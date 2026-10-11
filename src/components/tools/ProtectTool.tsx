import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { pdfEngine, PdfEngine } from '../../engine/pdf-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { sanitizeDownloadFilename, downloadPdf } from '../../utils/download';
import {
  Lock,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ProtectTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('protect');
  const { activeFile } = toolState;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [protectedResult, setProtectedResult] = useState<{
    data: Uint8Array;
    size: number;
    downloadFilename: string;
  } | null>(null);

  // Clear result when active file changes
  useEffect(() => {
    setProtectedResult(null);
    setErrorMsg(null);
    setPassword('');
    setConfirmPassword('');
  }, [activeFile?.id]);

  const calculateStrength = (pwd: string) => {
    if (!pwd) return { label: 'Empty', score: 0, color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', score: 1, color: 'bg-rose-500' };
    if (score <= 2) return { label: 'Fair', score: 2, color: 'bg-amber-500' };
    if (score <= 3) return { label: 'Good', score: 3, color: 'bg-blue-500' };
    return { label: 'Strong', score: 4, color: 'bg-emerald-500' };
  };

  const strength = calculateStrength(password);

  const handleProtect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile) return;
    if (!password) {
      setErrorMsg('Please enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const encryptedBytes = await pdfEngine.protectPdf(activeFile.data, {
        userPassword: password,
        ownerPassword: password,
        keyLength: 256,
      });

      // Signature verification
      if (!PdfEngine.isValidPdfHeader(encryptedBytes)) {
        throw new Error('Verification failed: protected output lacks %PDF- header.');
      }

      const downloadFilename = sanitizeDownloadFilename(activeFile.name, 'protected');

      setProtectedResult({
        data: encryptedBytes,
        size: encryptedBytes.byteLength,
        downloadFilename,
      });

      // Clear password from state immediately
      setPassword('');
      setConfirmPassword('');

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Encryption failed.');
      setProtectedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!protectedResult) return;
    try {
      await downloadPdf(protectedResult.data, protectedResult.downloadFilename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tool-specific Document Selection */}
      <ToolFileSelector
        toolId="protect"
        accept=".pdf"
        multiple={false}
        label="Protect Document Selection"
      />

      {activeFile && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Form */}
          <div className="md:col-span-7 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={activeFile.name}>
                    {activeFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round(activeFile.size / 1024)} KB • {activeFile.pageCount} {activeFile.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                </div>
              </div>
            </div>

            {!protectedResult ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Set Document Password
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Protected with AES-256 standard encryption. A password will be required every time the file is opened.
                  </p>
                </div>

                <form onSubmit={handleProtect} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Document Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Choose a strong password"
                        autoFocus
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900 dark:text-slate-100 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {password && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
                          {[1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`flex-1 transition-all ${
                                step <= strength.score ? strength.color : 'bg-transparent'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isProcessing || !password || !confirmPassword}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Encrypting with AES-256...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Protect Document with AES-256</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                      Document Genuinely Encrypted!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      AES-256 encryption applied. A password is now required to open this file.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 text-xs space-y-1 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Protected File Size:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {Math.round(protectedResult.size / 1024)} KB
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 text-[11px]">
                    <span>Output Filename:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                      {protectedResult.downloadFilename}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Protected PDF</span>
                  </button>
                  <button
                    onClick={() => setProtectedResult(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                  >
                    Protect Another
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Guidance Card */}
          <div className="md:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Standard AES-256 Security</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                OwnPDF applies <strong>genuine AES-256 standard encryption</strong>. Unlike cosmetic permission restrictions (e.g. "disallow printing" flags which can easily be ignored by PDF viewers), opening encryption prevents document contents from being read by unauthorized parties without the correct password.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p>• Verified with QPDF WASM engine</p>
                <p>• Verified %PDF- header signature</p>
                <p>• Zero passwords logged or retained</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
