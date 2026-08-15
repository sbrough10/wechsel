// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/Header'
import type { MemberView } from '@shared/types'

const member: MemberView = {
  id: 'm-ada',
  displayName: 'Ada Lovelace',
  nameKey: 'ada lovelace',
  createdAt: 1,
  removedAt: null,
}

function renderHeader(
  overrides: {
    connected?: boolean
    lastUpdatedAt?: number | null
  } = {},
) {
  const props: ComponentProps<typeof Header> = {
    member,
    onSwitchUser: vi.fn(),
    connected: overrides.connected ?? true,
    theme: 'system',
    resolvedTheme: 'light',
    onThemeChange: vi.fn(),
  }
  if (overrides.lastUpdatedAt !== null) {
    props.lastUpdatedAt = overrides.lastUpdatedAt ?? Date.now()
  }
  return render(<Header {...props} />)
}

describe('Header', () => {
  it('shows how long ago data was last updated while connected', () => {
    renderHeader()
    expect(screen.getByText(/^Updated \d+s ago$/)).toBeInTheDocument()
  })

  it('shows an offline warning instead of pretending updates are flowing', () => {
    renderHeader({ connected: false })
    expect(screen.getByText(/^Offline · last update \d+s ago$/)).toBeInTheDocument()
  })

  it('hides the freshness indicator when no successful update has happened yet', () => {
    renderHeader({ lastUpdatedAt: null })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
