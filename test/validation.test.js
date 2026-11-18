import { test } from 'node:test';
import assert from 'node:assert/strict';
import { text, email, stringList } from '../app/validation/rules.js';
import { validate } from '../app/validation/schema.js';
import { userRegistered } from '../app/events/user-registered.js';

test('email: accepts valid addresses (normalized) and rejects malformed ones', () => {
  assert.deepEqual(email('  Alice@Example.COM '), { value: 'alice@example.com' });
  assert.deepEqual(email('first.last+tag@sub.example.co.uk'), { value: 'first.last+tag@sub.example.co.uk' });
  for (const bad of ['bob.smith(at)example.com', 'a@b', 'no-at.example.com', 'a@@b.com', 'a b@c.com', '', null, 42]) {
    assert.ok('error' in email(bad), String(bad));
  }
});

test('stringList: normalizes roles into a clean array of strings', () => {
  assert.deepEqual(stringList('admin, editor , manager').value, ['admin', 'editor', 'manager']);
  assert.deepEqual(stringList(['viewer', ' ']).value, ['viewer']);
  assert.deepEqual(stringList(['Admin', 'admin', ' Editor ']).value, ['admin', 'editor']);
  assert.deepEqual(stringList(null).value, []);
  assert.deepEqual(stringList(undefined).value, []);
  assert.deepEqual(stringList('').value, []);
  assert.ok('error' in stringList(42));
  assert.ok('error' in stringList(['ok', 1]));
});

test('text: trims and requires a non-empty string', () => {
  assert.deepEqual(text('  Bob Smith '), { value: 'Bob Smith' });
  assert.ok('error' in text('   '));
  assert.ok('error' in text(undefined));
});

test('validate: collects all errors and drops unknown fields', () => {
  assert.deepEqual(validate(userRegistered.schema, { name: ' ', email: 'x', joined: 'never' }), {
    errors: ['name must be a non-empty string', 'email must be a valid email', 'joined must be a valid date'],
  });

  const { data } = validate(userRegistered.schema, {
    name: 'Alice',
    email: 'alice@example.com',
    joined: '2021-04-01',
    password: 'secret', // not in the schema: must never be stored
  });
  assert.deepEqual(data, { name: 'Alice', email: 'alice@example.com', roles: [], joined: '2021-04-01T00:00:00.000Z' });
});
