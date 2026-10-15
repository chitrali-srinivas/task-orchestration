"use client"

// Deployment V2 — full-screen plot boundary editor (same page: an overlay over the detail, never a route). One plot at
// a time: its outline is the only editable shape; every other plot stays visible but secondary and can't be touched.
//   Edit:  drag a point to move it; drag a midpoint to add one; select a point (click) → Delete point (or right-click it).
//   Draw:  when the plot has no outline (or after Redraw): click the map to place points; click the first point (or
//          Finish) to close the shape (3+ points).
//   Reset: back to the persisted outline. Cancel: discard (asks first when there are unsaved changes). Save: the
//   explicit, only write — the parent sends the real request; on failure the edited shape stays, with Retry.
// Nothing is saved while editing; the persisted outline on the detail map changes only after a successful save.
import * as React from "react"
import { GoogleMap, Marker, Polygon, Polyline } from "@react-google-maps/api"
import { AlertCircle, Check, Loader2, PencilRuler, RotateCcw, Trash2, Undo2, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { MapPlot } from "../data/map-data"
import { STATUS_BADGE_CLASS } from "./deployment-details-panel"
import { markerIcon } from "./map-markers"
import { SQUARE_METERS_TO_ACRES } from "../data/request-builders"

type LatLng = google.maps.LatLngLiteral

export interface BoundaryEditorProps {
    /** Every plot of the record (context); `target` is the one being edited. */
    plots: MapPlot[]
    target: MapPlot
    /** "DEPL-…" and the line under it (dispatch · source). */
    title: string
    subtitle: string
    /** The marker semantics of the detail map (fill / diameter), so the context looks the same. */
    markerFill: (plot: MapPlot) => string | null
    markerDiameter: (plot: MapPlot) => number
    onCancel: () => void
    /** Sends the real save; rejects with a message on failure (the editor then keeps the shape). */
    onSave: (path: LatLng[], areaSquareMeters: number) => Promise<void>
}

const samePath = (a: LatLng[], b: LatLng[]) => a.length === b.length && a.every((p, i) => Math.abs(p.lat - b[i].lat) < 1e-9 && Math.abs(p.lng - b[i].lng) < 1e-9)
const pathOf = (polygon: google.maps.Polygon | null): LatLng[] => (polygon ? polygon.getPath().getArray().map((p) => p.toJSON()) : [])
const areaOf = (path: LatLng[]) => (path.length >= 3 && typeof google !== "undefined" && google.maps.geometry ? google.maps.geometry.spherical.computeArea(path.map((p) => new google.maps.LatLng(p.lat, p.lng))) : 0)

export function PlotBoundaryEditor({ plots, target, title, subtitle, markerFill, markerDiameter, onCancel, onSave }: BoundaryEditorProps) {
    // A GeoJSON ring repeats its first point at the end; the editor edits the open ring (the save closes it again).
    const persisted = React.useMemo<LatLng[]>(() => {
        const path = (target.path ?? []).map((p) => ({ lat: p.lat, lng: p.lng }))
        if (path.length > 1 && samePath([path[0]], [path[path.length - 1]])) path.pop()
        return path.length >= 3 ? path : []
    }, [target.path])
    const [mode, setMode] = React.useState<"edit" | "draw">(persisted.length >= 3 ? "edit" : "draw")
    /** The editable polygon's starting path; a new value (with a new key) mounts a new polygon (Reset, Finish drawing). */
    const [initialPath, setInitialPath] = React.useState<LatLng[]>(persisted)
    const [polygonKey, setPolygonKey] = React.useState(0)
    const [draft, setDraft] = React.useState<LatLng[]>([])
    const [current, setCurrent] = React.useState<LatLng[]>(persisted)
    const [selectedVertex, setSelectedVertex] = React.useState<number | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [confirmDiscard, setConfirmDiscard] = React.useState(false)
    const polygonRef = React.useRef<google.maps.Polygon | null>(null)
    const listenersRef = React.useRef<google.maps.MapsEventListener[]>([])

    const shape = mode === "draw" ? draft : current
    const dirty = mode === "draw" ? draft.length > 0 || persisted.length >= 3 : !samePath(current, persisted)
    const canSave = mode === "edit" && current.length >= 3 && dirty && !saving
    const acres = areaOf(shape) * SQUARE_METERS_TO_ACRES

    // the polygon's path → state (moves, inserted midpoints, removed points)
    const bind = React.useCallback((polygon: google.maps.Polygon) => {
        listenersRef.current.forEach((l) => l.remove())
        const path = polygon.getPath()
        const sync = () => setCurrent(pathOf(polygon))
        listenersRef.current = [
            google.maps.event.addListener(path, "set_at", sync),
            google.maps.event.addListener(path, "insert_at", sync),
            google.maps.event.addListener(path, "remove_at", sync),
            google.maps.event.addListener(polygon, "click", (e: google.maps.PolyMouseEvent) => setSelectedVertex(typeof e.vertex === "number" ? e.vertex : null)),
            google.maps.event.addListener(polygon, "contextmenu", (e: google.maps.PolyMouseEvent) => {
                if (typeof e.vertex === "number" && path.getLength() > 3) path.removeAt(e.vertex)
                setSelectedVertex(null)
            }),
        ]
        sync()
    }, [])
    React.useEffect(() => () => listenersRef.current.forEach((l) => l.remove()), [])

    const deleteSelected = () => {
        const path = polygonRef.current?.getPath()
        if (!path || selectedVertex === null || path.getLength() <= 3) return
        path.removeAt(selectedVertex)
        setSelectedVertex(null)
    }
    const reset = () => {
        setError(null)
        setSelectedVertex(null)
        setDraft([])
        if (persisted.length >= 3) {
            setMode("edit")
            setInitialPath(persisted)
            setCurrent(persisted)
            setPolygonKey((k) => k + 1)
        } else {
            setMode("draw")
            setCurrent([])
        }
    }
    const redraw = () => {
        setSelectedVertex(null)
        setDraft([])
        setCurrent([])
        setMode("draw")
    }
    const finishDrawing = () => {
        if (draft.length < 3) return
        setInitialPath(draft)
        setCurrent(draft)
        setDraft([])
        setPolygonKey((k) => k + 1)
        setMode("edit")
    }
    const save = async () => {
        if (!canSave) return
        setSaving(true)
        setError(null)
        try {
            await onSave(current, areaOf(current))
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSaving(false)
        }
    }
    const requestCancel = () => (dirty ? setConfirmDiscard(true) : onCancel())

    // Escape: cancel (asks first with unsaved changes); Delete / Backspace: remove the selected point
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (confirmDiscard) return // the confirmation dialog closes itself (Radix)
                e.preventDefault()
                requestCancel()
            } else if ((e.key === "Delete" || e.key === "Backspace") && selectedVertex !== null && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault()
                deleteSelected()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })
    // leaving the page with unsaved changes asks first
    React.useEffect(() => {
        if (!dirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [dirty])

    const onMapLoad = React.useCallback((map: google.maps.Map) => {
        map.setMapTypeId("satellite") // as the detail map (the prop alone isn't applied at creation)
        const bounds = new google.maps.LatLngBounds()
        if (persisted.length >= 3) persisted.forEach((p) => bounds.extend(p))
        else bounds.extend(target.location)
        if (persisted.length >= 3) map.fitBounds(bounds, 96)
        else { map.setCenter(target.location); map.setZoom(19) }
    }, [persisted, target.location])

    const others = plots.filter((p) => p.id !== target.id)
    const toolButton = "h-8 px-3 gap-1.5 text-xs font-bold"
    return (
        <TooltipProvider delayDuration={200}>
        <div data-boundary-editor={target.id} data-boundary-mode={mode} data-boundary-dirty={dirty ? "" : undefined} className="relative flex flex-col w-full h-full bg-zinc-50 dark:bg-zinc-950">
            {/* the detail sheet's header language: white bar, zinc divider, bold title, muted context */}
            <header className="shrink-0 flex items-center gap-3 px-5 h-16 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="min-w-0 flex-1 text-left">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none">Edit plot boundary</p>
                    <p className="flex items-baseline gap-2 min-w-0">
                        <span className="text-base font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-50 shrink-0">{title}</span>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate" title={subtitle}>{subtitle}</span>
                    </p>
                </div>
                <Badge
                    variant="outline"
                    data-boundary-state={saving ? "saving" : dirty ? "unsaved" : "clean"}
                    className={cn(
                        "hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full border shadow-none",
                        saving || !dirty ? "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400" : STATUS_BADGE_CLASS.Pending
                    )}
                >
                    {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</> : dirty ? "Unsaved changes" : "No changes"}
                </Badge>
                <Separator orientation="vertical" className="h-6 bg-zinc-200 dark:bg-zinc-800" />
                <Button variant="ghost" data-boundary-reset onClick={reset} disabled={saving || !dirty} className="h-9 px-3 gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    <RotateCcw className="h-3.5 w-3.5" />Reset
                </Button>
                <Button variant="outline" data-boundary-cancel onClick={requestCancel} disabled={saving} className="h-9 px-4 text-xs font-bold">Cancel</Button>
                <Button data-boundary-save onClick={save} disabled={!canSave} className="h-9 px-5 gap-1.5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save
                </Button>
            </header>

            <div className="relative flex-1 min-h-0">
                <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={target.location}
                    zoom={18}
                    onLoad={onMapLoad}
                    mapTypeId="satellite"
                    options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true, disableDoubleClickZoom: mode === "draw", draggableCursor: mode === "draw" ? "crosshair" : undefined, clickableIcons: false }}
                    onClick={(e) => {
                        if (mode !== "draw" || !e.latLng) return
                        setDraft((d) => [...d, e.latLng!.toJSON()])
                    }}
                >
                    {/* context: every other plot, secondary and not editable / clickable */}
                    {others.map((plot) => (
                        <React.Fragment key={plot.id}>
                            {plot.path && plot.path.length >= 3 && (
                                <Polygon path={plot.path} options={{ clickable: false, editable: false, fillColor: "#ffffff", fillOpacity: 0.08, strokeColor: "#ffffff", strokeOpacity: 0.45, strokeWeight: 1.5, zIndex: 1 }} />
                            )}
                            <Marker position={plot.location} clickable={false} opacity={0.55} zIndex={1} icon={markerIcon(markerFill(plot), markerDiameter(plot), null)} />
                        </React.Fragment>
                    ))}
                    {/* the plot being edited: the map's selection treatment (green outline, selected marker) */}
                    <Marker position={target.location} clickable={false} zIndex={20} icon={markerIcon(markerFill(target), markerDiameter(target), "selected")} />
                    {mode === "edit" && initialPath.length >= 3 && (
                        <Polygon
                            key={polygonKey}
                            path={initialPath}
                            onLoad={(polygon) => { polygonRef.current = polygon; bind(polygon) }}
                            onUnmount={() => { polygonRef.current = null }}
                            options={{ editable: true, draggable: false, fillColor: "#22c55e", fillOpacity: 0.22, strokeColor: "#22c55e", strokeOpacity: 1, strokeWeight: 3, zIndex: 10 }}
                        />
                    )}
                    {mode === "draw" && draft.length > 0 && (
                        <>
                            <Polyline path={draft} options={{ clickable: false, strokeColor: "#22c55e", strokeWeight: 3, zIndex: 10 }} />
                            {draft.map((p, i) => (
                                <Marker
                                    key={i}
                                    position={p}
                                    zIndex={30}
                                    clickable={i === 0 && draft.length >= 3}
                                    onClick={i === 0 ? finishDrawing : undefined}
                                    icon={{ path: google.maps.SymbolPath.CIRCLE, scale: i === 0 ? 6 : 4, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#22c55e", strokeWeight: 2 }}
                                />
                            ))}
                        </>
                    )}
                </GoogleMap>

                {/* tools for the current mode: a detail card */}
                <Card data-boundary-tools className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md p-3 space-y-2.5 text-left">
                    <p data-boundary-hint className="text-xs leading-5 text-zinc-600 dark:text-zinc-300 max-w-[24rem]">
                        {mode === "edit"
                            ? "Drag a point to move it · drag a midpoint to add a point · click a point, then Delete point (or right-click it)"
                            : draft.length < 3 ? "Click on the map to place the boundary's points (at least 3)" : "Keep clicking to add points · click the first point or Finish to close the shape"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {mode === "edit" ? (
                            <>
                                <Button variant="outline" data-boundary-delete-point onClick={deleteSelected} disabled={selectedVertex === null || current.length <= 3 || saving} className={toolButton}><Trash2 className="h-3.5 w-3.5" />Delete point</Button>
                                <Button variant="outline" data-boundary-redraw onClick={redraw} disabled={saving} className={toolButton}><PencilRuler className="h-3.5 w-3.5" />Redraw</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" data-boundary-undo onClick={() => setDraft((d) => d.slice(0, -1))} disabled={draft.length === 0} className={toolButton}><Undo2 className="h-3.5 w-3.5" />Undo point</Button>
                                <Button variant="outline" data-boundary-clear onClick={() => setDraft([])} disabled={draft.length === 0} className={toolButton}><X className="h-3.5 w-3.5" />Clear</Button>
                                <Button data-boundary-finish onClick={finishDrawing} disabled={draft.length < 3} className={cn(toolButton, "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900")}><Check className="h-3.5 w-3.5" />Finish</Button>
                            </>
                        )}
                    </div>
                    <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                    <p data-boundary-area className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                        {shape.length >= 3 ? <>Area <span className="font-semibold text-zinc-900 dark:text-zinc-100">{acres.toFixed(3)} acres</span> · {shape.length} points</> : `${shape.length} point${shape.length === 1 ? "" : "s"}`}
                    </p>
                </Card>

                {error && (
                    <Alert variant="destructive" role="alert" data-boundary-error className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(30rem,calc(100%-1.5rem))] bg-white dark:bg-zinc-950 shadow-md text-left">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-bold">The boundary wasn&apos;t saved</AlertTitle>
                        <AlertDescription className="text-xs space-y-2">
                            <p className="[overflow-wrap:anywhere]">{error}</p>
                            <p className="text-zinc-600 dark:text-zinc-400">Your edits are kept — retry, or cancel to discard them.</p>
                            <Button variant="outline" data-boundary-retry onClick={save} disabled={!canSave} className="h-8 px-3 text-xs font-bold">Retry</Button>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* the dialog's own overlay sits under this full-screen editor: dim the editor the same way while it asks */}
            {confirmDiscard && <div aria-hidden data-boundary-dim className="absolute inset-0 z-40 bg-black/30 animate-in fade-in-0" />}

            {/* unsaved changes: the detail's confirmation dialog (as Confirm approval) */}
            <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <DialogContent data-boundary-confirm className="max-w-[440px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[560] rounded-xl [&>button]:hidden">
                    <div className="bg-white dark:bg-zinc-950 text-left">
                        <div className="p-6 pb-0 space-y-1">
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Discard boundary changes?</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">The plot keeps its saved boundary. Your edits are not saved.</DialogDescription>
                        </div>
                        <div className="p-6 flex items-center justify-end gap-3">
                            <Button variant="outline" data-boundary-keep onClick={() => setConfirmDiscard(false)} className="h-9 px-4 text-xs font-bold" autoFocus>Keep editing</Button>
                            <Button data-boundary-discard onClick={onCancel} className="h-9 px-5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white">Discard</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    )
}
