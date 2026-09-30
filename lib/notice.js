// One-time recording-consent notice: pure decision logic, no storage or DOM access here.
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderNotice = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function needsRecordingNotice(accepted) {
    return accepted !== true;
  }

  return { needsRecordingNotice };
});
