import { describe, it, expect } from 'vitest';
import { FindReplaceEngine } from '../../src/engine/find-replace';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';

describe('FindReplaceEngine PoC & Validation', () => {
  const engine = new FindReplaceEngine();
  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('locates text occurrences in standard PDF and detects matches accurately', async () => {
    const fileBytes = fs.readFileSync(unencPath);
    const matches = await engine.searchPdfText(fileBytes, 'Synthetic Document');

    expect(matches.length).toBe(2); // Page 1 and Page 2
    expect(matches[0].pageNumber).toBe(1);
    expect(matches[0].status).toBe('VALID');
    expect(matches[0].x).toBeGreaterThan(0);
    expect(matches[0].width).toBeGreaterThan(0);
    expect(matches[0].snippet).toContain('Synthetic Document');

    expect(matches[1].pageNumber).toBe(2);
    expect(matches[1].status).toBe('VALID');
  });

  it('handles case-sensitive vs case-insensitive searches', async () => {
    const fileBytes = fs.readFileSync(unencPath);

    const sensitiveMatches = await engine.searchPdfText(fileBytes, 'synthetic document', {
      matchCase: true,
    });
    expect(sensitiveMatches.length).toBe(0);

    const insensitiveMatches = await engine.searchPdfText(fileBytes, 'synthetic document', {
      matchCase: false,
    });
    expect(insensitiveMatches.length).toBe(2);
  });

  it('detects fragmented text spanning multiple items across a line', async () => {
    // Generate a synthetic PDF where text is split across multiple separate draws on the same line
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);

    // Item 1: "Fragmented " at x=50, y=400
    page.drawText('Fragmented ', { x: 50, y: 400, size: 14, font });
    // Item 2: "Text " at x=135, y=400
    page.drawText('Text ', { x: 135, y: 400, size: 14, font });
    // Item 3: "Target" at x=175, y=400
    page.drawText('Target', { x: 175, y: 400, size: 14, font });

    const pdfBytes = await doc.save();

    // Search for the full multi-item phrase "Fragmented Text Target"
    const matches = await engine.searchPdfText(pdfBytes, 'Fragmented Text Target');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('VALID');
    expect(matches[0].text).toBe('Fragmented Text Target');
    expect(matches[0].x).toBeCloseTo(50, 0);
    expect(matches[0].width).toBeGreaterThan(150);
  });

  it('flags layout collision warning when replacement text is significantly longer than original', async () => {
    const fileBytes = fs.readFileSync(unencPath);

    // Short query "Page" (4 chars) replaced with long sentence
    const occurrences = await engine.searchPdfText(fileBytes, 'Page', {
      replaceText: 'This is an exceptionally long replacement string that exceeds boundary',
    });

    expect(occurrences.length).toBeGreaterThan(0);
    const withCollision = occurrences.filter((o) => o.collisionWarning);
    expect(withCollision.length).toBe(occurrences.length); // All should be flagged
  });

  it('supports selective replacement of chosen occurrences', async () => {
    const fileBytes = fs.readFileSync(unencPath);

    const allMatches = await engine.searchPdfText(fileBytes, 'Synthetic Document');
    expect(allMatches.length).toBe(2);

    // Only replace occurrence #1 (Page 1)
    const result = await engine.replacePdfText(fileBytes, {
      searchQuery: 'Synthetic Document',
      replaceText: 'Verified Replacement',
      selectedOccurrenceIds: [allMatches[0].id],
    });

    expect(result.totalMatches).toBe(2);
    expect(result.replacedCount).toBe(1);
    expect(result.skippedCount).toBe(1);

    // Verify output: reopen with pdfjs and inspect extracted text
    const loading = pdfjsLib.getDocument({
      data: new Uint8Array(result.pdfData),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const loadedPdf = await loading.promise;
    const page1 = await loadedPdf.getPage(1);
    const tc1 = await page1.getTextContent();
    const page1Str = tc1.items.map((it: any) => it.str).join(' ');

    // Replacement text is stamped on page 1
    expect(page1Str).toContain('Verified Replacement');

    // Crucial check: Visual masking does NOT erase underlying stream!
    // Page 1 still contains original stream operator or both strings
    expect(page1Str).toContain('Synthetic Document');
  });

  it('supports non-white custom background patch colors', async () => {
    // Document with colored background card
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);
    // Draw background rectangle
    page.drawRectangle({ x: 50, y: 350, width: 300, height: 100, color: rgb(0.2, 0.4, 0.8) });
    page.drawText('Card Content', { x: 70, y: 400, size: 16, font, color: rgb(1, 1, 1) });
    const pdfBytes = await doc.save();

    // Replace with matching blue background patch
    const result = await engine.replacePdfText(pdfBytes, {
      searchQuery: 'Card Content',
      replaceText: 'Updated Content',
      backgroundColor: { r: 51, g: 102, b: 204 }, // blue patch
    });

    expect(result.replacedCount).toBe(1);
    expect(result.pdfData.length).toBeGreaterThan(0);
  });

  it('correctly handles rotated pages (90, 180, 270 degrees)', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.setRotation(degrees(90));
    page.drawText('Rotated Page Target', { x: 100, y: 300, size: 16, font });
    const pdfBytes = await doc.save();

    const matches = await engine.searchPdfText(pdfBytes, 'Rotated Page Target');
    expect(matches.length).toBe(1);
    expect(matches[0].rotation).toBe(90);
    expect(matches[0].status).toBe('VALID');

    const result = await engine.replacePdfText(pdfBytes, {
      searchQuery: 'Rotated Page Target',
      replaceText: 'Rotated Replacement',
    });

    expect(result.replacedCount).toBe(1);
    expect(result.pdfData.length).toBeGreaterThan(0);
  });

  it('rejects sheared/complex text matrices as UNSUPPORTED_LAYOUT', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);
    // Draw angled text with transformation matrix
    page.drawText('Angled Text Target', {
      x: 100,
      y: 200,
      size: 16,
      font,
      rotate: degrees(45), // Angled matrix: shearX and shearY will be non-zero
    });
    const pdfBytes = await doc.save();

    const matches = await engine.searchPdfText(pdfBytes, 'Angled Text Target');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('UNSUPPORTED_LAYOUT');

    // Attempting replacement should skip this unsupported match
    const result = await engine.replacePdfText(pdfBytes, {
      searchQuery: 'Angled Text Target',
      replaceText: 'Safe Replacement',
    });
    expect(result.replacedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('rejects encrypted PDF with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      engine.searchPdfText(encBytes, 'Test')
    ).rejects.toThrow(/unlock the document/i);
  });

  it('rejects empty search query gracefully', async () => {
    const fileBytes = fs.readFileSync(unencPath);
    const matches = await engine.searchPdfText(fileBytes, '   ');
    expect(matches).toEqual([]);

    await expect(
      engine.replacePdfText(fileBytes, { searchQuery: '', replaceText: 'Test' })
    ).rejects.toThrow(/Search query cannot be empty/i);
  });
});
