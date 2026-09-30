'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const filename = require('../lib/filename.js');

test('default template reproduces the pre-4.5.0 filename shape', () => {
  const now = new Date('2026-09-30T08:15:23.456Z');
  const built = filename.buildFilename({ template: undefined, mode: 'audio', extension: 'mp3', title: '', subfolder: '', now });
  const legacyTimestamp = now.toISOString().replace(/[:.]/g, '-');
  assert.equal(built, `google-meet-audio-${legacyTimestamp}.mp3`);
});

test('renderTemplate substitutes every token', () => {
  const result = filename.renderTemplate('{title}-{mode}-{date}-{time}', { date: '2026-09-30', time: '08-15-23', mode: 'video', title: 'Weekly Sync' });
  assert.equal(result, 'Weekly Sync-video-2026-09-30-08-15-23');
});

test('sanitizeSubfolder strips parent-directory traversal', () => {
  assert.equal(filename.sanitizeSubfolder('..\\x'), 'x');
  assert.equal(filename.sanitizeSubfolder('../../x/../y'), 'x/y');
});

test('sanitizeSubfolder strips a drive letter and leading slash', () => {
  assert.equal(filename.sanitizeSubfolder('C:\\x'), 'C-/x');
  assert.ok(!filename.sanitizeSubfolder('C:\\x').includes(':'));
  assert.equal(filename.sanitizeSubfolder('/x/y'), 'x/y');
});

test('sanitizeFilenameBase removes reserved characters and reserved device names', () => {
  assert.equal(filename.sanitizeFilenameBase('a<b>c:d*e?f"g|h'), 'a-b-c-d-e-f-g-h');
  assert.equal(filename.sanitizeFilenameBase('CON'), '_CON');
});

test('empty title token falls back cleanly with no leftover placeholder', () => {
  const result = filename.renderTemplate('{title}', { date: '', time: '', mode: '', title: '' });
  assert.equal(result, 'google-meet-recording');
  assert.ok(!result.includes('{'));
});

test('an overlong name is capped', () => {
  const long = 'x'.repeat(500);
  const result = filename.sanitizeFilenameBase(long);
  assert.ok(result.length <= 150);
});
