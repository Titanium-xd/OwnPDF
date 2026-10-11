import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  Unlock,
  Lock,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const UnlockTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('unlock');
  const { activeFile } = toolState;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unlockedResult, setUnlockedResult] = useState<{
    data: Uint8Array;
    originalSize: number;
    unlockedSize: number;
    pageCount: number;
    downloadFilename: string;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Clear previous results whenever active file changes
  useEffect(() => {
    setUnlockedResult(null);
    setErrorMsg(null);
    setPassword('');
  }, [activeFile?.id]);

  // Render canvas preview when unlocked
  useEffect(() => {
    if (unlockedResult && previewCanvasRef.current) {
      renderPdfPageToCanvas(unlockedResult.data, 1, previewCanvasRef.current, { maxDimension: 300 }).catch(console.error);
    }
    return () => {
      clearCanvas(previewCanvasRef.current);
    };
  }, [unlockedResult]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile) return;
    if (!password) {
      setErrorMsg('Please enter the password.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Decrypt via QPDF WASM worker
      const result = await pdfEngine.unlockPdf(activeFile.data, password);

      // 2. Validate output PDF signature %PDF-
      if (!PdfEngine.isValidPdfHeader(result.unlockedData)) {
        throw new Error('Verification failed: decrypted bytes lack valid %PDF- signature.');
      }

      // 3. Inspect page count & structure
      const info = await pdfEngine.inspectPdf(result.unlockedData);
      if (info.pageCount === 0) {
        throw new Error('Verification failed: decrypted document has 0 pages.');
      }

      // 4. Confirm document is genuinely unencrypted
      const isStillEncrypted = await pdfEngine.isEncrypted(result.unlockedData);
      if (isStillEncrypted) {
        throw new Error('Verification failed: document remains password-protected.');
      }

      // 5. Generate verified output filename
      const downloadFilename = sanitizeDownloadFilename(activeFile.name, 'unlocked');

      setUnlockedResult({
        data: result.unlockedData,
        originalSize: result.originalSize,
        unlockedSize: result.unlockedSize,
        pageCount: info.pageCount,
        downloadFilename,
      });

      // Clear password from state immediately
      setPassword('');

      // Confetti celebration
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      if (err.code === 'INCORRECT_PASSWORD') {
        setErrorMsg('Incorrect password. Please verify and try again.');
      } else {
        setErrorMsg(err.message || 'Decryption failed. Please check the file.');
      }
      setUnlockedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!unlockedResult) return;
    try {
      await downloadPdf(unlockedResult.data, unlockedResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Per-Tool Document Selection / Source Manager */}
      <ToolFileSelector
        toolId="unlock"
        accept=".pdf"
        multiple={false}
        label="Unlock Document Selection"
      />

      {/* Workspace Body: Only shown when a valid target file is selected */}
      {activeFile && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: File Info & Controls */}
          <div className="md:col-span-7 space-y-6">
            {/* Active Document Metadata Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={activeFile.name}>
                      {activeFile.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(activeFile.size / 1024)} KB • {activeFile.isEncrypted ? 'Password Protected' : 'Not Encrypted'}
                    </p>
                  </div>
                </div>
                {activeFile.isEncrypted && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shrink-0">
                    Locked
                  </span>
                )}
              </div>
            </div>

            {/* Password Form or Success State */}
            {!unlockedResult ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Enter Document Password
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Decrypted locally in your browser with QPDF WebAssembly. Your password never leaves your device.
                  </p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter opening password"
                        autoFocus
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900 dark:text-slate-100 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isProcessing || !password}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Decrypting via QPDF WASM...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Unlock PDF & Remove Password</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                      Password Successfully Removed!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Decrypted bytes verified. The file opens on any device without a password.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <div className="flex justify-between">
                    <span>Original File:</span>
                    <span className="font-mono">{Math.round(unlockedResult.originalSize / 1024)} KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Decrypted File:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {Math.round(unlockedResult.unlockedSize / 1024)} KB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Page Count:</span>
                    <span>{unlockedResult.pageCount} pages verified</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 text-[11px]">
                    <span>Output Filename:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                      {unlockedResult.downloadFilename}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Unlocked PDF</span>
                  </button>
                  <button
                    onClick={() => setUnlockedResult(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Preview / Helper Box */}
          <div className="md:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col items-center justify-center min-h-[320px] shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 self-start flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-sky-500" />
                <span>Document Preview</span>
              </h4>

              {unlockedResult ? (
                <div className="flex flex-col items-center">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 max-w-full overflow-hidden">
                    <canvas ref={previewCanvasRef} className="rounded-lg shadow-sm" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Verified First Page Preview (Rendered locally)</p>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Lock className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    Page preview will render dynamically as soon as the document is unlocked.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
