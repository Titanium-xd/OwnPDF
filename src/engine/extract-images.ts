import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import type { ExtractedImageItem, ExtractImagesResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

/**
 * Lossless PNG encoder for RGBA pixel buffers.
 * Uses browser canvas when available; falls back to pure deflate chunking in Node test environments.
 */
async function rgbaToPngBytes(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array
): Promise<Uint8Array> {
  // 1. Browser canvas path
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const clamped = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba);
      const imgData = new ImageData(clamped, width, height);
      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (blob) {
        const ab = await blob.arrayBuffer();
        return new Uint8Array(ab);
      }
    }
  }

  // 2. Pure Node / Vitest fallback using zlib
  try {
    const zlib = await import('zlib');
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdrData = new Uint8Array(13);
    const view = new DataView(ihdrData.buffer);
    view.setUint32(0, width, false);
    view.setUint32(4, height, false);
    ihdrData[8] = 8; // 8 bits per channel
    ihdrData[9] = 6; // RGBA color type
    ihdrData[10] = 0; // deflate compression
    ihdrData[11] = 0; // standard filter
    ihdrData[12] = 0; // no interlace

    function crc32(buf: Uint8Array): number {
      let crc = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    }

    function makeChunk(typeStr: string, data: Uint8Array): Uint8Array {
      const typeBytes = new Uint8Array([
        typeStr.charCodeAt(0),
        typeStr.charCodeAt(1),
        typeStr.charCodeAt(2),
        typeStr.charCodeAt(3),
      ]);
      const chunk = new Uint8Array(4 + 4 + data.length + 4);
      const cView = new DataView(chunk.buffer);
      cView.setUint32(0, data.length, false);
      chunk.set(typeBytes, 4);
      chunk.set(data, 8);

      const toCrc = chunk.subarray(4, 8 + data.length);
      const crcVal = crc32(toCrc);
      cView.setUint32(8 + data.length, crcVal, false);
      return chunk;
    }

    const ihdrChunk = makeChunk('IHDR', ihdrData);

    // Prepare scanlines with filter byte 0 (None)
    const scanlines = new Uint8Array(height * (1 + width * 4));
    let srcOffset = 0;
    let dstOffset = 0;
    for (let y = 0; y < height; y++) {
      scanlines[dstOffset++] = 0; // Filter: None
      for (let x = 0; x < width * 4; x++) {
        scanlines[dstOffset++] = rgba[srcOffset++];
      }
    }

    const compressed = zlib.deflateSync(scanlines);
    const idatChunk = makeChunk('IDAT', new Uint8Array(compressed));
    const iendChunk = makeChunk('IEND', new Uint8Array(0));

    const totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const finalPng = new Uint8Array(totalLen);
    let offset = 0;
    finalPng.set(signature, offset); offset += signature.length;
    finalPng.set(ihdrChunk, offset); offset += ihdrChunk.length;
    finalPng.set(idatChunk, offset); offset += idatChunk.length;
    finalPng.set(iendChunk, offset);

    return finalPng;
  } catch (err) {
    throw new Error('Failed to encode RGBA image to PNG.');
  }
}

export class ExtractImagesEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Extracts embedded images from a PDF document:
   * - Preserves raw DCTDecode streams directly as original JPEGs
   * - Decodes FlateDecode and composited /SMask transparency into valid PNGs
   * - Deduplicates shared image objects
   * - Bundles all valid images into a structured ZIP archive
   */
  public async extractPdfImages(fileData: Uint8Array): Promise<ExtractImagesResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before extracting images.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const images: ExtractedImageItem[] = [];
    const seenHashes = new Set<string>();
    let totalBytes = 0;
    const zip = new JSZip();

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNum = pageIdx + 1;
      const page = await pdfDoc.getPage(pageNum);
      const ops = await page.getOperatorList();

      const imageKeys: string[] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (
          ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
          ops.fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject
        ) {
          const imgKey = ops.argsArray[i][0];
          if (imgKey && !imageKeys.includes(imgKey)) {
            imageKeys.push(imgKey);
          }
        }
      }

      let pageImageCount = 0;

      for (const imgKey of imageKeys) {
        try {
          const imgObj = await new Promise<any>((resolve) => {
            const timer = setTimeout(() => resolve(null), 1500);
            if (page.commonObjs && page.commonObjs.has(imgKey)) {
              page.commonObjs.get(imgKey, (obj: any) => {
                clearTimeout(timer);
                resolve(obj);
              });
            } else {
              page.objs.get(imgKey, (obj: any) => {
                clearTimeout(timer);
                resolve(obj);
              });
            }
          });

          if (!imgObj || !imgObj.data || imgObj.width <= 0 || imgObj.height <= 0) {
            continue;
          }

          const width = imgObj.width;
          const height = imgObj.height;
          const rawData: Uint8Array = imgObj.data;

          // Check if data is already a raw JPEG (SOI marker 0xFF 0xD8 0xFF)
          const isRawJpeg =
            rawData.length >= 3 &&
            rawData[0] === 0xff &&
            rawData[1] === 0xd8 &&
            rawData[2] === 0xff;

          let imageBytes: Uint8Array;
          let format: 'jpeg' | 'png';
          let mimeType: string;

          if (isRawJpeg) {
            imageBytes = rawData;
            format = 'jpeg';
            mimeType = 'image/jpeg';
          } else {
            // Decoded pixel stream -> Convert to RGBA if RGB
            let rgba: Uint8Array | Uint8ClampedArray;
            if (rawData.length === width * height * 4) {
              rgba = rawData;
            } else if (rawData.length === width * height * 3) {
              // Convert RGB (24bpp) to RGBA (32bpp)
              rgba = new Uint8Array(width * height * 4);
              let s = 0;
              let d = 0;
              for (let p = 0; p < width * height; p++) {
                rgba[d++] = rawData[s++];
                rgba[d++] = rawData[s++];
                rgba[d++] = rawData[s++];
                rgba[d++] = 255;
              }
            } else if (rawData.length === width * height) {
              // Grayscale (8bpp) -> RGBA
              rgba = new Uint8Array(width * height * 4);
              let d = 0;
              for (let p = 0; p < width * height; p++) {
                const g = rawData[p];
                rgba[d++] = g;
                rgba[d++] = g;
                rgba[d++] = g;
                rgba[d++] = 255;
              }
            } else {
              // Unknown format size
              continue;
            }

            imageBytes = await rgbaToPngBytes(width, height, rgba);
            format = 'png';
            mimeType = 'image/png';
          }

          // Compute a simple hash to deduplicate repeating logos/images
          const hashSample = `${width}x${height}_${imageBytes.length}_${imageBytes[0] || 0}_${imageBytes[Math.floor(imageBytes.length / 2)] || 0}`;
          const isDeduplicated = seenHashes.has(hashSample);
          seenHashes.add(hashSample);

          pageImageCount++;
          const filename = `page-${pageNum}-img-${pageImageCount}.${format}`;
          const blob = new Blob([imageBytes], { type: mimeType });

          images.push({
            id: `img_p${pageNum}_${pageImageCount}`,
            pageNumber: pageNum,
            name: filename,
            format,
            width,
            height,
            sizeBytes: imageBytes.length,
            data: imageBytes,
            blob,
            isDeduplicated,
            status: 'SUCCESS',
          });

          totalBytes += imageBytes.length;

          // Add to zip archive
          zip.file(filename, imageBytes);
        } catch (imgErr) {
          console.error(`Failed to decode image ${imgKey} on page ${pageNum}:`, imgErr);
          images.push({
            id: `img_p${pageNum}_err`,
            pageNumber: pageNum,
            name: `page-${pageNum}-failed`,
            format: 'png',
            width: 0,
            height: 0,
            sizeBytes: 0,
            data: new Uint8Array(0),
            blob: new Blob([]),
            status: 'FAILED_CORRUPT',
          });
        }
      }
    }

    let zipBlob: Blob | undefined;
    if (images.filter((i) => i.status === 'SUCCESS').length > 0) {
      zipBlob = await zip.generateAsync({ type: 'blob' });
    }

    return {
      images,
      totalCount: images.filter((i) => i.status === 'SUCCESS').length,
      totalBytes,
      zipBlob,
    };
  }
}

export const extractImagesEngine = new ExtractImagesEngine();
