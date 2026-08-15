import { Check, X } from 'lucide-react'
import type { MemberView, PullRequestView, Role } from '@shared/types'
import { Button } from '@/components/ui/button'
import { useAssignRole, useComplete, useUnassign, useUndoComplete } from '@/hooks/useAssignments'

const roleMeta: Record<Role, { track: string; action: string }> = {
  review: { track: 'Review', action: 'Review this' },
  acceptance: { track: 'Acceptance testing', action: 'Acceptance test this' },
}

export function RoleTrack({
  pr,
  viewer,
  role,
}: {
  pr: PullRequestView
  viewer: MemberView
  role: Role
}) {
  const assign = useAssignRole()
  const unassign = useUnassign()
  const complete = useComplete()
  const undoComplete = useUndoComplete()

  const isPoster = pr.postedBy === viewer.id
  const required = role === 'review' ? pr.reviewersRequired : pr.testersRequired
  const trackAssignments = pr.assignments.filter((a) => a.role === role)
  const done = trackAssignments.filter((a) => a.completedAt !== null).length
  const mine = trackAssignments.find((a) => a.memberId === viewer.id)
  const pending =
    assign.isPending || unassign.isPending || complete.isPending || undoComplete.isPending
  const notNeeded = required === 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{roleMeta[role].track}</span>
        {notNeeded && trackAssignments.length === 0 ? (
          <span className="text-xs text-muted-foreground">not needed</span>
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{required}
          </span>
        )}
      </div>

      {trackAssignments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trackAssignments.map((assignment) => {
            const isDone = assignment.completedAt !== null
            return (
              <span
                key={assignment.id}
                className={
                  isDone
                    ? 'inline-flex items-center gap-1 rounded-full border border-transparent bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                    : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground'
                }
              >
                {assignment.memberName}
                {isDone ? (
                  <>
                    <Check aria-hidden="true" className="size-3" />
                    <span className="sr-only">done</span>
                  </>
                ) : null}
                {isPoster && (
                  <button
                    type="button"
                    aria-label={`Clear ${assignment.memberName} from ${roleMeta[role].track.toLowerCase()}`}
                    className="ml-0.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    disabled={pending}
                    onClick={() => unassign.mutate(assignment.id)}
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {mine ? (
          <>
            {mine.completedAt !== null ? (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => undoComplete.mutate(mine.id)}
              >
                Undo done
              </Button>
            ) : (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => complete.mutate(mine.id)}
              >
                Mark done
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              disabled={pending}
              onClick={() => unassign.mutate(mine.id)}
            >
              Remove me
            </Button>
          </>
        ) : !isPoster && !notNeeded ? (
          <Button
            size="xs"
            disabled={pending}
            onClick={() => assign.mutate({ prId: pr.id, role })}
          >
            {roleMeta[role].action}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
