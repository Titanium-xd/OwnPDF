import React from 'react';
import { Lock } from 'lucide-react';
import { SessionProvider, useSession } from './context/SessionContext';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { ActiveFilesList } from './components/ActiveFilesList';
import { ToolGrid } from './components/ToolGrid';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { Footer } from './components/Footer';
import { PrototypeView } from './components/PrototypeView';

// Dedicated Tool Views
import { UnlockTool } from './components/tools/UnlockTool';
import { ProtectTool } from './components/tools/ProtectTool';
import { MergeTool } from './components/tools/MergeTool';
import { SplitTool } from './components/tools/SplitTool';
import { OrganizeTool } from './components/tools/OrganizeTool';
import { ImagesToPdfTool } from './components/tools/ImagesToPdfTool';
import { CompressTool } from './components/tools/CompressTool';
import { InspectTool } from './components/tools/InspectTool';

const MainAppContent: React.FC = () => {
  const { viewMode, setViewMode, activeTool } = useSession();

  if (viewMode === 'prototype') {
    return <PrototypeView onProceedToApp={() => setViewMode('app')} />;
  }

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'unlock':
        return <UnlockTool />;
      case 'protect':
        return <ProtectTool />;
      case 'merge':
        return <MergeTool />;
      case 'split':
        return <SplitTool />;
      case 'organize':
        return <OrganizeTool />;
      case 'images':
        return <ImagesToPdfTool />;
      case 'compress':
        return <CompressTool />;
      case 'inspect':
        return <InspectTool />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white transition-colors">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-12">
        {activeTool ? (
          <WorkspaceLayout toolId={activeTool}>
            {renderActiveTool()}
          </WorkspaceLayout>
        ) : (
          <>
            {/* Hero Section */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% client-side • All processing stays on your device</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Your PDFs. Your device.{' '}
                <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 dark:from-sky-400 dark:via-sky-300 dark:to-cyan-400 bg-clip-text text-transparent">
                  Your privacy.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
                Unlock password-protected e-Aadhaar and bank statements, merge, split, reorganize, convert, and inspect PDFs locally in your browser. Zero uploads. Zero telemetry.
              </p>
            </div>

            {/* Dropzone */}
            <Dropzone />

            {/* In-Memory Active Files Drawer */}
            <ActiveFilesList />

            {/* Categorized Tools Grid */}
            <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Comprehensive PDF Toolkit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select any tool below to begin processing your documents.
                </p>
              </div>
              <ToolGrid />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SessionProvider>
      <MainAppContent />
    </SessionProvider>
  );
};

export default App;
