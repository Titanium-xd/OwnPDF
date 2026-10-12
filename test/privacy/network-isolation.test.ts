import { describe, it, expect, vi } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { ExtractLinksEngine } from '../../src/engine/extract-links';
import { FindReplaceEngine } from '../../src/engine/find-replace';
import fs from 'fs';
import path from 'path';

describe('Privacy Boundary & Network Isolation', () => {
  const engine = new PdfEngine();
  const linksEngine = new ExtractLinksEngine();
  const findReplaceEngine = new FindReplaceEngine();
  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');

  it('guarantees zero outbound network requests during document operations', async () => {
    let networkCallCount = 0;
    const interceptedCalls: string[] = [];

    // Spy on global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: any) => {
      networkCallCount++;
      interceptedCalls.push(`fetch -> ${url}`);
      return Promise.reject(new Error('Network access blocked by test'));
    });

    try {
      const fileBytes = fs.readFileSync(unencPath);

      // Perform local transformations across existing & Phase 4 Batch 1 engines
      await engine.inspectPdf(fileBytes);
      await engine.sanitizeMetadata(fileBytes);
      await engine.splitPdf(fileBytes, '1');
      await engine.mergePdfs([fileBytes, fileBytes]);
      await engine.reversePdfPages(fileBytes, { mode: 'all' });
      await engine.deletePages(fileBytes, [0]);
      await engine.resizePdf(fileBytes, { targetSize: 'A4', mode: 'fit' });
      await linksEngine.extractPdfLinks(fileBytes);
      await findReplaceEngine.replacePdfText(fileBytes, {
        searchQuery: 'Unencrypted',
        replaceText: 'Replacement',
      });

      // Assert zero calls occurred
      expect(networkCallCount).toBe(0);
      expect(interceptedCalls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
