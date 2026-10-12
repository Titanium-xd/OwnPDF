import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Resize Tool', () => {
  const engine = new PdfEngine();
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('resizes document to standard A4 in Fit mode with margins', async () => {
    // Create US Letter doc: [612, 792]
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText('US Letter Source Content', { x: 50, y: 700, size: 14, font });
    const letterBytes = await doc.save();

    const a4Bytes = await engine.resizePdf(letterBytes, {
      targetSize: 'A4',
      mode: 'fit',
      margin: 20,
    });

    const verifiedDoc = await PDFDocument.load(a4Bytes);
    expect(verifiedDoc.getPageCount()).toBe(1);
    const pageSize = verifiedDoc.getPage(0).getSize();

    expect(pageSize.width).toBeCloseTo(595.28, 1);
    expect(pageSize.height).toBeCloseTo(841.89, 1);

    // Verify content text is present
    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(a4Bytes),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdf = await loading.promise;
    const tc = await (await pdf.getPage(1)).getTextContent();
    expect(tc.items.map((it: any) => it.str).join(' ')).toContain('US Letter Source Content');
  });

  it('resizes in Fill & Crop mode', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 400]);
    page.drawText('Fill Crop Test', { x: 50, y: 350, size: 14, font });
    const bytes = await doc.save();

    const resizedBytes = await engine.resizePdf(bytes, {
      targetSize: { width: 300, height: 600 },
      mode: 'fill-crop',
    });

    const verifiedDoc = await PDFDocument.load(resizedBytes);
    const size = verifiedDoc.getPage(0).getSize();
    expect(size.width).toBe(300);
    expect(size.height).toBe(600);
  });

  it('resizes in Canvas Extension mode (100% scale without scaling content)', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 300]);
    page.drawText('Canvas Test', { x: 50, y: 250, size: 14, font });
    const bytes = await doc.save();

    const expandedBytes = await engine.resizePdf(bytes, {
      targetSize: { width: 600, height: 600 },
      mode: 'canvas',
    });

    const verifiedDoc = await PDFDocument.load(expandedBytes);
    const size = verifiedDoc.getPage(0).getSize();
    expect(size.width).toBe(600);
    expect(size.height).toBe(600);
  });

  it('correctly respects landscape and portrait orientation requests', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);
    page.drawText('Orient Test', { x: 50, y: 450, size: 14, font });
    const bytes = await doc.save();

    // Force landscape A4
    const landscapeBytes = await engine.resizePdf(bytes, {
      targetSize: 'A4',
      mode: 'fit',
      orientation: 'landscape',
    });
    const lDoc = await PDFDocument.load(landscapeBytes);
    const lSize = lDoc.getPage(0).getSize();
    expect(lSize.width).toBeGreaterThan(lSize.height);

    // Force portrait A4
    const portraitBytes = await engine.resizePdf(bytes, {
      targetSize: 'A4',
      mode: 'fit',
      orientation: 'portrait',
    });
    const pDoc = await PDFDocument.load(portraitBytes);
    const pSize = pDoc.getPage(0).getSize();
    expect(pSize.height).toBeGreaterThan(pSize.width);
  });

  it('handles rotated source pages correctly', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.setRotation(degrees(90));
    page.drawText('Rotated Source', { x: 50, y: 50, size: 12, font });
    const bytes = await doc.save();

    const resizedBytes = await engine.resizePdf(bytes, {
      targetSize: 'A4',
      mode: 'fit',
    });

    const verifiedDoc = await PDFDocument.load(resizedBytes);
    const size = verifiedDoc.getPage(0).getSize();
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(size.height).toBeCloseTo(841.89, 1);
  });

  it('handles empty pages with missing contents stream gracefully', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]); // No drawing -> no Contents stream
    const emptyBytes = await doc.save();

    const resizedBytes = await engine.resizePdf(emptyBytes, {
      targetSize: 'A4',
      mode: 'fit',
    });

    const verifiedDoc = await PDFDocument.load(resizedBytes);
    expect(verifiedDoc.getPageCount()).toBe(1);
    expect(verifiedDoc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      engine.resizePdf(encBytes, { targetSize: 'A4', mode: 'fit' })
    ).rejects.toThrow(/unlock the document/i);
  });
});
