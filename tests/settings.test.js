'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../lib/settings.js');

test('normalize fills in defaults for a partial object', () => {
  const normalized = settings.normalize({ audioQuality: 'mp3-192' });
  assert.equal(normalized.audioQuality, 'mp3-192');
  assert.equal(normalized.videoFormat, 'webm');
  assert.equal(normalized.filenameTemplate, settings.DEFAULTS.filenameTemplate);
});

test('normalize rejects an unknown enum value', () => {
  const normalized = settings.normalize({ audioQuality: 'flac-lossless', videoFormat: 'avi' });
  assert.equal(normalized.audioQuality, 'mp3-64');
  assert.equal(normalized.videoFormat, 'webm');
});

test('effective passes Pro values through when licensed', () => {
  const pro = { videoFormat: 'mp4', audioQuality: 'wav', separateTracks: true, filenameTemplate: '{title}-{date}', subfolder: 'meet' };
  const result = settings.effective(pro, true);
  assert.deepEqual(result, settings.normalize(pro));
});

test('effective downgrades every Pro value when unlicensed', () => {
  const pro = { videoFormat: 'mp4', audioQuality: 'wav', separateTracks: true, filenameTemplate: '{title}-{date}', subfolder: 'meet' };
  const result = settings.effective(pro, false);
  assert.equal(result.videoFormat, 'webm');
  assert.equal(result.audioQuality, 'mp3-64');
  assert.equal(result.separateTracks, false);
  assert.equal(result.filenameTemplate, settings.DEFAULTS.filenameTemplate);
  assert.equal(result.subfolder, '');
});

test('effective downgrade is byte-identical to the plain defaults', () => {
  const result = settings.effective({}, false);
  assert.deepEqual(result, settings.DEFAULTS);
});

test('leftover Pro settings in storage plus no license gives exactly the free defaults', () => {
  // Simulates a user who activated Pro, picked every Pro option, then the key was removed
  // (or never re-verified) and the raw values are still sitting in storage untouched.
  const leftoverFromAPreviousProSession = {
    videoFormat: 'mp4',
    audioQuality: 'mp3-192',
    separateTracks: true,
    filenameTemplate: '{title}-{mode}',
    subfolder: 'Meet Recordings',
  };
  const result = settings.effective(leftoverFromAPreviousProSession, false);
  assert.equal(result.audioQuality, 'mp3-64');
  assert.equal(result.videoFormat, 'webm');
  assert.equal(result.filenameTemplate, settings.DEFAULTS.filenameTemplate);
  assert.equal(result.separateTracks, false);
  assert.equal(result.subfolder, '');
});
