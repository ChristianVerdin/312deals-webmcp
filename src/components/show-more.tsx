"use client"

import { useState, type ReactNode } from "react"

interface ShowMoreProps {
  /** All items to render */
  items: ReactNode[]
  /** Number of items to show initially */
  initialCount?: number
  /** Label for the button (e.g. "deals", "venues") */
  noun?: string
}

/**
 * Renders a subset of items with a "Show more" button to reveal the rest.
 * Keeps DOM size small on initial load.
 */
export function ShowMore({
  items,
  initialCount = 50,
  noun = "items",
}: ShowMoreProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, initialCount)
  const remaining = items.length - initialCount

  return (
    <>
      {visible}
      {!showAll && remaining > 0 && (
        <div className="col-span-full flex justify-center pt-4">
          <button
            onClick={() => setShowAll(true)}
            className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Show {remaining} more {noun}
          </button>
        </div>
      )}
    </>
  )
}
