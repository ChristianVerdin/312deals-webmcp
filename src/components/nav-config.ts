import {
  MapPin,
  Beer,
  UtensilsCrossed,
  Map,
  Search,
  Send,
  Sparkles,
  Tag,
  Drumstick,
  Moon,
  Trophy,
  Clock,
  Link2,
  Timer,
  Route,
  Ghost,
  Newspaper,
  BookOpen,
  GraduationCap,
  BarChart3,
  Info,
  HelpCircle,
  Mail,
  Shield,
  FileText,
  Sun,
  Coffee,
  CircleDot,
  Hotel,
  Wheat,
  Dog,
  MessageSquarePlus,
  Copy,
  Martini,
  Pizza,
  Megaphone,
  HeartHandshake,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavLink = {
  href: string
  label: string
  description?: string
  icon: LucideIcon
}

export type NavGroup = {
  label: string
  links: NavLink[]
  /** Desktop dropdown only: render the first N links + a "more" footer link. Mobile nav & footer still show the full list. */
  featuredCount?: number
  moreHref?: string
  moreLabel?: string
}

// --- Dropdown groups (header + footer) ---

export const exploreGroup: NavGroup = {
  label: "Explore",
  links: [
    { href: "/today", label: "Deals Today", description: "What's on today, right now", icon: Clock },
    { href: "/neighborhoods", label: "Neighborhoods", description: "Browse deals by neighborhood", icon: MapPin },
    { href: "/happy-hours", label: "Happy Hours", description: "Drinks & apps after work", icon: Beer },
    { href: "/cuisine", label: "Cuisines", description: "Filter by cuisine type", icon: UtensilsCrossed },
    { href: "/map", label: "Interactive Map", description: "Find deals near you", icon: Map },
    { href: "/search", label: "Search", description: "Search all deals", icon: Search },
  ],
}

export const specialsGroup: NavGroup = {
  label: "Specials",
  moreHref: "/deals",
  moreLabel: "View all deals",
  links: [
    { href: "/deals/taco-tuesday", label: "Taco Tuesday", icon: Tag },
    { href: "/deals/wing-deals", label: "Wing Deals", icon: Drumstick },
    { href: "/deals/beer-specials", label: "Beer Specials", icon: Beer },
    { href: "/deals/cheap-cocktails", label: "Cheap Cocktails", icon: Martini },
    { href: "/deals/brunch-deals", label: "Brunch Deals", icon: UtensilsCrossed },
    { href: "/deals/late-night", label: "Late Night", icon: Moon },
    { href: "/deals/game-day", label: "Game Day", icon: Trophy },
    { href: "/deals/daily-specials", label: "Daily Specials", icon: Clock },
    { href: "/deals/bogo", label: "BOGO Deals", icon: Copy },
    { href: "/deals/chain-deals", label: "Chain Deals", icon: Link2 },
    { href: "/deals/limited-time", label: "Limited Time", icon: Timer },
  ],
}

export const guidesGroup: NavGroup = {
  label: "Guides",
  // Desktop dropdown shows only the first 5 (curated: popular + summer/tourist-relevant)
  // plus an "Explore all guides" link. Mobile nav & footer still list everything.
  featuredCount: 5,
  moreHref: "/guides",
  moreLabel: "Explore all guides",
  links: [
    // --- Featured top 5 ---
    { href: "/guides/bears-game-day-chicago", label: "Bears Game Day", description: "Where to watch + best specials", icon: Trophy },
    { href: "/guides/college-football-chicago", label: "College Football", description: "Alumni bars by school + Saturday specials", icon: Trophy },
    { href: "/guides/chicago-happy-hours", label: "Happy Hour Guide", description: "The definitive HH guide", icon: BookOpen },
    { href: "/guides/patio-season-chicago", label: "Patio Season", description: "Best outdoor deals", icon: Sun },
    { href: "/guides/cubs-game-day-chicago", label: "Cubs Game Day", description: "Wrigleyville bars & specials", icon: CircleDot },
    { href: "/guides/dog-friendly-patios-chicago", label: "Dog-Friendly Patios", description: "Eat & drink with your dog", icon: Dog },
    // --- Remaining (full list on /guides, mobile nav & footer) ---
    { href: "/guides/white-sox-game-day-chicago", label: "White Sox Game Day", description: "Rate Field bars & pre-game", icon: CircleDot },
    { href: "/guides/deep-dish-pizza-chicago", label: "Deep Dish Pizza", description: "A tourist's guide to the best spots", icon: Pizza },
    { href: "/guides/chicago-marathon-bars-restaurants", label: "Chicago Marathon", description: "Course-side bars & post-race brunch", icon: Route },
    { href: "/guides/halloween-bars-chicago", label: "Halloween", description: "Parade, costume parties & crawls", icon: Ghost },
    { href: "/guides/oktoberfest-chicago", label: "Oktoberfest", description: "Every fest, city & suburbs", icon: Beer },
    { href: "/guides/mexican-independence-day-chicago", label: "Mexican Independence Day", description: "El Grito, the parade & where to eat", icon: Sparkles },
    { href: "/guides/4th-of-july-chicago", label: "4th of July", description: "Rooftops, fireworks views & BBQ", icon: Sparkles },
    { href: "/guides/college-bars-chicago", label: "College Bars", description: "Find your team's bar", icon: Trophy },
    { href: "/blog", label: "Blog", description: "Chicago food & drink articles", icon: Newspaper },
    { href: "/crawl", label: "Bar Crawl Planner", description: "Plan your perfect bar crawl", icon: Route },
    { href: "/guides/cheap-drinks-chicago", label: "Cheap Drinks Guide", description: "$1 beers & $10 cocktails", icon: Beer },
    { href: "/guides/best-brunch-chicago", label: "Brunch Guide", description: "Bottomless & more", icon: Coffee },
    { href: "/guides/graduation-dinner-chicago", label: "Graduation Dinner", description: "Pre/post commencement dining", icon: GraduationCap },
    { href: "/dietary/gluten-free", label: "Gluten-Free", description: "400+ verified GF deals", icon: Wheat },
    { href: "/guides/where-to-stay-chicago", label: "Where to Stay", description: "Visiting? Hotels picked by neighborhood", icon: Hotel },
    { href: "/student-guides", label: "Student Guides", description: "Deals near your campus", icon: GraduationCap },
    { href: "/near", label: "Near a Venue", description: "Bars near stadiums & landmarks", icon: MapPin },
    { href: "/reports/chicago-deals-2026", label: "2026 Report", description: "Chicago deals by the numbers", icon: BarChart3 },
    { href: "/reports/chicago-value-dining-2026", label: "Value Dining Report", description: "How Chicago is beating inflation", icon: BarChart3 },
  ],
}

export const companyGroup: NavGroup = {
  label: "Company",
  links: [
    { href: "/about", label: "About", icon: Info },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
    { href: "/contact", label: "Contact", icon: Mail },
    { href: "/submit", label: "Submit a Deal", icon: Send },
    { href: "/advertise", label: "Advertise", icon: Megaphone },
    { href: "/partner", label: "Partner With Us", icon: HeartHandshake },
    { href: "mailto:deals@312deals.com?subject=312Deals%20Feedback%20%2F%20Feature%20Request", label: "Feedback", icon: MessageSquarePlus },
    { href: "/privacy", label: "Privacy Policy", icon: Shield },
    { href: "/terms", label: "Terms", icon: FileText },
  ],
}

// All dropdown groups for iteration
export const navGroups = [exploreGroup, specialsGroup, guidesGroup, companyGroup] as const

// --- Direct links (no dropdown, header only) ---

export const directLinks: NavLink[] = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/submit", label: "Submit a Deal", icon: Send },
  // { href: "/chat", label: "AI Guide", icon: Sparkles }, // Paused, saves compute, re-enable at 100+ daily visitors
]

// --- Helper: check if any link in a group matches the current pathname ---

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.links.some(
    (link) => pathname === link.href || pathname.startsWith(link.href + "/")
  )
}
