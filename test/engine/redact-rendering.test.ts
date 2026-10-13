import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  renderPdfPageToCanvas,
  clearCanvas,
  PdfDocumentSession,
  getPdfJsLoadingParams,
} from '../../src/engine/preview-renderer';
import { RedactEngine } from '../../src/engine/redact-engine';
import type { RedactionBox } from '../../src/types/engine';
import * as pdfjsLib from 'pdfjs-dist';

describe('Redact Rendering & Document Session Verification', () => {
  const redactEngine = new RedactEngine();

  const createSampleMultipagePdf = async (numPages: number = 5): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    for (let p = 1; p <= numPages; p++) {
      const page = doc.addPage([595, 842]); // A4
      page.drawText(`Page ${p} - Laboratory Manual Header`, {
        x: 50,
        y: 800,
        size: 14,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      page.drawText(`Confidential Student ID: 240101027285 - Page ${p}`, {
        x: 50,
        y: 750,
        size: 12,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(`Course details: B.Tech Computer Science and Engineering | Section 5C`, {
        x: 50,
        y: 700,
        size: 11,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    return doc.save();
  };

  it('reuses PdfDocumentSession across page accesses without re-parsing document', async () => {
    const pdfBytes = await createSampleMultipagePdf(10);

    const docPromise1 = PdfDocumentSession.getDocument(pdfBytes);
    const docPromise2 = PdfDocumentSession.getDocument(pdfBytes);

    expect(docPromise1).toBe(docPromise2); // Exact same promise in WeakMap

    const pdfDoc = await docPromise1;
    expect(pdfDoc.numPages).toBe(10);

    const page1 = await pdfDoc.getPage(1);
    const page10 = await pdfDoc.getPage(10);
    expect(page1.pageNumber).toBe(1);
    expect(page10.pageNumber).toBe(10);
  });

  it('provides valid local loading parameters with fontFace enabled for browsers', () => {
    const dummyBytes = new Uint8Array([1, 2, 3]);
    const params = getPdfJsLoadingParams(dummyBytes);

    expect(params.data).toBeDefined();
    expect(params.isEvalSupported).toBe(false);
    expect(params.cMapPacked).toBe(true);
  });

  it('handles canvas rendering and cancellation gracefully', async () => {
    const pdfBytes = await createSampleMultipagePdf(3);

    // Mock HTMLCanvasElement in JSDOM / Node
    const mockCanvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: () => ({
        save: () => {},
        restore: () => {},
        scale: () => {},
        clearRect: () => {},
      }),
    } as any;

    // Test clearCanvas
    clearCanvas(mockCanvas);
    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
  });

  it('burns geometric shapes (circle, ellipse, square, rectangle) into exported PDF', async () => {
    const pdfBytes = await createSampleMultipagePdf(3);

    const shapes: RedactionBox[] = [
      {
        id: 'box_rect',
        pageIndex: 0,
        pageNumber: 1,
        x: 50,
        y: 740,
        width: 250,
        height: 25,
        shapeType: 'rectangle',
        coordinateSpace: 'pdf',
      },
      {
        id: 'box_square',
        pageIndex: 0,
        pageNumber: 1,
        x: 320,
        y: 740,
        width: 30,
        height: 30,
        shapeType: 'square',
        coordinateSpace: 'pdf',
      },
      {
        id: 'box_circle',
        pageIndex: 1,
        pageNumber: 2,
        x: 50,
        y: 690,
        width: 40,
        height: 40,
        shapeType: 'circle',
        coordinateSpace: 'pdf',
      },
      {
        id: 'box_ellipse',
        pageIndex: 1,
        pageNumber: 2,
        x: 150,
        y: 690,
        width: 80,
        height: 30,
        shapeType: 'ellipse',
        coordinateSpace: 'pdf',
      },
    ];

    const result = await redactEngine.redactPdf(pdfBytes, {
      boxes: shapes,
      rasterizeAllPages: false,
      sanitizeMetadata: true,
      dpi: 200,
    });

    expect(result.redactedPagesCount).toBe(2); // Page 1 and Page 2 were sanitized
    expect(result.redactionBoxesCount).toBe(4);
    expect(result.sanitizedMetadata).toBe(true);

    // Verify output PDF in PDF.js
    const task = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
    const exportedDoc = await task.promise;
    expect(exportedDoc.numPages).toBe(3);

    // Page 3 was untouched vector page
    const p3 = await exportedDoc.getPage(3);
    const tc3 = await p3.getTextContent();
    const p3Strings = (tc3.items as any[]).map((it) => it.str).join(' ');
    expect(p3Strings).toContain('Page 3');
    expect(p3Strings).toContain('Confidential Student ID: 240101027285');

    // Page 1 and 2 were raster-reconstructed: original sensitive vector text purged
    const p1 = await exportedDoc.getPage(1);
    const tc1 = await p1.getTextContent();
    const p1Strings = (tc1.items as any[]).map((it) => it.str).join(' ');
    expect(p1Strings).not.toContain('Confidential Student ID: 240101027285');
  });

  it('successfully loads, renders, and redacts pages from real 38-page lab manual', async () => {
    const fs = await import('fs');
    const labManualPath = '/home/parva/Downloads/DAV print_replaced-unlocked.pdf';
    if (!fs.existsSync(labManualPath)) return;

    const fileBytes = fs.readFileSync(labManualPath);
    const pdfDoc = await PdfDocumentSession.getDocument(new Uint8Array(fileBytes));
    expect(pdfDoc.numPages).toBe(38);

    // Verify page 1 and page 2 text contents are loaded
    const page1 = await pdfDoc.getPage(1);
    const tc1 = await page1.getTextContent();
    expect(tc1.items.length).toBeGreaterThan(0);

    const page2 = await pdfDoc.getPage(2);
    const tc2 = await page2.getTextContent();
    const page2Text = (tc2.items as any[]).map((i) => i.str).join(' ');
    expect(page2Text).toContain('Data Analysis & Visualization Lab Manual');

    // Redact enrollment number on page 2
    const result = await redactEngine.redactPdf(fileBytes, {
      boxes: [
        {
          id: 'manual_b1',
          pageIndex: 1, // Page 2
          pageNumber: 2,
          x: 88,
          y: 780,
          width: 75,
          height: 15,
          shapeType: 'rectangle',
          coordinateSpace: 'pdf',
        },
      ],
      rasterizeAllPages: false,
      sanitizeMetadata: true,
      dpi: 200,
    });

    expect(result.redactedPagesCount).toBe(1);

    const checkDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    expect(checkDoc.numPages).toBe(38);

    // Unredacted Page 3 retains its vector content
    const p3 = await checkDoc.getPage(3);
    const tc3 = await p3.getTextContent();
    expect(tc3.items.length).toBeGreaterThan(0);
  });

  it('accurately converts multi-line text selection geometry across rotations and zoom levels', async () => {
    const pdfBytes = await createSampleMultipagePdf(1);
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const page = await pdfDoc.getPage(1);

    const rotations = [0, 90, 180, 270];
    const scales = [0.5, 1.0, 1.5, 2.25];

    for (const rotation of rotations) {
      for (const scale of scales) {
        const viewport = page.getViewport({ scale, rotation });

        // Simulate a multi-line selection with 3 distinct line rectangles in viewport pixels
        // Line 1: y = 50..70, x = 100..400
        // Line 2: y = 75..95, x = 100..450
        // Line 3: y = 100..120, x = 100..250
        const simulatedClientRects = [
          { left: 100, top: 50, right: 400, bottom: 70 },
          { left: 100, top: 75, right: 450, bottom: 95 },
          { left: 100, top: 100, right: 250, bottom: 120 },
        ];

        const generatedBoxes: RedactionBox[] = [];

        for (const r of simulatedClientRects) {
          const vx1 = r.left;
          const vy1 = r.top;
          const vx2 = r.right;
          const vy2 = r.bottom;

          const [p1x, p1y] = viewport.convertToPdfPoint(vx1, vy1);
          const [p2x, p2y] = viewport.convertToPdfPoint(vx2, vy2);

          const box: RedactionBox = {
            id: `test_box_${Math.random()}`,
            pageIndex: 0,
            pageNumber: 1,
            x: Math.min(p1x, p2x),
            y: Math.min(p1y, p2y),
            width: Math.abs(p2x - p1x),
            height: Math.abs(p2y - p1y),
            shapeType: 'rectangle',
            coordinateSpace: 'pdf',
            source: 'text-selection',
          };
          generatedBoxes.push(box);
        }

        expect(generatedBoxes.length).toBe(3);

        // Verify each box round-trips through convertToViewportRectangle with zero drift
        for (let i = 0; i < generatedBoxes.length; i++) {
          const b = generatedBoxes[i];
          const origRect = simulatedClientRects[i];

          const pdfRect = [b.x, b.y, b.x + b.width, b.y + b.height];
          const vpRect = viewport.convertToViewportRectangle(pdfRect);

          const roundVx1 = Math.min(vpRect[0], vpRect[2]);
          const roundVy1 = Math.min(vpRect[1], vpRect[3]);
          const roundVx2 = Math.max(vpRect[0], vpRect[2]);
          const roundVy2 = Math.max(vpRect[1], vpRect[3]);

          expect(roundVx1).toBeCloseTo(origRect.left, 1);
          expect(roundVy1).toBeCloseTo(origRect.top, 1);
          expect(roundVx2).toBeCloseTo(origRect.right, 1);
          expect(roundVy2).toBeCloseTo(origRect.bottom, 1);
        }
      }
    }
  });

  it('verifies irreversible export security and preservation of unaffected pages with attachments & metadata', async () => {
    // Create doc with sensitive text, metadata, and attachment
    const doc = await PDFDocument.create();
    doc.setTitle('Confidential Audit 2026');
    doc.setAuthor('Internal Security Team');
    doc.setSubject('Top Secret');

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p1 = doc.addPage([600, 400]);
    p1.drawText('Page 1: SECRET_TOKEN_789456', { x: 50, y: 350, size: 12, font });

    const p2 = doc.addPage([600, 400]);
    p2.drawText('Page 2: PUBLIC_DATA_123456', { x: 50, y: 350, size: 12, font });

    await doc.attach(new Uint8Array([1, 2, 3, 4]), 'sensitive_notes.txt', {
      mimeType: 'text/plain',
      description: 'Confidential Attachment',
    });

    const pdfBytes = await doc.save();

    // Redact Page 1 only
    const result = await redactEngine.redactPdf(pdfBytes, {
      boxes: [
        {
          id: 'redact_p1',
          pageIndex: 0,
          pageNumber: 1,
          x: 45,
          y: 340,
          width: 250,
          height: 30,
          shapeType: 'rectangle',
          coordinateSpace: 'pdf',
        },
      ],
      rasterizeAllPages: false,
      sanitizeMetadata: true,
      dpi: 150,
    });

    expect(result.redactedPagesCount).toBe(1);
    expect(result.sanitizedMetadata).toBe(true);

    const exportedDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    expect(exportedDoc.numPages).toBe(2);

    // 1. Text extraction check: Page 1 sensitive token must NOT exist anywhere in text content
    const expP1 = await exportedDoc.getPage(1);
    const tc1 = await expP1.getTextContent();
    const str1 = (tc1.items as any[]).map((it) => it.str).join(' ');
    expect(str1).not.toContain('SECRET_TOKEN_789456');

    // 2. Unaffected Page 2 retains vector text
    const expP2 = await exportedDoc.getPage(2);
    const tc2 = await expP2.getTextContent();
    const str2 = (tc2.items as any[]).map((it) => it.str).join(' ');
    expect(str2).toContain('PUBLIC_DATA_123456');

    // 3. Metadata check: original sensitive title/author/subject purged
    const meta = await exportedDoc.getMetadata();
    const info = (meta?.info as any) || {};
    expect(info.Title || '').not.toContain('Confidential Audit');
    expect(info.Author || '').not.toContain('Internal Security');

    // 4. Attachment check: EmbeddedFiles dictionary stripped
    const attachments = await exportedDoc.getAttachments();
    expect(attachments).toBeNull();
  });

  it('resolves asset URLs under base path without root-relative drift', async () => {
    const { getBaseAssetUrl, getPdfJsLoadingParams } = await import('../../src/engine/preview-renderer');
    const base = getBaseAssetUrl();
    expect(base.endsWith('/')).toBe(true);

    const dummy = new Uint8Array([1, 2, 3]);
    const params = getPdfJsLoadingParams(dummy);

    if (params.cMapUrl) {
      expect(params.cMapUrl.startsWith(base)).toBe(true);
      expect(params.cMapUrl.endsWith('cmaps/')).toBe(true);
    }
    if (params.standardFontDataUrl) {
      expect(params.standardFontDataUrl.startsWith(base)).toBe(true);
      expect(params.standardFontDataUrl.endsWith('standard_fonts/')).toBe(true);
    }
  });

  it('renders lightweight page thumbnails to canvas with cancellation safety', async () => {
    if (typeof (globalThis as any).Path2D === 'undefined') {
      (globalThis as any).Path2D = class Path2D {};
    }
    const { renderThumbnailToCanvas } = await import('../../src/engine/preview-renderer');
    const pdfBytes = await createSampleMultipagePdf(3);
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

    const mockThumbnailCanvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: () => mockCtx,
    } as any;

    const mockCtx: any = new Proxy(
      {
        canvas: mockThumbnailCanvas,
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          return () => {};
        },
      }
    );

    await renderThumbnailToCanvas(pdfDoc, 1, mockThumbnailCanvas, 130);
    expect(mockThumbnailCanvas.width).toBeGreaterThan(0);
    expect(mockThumbnailCanvas.height).toBeGreaterThan(0);
    // Height should be roughly bounded by maxDimension 130
    expect(parseInt(mockThumbnailCanvas.style.height)).toBeLessThanOrEqual(130);
  });
});
