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

export type PageNumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type PageNumberFormat =
  | 'NUMBER_ONLY'
  | 'PAGE_N'
  | 'PAGE_N_OF_TOTAL'
  | 'N_OF_TOTAL';

export interface PageNumberOptions {
  position?: PageNumberPosition;
  startNumber?: number;
  format?: PageNumberFormat;
  fontSize?: number;
  margin?: number;
  pageRange?: string;
  color?: { r: number; g: number; b: number };
}

export interface RotateOptions {
  rotationAngle: 90 | 180 | 270;
  pageRange?: string;
  perPageRotations?: Map<number, number>;
}

export interface WatermarkTextOptions {
  type: 'text';
  text: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  rotationDegrees?: number;
  pageRange?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface WatermarkImageOptions {
  type: 'image';
  imageData: Uint8Array;
  imageType: 'image/png' | 'image/jpeg';
  scale?: number;
  opacity?: number;
  rotationDegrees?: number;
  pageRange?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export type WatermarkOptions = WatermarkTextOptions | WatermarkImageOptions;

export interface PdfToImagesOptions {
  format: 'image/jpeg' | 'image/png';
  scale?: number;
  quality?: number;
  pageRange?: string;
  onProgress?: (current: number, total: number) => void;
}

export interface RenderedImage {
  pageNumber: number;
  blob: Blob;
  filename: string;
}

export interface ExtractTextOptions {
  pageRange?: string;
}

export interface ExtractTextResult {
  text: string;
  pageCount: number;
  wordCount: number;
  characterCount: number;
  isEmpty: boolean;
}

export interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropPdfOptions {
  margins: CropMargins;
  isPercentage?: boolean;
  pageRange?: string;
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

// Batch 1: Find & Replace Text Types
export type MatchStatus = 'VALID' | 'AMBIGUOUS_COORDINATES' | 'UNSUPPORTED_LAYOUT' | 'CONFLICT';

export interface FindReplaceRule {
  id: string;
  searchQuery: string;
  replaceText: string;
  matchCase?: boolean;
}

export interface TextMatchOccurrence {
  id: string;
  ruleId?: string;
  ruleIndex?: number;
  pageIndex: number; // 0-indexed
  pageNumber: number; // 1-indexed
  text: string;
  replaceText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  rotation: number;
  snippet: string;
  status: MatchStatus;
  collisionWarning?: boolean;
  isConflicting?: boolean;
  conflictReason?: string;
  selected?: boolean;
}

export interface FindReplaceOptions {
  searchQuery?: string;
  replaceText?: string;
  matchCase?: boolean;
  rules?: FindReplaceRule[];
  selectedOccurrenceIds?: string[];
  backgroundColor?: { r: number; g: number; b: number };
}

export interface RuleReport {
  ruleId: string;
  searchQuery: string;
  replaceText: string;
  totalMatches: number;
  replacedCount: number;
  skippedCount: number;
  unsupportedCount: number;
  collisionCount: number;
  conflictCount: number;
}

export interface FindReplaceResult {
  pdfData: Uint8Array;
  totalMatches: number;
  replacedCount: number;
  skippedCount: number;
  collisionCount: number;
  conflictCount?: number;
  ruleReports?: RuleReport[];
  occurrences: TextMatchOccurrence[];
}

// Batch 1: Reverse Pages Types
export type ReverseMode = 'all' | 'range' | 'duplex-inverted';

export interface ReversePagesOptions {
  mode: ReverseMode;
  pageRange?: string; // e.g. "3-6"
}

// Batch 1: Delete Blank Pages Types
export type BlankPageConfidence = 'HIGH_CONFIDENCE_BLANK' | 'POSSIBLE_NOISE' | 'HAS_CONTENT';

export interface BlankPageCandidate {
  pageIndex: number;
  pageNumber: number;
  inkCoverage: number; // Percentage 0 - 100
  textGlyphCount: number;
  status: BlankPageConfidence;
  selected: boolean;
}

export interface DetectBlankPagesOptions {
  threshold?: number; // default 0.15% ink coverage
}

export interface DetectBlankPagesResult {
  candidates: BlankPageCandidate[];
  blankCount: number;
  totalPages: number;
}

// Batch 1: Resize PDF Types
export type StandardPageSize = 'A4' | 'LETTER' | 'A3' | 'A5' | 'LEGAL' | 'TABLOID';
export type ResizeMode = 'fit' | 'fill-crop' | 'canvas';

export interface ResizePdfOptions {
  targetSize: StandardPageSize | { width: number; height: number };
  mode: ResizeMode;
  orientation?: 'portrait' | 'landscape' | 'keep';
  margin?: number; // in pt (default 0)
  pageRange?: string;
}

// Batch 1: Extract Images Types
export interface ExtractedImageItem {
  id: string;
  pageNumber: number;
  name: string;
  format: 'jpeg' | 'png';
  width: number;
  height: number;
  sizeBytes: number;
  data: Uint8Array;
  blob: Blob;
  isDeduplicated?: boolean;
  status: 'SUCCESS' | 'FAILED_CORRUPT';
}

export interface ExtractImagesResult {
  images: ExtractedImageItem[];
  totalCount: number;
  totalBytes: number;
  zipBlob?: Blob;
}

// Batch 1: Extract Links Types
export type LinkType = 'external' | 'internal' | 'text-url';

export interface ExtractedLinkItem {
  id: string;
  pageNumber: number;
  type: LinkType;
  text: string;
  url: string;
  destPageNumber?: number;
}

export interface ExtractLinksResult {
  links: ExtractedLinkItem[];
  totalCount: number;
  uniqueCount: number;
}

// Phase 5: Compare PDFs Types
export type PageDiffStatus = 'IDENTICAL' | 'TEXT_DIFF_ONLY' | 'VISUAL_DIFF_ONLY' | 'BOTH_DIFF' | 'ONLY_IN_A' | 'ONLY_IN_B';

export interface TextDiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
}

export interface PageComparison {
  pageNumber: number;
  status: PageDiffStatus;
  hasTextDiff: boolean;
  hasVisualDiff: boolean;
  textDiffLines: TextDiffLine[];
  similarityScore: number; // 0 - 100%
  pageAWidth?: number;
  pageAHeight?: number;
  pageBWidth?: number;
  pageBHeight?: number;
}

export interface CompareResult {
  docAPageCount: number;
  docBPageCount: number;
  pageComparisons: PageComparison[];
  identicalPageCount: number;
  differentPageCount: number;
  totalEvaluatedPages: number;
}

// Phase 5: Fill PDF Forms Types
export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'unsupported';

export interface FormFieldInfo {
  name: string;
  type: FormFieldType;
  value: string | boolean;
  options?: string[]; // for radio & dropdown
  isMultiline?: boolean;
  isReadOnly?: boolean;
  maxLength?: number;
}

export interface FillFormResult {
  pdfData: Uint8Array;
  filledFieldCount: number;
  totalFieldsCount: number;
}

// Phase 5: Flatten PDF Types
export type FlattenMode = 'forms' | 'annotations' | 'rasterize';

export interface FlattenReport {
  mode: FlattenMode;
  flattenedFieldsCount: number;
  flattenedAnnotationsCount: number;
  remainingInteractiveCount: number;
  unsupportedAnnotationsCount: number;
  unsupportedTypes: string[];
  isFullyFlattened: boolean;
}

export interface FlattenResult {
  pdfData: Uint8Array;
  report: FlattenReport;
}

// Phase 5: Remove Duplicate Pages Types
export interface DuplicateCandidate {
  pageIndex: number; // 0-indexed
  pageNumber: number; // 1-indexed
  isOriginal: boolean;
  duplicateOfPageNumber?: number;
  confidence: number; // 0 - 100%
  textHash: string;
  visualHash: string;
  selectedForDeletion: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  originalPageNumber: number;
  duplicatePageNumbers: number[];
  confidence: number;
  candidates: DuplicateCandidate[];
}

export interface DuplicateDetectionResult {
  groups: DuplicateGroup[];
  totalDuplicatesDetected: number;
  candidates: DuplicateCandidate[];
}

// Phase 5: Add Bookmarks Types
export interface BookmarkItem {
  id: string;
  title: string;
  targetPageNumber: number; // 1-indexed
  level: number; // 0 = top-level, 1 = nested subsection
  children?: BookmarkItem[];
}

export interface AddBookmarksOptions {
  bookmarks: BookmarkItem[];
  replaceExisting?: boolean; // if false, append to existing outlines
}

export interface AddBookmarksResult {
  pdfData: Uint8Array;
  totalBookmarksCount: number;
}

// Phase 5: Redact PDF Types
export interface RedactionBox {
  id: string;
  pageIndex: number; // 0-indexed
  pageNumber: number; // 1-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace?: 'viewport' | 'pdf';
}

export interface RedactOptions {
  boxes: RedactionBox[];
  rasterizeAllPages?: boolean; // default false (only affected pages rasterized)
  sanitizeMetadata?: boolean; // default true
  dpi?: number; // default 200
}

export interface RedactResult {
  pdfData: Uint8Array;
  redactedPagesCount: number;
  redactionBoxesCount: number;
  sanitizedMetadata: boolean;
}


