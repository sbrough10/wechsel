import { and, eq } from 'drizzle-orm'
import type { Role } from '../../shared/types.js'
import type { PullRequestView } from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { newId } from '../db/id.js'
import { assignments, completions, type Assignment } from '../db/schema.js'
import { AppError } from '../errors.js'
import { getLivePullRequest, toPullRequestView } from './pull-requests.js'

async function getAssignment(db: Database, id: string): Promise<Assignment> {
  const row = await db.select().from(assignments).where(eq(assignments.id, id)).get()
  if (!row) throw new AppError('not_found', 'That assignment no longer exists.')
  return row
}

function assertAssignee(assignment: Assignment, actorId: string): void {
  if (assignment.memberId !== actorId) throw new AppError('not_assignee')
}

export async function assign(
  db: Database,
  pullRequestId: string,
  role: Role,
  actorId: string,
): Promise<PullRequestView> {
  const pr = await getLivePullRequest(db, pullRequestId)
  if (pr.mergedAt) throw new AppError('already_merged')
  if (pr.postedBy === actorId) throw new AppError('self_assign_forbidden')

  const existing = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.pullRequestId, pullRequestId),
        eq(assignments.memberId, actorId),
        eq(assignments.role, role),
      ),
    )
    .get()
  if (existing) return toPullRequestView(db, pr)

  try {
    await db.insert(assignments)
      .values({
        id: newId(),
        pullRequestId,
        memberId: actorId,
        role,
        assignedAt: new Date(),
        completedAt: null,
      })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return toPullRequestView(db, pr)
    }
    throw err
  }

  return toPullRequestView(db, pr)
}

export async function unassign(
  db: Database,
  assignmentId: string,
  actorId: string,
): Promise<PullRequestView> {
  const assignment = await getAssignment(db, assignmentId)
  const pr = await getLivePullRequest(db, assignment.pullRequestId)
  if (assignment.memberId !== actorId && pr.postedBy !== actorId) {
    throw new AppError('not_assignee')
  }

  await db.delete(assignments).where(eq(assignments.id, assignmentId))
  return toPullRequestView(db, pr)
}

export async function complete(db: Database, assignmentId: string, actorId: string): Promise<PullRequestView> {
  const assignment = await getAssignment(db, assignmentId)
  const pr = await getLivePullRequest(db, assignment.pullRequestId)
  assertAssignee(assignment, actorId)
  if (assignment.completedAt) return toPullRequestView(db, pr)

  const now = new Date()
  await db.update(assignments)
    .set({ completedAt: now })
    .where(eq(assignments.id, assignmentId))
  await db.insert(completions)
    .values({
      id: newId(),
      pullRequestId: assignment.pullRequestId,
      memberId: assignment.memberId,
      role: assignment.role,
      assignmentId,
      completedAt: now,
    })

  return toPullRequestView(db, pr)
}

export async function undoComplete(
  db: Database,
  assignmentId: string,
  actorId: string,
): Promise<PullRequestView> {
  const assignment = await getAssignment(db, assignmentId)
  const pr = await getLivePullRequest(db, assignment.pullRequestId)
  assertAssignee(assignment, actorId)
  if (!assignment.completedAt) return toPullRequestView(db, pr)

  await db.update(assignments)
    .set({ completedAt: null })
    .where(eq(assignments.id, assignmentId))
  await db.delete(completions).where(eq(completions.assignmentId, assignmentId))

  return toPullRequestView(db, pr)
}

function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message?.toLowerCase() ?? ''
    return msg.includes('unique') || msg.includes('constraint')
  }
  return false
}
