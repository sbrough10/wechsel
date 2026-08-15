import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { runMigrations } from './migrate.js'
import { assignments, members, pullRequests } from './schema.js'
import { createTestDatabase } from './test-utils.js'

function member(id: string, name: string) {
  return {
    id,
    displayName: name,
    nameKey: name.toLowerCase(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    removedAt: null,
  }
}

function pr(
  id: string,
  url: string,
  postedBy: string,
  overrides: Partial<typeof pullRequests.$inferInsert> = {},
) {
  return {
    id,
    url,
    owner: 'acme-inc',
    repo: 'core',
    number: 42,
    note: null,
    postedBy,
    reviewersRequired: 1,
    testersRequired: 0,
    mergedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
}

describe('database schema', () => {
  it('migrates a fresh in-memory database and accepts a basic write', () => {
    const db = createTestDatabase()
    db.insert(members).values(member('m1', 'Ada')).run()
    expect(() =>
      db
        .insert(pullRequests)
        .values(pr('pr1', 'https://github.com/a/b/pull/1', 'm1'))
        .run(),
    ).not.toThrow()
  })

  it('rejects a duplicate live URL but allows it after soft deletion', () => {
    const db = createTestDatabase()
    db.insert(members).values(member('m1', 'Ada')).run()
    db.insert(pullRequests)
      .values(pr('pr1', 'https://github.com/a/b/pull/1', 'm1'))
      .run()

    expect(() =>
      db
        .insert(pullRequests)
        .values(pr('pr2', 'https://github.com/a/b/pull/1', 'm1'))
        .run(),
    ).toThrow()

    db.update(pullRequests)
      .set({ deletedAt: new Date('2026-01-03T00:00:00Z') })
      .where(eq(pullRequests.id, 'pr1'))
      .run()

    expect(() =>
      db
        .insert(pullRequests)
        .values(pr('pr3', 'https://github.com/a/b/pull/1', 'm1'))
        .run(),
    ).not.toThrow()
  })

  it('enforces the requirement range checks', () => {
    const db = createTestDatabase()
    db.insert(members).values(member('m1', 'Ada')).run()

    expect(() =>
      db
        .insert(pullRequests)
        .values(pr('pr1', 'https://github.com/a/b/pull/1', 'm1', { reviewersRequired: 11 }))
        .run(),
    ).toThrow()

    expect(() =>
      db
        .insert(pullRequests)
        .values(pr('pr2', 'https://github.com/a/b/pull/2', 'm1', { testersRequired: -1 }))
        .run(),
    ).toThrow()
  })

  it('enforces the role check on assignments', () => {
    const db = createTestDatabase()
    db.insert(members).values(member('m1', 'Ada')).run()
    db.insert(members).values(member('m2', 'Grace')).run()
    db.insert(pullRequests)
      .values(pr('pr1', 'https://github.com/a/b/pull/1', 'm1'))
      .run()

    expect(() =>
      db
        .insert(assignments)
        .values({
          id: 'a1',
          pullRequestId: 'pr1',
          memberId: 'm2',
          role: 'typo',
          assignedAt: new Date(),
        })
        .run(),
    ).toThrow()
  })

  it('is idempotent when migrations are re-run', () => {
    const db = createTestDatabase()
    expect(() => runMigrations(db)).not.toThrow()
  })
})
