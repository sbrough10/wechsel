import { hc } from 'hono/client'
import type { AppType } from '@server/app'
import { clearStoredMemberId, getStoredMemberId } from './identity'

const memberFetch: typeof fetch = async (input, init) => {
  const memberId = getStoredMemberId()
  const headers = new Headers(init?.headers)
  if (memberId) {
    headers.set('x-member-id', memberId)
  }
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401) {
    clearStoredMemberId()
  }
  return res
}

export const api = hc<AppType>('', { fetch: memberFetch })

export async function apiErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}
