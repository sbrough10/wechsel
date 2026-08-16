/// <reference types="@cloudflare/workers-types" />
import { drizzle } from 'drizzle-orm/d1'
import { createApp } from '../app.js'
import { type Database } from '../db/client.js'
import * as schema from '../db/schema.js'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const db = drizzle(env.DB, { schema }) as unknown as Database
    return createApp(db).fetch(request, env, ctx)
  },
}
