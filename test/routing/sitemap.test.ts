import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { toolRoutes, homeRoute } from '../../src/config/routes';

describe('Sitemap Integrity & Source of Truth', () => {
  it('public/sitemap.xml matches all 15 registered canonical URLs', () => {
    const sitemapPath = path.resolve(__dirname, '../../public/sitemap.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const content = fs.readFileSync(sitemapPath, 'utf-8');

    // Homepage
    expect(content).toContain(`<loc>${homeRoute.canonicalUrl}</loc>`);

    // All 14 tools
    for (const tool of toolRoutes) {
      expect(content).toContain(`<loc>${tool.canonicalUrl}</loc>`);
    }

    // Counts exactly 15 URLs
    const locMatches = content.match(/<loc>/g);
    expect(locMatches).toHaveLength(15);
  });

});
