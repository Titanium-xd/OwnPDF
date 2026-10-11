import React, { useState } from 'react';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import type { ImageInput } from '../../types/engine';
import { downloadPdf } from '../../utils/download';
import {
  Image as ImageIcon,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SelectedImage {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
  data: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
}

export const ImagesToPdfTool: React.FC = () => {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'FIT'>('A4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    data: Uint8Array;
    size: number;
    pageCount: number;
  } | null>(null);

  const handleAddImages = async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    const newItems: SelectedImage[] = [];
    for (const file of Array.from(fileList)) {
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        setErrorMsg('Only JPEG and PNG images are supported.');
        continue;
      }
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const previewUrl = URL.createObjectURL(new Blob([data], { type: file.type }));

      newItems.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: file.name,
        size: file.size,
        previewUrl,
        data,
        mimeType: file.type as 'image/jpeg' | 'image/png',
      });
    }

    setImages((prev) => [...prev, ...newItems]);
    setGeneratedResult(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
    setGeneratedResult(null);
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      setErrorMsg('Please add at least one image to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const inputs: ImageInput[] = images.map((img) => ({
        name: img.name,
        data: img.data,
        mimeType: img.mimeType,
      }));

      const pdfBytes = await pdfEngine.imagesToPdf(inputs, {
        pageSize,
        orientation,
        margin,
      });

      if (!PdfEngine.isValidPdfHeader(pdfBytes)) {
        throw new Error('Generated PDF lacks valid %PDF- header signature.');
      }

      const info = await pdfEngine.inspectPdf(pdfBytes);

      setGeneratedResult({
        data: pdfBytes,
        size: pdfBytes.byteLength,
        pageCount: info.pageCount,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Image to PDF conversion failed.');
      setGeneratedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedResult) return;
    try {
      await downloadPdf(generatedResult.data, 'images-converted.pdf');
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Left Configuration & Image List */}
      <div className="md:col-span-7 space-y-6">
        {/* Upload Button & Header */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rose-500" />
                <span>Select Images ({images.length} Selected)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Support for JPEG and PNG photographs, certificates, or document scans.
              </p>
            </div>

            <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-semibold hover:bg-sky-100 transition flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Add Images</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) => handleAddImages(e.target.files)}
              />
            </label>
          </div>

          {/* Drag & Drop Area when empty */}
          {images.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleAddImages(Array.from(e.dataTransfer.files));
              }}
              className={`p-8 text-center border-2 border-dashed rounded-xl transition ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Drop PNG or JPEG images here
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Each image will become a page in your document.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{img.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {Math.round(img.size / 1024)} KB • {img.mimeType.split('/')[1].toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveImage(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveImage(idx, 'down')}
                      disabled={idx === images.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1 rounded text-rose-400 hover:text-rose-600 cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversion Settings */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Page Configuration</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Page Size
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="A4">A4 (Standard Document)</option>
                <option value="LETTER">Letter</option>
                <option value="FIT">Fit to Image Size</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Orientation
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="auto">Auto (Match Image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Margins ({margin}pt)
              </label>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full mt-2 accent-sky-600"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleConvert}
            disabled={isProcessing || images.length === 0}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating PDF Locally...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                <span>Convert {images.length} Images to PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="md:col-span-5 space-y-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 min-h-[300px] flex flex-col justify-between shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Generated Result</h4>

          {generatedResult ? (
            <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h5 className="font-bold text-xs text-emerald-900 dark:text-emerald-100">PDF Ready for Download!</h5>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {generatedResult.pageCount} pages • {Math.round(generatedResult.size / 1024)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownload}
                className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p>Add photos or scans on the left and click convert to create your PDF.</p>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[11px] text-slate-400 leading-relaxed border border-slate-100 dark:border-slate-800">
            Images are embedded directly without compression loss or remote rendering.
          </div>
        </div>
      </div>
    </div>
  );
};
