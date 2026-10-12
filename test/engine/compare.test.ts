import { describe, it, expect } from 'vitest';
import { CompareEngine } from '../../src/engine/compare-engine';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('CompareEngine Verification', () => {
  const engine = new CompareEngine();
  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('detects 100% identity when comparing identical documents', async () => {
    const fileBytes = fs.readFileSync(unencPath);
    const result = await engine.comparePdfs(fileBytes, fileBytes);

    expect(result.docAPageCount).toBe(2);
    expect(result.docBPageCount).toBe(2);
    expect(result.identicalPageCount).toBe(2);
    expect(result.differentPageCount).toBe(0);
    expect(result.pageComparisons[0].status).toBe('IDENTICAL');
    expect(result.pageComparisons[0].similarityScore).toBe(100);
  });

  it('detects text differences between documents with altered content', async () => {
    const docA = await PDFDocument.create();
    const font = await docA.embedFont(StandardFonts.Helvetica);
    const pageA = docA.addPage([500, 500]);
    pageA.drawText('Invoice Total: $100.00', { x: 50, y: 400, size: 12, font });
    const bytesA = await docA.save();

    const docB = await PDFDocument.create();
    const pageB = docB.addPage([500, 500]);
    const fontB = await docB.embedFont(StandardFonts.Helvetica);
    pageB.drawText('Invoice Total: $250.00', { x: 50, y: 400, size: 12, font: fontB });
    const bytesB = await docB.save();

    const result = await engine.comparePdfs(bytesA, bytesB);
    expect(result.differentPageCount).toBe(1);
    expect(result.pageComparisons[0].hasTextDiff).toBe(true);
    expect(result.pageComparisons[0].textDiffLines.some((l) => l.type === 'removed')).toBe(true);
    expect(result.pageComparisons[0].textDiffLines.some((l) => l.type === 'added')).toBe(true);
  });

  it('handles unequal page counts correctly without crashing', async () => {
    const docA = await PDFDocument.create();
    docA.addPage([500, 500]);
    docA.addPage([500, 500]);
    docA.addPage([500, 500]); // 3 pages
    const bytesA = await docA.save();

    const docB = await PDFDocument.create();
    docB.addPage([500, 500]); // 1 page
    const bytesB = await docB.save();

    const result = await engine.comparePdfs(bytesA, bytesB);
    expect(result.docAPageCount).toBe(3);
    expect(result.docBPageCount).toBe(1);
    expect(result.totalEvaluatedPages).toBe(3);
    expect(result.pageComparisons[1].status).toBe('ONLY_IN_A');
    expect(result.pageComparisons[2].status).toBe('ONLY_IN_A');
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const unencBytes = fs.readFileSync(unencPath);
    const encBytes = fs.readFileSync(encPath);

    await expect(
      engine.comparePdfs(unencBytes, encBytes)
    ).rejects.toThrow(/unlock password-protected documents/i);
  });
});
