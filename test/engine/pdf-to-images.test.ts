import { describe, it, expect } from 'vitest';
import { bundleImagesToZip } from '../../src/engine/pdf-to-images';
import { PdfEngine } from '../../src/engine/pdf-engine';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

describe('PDF to Images Conversion Engine', () => {
  const engine = new PdfEngine();
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('bundles multiple images into a valid readable ZIP archive', async () => {
    const fakeBlob1 = new Blob(['fake image 1 content'], { type: 'image/jpeg' });
    const fakeBlob2 = new Blob(['fake image 2 content'], { type: 'image/jpeg' });

    const images = [
      { filename: 'document-page-1.jpg', blob: fakeBlob1 },
      { filename: 'document-page-2.jpg', blob: fakeBlob2 },
    ];

    const zipBlob = await bundleImagesToZip(images);
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.type).toBe('application/zip');

    // Load back with JSZip to verify archive integrity
    const arrayBuffer = await zipBlob.arrayBuffer();
    const loadedZip = await JSZip.loadAsync(arrayBuffer);

    expect(loadedZip.file('document-page-1.jpg')).not.toBeNull();
    expect(loadedZip.file('document-page-2.jpg')).not.toBeNull();

    const file1Text = await loadedZip.file('document-page-1.jpg')!.async('text');
    expect(file1Text).toBe('fake image 1 content');
  });

  it('correctly maps page ranges for image conversion', () => {
    expect(engine.parseTargetIndices('1-3, 5', 5)).toEqual([0, 1, 2, 4]);
    expect(engine.parseTargetIndices('all', 3)).toEqual([0, 1, 2]);
    expect(engine.parseTargetIndices(undefined, 3)).toEqual([0, 1, 2]);
  });

  it('detects encrypted documents and enforces security boundaries', async () => {
    const encBytes = fs.readFileSync(encPath);
    const isEnc = await engine.isEncrypted(encBytes);
    expect(isEnc).toBe(true);
  });
});
