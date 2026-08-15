import { useQuery } from '@tanstack/react-query'
import type { MemberView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export interface MeResponse {
  member: MemberView
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<MeResponse> => {
      const res = await api.api.members.me.$get()
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    retry: false,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
}
