import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '../../context/SessionContext';
import { redactEngine } from '../../engine/redact-engine';
import {
  renderPdfPageToCanvas,
  PdfDocumentSession,
} from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { RedactionBox, RedactionShapeType, RedactionMode } from '../../types/engine';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ShieldAlert,
  Download,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Square,
  Circle,
  Type,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HandleType {
  cursor: string;
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
}

const HANDLES: HandleType[] = [
  { cursor: 'nwse-resize', position: 'nw' },
  { cursor: 'ns-resize', position: 'n' },
  { cursor: 'nesw-resize', position: 'ne' },
  { cursor: 'ew-resize', position: 'e' },
  { cursor: 'nwse-resize', position: 'se' },
  { cursor: 'ns-resize', position: 's' },
  { cursor: 'nesw-resize', position: 'sw' },
  { cursor: 'ew-resize', position: 'w' },
];

export const RedactTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('redact');
  const { activeFile } = toolState;

  // Document state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageViewport, setPageViewport] = useState<any | null>(null);

  // Redaction regions state
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [history, setHistory] = useState<RedactionBox[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Tool & interaction modes
  const [activeMode, setActiveMode] = useState<RedactionMode>('select-text');
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'fit-width' | 'fit-page' | 'custom'>('fit-width');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  // Export settings
  const [rasterizeAllPages, setRasterizeAllPages] = useState<boolean>(false);
  const [sanitizeMetadata, setSanitizeMetadata] = useState<boolean>(true);
  const [exportDpi, setExportDpi] = useState<number>(200);

  // Execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Refs for rendering and interaction
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Dragging / Resizing existing shape state
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null>(null);
  const [resizeInitialBox, setResizeInitialBox] = useState<RedactionBox | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null);

  // Push state to undo/redo history
  const pushHistory = useCallback(
    (newBoxes: RedactionBox[]) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, newBoxes];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setBoxes(history[prevIndex]);
      setHistoryIndex(prevIndex);
      setSelectedBoxId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setBoxes(history[nextIndex]);
      setHistoryIndex(nextIndex);
      setSelectedBoxId(null);
    }
  };

  // 1. Load PDF document into session
  useEffect(() => {
    if (!activeFile || activeFile.pageCount === 0) {
      setPdfDoc(null);
      setTotalPages(1);
      return;
    }

    let isMounted = true;
    PdfDocumentSession.getDocument(activeFile.data)
      .then((doc) => {
        if (isMounted) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          setBoxes([]);
          setHistory([[]]);
          setHistoryIndex(0);
          setSelectedBoxId(null);
        }
      })
      .catch((err) => {
        if (isMounted) console.error('Failed to load PDF session:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeFile?.id]);

  // 2. Render current page canvas and text layer
  useEffect(() => {
    if (!activeFile || !pdfDoc) return;
    let isCancelled = false;

    const canvas = mainCanvasRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!canvas) return;

    // Calculate responsive scale if fitMode is set
    let activeScale = scale;
    if (fitMode === 'fit-width' && scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth - 48; // padding
      pdfDoc.getPage(currentPage).then((p) => {
        const unscaledVp = p.getViewport({ scale: 1.0 });
        const targetScale = Math.max(0.4, Math.min(2.5, containerWidth / unscaledVp.width));
        setScale(Number(targetScale.toFixed(2)));
      });
      return;
    }

    renderPdfPageToCanvas(activeFile.data, currentPage, canvas, {
      scale: activeScale,
      pdfDoc,
    })
      .then(async (result) => {
        if (isCancelled) return;
        setPageViewport(result.viewport);

        // Render official PDF.js TextLayer
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(result.viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(result.viewport.height)}px`;

          try {
            const textContent = await result.page.getTextContent();
            if (isCancelled) return;

            const textLayer = new (pdfjsLib as any).TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport: result.viewport,
            });

            await textLayer.render();
          } catch (err: any) {
            console.warn('Text layer render notice:', err?.message);
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) console.error('Page render error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.id, pdfDoc, currentPage, scale, fitMode]);

  // 3. Text Selection to Redaction Regions handler
  const handleTextLayerMouseUp = () => {
    if (activeMode !== 'select-text' || !pageViewport || !pageContainerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    const containerRect = pageContainerRef.current.getBoundingClientRect();

    if (clientRects.length === 0) return;

    const newBoxes: RedactionBox[] = [];

    for (const r of clientRects) {
      if (r.width < 2 || r.height < 2) continue;

      // Convert from screen client coords to viewport pixels relative to page container
      const vx1 = Math.max(0, Math.min(pageViewport.width, r.left - containerRect.left));
      const vy1 = Math.max(0, Math.min(pageViewport.height, r.top - containerRect.top));
      const vx2 = Math.max(0, Math.min(pageViewport.width, r.right - containerRect.left));
      const vy2 = Math.max(0, Math.min(pageViewport.height, r.bottom - containerRect.top));

      if (Math.abs(vx2 - vx1) < 2 || Math.abs(vy2 - vy1) < 2) continue;

      // Convert to unrotated PDF user-space points
      const [p1x, p1y] = pageViewport.convertToPdfPoint(vx1, vy1);
      const [p2x, p2y] = pageViewport.convertToPdfPoint(vx2, vy2);

      const box: RedactionBox = {
        id: `box_txt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pageIndex: currentPage - 1,
        pageNumber: currentPage,
        x: Math.min(p1x, p2x),
        y: Math.min(p1y, p2y),
        width: Math.abs(p2x - p1x),
        height: Math.abs(p2y - p1y),
        shapeType: 'rectangle',
        coordinateSpace: 'pdf',
        source: 'text-selection',
        textSnippet: selection.toString().slice(0, 30),
      };

      newBoxes.push(box);
    }

    if (newBoxes.length > 0) {
      const updated = [...boxes, ...newBoxes];
      setBoxes(updated);
      pushHistory(updated);
      setSelectedBoxId(newBoxes[0].id);
    }

    // Clear selection so black redaction preview replaces browser blue selection
    selection.removeAllRanges();
  };

  // 4. Shape Drawing Mouse Handlers
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeMode === 'select-text') return;
    if (!pageContainerRef.current) return;

    // Deselect if clicking on empty SVG area
    if ((e.target as HTMLElement).tagName === 'svg') {
      setSelectedBoxId(null);
    }

    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!pageContainerRef.current) return;
    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing && drawStart) {
      setDrawCurrent({ x, y });
      return;
    }

    // Handle dragging existing shape
    if (draggingBoxId && dragOffset && pageViewport) {
      const currentBox = boxes.find((b) => b.id === draggingBoxId);
      if (!currentBox) return;

      const newVx = x - dragOffset.x;
      const newVy = y - dragOffset.y;

      const [newPdfX, newPdfY] = pageViewport.convertToPdfPoint(newVx, newVy);

      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== draggingBoxId) return b;
          return {
            ...b,
            x: Math.round(newPdfX),
            y: Math.round(newPdfY),
          };
        })
      );
      return;
    }

    // Handle resizing existing shape
    if (activeHandle && resizeInitialBox && resizeStartPos && pageViewport) {
      const dx = (x - resizeStartPos.x) / scale;
      const dy = (y - resizeStartPos.y) / scale;

      let { x: bx, y: by, width: bw, height: bh } = resizeInitialBox;

      if (activeHandle.includes('e')) bw += dx;
      if (activeHandle.includes('s')) {
        by -= dy;
        bh += dy;
      }
      if (activeHandle.includes('w')) {
        bx += dx;
        bw -= dx;
      }
      if (activeHandle.includes('n')) {
        bh += dy;
      }

      if (resizeInitialBox.shapeType === 'square' || resizeInitialBox.shapeType === 'circle') {
        const side = Math.max(bw, bh);
        bw = side;
        bh = side;
      }

      if (bw > 4 && bh > 4) {
        setBoxes((prev) =>
          prev.map((b) => {
            if (b.id !== resizeInitialBox.id) return b;
            return {
              ...b,
              x: Math.round(bx),
              y: Math.round(by),
              width: Math.round(bw),
              height: Math.round(bh),
            };
          })
        );
      }
    }
  };

  const handleSvgMouseUp = () => {
    if (isDrawing && drawStart && drawCurrent && pageViewport) {
      const minVx = Math.min(drawStart.x, drawCurrent.x);
      const minVy = Math.min(drawStart.y, drawCurrent.y);
      let vw = Math.abs(drawCurrent.x - drawStart.x);
      let vh = Math.abs(drawCurrent.y - drawStart.y);

      if (activeMode === 'square' || activeMode === 'circle') {
        const side = Math.max(vw, vh);
        vw = side;
        vh = side;
      }

      if (vw > 4 && vh > 4) {
        const [p1x, p1y] = pageViewport.convertToPdfPoint(minVx, minVy);
        const [p2x, p2y] = pageViewport.convertToPdfPoint(minVx + vw, minVy + vh);

        const newBox: RedactionBox = {
          id: `box_${activeMode}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          pageIndex: currentPage - 1,
          pageNumber: currentPage,
          x: Math.round(Math.min(p1x, p2x)),
          y: Math.round(Math.min(p1y, p2y)),
          width: Math.round(Math.abs(p2x - p1x)),
          height: Math.round(Math.abs(p2y - p1y)),
          shapeType: activeMode as RedactionShapeType,
          coordinateSpace: 'pdf',
          source: 'draw',
        };

        const updated = [...boxes, newBox];
        setBoxes(updated);
        pushHistory(updated);
        setSelectedBoxId(newBox.id);
      }
    }

    if (draggingBoxId || activeHandle) {
      pushHistory(boxes);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setDraggingBoxId(null);
    setDragOffset(null);
    setActiveHandle(null);
    setResizeInitialBox(null);
    setResizeStartPos(null);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoxId) {
          e.preventDefault();
          const updated = boxes.filter((b) => b.id !== selectedBoxId);
          setBoxes(updated);
          pushHistory(updated);
          setSelectedBoxId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else if (e.key === 'Escape') {
        setSelectedBoxId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxId, boxes, totalPages, historyIndex]);

  // Execute Redaction & Export
  const handleRedactAndDownload = async () => {
    if (!activeFile || boxes.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await redactEngine.redactPdf(activeFile.data, {
        boxes,
        rasterizeAllPages,
        sanitizeMetadata,
        dpi: exportDpi,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_redacted.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessMsg(
        `Permanent redaction complete! Sanitized ${result.redactedPagesCount} page(s) and irreversibly burned ${result.redactionBoxesCount} region(s).`
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
  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  // Helper to translate PDF user-space coords to screen viewport coords
  const getScreenCoords = (b: RedactionBox) => {
    if (!pageViewport) return { x: 0, y: 0, width: 0, height: 0 };
    const pdfRect = [b.x, b.y, b.x + b.width, b.y + b.height];
    const vpRect = pageViewport.convertToViewportRectangle(pdfRect);
    return {
      x: Math.min(vpRect[0], vpRect[2]),
      y: Math.min(vpRect[1], vpRect[3]),
      width: Math.abs(vpRect[2] - vpRect[0]),
      height: Math.abs(vpRect[3] - vpRect[1]),
    };
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      <ToolFileSelector
        toolId="redact"
        description="Permanently redact sensitive text, numbers, and graphics by rebuilding affected pages from sanitized raster images."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-140px)] min-h-[700px] overflow-hidden">
          {/* 1. Top Control Bar */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Tool Mode Selectors */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('select-text');
                  setSelectedBoxId(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeMode === 'select-text'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Select text directly to redact word by word or line by line"
              >
                <Type className="w-3.5 h-3.5" />
                Select Text
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('rectangle');
                  setSelectedBoxId(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeMode === 'rectangle'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Draw a rectangle redaction box"
              >
                <Square className="w-3.5 h-3.5" />
                Rectangle
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('square');
                  setSelectedBoxId(null);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeMode === 'square'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Draw a 1:1 square redaction"
              >
                Square
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('circle');
                  setSelectedBoxId(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeMode === 'circle'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Draw a circular redaction"
              >
                <Circle className="w-3.5 h-3.5" />
                Circle
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('ellipse');
                  setSelectedBoxId(null);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeMode === 'ellipse'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Draw an elliptical redaction"
              >
                Ellipse
              </button>
            </div>

            {/* Navigation & Zoom Bar */}
            <div className="flex items-center gap-3">
              {/* Page Navigator */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-300"
                  title="Previous page (Left arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-1">
                  Page <strong className="font-semibold text-slate-900 dark:text-white">{currentPage}</strong> of{' '}
                  {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-300"
                  title="Next page (Right arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
                <button
                  type="button"
                  disabled={scale <= 0.5}
                  onClick={() => {
                    setFitMode('custom');
                    setScale((s) => Number(Math.max(0.5, s - 0.15).toFixed(2)));
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  disabled={scale >= 2.5}
                  onClick={() => {
                    setFitMode('custom');
                    setScale((s) => Number(Math.min(2.5, s + 0.15).toFixed(2)));
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFitMode('fit-width')}
                  className="px-2 py-0.5 text-[11px] rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium ml-1"
                  title="Fit to width"
                >
                  Fit
                </button>
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={historyIndex <= 0}
                  onClick={undo}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-300"
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={historyIndex >= history.length - 1}
                  onClick={redo}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-300"
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Toggle Thumbnails */}
              <button
                type="button"
                onClick={() => setShowThumbnails((t) => !t)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  showThumbnails
                    ? 'bg-slate-200/80 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}
              >
                {showThumbnails ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. Workspace Body: Left Filmstrip + Center Viewer + Right Inspector */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Thumbnail Filmstrip */}
            {showThumbnails && (
              <div className="w-44 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                  Pages ({totalPages})
                </div>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isActive = pNum === currentPage;
                  const pageBoxes = boxes.filter((b) => b.pageNumber === pNum);

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-full text-left rounded-xl p-2 transition-all group flex flex-col items-center gap-1.5 border ${
                        isActive
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 shadow-xs ring-1 ring-rose-500/50'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="relative w-full aspect-[1/1.4] bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-2xs">
                        <span className="text-[10px] font-mono text-slate-400">P. {pNum}</span>

                        {/* Synchronized miniature redaction overlay on thumbnail */}
                        {pageBoxes.length > 0 && (
                          <div className="absolute inset-0 bg-transparent pointer-events-none">
                            {pageBoxes.map((b) => (
                              <div
                                key={b.id}
                                className={`absolute bg-black/90 ${
                                  b.shapeType === 'circle' ? 'rounded-full' : ''
                                }`}
                                style={{
                                  left: `${Math.max(0, Math.min(90, (b.x / 595) * 100))}%`,
                                  bottom: `${Math.max(0, Math.min(90, (b.y / 842) * 100))}%`,
                                  width: `${Math.max(6, Math.min(90, (b.width / 595) * 100))}%`,
                                  height: `${Math.max(4, Math.min(90, (b.height / 842) * 100))}%`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between w-full px-1 text-[11px]">
                        <span className={`font-semibold ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          Page {pNum}
                        </span>
                        {pageBoxes.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 text-white rounded-full font-mono">
                            {pageBoxes.length}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Central Document Page Viewer */}
            <div
              ref={scrollContainerRef}
              className="flex-1 bg-slate-100/90 dark:bg-slate-950 overflow-auto flex items-center justify-center p-8 relative"
            >
              <div
                ref={pageContainerRef}
                className="relative bg-white shadow-xl rounded-sm select-none shrink-0"
                style={{
                  width: pageViewport ? `${pageViewport.width}px` : 'auto',
                  height: pageViewport ? `${pageViewport.height}px` : 'auto',
                }}
              >
                {/* 1. PDF Canvas Layer */}
                <canvas ref={mainCanvasRef} className="block select-none pointer-events-none" />

                {/* 2. PDF.js Native TextLayer */}
                <div
                  ref={textLayerRef}
                  onMouseUp={handleTextLayerMouseUp}
                  className={`textLayer ${activeMode === 'select-text' ? '' : 'disabled'}`}
                />

                {/* 3. Interactive SVG Redaction Shapes Layer */}
                <svg
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  className="absolute inset-0 w-full h-full cursor-crosshair z-10"
                >
                  {/* Real-time Ghost Drawing Shape */}
                  {isDrawing && drawStart && drawCurrent && (
                    <>
                      {activeMode === 'circle' || activeMode === 'ellipse' ? (
                        <ellipse
                          cx={Math.min(drawStart.x, drawCurrent.x) + Math.abs(drawCurrent.x - drawStart.x) / 2}
                          cy={Math.min(drawStart.y, drawCurrent.y) + Math.abs(drawCurrent.y - drawStart.y) / 2}
                          rx={Math.abs(drawCurrent.x - drawStart.x) / 2}
                          ry={
                            activeMode === 'circle'
                              ? Math.abs(drawCurrent.x - drawStart.x) / 2
                              : Math.abs(drawCurrent.y - drawStart.y) / 2
                          }
                          fill="#000000"
                          opacity="0.8"
                          stroke="#E11D48"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                      ) : (
                        <rect
                          x={Math.min(drawStart.x, drawCurrent.x)}
                          y={Math.min(drawStart.y, drawCurrent.y)}
                          width={
                            activeMode === 'square'
                              ? Math.max(Math.abs(drawCurrent.x - drawStart.x), Math.abs(drawCurrent.y - drawStart.y))
                              : Math.abs(drawCurrent.x - drawStart.x)
                          }
                          height={
                            activeMode === 'square'
                              ? Math.max(Math.abs(drawCurrent.x - drawStart.x), Math.abs(drawCurrent.y - drawStart.y))
                              : Math.abs(drawCurrent.y - drawStart.y)
                          }
                          fill="#000000"
                          opacity="0.8"
                          stroke="#E11D48"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                      )}
                    </>
                  )}

                  {/* Rendered Existing Page Redactions */}
                  {currentBoxes.map((b) => {
                    const screen = getScreenCoords(b);
                    const isSelected = selectedBoxId === b.id;

                    const handleShapeMouseDown = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSelectedBoxId(b.id);
                      setDraggingBoxId(b.id);
                      setDragOffset({
                        x: e.clientX - pageContainerRef.current!.getBoundingClientRect().left - screen.x,
                        y: e.clientY - pageContainerRef.current!.getBoundingClientRect().top - screen.y,
                      });
                    };

                    return (
                      <g key={b.id} className="cursor-move">
                        {b.shapeType === 'circle' || b.shapeType === 'ellipse' ? (
                          <ellipse
                            cx={screen.x + screen.width / 2}
                            cy={screen.y + screen.height / 2}
                            rx={screen.width / 2}
                            ry={b.shapeType === 'circle' ? screen.width / 2 : screen.height / 2}
                            fill="#000000"
                            stroke={isSelected ? '#38BDF8' : '#000000'}
                            strokeWidth={isSelected ? '2' : '0'}
                            strokeDasharray={isSelected ? '4 2' : undefined}
                            onMouseDown={handleShapeMouseDown}
                          />
                        ) : (
                          <rect
                            x={screen.x}
                            y={screen.y}
                            width={screen.width}
                            height={b.shapeType === 'square' ? screen.width : screen.height}
                            fill="#000000"
                            stroke={isSelected ? '#38BDF8' : '#000000'}
                            strokeWidth={isSelected ? '2' : '0'}
                            strokeDasharray={isSelected ? '4 2' : undefined}
                            onMouseDown={handleShapeMouseDown}
                          />
                        )}

                        {/* Interactive Selection Resize Handles */}
                        {isSelected && (
                          <>
                            {HANDLES.map((h) => {
                              let hx = screen.x;
                              let hy = screen.y;
                              const hw = b.shapeType === 'square' ? screen.width : screen.width;
                              const hh = b.shapeType === 'square' ? screen.width : screen.height;

                              if (h.position.includes('e')) hx += hw;
                              else if (!h.position.includes('w')) hx += hw / 2;

                              if (h.position.includes('s')) hy += hh;
                              else if (!h.position.includes('n')) hy += hh / 2;

                              const handleMouseDownResize = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                setActiveHandle(h.position);
                                setResizeInitialBox(b);
                                setResizeStartPos({
                                  x: e.clientX - pageContainerRef.current!.getBoundingClientRect().left,
                                  y: e.clientY - pageContainerRef.current!.getBoundingClientRect().top,
                                });
                              };

                              return (
                                <circle
                                  key={h.position}
                                  cx={hx}
                                  cy={hy}
                                  r="4.5"
                                  fill="#FFFFFF"
                                  stroke="#0284C7"
                                  strokeWidth="2"
                                  style={{ cursor: h.cursor }}
                                  onMouseDown={handleMouseDownResize}
                                />
                              );
                            })}
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Right Inspector & Redactions Sidebar */}
            <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
              {/* Selected Region Properties */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Selected Region
                  </h3>
                  {selectedBox && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = boxes.filter((b) => b.id !== selectedBox.id);
                        setBoxes(updated);
                        pushHistory(updated);
                        setSelectedBoxId(null);
                      }}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors"
                      title="Delete selected region (Delete key)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {selectedBox ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Shape Type:</span>
                      <select
                        value={selectedBox.shapeType || 'rectangle'}
                        onChange={(e) => {
                          const updated = boxes.map((b) =>
                            b.id === selectedBox.id
                              ? { ...b, shapeType: e.target.value as RedactionShapeType }
                              : b
                          );
                          setBoxes(updated);
                          pushHistory(updated);
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold capitalize"
                      >
                        <option value="rectangle">Rectangle</option>
                        <option value="square">Square</option>
                        <option value="circle">Circle</option>
                        <option value="ellipse">Ellipse</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-slate-500 block mb-0.5">X (pt):</label>
                        <input
                          type="number"
                          value={selectedBox.x}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setBoxes((prev) =>
                              prev.map((b) => (b.id === selectedBox.id ? { ...b, x: val } : b))
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Y (pt):</label>
                        <input
                          type="number"
                          value={selectedBox.y}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setBoxes((prev) =>
                              prev.map((b) => (b.id === selectedBox.id ? { ...b, y: val } : b))
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Width:</label>
                        <input
                          type="number"
                          value={selectedBox.width}
                          onChange={(e) => {
                            const val = Math.max(4, parseInt(e.target.value) || 4);
                            setBoxes((prev) =>
                              prev.map((b) => (b.id === selectedBox.id ? { ...b, width: val } : b))
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Height:</label>
                        <input
                          type="number"
                          value={selectedBox.height}
                          onChange={(e) => {
                            const val = Math.max(4, parseInt(e.target.value) || 4);
                            setBoxes((prev) =>
                              prev.map((b) => (b.id === selectedBox.id ? { ...b, height: val } : b))
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Click any redaction shape on the page to inspect or resize.
                  </p>
                )}
              </div>

              {/* Current Page Redactions List */}
              <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Page {currentPage} Redactions ({currentBoxes.length})
                  </h3>
                  {currentBoxes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = boxes.filter((b) => b.pageNumber !== currentPage);
                        setBoxes(updated);
                        pushHistory(updated);
                        setSelectedBoxId(null);
                      }}
                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
                    >
                      Clear Page
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {currentBoxes.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBoxId(b.id)}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between border cursor-pointer transition-all ${
                        selectedBoxId === b.id
                          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 text-rose-900 dark:text-rose-200'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {b.shapeType === 'circle' ? (
                          <Circle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate font-medium">
                          {b.textSnippet ? `"${b.textSnippet}"` : `${b.shapeType} (${b.width}×${b.height}pt)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = boxes.filter((item) => item.id !== b.id);
                          setBoxes(updated);
                          pushHistory(updated);
                          if (selectedBoxId === b.id) setSelectedBoxId(null);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {currentBoxes.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">
                      No redactions on this page yet. Use Select Text or Shape tools.
                    </p>
                  )}
                </div>
              </div>

              {/* Redaction Security Options & Download Action */}
              <div className="p-4 space-y-4 bg-slate-50 dark:bg-slate-900/80">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Resolution (DPI):</span>
                    <select
                      value={exportDpi}
                      onChange={(e) => setExportDpi(parseInt(e.target.value))}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                    >
                      <option value={150}>150 DPI (Compact)</option>
                      <option value={200}>200 DPI (Standard)</option>
                      <option value={300}>300 DPI (High Quality)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={sanitizeMetadata}
                      onChange={(e) => setSanitizeMetadata(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>Sanitize metadata & attachments</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rasterizeAllPages}
                      onChange={(e) => setRasterizeAllPages(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>Rasterize entire document</span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRedactAndDownload}
                    disabled={isProcessing || boxes.length === 0}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Burning Redactions...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Redact & Download ({boxes.length})
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5">
                    Irreversible client-side raster burn. Original vector stream purged.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
