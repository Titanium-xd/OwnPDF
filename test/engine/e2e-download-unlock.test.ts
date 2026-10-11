import { describe, it, expect } from 'vitest';
import createModule from '@neslinesli93/qpdf-wasm';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { sanitizeDownloadFilename } from '../../src/utils/download';
import { PdfEngine } from '../../src/engine/pdf-engine';

describe('End-to-End Download & Password-Free Verification', () => {
  const encFixturePath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('proves encrypted fixture requires password in PDF.js, and unlocked bytes open password-free', async () => {
    const encBytes = new Uint8Array(fs.readFileSync(encFixturePath));

    // 1. Verify that loading the original encrypted PDF without a password in PDF.js fails
    let encryptedFailed = false;
    try {
      const task = pdfjsLib.getDocument({ data: new Uint8Array(encBytes) });
      await task.promise;
    } catch (err: any) {
      encryptedFailed = true;
      // In PDF.js, err.name is "PasswordException"
      expect(err.name).toBe('PasswordException');
    }
    expect(encryptedFailed).toBe(true);

    // 2. Decrypt the PDF using QPDF WASM
    const qpdf = await createModule();
    qpdf.FS.writeFile('/enc_input.pdf', encBytes);
    const exitCode = qpdf.callMain([
      '--password=testpass123',
      '--decrypt',
      '/enc_input.pdf',
      '/unlocked_output.pdf',
    ]);
    expect(exitCode).toBe(0);

    const unlockedBytes = qpdf.FS.readFile('/unlocked_output.pdf');
    qpdf.FS.unlink('/enc_input.pdf');
    qpdf.FS.unlink('/unlocked_output.pdf');

    // 3. Verify unlocked byte structure and PDF signature
    expect(unlockedBytes.byteLength).toBeGreaterThan(0);
    expect(PdfEngine.isValidPdfHeader(unlockedBytes)).toBe(true);

    // 4. Verify download filename generation
    const downloadFilename = sanitizeDownloadFilename('fixture-encrypted-aes256.pdf', 'unlocked');
    expect(downloadFilename).toBe('fixture-encrypted-aes256-unlocked.pdf');

    // 5. Verify PDF.js parsing of unlocked bytes without ANY password
    const unlockedTask = pdfjsLib.getDocument({ data: new Uint8Array(unlockedBytes) });
    const pdfDoc = await unlockedTask.promise;

    expect(pdfDoc.numPages).toBe(2);

    const page1 = await pdfDoc.getPage(1);
    expect(page1.pageNumber).toBe(1);

    const page2 = await pdfDoc.getPage(2);
    expect(page2.pageNumber).toBe(2);

    // Unlocked doc has no password prompt, valid pages, and valid dimensions
    const viewport1 = page1.getViewport({ scale: 1.0 });
    expect(viewport1.width).toBeGreaterThan(0);
    expect(viewport1.height).toBeGreaterThan(0);
  });
});
