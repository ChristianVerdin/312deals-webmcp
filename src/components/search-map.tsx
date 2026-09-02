"use client"

import { useState, useCallback, useMemo } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
} from "@vis.gl/react-google-maps"
import { MapPin } from "lucide-react"
import {
  CHICAGO_CENTER,
  DEFAULT_ZOOM,
  groupDealsByVenue,
  MarkerPin,
  MapInfoWindow,
  FitBounds,
} from "@/components/map-utils"
import { useMapsKey } from "@/hooks/use-maps-key"
import type { Deal } from "@/lib/types"

export default function SearchMap({ deals }: { deals: Deal[] }) {
  const [selectedVenueKey, setSelectedVenueKey] = useState<string | null>(null)
  const { key: mapsApiKey, loading: mapsKeyLoading } = useMapsKey()

  const venueGroups = useMemo(() => groupDealsByVenue(deals), [deals])

  const selectedGroup = selectedVenueKey
    ? venueGroups.find(
        (g) =>
          `${g.lat.toFixed(5)},${g.lng.toFixed(5)}` === selectedVenueKey
      )
    : null

  const handleMarkerClick = useCallback(
    (key: string) => {
      setSelectedVenueKey(selectedVenueKey === key ? null : key)
    },
    [selectedVenueKey]
  )

  if (mapsKeyLoading) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted text-center sm:h-[500px]">
        <MapPin className="h-10 w-10 animate-pulse text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    )
  }

  if (!mapsApiKey) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted text-center sm:h-[500px]">
        <MapPin className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Map unavailable, API key not configured.
        </p>
      </div>
    )
  }

  const mappableDeals = deals.filter(
    (d) => d.latitude != null && d.longitude != null
  )

  if (mappableDeals.length === 0) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted text-center sm:h-[500px]">
        <MapPin className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          No deals with location data to show on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[350px] overflow-hidden rounded-xl border border-border sm:h-[500px]">
      <APIProvider apiKey={mapsApiKey}>
        <Map
          defaultCenter={CHICAGO_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          mapId="312deals-search-map"
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          className="h-full w-full"
        >
          <FitBounds deals={mappableDeals} />

          {venueGroups.map((group) => {
            const key = `${group.lat.toFixed(5)},${group.lng.toFixed(5)}`
            const isSelected = selectedVenueKey === key

            return (
              <AdvancedMarker
                key={key}
                position={{ lat: group.lat, lng: group.lng }}
                onClick={() => handleMarkerClick(key)}
                zIndex={isSelected ? 100 : undefined}
              >
                <MarkerPin deals={group.deals} isSelected={isSelected} />
              </AdvancedMarker>
            )
          })}

          {selectedGroup && (
            <MapInfoWindow
              deals={selectedGroup.deals}
              position={{ lat: selectedGroup.lat, lng: selectedGroup.lng }}
              onClose={() => setSelectedVenueKey(null)}
            />
          )}
        </Map>
      </APIProvider>
    </div>
  )
}
