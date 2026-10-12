import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { extractLinksEngine } from '../../engine/extract-links';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadFile, sanitizeDownloadFilename } from '../../utils/download';
import type { ExtractLinksResult } from '../../types/engine';
import {
  Link as LinkIcon,
  ExternalLink,
  Bookmark,
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Info,
  Search,
} from 'lucide-react';

export const ExtractLinksTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('extract-links');
  const { activeFile } = toolState;

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractLinksResult | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      handleExtract();
    } else {
      setExtractResult(null);
      setErrorMsg(null);
    }
  }, [activeFile?.id]);

  const handleExtract = async () => {
    if (!activeFile) return;

    setIsExtracting(true);
    setErrorMsg(null);

    try {
      const result = await extractLinksEngine.extractPdfLinks(activeFile.data);
      setExtractResult(result);
    } catch (err: any) {
      console.error('Link extraction failed:', err);
      setErrorMsg(err?.message || 'Failed to extract links from PDF.');
    } finally {
      setIsExtracting(false);
    }
  };

  const filteredLinks = (extractResult?.links || []).filter((l) => {
    const matchesType = filterType === 'all' || l.type === filterType;
    const matchesSearch =
      searchFilter.trim() === '' ||
      l.url.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.text.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportCsv = async () => {
    if (!activeFile || !extractResult) return;
    const csvStr = extractLinksEngine.exportToCsv(extractResult.links);
    const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
    const filename = sanitizeDownloadFilename(`${baseName}_links.csv`);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    await downloadFile(blob, filename);
  };

  const handleExportJson = async () => {
    if (!activeFile || !extractResult) return;
    const jsonStr = extractLinksEngine.exportToJson(extractResult.links);
    const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
    const filename = sanitizeDownloadFilename(`${baseName}_links.json`);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    await downloadFile(blob, filename);
  };

  const handleExportTxt = async () => {
    if (!activeFile || !extractResult) return;
    const txtStr = extractLinksEngine.exportToTxt(extractResult.links);
    const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
    const filename = sanitizeDownloadFilename(`${baseName}_links.txt`);
    const blob = new Blob([txtStr], { type: 'text/plain' });
    await downloadFile(blob, filename);
  };

  const handleCopyAll = async () => {
    if (!extractResult) return;
    const txt = extractResult.links.map((l) => `${l.url} (Page ${l.pageNumber})`).join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // clipboard access error
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="extract-links"
        description="Discover and export all clickable hyperlink annotations, internal page destinations, and plaintext URLs."
      />

      {activeFile && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-500" />
                  Links Discovery & Export
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isExtracting
                    ? 'Scanning PDF annotations and text streams...'
                    : extractResult
                    ? `Found ${extractResult.totalCount} total links (${extractResult.uniqueCount} unique destinations)`
                    : 'Ready'}
                </p>
              </div>

              {extractResult && extractResult.totalCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopyAll}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopied ? 'Copied' : 'Copy All'}
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>

                  <button
                    onClick={handleExportJson}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    JSON
                  </button>

                  <button
                    onClick={handleExportTxt}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    TXT
                  </button>
                </div>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All Links' },
                  { id: 'external', label: 'External Only' },
                  { id: 'internal', label: 'Internal Pages' },
                  { id: 'text-url', label: 'Printed URLs' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      filterType === tab.id
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter links..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Loading Indicator */}
            {isExtracting && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Scanning link annotations...
                </p>
              </div>
            )}

            {/* Links Table */}
            {!isExtracting && filteredLinks.length > 0 && (
              <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 w-16">Page</th>
                      <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 w-28">Type</th>
                      <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Destination</th>
                      <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 w-20 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                    {filteredLinks.map((link) => (
                      <tr key={link.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-sans font-medium">
                          p.{link.pageNumber}
                        </td>
                        <td className="p-3 font-sans">
                          {link.type === 'external' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              <ExternalLink className="w-3 h-3" /> External
                            </span>
                          )}
                          {link.type === 'internal' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                              <Bookmark className="w-3 h-3" /> Internal
                            </span>
                          )}
                          {link.type === 'text-url' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                              <FileText className="w-3 h-3" /> Text URL
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-900 dark:text-slate-100 break-all">
                          <div>{link.url}</div>
                          {link.text && link.text !== link.url && (
                            <div className="text-[11px] text-slate-400 font-sans mt-0.5">{link.text}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-sans">
                          {link.url.startsWith('http') && (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[11px] transition-colors"
                            >
                              Visit <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isExtracting && filteredLinks.length === 0 && extractResult && (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                No matching links found.
              </div>
            )}

            {/* Quality Callout */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Comprehensive Categorization:
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Scans both internal interactive PDF annotation dictionaries (/Subtype /Link) and visible text content. Deduplicates links across pages and provides 1-click structured exports.
                </p>
              </div>
            </div>
          </div>

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
