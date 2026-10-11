// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeDownloadFilename, downloadPdf, downloadFile } from '../../src/utils/download';
import { PdfEngine } from '../../src/engine/pdf-engine';

describe('Download Utility & Filename Sanitization', () => {
  it('correctly appends suffix to standard lowercase PDF filename', () => {
    expect(sanitizeDownloadFilename('eaadhaar.pdf', 'unlocked')).toBe('eaadhaar-unlocked.pdf');
  });

  it('handles uppercase .PDF extension case-insensitively', () => {
    expect(sanitizeDownloadFilename('STATEMENT.PDF', 'unlocked')).toBe('STATEMENT-unlocked.pdf');
  });

  it('prevents duplicating the suffix if already unlocked', () => {
    expect(sanitizeDownloadFilename('eaadhaar-unlocked.pdf', 'unlocked')).toBe('eaadhaar-unlocked.pdf');
    expect(sanitizeDownloadFilename('document_unlocked.pdf', 'unlocked')).toBe('document_unlocked.pdf');
  });

  it('sanitizes illegal filesystem characters', () => {
    expect(sanitizeDownloadFilename('secret:file*?.pdf', 'unlocked')).toBe('secret_file-unlocked.pdf');
  });

  it('handles path traversal attempts cleanly', () => {
    expect(sanitizeDownloadFilename('../../evil/path/sample.pdf', 'unlocked')).toBe('sample-unlocked.pdf');
  });

  it('falls back to default name if input is empty or invalid', () => {
    expect(sanitizeDownloadFilename('', 'unlocked')).toBe('document-unlocked.pdf');
    expect(sanitizeDownloadFilename('.pdf', 'unlocked')).toBe('document-unlocked.pdf');
  });

  it('validates standard PDF header signature for downloads', () => {
    const validHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]); // %PDF-1.7
    const invalidHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header

    expect(PdfEngine.isValidPdfHeader(validHeader)).toBe(true);
    expect(PdfEngine.isValidPdfHeader(invalidHeader)).toBe(false);
  });

  it('downloadPdf rejects invalid non-PDF buffers before attempting download', async () => {
    const fakeData = new Uint8Array([0x00, 0x11, 0x22]);
    await expect(downloadPdf(fakeData, 'test.pdf')).rejects.toThrow(
      'Output bytes do not contain a valid %PDF- header signature'
    );
  });

  it('downloadPdf cleanly isolates TypedArray sub-slices with non-zero offsets', async () => {
    // Create an ArrayBuffer with padding
    const buffer = new ArrayBuffer(20);
    const fullView = new Uint8Array(buffer);
    // Write %PDF- at offset 5
    fullView.set([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34], 5);

    // Create a sub-slice starting at offset 5 with length 8
    const subSlice = new Uint8Array(buffer, 5, 8);
    expect(subSlice.byteOffset).toBe(5);
    expect(subSlice.byteLength).toBe(8);

    // Mock URL.createObjectURL
    const originalCreateObjectUrl = URL.createObjectURL;
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:http://localhost:5173/mock-uuid';
    });

    try {
      await downloadPdf(subSlice, 'statement');
      expect(capturedBlob).not.toBeNull();
      expect(capturedBlob!.type).toBe('application/pdf');
      expect(capturedBlob!.size).toBe(8); // Exactly 8 bytes, not the 20-byte underlying buffer
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
    }
  });

  it('showSaveFilePicker user cancellation (AbortError) cleanly exits without anchor download fallback', async () => {
    const blob = new Blob(['sample'], { type: 'application/pdf' });
    const originalPicker = (window as any).showSaveFilePicker;

    // Mock showSaveFilePicker rejecting with AbortError
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(abortErr);

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    try {
      await downloadFile(blob, 'test.pdf');
      // Must not append any anchor element to document.body
      expect(appendChildSpy).not.toHaveBeenCalled();
    } finally {
      (window as any).showSaveFilePicker = originalPicker;
      appendChildSpy.mockRestore();
    }
  });
});
