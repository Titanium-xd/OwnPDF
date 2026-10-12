import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

// Simple static server mounting dist at /OwnPDF/
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:4173');
  let pathname = url.pathname;

  // Add COOP / COEP headers required for WASM
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  if (!pathname.startsWith('/OwnPDF/')) {
    res.statusCode = 404;
    res.end('Not Found outside /OwnPDF/');
    return;
  }

  let relative = pathname.slice('/OwnPDF/'.length);
  if (!relative || relative.endsWith('/')) {
    relative = path.join(relative, 'index.html');
  }

  let filePath = path.join(distDir, relative);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.xml': 'application/xml; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.wasm': 'application/wasm',
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.statusCode = 200;
    res.end(fs.readFileSync(filePath));
  } else {
    // Serve 404.html with status 404
    const notFoundPath = path.join(distDir, '404.html');
    if (fs.existsSync(notFoundPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.statusCode = 404;
      res.end(fs.readFileSync(notFoundPath));
    } else {
      res.statusCode = 404;
      res.end('404 Not Found');
    }
  }
});

const PORT = 4173;

async function runVerification() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running at http://localhost:${PORT}/OwnPDF/`);

  const routes = [
    { path: '/OwnPDF/', expectedH1: 'Free Private PDF Tools', expectedTitle: 'OwnPDF — Free Private PDF Tools' },
    { path: '/OwnPDF/unlock/', expectedH1: 'Unlock Password-Protected PDFs Locally', expectedTitle: 'Unlock PDF Online' },
    { path: '/OwnPDF/protect/', expectedH1: 'Protect PDFs with AES-256 Encryption', expectedTitle: 'Protect PDF with Password Online' },
    { path: '/OwnPDF/merge/', expectedH1: 'Merge Multiple PDF Files Together', expectedTitle: 'Merge PDF Files Online' },
    { path: '/OwnPDF/split/', expectedH1: 'Split PDF & Extract Pages', expectedTitle: 'Split PDF Online' },
    { path: '/OwnPDF/organize/', expectedH1: 'Organize, Rotate & Delete PDF Pages', expectedTitle: 'Organize PDF Pages Online' },
    { path: '/OwnPDF/images-to-pdf/', expectedH1: 'Convert Images to PDF Online', expectedTitle: 'Convert Images to PDF Online' },
    { path: '/OwnPDF/compress/', expectedH1: 'Compress & Optimize PDF File Size', expectedTitle: 'Compress PDF Online' },
    { path: '/OwnPDF/inspect/', expectedH1: 'Inspect PDF Properties & Sanitize Metadata', expectedTitle: 'Inspect & Sanitize PDF Online' },
    { path: '/OwnPDF/rotate/', expectedH1: 'Rotate PDF Pages Online', expectedTitle: 'Rotate PDF Online' },
    { path: '/OwnPDF/page-numbers/', expectedH1: 'Add Page Numbers to PDF Documents', expectedTitle: 'Add Page Numbers to PDF Online' },
    { path: '/OwnPDF/watermark/', expectedH1: 'Add Watermark to PDF Online', expectedTitle: 'Add Watermark to PDF Online' },
    { path: '/OwnPDF/pdf-to-images/', expectedH1: 'Convert PDF to JPG and PNG Images', expectedTitle: 'Convert PDF to JPG & PNG Online' },
    { path: '/OwnPDF/extract-text/', expectedH1: 'Extract Text from PDF Online', expectedTitle: 'Extract Text from PDF Online' },
    { path: '/OwnPDF/crop/', expectedH1: 'Crop & Trim PDF Pages Online', expectedTitle: 'Crop PDF Online' },
  ];

  let failures = 0;

  for (const route of routes) {
    const res = await fetch(`http://localhost:${PORT}${route.path}`);
    if (res.status !== 200) {
      console.error(`FAIL: ${route.path} returned status ${res.status}`);
      failures++;
      continue;
    }
    const html = await res.text();
    if (!html.includes(route.expectedH1)) {
      console.error(`FAIL: ${route.path} missing expected H1 "${route.expectedH1}"`);
      failures++;
    }
    if (!html.includes(route.expectedTitle)) {
      console.error(`FAIL: ${route.path} missing expected Title "${route.expectedTitle}"`);
      failures++;
    }
    console.log(`PASS: ${route.path} -> 200 OK, valid H1 & Title`);
  }

  // Test 404 page
  const res404 = await fetch(`http://localhost:${PORT}/OwnPDF/nonexistent-route/`);
  if (res404.status === 404) {
    const html404 = await res404.text();
    if (html404.includes('Page Not Found') && html404.includes('noindex')) {
      console.log('PASS: /OwnPDF/nonexistent-route/ -> 404 with dedicated 404 HTML and noindex');
    } else {
      console.error('FAIL: 404 HTML missing expected content or noindex');
      failures++;
    }
  } else {
    console.error(`FAIL: 404 expected, got ${res404.status}`);
    failures++;
  }

  // Test Sitemap & Robots
  const resSitemap = await fetch(`http://localhost:${PORT}/OwnPDF/sitemap.xml`);
  const sitemapText = await resSitemap.text();
  if (resSitemap.status === 200 && sitemapText.includes('<loc>') && (sitemapText.match(/<loc>/g) || []).length === 15) {
    console.log('PASS: /OwnPDF/sitemap.xml -> 200 OK with all 15 URLs');
  } else {
    console.error('FAIL: sitemap.xml check failed');
    failures++;
  }


  const resRobots = await fetch(`http://localhost:${PORT}/OwnPDF/robots.txt`);
  const robotsText = await resRobots.text();
  if (resRobots.status === 200 && robotsText.includes('Allow: /') && robotsText.includes('Sitemap:')) {
    console.log('PASS: /OwnPDF/robots.txt -> 200 OK');
  } else {
    console.error('FAIL: robots.txt check failed');
    failures++;
  }

  server.close();

  if (failures > 0) {
    console.error(`FAILED with ${failures} errors.`);
    process.exit(1);
  } else {
    console.log('ALL PRODUCTION SERVER CHECKS PASSED.');
    process.exit(0);
  }
}

runVerification();
