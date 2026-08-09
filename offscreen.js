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
  mp3Encoder: null,
  mp3Processor: null,
  mp3Sink: null,
  mp3Chunks: [],
  mp3Error: null,
  chunks: [],
  timer: null,
  mode: null,
  startedAt: null,
  micMuted: true,
  includeMic: false,
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

function bestMimeType(mode) {
  const options = mode === 'video'
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/webm;codecs=opus', 'audio/webm'];
  return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function floatToInt16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

function startMp3Encoder() {
  if (!globalThis.lamejs?.Mp3Encoder) throw new Error('The bundled MP3 encoder could not be loaded.');
  state.mp3Chunks = [];
  state.mp3Error = null;
  state.mp3Encoder = new globalThis.lamejs.Mp3Encoder(2, state.audioContext.sampleRate, 64);
  state.mp3Processor = state.audioContext.createScriptProcessor(4096, 2, 2);
  state.mp3Sink = state.audioContext.createGain();
  state.mp3Sink.gain.value = 0;
  state.mp3Processor.onaudioprocess = event => {
    if (state.mp3Error) return;
    try {
      const input = event.inputBuffer;
      const leftSamples = input.getChannelData(0);
      const rightSamples = input.numberOfChannels > 1 ? input.getChannelData(1) : leftSamples;
      const encoded = state.mp3Encoder.encodeBuffer(floatToInt16(leftSamples), floatToInt16(rightSamples));
      if (encoded.length) state.mp3Chunks.push(new Int8Array(encoded));
    } catch (error) {
      state.mp3Error = error;
    }
  };
  state.finalMix.connect(state.mp3Processor);
  state.mp3Processor.connect(state.mp3Sink).connect(state.audioContext.destination);
}

function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

async function sendState(patch) {
  await chrome.runtime.sendMessage({ type: 'RECORDER_STATE', state: patch });
}

async function cleanup() {
  clearInterval(state.timer);
  if (state.mp3Processor) state.mp3Processor.onaudioprocess = null;
  state.mp3Processor?.disconnect();
  state.mp3Sink?.disconnect();
  stopTracks(state.recordingStream);
  stopTracks(state.tabStream);
  stopTracks(state.micStream);
  await state.audioContext?.close().catch(() => {});
  Object.assign(state, {
    recorder: null, tabStream: null, micStream: null, micSource: null, recordingStream: null,
    audioContext: null, micGain: null, tabAnalyser: null, micAnalyser: null,
    outputAnalyser: null, finalMix: null, mp3Encoder: null, mp3Processor: null, mp3Sink: null,
    mp3Chunks: [], mp3Error: null, chunks: [], timer: null, mode: null, startedAt: null,
    includeMic: false, micMuted: true,
  });
}

async function startRecording({ streamId, mode }) {
  if (state.recorder) throw new Error('A recording is already running.');
  state.mode = mode;
  state.includeMic = false;
  state.micMuted = true;
  state.startedAt = Date.now();

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
  if (mode === 'audio') startMp3Encoder();

  const mixedAudioTracks = recordingDestination.stream.getAudioTracks();
  state.recordingStream = mode === 'video'
    ? new MediaStream([...state.tabStream.getVideoTracks(), ...mixedAudioTracks])
    : new MediaStream(mixedAudioTracks);

  const mimeType = bestMimeType(mode);
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

  await sendState({ recording: true, phase: 'recording', mode, includeMic: false, micMuted: true, startedAt: state.startedAt, message: mode === 'audio' ? 'Recording Meet audio · MP3' : 'Recording Meet video + audio' });
  state.timer = setInterval(() => {
    const meetLevel = signalLevel(state.tabAnalyser);
    const micLevel = signalLevel(state.micAnalyser);
    const outputLevel = signalLevel(state.outputAnalyser);
    sendState({
      recording: true, phase: 'recording', meetLevel, micLevel, includeMic: state.includeMic,
      outputLevel, micMuted: state.micMuted,
      message: outputLevel > .004 ? 'Recorder hears sound' : 'Waiting for sound',
    }).catch(() => {});
  }, 400);
}

async function stopRecording() {
  if (!state.recorder || state.recorder.state === 'inactive') return;
  clearInterval(state.timer);
  await sendState({ phase: 'saving', message: state.mode === 'audio' ? 'Finishing MP3…' : 'Saving video…' });
  state.recorder.stop();
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
  await sendState({
    recording: true,
    includeMic: true,
    micMuted: false,
    selectedMicId: deviceId || null,
    message: `Recording Meet audio + ${label}`,
  });
}

async function switchMicrophone(deviceId) {
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

async function saveRecording() {
  try {
    const mode = state.mode;
    let blob;
    let extension;
    if (mode === 'audio') {
      if (state.mp3Error) throw new Error(`MP3 encoding failed: ${state.mp3Error.message}`);
      const finalChunk = state.mp3Encoder?.flush();
      if (finalChunk?.length) state.mp3Chunks.push(new Int8Array(finalChunk));
      blob = new Blob(state.mp3Chunks, { type: 'audio/mpeg' });
      extension = 'mp3';
      if (!blob.size) throw new Error('The MP3 encoder produced an empty recording.');
    } else {
      blob = new Blob(state.chunks, { type: state.recorder.mimeType });
      extension = 'webm';
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const url = URL.createObjectURL(blob);
    const filename = `google-meet-${mode}-${timestamp}.${extension}`;
    const result = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_RECORDING', url, filename });
    if (!result?.ok) throw new Error(result?.error || 'Chrome could not download the recording.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    await cleanup();
    await sendState({ recording: false, phase: 'saved', message: `Saved ${(blob.size / 1048576).toFixed(1)} MB`, meetLevel: 0, micLevel: 0, outputLevel: 0 });
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
