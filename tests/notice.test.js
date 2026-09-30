'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const notice = require('../lib/notice.js');

test('needsRecordingNotice is true before the notice was ever accepted', () => {
  assert.equal(notice.needsRecordingNotice(undefined), true);
  assert.equal(notice.needsRecordingNotice(false), true);
});

test('needsRecordingNotice is false once accepted is exactly true', () => {
  assert.equal(notice.needsRecordingNotice(true), false);
});

test('needsRecordingNotice treats a truthy non-boolean as not yet accepted', () => {
  assert.equal(notice.needsRecordingNotice(1), true);
  assert.equal(notice.needsRecordingNotice('true'), true);
});
