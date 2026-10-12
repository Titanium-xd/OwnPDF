import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadFile, sanitizeDownloadFilename } from '../../utils/download';
import type { ExtractTextResult } from '../../types/engine';
import {
  FileCode2,
  Copy,
  Check,
  Download,
  AlertTriangle,
  RefreshCw,
  Info,
  FileText,
} from 'lucide-react';

import confetti from 'canvas-confetti';

export const ExtractTextTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('extract-text');
  const { activeFile } = toolState;

  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractTextResult | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Automatically extract text or reset when file changes
  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      handleExtract();
    } else {
      setExtractedData(null);
      setErrorMsg(null);
    }
  }, [activeFile?.id]);

  const handleExtract = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await pdfEngine.extractText(activeFile.data, {
        pageRange: pageRange.trim() || 'all',
      });
      setExtractedData(result);
    } catch (err: any) {
      console.error('Text extraction failed:', err);
      setErrorMsg(err?.message || 'Failed to extract text from PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!extractedData?.text) return;
    try {
      await navigator.clipboard.writeText(extractedData.text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownloadTxt = async () => {
    if (!activeFile || !extractedData) return;
    try {
      const baseName = sanitizeDownloadFilename(activeFile.name, 'extracted-text').replace('.pdf', '');
      const filename = `${baseName}.txt`;
      const blob = new Blob([extractedData.text], { type: 'text/plain;charset=utf-8' });

      await downloadFile(blob, filename);
      confetti({ particleCount: 70, spread: 60 });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to download text file.');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="extract-text" label="Select PDF to Extract Text" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="flex-1 font-medium">{errorMsg}</div>
        </div>
      )}

      {activeFile && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Page Range:
              </label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="all"
                className="w-36 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleExtract}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCode2 className="w-3.5 h-3.5" />
                )}
                Extract
              </button>
            </div>

            {extractedData && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!extractedData.text || extractedData.isEmpty}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  disabled={!extractedData.text || extractedData.isEmpty}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>
              </div>
            )}
          </div>

          {/* Statistics Strip */}
          {extractedData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-500">Pages Parsed</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {extractedData.pageCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-500">Words Found</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {extractedData.wordCount.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-500">Characters</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {extractedData.characterCount.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-500">Format</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  UTF-8 Plain Text
                </div>
              </div>
            </div>
          )}

          {/* Scanned / Empty PDF Notice */}
          {extractedData?.isEmpty && (
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Info className="w-4 h-4 text-amber-600" />
                <span>No selectable digital text detected</span>
              </div>
              <p className="leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                This document may be a scanned image, photographed paperwork, or outlined artwork. Scanned documents require Optical Character Recognition (OCR), which is not part of this browser-local phase.
              </p>
            </div>
          )}

          {/* Text Preview Window */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>Extracted Text Reader</span>
              </div>
              <span>{isProcessing ? 'Reading pages...' : 'Live Stream'}</span>
            </div>

            <div className="p-4">
              {isProcessing ? (
                <div className="py-16 text-center space-y-2 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs">Extracting selectable text from PDF...</p>
                </div>
              ) : extractedData ? (
                <textarea
                  readOnly
                  value={extractedData.text}
                  rows={16}
                  className="w-full font-mono text-xs leading-relaxed bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 focus:outline-hidden resize-y select-text"
                />
              ) : (
                <div className="py-16 text-center text-xs text-slate-500">
                  Select a document to extract text.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
