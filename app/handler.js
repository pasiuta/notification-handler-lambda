import { config } from './config.js';
import { logger } from './logger.js';
import { eventTypes } from './events/index.js';
import { insertToMySQL } from './db/mysql.js';
import { extractEvents } from './core/source.js';
import { createProcessor } from './core/processor.js';

// Wired once per Lambda container (cold start) and reused by warm invocations.
const processEvents = createProcessor({
  eventTypes,
  insert: insertToMySQL,
  logger,
  concurrency: config.dbConcurrency,
});

const countBy = (results) =>
  results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), { total: results.length });

/**
 * Lambda entry point.
 * Input: an array of events or { events: [...] }.
 * Output: { summary, results } with one result per input event, in input order.
 */
export const handler = async (event) => {
  const started = performance.now();
  const results = await processEvents(extractEvents(event));
  const summary = countBy(results);

  logger.info('Batch processed', { ...summary, durationMs: Math.round(performance.now() - started) });
  return { summary, results };
};
