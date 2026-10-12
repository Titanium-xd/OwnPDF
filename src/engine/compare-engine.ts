import * as pdfjsLib from 'pdfjs-dist';
import type {
  CompareResult,
  PageComparison,
  PageDiffStatus,
  TextDiffLine,
} from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

export class CompareEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Compares two PDF documents across metadata, page structures, extractable text,
   * and visual layouts. Handles unequal page counts and different dimensions.
   */
  public async comparePdfs(
    fileDataA: Uint8Array,
    fileDataB: Uint8Array
  ): Promise<CompareResult> {
    const isEncA = await this.pdfEngine.isEncrypted(fileDataA);
    const isEncB = await this.pdfEngine.isEncrypted(fileDataB);

    if (isEncA || isEncB) {
      throw new PdfError(
        'ENCRYPTED_DOCUMENT',
        'Please unlock password-protected documents before comparing.'
      );
    }

    const taskA = pdfjsLib.getDocument({
      data: new Uint8Array(fileDataA),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const taskB = pdfjsLib.getDocument({
      data: new Uint8Array(fileDataB),
      disableFontFace: true,
      isEvalSupported: false,
    });

    const [docA, docB] = await Promise.all([taskA.promise, taskB.promise]);

    const numPagesA = docA.numPages;
    const numPagesB = docB.numPages;
    const maxPages = Math.max(numPagesA, numPagesB);

    const pageComparisons: PageComparison[] = [];
    let identicalCount = 0;
    let diffCount = 0;

    for (let p = 1; p <= maxPages; p++) {
      if (p <= numPagesA && p <= numPagesB) {
        const [pageA, pageB] = await Promise.all([docA.getPage(p), docB.getPage(p)]);
        const [textObjA, textObjB] = await Promise.all([
          pageA.getTextContent(),
          pageB.getTextContent(),
        ]);

        const strA = (textObjA.items || [])
          .map((i: any) => i.str || '')
          .filter((s: string) => s.trim().length > 0);
        const strB = (textObjB.items || [])
          .map((i: any) => i.str || '')
          .filter((s: string) => s.trim().length > 0);

        const viewA = pageA.getViewport({ scale: 1 });
        const viewB = pageB.getViewport({ scale: 1 });

        const hasDimDiff =
          Math.abs(viewA.width - viewB.width) > 1 ||
          Math.abs(viewA.height - viewB.height) > 1 ||
          pageA.rotate !== pageB.rotate;

        const textDiffLines = this.computeTextDiff(strA, strB);
        const hasTextDiff = strA.join('\n') !== strB.join('\n');
        const hasVisualDiff = hasDimDiff || hasTextDiff;

        let status: PageDiffStatus = 'IDENTICAL';
        if (hasTextDiff && hasDimDiff) {
          status = 'BOTH_DIFF';
        } else if (hasTextDiff) {
          status = 'TEXT_DIFF_ONLY';
        } else if (hasDimDiff) {
          status = 'VISUAL_DIFF_ONLY';
        }

        const sameLines = textDiffLines.filter((l) => l.type === 'same').length;
        const totalLines = Math.max(1, Math.max(strA.length, strB.length));
        const similarityScore = Math.round((sameLines / totalLines) * 100);

        if (status === 'IDENTICAL') {
          identicalCount++;
        } else {
          diffCount++;
        }

        pageComparisons.push({
          pageNumber: p,
          status,
          hasTextDiff,
          hasVisualDiff,
          textDiffLines,
          similarityScore,
          pageAWidth: viewA.width,
          pageAHeight: viewA.height,
          pageBWidth: viewB.width,
          pageBHeight: viewB.height,
        });
      } else if (p <= numPagesA) {
        // Exists in Doc A but missing in Doc B
        diffCount++;
        const pageA = await docA.getPage(p);
        const textObjA = await pageA.getTextContent();
        const strA = (textObjA.items || [])
          .map((i: any) => i.str || '')
          .filter((s: string) => s.trim().length > 0);
        const viewA = pageA.getViewport({ scale: 1 });

        pageComparisons.push({
          pageNumber: p,
          status: 'ONLY_IN_A',
          hasTextDiff: true,
          hasVisualDiff: true,
          textDiffLines: strA.map((text) => ({ type: 'removed', text })),
          similarityScore: 0,
          pageAWidth: viewA.width,
          pageAHeight: viewA.height,
        });
      } else {
        // Exists in Doc B but missing in Doc A
        diffCount++;
        const pageB = await docB.getPage(p);
        const textObjB = await pageB.getTextContent();
        const strB = (textObjB.items || [])
          .map((i: any) => i.str || '')
          .filter((s: string) => s.trim().length > 0);
        const viewB = pageB.getViewport({ scale: 1 });

        pageComparisons.push({
          pageNumber: p,
          status: 'ONLY_IN_B',
          hasTextDiff: true,
          hasVisualDiff: true,
          textDiffLines: strB.map((text) => ({ type: 'added', text })),
          similarityScore: 0,
          pageBWidth: viewB.width,
          pageBHeight: viewB.height,
        });
      }
    }

    return {
      docAPageCount: numPagesA,
      docBPageCount: numPagesB,
      pageComparisons,
      identicalPageCount: identicalCount,
      differentPageCount: diffCount,
      totalEvaluatedPages: maxPages,
    };
  }

  private computeTextDiff(linesA: string[], linesB: string[]): TextDiffLine[] {
    const results: TextDiffLine[] = [];
    const maxLen = Math.max(linesA.length, linesB.length);

    for (let i = 0; i < maxLen; i++) {
      const a = linesA[i];
      const b = linesB[i];

      if (a !== undefined && b !== undefined) {
        if (a === b) {
          results.push({ type: 'same', text: a });
        } else {
          results.push({ type: 'removed', text: a });
          results.push({ type: 'added', text: b });
        }
      } else if (a !== undefined) {
        results.push({ type: 'removed', text: a });
      } else if (b !== undefined) {
        results.push({ type: 'added', text: b });
      }
    }

    return results;
  }
}

export const compareEngine = new CompareEngine();
