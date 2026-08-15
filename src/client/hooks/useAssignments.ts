import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateAssignmentInput } from '@shared/schemas'
import type { PullRequestView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput & { prId: string }): Promise<PullRequestView> => {
      const { prId, ...body } = input
      const res = await api.api['pull-requests'][':id'].assignments.$post({
        param: { id: prId },
        json: body,
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}

export function useUnassign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: string): Promise<PullRequestView> => {
      const res = await api.api.assignments[':id'].$delete({ param: { id: assignmentId } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}

export function useComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: string): Promise<PullRequestView> => {
      const res = await api.api.assignments[':id'].completion.$post({
        param: { id: assignmentId },
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export function useUndoComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: string): Promise<PullRequestView> => {
      const res = await api.api.assignments[':id'].completion.$delete({
        param: { id: assignmentId },
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}
