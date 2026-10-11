import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import type { PdfDocumentMetadata } from '../../types/engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  FileSearch,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const InspectTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('inspect');
  const { activeFile } = toolState;

  const [metadata, setMetadata] = useState<PdfDocumentMetadata | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sanitizedResult, setSanitizedResult] = useState<{
    data: Uint8Array;
    size: number;
    downloadFilename: string;
  } | null>(null);

  useEffect(() => {
    if (activeFile) {
      setSanitizedResult(null);
      setErrorMsg(null);
      pdfEngine
        .inspectPdf(activeFile.data)
        .then((meta) => setMetadata(meta))
        .catch((err) => setErrorMsg(err.message));
    } else {
      setMetadata(null);
      setSanitizedResult(null);
      setErrorMsg(null);
    }
  }, [activeFile?.id]);

  const handleSanitize = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const cleanBytes = await pdfEngine.sanitizeMetadata(activeFile.data);

      if (!PdfEngine.isValidPdfHeader(cleanBytes)) {
        throw new Error('Sanitized PDF lacks valid %PDF- header signature.');
      }

      const downloadFilename = sanitizeDownloadFilename(activeFile.name, 'sanitized');

      setSanitizedResult({
        data: cleanBytes,
        size: cleanBytes.byteLength,
        downloadFilename,
      });

      // Update local inspection
      const updated = await pdfEngine.inspectPdf(cleanBytes);
      setMetadata(updated);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Sanitization failed.');
      setSanitizedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!sanitizedResult) return;
    try {
      await downloadPdf(sanitizedResult.data, sanitizedResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector
        toolId="inspect"
        accept=".pdf"
        multiple={false}
        label="Inspect & Sanitize Document Selection"
      />

      {activeFile && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Metadata Display */}
          <div className="md:col-span-8 space-y-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-sky-500" />
                  <span>Document Structure & Metadata</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {Math.round(activeFile.size / 1024)} KB
                </span>
              </div>

              {metadata ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Title</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.title || 'None (Clean)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Author</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.author || 'None (Clean)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Creator Application</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.creator || 'None (Clean)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">PDF Producer Engine</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.producer || 'None (Clean)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Creation Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.creationDate ? metadata.creationDate.toLocaleDateString() : 'None'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Modification Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.modificationDate ? metadata.modificationDate.toLocaleDateString() : 'None'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">Loading metadata...</div>
              )}
            </div>
          </div>

          {/* Right Action Column */}
          <div className="md:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Privacy Sanitization</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Strips author names, company names, creation timestamps, and software signatures to protect your identity when sharing documents publicly.
              </p>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {sanitizedResult ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Metadata Sanitized Successfully!</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate">
                    Output: {sanitizedResult.downloadFilename}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Sanitized PDF</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSanitize}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sanitizing Metadata...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Strip Sensitive Metadata</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
