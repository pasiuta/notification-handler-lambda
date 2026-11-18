#!/usr/bin/env node
// Local Lambda simulator: reads a JSON file, calls the handler the way Lambda would, prints the result.
// Usage: node app/run.js --input sample/events.json --log-level INFO
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
    'log-level': { type: 'string', default: 'INFO' },
  },
});

if (!args.input) {
  console.error('Usage: node app/run.js --input <events.json> [--log-level DEBUG|INFO|WARN|ERROR]');
  process.exit(1);
}

// The logger reads LOG_LEVEL when it is imported, so set the env first and then import the handler.
process.env.LOG_LEVEL = args['log-level'];

try {
  const { handler } = await import('./handler.js');
  const event = JSON.parse(await readFile(args.input, 'utf8'));
  console.log(JSON.stringify(await handler(event), null, 2));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
