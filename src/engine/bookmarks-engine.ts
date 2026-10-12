import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFString,
  PDFNumber,
  PDFRef,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { BookmarkItem, AddBookmarksOptions, AddBookmarksResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

export class BookmarksEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Extracts existing outline bookmarks from a PDF document using PDF.js.
   */
  public async getBookmarks(fileData: Uint8Array): Promise<BookmarkItem[]> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before viewing bookmarks.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const rawOutlines = await pdfDoc.getOutline();
    if (!rawOutlines || rawOutlines.length === 0) {
      return [];
    }

    const results: BookmarkItem[] = [];
    let counter = 0;

    for (const item of rawOutlines) {
      let pageNum = 1;
      if (item.dest) {
        try {
          if (typeof item.dest === 'string') {
            const destArr = await pdfDoc.getDestination(item.dest);
            if (destArr && destArr.length > 0 && typeof destArr[0] === 'object') {
              const pIdx = await pdfDoc.getPageIndex(destArr[0]);
              pageNum = pIdx + 1;
            }
          } else if (Array.isArray(item.dest) && item.dest.length > 0) {
            const pIdx = await pdfDoc.getPageIndex(item.dest[0]);
            pageNum = pIdx + 1;
          }
        } catch {
          pageNum = 1;
        }
      }

      const parentItem: BookmarkItem = {
        id: `bm_${++counter}`,
        title: item.title || 'Untitled Bookmark',
        targetPageNumber: pageNum,
        level: 0,
        children: [],
      };

      if (item.items && item.items.length > 0) {
        for (const sub of item.items) {
          let subPageNum = pageNum;
          if (sub.dest) {
            try {
              if (typeof sub.dest === 'string') {
                const destArr = await pdfDoc.getDestination(sub.dest);
                if (destArr && destArr.length > 0 && typeof destArr[0] === 'object') {
                  const pIdx = await pdfDoc.getPageIndex(destArr[0]);
                  subPageNum = pIdx + 1;
                }
              } else if (Array.isArray(sub.dest) && sub.dest.length > 0) {
                const pIdx = await pdfDoc.getPageIndex(sub.dest[0]);
                subPageNum = pIdx + 1;
              }
            } catch {
              subPageNum = pageNum;
            }
          }

          parentItem.children?.push({
            id: `bm_${++counter}`,
            title: sub.title || 'Untitled Sub-bookmark',
            targetPageNumber: subPageNum,
            level: 1,
          });
        }
      }

      results.push(parentItem);
    }

    return results;
  }

  /**
   * Builds an ISO 32000-1 compliant outline tree in the PDF catalog and sets /PageMode /UseOutlines.
   * Validates target page numbers against document bounds.
   */
  public async addBookmarks(
    fileData: Uint8Array,
    options: AddBookmarksOptions
  ): Promise<AddBookmarksResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before adding bookmarks.');
    }

    const doc = await PDFDocument.load(fileData);
    const totalPages = doc.getPageCount();

    if (totalPages === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Document contains zero pages.');
    }

    const { bookmarks, replaceExisting = true } = options;

    if (!bookmarks || bookmarks.length === 0) {
      if (replaceExisting) {
        doc.catalog.delete(PDFName.of('Outlines'));
        doc.catalog.delete(PDFName.of('PageMode'));
      }
      return {
        pdfData: await doc.save(),
        totalBookmarksCount: 0,
      };
    }

    // 1. Validate all page numbers
    for (const bm of bookmarks) {
      if (bm.targetPageNumber < 1 || bm.targetPageNumber > totalPages) {
        throw new PdfError(
          'UNSUPPORTED_FORMAT',
          `Target page ${bm.targetPageNumber} for bookmark "${bm.title}" is out of bounds (1 - ${totalPages}).`
        );
      }
      if (bm.children) {
        for (const child of bm.children) {
          if (child.targetPageNumber < 1 || child.targetPageNumber > totalPages) {
            throw new PdfError(
              'UNSUPPORTED_FORMAT',
              `Target page ${child.targetPageNumber} for sub-bookmark "${child.title}" is out of bounds (1 - ${totalPages}).`
            );
          }
        }
      }
    }

    // 2. Create Root /Outlines Dictionary
    const outlinesDict = doc.context.obj({
      Type: 'Outlines',
    });
    const outlinesRef = doc.context.register(outlinesDict);

    // 3. Create items and link siblings and children
    const topLevelRefs: PDFRef[] = [];
    let totalItemsCount = 0;

    for (const bm of bookmarks) {
      const pageIndex = bm.targetPageNumber - 1;
      const targetPage = doc.getPage(pageIndex);

      const itemDict = doc.context.obj({
        Title: PDFString.of(bm.title),
        Parent: outlinesRef,
        Dest: [targetPage.ref, PDFName.of('Fit')],
      });
      const itemRef = doc.context.register(itemDict);
      topLevelRefs.push(itemRef);
      totalItemsCount++;

      // Handle nested children if present
      if (bm.children && bm.children.length > 0) {
        const childRefs: PDFRef[] = [];
        for (const child of bm.children) {
          const childPage = doc.getPage(child.targetPageNumber - 1);
          const childDict = doc.context.obj({
            Title: PDFString.of(child.title),
            Parent: itemRef,
            Dest: [childPage.ref, PDFName.of('Fit')],
          });
          const childRef = doc.context.register(childDict);
          childRefs.push(childRef);
          totalItemsCount++;
        }

        // Link child siblings
        for (let c = 0; c < childRefs.length; c++) {
          const cDict = doc.context.lookup(childRefs[c]) as PDFDict;
          if (c > 0) {
            cDict.set(PDFName.of('Prev'), childRefs[c - 1]);
          }
          if (c < childRefs.length - 1) {
            cDict.set(PDFName.of('Next'), childRefs[c + 1]);
          }
        }

        itemDict.set(PDFName.of('First'), childRefs[0]);
        itemDict.set(PDFName.of('Last'), childRefs[childRefs.length - 1]);
        itemDict.set(PDFName.of('Count'), PDFNumber.of(childRefs.length));
      }
    }

    // Link top-level siblings
    for (let i = 0; i < topLevelRefs.length; i++) {
      const itemDict = doc.context.lookup(topLevelRefs[i]) as PDFDict;
      if (i > 0) {
        itemDict.set(PDFName.of('Prev'), topLevelRefs[i - 1]);
      }
      if (i < topLevelRefs.length - 1) {
        itemDict.set(PDFName.of('Next'), topLevelRefs[i + 1]);
      }
    }

    outlinesDict.set(PDFName.of('First'), topLevelRefs[0]);
    outlinesDict.set(PDFName.of('Last'), topLevelRefs[topLevelRefs.length - 1]);
    outlinesDict.set(PDFName.of('Count'), PDFNumber.of(totalItemsCount));

    // Register in Catalog
    doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
    doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

    const modifiedBytes = await doc.save();

    return {
      pdfData: modifiedBytes,
      totalBookmarksCount: totalItemsCount,
    };
  }
}

export const bookmarksEngine = new BookmarksEngine();
