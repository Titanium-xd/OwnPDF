import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker URL to point to our local static asset in public/
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;
}

export interface RenderPageOptions {
  scale?: number;
  maxDimension?: number;
}

export async function renderPdfPageToCanvas(
  pdfData: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  options: RenderPageOptions = {}
): Promise<{ width: number; height: number }> {
  // Ensure we copy the data buffer to prevent detachment issues
  const dataCopy = new Uint8Array(pdfData);

  const loadingTask = pdfjsLib.getDocument({
    data: dataCopy,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  let viewport = page.getViewport({ scale: options.scale || 1.0 });

  // If a max dimension is given, recalculate scale
  if (options.maxDimension) {
    const maxSide = Math.max(viewport.width, viewport.height);
    const scale = options.maxDimension / maxSide;
    viewport = page.getViewport({ scale });
  }

  // Handle HiDPI displays
  const outputScale = window.devicePixelRatio || 1;
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
  };

  await page.render(renderContext as any).promise;
  ctx.restore();

  return {
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Cleanly releases canvas backing buffer memory.
 */
export function clearCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}
