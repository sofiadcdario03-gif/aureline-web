import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, destinationAfterLogin } from '../src/services/authService.js';
import {
  createAccessToken,
  generateSalt,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from '../server/security.js';

test('emails are normalized before authentication', () => {
  assert.equal(normalizeEmail(' Guest@Example.COM '), 'guest@example.com');
});

test('passwords are salted and verified without storing the original text', () => {
  const password = 'A secure test password';
  const salt = generateSalt();
  const digest = hashPassword(password, salt);
  assert.ok(verifyPassword(password, salt, digest));
  assert.equal(verifyPassword('wrong password', salt, digest), false);
  assert.equal(JSON.stringify({ salt, digest }).includes(password), false);
});

test('access tokens are signed, expire, and reject altered claims', () => {
  const secret = 'test-only-secret-with-sufficient-entropy';
  const identity = { role: 'Admin', staffId: 'ST-1' };
  const token = createAccessToken(identity, secret, 1000);
  assert.deepEqual(verifyAccessToken(token, secret, 1001), {
    ...identity,
    exp: 1000 + 12 * 60 * 60 * 1000,
  });
  assert.equal(verifyAccessToken(token, 'a different secret', 1001), null);
  assert.equal(verifyAccessToken(token, secret, 1000 + 12 * 60 * 60 * 1000), null);
  assert.equal(verifyAccessToken(`${token}x`, secret, 1001), null);
});

test('login redirects retain valid stay searches without allowing external destinations', () => {
  const search = '/search?start=2026-12-02&end=2026-12-05&guests=2';
  assert.equal(destinationAfterLogin('Guest', search), search);
  assert.equal(destinationAfterLogin('Guest', '/dashboard'), '/my-stays');
  assert.equal(destinationAfterLogin('Front Desk', '/team'), '/dashboard');
  assert.equal(destinationAfterLogin('Admin', '/team'), '/team');
  assert.equal(destinationAfterLogin('Guest', 'https://example.com'), '/my-stays');
  assert.equal(destinationAfterLogin('Admin', '//example.com'), '/dashboard');
});
