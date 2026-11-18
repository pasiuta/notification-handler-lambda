// Single source of configuration, driven by environment variables (12-factor).
const int = (value, fallback) => Number.parseInt(value ?? '', 10) || fallback;

export const config = Object.freeze({
  // Max parallel DB writes per invocation. Keep it at or below the MySQL connection pool size.
  dbConcurrency: int(process.env.DB_CONCURRENCY, 5),
});
