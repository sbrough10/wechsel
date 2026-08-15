import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const ROLES = ['review', 'acceptance'] as const
export type Role = (typeof ROLES)[number]

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  removedAt: integer('removed_at', { mode: 'timestamp_ms' }),
})

export const pullRequests = sqliteTable(
  'pull_requests',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    number: integer('number').notNull(),
    note: text('note'),
    postedBy: text('posted_by')
      .notNull()
      .references(() => members.id),
    reviewersRequired: integer('reviewers_required').notNull().default(1),
    testersRequired: integer('testers_required').notNull().default(0),
    mergedAt: integer('merged_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'pull_requests_reviewers_required_range',
      sql`${table.reviewersRequired} BETWEEN 0 AND 10`,
    ),
    check('pull_requests_testers_required_range', sql`${table.testersRequired} BETWEEN 0 AND 10`),
    uniqueIndex('pull_requests_live_url')
      .on(table.url)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const assignments = sqliteTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    pullRequestId: text('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    role: text('role').notNull(),
    assignedAt: integer('assigned_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    check('assignments_role_valid', sql`${table.role} IN ('review', 'acceptance')`),
    uniqueIndex('assignments_one_per_role').on(table.pullRequestId, table.memberId, table.role),
    index('assignments_by_pr').on(table.pullRequestId),
  ],
)

export const completions = sqliteTable(
  'completions',
  {
    id: text('id').primaryKey(),
    pullRequestId: text('pull_request_id')
      .notNull()
      .references(() => pullRequests.id),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    role: text('role').notNull(),
    assignmentId: text('assignment_id').references(() => assignments.id, {
      onDelete: 'set null',
    }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('completions_role_valid', sql`${table.role} IN ('review', 'acceptance')`),
    index('completions_by_member_role').on(table.memberId, table.role),
    index('completions_by_pr').on(table.pullRequestId),
  ],
)

export type Member = typeof members.$inferSelect
export type PullRequest = typeof pullRequests.$inferSelect
export type Assignment = typeof assignments.$inferSelect
export type Completion = typeof completions.$inferSelect
