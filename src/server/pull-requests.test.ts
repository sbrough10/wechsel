import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import type { Database } from './db/client.js'
import { assignments } from './db/schema.js'
import { createTestDatabase } from './db/test-utils.js'
import type { PullRequestView, PullRequestsResponse } from '../shared/types.js'

describe('pull requests API', () => {
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

  const postPr = (body: Record<string, unknown>, actorId: string) =>
    app.request('/api/pull-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-member-id': actorId },
      body: JSON.stringify(body),
    })

  const getPrs = () => app.request('/api/pull-requests')

  it('starts with empty open and merged lists', async () => {
    const res = await getPrs()
    expect(res.status).toBe(200)
    expect(await json<PullRequestsResponse>(res)).toEqual({ open: [], merged: [] })
  })

  it('creates a PR and canonicalises the URL', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const res = await postPr(
      { url: 'https://github.com/acme/core/pull/42/files', reviewersRequired: 2, testersRequired: 1, note: '  quick look  ' },
      member.id,
    )
    expect(res.status).toBe(201)
    const body = await json<PullRequestView>(res)
    expect(body).toMatchObject({
      url: 'https://github.com/acme/core/pull/42',
      owner: 'acme',
      repo: 'core',
      number: 42,
      postedBy: member.id,
      postedByName: 'Ada',
      reviewersRequired: 2,
      testersRequired: 1,
      note: 'quick look',
      mergedAt: null,
      status: 'needs_volunteers',
    })
    expect(body.createdAt).toBeTypeOf('number')
  })

  it('rejects an invalid URL', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const res = await postPr({ url: 'https://example.com/not-a-pr', reviewersRequired: 1, testersRequired: 0 }, member.id)
    expect(res.status).toBe(400)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('validation_failed')
  })

  it('rejects a non-GitHub URL even with pull in it', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const res = await postPr({ url: 'https://gitlab.com/a/b/pull/1', reviewersRequired: 1, testersRequired: 0 }, member.id)
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate live URL', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const url = 'https://github.com/acme/core/pull/42'
    await postPr({ url, reviewersRequired: 1, testersRequired: 0 }, member.id)
    const res = await postPr({ url, reviewersRequired: 1, testersRequired: 0 }, member.id)
    expect(res.status).toBe(409)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('duplicate_pr')
  })

  it('accepts a URL variant that canonicalises to a duplicate', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    await postPr({ url: 'https://www.github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, member.id)
    const res = await postPr({ url: 'https://github.com/acme/core/pull/42/files', reviewersRequired: 1, testersRequired: 0 }, member.id)
    expect(res.status).toBe(409)
  })

  it('accepts the same URL again after deletion', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const url = 'https://github.com/acme/core/pull/42'
    const created = await json<PullRequestView>(await postPr({ url, reviewersRequired: 1, testersRequired: 0 }, member.id))

    const del = await app.request(`/api/pull-requests/${created.id}`, {
      method: 'DELETE',
      headers: { 'x-member-id': member.id },
    })
    expect(del.status).toBe(200)

    const again = await postPr({ url, reviewersRequired: 1, testersRequired: 0 }, member.id)
    expect(again.status).toBe(201)
  })

  it('requires an identity to post', async () => {
    const res = await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, 'nope')
    expect(res.status).toBe(401)
  })

  it('non-poster gets not_poster on PATCH', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const other = await json<{ id: string }>(await postMember('Other'))
    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, poster.id),
    )

    const res = await app.request(`/api/pull-requests/${pr.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-member-id': other.id },
      body: JSON.stringify({ reviewersRequired: 2 }),
    })
    expect(res.status).toBe(403)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_poster')
  })

  it('poster can update requirements and clear the note', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const pr = await json<PullRequestView>(
      await postPr(
        { url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0, note: 'hello' },
        poster.id,
      ),
    )

    const res = await app.request(`/api/pull-requests/${pr.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-member-id': poster.id },
      body: JSON.stringify({ reviewersRequired: 3, testersRequired: 2, note: '' }),
    })
    expect(res.status).toBe(200)
    expect(await json<PullRequestView>(res)).toMatchObject({
      reviewersRequired: 3,
      testersRequired: 2,
      note: null,
    })
  })

  it('merge moves the PR out of open and into merged', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )

    const res = await app.request(`/api/pull-requests/${pr.id}/merge`, {
      method: 'POST',
      headers: { 'x-member-id': member.id },
    })
    expect(res.status).toBe(200)
    expect((await json<PullRequestView>(res)).mergedAt).not.toBeNull()

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open.map((p) => p.id)).not.toContain(pr.id)
    expect(list.merged.map((p) => p.id)).toContain(pr.id)
    expect(list.merged[0]).toMatchObject({ status: 'merged' })
  })

  it('undo merge returns the PR to open', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    await app.request(`/api/pull-requests/${pr.id}/merge`, { method: 'POST', headers: { 'x-member-id': member.id } })

    const undo = await app.request(`/api/pull-requests/${pr.id}/merge`, {
      method: 'DELETE',
      headers: { 'x-member-id': member.id },
    })
    expect(undo.status).toBe(200)
    expect((await json<PullRequestView>(undo)).mergedAt).toBeNull()

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open.map((p) => p.id)).toContain(pr.id)
    expect(list.merged.map((p) => p.id)).not.toContain(pr.id)
  })

  it('any active member can merge and delete', async () => {
    const poster = await json<{ id: string }>(await postMember('Poster'))
    const other = await json<{ id: string }>(await postMember('Other'))
    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, poster.id),
    )

    const merge = await app.request(`/api/pull-requests/${pr.id}/merge`, {
      method: 'POST',
      headers: { 'x-member-id': other.id },
    })
    expect(merge.status).toBe(200)

    const del = await app.request(`/api/pull-requests/${pr.id}`, {
      method: 'DELETE',
      headers: { 'x-member-id': other.id },
    })
    expect(del.status).toBe(200)

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open).toHaveLength(0)
    expect(list.merged).toHaveLength(0)
  })

  it('deleting an unknown PR gives not_found', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const res = await app.request('/api/pull-requests/nope', { method: 'DELETE', headers: { 'x-member-id': member.id } })
    expect(res.status).toBe(404)
    expect((await json<{ error: { code: string } }>(res)).error.code).toBe('not_found')
  })

  it('orders open PRs: unfilled-and-oldest first, then in-progress, then ready', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))

    const ready = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/10', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    const unfilledOld = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/11', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    const inProgress = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/12', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    const unfilledNew = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/13', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )

    db.insert(assignments)
      .values([
        { id: 'a1', pullRequestId: inProgress.id, memberId: member.id, role: 'review', assignedAt: new Date(), completedAt: null },
        { id: 'a2', pullRequestId: ready.id, memberId: member.id, role: 'review', assignedAt: new Date(), completedAt: new Date() },
      ])
      .run()

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open.map((p) => p.id)).toEqual([unfilledOld.id, unfilledNew.id, inProgress.id, ready.id])
    expect(list.open.map((p) => p.status)).toEqual([
      'needs_volunteers',
      'needs_volunteers',
      'in_progress',
      'ready',
    ])
  })

  it('merged PRs sort newest-first', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const old = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/1', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    const recent = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/2', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    await app.request(`/api/pull-requests/${old.id}/merge`, { method: 'POST', headers: { 'x-member-id': member.id } })
    await app.request(`/api/pull-requests/${recent.id}/merge`, { method: 'POST', headers: { 'x-member-id': member.id } })

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.merged.map((p) => p.id)).toEqual([recent.id, old.id])
  })

  it('lists include the poster display name', async () => {
    const poster = await json<{ id: string }>(await postMember('Grace Hopper'))
    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, poster.id),
    )
    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open.find((p) => p.id === pr.id)?.postedByName).toBe('Grace Hopper')
  })

  it('derives status from live assignments', async () => {
    const member = await json<{ id: string }>(await postMember('Ada'))
    const reviewer = await json<{ id: string }>(await postMember('Grace'))

    const pr = await json<PullRequestView>(
      await postPr({ url: 'https://github.com/acme/core/pull/42', reviewersRequired: 1, testersRequired: 0 }, member.id),
    )
    db.insert(assignments)
      .values({ id: 'a1', pullRequestId: pr.id, memberId: reviewer.id, role: 'review', assignedAt: new Date(), completedAt: new Date() })
      .run()

    const list = await json<PullRequestsResponse>(await getPrs())
    expect(list.open.find((p) => p.id === pr.id)?.status).toBe('ready')
  })
})
