import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';

describe('Delete Blank Pages Engine & Candidate Detector', () => {
  const engine = new PdfEngine();
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('correctly calculates ink coverage: ignores opaque white paper and transparency', () => {
    // 100 pixels total (400 bytes RGBA)
    const totalPixels = 100;
    const buffer = new Uint8ClampedArray(totalPixels * 4);

    // Scenario 1: All pixels are opaque white (R=255, G=255, B=255, A=255)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 255;
      buffer[i + 1] = 255;
      buffer[i + 2] = 255;
      buffer[i + 3] = 255;
    }
    expect(PdfEngine.calculateInkCoverage(buffer)).toBe(0.0);

    // Scenario 2: All pixels are fully transparent (A=0)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 0;
      buffer[i + 1] = 0;
      buffer[i + 2] = 0;
      buffer[i + 3] = 0;
    }
    expect(PdfEngine.calculateInkCoverage(buffer)).toBe(0.0);

    // Scenario 3: Near-white / cream paper background (R=245, G=248, B=242, A=255)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 245;
      buffer[i + 1] = 248;
      buffer[i + 2] = 242;
      buffer[i + 3] = 255;
    }
    expect(PdfEngine.calculateInkCoverage(buffer)).toBe(0.0);

    // Scenario 4: Scanner noise (1 pixel has dark ink out of 100 pixels = 1%)
    buffer[0] = 50;  // R
    buffer[1] = 50;  // G
    buffer[2] = 50;  // B
    buffer[3] = 255; // A
    expect(PdfEngine.calculateInkCoverage(buffer)).toBe(1.0);
  });

  it('detects blank pages, distinguishes invisible text, and preserves minimal content', async () => {
    // Build a 4-page test PDF:
    // Page 1: Standard text
    // Page 2: Truly blank page (no text items)
    // Page 3: Invisible/OCR text layer (white text on white)
    // Page 4: Small but meaningful content (just "12")
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Page 1: Content
    const p1 = doc.addPage([400, 400]);
    p1.drawText('Normal Document Header', { x: 50, y: 350, size: 14, font });

    // Page 2: Truly blank
    doc.addPage([400, 400]);

    // Page 3: Invisible OCR text (white text)
    const p3 = doc.addPage([400, 400]);
    p3.drawText('OCR Scanned Hidden Layer', {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(1, 1, 1),
    });

    // Page 4: Minimal meaningful content (tiny page number "12")
    const p4 = doc.addPage([400, 400]);
    p4.drawText('12', { x: 200, y: 30, size: 9, font });

    const pdfBytes = await doc.save();

    const detection = await engine.detectBlankPages(pdfBytes);
    expect(detection.totalPages).toBe(4);
    expect(detection.candidates.length).toBe(4);

    const [c1, c2, c3, c4] = detection.candidates;

    // Page 1: has text glyphs -> HAS_CONTENT
    expect(c1.textGlyphCount).toBeGreaterThan(0);
    expect(c1.status).toBe('HAS_CONTENT');
    expect(c1.selected).toBe(false);

    // Page 2: zero text glyphs -> HIGH_CONFIDENCE_BLANK
    expect(c2.textGlyphCount).toBe(0);
    expect(c2.status).toBe('HIGH_CONFIDENCE_BLANK');
    expect(c2.selected).toBe(true);

    // Page 3: invisible OCR text has glyphs -> HAS_CONTENT (not falsely flagged as blank!)
    expect(c3.textGlyphCount).toBeGreaterThan(0);
    expect(c3.status).toBe('HAS_CONTENT');
    expect(c3.selected).toBe(false);

    // Page 4: minimal content has glyphs -> HAS_CONTENT
    expect(c4.textGlyphCount).toBeGreaterThan(0);
    expect(c4.status).toBe('HAS_CONTENT');
    expect(c4.selected).toBe(false);
  });

  it('deletes selected blank pages and verifies resulting document binary', async () => {
    // 3-page document: Page 1, Blank Page 2, Page 3
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p1 = doc.addPage([400, 400]);
    p1.drawText('First Sheet', { x: 50, y: 350, size: 14, font });
    doc.addPage([400, 400]); // Blank
    const p3 = doc.addPage([400, 400]);
    p3.drawText('Third Sheet', { x: 50, y: 350, size: 14, font });

    const pdfBytes = await doc.save();

    // Delete index 1 (Page 2)
    const cleanedBytes = await engine.deletePages(pdfBytes, [1]);

    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(cleanedBytes),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdf = await loading.promise;
    expect(pdf.numPages).toBe(2);

    const tc1 = await (await pdf.getPage(1)).getTextContent();
    const tc2 = await (await pdf.getPage(2)).getTextContent();
    expect(tc1.items.map((it: any) => it.str).join(' ')).toContain('First Sheet');
    expect(tc2.items.map((it: any) => it.str).join(' ')).toContain('Third Sheet');
  });

  it('rejects attempt to delete all pages in document', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const pdfBytes = await doc.save();

    await expect(engine.deletePages(pdfBytes, [0])).rejects.toThrow(
      /Cannot delete all pages/i
    );
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(engine.detectBlankPages(encBytes)).rejects.toThrow(
      /unlock the document/i
    );
  });
});
