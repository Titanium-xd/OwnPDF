import { describe, it, expect, vi } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import fs from 'fs';
import path from 'path';

describe('Privacy Boundary & Network Isolation', () => {
  const engine = new PdfEngine();
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

      // Perform local transformations
      await engine.inspectPdf(fileBytes);
      await engine.sanitizeMetadata(fileBytes);
      await engine.splitPdf(fileBytes, '1');
      await engine.mergePdfs([fileBytes, fileBytes]);

      // Assert zero calls occurred
      expect(networkCallCount).toBe(0);
      expect(interceptedCalls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
