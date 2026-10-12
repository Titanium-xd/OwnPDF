import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { duplicatePagesEngine } from '../../engine/duplicate-pages-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { DuplicateDetectionResult } from '../../types/engine';
import {
  CopyX,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const RemoveDuplicatePagesTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('remove-duplicate-pages');
  const { activeFile } = toolState;

  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<DuplicateDetectionResult | null>(null);
  const [selectedDeletions, setSelectedDeletions] = useState<Set<number>>(new Set());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFile) {
      setScanResult(null);
      setSelectedDeletions(new Set());
      setErrorMsg(null);
      setSuccessMsg(null);
      return;
    }

    let isCancelled = false;
    setIsScanning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    duplicatePagesEngine
      .detectDuplicatePages(activeFile.data)
      .then((res) => {
        if (!isCancelled) {
          setScanResult(res);
          // Pre-select non-original duplicate pages for deletion
          const toDelete = new Set(
            res.candidates.filter((c) => !c.isOriginal).map((c) => c.pageIndex)
          );
          setSelectedDeletions(toDelete);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Duplicate detection failed:', err);
          setErrorMsg(err?.message || 'Failed to scan document for duplicate pages.');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsScanning(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.id]);

  const togglePageDeletion = (pageIndex: number) => {
    setSelectedDeletions((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const handleRemoveAndDownload = async () => {
    if (!activeFile || selectedDeletions.size === 0) return;

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const pageIndices = Array.from(selectedDeletions);
      const cleanedData = await duplicatePagesEngine.removeDuplicates(
        activeFile.data,
        pageIndices
      );

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_deduped.pdf`);
      await downloadPdf(cleanedData, filename);

      setSuccessMsg(
        `Successfully removed ${selectedDeletions.size} duplicate page(s) and downloaded clean PDF.`
      );
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Page deletion failed:', err);
      setErrorMsg(err?.message || 'Failed to remove duplicate pages.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="remove-duplicate-pages"
        description="Detect and remove identical or near-identical duplicate pages using text and visual fingerprints."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CopyX className="w-5 h-5 text-indigo-500" />
                Duplicate Pages Detection
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review candidate duplicate clusters. The first occurrence is preserved by default.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRemoveAndDownload}
              disabled={isDeleting || selectedDeletions.size === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Removing Selected Pages...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Remove {selectedDeletions.size} Duplicate(s) & Download
                </>
              )}
            </button>
          </div>

          {isScanning ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Scanning document pages for duplicate text & layout patterns...
            </div>
          ) : !scanResult || scanResult.groups.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No duplicate pages detected in this document.
              </p>
              <p className="text-xs text-slate-500">
                Every page in this document appears to have distinct textual content or dimensions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Found {scanResult.groups.length} duplicate group(s) with {scanResult.totalDuplicatesDetected} potential duplicate page(s).
              </p>

              {scanResult.groups.map((group) => (
                <div
                  key={group.groupId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Cluster: Original Page #{group.originalPageNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium">
                      {group.confidence}% similarity match
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {group.candidates.map((cand) => {
                      const isChecked = selectedDeletions.has(cand.pageIndex);

                      return (
                        <div
                          key={cand.pageNumber}
                          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                            cand.isOriginal
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                              : isChecked
                              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div>
                            <span className="font-bold">Page {cand.pageNumber}</span>
                            <span className="block text-[11px] text-slate-500">
                              {cand.isOriginal ? 'Original (Keep)' : 'Duplicate'}
                            </span>
                          </div>

                          {!cand.isOriginal && (
                            <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePageDeletion(cand.pageIndex)}
                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                              />
                              Delete
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p>{successMsg}</p>
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
