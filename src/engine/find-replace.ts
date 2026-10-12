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
  FindReplaceRule,
  RuleReport,
} from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

interface CharCoord {
  char: string;
  charIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isUnsupported: boolean;
  item: any;
}

interface InternalOccurrence extends TextMatchOccurrence {
  lineIndex: number;
  startCharIdx: number;
  endCharIdx: number;
}

function boxesIntersect(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return !(
    x1 + w1 <= x2 ||
    x2 + w2 <= x1 ||
    y1 + h1 <= y2 ||
    y2 + h2 <= y1
  );
}

export class FindReplaceEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Searches the document for occurrences of query strings across one or multiple rules.
   * Handles fragmented text items, non-horizontal orientations, collision warnings,
   * textual overlaps, and visual patch bounding box intersections.
   */
  public async searchPdfText(
    fileData: Uint8Array,
    searchQueryOrOptions: string | FindReplaceOptions,
    options: {
      matchCase?: boolean;
      replaceText?: string;
      rules?: FindReplaceRule[];
    } = {}
  ): Promise<TextMatchOccurrence[]> {
    let rules: FindReplaceRule[] = [];

    if (typeof searchQueryOrOptions === 'string') {
      if (options.rules && options.rules.length > 0) {
        rules = options.rules;
      } else if (searchQueryOrOptions.trim().length > 0) {
        rules = [
          {
            id: 'rule-1',
            searchQuery: searchQueryOrOptions,
            replaceText: options.replaceText ?? '',
            matchCase: options.matchCase ?? false,
          },
        ];
      }
    } else if (searchQueryOrOptions && typeof searchQueryOrOptions === 'object') {
      if (searchQueryOrOptions.rules && searchQueryOrOptions.rules.length > 0) {
        rules = searchQueryOrOptions.rules;
      } else if (searchQueryOrOptions.searchQuery && searchQueryOrOptions.searchQuery.trim().length > 0) {
        rules = [
          {
            id: 'rule-1',
            searchQuery: searchQueryOrOptions.searchQuery,
            replaceText: searchQueryOrOptions.replaceText ?? '',
            matchCase: searchQueryOrOptions.matchCase ?? false,
          },
        ];
      }
    }

    // Filter valid rules (non-empty queries)
    const activeRules = rules.filter((r) => r.searchQuery && r.searchQuery.trim().length > 0);
    if (activeRules.length === 0) {
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

    const occurrences: InternalOccurrence[] = [];
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

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
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
                charIndex: charList.length,
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
              charIndex: charList.length,
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

        // Search against all active rules
        for (let rIdx = 0; rIdx < activeRules.length; rIdx++) {
          const rule = activeRules[rIdx];
          const searchQuery = rule.searchQuery;
          const matchCase = rule.matchCase ?? false;
          const normalizedQuery = matchCase ? searchQuery : searchQuery.toLowerCase();
          const textToSearch = matchCase ? assembledLineText : assembledLineText.toLowerCase();
          const replaceText = rule.replaceText ?? '';

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
                id: `match_p${pageIdx}_r${rIdx}_${++matchCounter}`,
                ruleId: rule.id,
                ruleIndex: rIdx,
                pageIndex: pageIdx,
                pageNumber: pageNum,
                text: matchedText,
                replaceText,
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
                lineIndex: lineIdx,
                startCharIdx: foundIdx,
                endCharIdx: endIndex,
              });
            }

            startIndex = endIndex;
          }
        }
      }
    }

    // 2. Dual Conflict & Overlap Detection (Textual & Visual Patch Overlap)
    for (let i = 0; i < occurrences.length; i++) {
      const occA = occurrences[i];
      if (occA.status === 'AMBIGUOUS_COORDINATES' || occA.status === 'UNSUPPORTED_LAYOUT') {
        continue;
      }

      const patchXA = occA.x - 0.5;
      const patchYA = occA.y - occA.fontSize * 0.25;
      const patchWA = occA.width + 1.0;
      const patchHA = Math.max(occA.height, occA.fontSize * 1.2);

      for (let j = i + 1; j < occurrences.length; j++) {
        const occB = occurrences[j];
        if (occA.pageIndex !== occB.pageIndex) continue;
        if (occB.status === 'AMBIGUOUS_COORDINATES' || occB.status === 'UNSUPPORTED_LAYOUT') {
          continue;
        }

        // A. Textual Overlap on same line
        const isTextOverlap =
          occA.lineIndex === occB.lineIndex &&
          Math.max(occA.startCharIdx, occB.startCharIdx) < Math.min(occA.endCharIdx, occB.endCharIdx);

        // B. Visual Patch Overlap in 2D coordinate space
        const patchXB = occB.x - 0.5;
        const patchYB = occB.y - occB.fontSize * 0.25;
        const patchWB = occB.width + 1.0;
        const patchHB = Math.max(occB.height, occB.fontSize * 1.2);

        const isVisualOverlap = boxesIntersect(
          patchXA, patchYA, patchWA, patchHA,
          patchXB, patchYB, patchWB, patchHB
        );

        if (isTextOverlap || isVisualOverlap) {
          const reasonA = isTextOverlap
            ? `Textually overlaps with Rule ${(occB.ruleIndex ?? 0) + 1} ("${occB.text}")`
            : `Visual patch overlaps with Rule ${(occB.ruleIndex ?? 0) + 1}`;
          const reasonB = isTextOverlap
            ? `Textually overlaps with Rule ${(occA.ruleIndex ?? 0) + 1} ("${occA.text}")`
            : `Visual patch overlaps with Rule ${(occA.ruleIndex ?? 0) + 1}`;

          occA.status = 'CONFLICT';
          occA.isConflicting = true;
          occA.conflictReason = reasonA;
          occA.selected = false;

          occB.status = 'CONFLICT';
          occB.isConflicting = true;
          occB.conflictReason = reasonB;
          occB.selected = false;
        }
      }
    }

    return occurrences.map(({ lineIndex, startCharIdx, endCharIdx, ...rest }) => rest);
  }

  /**
   * Replaces text visually across multiple rules.
   * Scans original document text and applies opaque patches + replacement text in a single draw pass.
   * Conflicting occurrences are excluded from replacement and counted separately.
   */
  public async replacePdfText(
    fileData: Uint8Array,
    options: FindReplaceOptions
  ): Promise<FindReplaceResult> {
    let rules: FindReplaceRule[] = [];

    if (options.rules && options.rules.length > 0) {
      rules = options.rules;
    } else if (options.searchQuery && options.searchQuery.trim().length > 0) {
      rules = [
        {
          id: 'rule-1',
          searchQuery: options.searchQuery,
          replaceText: options.replaceText ?? '',
          matchCase: options.matchCase ?? false,
        },
      ];
    }

    const activeRules = rules.filter((r) => r.searchQuery && r.searchQuery.trim().length > 0);
    if (activeRules.length === 0) {
      throw new PdfError('CORRUPTED_DOCUMENT', 'Search query cannot be empty. At least one valid search rule is required.');
    }

    // 1. Find all occurrences
    const occurrences = await this.searchPdfText(fileData, options);

    const totalMatches = occurrences.length;
    if (totalMatches === 0) {
      const emptyReports: RuleReport[] = activeRules.map((r) => ({
        ruleId: r.id,
        searchQuery: r.searchQuery,
        replaceText: r.replaceText,
        totalMatches: 0,
        replacedCount: 0,
        skippedCount: 0,
        unsupportedCount: 0,
        collisionCount: 0,
        conflictCount: 0,
      }));

      return {
        pdfData: fileData,
        totalMatches: 0,
        replacedCount: 0,
        skippedCount: 0,
        collisionCount: 0,
        conflictCount: 0,
        ruleReports: emptyReports,
        occurrences: [],
      };
    }

    // Filter which occurrences to replace
    const selectedIds = options.selectedOccurrenceIds
      ? new Set(options.selectedOccurrenceIds)
      : null;

    // Conflicting occurrences must NEVER be replaced unless user explicitly resolved and selected them
    const occurrencesToReplace = occurrences.filter((occ) => {
      if (occ.status === 'UNSUPPORTED_LAYOUT' || occ.status === 'AMBIGUOUS_COORDINATES') {
        return false;
      }
      if (selectedIds) {
        return selectedIds.has(occ.id);
      }
      return occ.status === 'VALID';
    });

    const conflictCount = occurrences.filter((o) => o.status === 'CONFLICT').length;
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
      const textToDraw = occ.replaceText !== undefined ? occ.replaceText : options.replaceText ?? '';
      if (textToDraw.length > 0) {
        page.drawText(textToDraw, {
          x: occ.x,
          y: occ.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }
    }

    const modifiedBytes = await doc.save();

    // Generate per-rule breakdown report
    const ruleReports: RuleReport[] = activeRules.map((rule) => {
      const ruleMatches = occurrences.filter((o) => o.ruleId === rule.id);
      const ruleReplaced = occurrencesToReplace.filter((o) => o.ruleId === rule.id).length;
      const ruleConflicts = ruleMatches.filter((o) => o.status === 'CONFLICT').length;
      const ruleUnsupported = ruleMatches.filter((o) => o.status === 'UNSUPPORTED_LAYOUT' || o.status === 'AMBIGUOUS_COORDINATES').length;
      const ruleCollisions = ruleMatches.filter((o) => o.collisionWarning).length;
      const ruleSkipped = ruleMatches.length - ruleReplaced;

      return {
        ruleId: rule.id,
        searchQuery: rule.searchQuery,
        replaceText: rule.replaceText,
        totalMatches: ruleMatches.length,
        replacedCount: ruleReplaced,
        skippedCount: ruleSkipped,
        unsupportedCount: ruleUnsupported,
        collisionCount: ruleCollisions,
        conflictCount: ruleConflicts,
      };
    });

    return {
      pdfData: modifiedBytes,
      totalMatches,
      replacedCount: occurrencesToReplace.length,
      skippedCount,
      collisionCount,
      conflictCount,
      ruleReports,
      occurrences,
    };
  }
}

export const findReplaceEngine = new FindReplaceEngine();
