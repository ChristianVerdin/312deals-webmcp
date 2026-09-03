"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Bot, ExternalLink, Lock, Unlock, Moon, Trash2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type TonightStop } from "@/store/use-store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

function windowText(s: TonightStop) {
  if (s.isAllDay) return "All day"
  const parts = [s.startTime, s.endTime].filter(Boolean)
  return parts.length ? parts.join("–") : null
}

function ConstraintChips() {
  const c = useStore((s) => s.tonight.constraints)
  const chips = [
    c.neighborhood && c.neighborhood,
    c.budgetPerPerson != null && `$${c.budgetPerPerson}/person`,
    (c.startTime || c.endTime) && [c.startTime, c.endTime].filter(Boolean).join("–"),
    c.groupSize != null && `${c.groupSize} people`,
    c.maxStops != null && `max ${c.maxStops} stops`,
  ].filter(Boolean) as string[]
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
          {chip}
        </span>
      ))}
    </div>
  )
}

function StopRow({ stop, index, count }: { stop: TonightStop; index: number; count: number }) {
  const moveTonightStop = useStore((s) => s.moveTonightStop)
  const removeTonightStop = useStore((s) => s.removeTonightStop)
  const setTonightLocked = useStore((s) => s.setTonightLocked)
  const reservation = stop.resyUrl || stop.opentableUrl

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card p-3 transition-colors",
        stop.locked && "border-brand-500/60 bg-brand-50/40 dark:bg-brand-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {stop.venueSlug ? (
              <Link href={`/venues/${stop.venueSlug}`} className="truncate text-sm font-semibold text-foreground hover:text-brand-600">
                {stop.venueName}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">{stop.venueName}</span>
            )}
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                stop.addedBy === "agent" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-secondary text-muted-foreground"
              )}
              title={stop.addedBy === "agent" ? "Added by your agent" : "Added by you"}
            >
              {stop.addedBy === "agent" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {stop.addedBy === "agent" ? "agent" : "you"}
            </span>
          </div>
          {stop.dealTitle && <p className="mt-0.5 text-sm text-brand-600 dark:text-brand-400">{stop.dealTitle}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[stop.neighborhood, windowText(stop), stop.estimatedSavings != null && `save ~$${Math.round(stop.estimatedSavings)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {stop.note && <p className="mt-1 text-xs italic text-muted-foreground">“{stop.note}”</p>}
          {(reservation || stop.onlineOrderUrl) && (
            <div className="mt-1.5 flex gap-3">
              {reservation && (
                <a href={reservation} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Reserve
                </a>
              )}
              {stop.onlineOrderUrl && (
                <a href={stop.onlineOrderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Order
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <button
            onClick={() => setTonightLocked(stop.id, !stop.locked)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              stop.locked ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-secondary"
            )}
            aria-label={stop.locked ? "Unlock this stop" : "Lock this stop so the agent plans around it"}
            title={stop.locked ? "Locked — your agent can’t move or remove it" : "Lock this stop"}
          >
            {stop.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
          <div className="flex gap-0.5">
            <button
              onClick={() => moveTonightStop(stop.id, index - 1, { force: true })}
              disabled={index === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => moveTonightStop(stop.id, index + 1, { force: true })}
              disabled={index === count - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => removeTonightStop(stop.id, { force: true })}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-chi-red-600"
            aria-label="Remove stop"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}

export function TonightPanel() {
  const stops = useStore((s) => s.tonight.stops)
  const lastChangeBy = useStore((s) => s.tonight.lastChangeBy)
  const clearTonight = useStore((s) => s.clearTonight)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => setMounted(true), [])

  // Draw the eye when the agent changes the plan while the sheet is closed.
  useEffect(() => {
    if (!mounted || lastChangeBy !== "agent" || open) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 2500)
    return () => clearTimeout(t)
  }, [stops, lastChangeBy, open, mounted])

  if (!mounted) return null

  const lockedCount = stops.filter((s) => s.locked).length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:bottom-6",
          pulse && "animate-pulse ring-2 ring-sky-500"
        )}
        aria-label={`Open tonight's plan, ${stops.length} stops`}
      >
        <Moon className="h-4 w-4 text-brand-500" />
        Tonight
        <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background tabular-nums">{stops.length}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-brand-500" /> Tonight
            </SheetTitle>
            <SheetDescription>
              Your plan, built together. Your agent adds and orders stops; you drag, veto, and lock the ones that must stay.
            </SheetDescription>
          </SheetHeader>

          <ConstraintChips />

          {stops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Nothing planned yet.</p>
              <p className="mt-1">
                Add a deal from any card, or ask your agent: “Plan a 3-stop happy hour crawl in Wicker Park under $40.”
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {stops.map((stop, i) => (
                <StopRow key={stop.id} stop={stop} index={i} count={stops.length} />
              ))}
            </ol>
          )}

          {stops.length > 0 && (
            <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {lockedCount > 0 ? `${lockedCount} locked · your agent plans around them` : "Lock a stop to keep it fixed"}
              </span>
              <button onClick={() => clearTonight({ keepLocked: true, by: "you" })} className="font-medium text-foreground hover:underline">
                Clear unlocked
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
