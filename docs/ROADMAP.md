# OwnPDF — Development Roadmap & Milestone Tracker

**Product Tagline:** Your PDFs. Your device. Your privacy.

This roadmap tracks the development progress, decisions, known limitations, and next steps for the OwnPDF project.

---

## Milestone Status Overview

| Milestone | Title | Status | Primary Deliverable |
| :--- | :--- | :--- | :--- |
| **Milestone 0** | Inspection, Architecture & Documentation | **COMPLETED** | `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/TEST_PLAN.md`, `docs/ROADMAP.md` |
| **Milestone 0.5** | Technical Prototype & QPDF WASM POC | **COMPLETED** | Web Worker QPDF WASM decryption (`testpass123`), AES-256 encryption, MEMFS cleanup, zero-network tests, Vite bundling |
| **Milestone 1** | Application Shell & Design System | **COMPLETED** | Header with privacy badge, Dark/Light mode, drag-drop zone with magic byte validation, active session drawer, tool catalog |
| **Milestone 2** | Production Unlocking & Protection Workspaces | **COMPLETED** | `UnlockTool` (QPDF decryption, canvas preview, honesty errors), `ProtectTool` (AES-256 with password strength) |
| **Milestone 3** | PDF Organization Workspaces | **COMPLETED** | `MergeTool` (multi-file reordering), `SplitTool` (ranges + ZIP export), `OrganizeTool` (PDF.js visual thumbnail gallery, 90° rotation, deletion) |
| **Milestone 4** | Utilities: Convert, Compress & Inspect | **COMPLETED** | `ImagesToPdfTool` (JPG/PNG conversion), `CompressTool` (linearization with honest reporting), `InspectTool` (catalog viewer & v1 metadata sanitizer) |
| **Milestone 5** | Hardening, Testing & Deployment Readiness | **COMPLETED** | 12/12 passing Vitest tests, network isolation tests, strict TS `npm run build`, `vercel.json` with CSP |
| **Milestone 6** | Bug Fixes, UI Polish & Per-Tool File Management | **COMPLETED** | Resolved UUID download bug, bespoke folded-doc logo & favicon, Tailwind v4 theme persistence, GitHub button, removed test UI, per-tool decoupled file selection (22/22 tests passing) |

---

## Completed Work Log

### Milestone 0 — Inspection, Architecture & Documentation (Completed)
- Documented findings regarding `pdfstudio` (non-existent on npm; historical desktop software).
- Evaluated and selected `@neslinesli93/qpdf-wasm` pinned to `0.3.0`.
- Formulated layered engine architecture (`PdfEngine`) and worker isolation protocols.
- Authored `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/TEST_PLAN.md`, and `docs/ROADMAP.md`.

### Milestone 0.5 — Technical Prototype & QPDF WASM POC (Completed)
- Built `src/workers/qpdf.worker.ts` with transferable `ArrayBuffer` RPC and automatic MEMFS file unlinking (`FS.unlink`).
- Built `src/components/PrototypeView.tsx` with live event logging.
- Generated synthetic test fixtures (`scripts/generate-fixtures.mjs`).
- Verified decryption of AES-256 document in **201ms**, wrong-password rejection (`INCORRECT_PASSWORD`), and re-encryption in browser.

### Milestone 1 — Production Design System & Application Shell (Completed)
- Implemented modern, polished consumer design system with Tailwind CSS.
- Top navigation with Privacy Status pulse badge, memory counter, and "Clear Session" trigger.
- Interactive drag-and-drop zone with synthetic fixture one-click loaders.
- Categorized and searchable tool catalog with 8 dedicated tools.
- Session active files drawer with memory tracker.

### Milestone 2 — Unlocking & Protection (Completed)
- `UnlockTool`: Auto-encryption detection, show/hide password toggle, QPDF WASM decryption, integrity verification, first-page canvas preview, and confetti download.
- `ProtectTool`: Password strength estimation, AES-256 standard encryption, verification check, and download.

### Milestone 3 — Document Organization (Completed)
- `MergeTool`: Multi-file queue with Move Up/Down reordering and page count calculation.
- `SplitTool`: Custom page range parser (`1-3, 5`), individual page splitter, and JSZip multi-part download.
- `OrganizeTool`: PDF.js visual thumbnail grid, 90° clockwise rotation, page reordering, page deletion with undo.

### Milestone 4 — Utilities: Convert, Compress & Inspect (Completed)
- `ImagesToPdfTool`: Multi-image JPEG/PNG embedding with A4, Letter, and Fit-to-image sizing and margins.
- `CompressTool`: Structural optimization and linearization with honest before/after metrics and zero-loss guarantees.
- `InspectTool`: Document structure viewer and explicit v1 metadata sanitizer stripping Title, Author, Subject, Keywords, Creator, Producer, Dates, and XMP streams.

### Milestone 5 — Hardening, Quality & Deployment Readiness (Completed)
- 12 automated unit, integration, and privacy tests passing in Vitest.
- Strict TypeScript typechecking (`tsc -b`) passing with zero errors.
- Production bundle successfully verified.
- `vercel.json` configured with strict Content Security Policy and WASM headers.
- Comprehensive `README.md` documentation completed.

### Milestone 6 — Bug Fixes, UI Polish & Per-Tool File Management (Completed)
- **Resolved PDF Unlock Download Bug:**
  - Implemented `src/utils/download.ts` with DOM-appended anchor download and `%PDF-` signature verification.
  - Sanitized filenames case-insensitively (`.replace(/\.pdf$/i, '')`), removed illegal characters, and prevented duplicate suffixes.
  - Sliced and copied decrypted bytes in `qpdf.worker.ts` prior to MEMFS unlinking.
  - Verified decrypted documents open without passwords and retain correct page counts.
- **Bespoke Vector Logo & Favicon:**
  - Designed custom folded-document logo with integrated privacy keyhole motif (`src/components/Logo.tsx`).
  - Updated `public/favicon.svg` to match brand identity.
- **Reliable Light/Dark Theme Switch:**
  - Added `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css` for Tailwind CSS v4 class-based theming.
  - Persisted theme preferences in `localStorage` with system preference fallback and startup anti-flash script in `index.html`.
- **Developer Test UI Removal:**
  - Removed "Quick Test Fixtures" from public homepage dropzone.
  - Removed public "POC Lab" navigation button and footer link while preserving automated test fixtures.
- **Badge Polish:**
  - Replaced hero privacy capsule with restrained inline indicator.
  - Removed `Local-First` chip next to logo and replaced `100% On-Device` badge with a subtle inline status.
- **GitHub Header Capsule Button:**
  - Added styled black capsule button in Header reading `siteConfig.repoUrl` (`VITE_PUBLIC_REPO_URL`).
  - Gracefully disabled with tooltip when unconfigured.
- **Per-Tool File Management & Decoupled State:**
  - Created `ToolFileSelector.tsx` for tool dropzones and browse controls.
  - Supported compact 2-choice panel when homepage contains files (`Use files from Home` vs `Upload files for this tool`).
  - Overriding homepage queue immediately for tool-specific uploads without mutating the home queue.
  - Explicit target selection for single-document operations when multiple files are available.
- **Automated Test Suite Expansion:**
  - Expanded test suite to 22 passing tests covering filename sanitization, buffer verification, and per-tool state decoupling.

