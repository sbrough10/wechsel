// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '@/components/ThemeToggle'

describe('ThemeToggle', () => {
  it('offers light, system, and dark', async () => {
    render(<ThemeToggle theme="system" resolvedTheme="light" onThemeChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }))
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument()
  })

  it('reports a new selection', async () => {
    const onThemeChange = vi.fn()
    render(<ThemeToggle theme="system" resolvedTheme="light" onThemeChange={onThemeChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('marks the active preference as checked', async () => {
    render(<ThemeToggle theme="dark" resolvedTheme="dark" onThemeChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }))
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'data-state',
      'checked',
    )
  })
})
