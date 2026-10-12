import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import type { CropMargins } from '../../types/engine';
import {
  Crop,
  Download,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Info,
  CheckCircle2,
} from 'lucide-react';

import confetti from 'canvas-confetti';

export const CropTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('crop');
  const { activeFile } = toolState;

  const [margins, setMargins] = useState<CropMargins>({
    top: 36, // 0.5 inch default (36 pt)
    bottom: 36,
    left: 36,
    right: 36,
  });

  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [exportedPdf, setExportedPdf] = useState<{
    data: Uint8Array;
    filename: string;
    size: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewDims, setPreviewDims] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Render first page preview
  useEffect(() => {
    if (!activeFile || activeFile.pageCount === 0) return;
    let isCancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    renderPdfPageToCanvas(activeFile.data, 1, canvas, { maxDimension: 340 })
      .then((dims) => {
        if (!isCancelled) {
          setPreviewDims(dims);
        }
      })
      .catch((err) => console.warn('Preview render failed:', err));

    return () => {
      isCancelled = true;
      clearCanvas(canvas);
    };
  }, [activeFile?.id]);

  const handleMarginChange = (side: keyof CropMargins, val: number) => {
    setMargins((prev) => ({
      ...prev,
      [side]: Math.max(0, val),
    }));
    setExportedPdf(null);
  };

  const applyPreset = (top: number, right: number, bottom: number, left: number) => {
    setMargins({ top, right, bottom, left });
    setExportedPdf(null);
  };

  const handleApplyCrop = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const outputBytes = await pdfEngine.cropPdf(activeFile.data, {
        margins,
        isPercentage: false,
        pageRange: pageRange.trim() || 'all',
      });

      const filename = sanitizeDownloadFilename(activeFile.name, 'cropped');
      setExportedPdf({
        data: outputBytes,
        filename,
        size: outputBytes.byteLength,
      });
      confetti({ particleCount: 50, spread: 60 });
    } catch (err: any) {
      console.error('Crop failed:', err);
      setErrorMsg(err?.message || 'Failed to crop PDF document.');
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
      setErrorMsg(err?.message || 'Failed to download cropped PDF.');
    }
  };

  // Calculate percentage of preview width/height covered by margins
  const topPct = Math.min(45, (margins.top / previewDims.height) * 100);
  const bottomPct = Math.min(45, (margins.bottom / previewDims.height) * 100);
  const leftPct = Math.min(45, (margins.left / previewDims.width) * 100);
  const rightPct = Math.min(45, (margins.right / previewDims.width) * 100);

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="crop" label="Select PDF to Crop & Trim Margins" />

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
            {/* Presets */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Crop Presets
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(18, 18, 18, 18)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 text-center transition"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Small (0.25&quot;)</div>
                  <div className="text-[10px] text-slate-500">18 pt margins</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(36, 36, 36, 36)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 text-center transition"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Medium (0.5&quot;)</div>
                  <div className="text-[10px] text-slate-500">36 pt margins</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(72, 72, 72, 72)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 text-center transition"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Large (1.0&quot;)</div>
                  <div className="text-[10px] text-slate-500">72 pt margins</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(0, 0, 0, 0)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 text-center transition"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Reset</div>
                  <div className="text-[10px] text-slate-500">0 pt margins</div>
                </button>
              </div>
            </div>

            {/* Margin Inputs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Custom Margins (Points)
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Top Margin
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={margins.top}
                      onChange={(e) => handleMarginChange('top', parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500">pt</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bottom Margin
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={margins.bottom}
                      onChange={(e) => handleMarginChange('bottom', parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500">pt</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Left Margin
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={margins.left}
                      onChange={(e) => handleMarginChange('left', parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500">pt</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Right Margin
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={margins.right}
                      onChange={(e) => handleMarginChange('right', parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500">pt</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Pages
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => {
                    setPageRange(e.target.value);
                    setExportedPdf(null);
                  }}
                  placeholder="all (or e.g. 1-3, 5)"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Privacy & Technical Notice */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
              <Info className="w-4 h-4 shrink-0 text-orange-500 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-slate-900 dark:text-slate-200">Viewport Notice:</strong> Cropping adjusts the visible PDF CropBox boundary. It restricts what PDF viewers display but does not permanently erase or redact hidden text vectors outside the cropped area.
              </div>
            </div>
          </div>

          {/* Preview & Action Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Crop Boundary Preview
                </h3>
                <span className="text-[11px] font-medium text-slate-500">Page 1 Simulation</span>
              </div>

              <div className="relative aspect-3/4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-800/60 p-2">
                <canvas ref={previewCanvasRef} className="max-h-full max-w-full object-contain rounded-xs shadow-xs" />

                {/* Shaded visual crop overlay showing trimmed area */}
                <div
                  style={{
                    top: `${topPct}%`,
                    bottom: `${bottomPct}%`,
                    left: `${leftPct}%`,
                    right: `${rightPct}%`,
                  }}
                  className="absolute border-2 border-dashed border-orange-500 bg-orange-500/10 pointer-events-none transition-all rounded-xs"
                />
              </div>
            </div>

            {/* Action Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              {exportedPdf ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>PDF cropped successfully!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Cropped PDF ({(exportedPdf.size / 1024).toFixed(1)} KB)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Cropping PDF...
                    </>
                  ) : (
                    <>
                      <Crop className="w-4 h-4" />
                      Crop PDF & Save
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
