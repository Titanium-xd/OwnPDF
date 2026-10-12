import {
  PDFDocument,
  degrees,
  PageSizes,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { qpdfClient } from './qpdf-client';
import type {
  ProtectOptions,
  UnlockResult,
  SplitResult,
  ImageInput,
  ImageToPdfOptions,
  CompressResult,
  PdfDocumentMetadata,
  RotateOptions,
  PageNumberOptions,
  WatermarkOptions,
  ExtractTextOptions,
  ExtractTextResult,
  CropPdfOptions,
  ReversePagesOptions,
  DetectBlankPagesOptions,
  DetectBlankPagesResult,
  BlankPageCandidate,
  BlankPageConfidence,
  ResizePdfOptions,
  StandardPageSize,
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
   * Rotates pages of a PDF document by 90, 180, or 270 degrees.
   * Can rotate all pages, specified page ranges, or per-page overrides.
   */
  public async rotatePdf(
    fileData: Uint8Array,
    options: RotateOptions
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before rotating pages.');
    }

    const doc = await PDFDocument.load(fileData);
    const totalPages = doc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    for (let i = 0; i < totalPages; i++) {
      const page = doc.getPage(i);
      const isTarget = targetIndices.includes(i);
      let delta = 0;

      if (options.perPageRotations && options.perPageRotations.has(i)) {
        delta = options.perPageRotations.get(i)!;
      } else if (isTarget) {
        delta = options.rotationAngle;
      }

      if (delta !== 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + delta) % 360));
      }
    }

    return doc.save();
  }

  /**
   * Stamps page numbers onto selected or all pages with configurable placement, font size, margins, and format.
   */
  public async addPageNumbers(
    fileData: Uint8Array,
    options: PageNumberOptions = {}
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before adding page numbers.');
    }

    const doc = await PDFDocument.load(fileData);
    const totalPages = doc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = options.fontSize ?? 10;
    const margin = options.margin ?? 30;
    const position = options.position ?? 'bottom-center';
    const startNum = options.startNumber ?? 1;
    const format = options.format ?? 'PAGE_N_OF_TOTAL';
    const col = options.color ?? { r: 0.2, g: 0.25, b: 0.3 };
    const textColor = rgb(col.r, col.g, col.b);

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    const targetCount = targetIndices.length;

    for (let idx = 0; idx < targetCount; idx++) {
      const pageIndex = targetIndices[idx];
      const page = doc.getPage(pageIndex);
      const num = startNum + idx;

      let text = `${num}`;
      if (format === 'PAGE_N') {
        text = `Page ${num}`;
      } else if (format === 'PAGE_N_OF_TOTAL') {
        text = `Page ${num} of ${totalPages}`;
      } else if (format === 'N_OF_TOTAL') {
        text = `${num} / ${totalPages}`;
      }

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);
      const { width, height } = page.getSize();

      let x = margin;
      let y = margin;

      if (position.includes('top')) {
        y = height - margin - textHeight;
      } else {
        y = margin;
      }

      if (position.includes('left')) {
        x = margin;
      } else if (position.includes('right')) {
        x = width - margin - textWidth;
      } else {
        // center
        x = (width - textWidth) / 2;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: textColor,
      });
    }

    return doc.save();
  }

  /**
   * Stamps text or image watermark onto PDF pages with custom opacity, rotation, and placement.
   */
  public async addWatermark(
    fileData: Uint8Array,
    options: WatermarkOptions
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before adding a watermark.');
    }

    const doc = await PDFDocument.load(fileData);
    const totalPages = doc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    if (options.type === 'text') {
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = options.fontSize ?? 48;
      const opacity = Math.min(1, Math.max(0.05, options.opacity ?? 0.25));
      const col = options.color ?? { r: 0.5, g: 0.5, b: 0.5 };
      const textColor = rgb(col.r, col.g, col.b);
      const angle = options.rotationDegrees ?? 45;
      const position = options.position ?? 'center';
      const text = options.text.trim() || 'WATERMARK';

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      for (const pageIndex of targetIndices) {
        const page = doc.getPage(pageIndex);
        const { width, height } = page.getSize();

        let x = (width - textWidth) / 2;
        let y = (height - textHeight) / 2;

        if (position === 'center') {
          // Rotate around center of page
          const rad = (angle * Math.PI) / 180;
          x = width / 2 - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad);
          y = height / 2 - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad);
        } else if (position === 'top-left') {
          x = 40;
          y = height - 40 - textHeight;
        } else if (position === 'top-right') {
          x = width - 40 - textWidth;
          y = height - 40 - textHeight;
        } else if (position === 'bottom-left') {
          x = 40;
          y = 40;
        } else if (position === 'bottom-right') {
          x = width - 40 - textWidth;
          y = 40;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: textColor,
          opacity,
          rotate: degrees(position === 'center' ? angle : 0),
        });
      }
    } else if (options.type === 'image') {
      let embeddedImage;
      if (options.imageType === 'image/jpeg') {
        embeddedImage = await doc.embedJpg(options.imageData);
      } else {
        embeddedImage = await doc.embedPng(options.imageData);
      }

      const scale = options.scale ?? 0.5;
      const dims = embeddedImage.scale(scale);
      const opacity = Math.min(1, Math.max(0.05, options.opacity ?? 0.3));
      const position = options.position ?? 'center';

      for (const pageIndex of targetIndices) {
        const page = doc.getPage(pageIndex);
        const { width, height } = page.getSize();

        let x = (width - dims.width) / 2;
        let y = (height - dims.height) / 2;

        if (position === 'top-left') {
          x = 40;
          y = height - 40 - dims.height;
        } else if (position === 'top-right') {
          x = width - 40 - dims.width;
          y = height - 40 - dims.height;
        } else if (position === 'bottom-left') {
          x = 40;
          y = 40;
        } else if (position === 'bottom-right') {
          x = width - 40 - dims.width;
          y = 40;
        }

        page.drawImage(embeddedImage, {
          x,
          y,
          width: dims.width,
          height: dims.height,
          opacity,
        });
      }
    }

    return doc.save();
  }

  /**
   * Extracts selectable text from PDF pages with reconstructed reading order and statistics.
   */
  public async extractText(
    fileData: Uint8Array,
    options: ExtractTextOptions = {}
  ): Promise<ExtractTextResult> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before extracting text.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages === 0) {
      return {
        text: '',
        pageCount: 0,
        wordCount: 0,
        characterCount: 0,
        isEmpty: true,
      };
    }

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    const pageTexts: string[] = [];

    for (const pageIdx of targetIndices) {
      const pageNum = pageIdx + 1;
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const items = (textContent.items || []).filter(
        (it: any) => typeof it?.str === 'string' && it.str.length > 0
      );

      if (items.length === 0) {
        pageTexts.push(`--- Page ${pageNum} of ${totalPages} ---\n[No selectable text found on this page]`);
        continue;
      }

      // Group items into lines by Y coordinate
      // PDF coordinate: transform[5] is Y from bottom, transform[4] is X from left
      const lines: Array<{ y: number; items: any[] }> = [];
      const lineTolerance = 4; // points

      for (const item of items as any[]) {
        const itemY = item.transform[5];
        let line = lines.find((l) => Math.abs(l.y - itemY) <= lineTolerance);
        if (!line) {
          line = { y: itemY, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      }

      // Sort lines top to bottom (Y descending)
      lines.sort((a, b) => b.y - a.y);

      // In each line, sort items left to right (X ascending)
      const lineStrings = lines.map((l) => {
        l.items.sort((a, b) => a.transform[4] - b.transform[4]);
        return l.items.map((it) => it.str).join(' ');
      });

      const pageBody = lineStrings.join('\n');
      pageTexts.push(`--- Page ${pageNum} of ${totalPages} ---\n${pageBody}`);
    }

    const fullText = pageTexts.join('\n\n');
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const characterCount = fullText.length;
    const hasMeaningfulText = pageTexts.some((p) => !p.includes('[No selectable text found on this page]'));

    return {
      text: fullText,
      pageCount: targetIndices.length,
      wordCount,
      characterCount,
      isEmpty: !hasMeaningfulText || wordCount === 0,
    };
  }

  /**
   * Sets the visual CropBox on target pages without permanently deleting underlying data.
   */
  public async cropPdf(
    fileData: Uint8Array,
    options: CropPdfOptions
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before cropping pages.');
    }

    const doc = await PDFDocument.load(fileData);
    const totalPages = doc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    for (const pageIdx of targetIndices) {
      const page = doc.getPage(pageIdx);
      const mediaBox = page.getMediaBox();
      const { x, y, width, height } = mediaBox;

      let ml = options.margins.left;
      let mr = options.margins.right;
      let mt = options.margins.top;
      let mb = options.margins.bottom;

      if (options.isPercentage) {
        ml = width * (options.margins.left / 100);
        mr = width * (options.margins.right / 100);
        mt = height * (options.margins.top / 100);
        mb = height * (options.margins.bottom / 100);
      }

      const newX = x + ml;
      const newY = y + mb;
      const newWidth = width - ml - mr;
      const newHeight = height - mt - mb;

      if (newWidth <= 15 || newHeight <= 15) {
        throw new PdfError(
          'UNSUPPORTED_FORMAT',
          `Crop margins result in invalid dimensions (${Math.round(newWidth)}x${Math.round(newHeight)} pt). Please reduce margins.`
        );
      }

      page.setCropBox(newX, newY, newWidth, newHeight);
    }

    return doc.save();
  }

  /**
   * Parses page range string (e.g. "1-3, 5, 8") into a sorted, unique array of 0-based page indices.
   */
  public parseTargetIndices(rangeStr: string | undefined, totalPages: number): number[] {
    if (!rangeStr || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const ranges = this.parsePageRanges(rangeStr, totalPages);
    const set = new Set<number>();
    for (const r of ranges) {
      for (const idx of r.indices) {
        set.add(idx);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
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

  /**
   * Reverses pages in a PDF document based on selected mode:
   * - 'all': Inverts entire document sequence (N -> 1)
   * - 'range': Inverts only a specified page range (e.g. "3-6"), preserving order before and after
   * - 'duplex-inverted': Interleaves odd front pages with reversed even back pages (for scanner feeds)
   * Preserves page contents, form fields, page-level annotations, and document metadata.
   */
  public async reversePdfPages(
    fileData: Uint8Array,
    options: ReversePagesOptions = { mode: 'all' }
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before reversing pages.');
    }

    const srcDoc = await PDFDocument.load(fileData);
    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }
    if (totalPages === 1) {
      return fileData;
    }

    let targetIndices: number[] = [];

    if (options.mode === 'all') {
      targetIndices = Array.from({ length: totalPages }, (_, i) => totalPages - 1 - i);
    } else if (options.mode === 'range') {
      if (!options.pageRange || !options.pageRange.trim()) {
        throw new PdfError('UNSUPPORTED_FORMAT', 'Page range is required for range mode (e.g. "2-5").');
      }
      const parsed = this.parsePageRanges(options.pageRange, totalPages);
      const rangeIndices = parsed.flatMap((p) => p.indices);
      if (rangeIndices.length <= 1) {
        throw new PdfError('UNSUPPORTED_FORMAT', 'Page range must contain at least 2 pages to reverse.');
      }
      const minIdx = Math.min(...rangeIndices);
      const maxIdx = Math.max(...rangeIndices);

      targetIndices = Array.from({ length: totalPages }, (_, i) => i);
      const invertedSubRange = targetIndices.slice(minIdx, maxIdx + 1).reverse();
      targetIndices.splice(minIdx, invertedSubRange.length, ...invertedSubRange);
    } else if (options.mode === 'duplex-inverted') {
      const oddPages: number[] = []; // 0, 2, 4... (Fronts)
      const evenPages: number[] = []; // 1, 3, 5... (Backs)

      for (let i = 0; i < totalPages; i++) {
        if (i % 2 === 0) {
          oddPages.push(i);
        } else {
          evenPages.push(i);
        }
      }

      const reversedEven = evenPages.reverse();
      targetIndices = [];

      const maxLen = Math.max(oddPages.length, reversedEven.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < oddPages.length) targetIndices.push(oddPages[i]);
        if (i < reversedEven.length) targetIndices.push(reversedEven[i]);
      }
    }

    const targetDoc = await PDFDocument.create();
    const copiedPages = await targetDoc.copyPages(srcDoc, targetIndices);
    for (const page of copiedPages) {
      targetDoc.addPage(page);
    }

    const title = srcDoc.getTitle();
    if (title) targetDoc.setTitle(title);
    const author = srcDoc.getAuthor();
    if (author) targetDoc.setAuthor(author);
    const subject = srcDoc.getSubject();
    if (subject) targetDoc.setSubject(subject);
    const keywords = srcDoc.getKeywords();
    if (keywords) targetDoc.setKeywords(keywords.split(';'));
    const creator = srcDoc.getCreator();
    if (creator) targetDoc.setCreator(creator);
    const producer = srcDoc.getProducer();
    if (producer) targetDoc.setProducer(producer);

    return targetDoc.save();
  }

  /**
   * Corrected Ink Coverage calculation:
   * Strictly separates opaque white paper background (R>=240, G>=240, B>=240, A>32)
   * and empty transparent regions (A<=32) from actual ink marks.
   * Returns ink percentage (0 - 100).
   */
  public static calculateInkCoverage(rgbaData: Uint8ClampedArray | Uint8Array): number {
    const totalPixels = rgbaData.length / 4;
    if (totalPixels === 0) return 0;

    let inkPixels = 0;
    for (let i = 0; i < rgbaData.length; i += 4) {
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      const a = rgbaData[i + 3];

      // Transparent pixel -> Not ink
      if (a <= 32) continue;

      // Opaque white/near-white pixel -> Page background, not ink
      if (r >= 240 && g >= 240 && b >= 240) continue;

      // Pixel has opacity and deviates from white paper -> Count as ink
      inkPixels++;
    }

    return (inkPixels / totalPixels) * 100;
  }

  /**
   * Evaluates each page using text glyph count and canvas pixel ink coverage.
   * Classifies pages into HIGH_CONFIDENCE_BLANK, POSSIBLE_NOISE, and HAS_CONTENT.
   * Operates as a candidate suggestion engine, requiring explicit user confirmation.
   */
  public async detectBlankPages(
    fileData: Uint8Array,
    options: DetectBlankPagesOptions = {}
  ): Promise<DetectBlankPagesResult> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before detecting blank pages.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const threshold = options.threshold ?? 0.15;

    const candidates: BlankPageCandidate[] = [];

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNum = pageIdx + 1;
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const textGlyphCount = (textContent.items || []).reduce(
        (acc: number, it: any) =>
          acc + (typeof it?.str === 'string' ? it.str.trim().length : 0),
        0
      );

      let inkCoverage = 0;

      // If in browser or canvas environment, render low-res thumbnail to sample pixel ink
      if (typeof document !== 'undefined') {
        try {
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport,
            } as any).promise;

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            inkCoverage = PdfEngine.calculateInkCoverage(imgData.data);
          }
        } catch {
          // Fall back gracefully if canvas rendering is unsupported in environment
        }
      }

      let status: BlankPageConfidence = 'HAS_CONTENT';

      if (textGlyphCount === 0 && inkCoverage < 0.05) {
        status = 'HIGH_CONFIDENCE_BLANK';
      } else if (textGlyphCount === 0 && inkCoverage <= Math.max(0.35, threshold)) {
        status = 'POSSIBLE_NOISE';
      } else {
        status = 'HAS_CONTENT';
      }

      const selected = status === 'HIGH_CONFIDENCE_BLANK' || status === 'POSSIBLE_NOISE';

      candidates.push({
        pageIndex: pageIdx,
        pageNumber: pageNum,
        inkCoverage,
        textGlyphCount,
        status,
        selected,
      });
    }

    const blankCount = candidates.filter((c) => c.status !== 'HAS_CONTENT').length;

    return {
      candidates,
      blankCount,
      totalPages,
    };
  }

  /**
   * Deletes specific page indices from a PDF document, preserving metadata and remaining pages.
   */
  public async deletePages(
    fileData: Uint8Array,
    pageIndicesToDelete: number[]
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before deleting pages.');
    }

    const srcDoc = await PDFDocument.load(fileData);
    const totalPages = srcDoc.getPageCount();
    const toDeleteSet = new Set(pageIndicesToDelete);

    const remainingIndices: number[] = [];
    for (let i = 0; i < totalPages; i++) {
      if (!toDeleteSet.has(i)) {
        remainingIndices.push(i);
      }
    }

    if (remainingIndices.length === 0) {
      throw new PdfError(
        'UNSUPPORTED_FORMAT',
        'Cannot delete all pages in a document. At least one page must remain.'
      );
    }

    if (remainingIndices.length === totalPages) {
      return fileData;
    }

    const targetDoc = await PDFDocument.create();
    const copiedPages = await targetDoc.copyPages(srcDoc, remainingIndices);
    for (const page of copiedPages) {
      targetDoc.addPage(page);
    }

    const title = srcDoc.getTitle();
    if (title) targetDoc.setTitle(title);
    const author = srcDoc.getAuthor();
    if (author) targetDoc.setAuthor(author);
    const subject = srcDoc.getSubject();
    if (subject) targetDoc.setSubject(subject);
    const keywords = srcDoc.getKeywords();
    if (keywords) targetDoc.setKeywords(keywords.split(';'));
    const creator = srcDoc.getCreator();
    if (creator) targetDoc.setCreator(creator);
    const producer = srcDoc.getProducer();
    if (producer) targetDoc.setProducer(producer);

    return targetDoc.save();
  }

  public static readonly STANDARD_PAGE_SIZES: Record<StandardPageSize, [number, number]> = {
    A4: [595.28, 841.89],
    LETTER: [612.0, 792.0],
    A3: [841.89, 1190.55],
    A5: [419.53, 595.28],
    LEGAL: [612.0, 1008.0],
    TABLOID: [792.0, 1224.0],
  };

  /**
   * Resizes pages to target dimensions using one of three modes:
   * - 'fit': Scales content proportionally with margins, adding letterbox/pillarbox if aspect ratio changes
   * - 'fill-crop': Scales content proportionally to cover the page, clipping excess
   * - 'canvas': Preserves 100% vector scale, centering content within new canvas boundaries
   */
  public async resizePdf(
    fileData: Uint8Array,
    options: ResizePdfOptions
  ): Promise<Uint8Array> {
    const isEnc = await this.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before resizing.');
    }

    const srcDoc = await PDFDocument.load(fileData);
    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    let baseWidth: number;
    let baseHeight: number;

    if (typeof options.targetSize === 'string') {
      const sizeTuple = PdfEngine.STANDARD_PAGE_SIZES[options.targetSize];
      if (!sizeTuple) {
        throw new PdfError('UNSUPPORTED_FORMAT', `Unsupported page size: ${options.targetSize}`);
      }
      [baseWidth, baseHeight] = sizeTuple;
    } else {
      baseWidth = options.targetSize.width;
      baseHeight = options.targetSize.height;
    }

    const margin = options.margin ?? 0;
    const mode = options.mode ?? 'fit';
    const orientation = options.orientation ?? 'keep';

    const targetIndices = options.pageRange
      ? this.parseTargetIndices(options.pageRange, totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    const targetDoc = await PDFDocument.create();

    for (let i = 0; i < totalPages; i++) {
      const srcPage = srcDoc.getPage(i);
      const isTarget = targetIndices.includes(i);

      if (!isTarget) {
        const [copied] = await targetDoc.copyPages(srcDoc, [i]);
        targetDoc.addPage(copied);
        continue;
      }

      const srcSize = srcPage.getSize();
      const rot = ((srcPage.getRotation().angle % 360) + 360) % 360;
      const visualSrcW = rot === 90 || rot === 270 ? srcSize.height : srcSize.width;
      const visualSrcH = rot === 90 || rot === 270 ? srcSize.width : srcSize.height;

      let targetW = baseWidth;
      let targetH = baseHeight;

      if (orientation === 'portrait') {
        targetW = Math.min(baseWidth, baseHeight);
        targetH = Math.max(baseWidth, baseHeight);
      } else if (orientation === 'landscape') {
        targetW = Math.max(baseWidth, baseHeight);
        targetH = Math.min(baseWidth, baseHeight);
      } else {
        const isLandscape = visualSrcW > visualSrcH;
        targetW = isLandscape ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
        targetH = isLandscape ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
      }

      const hasContents = srcPage.node.Contents() !== undefined;
      const newPage = targetDoc.addPage([targetW, targetH]);

      if (!hasContents) {
        continue;
      }

      const embedded = await targetDoc.embedPage(srcPage);
      const availW = Math.max(1, targetW - 2 * margin);
      const availH = Math.max(1, targetH - 2 * margin);

      let scale = 1.0;
      if (mode === 'fit') {
        scale = Math.min(availW / visualSrcW, availH / visualSrcH);
      } else if (mode === 'fill-crop') {
        scale = Math.max(availW / visualSrcW, availH / visualSrcH);
      } else if (mode === 'canvas') {
        scale = 1.0;
      }

      const drawW = visualSrcW * scale;
      const drawH = visualSrcH * scale;

      const x = margin + (availW - drawW) / 2;
      const y = margin + (availH - drawH) / 2;

      const rawW = rot === 90 || rot === 270 ? drawH : drawW;
      const rawH = rot === 90 || rot === 270 ? drawW : drawH;

      if (rot === 0) {
        newPage.drawPage(embedded, { x, y, width: drawW, height: drawH });
      } else if (rot === 90) {
        newPage.drawPage(embedded, {
          x: x + drawW,
          y,
          width: rawW,
          height: rawH,
          rotate: degrees(90),
        });
      } else if (rot === 180) {
        newPage.drawPage(embedded, {
          x: x + drawW,
          y: y + drawH,
          width: rawW,
          height: rawH,
          rotate: degrees(180),
        });
      } else if (rot === 270) {
        newPage.drawPage(embedded, {
          x,
          y: y + drawH,
          width: rawW,
          height: rawH,
          rotate: degrees(270),
        });
      }
    }

    const title = srcDoc.getTitle();
    if (title) targetDoc.setTitle(title);
    const author = srcDoc.getAuthor();
    if (author) targetDoc.setAuthor(author);
    const subject = srcDoc.getSubject();
    if (subject) targetDoc.setSubject(subject);
    const keywords = srcDoc.getKeywords();
    if (keywords) targetDoc.setKeywords(keywords.split(';'));
    const creator = srcDoc.getCreator();
    if (creator) targetDoc.setCreator(creator);
    const producer = srcDoc.getProducer();
    if (producer) targetDoc.setProducer(producer);

    return targetDoc.save();
  }
}

export const pdfEngine = new PdfEngine();

