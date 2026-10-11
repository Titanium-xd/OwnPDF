import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  Minimize2,
  Download,
  AlertTriangle,
  RefreshCw,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CompressTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('compress');
  const { activeFile } = toolState;

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [compressResult, setCompressResult] = useState<{
    data: Uint8Array;
    originalSize: number;
    compressedSize: number;
    savedBytes: number;
    savingsPercent: number;
    isSmaller: boolean;
    downloadFilename: string;
  } | null>(null);

  useEffect(() => {
    setCompressResult(null);
    setErrorMsg(null);
  }, [activeFile?.id]);

  const handleCompress = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await pdfEngine.compressPdf(activeFile.data);

      if (!PdfEngine.isValidPdfHeader(res.compressedData)) {
        throw new Error('Compressed output lacks valid %PDF- header signature.');
      }

      const downloadFilename = sanitizeDownloadFilename(activeFile.name, 'compressed');

      setCompressResult({
        data: res.compressedData,
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
        savedBytes: res.savedBytes,
        savingsPercent: res.savingsPercent,
        isSmaller: res.isSmaller,
        downloadFilename,
      });

      if (res.isSmaller) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Compression failed.');
      setCompressResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!compressResult) return;
    try {
      await downloadPdf(compressResult.data, compressResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector
        toolId="compress"
        accept=".pdf"
        multiple={false}
        label="Compress & Linearize Document Selection"
      />

      {activeFile && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Configuration & Stats */}
          <div className="md:col-span-7 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3 truncate">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={activeFile.name}>
                    {activeFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Current Size: {Math.round(activeFile.size / 1024)} KB • {activeFile.pageCount} pages
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Lossless Structure Optimization & Linearization
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Removes unreferenced XRefs, redundant stream objects, and linearizes the document structure for fast web streaming with QPDF WASM.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={handleCompress}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Compressing via Web Worker...</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span>Optimize & Linearize Document</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Card */}
            {compressResult && (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                {compressResult.isSmaller ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <Sparkles className="w-5 h-5" />
                      <span>Successfully Compressed ({compressResult.savingsPercent}% Reduction)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-slate-400 block text-[11px]">Original Size</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {Math.round(compressResult.originalSize / 1024)} KB
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-emerald-600 dark:text-emerald-400 block text-[11px]">Optimized Size</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                          {Math.round(compressResult.compressedSize / 1024)} KB
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      Output: {compressResult.downloadFilename}
                    </div>

                    <button
                      onClick={handleDownload}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Optimized PDF</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-sm">
                      <Info className="w-5 h-5" />
                      <span>Already Highly Optimized Document</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This PDF was already compactly stream-compressed. Re-linearizing it created a fast web-streaming layout without significant size variance.
                    </p>

                    <button
                      onClick={handleDownload}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Linearized Copy</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Guidance Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Optimization Features
              </h4>
              <ul className="text-xs space-y-2.5 text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <span><strong>Web Linearization:</strong> Enables page-by-page streaming across browser viewers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <span><strong>Object Stream Generation:</strong> Bundles individual PDF objects into compressed streams.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <span><strong>Lossless Integrity:</strong> Vector paths, fonts, and high-DPI text are preserved with 100% fidelity.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
