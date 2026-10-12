import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type {
  TextMatchOccurrence,
  FindReplaceOptions,
  FindReplaceResult,
} from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

interface CharCoord {
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isUnsupported: boolean;
  item: any;
}

export class FindReplaceEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Searches the document for all occurrences of the query string.
   * Handles fragmented text items, non-horizontal orientations, and collision warnings.
   */
  public async searchPdfText(
    fileData: Uint8Array,
    searchQuery: string,
    options: {
      matchCase?: boolean;
      replaceText?: string;
    } = {}
  ): Promise<TextMatchOccurrence[]> {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before searching text.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const matchCase = options.matchCase ?? false;
    const normalizedQuery = matchCase ? searchQuery : searchQuery.toLowerCase();
    const replaceText = options.replaceText ?? '';

    const occurrences: TextMatchOccurrence[] = [];
    let matchCounter = 0;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNum = pageIdx + 1;
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageRotation = page.rotate || 0;

      const rawItems = (textContent.items || []).filter(
        (it: any) => typeof it?.str === 'string' && it.str.length > 0
      );

      if (rawItems.length === 0) {
        continue;
      }

      // Group text items into lines by Y baseline coordinate (tolerance: 2 points)
      const lines: Array<{ y: number; items: any[] }> = [];
      const lineTolerance = 2.0;

      for (const item of rawItems as any[]) {
        const itemY = item.transform[5];
        let line = lines.find((l) => Math.abs(l.y - itemY) <= lineTolerance);
        if (!line) {
          line = { y: itemY, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      }

      // Sort lines top to bottom (descending Y in PDF coordinates)
      lines.sort((a, b) => b.y - a.y);

      for (const line of lines) {
        // Sort items in line from left to right (ascending X)
        line.items.sort((a, b) => a.transform[4] - b.transform[4]);

        const charList: CharCoord[] = [];

        for (let i = 0; i < line.items.length; i++) {
          const it = line.items[i];
          const str = it.str;
          const itemX = it.transform[4];
          const itemY = it.transform[5];
          const scaleY = it.transform[3];
          const shearX = it.transform[1];
          const shearY = it.transform[2];

          // Check if text matrix has rotation/shear or vertical writing mode
          const hasComplexTransform =
            Math.abs(shearX) > 0.01 ||
            Math.abs(shearY) > 0.01 ||
            it.dir === 'ttb';

          const fontSize = Math.abs(scaleY) || it.height || 12;
          const itemHeight = it.height || fontSize;
          const itemWidth = it.width;

          // If there is an untracked gap between previous item and current, insert a virtual space
          if (charList.length > 0) {
            const prevChar = charList[charList.length - 1];
            const gap = itemX - (prevChar.x + prevChar.width);
            const spaceThreshold = fontSize * 0.2;

            if (gap >= spaceThreshold && !prevChar.char.endsWith(' ') && !str.startsWith(' ')) {
              charList.push({
                char: ' ',
                x: prevChar.x + prevChar.width,
                y: itemY,
                width: gap,
                height: itemHeight,
                fontSize,
                isUnsupported: false,
                item: null,
              });
            }
          }

          const avgCharWidth = str.length > 0 ? itemWidth / str.length : 0;

          for (let c = 0; c < str.length; c++) {
            charList.push({
              char: str[c],
              x: itemX + c * avgCharWidth,
              y: itemY,
              width: avgCharWidth,
              height: itemHeight,
              fontSize,
              isUnsupported: hasComplexTransform,
              item: it,
            });
          }
        }

        const assembledLineText = charList.map((c) => c.char).join('');
        const textToSearch = matchCase ? assembledLineText : assembledLineText.toLowerCase();

        let startIndex = 0;
        while (startIndex < textToSearch.length) {
          const foundIdx = textToSearch.indexOf(normalizedQuery, startIndex);
          if (foundIdx === -1) break;

          const endIndex = foundIdx + normalizedQuery.length;
          const matchedChars = charList.slice(foundIdx, endIndex);

          if (matchedChars.length > 0) {
            const first = matchedChars[0];
            const last = matchedChars[matchedChars.length - 1];
            const matchX = first.x;
            const matchWidth = Math.max(0, last.x + last.width - first.x);
            const matchY = first.y;
            const matchHeight = Math.max(...matchedChars.map((c) => c.height));
            const matchFontSize = Math.max(...matchedChars.map((c) => c.fontSize));
            const matchedText = assembledLineText.slice(foundIdx, endIndex);

            // Determine match status and reliability
            let status: 'VALID' | 'AMBIGUOUS_COORDINATES' | 'UNSUPPORTED_LAYOUT' = 'VALID';

            if (matchedChars.some((c) => c.isUnsupported)) {
              status = 'UNSUPPORTED_LAYOUT';
            } else if (
              matchWidth <= 0 ||
              isNaN(matchX) ||
              isNaN(matchY) ||
              matchedChars.some((c) => c.item === null && c.width > matchFontSize * 3)
            ) {
              status = 'AMBIGUOUS_COORDINATES';
            }

            // Layout collision detection: check if replacement is significantly wider
            let collisionWarning = false;
            if (replaceText.length > 0 && status === 'VALID') {
              const avgGlyphWidth = matchWidth / Math.max(1, searchQuery.length);
              const estReplacementWidth = replaceText.length * avgGlyphWidth;
              if (estReplacementWidth > matchWidth * 1.25) {
                collisionWarning = true;
              }
            }

            // Create contextual snippet
            const snippetStart = Math.max(0, foundIdx - 25);
            const snippetEnd = Math.min(assembledLineText.length, endIndex + 25);
            const rawSnippet =
              (snippetStart > 0 ? '...' : '') +
              assembledLineText.slice(snippetStart, snippetEnd).trim() +
              (snippetEnd < assembledLineText.length ? '...' : '');

            occurrences.push({
              id: `match_p${pageIdx}_${++matchCounter}`,
              pageIndex: pageIdx,
              pageNumber: pageNum,
              text: matchedText,
              x: matchX,
              y: matchY,
              width: matchWidth,
              height: matchHeight,
              fontSize: matchFontSize,
              rotation: pageRotation,
              snippet: rawSnippet,
              status,
              collisionWarning,
              selected: status === 'VALID',
            });
          }

          startIndex = endIndex;
        }
      }
    }

    return occurrences;
  }

  /**
   * Replaces text visually by drawing an opaque background patch and stamping
   * the replacement text at the detected coordinates using StandardFonts.Helvetica.
   * 
   * NOTE: This is visual masking. The original underlying text stream remains
   * present in the PDF object structure.
   */
  public async replacePdfText(
    fileData: Uint8Array,
    options: FindReplaceOptions
  ): Promise<FindReplaceResult> {
    const { searchQuery, replaceText, matchCase = false } = options;

    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Search query cannot be empty.');
    }

    // 1. Find all occurrences
    const occurrences = await this.searchPdfText(fileData, searchQuery, {
      matchCase,
      replaceText,
    });

    const totalMatches = occurrences.length;
    if (totalMatches === 0) {
      return {
        pdfData: fileData,
        totalMatches: 0,
        replacedCount: 0,
        skippedCount: 0,
        collisionCount: 0,
        occurrences: [],
      };
    }

    // Filter which occurrences to replace
    const selectedIds = options.selectedOccurrenceIds
      ? new Set(options.selectedOccurrenceIds)
      : null;

    const occurrencesToReplace = occurrences.filter((occ) => {
      if (occ.status !== 'VALID') return false;
      if (selectedIds) {
        return selectedIds.has(occ.id);
      }
      return true;
    });

    const skippedCount = totalMatches - occurrencesToReplace.length;
    const collisionCount = occurrencesToReplace.filter((o) => o.collisionWarning).length;

    // Load PDF with pdf-lib to apply visual patches and replacement text
    const doc = await PDFDocument.load(fileData);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const bgCol = options.backgroundColor ?? { r: 255, g: 255, b: 255 };
    const patchColor = rgb(bgCol.r / 255, bgCol.g / 255, bgCol.b / 255);
    const textColor = rgb(0.1, 0.1, 0.1);

    for (const occ of occurrencesToReplace) {
      const page = doc.getPage(occ.pageIndex);
      const fontSize = occ.fontSize;

      // Draw opaque background patch to occlude original text visually
      // Bounding box padding: extend slightly below baseline for descenders
      const patchX = occ.x - 0.5;
      const patchY = occ.y - fontSize * 0.25;
      const patchWidth = occ.width + 1.0;
      const patchHeight = Math.max(occ.height, fontSize * 1.2);

      page.drawRectangle({
        x: patchX,
        y: patchY,
        width: patchWidth,
        height: patchHeight,
        color: patchColor,
      });

      // Stamp replacement text at original baseline
      if (replaceText && replaceText.length > 0) {
        page.drawText(replaceText, {
          x: occ.x,
          y: occ.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }
    }

    const modifiedBytes = await doc.save();

    return {
      pdfData: modifiedBytes,
      totalMatches,
      replacedCount: occurrencesToReplace.length,
      skippedCount,
      collisionCount,
      occurrences,
    };
  }
}

export const findReplaceEngine = new FindReplaceEngine();
