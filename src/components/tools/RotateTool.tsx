import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  RotateCw,
  RotateCcw,
  AlertTriangle,
  Download,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import confetti from 'canvas-confetti';


interface PageRotateItem {
  pageIndex: number; // 0-based
  pageNumber: number; // 1-based
  rotationDelta: number; // 0, 90, 180, 270
  selected: boolean;
}

export const RotateTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('rotate');
  const { activeFile } = toolState;

  const [pages, setPages] = useState<PageRotateItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportedPdf, setExportedPdf] = useState<{
    data: Uint8Array;
    filename: string;
    size: number;
  } | null>(null);

  // Initialize page list when active file changes
  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      const initial: PageRotateItem[] = Array.from({ length: activeFile.pageCount }, (_, i) => ({
        pageIndex: i,
        pageNumber: i + 1,
        rotationDelta: 0,
        selected: true,
      }));
      setPages(initial);
      setErrorMsg(null);
      setExportedPdf(null);
    } else {
      setPages([]);
      setErrorMsg(null);
      setExportedPdf(null);
    }
  }, [activeFile?.id, activeFile?.pageCount]);

  const handleRotatePage = (index: number, delta: number = 90) => {
    setPages((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rotationDelta: (copy[index].rotationDelta + delta) % 360,
      };
      return copy;
    });
    setExportedPdf(null);
  };

  const handleRotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotationDelta: (p.rotationDelta + delta) % 360,
      }))
    );
    setExportedPdf(null);
  };

  const handleRotateSelected = (delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.selected
          ? { ...p, rotationDelta: (p.rotationDelta + delta) % 360 }
          : p
      )
    );
    setExportedPdf(null);
  };

  const handleToggleSelect = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const handleSelectAll = (select: boolean) => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  const handleReset = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotationDelta: 0, selected: true })));
    setExportedPdf(null);
  };

  const handleApplyRotation = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const perPageRotations = new Map<number, number>();
      for (const p of pages) {
        if (p.rotationDelta !== 0) {
          perPageRotations.set(p.pageIndex, p.rotationDelta);
        }
      }

      if (perPageRotations.size === 0) {
        setErrorMsg('No pages have been rotated. Please rotate at least one page before applying.');
        setIsProcessing(false);
        return;
      }

      const rotatedBytes = await pdfEngine.rotatePdf(activeFile.data, {
        rotationAngle: 90,
        perPageRotations,
      });

      const filename = sanitizeDownloadFilename(activeFile.name, 'rotated');
      setExportedPdf({
        data: rotatedBytes,
        filename,
        size: rotatedBytes.byteLength,
      });
      confetti({ particleCount: 50, spread: 60 });
    } catch (err: any) {
      console.error('Rotation failed:', err);
      setErrorMsg(err?.message || 'Failed to apply rotation.');
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
      setErrorMsg(err?.message || 'Failed to download rotated PDF.');
    }
  };

  const hasRotations = pages.some((p) => p.rotationDelta !== 0);
  const selectedCount = pages.filter((p) => p.selected).length;

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="rotate" label="Select PDF to Rotate" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="flex-1 font-medium">{errorMsg}</div>
        </div>
      )}

      {activeFile && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Action Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
                Rotate All:
              </span>
              <button
                type="button"
                onClick={() => handleRotateAll(90)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-500" />
                +90° Clockwise
              </button>
              <button
                type="button"
                onClick={() => handleRotateAll(180)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                180° Flip
              </button>
              <button
                type="button"
                onClick={() => handleRotateAll(270)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                +270° (90° CCW)
              </button>
              {selectedCount > 0 && selectedCount < pages.length && (
                <button
                  type="button"
                  onClick={() => handleRotateSelected(90)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate Selected ({selectedCount})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasRotations && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSelectAll(selectedCount !== pages.length)}
                className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline px-2 py-1"
              >
                {selectedCount === pages.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>


          {/* Thumbnail Gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pages.map((p, idx) => (
              <ThumbnailCard
                key={p.pageNumber}
                page={p}
                activeFileBytes={activeFile.data}
                onRotate={() => handleRotatePage(idx, 90)}
                onToggleSelect={() => handleToggleSelect(idx)}
              />
            ))}
          </div>

          {/* Process & Export Bottom Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {pages.length} total pages
              </span>
              {' • '}
              {hasRotations ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {pages.filter((p) => p.rotationDelta !== 0).length} page(s) scheduled to rotate
                </span>
              ) : (
                'No pages rotated yet'
              )}
            </div>

            <div className="flex items-center gap-3">
              {exportedPdf ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  Download Rotated PDF ({(exportedPdf.size / 1024).toFixed(1)} KB)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyRotation}
                  disabled={isProcessing || !hasRotations}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Applying Rotation...
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-4 h-4" />
                      Rotate & Save PDF
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

interface ThumbnailCardProps {
  page: PageRotateItem;
  activeFileBytes: Uint8Array;
  onRotate: () => void;
  onToggleSelect: () => void;
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  page,
  activeFileBytes,
  onRotate,
  onToggleSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderPdfPageToCanvas(activeFileBytes, page.pageNumber, canvas, { maxDimension: 220 })
      .catch((err) => {
        console.warn(`Thumbnail render error on page ${page.pageNumber}:`, err);
      });

    return () => {
      clearCanvas(canvas);
    };
  }, [page.pageNumber, activeFileBytes]);

  return (

    <div
      className={`group relative flex flex-col items-center p-3 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs ${
        page.selected
          ? 'border-indigo-500/50 dark:border-indigo-500/50 ring-1 ring-indigo-500/20'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Page number badge & Checkbox */}
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
          Page {page.pageNumber}
        </span>
        {page.rotationDelta !== 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            +{page.rotationDelta}°
          </span>
        )}
      </div>

      {/* Canvas preview container with rotation transform */}
      <div
        onClick={onToggleSelect}
        className="w-full aspect-3/4 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center overflow-hidden cursor-pointer p-1"
      >
        <canvas
          ref={canvasRef}
          style={{
            transform: `rotate(${page.rotationDelta}deg)`,
            transition: 'transform 0.2s ease-in-out',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          className="shadow-xs rounded-xs"
        />
      </div>

      {/* Per-Page Rotation Button */}
      <div className="w-full mt-2 flex items-center justify-center">
        <button
          type="button"
          onClick={onRotate}
          title="Rotate page 90° clockwise"
          className="w-full py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1 transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Rotate 90°</span>
        </button>
      </div>
    </div>
  );
};
