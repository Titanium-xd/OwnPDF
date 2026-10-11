import React from 'react';
import { X, Heart, Shield, Code } from 'lucide-react';

export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">About OwnPDF</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your PDFs. Your device. Your privacy.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed">
          <p>
            <strong>OwnPDF</strong> was created to solve an everyday problem: why should you have to upload sensitive identity cards (like e-Aadhaar), salary slips, confidential bank statements, or invoices to unknown servers just to remove a password, merge two pages, or extract an assignment?
          </p>
          <p>
            By compiling industry-standard PDF manipulation engines directly to WebAssembly and executing them inside your browser, OwnPDF delivers fast, professional document utilities with cryptographic security and absolute privacy.
          </p>

          <div className="pt-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-2 flex items-center gap-2">
              <Code className="w-4 h-4 text-sky-500" />
              Open Source Acknowledgements
            </h4>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <span><strong>QPDF</strong> (WASM Port)</span>
                <span className="text-slate-400">Artistic License 2.0 / ISC</span>
              </div>
              <div className="flex justify-between items-center">
                <span><strong>pdf-lib</strong> (Hopding)</span>
                <span className="text-slate-400">MIT License</span>
              </div>
              <div className="flex justify-between items-center">
                <span><strong>PDF.js</strong> (Mozilla)</span>
                <span className="text-slate-400">Apache License 2.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span><strong>Lucide React</strong></span>
                <span className="text-slate-400">ISC License</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" /> for complete privacy.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
