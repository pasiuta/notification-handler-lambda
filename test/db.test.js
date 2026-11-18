import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsert, insertToMySQL } from '../app/db/mysql.js';

test('buildInsert produces a parameterized query (no values inside the SQL)', () => {
  const { sql, params } = buildInsert({ NotificationTypeID: 1, NotificationData: '{"name":"Robert\'); DROP TABLE x;--"}' });

  assert.equal(sql, 'INSERT INTO `Notification` (`NotificationTypeID`, `NotificationData`) VALUES (?, ?)');
  assert.equal(params.length, 2);
  assert.ok(!sql.includes('DROP'));
});

test('insertToMySQL returns increasing insert ids', async () => {
  const a = await insertToMySQL({ NotificationTypeID: 1 });
  const b = await insertToMySQL({ NotificationTypeID: 2 });
  assert.equal(b.insertId, a.insertId + 1);
});
