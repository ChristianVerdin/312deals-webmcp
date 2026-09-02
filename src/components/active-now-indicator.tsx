import { cn } from "@/lib/utils"

interface ActiveNowIndicatorProps {
  className?: string
  showLabel?: boolean
}

export function ActiveNowIndicator({
  className,
  showLabel = true,
}: ActiveNowIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-green-600">Active Now</span>
      )}
    </span>
  )
}
