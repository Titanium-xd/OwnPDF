import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine } from '../../engine/pdf-engine';
import { renderPdfPageToCanvas, clearCanvas } from '../../engine/preview-renderer';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import type { WatermarkOptions } from '../../types/engine';
import {
  Stamp,
  Type,
  Image as ImageIcon,
  Download,
  AlertTriangle,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const WatermarkTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('watermark');
  const { activeFile } = toolState;

  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  // Text watermark state
  const [text, setText] = useState<string>('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState<number>(48);
  const [rotationAngle, setRotationAngle] = useState<number>(45);
  const [opacity, setOpacity] = useState<number>(0.25);
  const [textColorHex, setTextColorHex] = useState<string>('#64748b'); // slate-500

  // Image watermark state
  const [imageFile, setImageFile] = useState<{
    data: Uint8Array;
    name: string;
    type: 'image/png' | 'image/jpeg';
    previewUrl: string;
  } | null>(null);
  const [imageScale, setImageScale] = useState<number>(0.5);

  const [position, setPosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('center');
  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [exportedPdf, setExportedPdf] = useState<{
    data: Uint8Array;
    filename: string;
    size: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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


  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPng = file.type === 'image/png';
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';

    if (!isPng && !isJpeg) {
      setErrorMsg('Please upload a valid PNG or JPEG image for watermarking.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const previewUrl = URL.createObjectURL(file);
      setImageFile({
        data: new Uint8Array(arrayBuffer),
        name: file.name,
        type: isPng ? 'image/png' : 'image/jpeg',
        previewUrl,
      });
      setErrorMsg(null);
      setExportedPdf(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApply = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      let options: WatermarkOptions;

      if (watermarkType === 'text') {
        if (!text.trim()) {
          setErrorMsg('Please specify watermark text.');
          setIsProcessing(false);
          return;
        }

        const color = hexToRgb(textColorHex);
        options = {
          type: 'text',
          text: text.trim(),
          fontSize,
          color,
          opacity,
          rotationDegrees: rotationAngle,
          position,
          pageRange: pageRange.trim() || 'all',
        };
      } else {
        if (!imageFile) {
          setErrorMsg('Please upload a watermark image (PNG or JPEG).');
          setIsProcessing(false);
          return;
        }

        options = {
          type: 'image',
          imageData: imageFile.data,
          imageType: imageFile.type,
          scale: imageScale,
          opacity,
          position,
          pageRange: pageRange.trim() || 'all',
        };
      }

      const outputBytes = await pdfEngine.addWatermark(activeFile.data, options);
      const filename = sanitizeDownloadFilename(activeFile.name, 'watermarked');

      setExportedPdf({
        data: outputBytes,
        filename,
        size: outputBytes.byteLength,
      });
      confetti({ particleCount: 50, spread: 60 });
    } catch (err: any) {
      console.error('Watermark failed:', err);
      setErrorMsg(err?.message || 'Failed to apply watermark.');
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
      setErrorMsg(err?.message || 'Failed to download watermarked PDF.');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector toolId="watermark" label="Select PDF to Add Watermark" />

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
            {/* Watermark Type Selector */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-pink-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Watermark Type
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWatermarkType('text');
                    setExportedPdf(null);
                  }}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition ${
                    watermarkType === 'text'
                      ? 'bg-pink-50 dark:bg-pink-950/50 border-pink-500 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  Text Watermark
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWatermarkType('image');
                    setExportedPdf(null);
                  }}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition ${
                    watermarkType === 'image'
                      ? 'bg-pink-50 dark:bg-pink-950/50 border-pink-500 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Image Stamp (PNG/JPG)
                </button>
              </div>

              {watermarkType === 'text' ? (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        setExportedPdf(null);
                      }}
                      placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE"
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <span>Font Size</span>
                        <span>{fontSize} pt</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={90}
                        step={2}
                        value={fontSize}
                        onChange={(e) => {
                          setFontSize(parseInt(e.target.value, 10));
                          setExportedPdf(null);
                        }}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <span>Rotation</span>
                        <span>{rotationAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min={-90}
                        max={90}
                        step={5}
                        value={rotationAngle}
                        onChange={(e) => {
                          setRotationAngle(parseInt(e.target.value, 10));
                          setExportedPdf(null);
                        }}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Text Color
                      </label>
                      <div className="flex items-center gap-2">

                        {[
                          { hex: '#64748b', label: 'Grey' },
                          { hex: '#ef4444', label: 'Red' },
                          { hex: '#3b82f6', label: 'Blue' },
                          { hex: '#10b981', label: 'Green' },
                          { hex: '#f59e0b', label: 'Amber' },
                        ].map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => {
                              setTextColorHex(c.hex);
                              setExportedPdf(null);
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition ${
                              textColorHex === c.hex
                                ? 'border-pink-500 scale-110 shadow-xs'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (

                <div className="space-y-4 pt-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  {imageFile ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <img
                          src={imageFile.previewUrl}
                          alt="Watermark thumbnail"
                          className="w-10 h-10 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                            {imageFile.name}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase">
                            {imageFile.type.replace('image/', '')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                      >
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 text-center space-y-2 transition cursor-pointer"
                    >
                      <Upload className="w-5 h-5 mx-auto text-pink-500" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Upload PNG or JPEG Stamp
                      </p>
                      <p className="text-[11px] text-slate-500">Transparent PNG logos recommended</p>
                    </button>
                  )}

                  {imageFile && (
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <span>Image Scale</span>
                        <span>{Math.round(imageScale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={imageScale}
                        onChange={(e) => {
                          setImageScale(parseFloat(e.target.value));
                          setExportedPdf(null);
                        }}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Opacity & Position Controls */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-pink-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Opacity & Placement
                </h3>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Transparency / Opacity</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.9}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => {
                    setOpacity(parseFloat(e.target.value));
                    setExportedPdf(null);
                  }}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Placement
                  </label>
                  <select
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value as any);
                      setExportedPdf(null);
                    }}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="center">Center of Page</option>
                    <option value="top-left">Top Left Corner</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                  </select>
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
                    placeholder="all"
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-pink-500"
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
                  Watermark Preview
                </h3>
                <span className="text-[11px] font-medium text-slate-500">Live Simulation</span>
              </div>

              <div className="relative aspect-3/4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-800/60 p-2">
                <canvas ref={previewCanvasRef} className="max-h-full max-w-full object-contain rounded-xs shadow-xs" />

                {/* Simulated Overlay on top of preview */}
                {watermarkType === 'text' && text.trim() && (
                  <div
                    style={{
                      transform: position === 'center' ? `rotate(${rotationAngle}deg)` : undefined,
                      opacity,
                      color: textColorHex,
                      fontSize: `${Math.round(fontSize * 0.45)}px`,
                    }}
                    className={`absolute font-black tracking-widest pointer-events-none select-none transition-all ${
                      position === 'center'
                        ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center'
                        : position === 'top-left'
                        ? 'top-4 left-4'
                        : position === 'top-right'
                        ? 'top-4 right-4'
                        : position === 'bottom-left'
                        ? 'bottom-4 left-4'
                        : 'bottom-4 right-4'
                    }`}
                  >
                    {text}
                  </div>
                )}

                {watermarkType === 'image' && imageFile && (
                  <img
                    src={imageFile.previewUrl}
                    alt="Watermark preview"
                    style={{
                      opacity,
                      width: `${Math.round(imageScale * 50)}%`,
                    }}
                    className={`absolute object-contain pointer-events-none select-none transition-all ${
                      position === 'center'
                        ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                        : position === 'top-left'
                        ? 'top-4 left-4'
                        : position === 'top-right'
                        ? 'top-4 right-4'
                        : position === 'bottom-left'
                        ? 'bottom-4 left-4'
                        : 'bottom-4 right-4'
                    }`}
                  />
                )}
              </div>
            </div>

            {/* Action Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              {exportedPdf ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Watermark successfully applied!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Watermarked PDF ({(exportedPdf.size / 1024).toFixed(1)} KB)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white shadow-xs transition"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Applying Watermark...
                    </>
                  ) : (
                    <>
                      <Stamp className="w-4 h-4" />
                      Apply Watermark & Save
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
