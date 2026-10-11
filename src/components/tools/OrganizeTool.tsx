import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  RotateCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Grid,
  Undo2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PageItem {
  id: string;
  originalIndex: number; // 0-based
  pageNumber: number; // 1-based original
  rotationDelta: number; // 0, 90, 180, 270
}

export const OrganizeTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('organize');
  const { activeFile } = toolState;

  const [pages, setPages] = useState<PageItem[]>([]);
  const [deletedPages, setDeletedPages] = useState<PageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportedResult, setExportedResult] = useState<{
    data: Uint8Array;
    size: number;
    pageCount: number;
    downloadFilename: string;
  } | null>(null);

  // Initialize page items when activeFile changes
  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      const initial: PageItem[] = Array.from({ length: activeFile.pageCount }, (_, i) => ({
        id: `p_${i}_${Date.now()}`,
        originalIndex: i,
        pageNumber: i + 1,
        rotationDelta: 0,
      }));
      setPages(initial);
      setDeletedPages([]);
      setExportedResult(null);
    } else {
      setPages([]);
      setDeletedPages([]);
      setExportedResult(null);
    }
  }, [activeFile?.id, activeFile?.pageCount]);

  const handleRotate = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rotationDelta: (copy[index].rotationDelta + 90) % 360,
      };
      return copy;
    });
  };

  const handleDelete = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      setDeletedPages((del) => [...del, removed]);
      return copy;
    });
  };

  const handleRestore = (item: PageItem) => {
    setDeletedPages((prev) => prev.filter((p) => p.id !== item.id));
    setPages((prev) => [...prev, item]);
  };

  const handleMove = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleExport = async () => {
    if (!activeFile || pages.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const pageOrderIndices = pages.map((p) => p.originalIndex);
      const rotationsMap = new Map<number, number>();
      pages.forEach((p) => {
        if (p.rotationDelta) {
          rotationsMap.set(p.originalIndex, p.rotationDelta);
        }
      });

      const organizedBytes = await pdfEngine.organizePages(
        activeFile.data,
        pageOrderIndices,
        rotationsMap
      );

      // Validate header
      if (!PdfEngine.isValidPdfHeader(organizedBytes)) {
        throw new Error('Exported document lacks valid %PDF- header signature.');
      }

      const info = await pdfEngine.inspectPdf(organizedBytes);
      const downloadFilename = sanitizeDownloadFilename(activeFile.name, 'organized');

      setExportedResult({
        data: organizedBytes,
        size: organizedBytes.byteLength,
        pageCount: info.pageCount,
        downloadFilename,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Export failed.');
      setExportedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!exportedResult) return;
    try {
      await downloadPdf(exportedResult.data, exportedResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector
        toolId="organize"
        accept=".pdf"
        multiple={false}
        label="Organize Pages Document Selection"
      />

      {activeFile && (
        <div className="space-y-6">
          {/* Top Controls Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Grid className="w-4 h-4 text-sky-500" />
                <span>Visual Page Organizer ({pages.length} Pages Active)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rotate by 90°, delete unwanted pages, or reorder sequence before exporting.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {deletedPages.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                  <span>{deletedPages.length} removed</span>
                  <button
                    onClick={() => handleRestore(deletedPages[deletedPages.length - 1])}
                    className="font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" />
                    Undo
                  </button>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={isProcessing || pages.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Reorganized PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {exportedResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                  Ready! Exported {exportedResult.pageCount} pages ({Math.round(exportedResult.size / 1024)} KB) as <span className="font-mono font-semibold">{exportedResult.downloadFilename}</span>.
                </span>
              </div>
              <button
                onClick={handleDownload}
                className="py-1.5 px-3.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          )}

          {/* Interactive Page Thumbnail Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((item, index) => (
              <PageThumbnailCard
                key={item.id}
                fileData={activeFile.data}
                item={item}
                index={index}
                isFirst={index === 0}
                isLast={index === pages.length - 1}
                onRotate={() => handleRotate(index)}
                onDelete={() => handleDelete(index)}
                onMoveLeft={() => handleMove(index, 'left')}
                onMoveRight={() => handleMove(index, 'right')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PageThumbnailCard: React.FC<{
  fileData: Uint8Array;
  item: PageItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRotate: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}> = ({
  fileData,
  item,
  index,
  isFirst,
  isLast,
  onRotate,
  onDelete,
  onMoveLeft,
  onMoveRight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let active = true;
    if (canvasRef.current) {
      renderPdfPageToCanvas(fileData, item.pageNumber, canvasRef.current, { maxDimension: 180 })
        .then(() => {
          if (active) setIsRendered(true);
        })
        .catch((err) => {
          console.error(`Page ${item.pageNumber} render failed:`, err);
        });
    }

    return () => {
      active = false;
      clearCanvas(canvasRef.current);
    };
  }, [fileData, item.pageNumber]);

  return (
    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 group hover:border-sky-400 transition flex flex-col justify-between">
      {/* Canvas Wrapper with Rotation Transform */}
      <div className="aspect-3/4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center overflow-hidden p-2 relative">
        <canvas
          ref={canvasRef}
          style={{
            transform: `rotate(${item.rotationDelta}deg)`,
            transition: 'transform 0.2s ease-in-out',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          className="rounded shadow-xs"
        />

        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">
            Rendering...
          </div>
        )}

        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-mono text-[10px] font-bold backdrop-blur-xs">
          Page {index + 1}
        </span>
      </div>

      {/* Control Actions */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveLeft}
            disabled={isFirst}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
            title="Move left"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveRight}
            disabled={isLast}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
            title="Move right"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onRotate}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 cursor-pointer"
            title="Rotate 90° clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
            title="Delete page"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
