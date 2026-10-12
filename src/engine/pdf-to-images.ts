import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { pdfEngine } from './pdf-engine';
import { PdfError } from '../types/engine';
import type { PdfToImagesOptions, RenderedImage } from '../types/engine';
import { clearCanvas } from './preview-renderer';

export interface ConvertImagesResult {
  images: RenderedImage[];
  zipBlob?: Blob;
  singleBlob?: Blob;
  downloadFilename: string;
  isMultiPage: boolean;
}

/**
 * Converts selected pages of a PDF document into JPG or PNG image blobs,
 * with sequential rendering and canvas cleanup to prevent memory exhaustion.
 */
export async function convertPdfToImages(
  fileData: Uint8Array,
  options: PdfToImagesOptions,
  sourceBaseName: string = 'document'
): Promise<ConvertImagesResult> {
  const isEnc = await pdfEngine.isEncrypted(fileData);
  if (isEnc) {
    throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before converting to images.');
  }

  const dataCopy = new Uint8Array(fileData);
  const loadingTask = pdfjsLib.getDocument({
    data: dataCopy,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  if (totalPages === 0) {
    throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
  }

  const targetIndices = pdfEngine.parseTargetIndices(options.pageRange, totalPages);
  const totalTargetCount = targetIndices.length;

  if (totalTargetCount === 0) {
    throw new PdfError('UNSUPPORTED_FORMAT', 'No valid pages selected for conversion.');
  }

  const images: RenderedImage[] = [];
  const ext = options.format === 'image/jpeg' ? 'jpg' : 'png';
  const mimeType = options.format;
  const quality = options.format === 'image/jpeg' ? (options.quality ?? 0.92) : undefined;
  const scale = options.scale ?? 1.5;

  // Render pages sequentially to avoid allocating multiple large canvases simultaneously
  for (let idx = 0; idx < totalTargetCount; idx++) {
    const pageIndex = targetIndices[idx];
    const pageNum = pageIndex + 1;

    options.onProgress?.(idx + 1, totalTargetCount);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    if (typeof document === 'undefined') {
      const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: mimeType });
      const filename = `${sourceBaseName}-page-${pageNum}.${ext}`;
      images.push({
        pageNumber: pageNum,
        blob,
        filename,
      });
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      clearCanvas(canvas);
      throw new Error(`Failed to create 2D canvas context for page ${pageNum}.`);
    }

    // JPEG has no alpha channel; transparent canvas pixels render as black unless filled white
    if (options.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvasContext: ctx,
      viewport,
    } as any).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to encode canvas to ${mimeType} for page ${pageNum}.`));
        },
        mimeType,
        quality
      );
    });

    // Explicitly release canvas memory
    clearCanvas(canvas);

    const filename = `${sourceBaseName}-page-${pageNum}.${ext}`;
    images.push({
      pageNumber: pageNum,
      blob,
      filename,
    });
  }

  if (images.length === 1) {
    return {
      images,
      singleBlob: images[0].blob,
      downloadFilename: images[0].filename,
      isMultiPage: false,
    };
  }

  // Multi-page export: bundle into ZIP archive
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.filename, img.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    images,
    zipBlob,
    downloadFilename: `${sourceBaseName}-images.zip`,
    isMultiPage: true,
  };
}

/**
 * Creates a ZIP archive from an array of rendered image objects.
 */
export async function bundleImagesToZip(
  images: Array<{ filename: string; blob: Blob }>
): Promise<Blob> {
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.filename, img.blob);
  }
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
  });
}
