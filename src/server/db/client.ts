import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

export type Database = ReturnType<typeof createDatabase>

export function createDatabase(dbFile: string) {
  if (dbFile !== ':memory:') {
    mkdirSync(dirname(resolve(dbFile)), { recursive: true })
  }
  const sqlite = new Database(dbFile)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return drizzle(sqlite, { schema })
}
