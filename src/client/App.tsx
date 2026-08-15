import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'

type Health = { ok: boolean; message: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = () => {
    api.api.health
      .$get()
      .then((res) => res.json())
      .then((data) => {
        setHealth(data)
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(() => {
    check()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Wechsel</CardTitle>
          <CardDescription>Phase 0 scaffold &mdash; health check</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : (
            <p className="font-mono text-lg">{health ? health.message : 'loading…'}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={check}>Re-check</Button>
        </CardFooter>
      </Card>
    </main>
  )
}
