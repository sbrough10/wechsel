import { and, eq, isNull } from 'drizzle-orm'
import { parseGitHubPrUrl } from '../../shared/github-url.js'
import type {
  CreatePullRequestInput,
  UpdatePullRequestInput,
} from '../../shared/schemas.js'
import type {
  AssignmentView,
  PullRequestStatus,
  PullRequestView,
  PullRequestsResponse,
  Role,
} from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { newId } from '../db/id.js'
import { assignments, members, pullRequests, type PullRequest } from '../db/schema.js'
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

export async function getLivePullRequest(db: Database, id: string): Promise<PullRequest> {
  const pr = await db
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

function roleStatesFor(pr: PullRequest, assignmentViews: AssignmentView[]): RolesState {
  const roles: RolesState = {
    review: emptyState(pr.reviewersRequired),
    acceptance: emptyState(pr.testersRequired),
  }
  for (const view of assignmentViews) {
    const state = roles[view.role]
    state.assigned += 1
    if (view.completedAt) state.done += 1
  }
  return roles
}

async function assignmentViewsFor(db: Database, pullRequestId: string): Promise<AssignmentView[]> {
  const rows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.pullRequestId, pullRequestId))
    .all()
  const views: AssignmentView[] = []
  for (const row of rows) {
    const member = await db.select().from(members).where(eq(members.id, row.memberId)).get()
    views.push({
      id: row.id,
      memberId: row.memberId,
      memberName: member?.displayName ?? row.memberId,
      role: row.role as Role,
      assignedAt: row.assignedAt.getTime(),
      completedAt: row.completedAt ? row.completedAt.getTime() : null,
    })
  }
  return views
}

export async function toPullRequestView(db: Database, pr: PullRequest): Promise<PullRequestView> {
  const poster = await db.select().from(members).where(eq(members.id, pr.postedBy)).get()
  const assignmentsForPr = await assignmentViewsFor(db, pr.id)
  const roles = roleStatesFor(pr, assignmentsForPr)
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
    assignments: assignmentsForPr,
  }
}

export async function listPullRequests(db: Database): Promise<PullRequestsResponse> {
  const prRows = await db
    .select()
    .from(pullRequests)
    .where(isNull(pullRequests.deletedAt))
    .orderBy(pullRequests.createdAt)
    .all()

  const open: PullRequestView[] = []
  const merged: PullRequestView[] = []
  for (const pr of prRows) {
    const view = await toPullRequestView(db, pr)
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

export async function createPullRequest(
  db: Database,
  input: CreatePullRequestInput,
  actorId: string,
): Promise<PullRequestView> {
  const parsed = parseGitHubPrUrl(input.url)
  if (!parsed) throw new AppError('invalid_pr_url')

  const existing = await db
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
    await db.insert(pullRequests).values(pr)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError('duplicate_pr')
    }
    throw err
  }

  return toPullRequestView(db, pr)
}

export async function updatePullRequest(
  db: Database,
  id: string,
  input: UpdatePullRequestInput,
  actorId: string,
): Promise<PullRequestView> {
  const pr = await getLivePullRequest(db, id)
  assertPoster(pr, actorId)

  const patch: Partial<PullRequest> = { updatedAt: new Date() }
  if (input.reviewersRequired !== undefined) patch.reviewersRequired = input.reviewersRequired
  if (input.testersRequired !== undefined) patch.testersRequired = input.testersRequired
  if (input.note !== undefined) patch.note = input.note.trim() || null

  await db.update(pullRequests).set(patch).where(eq(pullRequests.id, id))
  return toPullRequestView(db, { ...pr, ...patch })
}

export async function mergePullRequest(db: Database, id: string): Promise<PullRequestView> {
  const pr = await getLivePullRequest(db, id)
  if (pr.mergedAt) return toPullRequestView(db, pr)
  const now = new Date()
  await db.update(pullRequests)
    .set({ mergedAt: now, updatedAt: now })
    .where(eq(pullRequests.id, id))
  return toPullRequestView(db, { ...pr, mergedAt: now, updatedAt: now })
}

export async function unmergePullRequest(db: Database, id: string): Promise<PullRequestView> {
  const pr = await getLivePullRequest(db, id)
  if (!pr.mergedAt) return toPullRequestView(db, pr)
  const now = new Date()
  await db.update(pullRequests)
    .set({ mergedAt: null, updatedAt: now })
    .where(eq(pullRequests.id, id))
  return toPullRequestView(db, { ...pr, mergedAt: null, updatedAt: now })
}

export async function softDeletePullRequest(db: Database, id: string): Promise<PullRequestView> {
  const pr = await getLivePullRequest(db, id)
  const now = new Date()
  await db.update(pullRequests)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(pullRequests.id, id))
  return toPullRequestView(db, { ...pr, deletedAt: now, updatedAt: now })
}

function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message?.toLowerCase() ?? ''
    return msg.includes('unique') || msg.includes('constraint')
  }
  return false
}
