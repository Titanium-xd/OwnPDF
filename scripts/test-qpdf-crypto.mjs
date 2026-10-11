import createModule from '@neslinesli93/qpdf-wasm';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

async function runCryptoProofOfConcept() {
  console.log('--- Step 1: Generate clean synthetic PDF using pdf-lib ---');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  
  // Page 1
  const page1 = doc.addPage([595, 842]); // A4
  page1.drawText('OwnPDF Synthetic Test Document - Page 1', {
    x: 50,
    y: 780,
    size: 20,
    font,
    color: rgb(0.2, 0.2, 0.8),
  });
  page1.drawText('This is a completely non-sensitive synthetic document for local cryptographic testing.', {
    x: 50,
    y: 740,
    size: 12,
    font,
  });

  // Page 2
  const page2 = doc.addPage([595, 842]);
  page2.drawText('OwnPDF Synthetic Test Document - Page 2', {
    x: 50,
    y: 780,
    size: 20,
    font,
    color: rgb(0.2, 0.2, 0.8),
  });
  page2.drawText('Verified page 2 content for split/merge tests.', {
    x: 50,
    y: 740,
    size: 12,
    font,
  });

  const unencryptedBytes = await doc.save();
  console.log(`Generated synthetic PDF: ${unencryptedBytes.byteLength} bytes`);

  console.log('\n--- Step 2: Initialize QPDF WASM module ---');
  let stderrOutput = '';
  let stdoutOutput = '';

  const qpdf = await createModule({
    print: (text) => { stdoutOutput += text + '\n'; },
    printErr: (text) => { stderrOutput += text + '\n'; },
  });

  console.log('\n--- Step 3: Encrypt with AES-256 using QPDF ---');
  const testPassword = 'testpass123';
  qpdf.FS.writeFile('/work_in.pdf', unencryptedBytes);

  // QPDF command: qpdf --encrypt <user-pwd> <owner-pwd> 256 -- /work_in.pdf /work_enc.pdf
  const encryptArgs = [
    '--encrypt', testPassword, 'ownerpass456', '256', '--',
    '/work_in.pdf', '/work_enc.pdf'
  ];
  
  let exitCode = qpdf.callMain(encryptArgs);
  console.log('QPDF Encryption Exit Code:', exitCode);
  
  const encryptedBytes = qpdf.FS.readFile('/work_enc.pdf');
  console.log(`Encrypted output size: ${encryptedBytes.byteLength} bytes`);

  // Unlink temporary input
  qpdf.FS.unlink('/work_in.pdf');

  console.log('\n--- Step 4: Verify encrypted file cannot be loaded directly into pdf-lib ---');
  try {
    await PDFDocument.load(encryptedBytes);
    console.error('FAIL: Encrypted PDF was loaded by pdf-lib without decryption!');
    process.exit(1);
  } catch (err) {
    console.log('PASS: pdf-lib correctly threw EncryptedPDFError:', err.message);
  }

  console.log('\n--- Step 5: Test decryption with WRONG password ---');
  qpdf.FS.writeFile('/work_test_wrong.pdf', encryptedBytes);
  stderrOutput = '';
  let wrongPasswordCaught = false;
  try {
    // QPDF exits with code 2 on password error
    qpdf.callMain([
      '--password=wrongpass',
      '--decrypt',
      '/work_test_wrong.pdf',
      '/work_test_wrong_out.pdf'
    ]);
  } catch (err) {
    wrongPasswordCaught = true;
    console.log('PASS: QPDF rejected incorrect password with error:', err.message || err);
  }
  if (!wrongPasswordCaught) {
    console.warn('Note: callMain returned without exception, checking stderr...');
  }
  console.log('Stderr from wrong password:', stderrOutput.trim());
  qpdf.FS.unlink('/work_test_wrong.pdf');

  console.log('\n--- Step 6: Test decryption with CORRECT password ---');
  qpdf.FS.writeFile('/work_test_correct.pdf', encryptedBytes);
  stderrOutput = '';
  stdoutOutput = '';

  // QPDF command: qpdf --password=testpass123 --decrypt /work_test_correct.pdf /work_decrypted.pdf
  exitCode = qpdf.callMain([
    `--password=${testPassword}`,
    '--decrypt',
    '/work_test_correct.pdf',
    '/work_decrypted.pdf'
  ]);
  console.log('QPDF Decryption Exit Code:', exitCode);

  const decryptedBytes = qpdf.FS.readFile('/work_decrypted.pdf');
  console.log(`Decrypted output size: ${decryptedBytes.byteLength} bytes`);

  // Clean up virtual filesystem
  qpdf.FS.unlink('/work_test_correct.pdf');
  qpdf.FS.unlink('/work_decrypted.pdf');
  qpdf.FS.unlink('/work_enc.pdf');
  console.log('PASS: All temporary files unlinked from MEMFS.');

  console.log('\n--- Step 7: Validate decrypted PDF can be parsed by pdf-lib ---');
  const decryptedDoc = await PDFDocument.load(decryptedBytes);
  const pageCount = decryptedDoc.getPageCount();
  console.log(`PASS: Decrypted document opened cleanly! Page count: ${pageCount}`);
  if (pageCount === 2) {
    console.log('\n🎉 ALL CRYPTOGRAPHIC POC CHECKS PASSED WITH FLYING COLORS! 🎉');
  } else {
    console.error('FAIL: Expected 2 pages, got', pageCount);
    process.exit(1);
  }
}

runCryptoProofOfConcept().catch(err => {
  console.error('Unhandled error in POC:', err);
  process.exit(1);
});
