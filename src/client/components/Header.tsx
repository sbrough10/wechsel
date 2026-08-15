import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { timeAgo } from '@/lib/relative-time'
import type { ResolvedTheme, ThemePreference } from '@/lib/color-scheme'
import type { MemberView } from '@shared/types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

export function Header({
  member,
  onSwitchUser,
  lastUpdatedAt,
  theme,
  resolvedTheme,
  onThemeChange,
}: {
  member: MemberView
  onSwitchUser: () => void
  lastUpdatedAt?: number
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemeChange: (theme: ThemePreference) => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <span className="text-lg font-semibold tracking-tight">Wechsel</span>
        <div className="flex min-w-0 items-center justify-end gap-3">
          {lastUpdatedAt !== undefined && (
            <p
              className="shrink-0 text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
              role="status"
            >
              Updated {timeAgo(lastUpdatedAt, now)}
            </p>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            >
              {initials(member.displayName)}
            </span>
            <span className="hidden text-sm font-medium sm:inline">{member.displayName}</span>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={onSwitchUser}>
            Switch user
          </Button>
          <ThemeToggle
            theme={theme}
            resolvedTheme={resolvedTheme}
            onThemeChange={onThemeChange}
          />
        </div>
      </div>
    </header>
  )
}
