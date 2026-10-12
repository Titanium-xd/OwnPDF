import { describe, it, expect } from 'vitest';
import {
  toolRoutes,
  homeRoute,
  getRouteFromPathname,
  isInvalidRoute,
  getPathForTool,
  PRODUCTION_ORIGIN,
  BASE_PATH,
} from '../../src/config/routes';

describe('Route Registry & URL Architecture', () => {
  it('defines exactly 8 functional tools', () => {
    expect(toolRoutes).toHaveLength(8);
    const expectedTools = [
      'unlock',
      'protect',
      'merge',
      'split',
      'organize',
      'images',
      'compress',
      'inspect',
    ];
    expect(toolRoutes.map((r) => r.toolId)).toEqual(expectedTools);
  });

  it('guarantees unique slugs, canonical URLs, titles, and descriptions', () => {
    const slugs = new Set<string>();
    const canonicals = new Set<string>();
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const tool of toolRoutes) {
      expect(slugs.has(tool.slug)).toBe(false);
      slugs.add(tool.slug);

      expect(canonicals.has(tool.canonicalUrl)).toBe(false);
      canonicals.add(tool.canonicalUrl);

      expect(titles.has(tool.title)).toBe(false);
      titles.add(tool.title);

      expect(descriptions.has(tool.metaDescription)).toBe(false);
      descriptions.add(tool.metaDescription);

      // Must start with production origin and base path
      expect(tool.canonicalUrl.startsWith(`${PRODUCTION_ORIGIN}${BASE_PATH}`)).toBe(true);
      expect(tool.canonicalUrl.endsWith('/')).toBe(true);

      // Must have descriptive H1 and instructions
      expect(tool.h1.length).toBeGreaterThan(10);
      expect(tool.instructions.length).toBeGreaterThanOrEqual(3);
      expect(tool.limitations.length).toBeGreaterThanOrEqual(2);
      expect(tool.privacyNotes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('ensures all relatedToolIds point to valid implemented tools', () => {
    const validIds = new Set(toolRoutes.map((r) => r.toolId));
    for (const tool of toolRoutes) {
      expect(tool.relatedToolIds.length).toBeGreaterThan(0);
      for (const relId of tool.relatedToolIds) {
        expect(validIds.has(relId)).toBe(true);
        expect(relId).not.toBe(tool.toolId);
      }
    }
  });

  it('correctly maps pathnames to tool routes with /OwnPDF/ base path', () => {
    expect(getRouteFromPathname('/OwnPDF/', '/OwnPDF/')).toBeNull();
    expect(getRouteFromPathname('/OwnPDF', '/OwnPDF/')).toBeNull();
    expect(getRouteFromPathname('/', '/OwnPDF/')).toBeNull();

    expect(getRouteFromPathname('/OwnPDF/merge/', '/OwnPDF/')?.toolId).toBe('merge');
    expect(getRouteFromPathname('/OwnPDF/merge', '/OwnPDF/')?.toolId).toBe('merge');
    expect(getRouteFromPathname('/OwnPDF/images-to-pdf/', '/OwnPDF/')?.toolId).toBe('images');
    expect(getRouteFromPathname('/OwnPDF/unlock/', '/OwnPDF/')?.toolId).toBe('unlock');
    expect(getRouteFromPathname('/OwnPDF/protect/', '/OwnPDF/')?.toolId).toBe('protect');
    expect(getRouteFromPathname('/OwnPDF/split/', '/OwnPDF/')?.toolId).toBe('split');
    expect(getRouteFromPathname('/OwnPDF/organize/', '/OwnPDF/')?.toolId).toBe('organize');
    expect(getRouteFromPathname('/OwnPDF/compress/', '/OwnPDF/')?.toolId).toBe('compress');
    expect(getRouteFromPathname('/OwnPDF/inspect/', '/OwnPDF/')?.toolId).toBe('inspect');

    // Unknown paths return null
    expect(getRouteFromPathname('/OwnPDF/unknown-tool/', '/OwnPDF/')).toBeNull();
  });

  it('correctly detects invalid routes', () => {
    expect(isInvalidRoute('/OwnPDF/', '/OwnPDF/')).toBe(false);
    expect(isInvalidRoute('/OwnPDF/index.html', '/OwnPDF/')).toBe(false);
    expect(isInvalidRoute('/OwnPDF/merge/', '/OwnPDF/')).toBe(false);
    expect(isInvalidRoute('/OwnPDF/unlock/', '/OwnPDF/')).toBe(false);

    expect(isInvalidRoute('/OwnPDF/nonexistent/', '/OwnPDF/')).toBe(true);
    expect(isInvalidRoute('/OwnPDF/random-page', '/OwnPDF/')).toBe(true);
  });

  it('generates correct clean canonical paths for tools', () => {
    expect(getPathForTool(null, '/OwnPDF/')).toBe('/OwnPDF/');
    expect(getPathForTool('merge', '/OwnPDF/')).toBe('/OwnPDF/merge/');
    expect(getPathForTool('images', '/OwnPDF/')).toBe('/OwnPDF/images-to-pdf/');
  });
});
