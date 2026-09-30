'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLicenseChecker } = require('../lib/license.js');
const { generateKeypair, signLicense, base64url } = require('./helpers/keys.js');

function fakeLocalStorage(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) { return { [key]: data[key] }; },
    async set(patch) { Object.assign(data, patch); },
    async remove(key) { delete data[key]; },
    dump: () => data,
  };
}

async function testConfig() {
  const { privateKey, publicKeyBase64 } = await generateKeypair();
  const config = {
    keyPrefix: 'BASH1-',
    formatVersion: 1,
    product: 'meet-recorder-pro',
    publicKey: publicKeyBase64,
    licenseStorageKey: 'license',
  };
  return { privateKey, config };
}

test('verify accepts a validly signed key for this product', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const result = await checker.verify(key);
  assert.equal(result.ok, true);
  assert.equal(result.email, 'buyer@example.com');
});

test('verify rejects a tampered payload', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const [prefixAndBody, signature] = key.split('.');
  const tamperedBody = base64url(Buffer.from(JSON.stringify({ v: 1, p: 'meet-recorder-pro', e: 'attacker@example.com', i: '2026-09-30', n: 'deadbeef' })));
  const tampered = `${prefixAndBody.slice(0, 'BASH1-'.length)}${tamperedBody}.${signature}`;
  const result = await checker.verify(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'signature');
});

test('verify rejects a key signed for a different product', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'speed-dial-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const result = await checker.verify(key);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'product');
});

test('verify rejects a bad signature length', async () => {
  const { config } = await testConfig();
  const checker = createLicenseChecker(config);
  const body = base64url(Buffer.from(JSON.stringify({ v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' })));
  const shortSignature = base64url(Buffer.from('too-short'));
  const result = await checker.verify(`BASH1-${body}.${shortSignature}`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'format');
});

test('verify rejects a key with the wrong prefix', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const result = await checker.verify(key.replace('BASH1-', 'BASH2-'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'format');
});

test('verify rejects a validly signed but non-JSON payload', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const { webcrypto } = require('node:crypto');
  const body = Buffer.from('not-json');
  const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, body));
  const result = await checker.verify(`BASH1-${base64url(body)}.${base64url(signature)}`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'format');
});

test('activate stores the key and current() reports it licensed', async () => {
  const { privateKey, config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const checker = createLicenseChecker(config, { localStorage });
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const activated = await checker.activate(key);
  assert.equal(activated.ok, true);
  const status = await checker.current();
  assert.equal(status.pro, true);
  assert.equal(status.email, 'buyer@example.com');
});

test('activate rejects a bad key and does not store it', async () => {
  const { config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const checker = createLicenseChecker(config, { localStorage });
  const activated = await checker.activate('BASH1-garbage.garbage');
  assert.equal(activated.ok, false);
  assert.equal(localStorage.dump().license, undefined);
});

test('deactivate removes the stored key', async () => {
  const { privateKey, config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const checker = createLicenseChecker(config, { localStorage });
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  await checker.activate(key);
  await checker.deactivate();
  const status = await checker.current();
  assert.equal(status.pro, false);
});

test('current() reports unlicensed when nothing is stored', async () => {
  const { config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const checker = createLicenseChecker(config, { localStorage });
  const status = await checker.current();
  assert.equal(status.pro, false);
});

test('a payload carrying the record-only "t" field still verifies', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef', t: 'early-bird' });
  const result = await checker.verify(key);
  assert.equal(result.ok, true);
  assert.equal(result.email, 'buyer@example.com');
});

test('a valid key survives a reload (a fresh checker reading the same storage)', async () => {
  const { privateKey, config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef', t: 'sale' });
  await createLicenseChecker(config, { localStorage }).activate(key);
  const reloaded = createLicenseChecker(config, { localStorage });
  const status = await reloaded.current();
  assert.equal(status.pro, true);
  assert.equal(status.email, 'buyer@example.com');
});

test('changing one character of a valid payload is rejected', async () => {
  const { privateKey, config } = await testConfig();
  const checker = createLicenseChecker(config);
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const [prefixAndBody, signature] = key.split('.');
  const flipped = prefixAndBody.slice(-1) === 'A' ? 'B' : 'A';
  const mutated = `${prefixAndBody.slice(0, -1)}${flipped}.${signature}`;
  const result = await checker.verify(mutated);
  assert.equal(result.ok, false);
});

test('onLicenseChange notifies listeners on activate and deactivate', async () => {
  const { privateKey, config } = await testConfig();
  const localStorage = fakeLocalStorage();
  const checker = createLicenseChecker(config, { localStorage });
  const key = await signLicense(privateKey, { v: 1, p: 'meet-recorder-pro', e: 'buyer@example.com', i: '2026-09-30', n: 'deadbeef' });
  const seen = [];
  checker.onLicenseChange(status => seen.push(status));
  await checker.activate(key);
  await checker.deactivate();
  assert.equal(seen.length, 2);
  assert.equal(seen[0].pro, true);
  assert.equal(seen[1].pro, false);
});
