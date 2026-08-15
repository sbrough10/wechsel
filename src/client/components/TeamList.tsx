import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useMembers } from '@/hooks/useMembers'
import { useRemoveMember } from '@/hooks/useRemoveMember'

export function TeamList({ viewerId }: { viewerId: string }) {
  const members = useMembers()
  const remove = useRemoveMember()
  const pending = remove.isPending

  return (
    <div className="flex flex-wrap gap-2">
      {members.data?.map((member) => {
        const isSelf = member.id === viewerId
        return (
          <div
            key={member.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-3 pr-1"
          >
            <span className="text-sm">
              {member.displayName}
              {isSelf && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <ConfirmDialog
              title={`Remove ${member.displayName}?`}
              description={
                <>
                  {member.displayName} can no longer be picked or assigned, all their live
                  assignments are dropped, and their slots reopen. Their completion credit stays on
                  the leaderboard, badged as removed.
                </>
              }
              confirmLabel="Remove member"
              onConfirm={() => remove.mutate(member.id)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={pending}
                  aria-label={`Remove ${member.displayName}`}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              }
            />
          </div>
        )
      })}
    </div>
  )
}
