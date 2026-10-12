import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { ReverseMode } from '../../types/engine';
import {
  ArrowDownUp,
  RotateCcw,
  Layers,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ReversePagesTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('reverse-pages');
  const { activeFile } = toolState;

  const [mode, setMode] = useState<ReverseMode>('all');
  const [pageRange, setPageRange] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  const getSimulatedOrder = (): number[] => {
    if (!activeFile) return [];
    const total = activeFile.pageCount;
    if (total <= 1) return [1];

    if (mode === 'all') {
      return Array.from({ length: total }, (_, i) => total - i);
    }

    if (mode === 'range') {
      const parts = pageRange.split('-').map((s) => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const start = Math.max(1, Math.min(parts[0], total));
        const end = Math.max(start, Math.min(parts[1], total));
        const arr = Array.from({ length: total }, (_, i) => i + 1);
        const sub = arr.slice(start - 1, end).reverse();
        arr.splice(start - 1, sub.length, ...sub);
        return arr;
      }
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (mode === 'duplex-inverted') {
      const odds: number[] = [];
      const evens: number[] = [];
      for (let i = 1; i <= total; i++) {
        if (i % 2 !== 0) odds.push(i);
        else evens.push(i);
      }
      const revEvens = evens.reverse();
      const res: number[] = [];
      const maxL = Math.max(odds.length, revEvens.length);
      for (let i = 0; i < maxL; i++) {
        if (i < odds.length) res.push(odds[i]);
        if (i < revEvens.length) res.push(revEvens[i]);
      }
      return res;
    }

    return Array.from({ length: total }, (_, i) => i + 1);
  };

  const handleReverseAndDownload = async () => {
    if (!activeFile) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setHasCompleted(false);

    try {
      const resultData = await pdfEngine.reversePdfPages(activeFile.data, {
        mode,
        pageRange: mode === 'range' ? pageRange : undefined,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_reversed.pdf`);
      await downloadPdf(resultData, filename);

      setHasCompleted(true);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Reverse pages failed:', err);
      setErrorMsg(err?.message || 'Failed to reverse PDF pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulated = getSimulatedOrder();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="reverse-pages"
        description="Invert page order with 1-click presets: entire document, specific page ranges, or duplex scanner back-sides."
      />

      {activeFile && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-indigo-500" />
              Reversal Mode
            </h2>

            {/* Mode Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'all'
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <RotateCcw className={`w-5 h-5 ${mode === 'all' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {mode === 'all' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">
                  Reverse All Pages
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Flips the complete document sequence from last page to first (N &rarr; 1).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('range')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'range'
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowDownUp className={`w-5 h-5 ${mode === 'range' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {mode === 'range' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">
                  Reverse Specific Range
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inverts only a chosen range of pages, leaving surrounding pages intact.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('duplex-inverted')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'duplex-inverted'
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Layers className={`w-5 h-5 ${mode === 'duplex-inverted' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {mode === 'duplex-inverted' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">
                  Duplex Scanner Fix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Interleaves front sheets with reversed back sheets (fixes inverted ADF scans).
                </p>
              </button>
            </div>

            {/* Range Input for Range Mode */}
            {mode === 'range' && (
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enter Page Range to Reverse (e.g. 2-{Math.max(2, activeFile.pageCount)}):
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder={`e.g. 2-${activeFile.pageCount}`}
                  className="w-full max-w-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* Simulated Sequence Preview */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Resulting Page Sequence Preview:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">
                {simulated.map((pageNum, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    p.{pageNum}
                  </span>
                ))}
              </div>
            </div>

            {/* Technical Boundary Callout */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Preservation Guarantee:
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Vector content, form fields, rotation angles, page dimensions, and document metadata (Title, Author, Subject) are verified and preserved. Document outline bookmarks (/Outlines) and custom page labels are omitted in reordered sequences.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleReverseAndDownload}
                disabled={isProcessing || (mode === 'range' && !pageRange.trim())}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reversing Pages...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Reverse Pages & Download
                  </>
                )}
              </button>
            </div>
          </div>

          {hasCompleted && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Reversal Complete & Downloaded!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  All pages have been reorganized and downloaded in the requested order.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
