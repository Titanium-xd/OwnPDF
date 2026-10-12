import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { compareEngine } from '../../engine/compare-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import type { CompareResult, PageComparison } from '../../types/engine';
import {
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export const CompareTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('compare');
  const { effectiveFiles } = toolState;

  const [isComparing, setIsComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());

  const fileA = effectiveFiles[0];
  const fileB = effectiveFiles[1];

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setErrorMsg('Please upload or select two PDF documents to compare.');
      return;
    }

    setIsComparing(true);
    setErrorMsg(null);
    setCompareResult(null);

    try {
      const result = await compareEngine.comparePdfs(fileA.data, fileB.data);
      setCompareResult(result);
      // Auto-expand pages with differences
      const diffPageNums = new Set(
        result.pageComparisons
          .filter((p) => p.status !== 'IDENTICAL')
          .map((p) => p.pageNumber)
      );
      setExpandedPages(diffPageNums);
    } catch (err: any) {
      console.error('Comparison error:', err);
      setErrorMsg(err?.message || 'Failed to compare the two documents.');
    } finally {
      setIsComparing(false);
    }
  };

  const togglePageExpand = (pageNumber: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="compare"
        description="Side-by-side visual and text-layer comparison between two PDF documents with change highlights."
        multiple
      />

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-indigo-500" />
              Document Comparison Setup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select two PDFs to perform structural, visual, and textual diffing.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCompare}
            disabled={isComparing || !fileA || !fileB}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isComparing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing Differences...
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4" />
                Compare Documents
              </>
            )}
          </button>
        </div>

        {/* Selected Files Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
              Document A (Base)
            </span>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-1">
              {fileA ? fileA.name : 'No file selected (upload first file)'}
            </p>
            {fileA && (
              <span className="text-xs text-slate-500">{fileA.pageCount} page(s)</span>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-xs font-semibold uppercase text-purple-600 dark:text-purple-400">
              Document B (Modified)
            </span>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-1">
              {fileB ? fileB.name : 'No file selected (upload second file)'}
            </p>
            {fileB && (
              <span className="text-xs text-slate-500">{fileB.pageCount} page(s)</span>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {compareResult && (
        <div className="space-y-6">
          {/* Summary Dashboard */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Comparison Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 text-center">
                <span className="text-xs text-slate-500">Evaluated Pages</span>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {compareResult.totalEvaluatedPages}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 text-center">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Identical Pages</span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {compareResult.identicalPageCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 text-center">
                <span className="text-xs text-amber-600 dark:text-amber-400">Pages with Differences</span>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  {compareResult.differentPageCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 text-center">
                <span className="text-xs text-indigo-600 dark:text-indigo-400">Document Size</span>
                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200 mt-2">
                  A: {compareResult.docAPageCount} pg | B: {compareResult.docBPageCount} pg
                </p>
              </div>
            </div>
          </div>

          {/* Per-Page Diff List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Page-by-Page Comparison
            </h3>

            <div className="space-y-3">
              {compareResult.pageComparisons.map((pc: PageComparison) => {
                const isExpanded = expandedPages.has(pc.pageNumber);
                const isIdentical = pc.status === 'IDENTICAL';

                return (
                  <div
                    key={pc.pageNumber}
                    className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => togglePageExpand(pc.pageNumber)}
                      className="w-full p-4 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/70 flex items-center justify-between transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          Page {pc.pageNumber}
                        </span>

                        {isIdentical ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Identical ({pc.similarityScore}%)
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {pc.status.replace(/_/g, ' ')} ({pc.similarityScore}% match)
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-mono">
                        {pc.pageAWidth && pc.pageAHeight && (
                          <span>Dim: {Math.round(pc.pageAWidth)}x{Math.round(pc.pageAHeight)}</span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-700/80 space-y-3 bg-white dark:bg-slate-800">
                        {pc.textDiffLines.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No text content detected on this page.</p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto space-y-1 font-mono text-xs p-3 bg-slate-900 text-slate-200 rounded-lg">
                            {pc.textDiffLines.map((line, lIdx) => (
                              <div
                                key={lIdx}
                                className={`px-2 py-0.5 rounded ${
                                  line.type === 'removed'
                                    ? 'bg-rose-900/60 text-rose-200 border-l-2 border-rose-500'
                                    : line.type === 'added'
                                    ? 'bg-emerald-900/60 text-emerald-200 border-l-2 border-emerald-500'
                                    : 'text-slate-400'
                                }`}
                              >
                                <span className="inline-block w-4 font-bold select-none">
                                  {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
                                </span>
                                {line.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
