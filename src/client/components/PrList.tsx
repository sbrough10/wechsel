import type { MemberView, PullRequestView } from '@shared/types'
import { PrCard } from '@/components/PrCard'

export function PrList({
  prs,
  viewer,
}: {
  prs: PullRequestView[]
  viewer: MemberView
}) {
  if (prs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No open PRs &mdash; post one above.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {prs.map((pr) => (
        <PrCard key={pr.id} pr={pr} viewer={viewer} />
      ))}
    </div>
  )
}
