// Free-tier limits: audio only, capped length, mic can be enabled but not muted or switched.
// Pure functions only, so the exact boundaries can be node-tested without a real recording.
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderLimits = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const config = (typeof globalThis !== 'undefined' && globalThis.MeetRecorderConfig) ||
    (typeof require !== 'undefined' ? require('./config.js') : null);
  const MINUTE_MS = 60000;

  function allowedMode(mode, licensed) {
    return mode !== 'video' || licensed;
  }

  function canControlMic(licensed) {
    return Boolean(licensed);
  }

  // warn is the highest warnMinutes threshold already crossed, or null before the first one
  // and once stop fires (the stop message supersedes any warning).
  function limitState(elapsedMs, licensed) {
    if (licensed) return { stop: false, warn: null, remainingMs: Infinity };
    const maxMs = config.freeLimits.maxMinutes * MINUTE_MS;
    const stop = elapsedMs >= maxMs;
    let warn = null;
    if (!stop) {
      for (const minute of config.freeLimits.warnMinutes) {
        if (elapsedMs >= minute * MINUTE_MS) warn = minute;
      }
    }
    return { stop, warn, remainingMs: Math.max(0, maxMs - elapsedMs) };
  }

  return { allowedMode, canControlMic, limitState };
});
