const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('WARNING: DATABASE_URL is not set. Database calls will fail.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && !/localhost|127\.0\.0\.1/.test(connectionString)
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000
});

let initPromise = null;

async function ensureSchema() {
  if (!initPromise) {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    initPromise = pool.query(sql).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function query(text, params) {
  await ensureSchema();
  return pool.query(text, params);
}

async function one(text, params) {
  const r = await query(text, params);
  return r.rows[0] || null;
}

async function many(text, params) {
  const r = await query(text, params);
  return r.rows;
}

module.exports = { pool, query, one, many, ensureSchema };
