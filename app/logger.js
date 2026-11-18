// Minimal structured JSON logger (CloudWatch Logs Insights can query the fields).
// Logs go to stderr, so stdout carries only the function result.
const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

const write = (level) => (msg, meta = {}) => {
  if (LEVELS[level] < threshold) return;
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta })}\n`);
};

export const logger = {
  debug: write('DEBUG'),
  info: write('INFO'),
  warn: write('WARN'),
  error: write('ERROR'),
};
