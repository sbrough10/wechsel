// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityGate } from '@/components/IdentityGate'
import { useCreateMember } from '@/hooks/useCreateMember'
import { useMembers } from '@/hooks/useMembers'
import type { MemberView } from '@shared/types'

vi.mock('@/hooks/useMembers', () => ({
  useMembers: vi.fn(),
}))

vi.mock('@/hooks/useCreateMember', () => ({
  useCreateMember: vi.fn(),
}))

const mockedUseMembers = vi.mocked(useMembers)
const mockedUseCreateMember = vi.mocked(useCreateMember)

const ada: MemberView = {
  id: 'm-ada',
  displayName: 'Ada Lovelace',
  nameKey: 'ada lovelace',
  createdAt: 1,
  removedAt: null,
}

const grace: MemberView = {
  id: 'm-grace',
  displayName: 'Grace Hopper',
  nameKey: 'grace hopper',
  createdAt: 2,
  removedAt: null,
}

const membersQuery = (data: MemberView[]) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
})

describe('IdentityGate', () => {
  beforeEach(() => {
    mockedUseMembers.mockReturnValue(membersQuery([ada, grace]) as never)
    mockedUseCreateMember.mockReturnValue({ mutate: vi.fn() } as never)
  })

  it('offers the existing team names', () => {
    render(<IdentityGate onSelected={vi.fn()} />)
    expect(screen.getByText('Who are you?')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('picking an existing name selects it', async () => {
    const onSelected = vi.fn()
    render(<IdentityGate onSelected={onSelected} />)
    await userEvent.click(screen.getByText('Ada Lovelace'))
    expect(onSelected).toHaveBeenCalledWith(ada)
  })

  it('lets a visitor type a brand-new name and join', async () => {
    const katherine: MemberView = {
      id: 'm-katherine',
      displayName: 'Katherine Johnson',
      nameKey: 'katherine johnson',
      createdAt: 4,
      removedAt: null,
    }
    const mutate = vi.fn((_name: string, options: { onSuccess?: (m: MemberView) => void }) =>
      options.onSuccess?.(katherine),
    )
    mockedUseCreateMember.mockReturnValue({ mutate } as never)
    const onSelected = vi.fn()
    render(<IdentityGate onSelected={onSelected} />)
    await userEvent.type(screen.getByPlaceholderText('Your name…'), 'Katherine Johnson')
    await userEvent.click(screen.getByRole('option', { name: /Katherine Johnson/ }))
    expect(mutate).toHaveBeenCalledWith('Katherine Johnson', expect.anything())
    expect(onSelected).toHaveBeenCalledWith(katherine)
  })
})
