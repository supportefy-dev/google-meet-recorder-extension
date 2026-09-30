importScripts('lib/config.js', 'lib/license.js');

const OFFSCREEN_DOCUMENT = 'offscreen.html';
const MEET_URL_PREFIX = 'https://meet.google.com/';
let creatingOffscreen = null;
let offscreenReady = false;
let readyResolvers = [];

function isReloadDisconnect(error) {
  const message = error?.message || error?.reason?.message || String(error?.reason || error || '');
  return message.includes('Extension context invalidated') || message.includes('Receiving end does not exist');
}

self.addEventListener('unhandledrejection', event => {
  if (isReloadDisconnect(event)) event.preventDefault();
});

self.addEventListener('error', event => {
  if (isReloadDisconnect(event.error || event.message)) event.preventDefault();
});

const defaultState = {
  recording: false,
  phase: 'idle',
  mode: null,
  tabId: null,
  startedAt: null,
  paused: false,
  pausedSince: null,
  pausedAccumMs: 0,
  meetLevel: 0,
  micLevel: 0,
  outputLevel: 0,
  micMuted: true,
  includeMic: false,
  message: 'Ready',
};

async function setState(patch) {
  const current = (await chrome.storage.local.get('recorderState')).recorderState || defaultState;
  await chrome.storage.local.set({ recorderState: { ...current, ...patch } });
}

async function isLicensed() {
  const status = await MeetRecorderLicense.current();
  return Boolean(status.pro);
}

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL(OFFSCREEN_DOCUMENT);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  if (contexts.length && !creatingOffscreen) {
    offscreenReady = true;
    return;
  }
  if (!creatingOffscreen) {
    offscreenReady = false;
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT,
      reasons: ['USER_MEDIA', 'BLOBS', 'AUDIO_PLAYBACK'],
      justification: 'Record and locally save the user-selected Google Meet tab and microphone.',
    }).finally(() => { creatingOffscreen = null; });
  }
  const creation = creatingOffscreen;
  await creation;
  await waitForOffscreenReady();
}

async function waitForOffscreenReady() {
  if (offscreenReady) return;
  await new Promise((resolve, reject) => {
    const entry = {
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
    };
    const timer = setTimeout(() => {
      readyResolvers = readyResolvers.filter(item => item !== entry);
      reject(new Error('Recorder engine took too long to initialize.'));
    }, 2500);
    readyResolvers.push(entry);
  });
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
}

async function startRecordingOnTab(tab) {
  if (!tab?.id || !tab.url?.startsWith(MEET_URL_PREFIX)) {
    throw new Error('Open the Google Meet tab, then try again.');
  }
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await setState({
    ...defaultState,
    phase: 'starting',
    mode: 'audio',
    tabId: tab.id,
    message: 'Connecting to Meet audio...',
  });
  const result = await sendToOffscreen({ type: 'START_RECORDING', streamId, mode: 'audio', tabId: tab.id, title: tab.title || '' });
  if (!result?.ok) throw new Error(result?.error || 'Recorder engine could not start.');
}

chrome.runtime.onInstalled.addListener(() => {
  setState(defaultState).catch(() => {});
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-recording') return;
  try {
    if (!(await isLicensed())) {
      await chrome.tabs.create({ url: `${chrome.runtime.getURL('options.html')}#pro` });
      return;
    }
    const recorderState = (await chrome.storage.local.get('recorderState')).recorderState || defaultState;
    if (recorderState.recording) {
      await sendToOffscreen({ type: 'STOP_RECORDING' });
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await startRecordingOnTab(tab);
  } catch (error) {
    await setState({ recording: false, phase: 'error', message: error.message }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') return false;
  if (message.type === 'OFFSCREEN_READY') {
    offscreenReady = true;
    readyResolvers.splice(0).forEach(item => item.resolve());
    try { sendResponse({ ok: true }); } catch (_) {}
    return false;
  }
  (async () => {
    if (message.type === 'PREPARE') {
      await ensureOffscreenDocument();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'START_RECORDING') {
      await ensureOffscreenDocument();
      const tab = message.tabId ? await chrome.tabs.get(message.tabId).catch(() => null) : null;
      await setState({
        ...defaultState,
        phase: 'starting',
        mode: message.mode,
        tabId: message.tabId,
        message: 'Connecting to Meet audio...',
      });
      const result = await sendToOffscreen({ ...message, title: tab?.title || '' });
      if (!result?.ok) throw new Error(result?.error || 'Recorder engine could not start.');
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'STOP_RECORDING') {
      const result = await sendToOffscreen({ type: 'STOP_RECORDING' });
      if (!result?.ok) throw new Error(result?.error || 'Recorder engine could not stop.');
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'PAUSE_RECORDING' || message.type === 'RESUME_RECORDING') {
      if (!(await isLicensed())) {
        sendResponse({ ok: false, error: 'Pause and resume need Meet Recorder Pro.' });
        return;
      }
      const result = await sendToOffscreen({ type: message.type });
      sendResponse(result || { ok: true });
      return;
    }

    if (message.type === 'DOWNLOAD_RECORDING') {
      const downloadId = await chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        saveAs: false,
      });
      sendResponse({ ok: true, downloadId });
      return;
    }

    if (message.type === 'ENABLE_MIC' || message.type === 'SET_MIC_MUTED' || message.type === 'SWITCH_MIC') {
      const result = await sendToOffscreen(message);
      sendResponse(result || { ok: true });
      return;
    }

    if (message.type === 'RECORDER_STATE') {
      await setState(message.state);
      if (message.state.recording === true) {
        await chrome.action.setBadgeBackgroundColor({ color: message.state.paused ? '#c08a2e' : '#ff5e68' });
        await chrome.action.setBadgeText({ text: message.state.paused ? 'PAUS' : 'REC' });
      } else if (message.state.recording === false) {
        await chrome.action.setBadgeText({ text: '' });
      }
      sendResponse({ ok: true });
    }
  })().catch(async error => {
    await setState({ recording: false, phase: 'error', message: error.message }).catch(() => {});
    try { sendResponse({ ok: false, error: error.message }); } catch (_) {}
  });
  return true;
});
