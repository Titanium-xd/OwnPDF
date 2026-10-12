import * as pdfjsLib from 'pdfjs-dist';
import type {
  DuplicateCandidate,
  DuplicateGroup,
  DuplicateDetectionResult,
} from '../types/engine';
import { PdfError } from '../types/engine';
import { pdfEngine } from './pdf-engine';

export class DuplicatePagesEngine {
  private pdfEngine = pdfEngine;

  /**
   * Scans a PDF document using dual-layer text and visual layout fingerprints
   * to detect candidate duplicate pages.
   */
  public async detectDuplicatePages(
    fileData: Uint8Array,
    _options: { similarityThreshold?: number } = {}
  ): Promise<DuplicateDetectionResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before scanning for duplicates.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages <= 1) {
      return {
        groups: [],
        totalDuplicatesDetected: 0,
        candidates: [],
      };
    }

    const pageFingerprints: Array<{
      pageIndex: number;
      pageNumber: number;
      text: string;
      textHash: string;
      visualHash: string;
      width: number;
      height: number;
    }> = [];

    for (let p = 1; p <= totalPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items || [])
        .map((i: any) => i.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const viewport = page.getViewport({ scale: 1 });
      const textHash = this.fnv1aHash(rawText);
      const visualHash = this.fnv1aHash(`${Math.round(viewport.width)}x${Math.round(viewport.height)}_${page.rotate}_${rawText.slice(0, 50)}`);

      pageFingerprints.push({
        pageIndex: p - 1,
        pageNumber: p,
        text: rawText,
        textHash,
        visualHash,
        width: viewport.width,
        height: viewport.height,
      });
    }

    const groups: DuplicateGroup[] = [];
    const candidates: DuplicateCandidate[] = [];
    const processedDuplicates = new Set<number>();

    for (let i = 0; i < pageFingerprints.length; i++) {
      if (processedDuplicates.has(i)) continue;

      const pA = pageFingerprints[i];
      const dupPages: number[] = [];
      let maxConfidence = 0;

      for (let j = i + 1; j < pageFingerprints.length; j++) {
        if (processedDuplicates.has(j)) continue;

        const pB = pageFingerprints[j];
        let isDuplicate = false;
        let confidence = 0;

        // Check text match and visual dimension match
        if (pA.text.length > 0 && pA.text === pB.text) {
          isDuplicate = true;
          confidence = 100;
        } else if (pA.textHash === pB.textHash && pA.visualHash === pB.visualHash) {
          isDuplicate = true;
          confidence = 95;
        }

        if (isDuplicate) {
          processedDuplicates.add(j);
          dupPages.push(pB.pageNumber);
          maxConfidence = Math.max(maxConfidence, confidence);

          candidates.push({
            pageIndex: pB.pageIndex,
            pageNumber: pB.pageNumber,
            isOriginal: false,
            duplicateOfPageNumber: pA.pageNumber,
            confidence,
            textHash: pB.textHash,
            visualHash: pB.visualHash,
            selectedForDeletion: true,
          });
        }
      }

      if (dupPages.length > 0) {
        // Add original to candidates
        candidates.push({
          pageIndex: pA.pageIndex,
          pageNumber: pA.pageNumber,
          isOriginal: true,
          confidence: 100,
          textHash: pA.textHash,
          visualHash: pA.visualHash,
          selectedForDeletion: false,
        });

        groups.push({
          groupId: `grp_${pA.pageNumber}`,
          originalPageNumber: pA.pageNumber,
          duplicatePageNumbers: dupPages,
          confidence: maxConfidence,
          candidates: candidates.filter((c) => c.pageNumber === pA.pageNumber || dupPages.includes(c.pageNumber)),
        });
      }
    }

    candidates.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      groups,
      totalDuplicatesDetected: candidates.filter((c) => !c.isOriginal).length,
      candidates,
    };
  }

  /**
   * Deletes chosen duplicate page indices from the document.
   * Does NOT alter the order of remaining pages.
   */
  public async removeDuplicates(
    fileData: Uint8Array,
    pageIndicesToDelete: number[]
  ): Promise<Uint8Array> {
    return this.pdfEngine.deletePages(fileData, pageIndicesToDelete);
  }

  private fnv1aHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

export const duplicatePagesEngine = new DuplicatePagesEngine();
