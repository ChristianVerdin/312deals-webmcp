"use client"

import { useEffect, useRef } from "react"

export function WebMCPProvider() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    import("@/webmcp/index.js")
      .then(({ init312DealsWebMCP, teardown312DealsWebMCP }) => {
        init312DealsWebMCP({
          analytics: true,
          declarativeForms: true,
          humanInTheLoop: true,
          softNavigations: true,
          debug: process.env.NODE_ENV === "development",
        }).then((result) => {
          if (result.registered > 0) {
            console.log(
              `[312Deals WebMCP] ${result.registered} tools registered (${result.detectionSource})`
            )
          }
        })
      })
      .catch(() => {
        // WebMCP module not available, degrade gracefully
      })

    return () => {
      import("@/webmcp/index.js")
        .then(({ teardown312DealsWebMCP }) => {
          teardown312DealsWebMCP()
        })
        .catch(() => {})
      initRef.current = false
    }
  }, [])

  return null
}
