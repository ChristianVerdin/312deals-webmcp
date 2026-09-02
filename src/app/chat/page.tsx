"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Send,
  Sparkles,
  RotateCcw,
  MessageSquare,
  Info,
} from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import type { ChatMessage } from "@/hooks/use-chat"
import type { DealReference } from "@/lib/types"
import { Navbar } from "@/components/navbar"
import { trackAIChatSent } from "@/lib/analytics"
import { stats } from "@/lib/product-stats"

// Map free-text query → canonical deal_type so the Plausible funnel
// can split AI-chat conversion by intent (taco_tuesday vs happy_hour vs brunch).
function detectDealType(query: string): string {
  const q = query.toLowerCase()
  if (/\btaco|\$1 taco|taco tuesday\b/.test(q)) return "taco_tuesday"
  if (/\bwing(s)?|wing tuesday|wing wednesday\b/.test(q)) return "wing_deals"
  if (/\bhappy hour|after[- ]?work|drink special|cocktail\b/.test(q)) return "happy_hour"
  if (/\bbrunch|mimosa|bottomless\b/.test(q)) return "brunch_deals"
  if (/\blate night|after hours|2am|3am|4am\b/.test(q)) return "late_night"
  if (/\bgame day|cubs|sox|bears|bulls|hawks|wrigley|united center|soldier field\b/.test(q)) return "game_day"
  if (/\bpatio|outdoor|rooftop\b/.test(q)) return "patio"
  if (/\bchain|drive[- ]?thru|app deal|fast food\b/.test(q)) return "chain_deals"
  return "general"
}

// --- Helpers ---

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

type QuestionGroup = { label: string; questions: string[] }

const QUESTION_GROUPS: QuestionGroup[] = [
  {
    label: "Right Now",
    questions: [
      "Best happy hour in River North right now?",
      "Best pizza deal in the city tonight?",
      "What's good in Logan Square right now?",
    ],
  },
  {
    label: "By Neighborhood",
    questions: [
      "Patio happy hours in Wicker Park with cocktails under $10",
      "Cheapest happy hour in the West Loop?",
      "Late night tacos in Pilsen?",
      "Sushi happy hour in Lakeview tonight?",
    ],
  },
  {
    label: "Brunch",
    questions: [
      "Bottomless brunch in Lincoln Park this weekend?",
      "Sunday brunch with bottomless mimosas under $30?",
    ],
  },
  {
    label: "Game Day",
    questions: [
      "Cheap eats near Wrigley Field for the Cubs game?",
      "Game day specials with patios near United Center?",
    ],
  },
  {
    label: "Gluten-Free",
    questions: [
      "Gluten-free happy hour in the West Loop?",
      "Best gluten-free pizza in Chicago?",
      "GF brunch with bottomless mimosas this weekend?",
      "Gluten-free tacos in Wicker Park tonight?",
    ],
  },
  {
    label: "Suburbs",
    questions: [
      "Suburban deals near Naperville this week?",
    ],
  },
]

// Flattened version for any consumer that still wants the legacy flat list.
const POPULAR_QUESTIONS: string[] = QUESTION_GROUPS.flatMap((g) => g.questions)

// --- Sub-components ---

function TypingIndicator({ status }: { status?: string }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-brand-500" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
          </div>
          {status && <span className="text-xs text-gray-400 animate-fade-in">{status}</span>}
        </div>
      </div>
    </div>
  )
}

function InlineDealCard({ deal }: { deal: DealReference }) {
  const venueSlug = slugify(deal.venue_name)
  return (
    <Link
      href={`/venues/${venueSlug}`}
      className="block py-1.5 px-2 -mx-2 rounded transition hover:bg-white/[0.04] group"
    >
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm leading-snug">
        <span className="font-medium text-white group-hover:text-brand-500 transition">
          {deal.venue_name}
        </span>
        <span className="text-gray-500 text-xs">·</span>
        <span className="text-gray-300">{deal.title}</span>
        {deal.neighborhood && (
          <span className="text-gray-500 text-xs">· {deal.neighborhood}</span>
        )}
      </div>
    </Link>
  )
}

function DealReferencesList({ deals }: { deals: DealReference[] }) {
  if (!deals || deals.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.08]">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        Mentioned · tap to view venue
      </p>
      <div className="space-y-0">
        {deals.map((deal) => (
          <InlineDealCard key={deal.deal_id} deal={deal} />
        ))}
      </div>
    </div>
  )
}

function formatMessageContent(content: string): React.ReactNode {
  const paragraphs = content.split(/\n{2,}/)
  return paragraphs.map((para, i) => {
    const trimmedPara = para.trim()

    // "---" on its own line = recommendation separator (thin amber divider)
    if (/^-{3,}$|^_{3,}$/.test(trimmedPara)) {
      return (
        <div
          key={i}
          className="my-4 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent"
          aria-hidden="true"
        />
      )
    }

    const lines = para.split("\n")
    const elements = lines.map((line, j) => {
      const trimmed = line.trim()

      // Inline parser: handles **bold** AND [text](/internal-path) links.
      // External URLs are stripped (rendered as plain text), only same-site
      // paths starting with "/" are linkified to prevent injection.
      const parts = trimmed.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
      const formatted = parts.map((part, k) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={k} className="font-semibold text-brand-500">
              {part.slice(2, -2)}
            </strong>
          )
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
          const [, text, href] = linkMatch
          if (href.startsWith("/")) {
            return (
              <a
                key={k}
                href={href}
                className="font-semibold text-brand-500 underline decoration-brand-500/40 underline-offset-2 hover:decoration-brand-500"
              >
                {text}
              </a>
            )
          }
          return text
        }
        return part
      })

      if (/^[-•]/.test(trimmed)) {
        return (
          <li key={j} className="ml-4 list-disc text-gray-300">
            {formatted.map((f) =>
              typeof f === "string" ? f.replace(/^[-•]\s*/, "") : f
            )}
          </li>
        )
      }
      if (/^\d+[.)]/.test(trimmed)) {
        return (
          <li key={j} className="ml-4 list-decimal text-gray-300">
            {formatted.map((f) =>
              typeof f === "string" ? f.replace(/^\d+[.)]\s*/, "") : f
            )}
          </li>
        )
      }
      return (
        <span key={j}>
          {formatted}
          {j < lines.length - 1 && <br />}
        </span>
      )
    })

    const allList = lines.every((l) => /^\s*[-•]|^\s*\d+[.)]/.test(l.trim()))
    if (allList) {
      const isOrdered = lines.every((l) => /^\s*\d+[.)]/.test(l.trim()))
      return isOrdered ? (
        <ol key={i} className="space-y-1 my-1">
          {elements}
        </ol>
      ) : (
        <ul key={i} className="space-y-1 my-1">
          {elements}
        </ul>
      )
    }

    return (
      <p key={i} className={i > 0 ? "mt-3" : ""}>
        {elements}
      </p>
    )
  })
}

function MessageBubble({
  message,
  onSuggestionClick,
}: {
  message: ChatMessage
  onSuggestionClick: (text: string) => void
}) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-brand-500" />
        </div>
      )}

      <div className={`max-w-[85%] space-y-2 ${isUser ? "items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-brand-500 text-white rounded-tr-sm"
              : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
          }`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-line">
            {isUser ? message.content : formatMessageContent(message.content)}
          </div>
        </div>

        {message.deals_referenced && message.deals_referenced.length > 0 && (
          <DealReferencesList deals={message.deals_referenced} />
        )}

        {message.follow_up_suggestions &&
          message.follow_up_suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.follow_up_suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSuggestionClick(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-brand-500/30 text-brand-500 hover:bg-brand-500/10 transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

// --- Sidebar ---

function ChatSidebar({
  onQuestionClick,
}: {
  onQuestionClick: (text: string) => void
}) {
  return (
    <div className="space-y-6">
      {/* Popular Questions, grouped */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <MessageSquare className="h-4 w-4 text-brand-500" />
          Popular Questions
        </h3>
        <div className="space-y-4">
          {QUESTION_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1 px-3">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onQuestionClick(q)}
                    className="w-full text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Info className="h-4 w-4 text-brand-500" />
          About
        </h3>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Powered by{" "}
            <span className="text-brand-500 font-medium">312Deals</span> AI.
            Searches a live database of{" "}
            <span className="text-white font-medium">{stats.deals} deals</span> across{" "}
            <span className="text-white font-medium">{stats.venues} venues</span> in{" "}
            <span className="text-white font-medium">Chicago and 60+ suburbs</span>.
            Pulls from a live database with near real-time access to find the best deals for you.
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function ChatPage() {
  const { messages, loading, streamingStatus, sendMessage, clearChat } = useChat()
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const didInitFromUrl = useRef(false)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  // Deep-link: /chat?q=<question> auto-asks once on load (the homepage "Ask the
  // AI" prompt chips link here). Read from location.search to avoid the
  // useSearchParams() Suspense requirement on this client page.
  useEffect(() => {
    if (didInitFromUrl.current) return
    const q = new URLSearchParams(window.location.search).get("q")?.trim()
    if (!q) return
    didInitFromUrl.current = true
    // B1 bot-gate: only auto-fire the (Claude-billed) completion when the visit
    // came from our own site — a human clicking a /chat?q= prompt chip carries a
    // same-origin referrer. Crawlers hit the URL directly with no such referrer
    // (~91% of /chat traffic per the S55 forensics); for them, just prefill the
    // box so a real visitor can still send it, without spending on a bot.
    const fromOurSite =
      typeof document !== "undefined" &&
      !!document.referrer &&
      document.referrer.startsWith(window.location.origin)
    if (!fromOurSite) {
      setInput(q)
      return
    }
    trackAIChatSent({ turn: 1, deal_type: detectDealType(q), query_length: q.length })
    // noFallback: the auto-ask must never resend via the JSON endpoint, that
    // doubled Claude spend whenever a client (typically a crawler) couldn't
    // consume the SSE stream. Humans can retype if the stream genuinely fails.
    sendMessage(q, { noFallback: true })
  }, [sendMessage])

  // Count of user-authored messages already in this session.
  // Used to attribute "turn" on the AI Chat Sent event so the funnel
  // can distinguish first-message conversions from follow-ups.
  const userTurnCount = messages.filter((m) => m.role === "user").length

  const handleSend = () => {
    if (!input.trim() || loading) return
    const query = input.trim()
    trackAIChatSent({
      turn: userTurnCount + 1,
      deal_type: detectDealType(query),
      query_length: query.length,
    })
    sendMessage(query)
    setInput("")
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
  }

  const handleSuggestionClick = (text: string) => {
    if (loading) return
    trackAIChatSent({
      turn: userTurnCount + 1,
      deal_type: detectDealType(text),
      query_length: text.length,
    })
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <Navbar />
      {/* -mb-16 md:mb-0 cancels root layout's pb-16 since bottom nav is hidden on /chat */}
      <div className="dark flex -mb-16 md:mb-0 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] overflow-hidden bg-[#1A1A2E] text-white">
        {/* Chat Thread */}
        <div className="flex-1 lg:w-[65%] flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h1 className="font-semibold text-white">Chicago Deals AI Guide</h1>
            </div>
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}
            {loading && <TypingIndicator status={streamingStatus} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar, safe-bottom for iOS home indicator */}
          <div className="border-t border-white/10 px-4 lg:px-6 py-3 safe-bottom">
            <div className="flex items-end gap-3 max-w-3xl">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about deals, restaurants, or neighborhoods..."
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-brand-500/50 transition"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-brand-500 text-white p-3 rounded-xl hover:bg-brand-400 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 ml-1 hidden sm:block">
              AI-powered recommendations from real Chicago deal data. Shift+Enter for new line.
            </p>
          </div>
        </div>

        {/* Sidebar, 35% desktop, hidden mobile */}
        <div className="hidden lg:block w-[35%] border-l border-white/10 overflow-y-auto px-5 py-4">
          <ChatSidebar onQuestionClick={handleSuggestionClick} />
        </div>
      </div>
    </>
  )
}
