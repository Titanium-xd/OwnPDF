import { describe, it, expect } from 'vitest';
import createModule from '@neslinesli93/qpdf-wasm';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('QPDF WASM Cryptographic Engine', () => {
  const encFixturePath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');
  const unencFixturePath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');

  it('correctly rejects direct loading of encrypted PDF in pdf-lib', async () => {
    const encBytes = fs.readFileSync(encFixturePath);
    let threwError = false;
    try {
      await PDFDocument.load(encBytes);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('encrypted');
    }
    expect(threwError).toBe(true);
  });

  it('successfully decrypts AES-256 encrypted PDF with correct password', async () => {
    const encBytes = fs.readFileSync(encFixturePath);
    const qpdf = await createModule();

    qpdf.FS.writeFile('/test_enc.pdf', encBytes);
    const exitCode = qpdf.callMain([
      '--password=testpass123',
      '--decrypt',
      '/test_enc.pdf',
      '/test_unlocked.pdf',
    ]);

    expect(exitCode).toBe(0);
    const unlockedBytes = qpdf.FS.readFile('/test_unlocked.pdf');
    expect(unlockedBytes.byteLength).toBeGreaterThan(0);

    // Clean up MEMFS
    qpdf.FS.unlink('/test_enc.pdf');
    qpdf.FS.unlink('/test_unlocked.pdf');

    // Verify output is valid unencrypted PDF with 2 pages
    const doc = await PDFDocument.load(unlockedBytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('safely catches and rejects incorrect password with exit code 2', async () => {
    const encBytes = fs.readFileSync(encFixturePath);
    let stderr = '';
    const qpdf = await createModule({
      printErr: (msg: string) => { stderr += msg + '\n'; },
    });

    qpdf.FS.writeFile('/test_wrong.pdf', encBytes);
    let exitCode = 0;
    try {
      exitCode = qpdf.callMain([
        '--password=incorrectpassword',
        '--decrypt',
        '/test_wrong.pdf',
        '/test_wrong_out.pdf',
      ]);
    } catch (err: any) {
      exitCode = err.status || 2;
    }

    expect(exitCode).toBe(2);
    let outputExists = false;
    try {
      qpdf.FS.stat('/test_wrong_out.pdf');
      outputExists = true;
    } catch {
      outputExists = false;
    }
    expect(outputExists).toBe(false);

    // Clean up input
    qpdf.FS.unlink('/test_wrong.pdf');
  });

  it('encrypts unencrypted PDF with AES-256 and verifies encryption', async () => {
    const unencBytes = fs.readFileSync(unencFixturePath);
    const qpdf = await createModule();

    qpdf.FS.writeFile('/test_src.pdf', unencBytes);
    const exitCode = qpdf.callMain([
      '--encrypt',
      'brandnewpass',
      'ownerpass999',
      '256',
      '--',
      '/test_src.pdf',
      '/test_dest_enc.pdf',
    ]);

    expect(exitCode).toBe(0);
    const encryptedBytes = qpdf.FS.readFile('/test_dest_enc.pdf');
    expect(encryptedBytes.byteLength).toBeGreaterThan(0);

    qpdf.FS.unlink('/test_src.pdf');
    qpdf.FS.unlink('/test_dest_enc.pdf');

    // Assert that loading without password fails in pdf-lib
    let threw = false;
    try {
      await PDFDocument.load(encryptedBytes);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    // Assert that decrypting with brandnewpass succeeds
    qpdf.FS.writeFile('/test_verify.pdf', encryptedBytes);
    const decCode = qpdf.callMain([
      '--password=brandnewpass',
      '--decrypt',
      '/test_verify.pdf',
      '/test_verify_out.pdf',
    ]);
    expect(decCode).toBe(0);
    const decryptedBytes = qpdf.FS.readFile('/test_verify_out.pdf');
    const doc = await PDFDocument.load(decryptedBytes);
    expect(doc.getPageCount()).toBe(2);

    qpdf.FS.unlink('/test_verify.pdf');
    qpdf.FS.unlink('/test_verify_out.pdf');
  });
});
