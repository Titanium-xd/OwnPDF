import { describe, it, expect } from 'vitest';
import { RedactEngine } from '../../src/engine/redact-engine';
import {
  PDFDocument,
  StandardFonts,
  PDFName,
  PDFDict,
  PDFString,
  PDFArray,
  PDFStream,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';

describe('RedactEngine Verification', () => {
  const engine = new RedactEngine();

  it('redacts sensitive text and purges original content streams, annotations, attachments, and metadata', async () => {
    // 1. Build a synthetic fixture containing sensitive text, annotations, attachments, and metadata
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Page 1: Sensitive text and sensitive embedded image
    const page1 = doc.addPage([500, 500]);
    page1.drawText('CONFIDENTIAL_PASSWORD_98765', { x: 50, y: 400, size: 14, font });
    page1.drawText('Public non-sensitive text on page 1', { x: 50, y: 350, size: 12, font });

    // Embed sensitive image into Page 1
    const imgPath = path.resolve(__dirname, '../fixtures/fixture-image-1.png');
    const sensitiveImageBytes = fs.readFileSync(imgPath);
    const embeddedImg = await doc.embedPng(sensitiveImageBytes);
    page1.drawImage(embeddedImg, { x: 50, y: 200, width: 100, height: 100 });

    // Add an interactive annotation to Page 1
    const annotDict = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [50, 400, 200, 430],
      Contents: PDFString.of('Secret Note: Password is on this page'),
    });
    const annotRef = doc.context.register(annotDict);
    page1.node.set(PDFName.of('Annots'), doc.context.obj([annotRef]));

    // Page 2: Untouched page
    const page2 = doc.addPage([500, 500]);
    page2.drawText('Safe information on page 2', { x: 50, y: 400, size: 12, font });

    // Add sensitive document metadata
    doc.setTitle('Sensitive Financial Report 2026');
    doc.setAuthor('John Secret Doe');

    // Add embedded attachment simulation via Names / EmbeddedFiles
    const filesDict = doc.context.obj({
      Names: doc.context.obj([
        PDFString.of('secret.txt'),
        doc.context.obj({
          Type: 'Filespec',
          F: PDFString.of('secret.txt'),
          EF: doc.context.obj({ F: doc.context.stream('sensitive_attachment_payload') }),
        }),
      ]),
    });
    const namesDict = doc.context.obj({
      EmbeddedFiles: doc.context.register(filesDict),
    });
    doc.catalog.set(PDFName.of('Names'), doc.context.register(namesDict));

    const originalBytes = await doc.save();

    // 2. Perform Redaction on Page 1
    const result = await engine.redactPdf(originalBytes, {
      boxes: [
        {
          id: 'box_1',
          pageIndex: 0,
          pageNumber: 1,
          x: 40,
          y: 70, // in viewport coordinates (top is 0)
          width: 300,
          height: 40,
          coordinateSpace: 'viewport',
        },
      ],
      sanitizeMetadata: true,
    });

    expect(result.redactedPagesCount).toBe(1);
    expect(result.sanitizedMetadata).toBe(true);

    // 3. Verify with PDF.js that sensitive text is completely absent from Page 1
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    expect(pdfDoc.numPages).toBe(2);

    const p1 = await pdfDoc.getPage(1);
    const p1Text = await p1.getTextContent();
    const p1Extracted = (p1Text.items || []).map((i: any) => i.str || '').join(' ');

    expect(p1Extracted).not.toContain('CONFIDENTIAL_PASSWORD_98765');
    // Rebuilt from raster image: zero text operators remain on Page 1
    expect(p1Extracted.trim()).toBe('');

    // Page 2 remains intact
    const p2 = await pdfDoc.getPage(2);
    const p2Text = await p2.getTextContent();
    const p2Extracted = (p2Text.items || []).map((i: any) => i.str || '').join(' ');
    expect(p2Extracted).toContain('Safe information on page 2');

    // 4. Low-level structural verification with pdf-lib:
    const reloadedDoc = await PDFDocument.load(result.pdfData);
    const reloadedP1 = reloadedDoc.getPage(0);

    // Content stream verification: original text stream is purged
    // In pdf-lib, reloaded page has NO text operators (BT / ET / Tj / TJ)
    const contentsRef = reloadedP1.node.get(PDFName.of('Contents'));
    expect(contentsRef).toBeDefined();
    // Raw content stream should only reference Do (drawing the image) and cm, never BT/ET/Tj
    const contentsStream = reloadedDoc.context.lookup(contentsRef);
    let streamText = '';
    if (contentsStream instanceof PDFStream) {
      streamText = new TextDecoder().decode(contentsStream.getContents());
    }
    expect(streamText).not.toContain('BT');
    expect(streamText).not.toContain('CONFIDENTIAL_PASSWORD');
    expect(streamText).not.toContain('Tj');

    // Annots purged
    expect(reloadedP1.node.get(PDFName.of('Annots'))).toBeUndefined();

    // Attachments purged (/Names deleted from Catalog)
    expect(reloadedDoc.catalog.get(PDFName.of('Names'))).toBeUndefined();

    // Metadata sanitized
    expect(reloadedDoc.getTitle()).toBe('');
    expect(reloadedDoc.getAuthor()).toBe('');
  });

  it('handles rotated pages and non-default crop boxes correctly', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Rotated page (90 degrees)
    const page = doc.addPage([400, 600]);
    page.setRotation({ type: 'degrees', angle: 90 });
    page.setCropBox(50, 50, 300, 500); // Non-default crop box
    page.drawText('TOP_SECRET_COORDINATE_DATA', { x: 80, y: 150, size: 14, font });

    const originalBytes = await doc.save();

    const result = await engine.redactPdf(originalBytes, {
      boxes: [
        {
          id: 'box_rot',
          pageIndex: 0,
          pageNumber: 1,
          x: 70,
          y: 140,
          width: 200,
          height: 30,
          coordinateSpace: 'pdf', // Specify PDF user space coordinates
        },
      ],
      sanitizeMetadata: true,
    });

    expect(result.redactedPagesCount).toBe(1);

    const reloadedDoc = await PDFDocument.load(result.pdfData);
    const newPage = reloadedDoc.getPage(0);
    const size = newPage.getSize();

    // In PDF.js viewport at 90 deg rotation, crop box width (300) and height (500) swap: width becomes 500, height becomes 300
    expect(size.width).toBe(500);
    expect(size.height).toBe(300);

    // Check with PDF.js that text is purged
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    const p1 = await pdfDoc.getPage(1);
    const p1Text = await p1.getTextContent();
    const p1Extracted = (p1Text.items || []).map((i: any) => i.str || '').join(' ');
    expect(p1Extracted).not.toContain('TOP_SECRET_COORDINATE_DATA');
  });

  it('leaves document unchanged when no redaction boxes are provided', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const originalBytes = await doc.save();

    const result = await engine.redactPdf(originalBytes, { boxes: [] });
    expect(result.redactedPagesCount).toBe(0);
    expect(result.redactionBoxesCount).toBe(0);
    expect(result.pdfData).toEqual(originalBytes);
  });
});
