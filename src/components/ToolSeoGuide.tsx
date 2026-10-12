import React from 'react';
import { toolRoutes, getPathForTool, isModifiedEvent } from '../config/routes';
import { useSession } from '../context/SessionContext';
import type { ToolId } from '../context/SessionContext';
import { ShieldCheck, Info, ArrowRight, ArrowLeft } from 'lucide-react';

interface ToolSeoGuideProps {
  toolId: ToolId;
}

export const ToolSeoGuide: React.FC<ToolSeoGuideProps> = ({ toolId }) => {
  const { setActiveTool } = useSession();
  const route = toolRoutes.find((r) => r.toolId === toolId);
  const baseUrl = import.meta.env.BASE_URL || '/';

  if (!route) return null;

  const relatedRoutes = toolRoutes.filter((r) => route.relatedToolIds.includes(r.toolId));

  const handleToolLinkClick = (e: React.MouseEvent, targetToolId: ToolId | null) => {
    if (isModifiedEvent(e)) return;
    e.preventDefault();
    setActiveTool(targetToolId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      aria-labelledby="tool-guide-heading"
      className="mt-12 pt-10 border-t border-slate-200/80 dark:border-slate-800/80 space-y-10"
    >
      {/* Educational Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
          <Info className="w-3.5 h-3.5" />
          <span>Tool Guide & Documentation</span>
        </div>
        <h2
          id="tool-guide-heading"
          className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white"
        >
          About {route.name}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {route.shortDescription}
        </p>
      </div>

      {/* Step-by-Step Instructions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          How to Use {route.name}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {route.instructions.map((inst) => (
            <div
              key={inst.step}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-500 text-white font-bold text-xs flex items-center justify-center">
                {inst.step}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {inst.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {inst.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Guarantees & Technical Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Privacy Section */}
        <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Local-First Privacy Guarantees</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
            {route.privacyNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>

        {/* Technical Limitations Section */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Technical Notes & Limitations</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
            {route.limitations.map((limit, idx) => (
              <li key={idx}>{limit}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Related Tools & Navigation */}
      {relatedRoutes.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Related PDF Tools
            </h2>
            <a
              href={getPathForTool(null, baseUrl)}
              onClick={(e) => handleToolLinkClick(e, null)}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to all tools</span>
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedRoutes.map((rel) => (
              <a
                key={rel.toolId}
                href={getPathForTool(rel.toolId, baseUrl)}
                onClick={(e) => handleToolLinkClick(e, rel.toolId)}
                className="group p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition flex items-center justify-between shadow-2xs"
              >
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                    {rel.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {rel.h1}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-1 transition shrink-0 ml-2" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
