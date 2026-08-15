import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateAssignmentInput } from '@shared/schemas'
import type { MemberView, PullRequestView, PullRequestsResponse, Role } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'
import type { MeResponse } from '@/hooks/useMe'

const pullRequestsKey = ['pull-requests'] as const

function getPrs(queryClient: QueryClient): PullRequestsResponse | undefined {
  return queryClient.getQueryData<PullRequestsResponse>(pullRequestsKey)
}

function setPrs(queryClient: QueryClient, prs: PullRequestsResponse) {
  queryClient.setQueryData<PullRequestsResponse>(pullRequestsKey, prs)
}

function mapPr(
  queryClient: QueryClient,
  prId: string,
  update: (pr: PullRequestView) => PullRequestView,
): PullRequestsResponse | undefined {
  const previous = getPrs(queryClient)
  if (!previous) return undefined
  setPrs(queryClient, {
    open: previous.open.map((pr) => (pr.id === prId ? update(pr) : pr)),
    merged: previous.merged.map((pr) => (pr.id === prId ? update(pr) : pr)),
  })
  return previous
}

function viewerFromCache(queryClient: QueryClient): MemberView | undefined {
  return queryClient.getQueryData<MeResponse>(['me'])?.member
}

function tempId(): string {
  return `optimistic-${Date.now()}`
}

export function useAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: CreateAssignmentInput & { prId: string },
    ): Promise<PullRequestView> => {
      const { prId, ...body } = input
      const res = await api.api['pull-requests'][':id'].assignments.$post({
        param: { id: prId },
        json: body,
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onMutate: async (input: CreateAssignmentInput & { prId: string }) => {
      await queryClient.cancelQueries({ queryKey: pullRequestsKey })
      const viewer = viewerFromCache(queryClient)
      if (!viewer) return
      const previous = mapPr(queryClient, input.prId, (pr) => {
        if (pr.assignments.some((a) => a.memberId === viewer.id && a.role === input.role)) return pr
        return {
          ...pr,
          assignments: [
            ...pr.assignments,
            {
              id: tempId(),
              memberId: viewer.id,
              memberName: viewer.displayName,
              role: input.role as Role,
              assignedAt: Date.now(),
              completedAt: null,
            },
          ],
        }
      })
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) setPrs(queryClient, context.previous)
      toast.error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pullRequestsKey })
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
    onError: (error) => toast.error(error.message),
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: pullRequestsKey })
      toast.success(`Removed from ${prLabelOf(pr)}.`)
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
    onMutate: async (assignmentId: string) => {
      await queryClient.cancelQueries({ queryKey: pullRequestsKey })
      const previous = getPrs(queryClient)
      if (!previous) return
      const prId = findPrByAssignment(previous, assignmentId)?.id
      if (!prId) return
      setPrs(queryClient, {
        open: previous.open.map((pr) =>
          pr.id === prId ? completeAssignment(pr, assignmentId) : pr,
        ),
        merged: previous.merged.map((pr) =>
          pr.id === prId ? completeAssignment(pr, assignmentId) : pr,
        ),
      })
      return { previous }
    },
    onError: (error, _assignmentId, context) => {
      if (context?.previous) setPrs(queryClient, context.previous)
      toast.error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pullRequestsKey })
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
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pullRequestsKey })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      toast.success('Undid done.')
    },
  })
}

function completeAssignment(pr: PullRequestView, assignmentId: string): PullRequestView {
  return {
    ...pr,
    assignments: pr.assignments.map((a) =>
      a.id === assignmentId ? { ...a, completedAt: Date.now() } : a,
    ),
  }
}

function findPrByAssignment(
  prs: PullRequestsResponse,
  assignmentId: string,
): PullRequestView | undefined {
  return [...prs.open, ...prs.merged].find((pr) =>
    pr.assignments.some((a) => a.id === assignmentId),
  )
}

function prLabelOf(pr: PullRequestView): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`
}
