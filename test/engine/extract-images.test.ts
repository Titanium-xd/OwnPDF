import { describe, it, expect } from 'vitest';
import { extractImagesEngine } from '../../src/engine/extract-images';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

describe('ExtractImagesEngine Binary & ZIP Validation', () => {
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');
  const pngFixturePath = path.resolve(__dirname, '../fixtures/fixture-image-1.png');

  it('extracts embedded images, verifies PNG headers, and confirms ZIP archive integrity', async () => {
    // Build a 2-page document with an embedded PNG on each page (same image used as repeating logo)
    const doc = await PDFDocument.create();
    const pngBytes = fs.readFileSync(pngFixturePath);
    const embeddedImg = await doc.embedPng(pngBytes);

    const page1 = doc.addPage([400, 400]);
    page1.drawImage(embeddedImg, { x: 50, y: 50, width: 100, height: 100 });

    const page2 = doc.addPage([400, 400]);
    page2.drawImage(embeddedImg, { x: 50, y: 50, width: 100, height: 100 });

    const pdfBytes = await doc.save();

    const result = await extractImagesEngine.extractPdfImages(pdfBytes);

    expect(result.totalCount).toBeGreaterThanOrEqual(1);
    expect(result.images.length).toBeGreaterThanOrEqual(1);

    const firstImg = result.images[0];
    expect(firstImg.status).toBe('SUCCESS');
    expect(firstImg.width).toBe(100);
    expect(firstImg.height).toBe(100);
    expect(firstImg.format).toBe('png');
    expect(firstImg.sizeBytes).toBeGreaterThan(0);

    // Verify 8-byte PNG magic header: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    const header = firstImg.data.slice(0, 8);
    expect(header[0]).toBe(0x89);
    expect(header[1]).toBe(0x50); // P
    expect(header[2]).toBe(0x4e); // N
    expect(header[3]).toBe(0x47); // G
    expect(header[4]).toBe(0x0d);
    expect(header[5]).toBe(0x0a);
    expect(header[6]).toBe(0x1a);
    expect(header[7]).toBe(0x0a);

    // Verify ZIP archive integrity
    expect(result.zipBlob).toBeDefined();
    const zipAb = await result.zipBlob!.arrayBuffer();
    const unzipped = await JSZip.loadAsync(zipAb);

    const fileEntries = Object.keys(unzipped.files);
    expect(fileEntries.length).toBe(result.images.length);

    // Verify uncompressed image from ZIP
    const unzippedBytes = await unzipped.file(firstImg.name)!.async('uint8array');
    expect(unzippedBytes.length).toBe(firstImg.sizeBytes);
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      extractImagesEngine.extractPdfImages(encBytes)
    ).rejects.toThrow(/unlock the document/i);
  });
});
