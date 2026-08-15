import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PullRequestView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useMergePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<PullRequestView> => {
      const res = await api.api['pull-requests'][':id'].merge.$post({ param: { id } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      toast.success(`Merged ${pr.owner}/${pr.repo}#${pr.number}.`)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUnmergePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<PullRequestView> => {
      const res = await api.api['pull-requests'][':id'].merge.$delete({ param: { id } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      toast.success(`Reopened ${pr.owner}/${pr.repo}#${pr.number}.`)
    },
    onError: (error) => toast.error(error.message),
  })
}
