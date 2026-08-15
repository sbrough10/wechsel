// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'

function signals(
  overrides: {
    dataUpdatedAt?: number
    fetchStatus?: 'fetching' | 'paused' | 'idle'
    failureCount?: number
  } = {},
) {
  return {
    dataUpdatedAt: overrides.dataUpdatedAt ?? 0,
    fetchStatus: overrides.fetchStatus ?? ('idle' as const),
    failureCount: overrides.failureCount ?? 0,
  }
}

function renderStatus(initial: ReturnType<typeof signals>) {
  return renderHook(
    ({ query }: { query: ReturnType<typeof signals> }) => useConnectionStatus(query),
    { initialProps: { query: initial } },
  )
}

describe('useConnectionStatus', () => {
  it('reports connected through healthy polls', () => {
    const { result, rerender } = renderStatus(signals({ dataUpdatedAt: 100 }))
    expect(result.current).toBe(true)
    rerender({ query: signals({ dataUpdatedAt: 200 }) })
    expect(result.current).toBe(true)
  })

  it('reports disconnected once a poll keeps failing', () => {
    const { result, rerender } = renderStatus(signals({ dataUpdatedAt: 100 }))
    rerender({ query: signals({ dataUpdatedAt: 100, failureCount: 2 }) })
    expect(result.current).toBe(false)
  })

  it('recovers when a poll succeeds again', () => {
    const { result, rerender } = renderStatus(signals({ dataUpdatedAt: 100, failureCount: 2 }))
    expect(result.current).toBe(false)
    rerender({ query: signals({ dataUpdatedAt: 300 }) })
    expect(result.current).toBe(true)
  })

  it('stays disconnected through retry windows so the indicator does not flicker', () => {
    const { result, rerender } = renderStatus(signals({ dataUpdatedAt: 100, failureCount: 2 }))
    expect(result.current).toBe(false)
    rerender({ query: signals({ dataUpdatedAt: 100, fetchStatus: 'fetching' }) })
    expect(result.current).toBe(false)
  })

  it('disconnects when the browser reports offline and only recovers on a successful poll', () => {
    const { result } = renderStatus(signals({ dataUpdatedAt: 100 }))
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(false)
  })

  it('treats a paused fetch as disconnected', () => {
    const { result, rerender } = renderStatus(signals({ dataUpdatedAt: 100 }))
    rerender({ query: signals({ dataUpdatedAt: 100, fetchStatus: 'paused' }) })
    expect(result.current).toBe(false)
  })
})
