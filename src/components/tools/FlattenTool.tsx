import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { flattenEngine } from '../../engine/flatten-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { FlattenMode, FlattenReport } from '../../types/engine';
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Layers,
  Image,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FlattenTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('flatten');
  const { activeFile } = toolState;

  const [mode, setMode] = useState<FlattenMode>('annotations');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<FlattenReport | null>(null);

  const handleFlatten = async () => {
    if (!activeFile) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setReport(null);

    try {
      const result = await flattenEngine.flattenPdf(activeFile.data, mode);
      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_flattened.pdf`);
      await downloadPdf(result.pdfData, filename);

      setReport(result.report);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Flattening failed:', err);
      setErrorMsg(err?.message || 'Failed to flatten PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="flatten"
        description="Bake interactive forms, comments, and annotations into static document vectors or raster images."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                Flattening Strategy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how deeply interactive elements should be converted into permanent graphics.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFlatten}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Flattening Document...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Flatten & Download PDF
                </>
              )}
            </button>
          </div>

          {/* Mode Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setMode('forms')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                mode === 'forms'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Form Fields Only
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Locks all AcroForm text inputs, checkboxes, and radio buttons into vector text. Annotations and links remain untouched.
              </p>
            </div>

            <div
              onClick={() => setMode('annotations')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                mode === 'annotations'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Forms & Annotations
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Flattens forms and preserves annotation appearance streams. Safely preserves dynamic markup without visual distortion.
              </p>
            </div>

            <div
              onClick={() => setMode('rasterize')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                mode === 'rasterize'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Image className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Full Rasterization
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Reconstructs every page as a high-res image. Guarantees 100% removal of all forms, layers, and interactive objects.
              </p>
            </div>
          </div>

          {/* Technical Disclosure Notice */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3 text-sm text-amber-900 dark:text-amber-200">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Honest Flattening Scope:</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Vector flattening bakes annotations that possess pre-rendered appearance streams. If third-party annotations lack appearance dictionaries, they are reported and preserved to avoid silent visual loss. For guaranteed 100% flattening of unsupported annotations, use Full Rasterization mode.
              </p>
            </div>
          </div>

          {/* Execution Report */}
          {report && (
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                {report.isFullyFlattened ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                )}
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                  {report.isFullyFlattened
                    ? 'Complete Flattening Achieved'
                    : 'Partial Flattening Completed'}
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Flattened Fields</span>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {report.flattenedFieldsCount}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Flattened Annotations</span>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {report.flattenedAnnotationsCount}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Remaining Interactive</span>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {report.remainingInteractiveCount}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Unsupported Types</span>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {report.unsupportedAnnotationsCount}
                  </p>
                </div>
              </div>

              {report.unsupportedTypes.length > 0 && (
                <div className="pt-2 text-xs text-amber-700 dark:text-amber-300">
                  Unsupported annotation types preserved on page:{' '}
                  <span className="font-mono">{report.unsupportedTypes.join(', ')}</span>.
                </div>
              )}
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
