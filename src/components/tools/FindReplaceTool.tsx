import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { findReplaceEngine } from '../../engine/find-replace';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { TextMatchOccurrence, FindReplaceRule, RuleReport, FindReplaceFitMode } from '../../types/engine';
import {
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FindReplaceTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('find-replace');
  const { activeFile } = toolState;

  const [rules, setRules] = useState<FindReplaceRule[]>([
    { id: 'rule_1', searchQuery: '', replaceText: '', matchCase: false },
  ]);
  const [bgHex, setBgHex] = useState('#FFFFFF');
  const [fitMode, setFitMode] = useState<FindReplaceFitMode>('fit-to-space');

  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [occurrences, setOccurrences] = useState<TextMatchOccurrence[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    replaced: number;
    collisions: number;
    conflictCount?: number;
    ruleReports?: RuleReport[];
  } | null>(null);

  // Clear state when active file changes
  useEffect(() => {
    setOccurrences([]);
    setSelectedIds(new Set());
    setErrorMsg(null);
    setSuccessSummary(null);
  }, [activeFile?.id]);

  const addRule = () => {
    const newId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setRules((prev) => [...prev, { id: newId, searchQuery: '', replaceText: '', matchCase: false }]);
  };

  const removeRule = (id: string) => {
    if (rules.length <= 1) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<FindReplaceRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const hasSearchContent = rules.some((r) => r.searchQuery.trim().length > 0);

  const handleSearch = async () => {
    if (!activeFile || !hasSearchContent) {
      setOccurrences([]);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    setSuccessSummary(null);

    try {
      const activeRules = rules.filter((r) => r.searchQuery.trim().length > 0);
      const results = await findReplaceEngine.searchPdfText(activeFile.data, '', {
        rules: activeRules,
      });
      setOccurrences(results);
      // Pre-select all valid non-conflicting occurrences
      const validIds = new Set(
        results.filter((o) => o.status === 'VALID' && !o.isConflicting).map((o) => o.id)
      );
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
    const validIds = new Set(
      occurrences.filter((o) => o.status === 'VALID' && !o.isConflicting).map((o) => o.id)
    );
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
      const activeRules = rules.filter((r) => r.searchQuery.trim().length > 0);
      const result = await findReplaceEngine.replacePdfText(activeFile.data, {
        rules: activeRules,
        selectedOccurrenceIds: Array.from(selectedIds),
        backgroundColor: bgColor,
        fitMode,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_replaced.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessSummary({
        replaced: result.replacedCount,
        collisions: result.collisionCount,
        conflictCount: result.conflictCount,
        ruleReports: result.ruleReports,
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
        description="Locate words, names, or numbers across pages with multi-rule support, dual conflict detection, and visual replacement."
      />

      {activeFile && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-500" />
                Multi-Rule Search & Replace
              </h2>

              <button
                type="button"
                onClick={addRule}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Another Rule
              </button>
            </div>

            {/* Dynamic Rule List */}
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="p-4 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>Rule #{idx + 1}</span>
                    {rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors"
                        title="Remove this rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Find Text:
                      </label>
                      <input
                        type="text"
                        value={rule.searchQuery}
                        onChange={(e) => updateRule(rule.id, { searchQuery: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="e.g. Acme Corp or John Doe..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Replace With:
                      </label>
                      <input
                        type="text"
                        value={rule.replaceText}
                        onChange={(e) => updateRule(rule.id, { replaceText: e.target.value })}
                        placeholder="Leave empty to erase visually..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rule.matchCase ?? false}
                        onChange={(e) => updateRule(rule.id, { matchCase: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Match case exactly
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Options & Search Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex flex-wrap items-center gap-6">
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

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Fit Mode:</span>
                  <select
                    value={fitMode}
                    onChange={(e) => setFitMode(e.target.value as FindReplaceFitMode)}
                    className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500"
                    title="Control how text behaves when longer than available space"
                  >
                    <option value="fit-to-space">Fit to Space (Prevent Overlap)</option>
                    <option value="keep-size">Keep Original Size (May Overlap)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !hasSearchContent}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Scan Document for Matches
              </button>
            </div>

            {/* Technical Limitation Notice */}
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
                    Select All Non-Conflicting
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
                  const isConflicting = occ.isConflicting;

                  return (
                    <div
                      key={occ.id}
                      className={`pt-2 flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        isUnsupported || isConflicting
                          ? 'opacity-70 bg-slate-50 dark:bg-slate-900/40'
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

                          {isConflicting && (
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1" title={occ.conflictReason}>
                              <AlertTriangle className="w-3 h-3" /> Rule Conflict: {occ.conflictReason || 'Overlapping match'}
                            </span>
                          )}

                          {occ.collisionWarning && !isConflicting && (
                            <span
                              className={`text-[11px] font-medium flex items-center gap-1 ${
                                fitMode === 'fit-to-space'
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                              title={
                                fitMode === 'fit-to-space'
                                  ? `Auto-fitted to ${Math.round((occ.fitScale || 1) * 100)}% scale to fit available slot (${occ.availableWidth?.toFixed(1)} pt)`
                                  : `Replacement exceeds available space by +${occ.overflowAmount?.toFixed(1)} pt`
                              }
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {fitMode === 'fit-to-space'
                                ? `Auto-fitted (${Math.round((occ.fitScale || 1) * 100)}% size)`
                                : `Layout collision (+${occ.overflowAmount?.toFixed(1)} pt)`}
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

              {/* Layout Collision / Substantial Scaling Warning Callout */}
              {(() => {
                const selectedOccurrences = occurrences.filter((o) => selectedIds.has(o.id));
                const hasKeepSizeCollision = fitMode === 'keep-size' && selectedOccurrences.some((o) => o.collisionWarning);
                const maxOverflow = Math.max(0, ...selectedOccurrences.map((o) => o.overflowAmount || 0));
                const minScale = Math.min(1, ...selectedOccurrences.map((o) => o.fitScale || 1));
                const hasSubstantialScaling = fitMode === 'fit-to-space' && minScale < 0.75;

                if (hasKeepSizeCollision) {
                  return (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Layout Overflow Warning (Keep Original Size):</p>
                        <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                          One or more replacement strings are longer than the original text (+{maxOverflow.toFixed(1)} pt) and may overlap adjacent content in the document.
                          You can proceed with unscaled text, or switch to <strong>Fit to Space</strong> above to prevent collision.
                        </p>
                      </div>
                    </div>
                  );
                }

                if (hasSubstantialScaling) {
                  return (
                    <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 rounded-xl text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Substantial Scaling Notice (Fit to Space):</p>
                        <p className="mt-0.5 leading-relaxed text-sky-800 dark:text-sky-300">
                          One or more replacements require downscaling to {Math.round(minScale * 100)}% of original size to avoid overlapping adjacent content.
                          You can proceed with scaled text, or switch to <strong>Keep Original Size</strong> above to maintain full typography.
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Ready to replace <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedIds.size}</span> item(s).
                </div>

                <button
                  type="button"
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

          {/* Success summary badge with per-rule breakdown */}
          {successSummary && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5 space-y-3 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-base">Replacement Complete & Downloaded!</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Replaced {successSummary.replaced} occurrence(s) in total.
                  </p>
                </div>
              </div>

              {successSummary.ruleReports && successSummary.ruleReports.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
                  <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Per-Rule Report:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {successSummary.ruleReports.map((r, i) => (
                      <div key={r.ruleId || i} className="p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/30 flex justify-between items-center">
                        <span className="font-mono truncate max-w-[150px]">"{r.searchQuery}"</span>
                        <span className="font-medium text-emerald-800 dark:text-emerald-200">
                          {r.replacedCount} replaced {r.conflictCount > 0 && `(${r.conflictCount} conflicts)`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
