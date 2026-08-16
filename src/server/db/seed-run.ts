import { createTestDatabase } from './client.js'
import { runMigrations } from './migrate.js'
import { seed } from './seed.js'

const db = createTestDatabase()
runMigrations(db)
await seed(db)
