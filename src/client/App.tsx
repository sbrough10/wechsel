import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { IdentityGate } from '@/components/IdentityGate'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/hooks/useMe'
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

  return (
    <div className="min-h-screen">
      <Header member={me.data.member} onSwitchUser={onInvalidIdentity} />
      <main className="mx-auto w-full max-w-5xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {me.data.member.displayName}.</CardTitle>
            <CardDescription>
              Identity is working &mdash; the PR board arrives in the next phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You can reload this page and skip the gate, or switch user from the header.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
