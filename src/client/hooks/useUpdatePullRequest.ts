import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdatePullRequestInput } from '@shared/schemas'
import type { PullRequestView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useUpdatePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdatePullRequestInput & { id: string }): Promise<PullRequestView> => {
      const { id, ...patch } = input
      const res = await api.api['pull-requests'][':id'].$patch({ param: { id }, json: patch })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}
