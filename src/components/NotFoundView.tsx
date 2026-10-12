import React from 'react';
import { toolRoutes, getPathForTool, isModifiedEvent } from '../config/routes';
import { useSession } from '../context/SessionContext';
import type { ToolId } from '../context/SessionContext';
import { FileQuestion, ArrowLeft, ArrowRight } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  const { setActiveTool } = useSession();
  const baseUrl = import.meta.env.BASE_URL || '/';

  const handleNav = (e: React.MouseEvent, toolId: ToolId | null) => {
    if (isModifiedEvent(e)) return;
    e.preventDefault();
    setActiveTool(toolId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 text-center space-y-8 animate-in fade-in">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
        <FileQuestion className="w-8 h-8" />
      </div>

      <div className="space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
          404 Error
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          The requested page or tool does not exist. Please return to the homepage or select one of the available PDF tools below.
        </p>
      </div>

      <div>
        <a
          href={getPathForTool(null, baseUrl)}
          onClick={(e) => handleNav(e, null)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Homepage</span>
        </a>
      </div>

      {/* Directory of valid tools */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Available OwnPDF Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
          {toolRoutes.map((tool) => (
            <a
              key={tool.toolId}
              href={getPathForTool(tool.toolId, baseUrl)}
              onClick={(e) => handleNav(e, tool.toolId)}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition flex items-center justify-between group shadow-2xs"
            >
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                  {tool.name}
                </h3>
                <p className="text-[10px] text-slate-500 line-clamp-1">{tool.slug}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-1 transition shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
