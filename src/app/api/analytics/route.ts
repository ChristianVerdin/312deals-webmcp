import { NextRequest, NextResponse } from "next/server"
import {
  getAggregate,
  getTopPages,
  getTrafficSources,
  getDailyVisitors,
  getTopEntryPages,
  getDeviceBreakdown,
  getCityBreakdown,
  getChannelBreakdown,
  type DateRange,
} from "@/lib/plausible"

/**
 * GET /api/analytics, Admin-only analytics dashboard data
 * Requires ADMIN_API_KEY as Bearer token or ?key= query param.
 *
 * Query params:
 *   range: DateRange (default "30d")
 *   report: "summary" | "pages" | "sources" | "timeseries" | "all" (default "summary")
 */
export async function GET(req: NextRequest) {
  // Auth check
  const adminKey = process.env.ADMIN_API_KEY
  const authHeader = req.headers.get("authorization")
  const queryKey = req.nextUrl.searchParams.get("key")
  const providedKey = authHeader?.replace("Bearer ", "") || queryKey

  if (!adminKey || providedKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const range = (req.nextUrl.searchParams.get("range") || "30d") as DateRange
  const report = req.nextUrl.searchParams.get("report") || "summary"

  try {
    if (report === "summary") {
      const aggregate = await getAggregate(range)
      return NextResponse.json(aggregate)
    }

    if (report === "pages") {
      const pages = await getTopPages(range)
      return NextResponse.json({ pages })
    }

    if (report === "sources") {
      const sources = await getTrafficSources(range)
      const channels = await getChannelBreakdown(range)
      return NextResponse.json({ sources, channels })
    }

    if (report === "timeseries") {
      const daily = await getDailyVisitors(range)
      return NextResponse.json({ daily })
    }

    if (report === "all") {
      const [aggregate, pages, sources, channels, daily, entries, devices, cities] =
        await Promise.all([
          getAggregate(range),
          getTopPages(range),
          getTrafficSources(range),
          getChannelBreakdown(range),
          getDailyVisitors(range),
          getTopEntryPages(range),
          getDeviceBreakdown(range),
          getCityBreakdown(range),
        ])
      return NextResponse.json({
        aggregate,
        pages,
        sources,
        channels,
        daily,
        entries,
        devices,
        cities,
      })
    }

    return NextResponse.json(
      { error: "Invalid report type. Use: summary, pages, sources, timeseries, all" },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
