import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramWebAppData } from '../functions/utils/auth.js';

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

