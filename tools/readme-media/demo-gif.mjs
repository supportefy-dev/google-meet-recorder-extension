// Records assets/readme/popup-demo.gif from the real popup: loads this repository as an unpacked
// extension over the DevTools pipe, drives the UI through chrome.storage recorder states, and
// hands the frames to ffmpeg. Usage: node tools/readme-media/demo-gif.mjs <chrome-or-edge-path>
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browserPath = process.argv[2];
if (!browserPath) {
  console.error('Usage: node tools/readme-media/demo-gif.mjs <chrome-or-edge-path>');
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), 'meet-recorder-gif-'));
const output = join(root, 'assets', 'readme', 'popup-demo.gif');
const FRAME_SECONDS = 0.16;

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

const frames = [];
async function capture(session, clip, seconds) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } }, session);
  const file = join(work, `frame-${String(frames.length).padStart(3, '0')}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, seconds });
}

function recorderState(patch) {
  return `chrome.storage.local.set({ recorderState: ${JSON.stringify(patch)} })`;
}

try {
  await wait(1500);
  const { id } = await send('Extensions.loadUnpacked', { path: root });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 700, deviceScaleFactor: 2, mobile: false }, sessionId);
  await send('Page.navigate', { url: `chrome-extension://${id}/popup.html` }, sessionId);
  await wait(1500);
  const rect = await send('Runtime.evaluate', {
    expression: 'JSON.stringify(document.querySelector(".shell").getBoundingClientRect())', returnByValue: true,
  }, sessionId);
  const box = JSON.parse(rect.result.value);
  const clip = { x: Math.floor(box.x) - 4, y: Math.floor(box.y) - 4, width: Math.ceil(box.width) + 8, height: Math.ceil(box.height) + 8 };
  const set = async (patch, settle = 180) => {
    await send('Runtime.evaluate', { expression: recorderState(patch), awaitPromise: true }, sessionId);
    await wait(settle);
  };

  await capture(sessionId, clip, 1.6);
  await set({ recording: false, phase: 'starting', message: 'Connecting to Meet audio...' });
  await capture(sessionId, clip, 0.6);
  const base = { recording: true, phase: 'recording', mode: 'audio', includeMic: false, micMuted: true };
  for (let step = 0; step < 16; step += 1) {
    const wave = Math.abs(Math.sin(step * 0.9));
    await set({ ...base, startedAt: Date.now() - (12 + step) * 1000, meetLevel: 0.2 + wave * 0.45, outputLevel: 0.18 + wave * 0.4, micLevel: 0, message: 'Recorder hears sound' });
    await capture(sessionId, clip, FRAME_SECONDS);
  }
  for (let step = 0; step < 16; step += 1) {
    const meet = Math.abs(Math.sin(step * 0.7));
    const mic = Math.abs(Math.cos(step * 1.1));
    await set({ ...base, includeMic: true, micMuted: false, startedAt: Date.now() - (28 + step) * 1000, meetLevel: 0.15 + meet * 0.4, micLevel: 0.2 + mic * 0.5, outputLevel: 0.25 + Math.max(meet, mic) * 0.4, message: 'Recording Meet audio + recording mic' });
    await capture(sessionId, clip, FRAME_SECONDS);
  }
  await set({ recording: false, phase: 'saving', message: 'Finishing MP3...', meetLevel: 0, micLevel: 0, outputLevel: 0 });
  await capture(sessionId, clip, 0.9);
  await set({ recording: false, phase: 'saved', message: 'Saved 0.4 MB', meetLevel: 0, micLevel: 0, outputLevel: 0 });
  await capture(sessionId, clip, 2.2);
  await send('Browser.close', {}, undefined, 5000).catch(() => {});

  const list = frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.seconds}`).join('\n');
  const listFile = join(work, 'frames.txt');
  writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const encode = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'scale=460:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    '-loop', '0', output,
  ], { stdio: 'inherit' });
  if (encode.status !== 0) throw new Error('ffmpeg failed');
  console.log(`wrote ${output} from ${frames.length} frames`);
} finally {
  clearTimeout(guard);
  browser.kill();
  await wait(1000);
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
