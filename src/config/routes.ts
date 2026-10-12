export type ToolId =
  | 'unlock'
  | 'protect'
  | 'merge'
  | 'split'
  | 'organize'
  | 'images'
  | 'compress'
  | 'inspect';

export interface ToolRoute {
  toolId: ToolId;
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  h1: string;
  shortDescription: string;
  instructions: { step: number; title: string; desc: string }[];
  limitations: string[];
  privacyNotes: string[];
  relatedToolIds: ToolId[];
}

export interface HomeRoute {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  h1: string;
}

export const PRODUCTION_ORIGIN = 'https://titanium-xd.github.io';
export const BASE_PATH = '/OwnPDF/';

export const homeRoute: HomeRoute = {
  title: 'OwnPDF — Free Private PDF Tools',
  metaDescription:
    'Merge, split, organize, compress, protect and unlock PDFs with OwnPDF. Convert images to PDF and process files locally in your browser for greater privacy.',
  canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}`,
  h1: 'Free Private PDF Tools. Your device. Your privacy.',
};

export const toolRoutes: ToolRoute[] = [
  {
    toolId: 'unlock',
    slug: 'unlock',
    name: 'Unlock PDF',
    title: 'Unlock PDF Online — Free, Private & On-Device — OwnPDF',
    metaDescription:
      'Remove password protection and restrictions from encrypted PDFs directly in your browser. Fast, local WebAssembly decryption with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}unlock/`,
    h1: 'Unlock Password-Protected PDFs Locally',
    shortDescription:
      'Decrypt and remove opening passwords from protected PDF files (such as e-Aadhaar cards, bank statements, and invoices) entirely on your device using WebAssembly.',
    instructions: [
      {
        step: 1,
        title: 'Select or Drop File',
        desc: 'Upload an encrypted PDF file using the drop area or file selector.',
      },
      {
        step: 2,
        title: 'Provide Password',
        desc: 'Enter the valid document opening password.',
      },
      {
        step: 3,
        title: 'Decrypt & Save',
        desc: 'Click "Unlock PDF" to remove encryption locally and download your unlocked document.',
      },
    ],
    limitations: [
      'Requires knowledge of the valid document password; does not perform illegal brute-force recovery.',
      'Only standard PDF encryption schemes supported by QPDF WebAssembly (RC4, AES-128, AES-256) are decrypted.',
    ],
    privacyNotes: [
      'Document bytes are decrypted strictly in your browser memory via WebAssembly.',
      'No passwords, metadata, or document data are ever transmitted to any remote server.',
    ],
    relatedToolIds: ['protect', 'split', 'inspect'],
  },
  {
    toolId: 'protect',
    slug: 'protect',
    name: 'Protect PDF',
    title: 'Protect PDF with Password Online — AES-256 Security — OwnPDF',
    metaDescription:
      'Secure PDF documents with industry-standard 256-bit AES encryption and custom passwords. Fully client-side processing with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}protect/`,
    h1: 'Protect PDFs with AES-256 Encryption',
    shortDescription:
      'Safeguard sensitive PDF documents with military-grade 256-bit AES encryption and custom passwords before sharing or storing them.',
    instructions: [
      {
        step: 1,
        title: 'Choose Document',
        desc: 'Upload or drag the PDF you wish to encrypt into the workspace.',
      },
      {
        step: 2,
        title: 'Set Strong Password',
        desc: 'Enter and verify your chosen encryption password.',
      },
      {
        step: 3,
        title: 'Encrypt Locally',
        desc: 'Click "Protect & Encrypt PDF" to download your securely encrypted file.',
      },
    ],
    limitations: [
      'Forgotten passwords cannot be recovered or reset by OwnPDF because zero keys are stored.',
      'Input file must not already be password-protected (unlock it first if necessary).',
    ],
    privacyNotes: [
      'Encryption is executed on-device using QPDF WebAssembly with genuine AES-256 parameters.',
      'Passwords never leave your device browser session.',
    ],
    relatedToolIds: ['unlock', 'inspect', 'compress'],
  },
  {
    toolId: 'merge',
    slug: 'merge',
    name: 'Merge PDF',
    title: 'Merge PDF Files Online — Free, Private PDF Combiner — OwnPDF',
    metaDescription:
      'Combine multiple PDF documents into a single organized file locally in your browser. Reorder files before merging with zero cloud uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}merge/`,
    h1: 'Merge Multiple PDF Files Together',
    shortDescription:
      'Combine multiple PDF documents, statements, certificates, or book chapters into a single cleanly unified PDF file with custom ordering.',
    instructions: [
      {
        step: 1,
        title: 'Add Multiple PDFs',
        desc: 'Upload two or more PDF files into the merge queue.',
      },
      {
        step: 2,
        title: 'Reorder Files',
        desc: 'Drag items or use the sequence controls to order pages exactly as desired.',
      },
      {
        step: 3,
        title: 'Assemble Document',
        desc: 'Click "Merge PDFs" to combine the files in memory and download the joined document.',
      },
    ],
    limitations: [
      'Encrypted PDFs must be unlocked before merging.',
      'Total queue size is limited by your local device available browser RAM.',
    ],
    privacyNotes: [
      'Document streams are merged locally in memory using pdf-lib.',
      'Zero server round-trips or file uploads occur.',
    ],
    relatedToolIds: ['split', 'organize', 'images'],
  },
  {
    toolId: 'split',
    slug: 'split',
    name: 'Split & Extract',
    title: 'Split PDF Online — Extract Pages & Split into Separate Files — OwnPDF',
    metaDescription:
      'Extract page ranges or split every page into individual PDF files with ZIP download. 100% client-side PDF splitter with complete privacy.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}split/`,
    h1: 'Split PDF & Extract Pages',
    shortDescription:
      'Extract custom page ranges into a single new document or split an entire PDF into individual single-page files bundled into a ZIP archive.',
    instructions: [
      {
        step: 1,
        title: 'Load PDF',
        desc: 'Select the PDF document you want to extract pages from.',
      },
      {
        step: 2,
        title: 'Select Mode',
        desc: 'Choose custom range extraction (e.g. 1-3, 5, 8-10) or "Split all pages".',
      },
      {
        step: 3,
        title: 'Extract & Export',
        desc: 'Click "Process & Download" to save the extracted PDF or ZIP archive immediately.',
      },
    ],
    limitations: [
      'Specified page indices must fall within the document total page range.',
      'Encrypted documents must have passwords removed first.',
    ],
    privacyNotes: [
      'Page slicing and ZIP archive packaging run 100% locally using pdf-lib and JSZip.',
      'No document pages are uploaded or cached on servers.',
    ],
    relatedToolIds: ['merge', 'organize', 'compress'],
  },
  {
    toolId: 'organize',
    slug: 'organize',
    name: 'Organize Pages',
    title: 'Organize PDF Pages Online — Reorder, Rotate & Remove Sheets — OwnPDF',
    metaDescription:
      'Visual thumbnail grid to rotate pages 90 degrees, delete unnecessary sheets, and reorder PDF pages locally in your browser with zero uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}organize/`,
    h1: 'Organize, Rotate & Delete PDF Pages',
    shortDescription:
      'Interactive visual thumbnail gallery to rearrange pages, rotate misoriented scans by 90°, and delete unnecessary pages from your PDF.',
    instructions: [
      {
        step: 1,
        title: 'Inspect Visual Grid',
        desc: 'Select a PDF to render on-device thumbnail previews of every page.',
      },
      {
        step: 2,
        title: 'Rotate or Delete',
        desc: 'Use rotation buttons to fix page orientation or remove unwanted sheets.',
      },
      {
        step: 3,
        title: 'Reorder & Save',
        desc: 'Drag pages into your preferred sequence and click "Save Reorganized PDF".',
      },
    ],
    limitations: [
      'Documents with hundreds of pages may take several seconds to generate local canvas thumbnails.',
      'Cannot edit underlying text content (reordering and rotation only).',
    ],
    privacyNotes: [
      'Thumbnail rendering uses PDF.js strictly within browser canvas elements.',
      'All page reorganization executes locally without network transfer.',
    ],
    relatedToolIds: ['split', 'merge', 'images'],
  },
  {
    toolId: 'images',
    slug: 'images-to-pdf',
    name: 'Images to PDF',
    title: 'Convert Images to PDF Online — JPG & PNG to PDF Converter — OwnPDF',
    metaDescription:
      'Convert JPG, JPEG, and PNG images into a clean single PDF file locally in your browser. Configure margins, page sizes, and orientation with zero uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}images-to-pdf/`,
    h1: 'Convert Images to PDF Online',
    shortDescription:
      'Transform one or multiple photos, scans, receipts, or screenshots (JPG, PNG) into a polished, professional multi-page PDF document.',
    instructions: [
      {
        step: 1,
        title: 'Add Images',
        desc: 'Select or drag JPG and PNG images into the converter.',
      },
      {
        step: 2,
        title: 'Configure Layout',
        desc: 'Arrange image order and choose page size (A4, Letter), orientation, and margins.',
      },
      {
        step: 3,
        title: 'Generate PDF',
        desc: 'Click "Convert Images to PDF" to generate and download your PDF.',
      },
    ],
    limitations: [
      'Supported image formats are JPG, JPEG, and PNG.',
      'Output dimensions follow standard print geometry settings (A4/Letter).',
    ],
    privacyNotes: [
      'Image decompression and PDF drawing happen entirely inside browser canvas/memory.',
      'Zero images are uploaded or sent over the internet.',
    ],
    relatedToolIds: ['organize', 'merge', 'compress'],
  },
  {
    toolId: 'compress',
    slug: 'compress',
    name: 'Compress PDF',
    title: 'Compress PDF Online — Reduce PDF Size with Honest Metrics — OwnPDF',
    metaDescription:
      'Linearize and optimize PDF structure locally to reduce file size without quality loss or server uploads. Honest size metrics and privacy.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}compress/`,
    h1: 'Compress & Optimize PDF File Size',
    shortDescription:
      'Linearize PDF internal structures and optimize uncompressed object streams without blurry lossy downsampling, featuring verified before/after byte metrics.',
    instructions: [
      {
        step: 1,
        title: 'Choose PDF',
        desc: 'Upload a PDF file to analyze its internal structural overhead.',
      },
      {
        step: 2,
        title: 'Optimize Structure',
        desc: 'Click "Compress Document" to linearize and streamline object streams.',
      },
      {
        step: 3,
        title: 'Verify & Download',
        desc: 'Inspect honest byte reduction metrics and download the optimized PDF.',
      },
    ],
    limitations: [
      'Does not perform lossy raster image degradation; files with already-compressed images may see modest savings.',
      'Protected PDFs must be decrypted prior to compression.',
    ],
    privacyNotes: [
      'Optimization runs in WebAssembly using genuine QPDF linearization algorithms.',
      'No telemetry or document copies are transmitted remotely.',
    ],
    relatedToolIds: ['inspect', 'protect', 'split'],
  },
  {
    toolId: 'inspect',
    slug: 'inspect',
    name: 'Inspect & Sanitize',
    title: 'Inspect & Sanitize PDF Online — Remove Tracking Metadata — OwnPDF',
    metaDescription:
      'Inspect PDF catalog version, page counts, and strip hidden tracking metadata (author, producer, creation date) 100% on-device with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}inspect/`,
    h1: 'Inspect PDF Properties & Sanitize Metadata',
    shortDescription:
      'Examine low-level PDF structural properties, encryption headers, and strip tracking metadata (author, creator, software, timestamps) before publication.',
    instructions: [
      {
        step: 1,
        title: 'Inspect Document',
        desc: 'Upload any PDF to view its catalog version, page count, and metadata dictionary.',
      },
      {
        step: 2,
        title: 'Review Properties',
        desc: 'Examine sensitive author, producer, and modification tracking information.',
      },
      {
        step: 3,
        title: 'Sanitize Metadata',
        desc: 'Click "Sanitize Metadata" to export a clean copy with tracking information wiped.',
      },
    ],
    limitations: [
      'Strips standard Document Information Dictionary and XMP metadata blocks; does not alter underlying page vectors.',
      'Encrypted PDFs must be unlocked to read and scrub metadata dictionaries.',
    ],
    privacyNotes: [
      'Metadata parsing and sanitization are completely client-side operations.',
      'Zero documents or metadata fields are logged or transmitted.',
    ],
    relatedToolIds: ['unlock', 'protect', 'compress'],
  },
];

/**
 * Normalizes a URL pathname and extracts the active tool route if valid.
 */
export function getRouteFromPathname(pathname: string, baseUrl: string = '/'): ToolRoute | null {
  // Normalize leading and trailing slashes
  let cleanPath = pathname;

  // Remove baseUrl prefix if present
  if (baseUrl !== '/' && cleanPath.startsWith(baseUrl)) {
    cleanPath = cleanPath.slice(baseUrl.length);
  } else if (cleanPath.startsWith('/OwnPDF/')) {
    cleanPath = cleanPath.slice('/OwnPDF/'.length);
  } else if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }

  // Strip trailing slashes and query params / hashes
  cleanPath = cleanPath.split('?')[0].split('#')[0];
  if (cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  if (!cleanPath) {
    return null; // Homepage
  }

  const match = toolRoutes.find((r) => r.slug === cleanPath);
  return match || null;
}

/**
 * Determines whether a pathname represents an unrecognized route.
 */
export function isInvalidRoute(pathname: string, baseUrl: string = '/'): boolean {
  let cleanPath = pathname;
  if (baseUrl !== '/' && cleanPath.startsWith(baseUrl)) {
    cleanPath = cleanPath.slice(baseUrl.length);
  } else if (cleanPath.startsWith('/OwnPDF/')) {
    cleanPath = cleanPath.slice('/OwnPDF/'.length);
  } else if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  cleanPath = cleanPath.split('?')[0].split('#')[0];
  if (cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  if (!cleanPath || cleanPath === 'index.html') {
    return false; // Home
  }
  return !toolRoutes.some((r) => r.slug === cleanPath);
}

/**
 * Builds the canonical relative/absolute path for a given tool.
 */
export function getPathForTool(toolId: ToolId | null, baseUrl: string = '/'): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (!toolId) {
    return base;
  }
  const route = toolRoutes.find((r) => r.toolId === toolId);
  return route ? `${base}${route.slug}/` : base;
}

export function isModifiedEvent(e: {
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
}): boolean {
  return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0);
}
