import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { cn } from '@/lib/utils'
import type { LeaderboardRow } from '@shared/types'

function RankedList({
  title,
  rows,
  viewerId,
}: {
  title: string
  rows: LeaderboardRow[]
  viewerId: string
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ol className="space-y-1">
        {rows.map((row) => {
          const isViewer = row.id === viewerId
          return (
            <li
              key={row.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5',
                isViewer && 'bg-primary/10',
              )}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {row.displayName}
                {row.removedAt !== null && (
                  <Badge variant="outline" className="ml-2 align-middle">
                    removed
                  </Badge>
                )}
              </span>
              <span className="text-sm font-medium tabular-nums">{row.count}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function Leaderboard({ viewerId }: { viewerId: string }) {
  const leaderboard = useLeaderboard()

  if (leaderboard.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    )
  }

  const reviews = leaderboard.data?.reviews ?? []
  const acceptance = leaderboard.data?.acceptance ?? []

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <RankedList title="Reviews completed" rows={reviews} viewerId={viewerId} />
      <RankedList title="Acceptance tests completed" rows={acceptance} viewerId={viewerId} />
    </div>
  )
}
