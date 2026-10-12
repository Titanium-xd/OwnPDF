import { describe, it, expect } from 'vitest';
import { FlattenEngine } from '../../src/engine/flatten-engine';
import {
  PDFDocument,
  StandardFonts,
  PDFName,
  PDFString,
  PDFDict,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

describe('FlattenEngine Verification', () => {
  const engine = new FlattenEngine();

  it('flattens AcroForm fields and bakes them into page vectors', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    const form = doc.getForm();

    const textField = form.createTextField('user.name');
    textField.setText('Jane Doe');
    textField.addToPage(page, { x: 50, y: 400, width: 200, height: 30 });

    const checkField = form.createCheckBox('user.agree');
    checkField.check();
    checkField.addToPage(page, { x: 50, y: 350, width: 20, height: 20 });

    const originalBytes = await doc.save();

    // 1. Run form flattening
    const result = await engine.flattenPdf(originalBytes, 'forms');

    expect(result.report.mode).toBe('forms');
    expect(result.report.flattenedFieldsCount).toBe(2);
    expect(result.report.remainingInteractiveCount).toBe(0);
    expect(result.report.isFullyFlattened).toBe(true);

    // 2. Verify with pdf-lib that AcroForm fields no longer exist
    const reloadedDoc = await PDFDocument.load(result.pdfData);
    const reloadedForm = reloadedDoc.getForm();
    expect(reloadedForm.getFields().length).toBe(0);

    // 3. Verify with PDF.js that the text "Jane Doe" is visually retained
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(result.pdfData) }).promise;
    const p1 = await pdfDoc.getPage(1);
    const textContent = await p1.getTextContent();
    const str = (textContent.items || []).map((i: any) => i.str || '').join(' ');
    expect(str).toContain('Jane Doe');
  });

  it('flattens annotations with appearance streams, preserves unsupported annotations, and reports them honestly', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);

    // 1. Annotation with valid normal appearance stream (/AP /N)
    const apStream = doc.context.flateStream('q 1 0 0 rg 0 0 100 20 re f Q');
    const apDict = doc.context.obj({
      N: doc.context.register(apStream),
    });
    const supportedAnnot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Square',
      Rect: [50, 400, 150, 420],
      AP: doc.context.register(apDict),
    });

    // 2. Annotation WITHOUT appearance stream (unsupported dynamic markup)
    const unsupportedAnnot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Highlight',
      Rect: [50, 300, 200, 320],
      Contents: PDFString.of('Dynamic highlight without AP stream'),
    });

    // 3. Link annotation
    const linkAnnot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [50, 200, 200, 220],
    });

    page.node.set(
      PDFName.of('Annots'),
      doc.context.obj([
        doc.context.register(supportedAnnot),
        doc.context.register(unsupportedAnnot),
        doc.context.register(linkAnnot),
      ])
    );

    const originalBytes = await doc.save();

    const result = await engine.flattenPdf(originalBytes, 'annotations');

    // Link (1) + Supported Square (1) = 2 flattened
    expect(result.report.flattenedAnnotationsCount).toBe(2);
    // Unsupported Highlight = 1 preserved
    expect(result.report.unsupportedAnnotationsCount).toBe(1);
    expect(result.report.unsupportedTypes).toContain('Highlight');
    expect(result.report.remainingInteractiveCount).toBe(1);
    // Never claims complete flattening when unsupported annotations remain
    expect(result.report.isFullyFlattened).toBe(false);

    // Verify that the unsupported annotation was NOT stripped from page
    const reloadedDoc = await PDFDocument.load(result.pdfData);
    const reloadedPage = reloadedDoc.getPage(0);
    const annotsRef = reloadedPage.node.get(PDFName.of('Annots'));
    expect(annotsRef).toBeDefined();
    const annotsArray = reloadedDoc.context.lookup(annotsRef);
    expect((annotsArray as any).size()).toBe(1);
  });

  it('supports full rasterization mode for guaranteed flattening', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const originalBytes = await doc.save();

    const result = await engine.flattenPdf(originalBytes, 'rasterize');
    expect(result.report.mode).toBe('rasterize');
    expect(result.report.isFullyFlattened).toBe(true);

    const reloadedDoc = await PDFDocument.load(result.pdfData);
    expect(reloadedDoc.getPageCount()).toBe(1);
  });
});
