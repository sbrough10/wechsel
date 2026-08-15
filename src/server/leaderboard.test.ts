import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp } from './app.js'
import type { Database } from './db/client.js'
import { completions, pullRequests } from './db/schema.js'
import { createTestDatabase } from './db/test-utils.js'
import type { LeaderboardResponse } from '../shared/types.js'

describe('leaderboard API', () => {
  let db: Database
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    db = createTestDatabase()
    app = createApp(db)
  })

  const json = <T>(res: Response) => res.json() as Promise<T>

  const postMember = (displayName: string) =>
    app.request('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })

  const removeMember = (id: string, actingId: string) =>
    app.request(`/api/members/${id}`, { method: 'DELETE', headers: { 'x-member-id': actingId } })

  const getLeaderboard = () => app.request('/api/leaderboard')

  const postPr = (memberId: string, number: number, merged = false) => {
    db.insert(pullRequests)
      .values({
        id: `pr_${number}`,
        url: `https://github.com/acme/core/pull/${number}`,
        owner: 'acme',
        repo: 'core',
        number,
        note: null,
        postedBy: memberId,
        reviewersRequired: 1,
        testersRequired: 0,
        mergedAt: merged ? new Date() : null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run()
  }

  const addCredit = (
    memberId: string,
    pullRequestId: string,
    role: 'review' | 'acceptance',
  ) => {
    db.insert(completions)
      .values({
        id: `credit_${memberId}_${pullRequestId}_${role}`,
        pullRequestId,
        memberId,
        role,
        assignmentId: null,
        completedAt: new Date(),
      })
      .run()
  }

  it('includes active members with no credit at count 0', async () => {
    await postMember('Ada')
    await postMember('Grace')

    const res = await getLeaderboard()
    expect(res.status).toBe(200)
    const body = await json<LeaderboardResponse>(res)
    expect(body.reviews).toHaveLength(2)
    for (const row of body.reviews) {
      expect(row).toMatchObject({ count: 0, rank: 1 })
    }
    expect(body.acceptance).toEqual(body.reviews.map((row) => ({ ...row })))
  })

  it('shows a removed member with credit, hides one without', async () => {
    const withCredit = await json<{ id: string }>(await postMember('WithCredit'))
    const withoutCredit = await json<{ id: string }>(await postMember('WithoutCredit'))
    const poster = await json<{ id: string }>(await postMember('Poster'))

    postPr(poster.id, 1)
    addCredit(withCredit.id, 'pr_1', 'review')

    await removeMember(withCredit.id, poster.id)
    await removeMember(withoutCredit.id, poster.id)

    const body = await json<LeaderboardResponse>(await getLeaderboard())
    const reviews = body.reviews.map((row) => row.id)
    expect(reviews).toContain(withCredit.id)
    expect(reviews).not.toContain(withoutCredit.id)

    const removed = body.reviews.find((row) => row.id === withCredit.id)
    expect(removed?.count).toBe(1)
    expect(removed?.removedAt).not.toBeNull()
  })

  it('excludes credit earned on a deleted PR', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const poster = await json<{ id: string }>(await postMember('Poster'))

    postPr(poster.id, 1)
    addCredit(member.id, 'pr_1', 'review')
    addCredit(member.id, 'pr_1', 'acceptance')
    db.update(pullRequests)
      .set({ deletedAt: new Date() })
      .where(eq(pullRequests.id, 'pr_1'))
      .run()

    const body = await json<LeaderboardResponse>(await getLeaderboard())
    const row = body.reviews.find((r) => r.id === member.id)
    expect(row).toMatchObject({ count: 0 })
    const acceptance = body.acceptance.find((r) => r.id === member.id)
    expect(acceptance).toMatchObject({ count: 0 })
  })

  it('counts credit earned on a merged PR', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const poster = await json<{ id: string }>(await postMember('Poster'))

    postPr(poster.id, 1, true)
    addCredit(member.id, 'pr_1', 'review')

    const body = await json<LeaderboardResponse>(await getLeaderboard())
    expect(body.reviews.find((r) => r.id === member.id)).toMatchObject({ count: 1 })
  })

  it('ties share a rank and ordering is count desc then name asc', async () => {
    const zelda = await json<{ id: string }>(await postMember('Zelda'))
    const amy = await json<{ id: string }>(await postMember('Amy'))
    await postMember('Bob')
    const poster = await json<{ id: string }>(await postMember('Poster'))

    postPr(poster.id, 1)
    postPr(poster.id, 2)
    postPr(poster.id, 3)
    addCredit(zelda.id, 'pr_1', 'review')
    addCredit(zelda.id, 'pr_2', 'review')
    addCredit(amy.id, 'pr_1', 'review')
    addCredit(amy.id, 'pr_2', 'review')

    const body = await json<LeaderboardResponse>(await getLeaderboard())
    const reviews = body.reviews
    expect(reviews).toHaveLength(4)
    expect(reviews.map((r) => r.count)).toEqual([2, 2, 0, 0])
    expect(reviews[0]).toMatchObject({ displayName: 'Amy', rank: 1 })
    expect(reviews[1]).toMatchObject({ displayName: 'Zelda', rank: 1 })
    expect(reviews[2]).toMatchObject({ displayName: 'Bob', rank: 3 })
    expect(reviews[3]).toMatchObject({ displayName: 'Poster', rank: 3 })
  })
})
