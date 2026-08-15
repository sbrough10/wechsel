import { createDatabase } from './client.js'
import { assignments, completions, members, pullRequests } from './schema.js'

const now = Date.now()
const hour = 60 * 60 * 1000
const day = 24 * hour

const [ada, grace, linus, alan] = ['ada', 'grace', 'linus', 'alan'].map((key, i) => ({
  id: `member_${key}`,
  displayName: key.charAt(0).toUpperCase() + key.slice(1),
  nameKey: key,
  createdAt: new Date(now - 14 * day + i * hour),
  removedAt: null,
})) as [
  typeof members.$inferInsert,
  typeof members.$inferInsert,
  typeof members.$inferInsert,
  typeof members.$inferInsert,
]

const pr1 = {
  id: 'pr_1',
  url: 'https://github.com/acme-inc/core/pull/42',
  owner: 'acme-inc',
  repo: 'core',
  number: 42,
  note: 'config change only, quick look',
  postedBy: ada.id,
  reviewersRequired: 1,
  testersRequired: 1,
  mergedAt: null,
  deletedAt: null,
  createdAt: new Date(now - 2 * day),
  updatedAt: new Date(now - 2 * day),
}

const pr2 = {
  id: 'pr_2',
  url: 'https://github.com/acme-inc/core/pull/51',
  owner: 'acme-inc',
  repo: 'core',
  number: 51,
  note: 'adds the retry client, touches the hot path',
  postedBy: grace.id,
  reviewersRequired: 2,
  testersRequired: 0,
  mergedAt: null,
  deletedAt: null,
  createdAt: new Date(now - day),
  updatedAt: new Date(now - day),
}

const pr3 = {
  id: 'pr_3',
  url: 'https://github.com/acme-inc/website/pull/7',
  owner: 'acme-inc',
  repo: 'website',
  number: 7,
  note: null,
  postedBy: linus.id,
  reviewersRequired: 1,
  testersRequired: 0,
  mergedAt: new Date(now - 6 * hour),
  deletedAt: null,
  createdAt: new Date(now - 3 * day),
  updatedAt: new Date(now - 6 * hour),
}

const assignment = (
  id: string,
  pullRequestId: string,
  memberId: string,
  role: 'review' | 'acceptance',
  assignedAt: Date,
  completedAt: Date | null,
) => ({ id, pullRequestId, memberId, role, assignedAt, completedAt })

const credit = (
  id: string,
  pullRequestId: string,
  memberId: string,
  role: 'review' | 'acceptance',
  assignmentId: string,
  completedAt: Date,
) => ({ id, pullRequestId, memberId, role, assignmentId, completedAt })

const seededAssignments = [
  assignment(
    'assign_grace_review',
    pr1.id,
    grace.id,
    'review',
    new Date(now - 2 * day),
    new Date(now - day),
  ),
  assignment(
    'assign_linus_acceptance',
    pr1.id,
    linus.id,
    'acceptance',
    new Date(now - 2 * day),
    null,
  ),
  assignment(
    'assign_ada_review',
    pr2.id,
    ada.id,
    'review',
    new Date(now - day),
    new Date(now - 12 * hour),
  ),
  assignment('assign_linus_review', pr2.id, linus.id, 'review', new Date(now - day), null),
  assignment('assign_alan_review', pr2.id, alan.id, 'review', new Date(now - 4 * hour), null),
  assignment(
    'assign_alan_review_pr3',
    pr3.id,
    alan.id,
    'review',
    new Date(now - 3 * day),
    new Date(now - 2 * day),
  ),
]

const seededCompletions = [
  credit(
    'credit_grace_pr1',
    pr1.id,
    grace.id,
    'review',
    'assign_grace_review',
    new Date(now - day),
  ),
  credit(
    'credit_ada_pr2',
    pr2.id,
    ada.id,
    'review',
    'assign_ada_review',
    new Date(now - 12 * hour),
  ),
  credit(
    'credit_alan_pr3',
    pr3.id,
    alan.id,
    'review',
    'assign_alan_review_pr3',
    new Date(now - 2 * day),
  ),
]

const db = createDatabase(process.env.DB_FILE ?? './data/app.db')

db.transaction((tx) => {
  tx.insert(members).values([ada, grace, linus, alan]).run()
  tx.insert(pullRequests).values([pr1, pr2, pr3]).run()
  tx.insert(assignments).values(seededAssignments).run()
  tx.insert(completions).values(seededCompletions).run()
})

console.log(
  `[seed] 4 members, 3 pull requests, ${seededAssignments.length} assignments, ${seededCompletions.length} completion credits`,
)
