import { createHash } from 'node:crypto';

// Idempotency key: the producer's event_id when present. Otherwise a hash of the normalized
// content, so exact duplicates without an id are also caught.
export const idempotencyKey = (type, data, eventId) =>
  eventId != null
    ? `id:${eventId}`
    : `hash:${createHash('sha1').update(type).update(JSON.stringify(data)).digest('hex')}`;

// Per-batch registry: the FIRST valid occurrence wins and later ones are reported as duplicates
// (the same semantics as a UNIQUE key on EventID). Only events that pass validation claim a key,
// so an invalid first copy does not block a valid retry. If the DB write fails, the key is released.
// Across invocations, idempotency belongs to the database (see the UNIQUE key in db/schema.sql).
export const createIdempotencyGuard = () => {
  const seen = new Set();
  return {
    claim: (key) => !seen.has(key) && Boolean(seen.add(key)),
    release: (key) => seen.delete(key),
  };
};
