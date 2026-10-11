# OwnPDF — Privacy & Security Architecture

## 1. Core Local-First Guarantee

The core promise of OwnPDF is simple: **Your PDFs. Your device. Your privacy.**

### The Non-Negotiables:
1. **Zero Server Uploads:** Document bytes, passwords, extracted text, and document metadata are processed exclusively inside your web browser. They are never transmitted to any server or cloud API.
2. **Zero Analytics & Telemetry:** There are no trackers, no advertising beacons, no third-party error trackers (e.g. Sentry), and no analytics packages (e.g. Google Analytics, Mixpanel).
3. **Zero AI / External API Integrations:** No documents or text contents are fed into external AI providers or remote translation/conversion services.
4. **Self-Contained Bundling:** All application logic, cryptographic routines (QPDF WASM), rendering libraries (PDF.js), icons, and styles are served from the static site origin.

> [!NOTE]
> **Honest Network Transparency:**
> When you first navigate to OwnPDF, your browser must download the static application assets (HTML, CSS, JavaScript bundles, fonts, and the WebAssembly binary). Once these assets are loaded, **all PDF operations are executed locally**. The application operates with zero network communication during document processing.

---

## 2. Best-Effort Memory & Ephemeral Data Hygiene

In a JavaScript runtime environment, applications cannot enforce deterministic, instant physical erasure of every memory block or CPU cache line due to automatic garbage collection and browser internal memory management.

OwnPDF adopts an honest **best-effort data hygiene protocol**:

### 2.1 Passwords
- Entered passwords exist only in local React component state during the active unlock/protect operation.
- Passwords are never written to `localStorage`, `sessionStorage`, `IndexedDB`, WebSQL, or cookies.
- Passwords are never printed to browser console logs (`console.log`, `console.error`).
- After the cryptographic operation completes or the modal is dismissed, the password string state is immediately cleared.

### 2.2 Buffers & Virtual File System (MEMFS)
- **Virtual File System Cleanup:** When QPDF WebAssembly processes a file inside its Web Worker virtual filesystem, both the input `/work/input.pdf` and output `/work/output.pdf` are explicitly unlinked using `FS.unlink()` immediately after the output bytes are copied to memory.
- **Buffer De-referencing:** Temporary `Uint8Array` and `ArrayBuffer` instances are decoupled and dereferenced once operations finish to allow timely garbage collection.
- **Worker Recycling:** If an unrecoverable failure occurs or when a user clicks "Clear Session", active Web Workers are terminated via `worker.terminate()` and newly instantiated, releasing all associated WebAssembly linear memory heaps.

### 2.3 Object URLs & Canvas Contexts
- Every Object URL created for document previews or download links (`blob:...`) is tracked in an internal registry.
- When a document is removed, replaced, or downloaded, the corresponding URL is immediately revoked via `URL.revokeObjectURL(url)`.
- When a preview canvas unmounts, its 2D rendering context is wiped (`ctx.clearRect(0, 0, width, height)`), canvas dimensions are reset to 0, and backing textures are released.

### 2.4 The "Clear Session" Mechanism
A prominent, accessible **"Clear Session"** control is always available in the top navigation bar:
- Instantly wipes the active document queue.
- Revokes all registered `blob:` URLs.
- Clears all canvas elements and UI previews.
- Terminates and respawns the background Web Workers.
- Resets all component states to their pristine initial condition.

---

## 3. Threat Modeling & Defense in Depth

| Threat | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Exfiltration of PDF bytes via malicious network requests** | Critical | Strict Content Security Policy (`connect-src 'self' blob:`), automated network isolation integration tests. |
| **Persistence of sensitive documents across browser reboots** | High | Purely in-memory session state; strictly zero IndexedDB or localStorage persistence for file buffers. |
| **Malicious PDF Exploits / Buffer Overflows** | High | QPDF WebAssembly runs within a sandboxed Web Worker isolated from DOM and credentials. |
| **Accidental password leak via telemetry/logging** | High | Zero telemetry dependencies installed in `package.json`; console logging stripped in production builds. |
| **Browser tab crash on huge PDFs** | Medium | 100 MB recommended file limit; worker watchdog timeout (60s) with graceful UI recovery. |

---

## 4. Content Security Policy & HTTP Headers

For production static deployment, OwnPDF utilizes the following headers (configured in `vercel.json` / static server):

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

---

## 5. Privacy Verification Protocol

We verify privacy claims through automated browser tests:
1. Every PDF tool operation (Unlock, Protect, Merge, Split, Organize, Images, Compress, Sanitize) is executed under a network-monitoring test harness.
2. The test harness records all outbound requests (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`).
3. The assertion confirms that **zero outbound network requests** occur during document processing, and no document bytes or password strings appear in request URLs, headers, or payloads.
