import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProcessor } from '../app/core/processor.js';
import { eventTypes } from '../app/events/index.js';
import { createIdempotencyGuard } from '../app/core/idempotency.js';

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

// The DB is injected, so tests record inserts or simulate failures without any mocking library.
const setup = (insertImpl) => {
  const rows = [];
  const insert = insertImpl ?? (async (row) => (rows.push(row), { insertId: rows.length }));
  return { rows, run: createProcessor({ eventTypes, insert, logger: silentLogger, concurrency: 3 }) };
};

const alice = { type: 'user_registered', name: 'Alice', email: 'alice@example.com', roles: 'admin', joined: '2021-04-01' };

test('rejects non-objects and unknown types, and keeps processing the rest', async () => {
  const { run, rows } = setup();
  const results = await run([null, 'text', { type: 'unknown_type' }, {}, alice]);

  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected', 'rejected', 'rejected', 'stored']);
  assert.match(results[2].errors[0], /unknown event type "unknown_type"/);
  assert.equal(rows.length, 1);
});

test('maps a valid event to a Notification row', async () => {
  const { run, rows } = setup();
  await run([{ ...alice, event_id: 'e-1' }]);

  assert.deepEqual(rows[0], {
    NotificationTypeID: 1,
    Status: 0,
    NotificationData: JSON.stringify({ name: 'Alice', email: 'alice@example.com', roles: ['admin'], joined: '2021-04-01T00:00:00.000Z', eventId: 'e-1' }),
    CreatedByType: 0,
    CreatedByID: 0,
  });
});

test('dedupes by event_id (first valid wins) and exact content without an id', async () => {
  const { run, rows } = setup();
  const results = await run([
    { ...alice, roles: null, event_id: 'd-1' },
    { ...alice, roles: 'admin', event_id: 'd-1' },
    alice,
    { ...alice }, // same content, no id
  ]);

  assert.deepEqual(results.map((r) => r.status), ['stored', 'duplicate', 'stored', 'duplicate']);
  assert.equal(rows.length, 2);
});

test('an invalid first copy does not block a valid retry with the same event_id', async () => {
  const { run } = setup();
  const results = await run([{ ...alice, email: 'bad', event_id: 'r-1' }, { ...alice, event_id: 'r-1' }]);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'stored']);
});

test('a DB failure is isolated: other events are still stored', async () => {
  const { run } = setup(async (row) => {
    if (row.NotificationTypeID === 1) throw new Error('connection lost');
    return { insertId: 1 };
  });
  const results = await run([alice, { type: 'password_reset', email: 'c@example.com', requested: '2021-06-01' }]);

  assert.deepEqual(results.map((r) => r.status), ['failed', 'stored']);
  assert.deepEqual(results[0].errors, ['database write failed']);
});

test('idempotency guard: first claim wins, and a released key can be claimed again', () => {
  const guard = createIdempotencyGuard();
  assert.equal(guard.claim('k'), true);
  assert.equal(guard.claim('k'), false);
  guard.release('k'); // what the processor does after a failed DB write
  assert.equal(guard.claim('k'), true);
});

test('results keep the input order under concurrency', async () => {
  const { run } = setup(async () => {
    await new Promise((r) => setTimeout(r, Math.random() * 10));
    return { insertId: 1 };
  });
  const events = Array.from({ length: 20 }, (_, i) => ({ ...alice, event_id: `o-${i}` }));
  assert.deepEqual((await run(events)).map((r) => r.index), [...events.keys()]);
});
