import React, { useState, useRef } from 'react';
import { useSession } from '../context/SessionContext';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

export const Dropzone: React.FC = () => {
  const { addMultipleFiles } = useSession();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMsg(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    setIsLoading(true);
    try {
      await addMultipleFiles(droppedFiles);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process dropped files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMsg(null);
    setIsLoading(true);

    const selected = Array.from(e.target.files);
    try {
      await addMultipleFiles(selected);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process selected files');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer group rounded-3xl border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center overflow-hidden ${
          isDragging
            ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/40 hover:border-sky-400 dark:hover:border-sky-500/70 hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-sky-500/10 transition duration-300">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          Drop your PDF or image files here
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Drag and drop files, or <span className="text-sky-600 dark:text-sky-400 font-semibold underline underline-offset-2">browse from your device</span>.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            100% On-Device
          </span>
          <span>•</span>
          <span>PDF, JPG, PNG</span>
          <span>•</span>
          <span>Up to 100 MB per file</span>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400 animate-in fade-in">
            <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Reading files locally...</span>
          </div>
        )}
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
