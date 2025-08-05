import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicket } from '../functions/api/ticket.js';

// Test that createTicket stores fileId from database lookup

test('createTicket stores fileId in ticket data', async () => {
  const fakeDB = {
    prepare: () => ({
      bind: () => ({
        async first() {
          return 'file123';
        }
      })
    })
  };

  let stored;
  const env = {
    DB: fakeDB,
    TICKETS: {
      async put(key, value) {
        stored = JSON.parse(value);
      }
    }
  };

  await createTicket(env, { contentId: '1', type: 'movie' });

  assert.strictEqual(stored.fileId, 'file123');
});
