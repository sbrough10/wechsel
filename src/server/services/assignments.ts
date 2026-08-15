import { SqliteError } from 'better-sqlite3'
import { and, eq } from 'drizzle-orm'
import type { Role } from '../../shared/types.js'
import type { PullRequestView } from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { newId } from '../db/id.js'
import { assignments, completions, type Assignment } from '../db/schema.js'
import { AppError } from '../errors.js'
import { getLivePullRequest, toPullRequestView } from './pull-requests.js'

function getAssignment(db: Database, id: string): Assignment {
  const row = db.select().from(assignments).where(eq(assignments.id, id)).get()
  if (!row) throw new AppError('not_found', 'That assignment no longer exists.')
  return row
}

function assertAssignee(assignment: Assignment, actorId: string): void {
  if (assignment.memberId !== actorId) throw new AppError('not_assignee')
}

export function assign(
  db: Database,
  pullRequestId: string,
  role: Role,
  actorId: string,
): PullRequestView {
  const pr = getLivePullRequest(db, pullRequestId)
  if (pr.mergedAt) throw new AppError('already_merged')
  if (pr.postedBy === actorId) throw new AppError('self_assign_forbidden')

  const existing = db
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
    db.insert(assignments)
      .values({
        id: newId(),
        pullRequestId,
        memberId: actorId,
        role,
        assignedAt: new Date(),
        completedAt: null,
      })
      .run()
  } catch (err) {
    if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return toPullRequestView(db, pr)
    }
    throw err
  }

  return toPullRequestView(db, pr)
}

export function unassign(
  db: Database,
  assignmentId: string,
  actorId: string,
): PullRequestView {
  const assignment = getAssignment(db, assignmentId)
  const pr = getLivePullRequest(db, assignment.pullRequestId)
  if (assignment.memberId !== actorId && pr.postedBy !== actorId) {
    throw new AppError('not_assignee')
  }

  db.delete(assignments).where(eq(assignments.id, assignmentId)).run()
  return toPullRequestView(db, pr)
}

export function complete(db: Database, assignmentId: string, actorId: string): PullRequestView {
  const assignment = getAssignment(db, assignmentId)
  const pr = getLivePullRequest(db, assignment.pullRequestId)
  assertAssignee(assignment, actorId)
  if (assignment.completedAt) return toPullRequestView(db, pr)

  const now = new Date()
  db.transaction((tx) => {
    tx.update(assignments)
      .set({ completedAt: now })
      .where(eq(assignments.id, assignmentId))
      .run()
    tx.insert(completions)
      .values({
        id: newId(),
        pullRequestId: assignment.pullRequestId,
        memberId: assignment.memberId,
        role: assignment.role,
        assignmentId,
        completedAt: now,
      })
      .run()
  })

  return toPullRequestView(db, pr)
}

export function undoComplete(
  db: Database,
  assignmentId: string,
  actorId: string,
): PullRequestView {
  const assignment = getAssignment(db, assignmentId)
  const pr = getLivePullRequest(db, assignment.pullRequestId)
  assertAssignee(assignment, actorId)
  if (!assignment.completedAt) return toPullRequestView(db, pr)

  db.transaction((tx) => {
    tx.update(assignments)
      .set({ completedAt: null })
      .where(eq(assignments.id, assignmentId))
      .run()
    tx.delete(completions).where(eq(completions.assignmentId, assignmentId)).run()
  })

  return toPullRequestView(db, pr)
}
