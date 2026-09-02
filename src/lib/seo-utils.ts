import type { Deal } from "./types"
import { stats } from "@/lib/product-stats"

// ─── Deal type landing page configs ─────────────────────────

export interface DealTypePageConfig {
  apiValue: string
  label: string
  seoTitle: string
  description: string
  query?: string
  day?: string
  /** Restrict to deals that explicitly name `day` and run on ≤3 days.
   *
   *  Only for weekday pages with no `query` to differentiate them. Measured
   *  2026-08-10, the five generic weekday pages were **97.5% identical** to one
   *  another, because the default day filter also admits the 50k undated deals
   *  and the 8k all-week ones. Google collapsed them into /deals: it ranked
   *  /deals 13.3 for "monday food deals" (442 impr) and /deals/monday-deals
   *  13.2 (4 impr). With this flag the pages drop to ~1.2% overlap, matching
   *  taco-tuesday (2.5%), which ranks at 6.2 with 721 clicks.
   *
   *  Do NOT set this on taco-tuesday / wing-tuesday / wine-wednesday /
   *  sunday-funday — their `query` already differentiates them, and narrowing
   *  their inventory would only cost them deals. */
  dayStrict?: boolean
  // Preferred sibling deal-type pages surfaced in "More Deal Types".
  // Use to consolidate weekday/cuisine variants near their parent hub.
  relatedTypes?: string[]
}

export const DEAL_TYPE_PAGES: Record<string, DealTypePageConfig> = {
  "happy-hours": {
    apiValue: "happy_hour",
    label: "Happy Hours",
    seoTitle: "Tonight's Chicago Happy Hour Deals, $3 Beers & $5 Cocktails Near You",
    description:
      `4,000+ live happy hour deals at Chicago bars and restaurants, $3 beers, $5 cocktails, half-off apps, wine flights, and reverse happy hours across ${stats.neighborhoods} neighborhoods. Filter by day, time, or area. Updated daily.`,
  },
  "brunch-deals": {
    apiValue: "brunch_deal",
    label: "Brunch Deals",
    // Retargeted 2026-09-02. "brunch specials" is 45.6% of this page's own
    // cluster and was MISSING -- the single largest gap found in the
    // DEAL_TYPE_PAGES title audit -- and "cheap" is another 22.5%. The old
    // title spent a word on "Saturday" (0.3%).
    seoTitle: "Chicago Brunch Specials, Cheap Deals & Bottomless Mimosas",
    description:
      `200+ brunch deals in Chicago. Bottomless mimosas from $15, prix fixe menus, Saturday & Sunday brunch specials at restaurants across ${stats.neighborhoods} neighborhoods.`,
  },
  "late-night": {
    apiValue: "late_night",
    label: "Late Night",
    // Retarget: page ranks for "late night happy hour chicago" / "after 9 happy
    // hour" (956 imp, pos 10.1) but the old title said "After Midnight", a
    // title<->query miss. Lead with the exact query.
    //
    // The title used to read "191 Specials After 9 PM". That number was
    // WRONG -- 571 active late_night deals as of 2026-09-02, stale by 3x --
    // and check_public_stats.py never caught it because its rule list does
    // not know this figure exists (the same literal-rule-list gap that let
    // nine surfaces publish a stale neighborhood count for months). There is no
    // per-deal-type count in product-stats.json to interpolate from, and the
    // house rule is never to hand-maintain a figure, so the number is gone
    // rather than corrected. It was 0% of this page's query demand anyway.
    seoTitle: "Late Night Happy Hour Chicago, Specials After 9 PM",
    description:
      "Late night happy hour Chicago, specials after 9 PM: reverse happy hours, $3 beers, late-night tacos & 2 AM kitchen deals at bars across the city. Updated daily.",
  },
  "taco-tuesday": {
    apiValue: "daily_special",
    label: "Taco Tuesday",
    // 56 chars, under Google's ~60 char cap. Adds "Deals" to capture the
    // top striking-distance query "taco tuesday deals" (190 imp / pos 10.6,
    // GSC May 2026) + "taco deals"/"taco specials" tail, without dropping the
    // "Taco Tuesday" head term (130 imp) or the "$1 tacos" / "Tonight" hooks.
    seoTitle: "Chicago Taco Tuesday Deals, $1 Tacos & $5 Margs Tonight",
    description:
      `Every Taco Tuesday in Chicago, mapped. 400+ live deals: $1-$2 tacos, $5 margaritas, half-price Mexican across ${stats.neighborhoods} neighborhoods. Updated every Tuesday.`,
    query: "taco",
    day: "tuesday",
    // Curated cluster so our #1 traffic page intentionally feeds its weekday/
    // food-special siblings instead of falling back to the generic top-6.
    relatedTypes: ["wing-deals", "cheap-cocktails", "daily-specials", "happy-hours", "late-night", "game-day"],
  },
  "wing-deals": {
    apiValue: "daily_special",
    label: "Wing Deals",
    // Retargeted 2026-09-02 against this page's own 419-query, 2,519-impression
    // cluster. The old title spent four of its content words on demand that is
    // not there: "Tonight" 0.1%, "BOGO" 0.2%, "$1" 1.4%, "Chicago" 0.6% -- about
    // 2% between them -- while WEEKDAYS are 33.5% (Wednesday 14.1%, Tuesday
    // 8.8%, Thursday 7.1%, Monday 3.4%) and appeared nowhere.
    //
    // The old comment said "Don't re-target 'wing tuesday', /deals/wing-tuesday
    // owns that." It owns nothing: that page has ZERO impressions on ZERO
    // queries. Every wing-weekday query is served by THIS page -- wing tuesday
    // pos 9.7, wing wednesday pos 14.1, wing thursday pos 7.7, all at zero
    // clicks. Same shape as the weekday deal pages (see the dayStrict note in
    // CLAUDE.md): the purpose-built day page does not get selected, so serve
    // the day intent on the page Google actually chose.
    //
    // Weekday bigrams live in the description rather than the title, because a
    // title that reads as a keyword list invites a Google rewrite, and the
    // /deals/late-night precedent in this file shows a natural phrase winning
    // (11.3% CTR from position 6.3).
    seoTitle: "Chicago Wing Deals, Wing Specials & Weekly Wing Nights",
    description:
      `Wing deals and wing specials across Chicago: Wing Tuesday, Wing Wednesday and Wing Thursday nights, buffalo wings, half-off buckets, boneless and $1 wing deals at bars across ${stats.neighborhoods} neighborhoods, updated daily.`,
    query: "wing",
    // Keep /deals/wing-tuesday first purely as an internal link to an orphan:
    // it has zero impressions, so the link is the only thing feeding it. It is
    // NOT the page ranking for "wing tuesday" -- this one is.
    relatedTypes: ["wing-tuesday", "beer-specials", "taco-tuesday", "game-day", "late-night", "happy-hours", "daily-specials"],
  },
  "game-day": {
    apiValue: "game_day",
    label: "Game Day",
    seoTitle: "Chicago Game Day Deals, Cubs, Bears, Bulls & Sox Watch Party Specials",
    description:
      `313 game day specials at Chicago sports bars. Cubs, Bears, Bulls, Sox & Blackhawks watch party deals, cheap beer, wing specials, and big-screen viewing across ${stats.neighborhoods} neighborhoods.`,
  },
  "daily-specials": {
    apiValue: "daily_special",
    label: "Daily Specials",
    // 60 chars, captures 'chicago daily deals' (116 imp / pos 7.9 / 0 clk per GSC May 2026).
    // Title untouched (front-loaded query); description rewritten with concrete value hooks
    // and weekday keywords to lift CTR.
    seoTitle: "Chicago Daily Deals Today, Today's Restaurant Specials",
    description:
      `Today's Chicago daily deals: $5 burger Mondays, $1 Taco Tuesdays, half-off Wine Wednesdays, ladies-night Thursdays, BOGO Sundays. ${stats.venues} restaurants and bars across ${stats.neighborhoods} neighborhoods, refreshed every morning.`,
  },
  "bogo": {
    // No deal_type lock (apiValue ""): BOGO spans 11 deal_types, so getDeals
    // skips the deal_type filter and queries text only, 244 live deals vs 171
    // if locked to daily_special. Targets "bogo food deals today" (86 imp /
    // pos 12.1), "bogo deals today" (22), "bogo food deals" (15), GSC May 2026,
    // no surface existed before.
    apiValue: "",
    label: "BOGO Deals",
    // 56 chars, under Google's ~60 char cap.
    seoTitle: "Chicago BOGO Deals Today, Buy One Get One Free Specials",
    description:
      "Live buy-one-get-one deals across Chicago, BOGO pizza, wings, entrees, drinks and app specials at 200+ bars and restaurants. Spend less, get two: every BOGO deal by neighborhood, updated daily.",
    query: "bogo",
    relatedTypes: ["daily-specials", "happy-hours", "wing-deals", "taco-tuesday", "chain-deals"],
  },
  "beer-specials": {
    // No deal_type lock (apiValue ""): beer deals span 11 deal_types
    // (happy_hour 762, daily_special 658, game_day 87, late_night 37…), so
    // query text-only to surface all ~1,900 live beer/draft deals. Rides the
    // 2026 "trade down from $18 cocktails to $8 beer" trend (Crain's, Jun 1).
    apiValue: "",
    label: "Beer Specials",
    // 58 chars, under Google's ~60 char cap. "$1 Beer" + "Tonight" hooks.
    // Retargeted 2026-09-02. Missing: "cheap beer" 19.7%, "beer specials"
    // 18.0%, "beers" 11.8%. Dead in the old title: "Nights" 0%, "Drafts"
    // 0%, "Tonight" 0.4%.
    seoTitle: "Chicago Beer Specials, Cheap Beer Deals & $1 Beers",
    description:
      `Every cheap beer night in Chicago, mapped. $1 beers, $3 drafts, dollar-beer Thursdays and cheap domestics at 880+ bars across ${stats.neighborhoods} neighborhoods. As cocktail prices climb, beer is back, updated daily.`,
    query: "beer",
    relatedTypes: ["cheap-cocktails", "happy-hours", "wing-deals", "game-day", "daily-specials"],
  },
  "cheap-cocktails": {
    // No deal_type lock (apiValue ""): cocktail deals span the same spread
    // (happy_hour 751, seasonal_lto 205, daily_special 195…). Rides the
    // "Death to the $20 Cocktail" $10–$12 value movement (Bloomberg, May 14).
    apiValue: "",
    label: "Cheap Cocktails",
    // 56 chars.
    seoTitle: "Cheap Cocktails Chicago, $10–$12 Drinks & Happy Hours",
    description:
      "Chicago's value cocktail scene, mapped. $10–$12 craft cocktails, half-price drinks, $5 margaritas and happy-hour specials as the city kills the $20 cocktail. Every cheap cocktail by neighborhood, updated daily.",
    query: "cocktail",
    relatedTypes: ["beer-specials", "happy-hours", "daily-specials", "brunch-deals", "taco-tuesday"],
  },
  "chain-deals": {
    apiValue: "chain_app_deal",
    // Label was "Chain Deals" before May 19, SERP showed "Drive Thru Deals
    // Today" via the title and pulled the user in, but the page header said
    // "Chain Deals" + breadcrumb said "Chain Deals", which is a SERP-promise
    // mismatch that explains the 143 imp / pos 2.9 / 0 clk pattern. Now the
    // user-facing label matches the title hook.
    label: "Drive Thru Deals",
    // 56 chars, captures "drive thru deals" (GSC: 143 imp / pos 2.9 / 0 clk per May 2026).
    // Description leads with drive-thru-specific brand names; "$5 Biggie Bags,
    // BOGO Whoppers" is more concrete than the previous menu-item lead-in.
    seoTitle: "Drive Thru Deals Today, Chicago Chain Specials & Apps",
    description:
      "Today's drive thru deals: $5 Biggie Bags (Wendy's), BOGO Whoppers (BK), $3 breakfast (McDonald's), half-price Frostys, free menu items via app. Daily-rotating offers from McDonald's, Wendy's, Taco Bell, Burger King, Popeyes, Chick-fil-A, Chipotle, Portillo's and 40+ Chicago chain locations.",
  },
  "limited-time": {
    apiValue: "seasonal_lto",
    label: "Limited Time Offers",
    seoTitle: "Chicago Limited Time Restaurant Offers",
    description:
      "Limited time food and drink offers at Chicago restaurants. Seasonal specials, new menu items, and promotional deals you don't want to miss.",
  },
  "pizza-deals": {
    apiValue: "daily_special",
    label: "Pizza Deals",
    seoTitle: "Chicago Pizza Deals & Specials",
    description:
      `The best pizza deals in Chicago, discounted slices, BOGO pies, happy hour pizza specials, and more at pizzerias and restaurants across ${stats.neighborhoods} neighborhoods.`,
    query: "pizza",
  },
  "bottomless-brunch": {
    apiValue: "brunch_deal",
    label: "Bottomless Brunch",
    seoTitle: "Chicago Bottomless Brunch 2026, $20–$40 Unlimited Mimosas, Bloodys & Bellinis",
    description:
      `200+ bottomless brunch deals in Chicago. Unlimited mimosas from $20, bottomless bloody marys, bellinis, sangria and drag brunches at Saturday & Sunday spots across ${stats.neighborhoods} neighborhoods. Filter by price and neighborhood.`,
    query: "bottomless",
  },
  "patio-deals": {
    apiValue: "happy_hour",
    label: "Patio Deals",
    seoTitle: "Chicago Patio Deals 2026, Outdoor Happy Hours at 3,000+ Patios",
    description:
      `Patio happy hours, brunch, and dinner specials at 3,000+ Chicago venues with outdoor seating. Rooftop bars, beer gardens, sidewalk patios, and dog-friendly patios across ${stats.neighborhoods} neighborhoods. Updated daily.`,
  },
  "restaurant-deals": {
    apiValue: "daily_special",
    label: "Restaurant Deals",
    seoTitle: `Chicago Restaurant Deals Today 2026, Dining Specials & Discounts at ${stats.venues} Spots`,
    description:
      `${stats.deals} restaurant deals across Chicago and suburbs. Daily dining specials, happy hour discounts, BOGO offers, and food coupons at ${stats.venues} venues in ${stats.neighborhoods} neighborhoods. Updated daily.`,
  },
  "food-deals": {
    apiValue: "daily_special",
    label: "Food Deals",
    seoTitle: "Chicago Food Deals Near You, Today's Best Specials & Discounts",
    description:
      `Find the best food deals in Chicago today. Cheap eats, daily specials, happy hour food, and restaurant discounts across ${stats.neighborhoods} neighborhoods and suburbs.`,
    query: "food",
  },
  "nightlife-deals": {
    apiValue: "late_night",
    label: "Nightlife Deals",
    seoTitle: "Chicago Nightlife Deals, Bar Specials, Late Night & Drink Deals",
    description:
      "Chicago nightlife deals and bar specials. Late night happy hours, drink specials, cover-free venues, and after-dark food deals across the city and suburbs.",
  },
  "wing-tuesday": {
    apiValue: "daily_special",
    label: "Wing Tuesday",
    seoTitle: "Chicago Wing Tuesday Deals 2026, 50¢ Wings, BOGO & $1 Wing Specials Every Tuesday",
    description:
      `Every Wing Tuesday deal in Chicago and the suburbs. 50¢ and $1 wings, BOGO buffalo wings, half-off boneless wings, and Tuesday wing nights at 200+ bars and restaurants across ${stats.neighborhoods} neighborhoods. Updated every Tuesday.`,
    query: "wing",
    day: "tuesday",
  },
  "wine-wednesday": {
    apiValue: "daily_special",
    label: "Wine Wednesday",
    // Replicates the day+keyword pattern of wing-tuesday/taco-tuesday.
    // /deals/taco-tuesday drove 7 of 12 deal-clicks Apr 28-29 (Plausible audit).
    seoTitle: "Chicago Wine Wednesday, Half-Off Bottles, $5 Glasses & Wine Specials Every Wednesday",
    description:
      `Every Wine Wednesday deal in Chicago. Half-off bottles, $5 glasses, BOGO wine, free corkage, and Wednesday wine nights at restaurants and wine bars across ${stats.neighborhoods} neighborhoods. Updated every Wednesday.`,
    query: "wine",
    day: "wednesday",
  },
  "wednesday-deals": {
    apiValue: "daily_special",
    label: "Wednesday Deals",
    seoTitle: "Chicago Wednesday Food & Drink Deals 2026, Half-Off Wings, BOGO Pizza, $5 Burger Nights",
    description:
      `Every Wednesday food and drink deal in Chicago. Half-off wings, BOGO pizza, $5 burger nights, half-price wine bottles, and mid-week happy hours at restaurants and bars across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    day: "wednesday",
    dayStrict: true,
  },
  "thursday-deals": {
    apiValue: "daily_special",
    label: "Thursday Deals",
    seoTitle: "Chicago Thursday Food & Drink Specials 2026, Ladies Night, Steak Night & Industry Deals",
    description:
      `Every Thursday food and drink deal in Chicago. Ladies night cocktails, steak night specials, industry happy hours, half-price bottle nights, and Thursday burger deals at bars and restaurants across ${stats.neighborhoods} neighborhoods.`,
    day: "thursday",
    dayStrict: true,
  },
  "monday-deals": {
    apiValue: "daily_special",
    label: "Monday Deals",
    seoTitle: "Chicago Monday Food & Drink Deals 2026, Burger Night, Industry Specials & Half-Off Bottles",
    description:
      `Every Monday food and drink deal in Chicago. Burger nights, half-off bottles, industry specials, $5 cocktails, and start-of-week happy hours at restaurants and bars across ${stats.neighborhoods} neighborhoods.`,
    day: "monday",
    dayStrict: true,
  },
  "sunday-funday": {
    apiValue: "brunch_deal",
    label: "Sunday Funday",
    seoTitle: "Chicago Sunday Funday, Bottomless Brunch, Drag Brunch & Sunday Drink Specials",
    description:
      `Every Sunday Funday deal in Chicago. Bottomless mimosa brunch, drag brunch, $40 buffets, all-day Sunday happy hours, and Sunday-only drink specials at restaurants across ${stats.neighborhoods} neighborhoods.`,
    query: "brunch",
    day: "sunday",
  },
  "dinner-deals": {
    apiValue: "daily_special",
    label: "Dinner Deals",
    // 58 chars, captures "dinner deals" (GSC: 40 imp / pos 43.8, no surface
    // existed). Meal-time intent distinct from the generic daily-specials hub.
    seoTitle: "Chicago Dinner Deals Tonight, Specials, Prix Fixe & Discounts",
    description:
      `Tonight's best dinner deals in Chicago: prix fixe menus, half-off entrees, early-bird specials, $5 dinner nights and date-worthy discounts at restaurants across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "dinner",
    relatedTypes: ["daily-specials", "restaurant-deals", "happy-hours", "brunch-deals", "late-night"],
  },
  "friday-deals": {
    apiValue: "daily_special",
    label: "Friday Deals",
    // Fills the weekday gap (mon/wed/thu/sun exist). "Fish fry" is the Chicago/
    // Midwest Friday hook; captures "friday food deals" (GSC: 13 imp / pos 40.6).
    seoTitle: "Chicago Friday Deals, Fish Fry, Happy Hours & Weekend-Kickoff Specials",
    description:
      `Every Friday food and drink deal in Chicago. Friday fish fry, half-off apps, weekend-kickoff happy hours, $5 cocktails, and late-night Friday specials at bars and restaurants across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    day: "friday",
    dayStrict: true,
    relatedTypes: ["thursday-deals", "happy-hours", "beer-specials", "late-night", "daily-specials"],
  },
  "saturday-deals": {
    apiValue: "daily_special",
    label: "Saturday Deals",
    seoTitle: "Chicago Saturday Deals, Brunch, Game Day & Weekend Specials",
    description:
      `Every Saturday food and drink deal in Chicago. Bottomless brunch, all-day happy hours, game-day specials, BOGO apps, and Saturday-night drink deals at restaurants and bars across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    day: "saturday",
    dayStrict: true,
    relatedTypes: ["sunday-funday", "bottomless-brunch", "game-day", "happy-hours", "daily-specials"],
  },
  "lunch-specials": {
    // No deal_type lock: lunch specials span daily_special + happy_hour + LTO.
    // 1,800+ live deals mention "lunch", query text-only to surface them all.
    apiValue: "",
    label: "Lunch Specials",
    // 56 chars, midday intent distinct from the dinner/daily-specials hubs.
    seoTitle: "Chicago Lunch Specials, Cheap Lunch Deals & Combos Today",
    description:
      `Today's best lunch deals in Chicago: $10 lunch combos, weekday lunch specials, half-off midday menus, prix fixe lunches and business-lunch happy hours at restaurants across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "lunch",
    relatedTypes: ["daily-specials", "dinner-deals", "happy-hours", "taco-tuesday", "food-deals"],
  },
  "margarita-deals": {
    apiValue: "",
    label: "Margarita Deals",
    // 55 chars, rides taco-tuesday's margarita tail with its own surface.
    seoTitle: "Chicago Margarita Deals, $5 Margs & Marg Specials Tonight",
    description:
      `Every margarita deal in Chicago, mapped. $5 margaritas, $1 marg Mondays, frozen and skinny margs, BOGO and happy-hour margaritas at 800+ bars and Mexican restaurants across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "margarita",
    relatedTypes: ["taco-tuesday", "cheap-cocktails", "happy-hours", "beer-specials", "daily-specials"],
  },
  "trivia-night": {
    apiValue: "",
    label: "Trivia Night",
    // 53 chars, captures "bar trivia chicago" / "pub quiz" event intent.
    seoTitle: "Chicago Trivia Nights, Bar Trivia & Pub Quiz Specials",
    description:
      `Every bar trivia night in Chicago, with the drink and food specials that come with them. Weekly pub quizzes, trivia leagues, and game-night deals at 500+ bars and breweries across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    query: "trivia",
    relatedTypes: ["game-day", "beer-specials", "happy-hours", "wing-deals", "daily-specials"],
  },
  "oyster-specials": {
    apiValue: "",
    label: "Oyster Specials",
    // 56 chars, "buck-a-shuck" is the canonical Chicago oyster-deal phrase.
    seoTitle: "Chicago Oyster Specials, $1 Oysters & Buck-a-Shuck Deals",
    description:
      `Where to find $1 oysters in Chicago. Buck-a-shuck nights, half-off raw bars, oyster happy hours and dollar-oyster deals at seafood spots and oyster bars across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "oyster",
    relatedTypes: ["happy-hours", "cheap-cocktails", "brunch-deals", "dinner-deals", "daily-specials"],
  },
  "kids-eat-free": {
    apiValue: "",
    label: "Kids Eat Free",
    // Retargeted 2026-09-02. 2,236 impressions at 1.2% CTR made this the
    // worst-converting large page on the site. Its demand is DAY-SCOPED:
    // "kids eat free <weekday>" and its near-me variants are ~936 impressions
    // (23% of the cluster) spread across all seven days, every one of them
    // landing on this single page -- kids wednesday 196, kids tuesday 179,
    // kids monday 168, kids thursday 144, kids sunday 131, kids friday 75,
    // kids saturday 43. The old title spent words on "Nights" (0.8%) and
    // "Family" (0.4%) and named no day at all.
    //
    // Day names go in the description, not the title, for the same reason as
    // wing-deals: seven of them would read as a keyword list. Do NOT set
    // dayStrict here -- the `query` below already differentiates this page,
    // and the house rule is that dayStrict is only for day pages with no
    // query of their own.
    seoTitle: "Kids Eat Free Chicago, Monday Through Sunday Kids Meal Deals",
    description:
      `Where kids eat free in Chicago and the suburbs, by day: kids eat free Monday, Tuesday, Wednesday, Thursday, Friday, Saturday and Sunday. Free kids meal deals at restaurants across ${stats.neighborhoods} neighborhoods, updated weekly.`,
    query: "kids eat free",
    relatedTypes: ["daily-specials", "dinner-deals", "food-deals", "restaurant-deals", "monday-deals"],
  },
  "steak-night": {
    apiValue: "",
    label: "Steak Night",
    // 56 chars, "steak night chicago" / "steak special" intent.
    seoTitle: "Chicago Steak Night Deals, Steak Dinner Specials Tonight",
    description:
      `Every steak night in Chicago, mapped. $ steak dinners, prime rib specials, surf-and-turf deals, and weekday steak nights at steakhouses and bars across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "steak",
    relatedTypes: ["dinner-deals", "prix-fixe", "daily-specials", "happy-hours", "restaurant-deals"],
  },
  "buffet-deals": {
    apiValue: "",
    label: "Buffet Deals",
    // 53 chars, "all you can eat chicago" / "buffet near me" intent.
    seoTitle: "Chicago Buffet Deals, All-You-Can-Eat & Brunch Buffets",
    description:
      `Chicago's best buffet deals: all-you-can-eat dinners, weekend brunch buffets, Indian and Mediterranean spreads, and bottomless specials at restaurants across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "buffet",
    relatedTypes: ["brunch-deals", "bottomless-brunch", "daily-specials", "dinner-deals", "food-deals"],
  },
  "sangria-deals": {
    apiValue: "",
    label: "Sangria Deals",
    // 55 chars, summer-seasonal, distinct from the margarita/cocktail hubs.
    seoTitle: "Chicago Sangria Deals, Pitcher Specials & Happy Hours",
    description:
      `Every sangria deal in Chicago, mapped. $ pitchers, red and white sangria specials, sangria happy hours and patio sangria at Spanish, Mexican and tapas spots across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "sangria",
    relatedTypes: ["margarita-deals", "cheap-cocktails", "happy-hours", "patio-deals", "brunch-deals"],
  },
  "industry-night": {
    apiValue: "",
    label: "Industry Night",
    // 55 chars, service-industry / "industry night chicago" intent.
    // Retargeted 2026-09-02. Missing: "night chicago" 15.3% (so the phrase
    // is reordered to make "Industry Night Chicago" contiguous),
    // "industry tuesdays" 11.4%, "deals" 11.0%. Dead: "Service-Industry"
    // 0%, "Drink" 0.4%.
    seoTitle: "Industry Night Chicago, Industry Tuesdays & Deals",
    description:
      `Where Chicago's service industry drinks after a shift. Industry-night discounts, late-night service-industry happy hours, and shift-drink specials at bars across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    query: "industry",
    relatedTypes: ["late-night", "happy-hours", "beer-specials", "cheap-cocktails", "daily-specials"],
  },
  "prix-fixe": {
    apiValue: "",
    label: "Prix Fixe",
    // 52 chars, date-night / restaurant-week-adjacent upscale intent.
    seoTitle: "Chicago Prix Fixe Deals, Multi-Course Dinner Specials",
    description:
      `Chicago prix fixe menus and multi-course dinner deals: tasting menus, three-course specials, date-night prix fixe and restaurant-week-style value at restaurants across ${stats.neighborhoods} neighborhoods. Updated daily.`,
    query: "prix fixe",
    relatedTypes: ["dinner-deals", "steak-night", "brunch-deals", "restaurant-deals", "happy-hours"],
  },
  "fish-fry": {
    apiValue: "",
    label: "Fish Fry",
    // 49 chars, Midwest Friday/Lent staple; distinct from friday-deals hub.
    seoTitle: "Chicago Friday Fish Fry, Fish Fry Specials & Deals",
    description:
      `Every Friday fish fry in Chicago and the suburbs. All-you-can-eat cod, beer-battered perch, Lenten fish fry specials and Friday seafood deals at taverns and restaurants across ${stats.neighborhoods} neighborhoods. Updated weekly.`,
    query: "fish fry",
    relatedTypes: ["friday-deals", "oyster-specials", "daily-specials", "happy-hours", "buffet-deals"],
  },
}

// ─── Student guide landing page configs ──────────────────────

export interface StudentGuideConfig {
  schoolName: string
  neighborhoods: string[] // neighborhood slugs
  seoTitle: string
  description: string
  externalLinks: { label: string; url: string }[]
}

export const STUDENT_GUIDE_PAGES: Record<string, StudentGuideConfig> = {
  uchicago: {
    schoolName: "University of Chicago",
    neighborhoods: ["hyde-park", "south-loop"],
    seoTitle: "Cheapest Eats & Drinks Near UChicago",
    description:
      "The best food and drink deals near the University of Chicago. Student-friendly happy hours, cheap eats, and daily specials in Hyde Park and South Loop.",
    externalLinks: [
      { label: "UChicago Dining", url: "https://dining.uchicago.edu/" },
      { label: "Hyde Park neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/hyde-park/" },
    ],
  },
  depaul: {
    schoolName: "DePaul University",
    neighborhoods: ["lincoln-park", "lakeview"],
    seoTitle: "Best Deals & Happy Hours Near DePaul",
    description:
      "Food and drink deals near DePaul University. Affordable restaurants, happy hours, and daily specials in Lincoln Park and Lakeview.",
    externalLinks: [
      { label: "DePaul University dining services", url: "https://offices.depaul.edu/student-affairs/about/departments/Pages/dining-services.aspx" },
      { label: "Lincoln Park neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/lincoln-park/" },
    ],
  },
  loyola: {
    schoolName: "Loyola University Chicago",
    neighborhoods: ["rogers-park", "edgewater"],
    seoTitle: "Cheap Eats & Drink Deals Near Loyola",
    description:
      "Student-friendly food and drink deals near Loyola University Chicago. Budget-friendly restaurants and happy hours in Rogers Park and Edgewater.",
    externalLinks: [
      { label: "Loyola University Chicago campus dining", url: "https://www.luc.edu/dining/" },
      { label: "Rogers Park neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/rogers-park/" },
    ],
  },
  uic: {
    schoolName: "University of Illinois Chicago",
    neighborhoods: ["university-village", "pilsen"],
    seoTitle: "Best Food & Drink Deals Near UIC",
    description:
      "Cheap eats and drink specials near UIC campus. Student-friendly deals, happy hours, and daily specials in University Village and Pilsen neighborhoods.",
    externalLinks: [
      { label: "UIC dining services", url: "https://dining.uic.edu/" },
      { label: "Pilsen neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/pilsen/" },
    ],
  },
  northwestern: {
    schoolName: "Northwestern University",
    neighborhoods: ["evanston"],
    seoTitle: "Best Deals & Happy Hours Near Northwestern",
    description:
      "Food and drink deals near Northwestern University in Evanston. Student-friendly restaurants, happy hours, and daily specials within walking distance.",
    externalLinks: [
      { label: "Northwestern dining", url: "https://www.northwestern.edu/dining/" },
      { label: "City of Evanston restaurants", url: "https://www.cityofevanston.org/business/shop-dine-evanston" },
    ],
  },
  iit: {
    schoolName: "Illinois Institute of Technology",
    neighborhoods: ["bronzeville", "south-loop"],
    seoTitle: "Best Food & Drink Deals Near IIT",
    description:
      "Cheap eats and drink specials near Illinois Institute of Technology. Student deals, happy hours, and daily specials in Bronzeville and South Loop.",
    externalLinks: [
      { label: "Illinois Tech campus life", url: "https://www.iit.edu/student-life" },
      { label: "Bronzeville neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/bronzeville/" },
    ],
  },
  "north-park": {
    schoolName: "North Park University",
    neighborhoods: ["albany-park", "lincoln-square"],
    seoTitle: "Deals & Happy Hours Near North Park",
    description:
      "Food and drink deals near North Park University. Student-friendly restaurants, happy hours, and daily specials in Albany Park and Lincoln Square.",
    externalLinks: [
      { label: "North Park University", url: "https://www.northpark.edu/" },
      { label: "Albany Park neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/albany-park/" },
    ],
  },
  "wilbur-wright": {
    schoolName: "Wilbur Wright College",
    neighborhoods: ["dunning", "portage-park"],
    seoTitle: "Deals & Happy Hours Near Wilbur Wright",
    description:
      "Cheap eats and drink specials near Wilbur Wright College. Student-friendly deals, happy hours, and daily specials in Dunning and Portage Park.",
    externalLinks: [
      { label: "Wilbur Wright College", url: "https://www.ccc.edu/colleges/wright/" },
      { label: "Portage Park neighborhood guide", url: "https://www.choosechicago.com/neighborhoods/portage-park/" },
    ],
  },
}

// ─── "Near a landmark" landing page configs ─────────────────
// High-intent event/convention/tourist surface: "restaurants near
// McCormick Place", "bars near Wrigley Field". Reuses the per-neighborhood
// deal aggregation pattern (no geo math), each landmark maps to the
// neighborhood slugs within walking distance.

export interface LandmarkPageConfig {
  landmarkName: string
  /** Short context line for the intro (what the landmark is). */
  blurb: string
  neighborhoods: string[] // neighborhood slugs within walking distance
  seoTitle: string
  description: string
  externalLinks: { label: string; url: string }[]
}

export const LANDMARK_PAGES: Record<string, LandmarkPageConfig> = {
  "wrigley-field": {
    landmarkName: "Wrigley Field",
    blurb: "the Cubs' historic Wrigleyville ballpark",
    neighborhoods: ["wrigleyville", "lakeview", "lincoln-park"],
    seoTitle: "Bars & Restaurants Near Wrigley Field, Deals & Specials",
    description:
      "The best bars and restaurants within walking distance of Wrigley Field. Cubs game-day specials, pre-game brunch, and post-game happy hours across Wrigleyville, Lakeview, and Lincoln Park. Updated daily.",
    externalLinks: [
      { label: "Cubs schedule", url: "https://www.mlb.com/cubs/schedule" },
      { label: "Cubs game-day guide", url: "https://www.312deals.com/guides/cubs-game-day-chicago" },
    ],
  },
  "united-center": {
    landmarkName: "United Center",
    blurb: "home of the Bulls and Blackhawks (and major concerts)",
    neighborhoods: ["near-west-side", "west-loop", "west-town"],
    seoTitle: "Bars Near United Center, Bulls, Blackhawks & Concert Deals",
    description:
      "Where to eat and drink near the United Center before a Bulls game, Blackhawks game, or concert. Pre-game and pre-show specials across the Near West Side, West Loop, and West Town. Updated daily.",
    externalLinks: [
      { label: "United Center events", url: "https://www.unitedcenter.com/events/" },
    ],
  },
  "mccormick-place": {
    landmarkName: "McCormick Place",
    blurb: "the largest convention center in North America",
    neighborhoods: ["south-loop", "chinatown"],
    seoTitle: "Restaurants Near McCormick Place, Convention Dining Deals",
    description:
      "In town for a convention? The best restaurants and bars near McCormick Place, happy hours, dinner specials, and group-friendly spots across the South Loop and Chinatown. Updated daily.",
    externalLinks: [
      { label: "McCormick Place", url: "https://www.mccormickplace.com/" },
    ],
  },
  "navy-pier": {
    landmarkName: "Navy Pier",
    blurb: "Chicago's lakefront landmark and tourist destination",
    neighborhoods: ["streeterville"],
    seoTitle: "Restaurants & Bars Near Navy Pier, Deals & Happy Hours",
    description:
      "The best food and drink deals near Navy Pier and Streeterville. Lakefront happy hours, dinner specials, and tourist-friendly spots a short walk from the pier. Updated daily.",
    externalLinks: [
      { label: "Navy Pier", url: "https://navypier.org/" },
    ],
  },
  "magnificent-mile": {
    landmarkName: "the Magnificent Mile",
    blurb: "Chicago's flagship shopping and hotel district",
    neighborhoods: ["gold-coast", "streeterville"],
    seoTitle: "Deals Near the Magnificent Mile, Bars & Restaurants",
    description:
      "Where to eat and drink near the Magnificent Mile. Happy hours, dinner deals, and shopping-break spots across the Gold Coast and Streeterville. Updated daily.",
    externalLinks: [
      { label: "The Magnificent Mile", url: "https://themagnificentmile.com/" },
    ],
  },
  "soldier-field": {
    landmarkName: "Soldier Field",
    blurb: "home of the Chicago Bears",
    neighborhoods: ["south-loop"],
    seoTitle: "Bars Near Soldier Field, Bears Game Day & Tailgate Deals",
    description:
      "Where to drink and eat before a Bears game or Soldier Field concert. Game-day specials, tailgate-adjacent bars, and pre-show happy hours across the South Loop and Museum Campus. Updated daily.",
    externalLinks: [
      { label: "Soldier Field events", url: "https://www.soldierfield.com/events" },
    ],
  },
  "rate-field": {
    landmarkName: "Rate Field",
    blurb: "home of the White Sox (formerly Guaranteed Rate Field / Comiskey Park)",
    neighborhoods: ["bridgeport", "chinatown"],
    seoTitle: "Bars Near Rate Field, White Sox Game Day Deals (Sox Park)",
    description:
      "Where to eat and drink near Rate Field (formerly Guaranteed Rate Field), home of the White Sox. Sox game-day specials and pre-game bars across Bridgeport and Chinatown. Updated daily.",
    externalLinks: [
      { label: "White Sox schedule", url: "https://www.mlb.com/whitesox/schedule" },
    ],
  },
  "allstate-arena": {
    landmarkName: "Allstate Arena",
    blurb: "Rosemont's concert, Wolves, and Sky arena near O'Hare",
    neighborhoods: ["rosemont"],
    seoTitle: "Bars & Restaurants Near Allstate Arena (Rosemont)",
    description:
      "Where to eat and drink near Allstate Arena and the Rosemont entertainment district. Pre-concert and pre-event happy hours and dinner deals, minutes from O'Hare. Updated daily.",
    externalLinks: [
      { label: "Allstate Arena events", url: "https://www.allstatearena.com/events" },
    ],
  },
}

// ─── Cuisine landing page configs ───────────────────────────

export interface CuisinePageConfig {
  label: string
  seoTitle: string
  /** Optional comma-separated cuisine list for umbrella pages (e.g. "asian"
   *  spans japanese/chinese/thai/…). The API OR-matches each via LIKE. When
   *  unset, the route slug itself is used as the cuisine filter. */
  apiCuisines?: string
}

export const CUISINE_PAGES: Record<string, CuisinePageConfig> = {
  asian: {
    label: "Asian",
    seoTitle: "Asian Food Deals in Chicago",
    // Umbrella over the asian sub-cuisines, 403 venues vs 31 for literal "asian".
    apiCuisines: "asian,japanese,chinese,thai,korean,vietnamese,sushi,ramen",
  },
  mexican: { label: "Mexican", seoTitle: "Mexican Food Deals in Chicago" },
  italian: { label: "Italian", seoTitle: "Italian Restaurant Deals in Chicago" },
  american: { label: "American", seoTitle: "American Restaurant Deals in Chicago" },
  japanese: { label: "Japanese", seoTitle: "Japanese Restaurant Deals in Chicago" },
  chinese: { label: "Chinese", seoTitle: "Chinese Food Deals in Chicago" },
  thai: { label: "Thai", seoTitle: "Thai Food Deals in Chicago" },
  indian: { label: "Indian", seoTitle: "Indian Restaurant Deals in Chicago" },
  korean: { label: "Korean", seoTitle: "Korean Restaurant Deals in Chicago" },
  mediterranean: { label: "Mediterranean", seoTitle: "Mediterranean Food Deals in Chicago" },
  sushi: { label: "Sushi", seoTitle: "Sushi Deals in Chicago" },
  pizza: { label: "Pizza", seoTitle: "Pizza Deals in Chicago" },
  seafood: { label: "Seafood", seoTitle: "Seafood Deals in Chicago" },
  bbq: { label: "BBQ", seoTitle: "BBQ Deals in Chicago" },
  greek: { label: "Greek", seoTitle: "Greek Restaurant Deals in Chicago" },
  vietnamese: { label: "Vietnamese", seoTitle: "Vietnamese Food Deals in Chicago" },
  french: { label: "French", seoTitle: "French Restaurant Deals in Chicago" },
  steakhouse: { label: "Steakhouse", seoTitle: "Steakhouse Deals in Chicago" },
  tacos: { label: "Tacos", seoTitle: "Taco Deals in Chicago" },
  burgers: { label: "Burgers", seoTitle: "Burger Deals in Chicago" },
  wings: { label: "Wings", seoTitle: "Wing Deals in Chicago" },
  deli: {
    label: "Deli",
    seoTitle: "Chicago Deli Deals, Sandwiches, Subs & Lunch Specials",
    apiCuisines: "deli,delicatessen,sandwich",
  },
  gastropub: {
    label: "Gastropub",
    seoTitle: "Chicago Gastropub Deals, Craft Beer & Elevated Pub Food",
    // Umbrella over pub/brewery/tavern, pulls ~100 venues vs 8 for literal.
    apiCuisines: "gastropub,pub,brewery,brewpub,tavern",
  },
  irish: {
    label: "Irish Pub",
    seoTitle: "Chicago Irish Pub Deals, Guinness, Whiskey & Pub Grub",
    apiCuisines: "irish",
  },
  breakfast: {
    label: "Breakfast",
    seoTitle: "Chicago Breakfast Deals, Diners, Cafes & Morning Specials",
    apiCuisines: "breakfast,diner,pancake",
  },
  coffee: {
    label: "Coffee",
    seoTitle: "Chicago Coffee Deals, Cafe Specials & Coffee Shop Discounts",
    apiCuisines: "coffee,espresso,cafe",
  },
  bakery: {
    label: "Bakery",
    seoTitle: "Chicago Bakery Deals, Pastries, Donuts & Dessert Specials",
    apiCuisines: "bakery,patisserie,donut,pastry,dessert",
  },
  "sports-bar": {
    label: "Sports Bar",
    seoTitle: "Chicago Sports Bar Deals, Game Day Specials & Cheap Beer",
    apiCuisines: "sports bar",
  },
  "cocktail-bar": {
    label: "Cocktail Bar",
    seoTitle: "Chicago Cocktail Bar Deals, Happy Hours & Craft Cocktails",
    apiCuisines: "cocktail bar,cocktail lounge,speakeasy",
  },
  "wine-bar": {
    label: "Wine Bar",
    seoTitle: "Chicago Wine Bar Deals, $5 Glasses & Wine Happy Hours",
    apiCuisines: "wine bar,enoteca",
  },
  "middle-eastern": {
    label: "Middle Eastern",
    seoTitle: "Chicago Middle Eastern Food Deals, Shawarma, Falafel & More",
    apiCuisines: "middle eastern,lebanese,turkish,persian,falafel,shawarma",
  },
  southern: {
    label: "Southern",
    seoTitle: "Chicago Southern Food Deals, Soul Food, Cajun & Creole",
    apiCuisines: "southern,soul,cajun,creole",
  },
  ramen: {
    label: "Ramen",
    seoTitle: "Chicago Ramen Deals, Ramen Specials & Noodle Shops",
    apiCuisines: "ramen,noodle",
  },
}

// ─── Programmatic SEO: neighborhood × deal-type pages ──────

export interface DealTypeSlugConfig {
  apiValue: string
  label: string
  singular: string
}

/** Maps URL-friendly slugs to API deal_type values and display labels. */
export const DEAL_TYPE_SLUGS: Record<string, DealTypeSlugConfig> = {
  "happy-hour": { apiValue: "happy_hour", label: "Happy Hours", singular: "happy hour" },
  "daily-special": { apiValue: "daily_special", label: "Daily Specials", singular: "daily special" },
  "brunch-deal": { apiValue: "brunch_deal", label: "Brunch Deals", singular: "brunch" },
  "late-night": { apiValue: "late_night", label: "Late Night", singular: "late night" },
  "game-day": { apiValue: "game_day", label: "Game Day", singular: "game day" },
  "seasonal-lto": { apiValue: "seasonal_lto", label: "Limited Time Offers", singular: "limited time offer" },
  "chain-app-deal": { apiValue: "chain_app_deal", label: "Chain Deals", singular: "chain deal" },
}

/** Reverse lookup: API deal_type → URL slug */
export const DEAL_TYPE_API_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(DEAL_TYPE_SLUGS).map(([slug, c]) => [c.apiValue, slug])
)

// ─── Breadcrumb JSON-LD ─────────────────────────────────────

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// ─── Price extraction ───────────────────────────────────────

/** Return the lowest deal_price across food + drink items, or null. */
export function getLowestDealPrice(deal: Deal): number | null {
  let low: number | null = null
  for (const item of deal.drink_items ?? []) {
    if (item.deal_price != null && (low === null || item.deal_price < low))
      low = item.deal_price
  }
  for (const item of deal.food_items ?? []) {
    if (item.deal_price != null && (low === null || item.deal_price < low))
      low = item.deal_price
  }
  return low
}

// ─── Helpers ────────────────────────────────────────────────

export function slugToName(slug: string): string {
  if (!slug) return ""
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatTime(t: string | null): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
}

export function buildCheapestDrink(deals: Deal[]): string | null {
  let cheapest: { name: string; price: number } | null = null
  for (const d of deals) {
    for (const item of d.drink_items ?? []) {
      if (item.deal_price && (!cheapest || item.deal_price < cheapest.price)) {
        cheapest = { name: item.name, price: item.deal_price }
      }
    }
  }
  return cheapest ? `${cheapest.name} for $${cheapest.price.toFixed(2)}` : null
}

export function buildItemListJsonLd(
  title: string,
  url: string,
  deals: Deal[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: `${deals.length} food & drink deals`,
    url,
    numberOfItems: deals.length,
    itemListElement: deals.slice(0, 20).map((deal, i) => {
      const price = getLowestDealPrice(deal)
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Offer",
          name: `${deal.venue_name}, ${deal.title}`,
          description: deal.description,
          ...(price != null && { price: price.toFixed(2) }),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          ...(deal.start_time && { availabilityStarts: deal.start_time }),
          ...(deal.end_time && { availabilityEnds: deal.end_time }),
          offeredBy: {
            "@type": "Restaurant",
            name: deal.venue_name,
            address: {
              "@type": "PostalAddress",
              // Neighborhood stands in for locality here — the deal payload has
              // no city field, and for a suburb the two are the same value.
              // Better than claiming every suburban venue is in Chicago.
              addressLocality: deal.neighborhood || "Chicago",
              addressRegion: "IL",
            },
          },
        },
      }
    }),
  }
}

// ─── Blog Article JSON-LD ─────────────────────────────────

export function buildBlogArticleJsonLd(post: {
  title: string
  description: string
  slug: string
  date: string
  coverImage?: string
  author?: string
  tags?: string[]
}) {
  const SITE_URL = "https://www.312deals.com"
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    author: {
      "@type": "Organization",
      name: post.author ?? "312Deals",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "312Deals",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/apple-touch-icon.png`,
      },
    },
    image: post.coverImage
      ? `${SITE_URL}${post.coverImage}`
      : `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&subtitle=312Deals+Blog`,
    datePublished: post.date,
    dateModified: post.date,
    ...(post.tags &&
      post.tags.length > 0 && { keywords: post.tags.join(", ") }),
  }
}

export function buildFaqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  }
}

export function uniqueVenueCount(deals: Deal[]): number {
  return new Set(deals.map((d) => d.venue_name)).size
}

export function topVenueNames(deals: Deal[], n = 3): string[] {
  const counts = new Map<string, number>()
  for (const d of deals) {
    counts.set(d.venue_name, (counts.get(d.venue_name) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name)
}
