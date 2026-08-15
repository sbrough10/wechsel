import { Badge } from '@/components/ui/badge'
import type { PullRequestStatus } from '@shared/types'

const statusMeta: Record<PullRequestStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  needs_volunteers: { label: 'Needs volunteers', variant: 'secondary' },
  in_progress: { label: 'In progress', variant: 'outline' },
  ready: { label: 'Ready to merge', variant: 'default' },
  merged: { label: 'Merged', variant: 'secondary' },
}

export function StatusBadge({ status }: { status: PullRequestStatus }) {
  const meta = statusMeta[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
