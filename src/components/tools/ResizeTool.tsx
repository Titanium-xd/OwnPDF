import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { StandardPageSize, ResizeMode } from '../../types/engine';
import {
  Scaling,
  Maximize2,
  Crop,
  Layers,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ResizeTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('resize');
  const { activeFile } = toolState;

  const [targetSize, setTargetSize] = useState<StandardPageSize>('A4');
  const [mode, setMode] = useState<ResizeMode>('fit');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'keep'>('keep');
  const [margin, setMargin] = useState<number>(0);
  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  const handleResizeAndDownload = async () => {
    if (!activeFile) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setHasCompleted(false);

    try {
      const resizedBytes = await pdfEngine.resizePdf(activeFile.data, {
        targetSize,
        mode,
        orientation,
        margin,
        pageRange: pageRange.trim() === 'all' ? undefined : pageRange,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_${targetSize.toLowerCase()}.pdf`);
      await downloadPdf(resizedBytes, filename);

      setHasCompleted(true);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Resize PDF failed:', err);
      setErrorMsg(err?.message || 'Failed to resize PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="resize"
        description="Change page dimensions to standard sizes (A4, Letter, A3, Legal) with proportional scaling, fill & crop, or canvas padding."
      />

      {activeFile && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Scaling className="w-5 h-5 text-indigo-500" />
              Resize Configuration
            </h2>

            {/* Target Size & Orientation Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Paper Size:
                </label>
                <select
                  value={targetSize}
                  onChange={(e) => setTargetSize(e.target.value as StandardPageSize)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="A4">A4 (210 × 297 mm / 595 × 842 pt)</option>
                  <option value="LETTER">US Letter (8.5 × 11 in / 612 × 792 pt)</option>
                  <option value="A3">A3 (297 × 420 mm / 842 × 1191 pt)</option>
                  <option value="A5">A5 (148 × 210 mm / 420 × 595 pt)</option>
                  <option value="LEGAL">US Legal (8.5 × 14 in / 612 × 1008 pt)</option>
                  <option value="TABLOID">US Tabloid (11 × 17 in / 792 × 1224 pt)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Orientation:
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="keep">Auto (Match Original Orientation)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            {/* Scaling Mode Cards */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Scaling Strategy:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('fit')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'fit'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Maximize2 className={`w-4 h-4 ${mode === 'fit' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {mode === 'fit' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 mb-1">
                    Fit Page (Proportional)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Scales content proportionally with margins; adds letterbox padding if proportions differ.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('fill-crop')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'fill-crop'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Crop className={`w-4 h-4 ${mode === 'fill-crop' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {mode === 'fill-crop' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 mb-1">
                    Fill & Bleed / Crop
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Scales content to completely cover the new page dimensions, trimming any outer overflow.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('canvas')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'canvas'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Layers className={`w-4 h-4 ${mode === 'canvas' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {mode === 'canvas' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 mb-1">
                    Canvas Padding (100%)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Keeps 100% vector scale without zooming, centering the page on the new canvas size.
                  </p>
                </button>
              </div>
            </div>

            {/* Margins & Page Range Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Page Margins (Padding):
                </label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value={0}>None (0 pt / Full Bleed)</option>
                  <option value={14}>Narrow (14 pt / ~5 mm)</option>
                  <option value={28}>Normal (28 pt / ~10 mm)</option>
                  <option value={42}>Wide (42 pt / ~15 mm)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Apply to Pages:
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder="e.g. all or 1-3, 5"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Geometry Info Callout */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Geometry & Vector Precision:
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Embeds vector pages with true mathematical precision, handling internal rotations (90°, 180°, 270°) and preserving document metadata.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleResizeAndDownload}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resizing Document...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Resize PDF & Download
                  </>
                )}
              </button>
            </div>
          </div>

          {hasCompleted && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Resize Complete & Downloaded!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Pages have been transformed to {targetSize} format and downloaded.
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
