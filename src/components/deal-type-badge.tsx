import { getDealTypeConfig } from "@/lib/deal-utils"
import { cn } from "@/lib/utils"

interface DealTypeBadgeProps {
  dealType: string
  className?: string
}

export function DealTypeBadge({ dealType, className }: DealTypeBadgeProps) {
  const config = getDealTypeConfig(dealType)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.bgClass,
        className
      )}
    >
      {config.label}
    </span>
  )
}
