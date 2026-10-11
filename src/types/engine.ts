export type PdfErrorCode =
  | 'INCORRECT_PASSWORD'
  | 'ENCRYPTED_DOCUMENT'
  | 'CORRUPTED_DOCUMENT'
  | 'OUT_OF_MEMORY'
  | 'TIMEOUT'
  | 'UNSUPPORTED_FORMAT'
  | 'UNKNOWN_ERROR';

export class PdfError extends Error {
  code: PdfErrorCode;
  details?: string;

  constructor(code: PdfErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'PdfError';
    this.code = code;
    this.details = details;
  }
}

export interface ProtectOptions {
  userPassword?: string;
  ownerPassword?: string;
  keyLength?: 128 | 256;
}

export interface UnlockResult {
  unlockedData: Uint8Array;
  originalSize: number;
  unlockedSize: number;
}

export interface PageOperation {
  pageIndex: number; // 0-indexed
  rotationDelta?: 90 | 180 | 270;
  delete?: boolean;
}

export interface SplitResult {
  filename: string;
  data: Uint8Array;
  pageCount: number;
}

export interface ImageInput {
  name: string;
  data: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
}

export interface ImageToPdfOptions {
  pageSize?: 'A4' | 'LETTER' | 'FIT';
  orientation?: 'portrait' | 'landscape' | 'auto';
  margin?: number;
}

export interface CompressResult {
  compressedData: Uint8Array;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savingsPercent: number;
  isSmaller: boolean;
}

export interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  isEncrypted: boolean;
  pdfVersion?: string;
  pageSize?: { width: number; height: number };
}

// Worker RPC Messages
export type QpdfWorkerAction =
  | { type: 'DECRYPT'; fileData: ArrayBuffer; password: string }
  | { type: 'ENCRYPT'; fileData: ArrayBuffer; userPassword?: string; ownerPassword?: string; keyLength?: 128 | 256 }
  | { type: 'OPTIMIZE'; fileData: ArrayBuffer };

export type WorkerRpcRequest = {
  id: string;
} & QpdfWorkerAction;

export type WorkerRpcResponse =
  | { id: string; ok: true; output: ArrayBuffer }
  | { id: string; ok: false; error: string; code: PdfErrorCode; details?: string };
