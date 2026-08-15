import { useQuery } from '@tanstack/react-query'
import type { MemberView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async (): Promise<MemberView[]> => {
      const res = await api.api.members.$get()
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
  })
}
