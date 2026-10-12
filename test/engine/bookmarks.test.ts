import { describe, it, expect } from 'vitest';
import { BookmarksEngine } from '../../src/engine/bookmarks-engine';
import { PDFDocument, PDFName } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

describe('BookmarksEngine Verification', () => {
  const engine = new BookmarksEngine();

  it('builds an ISO 32000-1 outline tree and verifies round-trip extraction with PDF.js', async () => {
    // 1. Create 5-page document
    const doc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      doc.addPage([500, 500]);
    }
    const originalBytes = await doc.save();

    // 2. Add hierarchical bookmarks
    const result = await engine.addBookmarks(originalBytes, {
      bookmarks: [
        {
          id: 'bm_1',
          title: 'Chapter 1: Overview',
          targetPageNumber: 1,
          level: 0,
          children: [
            {
              id: 'bm_1_1',
              title: 'Section 1.1: Background',
              targetPageNumber: 2,
              level: 1,
            },
          ],
        },
        {
          id: 'bm_2',
          title: 'Chapter 2: Implementation',
          targetPageNumber: 3,
          level: 0,
          children: [
            {
              id: 'bm_2_1',
              title: 'Section 2.1: Details',
              targetPageNumber: 4,
              level: 1,
            },
          ],
        },
        {
          id: 'bm_3',
          title: 'Chapter 3: Conclusion',
          targetPageNumber: 5,
          level: 0,
        },
      ],
      replaceExisting: true,
    });

    expect(result.totalBookmarksCount).toBe(5);

    // 3. Structural verification with pdf-lib:
    const reloadedDoc = await PDFDocument.load(result.pdfData);
    expect(reloadedDoc.catalog.get(PDFName.of('PageMode'))?.toString()).toBe('/UseOutlines');
    expect(reloadedDoc.catalog.get(PDFName.of('Outlines'))).toBeDefined();

    // 4. Extraction verification with PDF.js
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    const rawOutlines = await pdfDoc.getOutline();
    expect(rawOutlines).toBeDefined();
    expect(rawOutlines?.length).toBe(3);

    expect(rawOutlines![0].title).toBe('Chapter 1: Overview');
    expect(rawOutlines![0].items.length).toBe(1);
    expect(rawOutlines![0].items[0].title).toBe('Section 1.1: Background');

    expect(rawOutlines![1].title).toBe('Chapter 2: Implementation');
    expect(rawOutlines![2].title).toBe('Chapter 3: Conclusion');
  });

  it('rejects out-of-bounds target page numbers with an informative error', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([500, 500]); // 1 page total
    const bytes = await doc.save();

    await expect(
      engine.addBookmarks(bytes, {
        bookmarks: [
          {
            id: 'bm_bad',
            title: 'Out of Bounds',
            targetPageNumber: 99,
            level: 0,
          },
        ],
      })
    ).rejects.toThrow('out of bounds');
  });
});
