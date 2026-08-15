import { useState, type FormEvent } from 'react'
import { createPullRequestSchema } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreatePullRequest } from '@/hooks/useCreatePullRequest'
import { RequirementStepper } from './RequirementStepper'

interface FormErrors {
  url?: string
  note?: string
}

export function PostPrForm() {
  const createPr = useCreatePullRequest()
  const [url, setUrl] = useState('')
  const [reviewersRequired, setReviewersRequired] = useState(1)
  const [testersRequired, setTestersRequired] = useState(0)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = createPullRequestSchema.safeParse({
      url,
      reviewersRequired,
      testersRequired,
      note,
    })
    if (!result.success) {
      const issue = (field: string) =>
        result.error.issues.find((i) => i.path[0] === field)?.message
      setErrors({ url: issue('url'), note: issue('note') })
      return
    }
    setErrors({})
    createPr.mutate(result.data, {
      onSuccess: () => {
        setUrl('')
        setReviewersRequired(1)
        setTestersRequired(0)
        setNote('')
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a PR</CardTitle>
        <CardDescription>
          Paste a GitHub pull request URL and say what help it needs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pr-url">Pull request URL</Label>
            <Input
              id="pr-url"
              type="url"
              placeholder="https://github.com/acme/core/pull/42"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={Boolean(errors.url)}
              autoComplete="off"
            />
            {errors.url && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {errors.url}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="space-y-1.5">
              <Label>Reviewers needed</Label>
              <div className="flex items-center gap-2">
                <RequirementStepper
                  label="reviewers needed"
                  value={reviewersRequired}
                  onChange={setReviewersRequired}
                />
                <span className="sr-only">0 means not needed</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Acceptance testers needed</Label>
              <div className="flex items-center gap-2">
                <RequirementStepper
                  label="acceptance testers needed"
                  value={testersRequired}
                  onChange={setTestersRequired}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-note">Note (optional)</Label>
            <Textarea
              id="pr-note"
              placeholder="config change only, quick look"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              aria-invalid={Boolean(errors.note)}
            />
            {errors.note && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {errors.note}
              </p>
            )}
          </div>

          <Button type="submit" disabled={createPr.isPending} className="w-full sm:w-auto">
            {createPr.isPending ? 'Posting…' : 'Post pull request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
