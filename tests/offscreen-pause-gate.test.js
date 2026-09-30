'use strict';
// offscreen.js is a classic browser script, not a module. It exposes a module.exports block
// (harmless in the browser, where module is undefined) purely so this license-gate logic can be
// exercised here without a real AudioContext/MediaRecorder, which the pause/resume gate never
// touches when it refuses.
const test = require('node:test');
const assert = require('node:assert/strict');

function loadOffscreen({ licensed }) {
  global.self = global;
  global.addEventListener = () => {};
  global.MeetRecorderConfig = require('../lib/config.js');
  global.MeetRecorderFilename = require('../lib/filename.js');
  global.MeetRecorderSettings = require('../lib/settings.js');
  global.MeetRecorderWav = require('../lib/wav.js');
  global.MeetRecorderLimits = require('../lib/limits.js');
  // Signature verification is covered in license.test.js; this test is only about the gate.
  global.MeetRecorderLicense = { current: async () => ({ pro: licensed }) };
  global.chrome = { runtime: { sendMessage: async () => ({ ok: true }), onMessage: { addListener: () => {} } } };

  delete require.cache[require.resolve('../offscreen.js')];
  return require('../offscreen.js');
}

test('pauseRecording refuses when there is no license', async () => {
  const offscreen = loadOffscreen({ licensed: false });
  await assert.rejects(() => offscreen.pauseRecording(), /Recorder Pro/);
});

test('resumeRecording refuses when there is no license', async () => {
  const offscreen = loadOffscreen({ licensed: false });
  await assert.rejects(() => offscreen.resumeRecording(), /Recorder Pro/);
});

test('pauseRecording passes the license gate when licensed (no active recorder is a separate, benign no-op)', async () => {
  const offscreen = loadOffscreen({ licensed: true });
  await assert.doesNotReject(() => offscreen.pauseRecording());
});

test('a fake pro flag with no real key does not unlock the gate', async () => {
  // current() must come from a re-verified key, never a stored boolean; this stands in for that
  // contract by asserting the gate only opens when current() itself reports pro:true.
  const offscreen = loadOffscreen({ licensed: false });
  global.MeetRecorderLicense = { current: async () => ({ pro: false, spoofed: true }) };
  await assert.rejects(() => offscreen.pauseRecording(), /Recorder Pro/);
});

test('starting a video recording is refused without a license', async () => {
  const offscreen = loadOffscreen({ licensed: false });
  await assert.rejects(
    () => offscreen.startRecording({ streamId: 'stream-1', mode: 'video', title: '' }),
    /Video recording is a Pro feature/,
  );
});

test('muting the recording mic is refused without a license', async () => {
  const offscreen = loadOffscreen({ licensed: false });
  await assert.rejects(() => offscreen.setMicrophoneMuted(true), /Recorder Pro/);
});

test('switching the recording mic is refused without a license', async () => {
  const offscreen = loadOffscreen({ licensed: false });
  await assert.rejects(() => offscreen.switchMicrophone('device-2'), /Recorder Pro/);
});
