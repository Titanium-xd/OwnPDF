import { describe, it, expect } from 'vitest';
import { extractLinksEngine } from '../../src/engine/extract-links';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('ExtractLinksEngine Multi-Category & Export Validation', () => {
  const encPath = path.resolve(__dirname, '../fixtures/fixture-encrypted-aes256.pdf');

  it('extracts external annotations, internal links, and plaintext URLs without redundant duplicates', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Page 1: Has interactive external annotation AND a plaintext URL
    const p1 = doc.addPage([500, 500]);
    p1.drawText('Contact us at info@example.com or visit https://unlinked-site.org for docs.', {
      x: 50,
      y: 400,
      size: 12,
      font,
    });
    p1.drawText('Click Here For External Portal', { x: 50, y: 350, size: 12, font });

    // Attach interactive Link annotation
    const linkDict = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [50, 340, 250, 370],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of('https://portal.example.com/login'),
      },
    });
    const linkRef = doc.context.register(linkDict);
    p1.node.set(PDFName.of('Annots'), doc.context.obj([linkRef]));

    // Page 2: Has repeating link in footer
    const p2 = doc.addPage([500, 500]);
    p2.drawText('Page 2 body content with https://unlinked-site.org repeating in footer.', {
      x: 50,
      y: 400,
      size: 12,
      font,
    });

    const pdfBytes = await doc.save();

    const result = await extractLinksEngine.extractPdfLinks(pdfBytes);

    expect(result.totalCount).toBeGreaterThanOrEqual(3);
    expect(result.uniqueCount).toBeGreaterThanOrEqual(2);

    // 1. External annotation link
    const externalLink = result.links.find((l) => l.url === 'https://portal.example.com/login');
    expect(externalLink).toBeDefined();
    expect(externalLink?.type).toBe('external');
    expect(externalLink?.pageNumber).toBe(1);

    // 2. Plaintext unlinked URL
    const textUrl = result.links.find((l) => l.url === 'https://unlinked-site.org');
    expect(textUrl).toBeDefined();
    expect(textUrl?.type).toBe('text-url');

    // 3. Email link
    const emailLink = result.links.find((l) => l.url.includes('mailto:info@example.com'));
    expect(emailLink).toBeDefined();
    expect(emailLink?.type).toBe('text-url');

    // Test CSV export
    const csv = extractLinksEngine.exportToCsv(result.links);
    expect(csv).toContain('Page,Type,Label/Text,Destination URL');
    expect(csv).toContain('https://portal.example.com/login');

    // Test JSON export
    const json = extractLinksEngine.exportToJson(result.links);
    const parsedJson = JSON.parse(json);
    expect(parsedJson.length).toBe(result.links.length);

    // Test TXT export
    const txt = extractLinksEngine.exportToTxt(result.links);
    expect(txt).toContain('[Page 1]');
  });

  it('rejects encrypted documents with proper PdfError', async () => {
    const encBytes = fs.readFileSync(encPath);
    await expect(
      extractLinksEngine.extractPdfLinks(encBytes)
    ).rejects.toThrow(/unlock the document/i);
  });
});
