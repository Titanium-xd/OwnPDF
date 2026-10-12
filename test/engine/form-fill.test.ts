import { describe, it, expect } from 'vitest';
import { FormFillEngine } from '../../src/engine/form-fill-engine';
import { PDFDocument } from 'pdf-lib';

describe('FormFillEngine Verification', () => {
  const engine = new FormFillEngine();

  it('detects text, checkbox, radio, and dropdown form fields and fills them correctly', async () => {
    // 1. Create form with all supported field types
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 600]);
    const form = doc.getForm();

    const tf = form.createTextField('applicant.name');
    tf.setText('Initial Name');
    tf.addToPage(page, { x: 50, y: 500, width: 200, height: 30 });

    const cb = form.createCheckBox('applicant.terms');
    cb.uncheck();
    cb.addToPage(page, { x: 50, y: 450, width: 20, height: 20 });

    const rg = form.createRadioGroup('applicant.contact');
    rg.addOptionToPage('Email', page, { x: 50, y: 400, width: 20, height: 20 });
    rg.addOptionToPage('Phone', page, { x: 100, y: 400, width: 20, height: 20 });
    rg.select('Email');

    const dd = form.createDropdown('applicant.country');
    dd.addOptions(['USA', 'Canada', 'United Kingdom', 'Germany']);
    dd.select('Canada');
    dd.addToPage(page, { x: 50, y: 350, width: 150, height: 30 });

    const originalBytes = await doc.save();

    // 2. Discover fields
    const fields = await engine.getFormFields(originalBytes);
    expect(fields.length).toBe(4);

    const nameField = fields.find((f) => f.name === 'applicant.name');
    expect(nameField?.type).toBe('text');
    expect(nameField?.value).toBe('Initial Name');

    const termsField = fields.find((f) => f.name === 'applicant.terms');
    expect(termsField?.type).toBe('checkbox');
    expect(termsField?.value).toBe(false);

    const contactField = fields.find((f) => f.name === 'applicant.contact');
    expect(contactField?.type).toBe('radio');
    expect(contactField?.options).toEqual(['Email', 'Phone']);
    expect(contactField?.value).toBe('Email');

    const countryField = fields.find((f) => f.name === 'applicant.country');
    expect(countryField?.type).toBe('dropdown');
    expect(countryField?.value).toBe('Canada');

    // 3. Fill form with new values
    const result = await engine.fillForm(originalBytes, {
      'applicant.name': 'Alice Smith',
      'applicant.terms': true,
      'applicant.contact': 'Phone',
      'applicant.country': 'Germany',
    });

    expect(result.filledFieldCount).toBe(4);
    expect(result.totalFieldsCount).toBe(4);

    // 4. Reload and verify persistence
    const reloadedFields = await engine.getFormFields(result.pdfData);
    const reloadedName = reloadedFields.find((f) => f.name === 'applicant.name');
    expect(reloadedName?.value).toBe('Alice Smith');

    const reloadedTerms = reloadedFields.find((f) => f.name === 'applicant.terms');
    expect(reloadedTerms?.value).toBe(true);

    const reloadedContact = reloadedFields.find((f) => f.name === 'applicant.contact');
    expect(reloadedContact?.value).toBe('Phone');

    const reloadedCountry = reloadedFields.find((f) => f.name === 'applicant.country');
    expect(reloadedCountry?.value).toBe('Germany');
  });

  it('returns empty array gracefully for documents without forms', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const bytes = await doc.save();

    const fields = await engine.getFormFields(bytes);
    expect(fields).toEqual([]);
  });
});
