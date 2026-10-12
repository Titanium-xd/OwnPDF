import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pdfEngine, PdfEngine } from '../engine/pdf-engine';
import { qpdfClient } from '../engine/qpdf-client';
import {
  toolRoutes,
  homeRoute,
  getRouteFromPathname,
  isInvalidRoute,
  getPathForTool,
  ToolId,
} from '../config/routes';

export type { ToolId };

export interface SessionFile {
  id: string;
  name: string;
  size: number;
  data: Uint8Array;
  isEncrypted: boolean;
  pageCount: number;
  previewUrl?: string;
}

export interface ToolState {
  effectiveFiles: SessionFile[];
  activeFile: SessionFile | null;
  source: 'home' | 'tool' | null;
  hasHomeFiles: boolean;
}

interface SessionContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  // Global Homepage Session Files
  files: SessionFile[];
  addFile: (file: File) => Promise<SessionFile>;
  addMultipleFiles: (files: File[]) => Promise<SessionFile[]>;
  removeFile: (id: string) => void;
  clearSession: () => void;
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
  selectedFile: SessionFile | null;
  totalMemoryBytes: number;
  viewMode: 'app' | 'prototype';
  setViewMode: (mode: 'app' | 'prototype') => void;
  isNotFound: boolean;
  setIsNotFound: (notFound: boolean) => void;

  // Per-Tool File Management (Priority 7)
  toolFiles: Record<string, SessionFile[]>;
  toolSource: Record<string, 'home' | 'tool' | null>;
  toolActiveFileId: Record<string, string | null>;
  addToolFile: (toolId: string, file: File) => Promise<SessionFile>;
  addMultipleToolFiles: (toolId: string, files: File[]) => Promise<SessionFile[]>;
  setToolSource: (toolId: string, source: 'home' | 'tool' | null) => void;
  setToolActiveFileId: (toolId: string, fileId: string | null) => void;
  removeToolFile: (toolId: string, fileId: string) => void;
  reorderToolFiles: (toolId: string, fromIndex: number, toIndex: number) => void;
  clearToolFiles: (toolId: string) => void;
  getToolState: (toolId: string) => ToolState;
}

const SessionContext = createContext<SessionContextType | null>(null);

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('ownpdf_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'light';
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const baseUrl = import.meta.env.BASE_URL || '/';

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [files, setFiles] = useState<SessionFile[]>([]);
  const [activeTool, setActiveToolState] = useState<ToolId | null>(() => {
    if (typeof window === 'undefined') return null;
    const initialRoute = getRouteFromPathname(window.location.pathname, baseUrl);
    return initialRoute ? initialRoute.toolId : null;
  });
  const [isNotFound, setIsNotFound] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isInvalidRoute(window.location.pathname, baseUrl);
  });
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'app' | 'prototype'>('app');

  // Per-tool independent state
  const [toolFiles, setToolFiles] = useState<Record<string, SessionFile[]>>({});
  const [toolSource, setToolSourceState] = useState<Record<string, 'home' | 'tool' | null>>({});
  const [toolActiveFileId, setToolActiveFileIdState] = useState<Record<string, string | null>>({});

  const updateDocumentMetadata = useCallback((tool: ToolId | null) => {
    if (typeof document === 'undefined') return;
    if (tool) {
      const route = toolRoutes.find((r) => r.toolId === tool);
      if (route) {
        document.title = route.title;
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        if (canonicalEl) {
          canonicalEl.setAttribute('href', route.canonicalUrl);
        }
      }
    } else {
      document.title = homeRoute.title;
      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) {
        canonicalEl.setAttribute('href', homeRoute.canonicalUrl);
      }
    }
  }, []);

  const setActiveTool = useCallback(
    (tool: ToolId | null) => {
      setActiveToolState(tool);
      setIsNotFound(false);
      if (typeof window !== 'undefined') {
        const targetPath = getPathForTool(tool, baseUrl);
        if (window.location.pathname !== targetPath) {
          window.history.pushState({}, '', targetPath);
        }
      }
      updateDocumentMetadata(tool);
    },
    [baseUrl, updateDocumentMetadata]
  );

  // Synchronize browser history (Back / Forward)
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPathname(window.location.pathname, baseUrl);
      const invalid = isInvalidRoute(window.location.pathname, baseUrl);
      setIsNotFound(invalid);
      setActiveToolState(route ? route.toolId : null);
      updateDocumentMetadata(route ? route.toolId : null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [baseUrl, updateDocumentMetadata]);

  // Initial metadata sync on mount if initial tool was set
  useEffect(() => {
    if (activeTool) {
      updateDocumentMetadata(activeTool);
    }
  }, []);

  // Synchronize document theme class and localStorage
  const applyTheme = useCallback((targetTheme: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    if (targetTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('ownpdf_theme', targetTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Helper to construct a SessionFile from File
  const parseFileToSessionFile = async (file: File): Promise<SessionFile> => {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    const isPdf = PdfEngine.isValidPdfHeader(data);
    let isEncrypted = false;
    let pageCount = 0;

    if (isPdf) {
      isEncrypted = await pdfEngine.isEncrypted(data);
      if (!isEncrypted) {
        try {
          const info = await pdfEngine.inspectPdf(data);
          pageCount = info.pageCount;
        } catch {
          pageCount = 1;
        }
      }
    }

    const blob = new Blob([data], { type: file.type || 'application/pdf' });
    const previewUrl = URL.createObjectURL(blob);

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: file.name,
      size: file.size,
      data,
      isEncrypted,
      pageCount,
      previewUrl,
    };
  };

  // Add a single file to Homepage session queue
  const addFile = useCallback(async (file: File): Promise<SessionFile> => {
    const sessionFile = await parseFileToSessionFile(file);
    setFiles((prev) => [sessionFile, ...prev]);
    setSelectedFileId(sessionFile.id);
    return sessionFile;
  }, []);

  // Add multiple files to Homepage session queue
  const addMultipleFiles = useCallback(
    async (fileList: File[]): Promise<SessionFile[]> => {
      const added: SessionFile[] = [];
      for (const f of fileList) {
        try {
          const item = await addFile(f);
          added.push(item);
        } catch (err) {
          console.error(`Failed to load file ${f.name}:`, err);
        }
      }
      return added;
    },
    [addFile]
  );

  // Remove a file from Homepage queue
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
    setSelectedFileId((current) => (current === id ? null : current));
  }, []);

  // PER-TOOL METHODS (Priority 7)

  // Add single file directly inside tool: overrides homepage for this tool without altering homepage
  const addToolFile = useCallback(async (toolId: string, file: File): Promise<SessionFile> => {
    const sessionFile = await parseFileToSessionFile(file);
    setToolFiles((prev) => {
      const current = prev[toolId] || [];
      return { ...prev, [toolId]: [sessionFile, ...current] };
    });
    setToolSourceState((prev) => ({ ...prev, [toolId]: 'tool' }));
    setToolActiveFileIdState((prev) => ({ ...prev, [toolId]: sessionFile.id }));
    return sessionFile;
  }, []);

  // Add multiple files directly inside tool
  const addMultipleToolFiles = useCallback(async (toolId: string, fileList: File[]): Promise<SessionFile[]> => {
    const added: SessionFile[] = [];
    for (const f of fileList) {
      try {
        const item = await parseFileToSessionFile(f);
        added.push(item);
      } catch (err) {
        console.error(`Failed to load tool file ${f.name}:`, err);
      }
    }
    if (added.length > 0) {
      setToolFiles((prev) => {
        const current = prev[toolId] || [];
        return { ...prev, [toolId]: [...added, ...current] };
      });
      setToolSourceState((prev) => ({ ...prev, [toolId]: 'tool' }));
      setToolActiveFileIdState((prev) => ({
        ...prev,
        [toolId]: prev[toolId] || added[0].id,
      }));
    }
    return added;
  }, []);

  // Select tool source ('home' or 'tool' or reset null)
  const setToolSource = useCallback((toolId: string, source: 'home' | 'tool' | null) => {
    setToolSourceState((prev) => ({ ...prev, [toolId]: source }));
    if (source === 'home') {
      // Pick first home file as active target if not set
      setToolActiveFileIdState((prev) => ({
        ...prev,
        [toolId]: prev[toolId] || (files[0]?.id || null),
      }));
    } else if (source === 'tool') {
      setToolActiveFileIdState((prev) => ({
        ...prev,
        [toolId]: prev[toolId] || (toolFiles[toolId]?.[0]?.id || null),
      }));
    }
  }, [files, toolFiles]);

  const setToolActiveFileId = useCallback((toolId: string, fileId: string | null) => {
    setToolActiveFileIdState((prev) => ({ ...prev, [toolId]: fileId }));
  }, []);

  const removeToolFile = useCallback((toolId: string, fileId: string) => {
    setToolFiles((prev) => {
      const current = prev[toolId] || [];
      const item = current.find((f) => f.id === fileId);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      const filtered = current.filter((f) => f.id !== fileId);
      return { ...prev, [toolId]: filtered };
    });
    setToolActiveFileIdState((prev) => {
      if (prev[toolId] === fileId) {
        const remaining = (toolFiles[toolId] || []).filter((f) => f.id !== fileId);
        return { ...prev, [toolId]: remaining[0]?.id || null };
      }
      return prev;
    });
  }, [toolFiles]);

  const reorderToolFiles = useCallback((toolId: string, fromIndex: number, toIndex: number) => {
    setToolFiles((prev) => {
      const list = [...(prev[toolId] || [])];
      if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
        return prev;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...prev, [toolId]: list };
    });
  }, []);

  const clearToolFiles = useCallback((toolId: string) => {
    setToolFiles((prev) => {
      const list = prev[toolId] || [];
      for (const item of list) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return { ...prev, [toolId]: [] };
    });
    setToolSourceState((prev) => ({ ...prev, [toolId]: null }));
    setToolActiveFileIdState((prev) => ({ ...prev, [toolId]: null }));
  }, []);

  // Compute effective files and active target for a given tool
  const getToolState = useCallback((toolId: string): ToolState => {
    const customFiles = toolFiles[toolId] || [];
    const sourceChoice = toolSource[toolId];
    const hasHomeFiles = files.length > 0;

    // Rule: If user uploaded files inside tool OR chose tool source -> use tool files
    if (sourceChoice === 'tool' || (customFiles.length > 0 && sourceChoice !== 'home')) {
      const activeId = toolActiveFileId[toolId];
      const active = customFiles.find((f) => f.id === activeId) || (customFiles.length === 1 ? customFiles[0] : null);
      return {
        effectiveFiles: customFiles,
        activeFile: active,
        source: 'tool',
        hasHomeFiles,
      };
    }

    // Rule: If user explicitly chose home files
    if (sourceChoice === 'home') {
      const activeId = toolActiveFileId[toolId];
      const active = files.find((f) => f.id === activeId) || (files.length === 1 ? files[0] : null);
      return {
        effectiveFiles: files,
        activeFile: active,
        source: 'home',
        hasHomeFiles,
      };
    }

    // No source choice made yet
    return {
      effectiveFiles: [],
      activeFile: null,
      source: null,
      hasHomeFiles,
    };
  }, [files, toolFiles, toolSource, toolActiveFileId]);

  // Comprehensive Clear Session
  const clearSession = useCallback(() => {
    // Revoke all home object URLs
    for (const f of files) {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    }
    // Revoke all tool-specific object URLs
    Object.values(toolFiles).forEach((list) => {
      list.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    });

    setFiles([]);
    setSelectedFileId(null);
    setToolFiles({});
    setToolSourceState({});
    setToolActiveFileIdState({});
    setActiveTool(null);
    qpdfClient.terminate();
  }, [files, toolFiles, setActiveTool]);

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0] || null;

  // Calculate total memory across both home and per-tool files
  const toolMemoryBytes = Object.values(toolFiles).reduce(
    (total, list) => total + list.reduce((sub, f) => sub + f.size, 0),
    0
  );
  const totalMemoryBytes = files.reduce((acc, f) => acc + f.size, 0) + toolMemoryBytes;

  return (
    <SessionContext.Provider
      value={{
        theme,
        toggleTheme,
        files,
        addFile,
        addMultipleFiles,
        removeFile,
        clearSession,
        activeTool,
        setActiveTool,
        selectedFileId,
        setSelectedFileId,
        selectedFile,
        totalMemoryBytes,
        viewMode,
        setViewMode,
        isNotFound,
        setIsNotFound,
        toolFiles,
        toolSource,
        toolActiveFileId,
        addToolFile,
        addMultipleToolFiles,
        setToolSource,
        setToolActiveFileId,
        removeToolFile,
        reorderToolFiles,
        clearToolFiles,
        getToolState,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
};
