import React from 'react';
import { X, ShieldCheck, Cpu, HardDrive, WifiOff, FileCheck } from 'lucide-react';

export const PrivacyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Privacy Architecture & Guarantees</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your documents never leave your browser.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guarantees List */}
        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <WifiOff className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Zero Server Uploads</h4>
              <p className="mt-1 leading-relaxed">
                Document bytes, passwords, and extracted pages are processed exclusively inside Web Workers on your device. We maintain no backend servers, no cloud storage, and zero document processing APIs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <Cpu className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">WebAssembly Local Execution</h4>
              <p className="mt-1 leading-relaxed">
                Password removal and AES-256 encryption use QPDF compiled to WebAssembly. The WASM binary is downloaded once with the web app and executes inside an isolated client-side worker.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <HardDrive className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Ephemeral In-Memory Lifecycle</h4>
              <p className="mt-1 leading-relaxed">
                Documents are held in temporary memory buffers only for your active session. Passwords are never stored in localStorage, sessionStorage, cookies, or logs. Clicking <strong>Clear Session</strong> revokes all blob URLs and frees memory.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <FileCheck className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Zero Telemetry & Zero Analytics</h4>
              <p className="mt-1 leading-relaxed">
                OwnPDF contains no trackers, no advertising beacons, and no analytics SDKs. Network tests verify 0 outbound requests during document processing.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
