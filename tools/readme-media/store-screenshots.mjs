// Rebuilds the three Chrome Web Store screenshots from the current popup: captures the real
// popup as a free user sees it, swaps each capture into its media-pack SVG, and renders the
// 1280x800 PNGs. Usage: node tools/readme-media/store-screenshots.mjs <chrome-or-edge-path>
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browserPath = process.argv[2];
if (!browserPath) {
  console.error('Usage: node tools/readme-media/store-screenshots.mjs <chrome-or-edge-path>');
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), 'meet-recorder-store-'));
const sourceDir = join(root, 'assets', 'media-pack', 'source');
const outDir = join(root, 'assets', 'media-pack', 'chrome-web-store');
const SHOTS = [
  { svg: 'screenshot-recording-setup.svg', png: 'screenshot-01-recording-setup-1280x800.png', state: 'idle' },
  { svg: 'screenshot-live-recording.svg', png: 'screenshot-02-live-recording-1280x800.png', state: 'recording' },
  { svg: 'screenshot-microphone-selection.svg', png: 'screenshot-03-microphone-selection-1280x800.png', state: 'microphones' },
];
// Stand-in input devices so the microphone chooser has realistic names without real hardware.
const FAKE_DEVICES = [
  { deviceId: 'default', kind: 'audioinput', label: 'Default - Yeti Nano (Blue)', groupId: 'a' },
  { deviceId: 'yeti', kind: 'audioinput', label: 'Yeti Nano (Blue)', groupId: 'a' },
  { deviceId: 'usb', kind: 'audioinput', label: 'USB Audio Device', groupId: 'b' },
  { deviceId: 'headset', kind: 'audioinput', label: 'Communications - Headset Microphone', groupId: 'c' },
];

const browser = spawn(browserPath, [
  `--user-data-dir=${join(work, 'profile')}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const guard = setTimeout(() => { browser.kill(); process.exit(1); }, 180000);
const pipeOut = browser.stdio[3];
let buffer = '';
let nextId = 1;
const pending = new Map();
browser.stdio[4].on('data', chunk => {
  buffer += chunk.toString('utf8');
  let index;
  while ((index = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  }
});
const send = (method, params = {}, sessionId, ms = 30000) => new Promise((resolveSend, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${method}`)); }, ms);
  pending.set(id, message => {
    clearTimeout(timer);
    if (message.error) reject(new Error(`${method}: ${message.error.message}`));
    else resolveSend(message.result);
  });
  pipeOut.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const wait = ms => new Promise(done => setTimeout(done, ms));
const evaluate = (sessionId, expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);

async function capturePopup(extensionId, state) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 460, height: 900, deviceScaleFactor: 2, mobile: false }, sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `navigator.mediaDevices.enumerateDevices = async () => ${JSON.stringify(FAKE_DEVICES)};`,
  }, sessionId);
  await send('Page.navigate', { url: `chrome-extension://${extensionId}/popup.html` }, sessionId);
  await wait(1200);
  await evaluate(sessionId, `chrome.storage.local.set({ selectedMicId: 'usb' })`);
  if (state === 'recording') {
    await evaluate(sessionId, `chrome.storage.local.set({ recorderState: { recording: true, phase: 'recording', mode: 'audio', includeMic: true, micMuted: false, startedAt: Date.now() - 24000, meetLevel: .42, micLevel: .31, outputLevel: .5, message: 'Recording Meet audio + recording mic' } })`);
  }
  await evaluate(sessionId, `loadMicrophones()`);
  if (state === 'microphones') await evaluate(sessionId, `document.querySelector('#micPickerButton').click()`);
  await wait(900);
  const rect = JSON.parse((await evaluate(sessionId, 'JSON.stringify(document.querySelector(".shell").getBoundingClientRect())')).result.value);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png', clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  }, sessionId);
  await send('Target.closeTarget', { targetId });
  return { data, width: rect.width, height: rect.height };
}

function swapImage(svgText, capture) {
  return svgText.replace(/<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" xlink:href="data:image\/png;base64,[^"]+"/, (_, x, y, w, h) => {
    const height = Number(h);
    const width = Math.round(height * capture.width / capture.height);
    const centerX = Number(x) + Number(w) / 2;
    return `<image x="${(centerX - width / 2).toFixed(1)}" y="${y}" width="${width}" height="${height}" xlink:href="data:image/png;base64,${capture.data}"`;
  });
}

try {
  await wait(1500);
  const { id } = await send('Extensions.loadUnpacked', { path: root });
  for (const shot of SHOTS) {
    const capture = await capturePopup(id, shot.state);
    const svgPath = join(sourceDir, shot.svg);
    const updated = swapImage(readFileSync(svgPath, 'utf8'), capture);
    writeFileSync(svgPath, updated);
    const render = spawnSync(browserPath, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${join(work, 'render')}`,
      '--window-size=1280,800', `--screenshot=${join(outDir, shot.png)}`, pathToFileURL(svgPath).href,
    ], { timeout: 60000 });
    if (render.status !== 0) throw new Error(`render failed for ${shot.svg}`);
    console.log(`wrote ${shot.png}`);
  }
  await send('Browser.close', {}, undefined, 5000).catch(() => {});
} finally {
  clearTimeout(guard);
  browser.kill();
  await wait(1000);
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
