// Reservation links that carry the plan with them. OpenTable's restref links
// accept dateTime (YYYY-MM-DDTHH:MM) and covers; Resy venue links accept
// date and seats. Without these the booking page opens on its own default
// (typically 7 PM for 2), which is not what the person planned.

export interface ReservationOpts {
  date?: string | null // YYYY-MM-DD, defaults to today in Chicago
  time?: string | null // "18:00", "6pm", "6:30 PM"
  partySize?: number | null
}

export interface ReservationLink {
  url: string
  platform: "OpenTable" | "Resy"
  date: string
  time: string | null
  partySize: number
}

export function todayInChicago(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function normalizeTime(input: string | null | undefined): string | null {
  if (!input) return null
  const s = String(input).trim().toLowerCase()
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(s)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const ap = m[3]?.replace(/\./g, "")
  if (ap === "pm" && h < 12) h += 12
  if (ap === "am" && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export function reservationLink(
  venue: { opentableUrl?: string | null; resyUrl?: string | null; opentable_url?: string | null; resy_url?: string | null },
  opts: ReservationOpts = {}
): ReservationLink | null {
  const opentable = venue.opentableUrl ?? venue.opentable_url ?? null
  const resy = venue.resyUrl ?? venue.resy_url ?? null
  const raw = resy || opentable
  if (!raw) return null

  const date = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayInChicago()
  const time = normalizeTime(opts.time)
  const partySize = opts.partySize && opts.partySize > 0 ? Math.floor(opts.partySize) : 2

  let url: URL
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
  } catch {
    return null
  }

  if (resy) {
    url.searchParams.set("date", date)
    url.searchParams.set("seats", String(partySize))
    return { url: url.toString(), platform: "Resy", date, time, partySize }
  }

  url.searchParams.set("covers", String(partySize))
  if (time) url.searchParams.set("dateTime", `${date}T${time}`)
  return { url: url.toString(), platform: "OpenTable", date, time, partySize }
}
