import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { toolRoutes, homeRoute, ToolRoute } from './src/config/routes';

function renderStaticToolHtml(tool: ToolRoute, basePath: string): string {
  const relatedLinksHtml = tool.relatedToolIds
    .map((id) => {
      const rel = toolRoutes.find((r) => r.toolId === id);
      if (!rel) return '';
      return `<a href="${basePath}${rel.slug}/" class="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between group"><span class="text-xs font-bold text-slate-900 dark:text-slate-100">${rel.name}</span><span class="text-xs text-sky-500">→</span></a>`;
    })
    .join('');

  const instructionsHtml = tool.instructions
    .map(
      (inst) => `
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
          <div class="w-7 h-7 rounded-lg bg-sky-500 text-white font-bold text-xs flex items-center justify-center">${inst.step}</div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">${inst.title}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${inst.desc}</p>
        </div>`
    )
    .join('');

  const privacyHtml = tool.privacyNotes.map((note) => `<li>${note}</li>`).join('');
  const limitationsHtml = tool.limitations.map((limit) => `<li>${limit}</li>`).join('');

  return `<div id="root"><div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between"><header class="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"><a href="${basePath}" class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">OwnPDF</a></div></header><main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-12"><div class="max-w-6xl mx-auto space-y-6"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800"><div class="flex items-center gap-3"><a href="${basePath}" class="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 text-xs font-semibold">← All Tools</a><div class="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div><div><h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">${tool.h1}</h1><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${tool.shortDescription}</p></div></div></div><div class="p-8 sm:p-12 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/40 text-center space-y-3"><h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Load ${tool.name} Workspace</h2><p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Drag and drop PDF files or select documents from your device to begin processing locally.</p></div><section aria-labelledby="tool-guide-heading" class="mt-12 pt-10 border-t border-slate-200/80 dark:border-slate-800/80 space-y-10"><div class="space-y-3 max-w-3xl"><h2 id="tool-guide-heading" class="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">About ${tool.name}</h2><p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">${tool.shortDescription}</p></div><div class="space-y-4"><h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">How to Use ${tool.name}</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4">${instructionsHtml}</div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3"><h3 class="text-emerald-800 dark:text-emerald-300 font-bold text-sm">Local-First Privacy Guarantees</h3><ul class="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">${privacyHtml}</ul></div><div class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3"><h3 class="text-slate-800 dark:text-slate-200 font-bold text-sm">Technical Notes & Limitations</h3><ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">${limitationsHtml}</ul></div></div><div class="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60"><div class="flex items-center justify-between"><h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Related PDF Tools</h2><a href="${basePath}" class="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">Back to all tools</a></div><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${relatedLinksHtml}</div></div></section></div></main></div></div>`;
}

function renderStatic404Html(basePath: string): string {
  const toolLinks = toolRoutes
    .map(
      (t) =>
        `<a href="${basePath}${t.slug}/" class="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition flex items-center justify-between"><span class="text-xs font-bold text-slate-900 dark:text-slate-100">${t.name}</span><span class="text-xs text-sky-500">→</span></a>`
    )
    .join('');

  return `<div id="root"><div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between"><header class="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"><a href="${basePath}" class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">OwnPDF</a></div></header><main class="flex-1 max-w-4xl mx-auto py-12 px-4 sm:px-6 text-center space-y-8"><span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">404 Error</span><h1 class="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Page Not Found</h1><p class="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">The requested page or tool does not exist. Please return to the homepage or select one of the available PDF tools below.</p><div><a href="${basePath}" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition">Return to Homepage</a></div><div class="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4 text-left"><h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Available OwnPDF Tools</h2><div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">${toolLinks}</div></div></main></div></div>`;
}

function generateSitemapXml(): string {
  const urls = [
    `  <url>
    <loc>${homeRoute.canonicalUrl}</loc>
    <lastmod>2026-10-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...toolRoutes.map(
      (tool) => `  <url>
    <loc>${tool.canonicalUrl}</loc>
    <lastmod>2026-10-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

function seoPagesPlugin(): Plugin {
  return {
    name: 'seo-pages-generator',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexHtmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) return;

      const template = fs.readFileSync(indexHtmlPath, 'utf-8');
      const basePath = process.env.BASE_PATH || (process.env.GITHUB_ACTIONS ? '/OwnPDF/' : '/');

      // 1. Generate tool landing pages
      for (const tool of toolRoutes) {
        const toolDir = path.join(distDir, tool.slug);
        if (!fs.existsSync(toolDir)) {
          fs.mkdirSync(toolDir, { recursive: true });
        }

        let html = template;
        html = html.replace(/<title>.*?<\/title>/, `<title>${tool.title}</title>`);
        html = html.replace(
          /<meta name="description" content=".*?" \/>/,
          `<meta name="description" content="${tool.metaDescription}" />`
        );
        html = html.replace(
          /<link rel="canonical" href=".*?" \/>/,
          `<link rel="canonical" href="${tool.canonicalUrl}" />`
        );
        html = html.replace(
          /<meta property="og:title" content=".*?" \/>/,
          `<meta property="og:title" content="${tool.title}" />`
        );
        html = html.replace(
          /<meta property="og:description" content=".*?" \/>/,
          `<meta property="og:description" content="${tool.metaDescription}" />`
        );
        html = html.replace(
          /<meta property="og:url" content=".*?" \/>/,
          `<meta property="og:url" content="${tool.canonicalUrl}" />`
        );
        html = html.replace(
          /<meta name="twitter:title" content=".*?" \/>/,
          `<meta name="twitter:title" content="${tool.title}" />`
        );
        html = html.replace(
          /<meta name="twitter:description" content=".*?" \/>/,
          `<meta name="twitter:description" content="${tool.metaDescription}" />`
        );
        html = html.replace(
          /<meta name="twitter:url" content=".*?" \/>/,
          `<meta name="twitter:url" content="${tool.canonicalUrl}" />`
        );

        const staticContent = renderStaticToolHtml(tool, basePath);
        html = html.replace('<div id="root"></div>', staticContent);

        fs.writeFileSync(path.join(toolDir, 'index.html'), html, 'utf-8');
      }

      // 2. Generate 404.html
      let notFoundHtml = template;
      notFoundHtml = notFoundHtml.replace(/<title>.*?<\/title>/, `<title>Page Not Found — OwnPDF</title>`);
      notFoundHtml = notFoundHtml.replace(
        /<meta name="robots" content=".*?" \/>/,
        `<meta name="robots" content="noindex, follow" />`
      );
      notFoundHtml = notFoundHtml.replace(
        /<link rel="canonical" href=".*?" \/>/,
        `<link rel="canonical" href="${homeRoute.canonicalUrl}" />`
      );
      const static404 = renderStatic404Html(basePath);
      notFoundHtml = notFoundHtml.replace('<div id="root"></div>', static404);
      fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf-8');

      // 3. Generate dist/sitemap.xml
      const sitemapXml = generateSitemapXml();
      fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || (process.env.GITHUB_ACTIONS ? '/OwnPDF/' : '/'),
  plugins: [react(), seoPagesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdfjs': ['pdfjs-dist'],
          'vendor-pdflib': ['pdf-lib'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@neslinesli93/qpdf-wasm'],
  },
});
