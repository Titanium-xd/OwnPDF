import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  Layers,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const MergeTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('merge');
  const { effectiveFiles } = toolState;

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mergedResult, setMergedResult] = useState<{
    data: Uint8Array;
    size: number;
    pageCount: number;
    downloadFilename: string;
  } | null>(null);

  // Clear result when effective files change
  useEffect(() => {
    setMergedResult(null);
    setErrorMsg(null);
  }, [effectiveFiles.length]);

  const handleMerge = async () => {
    if (effectiveFiles.length < 2) {
      setErrorMsg('Please select at least two PDF documents to merge.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const orderedBuffers = effectiveFiles.map((f) => f.data);
      const mergedBytes = await pdfEngine.mergePdfs(orderedBuffers);

      // Verify header
      if (!PdfEngine.isValidPdfHeader(mergedBytes)) {
        throw new Error('Merged output lacks valid %PDF- header signature.');
      }

      const info = await pdfEngine.inspectPdf(mergedBytes);
      const downloadFilename = sanitizeDownloadFilename(
        effectiveFiles[0]?.name ? `${effectiveFiles[0].name.replace(/\.pdf$/i, '')}-merged` : 'merged-document',
        'pdf'
      ).replace(/-pdf\.pdf$/, '.pdf');

      setMergedResult({
        data: mergedBytes,
        size: mergedBytes.byteLength,
        pageCount: info.pageCount,
        downloadFilename: downloadFilename.endsWith('.pdf') ? downloadFilename : `${downloadFilename}.pdf`,
      });

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Merge failed. Please check the files.');
      setMergedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!mergedResult) return;
    try {
      await downloadPdf(mergedResult.data, mergedResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  const totalPages = effectiveFiles.reduce((sum, f) => sum + (f.pageCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Tool-specific Document Selection */}
      <ToolFileSelector
        toolId="merge"
        accept=".pdf"
        multiple={true}
        label="Merge Documents Selection"
      />

      {effectiveFiles.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-500" />
                <span>Merge Overview</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ready to merge {effectiveFiles.length} documents (~{totalPages} total pages) into a single continuous PDF.
              </p>
            </div>

            <button
              onClick={handleMerge}
              disabled={isProcessing || effectiveFiles.length < 2}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer self-start sm:self-auto"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Merging Documents Locally...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Merge {effectiveFiles.length} PDFs Now</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success State */}
          {mergedResult && (
            <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    PDFs Successfully Merged!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Combined {effectiveFiles.length} files into a single verified document with {mergedResult.pageCount} pages.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 text-xs space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Merged Document Size:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {Math.round(mergedResult.size / 1024)} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Verified Page Count:</span>
                  <span>{mergedResult.pageCount} pages</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">
                  <span>Output Filename:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {mergedResult.downloadFilename}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Merged PDF</span>
                </button>
                <button
                  onClick={() => setMergedResult(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
