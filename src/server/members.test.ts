import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import type { Database } from './db/client.js'
import { assignments, completions, pullRequests } from './db/schema.js'
import { createTestDatabase } from './db/test-utils.js'

describe('members API', () => {
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

  it('creates a member', async () => {
    const res = await postMember('Sam')
    expect(res.status).toBe(201)
    const body = await json<{ id: string; displayName: string; nameKey: string; removedAt: null; createdAt: number }>(res)
    expect(body).toMatchObject({ displayName: 'Sam', nameKey: 'sam', removedAt: null })
    expect(typeof body.id).toBe('string')
    expect(typeof body.createdAt).toBe('number')
  })

  it('creating an existing name returns the same member', async () => {
    const first = await json<{ id: string }>(await postMember('Sam'))
    const second = await json<{ id: string }>(await postMember('Sam'))
    expect(second.id).toBe(first.id)
  })

  it('case and whitespace variants collide', async () => {
    const first = await json<{ id: string }>(await postMember('  Sam  '))
    const second = await json<{ id: string }>(await postMember('sam'))
    expect(second.id).toBe(first.id)
  })

  it('re-adding a removed name reactivates it', async () => {
    const first = await json<{ id: string }>(await postMember('Sam'))
    const removeRes = await removeMember(first.id, first.id)
    expect(removeRes.status).toBe(200)

    const reactivated = await json<{ id: string; removedAt: number | null }>(
      await postMember('Sam'),
    )
    expect(reactivated.id).toBe(first.id)
    expect(reactivated.removedAt).toBeNull()
  })

  it('rejects a blank name with validation_failed', async () => {
    const res = await postMember('   ')
    expect(res.status).toBe(400)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('validation_failed')
  })

  it('rejects a name longer than 40 characters', async () => {
    const res = await postMember('x'.repeat(41))
    expect(res.status).toBe(400)
  })

  it('unknown x-member-id gives 401 unknown_member', async () => {
    const res = await app.request('/api/members/me', { headers: { 'x-member-id': 'nope' } })
    expect(res.status).toBe(401)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('unknown_member')
  })

  it('GET /api/members/me returns the acting member', async () => {
    const created = await json<{ id: string }>(await postMember('Sam'))
    const res = await app.request('/api/members/me', { headers: { 'x-member-id': created.id } })
    expect(res.status).toBe(200)
    expect((await json<{ member: { id: string } }>(res)).member.id).toBe(created.id)
  })

  it('lists only active members unless includeRemoved=true', async () => {
    const sam = await json<{ id: string }>(await postMember('Sam'))
    await postMember('Grace')
    await removeMember(sam.id, sam.id)

    const active = await json<{ id: string }[]>(await app.request('/api/members'))
    expect(active.map((m) => m.id)).not.toContain(sam.id)

    const all = await json<{ id: string; removedAt: number | null }[]>(
      await app.request('/api/members?includeRemoved=true'),
    )
    expect(all.map((m) => m.id)).toContain(sam.id)
    expect(all.find((m) => m.id === sam.id)?.removedAt).not.toBeNull()
  })

  it('removing a member drops their assignments but keeps completions', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))

    db.insert(pullRequests)
      .values({
        id: 'pr1',
        url: 'https://github.com/a/b/pull/1',
        owner: 'a',
        repo: 'b',
        number: 1,
        note: null,
        postedBy: poster.id,
        reviewersRequired: 1,
        testersRequired: 0,
        mergedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run()
    db.insert(assignments)
      .values({
        id: 'a1',
        pullRequestId: 'pr1',
        memberId: volunteer.id,
        role: 'review',
        assignedAt: new Date(),
        completedAt: new Date(),
      })
      .run()
    db.insert(completions)
      .values({
        id: 'c1',
        pullRequestId: 'pr1',
        memberId: volunteer.id,
        role: 'review',
        assignmentId: 'a1',
        completedAt: new Date(),
      })
      .run()

    const res = await removeMember(volunteer.id, poster.id)
    expect(res.status).toBe(200)

    expect(db.select().from(assignments).all()).toHaveLength(0)
    const remainingCompletions = db.select().from(completions).all()
    expect(remainingCompletions).toHaveLength(1)
    expect(remainingCompletions[0]).toMatchObject({ memberId: volunteer.id })
  })

  it('removing an unknown member gives not_found', async () => {
    const actor = await json<{ id: string }>(await postMember('Sam'))
    const res = await removeMember('does-not-exist', actor.id)
    expect(res.status).toBe(404)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_found')
  })

  it('a removed identity can no longer act', async () => {
    const me = await json<{ id: string }>(await postMember('Me'))
    await removeMember(me.id, me.id)
    const res = await app.request('/api/members/me', { headers: { 'x-member-id': me.id } })
    expect(res.status).toBe(401)
  })
})
