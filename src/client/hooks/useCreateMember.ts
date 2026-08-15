import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { MemberView } from '@shared/types'
import { api, apiErrorMessage } from '@/lib/api'

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string): Promise<MemberView> => {
      const res = await api.api.members.$post({ json: { displayName } })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      return res.json()
    },
    onSuccess: (member) => {
      queryClient.setQueryData<MemberView[]>(['members'], (previous) => {
        if (!previous) return [member]
        if (previous.some((m) => m.id === member.id)) return previous
        return [...previous, member]
      })
      toast.success(`You are now ${member.displayName}.`)
    },
    onError: (error) => toast.error(error.message),
  })
}
