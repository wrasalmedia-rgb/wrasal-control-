// Persistence port.
//
// The rest of WRASAL talks to this interface only. V0.1 ships one adapter
// (PGlite — embedded PostgreSQL) so the substrate runs with no server. Swapping
// to a hosted Postgres means adding an adapter here and nothing else: the SQL
// in schema.sql and in every module above this line is standard Postgres.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, 'schema.sql');

/**
 * @typedef {Object} Database
 * @property {(sql: string, params?: unknown[]) => Promise<{rows: any[]}>} query
 * @property {(fn: (tx: Database) => Promise<any>) => Promise<any>} transaction
 * @property {() => Promise<void>} close
 */

/** Create a PGlite-backed Database. `dataDir` null => in-memory. */
export async function createDatabase({ dataDir = null } = {}) {
  const pg = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  return wrap(pg);
}

function wrap(pg) {
  return {
    raw: pg,
    async query(sql, params = []) {
      return pg.query(sql, params);
    },
    async transaction(fn) {
      return pg.transaction(async (tx) => fn({
        raw: pg,
        query: (sql, params = []) => tx.query(sql, params),
        transaction: (inner) => inner({ query: (s, p = []) => tx.query(s, p) }),
        close: async () => {},
      }));
    },
    async close() {
      await pg.close();
    },
  };
}

/** Apply the schema. Idempotent guard: skips if `entities` already exists. */
export async function migrate(db) {
  const existing = await db.query(
    `SELECT to_regclass('public.entities') AS t`,
  );
  if (existing.rows[0].t) return { applied: false };
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await db.raw.exec(sql);
  return { applied: true };
}

/** Deterministic-ish id generator in the record-id style used across WRASAL. */
let counter = 0;
export function id(prefix) {
  counter += 1;
  const stamp = Date.now().toString(36);
  const seq = counter.toString(36).padStart(3, '0');
  return `${prefix}_${stamp}${seq}`;
}
