import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { createDatabase } from './db/client.js'
import { runMigrations } from './db/migrate.js'

const port = Number(process.env.PORT ?? 8787)
const staticDir = process.env.STATIC_DIR ?? './dist/client'

const db = createDatabase(process.env.DB_FILE ?? './data/app.db')
runMigrations(db)

const app = createApp(db)

const notFoundJson = () =>
  new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })

if (existsSync(staticDir)) {
  app.use('*', serveStatic({ root: staticDir }))
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api')) {
      return notFoundJson()
    }
    const serveIndexHtml = serveStatic({ root: staticDir, path: 'index.html' })
    const res = await serveIndexHtml(c, async () => undefined)
    return res ?? notFoundJson()
  })
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] Wechsel API listening on http://localhost:${info.port}`)
})
