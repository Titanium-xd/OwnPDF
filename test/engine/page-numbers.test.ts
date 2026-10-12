import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Add Page Numbers Tool', () => {
  const engine = new PdfEngine();
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('stamps page numbers on all pages with default settings', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const numbered = await engine.addPageNumbers(fileBytes, {
      position: 'bottom-center',
      format: 'PAGE_N_OF_TOTAL',
    });

    const doc = await PDFDocument.load(numbered);
    expect(doc.getPageCount()).toBe(5);
    expect(numbered.byteLength).toBeGreaterThan(fileBytes.byteLength);
  });

  it('supports custom starting number and format variations', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const numbered = await engine.addPageNumbers(fileBytes, {
      position: 'top-right',
      format: 'NUMBER_ONLY',
      startNumber: 10,
      fontSize: 12,
      margin: 40,
    });

    const doc = await PDFDocument.load(numbered);
    expect(doc.getPageCount()).toBe(5);
  });

  it('restricts numbering to a specific page range (e.g. pages 2-4)', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const numbered = await engine.addPageNumbers(fileBytes, {
      position: 'bottom-right',
      pageRange: '2-4',
    });

    const doc = await PDFDocument.load(numbered);
    expect(doc.getPageCount()).toBe(5);
    expect(numbered.byteLength).toBeGreaterThan(fileBytes.byteLength);
  });

  it('rejects unauthenticated execution on encrypted PDF', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(engine.addPageNumbers(encBytes)).rejects.toThrow(/unlock the document/i);
  });
});
