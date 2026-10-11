import createModule from '@neslinesli93/qpdf-wasm';
import fs from 'fs';

async function test() {
  console.log('Testing createModule in node...');
  try {
    const qpdf = await createModule();
    console.log('qpdf loaded successfully in node!');
    console.log('callMain type:', typeof qpdf.callMain);
    console.log('FS type:', typeof qpdf.FS);
  } catch (err) {
    console.error('Failed to load in node:', err);
  }
}

test();
