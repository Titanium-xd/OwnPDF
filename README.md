<div align="center">

  <img src="public/lumacut_ownpdf.png" alt="OwnPDF Mascot" width="120" style="border-radius: 28px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.25);" />

  # OwnPDF

  **Your PDFs. Your device. Your privacy.**

  *A blazing-fast, privacy-first PDF utility suite powered by WebAssembly. Unlock, protect, merge, split, organize, convert, redact, and inspect documents with 26 tools 100% in your browser.*

  <p align="center">
    <a href="https://github.com/Titanium-xd/OwnPDF/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-0ea5e9?style=for-the-badge" alt="License" /></a>
    <a href="https://github.com/Titanium-xd/OwnPDF"><img src="https://img.shields.io/badge/Zero_Uploads-100%25_Local-10b981?style=for-the-badge" alt="Zero Uploads" /></a>
    <a href="https://github.com/Titanium-xd/OwnPDF"><img src="https://img.shields.io/badge/Tools-26_On--Device-6366f1?style=for-the-badge" alt="26 Tools" /></a>
  </p>

  <p align="center">
    <a href="#-why-ownpdf">Why OwnPDF?</a> •
    <a href="#-features">26 PDF Tools</a> •
    <a href="#-architecture--privacy">Architecture & Privacy</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-verification--testing">Testing</a>
  </p>

</div>

---

## 💡 Why OwnPDF?

Every day, millions of people upload sensitive documents—**e-Aadhaar cards, bank account statements, tax filings, salary slips, and medical records**—to random cloud PDF websites just to remove a password, merge two pages, or split a chapter.

Those servers gain full access to your most confidential information.

**OwnPDF solves this completely.**
By compiling industry-standard PDF engines (**QPDF**, **pdf-lib**, and **Mozilla PDF.js**) directly to **WebAssembly** and executing them inside client-side Web Workers, OwnPDF brings desktop-class PDF manipulation into your web browser. 

- 🚫 **Zero Server Uploads**: No backend server exists. Files never leave your local RAM.
- 🛡️ **Zero Tracking**: No Google Analytics, telemetry, cookies, or remote logging.
- ⚡ **Hardware Accelerated**: Multi-threaded Web Workers with zero main-thread UI freezing.
- 🎨 **Modern Sky-Blue Aesthetic**: Beautiful, fluid design with adaptive dark/light themes and bundled local typography.
- 📦 **26 Built-In Tools**: Complete toolkit covering security, organization, conversion, optimization, and document inspection.

---

## ✨ Features: 26 Local-First PDF Tools

OwnPDF delivers 26 production-grade PDF tools organized into five intuitive categories:

### 🔒 Security & Privacy

#### 1. 🔓 Unlock PDF (Password Removal)
*Permanently remove document opening passwords from authorized files.*
- **Ideal for:** Indian e-Aadhaar cards, bank e-statements, locked payslips, and invoices.
- **Engine:** Client-side **QPDF WebAssembly Worker** for cryptographic decryption.
- **Safety:** Clear diagnostics distinguishing wrong passwords from corrupted documents.
- **Preview:** Instant first-page canvas preview rendered with Mozilla PDF.js.

#### 2. 🛡️ Protect PDF (AES-256 Encryption)
*Secure your documents with military-grade encryption.*
- **Standard:** Genuine **AES-256 bit** document encryption via QPDF WASM.
- **Entropy Meter:** Real-time visual password strength assessment.
- **Pre-download Check:** Verifies header validity and `%PDF-` signature before saving.

#### 3. 🏷️ Add Watermark
*Stamp custom text or image watermarks onto document pages.*
- **Customization:** Configurable opacity, font size, angle, repeating grid patterns, and z-order placement.
- **Scope:** Apply watermarks across all pages, odd/even subsets, or specific ranges.

#### 4. 🛡️ Redact PDF *(Beta / Under Development)*
*Permanently destroy sensitive information with irreversible raster reconstruction.*
- **Destruction:** Affected pages are rebuilt exclusively from sanitized raster images—purging underlying text and vector operator streams completely.
- **Shape Tools:** Text-selection redaction, freehand rectangles, squares, circles, and ellipses.
- **Status:** Under active development. Fully functional client-side raster burning; visual preview and canvas alignments are continuously refined.

---

### 📑 Organize & Page Layout

#### 5. 📑 Merge PDF
*Combine multiple documents, certificates, or assignments into one unified file.*
- **Drag & Reorder:** Interactive file sequence manager with move up/down controls.
- **Multi-source:** Merge files from your session queue or pick new files on the fly.
- **Integrity:** Preserves document resolution, bookmarks, and vector elements.

#### 6. ✂️ Split PDF & Extract Pages
*Extract specific portions of large documents with precision.*
- **Flexible Ranges:** Syntax support for custom ranges (e.g. `1-3, 5, 8-12`).
- **Single Page Extraction:** Split all pages into separate standalone documents.
- **Smart Export:** Download individual slices or bundle everything into a single **ZIP archive** (powered by JSZip).

#### 7. 🗂️ Organize Pages
*Visual page organizer with interactive page-level management.*
- **Live Gallery:** HiDPI thumbnail grid rendered directly from PDF vectors.
- **Page Operations:** Rotate pages clockwise (90° increments), reorder via drag/click, or delete unwanted sheets.
- **Safety Net:** Instant undo capability for deleted pages before saving.

#### 8. 🔄 Rotate PDF
*Permanently rotate selected pages or entire PDF files.*
- **Increments:** 90°, 180°, and 270° clockwise rotations.
- **Selective:** Rotate all pages, odd pages, even pages, or specific page lists.

#### 9. 🔢 Add Page Numbers
*Insert customizable page numbers and pagination headers/footers.*
- **Positions:** Top/bottom and left/center/right alignment.
- **Formatting:** Custom prefixes, suffixes, roman numerals, and starting offsets.

#### 10. ✂️ Crop PDF
*Trim margins or adjust visible bounding boxes across document pages.*
- **Interactive:** Visual crop box preview with draggable edge handles.
- **Standard Presets:** Quick margins, uniform trim, or custom dimensions in points.

#### 11. ↕️ Reverse Pages
*Invert page order with 1-click presets.*
- **Modes:** Entire document reversal, custom ranges, or alternating duplex scanner back-sides.

#### 12. 🗑️ Delete Blank Pages
*Detect and purge empty or accidental scanner pages automatically.*
- **Dual-Analysis:** Combines ink-density pixel sampling with PDF.js text-layer checks.
- **Thresholds:** Tunable sensitivity threshold with page preview before deletion.

#### 13. 📏 Resize PDF
*Scale or pad document pages to standard international paper sizes.*
- **Sizes:** A4, US Letter, A3, Legal, Executive, and custom dimensions.
- **Fitting:** Proportional scaling with letterboxing or boundary canvas padding.

#### 14. 📋 Fill PDF Forms
*Fill interactive AcroForm fields directly in your browser.*
- **Field Support:** Text inputs, checkboxes, radio button groups, and dropdown selectors.
- **Export:** Save filled forms with preserved interactive fields for downstream submission.

#### 15. 👥 Remove Duplicate Pages
*Detect and purge duplicate pages within multi-scan files.*
- **Detection:** Text checksum hashing combined with structural layout fingerprints.
- **Review:** Side-by-side comparison before confirming removal.

#### 16. 🔖 Add Bookmarks
*Build structured outlines and table-of-contents navigation for PDF readers.*
- **Hierarchy:** Multi-level parent/child bookmark nesting.
- **Destinations:** Direct page jumps with custom view offsets.

---

### 🔄 Convert

#### 17. 🖼️ Images to PDF
*Transform images into beautifully formatted PDF documents.*
- **Formats:** Full support for PNG, JPG, and JPEG.
- **Layouts:** Standard **A4**, **US Letter**, or **Fit to Image**.
- **Controls:** Margin sliders and auto/portrait/landscape orientation detection.

#### 18. 📷 PDF to JPG / PNG
*Convert PDF pages into crisp raster images.*
- **Formats:** High-resolution JPG and lossless PNG.
- **Packaging:** Download individual images or all pages in a single ZIP archive.

#### 19. 🌄 Extract Images
*Extract all embedded photos and raster figures from PDF streams.*
- **Lossless:** Recovers raw embedded image streams without recompression artifacts.
- **ZIP Export:** Packages all extracted visual assets with original resolutions.

---

### ⚡ Optimize

#### 20. 🗜️ Compress PDF
*Optimize PDF structures without cloud compromises.*
- **Techniques:** Structural linearization (Fast Web View), object stream consolidation, and unused object pruning via QPDF WASM.
- **Honest Reporting:** Transparently compares original vs. optimized size; notifies you if a document is already optimal.

#### 21. 📄 Flatten PDF
*Bake interactive form fields, comments, and annotations into permanent content.*
- **Vector & Image Modes:** Flatten AcroForms into native page vectors or convert to flattened raster pages to prevent subsequent tampering.

---

### 🔍 Inspect & Search

#### 22. 🔍 Inspect & Sanitize Metadata
*Audit document security and erase sensitive tracking data.*
- **Deep Audit:** Inspect PDF versions, page counts, title, author, producer, creation/modification dates, and catalog dictionaries.
- **One-Click Sanitizer:** Strips all identifying metadata attributes and embedded XMP tracking packets.

#### 23. 📝 Extract Text
*Extract selectable text into clean UTF-8 text files.*
- **Preservation:** Retains layout flow, linebreaks, and reading order.
- **Export:** Instant copy-to-clipboard or `.txt` file download.

#### 24. 🔁 Find & Replace
*Search and replace names, enrollment numbers, dates, and text strings across pages.*
- **Multi-Rule:** Run multiple replacement rules simultaneously.
- **Layout Safety:** Visual masking with bounding-box collision detection and warnings.

#### 25. 🔗 Extract Links
*Discover and export all clickable hyperlinks and internal destinations.*
- **Audit:** Extracts external web URLs, mailto links, and internal cross-references.
- **Export:** Clean list view with destination page numbers.

#### 26. ⚖️ Compare PDFs
*Side-by-side comparison of two documents.*
- **Modes:** Visual pixel-difference overlay and extracted text diff side-by-side.
- **Navigation:** Synchronized scrolling across documents.

---

## 🔒 Architecture & Privacy

```
                                [ OwnPDF Client Environment ]
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │  User Device (RAM)                                                           │
  │  ┌───────────────────────┐         ┌──────────────────────────────────────┐  │
  │  │   React 19 UI Thread  │         │         Dedicated Web Worker         │  │
  │  │   • Sky-Blue Theme    │         │  ┌────────────────────────────────┐  │  │
  │  │   • Local Fonts       │ Transfer│  │       QPDF WebAssembly         │  │  │
  │  │   • PDF.js Previews   ├─────────┼─►│  • Decryption (AES-256)        │  │  │
  │  │   • Session Storage   │ Array   │  │  • Encryption (AES-256)        │  │  │
  │  │   • Download Manager  │ Buffer  │  │  • Virtual MemFS Sandbox       │  │  │
  │  │   └───────────▲───────┘         │  └────────────────┬───────────────┘  │  │
  │              │                     │                   │ Output Stream    │  │
  │              │ Blob Stream         │                   ▼                  │  │
  │  ┌───────────┴───────────┐         │  ┌────────────────────────────────┐  │  │
  │  │ File System Access    │◄────────┼──┤      Clean TypedArray View     │  │  │
  │  │ • showSaveFilePicker  │         │  │   • %PDF- signature verified   │  │  │
  │  │ • Anchor Fallback     │         │  └────────────────────────────────┘  │  │
  │  └───────────────────────┘         └──────────────────────────────────────┘  │
  │                                                                              │
  └──────────────────────────────────────┬───────────────────────────────────────┘
                                         │
                             No Network Calls (CSP: self)
                                         ▼
                            [ 🌐 External Internet: 0 Bytes ]
```

### Privacy Guarantees
1. **Best-Effort Memory Hygiene:** Document data and passwords exist solely in ephemeral memory during the active session.
2. **Instant "Clear Session":** The persistent Clear Session button purges all active document buffers, revokes all created `blob:` URLs, and terminates active Web Workers immediately.
3. **Download Safety:** Uses the native **File System Access API** (`showSaveFilePicker`) when supported, allowing direct-to-disk streaming and preventing browser UUID filename fallback bugs. Cleanly cancels on user `AbortError` without duplicate downloads.
4. **Complete Network Isolation:** Strict automated assertions verify that all 26 processing tools produce **zero outbound network requests** (0 bytes exfiltrated).

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Strict-mode frontend runtime |
| **Bundler & Dev** | [Vite 6](https://vite.dev/) | Sub-second HMR and production bundle optimization |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Custom sky-blue design tokens & dark mode |
| **Core PDF Engine** | [QPDF WASM](https://github.com/neslinesli93/qpdf-wasm) | Cryptographic decryption, encryption, and linearization |
| **Transforms** | [pdf-lib](https://pdf-lib.js.org/) | In-memory page manipulation, merges, splits, and metadata |
| **Canvas Previews** | [Mozilla PDF.js](https://mozilla.github.io/pdf.js/) | Fast, on-device vector thumbnail rendering |
| **Multi-File Archiving**| [JSZip](https://stuk.github.io/jszip/) | In-memory ZIP packaging for split documents and image exports |
| **Typography** | [Fontsource](https://fontsource.org/) | Locally bundled **Manrope** (headings) & **Inter** (body) |
| **Icons** | [Lucide React](https://lucide.dev/) | Crisp, modern UI icons |
| **Testing** | [Vitest](https://vitest.dev/) | Unit tests, crypto benchmarks, and network isolation assertions |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`+ recommended
- **npm**: `v10.x`+

### 1. Clone & Install
```bash
git clone https://github.com/Titanium-xd/OwnPDF.git
cd OwnPDF
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. Build for Production
```bash
npm run build
npm run preview
```
The optimized static bundle will be generated in `dist/`.

---

## 🧪 Verification & Testing

OwnPDF includes a comprehensive Vitest test suite with **123 tests across 29 test suites** covering cryptographic operations, layout preservation, filename sanitization, sub-slice typed-array bounds, route generation, and privacy boundaries:

```bash
# Run all unit, crypto, and privacy tests
npm test
```

### Test Coverage Highlights:
- ✅ **Decryption & PDF.js Verification:** Tests that AES-256 encrypted documents cannot be opened without a password, decrypts via QPDF WASM, validates the `%PDF-` signature, and verifies password-free rendering in PDF.js.
- ✅ **Download Buffer Isolation:** Tests that TypedArray sub-slices with non-zero offsets are cleanly copied so external ArrayBuffer padding is never leaked.
- ✅ **Filename Sanitization:** Tests path-traversal prevention, special character filtering, case-insensitive `.pdf` extension handling, and deduplication of suffixes.
- ✅ **File System Access API Cancellation:** Tests that canceling `showSaveFilePicker()` (`AbortError`) terminates cleanly without fallback anchor clicks.
- ✅ **26-Tool Network Isolation:** Verifies zero outgoing fetch/XHR calls occur during local document processing across all 26 registered tools.
- ✅ **SEO & Pre-Rendering:** Validates physical HTML pre-rendering, unique titles, descriptions, canonical URLs, and schema markup across all 27 production routes.

---

## 🌐 Static Deployment

OwnPDF is 100% static and can be deployed anywhere with zero server configuration.

### Vercel
A pre-configured `vercel.json` is included with security headers and WASM MIME types:
```bash
npx vercel
```

### Cloudflare Pages / Netlify / GitHub Pages
Deploy the `dist/` folder directly to any static web host.

---

## 📄 License & Acknowledgements

OwnPDF is open-source software licensed under the **[MIT License](LICENSE)**.

### Open-Source Acknowledgements
- **QPDF WASM**: [Artistic License 2.0 / ISC](https://github.com/neslinesli93/qpdf-wasm)
- **pdf-lib**: [MIT License](https://github.com/Hopding/pdf-lib)
- **Mozilla PDF.js**: [Apache License 2.0](https://github.com/mozilla/pdf.js)
- **Lucide Icons**: [ISC License](https://lucide.dev/)

---

<div align="center">
  <sub>Built with ❤️ for true document privacy. Made by <a href="https://github.com/Titanium-xd">Titanium-xd</a>.</sub>
</div>
