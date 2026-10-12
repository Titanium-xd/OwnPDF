import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Rotate PDF Tool', () => {
  const engine = new PdfEngine();
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('rotates all pages by 90 degrees clockwise', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const rotated = await engine.rotatePdf(fileBytes, { rotationAngle: 90 });

    const doc = await PDFDocument.load(rotated);
    expect(doc.getPageCount()).toBe(5);

    for (let i = 0; i < 5; i++) {
      expect(doc.getPage(i).getRotation().angle).toBe(90);
    }
  });

  it('rotates all pages by 180 degrees', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const rotated = await engine.rotatePdf(fileBytes, { rotationAngle: 180 });

    const doc = await PDFDocument.load(rotated);
    for (let i = 0; i < 5; i++) {
      expect(doc.getPage(i).getRotation().angle).toBe(180);
    }
  });

  it('rotates only selected page range (e.g. pages 2-3)', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const rotated = await engine.rotatePdf(fileBytes, {
      rotationAngle: 90,
      pageRange: '2-3',
    });

    const doc = await PDFDocument.load(rotated);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90); // page 2
    expect(doc.getPage(2).getRotation().angle).toBe(90); // page 3
    expect(doc.getPage(3).getRotation().angle).toBe(0);
    expect(doc.getPage(4).getRotation().angle).toBe(0);
  });

  it('supports per-page rotation overrides', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const perPage = new Map<number, number>();
    perPage.set(0, 90);
    perPage.set(2, 270);

    const rotated = await engine.rotatePdf(fileBytes, {
      rotationAngle: 0,
      perPageRotations: perPage,
    });

    const doc = await PDFDocument.load(rotated);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
    expect(doc.getPage(2).getRotation().angle).toBe(270);
    expect(doc.getPage(3).getRotation().angle).toBe(0);
  });

  it('rejects rotation on password-protected documents', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(engine.rotatePdf(encBytes, { rotationAngle: 90 })).rejects.toThrow(
      /unlock the document/i
    );
  });
});
