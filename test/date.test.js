import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIsoDate } from '../app/validation/date.js';

test('converts the sample formats to ISO 8601 UTC', () => {
  const cases = {
    '2021-04-01': '2021-04-01T00:00:00.000Z',
    'April 5th, 2021 13:45 PST': '2021-04-05T21:45:00.000Z',
    '2021/06/01 10:23+02:00': '2021-06-01T08:23:00.000Z',
    '2021-07-15T00:00:00': '2021-07-15T00:00:00.000Z',
    '2021-06-01T10:23:00+0200': '2021-06-01T08:23:00.000Z',
    'March 3rd, 2022 08:15 GMT': '2022-03-03T08:15:00.000Z',
    'April 5, 2021 13:45': '2021-04-05T13:45:00.000Z', // no zone -> UTC
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(toIsoDate(input), expected, input);
});

test('gives the same result in any host time zone', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Europe/Kyiv', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      assert.equal(toIsoDate('2021-07-15T00:00:00'), '2021-07-15T00:00:00.000Z', tz);
      assert.equal(toIsoDate('April 5, 2021 13:45'), '2021-04-05T13:45:00.000Z', tz);
    }
  } finally {
    process.env.TZ = original;
  }
});

test('rejects invalid dates, including calendar overflow', () => {
  for (const bad of ['yesterday', '', '   ', '2021-02-30', '2021-13-01', null, undefined, 1617235200000, {}]) {
    assert.equal(toIsoDate(bad), null, String(bad));
  }
});
