import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { BlankPageCandidate } from '../../types/engine';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Info,
  Sliders,
  Check,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const DeleteBlankPagesTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('delete-blank-pages');
  const { activeFile } = toolState;

  const [candidates, setCandidates] = useState<BlankPageCandidate[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [threshold, setThreshold] = useState<number>(0.15); // %
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      runDetection();
    } else {
      setCandidates([]);
      setSelectedIndices(new Set());
      setErrorMsg(null);
      setHasCompleted(false);
    }
  }, [activeFile?.id, threshold]);

  const runDetection = async () => {
    if (!activeFile) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setHasCompleted(false);

    try {
      const result = await pdfEngine.detectBlankPages(activeFile.data, {
        threshold,
      });
      setCandidates(result.candidates);
      const preSelected = new Set(
        result.candidates.filter((c) => c.selected).map((c) => c.pageIndex)
      );
      setSelectedIndices(preSelected);
    } catch (err: any) {
      console.error('Blank page detection failed:', err);
      setErrorMsg(err?.message || 'Failed to analyze pages.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePageSelection = (pageIndex: number) => {
    const next = new Set(selectedIndices);
    if (next.has(pageIndex)) {
      next.delete(pageIndex);
    } else {
      next.add(pageIndex);
    }
    setSelectedIndices(next);
  };

  const selectAllCandidates = () => {
    const candidateIndices = new Set(
      candidates.filter((c) => c.status !== 'HAS_CONTENT').map((c) => c.pageIndex)
    );
    setSelectedIndices(candidateIndices);
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleDeleteAndDownload = async () => {
    if (!activeFile || selectedIndices.size === 0) return;

    if (selectedIndices.size >= activeFile.pageCount) {
      setErrorMsg('Cannot delete all pages in a document. At least one page must remain.');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const cleanedBytes = await pdfEngine.deletePages(
        activeFile.data,
        Array.from(selectedIndices)
      );

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_cleaned.pdf`);
      await downloadPdf(cleanedBytes, filename);

      setHasCompleted(true);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Page deletion failed:', err);
      setErrorMsg(err?.message || 'Failed to delete selected pages.');
    } finally {
      setIsDeleting(false);
    }
  };

  const candidateCount = candidates.filter((c) => c.status !== 'HAS_CONTENT').length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="delete-blank-pages"
        description="Detect and remove empty or accidental scanner sheets using intelligent ink-density and text-layer analysis."
      />

      {activeFile && (
        <div className="space-y-6">
          {/* Controls & Sensitivity Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-indigo-500" />
                  Candidate Detector & Review
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAnalyzing
                    ? 'Analyzing document pages...'
                    : `Detected ${candidateCount} candidate blank page(s) out of ${candidates.length} total pages`}
                </p>
              </div>

              {/* Threshold Slider */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <Sliders className="w-4 h-4 text-slate-500" />
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Noise Tolerance:
                </label>
                <input
                  type="range"
                  min="0.02"
                  max="0.40"
                  step="0.02"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-24 accent-indigo-600 cursor-pointer"
                  title="Adjust scanner noise sensitivity"
                />
                <span className="text-xs font-mono text-slate-500">{threshold.toFixed(2)}%</span>
              </div>
            </div>

            {/* Selection actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllCandidates}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                >
                  Select All Blank Candidates
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>

              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Selected for deletion: <span className="font-semibold text-rose-600 dark:text-rose-400">{selectedIndices.size}</span> page(s)
              </span>
            </div>

            {/* Interactive Candidate Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto p-1">
              {candidates.map((c) => {
                const isSelected = selectedIndices.has(c.pageIndex);
                const isBlank = c.status === 'HIGH_CONFIDENCE_BLANK';
                const isNoise = c.status === 'POSSIBLE_NOISE';

                return (
                  <div
                    key={c.pageIndex}
                    onClick={() => togglePageSelection(c.pageIndex)}
                    className={`relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Page {c.pageNumber}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by card click
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="my-2 space-y-1">
                      {isBlank && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Blank
                        </span>
                      )}
                      {isNoise && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Noise
                        </span>
                      )}
                      {!isBlank && !isNoise && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          <FileText className="w-3 h-3" /> Content
                        </span>
                      )}

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {c.textGlyphCount > 0 ? `${c.textGlyphCount} glyphs` : '0 glyphs'}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                      Ink: {c.inkCoverage.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirmation & Technical Safety Callout */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Explicit User Confirmation:
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  The detector evaluates both vector text glyphs and pixel ink density, safely detecting scanner dust without deleting pages that contain small footers, signatures, or OCR text layers. Only checked pages will be removed.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleDeleteAndDownload}
                disabled={isDeleting || selectedIndices.size === 0}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting Selected Pages...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Delete {selectedIndices.size} Page(s) & Download
                  </>
                )}
              </button>
            </div>
          </div>

          {hasCompleted && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Blank Pages Removed & Downloaded!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Cleaned document has been saved with blank sheets removed.
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
