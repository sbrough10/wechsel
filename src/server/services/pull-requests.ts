import { SqliteError } from 'better-sqlite3'
import { and, eq, isNull } from 'drizzle-orm'
import { parseGitHubPrUrl } from '../../shared/github-url.js'
import type {
  CreatePullRequestInput,
  UpdatePullRequestInput,
} from '../../shared/schemas.js'
import type {
  PullRequestStatus,
  PullRequestView,
  PullRequestsResponse,
} from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { newId } from '../db/id.js'
import {
  assignments,
  members,
  pullRequests,
  type PullRequest,
  type Role,
} from '../db/schema.js'
import { AppError } from '../errors.js'

interface RoleState {
  required: number
  assigned: number
  done: number
}

interface RolesState {
  review: RoleState
  acceptance: RoleState
}

const emptyState = (required: number): RoleState => ({ required, assigned: 0, done: 0 })

function deriveStatus(mergedAt: Date | null, roles: RolesState): PullRequestStatus {
  if (mergedAt) return 'merged'
  const needsVolunteers = (role: RoleState) => role.assigned < role.required
  if (needsVolunteers(roles.review) || needsVolunteers(roles.acceptance)) {
    return 'needs_volunteers'
  }
  const allDone = (role: RoleState) => role.required === 0 || role.done >= role.required
  if (allDone(roles.review) && allDone(roles.acceptance)) return 'ready'
  return 'in_progress'
}

const statusRank: Record<PullRequestStatus, number> = {
  needs_volunteers: 0,
  in_progress: 1,
  ready: 2,
  merged: 3,
}

export function getLivePullRequest(db: Database, id: string): PullRequest {
  const pr = db
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.id, id), isNull(pullRequests.deletedAt)))
    .get()
  if (!pr) throw new AppError('not_found')
  return pr
}

function assertPoster(pr: PullRequest, actorId: string): void {
  if (pr.postedBy !== actorId) throw new AppError('not_poster')
}

function roleStatesFor(db: Database, pr: PullRequest): RolesState {
  const roles: RolesState = {
    review: emptyState(pr.reviewersRequired),
    acceptance: emptyState(pr.testersRequired),
  }
  const rows = db
    .select({ role: assignments.role, completedAt: assignments.completedAt })
    .from(assignments)
    .where(eq(assignments.pullRequestId, pr.id))
    .all()
  for (const row of rows) {
    const state = roles[row.role as Role]
    state.assigned += 1
    if (row.completedAt) state.done += 1
  }
  return roles
}

export function toPullRequestView(db: Database, pr: PullRequest): PullRequestView {
  const poster = db.select().from(members).where(eq(members.id, pr.postedBy)).get()
  const roles = roleStatesFor(db, pr)
  return {
    id: pr.id,
    url: pr.url,
    owner: pr.owner,
    repo: pr.repo,
    number: pr.number,
    note: pr.note,
    postedBy: pr.postedBy,
    postedByName: poster?.displayName ?? pr.postedBy,
    reviewersRequired: pr.reviewersRequired,
    testersRequired: pr.testersRequired,
    mergedAt: pr.mergedAt ? pr.mergedAt.getTime() : null,
    createdAt: pr.createdAt.getTime(),
    updatedAt: pr.updatedAt.getTime(),
    status: deriveStatus(pr.mergedAt, roles),
  }
}

export function listPullRequests(db: Database): PullRequestsResponse {
  const prRows = db
    .select()
    .from(pullRequests)
    .where(isNull(pullRequests.deletedAt))
    .orderBy(pullRequests.createdAt)
    .all()

  const open: PullRequestView[] = []
  const merged: PullRequestView[] = []
  for (const pr of prRows) {
    const view = toPullRequestView(db, pr)
    if (view.mergedAt) {
      merged.push(view)
    } else {
      open.push(view)
    }
  }

  open.sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.createdAt - b.createdAt)
  merged.sort(
    (a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0) || b.createdAt - a.createdAt,
  )

  return { open, merged }
}

export function createPullRequest(
  db: Database,
  input: CreatePullRequestInput,
  actorId: string,
): PullRequestView {
  const parsed = parseGitHubPrUrl(input.url)
  if (!parsed) throw new AppError('invalid_pr_url')

  const existing = db
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.url, parsed.canonicalUrl), isNull(pullRequests.deletedAt)))
    .get()
  if (existing) throw new AppError('duplicate_pr')

  const now = new Date()
  const pr: PullRequest = {
    id: newId(),
    url: parsed.canonicalUrl,
    owner: parsed.owner,
    repo: parsed.repo,
    number: parsed.number,
    note: input.note?.trim() || null,
    postedBy: actorId,
    reviewersRequired: input.reviewersRequired,
    testersRequired: input.testersRequired,
    mergedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    db.insert(pullRequests).values(pr).run()
  } catch (err) {
    if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AppError('duplicate_pr')
    }
    throw err
  }

  return toPullRequestView(db, pr)
}

export function updatePullRequest(
  db: Database,
  id: string,
  input: UpdatePullRequestInput,
  actorId: string,
): PullRequestView {
  const pr = getLivePullRequest(db, id)
  assertPoster(pr, actorId)

  const patch: Partial<PullRequest> = { updatedAt: new Date() }
  if (input.reviewersRequired !== undefined) patch.reviewersRequired = input.reviewersRequired
  if (input.testersRequired !== undefined) patch.testersRequired = input.testersRequired
  if (input.note !== undefined) patch.note = input.note.trim() || null

  db.update(pullRequests).set(patch).where(eq(pullRequests.id, id)).run()
  return toPullRequestView(db, { ...pr, ...patch })
}

export function mergePullRequest(db: Database, id: string): PullRequestView {
  const pr = getLivePullRequest(db, id)
  if (pr.mergedAt) return toPullRequestView(db, pr)
  const now = new Date()
  db.update(pullRequests)
    .set({ mergedAt: now, updatedAt: now })
    .where(eq(pullRequests.id, id))
    .run()
  return toPullRequestView(db, { ...pr, mergedAt: now, updatedAt: now })
}

export function unmergePullRequest(db: Database, id: string): PullRequestView {
  const pr = getLivePullRequest(db, id)
  if (!pr.mergedAt) return toPullRequestView(db, pr)
  const now = new Date()
  db.update(pullRequests)
    .set({ mergedAt: null, updatedAt: now })
    .where(eq(pullRequests.id, id))
    .run()
  return toPullRequestView(db, { ...pr, mergedAt: null, updatedAt: now })
}

export function softDeletePullRequest(db: Database, id: string): PullRequestView {
  const pr = getLivePullRequest(db, id)
  const now = new Date()
  db.update(pullRequests)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(pullRequests.id, id))
    .run()
  return toPullRequestView(db, { ...pr, deletedAt: now, updatedAt: now })
}
