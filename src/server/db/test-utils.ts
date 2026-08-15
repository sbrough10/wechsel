import { createDatabase } from './client.js'
import { runMigrations } from './migrate.js'

export function createTestDatabase() {
  const db = createDatabase(':memory:')
  runMigrations(db)
  return db
}
