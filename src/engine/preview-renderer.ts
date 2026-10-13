import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker URL to point to our local static asset in public/
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;
}

/**
 * Returns standard PDF.js loading parameters ensuring local static assets for fonts,
 * CMaps, and proper font-face handling in browser environments.
 */
export function getPdfJsLoadingParams(data: Uint8Array) {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && 'fonts' in document;
  const baseUrl = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/OwnPDF/';
  return {
    data: new Uint8Array(data),
    // Critical: enable @font-face in browser so embedded subset fonts render correctly on canvas.
    // Only disable in headless Node.js unit test environments.
    disableFontFace: !isBrowser,
    cMapUrl: isBrowser ? `${baseUrl}cmaps/` : undefined,
    cMapPacked: true,
    standardFontDataUrl: isBrowser ? `${baseUrl}standard_fonts/` : undefined,
    isEvalSupported: false,
  };
}

/**
 * Global cache of PDFDocumentProxy instances by Uint8Array buffer.
 * Avoids re-parsing multi-megabyte PDFs on every page turn or thumbnail render.
 */
export class PdfDocumentSession {
  private static sessions = new WeakMap<Uint8Array, Promise<pdfjsLib.PDFDocumentProxy>>();

  public static getDocument(data: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    let existing = this.sessions.get(data);
    if (!existing) {
      const params = getPdfJsLoadingParams(data);
      const loadingTask = pdfjsLib.getDocument(params);
      existing = loadingTask.promise;
      this.sessions.set(data, existing);
    }
    return existing;
  }
}

// Track active render tasks per canvas to cancel pending renders on rapid navigation
const activeRenderTasks = new WeakMap<HTMLCanvasElement, any>();

export interface RenderPageOptions {
  scale?: number;
  maxDimension?: number;
  pdfDoc?: pdfjsLib.PDFDocumentProxy;
  annotationMode?: number;
}

export interface RenderPageResult {
  width: number;
  height: number;
  viewport: any;
  page: pdfjsLib.PDFPageProxy;
}

export async function renderPdfPageToCanvas(
  pdfData: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  options: RenderPageOptions = {}
): Promise<RenderPageResult> {
  // 1. Cancel any active render on this canvas to prevent collision exceptions
  const ongoing = activeRenderTasks.get(canvas);
  if (ongoing) {
    try {
      ongoing.cancel();
    } catch {
      // Ignore cancellation exceptions
    }
    activeRenderTasks.delete(canvas);
  }

  // 2. Obtain PDF document from session or options
  const pdfDoc = options.pdfDoc || (await PdfDocumentSession.getDocument(pdfData));
  const page = await pdfDoc.getPage(pageNumber);

  let viewport = page.getViewport({ scale: options.scale || 1.0 });

  // If a max dimension is given, recalculate scale
  if (options.maxDimension) {
    const maxSide = Math.max(viewport.width, viewport.height);
    const scale = options.maxDimension / maxSide;
    viewport = page.getViewport({ scale });
  }

  // Handle HiDPI displays
  const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.save();
  ctx.scale(outputScale, outputScale);

  const renderContext = {
    canvasContext: ctx,
    viewport,
    annotationMode: options.annotationMode ?? ((pdfjsLib as any).AnnotationMode?.ENABLE ?? 1),
  };

  const renderTask = page.render(renderContext as any);
  activeRenderTasks.set(canvas, renderTask);

  try {
    await renderTask.promise;
  } catch (err: any) {
    if (err?.name === 'RenderingCancelledException') {
      // Render cancelled by user navigating away; return clean result
      return {
        width: viewport.width,
        height: viewport.height,
        viewport,
        page,
      };
    }
    throw err;
  } finally {
    ctx.restore();
    if (activeRenderTasks.get(canvas) === renderTask) {
      activeRenderTasks.delete(canvas);
    }
  }

  return {
    width: viewport.width,
    height: viewport.height,
    viewport,
    page,
  };
}

/**
 * Cleanly releases canvas backing buffer memory and cancels any pending render tasks.
 */
export function clearCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ongoing = activeRenderTasks.get(canvas);
  if (ongoing) {
    try {
      ongoing.cancel();
    } catch {
      // Ignore cancellation exceptions
    }
    activeRenderTasks.delete(canvas);
  }
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}
