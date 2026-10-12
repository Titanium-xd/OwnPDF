import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { bookmarksEngine } from '../../engine/bookmarks-engine';
import { ToolFileSelector } from '../ToolFileSelector';
import { downloadPdf, sanitizeDownloadFilename } from '../../utils/download';
import type { BookmarkItem } from '../../types/engine';
import {
  Bookmark,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  CornerDownRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const BookmarksTool: React.FC = () => {
  const { getToolState } = useSession();
  const toolState = getToolState('bookmarks');
  const { activeFile } = toolState;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [replaceExisting] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFile) {
      setBookmarks([]);
      setErrorMsg(null);
      setSuccessMsg(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    bookmarksEngine
      .getBookmarks(activeFile.data)
      .then((existing) => {
        if (!isCancelled) {
          if (existing.length > 0) {
            setBookmarks(existing);
          } else {
            // Default initial empty bookmark pointing to page 1
            setBookmarks([
              {
                id: `bm_${Date.now()}`,
                title: 'Introduction',
                targetPageNumber: 1,
                level: 0,
                children: [],
              },
            ]);
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load bookmarks:', err);
          setErrorMsg(err?.message || 'Failed to inspect document outlines.');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.id]);

  const addTopLevelBookmark = () => {
    const newId = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const nextPg = Math.min(
      activeFile?.pageCount || 1,
      bookmarks.length > 0
        ? bookmarks[bookmarks.length - 1].targetPageNumber + 1
        : 1
    );

    setBookmarks((prev) => [
      ...prev,
      {
        id: newId,
        title: `Chapter ${prev.length + 1}`,
        targetPageNumber: nextPg,
        level: 0,
        children: [],
      },
    ]);
  };

  const addChildBookmark = (parentId: string) => {
    const parent = bookmarks.find((b) => b.id === parentId);
    if (!parent) return;

    const childId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const updated = bookmarks.map((b) => {
      if (b.id === parentId) {
        const children = b.children || [];
        return {
          ...b,
          children: [
            ...children,
            {
              id: childId,
              title: `Section ${children.length + 1}`,
              targetPageNumber: b.targetPageNumber,
              level: 1,
            },
          ],
        };
      }
      return b;
    });

    setBookmarks(updated);
  };

  const removeBookmark = (id: string, parentId?: string) => {
    if (parentId) {
      setBookmarks((prev) =>
        prev.map((b) => {
          if (b.id === parentId) {
            return {
              ...b,
              children: (b.children || []).filter((c) => c.id !== id),
            };
          }
          return b;
        })
      );
    } else {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const updateBookmark = (
    id: string,
    updates: Partial<BookmarkItem>,
    parentId?: string
  ) => {
    if (parentId) {
      setBookmarks((prev) =>
        prev.map((b) => {
          if (b.id === parentId) {
            return {
              ...b,
              children: (b.children || []).map((c) =>
                c.id === id ? { ...c, ...updates } : c
              ),
            };
          }
          return b;
        })
      );
    } else {
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    }
  };

  const handleSaveAndDownload = async () => {
    if (!activeFile) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const result = await bookmarksEngine.addBookmarks(activeFile.data, {
        bookmarks,
        replaceExisting,
      });

      const baseName = activeFile.name.replace(/\.[^/.]+$/, '');
      const filename = sanitizeDownloadFilename(`${baseName}_bookmarks.pdf`);
      await downloadPdf(result.pdfData, filename);

      setSuccessMsg(
        `Bookmarks applied successfully! Generated ${result.totalBookmarksCount} outline item(s).`
      );
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Bookmarks generation failed:', err);
      setErrorMsg(err?.message || 'Failed to create document bookmarks.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = activeFile?.pageCount || 1;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <ToolFileSelector
        toolId="bookmarks"
        description="Create structured navigation bookmarks and outlines that open automatically in PDF readers."
      />

      {activeFile && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-500" />
                Document Outline Tree
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure chapters and subsections with target page numbers.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={addTopLevelBookmark}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Chapter
              </button>

              <button
                type="button"
                onClick={handleSaveAndDownload}
                disabled={isSaving || bookmarks.length === 0}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Outlines...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Save & Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Inspecting existing PDF bookmarks...
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
              <Bookmark className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No bookmarks in document.
              </p>
              <button
                type="button"
                onClick={addTopLevelBookmark}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create First Bookmark
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bm, idx) => (
                <div
                  key={bm.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 font-semibold w-6">
                      #{idx + 1}
                    </span>

                    <input
                      type="text"
                      value={bm.title}
                      onChange={(e) => updateBookmark(bm.id, { title: e.target.value })}
                      placeholder="Chapter title..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <span>Page:</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={bm.targetPageNumber}
                        onChange={(e) =>
                          updateBookmark(bm.id, {
                            targetPageNumber: Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)),
                          })
                        }
                        className="w-16 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono text-center focus:outline-none"
                      />
                      <span className="text-slate-400">/ {totalPages}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => addChildBookmark(bm.id)}
                      className="px-2.5 py-1.5 text-xs bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                      title="Add Subsection"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Sub-section
                    </button>

                    <button
                      type="button"
                      onClick={() => removeBookmark(bm.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded transition-colors"
                      title="Delete Chapter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nested Subsections */}
                  {bm.children && bm.children.length > 0 && (
                    <div className="pl-8 space-y-2 border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-3">
                      {bm.children.map((child) => (
                        <div key={child.id} className="flex flex-wrap items-center gap-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <input
                            type="text"
                            value={child.title}
                            onChange={(e) =>
                              updateBookmark(child.id, { title: e.target.value }, bm.id)
                            }
                            placeholder="Section title..."
                            className="flex-1 min-w-[180px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                          />

                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <span>Page:</span>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={child.targetPageNumber}
                              onChange={(e) =>
                                updateBookmark(
                                  child.id,
                                  {
                                    targetPageNumber: Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)),
                                  },
                                  bm.id
                                )
                              }
                              className="w-14 px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-xs font-mono text-center focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeBookmark(child.id, bm.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors"
                            title="Delete Subsection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 flex items-center gap-3 text-sm text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
