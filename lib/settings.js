// Recording settings defaults, storage and the Free/Pro downgrade. offscreen.js and
// service-worker.js must read settings through effective(), never the raw stored object, so an
// unlicensed user always gets the free 4.4.7 behavior regardless of what is saved.
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderSettings = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const config = (typeof globalThis !== 'undefined' && globalThis.MeetRecorderConfig) ||
    (typeof require !== 'undefined' ? require('./config.js') : null);
  const filenameLib = (typeof globalThis !== 'undefined' && globalThis.MeetRecorderFilename) ||
    (typeof require !== 'undefined' ? require('./filename.js') : null);

  const DEFAULT_TEMPLATE = filenameLib ? filenameLib.DEFAULT_TEMPLATE : 'google-meet-{mode}-{date}T{time}';

  const DEFAULTS = Object.freeze({
    videoFormat: 'webm',
    audioQuality: 'mp3-64',
    separateTracks: false,
    filenameTemplate: DEFAULT_TEMPLATE,
    subfolder: '',
  });

  const AUDIO_QUALITY_BITRATES = Object.freeze({ 'mp3-64': 64, 'mp3-128': 128, 'mp3-192': 192 });
  const VIDEO_FORMATS = Object.freeze(['webm', 'mp4']);
  const AUDIO_QUALITIES = Object.freeze(['mp3-64', 'mp3-128', 'mp3-192', 'wav']);
  const PRO_VIDEO_FORMATS = Object.freeze(['mp4']);
  const PRO_AUDIO_QUALITIES = Object.freeze(['mp3-128', 'mp3-192', 'wav']);

  function normalize(settings) {
    const merged = { ...DEFAULTS, ...(settings || {}) };
    if (!VIDEO_FORMATS.includes(merged.videoFormat)) merged.videoFormat = DEFAULTS.videoFormat;
    if (!AUDIO_QUALITIES.includes(merged.audioQuality)) merged.audioQuality = DEFAULTS.audioQuality;
    merged.separateTracks = Boolean(merged.separateTracks);
    merged.filenameTemplate = typeof merged.filenameTemplate === 'string' && merged.filenameTemplate.trim()
      ? merged.filenameTemplate
      : DEFAULTS.filenameTemplate;
    merged.subfolder = typeof merged.subfolder === 'string' ? merged.subfolder : '';
    return merged;
  }

  // Downgrades every Pro value to its free default when unlicensed. Anything reading settings
  // for recording behavior must go through this, never the stored object directly.
  function effective(settings, licensed) {
    const normalized = normalize(settings);
    if (licensed) return normalized;
    return {
      ...normalized,
      videoFormat: DEFAULTS.videoFormat,
      audioQuality: DEFAULTS.audioQuality,
      separateTracks: DEFAULTS.separateTracks,
      filenameTemplate: DEFAULTS.filenameTemplate,
      subfolder: DEFAULTS.subfolder,
    };
  }

  function storageKey() {
    return config?.settingsStorageKey || 'recordingSettings';
  }

  async function load() {
    const chromeRef = typeof chrome !== 'undefined' ? chrome : null;
    if (!chromeRef?.storage?.local) return { ...DEFAULTS };
    const stored = await chromeRef.storage.local.get(storageKey());
    return normalize(stored[storageKey()]);
  }

  async function save(settings) {
    const chromeRef = typeof chrome !== 'undefined' ? chrome : null;
    if (!chromeRef?.storage?.local) throw new Error('Extension storage is not available.');
    const normalized = normalize(settings);
    await chromeRef.storage.local.set({ [storageKey()]: normalized });
    return normalized;
  }

  return {
    DEFAULTS,
    AUDIO_QUALITY_BITRATES,
    VIDEO_FORMATS,
    AUDIO_QUALITIES,
    PRO_VIDEO_FORMATS,
    PRO_AUDIO_QUALITIES,
    normalize,
    effective,
    load,
    save,
  };
});
