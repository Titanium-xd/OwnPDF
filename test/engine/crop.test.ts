import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Crop PDF Tool', () => {
  const engine = new PdfEngine();
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('adjusts CropBox dimensions with points margins', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const cropped = await engine.cropPdf(fileBytes, {
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      isPercentage: false,
    });

    const doc = await PDFDocument.load(cropped);
    expect(doc.getPageCount()).toBe(5);

    const firstPage = doc.getPage(0);
    const mediaBox = firstPage.getMediaBox();
    const cropBox = firstPage.getCropBox();

    expect(cropBox.x).toBe(mediaBox.x + 36);
    expect(cropBox.y).toBe(mediaBox.y + 36);
    expect(cropBox.width).toBe(mediaBox.width - 72);
    expect(cropBox.height).toBe(mediaBox.height - 72);
  });

  it('crops specific page range (e.g. pages 1-2)', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const cropped = await engine.cropPdf(fileBytes, {
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      pageRange: '1-2',
    });

    const doc = await PDFDocument.load(cropped);
    const page1Crop = doc.getPage(0).getCropBox();
    const page3Crop = doc.getPage(2).getCropBox();
    const page3Media = doc.getPage(2).getMediaBox();

    expect(page1Crop.x).toBe(50);
    // Uncropped page preserves original mediaBox bounds
    expect(page3Crop.width).toBe(page3Media.width);
  });

  it('rejects invalid margins that exceed page dimensions', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    await expect(
      engine.cropPdf(fileBytes, {
        margins: { top: 500, bottom: 500, left: 500, right: 500 },
      })
    ).rejects.toThrow(/invalid dimensions/i);
  });

  it('rejects crop on encrypted document without password', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      engine.cropPdf(encBytes, { margins: { top: 10, bottom: 10, left: 10, right: 10 } })
    ).rejects.toThrow(/unlock the document/i);
  });
});
