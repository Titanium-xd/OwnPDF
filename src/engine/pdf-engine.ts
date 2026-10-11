import {
  PDFDocument,
  degrees,
  PageSizes,
} from 'pdf-lib';
import { qpdfClient } from './qpdf-client';
import type {
  ProtectOptions,
  UnlockResult,
  SplitResult,
  ImageInput,
  ImageToPdfOptions,
  CompressResult,
  PdfDocumentMetadata,
} from '../types/engine';
import { PdfError } from '../types/engine';

export class PdfEngine {
  /**
   * Validates that the input bytes start with the standard PDF file header.
   */
  public static isValidPdfHeader(bytes: Uint8Array): boolean {
    if (bytes.length < 5) return false;
    const header = String.fromCharCode(...bytes.slice(0, 5));
    return header === '%PDF-';
  }

  /**
   * Deterministically determines if a PDF requires a password to open.
   */
  public async isEncrypted(fileData: Uint8Array): Promise<boolean> {
    if (!PdfEngine.isValidPdfHeader(fileData)) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Invalid PDF file header.');
    }

    try {
      await PDFDocument.load(fileData);
      return false;
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('is encrypted') ||
        msg.includes('EncryptedPDFError') ||
        msg.includes('encrypted')
      ) {
        return true;
      }
      // Re-throw if it's genuinely a corrupted document error
      throw new PdfError(
        'CORRUPTED_DOCUMENT',
        'Unable to parse PDF structure.',
        msg
      );
    }
  }

  /**
   * Decrypts a password-protected PDF locally using QPDF WebAssembly in a Web Worker.
   */
  public async unlockPdf(
    fileData: Uint8Array,
    password: string
  ): Promise<UnlockResult> {
    if (!password) {
      throw new PdfError('INCORRECT_PASSWORD', 'A password is required to unlock this document.');
    }

    const originalSize = fileData.byteLength;
    const buffer = fileData.buffer.slice(
      fileData.byteOffset,
      fileData.byteOffset + fileData.byteLength
    );

    // Run decryption inside isolated worker
    const outputBuffer = await qpdfClient.execute({
      type: 'DECRYPT',
      fileData: buffer,
      password,
    });

    const unlockedData = new Uint8Array(outputBuffer);

    // 1. Signature Check
    if (!PdfEngine.isValidPdfHeader(unlockedData)) {
      throw new PdfError(
        'CORRUPTED_DOCUMENT',
        'Decrypted output does not contain a valid %PDF- header signature.'
      );
    }

    // 2. Integrity Verification: Ensure unlocked output can be parsed by pdf-lib
    try {
      const verifiedDoc = await PDFDocument.load(unlockedData);
      if (verifiedDoc.getPageCount() === 0) {
        throw new Error('Unlocked document contains zero pages.');
      }
    } catch (verifErr: any) {
      throw new PdfError(
        'CORRUPTED_DOCUMENT',
        'Decryption completed, but output PDF structure could not be verified.',
        verifErr?.message
      );
    }

    // 3. Confirm document is genuinely decrypted
    const stillEncrypted = await this.isEncrypted(unlockedData);
    if (stillEncrypted) {
      throw new PdfError(
        'CORRUPTED_DOCUMENT',
        'Decryption completed, but output document remains password-protected.'
      );
    }

    return {
      unlockedData,
      originalSize,
      unlockedSize: unlockedData.byteLength,
    };
  }

  /**
   * Applies standard AES-256 password protection to a PDF document.
   */
  public async protectPdf(
    fileData: Uint8Array,
    options: ProtectOptions
  ): Promise<Uint8Array> {
    if (!options.userPassword && !options.ownerPassword) {
      throw new PdfError('INCORRECT_PASSWORD', 'You must supply a password to protect the document.');
    }

    // Safety Routing Check: Ensure input is not ALREADY encrypted
    const currentlyEncrypted = await this.isEncrypted(fileData);
    if (currentlyEncrypted) {
      throw new PdfError(
        'ENCRYPTED_DOCUMENT',
        'This document is already password protected. Unlock it before applying new protection.'
      );
    }

    const buffer = fileData.buffer.slice(
      fileData.byteOffset,
      fileData.byteOffset + fileData.byteLength
    );

    const outputBuffer = await qpdfClient.execute({
      type: 'ENCRYPT',
      fileData: buffer,
      userPassword: options.userPassword,
      ownerPassword: options.ownerPassword,
      keyLength: options.keyLength || 256,
    });

    const encryptedData = new Uint8Array(outputBuffer);

    // Verification: Assert that output is now genuinely recognized as encrypted
    const isNowProtected = await this.isEncrypted(encryptedData);
    if (!isNowProtected) {
      throw new PdfError(
        'UNKNOWN_ERROR',
        'Verification check failed: output file is not password protected.'
      );
    }

    return encryptedData;
  }

  /**
   * Merges multiple PDF files into a single continuous document.
   */
  public async mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
    if (files.length < 2) {
      throw new PdfError('UNSUPPORTED_FORMAT', 'Please provide at least two PDF files to merge.');
    }

    // Routing Validation: check all documents
    for (let i = 0; i < files.length; i++) {
      const isEnc = await this.isEncrypted(files[i]);
      if (isEnc) {
        throw new PdfError(
          'ENCRYPTED_DOCUMENT',
          `File #${i + 1} is password-protected. Please unlock all files before merging.`
        );
      }
    }

    const mergedDoc = await PDFDocument.create();

    for (const fileBytes of files) {
      const srcDoc = await PDFDocument.load(fileBytes);
      const copiedPages = await mergedDoc.copyPages(
        srcDoc,
        srcDoc.getPageIndices()
      );
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }

    return mergedDoc.save();
  }

  /**
   * Splits a PDF document by page ranges or individual pages.
   */
  public async splitPdf(
    fileData: Uint8Array,
    pageRangesStr: string
  ): Promise<SplitResult[]> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before splitting.');
    }

    const srcDoc = await PDFDocument.load(fileData);
    const totalPages = srcDoc.getPageCount();

    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains no pages.');
    }

    const ranges = this.parsePageRanges(pageRangesStr, totalPages);
    const results: SplitResult[] = [];

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(srcDoc, range.indices);
      for (const p of copied) {
        newDoc.addPage(p);
      }
      const data = await newDoc.save();
      results.push({
        filename: range.label ? `part-${range.label}.pdf` : `part-${i + 1}.pdf`,
        data,
        pageCount: range.indices.length,
      });
    }

    return results;
  }

  /**
   * Reorganizes pages: rotation, reordering, deletion.
   */
  public async organizePages(
    fileData: Uint8Array,
    pageOrderIndices: number[], // target sequence of 0-based page indices
    rotations: Map<number, number> // pageIndex -> rotation delta in degrees (e.g. 90, 180, 270)
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before organizing.');
    }

    if (pageOrderIndices.length === 0) {
      throw new PdfError('UNSUPPORTED_FORMAT', 'Cannot create a PDF with 0 pages.');
    }

    const srcDoc = await PDFDocument.load(fileData);
    const newDoc = await PDFDocument.create();

    // Copy selected pages in the desired order
    const copiedPages = await newDoc.copyPages(srcDoc, pageOrderIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      const originalIndex = pageOrderIndices[i];
      const rotationDelta = rotations.get(originalIndex) || 0;

      if (rotationDelta !== 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + rotationDelta) % 360));
      }

      newDoc.addPage(page);
    }

    return newDoc.save();
  }

  /**
   * Converts PNG / JPEG images into a formatted PDF document.
   */
  public async imagesToPdf(
    images: ImageInput[],
    options: ImageToPdfOptions = {}
  ): Promise<Uint8Array> {
    if (images.length === 0) {
      throw new PdfError('UNSUPPORTED_FORMAT', 'Please provide at least one image.');
    }

    const pdfDoc = await PDFDocument.create();

    for (const img of images) {
      let embeddedImage;
      if (img.mimeType === 'image/jpeg') {
        embeddedImage = await pdfDoc.embedJpg(img.data);
      } else if (img.mimeType === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(img.data);
      } else {
        throw new PdfError(
          'UNSUPPORTED_FORMAT',
          `Unsupported image format for "${img.name}". Only JPEG and PNG are supported.`
        );
      }

      const imgDims = embeddedImage.scale(1);
      const margin = options.margin ?? 20;

      let pageWidth: number;
      let pageHeight: number;

      if (options.pageSize === 'A4') {
        pageWidth = PageSizes.A4[0];
        pageHeight = PageSizes.A4[1];
      } else if (options.pageSize === 'LETTER') {
        pageWidth = PageSizes.Letter[0];
        pageHeight = PageSizes.Letter[1];
      } else {
        // FIT mode: page size equals image dimensions + margins
        pageWidth = imgDims.width + margin * 2;
        pageHeight = imgDims.height + margin * 2;
      }

      // Handle orientation
      if (
        options.orientation === 'landscape' &&
        pageHeight > pageWidth
      ) {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      } else if (
        options.orientation === 'portrait' &&
        pageWidth > pageHeight
      ) {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      const availWidth = pageWidth - margin * 2;
      const availHeight = pageHeight - margin * 2;
      const scale = Math.min(
        availWidth / imgDims.width,
        availHeight / imgDims.height,
        1
      );

      const drawWidth = imgDims.width * scale;
      const drawHeight = imgDims.height * scale;
      const posX = margin + (availWidth - drawWidth) / 2;
      const posY = margin + (availHeight - drawHeight) / 2;

      page.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: drawWidth,
        height: drawHeight,
      });
    }

    return pdfDoc.save();
  }

  /**
   * Performs structural optimization and linearization via QPDF Web Worker.
   */
  public async compressPdf(fileData: Uint8Array): Promise<CompressResult> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before compressing.');
    }

    const originalSize = fileData.byteLength;
    const buffer = fileData.buffer.slice(
      fileData.byteOffset,
      fileData.byteOffset + fileData.byteLength
    );

    const outputBuffer = await qpdfClient.execute({
      type: 'OPTIMIZE',
      fileData: buffer,
    });

    const compressedData = new Uint8Array(outputBuffer);
    const compressedSize = compressedData.byteLength;
    const savedBytes = originalSize - compressedSize;
    const savingsPercent = Math.max(
      0,
      Math.round((savedBytes / originalSize) * 100)
    );

    return {
      compressedData,
      originalSize,
      compressedSize,
      savedBytes,
      savingsPercent,
      isSmaller: compressedSize < originalSize,
    };
  }

  /**
   * Inspects document catalog metadata, structure, and dimensions.
   */
  public async inspectPdf(fileData: Uint8Array): Promise<PdfDocumentMetadata> {
    const isEncrypted = await this.isEncrypted(fileData);
    if (isEncrypted) {
      return {
        pageCount: 0,
        isEncrypted: true,
      };
    }

    const doc = await PDFDocument.load(fileData, { updateMetadata: false });
    const pageCount = doc.getPageCount();
    const firstPage = pageCount > 0 ? doc.getPage(0) : null;
    const pageSize = firstPage
      ? { width: Math.round(firstPage.getWidth()), height: Math.round(firstPage.getHeight()) }
      : undefined;

    return {
      title: doc.getTitle() || undefined,
      author: doc.getAuthor() || undefined,
      subject: doc.getSubject() || undefined,
      keywords: doc.getKeywords()?.split(';') || undefined,
      creator: doc.getCreator() || undefined,
      producer: doc.getProducer() || undefined,
      creationDate: doc.getCreationDate() || undefined,
      modificationDate: doc.getModificationDate() || undefined,
      pageCount,
      isEncrypted: false,
      pageSize,
    };
  }

  /**
   * Explicit v1 Metadata Sanitizer: Strips Title, Author, Subject, Keywords, Creator,
   * Producer, CreationDate, ModDate, and catalog XMP stream.
   */
  public async sanitizeMetadata(fileData: Uint8Array): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before sanitizing metadata.');
    }

    const doc = await PDFDocument.load(fileData, { updateMetadata: false });

    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('OwnPDF (https://ownpdf.app)');
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const catalog = doc.catalog;
    if (catalog.has((PDFDocument as any).context?.obj?.('Metadata'))) {
      catalog.delete((PDFDocument as any).context?.obj?.('Metadata'));
    }

    return doc.save();
  }

  /**
   * Helper: Parse page ranges string like "1-3, 5, 7-9" into 0-indexed ranges.
   */
  private parsePageRanges(
    rangeStr: string,
    totalPages: number
  ): Array<{ label: string; indices: number[] }> {
    if (!rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all') {
      return Array.from({ length: totalPages }, (_, i) => ({
        label: `page-${i + 1}`,
        indices: [i],
      }));
    }

    const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);
    const results: Array<{ label: string; indices: number[] }> = [];

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > totalPages) {
          throw new PdfError(
            'UNSUPPORTED_FORMAT',
            `Invalid range: "${part}". Ensure numbers are between 1 and ${totalPages}.`
          );
        }

        const validEnd = Math.min(end, totalPages);
        const indices: number[] = [];
        for (let p = start; p <= validEnd; p++) {
          indices.push(p - 1);
        }
        results.push({ label: `${start}-${validEnd}`, indices });
      } else {
        const pageNum = parseInt(part, 10);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
          throw new PdfError(
            'UNSUPPORTED_FORMAT',
            `Invalid page number: "${part}". Must be between 1 and ${totalPages}.`
          );
        }
        results.push({ label: `page-${pageNum}`, indices: [pageNum - 1] });
      }
    }

    return results;
  }
}

export const pdfEngine = new PdfEngine();
