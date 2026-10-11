import type {
  WorkerRpcRequest,
  WorkerRpcResponse,
  QpdfWorkerAction,
} from '../types/engine';
import { PdfError } from '../types/engine';

export class QpdfWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: ArrayBuffer) => void;
      reject: (err: Error) => void;
      timeoutId: any;
    }
  >();
  private requestCounter = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/qpdf.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent<WorkerRpcResponse>) => {
        const res = e.data;
        const pending = this.pendingRequests.get(res.id);
        if (!pending) return;

        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(res.id);

        if (res.ok) {
          pending.resolve(res.output);
        } else {
          pending.reject(new PdfError(res.code, res.error, res.details));
        }
      };

      this.worker.onerror = (err) => {
        console.error('QPDF Web Worker uncaught error:', err);
        // Reject all pending
        for (const [id, pending] of this.pendingRequests.entries()) {
          clearTimeout(pending.timeoutId);
          pending.reject(
            new PdfError(
              'UNKNOWN_ERROR',
              'The background processing worker encountered an unrecoverable error.'
            )
          );
          this.pendingRequests.delete(id);
        }
        this.terminate();
      };
    }
    return this.worker;
  }

  public async execute(action: QpdfWorkerAction): Promise<ArrayBuffer> {
    const worker = this.getWorker();
    const id = `req_${++this.requestCounter}_${Date.now()}`;

    return new Promise<ArrayBuffer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.terminate(); // Force kill unresponsive worker
          reject(
            new PdfError(
              'TIMEOUT',
              'The operation timed out after 60 seconds.'
            )
          );
        }
      }, 60000);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      const req: WorkerRpcRequest = {
        id,
        ...action,
      };

      // Transfer ArrayBuffer for zero-copy efficiency
      worker.postMessage(req, [action.fileData]);
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new PdfError('UNKNOWN_ERROR', 'Operation was cancelled.'));
    }
    this.pendingRequests.clear();
  }
}

// Global singleton client
export const qpdfClient = new QpdfWorkerClient();
