const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const pauseButton = document.querySelector('#pauseButton');
const pauseButtonLabel = document.querySelector('#pauseButtonLabel');
const pauseButtonIcon = document.querySelector('#pauseButtonIcon');
const pausePro = document.querySelector('#pausePro');
const proBadge = document.querySelector('#proBadge');
const settingsButton = document.querySelector('#settingsButton');
const videoModeInput = document.querySelector('#videoModeInput');
const videoModePro = document.querySelector('#videoModePro');
const freeLimitNote = document.querySelector('#freeLimitNote');
const micButton = document.querySelector('#micButton');
const micButtonLabel = document.querySelector('#micButtonLabel');
const micButtonMeta = document.querySelector('#micButtonMeta');
const micButtonIcon = document.querySelector('#micButtonIcon');
const micPro = document.querySelector('#micPro');
const micSelect = document.querySelector('#micSelect');
const micPickerButton = document.querySelector('#micPickerButton');
const micPickerLabel = document.querySelector('#micPickerLabel');
const micPickerMeta = document.querySelector('#micPickerMeta');
const micMenu = document.querySelector('#micMenu');
const micSheet = document.querySelector('#micSheet');
const micSheetBack = document.querySelector('#micSheetBack');
const status = document.querySelector('#status');
const modes = document.querySelector('#modes');
const sessionTimer = document.querySelector('#sessionTimer');
const healthText = document.querySelector('#healthText');
const stateLabel = document.querySelector('#stateLabel');
let latestState = {};
let licensedNow = false;

function friendlyMicName(label, fallback = 'Microphone') {
  return (label || fallback)
    .replace(/^(Default|Communications)\s*-\s*/i, '')
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '')
    .replace(/^Microphone\s*\((?:\d+\s*-\s*)?(.+)\)$/i, '$1')
    .trim();
}

function closeMicMenu() {
  micMenu.hidden = true;
  micSheet.hidden = true;
  document.body.classList.remove('mic-sheet-open');
  micPickerButton.setAttribute('aria-expanded', 'false');
  document.querySelector('#devicePicker').classList.remove('open');
}

function renderMicMenu(devices, selectedId) {
  const items = devices.map((device, index) => {
    const name = friendlyMicName(device.label, `Microphone ${index + 1}`);
    const route = device.deviceId === 'default'
      ? 'SYSTEM DEFAULT'
      : /^Communications\s*-\s*/i.test(device.label) ? 'CALLS DEFAULT' : 'CONNECTED DEVICE';
    return { device, name, route };
  });
  micMenu.replaceChildren(...items.map(({ device, name, route }) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'mic-option';
    option.dataset.deviceId = device.deviceId;
    option.setAttribute('role', 'option');
    const selected = device.deviceId === selectedId;
    option.setAttribute('aria-selected', String(selected));
    option.innerHTML = `<i>${selected ? '✓' : ''}</i><span><b></b><small>${route}</small></span>`;
    option.querySelector('b').textContent = name;
    option.addEventListener('click', () => {
      micMenu.querySelectorAll('.mic-option').forEach(item => {
        const isSelected = item === option;
        item.setAttribute('aria-selected', String(isSelected));
        item.querySelector('i').textContent = isSelected ? '✓' : '';
      });
      micSelect.value = device.deviceId;
      micSelect.dispatchEvent(new Event('change', { bubbles: true }));
      micPickerLabel.textContent = name;
      micPickerMeta.textContent = device.deviceId === 'default' ? 'System default input' : 'Selected microphone';
      closeMicMenu();
    });
    return option;
  }));
  const selected = items.find(item => item.device.deviceId === selectedId) || items[0];
  if (selected) {
    micPickerLabel.textContent = selected.name;
    micPickerMeta.textContent = selected.device.deviceId === 'default' ? 'System default input' : 'Selected microphone';
  }
}

function formatDuration(startedAt, pausedAccumMs = 0, now = Date.now()) {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((now - startedAt - pausedAccumMs) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

function updateTimer() {
  if (!latestState.recording) { sessionTimer.textContent = '00:00:00'; return; }
  const now = latestState.paused && latestState.pausedSince ? latestState.pausedSince : Date.now();
  sessionTimer.textContent = formatDuration(latestState.startedAt, latestState.pausedAccumMs, now);
}

function setMeter(id, level, text) {
  document.querySelector(`#${id}Bar`).style.transform = `scaleX(${Math.max(.025, level || 0)})`;
  document.querySelector(`#${id}Text`).textContent = text;
  if (id === 'output') {
    const signal = Math.max(.025, Math.min(1, level || 0));
    document.documentElement.style.setProperty('--signal', signal);
    document.documentElement.style.setProperty('--signal-angle', `${Math.max(6, signal * 240)}deg`);
  }
}

function render(state = {}) {
  latestState = state;
  const recording = Boolean(state.recording);
  document.body.classList.toggle('recording', recording);
  startButton.hidden = recording || state.phase === 'starting' || state.phase === 'saving';
  stopButton.hidden = !recording;
  pauseButton.hidden = !recording || state.phase === 'saving';
  micButton.hidden = !recording;
  modes.disabled = recording || state.phase === 'starting' || state.phase === 'saving';
  status.textContent = state.message || 'Ready';
  stateLabel.textContent = state.paused ? 'PAUSED' : recording ? 'RECORDING' : state.phase === 'saving' ? 'SAVING' : state.phase === 'starting' ? 'ARMING' : 'READY';
  pauseButtonLabel.textContent = state.paused ? 'Resume recording' : 'Pause recording';
  pauseButtonIcon.textContent = state.paused ? 'PLAY' : 'PAUSE';
  pausePro.hidden = licensedNow;
  freeLimitNote.hidden = licensedNow;
  videoModePro.hidden = licensedNow;
  const hearing = recording && state.outputLevel > .004;
  healthText.textContent = !recording ? 'Ready to capture' : hearing ? 'Capture signal is healthy' : 'Waiting for audible signal';
  document.body.classList.toggle('hearing', hearing);
  setMeter('meet', state.meetLevel, recording ? (state.meetLevel > .004 ? 'Live' : 'Quiet') : 'Standby');
  setMeter('mic', state.micMuted ? 0 : state.micLevel, recording ? (state.includeMic === false ? 'Unavailable' : state.micMuted ? 'Muted' : state.micLevel > .004 ? 'Live' : 'Quiet') : 'Standby');
  setMeter('output', state.outputLevel, recording ? (state.outputLevel > .004 ? 'Hearing ✓' : 'No sound') : 'Standby');
  const micLockedOn = state.includeMic && !licensedNow;
  micButton.classList.toggle('live', recording && state.includeMic && !state.micMuted);
  micButton.classList.toggle('muted', recording && state.includeMic && state.micMuted && licensedNow);
  micPro.hidden = !micLockedOn;
  micButtonLabel.textContent = !state.includeMic
    ? 'Enable recording mic'
    : micLockedOn ? 'Recording mic on'
    : state.micMuted ? 'Unmute recording mic' : 'Mute recording mic';
  micButtonMeta.textContent = !state.includeMic
    ? 'One-time permission · then stays here'
    : micLockedOn ? 'Pro can mute or switch it mid-recording'
    : state.micMuted ? 'Meet audio continues recording' : 'Mixed into this recording';
  micButtonIcon.hidden = micLockedOn;
  micButtonIcon.textContent = !state.includeMic ? 'ADD' : state.micMuted ? 'OFF' : 'ON';
}

async function readState() {
  render((await chrome.storage.local.get('recorderState')).recorderState);
}

async function loadMicrophones() {
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
    const saved = (await chrome.storage.local.get('selectedMicId')).selectedMicId || 'default';
    const options = devices.map((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${index + 1}`;
      return option;
    });
    if (!options.length || options.every(option => !option.textContent || /^Microphone \d+$/.test(option.textContent))) {
      const option = document.createElement('option');
      option.value = saved;
      option.textContent = 'Enable mic to reveal devices';
      micSelect.replaceChildren(option);
      micSelect.disabled = true;
      micPickerButton.disabled = true;
      micPickerLabel.textContent = 'Microphone not enabled';
      micPickerMeta.textContent = 'Enable it during recording to choose an input';
      micMenu.replaceChildren();
      return;
    }
    micSelect.replaceChildren(...options);
    micSelect.value = devices.some(device => device.deviceId === saved) ? saved : devices[0].deviceId;
    micSelect.disabled = false;
    micPickerButton.disabled = false;
    renderMicMenu(devices, micSelect.value);
  } catch (error) {
    micSelect.disabled = true;
    micPickerButton.disabled = true;
  }
}

micPickerButton.addEventListener('click', () => {
  if (micPickerButton.disabled) return;
  const opening = micSheet.hidden;
  if (opening) {
    micSheet.hidden = false;
    micMenu.hidden = false;
    document.body.classList.add('mic-sheet-open');
    micPickerButton.setAttribute('aria-expanded', 'true');
    document.querySelector('#devicePicker').classList.add('open');
    micSheetBack.focus();
  } else closeMicMenu();
});

micSheetBack.addEventListener('click', () => {
  closeMicMenu();
  micPickerButton.focus();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !micSheet.hidden) {
    closeMicMenu();
    micPickerButton.focus();
  }
});

videoModeInput.addEventListener('click', event => {
  if (licensedNow) return;
  event.preventDefault();
  document.querySelector('input[name="mode"][value="audio"]').checked = true;
  openUpgrade();
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Checking the active Meet tab…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith('https://meet.google.com/')) {
      throw new Error('Open the Google Meet tab, then click the extension again.');
    }

    await chrome.runtime.sendMessage({ type: 'PREPARE' });
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const result = await chrome.runtime.sendMessage({ type: 'START_RECORDING', streamId, mode, tabId: tab.id, includeMic: false });
    if (!result?.ok) throw new Error(result?.error || 'Could not start recording.');
    await readState();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    startButton.disabled = false;
  }
});

async function openMicPermission() {
  status.textContent = 'One-time microphone setup opened…';
  await chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
}

micButton.addEventListener('click', async () => {
  micButton.disabled = true;
  try {
    const recorderState = (await chrome.storage.local.get('recorderState')).recorderState || {};
    if (!recorderState.includeMic) {
      const saved = await chrome.storage.local.get(['micPermissionGranted', 'selectedMicId']);
      if (!saved.micPermissionGranted) {
        await openMicPermission();
      } else {
        status.textContent = 'Enabling recording microphone, one moment';
        const result = await chrome.runtime.sendMessage({ type: 'ENABLE_MIC', deviceId: saved.selectedMicId });
        if (!result?.ok) {
          await chrome.storage.local.set({ micPermissionGranted: false });
          await openMicPermission();
        }
      }
    } else if (!licensedNow) {
      await openUpgrade();
    } else {
      const result = await chrome.runtime.sendMessage({ type: 'SET_MIC_MUTED', muted: !recorderState.micMuted });
      if (!result?.ok) throw new Error(result?.error || 'Could not change microphone state.');
    }
  } catch (error) {
    status.textContent = `Microphone unavailable: ${error.message}`;
  } finally {
    micButton.disabled = false;
  }
});

micSelect.addEventListener('change', async () => {
  const deviceId = micSelect.value;
  await chrome.storage.local.set({ selectedMicId: deviceId });
  const recorderState = (await chrome.storage.local.get('recorderState')).recorderState || {};
  if (!recorderState.recording || !recorderState.includeMic) return;
  if (!licensedNow) {
    await openUpgrade();
    await loadMicrophones();
    return;
  }
  micSelect.disabled = true;
  micPickerButton.disabled = true;
  status.textContent = 'Switching recording microphone, one moment';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SWITCH_MIC', deviceId });
    if (!result?.ok) throw new Error(result?.error || 'Could not switch microphones.');
  } catch (error) {
    status.textContent = error.message;
  } finally {
    micSelect.disabled = false;
    micPickerButton.disabled = false;
    await loadMicrophones();
  }
});

navigator.mediaDevices.addEventListener('devicechange', loadMicrophones);

stopButton.addEventListener('click', async () => {
  stopButton.disabled = true;
  status.textContent = 'Finishing recording...';
  await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
});

async function openUpgrade() {
  await chrome.tabs.create({ url: `${chrome.runtime.getURL('options.html')}#pro` });
}

pauseButton.addEventListener('click', async () => {
  if (!licensedNow) {
    await openUpgrade();
    return;
  }
  pauseButton.disabled = true;
  try {
    const type = latestState.paused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING';
    const result = await chrome.runtime.sendMessage({ type });
    if (!result?.ok) throw new Error(result?.error || 'Could not change the pause state.');
  } catch (error) {
    status.textContent = error.message;
  } finally {
    pauseButton.disabled = false;
  }
});

settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

async function loadLicense() {
  const licenseStatus = await MeetRecorderLicense.current();
  licensedNow = Boolean(licenseStatus.pro);
  proBadge.hidden = !licensedNow;
  render(latestState);
}

MeetRecorderLicense.onLicenseChange(() => loadLicense());

chrome.storage.onChanged.addListener(changes => {
  if (changes.recorderState) render(changes.recorderState.newValue);
});
readState();
loadMicrophones();
loadLicense();
setInterval(updateTimer, 250);
