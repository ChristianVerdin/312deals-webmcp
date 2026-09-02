import { useState, useEffect } from "react"

let cachedKey: string | null = null

/**
 * Fetches the Google Maps API key from the server-side API route.
 * Caches the result in memory so subsequent calls don't re-fetch.
 */
export function useMapsKey() {
  const [key, setKey] = useState<string>(cachedKey ?? "")
  const [loading, setLoading] = useState(cachedKey === null)

  useEffect(() => {
    if (cachedKey !== null) {
      setKey(cachedKey)
      setLoading(false)
      return
    }

    fetch("/api/maps-config")
      .then((res) => res.json())
      .then((data) => {
        cachedKey = data.key ?? ""
        setKey(cachedKey ?? "")
      })
      .catch(() => {
        cachedKey = ""
        setKey("")
      })
      .finally(() => setLoading(false))
  }, [])

  return { key, loading }
}
