import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Logo } from './Logo';
import { PrivacyModal } from './modals/PrivacyModal';
import { AboutModal } from './modals/AboutModal';

export const Footer: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <footer className="mt-20 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left brand */}
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">OwnPDF</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Local-first, privacy-respecting PDF toolkit.
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400">
              <button
                onClick={() => setShowPrivacy(true)}
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                Privacy Architecture
              </button>
              <button
                onClick={() => setShowAbout(true)}
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                About & Licenses
              </button>
            </div>

            {/* Right statement */}
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Zero uploads. 100% on-device.</span>
            </div>
          </div>
        </div>
      </footer>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
};
