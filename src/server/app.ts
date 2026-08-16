import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { healthMessage } from '../shared/health.js'
import {
  createAssignmentSchema,
  createMemberSchema,
  createPullRequestSchema,
  updatePullRequestSchema,
} from '../shared/schemas.js'
import type { Database } from './db/client.js'
import type { Member } from './db/schema.js'
import { handleError, validationHook } from './errors.js'
import { actorMiddleware } from './middleware/actor.js'
import {
  assign,
  complete,
  unassign,
  undoComplete,
} from './services/assignments.js'
import { getLeaderboard } from './services/leaderboard.js'
import { findOrCreate, listMembers, removeMember, toMemberView } from './services/members.js'
import {
  createPullRequest,
  listPullRequests,
  mergePullRequest,
  softDeletePullRequest,
  unmergePullRequest,
  updatePullRequest,
} from './services/pull-requests.js'

export type Variables = { member: Member }

export function createApp(db: Database) {
  const app = new Hono<{ Variables: Variables }>()
  app.onError(handleError)

  const routes = app
    .use('/api/members/me', actorMiddleware(db))
    .use('/api/members/:id', actorMiddleware(db))
    .use('/api/pull-requests/:id/merge', actorMiddleware(db))
    .use('/api/pull-requests/:id/assignments', actorMiddleware(db))
    .use('/api/pull-requests/:id', actorMiddleware(db))
    .use('/api/assignments/*', actorMiddleware(db))
    .get('/api/health', (c) => c.json({ ok: true, message: healthMessage }))
    .get('/api/members', async (c) =>
      c.json(await listMembers(db, c.req.query('includeRemoved') === 'true')),
    )
    .post(
      '/api/members',
      zValidator('json', createMemberSchema, validationHook),
      async (c) => c.json(await findOrCreate(db, c.req.valid('json').displayName), 201),
    )
    .get('/api/members/me', (c) => c.json({ member: toMemberView(c.get('member')) }))
    .delete('/api/members/:id', async (c) => c.json(await removeMember(db, c.req.param('id'))))
    .get('/api/pull-requests', async (c) => c.json(await listPullRequests(db)))
    .get('/api/leaderboard', async (c) => c.json(await getLeaderboard(db)))
    .post(
      '/api/pull-requests',
      actorMiddleware(db),
      zValidator('json', createPullRequestSchema, validationHook),
      async (c) => c.json(await createPullRequest(db, c.req.valid('json'), c.get('member').id), 201),
    )
    .patch(
      '/api/pull-requests/:id',
      zValidator('json', updatePullRequestSchema, validationHook),
      async (c) =>
        c.json(
          await updatePullRequest(db, c.req.param('id'), c.req.valid('json'), c.get('member').id),
        ),
    )
    .post(
      '/api/pull-requests/:id/merge',
      async (c) => c.json(await mergePullRequest(db, c.req.param('id'))),
    )
    .delete(
      '/api/pull-requests/:id/merge',
      async (c) => c.json(await unmergePullRequest(db, c.req.param('id'))),
    )
    .delete(
      '/api/pull-requests/:id',
      async (c) => c.json(await softDeletePullRequest(db, c.req.param('id'))),
    )
    .post(
      '/api/pull-requests/:id/assignments',
      zValidator('json', createAssignmentSchema, validationHook),
      async (c) =>
        c.json(
          await assign(db, c.req.param('id'), c.req.valid('json').role, c.get('member').id),
        ),
    )
    .delete('/api/assignments/:id', async (c) =>
      c.json(await unassign(db, c.req.param('id'), c.get('member').id)),
    )
    .post('/api/assignments/:id/completion', async (c) =>
      c.json(await complete(db, c.req.param('id'), c.get('member').id)),
    )
    .delete('/api/assignments/:id/completion', async (c) =>
      c.json(await undoComplete(db, c.req.param('id'), c.get('member').id)),
    )

  return routes
}

export type AppType = ReturnType<typeof createApp>
