import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { findReplaceEngine } from '../../engine/find-replace';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { TextMatchOccurrence } from '../../types/engine';
import {
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FindReplaceTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('find-replace');
  const { activeFile } = toolState;

  const [searchQuery, setSearchQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [bgHex, setBgHex] = useState('#FFFFFF');

  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [occurrences, setOccurrences] = useState<TextMatchOccurrence[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    replaced: number;
    collisions: number;
  } | null>(null);

  // Clear occurrences when active file changes
  useEffect(() => {
    setOccurrences([]);
    setSelectedIds(new Set());
    setErrorMsg(null);
    setSuccessSummary(null);
  }, [activeFile?.id]);

  const handleSearch = async () => {
    if (!activeFile || !searchQuery.trim()) {
      setOccurrences([]);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    setSuccessSummary(null);

    try {
      const results = await findReplaceEngine.searchPdfText(activeFile.data, searchQuery.trim(), {
        matchCase,
        replaceText,
      });
      setOccurrences(results);
      // Pre-select all valid occurrences
      const validIds = new Set(results.filter((o) => o.status === 'VALID').map((o) => o.id));
      setSelectedIds(validIds);
    } catch (err: any) {
      console.error('Find & Replace search failed:', err);
      setErrorMsg(err?.message || 'Failed to search PDF text.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    const validIds = new Set(occurrences.filter((o) => o.status === 'VALID').map((o) => o.id));
    setSelectedIds(validIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const handleReplaceAndDownload = async () => {
    if (!activeFile || occurrences.length === 0 || selectedIds.size === 0) return;

    setIsReplacing(true);
    setErrorMsg(null);

    try {
      const bgColor = hexToRgb(bgHex);
      const result = await findReplaceEngine.replacePdfText(activeFile.data, {
        searchQuery: searchQuery.trim(),
        replaceText,
        matchCase,
        selectedOccurrenceIds: Array.from(selectedIds),
        backgroundColor: bgColor,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_replaced.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessSummary({
        replaced: result.replacedCount,
        collisions: result.collisionCount,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Find & Replace execution failed:', err);
      setErrorMsg(err?.message || 'Failed to replace text in PDF.');
    } finally {
      setIsReplacing(false);
    }
  };

  const validCount = occurrences.filter((o) => o.status === 'VALID').length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="find-replace"
        description="Locate words, names, or numbers across pages, preview occurrences, and replace them with visual precision."
      />

      {activeFile && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-500" />
              Search & Replace Parameters
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Find Text:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter word or phrase to find..."
                    className="w-full pl-3 pr-24 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Search
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Replace With:
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Leave empty to erase visually..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Options Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={(e) => setMatchCase(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Match case
              </label>

              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">Background Patch Color:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={bgHex}
                    onChange={(e) => setBgHex(e.target.value)}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                    title="Choose background patch color"
                  />
                  <span className="text-xs font-mono text-slate-500 uppercase">{bgHex}</span>
                </div>
              </div>
            </div>

            {/* Honest Technical Limitation Callout */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3 text-sm text-amber-900 dark:text-amber-200">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Visual Masking Notice (Not Secure Redaction):</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  PDF documents do not support word-processing text reflow. This tool covers matched text with an opaque background patch and stamps the new text at the exact baseline. It does not erase the underlying vector stream or reflow surrounding paragraphs. For irreversible data destruction, use Redact PDF.
                </p>
              </div>
            </div>
          </div>

          {/* Results & Occurrences Section */}
          {occurrences.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Matches Found ({occurrences.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedIds.size} of {validCount} valid occurrences selected for replacement
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                  >
                    Select All Valid
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Occurrences List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                {occurrences.map((occ) => {
                  const isSelected = selectedIds.has(occ.id);
                  const isUnsupported = occ.status !== 'VALID';

                  return (
                    <div
                      key={occ.id}
                      className={`pt-2 flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        isUnsupported
                          ? 'opacity-60 bg-slate-50 dark:bg-slate-900/40'
                          : isSelected
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30'
                          : 'bg-white dark:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isUnsupported}
                        onChange={() => toggleSelect(occ.id)}
                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                            Page {occ.pageNumber}
                          </span>

                          {occ.status === 'VALID' ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> {occ.status}
                            </span>
                          )}

                          {occ.collisionWarning && (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Replacement is significantly longer than original">
                              <AlertTriangle className="w-3 h-3" /> Layout collision warning
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                          {occ.snippet}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Ready to replace <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedIds.size}</span> item(s).
                </div>

                <button
                  onClick={handleReplaceAndDownload}
                  disabled={isReplacing || selectedIds.size === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isReplacing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing Replacement...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Replace & Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success summary badge */}
          {successSummary && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Replacement Complete & Downloaded!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Replaced {successSummary.replaced} occurrence(s). {successSummary.collisions > 0 && `(${successSummary.collisions} had potential layout collisions).`}
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
