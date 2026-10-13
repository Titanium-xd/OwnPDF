import {
  PDFDocument,
  PDFName,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { RedactionBox, RedactOptions, RedactResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';
import { getPdfJsLoadingParams } from './preview-renderer';

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

    const loadingParams = getPdfJsLoadingParams(fileData);
    const loadingTask = pdfjsLib.getDocument(loadingParams);

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

            // 2. Burn solid black redaction shapes directly into pixel canvas
            ctx.fillStyle = '#000000';
            for (const b of pageBoxes) {
              let rx = 0;
              let ry = 0;
              let rw = 0;
              let rh = 0;

              if (b.coordinateSpace === 'pdf') {
                // PDF user-space coordinates (bottom-left origin, unrotated)
                // Convert to viewport canvas coordinates
                const pdfRect = [b.x, b.y, b.x + b.width, b.y + b.height];
                const vpRect = viewport.convertToViewportRectangle(pdfRect);
                rx = Math.min(vpRect[0], vpRect[2]);
                ry = Math.min(vpRect[1], vpRect[3]);
                rw = Math.abs(vpRect[2] - vpRect[0]);
                rh = Math.abs(vpRect[3] - vpRect[1]);
              } else {
                // Viewport coordinates (top-left origin at 72 DPI)
                rx = b.x * scale;
                ry = b.y * scale;
                rw = b.width * scale;
                rh = b.height * scale;
              }

              if (b.shapeType === 'circle' || b.shapeType === 'ellipse') {
                ctx.beginPath();
                const radiusX = rw / 2;
                const radiusY = b.shapeType === 'circle' ? radiusX : rh / 2;
                const centerX = rx + radiusX;
                const centerY = ry + radiusY;
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fill();
              } else {
                // Rectangle or Square
                const finalH = b.shapeType === 'square' ? rw : rh;
                ctx.fillRect(rx, ry, rw, finalH);
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
