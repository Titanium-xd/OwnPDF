import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf, downloadFile } from '../../utils/download';
import {
  Scissors,
  Download,
  Archive,
  AlertTriangle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';

export const SplitTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('split');
  const { activeFile } = toolState;

  const [splitMode, setSplitMode] = useState<'ranges' | 'all'>('ranges');
  const [rangeInput, setRangeInput] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [splitOutputs, setSplitOutputs] = useState<
    Array<{ filename: string; size: number; pageCount: number; data: Uint8Array }>
  >([]);

  useEffect(() => {
    setSplitOutputs([]);
    setErrorMsg(null);
  }, [activeFile?.id]);

  const handleSplit = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSplitOutputs([]);

    try {
      const modeArg = splitMode === 'all' ? 'all' : rangeInput;
      const results = await pdfEngine.splitPdf(activeFile.data, modeArg);

      const mapped = results.map((r) => {
        // Validate %PDF-
        if (!PdfEngine.isValidPdfHeader(r.data)) {
          throw new Error(`Split segment ${r.filename} is corrupted.`);
        }
        return {
          filename: r.filename,
          size: r.data.byteLength,
          pageCount: r.pageCount,
          data: r.data,
        };
      });

      setSplitOutputs(mapped);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Splitting failed. Please check your ranges.');
      setSplitOutputs([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAllAsZip = async () => {
    if (splitOutputs.length === 0 || !activeFile) return;
    try {
      const zip = new JSZip();

      splitOutputs.forEach((item) => {
        zip.file(item.filename, item.data);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const zipName = sanitizeDownloadFilename(activeFile.name, 'split-pages')
        .replace(/\.pdf$/, '.zip');
      await downloadFile(content, zipName);
    } catch (err: any) {
      setErrorMsg(err.message || 'ZIP download failed');
    }
  };

  const handleDownloadSingle = async (data: Uint8Array, filename: string) => {
    try {
      await downloadPdf(data, filename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <ToolFileSelector
        toolId="split"
        accept=".pdf"
        multiple={false}
        label="Split & Extract Document Selection"
      />

      {activeFile && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Configuration Column */}
          <div className="md:col-span-6 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={activeFile.name}>
                    {activeFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round(activeFile.size / 1024)} KB • {activeFile.pageCount} total pages
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Configure Split Parameters
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select whether to extract custom ranges or explode every page into a standalone PDF.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSplitMode('ranges')}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    splitMode === 'ranges'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Custom Ranges
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('all')}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    splitMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Extract Every Page
                </button>
              </div>

              {splitMode === 'ranges' ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Page Ranges (e.g. <code>1-3, 5, 8-10</code>)
                  </label>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="e.g. 1-2, 3"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400">
                    Document has {activeFile.pageCount} pages. Use commas to create multiple output files.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 dark:text-slate-400">
                  Each of the {activeFile.pageCount} pages will be exported as an independent single-page PDF.
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSplit}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Splitting Locally...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>Execute Split</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Results Column */}
          <div className="md:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Extracted Files ({splitOutputs.length})
                </h4>

                {splitOutputs.length > 1 && (
                  <button
                    onClick={downloadAllAsZip}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 hover:bg-sky-100 transition cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All as ZIP</span>
                  </button>
                )}
              </div>

              {splitOutputs.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                  <Scissors className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p>Configure ranges on the left and click "Execute Split" to extract pages.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {splitOutputs.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={item.filename}>
                          {item.filename}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} • {Math.round(item.size / 1024)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadSingle(item.data, item.filename)}
                        className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
