import { PdfEngine } from '../engine/pdf-engine';

/**
 * Sanitizes a filename for download, ensuring:
 * 1. Safe filesystem characters.
 * 2. Case-insensitive stripping of existing .pdf extension.
 * 3. Prevention of duplicate suffixes (e.g. eaadhaar-unlocked-unlocked.pdf).
 * 4. Enforcing lowercase .pdf extension.
 */
export function sanitizeDownloadFilename(
  originalName: string,
  suffix: string = 'unlocked'
): string {
  if (!originalName || typeof originalName !== 'string') {
    return `document-${suffix}.pdf`;
  }

  // 1. Remove directory paths if present
  let base = originalName.trim().replace(/^.*[\\/]/, '');

  // 2. Strip trailing .pdf extension case-insensitively
  base = base.replace(/\.pdf$/i, '');

  // 3. Remove illegal filename characters across Windows/macOS/Linux: < > : " / \ | ? * and control chars
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  // 4. Clean trailing/leading underscores, dashes, or dots
  base = base.trim().replace(/^[._-]+|[._-]+$/g, '');

  if (!base) {
    base = 'document';
  }

  // 5. Avoid duplicate suffix (e.g., if base already ends with -unlocked or _unlocked)
  const escapedSuffix = suffix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const duplicateSuffixRegex = new RegExp(`[-_]${escapedSuffix}$`, 'i');
  if (duplicateSuffixRegex.test(base)) {
    return `${base}.pdf`;
  }

  return `${base}-${suffix}.pdf`;
}

/**
 * Generic file download utility for arbitrary output types (PDF, ZIP, images, etc.).
 * When showSaveFilePicker is supported (Chrome/Edge on desktop), invokes it directly.
 * If user cancels (AbortError), cleanly exits without initiating a fallback download.
 * Falls back to standard DOM-attached anchor download with deferred URL revocation.
 */
export async function downloadFile(
  blob: Blob,
  filename: string
): Promise<void> {
  const cleanFilename = filename.trim() || 'download';

  // 1. Check if File System Access API is supported and available in the current context
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const extMatch = cleanFilename.match(/\.([0-9a-z]+)$/i);
      const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
      const mimeType = blob.type || 'application/octet-stream';

      const options: any = {
        suggestedName: cleanFilename,
        types: [
          {
            description: ext === '.pdf' ? 'PDF Document' : ext === '.zip' ? 'ZIP Archive' : 'File',
            accept: {
              [mimeType]: ext ? [ext] : [],
            },
          },
        ],
      };

      const handle = await (window as any).showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // If user deliberately cancels the save dialog, stop immediately (do NOT trigger fallback anchor)
      if (err && err.name === 'AbortError') {
        return;
      }
      // For non-abort errors (security restrictions, iframe sandboxing), proceed to standard anchor fallback
      console.warn('showSaveFilePicker failed, proceeding with standard download anchor:', err);
    }
  }

  // 2. Standard DOM anchor fallback
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.style.position = 'absolute';
  anchor.style.left = '-9999px';
  anchor.href = objectUrl;
  anchor.setAttribute('download', cleanFilename);
  anchor.download = cleanFilename;

  // Append to body is required by Firefox and some Chromium versions for the download attribute
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    // Remove anchor element from DOM
    setTimeout(() => {
      if (anchor.parentNode) {
        document.body.removeChild(anchor);
      }
    }, 500);

    // Defer object URL revocation by 60 seconds so browser download manager has completed streaming
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }
}

/**
 * Specialized PDF download wrapper that:
 * 1. Accurately preserves typed-array view byte bounds without dragging unrelated buffer data.
 * 2. Validates %PDF- signature.
 * 3. Enforces .pdf extension.
 * 4. Constructs Blob with application/pdf MIME type.
 * 5. Calls downloadFile.
 */
export async function downloadPdf(
  bytes: Uint8Array,
  suggestedFilename: string
): Promise<void> {
  // Ensure typed-array bounds are strictly isolated
  const cleanBytes = new Uint8Array(bytes.length);
  cleanBytes.set(bytes);

  // Validate standard PDF header signature
  if (!PdfEngine.isValidPdfHeader(cleanBytes)) {
    throw new Error('Cannot download file: Output bytes do not contain a valid %PDF- header signature.');
  }

  let finalFilename = suggestedFilename.trim();
  if (!finalFilename.toLowerCase().endsWith('.pdf')) {
    finalFilename = `${finalFilename}.pdf`;
  }

  // Construct explicit PDF Blob
  const blob = new Blob([cleanBytes], { type: 'application/pdf' });
  await downloadFile(blob, finalFilename);
}

/**
 * Backward compatibility alias for downloadPdf.
 */
export const triggerPdfDownload = downloadPdf;
