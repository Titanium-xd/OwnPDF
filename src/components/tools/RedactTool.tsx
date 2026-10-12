import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { redactEngine } from '../../engine/redact-engine';
import { renderPdfPageToCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { RedactionBox } from '../../types/engine';
import {
  ShieldAlert,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Shield,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const RedactTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('redact');
  const { activeFile } = toolState;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [rasterizeAllPages, setRasterizeAllPages] = useState<boolean>(false);
  const [sanitizeMetadata, setSanitizeMetadata] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [canvasScale, setCanvasScale] = useState<{ scaleX: number; scaleY: number }>({
    scaleX: 1,
    scaleY: 1,
  });

  const totalPages = activeFile?.pageCount || 1;

  // Render current page to canvas preview
  useEffect(() => {
    if (!activeFile || activeFile.pageCount === 0) return;
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderPdfPageToCanvas(activeFile.data, currentPage, canvas, { maxDimension: 600 })
      .then((dims) => {
        if (!isCancelled) {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setCanvasScale({
              scaleX: dims.width / rect.width,
              scaleY: dims.height / rect.height,
            });
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) console.error('Canvas render error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.id, currentPage]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentPos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) {
      setIsDrawing(false);
      return;
    }

    const minX = Math.min(startPos.x, currentPos.x);
    const minY = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w > 5 && h > 5) {
      const newBox: RedactionBox = {
        id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pageIndex: currentPage - 1,
        pageNumber: currentPage,
        x: Math.round(minX * canvasScale.scaleX),
        y: Math.round(minY * canvasScale.scaleY),
        width: Math.round(w * canvasScale.scaleX),
        height: Math.round(h * canvasScale.scaleY),
        coordinateSpace: 'viewport',
      };
      setBoxes((prev) => [...prev, newBox]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  const removeBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  const handleRedactAndDownload = async () => {
    if (!activeFile || boxes.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await redactEngine.redactPdf(activeFile.data, {
        boxes,
        rasterizeAllPages,
        sanitizeMetadata,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_redacted.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessMsg(
        `Permanent redaction complete! Sanitized ${result.redactedPagesCount} page(s) and burned ${result.redactionBoxesCount} box(es).`
      );
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Redaction failed:', err);
      setErrorMsg(err?.message || 'Failed to redact PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBoxes = boxes.filter((b) => b.pageNumber === currentPage);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="redact"
        description="Permanently black out sensitive text, numbers, and graphics by rebuilding affected pages from sanitized raster images."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Permanent Client-Side Redaction
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click and drag on the preview canvas to draw solid black redaction areas.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRedactAndDownload}
              disabled={isProcessing || boxes.length === 0}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Burning Redactions...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Redact & Download PDF ({boxes.length})
                </>
              )}
            </button>
          </div>

          {/* Interactive Canvas & Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Canvas Preview */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Draw boxes directly over sensitive areas:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="relative border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center min-h-[380px]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="max-w-full max-h-[500px] object-contain cursor-crosshair select-none"
                />

                {/* Render overlay for boxes on this page */}
                {currentBoxes.map((b) => {
                  const canvas = canvasRef.current;
                  if (!canvas) return null;
                  const left = (b.x / canvasScale.scaleX);
                  const top = (b.y / canvasScale.scaleY);
                  const width = (b.width / canvasScale.scaleX);
                  const height = (b.height / canvasScale.scaleY);

                  return (
                    <div
                      key={b.id}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                      }}
                      className="bg-black/90 border border-rose-500 pointer-events-none flex items-center justify-center text-[10px] text-white font-mono"
                    >
                      REDACTED
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Box List & Security Options */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Security Options
                </h3>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={sanitizeMetadata}
                    onChange={(e) => setSanitizeMetadata(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Purge metadata & attachments (Recommended)</span>
                </label>

                {!sanitizeMetadata && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                    <strong>Caution:</strong> Disabling this preserves document properties, author names, and embedded attachments which may contain confidential data.
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rasterizeAllPages}
                    onChange={(e) => setRasterizeAllPages(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Rasterize all document pages</span>
                </label>
              </div>

              {/* Redaction Boxes List */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Redaction Boxes ({boxes.length})
                  </span>
                  {boxes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBoxes([])}
                      className="text-rose-500 hover:text-rose-700 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {boxes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    No redaction boxes drawn yet. Click and drag over the page preview.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                    {boxes.map((b, i) => (
                      <div key={b.id} className="pt-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          #{i + 1} Page {b.pageNumber} ({b.width}x{b.height} pt)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBox(b.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tested Threat Model Callout */}
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 flex gap-3 text-xs text-rose-900 dark:text-rose-200">
            <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Tested Threat Model & Verification:</p>
              <p className="text-rose-800 dark:text-rose-300 leading-relaxed">
                Affected pages are rebuilt exclusively from sanitized raster images with solid black burned directly into pixel memory. Original content streams, font descriptors, and annotations are permanently purged. Tested against text extraction, structural tree inspection, and attachment parsing.
              </p>
            </div>
          </div>

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
