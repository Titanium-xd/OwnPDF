import React from 'react';
import { useSession } from '../context/SessionContext';
import { ArrowLeft } from 'lucide-react';
import { toolsData } from './ToolGrid';

export const WorkspaceLayout: React.FC<{
  toolId: string;
  children: React.ReactNode;
}> = ({ toolId, children }) => {
  const { setActiveTool } = useSession();

  const toolInfo = toolsData.find((t) => t.id === toolId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTool(null)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Tools</span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {toolInfo?.icon}
              {toolInfo?.name || 'Tool Workspace'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {toolInfo?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      {children}
    </div>
  );
};
