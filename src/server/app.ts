import { Hono } from 'hono'
import { healthMessage } from '../shared/health.js'

const app = new Hono()

const routes = app.get('/api/health', (c) =>
  c.json({ ok: true, message: healthMessage }),
)

export { app }
export type AppType = typeof routes
