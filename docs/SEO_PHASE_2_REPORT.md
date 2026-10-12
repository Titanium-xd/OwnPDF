# OwnPDF — SEO Phase 2: Landing Pages & URL Architecture Report

**Project:** OwnPDF  
**Production URL:** [https://titanium-xd.github.io/OwnPDF/](https://titanium-xd.github.io/OwnPDF/)  
**Stack:** React 19, TypeScript, Vite, Tailwind CSS  
**Deployment Platform:** GitHub Pages  
**Search Console Status:** Verified (`A5HBnMzskxpYN049quXzj_7v-FKCmpSW1K9g_xfbwvM`)  
**Phase:** Phase 2 — SEO Landing Pages, Clean URL Architecture & Static Prerendering  

---

## 1. Overview of Phase 2

In Phase 1, the homepage metadata, heading hierarchy, and base XML sitemap were standardized. However, all 8 PDF tools operated solely via React state on a single URL (`https://titanium-xd.github.io/OwnPDF/`), preventing search engines from indexing individual tools.

In Phase 2, OwnPDF was transformed into a **multi-page, statically prerendered application with clean, canonical URLs** for each of its 8 implemented tools. The architecture achieves:
- **Real HTTP 200 responses** directly served by GitHub Pages for every tool route without relying on 404 fallbacks.
- **Immediate static crawlability** with unique `<title>`, `<meta name="description">`, self-referencing canonical tag, Open Graph/Twitter cards, and a single semantic `<h1>` before JavaScript runs.
- **Native HTML5 History routing** with zero external dependencies (no heavy `react-router`), preserving in-memory files during in-app navigation and browser Back/Forward traversal.
- **Dedicated 404 Not-Found page** with `noindex` and a crawlable directory of all available tools.
- **Strict adherence to the ephemeral, zero-upload privacy model**.

---

## 2. Canonical URL & Route Matrix

All 8 implemented tools map to clean, canonical URLs under the `/OwnPDF/` base path:

| Tool ID | Clean Slug | Production Canonical URL | Tool Name | Primary H1 |
| :--- | :--- | :--- | :--- | :--- |
| *Homepage* | `/` | `https://titanium-xd.github.io/OwnPDF/` | OwnPDF Home | `Free Private PDF Tools. Your device. Your privacy.` |
| `unlock` | `unlock` | `https://titanium-xd.github.io/OwnPDF/unlock/` | Unlock PDF | `Unlock Password-Protected PDFs Locally` |
| `protect` | `protect` | `https://titanium-xd.github.io/OwnPDF/protect/` | Protect PDF | `Protect PDFs with AES-256 Encryption` |
| `merge` | `merge` | `https://titanium-xd.github.io/OwnPDF/merge/` | Merge PDF | `Merge Multiple PDF Files Together` |
| `split` | `split` | `https://titanium-xd.github.io/OwnPDF/split/` | Split & Extract | `Split PDF & Extract Pages` |
| `organize` | `organize` | `https://titanium-xd.github.io/OwnPDF/organize/` | Organize Pages | `Organize, Rotate & Delete PDF Pages` |
| `images` | `images-to-pdf` | `https://titanium-xd.github.io/OwnPDF/images-to-pdf/` | Images to PDF | `Convert Images to PDF Online` |
| `compress` | `compress` | `https://titanium-xd.github.io/OwnPDF/compress/` | Compress PDF | `Compress & Optimize PDF File Size` |
| `inspect` | `inspect` | `https://titanium-xd.github.io/OwnPDF/inspect/` | Inspect & Sanitize | `Inspect PDF Properties & Sanitize Metadata` |

---

## 3. Technical Implementation Details

### 3.1 Centralized Route Registry (`src/config/routes.ts`)
A single TypeScript configuration serves as the single source of truth across the build plugin, runtime router, and sitemap generator:
- Defines strongly typed metadata (`ToolRoute`) for each tool: slug, title, meta description, canonical URL, primary H1, grounded instructions (steps 1–3), technical limitations, privacy guarantees, and related tool IDs.
- Provides path matching and formatting utilities: `getRouteFromPathname`, `getPathForTool`, `isInvalidRoute`, `isModifiedEvent`.

### 3.2 Build-Time Static HTML & Sitemap Generator (`vite.config.ts`)
A custom Vite build plugin hook (`closeBundle`) runs during `npm run build`:
1. Reads the bundled `dist/index.html` containing hashed JS/CSS assets.
2. For each tool in `toolRoutes`:
   - Creates `dist/<slug>/index.html`.
   - Injects tool-specific title, description, canonical link, Open Graph, and Twitter metadata.
   - Pre-renders static semantic HTML into `#root` (header, primary `<h1>`, tool dropzone skeleton, step-by-step instructions, privacy guarantees, limitations, and related tool links).
3. Emits `dist/404.html` with `<meta name="robots" content="noindex, follow" />`, clear 404 message, and crawlable links to home and all 8 tools.
4. Directly emits `dist/sitemap.xml` with all 9 canonical URLs.

### 3.3 Zero-Dependency Client Router & Session Lifecycle (`SessionContext.tsx`)
- **Route Detection:** On page load, `SessionProvider` inspects `window.location.pathname` against `src/config/routes.ts` and sets `activeTool`.
- **History Synchronization:** When switching tools, `setActiveTool` uses `window.history.pushState` to update the URL bar, `document.title`, and the canonical `<link>` dynamically.
- **Browser History:** A `popstate` event listener handles browser Back and Forward navigation without reloading the page.
- **Modified Clicks:** All internal links use `isModifiedEvent(e)` so Cmd/Ctrl+click or middle-click opens in a new tab normally without triggering SPA navigation.
- **In-Memory Sessions:** Client-side navigation preserves all loaded PDF buffers across tool switches.
- **Ephemeral Privacy Guarantee:** Hard page refreshes reset ephemeral memory buffers (`Uint8Array`) to guarantee no persistence of sensitive document bytes, strictly adhering to `PRIVACY.md`.

### 3.4 Shared SEO Guide Component (`src/components/ToolSeoGuide.tsx`)
Rendered inside `WorkspaceLayout.tsx` beneath the active tool interface. The React component renders the exact same semantic elements (H2 section, step-by-step instructions, limitations, privacy guarantees, related tool links) as the build-time static HTML generator, ensuring zero content mismatch or layout shifts between the pre-rendered shell and client React app.

---

## 4. Build, Test, and Production Server Verification

### 4.1 Vitest Automated Test Suite
- **Command:** `npm test`
- **Result:** `10 passed (10 test files, 36 tests total)`
- **New Tests Added:**
  - `test/routing/routes.test.ts` (6 tests): Validates route definitions, slug uniqueness, canonical URLs, related tool integrity, base path resolution, and invalid route detection.
  - `test/routing/sitemap.test.ts` (1 test): Asserts `public/sitemap.xml` contains all 9 canonical URLs matching the registry.
  - `test/routing/prerender.test.ts` (3 tests): Tests `dist/` build output to verify that every tool's `index.html` exists, contains exactly one `<h1>`, unique title, description, and canonical URL, and verifies `dist/404.html` and `dist/sitemap.xml`.

### 4.2 Production Preview Server Verification (`scripts/verify-production-build.mjs`)
To verify actual HTTP responses against the `/OwnPDF/` deployment base path:
- **Server:** Local static server mounting `dist/` at `http://localhost:4173/OwnPDF/` with COOP/COEP headers.
- **Route Status Validation Results:**
  - `GET /OwnPDF/` &rarr; **HTTP 200 OK** (H1: "Free Private PDF Tools", Title: "OwnPDF — Free Private PDF Tools")
  - `GET /OwnPDF/unlock/` &rarr; **HTTP 200 OK** (H1: "Unlock Password-Protected PDFs Locally")
  - `GET /OwnPDF/protect/` &rarr; **HTTP 200 OK** (H1: "Protect PDFs with AES-256 Encryption")
  - `GET /OwnPDF/merge/` &rarr; **HTTP 200 OK** (H1: "Merge Multiple PDF Files Together")
  - `GET /OwnPDF/split/` &rarr; **HTTP 200 OK** (H1: "Split PDF & Extract Pages")
  - `GET /OwnPDF/organize/` &rarr; **HTTP 200 OK** (H1: "Organize, Rotate & Delete PDF Pages")
  - `GET /OwnPDF/images-to-pdf/` &rarr; **HTTP 200 OK** (H1: "Convert Images to PDF Online")
  - `GET /OwnPDF/compress/` &rarr; **HTTP 200 OK** (H1: "Compress & Optimize PDF File Size")
  - `GET /OwnPDF/inspect/` &rarr; **HTTP 200 OK** (H1: "Inspect PDF Properties & Sanitize Metadata")
  - `GET /OwnPDF/nonexistent-route/` &rarr; **HTTP 404 Not Found** (contains `<meta name="robots" content="noindex, follow" />` and tool directory)
  - `GET /OwnPDF/sitemap.xml` &rarr; **HTTP 200 OK** (valid XML, all 9 canonical URLs)
  - `GET /OwnPDF/robots.txt` &rarr; **HTTP 200 OK** (allows crawling, references sitemap)

---

## 5. Summary of Files Changed & Created

| File | Type | Description |
| :--- | :--- | :--- |
| [src/config/routes.ts](file:///media/parva/Work/ownPDF/src/config/routes.ts) | Created | Centralized route registry, tool metadata, instructions, limitations, and routing utilities. |
| [src/components/ToolSeoGuide.tsx](file:///media/parva/Work/ownPDF/src/components/ToolSeoGuide.tsx) | Created | Reusable educational SEO guide section for all tool workspaces. |
| [src/components/NotFoundView.tsx](file:///media/parva/Work/ownPDF/src/components/NotFoundView.tsx) | Created | Dedicated client-side 404 view with directory links. |
| [scripts/verify-production-build.mjs](file:///media/parva/Work/ownPDF/scripts/verify-production-build.mjs) | Created | Production verification script testing HTTP status codes, H1s, titles, and 404 behavior. |
| [test/routing/routes.test.ts](file:///media/parva/Work/ownPDF/test/routing/routes.test.ts) | Created | Unit tests for route matching, slug validation, and metadata integrity. |
| [test/routing/sitemap.test.ts](file:///media/parva/Work/ownPDF/test/routing/sitemap.test.ts) | Created | Test verifying sitemap consistency with route registry. |
| [test/routing/prerender.test.ts](file:///media/parva/Work/ownPDF/test/routing/prerender.test.ts) | Created | Integration tests verifying physical pre-rendered HTML files in `dist/`. |
| [public/sitemap.xml](file:///media/parva/Work/ownPDF/public/sitemap.xml) | Modified | Updated source sitemap with all 9 canonical URLs matching the registry. |
| [vite.config.ts](file:///media/parva/Work/ownPDF/vite.config.ts) | Modified | Added build-time static HTML and sitemap generator plugin in `closeBundle`. |
| [src/context/SessionContext.tsx](file:///media/parva/Work/ownPDF/src/context/SessionContext.tsx) | Modified | Integrated HTML5 history routing (`pushState`, `popstate`), dynamic title/canonical updates, and 404 detection. |
| [src/App.tsx](file:///media/parva/Work/ownPDF/src/App.tsx) | Modified | Added `NotFoundView` rendering on invalid routes. |
| [src/components/Header.tsx](file:///media/parva/Work/ownPDF/src/components/Header.tsx) | Modified | Changed logo button to crawlable `<a href>` tag with SPA click handler. |
| [src/components/ToolGrid.tsx](file:///media/parva/Work/ownPDF/src/components/ToolGrid.tsx) | Modified | Wrapped tool cards in crawlable `<a href>` tags with modifier-click support. |
| [src/components/WorkspaceLayout.tsx](file:///media/parva/Work/ownPDF/src/components/WorkspaceLayout.tsx) | Modified | Added primary `<h1>`, crawlable back button, and embedded `ToolSeoGuide`. |
| [docs/SEO_PHASE_2_REPORT.md](file:///media/parva/Work/ownPDF/docs/SEO_PHASE_2_REPORT.md) | Created | This report document. |

---

## 6. Remaining SEO & Platform Limitations

1. **Google Subdirectory Site Name Limitation:**
   Google's `WebSite` Schema Site Name feature is explicitly restricted to root domains or subdomains. Subdirectory deployments like `https://titanium-xd.github.io/OwnPDF/` inherit the parent domain name (`github.io`) in Google Search snippets. Showing "OwnPDF" as the independent site name in search results requires migrating to a custom domain (e.g., `ownpdf.org`).
2. **Review & Rating Rich Snippets:**
   Google requires authentic user ratings (`aggregateRating`) or user reviews for software rich snippets. Because OwnPDF does not collect telemetry or reviews, rating markup is intentionally omitted to avoid Search Console validation errors.

---

## 7. Exact Live URLs to Verify After Next Deployment

Once committed and pushed to GitHub:
1. **Homepage:** [https://titanium-xd.github.io/OwnPDF/](https://titanium-xd.github.io/OwnPDF/)
2. **Unlock PDF:** [https://titanium-xd.github.io/OwnPDF/unlock/](https://titanium-xd.github.io/OwnPDF/unlock/)
3. **Protect PDF:** [https://titanium-xd.github.io/OwnPDF/protect/](https://titanium-xd.github.io/OwnPDF/protect/)
4. **Merge PDF:** [https://titanium-xd.github.io/OwnPDF/merge/](https://titanium-xd.github.io/OwnPDF/merge/)
5. **Split & Extract:** [https://titanium-xd.github.io/OwnPDF/split/](https://titanium-xd.github.io/OwnPDF/split/)
6. **Organize Pages:** [https://titanium-xd.github.io/OwnPDF/organize/](https://titanium-xd.github.io/OwnPDF/organize/)
7. **Images to PDF:** [https://titanium-xd.github.io/OwnPDF/images-to-pdf/](https://titanium-xd.github.io/OwnPDF/images-to-pdf/)
8. **Compress PDF:** [https://titanium-xd.github.io/OwnPDF/compress/](https://titanium-xd.github.io/OwnPDF/compress/)
9. **Inspect & Sanitize:** [https://titanium-xd.github.io/OwnPDF/inspect/](https://titanium-xd.github.io/OwnPDF/inspect/)
10. **Sitemap XML:** [https://titanium-xd.github.io/OwnPDF/sitemap.xml](https://titanium-xd.github.io/OwnPDF/sitemap.xml)
11. **Robots TXT:** [https://titanium-xd.github.io/OwnPDF/robots.txt](https://titanium-xd.github.io/OwnPDF/robots.txt)
