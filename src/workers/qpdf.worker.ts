import createModule from '@neslinesli93/qpdf-wasm';
import type { WorkerRpcRequest, WorkerRpcResponse, PdfErrorCode } from '../types/engine';

let qpdfInstance: any = null;
let lastStderr = '';
let lastStdout = '';

async function getQpdf() {
  if (!qpdfInstance) {
    qpdfInstance = await createModule({
      locateFile: (path: string = '') => {
        if (path.endsWith('.wasm')) {
          const base = import.meta.env.BASE_URL || '/';
          return `${base}qpdf.wasm`;
        }
        return path;
      },
      print: (text: string) => {
        lastStdout += text + '\n';
      },
      printErr: (text: string) => {
        lastStderr += text + '\n';
      },
    });
  }
  return qpdfInstance;
}

function fileExists(qpdf: any, path: string): boolean {
  try {
    qpdf.FS.stat(path);
    return true;
  } catch {
    return false;
  }
}

const postResponse = (response: WorkerRpcResponse, transfer?: Transferable[]) => {
  const ctx = self as unknown as { postMessage: (msg: any, transfer?: Transferable[]) => void };
  if (transfer && transfer.length > 0) {
    ctx.postMessage(response, transfer);
  } else {
    ctx.postMessage(response);
  }
};

self.onmessage = async (e: MessageEvent<WorkerRpcRequest>) => {
  const req = e.data;
  lastStderr = '';
  lastStdout = '';

  try {
    const qpdf = await getQpdf();
    const inPath = `/work_in_${req.id}.pdf`;
    const outPath = `/work_out_${req.id}.pdf`;

    if (req.type === 'DECRYPT') {
      const inputBytes = new Uint8Array(req.fileData);
      qpdf.FS.writeFile(inPath, inputBytes);

      const args = [
        `--password=${req.password}`,
        '--decrypt',
        inPath,
        outPath,
      ];

      let exitCode = 0;
      try {
        exitCode = qpdf.callMain(args);
      } catch (err: any) {
        exitCode = err.status || 2;
      }

      const exists = fileExists(qpdf, outPath);

      if (exitCode !== 0 || !exists) {
        try { qpdf.FS.unlink(inPath); } catch {}
        
        const isWrongPassword = lastStderr.includes('invalid password') || 
                               lastStderr.includes('password') || 
                               exitCode === 2;
        
        const code: PdfErrorCode = isWrongPassword ? 'INCORRECT_PASSWORD' : 'CORRUPTED_DOCUMENT';
        const msg = isWrongPassword 
          ? 'Incorrect password. Please verify and try again.' 
          : 'Failed to decrypt document. The file may be damaged or use unsupported security.';

        postResponse({
          id: req.id,
          ok: false,
          error: msg,
          code,
          details: lastStderr.trim(),
        });
        return;
      }

      const outputBytes = qpdf.FS.readFile(outPath);
      // Independent copy before MEMFS unlinking prevents memory corruption/detached views
      const cleanBytes = new Uint8Array(outputBytes.length);
      cleanBytes.set(outputBytes);

      try { qpdf.FS.unlink(inPath); } catch {}
      try { qpdf.FS.unlink(outPath); } catch {}

      const outputBuffer = cleanBytes.buffer;

      postResponse(
        {
          id: req.id,
          ok: true,
          output: outputBuffer,
        },
        [outputBuffer]
      );
      return;
    }

    if (req.type === 'ENCRYPT') {
      const inputBytes = new Uint8Array(req.fileData);
      qpdf.FS.writeFile(inPath, inputBytes);

      const userPwd = req.userPassword || '';
      const ownerPwd = req.ownerPassword || req.userPassword || '';
      const keyLen = String(req.keyLength || 256);

      const args = [
        '--encrypt',
        userPwd,
        ownerPwd,
        keyLen,
        '--',
        inPath,
        outPath,
      ];

      let exitCode = 0;
      try {
        exitCode = qpdf.callMain(args);
      } catch (err: any) {
        exitCode = err.status || 2;
      }

      const exists = fileExists(qpdf, outPath);

      if (exitCode !== 0 || !exists) {
        try { qpdf.FS.unlink(inPath); } catch {}
        postResponse({
          id: req.id,
          ok: false,
          error: 'Failed to encrypt document.',
          code: 'CORRUPTED_DOCUMENT',
          details: lastStderr.trim(),
        });
        return;
      }

      const outputBytes = qpdf.FS.readFile(outPath);
      const cleanBytes = new Uint8Array(outputBytes.length);
      cleanBytes.set(outputBytes);

      try { qpdf.FS.unlink(inPath); } catch {}
      try { qpdf.FS.unlink(outPath); } catch {}

      const outputBuffer = cleanBytes.buffer;

      postResponse(
        {
          id: req.id,
          ok: true,
          output: outputBuffer,
        },
        [outputBuffer]
      );
      return;
    }

    if (req.type === 'OPTIMIZE') {
      const inputBytes = new Uint8Array(req.fileData);
      qpdf.FS.writeFile(inPath, inputBytes);

      const args = [
        '--linearize',
        '--object-streams=generate',
        inPath,
        outPath,
      ];

      let exitCode = 0;
      try {
        exitCode = qpdf.callMain(args);
      } catch (err: any) {
        exitCode = err.status || 2;
      }

      const exists = fileExists(qpdf, outPath);

      if (exitCode !== 0 || !exists) {
        try { qpdf.FS.unlink(inPath); } catch {}
        postResponse({
          id: req.id,
          ok: false,
          error: 'Optimization failed.',
          code: 'CORRUPTED_DOCUMENT',
          details: lastStderr.trim(),
        });
        return;
      }

      const outputBytes = qpdf.FS.readFile(outPath);
      const cleanBytes = new Uint8Array(outputBytes.length);
      cleanBytes.set(outputBytes);

      try { qpdf.FS.unlink(inPath); } catch {}
      try { qpdf.FS.unlink(outPath); } catch {}

      const outputBuffer = cleanBytes.buffer;

      postResponse(
        {
          id: req.id,
          ok: true,
          output: outputBuffer,
        },
        [outputBuffer]
      );
      return;
    }

    throw new Error(`Unsupported action type: ${(req as any).type}`);
  } catch (error: any) {
    postResponse({
      id: req.id,
      ok: false,
      error: error.message || 'Worker processing failed',
      code: 'UNKNOWN_ERROR',
      details: lastStderr.trim(),
    });
  }
};
