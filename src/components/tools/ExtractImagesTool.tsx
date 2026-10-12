import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { extractImagesEngine } from '../../engine/extract-images';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadFile, sanitizeDownloadFilename } from '../../utils/download';
import type { ExtractedImageItem, ExtractImagesResult } from '../../types/engine';
import {
  Image as ImageIcon,
  Download,
  AlertTriangle,
  Archive,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ExtractImagesTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('extract-images');
  const { activeFile } = toolState;

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractImagesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeFile && activeFile.pageCount > 0) {
      handleExtract();
    } else {
      setExtractResult(null);
      setErrorMsg(null);
      cleanupUrls();
    }
  }, [activeFile?.id]);

  const cleanupUrls = () => {
    Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls({});
  };

  const handleExtract = async () => {
    if (!activeFile) return;

    setIsExtracting(true);
    setErrorMsg(null);
    cleanupUrls();

    try {
      const result = await extractImagesEngine.extractPdfImages(activeFile.data);
      setExtractResult(result);

      // Create object URLs for thumbnails
      const urls: Record<string, string> = {};
      result.images.forEach((img) => {
        if (img.status === 'SUCCESS' && img.blob.size > 0) {
          urls[img.id] = URL.createObjectURL(img.blob);
        }
      });
      setPreviewUrls(urls);
    } catch (err: any) {
      console.error('Image extraction failed:', err);
      setErrorMsg(err?.message || 'Failed to extract images from PDF.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadSingle = async (img: ExtractedImageItem) => {
    const filename = sanitizeDownloadFilename(img.name);
    await downloadFile(img.blob, filename);
  };

  const handleDownloadAllZip = async () => {
    if (!activeFile || !extractResult?.zipBlob) return;

    const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
    const filename = sanitizeDownloadFilename(`${baseName}_images.zip`);
    await downloadFile(extractResult.zipBlob, filename);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="extract-images"
        description="Extract embedded photos, graphics, and figures in their original lossless quality, single or bundled into a ZIP archive."
      />

      {activeFile && (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-500" />
                  Extracted Images Gallery
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isExtracting
                    ? 'Scanning PDF objects and decoding image streams...'
                    : extractResult
                    ? `Found ${extractResult.totalCount} image(s) (${formatBytes(extractResult.totalBytes)})`
                    : 'Ready to extract'}
                </p>
              </div>

              {extractResult && extractResult.totalCount > 0 && (
                <button
                  onClick={handleDownloadAllZip}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  Download All as ZIP
                </button>
              )}
            </div>

            {/* Loading Spinner */}
            {isExtracting && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Extracting embedded raster assets...
                </p>
              </div>
            )}

            {/* Images Grid */}
            {!isExtracting && extractResult && extractResult.images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[550px] overflow-y-auto p-1">
                {extractResult.images.map((img) => {
                  const url = previewUrls[img.id];

                  return (
                    <div
                      key={img.id}
                      className="group bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                    >
                      {/* Image Preview Box */}
                      <div className="relative aspect-video bg-slate-200 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                        {url ? (
                          <img
                            src={url}
                            alt={img.name}
                            className="object-contain w-full h-full"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        )}

                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/70 text-white backdrop-blur-xs">
                          Page {img.pageNumber}
                        </span>

                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-600/90 text-white">
                          {img.format}
                        </span>
                      </div>

                      {/* Metadata Details */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                          <span>
                            {img.width} × {img.height} px
                          </span>
                          <span>{formatBytes(img.sizeBytes)}</span>
                        </div>

                        {img.isDeduplicated && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                            <Layers className="w-3 h-3" /> Shared asset
                          </span>
                        )}

                        <button
                          onClick={() => handleDownloadSingle(img)}
                          className="w-full mt-2 py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isExtracting && extractResult && extractResult.images.length === 0 && (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                No embedded raster images found in this document.
              </div>
            )}

            {/* Quality Guarantee Callout */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Lossless Image Preservation:
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Raw JPEG streams are extracted directly from PDF objects without re-compression degradation. FlateDecode and transparency soft-masks (/SMask) are composited into lossless PNGs.
                </p>
              </div>
            </div>
          </div>

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
