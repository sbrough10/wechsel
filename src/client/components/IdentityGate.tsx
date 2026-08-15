import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateMember } from '@/hooks/useCreateMember'
import { useMembers } from '@/hooks/useMembers'
import { toNameKey } from '@shared/schemas'
import type { MemberView } from '@shared/types'

export function IdentityGate({ onSelected }: { onSelected: (member: MemberView) => void }) {
  const members = useMembers()
  const createMember = useCreateMember()
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const matches = useMemo(
    () =>
      (members.data ?? []).filter((m) =>
        m.displayName.toLowerCase().includes(trimmed.toLowerCase()),
      ),
    [members.data, trimmed],
  )
  const isExactMatch = matches.some((m) => m.nameKey === toNameKey(trimmed))

  const pick = (member: MemberView) => onSelected(member)

  const create = () => {
    if (!trimmed) return
    createMember.mutate(trimmed, { onSuccess: (member) => onSelected(member) })
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Who are you?</CardTitle>
          <CardDescription>
            Pick your name from the list, or type a new one to join the team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Command className="rounded-lg border bg-popover">
            <CommandInput
              placeholder="Your name…"
              value={query}
              onValueChange={setQuery}
              autoFocus
            />
            <CommandList>
              {members.isLoading && (
                <div className="space-y-1.5 p-2">
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-4/5" />
                  <Skeleton className="h-7 w-3/5" />
                </div>
              )}

              {members.isError && (
                <div className="flex items-center justify-between gap-3 p-2">
                  <p className="text-sm text-destructive" role="alert">
                    Could not load the team list.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => members.refetch()}>
                    Retry
                  </Button>
                </div>
              )}

              {!members.isLoading && trimmed && !isExactMatch && (
                <CommandItem value={`create:${trimmed}`} onSelect={create}>
                  <UserPlus />
                  <span>
                    Use &ldquo;{trimmed}&rdquo;
                  </span>
                </CommandItem>
              )}

              {!members.isLoading && matches.length > 0 && (
                <CommandGroup heading="Team">
                  {matches.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.displayName}
                      onSelect={() => pick(member)}
                    >
                      {member.displayName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!members.isLoading && !members.isError && (
                <CommandEmpty>
                  No teammates yet &mdash; type your name to join.
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </CardContent>
      </Card>
    </main>
  )
}
