// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrCard } from '@/components/PrCard'
import type { AssignmentView, MemberView, PullRequestView } from '@shared/types'

const poster: MemberView = {
  id: 'm-poster',
  displayName: 'Pat Poster',
  nameKey: 'pat poster',
  createdAt: 1,
  removedAt: null,
}

const viewer: MemberView = {
  id: 'm-viewer',
  displayName: 'Vera Viewer',
  nameKey: 'vera viewer',
  createdAt: 2,
  removedAt: null,
}

const bob: MemberView = {
  id: 'm-bob',
  displayName: 'Bob Builder',
  nameKey: 'bob builder',
  createdAt: 3,
  removedAt: null,
}

const basePr: PullRequestView = {
  id: 'pr-1',
  url: 'https://github.com/acme/core/pull/42',
  owner: 'acme',
  repo: 'core',
  number: 42,
  note: null,
  postedBy: poster.id,
  postedByName: poster.displayName,
  reviewersRequired: 2,
  testersRequired: 1,
  mergedAt: null,
  createdAt: 1000,
  updatedAt: 1000,
  status: 'needs_volunteers',
  assignments: [],
}

function assignment(overrides: Partial<AssignmentView> = {}): AssignmentView {
  return {
    id: 'a-1',
    memberId: 'm-bob',
    memberName: 'Bob Builder',
    role: 'review',
    assignedAt: 1000,
    completedAt: null,
    ...overrides,
  }
}

function renderPr(pr: PullRequestView, currentViewer: MemberView, merged = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PrCard pr={pr} viewer={currentViewer} merged={merged} />
    </QueryClientProvider>,
  )
}

describe('PrCard permission rendering', () => {
  it('shows the PR link and poster', () => {
    renderPr(basePr, viewer)
    expect(screen.getByRole('link', { name: 'acme/core#42' })).toHaveAttribute(
      'href',
      'https://github.com/acme/core/pull/42',
    )
    expect(screen.getByText(/Posted by/)).toHaveTextContent('Pat Poster')
  })

  it('the poster sees requirement steppers but no self-assign buttons', () => {
    renderPr({ ...basePr, assignments: [assignment()] }, poster)
    expect(screen.getByText('Reviewers needed')).toBeInTheDocument()
    expect(screen.getByText('Acceptance testers needed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review this' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acceptance test this' })).not.toBeInTheDocument()
  })

  it('the poster can clear another members assignment', () => {
    renderPr({ ...basePr, assignments: [assignment()] }, poster)
    expect(
      screen.getByRole('button', { name: 'Clear Bob Builder from review' }),
    ).toBeInTheDocument()
  })

  it('a non-poster can volunteer but never clears or edits requirements', () => {
    renderPr({ ...basePr, assignments: [assignment()] }, viewer)
    expect(screen.getByRole('button', { name: 'Review this' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acceptance test this' })).toBeInTheDocument()
    expect(screen.queryByText('Reviewers needed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Clear / })).not.toBeInTheDocument()
  })

  it('an assignee sees mark-done and remove-me instead of volunteering', () => {
    renderPr({ ...basePr, assignments: [assignment()] }, bob)
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove me' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review this' })).not.toBeInTheDocument()
  })

  it('a completed assignment shows undo-done', () => {
    renderPr(
      { ...basePr, assignments: [assignment({ completedAt: 2000 })] },
      bob,
    )
    expect(screen.getByRole('button', { name: 'Undo done' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument()
  })

  it('any member can merge or delete an open PR', () => {
    renderPr(basePr, viewer)
    expect(screen.getByRole('button', { name: 'Mark merged' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('a merged PR offers undo merge instead of mark merged', () => {
    renderPr({ ...basePr, mergedAt: 2000, status: 'merged' }, viewer, true)
    expect(screen.getByRole('button', { name: 'Undo merge' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark merged' })).not.toBeInTheDocument()
  })
})
