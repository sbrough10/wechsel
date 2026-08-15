import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createDatabase } from './db/client.js'
import { runMigrations } from './db/migrate.js'

const port = Number(process.env.PORT ?? 8787)

const db = createDatabase(process.env.DB_FILE ?? './data/app.db')
runMigrations(db)

serve({ fetch: createApp(db).fetch, port }, (info) => {
  console.log(`[server] Wechsel API listening on http://localhost:${info.port}`)
})
