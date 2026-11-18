import { logger } from '../logger.js';

// Simulated MySQL client. It builds the same parameterized INSERT that mysql2 would run, so swapping
// in a real database is a one-line change in insertToMySQL:
//   import mysql from 'mysql2/promise';
//   const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5 }); // module scope: reused by warm invocations
//   const [result] = await pool.execute(sql, params); return { insertId: result.insertId };
let autoIncrement = 0;

export const buildInsert = (row) => {
  const columns = Object.keys(row);
  return {
    sql: `INSERT INTO \`Notification\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    params: Object.values(row), // placeholders + params: SQL-injection safe
  };
};

export async function insertToMySQL(row) {
  const { sql, params } = buildInsert(row);
  await new Promise((resolve) => setImmediate(resolve)); // simulate async I/O
  const insertId = ++autoIncrement;
  logger.debug('MySQL insert', { sql, params, insertId });
  return { insertId };
}
