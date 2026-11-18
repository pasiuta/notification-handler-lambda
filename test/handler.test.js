import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.LOG_LEVEL = 'ERROR';
const { handler } = await import('../app/handler.js');
const load = async (file) => JSON.parse(await readFile(new URL(`../sample/${file}`, import.meta.url), 'utf8'));

test('processes the sample events from the task end-to-end', async () => {
  const { summary, results } = await handler(await load('events.json'));

  assert.deepEqual(summary, { total: 7, stored: 4, rejected: 2, duplicate: 1 });
  assert.deepEqual(results.map((r) => r.status), ['stored', 'rejected', 'stored', 'stored', 'rejected', 'stored', 'duplicate']);
  assert.deepEqual(results[0].data.roles, ['admin', 'editor', 'manager']);
  assert.deepEqual(results[1].errors, ['email must be a valid email']); // Bob: "(at)" email
  assert.equal(results[2].data.requested, '2021-06-01T08:23:00.000Z');
  assert.equal(results[3].data.deleted, '2021-07-15T00:00:00.000Z');
  assert.deepEqual(results[5].data.roles, []); // roles: null
});

test('supports an SQS batch, including a malformed message body', async () => {
  const { summary, results, batchItemFailures } = await handler(await load('sqs-event.json'));

  assert.deepEqual(summary, { total: 3, stored: 2, rejected: 1 });
  assert.equal(results[0].data.email, 'frank@example.com');
  assert.deepEqual(results[2].data.roles, ['admin', 'editor']);
  assert.equal(results[2].data.joined, '2022-03-03T08:15:00.000Z');
  assert.deepEqual(batchItemFailures, []); // invalid messages are not retried
});

test('accepts { events: [...] } and rejects unsupported payloads', async () => {
  assert.equal((await handler({ events: [] })).summary.total, 0);
  await assert.rejects(handler({ foo: 1 }), TypeError);
  await assert.rejects(handler(undefined), TypeError);
});
