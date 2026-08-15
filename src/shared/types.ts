export interface MemberView {
  id: string
  displayName: string
  nameKey: string
  createdAt: number
  removedAt: number | null
}

export type PullRequestStatus = 'needs_volunteers' | 'in_progress' | 'ready' | 'merged'

export interface PullRequestView {
  id: string
  url: string
  owner: string
  repo: string
  number: number
  note: string | null
  postedBy: string
  postedByName: string
  reviewersRequired: number
  testersRequired: number
  mergedAt: number | null
  createdAt: number
  updatedAt: number
  status: PullRequestStatus
}

export interface PullRequestsResponse {
  open: PullRequestView[]
  merged: PullRequestView[]
}

export function prLabel(pr: PullRequestView): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`
}
