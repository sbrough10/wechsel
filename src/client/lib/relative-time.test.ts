import { describe, expect, it } from 'vitest'
import { timeAgo, timeAgoShort } from '@/lib/relative-time'

const now = 1000 * 60 * 60 * 2

describe('timeAgo', () => {
  it('renders coarse labels for the compact contexts', () => {
    expect(timeAgo(now - 30_000, now)).toBe('just now')
    expect(timeAgo(now - 2 * 60_000, now)).toBe('2m ago')
    expect(timeAgo(now - 3 * 60 * 60_000, now)).toBe('3h ago')
    expect(timeAgo(now - 4 * 24 * 60 * 60_000, now)).toBe('4d ago')
  })

  it('never shows a negative age', () => {
    expect(timeAgo(now + 5000, now)).toBe('just now')
  })
})

describe('timeAgoShort', () => {
  it('shows seconds under a minute', () => {
    expect(timeAgoShort(now - 5000, now)).toBe('5s ago')
    expect(timeAgoShort(now - 0, now)).toBe('0s ago')
  })

  it('falls back to minute, hour and day precision', () => {
    expect(timeAgoShort(now - 2 * 60_000, now)).toBe('2m ago')
    expect(timeAgoShort(now - 3 * 60 * 60_000, now)).toBe('3h ago')
    expect(timeAgoShort(now - 4 * 24 * 60 * 60_000, now)).toBe('4d ago')
  })

  it('never shows a negative age', () => {
    expect(timeAgoShort(now + 5000, now)).toBe('0s ago')
  })
})
