import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { formFillEngine } from '../../engine/form-fill-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { FormFieldInfo } from '../../types/engine';
import {
  FileCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FillFormTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('fill-form');
  const { activeFile } = toolState;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFile) {
      setFields([]);
      setFormValues({});
      setErrorMsg(null);
      setSuccessMsg(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    formFillEngine
      .getFormFields(activeFile.data)
      .then((loadedFields) => {
        if (!isCancelled) {
          setFields(loadedFields);
          const initialValues: Record<string, string | boolean> = {};
          loadedFields.forEach((f) => {
            initialValues[f.name] = f.value;
          });
          setFormValues(initialValues);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load form fields:', err);
          setErrorMsg(err?.message || 'Failed to detect interactive form fields.');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.id]);

  const handleFieldChange = (name: string, val: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleSaveAndDownload = async () => {
    if (!activeFile) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const result = await formFillEngine.fillForm(activeFile.data, formValues);
      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_filled.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessMsg(`Form saved successfully! Updated ${result.filledFieldCount} field(s).`);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Form saving failed:', err);
      setErrorMsg(err?.message || 'Failed to save filled form.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="fill-form"
        description="Inspect, fill, and download interactive PDF forms directly in your browser."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-500" />
                Interactive Form Fields ({fields.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Values will be cleanly embedded into the document's AcroForm field dictionaries.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveAndDownload}
              disabled={isSaving || fields.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving Form...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Save & Download Form
                </>
              )}
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Scanning PDF for interactive form fields...
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <Edit3 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No interactive AcroForm fields found in this document.
              </p>
              <p className="text-xs text-slate-500">
                This PDF may be a flat scanned document or use static vector lines instead of fillable form widgets.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {field.name}
                    </label>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {field.type}
                    </span>
                  </div>

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={(formValues[field.name] as string) || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      disabled={field.isReadOnly}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
                    />
                  )}

                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(formValues[field.name])}
                        onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                        disabled={field.isReadOnly}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {Boolean(formValues[field.name]) ? 'Checked' : 'Unchecked'}
                      </span>
                    </label>
                  )}

                  {field.type === 'radio' && (
                    <div className="space-y-1 pt-1">
                      {(field.options || []).map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name={field.name}
                            value={opt}
                            checked={formValues[field.name] === opt}
                            onChange={() => handleFieldChange(field.name, opt)}
                            disabled={field.isReadOnly}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      value={(formValues[field.name] as string) || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      disabled={field.isReadOnly}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

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
