import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
} from 'pdf-lib';
import type { FormFieldInfo, FormFieldType, FillFormResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

export class FormFillEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Inspects a PDF document and extracts all supported interactive AcroForm fields.
   * Identifies text inputs, checkboxes, radio button groups, and dropdowns.
   */
  public async getFormFields(fileData: Uint8Array): Promise<FormFieldInfo[]> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before filling form fields.');
    }

    const doc = await PDFDocument.load(fileData);
    let form;
    try {
      form = doc.getForm();
    } catch {
      return [];
    }

    const rawFields = form.getFields();
    if (rawFields.length === 0) {
      return [];
    }

    const results: FormFieldInfo[] = [];

    for (const field of rawFields) {
      const name = field.getName();
      let type: FormFieldType = 'unsupported';
      let value: string | boolean = '';
      let options: string[] | undefined;
      let isMultiline = false;
      let isReadOnly = field.isReadOnly();
      let maxLength: number | undefined;

      if (field instanceof PDFTextField) {
        type = 'text';
        value = field.getText() || '';
        isMultiline = field.isMultiline();
        maxLength = field.getMaxLength() || undefined;
      } else if (field instanceof PDFCheckBox) {
        type = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFRadioGroup) {
        type = 'radio';
        options = field.getOptions();
        value = field.getSelected() || (options.length > 0 ? options[0] : '');
      } else if (field instanceof PDFDropdown) {
        type = 'dropdown';
        options = field.getOptions();
        const selected = field.getSelected();
        value = selected && selected.length > 0 ? selected[0] : (options.length > 0 ? options[0] : '');
      }

      if (type !== 'unsupported') {
        results.push({
          name,
          type,
          value,
          options,
          isMultiline,
          isReadOnly,
          maxLength,
        });
      }
    }

    return results;
  }

  /**
   * Fills form fields in the PDF document with user-supplied values and saves the result.
   */
  public async fillForm(
    fileData: Uint8Array,
    fieldValues: Record<string, string | boolean>
  ): Promise<FillFormResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before filling form fields.');
    }

    const doc = await PDFDocument.load(fileData);
    const form = doc.getForm();
    const allFields = form.getFields();

    let filledCount = 0;

    for (const [name, val] of Object.entries(fieldValues)) {
      try {
        const field = form.getFieldMaybe(name);
        if (!field) continue;

        if (field instanceof PDFTextField && typeof val === 'string') {
          field.setText(val);
          filledCount++;
        } else if (field instanceof PDFCheckBox) {
          if (val === true) {
            field.check();
          } else {
            field.uncheck();
          }
          filledCount++;
        } else if (field instanceof PDFRadioGroup && typeof val === 'string') {
          field.select(val);
          filledCount++;
        } else if (field instanceof PDFDropdown && typeof val === 'string') {
          field.select(val);
          filledCount++;
        }
      } catch (err) {
        console.warn(`Could not set form field "${name}":`, err);
      }
    }

    const modifiedBytes = await doc.save();

    return {
      pdfData: modifiedBytes,
      filledFieldCount: filledCount,
      totalFieldsCount: allFields.length,
    };
  }
}

export const formFillEngine = new FormFillEngine();
