import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatePullRequestInput } from '@shared/schemas'
import type { PullRequestView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useCreatePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePullRequestInput): Promise<PullRequestView> => {
      const res = await api.api['pull-requests'].$post({ json: input })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}
