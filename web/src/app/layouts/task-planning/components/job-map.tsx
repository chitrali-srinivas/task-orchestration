"use client"

// Job map — Google Maps (Maps JavaScript API). The key is NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (platform/env.ts, see
// web/.env.example); the loader uses the same id and libraries as the repo's other Google maps so they share one script.
// Shows the base village and the numbered stops joined in visiting order and back to the base (straight lines until the
// Routes API is wired in), each leg labelled with its distance and drive time, the day's unassigned tasks as grey pins
// and, when ticked, other jobs' stops; clicking a pin offers to add it to this job. Without a key it shows how to set
// one; the task list and the route info work either way.
import * as React from "react"
import { GoogleMap, InfoWindow, Marker, OVERLAY_LAYER, OverlayViewF, Polyline, useJsApiLoader } from "@react-google-maps/api"
import { MapPinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { env } from "@/platform/env"
import type { LatLng } from "@/lib/orchestration/engine"

const LIBRARIES: "geometry"[] = ["geometry"]
const CONTAINER = { width: "100%", height: "100%" }
const centred = (width: number, height: number) => ({ x: -width / 2, y: -height / 2 })

/** Whether maps can load (the key is built in, so this is fixed for the page's life). */
export const hasMapKey = Boolean(env.googleMapsApiKey)

export interface MapStop {
    key: string
    no: number
    label: string
    location: LatLng
    done: boolean
}

/** One leg between two nodes (base or stops), with its label placed clear of the markers. */
export interface MapLeg {
    key: string
    from: LatLng
    to: LatLng
    labelAt: LatLng
    label: string
}

export interface MapCandidate {
    key: string
    label: string
    detail: string
    location: LatLng
    kind: "unassigned" | "other-job"
    /** "Add to J2" / "Move to J2"; none when it can't be added. */
    actionLabel?: string
}

interface JobMapProps {
    base?: LatLng
    stops: MapStop[]
    legs: MapLeg[]
    candidates: MapCandidate[]
    activeKey?: string | null
    onSelectStop: (key: string) => void
    onPickCandidate: (key: string) => void
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MapPinOff className="h-5 w-5 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
            <div className="max-w-[340px] text-xs leading-relaxed text-zinc-500">{children}</div>
        </div>
    )
}

export function JobMap(props: JobMapProps) {
    if (!hasMapKey)
        return (
            <Notice title="Google Maps key not set">
                Add <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code className="font-mono">web/.env.local</code> (see{" "}
                <code className="font-mono">web/.env.example</code>) and restart the dev server. The stop list, distances and effort work without it.
            </Notice>
        )
    return <GoogleJobMap {...props} />
}

function GoogleJobMap({ base, stops, legs, candidates, activeKey, onSelectStop, onPickCandidate }: JobMapProps) {
    const { isLoaded, loadError } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: env.googleMapsApiKey, libraries: LIBRARIES })
    const [map, setMap] = React.useState<google.maps.Map | null>(null)
    const [openKey, setOpenKey] = React.useState<string | null>(null)

    // Fit the job's base and stops (or the candidates when the job has none) whenever they change.
    const points = React.useMemo(() => {
        const job = [...(base ? [base] : []), ...stops.map((s) => s.location)]
        return job.length > 0 ? job : candidates.map((c) => c.location)
    }, [base, stops, candidates])
    const pointsKey = JSON.stringify(points)
    React.useEffect(() => {
        if (!map || points.length === 0) return
        if (points.length === 1) {
            map.setCenter(points[0])
            map.setZoom(14)
            return
        }
        const bounds = new google.maps.LatLngBounds()
        points.forEach((p) => bounds.extend(p))
        map.fitBounds(bounds, 48)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, pointsKey])

    // A stop picked in the list is brought into view.
    React.useEffect(() => {
        const stop = stops.find((s) => s.key === activeKey)
        if (map && stop) map.panTo(stop.location)
    }, [map, activeKey, stops])

    if (loadError) return <Notice title="Google Maps didn't load">Check that the key allows the Maps JavaScript API and this site&apos;s address.</Notice>
    if (!isLoaded) return <div className="h-full w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />

    const path = base && stops.length > 0 ? [base, ...stops.map((s) => s.location), base] : stops.map((s) => s.location)
    const open = candidates.find((c) => c.key === openKey)

    return (
        <GoogleMap
            mapContainerStyle={CONTAINER}
            center={points[0] ?? { lat: 21, lng: 78 }}
            zoom={points.length > 0 ? 12 : 5}
            onLoad={setMap}
            onUnmount={() => setMap(null)}
            onClick={() => setOpenKey(null)}
            options={{ mapTypeId: "hybrid", streetViewControl: false, fullscreenControl: false, clickableIcons: false, mapTypeControl: true }}
        >
            {path.length > 1 && (
                <Polyline
                    path={path}
                    options={{
                        strokeOpacity: 0,
                        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#ffffff", scale: 3 }, offset: "0", repeat: "12px" }],
                    }}
                />
            )}
            {legs.map((leg) => (
                <OverlayViewF
                    key={leg.key}
                    position={leg.labelAt}
                    mapPaneName={OVERLAY_LAYER}
                    getPixelPositionOffset={centred}
                >
                    <div className="whitespace-nowrap rounded-full border border-zinc-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-zinc-800 shadow-sm">{leg.label}</div>
                </OverlayViewF>
            ))}
            {candidates.map((c) => (
                <Marker
                    key={c.key}
                    position={c.location}
                    title={c.label}
                    zIndex={100}
                    onClick={() => setOpenKey(c.key)}
                    icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 6,
                        fillColor: c.kind === "unassigned" ? "#a1a1aa" : "#38bdf8",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 1.5,
                    }}
                />
            ))}
            {base && (
                <Marker
                    position={base}
                    title="Base village"
                    zIndex={200}
                    label={{ text: "B", color: "#18181b", fontSize: "10px", fontWeight: "700" }}
                    icon={{ path: "M -9 -9 L 9 -9 L 9 9 L -9 9 Z", fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#18181b", strokeWeight: 2, scale: 1 }}
                />
            )}
            {stops.map((s) => {
                const active = s.key === activeKey
                return (
                    <Marker
                        key={s.key}
                        position={s.location}
                        title={`Stop ${s.no} · ${s.label}`}
                        zIndex={active ? 1000 : 500 - s.no}
                        onClick={() => onSelectStop(s.key)}
                        label={{ text: String(s.no), color: "#ffffff", fontSize: "11px", fontWeight: "700" }}
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: active ? 14 : 11,
                            fillColor: s.done ? "#059669" : active ? "#0284c7" : "#18181b",
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2,
                        }}
                    />
                )
            })}
            {open && (
                <InfoWindow position={open.location} onCloseClick={() => setOpenKey(null)}>
                    <div className="min-w-[160px] space-y-1 text-zinc-900">
                        <div className="text-xs font-semibold">{open.label}</div>
                        <div className="text-[11px] text-zinc-600">{open.detail}</div>
                        {open.actionLabel && (
                            <Button
                                size="sm"
                                className="mt-1 h-7 w-full text-[11px]"
                                onClick={() => {
                                    onPickCandidate(open.key)
                                    setOpenKey(null)
                                }}
                            >
                                {open.actionLabel}
                            </Button>
                        )}
                    </div>
                </InfoWindow>
            )}
        </GoogleMap>
    )
}
