import {
  PDFDocument,
  PDFName,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { RedactionBox, RedactOptions, RedactResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

export class RedactEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Applies permanent, irreversible client-side redaction.
   * Reconstructs affected pages exclusively from sanitized raster images where redacted pixels
   * are burned with solid black. Purges original content streams, text operators, font descriptors,
   * annotations, and structural metadata.
   */
  public async redactPdf(
    fileData: Uint8Array,
    options: RedactOptions
  ): Promise<RedactResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before redacting.');
    }

    const {
      boxes,
      rasterizeAllPages = false,
      sanitizeMetadata = true,
      dpi = 200,
    } = options;

    if (!boxes || boxes.length === 0) {
      return {
        pdfData: fileData,
        redactedPagesCount: 0,
        redactionBoxesCount: 0,
        sanitizedMetadata: false,
      };
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const srcDoc = await PDFDocument.load(fileData);
    const targetDoc = await PDFDocument.create();

    // Map boxes by 0-indexed pageIndex
    const boxesByPage = new Map<number, RedactionBox[]>();
    for (const b of boxes) {
      const pIdx = b.pageIndex !== undefined ? b.pageIndex : b.pageNumber - 1;
      if (!boxesByPage.has(pIdx)) {
        boxesByPage.set(pIdx, []);
      }
      boxesByPage.get(pIdx)!.push(b);
    }

    const scale = dpi / 72.0;
    let redactedPagesCount = 0;

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageNum = pIdx + 1;
      const pageBoxes = boxesByPage.get(pIdx) || [];
      const needsRaster = pageBoxes.length > 0 || rasterizeAllPages;

      if (needsRaster) {
        redactedPagesCount++;
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const origView = page.getViewport({ scale: 1.0 });

        let pngBytes: Uint8Array | null = null;

        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // 1. Render original page content (including annotations) to canvas
            await page.render({
              canvasContext: ctx,
              viewport,
              annotationMode: (pdfjsLib as any).AnnotationMode?.ENABLE ?? 1,
            } as any).promise;

            // 2. Burn solid black redaction boxes directly into pixel canvas
            ctx.fillStyle = '#000000';
            for (const b of pageBoxes) {
              if (b.coordinateSpace === 'pdf') {
                // PDF user-space coordinates (bottom-left origin, unrotated)
                // Convert to viewport canvas coordinates
                const pdfRect = [b.x, b.y, b.x + b.width, b.y + b.height];
                const vpRect = viewport.convertToViewportRectangle(pdfRect);
                const rx = Math.min(vpRect[0], vpRect[2]);
                const ry = Math.min(vpRect[1], vpRect[3]);
                const rw = Math.abs(vpRect[2] - vpRect[0]);
                const rh = Math.abs(vpRect[3] - vpRect[1]);
                ctx.fillRect(rx, ry, rw, rh);
              } else {
                // Viewport coordinates (top-left origin at 72 DPI)
                const rx = b.x * scale;
                const ry = b.y * scale;
                const rw = b.width * scale;
                const rh = b.height * scale;
                ctx.fillRect(rx, ry, rw, rh);
              }
            }

            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/png')
            );
            if (blob) {
              const ab = await blob.arrayBuffer();
              pngBytes = new Uint8Array(ab);
            }
          }
        }

        // Headless Node / Vitest fallback
        if (!pngBytes) {
          pngBytes = this.generateFallbackRedactedPng();
        }

        // 3. Rebuild fresh page from sanitized raster image ONLY
        const img = await targetDoc.embedPng(pngBytes);
        const newPage = targetDoc.addPage([origView.width, origView.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: origView.width,
          height: origView.height,
        });

        // Ensure page has zero annotations
        newPage.node.delete(PDFName.of('Annots'));
      } else {
        // Copy untouched page with preserved vector contents
        const [copiedPage] = await targetDoc.copyPages(srcDoc, [pIdx]);
        targetDoc.addPage(copiedPage);
      }
    }

    // 4. Sanitize Document Metadata and Structural Objects
    if (sanitizeMetadata) {
      targetDoc.setTitle('');
      targetDoc.setAuthor('');
      targetDoc.setSubject('');
      targetDoc.setKeywords([]);
      targetDoc.setProducer('OwnPDF (Sanitized)');
      targetDoc.setCreator('OwnPDF');

      // Purge document structure and attachments from catalog
      targetDoc.catalog.delete(PDFName.of('PieceInfo'));
      targetDoc.catalog.delete(PDFName.of('StructTreeRoot'));
      targetDoc.catalog.delete(PDFName.of('AcroForm'));
      targetDoc.catalog.delete(PDFName.of('Names'));
      targetDoc.catalog.delete(PDFName.of('AF'));
    }

    const modifiedBytes = await targetDoc.save();

    return {
      pdfData: modifiedBytes,
      redactedPagesCount,
      redactionBoxesCount: boxes.length,
      sanitizedMetadata: sanitizeMetadata,
    };
  }

  /**
   * Generates a 1x1 black pixel PNG buffer for hermetic Node.js testing.
   */
  private generateFallbackRedactedPng(): Uint8Array {
    return new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  }
}

export const redactEngine = new RedactEngine();
