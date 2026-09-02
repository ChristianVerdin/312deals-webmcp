"use client"

import { Share2, MessageCircle, Phone } from "lucide-react"
import { toast } from "sonner"
import { trackDealShared } from "@/lib/analytics"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ShareButtonProps {
  url?: string
  title?: string
  text?: string
  deal?: { id: number; venue_slug?: string; venue_name?: string; title?: string; neighborhood?: string }
  className?: string
  variant?: "icon" | "menu-item"
}

function getFullUrl(url: string): string {
  if (typeof window === "undefined") return url
  return url.startsWith("http") ? url : `${window.location.origin}${url}`
}

export function ShareButton({ url: urlProp, title: titleProp, text: textProp, deal, className, variant = "icon" }: ShareButtonProps) {
  // Derive URL/title/text from deal prop if provided
  const url = urlProp || (deal ? `/venues/${deal.venue_slug}#deal-${deal.id}` : "/")
  const title = titleProp || (deal ? `${deal.venue_name}, ${deal.title}` : "312Deals")
  const text = textProp || (deal ? `Check out this deal: ${deal.title} at ${deal.venue_name}${deal.neighborhood ? ` in ${deal.neighborhood}` : ""}` : title)
  function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      trackDealShared({ method: "native" })
      navigator.share({ title, text: text || title, url: getFullUrl(url) }).catch(() => {})
    } else {
      trackDealShared({ method: "copy" })
      navigator.clipboard.writeText(getFullUrl(url)).then(() => {
        toast.success("Link copied!")
      })
    }
  }

  function copyToClipboard() {
    trackDealShared({ method: "copy" })
    navigator.clipboard.writeText(getFullUrl(url)).then(() => {
      toast.success("Link copied!")
    })
  }

  function shareTwitter(e: React.MouseEvent) {
    e.stopPropagation()
    trackDealShared({ method: "twitter" })
    const tweetText = text || title
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(getFullUrl(url))}`,
      "_blank",
      "noopener,width=550,height=420"
    )
  }

  function shareFacebook(e: React.MouseEvent) {
    e.stopPropagation()
    trackDealShared({ method: "facebook" })
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getFullUrl(url))}`,
      "_blank",
      "noopener,width=550,height=420"
    )
  }

  function shareText(e: React.MouseEvent) {
    e.stopPropagation()
    trackDealShared({ method: "sms" })
    const msg = `${text || title}\n${getFullUrl(url)}`
    window.location.href = `sms:?&body=${encodeURIComponent(msg)}`
  }

  function shareWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    trackDealShared({ method: "whatsapp" })
    const msg = `${text || title}\n${getFullUrl(url)}`
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener"
    )
  }

  // Menu item variant, renders as a row inside an existing menu
  if (variant === "menu-item") {
    return (
      <button
        onClick={handleShare}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
      >
        <Share2 className="h-4 w-4 text-brand-500" />
        Share deal
      </button>
    )
  }

  function handleTriggerClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      trackDealShared({ method: "native" })
      navigator.share({ title, text: text || title, url: getFullUrl(url) }).catch(() => {})
      return
    }
  }

  const btnClass = className || "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={handleTriggerClick}
          className={btnClass}
          aria-label="Share deal"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
        <DropdownMenuItem onClick={shareText}>
          <Phone className="mr-2 h-4 w-4" />
          Text a friend
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTwitter}>
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareFacebook}>
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard() }}>
          Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
