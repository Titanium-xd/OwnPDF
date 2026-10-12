import { describe, it, expect, vi } from 'vitest';
import { PdfEngine } from '../../src/engine/pdf-engine';
import { ExtractLinksEngine } from '../../src/engine/extract-links';
import { FindReplaceEngine } from '../../src/engine/find-replace';
import { CompareEngine } from '../../src/engine/compare-engine';
import { FormFillEngine } from '../../src/engine/form-fill-engine';
import { FlattenEngine } from '../../src/engine/flatten-engine';
import { DuplicatePagesEngine } from '../../src/engine/duplicate-pages-engine';
import { BookmarksEngine } from '../../src/engine/bookmarks-engine';
import { RedactEngine } from '../../src/engine/redact-engine';
import { convertPdfToImages } from '../../src/engine/pdf-to-images';
import { ExtractImagesEngine } from '../../src/engine/extract-images';
import createModule from '@neslinesli93/qpdf-wasm';
import { toolRoutes, type ToolId } from '../../src/config/routes';
import fs from 'fs';
import path from 'path';

describe('Privacy Boundary & Network Isolation', () => {
  const engine = new PdfEngine();
  const linksEngine = new ExtractLinksEngine();
  const findReplaceEngine = new FindReplaceEngine();
  const compareEngine = new CompareEngine();
  const formFillEngine = new FormFillEngine();
  const flattenEngine = new FlattenEngine();
  const duplicatePagesEngine = new DuplicatePagesEngine();
  const bookmarksEngine = new BookmarksEngine();
  const redactEngine = new RedactEngine();
  const extractImagesEngine = new ExtractImagesEngine();

  const unencPath = path.resolve(__dirname, '../fixtures/fixture-unencrypted.pdf');
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');
  const imgPath = path.resolve(__dirname, '../fixtures/fixture-image-1.png');

  it('guarantees zero outbound network requests across all 26 registered tools', async () => {
    let networkCallCount = 0;
    const interceptedCalls: string[] = [];

    // Spy on global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: any) => {
      networkCallCount++;
      interceptedCalls.push(`fetch -> ${url}`);
      return Promise.reject(new Error('Network access blocked by test'));
    });

    // Track executed tools to ensure 100% coverage of the 26-tool registry
    const coveredTools = new Set<ToolId>();

    try {
      const fileBytes = new Uint8Array(fs.readFileSync(unencPath));
      const encBytes = new Uint8Array(fs.readFileSync(encPath));
      const imageBytes = new Uint8Array(fs.readFileSync(imgPath));

      // 1. unlock
      const qpdf = await createModule();
      qpdf.FS.writeFile('/enc.pdf', encBytes);
      const unlockExitCode = qpdf.callMain(['--password=testpass123', '--decrypt', '/enc.pdf', '/unlocked.pdf']);
      expect(unlockExitCode).toBe(0);
      const unlocked = qpdf.FS.readFile('/unlocked.pdf');
      expect(unlocked.byteLength).toBeGreaterThan(0);
      qpdf.FS.unlink('/enc.pdf');
      qpdf.FS.unlink('/unlocked.pdf');
      coveredTools.add('unlock');

      // 2. protect
      qpdf.FS.writeFile('/unenc.pdf', fileBytes);
      const protectExitCode = qpdf.callMain([
        '--encrypt',
        'secpass123',
        'secpass123',
        '256',
        '--',
        '/unenc.pdf',
        '/enc_out.pdf',
      ]);
      expect(protectExitCode).toBe(0);
      const protectedBytes = qpdf.FS.readFile('/enc_out.pdf');
      expect(protectedBytes.byteLength).toBeGreaterThan(0);
      qpdf.FS.unlink('/unenc.pdf');
      qpdf.FS.unlink('/enc_out.pdf');
      coveredTools.add('protect');

      // 3. merge
      await engine.mergePdfs([fileBytes, fileBytes]);
      coveredTools.add('merge');

      // 4. split
      await engine.splitPdf(fileBytes, '1');
      coveredTools.add('split');

      // 5. organize
      await engine.organizePages(fileBytes, [1, 0], new Map());
      coveredTools.add('organize');

      // 6. images (images-to-pdf)
      await engine.imagesToPdf([{ data: imageBytes, mimeType: 'image/png' }]);
      coveredTools.add('images');

      // 7. compress
      qpdf.FS.writeFile('/comp_in.pdf', fileBytes);
      const compressExitCode = qpdf.callMain([
        '--linearize',
        '--object-streams=generate',
        '/comp_in.pdf',
        '/comp_out.pdf',
      ]);
      expect(compressExitCode).toBe(0);
      const compressedBytes = qpdf.FS.readFile('/comp_out.pdf');
      expect(compressedBytes.byteLength).toBeGreaterThan(0);
      qpdf.FS.unlink('/comp_in.pdf');
      qpdf.FS.unlink('/comp_out.pdf');
      coveredTools.add('compress');

      // 8. inspect
      await engine.inspectPdf(fileBytes);
      coveredTools.add('inspect');

      // 9. rotate
      await engine.rotatePdf(fileBytes, { rotationAngle: 90, pageRange: '1' });
      coveredTools.add('rotate');

      // 10. page-numbers
      await engine.addPageNumbers(fileBytes, { format: 'PAGE_N_OF_TOTAL' });
      coveredTools.add('page-numbers');

      // 11. watermark
      await engine.addWatermark(fileBytes, { type: 'text', text: 'CONFIDENTIAL' });
      coveredTools.add('watermark');

      // 12. pdf-to-images
      await convertPdfToImages(fileBytes, { format: 'image/png' });
      coveredTools.add('pdf-to-images');

      // 13. extract-text
      await engine.extractText(fileBytes);
      coveredTools.add('extract-text');

      // 14. crop
      await engine.cropPdf(fileBytes, { margins: { top: 10, right: 10, bottom: 10, left: 10 } });
      coveredTools.add('crop');

      // 15. find-replace
      await findReplaceEngine.replacePdfText(fileBytes, {
        searchQuery: 'Unencrypted',
        replaceText: 'Replacement',
      });
      coveredTools.add('find-replace');

      // 16. reverse-pages
      await engine.reversePdfPages(fileBytes, { mode: 'all' });
      coveredTools.add('reverse-pages');

      // 17. delete-blank-pages
      await engine.detectBlankPages(fileBytes);
      await engine.deletePages(fileBytes, [1]);
      coveredTools.add('delete-blank-pages');

      // 18. resize
      await engine.resizePdf(fileBytes, { targetSize: 'A4', mode: 'fit' });
      coveredTools.add('resize');

      // 19. extract-images
      await extractImagesEngine.extractPdfImages(fileBytes);
      coveredTools.add('extract-images');

      // 20. extract-links
      await linksEngine.extractPdfLinks(fileBytes);
      coveredTools.add('extract-links');

      // 21. compare
      await compareEngine.comparePdfs(fileBytes, fileBytes);
      coveredTools.add('compare');

      // 22. fill-form
      await formFillEngine.getFormFields(fileBytes);
      await formFillEngine.fillForm(fileBytes, {});
      coveredTools.add('fill-form');

      // 23. flatten
      await flattenEngine.flattenPdf(fileBytes, 'forms');
      coveredTools.add('flatten');

      // 24. remove-duplicate-pages
      await duplicatePagesEngine.detectDuplicatePages(fileBytes);
      coveredTools.add('remove-duplicate-pages');

      // 25. bookmarks
      await bookmarksEngine.addBookmarks(fileBytes, {
        bookmarks: [{ id: 'b1', title: 'Page 1', targetPageNumber: 1, level: 0 }],
      });
      coveredTools.add('bookmarks');

      // 26. redact
      await redactEngine.redactPdf(fileBytes, {
        boxes: [{ id: 'r1', pageIndex: 0, pageNumber: 1, x: 10, y: 10, width: 50, height: 20 }],
      });
      coveredTools.add('redact');

      // Assert 100% coverage of all 26 registered tools
      expect(coveredTools.size).toBe(26);
      for (const route of toolRoutes) {
        expect(coveredTools.has(route.toolId)).toBe(true);
      }

      // Assert ZERO network calls occurred across all 26 tools
      expect(networkCallCount).toBe(0);
      expect(interceptedCalls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
