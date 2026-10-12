import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { convertPdfToImages, ConvertImagesResult } from '../../engine/pdf-to-images';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadFile, sanitizeDownloadFilename } from '../../utils/download';
import {
  Images,
  Image as ImageIcon,
  Archive,
  Download,
  AlertTriangle,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PdfToImagesTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('pdf-to-images');
  const { activeFile } = toolState;

  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [scale, setScale] = useState<number>(1.5); // 1.5x default ~150 DPI
  const [quality, setQuality] = useState<number>(0.92);
  const [pageRange, setPageRange] = useState<string>('all');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [convertedResult, setConvertedResult] = useState<ConvertImagesResult | null>(null);

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


  const handleConvert = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setProgress({ current: 0, total: activeFile.pageCount });

    try {
      const baseName = sanitizeDownloadFilename(activeFile.name, 'images').replace('.pdf', '');

      const result = await convertPdfToImages(
        activeFile.data,
        {
          format,
          scale,
          quality,
          pageRange: pageRange.trim() || 'all',
          onProgress: (current, total) => {
            setProgress({ current, total });
          },
        },
        baseName
      );

      setConvertedResult(result);
      confetti({ particleCount: 50, spread: 60 });
    } catch (err: any) {
      console.error('PDF to Images failed:', err);
      setErrorMsg(err?.message || 'Failed to render PDF to images.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleDownload = async () => {
    if (!convertedResult) return;
    try {
      const blob = convertedResult.zipBlob || convertedResult.singleBlob;
      if (!blob) throw new Error('No image or archive file available to download.');

      await downloadFile(blob, convertedResult.downloadFilename);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to download image file.');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="pdf-to-images" label="Select PDF to Convert to Images" />

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
            {/* Format Selection */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Image Format
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('image/jpeg');
                    setConvertedResult(null);
                  }}
                  className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                    format === 'image/jpeg'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">JPG / JPEG</span>
                  <span className="text-[10px] text-slate-500">Smaller file size, opaque white</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormat('image/png');
                    setConvertedResult(null);
                  }}
                  className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                    format === 'image/png'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">PNG</span>
                  <span className="text-[10px] text-slate-500">Lossless quality, transparent</span>
                </button>
              </div>

              {format === 'image/jpeg' && (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <span>JPEG Quality</span>
                    <span>{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={quality}
                    onChange={(e) => {
                      setQuality(parseFloat(e.target.value));
                      setConvertedResult(null);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Resolution Scale & Page Range */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Resolution & Page Range
                </h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rendering Resolution (Scale)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1.0, label: '1x (72/96 DPI)', desc: 'Standard' },
                    { val: 1.5, label: '1.5x (150 DPI)', desc: 'Balanced' },
                    { val: 2.0, label: '2x (300 DPI)', desc: 'High Res' },
                  ].map((res) => (
                    <button
                      key={res.val}
                      type="button"
                      onClick={() => {
                        setScale(res.val);
                        setConvertedResult(null);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        scale === res.val
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="text-xs font-bold">{res.label}</div>
                      <div className="text-[10px] text-slate-500">{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pages to Convert
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => {
                    setPageRange(e.target.value);
                    setConvertedResult(null);
                  }}
                  placeholder="all (or e.g. 1, 3-5)"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Multiple pages will automatically download as a single organized .ZIP archive.
                </p>
              </div>
            </div>
          </div>

          {/* Preview & Action Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Page 1 Preview
                </h3>
                <span className="text-[11px] font-medium text-slate-500">{activeFile.pageCount} Pages Total</span>
              </div>

              <div className="relative aspect-3/4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-800/60 p-2">
                <canvas ref={previewCanvasRef} className="max-h-full max-w-full object-contain rounded-xs shadow-xs" />
              </div>
            </div>

            {/* Action Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              {progress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <span>Rendering page {progress.current} of {progress.total}...</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {convertedResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {convertedResult.images.length} page(s) successfully converted!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                  >
                    {convertedResult.isMultiPage ? (
                      <Archive className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download {convertedResult.downloadFilename}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Rendering Images...
                    </>
                  ) : (
                    <>
                      <Images className="w-4 h-4" />
                      Convert to Images
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
