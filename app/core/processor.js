import { validate } from '../validation/schema.js';
import { toNotificationRow } from '../db/notification.js';
import { idempotencyKey, createIdempotencyGuard } from './idempotency.js';
import { mapLimit } from './pool.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The pipeline for one batch: resolve type -> validate and normalize -> dedupe -> store.
// Every event is isolated: a problem becomes a { status, errors } result and a log line,
// and the remaining events keep going. Logs contain the index, type and error messages, never
// raw payloads, so no PII (emails, names) ends up in the logs.
export const createProcessor = ({ eventTypes, insert, logger, concurrency }) => async (events) => {
  const guard = createIdempotencyGuard();

  const reject = (index, type, errors) => {
    logger.warn('Event rejected', { index, type, errors });
    return { index, type, status: 'rejected', errors };
  };

  const processOne = async (raw, index) => {
    if (!isObject(raw)) return reject(index, null, ['event must be a JSON object']);

    const definition = eventTypes.get(raw.type);
    if (!definition) return reject(index, raw.type ?? null, [`unknown event type "${raw.type}"`]);

    const { data, errors } = validate(definition.schema, raw);
    if (errors) return reject(index, raw.type, errors);

    // Claimed synchronously before the first await, so "first wins" follows input order.
    const key = idempotencyKey(raw.type, data, raw.event_id);
    if (!guard.claim(key)) {
      logger.info('Duplicate event skipped', { index, type: raw.type, eventId: raw.event_id });
      return { index, type: raw.type, status: 'duplicate' };
    }

    try {
      const { insertId } = await insert(toNotificationRow(definition, data, raw.event_id));
      logger.info('Event stored', { index, type: raw.type, notificationId: insertId });
      return { index, type: raw.type, status: 'stored', notificationId: insertId, data };
    } catch (err) {
      guard.release(key); // let a later retry of the same event go through
      logger.error('Database write failed', { index, type: raw.type, error: err.message });
      return { index, type: raw.type, status: 'failed', errors: ['database write failed'] };
    }
  };

  return mapLimit(events, concurrency, processOne);
};
