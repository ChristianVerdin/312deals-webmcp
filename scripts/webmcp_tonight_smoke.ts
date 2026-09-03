/**
 * Exercises the Tonight tools the way an agent would, against the live API,
 * without a browser: resolve venues, pick deals, and confirm the lock/veto
 * contract returns refusals as data. Run: npx tsx scripts/webmcp_tonight_smoke.ts
 */
import { useStore } from "../src/store/use-store"
import { TONIGHT_TOOLS } from "../src/webmcp/tonight_tools.js"

const API = process.env.API_URL || "https://www.312deals.com"
const realFetch = globalThis.fetch
globalThis.fetch = ((input: any, init?: any) => {
  const url = typeof input === "string" && input.startsWith("/") ? API + input : input
  return realFetch(url, init)
}) as typeof fetch

const tool = (name: string) => {
  const t = (TONIGHT_TOOLS as any[]).find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return async (params: any = {}) => JSON.parse((await t.execute(params)).content[0].text)
}

function check(cond: unknown, label: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  let r = await tool("tonight_get_plan")()
  check(r.stop_count === 0, "empty plan reads as empty with guidance")

  r = await tool("tonight_set_constraints")({ budget_per_person: 40, start_time: "18:00", max_stops: 3, neighborhood: "Wicker Park" })
  check(r.ok && r.constraints.budgetPerPerson === 40 && r.constraints.maxStops === 3, "constraints set")

  r = await tool("tonight_add_stop")({ venue_name: "Big Star", note: "tacos + margs" })
  check(r.ok && r.added && r.added.venue_name && r.stop_count === 1, `add by venue name -> ${r.added?.venue_name} / ${r.added?.deal}`)
  const first = r.added?.stop_id

  r = await tool("tonight_add_stop")({ venue_name: "The Violet Hour" })
  check(r.stop_count === 2, `second stop -> ${r.added?.venue_name} / ${r.added?.deal}`)

  r = await tool("tonight_add_stop")({ venue_name: "Piece Brewery" })
  check(r.stop_count === 3, `third stop -> ${r.added?.venue_name}`)

  r = await tool("tonight_add_stop")({ venue_name: "Au Cheval" })
  check(!!r.error && r.stop_count === 3, "max_stops enforced with a readable error")

  r = await tool("tonight_add_stop")({ venue_name: "zzz-not-a-real-venue-qq" })
  check(!!r.error, "unknown venue -> error, not throw")

  // Person locks stop 1 in the panel
  useStore.getState().setTonightLocked(first, true)

  r = await tool("tonight_remove_stop")({ stop: "1" })
  check(r.ok === false && /locked/i.test(r.reason || ""), `remove locked stop refused: "${r.reason}"`)

  r = await tool("tonight_move_stop")({ stop: "1", position: 3 })
  check(r.ok === false, "move locked stop refused")

  r = await tool("tonight_move_stop")({ stop: "3", position: 1 })
  check(r.ok === false && /locked/i.test(r.reason || ""), "displacing a locked slot refused")

  r = await tool("tonight_move_stop")({ stop: "3", position: 2 })
  check(r.ok === true && r.stops[1].stop_id !== first, "move unlocked stop into an unlocked slot")

  r = await tool("tonight_order_by_deal_window")()
  check(r.ok === true && r.stops[0].stop_id === first && r.locked_stops.join() === "1", "reorder keeps the locked stop in slot 1")

  r = await tool("tonight_remove_stop")({ stop: "2" })
  check(r.ok === true && r.stop_count === 2, "remove unlocked stop")

  r = await tool("tonight_clear")({})
  check(r.ok && r.stop_count === 1 && r.stops[0].locked_by_user, "clear keeps the locked stop")

  r = await tool("tonight_clear")({ keep_locked: false })
  check(r.stop_count === 0, "clear with keep_locked=false empties the plan")

  r = await tool("tonight_get_plan")()
  console.log("final guidance:", r.guidance)
}

main().catch((e) => {
  console.error("SMOKE CRASH", e)
  process.exitCode = 1
})
