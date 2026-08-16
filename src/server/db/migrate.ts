import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from './client.js'

const MIGRATION_FILE = resolve(process.cwd(), 'drizzle/0000_chunky_outlaw_kid.sql')

export function runMigrations(db: Database) {
  const sql = readFileSync(MIGRATION_FILE, 'utf-8')
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    const idempotent = stmt
      .replace(/CREATE TABLE `(\w+)`/g, 'CREATE TABLE IF NOT EXISTS `$1`')
      .replace(/CREATE UNIQUE INDEX `(\w+)`/g, 'CREATE UNIQUE INDEX IF NOT EXISTS `$1`')
      .replace(/CREATE INDEX `(\w+)`/g, 'CREATE INDEX IF NOT EXISTS `$1`')
    db.run(idempotent)
  }
}
