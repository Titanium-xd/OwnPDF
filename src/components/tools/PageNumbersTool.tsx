import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import type { PageNumberPosition, PageNumberFormat } from '../../types/engine';
import {
  Hash,
  Download,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Layout,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const POSITIONS: Array<{ id: PageNumberPosition; label: string; row: number; col: number }> = [
  { id: 'top-left', label: 'Top Left', row: 0, col: 0 },
  { id: 'top-center', label: 'Top Center', row: 0, col: 1 },
  { id: 'top-right', label: 'Top Right', row: 0, col: 2 },
  { id: 'bottom-left', label: 'Bottom Left', row: 1, col: 0 },
  { id: 'bottom-center', label: 'Bottom Center', row: 1, col: 1 },
  { id: 'bottom-right', label: 'Bottom Right', row: 1, col: 2 },
];

export const PageNumbersTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('page-numbers');
  const { activeFile } = toolState;

  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [format, setFormat] = useState<PageNumberFormat>('PAGE_N_OF_TOTAL');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(10);
  const [margin, setMargin] = useState<number>(30);
  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [exportedPdf, setExportedPdf] = useState<{
    data: Uint8Array;
    filename: string;
    size: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render first page preview
  useEffect(() => {
    if (!activeFile || activeFile.pageCount === 0) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    renderPdfPageToCanvas(activeFile.data, 1, canvas, { maxDimension: 340 })
      .catch((err) => console.warn('Preview render failed:', err));

    return () => {
      clearCanvas(canvas);
    };
  }, [activeFile?.id]);


  const handleApply = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const outputBytes = await pdfEngine.addPageNumbers(activeFile.data, {
        position,
        format,
        startNumber,
        fontSize,
        margin,
        pageRange: pageRange.trim() || 'all',
      });

      const filename = sanitizeDownloadFilename(activeFile.name, 'numbered');
      setExportedPdf({
        data: outputBytes,
        filename,
        size: outputBytes.byteLength,
      });
      confetti({ particleCount: 50, spread: 60 });
    } catch (err: any) {
      console.error('Page numbering failed:', err);
      setErrorMsg(err?.message || 'Failed to stamp page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!exportedPdf) return;
    try {
      await downloadPdf(exportedPdf.data, exportedPdf.filename);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to download numbered PDF.');
    }
  };

  const sampleLabel = () => {
    const total = activeFile?.pageCount || 10;
    if (format === 'NUMBER_ONLY') return `${startNumber}`;
    if (format === 'PAGE_N') return `Page ${startNumber}`;
    if (format === 'PAGE_N_OF_TOTAL') return `Page ${startNumber} of ${total}`;
    if (format === 'N_OF_TOTAL') return `${startNumber} / ${total}`;
    return `${startNumber}`;
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="page-numbers" label="Select PDF to Add Page Numbers" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="flex-1 font-medium">{errorMsg}</div>
        </div>
      )}

      {activeFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* Position Matrix */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Stamp Position
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => {
                      setPosition(pos.id);
                      setExportedPdf(null);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition text-center ${
                      position === pos.id
                        ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-500 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format & Starting Number */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Numbering Format & Range
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Format Style
                  </label>
                  <select
                    value={format}
                    onChange={(e) => {
                      setFormat(e.target.value as PageNumberFormat);
                      setExportedPdf(null);
                    }}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="PAGE_N_OF_TOTAL">Page N of Total (e.g. Page 1 of 10)</option>
                    <option value="N_OF_TOTAL">N / Total (e.g. 1 / 10)</option>
                    <option value="PAGE_N">Page N (e.g. Page 1)</option>
                    <option value="NUMBER_ONLY">Number Only (e.g. 1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Counting At
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => {
                      setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1));
                      setExportedPdf(null);
                    }}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Pages (e.g. &quot;all&quot;, &quot;1-5&quot;, or &quot;2-10&quot;)
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => {
                    setPageRange(e.target.value);
                    setExportedPdf(null);
                  }}
                  placeholder="all"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Typography & Margins */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Size & Margin Tuning
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <span>Font Size</span>
                    <span>{fontSize} pt</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    step={1}
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(parseInt(e.target.value, 10));
                      setExportedPdf(null);
                    }}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <span>Edge Margin</span>
                    <span>{margin} pt</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={60}
                    step={5}
                    value={margin}
                    onChange={(e) => {
                      setMargin(parseInt(e.target.value, 10));
                      setExportedPdf(null);
                    }}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview & Action Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Placement Preview
                </h3>
                <span className="text-[11px] font-medium text-slate-500">Page 1 Sample</span>
              </div>

              <div className="relative aspect-3/4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-800/60 p-2">
                <canvas ref={previewCanvasRef} className="max-h-full max-w-full object-contain rounded-xs shadow-xs" />

                {/* Visual Overlay of the stamped number */}
                <div
                  className={`absolute px-2 py-0.5 rounded text-[11px] font-bold bg-violet-600/90 text-white shadow-md pointer-events-none transition-all ${
                    position.includes('top') ? 'top-4' : 'bottom-4'
                  } ${
                    position.includes('left')
                      ? 'left-4'
                      : position.includes('right')
                      ? 'right-4'
                      : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  {sampleLabel()}
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              {exportedPdf ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Page numbers successfully added!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Numbered PDF ({(exportedPdf.size / 1024).toFixed(1)} KB)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Numbering PDF...
                    </>
                  ) : (
                    <>
                      <Hash className="w-4 h-4" />
                      Add Page Numbers & Save
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
