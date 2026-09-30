// 16-bit PCM WAV header plus a streaming writer that keeps Int16 chunks as separate Blob parts
// instead of concatenating into one growing array (an hour of stereo 48kHz audio is ~690MB).
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderWav = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BITS_PER_SAMPLE = 16;

  function writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function buildHeader({ sampleRate, channels, dataLength }) {
    const blockAlign = channels * (BITS_PER_SAMPLE / 8);
    const byteRate = sampleRate * blockAlign;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, BITS_PER_SAMPLE, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    return buffer;
  }

  function int16ChunkToBytes(int16Array) {
    return new Uint8Array(int16Array.buffer.slice(int16Array.byteOffset, int16Array.byteOffset + int16Array.byteLength));
  }

  function createWriter({ sampleRate, channels }) {
    let dataLength = 0;
    const parts = [];
    return {
      push(int16Array) {
        const bytes = int16ChunkToBytes(int16Array);
        dataLength += bytes.byteLength;
        parts.push(bytes);
      },
      get byteLength() {
        return dataLength;
      },
      finalize() {
        if (typeof Blob === 'undefined') throw new Error('Blob is not available in this context.');
        const header = buildHeader({ sampleRate, channels, dataLength });
        return new Blob([header, ...parts], { type: 'audio/wav' });
      },
    };
  }

  return { BITS_PER_SAMPLE, buildHeader, int16ChunkToBytes, createWriter };
});
