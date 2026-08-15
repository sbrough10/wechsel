import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import type { Database } from './db/client.js'
import { completions } from './db/schema.js'
import { createTestDatabase } from './db/test-utils.js'
import type { PullRequestView, PullRequestsResponse } from '../shared/types.js'

describe('assignments API', () => {
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

  const postPr = (url: string, actorId: string) =>
    app.request('/api/pull-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-member-id': actorId },
      body: JSON.stringify({ url, reviewersRequired: 1, testersRequired: 0 }),
    })

  const postPrFull = (body: Record<string, unknown>, actorId: string) =>
    app.request('/api/pull-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-member-id': actorId },
      body: JSON.stringify(body),
    })

  const assignRoute = (prId: string, role: string, actorId: string) =>
    app.request(`/api/pull-requests/${prId}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-member-id': actorId },
      body: JSON.stringify({ role }),
    })

  const unassignRoute = (assignmentId: string, actorId: string) =>
    app.request(`/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { 'x-member-id': actorId },
    })

  const completeRoute = (assignmentId: string, actorId: string) =>
    app.request(`/api/assignments/${assignmentId}/completion`, {
      method: 'POST',
      headers: { 'x-member-id': actorId },
    })

  const undoRoute = (assignmentId: string, actorId: string) =>
    app.request(`/api/assignments/${assignmentId}/completion`, {
      method: 'DELETE',
      headers: { 'x-member-id': actorId },
    })

  const getPr = async (id: string) => {
    const list = await json<PullRequestsResponse>(await app.request('/api/pull-requests'))
    return [...list.open, ...list.merged].find((p) => p.id === id)
  }

  const openPr = async (pr: PullRequestView) => {
    const view = await getPr(pr.id)
    if (!view) throw new Error(`PR ${pr.id} not found in list`)
    return view
  }

  const countCredits = () => db.select().from(completions).all()

  const firstAssignment = (view: PullRequestView) => {
    const assignment = view.assignments[0]
    if (!assignment) throw new Error('expected an assignment')
    return assignment
  }

  const assignmentFor = (view: PullRequestView, memberId: string) => {
    const assignment = view.assignments.find((a) => a.memberId === memberId)
    if (!assignment) throw new Error('expected an assignment for that member')
    return assignment
  }

  const firstCredit = () => {
    const credit = countCredits()[0]
    if (!credit) throw new Error('expected a credit')
    return credit
  }

  it('poster cannot self-assign either role', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const pr = await json<PullRequestView>(
      await postPrFull(
        { url: 'https://github.com/a/b/pull/1', reviewersRequired: 1, testersRequired: 1 },
        poster.id,
      ),
    )

    for (const role of ['review', 'acceptance'] as const) {
      const res = await assignRoute(pr.id, role, poster.id)
      expect(res.status).toBe(403)
      expect((await json<{ error: { code: string } }>(res)).error.code).toBe(
        'self_assign_forbidden',
      )
    }
  })

  it('a non-poster can hold both roles', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const other = await json<{ id: string }>(await postMember('Other'))
    const pr = await json<PullRequestView>(
      await postPrFull(
        { url: 'https://github.com/a/b/pull/1', reviewersRequired: 1, testersRequired: 1 },
        poster.id,
      ),
    )

    const review = await assignRoute(pr.id, 'review', other.id)
    expect(review.status).toBe(200)
    const acceptance = await assignRoute(pr.id, 'acceptance', other.id)
    expect(acceptance.status).toBe(200)

    const view = await openPr(pr)
    expect(view.assignments).toHaveLength(2)
    expect(view.assignments.map((a) => a.role).sort()).toEqual(['acceptance', 'review'])
    expect(view.assignments.every((a) => a.memberId === other.id)).toBe(true)
  })

  it('double-assign is idempotent', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const other = await json<{ id: string }>(await postMember('Other'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )

    const first = await assignRoute(pr.id, 'review', other.id)
    expect(first.status).toBe(200)
    const firstBody = await json<PullRequestView>(first)
    const second = await assignRoute(pr.id, 'review', other.id)
    expect(second.status).toBe(200)

    const view = await openPr(pr)
    expect(view.assignments.filter((a) => a.role === 'review')).toHaveLength(1)
    expect(firstBody.assignments).toEqual(view.assignments)
  })

  it('assigning with no identity gives unknown_member', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const res = await app.request(`/api/pull-requests/${pr.id}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'review' }),
    })
    expect(res.status).toBe(401)
  })

  it('assigning to an unknown PR gives not_found', async () => {
    const other = await json<{ id: string }>(await postMember('Other'))
    const res = await assignRoute('nope', 'review', other.id)
    expect(res.status).toBe(404)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_found')
  })

  it('assigning to a merged PR is refused', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const other = await json<{ id: string }>(await postMember('Other'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    await app.request(`/api/pull-requests/${pr.id}/merge`, {
      method: 'POST',
      headers: { 'x-member-id': other.id },
    })

    const res = await assignRoute(pr.id, 'review', other.id)
    expect(res.status).toBe(409)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('already_merged')
  })

  it('a stranger cannot complete someone elses assignment', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const stranger = await json<{ id: string }>(await postMember('Stranger'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id

    const res = await completeRoute(assignmentId, stranger.id)
    expect(res.status).toBe(403)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_assignee')
    expect(countCredits()).toHaveLength(0)
  })

  it('the poster cannot complete someone elses assignment', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id

    const res = await completeRoute(assignmentId, poster.id)
    expect(res.status).toBe(403)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_assignee')
  })

  it('marking done writes exactly one credit and updates status to ready', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id

    const res = await completeRoute(assignmentId, volunteer.id)
    expect(res.status).toBe(200)
    const done = await json<PullRequestView>(res)
    expect(firstAssignment(done).completedAt).not.toBeNull()

    const credits = countCredits()
    expect(credits).toHaveLength(1)
    expect(credits[0]).toMatchObject({
      memberId: volunteer.id,
      pullRequestId: pr.id,
      role: 'review',
      assignmentId,
    })

    expect((await openPr(pr)).status).toBe('ready')
  })

  it('marking done twice stays idempotent', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id

    await completeRoute(assignmentId, volunteer.id)
    const again = await completeRoute(assignmentId, volunteer.id)
    expect(again.status).toBe(200)
    expect(countCredits()).toHaveLength(1)
  })

  it('undo-done removes exactly one credit row', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id
    await completeRoute(assignmentId, volunteer.id)
    expect(countCredits()).toHaveLength(1)

    const undo = await undoRoute(assignmentId, volunteer.id)
    expect(undo.status).toBe(200)
    expect(countCredits()).toHaveLength(0)

    const view = await openPr(pr)
    expect(firstAssignment(view).completedAt).toBeNull()
    expect(view.status).toBe('in_progress')
  })

  it('only the assignee can undo done', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const stranger = await json<{ id: string }>(await postMember('Stranger'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id
    await completeRoute(assignmentId, volunteer.id)

    const res = await undoRoute(assignmentId, stranger.id)
    expect(res.status).toBe(403)
    expect(countCredits()).toHaveLength(1)
  })

  it('remove-after-done keeps credit', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id
    await completeRoute(assignmentId, volunteer.id)

    const remove = await unassignRoute(assignmentId, volunteer.id)
    expect(remove.status).toBe(200)

    expect(countCredits()).toHaveLength(1)
    const view = await openPr(pr)
    expect(view.assignments).toHaveLength(0)
    expect(view.status).toBe('needs_volunteers')
  })

  it('poster clearing a completed assignment keeps credit and reopens the slot', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const assignmentId = firstAssignment(assigned).id
    await completeRoute(assignmentId, volunteer.id)

    const clear = await unassignRoute(assignmentId, poster.id)
    expect(clear.status).toBe(200)

    const credits = countCredits()
    expect(credits).toHaveLength(1)
    expect(firstCredit().assignmentId).toBeNull()
    expect(firstCredit().memberId).toBe(volunteer.id)

    const view = await openPr(pr)
    expect(view.assignments).toHaveLength(0)
    expect(view.status).toBe('needs_volunteers')
  })

  it('a stranger cannot unassign someone elses assignment', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const stranger = await json<{ id: string }>(await postMember('Stranger'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )
    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))

    const res = await unassignRoute(firstAssignment(assigned).id, stranger.id)
    expect(res.status).toBe(403)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_assignee')
  })

  it('a third volunteer on a 2-slot track is accepted and their credit counts', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const one = await json<{ id: string }>(await postMember('One'))
    const two = await json<{ id: string }>(await postMember('Two'))
    const three = await json<{ id: string }>(await postMember('Three'))
    const pr = await json<PullRequestView>(
      await postPrFull(
        { url: 'https://github.com/a/b/pull/1', reviewersRequired: 2, testersRequired: 0 },
        poster.id,
      ),
    )

    const a1 = await json<PullRequestView>(await assignRoute(pr.id, 'review', one.id))
    await assignRoute(pr.id, 'review', two.id)
    const third = await assignRoute(pr.id, 'review', three.id)
    expect(third.status).toBe(200)

    expect((await openPr(pr)).assignments.filter((a) => a.role === 'review')).toHaveLength(3)

    await completeRoute(firstAssignment(a1).id, one.id)
    const credits = countCredits()
    expect(credits).toHaveLength(1)
    expect(firstCredit().memberId).toBe(one.id)
  })

  it('completing work that exceeds the requirement still counts', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const one = await json<{ id: string }>(await postMember('One'))
    const two = await json<{ id: string }>(await postMember('Two'))
    const pr = await json<PullRequestView>(
      await postPrFull(
        { url: 'https://github.com/a/b/pull/1', reviewersRequired: 1, testersRequired: 0 },
        poster.id,
      ),
    )
    const a1 = await json<PullRequestView>(await assignRoute(pr.id, 'review', one.id))
    const a2 = await json<PullRequestView>(await assignRoute(pr.id, 'review', two.id))

    await completeRoute(assignmentFor(a1, one.id).id, one.id)
    await completeRoute(assignmentFor(a2, two.id).id, two.id)

    expect(countCredits()).toHaveLength(2)
    const view = await openPr(pr)
    expect(view.assignments.filter((a) => a.completedAt !== null)).toHaveLength(2)
    expect(view.status).toBe('ready')
  })

  it('completing an unknown assignment gives not_found', async () => {
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const res = await completeRoute('nope', volunteer.id)
    expect(res.status).toBe(404)
  })

  it('unassigning an unknown assignment gives not_found', async () => {
    const volunteer = await json<{ id: string }>(await postMember('Volunteer'))
    const res = await unassignRoute('nope', volunteer.id)
    expect(res.status).toBe(404)
  })

  it('assignment views carry the assignee display name and timestamps', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const volunteer = await json<{ id: string }>(await postMember('Grace Hopper'))
    const pr = await json<PullRequestView>(
      await postPr('https://github.com/a/b/pull/1', poster.id),
    )

    const assigned = await json<PullRequestView>(await assignRoute(pr.id, 'review', volunteer.id))
    const view = await openPr(pr)
    expect(view.assignments).toEqual([
      {
        id: firstAssignment(assigned).id,
        memberId: volunteer.id,
        memberName: 'Grace Hopper',
        role: 'review',
        assignedAt: expect.any(Number),
        completedAt: null,
      },
    ])
  })
})
