"use client"

import { useEffect, useState, useCallback } from "react"
import { Navbar } from "@/components/navbar"

type DetectionResult = {
  source: string
  has_model_context: boolean
  is_polyfill: boolean
  chrome_version: string
  testing_api: boolean
  recommendation: string
}

type SchemaValidation = {
  tool_name: string
  valid: boolean
  issues: string[]
  quality_score: number
}

type ExecutionTest = {
  case: string
  params: Record<string, unknown>
  passed: boolean
  duration_ms?: number
  response_size?: number
  error?: string
}

type ToolTestResult = {
  tool_name: string
  registration_type: string
  schema_validation: SchemaValidation
  execution_tests: ExecutionTest[]
}

type FormValidation = {
  formId: string
  found: boolean
  valid?: boolean
  toolName?: string | null
  inputsWithDesc?: number
  inputsWithoutDesc?: number
  issues: string[]
}

type AnalyticsSummary = {
  total_calls?: number
  tools?: { tool_name: string; call_count: number; avg_duration_ms: number }[]
  error?: string
}

export default function WebMCPInspectorPage() {
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [schemaResults, setSchemaResults] = useState<SchemaValidation[]>([])
  const [testResults, setTestResults] = useState<ToolTestResult[]>([])
  const [formResults, setFormResults] = useState<FormValidation[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [running, setRunning] = useState(false)
  const [testRunning, setTestRunning] = useState(false)

  useEffect(() => {
    runDetection()
    runSchemaValidation()
    runFormValidation()
    fetchAnalytics()
  }, [])

  async function runDetection() {
    try {
      const { validateDetection } = await import("@/webmcp/webmcp_inspector.js")
      setDetection(validateDetection() as DetectionResult)
    } catch {
      setDetection({ source: "error", has_model_context: false, is_polyfill: false, chrome_version: "unknown", testing_api: false, recommendation: "Failed to load inspector module" })
    }
  }

  async function runSchemaValidation() {
    try {
      const { TOOLS } = await import("@/webmcp/webmcp_tools.js")
      const { validateToolSchema } = await import("@/webmcp/webmcp_inspector.js")
      setSchemaResults(TOOLS.map((t: Record<string, unknown>) => validateToolSchema(t)))
    } catch { /* module unavailable */ }
  }

  async function runFormValidation() {
    try {
      const { validateDeclarativeForms } = await import("@/webmcp/webmcp_inspector.js")
      setFormResults(validateDeclarativeForms(["deal-search-form", "deal-submit-form"]) as FormValidation[])
    } catch { /* module unavailable */ }
  }

  async function fetchAnalytics() {
    try {
      const resp = await fetch("/api/v1/analytics/webmcp/summary")
      if (resp.ok) setAnalytics(await resp.json())
      else setAnalytics({ error: `${resp.status} ${resp.statusText}` })
    } catch {
      setAnalytics({ error: "Backend unreachable" })
    }
  }

  const runTests = useCallback(async () => {
    setTestRunning(true)
    try {
      const { TOOLS } = await import("@/webmcp/webmcp_tools.js")
      const { runToolTests } = await import("@/webmcp/webmcp_inspector.js")
      const results = await runToolTests(TOOLS)
      setTestResults(results)
    } catch { /* module unavailable */ }
    setTestRunning(false)
  }, [])

  const avgScore = schemaResults.length > 0
    ? Math.round(schemaResults.reduce((s, r) => s + r.quality_score, 0) / schemaResults.length)
    : 0

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-bold text-foreground">WebMCP Inspector</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Debug and test WebMCP tool registration, schema quality, and declarative forms.
          </p>

          {/* Detection */}
          <Section title="Detection">
            {detection ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Source" value={detection.source} color={detection.source === "native" ? "green" : detection.source === "polyfill" ? "yellow" : "red"} />
                <Stat label="Chrome" value={`v${detection.chrome_version}`} />
                <Stat label="modelContext" value={detection.has_model_context ? "Available" : "Missing"} color={detection.has_model_context ? "green" : "red"} />
                <Stat label="Testing API" value={detection.testing_api ? "Yes" : "No"} />
                <Stat label="Polyfill" value={detection.is_polyfill ? "Yes" : "No"} />
                <div className="col-span-2 sm:col-span-1 text-xs text-muted-foreground">{detection.recommendation}</div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading...</p>}
          </Section>

          {/* Schema Validation */}
          <Section title={`Tool Schemas (${schemaResults.length} tools, avg ${avgScore}/100)`}>
            <div className="space-y-2">
              {schemaResults.map((r) => (
                <div key={r.tool_name} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <ScoreBadge score={r.quality_score} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground">{r.tool_name}</p>
                    {r.issues.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.issues.map((issue, i) => (
                          <li key={i} className="text-xs text-yellow-600 dark:text-yellow-400">! {issue}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Declarative Forms */}
          <Section title="Declarative Forms">
            {formResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No form validations (navigate to /search or /submit first).</p>
            ) : (
              <div className="space-y-2">
                {formResults.map((f) => (
                  <div key={f.formId} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <span className={`mt-0.5 text-lg ${f.found && f.valid ? "text-green-500" : f.found ? "text-yellow-500" : "text-red-500"}`}>
                      {f.found && f.valid ? "\u2713" : f.found ? "!" : "\u2717"}
                    </span>
                    <div className="flex-1">
                      <p className="font-mono text-sm">{f.formId}</p>
                      {f.toolName && <p className="text-xs text-muted-foreground">toolname: {f.toolName}</p>}
                      {f.found && <p className="text-xs text-muted-foreground">Inputs with desc: {f.inputsWithDesc} | without: {f.inputsWithoutDesc}</p>}
                      {f.issues.map((issue, i) => (
                        <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">! {issue}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Live Tests */}
          <Section title="Live Tool Tests">
            <button
              onClick={runTests}
              disabled={testRunning}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {testRunning ? "Running..." : "Run All Tests"}
            </button>
            {testResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {testResults.map((tr) => (
                  <div key={tr.tool_name} className="rounded-lg border border-border p-3">
                    <p className="font-mono text-sm font-medium text-foreground">{tr.tool_name}</p>
                    <div className="mt-2 space-y-1">
                      {tr.execution_tests.map((et, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={et.passed ? "text-green-500" : "text-red-500"}>
                            {et.passed ? "\u2713" : "\u2717"}
                          </span>
                          <span className="text-muted-foreground">{et.case}</span>
                          {et.duration_ms !== undefined && <span className="text-muted-foreground">({et.duration_ms}ms)</span>}
                          {et.response_size !== undefined && <span className="text-muted-foreground">{(et.response_size / 1024).toFixed(1)}KB</span>}
                          {et.error && <span className="text-red-500">{et.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Analytics */}
          <Section title="Analytics Summary">
            {analytics?.error ? (
              <p className="text-sm text-muted-foreground">{analytics.error}</p>
            ) : analytics?.tools ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total calls: {analytics.total_calls}</p>
                {analytics.tools.map((t) => (
                  <div key={t.tool_name} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{t.tool_name}</span>
                    <span className="text-muted-foreground">{t.call_count} calls, avg {t.avg_duration_ms}ms</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading...</p>}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      <div className="rounded-xl border border-border bg-card p-4">{children}</div>
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass = color === "green" ? "text-green-500" : color === "red" ? "text-red-500" : color === "yellow" ? "text-yellow-500" : "text-foreground"
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${colorClass}`}>{value}</p>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : score >= 55 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{score}</span>
}
