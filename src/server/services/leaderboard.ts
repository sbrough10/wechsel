import { and, eq, isNull, sql } from 'drizzle-orm'
import type { LeaderboardResponse, LeaderboardRow } from '../../shared/types.js'
import type { Database } from '../db/client.js'
import { completions, members, pullRequests } from '../db/schema.js'

interface LeaderboardCounts {
  id: string
  displayName: string
  removedAt: Date | null
  reviewsCompleted: number
  testsCompleted: number
}

const countByRole = (role: 'review' | 'acceptance') =>
  sql<number>`COUNT(CASE WHEN ${completions.role} = ${role} AND ${pullRequests.id} IS NOT NULL THEN 1 END)`

function rankedRows(rows: { id: string; displayName: string; removedAt: Date | null; count: number }[]): LeaderboardRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName),
  )
  let rank = 0
  let previousCount: number | null = null
  return sorted.map((row, index) => {
    if (row.count !== previousCount) {
      rank = index + 1
      previousCount = row.count
    }
    return {
      id: row.id,
      displayName: row.displayName,
      removedAt: row.removedAt ? row.removedAt.getTime() : null,
      count: row.count,
      rank,
    }
  })
}

export function getLeaderboard(db: Database): LeaderboardResponse {
  const rows = db
    .select({
      id: members.id,
      displayName: members.displayName,
      removedAt: members.removedAt,
      reviewsCompleted: countByRole('review'),
      testsCompleted: countByRole('acceptance'),
    })
    .from(members)
    .leftJoin(completions, eq(completions.memberId, members.id))
    .leftJoin(
      pullRequests,
      and(eq(pullRequests.id, completions.pullRequestId), isNull(pullRequests.deletedAt)),
    )
    .groupBy(members.id)
    .having(
      sql`${members.removedAt} IS NULL OR ${countByRole('review')} + ${countByRole('acceptance')} > 0`,
    )
    .all()

  const counts = rows as LeaderboardCounts[]
  return {
    reviews: rankedRows(
      counts.map((row) => ({ ...row, count: row.reviewsCompleted })),
    ),
    acceptance: rankedRows(
      counts.map((row) => ({ ...row, count: row.testsCompleted })),
    ),
  }
}
