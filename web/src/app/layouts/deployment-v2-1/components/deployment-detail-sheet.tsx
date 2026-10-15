"use client"

// Deployment V2.1 — the FARMER-level detail sheet (requirement 3), cloned from Deployment V2 Oct 26's sheet, itself
// cloned from the existing Deployment layout (src/app/layouts/deployment/components/engagement-detail-sheet.tsx). The
// map panel, header, footer navigation, media preview and transitions are unchanged. The body follows matic-dash's
// Deployment IA — one list, AZ section → Dispatch → Deployment (plot), with no dispatch or plot page — over EVERY list
// row of the opened farmer (hooks/use-farmer-detail.ts: the farmer's rows, then one dispatch read, one NOC read and one
// history read per row), grouped by AZ as the Samples detail is. A dispatch expands in place into its working surface
// (deployment-details-panel.tsx): its facts and correction, its plot cards (picture, facts, comment, delete, map
// focus), report selection and Approve. The existing dialogs — media preview, Finalize Report, approval, comment,
// delete, NOC, history — open over it, driven by the Matic workflow through ../data.
//   header      the farmer, then V2's summary bar: "Dispatches", the local filter, and the farmer-level NOC / Pre-Sample
//               icons (the API scopes both to a deployment: every document is listed, never merged), then — at V2's
//               place — the farmer's NOC readiness strip (one line across its documents, with Review / View NOC).
//   NOC         farmer-level: the header icon, the strip and a card's "Review NOC" open ONE farmer-level NOC view
//               listing every document (deployment + AZ) with its own status; each undecided document is approved or
//               reported on its own (updateFarmerDeploymentNOC for that document's farmer_id, deployment_num and
//               az_id). Nothing NOC-related is repeated on rows or cards except Matic's approve gate text.
//   selection   the table picks a dispatch (page.tsx): its AZ section opens, the card expands and scrolls into view and
//               its plots are focused on the map (the Samples pattern); Previous / Next move between farmers.
//   actions     per deployment group (farmer + deployment_num + az_id — the list's dispatch rows grouped), through the
//               group's deployment type (deployment-types.ts actions): permission key, payload builders, delete scopes.
//               Gates: the dispatch's own status (and, for the group's NOC / deletes, whether every dispatch of the
//               group is approved — data/dispatch-rows.ts groupAllApproved), its NOC, and — for Approve — every plot of
//               the dispatch having a valid SAVED boundary (data/boundary-gate.ts; re-checked on confirm).
//   validation  V2.1 (live API audit): action_required / err_msg are PER DISPATCH. Each card shows its own dispatch's
//               flag and messages beside its status and its actions; a flagged pending dispatch offers Report, not
//               Approve (deployment-dispatch-view.ts offersApprove). franchise_status alone sets every status.
//   history     on each dispatch card (its clock), scoped to that dispatch; never in the header or a group.
//   no round    the deployment number is never shown; no per-deployment heading either — the dispatch cards of an AZ
//               carry their own dates and statuses (deployments recur in NOC / history labels by submission date).

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogPortal,
} from "@/components/ui/dialog"
import type { DeploymentMetadataRow, ReportHistoryEntry, TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import { useDeploymentSession, type DeploymentSession } from "../data/session"
import { buildMapFarmer, type MapFarmer, type MapPlot, type PlotSemanticsReader } from "../data/map-data"
import { inspectorState } from "../inspector/inspector-state"
import { MapLegend, PlotMapCard, type SelectedDeployment } from "./map-overlays"
import { amountScale, markerIcon, sourceColors } from "./map-markers"
import { PlotBoundaryEditor, type EditablePlot, type SaveAllResult } from "./plot-boundary-editor"
import { DeploymentVideoPlayer } from "./deployment-video-player"
import { farmerHeaderTotals } from "../data/farmer-header-totals"
import { deploymentApi } from "../data/deployment-api"
import { boundaryCoverage, outlineKey } from "../data/boundary-coverage"
import { ApiError } from "../data/api-client"
import {
    buildCommentRequest,
    buildUploadGeoJsonEntriesRequest,
    buildDeleteDeploymentRequest,
    buildDeleteDispatchRequest,
    buildNocDecisionRequest,
    buildReportHistoryRequest,
    getNocApprovalBlocker,
    getNocReadiness,
    type NocReadiness,
    summarizeNoc,
} from "../data/request-builders"
import { getDeploymentRowKey, parseEpochMs, toDeploymentV2Record } from "../data/adapter"
import { groupAllApproved } from "../data/dispatch-rows"
import { dispatchBoundaryGate } from "../data/boundary-gate"
import { useFarmerDetail, type FarmerRowDetail } from "../hooks/use-farmer-detail"
import {
    DetailHeading,
    DetailStatusFilter,
    DispatchCards,
    EmptyBox,
    GroupHeader,
    NocReadinessStrip,
    type ApproveBlocker,
    type DispatchWork,
    type HeaderNocAction,
    type HeaderPreSampleAction,
    type HistoryReadState,
    type LocalReport,
} from "./deployment-details-panel"
import {
    classifyDispatches,
    defaultDetailFilter,
    detailFilterCounts,
    inDetailFilter,
    mergeDispatchReads,
    offersApprove,
    offersReport,
    type ClassifiedDispatch,
    type DetailFilter,
} from "./deployment-dispatch-view"
import { dispatchLabel, formatDispatchDate, plotLabel, toReportSelections } from "./deployment-field-cards"
import { buildReportIndex, historyForDispatch, toReportHistoryRows, type ReportIndex } from "./deployment-report-index"
import { DEPLOYMENT_PERMISSION, getDeploymentType, type DeploymentTypeConfig } from "./deployment-types"
import { mediaFileName } from "./deployment-media"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, ImageOff } from "lucide-react"
import { useAppNavigate } from "@/platform/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, X, Check, Image as ImageIcon, Play, FileText, MapPin, Download, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Scaling, AlignCenter, SlidersHorizontal, RotateCcw, Loader2, Plus, Minus } from "lucide-react"
import { PencilRuler, Scan } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SurveyItem } from "@/app/components/survey/SurveyComponents"
import { GoogleMap, useJsApiLoader, Marker, Polygon } from "@react-google-maps/api"
import { env } from "@/platform/env"
import { Plot } from "@/types/map"

/** Message of a failed API call (live mode surfaces the real failure). */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** V2.1: server reasons longer than this stay out of the report dialog's one-line message (shown in full under Technical details). */
const INLINE_REASON_MAX = 200

/**
 * V2.1: a failed report as the dialog shows it (post-migration audit P4): the usual "Report failed: …" line and, when the
 * server said more than that line shows, its complete technical text (ApiError.details) — never shortened.
 */
function reportFailure(failure: string, error: unknown): { message: string; details: string | null } {
    if (!(error instanceof ApiError) || !error.details) return { message: `Report failed: ${failure}`, details: null }
    const inline = (error.reason ?? "").length <= INLINE_REASON_MAX
    const message = inline
        ? `Report failed: ${failure}`
        : `Report failed: ${error.endpoint} failed${error.status ? ` (HTTP ${error.status})` : ""}. The server's full reason is under Technical details.`
    const repeatsMessage = inline && error.details.replace(/\s+/g, " ") === error.reason
    return { message, details: repeatsMessage ? null : error.details }
}

/** V2.1: the report dialog's failure line, with the server's full text under a collapsed "Technical details". */
function ReportDialogError({ error }: { error: { message: string; details: string | null } | null }) {
    if (!error) return null
    return (
        <div data-report-error className="space-y-1.5 text-left">
            <p role="alert" data-dialog-error className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">
                <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
                <span>{error.message}</span>
            </p>
            {error.details && (
                <details data-dialog-error-details className="rounded-md border border-red-100 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20">
                    <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-semibold text-red-700 dark:text-red-300">Technical details</summary>
                    <pre tabIndex={0} className="max-h-48 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] border-t border-red-100 dark:border-red-900/50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">{error.details}</pre>
                </details>
            )}
        </div>
    )
}

/** Soft delete target: a whole dispatch, or one plot deployment of it (matic-dash deleteMode). */
type DeleteTarget =
    | { mode: "Dispatch"; dispatch: TrailerDispatchItem }
    | { mode: "Deployment"; dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot }

/** V2.1: the session flag each matic-dash permission key maps to (data/session.ts). */
const PERMISSION_FLAG: Record<string, keyof DeploymentSession["permissions"]> = {
    [DEPLOYMENT_PERMISSION.deploymentEdit]: "edit",
    [DEPLOYMENT_PERMISSION.deploymentDelete]: "delete",
    [DEPLOYMENT_PERMISSION.awdEdit]: "awdEdit",
    [DEPLOYMENT_PERMISSION.matiBoostEdit]: "matiBoostEdit",
}

/** One list row of the opened farmer, with what its reads returned and its deployment type. */
interface RowEntry {
    /** The deployment GROUP's row (farmer + deployment_num + az_id): group-level fields and request building only. */
    row: DeploymentMetadataRow
    rowKey: string
    detail: FarmerRowDetail | undefined
    type: DeploymentTypeConfig
    /** Every dispatch of the group is approved (the former row status "approved"): its NOC and deletes are closed. */
    allApproved: boolean
}

// Same loader id + libraries as matic-dash: @react-google-maps refuses a second load with different options.
const LIBRARIES: "geometry"[] = ["geometry"];
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 };
const DEFAULT_ZOOM = 5;
/** V2.1: a farmer's plots are framed between these zooms (one plot: 18; a far-off outlier never shrinks them below 11). */
const FARMER_MAX_ZOOM = 18;
const FARMER_MIN_ZOOM = 11;
/** The median of points (per axis): the centre of the bulk of a farmer's plots, unmoved by one far-off coordinate. */
function medianLocation(points: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
    const mid = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2 }
    return { lat: mid(points.map((p) => p.lat)), lng: mid(points.map((p) => p.lng)) }
}

// ── V2: map ↔ list navigation motion lives in map-camera.ts (shared with the Samples detail map) ──────────────
import { flyToPlot, overlayPadding, prefersReducedMotion, type CameraFocus } from "./map-camera"

/**
 * Where the list should rest for a dispatch revealed from the map: its header around the upper quarter of the viewport
 * (context above it stays visible). If that leaves the picked plot below the fold (an expanded dispatch taller than the
 * list), scroll only as far as needed to show the whole plot, so as much of its dispatch as possible stays above it.
 * No scroll when both are already comfortably visible; never past the content's ends (no bounce).
 */
function revealScrollTop(viewport: HTMLElement, dispatch: HTMLElement, plot: HTMLElement): number {
    const v = viewport.getBoundingClientRect()
    const d = dispatch.getBoundingClientRect(), p = plot.getBoundingClientRect()
    const current = viewport.scrollTop
    const height = viewport.clientHeight
    const max = Math.max(0, viewport.scrollHeight - height)
    const margin = Math.min(48, height * 0.08)
    const dTop = d.top - v.top, pTop = p.top - v.top, pBottom = p.bottom - v.top
    if (dTop >= margin && dTop <= height * 0.6 && pTop >= margin && pBottom <= height - margin) return current
    let top = current + dTop - height * 0.25
    if (pBottom - (top - current) > height - margin) top = current + pBottom - (height - margin)
    if (pTop - (top - current) < margin) top = current + pTop - margin // a plot card taller than the space: its top first
    return Math.round(Math.max(0, Math.min(max, top)))
}

/** Scrolls the list's viewport to `top` (smoothly unless reduced motion) and calls `onDone` when it has settled. Cancellable. */
function guideScroll(viewport: HTMLElement, top: number, onDone: () => void): () => void {
    let finished = false
    const reduced = prefersReducedMotion()
    const finish = () => {
        if (finished) return
        finished = true
        viewport.removeEventListener("scrollend", finish)
        clearTimeout(timer)
        onDone()
    }
    const timer = window.setTimeout(finish, Math.abs(viewport.scrollTop - top) < 2 ? 0 : reduced ? 60 : 900)
    if (Math.abs(viewport.scrollTop - top) >= 2) {
        viewport.addEventListener("scrollend", finish)
        viewport.scrollTo({ top, behavior: reduced ? "auto" : "smooth" })
    }
    return () => {
        finished = true
        viewport.removeEventListener("scrollend", finish)
        clearTimeout(timer)
    }
}

/** A map control: the detail's outline icon button, on a white surface over the map. */
/** V2.1: a button of the map's one control group (the group draws the border and the dividers). */
const MAP_GROUP_CONTROL = "h-9 w-9 rounded-none bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-40"

function MapPreviewContent({
    selectedFarmer,
    onIdle,
    center,
    zoom,
    onReset,
    onInteraction,
    resetCount,
    setIsMapInteracted,
    mapRef,
    isProgrammaticChange,
    farmerKey,
    geometryState,
    selectedPlot,
    setSelectedPlot,
    hoveredPlotId,
    setHoveredPlotId,
    isShowingSpecificLocation,
    isMapInteracted,
    onEditClick,
    focusTarget,
    highlightIds,
    bouncingIds,
    onFocusArrived,
    markerFill,
    markerDiameter,
    editEnabled
}: {
    selectedFarmer: MapFarmer | null,
    onIdle?: () => void,
    center?: google.maps.LatLngLiteral | null,
    zoom?: number,
    onReset?: () => void,
    onInteraction?: () => void,
    resetCount: number,
    setIsMapInteracted: (val: boolean) => void,
    mapRef: React.MutableRefObject<google.maps.Map | null>,
    isProgrammaticChange: React.MutableRefObject<boolean>,
    /** V2.1: whose plots these are (the farmer); a new farmer is framed once its plots are there. */
    farmerKey: string,
    /** V2.1: the farmer's dispatch reads: still loading, all read, or failed (no plots then means "couldn't be read"). */
    geometryState: "loading" | "ready" | "failed",
    selectedPlot: any | null,
    setSelectedPlot: (plot: any | null) => void,
    hoveredPlotId: string | null,
    setHoveredPlotId: (id: string | null) => void,
    isShowingSpecificLocation: boolean,
    isMapInteracted: boolean,
    onEditClick?: () => void,
    /** V2: a plot to fly the camera to (a deployment's map focus); null stops any flight in progress. */
    focusTarget?: CameraFocus | null
    /** V2: the map plots of the selected dispatch — highlighted together; the other plots step back. */
    highlightIds?: ReadonlySet<string>
    /** V2: map plots whose markers bounce right now (a selection's brief attention cue). */
    bouncingIds?: ReadonlySet<string>
    /** V2: the camera reached a focused plot (its marker's highlight starts then). */
    onFocusArrived?: (target: CameraFocus) => void
    /** V2: marker semantics — fill = source colour (null: hollow, not recorded), diameter = deployed amount. */
    markerFill?: (plot: MapPlot) => string | null
    markerDiameter?: (plot: MapPlot) => number
    /** V2: a single plot is selected and its boundary may be edited (the edit button is shown only with `onEditClick`). */
    editEnabled?: boolean
}) {
    /** V2: the camera flight in progress (cancelled by a newer target, Reset View, a map click or the user's own drag). */
    const flightCancel = React.useRef<(() => void) | null>(null)
    /**
     * V2.1: the camera GoogleMap starts with — read once. Later moves are explicit (the effect below: fit the record's
     * plots, or pan to a location). As controlled props, a record still loading (no plots, no location) sent the camera to
     * DEFAULT_CENTER — the all-India jump on Previous / Next (post-migration audit P1).
     */
    const [initialCamera] = React.useState(() => ({ center: center || selectedFarmer?.location || DEFAULT_CENTER, zoom: zoom || (selectedFarmer ? 17 : DEFAULT_ZOOM) }))
    /** V2: the map instance exists — a plot focused while the map was still loading is flown to once it is ready. */
    const [mapReady, setMapReady] = React.useState(false)
    const arrivedRef = React.useRef(onFocusArrived)
    React.useEffect(() => { arrivedRef.current = onFocusArrived })
    React.useEffect(() => {
        const map = mapRef.current
        if (!mapReady || !map || !focusTarget) return
        const cancel = flyToPlot(map, focusTarget, isProgrammaticChange, () => arrivedRef.current?.(focusTarget))
        flightCancel.current = cancel
        return () => {
            cancel()
            if (flightCancel.current === cancel) flightCancel.current = null
        }
    }, [focusTarget, mapReady, mapRef, isProgrammaticChange])

    /**
     * V2.1: frames the farmer's own plots — their markers and outlines, nothing else — clear of the map's overlays (the
     * buttons top-left, the legend bottom-left), at a useful scale: never closer than zoom 18 (one plot), never wider than
     * zoom 11 — a far-off point (a bad coordinate) would otherwise shrink the farmer to a dot; the view then centres on the
     * plots' median location instead.
     */
    const fitBounds = React.useCallback(() => {
        const map = mapRef.current
        if (!map || !selectedFarmer || selectedFarmer.plots.length === 0) return;

        isProgrammaticChange.current = true;
        const plots = selectedFarmer.plots
        const bounds = new google.maps.LatLngBounds();
        plots.forEach(plot => {
            bounds.extend(plot.location);
            if (plot.path) {
                plot.path.forEach(point => bounds.extend(point));
            }
        });
        const ne = bounds.getNorthEast(), sw = bounds.getSouthWest()
        if (Math.abs(ne.lat() - sw.lat()) < 1e-7 && Math.abs(ne.lng() - sw.lng()) < 1e-7) {
            // one point (a single plot without an outline): no box to fit — centred at the zoom cap
            map.setCenter(bounds.getCenter());
            map.setZoom(FARMER_MAX_ZOOM);
            setTimeout(() => { isProgrammaticChange.current = false; }, 300);
            return
        }
        map.fitBounds(bounds, overlayPadding(map));
        // the cap holds for the whole fit (a zoom step can land after the first idle)
        const capped = google.maps.event.addListener(map, "zoom_changed", () => { if ((map.getZoom() ?? 0) > FARMER_MAX_ZOOM) map.setZoom(FARMER_MAX_ZOOM) })
        setTimeout(() => google.maps.event.removeListener(capped), 1500)
        google.maps.event.addListenerOnce(map, "idle", () => {
            const fitted = map.getZoom() ?? FARMER_MAX_ZOOM
            if (fitted > FARMER_MAX_ZOOM) map.setZoom(FARMER_MAX_ZOOM);
            else if (fitted < FARMER_MIN_ZOOM) {
                map.setCenter(medianLocation(plots.map((p) => p.location)));
                map.setZoom(FARMER_MIN_ZOOM);
            }
            // Use a small delay before allowing interaction detection again
            setTimeout(() => {
                isProgrammaticChange.current = false;
            }, 100);
        });
    }, [selectedFarmer, mapRef, isProgrammaticChange]);

    const onLoad = React.useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setMapReady(true);
        map.setMapTypeId("satellite");
        // V2.1: the farmer is framed by the effect below once the map is ready (a plot already focused flies there instead)
    }, [mapRef]);

    const onUnmount = React.useCallback(() => {
        mapRef.current = null;
        setMapReady(false);
    }, [mapRef]);

    /**
     * V2.1: when the camera frames the farmer — on a new farmer (Previous / Next) as soon as its plots are there, on Reset
     * View, and when more of THIS farmer's plots arrive while the user hasn't moved the map (later reads add plots); never
     * while the user explores (their pan / zoom stays). A farmer whose reads finished without any plot location gets the
     * overview and a note — the previous farmer's view would claim a location the data doesn't have.
     */
    const plotSig = selectedFarmer ? selectedFarmer.plots.map((p) => `${p.id}:${p.path?.length ?? 0}`).join(",") : ""
    const fittedRef = React.useRef<{ farmer: string; sig: string; reset: number } | null>(null)
    const noPlotLocations = geometryState !== "loading" && !!selectedFarmer && selectedFarmer.plots.length === 0
    React.useEffect(() => {
        const map = mapRef.current
        if (!mapReady || !map) return
        if (center) {
            isProgrammaticChange.current = true;
            map.panTo(center);
            map.setZoom(zoom || 17);
            // Reset flag after a short delay since panTo/setZoom don't have callbacks
            setTimeout(() => { isProgrammaticChange.current = false; }, 500);
            return
        }
        const last = fittedRef.current
        const farmerChanged = !last || last.farmer !== farmerKey
        const resetPressed = !!last && last.reset !== resetCount
        if (plotSig === "") {
            if (noPlotLocations && (farmerChanged || resetPressed)) {
                isProgrammaticChange.current = true;
                map.setCenter(DEFAULT_CENTER);
                map.setZoom(DEFAULT_ZOOM);
                setTimeout(() => { isProgrammaticChange.current = false; }, 500);
                fittedRef.current = { farmer: farmerKey, sig: "", reset: resetCount }
            }
            return
        }
        if (farmerChanged && focusTarget) {
            fittedRef.current = { farmer: farmerKey, sig: plotSig, reset: resetCount } // a focused plot flies there instead
            return
        }
        if (farmerChanged || resetPressed || (last.sig !== plotSig && !isMapInteracted)) {
            fitBounds();
            fittedRef.current = { farmer: farmerKey, sig: plotSig, reset: resetCount }
        }
    }, [farmerKey, plotSig, noPlotLocations, center, zoom, fitBounds, resetCount, mapReady, isMapInteracted, focusTarget, mapRef, isProgrammaticChange]);

    /** V2.1 (tests / diagnostics): the camera after it settles, and the farmer's plot extent, on the map's wrapper. */
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const handleIdle = React.useCallback(() => {
        const map = mapRef.current
        const wrapper = wrapperRef.current
        if (map && wrapper) {
            wrapper.dataset.mapZoom = String(map.getZoom() ?? "")
            const b = map.getBounds()
            if (b) wrapper.dataset.mapView = [b.getSouthWest().lat(), b.getSouthWest().lng(), b.getNorthEast().lat(), b.getNorthEast().lng()].map((n) => n.toFixed(6)).join(",")
        }
        onIdle?.()
    }, [mapRef, onIdle])
    /** V2.1: the zoom buttons — a user zoom like the wheel's (onZoomChanged marks the map as explored; a flight stops). */
    const zoomBy = (delta: number) => {
        const map = mapRef.current
        if (!map) return
        flightCancel.current?.()
        map.setZoom(Math.round((map.getZoom() ?? 0) + delta))
    }
    const canReset = isShowingSpecificLocation || isMapInteracted
    /** V2.1 (tests / diagnostics): for each outlined plot, a point inside its outline away from its marker (halfway from the
     *  outline's centre to the vertex farthest from the marker) — where a click lands on the outline, not the marker. */
    const outlinePoints = selectedFarmer?.plots.filter((p) => (p.path?.length ?? 0) >= 3).map((p) => {
        const path = p.path!
        const c = { lat: path.reduce((t, v) => t + v.lat, 0) / path.length, lng: path.reduce((t, v) => t + v.lng, 0) / path.length }
        const far = path.reduce((a, v) => (Math.hypot(v.lat - p.location.lat, v.lng - p.location.lng) > Math.hypot(a.lat - p.location.lat, a.lng - p.location.lng) ? v : a), path[0])
        return `${p.id}@${((c.lat + far.lat) / 2).toFixed(6)},${((c.lng + far.lng) / 2).toFixed(6)}`
    }).join("|")
    /**
     * V2.1: an outline several deployments share (the same polygon on each; the API stores one per deployment) is drawn
     * once, not stacked: by the selected deployment when it is one of them, else the hovered one, else one of the
     * highlighted dispatch, else the first. Every deployment keeps its own marker.
     */
    const outlineDrawers = React.useMemo(() => {
        const byKey = new Map<string, MapPlot[]>()
        for (const plot of (selectedFarmer?.plots ?? []) as MapPlot[]) {
            if (!plot.path || plot.path.length === 0) continue
            const key = outlineKey(plot.path)
            byKey.set(key, [...(byKey.get(key) ?? []), plot])
        }
        const drawers = new Set<string>()
        for (const group of byKey.values()) {
            const pick = group.find((p) => p.id === selectedPlot?.id) ?? group.find((p) => p.id === hoveredPlotId) ?? group.find((p) => highlightIds?.has(p.id)) ?? group[0]
            drawers.add(pick.id)
        }
        return drawers
    }, [selectedFarmer, selectedPlot, hoveredPlotId, highlightIds])
    const plotExtent = selectedFarmer && selectedFarmer.plots.length > 0
        ? (() => { const ls = selectedFarmer.plots.map((p) => p.location); return [Math.min(...ls.map((l) => l.lat)), Math.min(...ls.map((l) => l.lng)), Math.max(...ls.map((l) => l.lat)), Math.max(...ls.map((l) => l.lng))].map((n) => n.toFixed(6)).join(",") })()
        : undefined

    return (
        <div ref={wrapperRef} data-map-farmer={farmerKey} data-map-plots={selectedFarmer?.plots.length ?? 0} data-map-plot-extent={plotExtent} data-map-selected={selectedPlot?.id ?? undefined} data-map-outlines-drawn={outlineDrawers.size} data-map-outlines={outlinePoints} data-map-points={selectedFarmer?.plots.map((p) => `${p.id}@${p.location.lat.toFixed(6)},${p.location.lng.toFixed(6)}`).join("|")} data-map-plot-owners={selectedFarmer ? [...new Set(selectedFarmer.plots.map((p) => p.farmerId))].join(",") : undefined} data-map-fitted-farmer={fittedRef.current?.farmer ?? undefined} className="relative w-full h-full">
            {noPlotLocations && (
                <p data-map-no-plots={geometryState} role="status" className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 shadow-sm whitespace-nowrap">
                    {geometryState === "failed" ? "Plot locations couldn't be loaded" : "No plot locations for this farmer"}
                </p>
            )}
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={initialCamera.center}
                zoom={initialCamera.zoom}
                onLoad={onLoad}
                onIdle={handleIdle}
                onUnmount={onUnmount}
                onDragStart={() => {
                    flightCancel.current?.() // the user takes the camera over
                    if (!isProgrammaticChange.current) {
                        setIsMapInteracted(true);
                        onInteraction?.();
                    }
                }}
                onZoomChanged={() => {
                    if (mapRef.current && !isProgrammaticChange.current) {
                        setIsMapInteracted(true);
                        onInteraction?.();
                    }
                }}
                mapTypeId="satellite"
                options={{
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    // V2.1: the map's controls are one group of the panel's own buttons (below) — not Google's zoom and
                    // camera controls in another corner
                    zoomControl: false,
                    cameraControl: false,
                }}
            >
                {selectedFarmer && (
                    <>
                        {selectedFarmer.plots.map((plot) => {
                            const isHovered = hoveredPlotId === plot.id || selectedPlot?.id === plot.id;
                            // V2: the marker encodes source (fill) and amount (size); the selected deployment and its
                            // dispatch's plots stand out by a ring, opacity and z-index on top of that — while a dispatch is
                            // highlighted the other plots step back. The fill and size never change with selection.
                            const isSelected = selectedPlot?.id === plot.id;
                            const inGroup = !!highlightIds?.has(plot.id);
                            const dimmed = !!highlightIds && highlightIds.size > 0 && !inGroup && !isSelected;
                            const semantic = plot as MapPlot;
                            return (
                                <React.Fragment key={plot.id}>
                                    {plot.path && plot.path.length > 0 && outlineDrawers.has(plot.id) && (
                                        <Polygon
                                            path={plot.path}
                                            options={{
                                                fillColor: "#ffffff",
                                                fillOpacity: isHovered ? 0.35 : inGroup ? 0.28 : dimmed ? 0.12 : 0.2,
                                                strokeColor: isHovered ? "#22c55e" : inGroup ? "#6ee7b7" : "#ffffff",
                                                strokeWeight: isHovered ? 3 : inGroup ? 2.5 : 2,
                                                strokeOpacity: dimmed ? 0.5 : 1,
                                                zIndex: isHovered ? 3 : inGroup ? 2 : 1,
                                            }}
                                            onMouseOver={() => {
                                                if (!selectedPlot) {
                                                    setHoveredPlotId(plot.id);
                                                }
                                            }}
                                            onMouseOut={() => {
                                                if (!selectedPlot) {
                                                    setHoveredPlotId(null);
                                                }
                                            }}
                                            onClick={() => {
                                                setSelectedPlot(plot);
                                            }}
                                        />
                                    )}
                                    <Marker
                                        position={plot.location}
                                        onMouseOver={() => {
                                            if (!selectedPlot) {
                                                setHoveredPlotId(plot.id);
                                            }
                                        }}
                                        onMouseOut={() => {
                                            if (!selectedPlot) {
                                                setHoveredPlotId(null);
                                            }
                                        }}
                                        onClick={() => {
                                            setSelectedPlot(plot);
                                        }}
                                        animation={bouncingIds?.has(plot.id) ? google.maps.Animation.BOUNCE : undefined}
                                        opacity={dimmed ? 0.5 : 1}
                                        zIndex={isSelected ? 1000 : inGroup ? 500 : undefined}
                                        icon={markerIcon(markerFill ? markerFill(semantic) : "#ffffff", markerDiameter ? markerDiameter(semantic) : 24, isSelected ? "selected" : inGroup ? "group" : null)}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </GoogleMap>

            {/* V2.1: the map's controls, ONE group bottom-right (a column beside the sheet; a row when the map sits in the
                sheet, leaving the plot card room above): zoom in / out and Reset View — always in place, disabled while the
                view is the farmer's own framing — plus the boundary edit when a page passes one. */}
            <div data-map-controls role="group" aria-label="Map controls" className="absolute right-2 bottom-7 z-10 flex flex-row lg:flex-col overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm divide-x lg:divide-x-0 lg:divide-y divide-zinc-200 dark:divide-zinc-800">
                <TooltipProvider delayDuration={200}>
                    {onEditClick && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* a disabled button gets no pointer events: the tooltip sits on its wrapper */}
                                <span tabIndex={editEnabled ? -1 : 0} className="inline-flex">
                                    <Button variant="ghost" size="icon" data-map-edit-boundary onClick={onEditClick} disabled={!editEnabled} aria-label={editEnabled ? "Edit the selected plot's boundary" : "Select a plot to edit its boundary"} className={MAP_GROUP_CONTROL}>
                                        <PencilRuler className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">{editEnabled ? "Edit plot boundary" : "Select a plot to edit its boundary"}</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" data-map-zoom-in aria-label="Zoom in" onClick={() => zoomBy(1)} className={MAP_GROUP_CONTROL}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">Zoom in</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" data-map-zoom-out aria-label="Zoom out" onClick={() => zoomBy(-1)} className={MAP_GROUP_CONTROL}>
                                <Minus className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">Zoom out</TooltipContent>
                    </Tooltip>
                    {onReset && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={canReset ? -1 : 0} className="inline-flex">
                                    <Button variant="ghost" size="icon" data-map-reset-view aria-label="Reset view" onClick={onReset} disabled={!canReset} className={MAP_GROUP_CONTROL}>
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">{canReset ? "Reset view: the farmer's plots" : "Showing the farmer's plots"}</TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </div>

        </div>
    );
}

interface DeploymentDetailSheetProps {
    /** The farmer the detail shows (null: nothing open). */
    farmerId: string | null
    /** The list row the detail was opened from (shown and read first; the farmer's other rows follow). */
    seedRow: DeploymentMetadataRow | null
    /** The dispatch picked in the table (its dispatch_id — what a list row carries): revealed in the detail; null after Previous / Next. */
    selectedDispatchId: string | null
    /** The verifier expanded a dispatch in the detail: the table's selection follows (its dispatch_id). */
    onSelectDispatch: (dispatchId: string | null) => void
    open: boolean
    onOpenChange: (open: boolean) => void
    onNext: () => void
    onPrevious: () => void
    isFirst: boolean
    isLast: boolean
    currentIndex: number
    totalCount: number
    /** V2.1: farmers beyond the loaded ones may follow (the server has more pages) — the counter reads "n / m+". */
    moreFarmers?: boolean
    /** V2.1: the next page of farmers, while the detail is open — "loading": Next was pressed at the last loaded farmer
     *  (or that page is in flight there); "error": that page failed (Retry). Quiet ("idle") otherwise. */
    navStatus?: "idle" | "loading" | "error"
    onRetryNav?: () => void
    /** V2.1: an overlay over the detail opened / closed (boundary editor, media viewer, NOC review): a pending Next is dropped. */
    onOverlayChange?: (open: boolean) => void
    surveyData?: SurveyItem[]
    /** No longer used: it only added a synthetic point to the map fit (V2.1 frames the farmer's plots alone). */
    hasLocationQuestion?: boolean
    language?: "en" | "hi"
    onLanguageChange?: (lang: "en" | "hi") => void
    defaultTab?: "all" | "verified" | "pending" | "need_correction" | "details"
}

/** V2.1: the image viewer's zoom range (header buttons, double-click / double-tap, pinch) and the double-click step. */
const IMAGE_MIN_ZOOM = 0.5
const IMAGE_MAX_ZOOM = 3
const DOUBLE_ZOOM = 2
const clampZoom = (z: number) => Math.min(IMAGE_MAX_ZOOM, Math.max(IMAGE_MIN_ZOOM, Math.round(z * 100) / 100))

/**
 * The image viewer's stage. V2.1: gestures on the image only (never on the header or the footer):
 *   double-click / double-tap  zoom in at that point; repeat → back to the zoom it came from
 *   pinch (two fingers)         zoom
 *   drag (mouse / one finger)   pan while zoomed in — bounded: the image can move only as far as it overflows the stage
 * Rotation composes with zoom and pan (translate · scale · rotate). The stage is the space left by the header and the
 * footer (it never sits under them), so "fit" shows the whole image.
 */
function ImagePreview({ item, zoom, rotation, imageMode, onZoom, fitToken }: { item: SurveyItem, zoom: number, rotation: number, imageMode: "fill" | "fit" | "stretch" | "center", onZoom: (zoom: number) => void, fitToken: number }) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
    /** V2: a URL that doesn't load shows why, instead of an empty frame (keyed by URL by the caller). */
    const [failed, setFailed] = React.useState(false)
    const [pan, setPan] = React.useState({ x: 0, y: 0 })
    const [dragging, setDragging] = React.useState(false)
    const pointers = React.useRef(new Map<number, { x: number; y: number }>())
    const gesture = React.useRef<{ kind: "pan"; x: number; y: number; panX: number; panY: number } | { kind: "pinch"; dist: number; zoom: number } | null>(null)
    const tapStart = React.useRef<{ t: number; x: number; y: number } | null>(null)
    const lastTap = React.useRef<{ t: number; x: number; y: number } | null>(null)
    const lastPointerType = React.useRef<string>("mouse")
    /** The zoom a double-click / double-tap zoomed in from (the next one returns to it). */
    const zoomedFrom = React.useRef<number | null>(null)

    React.useLayoutEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
            updateSize();
        }

        return () => observer.disconnect();
    }, []);

    /** The pan the stage allows at `z`: half of what the zoomed image overflows it by, on each axis. */
    const bound = React.useCallback((p: { x: number; y: number }, z: number) => {
        const mx = Math.max(0, (containerSize.width * z - containerSize.width) / 2)
        const my = Math.max(0, (containerSize.height * z - containerSize.height) / 2)
        return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
    }, [containerSize.width, containerSize.height])
    // a smaller zoom or a resized stage re-bounds the pan (at fit size the image is centred); Fit to view re-centres
    React.useEffect(() => { setPan((p) => bound(p, zoom)) }, [zoom, bound])
    React.useEffect(() => { setPan({ x: 0, y: 0 }); zoomedFrom.current = null }, [fitToken])

    const toggleZoom = (clientX: number, clientY: number) => {
        if (zoom > 1) {
            onZoom(zoomedFrom.current ?? 1)
            zoomedFrom.current = null
            setPan({ x: 0, y: 0 })
            return
        }
        const box = containerRef.current?.getBoundingClientRect()
        const next = clampZoom(Math.max(DOUBLE_ZOOM, zoom * 2))
        zoomedFrom.current = zoom
        onZoom(next)
        if (box) {
            // the point under the pointer stays under it
            const dx = clientX - (box.left + box.width / 2), dy = clientY - (box.top + box.height / 2)
            setPan(bound({ x: -dx * (next / zoom - 1), y: -dy * (next / zoom - 1) }, next))
        }
    }
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        lastPointerType.current = e.pointerType
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
            tapStart.current = null
        } else if (pointers.current.size === 1) {
            tapStart.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
            gesture.current = zoom > 1 ? { kind: "pan", x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y } : null
            if (zoom > 1) setDragging(true)
        }
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const g = gesture.current
        if (g?.kind === "pinch" && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()]
            onZoom(clampZoom(g.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.dist)))
        } else if (g?.kind === "pan") {
            setPan(bound({ x: g.panX + e.clientX - g.x, y: g.panY + e.clientY - g.y }, zoom))
        }
    }
    const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        const start = tapStart.current
        pointers.current.delete(e.pointerId)
        if (pointers.current.size === 0) {
            gesture.current = null
            setDragging(false)
        } else if (gesture.current?.kind === "pinch") {
            gesture.current = null // one finger left after a pinch: no pan jump
        }
        tapStart.current = null
        // double-tap (touch / pen): two short, still taps close together
        if (e.type === "pointerup" && e.pointerType !== "mouse" && start && e.timeStamp - start.t < 300 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) {
            const last = lastTap.current
            if (last && e.timeStamp - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
                lastTap.current = null
                toggleZoom(e.clientX, e.clientY)
            } else {
                lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
            }
        }
    }

    const isRotated = rotation % 180 !== 0;

    // Calculate dimensions for the image wrapper when rotated
    const wrapperStyle: React.CSSProperties = isRotated && containerSize.width > 0 ? {
        width: `${containerSize.height}px`,
        height: `${containerSize.width}px`,
    } : {
        width: "100%",
        height: "100%",
    };

    if (failed) {
        return (
            <div ref={containerRef} data-preview-state="failed" className="flex-1 w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-900/50 text-center px-6">
                <ImageOff className="h-10 w-10 text-zinc-300" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">This image couldn&apos;t be loaded.</p>
                <p className="text-xs text-zinc-500 max-w-[420px]">The file may have been moved, or the link may have expired.</p>
                <a href={item.answer as string} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                    Open original link
                </a>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            data-image-stage
            data-zoom={zoom}
            data-pan={`${Math.round(pan.x)},${Math.round(pan.y)}`}
            data-rotation={rotation}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onDoubleClick={(e) => { if (lastPointerType.current === "mouse") toggleZoom(e.clientX, e.clientY) }}
            className={cn(
                "flex-1 min-h-0 w-full h-full overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 relative touch-none select-none",
                zoom > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
            )}
        >
            <div
                className={cn("flex items-center justify-center", !dragging && "transition-transform duration-200 ease-out")}
                style={{
                    ...wrapperStyle,
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                }}
            >
                <img
                    src={item.answer as string}
                    alt="Preview"
                    draggable={false}
                    onError={() => setFailed(true)}
                    className={cn(
                        "transition-all duration-300",
                        imageMode === "fill" && "w-full h-full object-cover",
                        imageMode === "fit" && "w-full h-full object-contain",
                        imageMode === "stretch" && "w-full h-full object-fill",
                        imageMode === "center" && "max-w-full max-h-full object-contain",
                    )}
                />
            </div>
        </div>
    );
}

export function DeploymentDetailSheet({
    farmerId,
    seedRow,
    selectedDispatchId: selectedTableDispatchId,
    onSelectDispatch: onSelectTableDispatch,
    open,
    onOpenChange,
    onNext,
    onPrevious,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    moreFarmers = false,
    navStatus = "idle",
    onRetryNav,
    onOverlayChange,
    defaultTab,
}: DeploymentDetailSheetProps) {
    // ── V2: Matic detail workflow state ─────────────────────────────────────────────────────────────
    /** Signed-in verifier: mock admin in mock mode, the bootstrap user in live mode (actions disabled until known). */
    const session = useDeploymentSession()
    const permissions = session.permissions
    /** Every mutation sends the verifier's phone as the verifier id; a null one is never sent (audit M3). */
    const verifierPhone = session.verifierPhone
    const sessionReady = session.status === "ready" && !!verifierPhone
    const navigate = useAppNavigate()
    /** V2.1: everything the farmer-level detail reads (the farmer's rows, each row's dispatches / NOC / history). */
    const detail = useFarmerDetail(farmerId, open, seedRow)
    /** The detail's per-farmer UI state is keyed by the farmer (a newly opened farmer starts fresh). */
    const stateKey = farmerId

    /**
     * The farmer's deployment groups (round / AZ order). V2.1: one entry per group however many dispatch rows the list
     * has for it; after a mutation the farmer is read again (afterMutation), so the entries follow the backend.
     */
    const rowEntries = React.useMemo<RowEntry[]>(() => {
        const base = detail.rows ?? [...detail.byRow.values()].map((r) => r.row)
        return base.map((row) => {
            const rowKey = getDeploymentRowKey(row)
            const d = detail.byRow.get(rowKey)
            const allApproved = groupAllApproved(d?.groupRows ?? [row], d?.loaded ? d.dispatches : null)
            return { row, rowKey, detail: d, type: getDeploymentType(row.az_id), allApproved }
        })
    }, [detail.rows, detail.byRow])
    const entryByKey = React.useCallback((rowKey: string | null | undefined) => (rowKey ? rowEntries.find((e) => e.rowKey === rowKey) : undefined), [rowEntries])
    /** The row the detail was opened from (the farmer's first row when the seed isn't this farmer's). */
    const seedEntry = React.useMemo(() => {
        const seedKey = seedRow && String(seedRow.farmer_id) === farmerId ? getDeploymentRowKey(seedRow) : null
        return (seedKey ? rowEntries.find((e) => e.rowKey === seedKey) : undefined) ?? rowEntries[0]
    }, [seedRow, farmerId, rowEntries])
    /** The header's farmer identity (name, village, avatar): the seed row's, else the first row's. */
    const headerRow = (seedRow && String(seedRow.farmer_id) === farmerId ? seedRow : null) ?? rowEntries[0]?.row ?? null
    const record = React.useMemo(() => (headerRow ? toDeploymentV2Record(headerRow, 0) : null), [headerRow])

    /** Every dispatch across the farmer's rows, each once (what the map and the report selection work on). */
    const trailers = React.useMemo(() => mergeDispatchReads(rowEntries.map((e) => e.detail?.dispatches ?? [])), [rowEntries])
    /** V2.1: the table's selection (a dispatch_id) as the detail's dispatch key (deployment_detail_id), once it is loaded. */
    const selectedDispatchId = React.useMemo(
        () => (selectedTableDispatchId ? trailers.find((d) => String(d.dispatch_id) === selectedTableDispatchId)?.deployment_detail_id ?? null : null),
        [selectedTableDispatchId, trailers],
    )
    /** The table's selection follows a dispatch expanded here (by its dispatch_id). */
    const onSelectDispatch = (deploymentDetailId: string | null) => {
        const dispatch = deploymentDetailId ? trailers.find((d) => d.deployment_detail_id === deploymentDetailId) : undefined
        onSelectTableDispatch(dispatch ? String(dispatch.dispatch_id) : null)
    }
    const rowKeyByDispatch = React.useMemo(() => {
        const map = new Map<string, string>()
        for (const e of rowEntries) for (const d of e.detail?.dispatches ?? []) if (!map.has(d.deployment_detail_id)) map.set(d.deployment_detail_id, e.rowKey)
        return map
    }, [rowEntries])
    const entryOfDispatch = React.useCallback((dispatch: Pick<TrailerDispatchItem, "deployment_detail_id"> | string | null) => {
        const id = typeof dispatch === "string" ? dispatch : dispatch?.deployment_detail_id
        return id ? entryByKey(rowKeyByDispatch.get(id)) : undefined
    }, [entryByKey, rowKeyByDispatch])
    /** A dispatch's deployment type: its row's (else by its own az_id). */
    const typeOf = React.useCallback((dispatch: TrailerDispatchItem) => entryOfDispatch(dispatch)?.type ?? getDeploymentType(dispatch.az_id), [entryOfDispatch])
    const dispatchOfPlot = React.useMemo(() => {
        const map = new Map<number, TrailerDispatchItem>()
        for (const d of trailers) for (const p of d.deployment_plots_data) if (!map.has(p.deployment_id)) map.set(p.deployment_id, d)
        return map
    }, [trailers])

    /** Every loaded dispatch with its view status, per row (deployment-dispatch-view.ts; history scoped to the row). */
    const classified = React.useMemo(() => new Map(rowEntries.map((e) => {
        const dispatches = e.detail?.dispatches ?? []
        const history = e.detail?.history ?? null
        const reportIndex = buildReportIndex(history ?? [], dispatches)
        const views = classifyDispatches({ row: e.row, allApproved: e.allApproved, dispatches, reportIndex, historyKnown: history !== null, fieldMarkers: e.type.reportedFieldMarkers })
        return [e.rowKey, { views, reportIndex }] as const
    })), [rowEntries])
    const dispatchViews = React.useMemo(() => [...classified.values()].flatMap((c) => c.views), [classified])
    const dispatchById = React.useCallback((id: string | null) => (id ? trailers.find((d) => d.deployment_detail_id === id) ?? null : null), [trailers])
    const viewById = React.useCallback((id: string | null) => (id ? dispatchViews.find((v) => v.dispatch.deployment_detail_id === id) ?? null : null), [dispatchViews])

    /** The NOC of one row's AZ (summary, readiness for the strip, the read's error). */
    const nocOf = (e: RowEntry) => {
        const d = e.detail
        const summary = summarizeNoc(d?.noc ?? null)
        const readiness = getNocReadiness(summary, { loading: (d?.nocLoading ?? true) && !d?.noc && !d?.nocError, error: !!d?.nocError })
        return { summary, readiness, error: d?.nocError ?? null }
    }

    // ── V2.1 (M1): per-type permissions — matic-dash's keys, through the session's flags ──────────────
    const hasPermission = (key: string) => {
        const flag = PERMISSION_FLAG[key]
        return flag ? !!permissions[flag] : false
    }
    /** The verifier may act (approve, report, NOC, comments, boundaries) on this row's type. */
    const canActOn = (row: DeploymentMetadataRow) => {
        const type = getDeploymentType(row.az_id)
        return sessionReady && !!type.actions && hasPermission(type.actions.editPermission)
    }
    /** Soft delete of the scope on this group's type; never when every dispatch of the group is approved (read-only). */
    const canDeleteOn = (entry: RowEntry, scope: "dispatch" | "plot") => {
        const type = getDeploymentType(entry.row.az_id)
        return sessionReady && !!type.actions && type.actions.deleteScopes[scope] && hasPermission(type.actions.deletePermission) && !entry.allApproved
    }
    /** Why actions are unavailable on this row (the account), or null. */
    const permissionBlocker = (row: DeploymentMetadataRow): string | null => {
        if (session.status === "error") return "Your account couldn't be loaded."
        if (session.status !== "ready") return null
        const type = getDeploymentType(row.az_id)
        if (!type.actions) return null
        if (!verifierPhone) return "Your verifier account has no phone number. Actions are disabled."
        if (!hasPermission(type.actions.editPermission)) return "You don't have permission to approve deployments."
        return null
    }
    /**
     * Every reason Approve is unavailable for a dispatch of this row — the account (alone, when it blocks), Matic's NOC
     * gates (in Matic's order; matic-dash applies them to AWD too) AND V2.1's boundary gate (requirement 5): every plot of
     * the dispatch with a valid SAVED boundary, read from the dispatch the detail returned — never from the editor.
     * Independent gates are all listed, so a NOC blocker never hides missing boundaries. Fail-safe: while the row's
     * dispatches are being (re-)read, or after a failed read, the boundaries count as unverified. The click AND the
     * confirmation handlers both re-run this (a disabled button is never the only guard). Frontend-only: whether the
     * backend enforces the same is unverified.
     */
    const approveBlockersFor = (e: RowEntry) => (dispatch: TrailerDispatchItem): ApproveBlocker[] => {
        const permission = permissionBlocker(e.row)
        if (permission) return [{ kind: "permission", title: null, text: permission }]
        const blockers: ApproveBlocker[] = []
        const noc = nocOf(e)
        const nocBlocker = noc.readiness === "loading" ? "Checking NOC…" : noc.error ? `NOC details are unavailable: ${noc.error}` : getNocApprovalBlocker(noc.summary)
        if (nocBlocker) blockers.push({ kind: "noc", title: null, text: nocBlocker })
        const boundaryTitle = "Boundaries required."
        if (e.detail?.loading) {
            blockers.push({ kind: "boundary", title: boundaryTitle, text: "Checking the plots' saved boundaries…" })
        } else if (e.detail?.dispatchesError) {
            blockers.push({ kind: "boundary", title: boundaryTitle, text: "The plots' saved boundaries couldn't be read, so they can't be verified." })
        } else {
            const gate = dispatchBoundaryGate(dispatch, plotLabel)
            if (!gate.ok && gate.reason) blockers.push({ kind: "boundary", title: boundaryTitle, text: gate.reason })
        }
        return blockers
    }
    /** The first blocker as one message (the click / confirm toasts), or null when Approve may proceed. */
    const approveBlockerFor = (e: RowEntry) => (dispatch: TrailerDispatchItem): string | null => {
        const blockers = approveBlockersFor(e)(dispatch)
        return blockers.length ? blockers.map((b) => (b.title ? `${b.title} ${b.text}` : b.text)).join(" ") : null
    }

    /** The local dispatch filter picked in this detail, for this farmer only (a newly opened farmer starts at its default). */
    const [filterChoice, setFilterChoice] = React.useState<{ key: string | null; filter: DetailFilter } | null>(null)
    /** Collapsed AZ sections (by az_id), for this farmer only (a newly opened farmer starts with every AZ expanded). */
    const [collapsedAzChoice, setCollapsedAzChoice] = React.useState<{ key: string | null; azIds: number[] } | null>(null)
    /** Dispatches expanded in place, for this farmer only (by deployment_detail_id; a newly opened farmer starts all collapsed). */
    const [expandedChoice, setExpandedChoice] = React.useState<{ key: string | null; ids: string[] } | null>(null)
    /** Plot (deployment) cards expanded to their details, for this farmer only (by deployment_id; all start collapsed). */
    const [plotChoice, setPlotChoice] = React.useState<{ key: string | null; ids: number[] } | null>(null)
    /** The report history the dialog shows: a row's (its AZ), narrowed to one dispatch when opened from it. */
    const [historyScope, setHistoryScope] = React.useState<{ rowKey: string; dispatchId: string | null } | null>(null)
    /**
     * An element to scroll into view after the next render (a plot revealed from the map, the dispatch picked in the
     * table). With `context` (its dispatch card), the dispatch is brought into view first and the element is centred only
     * if it would otherwise stay hidden.
     */
    const revealRef = React.useRef<{ selector: string; block: ScrollLogicalPosition; context?: string; seq?: number; dispatchId?: string; plotId?: number } | null>(null)
    /** The dispatch (and its picked plot) a map pick just revealed: briefly emphasised in the list, after the scroll. */
    const [mapFocus, setMapFocus] = React.useState<{ id: string; plotId: number; at: number } | null>(null)
    /** Map ↔ list navigation: each map pick gets a number (the latest wins); its guided scroll can be cancelled. */
    const navSeqRef = React.useRef(0)
    const scrollCancelRef = React.useRef<(() => void) | null>(null)
    /** The plot the camera flies to (a deployment's map focus). */
    const [cameraFocus, setCameraFocus] = React.useState<CameraFocus | null>(null)
    const cameraSeqRef = React.useRef(0)
    /** The dispatch whose plots the map highlights (the latest one expanded / selected); null: none. */
    const [highlightDispatchId, setHighlightDispatchId] = React.useState<string | null>(null)
    /**
     * The map selection's owner: every new selection (a dispatch, a deployment, a map pick) — and every clear (Reset View,
     * farmer change, the plot card's close, the editor opening) — takes the next number. The bounce belongs to exactly one
     * selection and lasts as long as it does; a flight that lands for an older selection can't start one.
     */
    const selectionSeqRef = React.useRef(0)
    const [bounce, setBounce] = React.useState<{ owner: number; kind: "dispatch" | "deployment"; ids: string[] } | null>(null)
    /** The dispatch in report mode (one at a time; its expanded card shows the selectable values). */
    const [reportDispatchId, setReportDispatchId] = React.useState<string | null>(null)
    /** The dispatch whose approval is being confirmed. */
    const [approveDispatchId, setApproveDispatchId] = React.useState<string | null>(null)
    /** The plot whose comment dialog is open. */
    const [commentTarget, setCommentTarget] = React.useState<{ dispatchId: string; deploymentId: number } | null>(null)
    const [reportedIds, setReportedIds] = React.useState<string[]>([])
    const [isReportingFinalStep, setIsReportingFinalStep] = React.useState(false)
    /** V2.1: a failed report, shown inside the dialog (the full server text under Technical details). */
    const [reportError, setReportError] = React.useState<{ message: string; details: string | null } | null>(null)
    React.useEffect(() => { if (!isReportingFinalStep) setReportError(null) }, [isReportingFinalStep])
    const [reportComment, setReportComment] = React.useState("")
    const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)
    const [reportSuccess, setReportSuccess] = React.useState(false)
    const [localReports, setLocalReports] = React.useState<Record<string, LocalReport>>({})
    const [approveDialogOpen, setApproveDialogOpen] = React.useState(false)
    const [isApprovingDispatch, setIsApprovingDispatch] = React.useState(false)
    /** The NOC document open in the preview (its key in the farmer's document list: "<rowKey>:<az_id>"). */
    const [nocView, setNocView] = React.useState<string | null>(null)
    /**
     * The NOC review is open: the preview dialog shows the current document directly (with Previous / Next over every
     * document, Report / Approve), or — while nothing can be shown — the loading / failed / empty state.
     */
    const [nocReviewOpen, setNocReviewOpen] = React.useState(false)
    /** The row the review was opened for (a card's "Review NOC"): its undecided document is shown first when none is chosen yet. */
    const [nocPreferRowKey, setNocPreferRowKey] = React.useState<string | null>(null)
    /**
     * QA: the mutations in flight, by kind. A second activation of the same mutation before the first settles is
     * ignored — the buttons' disabled state only applies after a render, so two activations in the same task (a
     * scripted double activation, an assistive-technology repeat) could otherwise send the request twice.
     */
    const inFlightRef = React.useRef(new Set<string>())
    const runOnce = async (kind: string, run: () => Promise<void>) => {
        if (inFlightRef.current.has(kind)) return
        inFlightRef.current.add(kind)
        try {
            await run()
        } finally {
            inFlightRef.current.delete(kind)
        }
    }
    /** The document whose decision is being sent (its key) — one at a time. */
    const [submittingNocKey, setSubmittingNocKey] = React.useState<string | null>(null)
    const [historyOpen, setHistoryOpen] = React.useState(false)
    const [historyItems, setHistoryItems] = React.useState<ReportHistoryEntry[] | null>(null)
    const [historyError, setHistoryError] = React.useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
    const [deleteComment, setDeleteComment] = React.useState("")
    const [deleteError, setDeleteError] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [plotCommentDraft, setPlotCommentDraft] = React.useState<string | null>(null)
    const [isSavingPlotComment, setIsSavingPlotComment] = React.useState(false)
    const [toastMessage, setToastMessage] = React.useState<{ title: string; description: string; type: "success" | "error" } | null>(null)
    /** The dispatch already revealed for the table's selection (never revealed twice; reset per farmer). */
    const revealedRef = React.useRef<string | null>(null)

    // A different farmer starts with every row open, every dispatch collapsed and no pending report / dialog state.
    React.useEffect(() => {
        setReportDispatchId(null)
        setApproveDispatchId(null)
        setCommentTarget(null)
        setReportedIds([])
        setReportComment("")
        setPlotCommentDraft(null)
        setFilterChoice(null)
        setCollapsedAzChoice(null)
        setExpandedChoice(null)
        setPlotChoice(null)
        revealRef.current = null
        revealedRef.current = null
        setHistoryOpen(false)
        setHistoryScope(null)
        setApproveDialogOpen(false)
        setDeleteTarget(null)
        setNocView(null)
        setNocReviewOpen(false)
        setNocPreferRowKey(null)
    }, [stateKey, open])

    // Live: an account (bootstrap) failure leaves every action disabled — say why.
    React.useEffect(() => {
        if (!open || session.status !== "error") return
        setToastMessage({ title: "Couldn't load your account", description: `${session.error ?? ""} Actions are disabled.`, type: "error" })
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [open, session.status, session.error])

    // Load-failure toasts (each row's section also shows its own failure in place of its dispatch list).
    const dispatchFailure = rowEntries.map((e) => e.detail?.dispatchesError ?? null).find((e) => e !== null) ?? null
    const nocFailure = rowEntries.map((e) => e.detail?.nocError ?? null).find((e) => e !== null) ?? null
    const loadFailure = dispatchFailure ?? nocFailure ?? detail.rowsError
    React.useEffect(() => {
        if (!open || !loadFailure) return
        setToastMessage({
            title: dispatchFailure ? "Couldn't load trailer dispatches" : nocFailure ? "Couldn't load NOC details" : "Couldn't load the farmer's deployments",
            description: loadFailure,
            type: "error",
        })
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [open, loadFailure, dispatchFailure, nocFailure])

    /** Filter counts: known once every row's dispatch read succeeded (each dispatch carries its own status). */
    const readsOk = !detail.rowsError && rowEntries.length > 0 && rowEntries.every((e) => !!e.detail?.loaded && !e.detail.dispatchesError)
    const filterCounts = detailFilterCounts(dispatchViews, { readsOk })
    /**
     * V2.1: the header's "N Plots · X Acres" (data/farmer-header-totals.ts): the farmer's unique plots (by `plot_id`)
     * across every dispatch read, and their total Cal. Area — the table's Cal. Area (the list rows' `calculated_area`),
     * each dispatch once; unstated, with the reasons, whenever a value is missing, invalid, 0 or conflicting, or a plot
     * is on more than one deployment record. Only once the farmer's list rows AND every dispatch read are in.
     */
    const plotTotals = React.useMemo(
        () => (readsOk && detail.dispatchRows ? farmerHeaderTotals(trailers, detail.dispatchRows) : null),
        [readsOk, trailers, detail.dispatchRows]
    )
    /** The local filter: the row's default (where it was opened from) until the verifier picks another for this farmer. */
    const detailFilter: DetailFilter = filterChoice && filterChoice.key === stateKey ? filterChoice.filter : defaultDetailFilter(defaultTab)
    const collapsedAzIds = new Set(collapsedAzChoice && collapsedAzChoice.key === stateKey ? collapsedAzChoice.azIds : [])
    const toggleAz = (azId: number) => setCollapsedAzChoice((prev) => {
        const current = prev && prev.key === stateKey ? prev.azIds : []
        return { key: stateKey, azIds: current.includes(azId) ? current.filter((id) => id !== azId) : [...current, azId] }
    })
    /** Opens an AZ section if it is collapsed (to reveal one of its dispatches). */
    const expandAz = (azId: number) => setCollapsedAzChoice((prev) => (
        prev && prev.key === stateKey && prev.azIds.includes(azId) ? { key: stateKey, azIds: prev.azIds.filter((id) => id !== azId) } : prev
    ))
    const expandedDispatches = new Set(expandedChoice && expandedChoice.key === stateKey ? expandedChoice.ids : [])
    const expandedPlots = new Set(plotChoice && plotChoice.key === stateKey ? plotChoice.ids : [])
    const setPlotExpanded = (deploymentId: number, expand: boolean) => setPlotChoice((prev) => {
        const current = prev && prev.key === stateKey ? prev.ids : []
        if (current.includes(deploymentId) === expand) return prev
        return { key: stateKey, ids: expand ? [...current, deploymentId] : current.filter((id) => id !== deploymentId) }
    })
    const setDispatchExpanded = (deploymentDetailId: string, expand: boolean) => setExpandedChoice((prev) => {
        const current = prev && prev.key === stateKey ? prev.ids : []
        if (current.includes(deploymentDetailId) === expand) return prev
        return { key: stateKey, ids: expand ? [...current, deploymentDetailId] : current.filter((id) => id !== deploymentDetailId) }
    })
    const toggleDispatch = (deploymentDetailId: string) => setDispatchExpanded(deploymentDetailId, !expandedDispatches.has(deploymentDetailId))
    /**
     * Approve and Report (offersApprove / offersReport, deployment-dispatch-view.ts), on the dispatch's own row and type.
     * Each handler re-checks the gate for the dispatch it acts on.
     */
    const reportView = viewById(reportDispatchId)
    const reportEntry = entryOfDispatch(reportDispatchId)
    const canOfferReport = !!reportEntry && !!reportView && canActOn(reportEntry.row) && offersReport(reportView, reportEntry.type)
    const approveDispatch = dispatchById(approveDispatchId)
    const approveEntry = entryOfDispatch(approveDispatchId)
    const approveView = viewById(approveDispatchId)
    const canOfferApprove = !!approveEntry && !!approveView && canActOn(approveEntry.row) && offersApprove(approveView, approveEntry.type)
    /** The boundary gate of the dispatch being approved, on the dispatch as currently loaded (the dialog shows it). */
    const approveGate = approveDispatch ? dispatchBoundaryGate(approveDispatch, plotLabel) : null
    /** Plot comments: viewed by anyone, edited on the dispatches of the row's own verification read (as before). */
    const commentDispatch = dispatchById(commentTarget?.dispatchId ?? null)
    const commentEntry = entryOfDispatch(commentTarget?.dispatchId ?? null)
    const commentPlot = commentDispatch?.deployment_plots_data.find((p) => p.deployment_id === commentTarget?.deploymentId) ?? null
    const commentEditable = !!commentEntry && canActOn(commentEntry.row) && (viewById(commentTarget?.dispatchId ?? null)?.inVerificationScope ?? false)
    const [previewItem, setPreviewItem] = React.useState<SurveyItem | null>(null)
    /** V2: the previewed video URL that failed to load (its preview then says so). */
    const [failedVideoUrl, setFailedVideoUrl] = React.useState<string | null>(null)
    const [selectedPlot, setSelectedPlot] = React.useState<any | null>(null)
    const [hoveredPlotId, setHoveredPlotId] = React.useState<string | null>(null)
    /** The deployment an inline plot row located on the map, and the map plot it focused (the mock map matches by location). */
    const [located, setLocated] = React.useState<{ deploymentId: number; mapPlotId: string } | null>(null)
    const [zoom, setZoom] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [imageMode, setImageMode] = React.useState<"fill" | "fit" | "stretch" | "center">("fit")
    /** V2.1: "Fit to view" — a new value re-centres the image stage (zoom, rotation and mode are reset with it). */
    const [fitToken, setFitToken] = React.useState(0)
    const [isDataLoading, setIsDataLoading] = React.useState(false)
    const [mapCenter, setMapCenter] = React.useState<google.maps.LatLngLiteral | null>(null)
    const [mapZoom, setMapZoom] = React.useState<number>(17)
    const [isShowingSpecificLocation, setIsShowingSpecificLocation] = React.useState(false)
    const [isMapInteracted, setIsMapInteracted] = React.useState(false)
    const [resetCount, setResetCount] = React.useState(0)
    /**
     * V2.1: the plots the map draws — the data layer's, plus boundaries saved in this session, tied to the data they were
     * made on (`base`). A newer farmer / read replaces them in the SAME render: before, they followed one render late, so
     * the map briefly framed the previous farmer's plots under the new farmer.
     */
    const [localFarmerPlots, setLocalFarmerPlots] = React.useState<{ base: MapPlot[]; plots: MapPlot[] } | null>(null)
    /** V2: the plot whose boundary is being edited (full-screen, on this page), with the deployment it saves to. */
    const [boundaryTarget, setBoundaryTarget] = React.useState<{ mapPlot: MapPlot; deployment: SelectedDeployment } | null>(null)
    /**
     * V2.1: one Save all's containment bookkeeping — the deployments covered by its earlier outlines (never covered again
     * by a later one), what each saved outline covered (for the result), and whether a save that covered several
     * deployments failed (its outcome is then not confirmed: the detail is read again to show what the backend kept).
     */
    const coverageRef = React.useRef<{ covered: Set<number>; byPlot: Map<string, string[]>; uncertain: boolean }>({ covered: new Set(), byPlot: new Map(), uncertain: false })
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const isProgrammaticChange = React.useRef(false);

    // Synchronize map plots with the farmer when the farmer or the sheet's open state changes.
    // V2: map farmer from the data layer (mock farmer in mock mode, the loaded real plots in live mode). V2.1: each plot's
    // amount / source is read through ITS dispatch's type (a farmer may have rows of different types).
    const semantics = React.useMemo<PlotSemanticsReader>(() => ({
        amountOf: (plot) => {
            const owner = dispatchOfPlot.get(plot.deployment_id)
            return owner ? typeOf(owner).plotAmount(plot) : null
        },
        sourceOf: (dispatch) => typeOf(dispatch).dispatchSource(dispatch),
    }), [dispatchOfPlot, typeOf])
    const baseFarmerData = React.useMemo(() => buildMapFarmer(record, trailers, semantics), [record, trailers, semantics]);
    React.useEffect(() => {
        if (record) setLocalFarmerPlots({ base: baseFarmerData.plots, plots: baseFarmerData.plots });
    }, [record, open, baseFarmerData]);

    const farmerData = React.useMemo(() => {
        return {
            ...baseFarmerData,
            plots: localFarmerPlots && localFarmerPlots.base === baseFarmerData.plots ? localFarmerPlots.plots : baseFarmerData.plots
        };
    }, [baseFarmerData, localFarmerPlots]);
    /** V2: marker semantics for this farmer's map plots — colour per source (fixed order), size per amount. */
    const markerSemantics = React.useMemo(() => ({ colors: sourceColors(farmerData.plots), scale: amountScale(farmerData.plots) }), [farmerData.plots]);
    /** The type whose labels the map legend uses: the selected dispatch's row, else the row opened from. */
    const focusEntry = entryOfDispatch(selectedDispatchId) ?? seedEntry
    const focusType = focusEntry?.type ?? getDeploymentType(0)
    // V2.1: the last opened detail for the Data / API Inspector's mapping section (design-time; nothing in the UI reads
    // it). Kept after the sheet closes — the Inspector opens from the toolbar, which the open sheet covers.
    React.useEffect(() => {
        if (!farmerId || !headerRow) return
        inspectorState.setDetail({
            open,
            farmerId,
            row: headerRow,
            typeKey: focusType.key,
            rows: rowEntries.map((e) => ({ row: e.row, typeKey: e.type.key, dispatches: e.detail?.dispatches ?? [], loading: e.detail?.loading ?? true, error: e.detail?.dispatchesError ?? null, nocError: e.detail?.nocError ?? null, historyFailed: e.detail?.historyFailed ?? false })),
            rowsError: detail.rowsError,
            trailers,
            loading: detail.loading,
            error: dispatchFailure,
            amountLabel: focusType.amountLabel,
            selectedDispatchId,
            markers: (farmerData.plots as MapPlot[]).map((plot) => ({
                id: plot.id,
                deploymentId: plot.deploymentId,
                source: plot.source,
                color: markerSemantics.colors.colorOf(plot.source),
                amount: plot.amount,
                diameter: markerSemantics.scale.diameterOf(plot.amount),
                outlinePoints: plot.path?.length ?? 0,
            })),
        })
    }, [open, farmerId, headerRow, focusType, rowEntries, detail.rowsError, detail.loading, trailers, dispatchFailure, selectedDispatchId, farmerData.plots, markerSemantics])
    React.useEffect(() => () => inspectorState.setDetail(null), [])


    const scrollAreaRef = React.useRef<HTMLDivElement>(null)

    // Determine if we are previewing something else (image, video, file)
    const activePreview = previewItem && previewItem.type !== "map" ? previewItem : null;
    /** V2.1: an overlay is open over the detail — the page drops a pending Next (it never switches farmers under one). */
    const overlayOpen = !!boundaryTarget || !!activePreview || nocReviewOpen
    React.useEffect(() => { onOverlayChange?.(overlayOpen) }, [overlayOpen, onOverlayChange])

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: env.googleMapsApiKey,
        libraries: LIBRARIES
    });

    const [mapVisible, setMapVisible] = React.useState(false)
    const [isMapReady, setIsMapReady] = React.useState(false)
    /**
     * V2.1: the map's cover — until the map first renders, and while a newly opened farmer's dispatches load (Previous /
     * Next): the camera holds on the last farmer meanwhile instead of showing a half-loaded state.
     */
    const mapLoadingRecord = detail.loading && trailers.length === 0 && !dispatchFailure
    const mapCovered = !isMapReady || mapLoadingRecord

    const onMapIdle = React.useCallback(() => {
        if (!isMapReady) {
            setIsMapReady(true);
        }
    }, [isMapReady]);

    // Reset state when the farmer changes
    React.useEffect(() => {
        setPreviewItem(null);
        setZoom(1);
        setRotation(0);
        setImageMode("fit");
        // V2.1: the map stays ready across farmers (it isn't remounted); the cover follows the new farmer's load (mapCovered)
        setMapCenter(null); // Reset map center
        setMapZoom(17); // Reset map zoom
        setIsShowingSpecificLocation(false); // Reset specific location state
        setIsMapInteracted(false); // Reset map interaction state
        setSelectedPlot(null); // V2: the previous farmer's plot selection doesn't carry over
        setHoveredPlotId(null);
        setLocated(null);
        setMapFocus(null);
        setCameraFocus(null);
        setHighlightDispatchId(null);
        selectionSeqRef.current += 1;
        setBounce(null);
        setBoundaryTarget(null);
        navSeqRef.current += 1;
        scrollCancelRef.current?.();

        if (open) {
            setMapVisible(true);
            setIsDataLoading(true);
            const timer = setTimeout(() => {
                setIsDataLoading(false);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setMapVisible(false);
            setIsMapReady(false); // V2.1: the map unmounts with the sheet; a reopened sheet starts a new map (its own cover)
            setIsDataLoading(false);
        }
    }, [farmerId, open])

    // V2: scroll to what the last change revealed (a plot picked on the map, the dispatch picked in the table), once.
    React.useLayoutEffect(() => {
        const reveal = revealRef.current
        if (!reveal) return
        revealRef.current = null
        const root = scrollAreaRef.current
        const target = root?.querySelector(reveal.selector)
        if (!target) return
        const context = reveal.context ? root?.querySelector<HTMLElement>(reveal.context) : null
        const viewport = root?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")
        if (!context || !viewport || !(target instanceof HTMLElement)) {
            target.scrollIntoView({ block: reveal.block, behavior: prefersReducedMotion() ? "auto" : "smooth" })
            return
        }
        // Guided, not teleported: smooth-scroll the list to a useful resting place, then focus what was picked.
        const { seq, dispatchId, plotId } = reveal
        scrollCancelRef.current?.()
        scrollCancelRef.current = guideScroll(viewport, revealScrollTop(viewport, context, target), () => {
            scrollCancelRef.current = null
            if (seq !== navSeqRef.current || !dispatchId || plotId === undefined) return // a newer selection took over
            setMapFocus({ id: dispatchId, plotId, at: Date.now() })
        })
    })
    React.useEffect(() => {
        if (!mapFocus) return
        const timer = setTimeout(() => setMapFocus(null), 1600)
        return () => clearTimeout(timer)
    }, [mapFocus])
    React.useEffect(() => () => scrollCancelRef.current?.(), [])

    /** The map plot of a dispatch plot: by plot id (live), else by location as the Location card does (mock); none without a location. */
    const mapPlotOf = (plot: TrailerDeploymentPlot) => {
        const at = plot.location
        return farmerData.plots.find((p) => p.id === String(plot.deployment_id))
            ?? (at ? farmerData.plots.find((p) => Math.abs(p.location.lat - at.lat) < 0.0015 && Math.abs(p.location.lng - at.lng) < 0.0015) : undefined)
    }
    /** The map plots of a dispatch's deployments (only those with a real location have one). */
    const dispatchMapPlotIds = (dispatch: TrailerDispatchItem | null) =>
        [...new Set((dispatch?.deployment_plots_data ?? []).map(mapPlotOf).filter((p): p is NonNullable<typeof p> => !!p).map((p) => p.id))]
    /** A new map selection (or a clear): the previous selection's bounce stops at once; the number owns what follows. */
    const newSelection = () => {
        setBounce(null)
        return ++selectionSeqRef.current
    }
    /** These markers bounce for as long as `owner` stays the selection (none with reduced motion: the highlight alone). */
    const bounceMarkers = (ids: string[], owner: number, kind: "dispatch" | "deployment") => {
        if (owner !== selectionSeqRef.current) return // a newer selection took over
        if (ids.length === 0 || prefersReducedMotion()) return setBounce(null)
        setBounce({ owner, kind, ids })
    }
    /**
     * Selects a dispatch on the map: its located plots are highlighted and the camera frames them — one plot is focused
     * like a deployment, several are fitted together, none leaves the camera where it is — then their markers bounce for
     * as long as the dispatch stays selected. It never opens the one-plot card.
     */
    const focusDispatchOnMap = (deploymentDetailId: string) => {
        const owner = newSelection()
        setHighlightDispatchId(deploymentDetailId)
        setSelectedPlot(null) // a dispatch focus is a group: no single plot's card
        const plots = dispatchMapPlotIds(dispatchById(deploymentDetailId)).map((id) => farmerData.plots.find((p) => p.id === id)).filter((p): p is MapPlot => !!p)
        if (plots.length === 0) {
            setCameraFocus(null) // no valid location: the camera stays (an older flight stops — the latest selection wins)
            return
        }
        const seq = ++cameraSeqRef.current
        const one = plots.length === 1 ? plots[0] : null
        setCameraFocus(one
            ? { seq, location: one.location, path: one.path, plotId: one.id, bounceIds: [one.id], owner, kind: "dispatch" }
            : { seq, location: plots[0].location, group: plots.flatMap((p) => [p.location, ...(p.path ?? [])]), bounceIds: plots.map((p) => p.id), owner, kind: "dispatch" })
        setIsShowingSpecificLocation(true)
        setIsMapInteracted(false)
    }
    /** The latest focusDispatchOnMap, for the reveal effect below (which must not re-run for each new closure). */
    const focusDispatchRef = React.useRef<(deploymentDetailId: string) => void>(() => {})
    React.useEffect(() => { focusDispatchRef.current = focusDispatchOnMap })
    // V2.1: the dispatch picked in the table (the Samples pattern): once it is loaded, its row section opens, the filter
    // shows it, its trailer group and card open, the card scrolls into view and its plots are focused on the map. Once
    // per selection; never while the loading screen covers the list (there is nothing to scroll to yet).
    React.useEffect(() => {
        if (!open || !selectedDispatchId) {
            if (!selectedDispatchId) revealedRef.current = null
            return
        }
        if (isDataLoading || revealedRef.current === selectedDispatchId) return
        const dispatch = trailers.find((d) => d.deployment_detail_id === selectedDispatchId)
        if (!dispatch) return
        revealedRef.current = selectedDispatchId
        const view = viewById(selectedDispatchId)
        if (view && !inDetailFilter(view, detailFilter)) setFilterChoice({ key: stateKey, filter: "all" })
        expandAz(dispatch.az_id)
        setDispatchExpanded(selectedDispatchId, true)
        focusDispatchRef.current(selectedDispatchId)
        revealRef.current = { selector: `[data-dispatch-row="${selectedDispatchId}"]`, block: "start" }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the selection or the loaded dispatches change; the setters are per-render closures over stateKey
    }, [open, selectedDispatchId, trailers, isDataLoading])

    if (!record) return null;

    // ── V2: workflow handlers (every call goes through deploymentApi — mock or live — then refetches) ──
    /** After a successful mutation: reconcile the authoritative row, table and counts, then read the farmer again. */
    const afterMutation = (rowKey?: string) => {
        const row = entryByKey(rowKey)?.row
        if (!row) {
            detail.reload()
            return
        }
        deploymentApi.reconcile(row).then(
            () => detail.reload(),
            (error: unknown) => {
                detail.reload()
                showToast("Couldn't refresh the deployment", errorMessage(error), "error")
            },
        )
    }

    const showToast = (title: string, description: string, type: "success" | "error") => {
        setToastMessage({ title, description, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleItemClick = (item: SurveyItem) => {
        if (item.type === "map") {
            if (item.meta) {
                const numbers = item.meta.match(/[\d.]+/g);
                if (numbers && numbers.length >= 2) {
                    const lat = parseFloat(numbers[0]);
                    const lng = parseFloat(numbers[1]);

                    const foundPlot = farmerData.plots.find(p => {
                        const dLat = Math.abs(p.location.lat - lat);
                        const dLng = Math.abs(p.location.lng - lng);
                        return dLat < 0.0015 && dLng < 0.0015;
                    });

                    if (foundPlot) {
                        if (mapRef.current) {
                            isProgrammaticChange.current = true;
                        }
                        setSelectedPlot(foundPlot);
                        setMapCenter(foundPlot.location);
                        setMapZoom(19);
                        setIsShowingSpecificLocation(true);
                        setIsMapInteracted(false);
                        return;
                    }
                }
            }
            return;
        }
        if (["image", "video", "file"].includes(item.type)) {
            setPreviewItem(item)
        }
    }

    const exitReportMode = () => {
        setReportDispatchId(null)
        setReportedIds([])
        setReportComment("")
    }
    /** Report on an expanded Pending dispatch: the type's report options (its values) become selectable. */
    const startReport = (dispatch: TrailerDispatchItem) => {
        const entry = entryOfDispatch(dispatch)
        const view = viewById(dispatch.deployment_detail_id)
        if (!entry || !view || !canActOn(entry.row) || !offersReport(view, entry.type)) return
        setReportDispatchId(dispatch.deployment_detail_id)
        setReportedIds([])
        setReportComment("")
    }
    /**
     * Expands / collapses a dispatch; collapsing the one in report mode leaves report mode. Expanding selects the
     * dispatch on the map (focusDispatchOnMap) and makes it the table's selection. Collapsing removes its highlight (no
     * camera move).
     */
    const toggleDispatchCard = (deploymentDetailId: string) => {
        const expanding = !expandedDispatches.has(deploymentDetailId)
        if (!expanding && reportDispatchId === deploymentDetailId) exitReportMode()
        toggleDispatch(deploymentDetailId)
        if (expanding) {
            revealedRef.current = deploymentDetailId // the verifier opened it: nothing to reveal for the selection
            onSelectDispatch(deploymentDetailId)
            focusDispatchOnMap(deploymentDetailId)
        } else if (highlightDispatchId === deploymentDetailId) {
            setHighlightDispatchId(null)
            if (bounce?.kind === "dispatch" || cameraFocus?.kind === "dispatch") {
                newSelection() // its bounce stops; a flight still going to it stops where it is
                if (cameraFocus?.kind === "dispatch") setCameraFocus(null)
            }
        }
    }
    const openComment = (dispatch: TrailerDispatchItem, plot: TrailerDeploymentPlot) => {
        setCommentTarget({ dispatchId: dispatch.deployment_detail_id, deploymentId: plot.deployment_id })
        setPlotCommentDraft(plot.comment ?? "")
    }
    const closeComment = () => {
        setCommentTarget(null)
        setPlotCommentDraft(null)
    }
    /**
     * A deployment → its plot on the map: selected (marker and outline), its dispatch's plots highlighted, the camera
     * flies there; its marker bounces when the camera arrives. A plot without a real location has no map plot: nothing moves.
     */
    const locatePlot = (plot: TrailerDeploymentPlot) => {
        const mapPlot = mapPlotOf(plot)
        if (!mapPlot) return
        const owner = dispatchOfPlot.get(plot.deployment_id)
        const selection = newSelection()
        setSelectedPlot(mapPlot)
        setLocated({ deploymentId: plot.deployment_id, mapPlotId: mapPlot.id })
        if (owner) setHighlightDispatchId(owner.deployment_detail_id)
        setCameraFocus({ seq: ++cameraSeqRef.current, location: mapPlot.location, path: mapPlot.path, plotId: mapPlot.id, bounceIds: [mapPlot.id], owner: selection, kind: "deployment" })
        setIsShowingSpecificLocation(true)
        setIsMapInteracted(false)
    }
    /** A plot card expands to its details / collapses; expanding also focuses the plot on the map (when it has a location). */
    const togglePlotCard = (plot: TrailerDeploymentPlot) => {
        const expand = !expandedPlots.has(plot.deployment_id)
        setPlotExpanded(plot.deployment_id, expand)
        if (expand && plot.location) locatePlot(plot)
    }
    /**
     * A marker / outline picked on the map → the list reveals its dispatch: the local filter switches to All if it hides
     * that dispatch, its row section, trailer group and the dispatch open, the dispatch scrolls into view (then its plot
     * card, if needed), the plot card is marked and the dispatch briefly ringed. The plot is found by its stable id — the
     * map's plot id is the deployment_id (live map-data.ts) — never by a position in a list. V2.1: resolved exactly as
     * the plot's card resolves it (deploymentOf), so the mock's demo map (its plots link a dispatch plot by location)
     * reveals the same deployment its card names.
     */
    const selectPlotFromMap = (plot: Plot | null) => {
        const selection = newSelection() // a pick, or the card's close (a clear): the previous bounce stops
        setSelectedPlot(plot)
        const seq = ++navSeqRef.current
        scrollCancelRef.current?.()
        scrollCancelRef.current = null
        setMapFocus(null)
        if (!plot) {
            setCameraFocus(null) // the card closed: no flight toward an older selection
            return
        }
        // V2.1: a plot picked on the map (its marker or its boundary) is focused as one picked in the list (locatePlot):
        // the camera flies to it with the existing transition — its outline fitted, else its point — and its marker
        // bounces when the camera arrives (onFocusArrived)
        const mapPlot = plot as MapPlot
        setCameraFocus({ seq: ++cameraSeqRef.current, location: mapPlot.location, path: mapPlot.path, plotId: mapPlot.id, bounceIds: [mapPlot.id], owner: selection, kind: "deployment" })
        setIsShowingSpecificLocation(true)
        setIsMapInteracted(false)
        // the deployment behind the picked plot, resolved as its card resolves it (deploymentOf): live, the map plot's id is
        // the deployment_id; mock, the deployment focused on this demo plot, else the dispatch plot linked to it
        const picked = deploymentOf(plot as MapPlot)
        if (!picked) return
        const owner = picked.dispatch
        const ownerPlot = picked.plot
        const ownerView = viewById(owner.deployment_detail_id)
        if (ownerView && !inDetailFilter(ownerView, detailFilter)) setFilterChoice({ key: stateKey, filter: "all" })
        expandAz(owner.az_id)
        setDispatchExpanded(owner.deployment_detail_id, true)
        setHighlightDispatchId(owner.deployment_detail_id)
        setPlotExpanded(ownerPlot.deployment_id, true)
        setLocated({ deploymentId: ownerPlot.deployment_id, mapPlotId: plot.id })
        revealRef.current = { selector: `[data-plot-card="${ownerPlot.deployment_id}"]`, block: "center", context: `[data-dispatch-row="${owner.deployment_detail_id}"]`, seq, dispatchId: owner.deployment_detail_id, plotId: ownerPlot.deployment_id }
    }
    const toggleReportId = (id: string) =>
        setReportedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

    // Approve — one dispatch at a time; the account, Matic's NOC gates and the boundary gate first, then the confirmation dialog.
    const handleApproveClick = (dispatch: TrailerDispatchItem) => {
        const entry = entryOfDispatch(dispatch)
        const view = viewById(dispatch.deployment_detail_id)
        if (!entry || !view || !canActOn(entry.row) || !offersApprove(view, entry.type)) return
        const blocker = approveBlockerFor(entry)(dispatch)
        if (blocker) {
            showToast("Cannot approve", blocker, "error")
            return
        }
        setApproveDispatchId(dispatch.deployment_detail_id)
        setApproveDialogOpen(true)
    }
    const confirmApproveUnguarded = async () => {
        if (!approveDispatch || !approveEntry?.type.actions || !canOfferApprove || !verifierPhone) return
        // Re-checked on the dispatch as currently loaded (not on what the dialog opened with): NOC and every plot's saved boundary.
        const blocker = approveBlockerFor(approveEntry)(approveDispatch)
        if (blocker) {
            setApproveDialogOpen(false)
            showToast("Cannot approve", blocker, "error")
            return
        }
        setIsApprovingDispatch(true)
        const result = await deploymentApi.updateDeploymentTrailerDispatch(approveEntry.type.actions.approveRequest(approveEntry.row, approveDispatch, verifierPhone))
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setIsApprovingDispatch(false)
        setApproveDialogOpen(false)
        if ("error" in result) {
            showToast("Approval failed", result.error, "error")
        } else if (result.status === 200) {
            showToast("Approved Successfully", "Deployment trailer dispatch data updated successfully!", "success")
            afterMutation(approveEntry.rowKey)
        } else {
            showToast("Approval failed", "Failed to update deployment trailer dispatch data!", "error")
        }
    }

    // Report — the selected fields become one reportFarmerDetails call, then the dispatches are rejected (the type's builders).
    const reportSubmitUnguarded = async () => {
        if (!reportEntry?.type.actions || !reportComment.trim() || !canOfferReport || !verifierPhone || reportEntry.allApproved) return
        const comment = reportComment.trim()
        const selections = toReportSelections(reportedIds, trailers)
        const { report, dispatchUpdate } = reportEntry.type.actions.reportRequests(reportEntry.row, selections, comment, verifierPhone)
        // V2.1: a selection that resolves to nothing never sends an empty report (post-migration audit P5)
        if (report.reportData.length === 0 || dispatchUpdate.deployment_trailer_dispatch_data.length === 0) {
            setReportError({ message: "The selected values couldn't be matched to this dispatch. Close the report and select them again.", details: null })
            return
        }
        setReportError(null)
        setIsSubmittingReport(true)
        // Two calls, no rollback (as in matic-dash). If the report is saved but the dispatch update fails, say exactly
        // that — nothing is retried automatically — and reload the authoritative state.
        let failure: string | null = null
        let failureError: unknown = null
        let reportSaved = false
        try {
            const reported = await deploymentApi.reportFarmerDetails(report)
            if (reported.status !== 200) failure = "Failed to report farmer data!"
            else {
                reportSaved = true
                const updated = await deploymentApi.updateDeploymentTrailerDispatch(dispatchUpdate)
                if (updated.status !== 200) failure = "Failed to update deployment trailer dispatch data!"
            }
        } catch (error) {
            failure = errorMessage(error)
            failureError = error
        }
        setIsSubmittingReport(false)
        if (failure && reportSaved) {
            setIsReportingFinalStep(false)
            exitReportMode()
            showToast("Report partly saved", `The reported fields were saved, but the dispatch status was not updated: ${failure}`, "error")
            afterMutation(reportEntry.rowKey)
            return
        }
        if (failure) {
            // V2.1: the dialog stays open with the server's complete reason (audit P4); nothing is marked reported
            setReportError(reportFailure(failure, failureError))
            return
        }
        const at = Date.now()
        setLocalReports((prev) => {
            const next = { ...prev }
            for (const selection of selections) next[selection.dispatch.deployment_detail_id] = { comment, at }
            return next
        })
        setReportSuccess(true)
        const rowKey = reportEntry.rowKey
        setTimeout(() => {
            setReportSuccess(false)
            setIsReportingFinalStep(false)
            exitReportMode()
            afterMutation(rowKey)
            showToast("Reported Successfully", "Reported farmer data successfully!", "success")
        }, 1500)
    }

    // NOC — farmer-level in the UI (requirement 4), as Deployment V2's header icon. The API scopes a NOC document to a
    // deployment + AZ (one getDeploymentNocDetails per row); the farmer's documents are reviewed DIRECTLY in the existing
    // media preview (V2's Report / Approve footer): opening the NOC shows a document at once — the first still waiting
    // for review — with Previous / Next over every document (waiting first, then approved) and the position ("1 / 3").
    // Each document is labelled with its AZ (and its deployment's submission date when the AZ recurs) and decided on its
    // own: a decision is sent for the document's own row (farmer_id, deployment_num, az_id) — distinct documents are
    // never merged. The header icon, the readiness strip under the summary bar and a card's "Review NOC" all open it;
    // while nothing can be shown the same dialog says why (loading / a failed read with Retry / no document).
    const azLabelOf = (entry: RowEntry) => entry.row.az_code || `AZ ${entry.row.az_id}`
    /** "submitted 12 Mar 2025" — how a deployment is told apart from another of the same AZ (never a round number). */
    const submittedLabel = (entry: RowEntry) => {
        const ms = parseEpochMs(entry.row.created_at)
        return ms === null ? null : `submitted ${format(new Date(ms), "dd MMM yyyy")}`
    }
    const azRecurs = (entry: RowEntry) => rowEntries.filter((e) => e.row.az_id === entry.row.az_id).length > 1
    /** A deployment as named in NOC / history labels: its AZ, with its submission date when the AZ recurs. */
    const rowLabelOf = (entry: RowEntry) => `${azLabelOf(entry)}${azRecurs(entry) && submittedLabel(entry) ? ` (${submittedLabel(entry)})` : ""}`
    /** The farmer's NOC documents in row order, keyed by row + AZ. */
    // Keyed by row + AZ + POSITION in the row's NOC list: a deployment may have several NOC photos for one AZ (the read
    // returns each), and a row + AZ key alone made them collide — Previous / Next resolved every photo to the first.
    const nocDocs = rowEntries.flatMap((entry) => nocOf(entry).summary.docs.map((doc, i) => ({ key: `${entry.rowKey}:${doc.az_id}:${i}`, entry, doc })))
    type NocDocItem = (typeof nocDocs)[number]
    const nocUnavailable = rowEntries.filter((e) => !!e.detail?.nocError)
    const nocLoading = rowEntries.some((e) => nocOf(e).readiness === "loading")
    /** Rows whose NOC read returned no document (not loading, not failed). */
    const nocMissing = rowEntries.filter((e) => nocOf(e).readiness === "missing")
    /** A document's label: its deployment (AZ, submission date when the AZ recurs), and "photo i of n" when it has several. */
    const nocDocLabel = (d: NocDocItem) => {
        const photos = nocDocs.filter((x) => x.entry.rowKey === d.entry.rowKey && x.doc.az_id === d.doc.az_id)
        return photos.length > 1 ? `${rowLabelOf(d.entry)} · photo ${photos.findIndex((x) => x.key === d.key) + 1} of ${photos.length}` : rowLabelOf(d.entry)
    }
    const nocUndecided = nocDocs.filter((d) => d.doc.franchise_status !== "approved")
    const nocApproved = nocDocs.filter((d) => d.doc.franchise_status === "approved")
    /** The review order: documents still waiting for review first, then the approved ones (each in row order). */
    const nocOrdered = [...nocUndecided, ...nocApproved]
    const nocState: HeaderNocAction["state"] = nocUnavailable.length > 0 ? "unavailable"
        : nocDocs.length === 0 ? (nocLoading ? "loading" : "none")
        : nocUndecided.length === 0 ? "approved" : "pending"
    const nocLabel = nocState === "loading" ? "NOC — loading…"
        : nocDocs.length === 0
            ? (nocState === "unavailable" ? `NOC — couldn't be loaded for ${nocUnavailable.map(azLabelOf).join(", ")}` : "NOC — no NOC found for this farmer's deployments")
            : `NOC — ${nocDocs.map((d) => `${nocDocLabel(d)}: ${d.doc.franchise_status}`).join(", ")}${nocUnavailable.length > 0 ? `; couldn't be loaded for ${nocUnavailable.map(azLabelOf).join(", ")}` : ""}`
    /** The document carries an image link (the API may send noc null / absent; the live normalizer makes that ""). */
    const nocHasImage = (item: NocDocItem) => typeof item.doc.noc === "string" && item.doc.noc.trim() !== ""
    /** The document as the media preview / thumbnail shows it. */
    const nocPreviewItem = (item: NocDocItem): SurveyItem => ({ id: `noc-${item.key}`, question: `NOC — ${nocDocLabel(item)}`, label: `NOC — ${azLabelOf(item.entry)}`, type: "image", answer: item.doc.noc })
    /** Shows one document in the review (by key). */
    const openNocAt = (key: string) => {
        if (nocDocs.some((d) => d.key === key)) setNocView(key)
    }
    /**
     * Opens the NOC review directly on a document: an undecided document of `preferRowKey`'s row (a card's "Review NOC")
     * first, else the first undecided, else that row's / the first document. With nothing to show yet (still loading, a
     * failed read, no document) the dialog opens on that state and shows the first document as soon as one arrives (the
     * shown document is derived below, so no extra step is needed).
     */
    const openNoc = (preferRowKey?: string) => {
        setNocPreferRowKey(preferRowKey ?? null)
        setNocView(null)
        setNocReviewOpen(true)
    }
    /** Closes the preview (and the NOC review with it). */
    const closePreview = () => {
        setPreviewItem(null)
        setNocReviewOpen(false)
        setNocView(null)
    }
    /**
     * The NOC document the review shows, with its position in the review order: the chosen one (nocView), else the
     * default pick — an undecided document of the row the review was opened for, else the first undecided, else that
     * row's / the first document. Null while the review is closed or has no document yet.
     */
    const activeNoc = (() => {
        if (!nocReviewOpen || nocOrdered.length === 0) return null
        const isUndecided = (d: NocDocItem) => d.doc.franchise_status !== "approved"
        const own = nocPreferRowKey ? nocOrdered.filter((d) => d.entry.rowKey === nocPreferRowKey) : []
        const chosen = nocView ? nocOrdered.find((d) => d.key === nocView) : undefined
        const pick = chosen ?? own.find(isUndecided) ?? nocOrdered.find(isUndecided) ?? own[0] ?? nocOrdered[0]
        const index = nocOrdered.findIndex((d) => d.key === pick.key)
        return { ...pick, index }
    })()
    /** What the review dialog shows when open: a document, or why none can be shown yet. */
    const nocReviewState: "document" | "loading" | "error" | "empty" = nocOrdered.length > 0 ? "document" : nocUnavailable.length > 0 ? "error" : nocLoading ? "loading" : "empty"
    /** A document may be decided here: the verifier may act on its row, the row isn't Verified, the document isn't approved. */
    const canDecideNocDoc = (item: NocDocItem) => canActOn(item.entry.row) && !item.entry.allApproved && item.doc.franchise_status !== "approved"
    const canDecideNoc = !!activeNoc && canDecideNocDoc(activeNoc)
    /** One document's decision (matic-dash handleQulifyNoc / handleReportNoc), for that document's row and AZ only. */
    const decideNocUnguarded = async (item: NocDocItem, decision: "approved" | "rejected") => {
        if (!canDecideNocDoc(item) || !verifierPhone || submittingNocKey !== null) return
        const { entry, doc } = item
        setSubmittingNocKey(item.key)
        const result = await deploymentApi.updateFarmerDeploymentNOC(buildNocDecisionRequest(entry.row, doc.az_id, decision, verifierPhone))
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setSubmittingNocKey(null)
        if ("error" in result) {
            showToast("NOC update failed", result.error, "error")
        } else if (result.status === 200) {
            showToast(decision === "approved" ? "Noc qualified successfully" : "Noc reported successfully", `NOC for ${nocDocLabel(item)} ${decision}.`, "success")
            // Stay in the review: move on to the next document still waiting (if any), else keep this one in view (its
            // status updates when the row is re-read). The index follows the key, so the reorder after a decision is safe.
            // The decision covers every photo of this deployment + AZ (the API names no single photo), so the next document
            // to review is one of ANOTHER deployment / AZ.
            const next = nocUndecided.find((d) => !(d.entry.rowKey === item.entry.rowKey && d.doc.az_id === item.doc.az_id))
            if (next && activeNoc?.key === item.key) openNocAt(next.key)
            else if (activeNoc?.key === item.key) setNocView(item.key)
            afterMutation(entry.rowKey)
        } else {
            showToast("NOC update failed", decision === "approved" ? "Failed to qualify Noc" : "Failed to report Noc", "error")
        }
    }
    const handleNocDecision = (decision: "approved" | "rejected") => { if (activeNoc) void decideNoc(activeNoc, decision) }
    const headerNoc: HeaderNocAction = { label: nocLabel, state: nocState, onOpen: () => openNoc(focusEntry?.rowKey) }
    /**
     * The farmer's NOC readiness (V2's strip, at farmer scope): one concise line — counts and the DISTINCT AZ codes, never
     * a label per deployment (deployments of one AZ submitted the same day have identical labels) — and what it means for
     * Approve, plus the one action. A missing NOC can't be reported: no API operation reports a NOC that doesn't exist
     * (docs/deployment/deployment-v2-1-follow-up-fixes-report.md §3), so no such action is offered. The approval gate
     * itself (approveBlockersFor) is unchanged.
     */
    const farmerNoc = ((): { readiness: NocReadiness; text: string; action?: { label: string; onClick: () => void }; undecided: number; approved: number; missing: number } => {
        const nocs = (count: number) => (count === 1 ? "NOC" : "NOCs")
        const deployments = (count: number) => `${count} deployment${count === 1 ? "" : "s"}`
        /** The distinct AZ codes, in order ("AZ1, AZ2"). */
        const azs = (entries: RowEntry[]) => [...new Set(entries.map(azLabelOf))].join(", ")
        const open = (label: string) => ({ label, onClick: () => openNoc(focusEntry?.rowKey) })
        const counts = { undecided: nocUndecided.length, approved: nocApproved.length, missing: nocMissing.length }
        const blocked = "Approval is blocked until the required NOCs are approved."
        const missingClause = nocMissing.length > 0 ? `NOC missing for ${deployments(nocMissing.length)} (${azs(nocMissing)}). ` : ""
        if (nocUnavailable.length > 0) {
            const text = `NOC details couldn't be loaded for ${deployments(nocUnavailable.length)} (${azs(nocUnavailable)}). Approval is blocked until they load.`
            return { readiness: "unavailable", text, action: { label: "Retry", onClick: () => nocUnavailable.forEach((e) => detail.reloadRow(e.rowKey)) }, ...counts }
        }
        if (nocUndecided.length > 0) {
            const count = nocUndecided.length
            const rejected = nocUndecided.some((d) => d.doc.franchise_status === "rejected")
            const docAzs = azs(nocUndecided.map((d) => d.entry))
            const text = `${count} ${nocs(count)} ${rejected ? "reported or waiting for review" : "waiting for review"} (${docAzs}). ${missingClause}${blocked}`
            return { readiness: rejected ? "rejected" : "pending", text, action: open(`Review ${nocs(count)}`), ...counts }
        }
        if (nocMissing.length > 0) {
            // Nothing to review when no document exists at all; the approved ones (other deployments) can still be viewed.
            return { readiness: "missing", text: `${missingClause}${blocked}`, action: nocDocs.length > 0 ? open(`View ${nocs(nocDocs.length)}`) : undefined, ...counts }
        }
        if (nocLoading) return { readiness: "loading", text: "Checking NOC…", ...counts }
        return { readiness: "approved", text: `NOC approved for ${deployments(nocApproved.length)} (${azs(nocApproved.map((d) => d.entry))}).`, action: open(`View ${nocs(nocApproved.length)}`), ...counts }
    })()

    // Pre-Sample — farmer-level in the UI (requirement 4; AZ 1–3 deployments only, audit P2). The API returns the
    // pre-sampling summary per deployment (farmer + deployment_num); when the farmer's deployments disagree the header says
    // so instead of merging them. Navigation follows matic-dash (approved sampling → /samples/pre, else verification),
    // decided by the deployment opened from (the selected dispatch's, else the first pre-sampling deployment).
    const preSampleEntries = rowEntries.filter((e) => e.type.preSample)
    const openPreSample = () => {
        const entry = (focusEntry?.type.preSample ? focusEntry : undefined) ?? preSampleEntries[0]
        if (!entry) return
        navigate(nocOf(entry).summary.samplingStatus === "approved" ? `/samples/pre/${entry.row.farmer_id}` : `/samples/verification/pre/${entry.row.farmer_id}`)
    }
    const headerPreSample: HeaderPreSampleAction | undefined = preSampleEntries.length === 0 ? undefined : (() => {
        const byDeployment = new Map<number, ReturnType<typeof nocOf>["summary"]>()
        for (const e of preSampleEntries) if (e.detail?.noc && !byDeployment.has(e.row.deployment_num)) byDeployment.set(e.row.deployment_num, nocOf(e).summary)
        const values = [...byDeployment.values()]
        const describe = (v: (typeof values)[number]) => `${v.samplingCount} sample code${v.samplingCount === 1 ? "" : "s"}${v.samplingStatus ? ` (${v.samplingStatus})` : ""}`
        const agree = values.length > 0 && values.every((v) => v.samplingCount === values[0].samplingCount && v.samplingStatus === values[0].samplingStatus)
        const label = values.length === 0 ? "Pre-Sample — loading…" : agree ? `Pre-Sample — ${describe(values[0])}` : `Pre-Sample — differs by deployment: ${values.map(describe).join(" / ")}`
        return { label, count: agree ? values[0].samplingCount : null, onOpen: openPreSample }
    })()

    // Report history — its own dialog (independent of any other panel), for every status; one row's AZ.
    // No history (the API's 404) reads as an empty list; a real failure stays in the dialog with Retry.
    /** Report history of a row: of one dispatch when opened from it (its deployment_detail_id), else of the whole row. */
    const openHistory = async (rowKey: string, deploymentDetailId?: string) => {
        const entry = entryByKey(rowKey)
        if (!entry) return
        setHistoryScope({ rowKey, dispatchId: deploymentDetailId ?? null })
        setHistoryItems(null)
        setHistoryError(null)
        setHistoryOpen(true)
        try {
            const response = await deploymentApi.getFarmerReportedHistory(buildReportHistoryRequest(entry.row))
            setHistoryItems(response.reported_farmer_details_result)
        } catch (error) {
            setHistoryError(errorMessage(error))
        }
    }

    // Delete — soft delete of a whole dispatch or one plot deployment (matic-dash handleDeleteSubmit), as the type allows.
    const deleteAllowed = (target: DeleteTarget) => {
        const entry = entryOfDispatch(target.dispatch)
        if (!entry) return false
        // Only the dispatches of the row's own verification read can be deleted (as before the All view).
        const inScope = viewById(target.dispatch.deployment_detail_id)?.inVerificationScope ?? false
        return inScope && canDeleteOn(entry, target.mode === "Dispatch" ? "dispatch" : "plot")
    }
    const openDelete = (target: DeleteTarget) => {
        if (!deleteAllowed(target)) return
        setDeleteComment("")
        setDeleteError(false)
        setDeleteTarget(target)
    }
    const closeDelete = () => {
        setDeleteTarget(null)
        setDeleteComment("")
        setDeleteError(false)
    }
    const deleteSubmitUnguarded = async () => {
        if (!deleteTarget) return
        if (!deleteAllowed(deleteTarget)) {
            showToast("Delete failed", "You are not authorized for this action", "error")
            return
        }
        if (!deleteComment.trim()) {
            setDeleteError(true)
            return
        }
        const target = deleteTarget
        const rowKey = entryOfDispatch(target.dispatch)?.rowKey
        const request = target.mode === "Dispatch"
            ? buildDeleteDispatchRequest(target.dispatch, deleteComment)
            : buildDeleteDeploymentRequest(target.plot, deleteComment)
        setIsDeleting(true)
        const result = await deploymentApi.softDeleteDispatch(request)
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setIsDeleting(false)
        if ("error" in result) {
            showToast("Delete failed", result.error, "error")
        } else if (result.status === 200) {
            closeDelete()
            // Nothing may stay pointed at what no longer exists.
            if (reportDispatchId === target.dispatch.deployment_detail_id) exitReportMode()
            if (commentTarget && (target.mode === "Dispatch" ? commentTarget.dispatchId === target.dispatch.deployment_detail_id : commentTarget.deploymentId === target.plot.deployment_id)) closeComment()
            showToast(
                target.mode === "Dispatch" ? "Dispatch deleted successfully" : "Deployment deleted successfully",
                `${target.mode === "Dispatch" ? dispatchLabel(target.dispatch) : plotLabel(target.plot)} was deleted.`,
                "success"
            )
            afterMutation(rowKey)
        } else {
            showToast("Delete failed", "Failed to delete deployment trailer!", "error")
        }
    }

    // Plot comment — the single plot.comment field, from the plot card's comment dialog.
    const savePlotCommentUnguarded = async () => {
        if (!commentDispatch || !commentPlot || !plotCommentDraft?.trim() || !commentEditable) return
        setIsSavingPlotComment(true)
        const result = await deploymentApi.updateComment(buildCommentRequest(commentPlot, commentDispatch, plotCommentDraft.trim()))
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setIsSavingPlotComment(false)
        if ("error" in result) {
            showToast("Comment failed", result.error, "error")
        } else if (result.status === 200) {
            const saved = commentPlot
            closeComment()
            afterMutation(commentEntry?.rowKey)
            showToast("Comment saved", `Comment ${saved.comment ? "updated" : "added"} for ${saved.plot_id}.`, "success")
        } else {
            showToast("Comment failed", "Something went wrong, failed to update comment on deployment!!", "error")
        }
    }

    /** Dispatches the current report selection would mark for correction (every plot of each goes back). */
    const reportedDispatches = [...new Map(toReportSelections(reportedIds, trailers).map((s) => [s.dispatch.deployment_detail_id, s.dispatch])).values()]
    const reportsPlotField = reportedIds.some((id) => !id.startsWith("source_name:"))
    /** The deployment marked in the list: the one located from its row, else (live) the map's selected plot. */
    const locatedPlotId: number | null = !selectedPlot ? null
        : located && located.mapPlotId === String(selectedPlot.id) ? located.deploymentId
        : /^\d+$/.test(String(selectedPlot.id)) ? Number(selectedPlot.id) : null
    const historyEntry = entryByKey(historyScope?.rowKey)
    const historyRows = historyItems ? toReportHistoryRows(historyScope?.dispatchId ? historyForDispatch(historyItems, historyScope.dispatchId) : historyItems, trailers) : []
    const historyDispatch = historyScope?.dispatchId ? dispatchById(historyScope.dispatchId) : null

    const resetMapToFarmer = () => {
        setCameraFocus(null);
        setHighlightDispatchId(null);
        newSelection();
        if (mapRef.current) {
            isProgrammaticChange.current = true;
        }
        setMapCenter(null);
        setMapZoom(17);
        setIsShowingSpecificLocation(false);
        setIsMapInteracted(false);
        setSelectedPlot(null);
        setHoveredPlotId(null);
        setLocated(null);
        setResetCount(prev => prev + 1);
    }

    /**
     * V2: the deployment behind the selected map plot — live: the map plot's id is the deployment_id; mock: the
     * deployment card the verifier focused when it sits on this demo plot, else the dispatch plot linked to it.
     */
    const selectedMapPlot = (selectedPlot as MapPlot | null) ?? null
    const deploymentOf = (mapPlot: MapPlot | null): SelectedDeployment | null => {
        if (!mapPlot) return null
        const id = located && located.mapPlotId === mapPlot.id ? located.deploymentId : mapPlot.deploymentId ?? (/^\d+$/.test(mapPlot.id) ? Number(mapPlot.id) : null)
        if (id === null) return null
        const dispatch = dispatchOfPlot.get(id)
        const plot = dispatch?.deployment_plots_data.find((p) => p.deployment_id === id)
        return dispatch && plot ? { dispatch, plot, view: viewById(dispatch.deployment_detail_id) } : null
    }
    const selectedDeployment = deploymentOf(selectedMapPlot)
    const selectedDeploymentType = selectedDeployment ? typeOf(selectedDeployment.dispatch) : focusType
    /** Boundary editing: the row's edit permission (as for report / approve / comments), per deployment. */
    const canEditBoundaryOf = (deployment: SelectedDeployment | null) => {
        const entry = deployment ? entryOfDispatch(deployment.dispatch) : undefined
        return !!entry && canActOn(entry.row)
    }
    const canEditBoundary = canEditBoundaryOf(selectedDeployment)
    const openBoundaryEditor = () => {
        if (!canEditBoundary || !selectedMapPlot || !selectedDeployment) return
        newSelection() // the editor takes over: the map's bounce stops (the selection itself stays behind the editor)
        setBoundaryTarget({ mapPlot: selectedMapPlot, deployment: selectedDeployment })
    }
    /**
     * The same editor from a dispatch card's boundary warning: on the dispatch's first plot without a valid saved boundary
     * (else its first plot) that has a place on the map — the editor draws on its map plot. Null when none of the
     * dispatch's plots is on the map (or editing isn't allowed): the warning then offers no editor link.
     */
    const boundaryEditorOpenerFor = (dispatch: TrailerDispatchItem): (() => void) | undefined => {
        const gate = dispatchBoundaryGate(dispatch, plotLabel)
        for (const plot of [...gate.missing, ...gate.invalid.map((c) => c.plot), ...dispatch.deployment_plots_data]) {
            const mapPlot = (farmerData.plots as MapPlot[]).find((mp) => deploymentOf(mp)?.plot.deployment_id === plot.deployment_id)
            const deployment = mapPlot ? deploymentOf(mapPlot) : null
            if (mapPlot && deployment && canEditBoundaryOf(deployment)) {
                return () => {
                    newSelection()
                    setBoundaryTarget({ mapPlot, deployment })
                }
            }
        }
        return undefined
    }
    /**
     * V2.1 (backlog D): the plots one boundary session can edit — every map plot that resolves to a plot deployment the
     * verifier may edit (the one the editor opened on first), with the deployment each saves to.
     */
    const boundaryPlots: (EditablePlot & { deployment: SelectedDeployment })[] = boundaryTarget
        ? (farmerData.plots as MapPlot[]).flatMap((mapPlot) => {
            const deployment = mapPlot.id === boundaryTarget.mapPlot.id ? boundaryTarget.deployment : deploymentOf(mapPlot)
            if (!deployment || !canEditBoundaryOf(deployment)) return []
            const subtitle = [dispatchLabel(deployment.dispatch), typeOf(deployment.dispatch).dispatchSource(deployment.dispatch), deployment.plot.plot_id ? `Plot ${deployment.plot.plot_id}` : null].filter(Boolean).join(" · ")
            return [{ mapPlot, deployment, title: plotLabel(deployment.plot), subtitle, plotId: deployment.plot.plot_id || undefined }]
        })
        : []
    /**
     * The deployments one outline of a Save all goes to (data/boundary-coverage.ts) — the same rule for the editor's
     * notice before saving and for the save: the edited plot, then every other deployment of the same farmer and round
     * inside it (an existing boundary replaced, as on the production page), except a plot that Save all saves with its
     * own outline and one an earlier outline of it already covered.
     */
    const coverageFor = (plotId: string, path: google.maps.LatLngLiteral[], sessionPlotIds: string[], alreadyCovered: ReadonlySet<number>) => {
        const entry = boundaryPlots.find((p) => p.mapPlot.id === plotId)
        if (!entry) return null
        const roundOf = (dispatch: TrailerDispatchItem) => entryOfDispatch(dispatch)?.row.deployment_num ?? null
        const exclude = new Set<number>(alreadyCovered)
        for (const id of sessionPlotIds) {
            const own = boundaryPlots.find((p) => p.mapPlot.id === id)?.deployment.plot.deployment_id
            if (own !== undefined) exclude.add(own)
        }
        const candidates = trailers.flatMap((dispatch) => dispatch.deployment_plots_data.map((plot) => ({
            plot, dispatch, round: roundOf(dispatch), editable: canEditBoundaryOf({ dispatch, plot, view: null }),
        })))
        return { entry, coverage: boundaryCoverage({ plot: entry.deployment.plot, dispatch: entry.deployment.dispatch, round: roundOf(entry.deployment.dispatch) }, path, candidates, exclude) }
    }
    /** The editor's notice before Save all: per outline (in save order), the deployments it also goes to. */
    const previewBoundarySave = (queue: { plotId: string; path: google.maps.LatLngLiteral[] }[]) => {
        const covered = new Set<number>()
        const out: Record<string, { title: string; replaces: boolean }[]> = {}
        for (const q of queue) {
            const r = coverageFor(q.plotId, q.path, queue.map((x) => x.plotId), covered)
            if (!r) continue
            out[q.plotId] = r.coverage.covered.map((c) => ({ title: plotLabel(c.plot), replaces: c.replaces }))
            for (const c of r.coverage.covered) covered.add(c.plot.deployment_id)
        }
        return out
    }
    /**
     * Saves ONE plot's outline (matic-dash uploadGeoJson) and — as the production Deployment page does — every other
     * deployment of the same farmer and round inside it, in ONE request, each entry with its own identifiers. Rejects
     * with a message so the editor keeps that plot's edits. The saved outline shows at once; the approval gate counts it
     * once the detail is read again (finishBoundarySave reloads every row of the farmer, so every AZ).
     */
    const saveBoundaryPlot = async (plotId: string, path: google.maps.LatLngLiteral[], areaSquareMeters: number, session: { plotIds: string[]; include: string[] }) => {
        const found = coverageFor(plotId, path, session.plotIds, coverageRef.current.covered)
        if (!found || !canEditBoundaryOf(found.entry.deployment)) throw new Error("Editing plot boundaries isn't allowed for this account.")
        const { coverage } = found
        const request = buildUploadGeoJsonEntriesRequest(coverage.entries, path, areaSquareMeters)
        const several = request.geoJsonData.length > 1
        const failure = (message: string) => {
            if (!several) return new Error(message)
            coverageRef.current.uncertain = true
            return new Error(`${message} This save covered ${request.geoJsonData.length} deployments; whether any of them were updated isn't confirmed — the detail is read again to show what was saved.`)
        }
        const result = await deploymentApi.uploadGeoJson(request).catch((error: unknown) => { throw failure(errorMessage(error)) })
        if (result.status !== 200) throw failure(`The server answered HTTP ${result.status}.`)
        for (const c of coverage.covered) coverageRef.current.covered.add(c.plot.deployment_id)
        coverageRef.current.byPlot.set(plotId, coverage.covered.map((c) => `${plotLabel(c.plot)}${c.replaces ? " (outline replaced)" : ""}`))
        // the editor's plots this outline was also saved to (they show it at once; the re-read confirms)
        const coveredIds = new Set(coverage.covered.map((c) => c.plot.deployment_id))
        const coveredPlotIds = boundaryPlots.filter((p) => coveredIds.has(p.deployment.plot.deployment_id)).map((p) => p.mapPlot.id)
        const withOutline = new Set([plotId, ...coveredPlotIds])
        setLocalFarmerPlots((prev) => prev && { ...prev, plots: prev.plots.map((p) => (withOutline.has(p.id) ? { ...p, path } : p)) })
        setSelectedPlot((p: MapPlot | null) => (p && withOutline.has(p.id) ? { ...p, path } : p))
        return { coveredPlotIds }
    }
    /**
     * After each Save all: re-read the farmer (every row, so every AZ) once anything saved — or once a save covering
     * several deployments failed (its outcome isn't confirmed); close only when nothing failed (failed plots stay
     * editable). The toast names what each outline also covered.
     */
    const finishBoundarySave = ({ saved, failed }: SaveAllResult) => {
        const { byPlot, uncertain } = coverageRef.current
        if (saved.length > 0 || uncertain) afterMutation(boundaryTarget ? entryOfDispatch(boundaryTarget.deployment.dispatch)?.rowKey : undefined)
        const alsoCovered = saved.flatMap((id) => byPlot.get(id) ?? [])
        coverageRef.current = { covered: new Set(), byPlot: new Map(), uncertain: false }
        if (failed.length > 0) return
        setBoundaryTarget(null)
        const names = saved.map((id) => boundaryPlots.find((p) => p.mapPlot.id === id)?.title ?? id)
        showToast(saved.length === 1 ? "Boundary saved" : `${saved.length} boundaries saved`, `${names.join(", ")}${alsoCovered.length > 0 ? ` · also covers ${alsoCovered.join(", ")} (inside the outline)` : ""}`, "success")
    }
    const plotCard = selectedMapPlot ? (
        <PlotMapCard
            key={selectedMapPlot.id}
            mapPlot={selectedMapPlot}
            deployment={selectedDeployment}
            deploymentType={selectedDeploymentType}
            color={markerSemantics.colors.colorOf(selectedDeployment ? selectedDeploymentType.dispatchSource(selectedDeployment.dispatch) : selectedMapPlot.source)}
            correctionFields={selectedDeployment?.view?.view === "need_correction" ? selectedDeployment.view.correctionFields : new Set<string>()}
            onClose={() => selectPlotFromMap(null)}
            onEditBoundary={canEditBoundary && selectedDeployment ? openBoundaryEditor : undefined}
        />
    ) : null

    /** The map's highlight: the selected dispatch's plots; the markers bouncing now. */
    const highlightIds: ReadonlySet<string> = new Set(dispatchMapPlotIds(dispatchById(highlightDispatchId)))
    const bouncingIds: ReadonlySet<string> = new Set(bounce?.ids ?? [])

    const handleCloseAll = () => {
        setPreviewItem(null)
        onOpenChange(false)
    }

    /** The expanded dispatch's actions for one row: its gates and the handlers above. */
    // The mutation handlers, each guarded against a second activation while it is in flight (runOnce above).
    const handleConfirmApprove = () => runOnce("approve", confirmApproveUnguarded)
    const handleReportSubmit = () => runOnce("report", reportSubmitUnguarded)
    const decideNoc = (item: NocDocItem, decision: "approved" | "rejected") => runOnce("noc", () => decideNocUnguarded(item, decision))
    const handleDeleteSubmit = () => runOnce("delete", deleteSubmitUnguarded)
    const savePlotComment = () => runOnce("comment", savePlotCommentUnguarded)

    const workFor = (e: RowEntry): DispatchWork => ({
        canMutate: canActOn(e.row),
        approveBlockersFor: approveBlockersFor(e),
        editBoundariesFor: canActOn(e.row) ? boundaryEditorOpenerFor : undefined,
        onReviewNoc: canActOn(e.row) && nocOf(e).summary.docs.length > 0 && !nocOf(e).error ? () => openNoc(e.rowKey) : undefined,
        reportDispatchId,
        reportedIds,
        onStartReport: startReport,
        onCancelReport: exitReportMode,
        onToggleReportField: toggleReportId,
        onFinalizeReport: () => setIsReportingFinalStep(true),
        onApprove: handleApproveClick,
        onComment: openComment,
        onDeletePlot: canDeleteOn(e, "plot") ? (dispatch, plot) => openDelete({ mode: "Deployment", dispatch, plot }) : undefined,
        onPreview: handleItemClick,
        onLocatePlot: locatePlot,
    })

    /** What the header's details bar says about the farmer's deployments (no round / deployment number anywhere in the UI). */
    const azLabels = [...new Set(rowEntries.map((e) => e.row.az_code || `AZ ${e.row.az_id}`))]
    const listedCount = (views: ClassifiedDispatch[]) => views.filter((v) => inDetailFilter(v, detailFilter)).length
    const failedRows = rowEntries.filter((e) => !!e.detail?.dispatchesError).length
    const showLoadingScreen = isDataLoading || (rowEntries.length === 0 && (detail.loading || detail.rowsLoading))
    /** The row's report-history read, for its cards' clocks (requirement 5). */
    const historyStateOf = (e: RowEntry): HistoryReadState => (e.detail?.historyFailed ? "failed" : !e.detail || e.detail.history === null ? "loading" : "ready")
    /**
     * AZ sections (requirement 3, the Samples pattern): the farmer's deployments grouped by AZ (the API's az_id on the
     * row and on every dispatch), in AZ order; a deployment's dispatches stay under its AZ, never merged across deployments.
     */
    const azSections = (() => {
        const map = new Map<number, { azId: number; code: string; name: string; entries: RowEntry[] }>()
        for (const e of rowEntries) {
            const section = map.get(e.row.az_id) ?? { azId: e.row.az_id, code: e.row.az_code || `AZ ${e.row.az_id}`, name: e.row.az_name ?? "", entries: [] }
            section.entries.push(e)
            map.set(e.row.az_id, section)
        }
        return [...map.values()].sort((a, b) => a.azId - b.azId).map((section) => {
            const views = section.entries.flatMap((e) => classified.get(e.rowKey)?.views ?? [])
            return { ...section, total: views.length, shown: listedCount(views) }
        })
    })()

    const renderPreviewContent = (item: SurveyItem) => {
        switch (item.type) {
            case "image":
                // V2: decoded file name; no size (the API sends none, so none is shown).
                const imgFileName = mediaFileName(item.answer as string, "image");
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-50 p-2 rounded-lg">
                                    <ImageIcon className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{imgFileName}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">{item.question}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Zoom Controls */}
                                <div className="flex items-center gap-1 mr-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-zinc-700"
                                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                                        title="Zoom Out"
                                        aria-label="Zoom out"
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="text-[10px] font-bold w-8 text-center">{Math.round(zoom * 100)}%</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-zinc-700"
                                        onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                                        title="Zoom In"
                                        aria-label="Zoom in"
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* Rotation */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full"
                                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                                    title="Rotate 90°"
                                    aria-label="Rotate 90°"
                                >
                                    <RotateCw className="h-4 w-4" />
                                </Button>

                                {/* V2.1: back to a predictable start — whole image, upright, centred */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    data-preview-fit
                                    className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full"
                                    onClick={() => { setZoom(1); setRotation(0); setImageMode("fit"); setFitToken((t) => t + 1) }}
                                    title="Fit to view"
                                    aria-label="Fit to view"
                                >
                                    <Scan className="h-4 w-4" />
                                </Button>

                                {/* Fit/Mode Menu */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full"
                                            title="View Modes"
                                        >
                                            <SlidersHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[140px] z-[10005]">
                                        <DropdownMenuItem onClick={() => setImageMode("fill")} className="flex items-center gap-2">
                                            <Maximize2 className="h-3.5 w-3.5" />
                                            <span>Fill</span>
                                            {imageMode === "fill" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("fit")} className="flex items-center gap-2">
                                            <Minimize2 className="h-3.5 w-3.5" />
                                            <span>Fit</span>
                                            {imageMode === "fit" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("stretch")} className="flex items-center gap-2">
                                            <Scaling className="h-3.5 w-3.5" />
                                            <span>Stretch</span>
                                            {imageMode === "stretch" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("center")} className="flex items-center gap-2">
                                            <AlignCenter className="h-3.5 w-3.5" />
                                            <span>Center</span>
                                            {imageMode === "center" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href={item.answer as string} download title="Download Image">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={closePreview}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <ImagePreview
                            key={item.answer as string}
                            item={item}
                            zoom={zoom}
                            rotation={rotation}
                            imageMode={imageMode}
                            onZoom={setZoom}
                            fitToken={fitToken}
                        />
                    </div>
                );
            case "video":
                const vidFileName = mediaFileName(item.answer as string, "video");
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-50 p-2 rounded-lg">
                                    <Play className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{vidFileName}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">{item.question}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Fit Toggle */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                                    onClick={() => setImageMode(prev => prev === "fill" ? "fit" : "fill")}
                                    title={imageMode === "fill" ? "Switch to Fit" : "Switch to Fill"}
                                >
                                    {imageMode === "fill" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>

                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href={item.answer as string} download title="Download Video">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={closePreview}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black relative">
                            {/* V2.1: V2.1's player (deployment-video-player.tsx): the same <video>, controls that fade while playing */}
                            <DeploymentVideoPlayer
                                key={item.answer as string}
                                src={item.answer as string}
                                fit={imageMode === "fill" ? "fill" : "fit"}
                                onError={() => setFailedVideoUrl(item.answer as string)}
                            />
                            {/* V2: shown when the video can't be loaded */}
                            {failedVideoUrl === item.answer && (
                                <div data-preview-state="failed" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 text-center px-6">
                                    <p className="text-sm font-semibold text-zinc-200">This video couldn&apos;t be loaded.</p>
                                    <a href={item.answer as string} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-zinc-400 underline underline-offset-2 hover:text-zinc-100">
                                        Open original link
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case "file":
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{(item.answer as { name: string }).name || "Document.pdf"}</p>
                                    {(item.answer as { size: string }).size && <p className="text-[11px] text-zinc-500 mt-1 font-medium">{(item.answer as { size: string }).size}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" target="_blank" rel="noopener noreferrer" title="Download PDF">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={closePreview}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* PDF Content */}
                        <div className="flex-1 w-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                            <iframe
                                src={`https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&embedded=true`}
                                className="w-full h-full border-none"
                                title="PDF Preview"
                            />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={(val) => {
                if (!val) {
                    handleCloseAll();
                }
            }}>
                <SheetContent
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-visible z-[200] transition-all duration-500 ease-in-out focus-visible:outline-none"
                    onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.map-preview-module')) {
                            e.preventDefault();
                        }
                    }}
                >
                {/* Header section */}
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
                    {/* V2.1: the compact header — the same content as V2 / Samples (avatar, name, location, close) at less height */}
                    <div data-detail-identity className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* V2.1: the photo keeps its proportions — cropped to the circle (object-cover, centred), never stretched;
                                    no photo, a broken one or one still loading shows the initials (Radix fallback) */}
                                <Avatar data-farmer-avatar className="h-10 w-10 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <AvatarImage src={record.farmer.avatar} alt={record.farmer.name} className="object-cover object-center" />
                                    <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{record.farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-left min-w-0">
                                    <SheetTitle className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight truncate">
                                        {record.farmer.name}
                                    </SheetTitle>
                                    <SheetDescription asChild>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500 font-medium">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                {[record.village, record.block, record.state, record.country].filter(Boolean).join(", ")}
                                            </span>
                                        </div>
                                    </SheetDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Close"
                                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    onClick={handleCloseAll}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Fixed details bar (V2's "{area} Acres . {plots} Plots | AZ"), at farmer level: deployments · dispatches | AZs */}
                    <div data-farmer-details data-farmer-rows={rowEntries.length} className="bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-zinc-800 px-6 py-2 flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        <div className="truncate">
                            {rowEntries.length === 0
                                ? (detail.rowsError ? "Deployments unavailable" : "Loading deployments…")
                                : (
                                    <>
                                        {/* V2.1: V2's "{area} Acres . {plots} Plots", for the whole farmer (unique plots, total Cal. Area; see plotTotals) */}
                                        {plotTotals ? (
                                            <>
                                                <span data-farmer-plots={plotTotals.plots}>{plotTotals.plots} {plotTotals.plots === 1 ? "Plot" : "Plots"}</span>
                                                {" . "}
                                                {plotTotals.area !== null
                                                    ? <span data-farmer-area={plotTotals.area} title={`Total Cal. Area of ${plotTotals.plots} ${plotTotals.plots === 1 ? "plot" : "plots"}, as in the table's Cal. Area column`}>{plotTotals.area} Acres</span>
                                                    : <span data-farmer-area="unknown" title={plotTotals.reasons.join("; ")} className="text-zinc-400">Area —</span>}
                                                {" . "}
                                            </>
                                        ) : (
                                            <span data-farmer-plots={dispatchFailure || detail.rowsError ? "unavailable" : "loading"} className="text-zinc-400">{dispatchFailure || detail.rowsError ? "Plots unavailable . " : "Plots … . "}</span>
                                        )}
                                        {`${rowEntries.length} ${rowEntries.length === 1 ? "Deployment" : "Deployments"} . ${trailers.length} ${trailers.length === 1 ? "Dispatch" : "Dispatches"}`}
                                    </>
                                )}
                        </div>
                        <div className="shrink-0 truncate max-w-[50%]" title={azLabels.join(", ")}>{azLabels.join(", ")}</div>
                    </div>
                    {/* The persistent map: beside the sheet (lg), or in it under the farmer's totals (below lg) */}
                    <div
                        data-map-panel
                        className={cn(
                            // V2.1: beside the sheet from 1024 px, as before (half the window, left of the panel). Below that
                            // the window has no room beside the sheet — the map hung off-screen, its controls and legend with
                            // it — so it sits in the sheet, under the farmer's name and totals, short enough to leave the
                            // dispatches room. (Absolute here resolves against the sheet: this block isn't positioned.)
                            "map-preview-module relative w-full shrink-0 border-t border-zinc-100 dark:border-zinc-800",
                            "lg:absolute lg:top-0 lg:bottom-0 lg:right-full lg:w-[50vw] lg:border-t-0 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 lg:z-[-1]",
                            "bg-white dark:bg-zinc-950 flex flex-col pointer-events-auto transition-all duration-500 ease-in-out",
                            open ? "opacity-100" : "opacity-0"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative shrink-0 h-[clamp(220px,32vh,360px)] lg:h-auto lg:flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50">
                            {/* Map Loader Overlay */}
                            <div className={cn(
                                "absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-opacity duration-300",
                                mapCovered ? "opacity-100" : "opacity-0 pointer-events-none"
                            )} data-map-cover={mapCovered ? (isMapReady ? "loading-record" : "initializing") : undefined}>
                                <div className="text-center space-y-3">
                                    <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{isMapReady ? "Loading plots…" : "Initializing Map..."}</p>
                                </div>
                            </div>

                            <div className="w-full h-full relative overflow-hidden">
                                {isLoaded ? (
                                    <>
                                        <MapPreviewContent
                                            selectedFarmer={farmerData}
                                            onIdle={onMapIdle}
                                            center={mapCenter}
                                            zoom={mapZoom}
                                            onReset={resetMapToFarmer}
                                            onInteraction={() => setIsMapInteracted(true)}
                                            resetCount={resetCount}
                                            setIsMapInteracted={setIsMapInteracted}
                                            mapRef={mapRef}
                                            isProgrammaticChange={isProgrammaticChange}
                                            farmerKey={stateKey ?? ""}
                                            geometryState={readsOk ? "ready" : dispatchFailure || detail.rowsError ? "failed" : "loading"}
                                            selectedPlot={selectedPlot}
                                            setSelectedPlot={selectPlotFromMap}
                                            hoveredPlotId={hoveredPlotId}
                                            setHoveredPlotId={setHoveredPlotId}
                                            isShowingSpecificLocation={isShowingSpecificLocation}
                                            isMapInteracted={isMapInteracted}
                                            /* V2.1: no map-level boundary button — the selected plot's card is the one entry point (backlog B) */
                                            markerFill={(plot) => markerSemantics.colors.colorOf(plot.source)}
                                            markerDiameter={(plot) => markerSemantics.scale.diameterOf(plot.amount)}
                                            focusTarget={cameraFocus}
                                            highlightIds={highlightIds}
                                            bouncingIds={bouncingIds}
                                            onFocusArrived={(target) => { if (target.bounceIds && target.owner !== undefined) bounceMarkers(target.bounceIds, target.owner, target.kind ?? "deployment") }}
                                        />

                                        <Dialog open={!!boundaryTarget} onOpenChange={() => { /* the editor decides (unsaved changes ask first) */ }}>
                                            <DialogContent
                                                data-boundary-dialog
                                                onEscapeKeyDown={(e) => e.preventDefault()}
                                                onInteractOutside={(e) => e.preventDefault()}
                                                className="fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none p-0 border-0 rounded-none bg-zinc-50 dark:bg-zinc-950 gap-0 flex flex-col z-[500] [&>button]:hidden"
                                            >
                                                <DialogTitle className="sr-only">Edit plot boundaries</DialogTitle>
                                                <DialogDescription className="sr-only">Full-screen map for editing the boundaries of this farmer&apos;s plots</DialogDescription>
                                                {boundaryTarget && (
                                                    <PlotBoundaryEditor
                                                        plots={farmerData.plots}
                                                        editable={boundaryPlots}
                                                        initialTargetId={boundaryTarget.mapPlot.id}
                                                        markerFill={(plot) => markerSemantics.colors.colorOf(plot.source)}
                                                        markerDiameter={(plot) => markerSemantics.scale.diameterOf(plot.amount)}
                                                        onCancel={() => setBoundaryTarget(null)}
                                                        onSavePlot={saveBoundaryPlot}
                                                        previewSave={previewBoundarySave}
                                                        onSaveAllDone={finishBoundarySave}
                                                    />
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-500">
                                        Loading Map...
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* V2: the ONE selected plot — top-right on the map beside the sheet; under the map in the sheet, where a
                            floating card would cover the plot on a phone-sized map */}
                        {isLoaded && plotCard}
                        {/* V2: what marker colour / size mean — bottom-left on the map beside the sheet; a strip under the map in the
                            sheet, out of the way while a plot's card is shown there */}
                        {isLoaded && <MapLegend sources={markerSemantics.colors.legend} scale={markerSemantics.scale} amountLabel={focusType.amountLabel} className={plotCard ? "max-lg:hidden" : undefined} />}
                    </div>
                    {/* V2's summary bar: "Dispatches", the local filter under it (V2.1: over every AZ of the farmer), and the
                        farmer-level NOC / Pre-Sample icons (requirement 4). Report history is on each dispatch card. */}
                    <DetailHeading
                        filter={!isDataLoading && dispatchViews.length > 0
                            ? <DetailStatusFilter value={detailFilter} counts={filterCounts} onChange={(filter) => setFilterChoice({ key: stateKey, filter })} />
                            : undefined}
                        dispatches={trailers.length}
                        deployments={rowEntries.length}
                        loading={detail.loading}
                        failed={failedRows}
                        noc={rowEntries.length > 0 ? headerNoc : undefined}
                        preSample={headerPreSample}
                    />
                    {/* The FARMER's NOC readiness (V2's strip, at V2's place): one line across its documents, never per row / card */}
                    {rowEntries.length > 0 && (
                        <div data-farmer-noc={farmerNoc.readiness} data-noc-undecided={farmerNoc.undecided} data-noc-approved={farmerNoc.approved} data-noc-missing={farmerNoc.missing}>
                            <NocReadinessStrip readiness={farmerNoc.readiness} text={farmerNoc.text} action={farmerNoc.action} />
                        </div>
                    )}
                    {/* V2.1: no "Verified by — date" strip here: each verified dispatch card states its verifier and time (backlog A). */}
                    </div>


                {/* Content section - Style 5 (Feedback based) */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 relative [&>[data-radix-scroll-area-viewport]>div]:!block">
                    {showLoadingScreen ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-in fade-in duration-500">
                            <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                        </div>
                    ) : (
                        /* The farmer: one section per AZ (the Samples pattern), each listing its deployments' dispatches (every
                           status) through the local filter; a dispatch expands in place into its working surface (plots, actions) */
                        <div className="p-6 space-y-6">
                            {detail.rowsError && (
                                <div data-farmer-rows-error className="rounded-md border border-amber-100 dark:border-amber-900/20 bg-amber-50/40 dark:bg-amber-950/10 px-3 py-2 flex items-start gap-2 text-left">
                                    <AlertCircle className="h-4 w-4 mt-px text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                                    <div className="flex-1 min-w-0 text-[11px] leading-4">
                                        <p className="font-semibold text-amber-800 dark:text-amber-300">The farmer&apos;s other deployments couldn&apos;t be loaded.</p>
                                        <p className="text-zinc-600 dark:text-zinc-400 [overflow-wrap:anywhere]">{detail.rowsError} Only the deployment opened from the table is shown.</p>
                                    </div>
                                    <Button variant="outline" size="sm" data-farmer-rows-retry className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider shrink-0" onClick={detail.reload}>Retry</Button>
                                </div>
                            )}
                            {rowEntries.length === 0 && !detail.loading && (
                                <EmptyBox data-farmer-empty="" title="No deployments" detail="The list returned no deployment for this farmer." icon="inbox" />
                            )}
                            {azSections.map((section) => {
                                const collapsed = collapsedAzIds.has(section.azId)
                                const azLabel = section.name ? `${section.code} · ${section.name}` : section.code
                                return (
                                    <section
                                        key={section.azId}
                                        data-az-section={section.code}
                                        data-az-id={section.azId}
                                        data-az-rows={section.entries.length}
                                        data-az-collapsed={collapsed || undefined}
                                        className="space-y-3"
                                    >
                                        <GroupHeader prefix="az" label={azLabel} shown={section.shown} total={section.total} noun="dispatch" filtered={detailFilter !== "all"} collapsed={collapsed} onToggle={() => toggleAz(section.azId)} />
                                        {!collapsed && section.entries.map((e) => {
                                            const views = classified.get(e.rowKey)?.views ?? []
                                            const reportIndex: ReportIndex = classified.get(e.rowKey)?.reportIndex ?? buildReportIndex([], [])
                                            // No per-deployment heading, validation notice or NOC strip here: the cards carry their own
                                            // dates and statuses; the NOC is farmer-level (the header); the deployment-wide validation
                                            // flag names no dispatch (not shown — see the file comment).
                                            return (
                                                <div key={e.rowKey} data-farmer-row={e.rowKey} data-group-verified={e.allApproved ? "true" : "false"} data-row-az={e.row.az_id} data-row-type={e.type.key} className="space-y-3">
                                                    <DispatchCards
                                                        row={e.row}
                                                        deploymentType={e.type}
                                                        loading={e.detail?.loading ?? true}
                                                        dispatches={views}
                                                        filter={detailFilter}
                                                        localReports={localReports}
                                                        reporterName={session.displayName}
                                                        trailersError={e.detail?.dispatchesError ?? null}
                                                        historyState={historyStateOf(e)}
                                                        expandedDispatches={expandedDispatches}
                                                        onToggleDispatch={toggleDispatchCard}
                                                        locatedPlotId={locatedPlotId}
                                                        work={workFor(e)}
                                                        onDeleteDispatch={canDeleteOn(e, "dispatch") ? (dispatch) => openDelete({ mode: "Dispatch", dispatch }) : undefined}
                                                        onRetry={() => detail.reloadRow(e.rowKey)}
                                                        reportIndex={reportIndex}
                                                        onOpenHistory={(id) => openHistory(e.rowKey, id)}
                                                        expandedPlots={expandedPlots}
                                                        onTogglePlot={togglePlotCard}
                                                        mapFocusDispatchId={mapFocus?.id ?? null}
                                                        mapFocusPlotId={mapFocus?.plotId ?? null}
                                                    />
                                                </div>
                                            )
                                        })}
                                        {/* The AZ's dispatches the local filter hides: one compact line at the section's foot, with the way to All */}
                                        {!collapsed && detailFilter !== "all" && section.total > section.shown && (() => {
                                            const hidden = section.total - section.shown
                                            return (
                                                <p data-az-more={hidden} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                                                    <span>{hidden} {section.shown > 0 ? "more " : ""}{hidden === 1 ? "dispatch" : "dispatches"} in this AZ</span>
                                                    <button
                                                        type="button"
                                                        data-show-all
                                                        onClick={() => setFilterChoice({ key: stateKey, filter: "all" })}
                                                        className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:underline underline-offset-2"
                                                    >
                                                        View all dispatches
                                                    </button>
                                                </p>
                                            )
                                        })()}
                                    </section>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>

                        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 flex flex-col relative">
                            <div className="p-4 flex items-center justify-between gap-4">
                                {/* Left: Navigation — V2.1: between the loaded FARMERS (the Samples pattern) */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-prev-farmer
                                        aria-label="Previous farmer"
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onPrevious}
                                        disabled={isFirst || isDataLoading}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    {/* V2.1: fixed width — the counter growing as farmers load never moves Next */}
                                    <span data-nav-counter data-nav-more={moreFarmers ? "" : undefined} title={moreFarmers ? "More farmers load as you go" : undefined} className="min-w-[4.5rem] text-center text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex + 1} / {totalCount}{moreFarmers ? "+" : ""}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-next-farmer
                                        aria-label={navStatus === "loading" ? "Next farmer (loading more farmers)" : "Next farmer"}
                                        aria-busy={navStatus === "loading" || undefined}
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onNext}
                                        disabled={isLast || isDataLoading}
                                    >
                                        {navStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ChevronRight className="h-5 w-5" />}
                                    </Button>
                                </div>
                                {/* No "Farmers" label here: the footer is V2's / Samples' Previous / Next alone (the header names the farmer).
                                    V2.1: the next page of farmers — said only when it matters (at the last loaded farmer), on the same row. */}
                                <div data-nav-status={navStatus} role="status" aria-live="polite" className="min-w-0 flex items-center justify-end gap-2 text-xs text-zinc-500">
                                    {navStatus === "loading" && <span className="truncate">Loading more farmers…</span>}
                                    {navStatus === "error" && (
                                        <>
                                            <span className="truncate text-red-600 dark:text-red-400">Couldn&apos;t load more farmers.</span>
                                            <Button variant="outline" size="sm" data-nav-retry className="h-7 px-2.5 text-xs shrink-0" onClick={onRetryNav}>Retry</Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

            </SheetContent>
        </Sheet>

            {/* The media preview — and the NOC review in it (V2's DocumentVerifierDialog footer: Previous / Next over every
                document, Report / Approve for the one shown; loading / failed / none said in the same dialog). */}
            <Dialog open={!!activePreview || nocReviewOpen} onOpenChange={(val) => { if (!val) closePreview() }}>
                <DialogPortal>
                    <DialogContent
                        data-noc-review={nocReviewOpen ? nocReviewState : undefined}
                        data-noc-current={activeNoc?.key}
                        data-noc-az={activeNoc?.doc.az_id}
                        data-noc-current-status={activeNoc?.doc.franchise_status}
                        data-noc-position={activeNoc ? `${activeNoc.index + 1}/${nocOrdered.length}` : undefined}
                        onKeyDown={(e) => {
                            // Left / Right move between NOC documents (buttons stay the primary way; typing fields are left alone)
                            if (!activeNoc || nocOrdered.length < 2 || (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return
                            if (e.key === "ArrowRight" && activeNoc.index < nocOrdered.length - 1) { e.preventDefault(); openNocAt(nocOrdered[activeNoc.index + 1].key) }
                            if (e.key === "ArrowLeft" && activeNoc.index > 0) { e.preventDefault(); openNocAt(nocOrdered[activeNoc.index - 1].key) }
                        }}
                        className="max-w-[1200px] w-[95vw] h-[800px] max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl z-[500] flex items-center justify-center rounded-2xl [&>button]:hidden"
                    >
                        <DialogTitle className="sr-only">{nocReviewOpen ? "NOC review" : "Attachment Preview"}</DialogTitle>
                        <DialogDescription className="sr-only">{nocReviewOpen ? "The farmer's NOC documents one at a time, with Report and Approve" : "Basic view of the survey attachment"}</DialogDescription>

                        <div className="relative w-full h-full flex flex-col bg-black/5">
                            {/* V2.1: the media's own stage — the space between the viewer's header and its footer (the footer is in
                                the flow below it, so it never covers the image: "fit" shows the whole image) */}
                            <div data-media-stage className="relative flex-1 min-h-0 w-full flex flex-col items-center justify-center">
                            {/* A media item, or the NOC document under review — both through the same viewer */}
                            {activePreview ? renderPreviewContent(activePreview) : activeNoc ? (nocHasImage(activeNoc) ? renderPreviewContent(nocPreviewItem(activeNoc)) : (
                                // V2.1: a NOC document the API sent without an image link (noc null / absent / empty —
                                // live-normalize.ts turns those into ""). Said so in the viewer's frame: not an empty image,
                                // not "couldn't be loaded" (a link that fails), not "No NOC found" (the document exists).
                                // The footer (Previous / Next, Report / Approve and their gates) is unchanged.
                                <div data-noc-no-image={activeNoc.key} className="w-full h-full flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
                                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-amber-50 p-2 rounded-lg">
                                                <FileText className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-none">NOC</p>
                                                <p className="text-[11px] text-zinc-500 mt-1 font-medium">{nocPreviewItem(activeNoc).question}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" data-noc-close className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={closePreview} title="Close" aria-label="Close">
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div role="status" data-preview-state="no-image" className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-100 dark:bg-zinc-900/50">
                                        <ImageOff className="h-10 w-10 text-zinc-300" aria-hidden />
                                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No NOC image was sent.</p>
                                        <p className="text-xs text-zinc-500 max-w-[420px]">This NOC document came without an image link, so there is no image to show. Its status: {activeNoc.doc.franchise_status || "not sent"}.</p>
                                    </div>
                                </div>
                            )) : null}
                            {/* The NOC review with nothing to show yet — loading, a failed read (Retry), or no document — in the viewer's own frame */}
                            {nocReviewOpen && !activePreview && !activeNoc && (
                                <div data-noc-state={nocReviewState} className="w-full h-full flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
                                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-amber-50 p-2 rounded-lg">
                                                <FileText className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-none">NOC</p>
                                                <p className="text-[11px] text-zinc-500 mt-1 font-medium">{record?.farmer.name}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" data-noc-close className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={closePreview} title="Close">
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-100 dark:bg-zinc-900/50">
                                        {nocReviewState === "loading" ? (
                                            <>
                                                <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Checking NOC…</p>
                                            </>
                                        ) : nocReviewState === "error" ? (
                                            <>
                                                <AlertCircle className="h-8 w-8 text-amber-500" />
                                                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">NOC details couldn&apos;t be loaded for {nocUnavailable.length} deployment{nocUnavailable.length === 1 ? "" : "s"} ({[...new Set(nocUnavailable.map(azLabelOf))].join(", ")}).</p>
                                                <p className="text-xs text-zinc-500 max-w-[420px] [overflow-wrap:anywhere]">{nocUnavailable[0]?.detail?.nocError}</p>
                                                <Button variant="outline" size="sm" data-noc-retry className="h-8 text-xs font-bold" onClick={() => nocUnavailable.forEach((e) => detail.reloadRow(e.rowKey))}>Retry</Button>
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="h-8 w-8 text-zinc-300" />
                                                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No NOC found for this farmer&apos;s deployments.</p>
                                                <p className="text-xs text-zinc-500 max-w-[420px]">
                                                    {nocMissing.length > 0 ? `NOC missing for ${nocMissing.length} deployment${nocMissing.length === 1 ? "" : "s"} (${[...new Set(nocMissing.map(azLabelOf))].join(", ")}). Approval is blocked until the required NOCs are approved.` : "Dispatches can't be approved without an approved NOC."}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            </div>
                            {/* V2: NOC review footer (matic-dash DocumentVerifierDialog: "Report" / "Approve"), with Previous / Next over every document */}
                            {activeNoc && !activePreview && (
                                <div data-noc-footer className="relative shrink-0 w-full z-10 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-x-6 gap-y-3">
                                    {/*
                                      V2.1: three fixed zones, so no control ever moves into another's place between documents — navigation pinned
                                      at the left, the document in the middle, the decision slot at the right. The slot keeps its width whether or not
                                      Report / Approve are offered (and its height: an empty slot never collapses), and they have fixed widths; the counter too. Controls sit on the footer's bottom
                                      line (a wrapping status line grows upward). Below sm each zone takes its own row: text, navigation, decision.
                                    */}
                                    {/* the document: what it is, its status (fills the middle; wraps upward) */}
                                    <div className="row-start-1 sm:col-start-2 text-left min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">NOC — {nocDocLabel(activeNoc)}</p>
                                        <p data-noc-status-line className="text-xs text-zinc-500 [overflow-wrap:anywhere]">
                                            {canDecideNoc ? "This farmer has submitted an NOC, please review." : `Status: ${activeNoc.doc.franchise_status}.`}
                                            {nocUndecided.length > 0 && ` ${nocUndecided.length} waiting for review.`}
                                            {nocUnavailable.length > 0 && (
                                                <>
                                                    {" "}
                                                    <span className="text-amber-700 dark:text-amber-300">NOC couldn&apos;t be loaded for {nocUnavailable.length} deployment{nocUnavailable.length === 1 ? "" : "s"} ({[...new Set(nocUnavailable.map(azLabelOf))].join(", ")}).</span>{" "}
                                                    <button type="button" data-noc-retry className="text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 text-amber-800 dark:text-amber-300" onClick={() => nocUnavailable.forEach((e) => detail.reloadRow(e.rowKey))}>Retry</button>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    {/* navigation: every NOC document of the farmer (waiting first, then approved), always at the left */}
                                    <nav aria-label="NOC documents" data-noc-nav className="row-start-2 justify-self-start sm:col-start-1 sm:row-start-1 h-9 flex items-center gap-1">
                                        {nocOrdered.length > 1 && (
                                            <div className="flex items-center gap-1" data-noc-pager={`${activeNoc.index + 1}/${nocOrdered.length}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" data-noc-prev aria-label="Previous NOC document" disabled={activeNoc.index === 0} onClick={() => openNocAt(nocOrdered[activeNoc.index - 1].key)}>
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span aria-live="polite" className="w-14 text-center text-[11px] font-bold text-zinc-500 tabular-nums">{activeNoc.index + 1} / {nocOrdered.length}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" data-noc-next aria-label="Next NOC document" disabled={activeNoc.index === nocOrdered.length - 1} onClick={() => openNocAt(nocOrdered[activeNoc.index + 1].key)}>
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </nav>
                                    {/* the decision: a reserved slot at the right — the same width with or without Report / Approve */}
                                    <div data-noc-actions className="row-start-3 justify-self-end sm:col-start-3 sm:row-start-1 h-9 flex items-center justify-end gap-2 w-[14.75rem]">
                                        {canDecideNoc && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    data-noc-report
                                                    className="h-9 w-[6.75rem] px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                                                    disabled={submittingNocKey !== null}
                                                    onClick={() => handleNocDecision("rejected")}
                                                >
                                                    <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                    Report
                                                </Button>
                                                <Button
                                                    data-noc-approve
                                                    className="h-9 w-[7.5rem] px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                    disabled={submittingNocKey !== null}
                                                    onClick={() => handleNocDecision("approved")}
                                                >
                                                    {submittingNocKey === activeNoc.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Approve</>}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </DialogPortal>
            </Dialog>

            {/* New Report Comment Pop-up (existing Deployment Finalize Report dialog) */}
            <Dialog open={isReportingFinalStep} onOpenChange={setIsReportingFinalStep}>
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <DialogTitle className="sr-only">Finalize Report</DialogTitle>
                    <DialogDescription className="sr-only">Add additional comments before submitting the report</DialogDescription>

                    <div className="bg-white dark:bg-zinc-950">
                        {reportSuccess ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reported Successfully</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Updating the deployment status...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="p-6 pb-0 flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Report Survey</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            You are reporting <span className="font-semibold text-zinc-900 dark:text-zinc-100">{reportedIds.length} {reportedIds.length === 1 ? "item" : "items"}</span>.
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all"
                                        onClick={() => setIsReportingFinalStep(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Body */}
                                <div className="p-6 space-y-4">
                                    <div data-report-warning className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-3 flex items-start gap-2 text-left">
                                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
                                            <p className="font-bold">
                                                {reportsPlotField
                                                    ? "Reporting this plot will mark the entire dispatch for correction."
                                                    : "Reporting this dispatch will mark the entire dispatch for correction."}
                                            </p>
                                            <p>
                                                {reportedDispatches.map((d) => `${dispatchLabel(d)} (${d.deployment_plots_data.length} ${d.deployment_plots_data.length === 1 ? "plot" : "plots"})`).join(", ")}
                                                {" "}will be marked for correction, with every plot in {reportedDispatches.length === 1 ? "it" : "them"}.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Additional Comments <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            placeholder="Describe what needs to be corrected..."
                                            className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-50 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                            value={reportComment}
                                            onChange={(e) => setReportComment(e.target.value)}
                                        />
                                    </div>
                                    <ReportDialogError error={reportError} />
                                </div>

                                {/* Footer */}
                                <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-9 px-4 text-xs font-bold"
                                        onClick={() => setIsReportingFinalStep(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-none"
                                        onClick={handleReportSubmit}
                                        disabled={isSubmittingReport || !reportComment.trim() || !canOfferReport}
                                    >
                                        {isSubmittingReport ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                Submit Report
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* V2: Confirm approval (matic-dash ConfirmSourceDialog, for the one dispatch being approved) */}
            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <DialogTitle className="sr-only">Confirm approval</DialogTitle>
                    <DialogDescription className="sr-only">Approve the selected trailer deployment</DialogDescription>
                    {approveDispatch && approveEntry && approveGate && (() => {
                        const reportedFields = reportedIds.filter((id) => id.endsWith(`:${approveDispatch.deployment_detail_id}`)).length
                        const facts = [...approveEntry.type.dispatchCardFacts(approveDispatch), formatDispatchDate(approveDispatch.date)]
                        return (
                            <div className="bg-white dark:bg-zinc-950" data-approve-dialog={approveDispatch.deployment_detail_id} data-approve-dialog-gate={approveGate.ok ? "ok" : "blocked"}>
                                <div className="p-6 pb-0 space-y-1">
                                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Confirm approval</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {reportedFields === 0 && approveGate.ok ? 1 : 0} out of 1 trailer deployments can be approved.
                                    </p>
                                </div>
                                <div className="p-6 space-y-3">
                                    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-left">
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                                            {approveDispatch.trailer_no || dispatchLabel(approveDispatch)} (1)
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            {reportedFields === 0 ? "No reported fields" : `${reportedFields} reported field${reportedFields > 1 ? "s" : ""}`}
                                            {facts.length > 0 ? ` · ${facts.join(" · ")}` : ""}
                                        </div>
                                    </div>
                                    {/* V2.1 (requirement 5): the boundary gate, plot by plot, as the dispatch is loaded now */}
                                    <div data-approve-boundaries={approveGate.checks.length} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 text-left space-y-1">
                                        <p className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">Saved boundaries</p>
                                        {approveGate.checks.length === 0 ? (
                                            <p className="text-xs text-red-700 dark:text-red-300">This dispatch has no plots.</p>
                                        ) : approveGate.checks.map((check) => (
                                            <p key={check.plot.deployment_id} data-approve-boundary={check.state} className={cn("text-xs flex items-center gap-1.5", check.state === "saved" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                                                {check.state === "saved" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                                                <span className="font-mono">{plotLabel(check.plot)}</span>
                                                <span className="text-zinc-500 dark:text-zinc-400">{check.state === "saved" ? "saved" : check.state === "missing" ? "no saved boundary" : `invalid: ${check.problem}`}</span>
                                            </p>
                                        ))}
                                        {!approveGate.ok && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{approveGate.reason}</p>}
                                    </div>
                                </div>
                                <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                    <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={() => setApproveDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        data-approve-confirm
                                        className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                        onClick={handleConfirmApprove}
                                        disabled={isApprovingDispatch || reportedFields > 0 || !canOfferApprove || !approveGate.ok}
                                    >
                                        {isApprovingDispatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Approve</>}
                                    </Button>
                                </div>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>

            {/* V2: a plot's comment (the single plot.comment field) — from the plot card; edited where the verifier may */}
            <Dialog open={!!commentTarget} onOpenChange={(open) => { if (!open) closeComment() }}>
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <DialogTitle className="sr-only">Plot comment</DialogTitle>
                    <DialogDescription className="sr-only">The deployment&apos;s comment</DialogDescription>
                    {commentPlot && (
                        <div data-comment-dialog className="bg-white dark:bg-zinc-950">
                            <div className="p-6 pb-0 flex items-start justify-between">
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                        {commentEditable ? (commentPlot.comment ? "Update Comment" : "Add Comment") : "Comment"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-mono truncate">{[plotLabel(commentPlot), commentPlot.plot_id].filter(Boolean).join(" · ")}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all"
                                    onClick={closeComment}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-6 space-y-2 text-left">
                                {commentEditable ? (
                                    <>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Share any additional observations or feedback regarding this plot.</p>
                                        <Textarea
                                            placeholder="Type your comment here . . ."
                                            className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                            value={plotCommentDraft ?? ""}
                                            onChange={(e) => setPlotCommentDraft(e.target.value)}
                                        />
                                    </>
                                ) : (
                                    <p data-comment-text className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic break-words">&quot;{commentPlot.comment}&quot;</p>
                                )}
                            </div>
                            <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={closeComment}>
                                    {commentEditable ? "Cancel" : "Close"}
                                </Button>
                                {commentEditable && (
                                    <Button
                                        data-save-comment
                                        className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                        onClick={savePlotComment}
                                        disabled={!plotCommentDraft?.trim() || isSavingPlotComment}
                                    >
                                        {isSavingPlotComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentPlot.comment ? "Update Comment" : "Add Comment"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* V2: Report history (matic-dash getFarmerReportedHistory), independent of any other panel; V2.1: one row's AZ */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent
                    data-history-dialog
                    className="flex flex-col gap-0 w-[calc(100vw-2rem)] max-w-[520px] max-h-[85vh] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl bg-white dark:bg-zinc-950 [&>button]:hidden"
                >
                    <DialogTitle className="sr-only">Report history</DialogTitle>
                    <DialogDescription className="sr-only">Earlier reports for this deployment</DialogDescription>
                    {/* Fixed header: the Close control stays reachable whatever the history holds. */}
                    <div data-history-header className="shrink-0 p-6 pb-4 flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 min-w-0">
                        <div className="space-y-1 min-w-0">
                            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{historyScope?.dispatchId ? "Report history" : "History"}</h3>
                            {historyScope?.dispatchId ? (
                                <p data-history-scope={historyScope.dispatchId} className="text-sm font-mono font-semibold text-zinc-600 dark:text-zinc-300 [overflow-wrap:anywhere]">
                                    {historyDispatch ? dispatchLabel(historyDispatch) : `DISP-${historyScope.dispatchId}`}
                                </p>
                            ) : (
                                <p data-history-row={historyScope?.rowKey} className="text-sm text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">
                                    Track the changes done so far{historyEntry ? ` · ${azLabelOf(historyEntry)}${azRecurs(historyEntry) && submittedLabel(historyEntry) ? ` (${submittedLabel(historyEntry)})` : ""}` : ""}.
                                </p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-history-close
                            aria-label="Close history"
                            className="h-8 w-8 shrink-0 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all"
                            onClick={() => setHistoryOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {/* The entries scroll on their own; long reasons / values wrap inside the cards. */}
                    <div data-history-scroll className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6 pt-4">
                        {historyError ? (
                            <div data-history-state="error" className="py-8 flex flex-col items-center gap-3 text-center">
                                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Couldn&apos;t load report history</p>
                                <p className="text-xs text-zinc-500 [overflow-wrap:anywhere] max-w-[400px]">{historyError}</p>
                                <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => { if (historyScope) openHistory(historyScope.rowKey, historyScope.dispatchId ?? undefined) }}>Retry</Button>
                            </div>
                        ) : historyItems === null ? (
                            <div data-history-state="loading" className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 text-zinc-300 animate-spin" />
                            </div>
                        ) : historyRows.length === 0 ? (
                            <div data-history-state="empty" className="py-8 text-center space-y-1">
                                {historyScope?.dispatchId ? (
                                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No report history for this dispatch.</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No report history</p>
                                        <p className="text-xs text-zinc-500">Nothing has been reported for this deployment ({historyEntry?.row.az_code || `AZ ${historyEntry?.row.az_id ?? "?"}`}).</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 min-w-0">
                                {historyRows.map((item) => (
                                    <div key={item.key} data-history-entry={item.status ?? ""} className="min-w-0 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-left space-y-1.5">
                                        <div className="flex items-start justify-between gap-2 min-w-0">
                                            <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 [overflow-wrap:anywhere]">{item.field}</span>
                                            <span className="shrink-0 text-[10px] text-zinc-400 font-medium uppercase">{item.createdAt !== null ? format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a") : "-"}</span>
                                        </div>
                                        {/* V2: the loaded dispatch / plot the entry names, and its report status */}
                                        {(item.target || item.status) && (
                                            <div className="flex items-center justify-between gap-2 text-[10px] font-medium min-w-0">
                                                <span className="font-mono text-zinc-500 dark:text-zinc-400 truncate min-w-0" title={item.target ?? undefined}>{item.target ?? ""}</span>
                                                {item.status && (
                                                    <span className={cn("shrink-0 font-bold uppercase tracking-wider", item.status === "ongoing" ? "text-red-600 dark:text-red-400" : "text-zinc-400")}>
                                                        {item.status === "ongoing" ? "Ongoing" : "Completed"}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div data-history-values className="text-xs text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">
                                            <span className="font-semibold">{item.oldValue || "—"}</span>
                                            <span className="text-zinc-400"> to </span>
                                            <span className="font-semibold">{item.newValue || (item.status === "completed" ? "—" : "Pending correction")}</span>
                                        </div>
                                        <div data-history-reason className="text-xs text-zinc-600 dark:text-zinc-400 italic whitespace-pre-line [overflow-wrap:anywhere]">&quot;{item.reason}&quot;</div>
                                        <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider [overflow-wrap:anywhere]">
                                            Reported by {item.reportedBy}{item.surveyorName ? ` • Surveyor ${item.surveyorName}` : ""}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {/* V2: soft delete (matic-dash deployment-trailer.tsx delete dialog: same wording, comment required) */}
            <Dialog open={!!deleteTarget} onOpenChange={(val) => { if (!val && !isDeleting) closeDelete() }}>
                <DialogContent className="max-w-[520px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <DialogTitle className="sr-only">{deleteTarget?.mode === "Dispatch" ? "Delete dispatch" : "Delete deployment"}</DialogTitle>
                    <DialogDescription className="sr-only">Soft delete with a required comment</DialogDescription>
                    {deleteTarget && (
                        <div className="bg-white dark:bg-zinc-950" data-delete-dialog={deleteTarget.mode}>
                            <div className="p-6 pb-0 space-y-2 text-left">
                                <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {deleteTarget.mode === "Dispatch" ? `Delete ${dispatchLabel(deleteTarget.dispatch)}` : `Delete ${plotLabel(deleteTarget.plot)}`}
                                </h3>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    {deleteTarget.mode === "Dispatch"
                                        ? "You're deleting a dispatch record. Please be sure to enter a comment and double check — this change is permanent."
                                        : "You're deleting a deployment record. Please be sure to enter a comment and double check — this change is permanent."}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {deleteTarget.mode === "Dispatch"
                                        ? `Deletes the entire dispatch and all deployments under it (${deleteTarget.dispatch.deployment_plots_data.length} ${deleteTarget.dispatch.deployment_plots_data.length === 1 ? "plot" : "plots"}).`
                                        : "Deletes only the selected deployment."}
                                </p>
                            </div>
                            <div className="p-6 space-y-2">
                                <Textarea
                                    value={deleteComment}
                                    onChange={(e) => {
                                        setDeleteComment(e.target.value)
                                        if (deleteError) setDeleteError(false)
                                    }}
                                    placeholder="Add your comment here"
                                    className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                />
                                {deleteError && !deleteComment.trim() && <p className="text-sm text-red-500">Please add a comment.</p>}
                            </div>
                            <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={closeDelete} disabled={isDeleting}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="h-9 px-5 text-xs font-bold"
                                    onClick={handleDeleteSubmit}
                                    disabled={isDeleting || !deleteComment.trim() || !deleteAllowed(deleteTarget)}
                                    data-delete-confirm
                                >
                                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</>}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Custom Toast Message */}
            {toastMessage && (
                <div
                    className={cn(
                        "fixed top-4 right-4 z-[999] w-full max-w-[360px] p-4 rounded-xl shadow-lg border flex gap-3 animate-in fade-in slide-in-from-top-3 duration-300 group bg-white dark:bg-zinc-950",
                        toastMessage.type === "success"
                            ? "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-50 dark:border-emerald-900/50"
                            : "bg-red-50 text-red-950 border-red-200 dark:bg-red-950/90 dark:text-red-50 dark:border-red-900/50"
                    )}
                >
                    <div
                        className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            toastMessage.type === "success"
                                ? "bg-emerald-100 dark:bg-emerald-900/40"
                                : "bg-red-100 dark:bg-red-900/40"
                        )}
                    >
                        {toastMessage.type === "success" ? (
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                        <h5 className={cn(
                            "font-bold text-[12px] leading-tight mb-0.5",
                            toastMessage.type === "success" ? "text-emerald-950 dark:text-emerald-50" : "text-red-950 dark:text-red-50"
                        )}>{toastMessage.title}</h5>
                        <p className={cn(
                            "text-[10px] font-medium leading-relaxed opacity-90 truncate-2-lines",
                            toastMessage.type === "success" ? "text-emerald-800 dark:text-emerald-300/80" : "text-red-800 dark:text-red-300/80"
                        )}>{toastMessage.description}</p>
                    </div>
                    <button
                        onClick={() => setToastMessage(null)}
                        className={cn(
                            "absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-0.5",
                            toastMessage.type === "success"
                                ? "text-emerald-900/40 hover:text-emerald-900 hover:bg-emerald-100/50 dark:text-emerald-50/40 dark:hover:text-emerald-50 dark:hover:bg-emerald-900/30"
                                : "text-red-900/40 hover:text-red-900 hover:bg-red-100/50 dark:text-red-50/40 dark:hover:text-red-50 dark:hover:bg-red-900/30"
                        )}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
        </>
    )
}
