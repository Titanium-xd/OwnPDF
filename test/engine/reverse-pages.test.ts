import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Reverse Pages Tool', () => {
  const engine = new PdfEngine();
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('reverses all pages in a multi-page document (N -> 1) and verifies page content order', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const reversedBytes = await engine.reversePdfPages(fileBytes, { mode: 'all' });

    // Inspect the generated binary with pdfjs-dist
    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(reversedBytes),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdfDoc = await loading.promise;
    expect(pdfDoc.numPages).toBe(5);

    // Extract text from each page to verify identifiable text order
    const pageTexts: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      pageTexts.push(tc.items.map((it: any) => it.str).join(' '));
    }

    // Original: 1, 2, 3, 4, 5 -> Reversed: 5, 4, 3, 2, 1
    expect(pageTexts[0]).toContain('Document Page 5 of 5');
    expect(pageTexts[1]).toContain('Document Page 4 of 5');
    expect(pageTexts[2]).toContain('Document Page 3 of 5');
    expect(pageTexts[3]).toContain('Document Page 2 of 5');
    expect(pageTexts[4]).toContain('Document Page 1 of 5');
  });

  it('reverses only a specific page range (e.g. 2-4), keeping remaining pages in place', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const reversedBytes = await engine.reversePdfPages(fileBytes, {
      mode: 'range',
      pageRange: '2-4',
    });

    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(reversedBytes),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdfDoc = await loading.promise;
    expect(pdfDoc.numPages).toBe(5);

    const pageTexts: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      pageTexts.push(tc.items.map((it: any) => it.str).join(' '));
    }

    // Expected order: 1, 4, 3, 2, 5
    expect(pageTexts[0]).toContain('Document Page 1 of 5');
    expect(pageTexts[1]).toContain('Document Page 4 of 5');
    expect(pageTexts[2]).toContain('Document Page 3 of 5');
    expect(pageTexts[3]).toContain('Document Page 2 of 5');
    expect(pageTexts[4]).toContain('Document Page 5 of 5');
  });

  it('reverses duplex back-pages correctly', async () => {
    // Build a 6-page test document: Page 1, 2, 3, 4, 5, 6
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 6; i++) {
      const page = doc.addPage([400, 400]);
      page.drawText(`Sheet Page ${i}`, { x: 50, y: 350, size: 16, font });
    }
    const sixPageBytes = await doc.save();

    // Odd front pages: 1, 3, 5. Even back pages: 2, 4, 6 (inverted to 6, 4, 2)
    // Resulting interleave: 1, 6, 3, 4, 5, 2
    const reversedBytes = await engine.reversePdfPages(sixPageBytes, {
      mode: 'duplex-inverted',
    });

    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(reversedBytes),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdfDoc = await loading.promise;
    expect(pdfDoc.numPages).toBe(6);

    const pageTexts: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      pageTexts.push(tc.items.map((it: any) => it.str).join(' '));
    }

    expect(pageTexts[0]).toContain('Sheet Page 1');
    expect(pageTexts[1]).toContain('Sheet Page 6');
    expect(pageTexts[2]).toContain('Sheet Page 3');
    expect(pageTexts[3]).toContain('Sheet Page 4');
    expect(pageTexts[4]).toContain('Sheet Page 5');
    expect(pageTexts[5]).toContain('Sheet Page 2');
  });

  it('preserves document metadata (Title, Author, Subject)', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.setTitle('Metadata Test Doc');
    doc.setAuthor('Test Author');
    doc.setSubject('Reversal Verification');

    const p1 = doc.addPage([300, 300]);
    p1.drawText('First', { x: 50, y: 250, size: 12, font });
    const p2 = doc.addPage([300, 300]);
    p2.drawText('Second', { x: 50, y: 250, size: 12, font });
    const originalBytes = await doc.save();

    const reversedBytes = await engine.reversePdfPages(originalBytes, { mode: 'all' });
    const verifiedDoc = await PDFDocument.load(reversedBytes);

    expect(verifiedDoc.getTitle()).toBe('Metadata Test Doc');
    expect(verifiedDoc.getAuthor()).toBe('Test Author');
    expect(verifiedDoc.getSubject()).toBe('Reversal Verification');
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      engine.reversePdfPages(encBytes, { mode: 'all' })
    ).rejects.toThrow(/unlock the document/i);
  });
});
