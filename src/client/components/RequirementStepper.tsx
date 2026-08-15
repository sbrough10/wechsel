import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RequirementStepper({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const set = (next: number) => onChange(Math.min(10, Math.max(0, next)))
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        disabled={disabled || value <= 0}
        onClick={() => set(value - 1)}
        aria-label={`Decrease ${label}`}
      >
        <Minus />
      </Button>
      <span className="min-w-6 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        disabled={disabled || value >= 10}
        onClick={() => set(value + 1)}
        aria-label={`Increase ${label}`}
      >
        <Plus />
      </Button>
    </div>
  )
}
