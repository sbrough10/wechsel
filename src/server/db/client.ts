import { type BetterSQLite3Database, drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import * as schema from './schema.js'

/**
 * Database type used throughout the application.
 *
 * This is `BetterSQLite3Database` because both better-sqlite3 and D1 produce
 * structurally compatible Drizzle instances. Platform adapters create the
 * appropriate driver and cast to this type:
 *
 * - better-sqlite3 (Node.js, tests): `createSqliteDatabase(sqlite)` — no cast needed
 * - D1 (Cloudflare Workers): `drizzle(d1, { schema }) as unknown as Database`
 */
export type Database = BetterSQLite3Database<typeof schema>

/**
 * Wrap a raw better-sqlite3 instance in Drizzle ORM.
 *
 * Use this in platform adapters (e.g., `platforms/node.ts`) to create a
 * `Database` from a file-based or in-memory better-sqlite3 connection.
 *
 * @example
 * ```ts
 * import Database from 'better-sqlite3'
 * const sqlite = new Database('./data/app.db')
 * const db = createSqliteDatabase(sqlite)
 * const app = createApp(db)
 * ```
 */
export function createSqliteDatabase(sqlite: BetterSqlite3.Database): Database {
  return drizzleBetterSqlite3(sqlite as any, { schema })
}

/**
 * Create an in-memory better-sqlite3 database for tests.
 */
export function createTestDatabase(): Database {
  const BetterSqlite3 = require('better-sqlite3')
  const sqlite = new BetterSqlite3(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return drizzleBetterSqlite3(sqlite, { schema })
}
