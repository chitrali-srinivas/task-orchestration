"use client"

// Samples — the detail map (the module beside the sheet, as in Deployment V2). It draws every sample of the FARMER
// and the plots around them:
//   sample point     marker: colour = purpose, shape = kind (sample-markers.ts); hollow = not in the detail's status view
//   clusters         dense points group into zinc bubbles (count); they split as you zoom in (max zoom 18)
//   plot outline     white (V2's outline); the selected sample's plot is green; a hovered one lifts (V2 hover)
//   drawn boundary   drawn in the full-screen editor (PlotBoundaryEditor), saved through the API, then shown as a plot
// Motion is Deployment V2's (map-camera.ts, reused): the loader overlay fades out when the map is ready;
// a focused sample is flown to with V2's flyToPlot (zoom out → glide → zoom in; a short hop when it is already in
// view; one move with reduced motion) and its marker bounces on arrival for as long as it stays selected; Reset view
// frames the farmer clear of the legend and controls (overlayPadding). Selection is shared with the list both ways.
import * as React from "react"
import { GoogleMap, MarkerClustererF, MarkerF, PolygonF } from "@react-google-maps/api"
import { Loader2, PencilRuler, RotateCcw, X } from "lucide-react"
import { flyToPlot, overlayPadding, type CameraFocus } from "@/app/layouts/deployment-v2-oct-26/components/map-camera"
import { DetailRow } from "@/app/layouts/deployment-v2-oct-26/components/deployment-details-panel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BOUNDARY_LABEL, KIND_LABEL, PURPOSE_LABEL, personName } from "../domain/labels"
import type { PlotRef, Sample, SamplePurpose } from "../domain/types"
import { BucketBadge } from "./columns"
import { PLOT_OUTLINE, PLOT_OUTLINE_SELECTED, PURPOSE_COLOR, clusterIconUrl, sampleMarkerIcon } from "./sample-markers"

const DEFAULT_CENTER = { lat: 21.25, lng: 81.4 }
/** Clusters dissolve above this zoom, so the samples of one plot can always be told apart. */
const CLUSTER_MAX_ZOOM = 18
const MAP_CONTROL = "h-9 w-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
const MAP_SURFACE = "rounded-lg border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md"
const SECTION_LABEL = "text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none"
/** V2's compact detail row for a card floating on the map (map-overlays.tsx CARD_ROW). */
const CARD_ROW = "grid-cols-[96px_minmax(0,1fr)] gap-2 px-1.5 py-0.5"

// The clusterer ships with @react-google-maps/api (no extra dependency); its option types come from there too.
type ClustererOptions = NonNullable<React.ComponentProps<typeof MarkerClustererF>["options"]>
type ClusterIconStyle = NonNullable<ClustererOptions["styles"]>[number]
type TCalculator = NonNullable<ClustererOptions["calculator"]>
const CLUSTER_STYLES: ClusterIconStyle[] = [30, 36, 44].map((d) => ({ url: clusterIconUrl(d), width: d, height: d, textColor: "#ffffff", textSize: 11, fontWeight: "700" }))
const clusterCalculator: TCalculator = (markers) => {
    const n = markers.length
    return { text: String(n), index: n < 10 ? 1 : n < 25 ? 2 : 3, title: `${n} samples — zoom in to separate them` }
}

export interface MapFocus {
    sampleId: string
    seq: number
}

export function SamplesMap({ samples, plots, inViewIds, selectedId, onSelect, focus, onDrawBoundary }: {
    samples: Sample[]
    plots: PlotRef[]
    /** Samples in the detail's current status view (others are drawn hollow). */
    inViewIds: ReadonlySet<string>
    selectedId: string | null
    /** A marker click: the detail reveals the sample's card (V2: a map pick reveals its dispatch). */
    onSelect: (sampleId: string | null) => void
    /** A sample to fly to (a card expanded, a row revealed); null stops any flight. */
    focus: MapFocus | null
    /** Opens the boundary editor for a sample (only offered when the server says it is editable). */
    onDrawBoundary: (sample: Sample) => void
}) {
    const mapRef = React.useRef<google.maps.Map | null>(null)
    const programmatic = React.useRef(false)
    const flightCancel = React.useRef<(() => void) | null>(null)
    const [ready, setReady] = React.useState(false)
    const [moved, setMoved] = React.useState(false)
    const [hoveredId, setHoveredId] = React.useState<string | null>(null)
    /** V2: the focused sample's marker bounces once the camera arrives, for as long as it stays selected. */
    const [bouncing, setBouncing] = React.useState<string | null>(null)
    const located = React.useMemo(() => samples.filter((s) => s.location), [samples])
    const selected = samples.find((s) => s.sample_id === selectedId) ?? null
    const selectedPlotId = selected?.plot?.plot_id ?? null
    const hoveredPlotId = samples.find((s) => s.sample_id === hoveredId)?.plot?.plot_id ?? null

    // V2's farmer framing: every point and outline, clear of the legend (bottom-left) and controls (top-left)
    const fitAll = React.useCallback(() => {
        const map = mapRef.current
        if (!map) return
        flightCancel.current?.()
        const bounds = new google.maps.LatLngBounds()
        located.forEach((s) => bounds.extend(s.location!))
        plots.forEach((p) => p.outline?.forEach((pt) => bounds.extend(pt)))
        if (bounds.isEmpty()) return
        programmatic.current = true
        map.fitBounds(bounds, overlayPadding(map))
        google.maps.event.addListenerOnce(map, "idle", () => {
            if ((map.getZoom() ?? 0) > 18) map.setZoom(18)
            window.setTimeout(() => { programmatic.current = false }, 100)
        })
        setMoved(false)
        setBouncing(null)
    }, [located, plots])

    // a new farmer: frame their samples
    const farmerKey = samples[0]?.farmer_id ?? null
    React.useEffect(() => {
        if (ready) fitAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-frame when the farmer changes, not on every data refresh
    }, [ready, farmerKey])

    // a card expanded / a row revealed: V2's flight, then the marker bounces on arrival
    React.useEffect(() => {
        const map = mapRef.current
        const target = focus ? samples.find((s) => s.sample_id === focus.sampleId) : null
        if (!ready || !map || !target?.location) return
        const camera: CameraFocus = { seq: focus!.seq, location: target.location, path: target.plot?.outline ?? undefined, plotId: target.sample_id, bounceIds: [target.sample_id] }
        setMoved(true) // the view left the farmer's frame: offer Reset view
        setBouncing(null)
        const cancel = flyToPlot(map, camera, programmatic, () => setBouncing(target.sample_id))
        flightCancel.current = cancel
        return () => {
            cancel()
            if (flightCancel.current === cancel) flightCancel.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `seq` is the request
    }, [focus?.seq, ready])

    // the bounce belongs to the selection: a different (or no) selection stops it
    React.useEffect(() => {
        if (bouncing && bouncing !== selectedId) setBouncing(null)
    }, [selectedId, bouncing])

    const presentPurposes = React.useMemo(() => {
        const order: SamplePurpose[] = ["pre", "start", "harvest", "eoy", "eo3y", "eo5y"]
        const present = new Set(located.map((s) => s.purpose))
        return order.filter((p) => present.has(p))
    }, [located])
    const kinds = new Set(located.map((s) => s.kind))
    const withoutGps = samples.length - located.length

    return (
        <div className="relative w-full h-full" data-samples-map data-map-ready={ready ? "" : undefined}>
            {/* V2's map loader overlay: fades out once the map is ready */}
            <div className={cn("absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-opacity duration-300", ready ? "opacity-0 pointer-events-none" : "opacity-100")}>
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Initializing Map...</p>
                </div>
            </div>
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={DEFAULT_CENTER}
                zoom={12}
                onLoad={(map) => { mapRef.current = map; map.setMapTypeId("satellite"); setReady(true) }}
                onUnmount={() => { mapRef.current = null; setReady(false) }}
                onDragStart={() => { flightCancel.current?.(); setMoved(true) }} // the user takes the camera over (V2)
                onZoomChanged={() => { if (!programmatic.current && mapRef.current) setMoved(true) }}
                mapTypeId="satellite"
                options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true, clickableIcons: false }}
            >
                {plots.filter((p) => p.outline && p.outline.length >= 3).map((plot) => {
                    const active = plot.plot_id === selectedPlotId
                    const hovered = !active && plot.plot_id === hoveredPlotId
                    return (
                        <PolygonF
                            key={plot.plot_id}
                            path={plot.outline!}
                            options={{
                                fillColor: active || hovered ? PLOT_OUTLINE_SELECTED : "#ffffff",
                                fillOpacity: active ? 0.22 : hovered ? 0.3 : 0.16,
                                strokeColor: active || hovered ? PLOT_OUTLINE_SELECTED : PLOT_OUTLINE,
                                strokeWeight: active || hovered ? 3 : 2,
                                zIndex: active ? 3 : hovered ? 2 : 1,
                                clickable: false,
                            }}
                        />
                    )
                })}
                <MarkerClustererF options={{ gridSize: 44, maxZoom: CLUSTER_MAX_ZOOM, minimumClusterSize: 3, averageCenter: true, zoomOnClick: true, styles: CLUSTER_STYLES, calculator: clusterCalculator }}>
                    {(clusterer) => (
                        <>
                            {located.map((s) => {
                                const isSelected = s.sample_id === selectedId
                                const samePlot = !isSelected && !!selectedPlotId && s.plot?.plot_id === selectedPlotId
                                return (
                                    <MarkerF
                                        key={s.sample_id}
                                        position={s.location!}
                                        clusterer={isSelected ? undefined : clusterer}
                                        title={`${s.sample_code ?? s.sample_id} · ${PURPOSE_LABEL[s.purpose]} · ${KIND_LABEL[s.kind]}`}
                                        icon={sampleMarkerIcon(s.purpose, s.kind, isSelected ? "selected" : samePlot ? "group" : null, !inViewIds.has(s.sample_id))}
                                        zIndex={isSelected ? 1000 : samePlot ? 500 : inViewIds.has(s.sample_id) ? 100 : 10}
                                        animation={bouncing === s.sample_id ? google.maps.Animation.BOUNCE : undefined}
                                        onMouseOver={() => setHoveredId(s.sample_id)}
                                        onMouseOut={() => setHoveredId((id) => (id === s.sample_id ? null : id))}
                                        onClick={() => { flightCancel.current?.(); onSelect(s.sample_id) }}
                                    />
                                )
                            })}
                        </>
                    )}
                </MarkerClustererF>
            </GoogleMap>

            <TooltipProvider delayDuration={200}>
                <div data-map-controls className="absolute top-4 left-4 z-10 flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span tabIndex={selected?.boundary_editable ? -1 : 0} className="inline-flex rounded-md">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    data-map-draw-boundary
                                    className={MAP_CONTROL}
                                    disabled={!selected?.boundary_editable}
                                    onClick={() => selected && onDrawBoundary(selected)}
                                    aria-label="Draw or edit the selected sample's plot boundary"
                                >
                                    <PencilRuler className="h-4 w-4" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[16rem]">
                            {selected?.boundary_editable
                                ? selected.plot?.outline ? "Edit plot boundary" : "Draw plot boundary"
                                : selected ? "This sample's boundary can't be drawn or edited here" : "Select a control sample to draw its boundary"}
                        </TooltipContent>
                    </Tooltip>
                    {moved && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" data-map-reset-view className={MAP_CONTROL} onClick={fitAll} aria-label="Reset view">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Reset view</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </TooltipProvider>

            {/* The ONE selected sample (top-right), V2's PlotMapCard: title, V2 detail rows, the boundary action */}
            {selected && (
                <Card data-map-selected-card={selected.sample_id} role="region" aria-label={`Selected sample ${selected.sample_code ?? selected.sample_id}`} className={cn("absolute top-3 right-3 z-10 w-[min(17.5rem,calc(100%-1.5rem))] max-h-[calc(100%-1.5rem)] overflow-y-auto overflow-x-hidden text-left animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none", MAP_SURFACE)}>
                    <div className="flex items-start gap-2 px-3 pt-2.5 pb-2">
                        <div className="min-w-0 flex-1">
                            <p className={SECTION_LABEL}>Selected sample</p>
                            <p className="mt-0.5 font-bold text-sm leading-5 font-mono text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{selected.sample_code ?? "No sample code"}</p>
                        </div>
                        <Button variant="ghost" aria-label="Close sample details" title="Close sample details" onClick={() => onSelect(null)} className="-mr-1 h-7 w-7 p-0 shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                    <dl className="px-1.5 py-1.5 min-w-0">
                        <DetailRow id="status" label="Status" className={CARD_ROW}><BucketBadge bucket={selected.bucket} /></DetailRow>
                        <DetailRow id="az" label="AZ" className={CARD_ROW}>{selected.az.id === 0 ? "Not recorded" : selected.az.code}</DetailRow>
                        <DetailRow id="kind" label="Sample" className={CARD_ROW}>{KIND_LABEL[selected.kind]} · {PURPOSE_LABEL[selected.purpose]}</DetailRow>
                        <DetailRow id="plot" label="Plot" className={CARD_ROW}>
                            {selected.plot ? <span className="font-mono">{selected.plot.plot_id}{selected.plot.area_acres !== null && <> · {selected.plot.area_acres} acres</>}</span> : BOUNDARY_LABEL[selected.boundary_state]}
                        </DetailRow>
                        {selected.surveyor && <DetailRow id="surveyor" label="Surveyor" className={CARD_ROW}>{personName(selected.surveyor, "Surveyor")}</DetailRow>}
                    </dl>
                    {selected.boundary_editable && (
                        <div className="px-3 pb-2.5">
                            <Button variant="outline" data-map-card-boundary onClick={() => onDrawBoundary(selected)} className="h-8 w-full gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                <PencilRuler className="h-3.5 w-3.5" />
                                {selected.plot?.outline ? "Edit plot boundary" : "Draw plot boundary"}
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            <Card data-map-legend className={cn("absolute left-2 bottom-7 z-10 w-[min(14rem,calc(100%-1rem))] px-2.5 py-2 text-left space-y-1.5", MAP_SURFACE)}>
                <div>
                    <p className={SECTION_LABEL}>Colour · purpose</p>
                    <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5">
                        {presentPurposes.map((p) => (
                            <span key={p} className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                                <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PURPOSE_COLOR[p], boxShadow: "0 0 0 1.5px white, 0 0 0 2.5px rgba(0,0,0,0.12)" }} />
                                {PURPOSE_LABEL[p]}
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <p className={SECTION_LABEL}>Shape · sample type</p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-700 dark:text-zinc-300">
                        {kinds.has("deployment") && <span className="flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-zinc-500" />Deployment</span>}
                        {kinds.has("control") && <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rotate-45 rounded-[1px] bg-zinc-500" />Control</span>}
                    </div>
                </div>
                <div className="space-y-0.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                    <p className={SECTION_LABEL}>Plot</p>
                    <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-4 rounded-[2px] border-2 border-white bg-zinc-400/60 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />Plot boundary</span>
                    <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-4 rounded-[2px] border-2" style={{ borderColor: PLOT_OUTLINE_SELECTED, background: "rgba(34,197,94,0.25)" }} />Selected sample&apos;s plot</span>
                    <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full border-2 border-zinc-500 bg-white" />Hollow: other status</span>
                    {withoutGps > 0 && <span data-legend-no-gps className="block text-zinc-500">{withoutGps} without GPS (not on the map)</span>}
                </div>
            </Card>
        </div>
    )
}
