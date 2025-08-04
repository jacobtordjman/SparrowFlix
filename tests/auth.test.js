import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramWebAppData, hashPassword, verifyPassword } from '../functions/utils/auth.js';
import { generateWebToken, verifyWebToken } from '../functions/utils/jwt.js';

test('verifyTelegramWebAppData returns user for valid hash', () => {
  const botToken = 'test_token';
  const user = { id: 123, first_name: 'Alice' };
  const authDate = '123456';

  const params = new URLSearchParams({
    auth_date: authDate,
    user: JSON.stringify(user)
  });

  const dataCheckString = Array.from(params.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);
  const initData = params.toString();

  const result = verifyTelegramWebAppData(initData, botToken);
  assert.deepStrictEqual(result, user);
});

test('verifyTelegramWebAppData returns null for invalid hash', () => {
  const botToken = 'test_token';
  const user = { id: 123, first_name: 'Alice' };
  const authDate = '123456';

  const params = new URLSearchParams({
    auth_date: authDate,
    user: JSON.stringify(user),
    hash: 'invalid'
  });

  const initData = params.toString();
  const result = verifyTelegramWebAppData(initData, botToken);
  assert.strictEqual(result, null);
});

test('hashPassword and verifyPassword work together', () => {
  const password = 'secret';
  const hashed = hashPassword(password);
  assert.ok(hashed.includes(':'));
  assert.equal(verifyPassword(password, hashed), true);
});

test('generateWebToken creates verifiable token', () => {
  const secret = 'testsecret';
  const token = generateWebToken({ id: 1 }, secret, 60);
  const payload = verifyWebToken(token, secret);
  assert.equal(payload.id, 1);
});

