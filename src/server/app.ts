import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { healthMessage } from '../shared/health.js'
import { createMemberSchema } from '../shared/schemas.js'
import type { Database } from './db/client.js'
import type { Member } from './db/schema.js'
import { handleError, validationHook } from './errors.js'
import { actorMiddleware } from './middleware/actor.js'
import { findOrCreate, listMembers, removeMember, toMemberView } from './services/members.js'

export type Variables = { member: Member }

export function createApp(db: Database) {
  const app = new Hono<{ Variables: Variables }>()
  app.onError(handleError)

  const routes = app
    .use('/api/members/me', actorMiddleware(db))
    .use('/api/members/:id', actorMiddleware(db))
    .get('/api/health', (c) => c.json({ ok: true, message: healthMessage }))
    .get('/api/members', (c) =>
      c.json(listMembers(db, c.req.query('includeRemoved') === 'true')),
    )
    .post(
      '/api/members',
      zValidator('json', createMemberSchema, validationHook),
      (c) => c.json(findOrCreate(db, c.req.valid('json').displayName), 201),
    )
    .get('/api/members/me', (c) => c.json({ member: toMemberView(c.get('member')) }))
    .delete('/api/members/:id', (c) => c.json(removeMember(db, c.req.param('id'))))

  return routes
}

export type AppType = ReturnType<typeof createApp>
