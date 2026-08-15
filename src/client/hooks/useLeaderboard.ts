import { useQuery } from '@tanstack/react-query'
import type { LeaderboardResponse } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const res = await api.api.leaderboard.$get()
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
}
