// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useColorScheme } from '@/lib/color-scheme'

type MediaChangeListener = (event: { matches: boolean }) => void

function mockMatchMedia(dark: boolean) {
  const listeners = new Set<MediaChangeListener>()
  const media = {
    matches: dark,
    addEventListener: vi.fn((_type: string, listener: MediaChangeListener) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_type: string, listener: MediaChangeListener) =>
      listeners.delete(listener),
    ),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media))
  return {
    media,
    setSystemDark: (value: boolean) => {
      listeners.forEach((listener) => listener({ matches: value }))
    },
  }
}

describe('useColorScheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to system and applies the OS preference', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.preference).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('follows OS changes while in system mode', () => {
    const { setSystemDark } = mockMatchMedia(false)
    const { result } = renderHook(() => useColorScheme())
    act(() => setSystemDark(true))
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies and persists a forced preference', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useColorScheme())
    act(() => result.current.setTheme('dark'))
    expect(result.current.preference).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('wechsel.theme')).toBe('dark')
  })

  it('ignores OS changes when a preference is forced', () => {
    const { setSystemDark } = mockMatchMedia(true)
    const { result } = renderHook(() => useColorScheme())
    act(() => result.current.setTheme('light'))
    act(() => setSystemDark(true))
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('reads a stored preference on mount', () => {
    localStorage.setItem('wechsel.theme', 'dark')
    mockMatchMedia(false)
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.preference).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
