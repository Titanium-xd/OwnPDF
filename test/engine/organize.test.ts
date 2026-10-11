import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Organization Operations', () => {
  const engine = new PdfEngine();
  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');

  it('merges multiple PDF files in exact order and preserves page count', async () => {
    const file1 = fs.readFileSync(unencPath); // 2 pages
    const file2 = fs.readFileSync(multiPath); // 5 pages

    const mergedBytes = await engine.mergePdfs([file1, file2]);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(7); // 2 + 5 = 7 pages
  });

  it('splits a document into individual pages', async () => {
    const multiBytes = fs.readFileSync(multiPath); // 5 pages
    const parts = await engine.splitPdf(multiBytes, 'all');

    expect(parts.length).toBe(5);
    for (let i = 0; i < parts.length; i++) {
      const partDoc = await PDFDocument.load(parts[i].data);
      expect(partDoc.getPageCount()).toBe(1);
    }
  });

  it('extracts specific page ranges (e.g. 1-2, 4)', async () => {
    const multiBytes = fs.readFileSync(multiPath);
    const parts = await engine.splitPdf(multiBytes, '1-2, 4');

    expect(parts.length).toBe(2);
    expect(parts[0].pageCount).toBe(2);
    expect(parts[1].pageCount).toBe(1);

    const doc1 = await PDFDocument.load(parts[0].data);
    expect(doc1.getPageCount()).toBe(2);
    const doc2 = await PDFDocument.load(parts[1].data);
    expect(doc2.getPageCount()).toBe(1);
  });

  it('reorders and rotates pages properly', async () => {
    const multiBytes = fs.readFileSync(multiPath); // 5 pages
    // Target order: Page 5 (index 4), Page 1 (index 0), Page 3 (index 2)
    const order = [4, 0, 2];
    const rotations = new Map<number, number>();
    rotations.set(4, 90); // Rotate original page 5 by 90 deg

    const organizedBytes = await engine.organizePages(multiBytes, order, rotations);
    const organizedDoc = await PDFDocument.load(organizedBytes);

    expect(organizedDoc.getPageCount()).toBe(3);
    const firstPage = organizedDoc.getPage(0);
    expect(firstPage.getRotation().angle).toBe(90);
  });

  it('converts PNG image into a valid PDF document', async () => {
    const pngPath = path.resolve(__dirname, '../fixtures/fixture-image-1.png');
    const pngBytes = fs.readFileSync(pngPath);

    const pdfBytes = await engine.imagesToPdf([
      {
        name: 'test.png',
        data: pngBytes,
        mimeType: 'image/png',
      },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
