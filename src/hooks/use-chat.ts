"use client"

import { useState, useCallback, useRef } from "react"
import type { ChatResponse, DealReference } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  deals_referenced?: DealReference[]
  follow_up_suggestions?: string[]
  timestamp: number
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    `Hey! I'm your Chicago deals guide. I know every happy hour, daily special, and late-night bite across ${stats.neighborhoods} neighborhoods, city and suburbs. Try asking:\n\n\"Best happy hour in River North right now?\"`,
  follow_up_suggestions: [
    "Best happy hour in River North?",
    "Late night tacos in Pilsen?",
    "Brunch deals in Lincoln Park?",
  ],
  timestamp: Date.now(),
}

// Stable per-tab session id so the backend can group every message in a
// chat thread together for analytics. Resets if the user clicks "New Chat".
function makeSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  // Tool-loop progress shown in the typing indicator while streaming
  // ("Searching West Loop…") before the answer's first token arrives.
  const [streamingStatus, setStreamingStatus] = useState("")
  const sessionIdRef = useRef<string>(makeSessionId())
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (text: string, opts?: { noFallback?: boolean }) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      // Build conversation_history from existing messages (exclude welcome)
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setStreamingStatus("")

      const body = JSON.stringify({
        message: trimmed,
        conversation_history: history,
        session_id: sessionIdRef.current,
        referrer:
          typeof document !== "undefined"
            ? document.referrer || (typeof window !== "undefined" ? window.location.pathname : null)
            : null,
      })

      abortRef.current = new AbortController()
      const signal = abortRef.current.signal

      // Non-streaming fallback (also the path API/MCP consumers use).
      const runFallback = async () => {
        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal,
        })
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data: ChatResponse = await res.json()
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.response,
            deals_referenced: data.deals_referenced?.length > 0 ? data.deals_referenced : undefined,
            follow_up_suggestions: data.follow_up_suggestions?.length > 0 ? data.follow_up_suggestions : undefined,
            timestamp: Date.now(),
          },
        ])
      }

      let inserted = false
      try {
        const res = await fetch("/api/v1/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal,
        })
        if (!res.ok || !res.body) throw new Error("stream unavailable")

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        const assistantId = `assistant-${Date.now()}`
        let buffer = ""
        let acc = ""

        const upsert = (patch: Partial<ChatMessage>) => {
          setMessages((prev) => {
            if (!inserted) {
              inserted = true
              return [
                ...prev,
                { id: assistantId, role: "assistant", content: acc, timestamp: Date.now(), ...patch },
              ]
            }
            return prev.map((m) => (m.id === assistantId ? { ...m, content: acc, ...patch } : m))
          })
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() ?? ""
          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith("data:")) continue
            const payload = line.slice(5).trim()
            if (!payload) continue
            let evt: { type: string; text?: string; deals_referenced?: DealReference[]; follow_up_suggestions?: string[] }
            try {
              evt = JSON.parse(payload)
            } catch {
              continue
            }
            if (evt.type === "status") {
              setStreamingStatus(evt.text || "")
            } else if (evt.type === "delta") {
              acc += evt.text || ""
              if (!inserted) {
                setLoading(false)
                setStreamingStatus("")
              }
              upsert({})
            } else if (evt.type === "done") {
              setLoading(false)
              setStreamingStatus("")
              upsert({
                deals_referenced: evt.deals_referenced?.length ? evt.deals_referenced : undefined,
                follow_up_suggestions: evt.follow_up_suggestions?.length ? evt.follow_up_suggestions : undefined,
              })
            } else if (evt.type === "error") {
              throw new Error("stream error event")
            }
          }
        }

        // Stream produced nothing usable → fall back to the JSON endpoint.
        // noFallback (the /chat?q= auto-ask path) skips the resend: the stream
        // request already cost a full Claude call server-side, and re-posting
        // the same query doubles spend, the main victims were JS-rendering
        // crawlers whose SSE handling never yields deltas (84 dupe pairs/wk).
        if (!inserted && !opts?.noFallback) await runFallback()
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        // Partial stream already rendered → keep it, don't duplicate via fallback.
        if (inserted) return
        try {
          if (opts?.noFallback) throw err
          await runFallback()
        } catch (err2) {
          if (err2 instanceof DOMException && err2.name === "AbortError") return
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              content:
                "Sorry, I'm having trouble connecting right now. Try again in a moment, or browse deals by neighborhood!",
              timestamp: Date.now(),
            },
          ])
        }
      } finally {
        setLoading(false)
        setStreamingStatus("")
        abortRef.current = null
      }
    },
    [messages, loading]
  )

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
    setLoading(false)
    setStreamingStatus("")
    // Fresh session id so analytics treats this as a new conversation
    sessionIdRef.current = makeSessionId()
  }, [])

  return { messages, loading, streamingStatus, sendMessage, clearChat }
}
