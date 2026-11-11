"use client"

// Location picker for a master record (a user's home, a village centre): click the map or drag the pin, or type the
// numbers. Values are kept as text, like every master field, rounded to 6 decimals (about 10 cm). Without a Maps key
// only the two number boxes show.
import * as React from "react"
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GOOGLE_MAPS_LOADER, hasMapKey } from "@/lib/google-maps"
import type { LatLng } from "@/lib/orchestration/engine"

/** Centre of India, for a picker with no point and no village to start from. */
const COUNTRY_CENTRE: LatLng = { lat: 22.5, lng: 79 }
const CONTAINER = { width: "100%", height: "100%" }

const parse = (v: string | undefined) => {
    const n = parseFloat(String(v ?? ""))
    return Number.isFinite(n) ? n : undefined
}

/** A point from the two text values, when both are numbers in range. */
export function pointOf(lat: string | undefined, lng: string | undefined): LatLng | undefined {
    const a = parse(lat)
    const b = parse(lng)
    return a !== undefined && b !== undefined && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : undefined
}

export function LocationPicker({
    id,
    lat,
    lng,
    near,
    onChange,
}: {
    id: string
    lat?: string
    lng?: string
    /** Where to look when there's no point yet (e.g. the first village with a centre). */
    near?: LatLng
    onChange: (lat: string, lng: string) => void
}) {
    const point = pointOf(lat, lng)
    const set = (p: LatLng) => onChange(p.lat.toFixed(6), p.lng.toFixed(6))

    return (
        <div className="space-y-2">
            {hasMapKey && <PickerMap point={point} near={near} onPick={set} />}
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    aria-label="Latitude"
                    placeholder="Latitude, e.g. 21.256700"
                    value={lat ?? ""}
                    onChange={(e) => onChange(e.target.value, lng ?? "")}
                    className="h-9 text-xs"
                />
                <Input
                    aria-label="Longitude"
                    placeholder="Longitude, e.g. 77.510400"
                    value={lng ?? ""}
                    onChange={(e) => onChange(lat ?? "", e.target.value)}
                    className="h-9 text-xs"
                />
                {(lat || lng) && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => onChange("", "")}>
                        Clear
                    </Button>
                )}
            </div>
            {(lat || lng) && !point && <p className="text-[11px] text-rose-600">Enter both numbers (latitude −90 to 90, longitude −180 to 180).</p>}
        </div>
    )
}

function PickerMap({ point, near, onPick }: { point?: LatLng; near?: LatLng; onPick: (p: LatLng) => void }) {
    const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER)
    // Centre once, on the point (or the nearby place) the dialog opened with; later picks don't move the map.
    const [initial] = React.useState(() => ({ centre: point ?? near ?? COUNTRY_CENTRE, zoom: point ? 16 : near ? 12 : 5 }))
    const pick = (e: google.maps.MapMouseEvent) => e.latLng && onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() })

    return (
        <div className="relative h-[220px] overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            {loadError ? (
                <p className="p-4 text-xs text-zinc-500">The map didn&apos;t load. Type the numbers below instead.</p>
            ) : !isLoaded ? (
                <p className="p-4 text-xs text-zinc-500">Loading map…</p>
            ) : (
                <GoogleMap
                    mapContainerStyle={CONTAINER}
                    center={initial.centre}
                    zoom={initial.zoom}
                    onClick={pick}
                    options={{
                        mapTypeId: "hybrid",
                        streetViewControl: false,
                        fullscreenControl: false,
                        mapTypeControl: false,
                        clickableIcons: false,
                        draggableCursor: "crosshair",
                    }}
                >
                    {point && <MarkerF position={point} draggable onDragEnd={pick} />}
                </GoogleMap>
            )}
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 shadow-sm">
                Click the map or drag the pin
            </span>
        </div>
    )
}
