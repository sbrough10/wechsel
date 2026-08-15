import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { IdentityGate } from '@/components/IdentityGate'
import { MergedPrList } from '@/components/MergedPrList'
import { PostPrForm } from '@/components/PostPrForm'
import { PrList } from '@/components/PrList'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/hooks/useMe'
import { usePullRequests } from '@/hooks/usePullRequests'
import { clearStoredMemberId, getStoredMemberId, storeMemberId } from '@/lib/identity'
import type { MemberView } from '@shared/types'

export default function App() {
  const [memberId, setMemberId] = useState<string | null>(() => getStoredMemberId())

  if (!memberId) {
    return (
      <IdentityGate
        onSelected={(member: MemberView) => {
          storeMemberId(member.id)
          setMemberId(member.id)
        }}
      />
    )
  }

  return (
    <Dashboard
      onInvalidIdentity={() => {
        clearStoredMemberId()
        setMemberId(null)
      }}
    />
  )
}

function Dashboard({ onInvalidIdentity }: { onInvalidIdentity: () => void }) {
  const me = useMe()
  const pullRequests = usePullRequests()

  useEffect(() => {
    if (me.isError) {
      onInvalidIdentity()
    }
  }, [me.isError, onInvalidIdentity])

  if (me.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!me.data) return null

  const { member } = me.data

  return (
    <div className="min-h-screen">
      <Header member={member} onSwitchUser={onInvalidIdentity} />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4">
        <PostPrForm />

        <section className="space-y-3" aria-labelledby="open-prs-heading">
          <h2 id="open-prs-heading" className="text-lg font-semibold tracking-tight">
            Open PRs
          </h2>
          {pullRequests.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <PrList prs={pullRequests.data?.open ?? []} viewer={member} />
          )}
        </section>

        <section className="space-y-3" aria-label="Recently merged">
          {pullRequests.isPending ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <MergedPrList prs={pullRequests.data?.merged ?? []} viewer={member} />
          )}
        </section>
      </main>
    </div>
  )
}
