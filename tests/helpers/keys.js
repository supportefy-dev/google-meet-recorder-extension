// Ephemeral P-256 test keypair generation and signing, mirroring ops/license-keys/license_core.py.
// Never touches the vault or the production private key.
'use strict';
const { webcrypto } = require('node:crypto');
const subtle = webcrypto.subtle;

async function generateKeypair() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = Buffer.from(await subtle.exportKey('spki', pair.publicKey));
  return { privateKey: pair.privateKey, publicKeyBase64: spki.toString('base64') };
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signLicense(privateKey, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, body));
  return `BASH1-${base64url(body)}.${base64url(signature)}`;
}

module.exports = { generateKeypair, signLicense, base64url };
