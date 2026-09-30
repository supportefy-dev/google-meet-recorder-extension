// Verifies and stores the BASH1-<payload>.<signature> license key shared across bash-extensions
// products (see ops/license-keys/license_core.py). createLicenseChecker takes a config so tests
// can inject an ephemeral keypair instead of the production public key.
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderLicense = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIGNATURE_BYTES = 64;

  function base64ToBytes(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function base64UrlToBytes(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
    return base64ToBytes(padded);
  }

  function subtleCrypto() {
    const cryptoRef = (typeof crypto !== 'undefined' && crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!cryptoRef?.subtle) throw new Error('WebCrypto is not available in this context.');
    return cryptoRef.subtle;
  }

  function createLicenseChecker(config, deps) {
    let publicKeyPromise = null;
    const listeners = new Set();
    function notify(status) {
      for (const listener of listeners) listener(status);
    }
    function onLicenseChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function importPublicKey() {
      if (!publicKeyPromise) {
        publicKeyPromise = subtleCrypto().importKey(
          'spki',
          base64ToBytes(config.publicKey),
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify'],
        );
      }
      return publicKeyPromise;
    }

    async function verify(input) {
      const text = String(input ?? '').replace(/\s+/g, '');
      if (!text.startsWith(config.keyPrefix)) return { ok: false, reason: 'format' };
      const parts = text.slice(config.keyPrefix.length).split('.');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'format' };

      let body;
      let signature;
      try {
        body = base64UrlToBytes(parts[0]);
        signature = base64UrlToBytes(parts[1]);
      } catch {
        return { ok: false, reason: 'format' };
      }
      if (signature.length !== SIGNATURE_BYTES) return { ok: false, reason: 'format' };

      let valid;
      try {
        valid = await subtleCrypto().verify({ name: 'ECDSA', hash: 'SHA-256' }, await importPublicKey(), signature, body);
      } catch {
        return { ok: false, reason: 'format' };
      }
      if (!valid) return { ok: false, reason: 'signature' };

      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(body));
      } catch {
        return { ok: false, reason: 'format' };
      }
      if (payload?.v !== config.formatVersion) return { ok: false, reason: 'version' };
      if (payload?.p !== config.product) return { ok: false, reason: 'product' };
      if (typeof payload.e !== 'string' || !payload.e) return { ok: false, reason: 'format' };

      return { ok: true, text, email: payload.e, issued: String(payload.i ?? ''), nonce: String(payload.n ?? '') };
    }

    function storage() {
      if (deps?.localStorage) return deps.localStorage;
      const chromeRef = typeof chrome !== 'undefined' ? chrome : null;
      if (!chromeRef?.storage?.local) throw new Error('Extension storage is not available.');
      return chromeRef.storage.local;
    }

    async function current() {
      const stored = await storage().get(config.licenseStorageKey);
      const text = stored[config.licenseStorageKey];
      if (!text) return { pro: false };
      const result = await verify(text);
      return result.ok ? { pro: true, email: result.email, issued: result.issued } : { pro: false };
    }

    async function activate(input) {
      const result = await verify(input);
      if (!result.ok) return result;
      await storage().set({ [config.licenseStorageKey]: result.text });
      notify({ pro: true, email: result.email, issued: result.issued });
      return result;
    }

    async function deactivate() {
      await storage().remove(config.licenseStorageKey);
      notify({ pro: false });
    }

    // Chrome-backed instances also react to the key changing from another surface, e.g. the
    // options page activating a license while the popup is already open.
    if (!deps?.localStorage) {
      const chromeRef = typeof chrome !== 'undefined' ? chrome : null;
      if (chromeRef?.storage?.onChanged) {
        chromeRef.storage.onChanged.addListener(async (changes, area) => {
          if (area !== 'local' || !(config.licenseStorageKey in changes)) return;
          const text = changes[config.licenseStorageKey].newValue;
          if (!text) { notify({ pro: false }); return; }
          const result = await verify(text);
          notify(result.ok ? { pro: true, email: result.email, issued: result.issued } : { pro: false });
        });
      }
    }

    return { verify, activate, deactivate, current, onLicenseChange };
  }

  const defaultConfig = (typeof globalThis !== 'undefined' && globalThis.MeetRecorderConfig) ||
    (typeof require !== 'undefined' ? require('./config.js') : null);

  const api = { createLicenseChecker };
  if (defaultConfig) Object.assign(api, createLicenseChecker(defaultConfig));
  return api;
});
