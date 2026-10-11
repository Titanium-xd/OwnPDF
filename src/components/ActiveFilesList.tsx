import React from 'react';
import { useSession } from '../context/SessionContext';
import { FileText, Lock, Unlock, Trash2, Eye } from 'lucide-react';

export const ActiveFilesList: React.FC = () => {
  const { files, removeFile, selectedFileId, setSelectedFileId, setActiveTool } = useSession();

  if (files.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Current Session Documents ({files.length})
        </h4>
        <span className="text-[11px] text-slate-400">Stored in browser memory only</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {files.map((file) => {
          const isSelected = file.id === selectedFileId;
          const formattedSize =
            file.size < 1024 * 1024
              ? `${Math.round(file.size / 1024)} KB`
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

          return (
            <div
              key={file.id}
              onClick={() => setSelectedFileId(file.id)}
              className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 shadow-md shadow-sky-500/5'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    file.isEncrypted
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                      : 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40'
                  }`}
                >
                  {file.isEncrypted ? <Lock className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{formattedSize}</span>
                    <span>•</span>
                    {file.isEncrypted ? (
                      <span className="text-rose-500 font-medium">Password Protected</span>
                    ) : (
                      <span>{file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Remove from session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tool trigger shortcuts */}
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                {file.isEncrypted ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFileId(file.id);
                      setActiveTool('unlock');
                    }}
                    className="font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Unlock className="w-3 h-3" />
                    Unlock this document →
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFileId(file.id);
                      setActiveTool('organize');
                    }}
                    className="font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Organize / Preview →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
