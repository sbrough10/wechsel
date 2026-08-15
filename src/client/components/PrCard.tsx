import { ExternalLink, GitMerge, Undo2 } from 'lucide-react'
import type { MemberView, PullRequestView } from '@shared/types'
import { prLabel } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RequirementStepper } from '@/components/RequirementStepper'
import { RoleTrack } from '@/components/RoleTrack'
import { StatusBadge } from '@/components/StatusBadge'
import { useDeletePullRequest } from '@/hooks/useDeletePullRequest'
import { useMergePullRequest, useUnmergePullRequest } from '@/hooks/useMergePullRequest'
import { useUpdatePullRequest } from '@/hooks/useUpdatePullRequest'
import { timeAgo } from '@/lib/relative-time'

export function PrCard({
  pr,
  viewer,
  merged = false,
}: {
  pr: PullRequestView
  viewer: MemberView
  merged?: boolean
}) {
  const update = useUpdatePullRequest()
  const merge = useMergePullRequest()
  const unmerge = useUnmergePullRequest()
  const remove = useDeletePullRequest()

  const isPoster = pr.postedBy === viewer.id
  const pending = update.isPending || merge.isPending || unmerge.isPending || remove.isPending
  const actionError =
    update.error?.message ?? merge.error?.message ?? unmerge.error?.message ?? remove.error?.message

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            {prLabel(pr)}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </CardTitle>
        <CardDescription>{pr.note}</CardDescription>
        <CardAction>
          <StatusBadge status={pr.status} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Posted by <span className="font-medium text-foreground">{pr.postedByName}</span>{' '}
            {timeAgo(pr.createdAt)}
          </p>
          <div className="flex items-center gap-2">
            {!merged && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => merge.mutate(pr.id)}
              >
                <GitMerge aria-hidden="true" />
                Mark merged
              </Button>
            )}
            {merged && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => unmerge.mutate(pr.id)}
              >
                <Undo2 aria-hidden="true" />
                Undo merge
              </Button>
            )}
            <ConfirmDialog
              title={`Delete ${prLabel(pr)}?`}
              description={
                <>
                  This removes the post and its completion credit stops counting on the leaderboard.
                  This can&rsquo;t be undone from the app.
                </>
              }
              confirmLabel="Delete PR"
              onConfirm={() => remove.mutate(pr.id)}
              trigger={
                <Button variant="ghost" size="sm" disabled={pending}>
                  Delete
                </Button>
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleTrack pr={pr} viewer={viewer} role="review" />
          <RoleTrack pr={pr} viewer={viewer} role="acceptance" />
        </div>
      </CardContent>

      {isPoster && (
        <CardFooter className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="space-y-1.5">
            <Label>Reviewers needed</Label>
            <RequirementStepper
              label="reviewers needed"
              value={pr.reviewersRequired}
              disabled={pending}
              onChange={(value) => update.mutate({ id: pr.id, reviewersRequired: value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Acceptance testers needed</Label>
            <RequirementStepper
              label="acceptance testers needed"
              value={pr.testersRequired}
              disabled={pending}
              onChange={(value) => update.mutate({ id: pr.id, testersRequired: value })}
            />
          </div>
          {actionError && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {actionError}
            </p>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
