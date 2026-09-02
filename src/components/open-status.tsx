"use client"

import { useMemo, useState } from "react"

const DAY_ORDER = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
]

interface ParsedDay {
  day: string
  hours: string
}

function parseHoursClient(hoursJson: string | null): ParsedDay[] {
  if (!hoursJson) return []
  try {
    const raw = typeof hoursJson === "string" ? JSON.parse(hoursJson) : hoursJson
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return DAY_ORDER.filter((d) => d in raw).map((d) => ({
        day: d,
        hours: raw[d].replace(/[\u2009\u202F\u00A0]/g, " ").trim(),
      }))
    }
    if (Array.isArray(raw)) {
      return raw
        .map((entry: string) => {
          const cleaned = entry.replace(/[\u2009\u202F\u00A0]/g, " ").trim()
          const colonIdx = cleaned.indexOf(":")
          if (colonIdx === -1) return null
          const dayStr = cleaned.slice(0, colonIdx).trim().toLowerCase()
          const hours = cleaned.slice(colonIdx + 1).trim()
          if (!DAY_ORDER.includes(dayStr)) return null
          return { day: dayStr, hours }
        })
        .filter(Boolean) as ParsedDay[]
    }
    return []
  } catch {
    return []
  }
}

function getChicagoDay(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(new Date()).toLowerCase()
}

function getChicagoTime(): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return { hours: h, minutes: m }
}

function isOpenNow(hoursJson: string | null): boolean | null {
  const parsed = parseHoursClient(hoursJson)
  if (parsed.length === 0) return null
  const today = getChicagoDay()
  const entry = parsed.find((p) => p.day === today)
  if (!entry) return null
  const lower = entry.hours.toLowerCase()
  if (lower === "closed") return false
  if (lower.includes("24 hours") || lower.includes("open 24")) return true

  const { hours: nowH, minutes: nowM } = getChicagoTime()
  const nowMin = nowH * 60 + nowM
  const ranges = entry.hours.split(",").map((s) => s.trim())

  for (const range of ranges) {
    const match = range.match(
      /(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*[–\-−]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i
    )
    if (!match) continue
    const [, sh, sm, sap, eh, em, eap] = match
    let startH = Number(sh)
    const startM = Number(sm || 0)
    let endH = Number(eh)
    const endM = Number(em || 0)
    if (sap?.toUpperCase() === "PM" && startH < 12) startH += 12
    if (sap?.toUpperCase() === "AM" && startH === 12) startH = 0
    if (eap?.toUpperCase() === "PM" && endH < 12) endH += 12
    if (eap?.toUpperCase() === "AM" && endH === 12) endH = 0

    const startMin = startH * 60 + startM
    const endMin = endH * 60 + endM

    if (endMin <= startMin) {
      if (nowMin >= startMin || nowMin <= endMin) return true
    } else {
      if (nowMin >= startMin && nowMin <= endMin) return true
    }
  }
  return false
}

export function OpenStatus({ hoursJson }: { hoursJson: string | null }) {
  const status = useMemo(() => isOpenNow(hoursJson), [hoursJson])

  if (status === null) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        status
          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${status ? "bg-green-500" : "bg-red-400"}`}
      />
      {status ? "Open Now" : "Closed"}
    </span>
  )
}

export function HoursTable({ hoursJson, defaultExpanded = false }: { hoursJson: string | null; defaultExpanded?: boolean }) {
  const parsed = useMemo(() => parseHoursClient(hoursJson), [hoursJson])
  const todayDay = getChicagoDay()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const DAY_LABELS: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  }

  if (parsed.length === 0) return null

  const todayEntry = parsed.find((p) => p.day === todayDay)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Collapsed: only today */}
      {!expanded && todayEntry && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-secondary/50"
        >
          <span className="font-medium text-foreground">
            {DAY_LABELS[todayEntry.day]}
            <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">Today</span>
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            {todayEntry.hours}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      )}

      {/* Expanded: full week */}
      {expanded && (
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Hours</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((entry) => (
              <tr
                key={entry.day}
                className={
                  entry.day === todayDay
                    ? "bg-brand-50 font-medium dark:bg-brand-950"
                    : ""
                }
              >
                <td className="px-4 py-2 text-foreground">
                  {DAY_LABELS[entry.day]}
                  {entry.day === todayDay && (
                    <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">
                      Today
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {entry.hours}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <button
                  onClick={() => setExpanded(false)}
                  className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Show less
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
