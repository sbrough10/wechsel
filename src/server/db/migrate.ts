import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { Database } from './client.js'
import { createDatabase } from './client.js'

const DEFAULT_MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle')

export function runMigrations(
  db: Database,
  migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER,
): void {
  migrate(db, { migrationsFolder })
}

function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return resolve(entry) === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  const dbFile = process.env.DB_FILE ?? './data/app.db'
  const db = createDatabase(dbFile)
  runMigrations(db)
  console.log(`[migrate] applied pending migrations to ${dbFile}`)
}
