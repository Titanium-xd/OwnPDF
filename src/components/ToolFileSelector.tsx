import React, { useRef, useState } from 'react';
import { useSession } from '../context/SessionContext';
import {
  UploadCloud,
  FolderOpen,
  ArrowRight,
  FileText,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Info,
} from 'lucide-react';

interface ToolFileSelectorProps {
  toolId: string;
  accept?: string;
  multiple?: boolean;
  label?: string;
  description?: string;
}

export const ToolFileSelector: React.FC<ToolFileSelectorProps> = ({
  toolId,
  accept = '.pdf',
  multiple = false,
}) => {
  const {
    files: homeFiles,
    addToolFile,
    addMultipleToolFiles,
    setToolSource,
    setToolActiveFileId,
    removeToolFile,
    reorderToolFiles,
    clearToolFiles,
    getToolState,
  } = useSession();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const toolState = getToolState(toolId);
  const { effectiveFiles, activeFile, source, hasHomeFiles } = toolState;

  // Handle file uploads directly inside this tool
  const handleFilesChosen = async (filesList: File[]) => {
    if (filesList.length === 0) return;
    setIsUploading(true);
    try {
      if (multiple) {
        await addMultipleToolFiles(toolId, filesList);
      } else {
        await addToolFile(toolId, filesList[0]);
      }
    } catch (err) {
      console.error('Failed to upload file to tool:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    const dropped = Array.from(e.dataTransfer.files);
    await handleFilesChosen(dropped);
  };

  // CASE 2: Homepage already contains files & user has NOT chosen source yet
  if (!source && hasHomeFiles) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-sky-500" />
              <span>Choose Document Source</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select how you want to provide files for this operation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Option 1: Use Home Files */}
          <button
            onClick={() => setToolSource(toolId, 'home')}
            className="p-4 rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 hover:bg-sky-50 dark:bg-sky-950/20 dark:hover:bg-sky-950/40 text-left transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Use files from Home</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-600 text-white shadow-xs">
                {homeFiles.length} available
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Process documents already uploaded to your session queue without re-selecting.
            </p>
          </button>

          {/* Option 2: Upload for this Tool */}
          <button
            onClick={() => {
              setToolSource(toolId, 'tool');
              setTimeout(() => fileInputRef.current?.click(), 50);
            }}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 text-left transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-slate-500 group-hover:text-sky-500 transition" />
                <span>Upload files for this tool</span>
              </span>
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 group-hover:underline flex items-center gap-0.5">
                Browse <ArrowRight className="w-3 text-sky-600 dark:text-sky-400" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select or drop documents directly into this workspace. Overrides home files for this tool.
            </p>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesChosen(Array.from(e.target.files));
          }}
        />
      </div>
    );
  }

  // CASE 1: No files chosen in this tool yet & no source active (or empty tool files)
  if (!source || effectiveFiles.length === 0) {
    return (
      <div className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer group rounded-2xl border-2 border-dashed p-8 text-center flex flex-col items-center justify-center transition-all ${
            isDragging
              ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 scale-[1.01]'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesChosen(Array.from(e.target.files));
            }}
          />

          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {multiple ? 'Select or drop PDF documents' : 'Select or drop a PDF document'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drag and drop here, or <span className="text-sky-600 dark:text-sky-400 font-semibold underline">browse files</span>
          </p>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span>Accepted: {accept}</span>
            <span>•</span>
            <span>Zero server uploads</span>
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-sky-600">
              <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Processing file locally...</span>
            </div>
          )}
        </div>

        {hasHomeFiles && (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setToolSource(toolId, 'home')}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5 font-medium"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Or use {homeFiles.length} files already in Home session</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE SOURCE VIEW (Case 3, Case 4): Files have been selected
  return (
    <div className="space-y-4">
      {/* Source & Actions Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Active Source:</span>
          {source === 'tool' ? (
            <span className="px-2 py-0.5 rounded-md font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Uploaded for this tool ({effectiveFiles.length})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Home session queue ({effectiveFiles.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add more files for multi-file operations */}
          {multiple && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-sky-500" />
              <span>Add More</span>
            </button>
          )}

          {/* Switch Source / Reset */}
          <button
            onClick={() => {
              if (source === 'tool') {
                clearToolFiles(toolId);
              } else {
                setToolSource(toolId, null);
              }
            }}
            className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition flex items-center gap-1"
            title="Switch document source or clear selection"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Change Source</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesChosen(Array.from(e.target.files));
          }}
        />
      </div>

      {/* Case 4: Single-File Tool with MULTIPLE files available -> Explicit target selection */}
      {!multiple && effectiveFiles.length > 1 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-500" />
              <span>Select Target Document for Operation</span>
            </h4>
            <span className="text-[11px] text-slate-500">
              Multiple files available — choose one to process
            </span>
          </div>

          <div className="space-y-2">
            {effectiveFiles.map((file) => {
              const isSelected = activeFile?.id === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => setToolActiveFileId(toolId, file.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-1 ring-sky-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {file.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500">
                    <span>{Math.round(file.size / 1024)} KB</span>
                    {file.isEncrypted && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                        Encrypted
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Case 4 Multi-file List (for Merge & Images tools) */}
      {multiple && effectiveFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Files in Operation ({effectiveFiles.length})
            </h4>
            <span className="text-[11px] text-slate-500">Files will be merged in the order below</span>
          </div>

          <div className="space-y-2">
            {effectiveFiles.map((file, idx) => (
              <div
                key={file.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {file.name}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => reorderToolFiles(toolId, idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => reorderToolFiles(toolId, idx, idx + 1)}
                    disabled={idx === effectiveFiles.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeToolFile(toolId, file.id)}
                    className="p-1 rounded text-rose-400 hover:text-rose-600 transition"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
