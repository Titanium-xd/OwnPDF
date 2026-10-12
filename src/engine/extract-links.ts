import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedLinkItem, ExtractLinksResult } from '../types/engine';
import { PdfError } from '../types/engine';
import { PdfEngine } from './pdf-engine';

export class ExtractLinksEngine {
  private pdfEngine = new PdfEngine();

  /**
   * Scans a PDF document and extracts:
   * 1. Clickable External Annotations (/Subtype /Link with URI)
   * 2. Internal Page Destinations (/Dest or /GoTo)
   * 3. Plaintext printed URLs without annotations
   * Deduplicates repeated links across pages and exports structured results.
   */
  public async extractPdfLinks(fileData: Uint8Array): Promise<ExtractLinksResult> {
    const isEnc = await this.pdfEngine.isEncrypted(fileData);
    if (isEnc) {
      throw new PdfError('ENCRYPTED_DOCUMENT', 'Please unlock the document before extracting links.');
    }

    const dataCopy = new Uint8Array(fileData);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      disableFontFace: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const links: ExtractedLinkItem[] = [];
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`]+)/gi;
    const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;

    let linkCounter = 0;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNum = pageIdx + 1;
      const page = await pdfDoc.getPage(pageNum);

      // Track external URLs discovered on this page to avoid duplicating with plaintext regex
      const pageDiscoveredUrls = new Set<string>();

      // 1. Extract interactive PDF annotations
      const annotations = await page.getAnnotations();
      for (const annot of annotations) {
        if (annot.subtype === 'Link') {
          if (annot.url) {
            // External Clickable Link
            const cleanUrl = annot.url.trim();
            pageDiscoveredUrls.add(cleanUrl.toLowerCase());

            links.push({
              id: `link_${++linkCounter}`,
              pageNumber: pageNum,
              type: 'external',
              text: annot.contentsObj?.str || cleanUrl,
              url: cleanUrl,
            });
          } else if (annot.dest) {
            // Internal Destination Link
            let targetPage = 0;
            try {
              if (typeof annot.dest === 'string') {
                const destInfo = await pdfDoc.getDestination(annot.dest);
                if (destInfo && destInfo[0]) {
                  const pIdx = await pdfDoc.getPageIndex(destInfo[0]);
                  targetPage = pIdx + 1;
                }
              } else if (Array.isArray(annot.dest) && annot.dest[0]) {
                const pIdx = await pdfDoc.getPageIndex(annot.dest[0]);
                targetPage = pIdx + 1;
              }
            } catch {
              // Internal destination index unresolvable
            }

            links.push({
              id: `link_${++linkCounter}`,
              pageNumber: pageNum,
              type: 'internal',
              text: annot.contentsObj?.str || `Jump to Page ${targetPage || 'Destination'}`,
              url: targetPage > 0 ? `#page=${targetPage}` : '#internal',
              destPageNumber: targetPage > 0 ? targetPage : undefined,
            });
          }
        }
      }

      // 2. Scan text stream for printed plaintext URLs
      const textContent = await page.getTextContent();
      const pageText = (textContent.items || [])
        .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
        .join(' ');

      // Match HTTP/HTTPS URLs
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(pageText)) !== null) {
        let rawUrl = match[1].trim();
        // Strip trailing punctuation like '.' or ',' or ')'
        rawUrl = rawUrl.replace(/[.,;:)\]]+$/, '');

        if (rawUrl && !pageDiscoveredUrls.has(rawUrl.toLowerCase())) {
          pageDiscoveredUrls.add(rawUrl.toLowerCase());
          links.push({
            id: `link_${++linkCounter}`,
            pageNumber: pageNum,
            type: 'text-url',
            text: rawUrl,
            url: rawUrl,
          });
        }
      }

      // Match mailto: emails
      while ((match = emailRegex.exec(pageText)) !== null) {
        const rawMail = `mailto:${match[1].trim()}`;
        if (!pageDiscoveredUrls.has(rawMail.toLowerCase())) {
          pageDiscoveredUrls.add(rawMail.toLowerCase());
          links.push({
            id: `link_${++linkCounter}`,
            pageNumber: pageNum,
            type: 'text-url',
            text: match[1].trim(),
            url: rawMail,
          });
        }
      }
    }

    const uniqueUrls = new Set(links.map((l) => l.url.toLowerCase()));

    return {
      links,
      totalCount: links.length,
      uniqueCount: uniqueUrls.size,
    };
  }

  public exportToCsv(links: ExtractedLinkItem[]): string {
    const headers = ['Page', 'Type', 'Label/Text', 'Destination URL'];
    const rows = links.map((l) => [
      l.pageNumber,
      l.type,
      `"${(l.text || '').replace(/"/g, '""')}"`,
      `"${(l.url || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportToJson(links: ExtractedLinkItem[]): string {
    return JSON.stringify(links, null, 2);
  }

  public exportToTxt(links: ExtractedLinkItem[]): string {
    return links
      .map((l) => `[Page ${l.pageNumber}] [${l.type.toUpperCase()}] ${l.url} (${l.text})`)
      .join('\n');
  }
}

export const extractLinksEngine = new ExtractLinksEngine();
