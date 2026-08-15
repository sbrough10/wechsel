import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createTestDatabase } from './db/test-utils.js'

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const app = createApp(createTestDatabase())
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, message: 'ok' })
  })
})
