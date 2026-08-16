import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTestDatabase as createTestDatabaseRaw } from './client.js'

const MIGRATION_FILE = resolve(process.cwd(), 'drizzle/0000_chunky_outlaw_kid.sql')

export function createTestDatabase() {
  const db = createTestDatabaseRaw()
  const sql = readFileSync(MIGRATION_FILE, 'utf-8')
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    db.run(stmt)
  }
  return db
}
