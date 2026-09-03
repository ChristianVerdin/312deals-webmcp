import { create } from "zustand"
import { persist } from "zustand/middleware"

// A stop on tonight's plan. Both the person (panel UI) and their agent (WebMCP
// tools) read and write the same list; `locked` is the person's veto — agent
// tools refuse to move or remove a locked stop.
export interface TonightStop {
  id: string
  dealId: number | null
  venueId: number | null
  venueName: string
  venueSlug: string | null
  neighborhood: string | null
  address: string | null
  dealTitle: string | null
  dealType: string | null
  daysAvailable: string[] | null
  startTime: string | null
  endTime: string | null
  isAllDay: boolean
  estimatedSavings: number | null
  resyUrl: string | null
  opentableUrl: string | null
  onlineOrderUrl: string | null
  addedBy: "you" | "agent"
  locked: boolean
  note: string | null
  addedAt: string
}

export interface TonightConstraints {
  budgetPerPerson: number | null
  startTime: string | null
  endTime: string | null
  groupSize: number | null
  maxStops: number | null
  neighborhood: string | null
}

export type TonightStopInput = Omit<TonightStop, "id" | "addedAt" | "locked"> & { locked?: boolean }

interface MutationResult {
  ok: boolean
  reason?: string
}

interface StoreState {
  savedDeals: number[]
  toggleSaveDeal: (dealId: number) => void
  isSaved: (dealId: number) => boolean
  filters: {
    neighborhood: string | null
    day: string | null
    deal_type: string | null
    q: string | null
    cuisine: string | null
  }
  setFilters: (filters: Partial<StoreState["filters"]>) => void
  resetFilters: () => void
  tonight: {
    stops: TonightStop[]
    constraints: TonightConstraints
    updatedAt: string | null
    lastChangeBy: "you" | "agent" | null
  }
  addTonightStop: (stop: TonightStopInput, position?: number) => TonightStop
  removeTonightStop: (id: string, opts?: { force?: boolean }) => MutationResult
  moveTonightStop: (id: string, position: number, opts?: { force?: boolean }) => MutationResult
  setTonightLocked: (id: string, locked: boolean) => void
  setTonightNote: (id: string, note: string | null) => void
  reorderTonightUnlocked: (orderedUnlockedIds: string[], by: "you" | "agent") => MutationResult
  setTonightConstraints: (c: Partial<TonightConstraints>, by: "you" | "agent") => void
  clearTonight: (opts?: { keepLocked?: boolean; by?: "you" | "agent" }) => number
}

const defaultFilters = {
  neighborhood: null,
  day: null,
  deal_type: null,
  q: null,
  cuisine: null,
}

const defaultConstraints: TonightConstraints = {
  budgetPerPerson: null,
  startTime: null,
  endTime: null,
  groupSize: null,
  maxStops: null,
  neighborhood: null,
}

const defaultTonight = {
  stops: [] as TonightStop[],
  constraints: { ...defaultConstraints },
  updatedAt: null as string | null,
  lastChangeBy: null as "you" | "agent" | null,
}

function newId() {
  return `stop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function clampPosition(position: number | undefined, length: number) {
  if (position == null || Number.isNaN(position)) return length
  return Math.max(0, Math.min(Math.floor(position), length))
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      savedDeals: [],
      toggleSaveDeal: (dealId: number) =>
        set((state) => ({
          savedDeals: state.savedDeals.includes(dealId)
            ? state.savedDeals.filter((id) => id !== dealId)
            : [...state.savedDeals, dealId],
        })),
      isSaved: (dealId: number) => get().savedDeals.includes(dealId),
      filters: { ...defaultFilters },
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),

      tonight: { ...defaultTonight },

      addTonightStop: (input, position) => {
        const stop: TonightStop = {
          ...input,
          locked: input.locked ?? false,
          id: newId(),
          addedAt: new Date().toISOString(),
        }
        set((state) => {
          const stops = [...state.tonight.stops]
          stops.splice(clampPosition(position, stops.length), 0, stop)
          return {
            tonight: {
              ...state.tonight,
              stops,
              updatedAt: stop.addedAt,
              lastChangeBy: input.addedBy,
            },
          }
        })
        return stop
      },

      removeTonightStop: (id, opts) => {
        const stop = get().tonight.stops.find((s) => s.id === id)
        if (!stop) return { ok: false, reason: "No stop with that id." }
        if (stop.locked && !opts?.force) {
          return { ok: false, reason: `${stop.venueName} is locked by the user. Ask them to unlock it before removing.` }
        }
        set((state) => ({
          tonight: {
            ...state.tonight,
            stops: state.tonight.stops.filter((s) => s.id !== id),
            updatedAt: new Date().toISOString(),
            lastChangeBy: opts?.force ? "you" : "agent",
          },
        }))
        return { ok: true }
      },

      moveTonightStop: (id, position, opts) => {
        const stops = [...get().tonight.stops]
        const from = stops.findIndex((s) => s.id === id)
        if (from === -1) return { ok: false, reason: "No stop with that id." }
        if (stops[from].locked && !opts?.force) {
          return { ok: false, reason: `${stops[from].venueName} is locked by the user and stays at stop ${from + 1}.` }
        }
        const [stop] = stops.splice(from, 1)
        const to = clampPosition(position, stops.length)
        if (!opts?.force && stops[to]?.locked && to < stops.length) {
          // Never displace a locked stop from its slot
          const target = stops[to]
          stops.splice(from, 0, stop)
          return { ok: false, reason: `Stop ${to + 1} is ${target.venueName}, locked by the user. Choose another position.` }
        }
        stops.splice(to, 0, stop)
        set((state) => ({
          tonight: {
            ...state.tonight,
            stops,
            updatedAt: new Date().toISOString(),
            lastChangeBy: opts?.force ? "you" : "agent",
          },
        }))
        return { ok: true }
      },

      setTonightLocked: (id, locked) =>
        set((state) => ({
          tonight: {
            ...state.tonight,
            stops: state.tonight.stops.map((s) => (s.id === id ? { ...s, locked } : s)),
            updatedAt: new Date().toISOString(),
            lastChangeBy: "you",
          },
        })),

      setTonightNote: (id, note) =>
        set((state) => ({
          tonight: {
            ...state.tonight,
            stops: state.tonight.stops.map((s) => (s.id === id ? { ...s, note } : s)),
            updatedAt: new Date().toISOString(),
            lastChangeBy: "you",
          },
        })),

      // Reorders only the unlocked stops; locked stops keep their exact slots.
      reorderTonightUnlocked: (orderedUnlockedIds, by) => {
        const stops = get().tonight.stops
        const unlocked = stops.filter((s) => !s.locked)
        const wanted = orderedUnlockedIds.filter((id) => unlocked.some((s) => s.id === id))
        if (wanted.length !== unlocked.length) {
          return { ok: false, reason: "The order must list every unlocked stop exactly once." }
        }
        const queue = wanted.map((id) => unlocked.find((s) => s.id === id)!)
        const next = stops.map((s) => (s.locked ? s : queue.shift()!))
        set((state) => ({
          tonight: { ...state.tonight, stops: next, updatedAt: new Date().toISOString(), lastChangeBy: by },
        }))
        return { ok: true }
      },

      setTonightConstraints: (c, by) =>
        set((state) => ({
          tonight: {
            ...state.tonight,
            constraints: { ...state.tonight.constraints, ...c },
            updatedAt: new Date().toISOString(),
            lastChangeBy: by,
          },
        })),

      clearTonight: (opts) => {
        const keepLocked = opts?.keepLocked ?? true
        const before = get().tonight.stops
        const stops = keepLocked ? before.filter((s) => s.locked) : []
        set((state) => ({
          tonight: {
            ...state.tonight,
            stops,
            updatedAt: new Date().toISOString(),
            lastChangeBy: opts?.by ?? "you",
          },
        }))
        return before.length - stops.length
      },
    }),
    { name: "chideals-storage" }
  )
)
