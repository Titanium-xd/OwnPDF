import { describe, it, expect } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PdfEngine Metadata and Inspection', () => {
  const engine = new PdfEngine();

  it('correctly reads document metadata', async () => {
    // Create doc with known metadata
    const doc = await PDFDocument.create();
    doc.setTitle('Sensitive Title');
    doc.setAuthor('Secret Author');
    doc.setSubject('Confidential Memo');
    doc.addPage([500, 500]);
    const bytes = await doc.save();

    const info = await engine.inspectPdf(bytes);
    expect(info.title).toBe('Sensitive Title');
    expect(info.author).toBe('Secret Author');
    expect(info.subject).toBe('Confidential Memo');
    expect(info.pageCount).toBe(1);
    expect(info.isEncrypted).toBe(false);
  });

  it('explicitly strips Title, Author, Subject and sanitizes document in v1', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Sensitive Title');
    doc.setAuthor('Secret Author');
    doc.setSubject('Confidential Memo');
    doc.setCreator('Internal Tool 4.0');
    doc.addPage([500, 500]);
    const bytes = await doc.save();

    const sanitizedBytes = await engine.sanitizeMetadata(bytes);
    const sanitizedDoc = await PDFDocument.load(sanitizedBytes, { updateMetadata: false });

    expect(sanitizedDoc.getTitle()).toBe('');
    expect(sanitizedDoc.getAuthor()).toBe('');
    expect(sanitizedDoc.getSubject()).toBe('');
    expect(sanitizedDoc.getCreator()).toBe('');
    expect(sanitizedDoc.getProducer()).toBe('OwnPDF (https://ownpdf.app)');
  });
});
