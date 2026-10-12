import { describe, it, expect } from 'vitest';
import { DuplicatePagesEngine } from '../../src/engine/duplicate-pages-engine';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

describe('DuplicatePagesEngine Verification', () => {
  const engine = new DuplicatePagesEngine();

  it('accurately identifies duplicate pages based on textual and visual fingerprints', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Page 1: Content A
    const p1 = doc.addPage([500, 500]);
    p1.drawText('Quarterly Financial Summary 2026', { x: 50, y: 400, size: 14, font });

    // Page 2: Content B
    const p2 = doc.addPage([500, 500]);
    p2.drawText('Appendix and Disclaimers Section', { x: 50, y: 400, size: 14, font });

    // Page 3: Exact duplicate of Page 1
    const p3 = doc.addPage([500, 500]);
    p3.drawText('Quarterly Financial Summary 2026', { x: 50, y: 400, size: 14, font });

    // Page 4: Another exact duplicate of Page 1
    const p4 = doc.addPage([500, 500]);
    p4.drawText('Quarterly Financial Summary 2026', { x: 50, y: 400, size: 14, font });

    const originalBytes = await doc.save();

    const detection = await engine.detectDuplicatePages(originalBytes);

    expect(detection.totalDuplicatesDetected).toBe(2);
    expect(detection.groups.length).toBe(1);

    const group = detection.groups[0];
    expect(group.originalPageNumber).toBe(1);
    expect(group.duplicatePageNumbers).toEqual([3, 4]);
    expect(group.confidence).toBe(100);

    // Verify candidates list
    const p1Cand = detection.candidates.find((c) => c.pageNumber === 1);
    expect(p1Cand?.isOriginal).toBe(true);
    expect(p1Cand?.selectedForDeletion).toBe(false);

    const p3Cand = detection.candidates.find((c) => c.pageNumber === 3);
    expect(p3Cand?.isOriginal).toBe(false);
    expect(p3Cand?.selectedForDeletion).toBe(true);
    expect(p3Cand?.duplicateOfPageNumber).toBe(1);

    const p4Cand = detection.candidates.find((c) => c.pageNumber === 4);
    expect(p4Cand?.isOriginal).toBe(false);
    expect(p4Cand?.selectedForDeletion).toBe(true);

    // 2. Remove detected duplicates (pages 3 and 4 -> 0-indexed 2 and 3)
    const cleanedBytes = await engine.removeDuplicates(originalBytes, [2, 3]);

    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(cleanedBytes) }).promise;
    expect(pdfDoc.numPages).toBe(2);

    // Page 1 should still be Summary, Page 2 should still be Appendix
    const page1 = await pdfDoc.getPage(1);
    const text1 = (await page1.getTextContent()).items.map((i: any) => i.str || '').join(' ');
    expect(text1).toContain('Quarterly Financial Summary 2026');

    const page2 = await pdfDoc.getPage(2);
    const text2 = (await page2.getTextContent()).items.map((i: any) => i.str || '').join(' ');
    expect(text2).toContain('Appendix and Disclaimers Section');
  });

  it('handles single-page or empty duplicate sets cleanly', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const bytes = await doc.save();

    const result = await engine.detectDuplicatePages(bytes);
    expect(result.groups.length).toBe(0);
    expect(result.totalDuplicatesDetected).toBe(0);
  });
});
