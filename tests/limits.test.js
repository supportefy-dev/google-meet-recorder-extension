'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const limits = require('../lib/limits.js');

const MIN = 60000;

test('allowedMode blocks video when unlicensed and allows it when licensed', () => {
  assert.equal(limits.allowedMode('video', false), false);
  assert.equal(limits.allowedMode('video', true), true);
});

test('allowedMode always allows audio', () => {
  assert.equal(limits.allowedMode('audio', false), true);
  assert.equal(limits.allowedMode('audio', true), true);
});

test('canControlMic requires a license', () => {
  assert.equal(limits.canControlMic(false), false);
  assert.equal(limits.canControlMic(true), true);
});

test('licensed recordings never stop, at any elapsed time', () => {
  for (const elapsedMs of [0, 34 * MIN + 59000, 40 * MIN, 999 * MIN]) {
    const result = limits.limitState(elapsedMs, true);
    assert.equal(result.stop, false);
    assert.equal(result.warn, null);
    assert.equal(result.remainingMs, Infinity);
  }
});

test('34:59 unlicensed: no warning yet, not stopped', () => {
  const result = limits.limitState(34 * MIN + 59000, false);
  assert.equal(result.stop, false);
  assert.equal(result.warn, null);
});

test('35:00 unlicensed: the first warning fires', () => {
  const result = limits.limitState(35 * MIN, false);
  assert.equal(result.stop, false);
  assert.equal(result.warn, 35);
});

test('39:00 unlicensed: the second warning fires', () => {
  const result = limits.limitState(39 * MIN, false);
  assert.equal(result.stop, false);
  assert.equal(result.warn, 39);
});

test('39:59 unlicensed: still the second warning, still not stopped', () => {
  const result = limits.limitState(39 * MIN + 59000, false);
  assert.equal(result.stop, false);
  assert.equal(result.warn, 39);
});

test('40:00 unlicensed: stops, with no warning attached to a stop', () => {
  const result = limits.limitState(40 * MIN, false);
  assert.equal(result.stop, true);
  assert.equal(result.warn, null);
  assert.equal(result.remainingMs, 0);
});

test('remainingMs counts down correctly before the cap', () => {
  const result = limits.limitState(10 * MIN, false);
  assert.equal(result.remainingMs, 30 * MIN);
});
