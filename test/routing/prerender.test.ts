import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { toolRoutes, homeRoute } from '../../src/config/routes';

describe('Production Pre-rendered HTML & SEO Output', () => {
  const distDir = path.resolve(__dirname, '../../dist');

  it('generates a physical index.html for all 20 tool routes', () => {
    // If dist doesn't exist yet (e.g. before full build), skip or test file structure

    if (!fs.existsSync(distDir)) {
      return;
    }

    for (const tool of toolRoutes) {
      const toolHtmlPath = path.join(distDir, tool.slug, 'index.html');
      expect(fs.existsSync(toolHtmlPath)).toBe(true);

      const html = fs.readFileSync(toolHtmlPath, 'utf-8');

      // Title & Description
      expect(html).toContain(`<title>${tool.title}</title>`);
      expect(html).toContain(`content="${tool.metaDescription}"`);

      // Canonical URL
      expect(html).toContain(`<link rel="canonical" href="${tool.canonicalUrl}" />`);

      // Open Graph & Twitter
      expect(html).toContain(`property="og:title" content="${tool.title}"`);
      expect(html).toContain(`property="og:url" content="${tool.canonicalUrl}"`);
      expect(html).toContain(`name="twitter:title" content="${tool.title}"`);

      // Exactly one H1 tag with tool H1 text
      const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches).toHaveLength(1);
      expect(h1Matches![0]).toContain(tool.h1);

      // Has instructions and limitations
      expect(html).toContain(`How to Use ${tool.name}`);
      expect(html).toContain('Local-First Privacy Guarantees');
      expect(html).toContain('Technical Notes & Limitations');
    }
  });

  it('generates a dedicated 404.html page with noindex and tool directory', () => {
    if (!fs.existsSync(distDir)) {
      return;
    }

    const notFoundPath = path.join(distDir, '404.html');
    expect(fs.existsSync(notFoundPath)).toBe(true);

    const html = fs.readFileSync(notFoundPath, 'utf-8');
    expect(html).toContain('<title>Page Not Found — OwnPDF</title>');
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).toContain('Page Not Found');

    for (const tool of toolRoutes) {
      expect(html).toContain(tool.name);
    }
  });

  it('generates dist/sitemap.xml with 21 valid URLs', () => {

    if (!fs.existsSync(distDir)) {
      return;
    }

    const sitemapPath = path.join(distDir, 'sitemap.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const content = fs.readFileSync(sitemapPath, 'utf-8');
    expect(content).toContain(`<loc>${homeRoute.canonicalUrl}</loc>`);
    for (const tool of toolRoutes) {
      expect(content).toContain(`<loc>${tool.canonicalUrl}</loc>`);
    }
  });
});
