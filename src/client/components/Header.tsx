import { Button } from '@/components/ui/button'
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
}: {
  member: MemberView
  onSwitchUser: () => void
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <span className="text-lg font-semibold tracking-tight">Wechsel</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            >
              {initials(member.displayName)}
            </span>
            <span className="text-sm font-medium">{member.displayName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onSwitchUser}>
            Switch user
          </Button>
        </div>
      </div>
    </header>
  )
}
