import createModule from '@neslinesli93/qpdf-wasm';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateFixtures() {
  const dirs = ['public/fixtures', 'test/fixtures'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('Generating synthetic test fixtures...');

  // 1. Unencrypted 2-page PDF
  const unencryptedDoc = await PDFDocument.create();
  const helvetica = await unencryptedDoc.embedFont(StandardFonts.Helvetica);
  
  const page1 = unencryptedDoc.addPage([595, 842]);
  page1.drawText('OwnPDF Synthetic Document - Page 1', { x: 50, y: 780, size: 20, font: helvetica, color: rgb(0.1, 0.3, 0.8) });
  page1.drawText('This document is purely synthetic and contains zero confidential data.', { x: 50, y: 740, size: 12, font: helvetica });
  page1.drawRectangle({ x: 50, y: 600, width: 200, height: 100, color: rgb(0.9, 0.95, 1), borderColor: rgb(0.2, 0.4, 0.9), borderWidth: 2 });
  page1.drawText('Sample Card Graphic', { x: 70, y: 645, size: 14, font: helvetica, color: rgb(0.2, 0.4, 0.9) });

  const page2 = unencryptedDoc.addPage([595, 842]);
  page2.drawText('OwnPDF Synthetic Document - Page 2', { x: 50, y: 780, size: 20, font: helvetica, color: rgb(0.1, 0.3, 0.8) });
  page2.drawText('Page 2 content for merge and split verification.', { x: 50, y: 740, size: 12, font: helvetica });

  const unencryptedBytes = await unencryptedDoc.save();

  // 2. Multipage 5-page PDF
  const multiDoc = await PDFDocument.create();
  const multiFont = await multiDoc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= 5; i++) {
    const page = multiDoc.addPage([595, 842]);
    page.drawText(`Document Page ${i} of 5`, { x: 50, y: 780, size: 24, font: multiFont, color: rgb(0.1, 0.2, 0.6) });
    page.drawText(`Synthetic test content for page organization and reordering. Index: ${i}`, { x: 50, y: 730, size: 13, font: helvetica });
    page.drawRectangle({ x: 50, y: 650, width: 495, height: 40, color: rgb(0.92, 0.94, 0.98) });
    page.drawText(`Page Marker #${i}`, { x: 70, y: 662, size: 14, font: multiFont, color: rgb(0.2, 0.3, 0.7) });
  }
  const multiBytes = await multiDoc.save();

  // 3. Encrypted AES-256 PDF using QPDF WASM
  const qpdf = await createModule();
  qpdf.FS.writeFile('/unenc.pdf', unencryptedBytes);
  qpdf.callMain([
    '--encrypt', 'testpass123', 'ownerpass789', '256', '--',
    '/unenc.pdf', '/enc.pdf'
  ]);
  const encryptedBytes = qpdf.FS.readFile('/enc.pdf');
  qpdf.FS.unlink('/unenc.pdf');
  qpdf.FS.unlink('/enc.pdf');

  // 4. Corrupt PDF
  const corruptBytes = Buffer.from('%PDF-1.4\n%Malformed and truncated byte stream for error detection\n');

  // 5. Minimal Valid PNG (100x100 solid blue PNG)
  // Base64 of a clean 100x100 blue PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHiqAQtgAAEUtZz4AAAAAElFTkSuQmCC';
  const pngBytes = Buffer.from(pngBase64, 'base64');

  // Write to both public/fixtures (for browser demo/prototype) and test/fixtures (for vitest)
  const fileMap = {
    'fixture-unencrypted.pdf': unencryptedBytes,
    'fixture-multipage.pdf': multiBytes,
    'fixture-encrypted-aes256.pdf': encryptedBytes,
    'fixture-corrupt.pdf': corruptBytes,
    'fixture-image-1.png': pngBytes,
  };

  for (const dir of dirs) {
    for (const [filename, data] of Object.entries(fileMap)) {
      const target = path.join(dir, filename);
      fs.writeFileSync(target, data);
      console.log(`Saved ${target} (${data.byteLength || data.length} bytes)`);
    }
  }

  console.log('✅ All synthetic test fixtures generated successfully!');
}

generateFixtures().catch(err => {
  console.error('Failed to generate fixtures:', err);
  process.exit(1);
});
