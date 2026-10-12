import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Extract Text Tool', () => {
  const engine = new PdfEngine();
  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('extracts selectable text and generates structured metrics', async () => {
    const fileBytes = fs.readFileSync(unencPath);
    const result = await engine.extractText(fileBytes);

    expect(result.pageCount).toBe(2);
    expect(result.wordCount).toBeGreaterThan(5);
    expect(result.characterCount).toBeGreaterThan(20);
    expect(result.isEmpty).toBe(false);

    expect(result.text).toContain('OwnPDF Synthetic Document - Page 1');
    expect(result.text).toContain('OwnPDF Synthetic Document - Page 2');
    expect(result.text).toContain('--- Page 1 of 2 ---');
  });

  it('filters extraction by custom page range (e.g. page 2)', async () => {
    const fileBytes = fs.readFileSync(unencPath);
    const result = await engine.extractText(fileBytes, { pageRange: '2' });

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain('OwnPDF Synthetic Document - Page 2');
    expect(result.text).not.toContain('Page 1 of 2');
  });

  it('rejects text extraction on encrypted PDF', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(engine.extractText(encBytes)).rejects.toThrow(/unlock the document/i);
  });
});
