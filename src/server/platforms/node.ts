import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from '../app.js'
import { createSqliteDatabase, type Database } from '../db/client.js'
import { runMigrations } from '../db/migrate.js'

const port = Number(process.env.PORT || 8787)
const dbFile = process.env.DB_FILE || './data/app.db'

async function createDatabase(): Promise<Database> {
  const { default: BetterSqlite3 } = await import('better-sqlite3')
  const sqlite = new BetterSqlite3(dbFile)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return createSqliteDatabase(sqlite)
}

const db = await createDatabase()
runMigrations(db)

const app = createApp(db)

// Serve built client assets in production
app.use('/*', serveStatic({ root: './dist/client' }))

// SPA fallback: unknown non-/api routes serve index.html
app.get('*', serveStatic({ root: './dist/client', path: 'index.html' }))

serve({ fetch: app.fetch, port }, () => {
  console.log(`[wechsel] listening on http://localhost:${port}`)
})
