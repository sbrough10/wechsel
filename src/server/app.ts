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
    .get('/api/pull-requests', (c) => c.json(listPullRequests(db)))
    .post(
      '/api/pull-requests',
      actorMiddleware(db),
      zValidator('json', createPullRequestSchema, validationHook),
      (c) => c.json(createPullRequest(db, c.req.valid('json'), c.get('member').id), 201),
    )
    .patch(
      '/api/pull-requests/:id',
      zValidator('json', updatePullRequestSchema, validationHook),
      (c) =>
        c.json(
          updatePullRequest(db, c.req.param('id'), c.req.valid('json'), c.get('member').id),
        ),
    )
    .post(
      '/api/pull-requests/:id/merge',
      (c) => c.json(mergePullRequest(db, c.req.param('id'))),
    )
    .delete(
      '/api/pull-requests/:id/merge',
      (c) => c.json(unmergePullRequest(db, c.req.param('id'))),
    )
    .delete(
      '/api/pull-requests/:id',
      (c) => c.json(softDeletePullRequest(db, c.req.param('id'))),
    )
    .post(
      '/api/pull-requests/:id/assignments',
      zValidator('json', createAssignmentSchema, validationHook),
      (c) =>
        c.json(
          assign(db, c.req.param('id'), c.req.valid('json').role, c.get('member').id),
        ),
    )
    .delete('/api/assignments/:id', (c) =>
      c.json(unassign(db, c.req.param('id'), c.get('member').id)),
    )
    .post('/api/assignments/:id/completion', (c) =>
      c.json(complete(db, c.req.param('id'), c.get('member').id)),
    )
    .delete('/api/assignments/:id/completion', (c) =>
      c.json(undoComplete(db, c.req.param('id'), c.get('member').id)),
    )

  return routes
}

export type AppType = ReturnType<typeof createApp>
