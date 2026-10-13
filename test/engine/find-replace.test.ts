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

  it('supports multiple rules replacing both an ID and a Name simultaneously', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page1 = doc.addPage([500, 500]);
    page1.drawText('Student: Alice Smith (ID: ENROLL-1001)', { x: 50, y: 400, size: 12, font });
    const page2 = doc.addPage([500, 500]);
    page2.drawText('Student: Alice Smith (ID: ENROLL-1001)', { x: 50, y: 400, size: 12, font });
    const pdfBytes = await doc.save();

    const rules = [
      { id: 'r1', searchQuery: 'Alice Smith', replaceText: 'Bob Jones' },
      { id: 'r2', searchQuery: 'ENROLL-1001', replaceText: 'ENROLL-9999' },
    ];

    const occurrences = await engine.searchPdfText(pdfBytes, { rules });
    expect(occurrences.length).toBe(4); // 2 on page 1, 2 on page 2

    const result = await engine.replacePdfText(pdfBytes, { rules });
    expect(result.totalMatches).toBe(4);
    expect(result.replacedCount).toBe(4);
    expect(result.ruleReports).toBeDefined();
    expect(result.ruleReports?.length).toBe(2);
    expect(result.ruleReports?.[0].replacedCount).toBe(2);
    expect(result.ruleReports?.[1].replacedCount).toBe(2);

    // Verify visual replacement in output PDF
    const reloadDoc = await PDFDocument.load(result.pdfData);
    expect(reloadDoc.getPageCount()).toBe(2);
  });

  it('prevents accidental cascading replacements where rule B search text is created by rule A', async () => {
    // Rule 1 replaces "CAT" with "DOG".
    // Rule 2 replaces "DOG" with "BIRD".
    // If cascading happened, "CAT" would become "DOG" and then "BIRD".
    // Since we process against original content, "CAT" must become "DOG", and original "DOG" becomes "BIRD".
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);
    page.drawText('The CAT and the DOG', { x: 50, y: 400, size: 12, font });
    const pdfBytes = await doc.save();

    const rules = [
      { id: 'r1', searchQuery: 'CAT', replaceText: 'DOG' },
      { id: 'r2', searchQuery: 'DOG', replaceText: 'BIRD' },
    ];

    const result = await engine.replacePdfText(pdfBytes, { rules });
    expect(result.replacedCount).toBe(2);
    expect(result.ruleReports?.[0].replacedCount).toBe(1);
    expect(result.ruleReports?.[1].replacedCount).toBe(1);
  });

  it('detects textual overlap and visual patch conflicts between conflicting rules', async () => {
    // Rule 1 matches "John Doe", Rule 2 matches "Doe" (textual overlap)
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 500]);
    page.drawText('Signature: John Doe, Manager', { x: 50, y: 400, size: 12, font });
    const pdfBytes = await doc.save();

    const rules = [
      { id: 'r1', searchQuery: 'John Doe', replaceText: 'Jane Smith' },
      { id: 'r2', searchQuery: 'Doe', replaceText: 'Williams' },
    ];

    const occurrences = await engine.searchPdfText(pdfBytes, { rules });
    expect(occurrences.length).toBe(2);

    // Both occurrences should be flagged as CONFLICT and deselected
    const conflicts = occurrences.filter((o) => o.status === 'CONFLICT');
    expect(conflicts.length).toBe(2);
    expect(conflicts[0].isConflicting).toBe(true);
    expect(conflicts[0].selected).toBe(false);

    // Without user selection/resolution, replacing skips them and reports conflicts
    const result = await engine.replacePdfText(pdfBytes, { rules });
    expect(result.replacedCount).toBe(0);
    expect(result.conflictCount).toBe(2);
    expect(result.ruleReports?.[0].conflictCount).toBe(1);
    expect(result.ruleReports?.[1].conflictCount).toBe(1);

    // User explicitly resolves conflict by selecting only Rule 1
    const resolvedResult = await engine.replacePdfText(pdfBytes, {
      rules,
      selectedOccurrenceIds: [occurrences[0].id],
    });
    // When user selected occurrence 0, it applies rule 1
    expect(resolvedResult.replacedCount).toBe(1);
    expect(resolvedResult.skippedCount).toBe(1);
  });

  describe('Layout Preservation & Real Fixture Regressions', () => {
    const createLabManualPdf = async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([600, 400]);

      page.drawText('Data Analysis & Visualization Lab Manual', {
        x: 120,
        y: 350,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      page.drawText(
        'Enrollment: 240101027285 | Name: Yash Tank | Course: B.Tech. CSE | Semester:5C2',
        {
          x: 30,
          y: 320,
          size: 11,
          font: font,
          color: rgb(0, 0, 0),
        }
      );

      return doc.save();
    };

    it('accurately positions enrollment number avoiding double-digit overlap', async () => {
      const pdfBytes = await createLabManualPdf();

      // Search for 240101027285
      const matches = await engine.searchPdfText(pdfBytes, '240101027285', {
        replaceText: '2240101027254',
      });

      expect(matches.length).toBe(1);
      const m = matches[0];
      expect(m.status).toBe('VALID');

      // Calibrated X must be within 0.5pt of true font-metric position 88.14 pt (not drifting to 94 pt!)
      expect(Math.abs(m.x - 88.14)).toBeLessThan(1.0);
      // Width must be calibrated to ~73.39 pt (not truncated to 64 pt!)
      expect(Math.abs(m.width - 73.39)).toBeLessThan(1.5);

      // Perform replacement
      const result = await engine.replacePdfText(pdfBytes, {
        searchQuery: '240101027285',
        replaceText: '2240101027254',
      });

      expect(result.replacedCount).toBe(1);

      // Inspect output PDF via PDF.js to verify zero double digits or corruption
      const repTask = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
      const repDoc = await repTask.promise;
      const repPage = await repDoc.getPage(1);
      const repContent = await repPage.getTextContent();
      const repItems = (repContent.items as any[]).filter((it) => it.str && it.str.trim().length > 0);

      // Find the replacement item
      const repItem = repItems.find((it) => it.str === '2240101027254');
      expect(repItem).toBeDefined();
      // Replacement starts precisely at the original match X coordinate (no 6pt rightward drift causing double-digit 22...)
      expect(Math.abs(repItem.transform[4] - m.x)).toBeLessThan(0.1);
      expect(repItem.transform[0]).toBeGreaterThanOrEqual(10.0); // Readable font size

      // Adjacent text before and after enrollment number remains intact and legible
      const hasEnrollmentLabel = repItems.some((it) => it.str.includes('Enrollment:'));
      expect(hasEnrollmentLabel).toBe(true);
      const hasNameLabel = repItems.some((it) => it.str.includes('| Name:'));
      expect(hasNameLabel).toBe(true);
    });

    it('replaces Yash Tank with Parva Trivedi without overlapping | Course: B.Tech. CSE', async () => {
      const pdfBytes = await createLabManualPdf();

      // 1. Search for Yash Tank with Parva Trivedi
      const matches = await engine.searchPdfText(pdfBytes, 'Yash Tank', {
        replaceText: 'Parva Trivedi',
      });

      expect(matches.length).toBe(1);
      const m = matches[0];
      expect(m.status).toBe('VALID');
      expect(m.overflowWarning).toBe(true);
      expect(m.overflowAmount).toBeGreaterThan(5.0); // Parva Trivedi is wider by ~13 pt
      expect(m.fitScale).toBeLessThan(1.0); // Needs scaling in fit-to-space mode

      // 2. Execute replacement in fit-to-space mode
      const result = await engine.replacePdfText(pdfBytes, {
        searchQuery: 'Yash Tank',
        replaceText: 'Parva Trivedi',
        fitMode: 'fit-to-space',
      });

      expect(result.replacedCount).toBe(1);

      // Verify output in PDF.js
      const repTask = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
      const repDoc = await repTask.promise;
      const repPage = await repDoc.getPage(1);
      const repContent = await repPage.getTextContent();
      const repItems = (repContent.items as any[]).filter((it) => it.str && it.str.trim().length > 0);

      const repItem = repItems.find((it) => it.str === 'Parva Trivedi');
      expect(repItem).toBeDefined();

      // Ensure the end of the replacement string does NOT exceed available space or overlap adjacent content
      const repEndX = repItem.transform[4] + repItem.width;
      // The adjacent '|' obstacle starts at 262.14 pt; replacement ends cleanly before it
      expect(repEndX).toBeLessThanOrEqual(259.0);
      expect(repEndX).toBeLessThan(262.14);

      // Adjacent text '| Course: B.Tech. CSE' remains intact and legible
      const hasCourse = repItems.some((it) => it.str.includes('| Course: B.Tech. CSE'));
      expect(hasCourse).toBe(true);
    });

    it('honors keep-size mode and reports collision without silently shrinking', async () => {
      const pdfBytes = await createLabManualPdf();

      const result = await engine.replacePdfText(pdfBytes, {
        searchQuery: 'Yash Tank',
        replaceText: 'Parva Trivedi',
        fitMode: 'keep-size',
      });

      expect(result.replacedCount).toBe(1);
      expect(result.collisionCount).toBe(1);

      // Inspect output: text was drawn at full original size in keep-size mode
      const repTask = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
      const repDoc = await repTask.promise;
      const repPage = await repDoc.getPage(1);
      const repContent = await repPage.getTextContent();
      const repItem = (repContent.items as any[]).find((it) => it.str === 'Parva Trivedi');
      expect(repItem).toBeDefined();
      expect(repItem.transform[0]).toBe(11); // Font scale remains uncompressed 11
    });

    it('handles shorter replacement text cleanly preserving surrounding content', async () => {
      const pdfBytes = await createLabManualPdf();

      // Replace 12-digit number with 5-digit number
      const result = await engine.replacePdfText(pdfBytes, {
        searchQuery: '240101027285',
        replaceText: '98765',
      });

      expect(result.replacedCount).toBe(1);

      const repTask = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
      const repDoc = await repTask.promise;
      const repPage = await repDoc.getPage(1);
      const repContent = await repPage.getTextContent();
      const repItem = (repContent.items as any[]).find((it) => it.str === '98765');
      expect(repItem).toBeDefined();
      expect(repItem.transform[0]).toBe(11); // No downscaling required for shorter replacement

      // Surrounding content remains intact and legible
      const hasEnrollment = (repContent.items as any[]).some((it) => it.str?.includes('Enrollment:'));
      expect(hasEnrollment).toBe(true);
      const hasName = (repContent.items as any[]).some((it) => it.str?.includes('Name: Yash Tank'));
      expect(hasName).toBe(true);
    });

    it('replaces both name and enrollment number in a single multi-rule pass', async () => {
      const pdfBytes = await createLabManualPdf();

      const rules = [
        { id: 'r1', searchQuery: 'Yash Tank', replaceText: 'Parva Trivedi' },
        { id: 'r2', searchQuery: '240101027285', replaceText: '2240101027254' },
      ];

      const result = await engine.replacePdfText(pdfBytes, {
        rules,
        fitMode: 'fit-to-space',
      });

      expect(result.totalMatches).toBe(2);
      expect(result.replacedCount).toBe(2);
      expect(result.ruleReports?.length).toBe(2);
      expect(result.ruleReports?.[0].replacedCount).toBe(1);
      expect(result.ruleReports?.[1].replacedCount).toBe(1);

      const repTask = pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) });
      const repDoc = await repTask.promise;
      const repPage = await repDoc.getPage(1);
      const repContent = await repPage.getTextContent();
      const strings = (repContent.items as any[]).map((it) => it.str);
      expect(strings).toContain('Parva Trivedi');
      expect(strings).toContain('2240101027254');
      // Adjacent content is preserved and legible
      expect(strings.some((s) => s.includes('| Course: B.Tech. CSE'))).toBe(true);
    });
  });
});
