'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wav = require('../lib/wav.js');

function readAscii(view, offset, length) {
  let text = '';
  for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i));
  return text;
}

test('buildHeader writes RIFF/WAVE/fmt/data tags and the sample rate', () => {
  const header = wav.buildHeader({ sampleRate: 48000, channels: 2, dataLength: 1000 });
  const view = new DataView(header);
  assert.equal(readAscii(view, 0, 4), 'RIFF');
  assert.equal(readAscii(view, 8, 4), 'WAVE');
  assert.equal(readAscii(view, 12, 4), 'fmt ');
  assert.equal(readAscii(view, 36, 4), 'data');
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 1000);
  assert.equal(view.getUint32(4, true), 36 + 1000);
});

test('createWriter streams chunks as separate Blob parts and reports total length', async () => {
  const writer = wav.createWriter({ sampleRate: 48000, channels: 2 });
  const chunkA = new Int16Array([1, -1, 2, -2]);
  const chunkB = new Int16Array([3, -3]);
  writer.push(chunkA);
  writer.push(chunkB);
  assert.equal(writer.byteLength, (chunkA.length + chunkB.length) * 2);
  const blob = writer.finalize();
  assert.equal(blob.size, 44 + writer.byteLength);
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  assert.equal(view.getInt16(44, true), 1);
  assert.equal(view.getInt16(46, true), -1);
  assert.equal(view.getInt16(48 + 4, true), 3);
});
