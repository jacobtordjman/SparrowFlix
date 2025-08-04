import test from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from './bot.js';

class MockCache {
  constructor() {
    this.store = new Map();
  }
  async get(key) {
    return this.store.get(key);
  }
  async put(key, value) {
    this.store.set(key, value);
  }
  async delete(key) {
    this.store.delete(key);
  }
}

class TestBot extends Bot {
  constructor(token, env) {
    super(token, env);
    this.sent = [];
  }
  async sendMessage(chatId, text, options = {}) {
    this.sent.push({ chatId, text, options });
  }
}

test('start and stop commands manage process and state', async () => {
  const cache = new MockCache();
  const env = { FILEPATH_CACHE: cache };
  const bot = new TestBot('token', env);

  let exitCode;
  const originalExit = process.exit;
  process.exit = (code) => {
    exitCode = code;
  };

  await bot.handleMessage({ chat: { id: 1 }, text: '/start' });
  assert.equal(await cache.get('bot_status_1'), 'active');

  await bot.handleMessage({ chat: { id: 1 }, text: '/stop' });
  // allow setTimeout inside handleMessage to fire
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await cache.get('bot_status_1'), 'stopped');
  assert.equal(exitCode, 0);

  bot.sent = [];
  await bot.handleMessage({ chat: { id: 1 }, text: 'hello' });
  assert.equal(bot.sent[0].text, 'Bot is currently stopped. Send /start to begin.');

  await bot.handleMessage({ chat: { id: 1 }, text: '/start' });
  assert.equal(await cache.get('bot_status_1'), 'active');

  process.exit = originalExit;
});

test('sendMessage logs API errors', async () => {
  const cache = new MockCache();
  const env = { FILEPATH_CACHE: cache };
  const bot = new Bot('token', env);

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    json: async () => ({ ok: false, description: 'unauthorized' }),
  });

  let logged;
  const originalError = console.error;
  console.error = (msg, data) => {
    if (msg === 'Telegram sendMessage error:') {
      logged = data;
    }
  };

  await bot.sendMessage(1, 'hi');

  assert.deepEqual(logged, { ok: false, description: 'unauthorized' });

  console.error = originalError;
  global.fetch = originalFetch;
});
