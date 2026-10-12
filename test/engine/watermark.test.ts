import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Add Watermark Tool', () => {
  const engine = new PdfEngine();
  const multiPath = path.resolve(__dirname, '../fixtures/fixture-multipage.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  // Minimal valid 1x1 PNG data
  const tinyPng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  it('stamps text watermark on all pages', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const watermarked = await engine.addWatermark(fileBytes, {
      type: 'text',
      text: 'CONFIDENTIAL',
      fontSize: 50,
      opacity: 0.3,
      rotationDegrees: 45,
      position: 'center',
    });

    const doc = await PDFDocument.load(watermarked);
    expect(doc.getPageCount()).toBe(5);
    expect(watermarked.byteLength).toBeGreaterThan(fileBytes.byteLength);
  });

  it('stamps text watermark with corner positions and custom page ranges', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const watermarked = await engine.addWatermark(fileBytes, {
      type: 'text',
      text: 'SAMPLE',
      position: 'top-right',
      pageRange: '1, 3',
    });

    const doc = await PDFDocument.load(watermarked);
    expect(doc.getPageCount()).toBe(5);
  });

  it('stamps image watermark using embedded PNG', async () => {
    const fileBytes = fs.readFileSync(multiPath);
    const watermarked = await engine.addWatermark(fileBytes, {
      type: 'image',
      imageData: tinyPng,
      imageType: 'image/png',
      scale: 1.0,
      opacity: 0.4,
      position: 'center',
    });

    const doc = await PDFDocument.load(watermarked);
    expect(doc.getPageCount()).toBe(5);
    expect(watermarked.byteLength).toBeGreaterThan(fileBytes.byteLength);
  });

  it('rejects watermarking on password-protected documents', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      engine.addWatermark(encBytes, { type: 'text', text: 'TEST' })
    ).rejects.toThrow(/unlock the document/i);
  });
});
