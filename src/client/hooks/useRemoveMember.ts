import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemberView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<MemberView> => {
      const res = await api.api.members[':id'].$delete({ param: { id } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}
