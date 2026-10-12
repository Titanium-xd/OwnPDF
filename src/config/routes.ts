export type ToolId =
  | 'unlock'
  | 'protect'
  | 'merge'
  | 'split'
  | 'organize'
  | 'images'
  | 'compress'
  | 'inspect'
  | 'rotate'
  | 'page-numbers'
  | 'watermark'
  | 'pdf-to-images'
  | 'extract-text'
  | 'crop'
  | 'find-replace'
  | 'reverse-pages'
  | 'delete-blank-pages'
  | 'resize'
  | 'extract-images'
  | 'extract-links'
  | 'compare'
  | 'fill-form'
  | 'flatten'
  | 'remove-duplicate-pages'
  | 'bookmarks'
  | 'redact';


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
  {
    toolId: 'rotate',
    slug: 'rotate',
    name: 'Rotate PDF',
    title: 'Rotate PDF Online — Free, Permanent & On-Device — OwnPDF',
    metaDescription:
      'Rotate specific pages or entire PDF files by 90, 180, or 270 degrees locally in your browser. Clean, private PDF rotation with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}rotate/`,
    h1: 'Rotate PDF Pages Online',
    shortDescription:
      'Rotate misoriented scans or individual pages by 90°, 180°, or 270° clockwise with instant visual previews completely on your device.',
    instructions: [
      {
        step: 1,
        title: 'Choose PDF File',
        desc: 'Select or drag your PDF into the rotation workspace.',
      },
      {
        step: 2,
        title: 'Set Rotation',
        desc: 'Choose rotation angle (90°, 180°, or 270°) and select all pages or a custom page range.',
      },
      {
        step: 3,
        title: 'Apply & Save',
        desc: 'Click "Rotate PDF" to permanently adjust page orientation and download your modified document.',
      },
    ],
    limitations: [
      'Adjusts the standard PDF rotation dictionary without rasterizing or altering vector text streams.',
      'Password-protected documents must be unlocked before rotating.',
    ],
    privacyNotes: [
      'Page rotation executes strictly in browser memory using pdf-lib.',
      'No files or pages are ever uploaded to any cloud server.',
    ],
    relatedToolIds: ['organize', 'crop', 'split'],
  },
  {
    toolId: 'page-numbers',
    slug: 'page-numbers',
    name: 'Add Page Numbers',
    title: 'Add Page Numbers to PDF Online — Free & Customizable — OwnPDF',
    metaDescription:
      'Insert page numbers into PDF documents locally. Customize format, position, font size, margins, and page ranges with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}page-numbers/`,
    h1: 'Add Page Numbers to PDF Documents',
    shortDescription:
      'Stamp clean, professional page numbering onto PDF sheets with full control over position (top/bottom, left/center/right), formatting, and margins.',
    instructions: [
      {
        step: 1,
        title: 'Upload Document',
        desc: 'Select the PDF document you wish to number.',
      },
      {
        step: 2,
        title: 'Configure Numbering',
        desc: 'Choose position, numbering format ("Page N of M", "N / M", or "N"), start number, and margin.',
      },
      {
        step: 3,
        title: 'Generate Numbered PDF',
        desc: 'Click "Add Page Numbers" to stamp the document and download the finished file.',
      },
    ],
    limitations: [
      'Stamps text onto the foreground of each page; ensure chosen margins do not overlap critical content.',
      'Supports standard Latin numerical formats and standard PDF typefaces.',
    ],
    privacyNotes: [
      'Text layout and stamping are computed entirely inside your browser.',
      'Zero document contents leave your computer.',
    ],
    relatedToolIds: ['watermark', 'organize', 'merge'],
  },
  {
    toolId: 'watermark',
    slug: 'watermark',
    name: 'Add Watermark',
    title: 'Add Watermark to PDF Online — Text & Image Watermarks — OwnPDF',
    metaDescription:
      'Apply text or logo image watermarks to PDF files locally. Configure opacity, rotation, size, and page range with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}watermark/`,
    h1: 'Add Watermark to PDF Online',
    shortDescription:
      'Stamp custom confidential text or transparent PNG/JPEG logo watermarks across PDF pages with full control over opacity, angle, and positioning.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF',
        desc: 'Upload the document you want to watermark.',
      },
      {
        step: 2,
        title: 'Design Watermark',
        desc: 'Choose Text or Image watermark, configure opacity, rotation angle, position, and page scope.',
      },
      {
        step: 3,
        title: 'Stamp & Download',
        desc: 'Click "Apply Watermark" to generate and download your watermarked PDF.',
      },
    ],
    limitations: [
      'Watermarks are stamped into content streams; they deter unauthorized copying but are not a substitute for cryptographic DRM.',
      'Image watermarks support PNG and JPEG formats.',
    ],
    privacyNotes: [
      'Watermark rendering and compositing occur 100% on your device.',
      'Neither source files nor watermark images are sent over the network.',
    ],
    relatedToolIds: ['page-numbers', 'protect', 'inspect'],
  },
  {
    toolId: 'pdf-to-images',
    slug: 'pdf-to-images',
    name: 'PDF to JPG / PNG',
    title: 'Convert PDF to JPG & PNG Online — High Resolution Images — OwnPDF',
    metaDescription:
      'Convert PDF pages into high-resolution JPG or PNG images locally in your browser. Download single pages or ZIP archive with zero cloud uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}pdf-to-images/`,
    h1: 'Convert PDF to JPG and PNG Images',
    shortDescription:
      'Rasterize PDF sheets into crisp JPG or transparent PNG images. Select specific pages, adjust scale resolution, and download as single images or ZIP.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF File',
        desc: 'Load the PDF document you want to convert into images.',
      },
      {
        step: 2,
        title: 'Choose Output Settings',
        desc: 'Select JPG or PNG, set image resolution scale, and specify which pages to render.',
      },
      {
        step: 3,
        title: 'Export Images',
        desc: 'Click "Convert to Images" to render pages locally and download directly or as a ZIP archive.',
      },
    ],
    limitations: [
      'Conversion is performed locally in browser canvas memory; very high resolutions on large documents may require significant device RAM.',
      'JPEG format automatically applies a solid white background as JPEG does not support transparency.',
    ],
    privacyNotes: [
      'Pages are rasterized on-device using PDF.js without remote server processing.',
      'ZIP packaging runs in-memory using client-side JSZip.',
    ],
    relatedToolIds: ['images', 'extract-text', 'split'],
  },
  {
    toolId: 'extract-text',
    slug: 'extract-text',
    name: 'Extract Text',
    title: 'Extract Text from PDF Online — Export to TXT — OwnPDF',
    metaDescription:
      'Extract selectable text from PDF documents locally in your browser. Reconstruct reading order and download UTF-8 TXT with zero server uploads.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}extract-text/`,
    h1: 'Extract Text from PDF Online',
    shortDescription:
      'Extract selectable text content from PDF pages with reconstructed reading order, live preview, word statistics, and UTF-8 TXT export.',
    instructions: [
      {
        step: 1,
        title: 'Load PDF File',
        desc: 'Upload the PDF document you want to extract text from.',
      },
      {
        step: 2,
        title: 'Preview Text',
        desc: 'Review extracted text in the live reader, inspect word and character counts, and select page ranges.',
      },
      {
        step: 3,
        title: 'Copy or Download',
        desc: 'Copy text directly to your clipboard or download a clean UTF-8 .txt document.',
      },
    ],
    limitations: [
      'Extracts selectable digital text streams; scanned image-only PDFs require Optical Character Recognition (OCR), which is not included in this phase.',
      'Complex multi-column or tabular layouts are parsed in reading order but do not reconstruct pixel-perfect typographic grids.',
    ],
    privacyNotes: [
      'Text stream parsing runs completely in your local browser runtime.',
      'Zero document contents or extracted strings are stored or sent anywhere.',
    ],
    relatedToolIds: ['inspect', 'pdf-to-images', 'split'],
  },
  {
    toolId: 'crop',
    slug: 'crop',
    name: 'Crop PDF',
    title: 'Crop PDF Online — Trim Margins & Adjust Viewport — OwnPDF',
    metaDescription:
      'Crop and trim PDF margins locally in your browser. Set visual boundaries or numerical margins for selected pages with complete privacy.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}crop/`,
    h1: 'Crop & Trim PDF Pages Online',
    shortDescription:
      'Trim unnecessary margins or adjust visible PDF boundaries visually with interactive previews and customizable margin controls.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF',
        desc: 'Upload the PDF you want to crop.',
      },
      {
        step: 2,
        title: 'Set Crop Margins',
        desc: 'Adjust top, bottom, left, and right margins or select preset trimming options.',
      },
      {
        step: 3,
        title: 'Crop & Download',
        desc: 'Click "Crop PDF" to update the visible display area and download the cropped document.',
      },
    ],
    limitations: [
      'Cropping adjusts the visible PDF CropBox boundary; it does not permanently redact or erase underlying vectors outside the crop area.',
      'Margins must leave at least 15 points of viewable width and height per page.',
    ],
    privacyNotes: [
      'Crop box modifications are executed strictly in local memory with pdf-lib.',
      'Zero documents or coordinates are sent to remote servers.',
    ],
    relatedToolIds: ['rotate', 'organize', 'split'],
  },
  {
    toolId: 'find-replace',
    slug: 'find-replace',
    name: 'Find & Replace',
    title: 'Find & Replace Text in PDF Online — Free & Private — OwnPDF',
    metaDescription:
      'Find and replace text, words, and numbers in PDF documents locally in your browser with layout collision warnings and visual precision.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}find-replace/`,
    h1: 'Find & Replace Text in PDF Locally',
    shortDescription:
      'Locate words, names, or numbers across pages, preview occurrences, and replace them with visual precision.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF Document',
        desc: 'Choose or drag-and-drop the PDF you want to search.',
      },
      {
        step: 2,
        title: 'Enter Search & Replacement Text',
        desc: 'Type the search query and desired replacement text, then click "Search".',
      },
      {
        step: 3,
        title: 'Review Occurrences & Download',
        desc: 'Select which occurrences to replace, verify collision warnings, and click "Replace & Download PDF".',
      },
    ],
    limitations: [
      'Visual masking covers matched text with an opaque background patch and stamps replacement text at the exact baseline; it does not destroy underlying vector streams or reflow paragraphs.',
      'Replacing short words with significantly longer phrases may collide with adjacent text on the page.',
      'Text rendered vertically or with complex transformation matrices cannot be replaced.',
    ],
    privacyNotes: [
      'Zero search terms, replacement strings, or PDF documents leave your device.',
      'All text searching and visual patching execute in-browser using WebAssembly and Web Workers.',
    ],
    relatedToolIds: ['extract-text', 'watermark', 'crop'],
  },
  {
    toolId: 'reverse-pages',
    slug: 'reverse-pages',
    name: 'Reverse Pages',
    title: 'Reverse PDF Pages Online — Invert Page Order — OwnPDF',
    metaDescription:
      'Reverse and invert page order in PDF documents with 1 click. Reverse entire document, specific page ranges, or fix inverted duplex scanner feeds.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}reverse-pages/`,
    h1: 'Reverse PDF Page Order Online',
    shortDescription:
      'Invert page order with 1-click presets: entire document, specific page ranges, or duplex scanner back-sides.',
    instructions: [
      {
        step: 1,
        title: 'Upload PDF',
        desc: 'Select the PDF document whose pages you want to reverse.',
      },
      {
        step: 2,
        title: 'Choose Reversal Mode',
        desc: 'Select "Reverse All Pages", "Reverse Specific Range", or "Duplex Scanner Fix".',
      },
      {
        step: 3,
        title: 'Download Inverted PDF',
        desc: 'Click "Reverse Pages & Download" to save your reorganized document immediately.',
      },
    ],
    limitations: [
      'Page vector content, rotation, dimensions, annotations, and document metadata (Title, Author) are verified and preserved.',
      'In accordance with PDF specifications, document outline bookmarks (/Outlines) and custom page labels are omitted in reordered outputs.',
    ],
    privacyNotes: [
      'Page reordering runs 100% locally in browser memory with pdf-lib.',
      'No document uploads or server calls.',
    ],
    relatedToolIds: ['organize', 'rotate', 'split'],
  },
  {
    toolId: 'delete-blank-pages',
    slug: 'delete-blank-pages',
    name: 'Delete Blank Pages',
    title: 'Delete Blank Pages from PDF Online — Free & Private — OwnPDF',
    metaDescription:
      'Detect and remove blank or empty pages from PDF documents. Features dual-mode ink density and text layer analysis with noise tolerance.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}delete-blank-pages/`,
    h1: 'Delete Blank & Empty PDF Pages Online',
    shortDescription:
      'Detect and remove empty or accidental scanner sheets using intelligent ink-density and text-layer analysis.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF',
        desc: 'Upload the PDF document you wish to clean.',
      },
      {
        step: 2,
        title: 'Review Candidate Pages',
        desc: 'The detector automatically marks candidate blank pages. Adjust the noise slider and check/uncheck pages.',
      },
      {
        step: 3,
        title: 'Confirm Deletion & Download',
        desc: 'Click "Delete Selected Pages & Download" to remove blank sheets and save your cleaned document.',
      },
    ],
    limitations: [
      'Operates as a candidate detector requiring explicit user confirmation before deletion.',
      'Pages with invisible OCR text layers or minimal content (such as single-digit page numbers) are preserved from deletion.',
    ],
    privacyNotes: [
      'Page analysis and deletion are performed completely client-side in browser memory.',
      'No documents or images are ever transmitted over the network.',
    ],
    relatedToolIds: ['organize', 'split', 'reverse-pages'],
  },
  {
    toolId: 'resize',
    slug: 'resize',
    name: 'Resize PDF',
    title: 'Resize PDF Page Dimensions Online — Change Page Size — OwnPDF',
    metaDescription:
      'Resize PDF page dimensions to standard sizes like A4, US Letter, A3, and Legal. Choose proportional fitting, fill & crop, or canvas padding.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}resize/`,
    h1: 'Resize PDF Page Size & Dimensions Online',
    shortDescription:
      'Change page dimensions to standard sizes (A4, Letter, A3, Legal) with proportional scaling, fill & crop, or canvas padding.',
    instructions: [
      {
        step: 1,
        title: 'Choose PDF File',
        desc: 'Upload the PDF you want to resize.',
      },
      {
        step: 2,
        title: 'Select Target Size & Strategy',
        desc: 'Choose your desired paper format (e.g. A4, Letter) and strategy (Fit, Fill & Crop, or Canvas).',
      },
      {
        step: 3,
        title: 'Resize & Download',
        desc: 'Click "Resize PDF & Download" to generate and save your resized document.',
      },
    ],
    limitations: [
      'Proportional Fit adds letterbox/pillarbox margins when aspect ratios differ.',
      'Fill & Bleed scales content to cover target dimensions, clipping excess outside the margin boundary.',
      'Canvas Padding keeps 100% vector scale without zooming content.',
    ],
    privacyNotes: [
      'Page geometry transformations run locally in your browser.',
      'Zero document data is sent to external servers.',
    ],
    relatedToolIds: ['crop', 'rotate', 'images'],
  },
  {
    toolId: 'extract-images',
    slug: 'extract-images',
    name: 'Extract Images',
    title: 'Extract Images from PDF Online — Lossless Photo & Figure Export — OwnPDF',
    metaDescription:
      'Extract embedded photos, illustrations, and figures from PDF files in their original lossless quality. Download individually or as a ZIP archive.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}extract-images/`,
    h1: 'Extract Embedded Images from PDF Online',
    shortDescription:
      'Extract embedded photos, graphics, and figures in their original lossless quality, single or bundled into a ZIP archive.',
    instructions: [
      {
        step: 1,
        title: 'Upload PDF Document',
        desc: 'Select or drag-and-drop the PDF containing images.',
      },
      {
        step: 2,
        title: 'Browse Extracted Gallery',
        desc: 'Preview extracted photos and figures with page numbers, formats, and dimensions.',
      },
      {
        step: 3,
        title: 'Download Images or ZIP',
        desc: 'Download individual image files or click "Download All as ZIP" to save all assets in an archive.',
      },
    ],
    limitations: [
      'Raw JPEG streams are extracted without re-compression degradation.',
      'FlateDecode and soft-masked (/SMask) transparency images are decoded into lossless 32-bit PNGs.',
      'Vector diagrams drawn as lines and shapes are not raster images and cannot be extracted as image files.',
    ],
    privacyNotes: [
      'Image extraction runs entirely inside your browser.',
      'Zero images or documents are ever uploaded to remote servers.',
    ],
    relatedToolIds: ['pdf-to-images', 'extract-text', 'images'],
  },
  {
    toolId: 'extract-links',
    slug: 'extract-links',
    name: 'Extract Links',
    title: 'Extract Links from PDF Online — URL & Hyperlink Finder — OwnPDF',
    metaDescription:
      'Extract all clickable links, annotations, internal destinations, and printed URLs from PDF files. Export to CSV, JSON, or TXT.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}extract-links/`,
    h1: 'Extract Links & Hyperlinks from PDF Online',
    shortDescription:
      'Discover and export all clickable hyperlink annotations, internal page destinations, and plaintext URLs.',
    instructions: [
      {
        step: 1,
        title: 'Select PDF',
        desc: 'Upload the document you want to inspect for links.',
      },
      {
        step: 2,
        title: 'Explore Link Table',
        desc: 'Filter by external, internal, or text URLs, and search or test destinations.',
      },
      {
        step: 3,
        title: 'Export Structured Data',
        desc: 'Click CSV, JSON, or TXT to download the complete list of extracted URLs.',
      },
    ],
    limitations: [
      'Distinguishes interactive PDF annotation dictionaries (/Subtype /Link) from plain text URLs.',
      'Internal destinations link to specific document pages rather than external web addresses.',
    ],
    privacyNotes: [
      'Link extraction occurs entirely in browser memory.',
      'Testing or clicking links is done directly by your browser; zero data is collected or sent to telemetry endpoints.',
    ],
    relatedToolIds: ['extract-text', 'inspect', 'find-replace'],
  },
  {
    toolId: 'compare',
    slug: 'compare',
    name: 'Compare PDFs',
    title: 'Compare PDFs — Free Online PDF Comparison Tool | OwnPDF',
    metaDescription:
      'Compare two PDF documents side-by-side with visual and text-layer diffing. Inspect line additions, deletions, and structural changes locally in your browser.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}compare/`,
    h1: 'Compare PDF Documents Side-by-Side',
    shortDescription: 'Compare two PDFs to identify text changes and visual differences.',
    instructions: [
      {
        step: 1,
        title: 'Select Two PDFs',
        desc: 'Upload Document A (base version) and Document B (modified version).',
      },
      {
        step: 2,
        title: 'Run Side-by-Side Diff',
        desc: 'Click Compare Documents to analyze textual and structural changes across pages.',
      },
      {
        step: 3,
        title: 'Inspect Changes',
        desc: 'Expand differing pages to review line-by-line additions, deletions, and layout variances.',
      },
    ],
    limitations: [
      'Diff analysis compares extracted text items and visual page boundaries.',
      'Complex multi-column text layouts are compared in extraction stream sequence.',
    ],
    privacyNotes: [
      'Both PDF documents remain entirely within local browser memory.',
      'Zero server transmission, zero third-party telemetry.',
    ],
    relatedToolIds: ['inspect', 'extract-text', 'find-replace'],
  },
  {
    toolId: 'fill-form',
    slug: 'fill-form',
    name: 'Fill PDF Forms',
    title: 'Fill PDF Forms — Free Online PDF Form Filler | OwnPDF',
    metaDescription:
      'Fill interactive PDF forms, text inputs, checkboxes, radio groups, and dropdowns directly in your browser. Fast, free, and private.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}fill-form/`,
    h1: 'Fill Interactive PDF Forms Online',
    shortDescription: 'Fill out interactive AcroForm fields in your browser with complete privacy.',
    instructions: [
      {
        step: 1,
        title: 'Upload Fillable PDF',
        desc: 'Select any PDF document containing interactive AcroForm fields.',
      },
      {
        step: 2,
        title: 'Fill Form Fields',
        desc: 'Type text, toggle checkboxes, choose radio buttons, and select dropdown options.',
      },
      {
        step: 3,
        title: 'Save & Download',
        desc: 'Download your filled PDF with all values embedded cleanly into the document.',
      },
    ],
    limitations: [
      'Supports standard PDF AcroForm text fields, checkboxes, radio groups, and dropdowns.',
      'Proprietary Adobe LiveCycle dynamic XFA forms are not supported.',
    ],
    privacyNotes: [
      'Form entries and confidential information never leave your device.',
      'Values are embedded client-side using WebAssembly.',
    ],
    relatedToolIds: ['flatten', 'inspect', 'protect'],
  },
  {
    toolId: 'flatten',
    slug: 'flatten',
    name: 'Flatten PDF',
    title: 'Flatten PDF — Convert Forms and Annotations to Static Vector Graphics | OwnPDF',
    metaDescription:
      'Flatten interactive PDF form fields, comments, and annotations into permanent document graphics or raster images. Honest flattening reports and 100% privacy.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}flatten/`,
    h1: 'Flatten Forms & Annotations in PDF',
    shortDescription: 'Lock fillable form fields and markup into permanent document content.',
    instructions: [
      {
        step: 1,
        title: 'Upload PDF Document',
        desc: 'Select a PDF containing interactive forms, annotations, or comments.',
      },
      {
        step: 2,
        title: 'Choose Flattening Strategy',
        desc: 'Select Form Fields Only, Forms & Annotations, or Full Page Rasterization.',
      },
      {
        step: 3,
        title: 'Download Flattened PDF',
        desc: 'Get a clean document with interactive elements locked into static visual layers.',
      },
    ],
    limitations: [
      'Vector flattening bakes annotations with valid appearance streams; unsupported dynamic annotations are preserved and reported.',
      'Full Page Rasterization mode guarantees 100% flattening by converting pages into high-resolution images.',
    ],
    privacyNotes: [
      'Document vectors and appearance streams are rewritten in local browser memory.',
      'Zero cloud processing or external server involvement.',
    ],
    relatedToolIds: ['fill-form', 'redact', 'compress'],
  },
  {
    toolId: 'remove-duplicate-pages',
    slug: 'remove-duplicate-pages',
    name: 'Remove Duplicate Pages',
    title: 'Remove Duplicate Pages from PDF — Free Cleanup Tool | OwnPDF',
    metaDescription:
      'Detect and delete duplicate or repeated pages in PDF files using text and visual fingerprinting. Keep originals and clean up documents locally.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}remove-duplicate-pages/`,
    h1: 'Detect & Remove Duplicate Pages from PDF',
    shortDescription: 'Find and delete repeated pages using text and layout fingerprinting.',
    instructions: [
      {
        step: 1,
        title: 'Upload Multi-Page PDF',
        desc: 'Select a PDF that may contain accidental repeated or duplicate pages.',
      },
      {
        step: 2,
        title: 'Review Duplicate Clusters',
        desc: 'Inspect detected duplicate page groups and confirm which pages to delete.',
      },
      {
        step: 3,
        title: 'Download Cleaned PDF',
        desc: 'Remove selected duplicates without altering the sequence of remaining pages.',
      },
    ],
    limitations: [
      'Detects duplicate pages using text checksums and visual dimension fingerprints.',
      'Scanned pages with scanner noise or slight skew may require manual review.',
    ],
    privacyNotes: [
      'Page fingerprinting and deletion execute entirely in browser memory.',
      'Zero data is uploaded or logged.',
    ],
    relatedToolIds: ['delete-blank-pages', 'organize', 'split'],
  },
  {
    toolId: 'bookmarks',
    slug: 'bookmarks',
    name: 'Add Bookmarks',
    title: 'Add Bookmarks to PDF — Create Outline Navigation | OwnPDF',
    metaDescription:
      'Add hierarchical chapter bookmarks and navigation outlines to PDF documents. Creates ISO 32000-1 compliant outlines with 100% client-side privacy.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}bookmarks/`,
    h1: 'Add Navigation Bookmarks to PDF',
    shortDescription: 'Build structured outlines and table-of-contents navigation for PDF readers.',
    instructions: [
      {
        step: 1,
        title: 'Upload PDF Document',
        desc: 'Select any PDF file where you want to add or organize bookmarks.',
      },
      {
        step: 2,
        title: 'Build Outline Structure',
        desc: 'Add chapters and subsections, assign target page numbers, and configure hierarchy.',
      },
      {
        step: 3,
        title: 'Save & Download',
        desc: 'Download the PDF with standard ISO 32000-1 outlines configured to open automatically in viewers.',
      },
    ],
    limitations: [
      'Supports top-level chapters and nested subsections pointing to valid document pages.',
      'Target page numbers are validated against total document page bounds.',
    ],
    privacyNotes: [
      'Outline dictionaries and destinations are constructed in local browser memory.',
      'No files are transmitted or stored remotely.',
    ],
    relatedToolIds: ['page-numbers', 'organize', 'inspect'],
  },
  {
    toolId: 'redact',
    slug: 'redact',
    name: 'Redact PDF',
    title: 'Redact PDF — Permanent Client-Side Sensitive Data Removal | OwnPDF',
    metaDescription:
      'Permanently redact confidential text, account numbers, and images from PDF files. Reconstructs affected pages from sanitized raster images for irreversible destruction.',
    canonicalUrl: `${PRODUCTION_ORIGIN}${BASE_PATH}redact/`,
    h1: 'Permanent Client-Side PDF Redaction',
    shortDescription: 'Black out sensitive text and images with permanent raster reconstruction.',
    instructions: [
      {
        step: 1,
        title: 'Upload Document',
        desc: 'Select the PDF containing sensitive information to redact.',
      },
      {
        step: 2,
        title: 'Draw Redaction Boxes',
        desc: 'Click and drag over sensitive text, numbers, or images on the page preview.',
      },
      {
        step: 3,
        title: 'Burn Redactions & Download',
        desc: 'Affected pages are reconstructed from sanitized raster images with metadata purged.',
      },
    ],
    limitations: [
      'Affected pages are rebuilt exclusively from sanitized raster images to permanently destroy underlying text and vector streams.',
      'Redaction destroys underlying text selection on redacted pages; non-affected pages retain vector text quality.',
    ],
    privacyNotes: [
      'Redaction occurs entirely on your device with solid black burned into canvas memory.',
      'Original content streams, text operators, and structural metadata are purged forever.',
    ],
    relatedToolIds: ['flatten', 'find-replace', 'protect'],
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
