import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { MemberView, PullRequestView } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PrCard } from './PrCard'

const DEFAULT_VISIBLE = 20

export function MergedPrList({
  prs,
  viewer,
}: {
  prs: PullRequestView[]
  viewer: MemberView
}) {
  const [showAll, setShowAll] = useState(false)

  if (prs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing merged yet.
      </p>
    )
  }

  const visible = showAll ? prs : prs.slice(0, DEFAULT_VISIBLE)

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group/merged gap-1.5 px-2">
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-data-[state=open]/merged:rotate-180"
          />
          Recently merged ({prs.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">
        {visible.map((pr) => (
          <PrCard key={pr.id} pr={pr} viewer={viewer} merged />
        ))}
        {prs.length > DEFAULT_VISIBLE && !showAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="mx-auto block"
          >
            Show all {prs.length} merged
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
