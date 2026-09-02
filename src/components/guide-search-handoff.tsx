import Link from "next/link"
import { Search } from "lucide-react"

interface HandoffLink {
  label: string
  href: string
}

interface GuideSearchHandoffProps {
  headline: string
  subtitle?: string
  cta: HandoffLink
  links: HandoffLink[]
}

export function GuideSearchHandoff({ headline, subtitle, cta, links }: GuideSearchHandoffProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">{headline}</div>
          {subtitle && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          href={cta.href}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-700"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {cta.label}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
