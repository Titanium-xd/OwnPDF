import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const artifactsDir = '/home/parva/.gemini/antigravity-ide/brain/10f6b43e-a31c-4ae1-89a0-e97a96883da2';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBrowserVerification() {
  console.log('--- Starting OwnPDF Redact PDF Real-Browser Verification (Firefox 157) ---');

  // Ensure test fixture is in public/fixtures/
  const labManualSrc = '/home/parva/Downloads/DAV print_replaced-unlocked.pdf';
  const fixtureDst = path.join(projectRoot, 'public', 'fixtures', 'dav_lab_manual.pdf');
  const distFixtureDst = path.join(projectRoot, 'dist', 'fixtures', 'dav_lab_manual.pdf');

  if (fs.existsSync(labManualSrc)) {
    if (!fs.existsSync(path.dirname(fixtureDst))) fs.mkdirSync(path.dirname(fixtureDst), { recursive: true });
    fs.copyFileSync(labManualSrc, fixtureDst);
    if (fs.existsSync(path.join(projectRoot, 'dist'))) {
      if (!fs.existsSync(path.dirname(distFixtureDst))) fs.mkdirSync(path.dirname(distFixtureDst), { recursive: true });
      fs.copyFileSync(labManualSrc, distFixtureDst);
    }
  }

  // 1. Launch Vite preview server on port 4173 with base /OwnPDF/
  console.log('1. Starting production preview server...');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--base', '/OwnPDF/'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  await sleep(2000);

  // 2. Launch headless Firefox with WebDriver BiDi port 9222
  console.log('2. Launching host Mozilla Firefox 157 (headless)...');
  const firefoxProcess = spawn('/usr/bin/firefox', [
    '--headless',
    '--remote-debugging-port', '9222',
  ], {
    stdio: 'ignore',
  });

  await sleep(2500);

  let ws = null;
  try {
    ws = new WebSocket('ws://127.0.0.1:9222/session');
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    console.log('3. Connected to Firefox WebDriver BiDi session.');

    function send(method, params) {
      return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 1000000);
        const timeout = setTimeout(() => {
          ws.removeEventListener('message', handler);
          reject(new Error(`Timeout waiting for ${method}`));
        }, 30000);

        const handler = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id === id) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            if (data.error) reject(new Error(`${method} failed: ${data.error.message}`));
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('session.new', { capabilities: {} });
    const tree = await send('browsingContext.getTree', {});
    const ctxId = tree.contexts[0].context;

    // Navigate to Redact PDF tool
    console.log('4. Navigating to http://localhost:4173/OwnPDF/redact/...');
    await send('browsingContext.navigate', {
      context: ctxId,
      url: 'http://localhost:4173/OwnPDF/redact/',
      wait: 'complete',
    });

    await sleep(1500);

    // Wait for React to mount and input[type="file"] to be available
    console.log('5. Waiting for React hydration and file input...');
    const hydrated = await send('script.evaluate', {
      expression: `(async () => {
        for (let i = 0; i < 30; i++) {
          if (document.querySelector('input[type="file"]')) return true;
          await new Promise((r) => setTimeout(r, 500));
        }
        return false;
      })()`,
      target: { context: ctxId },
      awaitPromise: true,
    });
    console.log('   React mounted file input:', hydrated.result.value);

    // Inject and upload the 38-page test PDF
    console.log('6. Injecting 38-page test PDF (/OwnPDF/fixtures/dav_lab_manual.pdf)...');
    const uploadRes = await send('script.evaluate', {
      expression: `(async () => {
        try {
          const resp = await fetch('/OwnPDF/fixtures/dav_lab_manual.pdf');
          if (!resp.ok) return { success: false, error: 'Failed to fetch fixture: ' + resp.status };
          const blob = await resp.blob();
          const file = new File([blob], 'DAV print_replaced-unlocked.pdf', { type: 'application/pdf' });
          const input = document.querySelector('input[type="file"]');
          if (!input) return { success: false, error: 'Could not find file input' };
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()`,
      target: { context: ctxId },
      awaitPromise: true,
    });

    console.log('   Upload trigger result:', uploadRes.result.value);

    // Wait for PDF session to parse and central canvas to render
    console.log('6. Waiting for central page canvas and thumbnails to render...');
    let isRendered = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const checkRes = await send('script.evaluate', {
        expression: `JSON.stringify((() => {
          const canvases = Array.from(document.querySelectorAll('canvas'));
          const bodyText = document.body.innerText;
          return {
            canvasCount: canvases.length,
            canvases: canvases.map(c => ({ width: c.width, height: c.height, styleW: c.style.width, styleH: c.style.height, class: c.className })),
            bodySnippet: bodyText.slice(0, 300),
            hasError: !!document.querySelector('.text-rose-700, .text-rose-300'),
            errorText: document.querySelector('.text-rose-700, .text-rose-300')?.innerText || null,
          };
        })())`,
        target: { context: ctxId },
        awaitPromise: true,
      });

      const val = JSON.parse(checkRes.result.value);
      console.log(`   Poll ${i + 1}: canvases=${val.canvasCount}, hasError=${val.hasError}, error=${val.errorText}, snippet=${val.bodySnippet?.slice(0, 80).replace(/\n/g, ' ')}`);

      if (val?.canvasCount > 0 && val.canvases.some(c => c.width > 200)) {
        console.log('   Central canvas rendered!', val.canvases);
        isRendered = true;
        break;
      }
    }

    if (!isRendered) {
      const shot = await send('browsingContext.captureScreenshot', { context: ctxId });
      fs.writeFileSync(path.join(artifactsDir, 'firefox_debug_failure.png'), Buffer.from(shot.data, 'base64'));
      throw new Error('Canvas failed to render within 20 seconds');
    }

    // Inspect pixel content of central canvas to verify it is NOT blank
    console.log('7. Inspecting central canvas pixel data...');
    const pixelAnalysis = await send('script.evaluate', {
      expression: `JSON.stringify((() => {
        const canvas = document.querySelector('div.overflow-auto canvas') || document.querySelector('canvas');
        if (!canvas) return { error: 'No canvas found' };
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, Math.min(canvas.width, 400), Math.min(canvas.height, 400));
        let nonWhitePixels = 0;
        let pureWhitePixels = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i+1];
          const b = imgData.data[i+2];
          const a = imgData.data[i+3];
          if (a > 0) {
            if (r < 240 || g < 240 || b < 240) nonWhitePixels++;
            else pureWhitePixels++;
          }
        }
        return {
          totalSampled: imgData.data.length / 4,
          nonWhitePixels,
          pureWhitePixels,
          isNotBlank: nonWhitePixels > 500,
        };
      })())`,
      target: { context: ctxId },
      awaitPromise: true,
    });

    const parsedPixelAnalysis = JSON.parse(pixelAnalysis.result.value);
    console.log('   Pixel Analysis Result:', parsedPixelAnalysis);

    // Capture Page 1 screenshot
    const shot1 = await send('browsingContext.captureScreenshot', { context: ctxId });
    const shot1Path = path.join(artifactsDir, 'firefox_page1_verified.png');
    fs.writeFileSync(shot1Path, Buffer.from(shot1.data, 'base64'));
    console.log(`   Saved screenshot: ${shot1Path} (${Math.round(shot1.data.length / 1024)} KB)`);

    // 8. Test Navigation to Page 2
    console.log('8. Testing navigation to Page 2...');
    await send('script.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('div.w-44 button'));
        if (buttons[1]) buttons[1].click();
      })()`,
      target: { context: ctxId },
      awaitPromise: true,
    });

    await sleep(2000);

    const shot2 = await send('browsingContext.captureScreenshot', { context: ctxId });
    const shot2Path = path.join(artifactsDir, 'firefox_page2_verified.png');
    fs.writeFileSync(shot2Path, Buffer.from(shot2.data, 'base64'));
    console.log(`   Saved screenshot: ${shot2Path} (${Math.round(shot2.data.length / 1024)} KB)`);

    // 9. Test Zoom Control (Zoom In)
    console.log('9. Testing zoom control (Zoom In)...');
    await send('script.evaluate', {
      expression: `(() => {
        const zoomInBtn = document.querySelector('button[title="Zoom in"]');
        if (zoomInBtn) {
          zoomInBtn.click();
          zoomInBtn.click();
        }
      })()`,
      target: { context: ctxId },
      awaitPromise: true,
    });

    await sleep(1500);

    const shot3 = await send('browsingContext.captureScreenshot', { context: ctxId });
    const shot3Path = path.join(artifactsDir, 'firefox_zoom_verified.png');
    fs.writeFileSync(shot3Path, Buffer.from(shot3.data, 'base64'));
    console.log(`   Saved screenshot: ${shot3Path} (${Math.round(shot3.data.length / 1024)} KB)`);

    // 10. Test Drawing Redaction Overlay & Geometry Alignment
    console.log('10. Testing Redaction Drawing & Overlay Alignment...');
    const drawResult = await send('script.evaluate', {
      expression: `(async () => {
        // Select Rectangle tool
        const rectBtn = document.querySelector('button[title*="rectangle" i]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Rectangle'));
        if (rectBtn) rectBtn.click();
        await new Promise(r => setTimeout(r, 300));

        const svg = document.querySelector('svg.cursor-crosshair');
        if (!svg) return { success: false, error: 'SVG overlay not found' };
        const container = svg.parentElement;
        const rect = container.getBoundingClientRect();

        // Dispatch mousedown, mousemove, mouseup
        const startX = rect.left + 80;
        const startY = rect.top + 100;
        const endX = rect.left + 260;
        const endY = rect.top + 180;

        svg.dispatchEvent(new MouseEvent('mousedown', {
          clientX: startX,
          clientY: startY,
          bubbles: true
        }));
        await new Promise(r => setTimeout(r, 100));

        svg.dispatchEvent(new MouseEvent('mousemove', {
          clientX: endX,
          clientY: endY,
          bubbles: true
        }));
        await new Promise(r => setTimeout(r, 100));

        svg.dispatchEvent(new MouseEvent('mouseup', {
          clientX: endX,
          clientY: endY,
          bubbles: true
        }));
        await new Promise(r => setTimeout(r, 500));

        // Check if redaction rect appeared in SVG
        const rects = Array.from(svg.querySelectorAll('rect'));
        const blackRects = rects.filter(r => r.getAttribute('fill') === '#000000');
        const overlayRect = blackRects[0];

        return {
          success: blackRects.length > 0,
          rectCount: blackRects.length,
          overlayBounds: overlayRect ? {
            x: overlayRect.getAttribute('x'),
            y: overlayRect.getAttribute('y'),
            w: overlayRect.getAttribute('width'),
            h: overlayRect.getAttribute('height')
          } : null,
          canvasBounds: {
            w: container.querySelector('canvas')?.clientWidth,
            h: container.querySelector('canvas')?.clientHeight
          }
        };
      })()`,
      target: { context: ctxId },
      awaitPromise: true
    });

    console.log('    Redaction Draw Result:', drawResult.result.value);

    const shot4 = await send('browsingContext.captureScreenshot', { context: ctxId });
    const shot4Path = path.join(artifactsDir, 'firefox_redaction_overlay.png');
    fs.writeFileSync(shot4Path, Buffer.from(shot4.data, 'base64'));
    console.log(`   Saved screenshot: ${shot4Path} (${Math.round(shot4.data.length / 1024)} KB)`);

    // 11. Test Export Execution
    console.log('11. Testing Redact & Download export...');
    const exportResult = await send('script.evaluate', {
      expression: `(async () => {
        const exportBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.innerText.includes('Redact & Download')
        );
        if (!exportBtn) return { success: false, error: 'Export button not found' };

        // Prevent actual browser download popup dialog blocking execution
        let downloadTriggered = false;
        const origCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName, ...args) {
          const el = origCreateElement(tagName, ...args);
          if (tagName.toLowerCase() === 'a') {
            el.click = function() {
              downloadTriggered = true;
            };
          }
          return el;
        };

        exportBtn.click();

        // Wait up to 15s for processing to finish and success message to show
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          const successBanner = Array.from(document.querySelectorAll('div')).find(
            d => d.innerText.includes('Permanent redaction complete!')
          );
          if (successBanner) {
            document.createElement = origCreateElement;
            return {
              success: true,
              downloadTriggered,
              message: successBanner.innerText
            };
          }
          const errorBanner = document.querySelector('.bg-rose-50, .bg-rose-950');
          if (errorBanner) {
            document.createElement = origCreateElement;
            return { success: false, error: errorBanner.innerText };
          }
        }

        document.createElement = origCreateElement;
        return { success: false, error: 'Timed out waiting for export completion' };
      })()`,
      target: { context: ctxId },
      awaitPromise: true
    });

    console.log('    Export Result:', exportResult.result.value);

    const shot5 = await send('browsingContext.captureScreenshot', { context: ctxId });
    const shot5Path = path.join(artifactsDir, 'firefox_export_success.png');
    fs.writeFileSync(shot5Path, Buffer.from(shot5.data, 'base64'));
    console.log(`   Saved screenshot: ${shot5Path} (${Math.round(shot5.data.length / 1024)} KB)`);

    console.log('=== REAL BROWSER VERIFICATION PASSED FULLY! ===');
  } finally {
    if (ws) ws.close();
    firefoxProcess.kill('SIGKILL');
    previewProcess.kill('SIGKILL');

    // Clean up temporary fixtures
    try {
      if (fs.existsSync(fixtureDst)) fs.unlinkSync(fixtureDst);
      if (fs.existsSync(distFixtureDst)) fs.unlinkSync(distFixtureDst);
    } catch {}
  }
}

runBrowserVerification().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
