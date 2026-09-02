"use client"

import { useEffect } from "react"
import { cacheWeatherBucket } from "@/lib/analytics-props"

/**
 * Fires once per browser session: fetch today's Chicago high from Open-Meteo
 * (free, no API key) and cache the temperature bucket for getCommonProps().
 *
 * Why this exists: weather_bucket was wired into common props since the
 * analytics-props.ts launch, but cacheWeatherBucket() had no caller, every
 * Plausible event carried weather_bucket="unknown". The May 14-19 6-day
 * analytics overlay had to be done manually via the Open-Meteo archive API
 * instead of native Plausible joins. Wiring this primes the bucket so all
 * future analytics can natively filter by hot_warm/mild/cold.
 *
 * Gating: sessionStorage flag ensures one Open-Meteo call per session, then
 * subsequent navigations reuse the 6-hour localStorage cache from
 * cacheWeatherBucket().
 */

const SESSION_KEY = "_312d_weather_init"
const CHICAGO_LAT = 41.88
const CHICAGO_LON = -87.63

export function WeatherBucketInit() {
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // Storage may be blocked (private mode, embedded webview). Skip.
      return
    }

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${CHICAGO_LAT}&longitude=${CHICAGO_LON}&daily=temperature_2m_max&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const highF: number | undefined = data?.daily?.temperature_2m_max?.[0]
        if (typeof highF === "number" && Number.isFinite(highF)) {
          cacheWeatherBucket(highF)
        }
      })
      .catch(() => {
        // Open-Meteo down or network blocked. weather_bucket stays "unknown".
      })
  }, [])

  return null
}
