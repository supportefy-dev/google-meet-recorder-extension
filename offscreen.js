const state = {
  recorder: null,
  tabStream: null,
  micStream: null,
  micSource: null,
  recordingStream: null,
  audioContext: null,
  micGain: null,
  tabAnalyser: null,
  micAnalyser: null,
  outputAnalyser: null,
  finalMix: null,
  chunks: [],
  timer: null,
  mode: null,
  startedAt: null,
  micMuted: true,
  includeMic: false,
  settings: null,
  title: '',
  videoExtension: 'webm',
  videoFallbackNote: '',
  mainWriter: null,
  meetOnlyWriter: null,
  micOnlyWriter: null,
  paused: false,
  pausedSince: null,
  pausedAccumMs: 0,
  licensed: false,
  finalMessageOverride: null,
};

self.addEventListener('unhandledrejection', event => {
  const message = event.reason?.message || String(event.reason || '');
  if (message.includes('Extension context invalidated') || message.includes('Receiving end does not exist')) {
    event.preventDefault();
  }
});

function signalLevel(analyser) {
  if (!analyser) return 0;
  const samples = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(samples);
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
  return Math.min(1, Math.sqrt(energy) * 8);
}

function bestVideoMimeType(videoFormat) {
  if (videoFormat === 'mp4') {
    const mp4Options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
    const supported = mp4Options.find(type => MediaRecorder.isTypeSupported(type));
    if (supported) return { mimeType: supported, extension: 'mp4', note: '' };
  }
  const webmOptions = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = webmOptions.find(type => MediaRecorder.isTypeSupported(type)) || '';
  const note = videoFormat === 'mp4' ? "MP4 is not supported on this Chrome build, saved as WEBM instead." : '';
  return { mimeType, extension: 'webm', note };
}

function floatToInt16Sample(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

function floatToInt16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) pcm[index] = floatToInt16Sample(samples[index]);
  return pcm;
}

function interleaveInt16(left, right) {
  const result = new Int16Array(left.length * 2);
  for (let index = 0; index < left.length; index += 1) {
    result[index * 2] = floatToInt16Sample(left[index]);
    result[index * 2 + 1] = floatToInt16Sample(right[index]);
  }
  return result;
}

// One audio writer per output file (main, Meet-only, mic-only). Each owns its own
// ScriptProcessorNode fed from the given source node, so pausing one never touches the others.
function createAudioWriter(audioContext, sourceNode, quality) {
  const bufferSize = 4096;
  const bitrate = MeetRecorderSettings.AUDIO_QUALITY_BITRATES[quality] || MeetRecorderSettings.AUDIO_QUALITY_BITRATES['mp3-64'];
  const isWav = quality === 'wav';
  const wavWriter = isWav ? MeetRecorderWav.createWriter({ sampleRate: audioContext.sampleRate, channels: 2 }) : null;
  const mp3Encoder = isWav ? null : new globalThis.lamejs.Mp3Encoder(2, audioContext.sampleRate, bitrate);
  const mp3Chunks = [];
  const processor = audioContext.createScriptProcessor(bufferSize, 2, 2);
  const sink = audioContext.createGain();
  sink.gain.value = 0;
  let paused = false;
  let error = null;

  processor.onaudioprocess = event => {
    if (paused || error) return;
    try {
      const input = event.inputBuffer;
      const left = input.getChannelData(0);
      const right = input.numberOfChannels > 1 ? input.getChannelData(1) : left;
      if (isWav) {
        wavWriter.push(interleaveInt16(left, right));
      } else {
        const encoded = mp3Encoder.encodeBuffer(floatToInt16(left), floatToInt16(right));
        if (encoded.length) mp3Chunks.push(new Int8Array(encoded));
      }
    } catch (thrown) {
      error = thrown;
    }
  };
  sourceNode.connect(processor);
  processor.connect(sink).connect(audioContext.destination);

  return {
    setPaused(value) { paused = value; },
    disconnect() {
      processor.onaudioprocess = null;
      processor.disconnect();
      sink.disconnect();
    },
    finish() {
      if (error) throw new Error(`${isWav ? 'WAV' : 'MP3'} encoding failed: ${error.message}`);
      if (isWav) return { blob: wavWriter.finalize(), extension: 'wav' };
      const finalChunk = mp3Encoder.flush();
      if (finalChunk?.length) mp3Chunks.push(new Int8Array(finalChunk));
      return { blob: new Blob(mp3Chunks, { type: 'audio/mpeg' }), extension: 'mp3' };
    },
  };
}

function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

async function sendState(patch) {
  await chrome.runtime.sendMessage({ type: 'RECORDER_STATE', state: patch });
}

function disconnectWriters() {
  state.mainWriter?.disconnect();
  state.meetOnlyWriter?.disconnect();
  state.micOnlyWriter?.disconnect();
}

async function cleanup() {
  clearInterval(state.timer);
  disconnectWriters();
  stopTracks(state.recordingStream);
  stopTracks(state.tabStream);
  stopTracks(state.micStream);
  await state.audioContext?.close().catch(() => {});
  Object.assign(state, {
    recorder: null, tabStream: null, micStream: null, micSource: null, recordingStream: null,
    audioContext: null, micGain: null, tabAnalyser: null, micAnalyser: null,
    outputAnalyser: null, finalMix: null, chunks: [], timer: null, mode: null, startedAt: null,
    includeMic: false, micMuted: true, settings: null, title: '', videoExtension: 'webm',
    videoFallbackNote: '', mainWriter: null, meetOnlyWriter: null, micOnlyWriter: null,
    paused: false, pausedSince: null, pausedAccumMs: 0, licensed: false, finalMessageOverride: null,
  });
}

function audioModeMessage(quality) {
  if (quality === 'wav') return 'Recording Meet audio · WAV';
  if (quality === 'mp3-64') return 'Recording Meet audio · MP3';
  const bitrate = MeetRecorderSettings.AUDIO_QUALITY_BITRATES[quality];
  return `Recording Meet audio · MP3 ${bitrate}kbps`;
}

function videoModeMessage(extension, note) {
  if (note) return 'Recording Meet video + audio · falling back to WEBM';
  if (extension === 'mp4') return 'Recording Meet video + audio · MP4';
  return 'Recording Meet video + audio';
}

const FREE_CAP_MESSAGE = 'Free recordings stop at 40 minutes. Saved. Pro removes the limit.';

function freeLimitWarning(minute) {
  const remaining = MeetRecorderConfig.freeLimits.maxMinutes - minute;
  return `Free recordings stop at 40 minutes, ${remaining} minute${remaining === 1 ? '' : 's'} left. Pro removes the limit.`;
}

// Settings and license are re-read and re-verified here, not trusted from the START_RECORDING
// message: a compromised or stale popup/service-worker message must never unlock a Pro feature.
async function startRecording({ streamId, mode, title }) {
  if (state.recorder) throw new Error('A recording is already running.');
  const rawSettings = await MeetRecorderSettings.load();
  const licenseStatus = await MeetRecorderLicense.current();
  if (!MeetRecorderLimits.allowedMode(mode, licenseStatus.pro)) throw new Error('Video recording is a Pro feature.');
  state.mode = mode;
  state.licensed = Boolean(licenseStatus.pro);
  state.settings = MeetRecorderSettings.effective(rawSettings, state.licensed);
  state.title = title || '';
  state.includeMic = false;
  state.micMuted = true;
  state.startedAt = Date.now();
  state.pausedAccumMs = 0;
  state.paused = false;

  state.tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: mode === 'video'
      ? { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
      : false,
  });
  if (!state.tabStream.getAudioTracks().length) throw new Error('Chrome returned no tab-audio track.');

  state.audioContext = new AudioContext();
  await state.audioContext.resume();
  const tabSource = state.audioContext.createMediaStreamSource(state.tabStream);
  const recordingDestination = state.audioContext.createMediaStreamDestination();
  state.finalMix = state.audioContext.createGain();
  state.micGain = state.audioContext.createGain();
  state.tabAnalyser = state.audioContext.createAnalyser();
  state.micAnalyser = state.audioContext.createAnalyser();
  state.outputAnalyser = state.audioContext.createAnalyser();
  [state.tabAnalyser, state.micAnalyser, state.outputAnalyser].forEach(node => { node.fftSize = 256; });

  // The tabCapture API suppresses local playback, so restore it for the user.
  tabSource.connect(state.audioContext.destination);
  tabSource.connect(state.tabAnalyser).connect(state.finalMix);
  state.micAnalyser.connect(state.micGain).connect(state.finalMix);
  state.finalMix.connect(state.outputAnalyser).connect(recordingDestination);
  state.micGain.gain.value = state.micMuted ? 0 : 1;

  if (mode === 'audio') state.mainWriter = createAudioWriter(state.audioContext, state.finalMix, state.settings.audioQuality);
  if (state.settings.separateTracks) state.meetOnlyWriter = createAudioWriter(state.audioContext, state.tabAnalyser, state.settings.audioQuality);

  const mixedAudioTracks = recordingDestination.stream.getAudioTracks();
  state.recordingStream = mode === 'video'
    ? new MediaStream([...state.tabStream.getVideoTracks(), ...mixedAudioTracks])
    : new MediaStream(mixedAudioTracks);

  let mimeType = '';
  if (mode === 'video') {
    const picked = bestVideoMimeType(state.settings.videoFormat);
    mimeType = picked.mimeType;
    state.videoExtension = picked.extension;
    state.videoFallbackNote = picked.note;
  } else {
    mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  state.recorder = new MediaRecorder(state.recordingStream, mimeType ? {
    mimeType,
    audioBitsPerSecond: mode === 'audio' ? 64000 : 128000,
    ...(mode === 'video' ? { videoBitsPerSecond: 3000000 } : {}),
  } : undefined);
  state.chunks = [];
  state.recorder.ondataavailable = event => { if (event.data.size) state.chunks.push(event.data); };
  state.recorder.onerror = event => sendState({ recording: false, phase: 'error', message: event.error?.message || 'Recording failed.' });
  state.recorder.onstop = saveRecording;
  state.tabStream.getAudioTracks()[0].addEventListener('ended', () => stopRecording());
  state.recorder.start(1000);

  const message = mode === 'audio' ? audioModeMessage(state.settings.audioQuality) : videoModeMessage(state.videoExtension, state.videoFallbackNote);
  await sendState({ recording: true, phase: 'recording', mode, includeMic: false, micMuted: true, startedAt: state.startedAt, paused: false, pausedAccumMs: 0, message });
  state.timer = setInterval(() => {
    const meetLevel = signalLevel(state.tabAnalyser);
    const micLevel = signalLevel(state.micAnalyser);
    const outputLevel = signalLevel(state.outputAnalyser);
    const elapsedMs = Date.now() - state.startedAt - state.pausedAccumMs;
    const limit = MeetRecorderLimits.limitState(elapsedMs, state.licensed);
    if (limit.stop) {
      stopRecording(FREE_CAP_MESSAGE).catch(() => {});
      return;
    }
    sendState({
      recording: true, phase: 'recording', meetLevel, micLevel, includeMic: state.includeMic,
      outputLevel, micMuted: state.micMuted, paused: state.paused,
      message: limit.warn ? freeLimitWarning(limit.warn)
        : state.paused ? 'Paused'
        : (outputLevel > .004 ? 'Recorder hears sound' : 'Waiting for sound'),
    }).catch(() => {});
  }, 400);
}

async function stopRecording(finalMessage) {
  if (!state.recorder || state.recorder.state === 'inactive') return;
  clearInterval(state.timer);
  state.finalMessageOverride = finalMessage || null;
  const finishing = state.mode === 'video' ? 'Saving video...' : state.settings?.audioQuality === 'wav' ? 'Finishing WAV...' : 'Finishing MP3...';
  await sendState({ phase: 'saving', message: finishing });
  if (state.recorder.state === 'paused') state.recorder.resume();
  state.recorder.stop();
}

async function pauseRecording() {
  const licenseStatus = await MeetRecorderLicense.current();
  if (!licenseStatus.pro) throw new Error('Pause and resume need Meet Recorder Pro.');
  if (!state.recorder || state.recorder.state === 'inactive' || state.paused) return;
  state.paused = true;
  state.pausedSince = Date.now();
  if (state.recorder.state === 'recording') state.recorder.pause();
  state.mainWriter?.setPaused(true);
  state.meetOnlyWriter?.setPaused(true);
  state.micOnlyWriter?.setPaused(true);
  await sendState({ recording: true, paused: true, pausedSince: state.pausedSince, message: 'Paused' });
}

async function resumeRecording() {
  const licenseStatus = await MeetRecorderLicense.current();
  if (!licenseStatus.pro) throw new Error('Pause and resume need Meet Recorder Pro.');
  if (!state.recorder || !state.paused) return;
  state.pausedAccumMs += Date.now() - state.pausedSince;
  state.pausedSince = null;
  state.paused = false;
  if (state.recorder.state === 'paused') state.recorder.resume();
  state.mainWriter?.setPaused(false);
  state.meetOnlyWriter?.setPaused(false);
  state.micOnlyWriter?.setPaused(false);
  const message = state.mode === 'audio' ? audioModeMessage(state.settings.audioQuality) : videoModeMessage(state.videoExtension, state.videoFallbackNote);
  await sendState({ recording: true, paused: false, pausedSince: null, pausedAccumMs: state.pausedAccumMs, message });
}

function microphoneConstraints(deviceId) {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

async function connectMicrophone(deviceId) {
  const newStream = await navigator.mediaDevices.getUserMedia({
    audio: microphoneConstraints(deviceId),
    video: false,
  });
  const newSource = state.audioContext.createMediaStreamSource(newStream);
  newSource.connect(state.micAnalyser);
  state.micSource?.disconnect();
  stopTracks(state.micStream);
  state.micStream = newStream;
  state.micSource = newSource;
  return newStream.getAudioTracks()[0]?.label || 'Selected microphone';
}

async function enableMicrophone(deviceId) {
  if (!state.recorder) throw new Error('Start a recording before enabling the microphone.');
  if (state.micStream) return;
  const label = await connectMicrophone(deviceId);
  state.includeMic = true;
  state.micMuted = false;
  state.micGain.gain.setValueAtTime(1, state.audioContext.currentTime);
  if (state.settings?.separateTracks && !state.micOnlyWriter) {
    state.micOnlyWriter = createAudioWriter(state.audioContext, state.micGain, state.settings.audioQuality);
    state.micOnlyWriter.setPaused(state.paused);
  }
  await sendState({
    recording: true,
    includeMic: true,
    micMuted: false,
    selectedMicId: deviceId || null,
    message: `Recording Meet audio + ${label}`,
  });
}

async function switchMicrophone(deviceId) {
  const licenseStatus = await MeetRecorderLicense.current();
  if (!MeetRecorderLimits.canControlMic(licenseStatus.pro)) throw new Error('Switching microphones needs Meet Recorder Pro.');
  if (!state.micStream) throw new Error('Enable the recording microphone first.');
  const wasMuted = state.micMuted;
  const label = await connectMicrophone(deviceId);
  state.micGain.gain.setValueAtTime(wasMuted ? 0 : 1, state.audioContext.currentTime);
  await sendState({
    recording: true,
    includeMic: true,
    micMuted: wasMuted,
    selectedMicId: deviceId,
    message: `Switched recording mic to ${label}`,
  });
}

async function setMicrophoneMuted(muted) {
  const licenseStatus = await MeetRecorderLicense.current();
  if (!MeetRecorderLimits.canControlMic(licenseStatus.pro)) throw new Error('Muting the recording mic needs Meet Recorder Pro.');
  if (!state.micStream) throw new Error('Enable the recording microphone first.');
  state.micMuted = muted;
  state.micGain.gain.setTargetAtTime(muted ? 0 : 1, state.audioContext.currentTime, .01);
  await sendState({
    recording: true,
    includeMic: true,
    micMuted: muted,
    message: muted ? 'Recording Meet audio · Recording mic muted' : 'Recording Meet audio + recording mic',
  });
}

function extraTracks() {
  const tracks = [];
  if (state.meetOnlyWriter) tracks.push({ writer: state.meetOnlyWriter, suffix: '-meet' });
  if (state.micOnlyWriter) tracks.push({ writer: state.micOnlyWriter, suffix: '-mic' });
  return tracks;
}

async function saveRecording() {
  try {
    const mode = state.mode;
    const now = new Date();
    const filenameOptions = { template: state.settings.filenameTemplate, mode, title: state.title, subfolder: state.settings.subfolder, now };
    let mainBlob;
    let mainExtension;
    if (mode === 'audio') {
      const result = state.mainWriter.finish();
      mainBlob = result.blob;
      mainExtension = result.extension;
      if (!mainBlob.size) throw new Error(`The ${mainExtension.toUpperCase()} encoder produced an empty recording.`);
    } else {
      mainBlob = new Blob(state.chunks, { type: state.recorder.mimeType });
      mainExtension = state.videoExtension;
    }
    const files = [{ blob: mainBlob, filename: MeetRecorderFilename.buildFilename({ ...filenameOptions, extension: mainExtension }) }];
    for (const { writer, suffix } of extraTracks()) {
      const result = writer.finish();
      if (result.blob.size) {
        files.push({ blob: result.blob, filename: MeetRecorderFilename.buildFilename({ ...filenameOptions, extension: result.extension, suffix }) });
      }
    }

    const totalBytes = files.reduce((sum, file) => sum + file.blob.size, 0);
    for (const file of files) {
      const url = URL.createObjectURL(file.blob);
      const result = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_RECORDING', url, filename: file.filename });
      if (!result?.ok) throw new Error(result?.error || 'Chrome could not download the recording.');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    const extraCount = files.length - 1;
    const savedMessage = state.finalMessageOverride
      || `Saved ${(totalBytes / 1048576).toFixed(1)} MB${extraCount ? ` across ${files.length} files` : ''}`;
    await cleanup();
    await sendState({ recording: false, phase: 'saved', message: savedMessage, meetLevel: 0, micLevel: 0, outputLevel: 0, paused: false });
  } catch (error) {
    await cleanup();
    await sendState({ recording: false, phase: 'error', message: error.message });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  (async () => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'START_RECORDING') await startRecording(message);
    if (message.type === 'STOP_RECORDING') await stopRecording();
    if (message.type === 'PAUSE_RECORDING') await pauseRecording();
    if (message.type === 'RESUME_RECORDING') await resumeRecording();
    if (message.type === 'ENABLE_MIC') await enableMicrophone(message.deviceId);
    if (message.type === 'SET_MIC_MUTED') await setMicrophoneMuted(message.muted);
    if (message.type === 'SWITCH_MIC') await switchMicrophone(message.deviceId);
    sendResponse({ ok: true });
  })().catch(async error => {
    if (message.type === 'START_RECORDING') await cleanup();
    await sendState({
      recording: message.type === 'START_RECORDING' ? false : true,
      phase: message.type === 'START_RECORDING' ? 'error' : 'recording',
      message: error.message,
    });
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {});

// module is undefined in the browser, so this is a no-op there. It exists only so the license
// gate on pauseRecording/resumeRecording can be covered by a node test without a real
// AudioContext or MediaRecorder.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startRecording, stopRecording, pauseRecording, resumeRecording, enableMicrophone, switchMicrophone, setMicrophoneMuted };
}
