import { useQuery } from '@tanstack/react-query'
import type { PullRequestsResponse } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function usePullRequests() {
  return useQuery({
    queryKey: ['pull-requests'],
    queryFn: async (): Promise<PullRequestsResponse> => {
      const res = await api.api['pull-requests'].$get()
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
  })
}
