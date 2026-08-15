import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PullRequestView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useDeletePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<PullRequestView> => {
      const res = await api.api['pull-requests'][':id'].$delete({ param: { id } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}
