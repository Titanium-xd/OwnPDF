import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import type { ToolId } from '../context/SessionContext';
import {
  Unlock,
  Lock,
  Layers,
  Scissors,
  Grid,
  Image,
  Minimize2,
  FileSearch,
  Search,
  ArrowRight,
} from 'lucide-react';

interface ToolItem {
  id: ToolId;
  name: string;
  category: 'Security' | 'Organize' | 'Convert' | 'Optimize' | 'Inspect';
  description: string;
  icon: React.ReactNode;
  badge?: string;
  gradient: string;
}

export const toolsData: ToolItem[] = [
  {
    id: 'unlock',
    name: 'Unlock PDF',
    category: 'Security',
    description: 'Remove opening passwords from protected PDFs (such as e-Aadhaar, bank statements, or invoices) with local WebAssembly.',
    icon: <Unlock className="w-5 h-5 text-emerald-500" />,
    badge: 'Popular',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    category: 'Security',
    description: 'Apply industry-standard AES-256 encryption with a password to restrict unauthorized opening.',
    icon: <Lock className="w-5 h-5 text-sky-500" />,
    gradient: 'from-sky-500/10 to-sky-500/5',
  },
  {
    id: 'merge',
    name: 'Merge PDF',
    category: 'Organize',
    description: 'Combine multiple certificates, assignments, or documents into a single ordered PDF file.',
    icon: <Layers className="w-5 h-5 text-blue-500" />,
    gradient: 'from-blue-500/10 to-blue-500/5',
  },
  {
    id: 'split',
    name: 'Split & Extract',
    category: 'Organize',
    description: 'Extract specific page ranges (e.g., 1-3, 5, 8-10) or split every page into individual files with ZIP export.',
    icon: <Scissors className="w-5 h-5 text-amber-500" />,
    gradient: 'from-amber-500/10 to-amber-500/5',
  },
  {
    id: 'organize',
    name: 'Organize Pages',
    category: 'Organize',
    description: 'Visual thumbnail gallery to rotate pages 90°, delete unnecessary sheets, and drag pages to reorder.',
    icon: <Grid className="w-5 h-5 text-cyan-500" />,
    badge: 'Interactive',
    gradient: 'from-cyan-500/10 to-cyan-500/5',
  },
  {
    id: 'images',
    name: 'Images to PDF',
    category: 'Convert',
    description: 'Convert JPG, JPEG, and PNG images into a clean, single-document PDF with custom margins and page sizing.',
    icon: <Image className="w-5 h-5 text-rose-500" />,
    gradient: 'from-rose-500/10 to-rose-500/5',
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    category: 'Optimize',
    description: 'Lossless structural linearization and object stream optimization. Honest size reduction metrics without quality loss.',
    icon: <Minimize2 className="w-5 h-5 text-sky-500" />,
    gradient: 'from-sky-500/10 to-sky-500/5',
  },
  {
    id: 'inspect',
    name: 'Inspect & Sanitize',
    category: 'Inspect',
    description: 'Inspect catalog properties, page count, PDF version, and strip sensitive tracking metadata (Title, Author, Producer).',
    icon: <FileSearch className="w-5 h-5 text-teal-500" />,
    gradient: 'from-teal-500/10 to-teal-500/5',
  },
];

export const ToolGrid: React.FC = () => {
  const { setActiveTool } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', 'Security', 'Organize', 'Convert', 'Optimize', 'Inspect'];

  const filteredTools = toolsData.filter((tool) => {
    const matchesCategory =
      selectedCategory === 'All' || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
          />
        </div>
      </div>

      {/* Grid of Tool Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className="group relative p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${tool.gradient} border border-slate-200/50 dark:border-slate-700/40 group-hover:scale-105 transition`}>
                  {tool.icon}
                </div>
                {tool.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                    {tool.badge}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                {tool.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                {tool.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
              <span className="text-[11px] font-medium text-slate-400">{tool.category}</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition duration-200">
                Launch <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
