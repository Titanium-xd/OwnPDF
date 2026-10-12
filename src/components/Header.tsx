import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { Sun, Moon, Trash2, Info } from 'lucide-react';
import { Logo } from './Logo';
import { siteConfig } from '../config/site';
import { getPathForTool, isModifiedEvent } from '../config/routes';
import { PrivacyModal } from './modals/PrivacyModal';
import { AboutModal } from './modals/AboutModal';

const GitHubIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export const Header: React.FC = () => {
  const {
    theme,
    toggleTheme,
    files,
    clearSession,
    totalMemoryBytes,
    setActiveTool,
  } = useSession();

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const formattedMemory =
    totalMemoryBytes < 1024 * 1024
      ? `${Math.round(totalMemoryBytes / 1024)} KB`
      : `${(totalMemoryBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <a
              href={getPathForTool(null, import.meta.env.BASE_URL || '/')}
              onClick={(e) => {
                if (isModifiedEvent(e)) return;
                e.preventDefault();
                setActiveTool(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-3 text-left group"
              aria-label="Return to OwnPDF home"
            >
              <Logo size="md" />
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  OwnPDF
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  Your PDFs. Your device. Your privacy.
                </p>
              </div>
            </a>

            {/* Subtle Inline Privacy Indicator */}
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
              title="Click to view our verified zero-upload privacy guarantees"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>Zero uploads • 100% on-device</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Memory usage badge */}
            {totalMemoryBytes > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>{formattedMemory} in memory</span>
              </div>
            )}

            {/* Clear session */}
            <button
              onClick={clearSession}
              disabled={files.length === 0 && totalMemoryBytes === 0}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                files.length > 0 || totalMemoryBytes > 0
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                  : 'text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
              }`}
              title="Immediately revokes object URLs and purges document buffers from memory"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Session</span>
            </button>

            {/* GitHub Capsule Button */}
            {siteConfig.repoUrl ? (
              <a
                href={siteConfig.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition shadow-xs"
                aria-label="View OwnPDF repository on GitHub"
              >
                <GitHubIcon className="w-3.5 h-3.5" />
                <span>GitHub</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/70 text-white/70 dark:bg-white/20 dark:text-white/70 cursor-not-allowed transition"
                title="Repository coming soon"
                aria-label="GitHub repository (coming soon)"
              >
                <GitHubIcon className="w-3.5 h-3.5" />
                <span>GitHub</span>
              </button>
            )}

            {/* About modal trigger */}
            <button
              onClick={() => setShowAboutModal(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="About OwnPDF & open-source licenses"
              aria-label="About OwnPDF"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} />}
      {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}
    </>
  );
};
