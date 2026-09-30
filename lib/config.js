// The only home for Pro pricing, links, the license public key and the early-bird offer.
// Read by license.js, settings.js, options.js and popup.js. Never duplicate a value from here.
(function (root, factory) {
  const config = factory();
  root.MeetRecorderConfig = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const price = 4.99;
  const currency = 'USD';
  return Object.freeze({
    product: 'meet-recorder-pro',
    price,
    currency,
    paypalUrl: `https://www.paypal.com/paypalme/BashOM/${price.toFixed(2)}${currency}`,
    donateUrl: 'https://paypal.me/BashOM',
    repoUrl: 'https://github.com/supportefy-dev/meet-recorder',
    keyPrefix: 'BASH1-',
    formatVersion: 1,
    publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPMsagPYeN2co6gKUxcYHg/FZqdF4e/tlg06QZWSG4iTuZkXP3vhfpvXVoD1QkBxek9eGviIHzeT6SSRaLu1lcA==',
    licenseStorageKey: 'license',
    settingsStorageKey: 'recordingSettings',
    earlyBird: Object.freeze({ open: true, seats: 100, claimEmail: 'bash@supportefy.com' }),
  });
});
