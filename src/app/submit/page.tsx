"use client"

import { useState } from "react"
import {
  Send,
  CheckCircle,
  MapPin,
  Tag,
  Mail,
  FileText,
  Building,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackDealSubmitted } from "@/lib/analytics"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getDealTypeConfig } from "@/lib/deal-utils"

const DEAL_TYPES = [
  "happy_hour",
  "daily_special",
  "brunch_deal",
  "late_night",
  "chain_app_deal",
  "game_day",
  "seasonal_lto",
  "loyalty_reward",
]

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
]

interface FormState {
  venue_name: string
  venue_address: string
  deal_title: string
  deal_description: string
  deal_type: string
  days: string[]
  start_time: string
  end_time: string
  is_all_day: boolean
  source_url: string
  submitter_email: string
}

const initialForm: FormState = {
  venue_name: "",
  venue_address: "",
  deal_title: "",
  deal_description: "",
  deal_type: "",
  days: [],
  start_time: "",
  end_time: "",
  is_all_day: false,
  source_url: "",
  submitter_email: "",
}

function FormField({
  label,
  required,
  icon: Icon,
  hint,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  icon?: React.ComponentType<{ className?: string }>
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {required && <span className="text-brand-500" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day)
        ? f.days.filter((d) => d !== day)
        : [...f.days, day],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Detect AI agent submissions via WebMCP SubmitEvent.agentInvoked
    // NOTE: respondWith() does NOT exist in Chrome Canary 147 (empirically verified 2026-02-19).
    // Agent submissions go through the normal form path for now.
    const nativeEvent = e.nativeEvent as SubmitEvent & { agentInvoked?: boolean }
    if (nativeEvent.agentInvoked) {
      // Agent-invoked: proceed with normal submission flow (no respondWith available)
      console.log('[312Deals] Agent-invoked form submission detected')
    }

    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Submission failed")
      }

      trackDealSubmitted({ deal_type: form.deal_type })
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-8 lg:px-6 lg:py-12">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Send className="h-7 w-7 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              Submit a Deal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground lg:text-base">
              {"Know a great deal? Share it with the 312Deals community. We'll review and add it within 24 hours."}
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Thanks for your submission!
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {"We'll review your deal and add it to 312Deals if it checks out. You'll get an email notification if you provided one."}
              </p>
              <button
                onClick={() => {
                  setSuccess(false)
                  setForm(initialForm)
                }}
                className="mt-6 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Submit another deal
              </button>
            </div>
          ) : (
            <form
              id="deal-submit-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 lg:p-6"
            >
              {/* Section: Venue info */}
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Venue Information
                </span>
              </div>

              <FormField label="Venue Name" required icon={Building} htmlFor="venue_name">
                <input
                  id="venue_name"
                  type="text"
                  name="venue_name"
                  required
                  value={form.venue_name}
                  onChange={(e) => updateField("venue_name", e.target.value)}
                  placeholder="e.g. Fatpour Tap Works"
                  className={inputClasses}
                />
              </FormField>

              <FormField
                label="Venue Address"
                icon={MapPin}
                hint="Include full street address if known."
                htmlFor="venue_address"
              >
                <input
                  id="venue_address"
                  type="text"
                  value={form.venue_address}
                  onChange={(e) =>
                    updateField("venue_address", e.target.value)
                  }
                  placeholder="e.g. 2005 W Division St, Chicago, IL"
                  className={inputClasses}
                />
              </FormField>

              {/* Section: Deal info */}
              <div className="mt-2 flex items-center gap-2 border-b border-border pb-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Deal Details
                </span>
              </div>

              <FormField label="Deal Title" required icon={Tag} htmlFor="deal_title">
                <input
                  id="deal_title"
                  type="text"
                  required
                  value={form.deal_title}
                  onChange={(e) => updateField("deal_title", e.target.value)}
                  placeholder="e.g. Half-Price Burgers & $5 Drafts"
                  className={inputClasses}
                />
              </FormField>

              <FormField
                label="Description"
                required
                icon={FileText}
                hint="Include prices, items, and any restrictions."
                htmlFor="deal_description"
              >
                <textarea
                  id="deal_description"
                  name="deal_description"
                  required
                  rows={4}
                  value={form.deal_description}
                  onChange={(e) =>
                    updateField("deal_description", e.target.value)
                  }
                  placeholder="Describe the deal: what's discounted, prices, restrictions..."
                  className={cn(inputClasses, "resize-none")}
                />
              </FormField>

              <FormField label="Deal Type" icon={Tag}>
                <div className="flex flex-wrap gap-2">
                  {DEAL_TYPES.map((t) => {
                    const config = getDealTypeConfig(t)
                    const isSelected = form.deal_type === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          updateField("deal_type", isSelected ? "" : t)
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          isSelected
                            ? config.bgClass
                            : "border-border bg-background text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </FormField>

              {/* Days available */}
              <FormField label="Days Available">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const isSelected = form.days.includes(d.value)
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          "flex h-9 w-11 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                          isSelected
                            ? "border-brand-300 bg-brand-50 text-brand-700"
                            : "border-border bg-background text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </FormField>

              {/* Time range */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FormField label="Start Time" htmlFor="start_time">
                    <input
                      id="start_time"
                      type="time"
                      value={form.start_time}
                      onChange={(e) =>
                        updateField("start_time", e.target.value)
                      }
                      disabled={form.is_all_day}
                      className={cn(
                        inputClasses,
                        form.is_all_day && "opacity-50"
                      )}
                    />
                  </FormField>
                </div>
                <span className="pb-2.5 text-sm text-muted-foreground">
                  to
                </span>
                <div className="flex-1">
                  <FormField label="End Time" htmlFor="end_time">
                    <input
                      id="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={(e) =>
                        updateField("end_time", e.target.value)
                      }
                      disabled={form.is_all_day}
                      className={cn(
                        inputClasses,
                        form.is_all_day && "opacity-50"
                      )}
                    />
                  </FormField>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_all_day}
                  onChange={(e) =>
                    updateField("is_all_day", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/20"
                />
                <span className="text-sm text-foreground">
                  All day deal
                </span>
              </label>

              {/* Source URL */}
              <FormField
                label="Source URL"
                icon={Info}
                hint="Link to menu, social media post, or website with the deal."
                htmlFor="source_url"
              >
                <input
                  id="source_url"
                  type="url"
                  value={form.source_url}
                  onChange={(e) => updateField("source_url", e.target.value)}
                  placeholder="https://..."
                  className={inputClasses}
                />
              </FormField>

              {/* Section: Contact */}
              <div className="mt-2 flex items-center gap-2 border-b border-border pb-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Info
                </span>
              </div>

              <FormField
                label="Email"
                icon={Mail}
                hint="Optional. We'll only use this to follow up if we have questions."
                htmlFor="submitter_email"
              >
                <input
                  id="submitter_email"
                  type="email"
                  value={form.submitter_email}
                  onChange={(e) =>
                    updateField("submitter_email", e.target.value)
                  }
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </FormField>

              {/* Error */}
              {error && (
                <div role="alert" aria-live="polite" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Deal
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                {"By submitting, you confirm this is a real deal you've personally verified."}
              </p>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
