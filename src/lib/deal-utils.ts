import type { Deal } from "./types"

const DEAL_TYPE_CONFIG: Record<
  string,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  happy_hour: {
    label: "Happy Hour",
    colorClass: "text-amber-700 dark:text-amber-400",
    bgClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    borderClass: "border-l-amber-400",
  },
  daily_special: {
    label: "Daily Special",
    colorClass: "text-blue-700 dark:text-blue-400",
    bgClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    borderClass: "border-l-blue-400",
  },
  brunch_deal: {
    label: "Brunch",
    colorClass: "text-orange-700 dark:text-orange-400",
    bgClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
    borderClass: "border-l-orange-400",
  },
  late_night: {
    label: "Late Night",
    colorClass: "text-purple-700 dark:text-purple-400",
    bgClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
    borderClass: "border-l-purple-400",
  },
  chain_app_deal: {
    label: "App Deal",
    colorClass: "text-green-700 dark:text-green-400",
    bgClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
    borderClass: "border-l-green-400",
  },
  game_day: {
    label: "Game Day",
    colorClass: "text-red-700 dark:text-red-400",
    bgClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    borderClass: "border-l-red-400",
  },
  seasonal_lto: {
    label: "Limited Time",
    colorClass: "text-pink-700 dark:text-pink-400",
    bgClass: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800",
    borderClass: "border-l-pink-400",
  },
  loyalty_reward: {
    label: "Loyalty",
    colorClass: "text-indigo-700 dark:text-indigo-400",
    bgClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-800",
    borderClass: "border-l-indigo-400",
  },
}

export function getDealTypeConfig(dealType: string) {
  return (
    DEAL_TYPE_CONFIG[dealType] ?? {
      label: dealType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      colorClass: "text-muted-foreground",
      bgClass: "bg-secondary text-secondary-foreground border-border",
      borderClass: "border-l-gray-400",
    }
  )
}

function getChicagoNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
  )
}

export function isDealActiveNow(deal: Deal): boolean {
  const now = getChicagoNow()
  const days = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ]
  const currentDay = days[now.getDay()]

  if (!deal.days_available || !deal.days_available.includes(currentDay)) {
    return false
  }

  if (deal.is_all_day) return true
  if (!deal.start_time || !deal.end_time) return true

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = deal.start_time.split(":").map(Number)
  const [endH, endM] = deal.end_time.split(":").map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

/** Returns "active" | "starts-soon" (within 2h) | null */
export function getDealTimeStatus(
  deal: Deal
): { status: "active" | "starts-soon"; label: string } | null {
  const now = getChicagoNow()
  const days = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ]
  const currentDay = days[now.getDay()]

  if (!deal.days_available || !deal.days_available.includes(currentDay)) {
    return null
  }

  if (deal.is_all_day) return { status: "active", label: "Active Now" }
  if (!deal.start_time || !deal.end_time) return { status: "active", label: "Active Now" }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = deal.start_time.split(":").map(Number)
  const [endH, endM] = deal.end_time.split(":").map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  const isActive =
    endMinutes < startMinutes
      ? currentMinutes >= startMinutes || currentMinutes <= endMinutes
      : currentMinutes >= startMinutes && currentMinutes <= endMinutes

  if (isActive) return { status: "active", label: "Active Now" }

  // Check if it starts within 2 hours
  let minutesUntilStart = startMinutes - currentMinutes
  if (minutesUntilStart < 0) minutesUntilStart += 24 * 60
  if (minutesUntilStart <= 120) {
    const hours = Math.floor(minutesUntilStart / 60)
    const mins = minutesUntilStart % 60
    const label =
      hours > 0
        ? `Starts in ${hours}h${mins > 0 ? ` ${mins}m` : ""}`
        : `Starts in ${mins}m`
    return { status: "starts-soon", label }
  }

  return null
}

export function formatDays(days: string[] | string | null | undefined): string {
  if (!days || !Array.isArray(days) || days.length === 0) return ""
  if (days.length === 7) return "Every day"

  const allDaysOrdered = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  const abbrev: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  }

  // Sort days into canonical week order
  const sorted = [...days].sort((a, b) => allDaysOrdered.indexOf(a) - allDaysOrdered.indexOf(b))

  // Check for consecutive day ranges (e.g., Tue-Sun, Mon-Fri, Mon-Sat)
  const startIdx = allDaysOrdered.indexOf(sorted[0])
  const endIdx = allDaysOrdered.indexOf(sorted[sorted.length - 1])
  const isConsecutive = sorted.length === endIdx - startIdx + 1

  if (isConsecutive && sorted.length >= 3) {
    return `${abbrev[sorted[0]]}-${abbrev[sorted[sorted.length - 1]]}`
  }

  // Special cases for exactly weekdays or weekend
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]
  const weekend = ["saturday", "sunday"]
  const hasAllWeekdays = weekdays.every((d) => days.includes(d))
  const hasAllWeekend = weekend.every((d) => days.includes(d))
  const hasOnlyWeekend = hasAllWeekend && sorted.length === 2

  if (hasAllWeekdays && !hasAllWeekend && sorted.length === 5) return "Mon-Fri"
  if (hasOnlyWeekend) return "Sat-Sun"

  return sorted.map((d) => abbrev[d] || d).join(", ")
}

export function formatTimeRange(
  startTime: string | null,
  endTime: string | null,
  isAllDay: number
): string {
  if (isAllDay) return "All day"
  if (!startTime || !endTime) return ""

  const format = (t: string) => {
    const parts = t.split(":").map(Number)
    const h = parts[0]
    const m = parts[1] ?? 0
    if (isNaN(h)) return ""
    const suffix = h >= 12 ? "PM" : "AM"
    const hour = h % 12 || 12
    return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, "0")}${suffix}`
  }

  return `${format(startTime)}-${format(endTime)}`
}

export function getTodayName(): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ]
  return days[new Date().getDay()]
}
