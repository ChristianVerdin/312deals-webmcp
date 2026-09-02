import { create } from "zustand"
import { persist } from "zustand/middleware"

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
}

const defaultFilters = {
  neighborhood: null,
  day: null,
  deal_type: null,
  q: null,
  cuisine: null,
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
    }),
    { name: "chideals-storage" }
  )
)
