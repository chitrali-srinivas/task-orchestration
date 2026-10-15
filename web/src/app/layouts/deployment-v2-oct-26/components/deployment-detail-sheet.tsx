"use client"

// Deployment V2 Oct 26 — detail sheet cloned from the existing Deployment layout
// (src/app/layouts/deployment/components/engagement-detail-sheet.tsx). The map panel, header, details bar,
// footer navigation, media preview and transitions are unchanged. The body follows matic-dash's Deployment IA: one
// list, Trailer → Dispatch → Deployment (plot), with no dispatch or plot page. A dispatch expands in place into its
// working surface (deployment-details-panel.tsx): its facts and correction, its plot cards (picture, facts, comment,
// delete, map focus), report selection and Approve. The existing dialogs — media preview, Finalize Report, approval,
// comment, delete, NOC, history — open over it, driven by the Matic workflow through ../data.

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogPortal,
    DialogOverlay,
} from "@/components/ui/dialog"
import type { VerificationComment } from "@/app/layouts/deployment/data/schema"
import type { DeploymentNocDetails, DeploymentV2Record, DispatchStatus, ReportHistoryEntry, TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import { useDeploymentSession } from "../data/session"
import { buildMapFarmer, type MapFarmer, type MapPlot } from "../data/map-data"
import { MapLegend, PlotMapCard, type SelectedDeployment } from "./map-overlays"
import { amountScale, markerIcon, sourceColors, type AmountScale, type SourceLegendEntry } from "./map-markers"
import { PlotBoundaryEditor } from "./plot-boundary-editor"
import { deploymentApi } from "../data/deployment-api"
import {
    buildApproveDispatchRequest,
    buildCommentRequest,
    buildUploadGeoJsonRequest,
    buildDeleteDeploymentRequest,
    buildDeleteDispatchRequest,
    buildNocDecisionRequest,
    buildNocDetailsRequest,
    buildReportHistoryRequest,
    buildReportRequests,
    buildTrailerDetailsRequest,
    getNocApprovalBlocker,
    getNocReadiness,
    summarizeNoc,
} from "../data/request-builders"
import { getDeploymentRowKey, parseEpochMs } from "../data/adapter"
import { useDeploymentRows } from "../data/data-source"
import {
    DeploymentSummaryBar,
    DetailStatusFilter,
    DispatchCards,
    NocReadinessStrip,
    type LocalReport,
} from "./deployment-details-panel"
import {
    classifyDispatches,
    defaultDetailFilter,
    detailFilterCounts,
    detailReadStatuses,
    inDetailFilter,
    mergeDispatchReads,
    offersApprove,
    offersReport,
    type DetailFilter,
} from "./deployment-dispatch-view"
import { dispatchLabel, formatDispatchDate, plotLabel, toReportSelections } from "./deployment-field-cards"
import { buildReportIndex, historyForDispatch, toReportHistoryRows } from "./deployment-report-index"
import { getDeploymentType } from "./deployment-types"
import { mediaFileName } from "./deployment-media"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, ImageOff } from "lucide-react"
import { useAppNavigate } from "@/platform/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, XCircle, Truck, Tractor } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, MessageSquareText, X, Check, Image as ImageIcon, Play, FileText, MapPin, Download, Info, MessageSquareWarning, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Scaling, AlignCenter, SlidersHorizontal, RotateCcw, Loader2, User, Phone, Eye, EyeOff, Plus } from "lucide-react"
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PencilRuler } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SurveyItem, VariantType, surveyData } from "@/app/components/survey/SurveyComponents"
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow } from "@react-google-maps/api"
import { env } from "@/platform/env"
import { Plot } from "@/types/map"

/** Message of a failed API call (live mode surfaces the real failure). */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Soft delete target: a whole dispatch, or one plot deployment of it (matic-dash deleteMode). */
type DeleteTarget =
    | { mode: "Dispatch"; dispatch: TrailerDispatchItem }
    | { mode: "Deployment"; dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot }

// Same loader id + libraries as matic-dash: @react-google-maps refuses a second load with different options.
const LIBRARIES: "geometry"[] = ["geometry"];
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 };
const DEFAULT_ZOOM = 5;

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
const MAP_CONTROL = "h-9 w-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"

function MapPreviewContent({
    selectedFarmer,
    onIdle,
    center,
    zoom,
    specificMarker,
    onReset,
    onInteraction,
    resetCount,
    questionLocation,
    setIsMapInteracted,
    mapRef,
    isProgrammaticChange,
    hasLocationQuestion,
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
    legend,
    detailsCard,
    editEnabled
}: {
    selectedFarmer: MapFarmer | null,
    onIdle?: () => void,
    center?: google.maps.LatLngLiteral | null,
    zoom?: number,
    specificMarker?: google.maps.LatLngLiteral | null,
    onReset?: () => void,
    onInteraction?: () => void,
    resetCount: number,
    questionLocation?: google.maps.LatLngLiteral | null,
    setIsMapInteracted: (val: boolean) => void,
    mapRef: React.MutableRefObject<google.maps.Map | null>,
    isProgrammaticChange: React.MutableRefObject<boolean>,
    hasLocationQuestion: boolean,
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
    /** V2: what colour / size mean (bottom-left). */
    legend?: { sources: SourceLegendEntry[]; scale: AmountScale; amountLabel: string | null }
    /** V2: the one selected plot's card (top-right); null: no single plot is selected. */
    detailsCard?: React.ReactNode
    /** V2: a single plot is selected and its boundary may be edited (the edit button is shown only with `onEditClick`). */
    editEnabled?: boolean
}) {
    /** V2: the camera flight in progress (cancelled by a newer target, Reset View, a map click or the user's own drag). */
    const flightCancel = React.useRef<(() => void) | null>(null)
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

    const fitBounds = React.useCallback(() => {
        if (!mapRef.current || !selectedFarmer || selectedFarmer.plots.length === 0) return;

        isProgrammaticChange.current = true;
        const bounds = new google.maps.LatLngBounds();
        selectedFarmer.plots.forEach(plot => {
            bounds.extend(plot.location);
            if (plot.path) {
                plot.path.forEach(point => bounds.extend(point));
            }
        });

        // Also include the question location in the initial view bounds if it exists
        if (questionLocation && hasLocationQuestion) {
            bounds.extend(questionLocation);
        }

        // V2: framed clear of the map's overlays — the buttons (top-left) and the legend (bottom-left) never hide a plot
        mapRef.current.fitBounds(bounds, overlayPadding(mapRef.current));
        
        // Add some padding so markers aren't right at the edge
        const listener = google.maps.event.addListener(mapRef.current, "idle", () => {
            if (mapRef.current) {
                // If the zoom is too high after fitBounds (e.g. only one plot), cap it
                if (mapRef.current.getZoom()! > 18) mapRef.current.setZoom(18);
            }
            // Use a small delay before allowing interaction detection again
            setTimeout(() => {
                isProgrammaticChange.current = false;
            }, 100);
            google.maps.event.removeListener(listener);
        });
    }, [selectedFarmer, questionLocation, mapRef, isProgrammaticChange, hasLocationQuestion]);

    const onLoad = React.useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setMapReady(true);
        map.setMapTypeId("satellite");
        // V2: a plot already focused flies there instead of the farmer fit
        if (!center && !focusTarget) {
            fitBounds();
        }
    }, [center, focusTarget, fitBounds, mapRef]);

    const onUnmount = React.useCallback(() => {
        mapRef.current = null;
        setMapReady(false);
    }, [mapRef]);

    React.useEffect(() => {
        if (mapRef.current) {
            isProgrammaticChange.current = true;
            if (center) {
                mapRef.current.panTo(center);
                mapRef.current.setZoom(zoom || 17);
                // Reset flag after a short delay since panTo/setZoom don't have callbacks
                setTimeout(() => { isProgrammaticChange.current = false; }, 500);
            } else if (selectedFarmer) {
                fitBounds();
            }
        }
    }, [selectedFarmer, center, zoom, fitBounds, resetCount, mapRef, isProgrammaticChange]);

    return (
        <div className="relative w-full h-full">
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={center || selectedFarmer?.location || DEFAULT_CENTER}
                zoom={zoom || (selectedFarmer ? 17 : DEFAULT_ZOOM)}
                onLoad={onLoad}
                onIdle={onIdle}
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
                    zoomControl: true,
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
                                    {plot.path && plot.path.length > 0 && (
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

            {/* Boundary edit (only for verifiers who may edit; acts on the one selected plot) and Reset View, top-left */}
            <div data-map-controls className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <TooltipProvider delayDuration={200}>
                    {onEditClick && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* a disabled button gets no pointer events: the tooltip sits on its wrapper */}
                                <span tabIndex={editEnabled ? -1 : 0} className="inline-flex rounded-md">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        data-map-edit-boundary
                                        onClick={onEditClick}
                                        disabled={!editEnabled}
                                        aria-label={editEnabled ? "Edit the selected plot's boundary" : "Select a plot to edit its boundary"}
                                        className={MAP_CONTROL}
                                    >
                                        <PencilRuler className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">{editEnabled ? "Edit plot boundary" : "Select a plot to edit its boundary"}</TooltipContent>
                        </Tooltip>
                    )}
                    {(isShowingSpecificLocation || isMapInteracted) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" data-map-reset-view aria-label="Reset view" onClick={onReset} className={MAP_CONTROL}>
                                    <RotateCcw className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Reset view</TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </div>

            {/* V2: the ONE selected plot (top-right) and the marker legend (bottom-left) */}
            {detailsCard}
            {legend && <MapLegend sources={legend.sources} scale={legend.scale} amountLabel={legend.amountLabel} />}
        </div>
    );
}

interface DeploymentDetailSheetProps {
    record: DeploymentV2Record | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onNext: () => void
    onPrevious: () => void
    isFirst: boolean
    isLast: boolean
    currentIndex: number
    totalCount: number
    surveyData?: SurveyItem[]
    hasLocationQuestion?: boolean
    language?: "en" | "hi"
    onLanguageChange?: (lang: "en" | "hi") => void
    defaultTab?: "all" | "verified" | "pending" | "need_correction" | "details"
}

function ImagePreview({ item, zoom, rotation, imageMode }: { item: SurveyItem, zoom: number, rotation: number, imageMode: "fill" | "fit" | "stretch" | "center" }) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
    /** V2: a URL that doesn't load shows why, instead of an empty frame (keyed by URL by the caller). */
    const [failed, setFailed] = React.useState(false)

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
        <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing relative">
            <div
                className="transition-all duration-300 ease-out flex items-center justify-center"
                style={{ 
                    ...wrapperStyle,
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
            >
                <img
                    src={item.answer as string}
                    alt="Preview"
                    onError={() => setFailed(true)}
                    className={cn(
                        "transition-all duration-300",
                        imageMode === "fill" && "w-full h-full object-cover",
                        imageMode === "fit" && "w-full h-full object-contain",
                        imageMode === "stretch" && "w-full h-full object-fill",
                    )}
                />
            </div>
        </div>
    );
}

export function DeploymentDetailSheet({
    record,
    open,
    onOpenChange,
    onNext,
    onPrevious,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    surveyData: customSurveyData,
    hasLocationQuestion = true,
    defaultTab,
}: DeploymentDetailSheetProps) {
    // ── V2: Matic detail workflow state ─────────────────────────────────────────────────────────────
    /** Signed-in verifier: mock admin in mock mode, the bootstrap user in live mode (actions disabled until known). */
    const session = useDeploymentSession()
    const permissions = session.permissions
    /** Every mutation handler re-checks this (the disabled buttons are not the only gate). */
    const canMutate = session.status === "ready" && permissions.edit
    const navigate = useAppNavigate()
    const liveRows = useDeploymentRows()
    const recordKey = record ? getDeploymentRowKey(record.api) : null
    /** Authoritative deployment row: re-read from the mock backend after every mutation. */
    const row = React.useMemo(
        () => (recordKey ? liveRows.find((r) => getDeploymentRowKey(r) === recordKey) ?? record?.api ?? null : null),
        [liveRows, recordKey, record]
    )
    /** The detail's trailer reads: the row's verification read first (pending on Pending / Need Correction rows, as
     *  matic-dash's Ready to Verify / Action Required; approved on Verified), then the other statuses, so the detail holds
     *  every dispatch of the farmer + deployment + AZ (deployment-dispatch-view.ts). */
    const readStatuses = React.useMemo<DispatchStatus[]>(() => (row ? detailReadStatuses(row) : []), [row])
    const deploymentType = getDeploymentType(row?.az_id ?? 0)
    const [trailers, setTrailers] = React.useState<TrailerDispatchItem[]>([])
    const [nocDetails, setNocDetails] = React.useState<DeploymentNocDetails | null>(null)
    /** Load failures per source (a failed NOC read must not look like "no NOC"). */
    const [trailersError, setTrailersError] = React.useState<string | null>(null)
    /** Optional reads that failed (the statuses other than the row's own) and the first error: the rest is still shown. */
    const [failedReads, setFailedReads] = React.useState<DispatchStatus[]>([])
    const [trailersNotice, setTrailersNotice] = React.useState<string | null>(null)
    const [nocError, setNocError] = React.useState<string | null>(null)
    const [isNocLoading, setIsNocLoading] = React.useState(false)
    const [detailToken, setDetailToken] = React.useState(0)
    const [isDetailLoading, setIsDetailLoading] = React.useState(false)
    /** The local dispatch filter picked in this detail, for this row only (a newly opened row starts at its default). */
    const [filterChoice, setFilterChoice] = React.useState<{ key: string | null; filter: DetailFilter } | null>(null)
    /** Collapsed trailer groups, for this row only (a newly opened row starts with every group expanded). */
    const [collapsedChoice, setCollapsedChoice] = React.useState<{ key: string | null; trailers: string[] } | null>(null)
    /** Dispatches expanded in place, for this row only (by deployment_detail_id; a newly opened row starts all collapsed). */
    const [expandedChoice, setExpandedChoice] = React.useState<{ key: string | null; ids: string[] } | null>(null)
    /** Plot (deployment) cards expanded to their details, for this row only (by deployment_id; all start collapsed). */
    const [plotChoice, setPlotChoice] = React.useState<{ key: string | null; ids: number[] } | null>(null)
    /** The dispatch whose report history the dialog shows (its deployment_detail_id); null = the deployment's history. */
    const [historyScope, setHistoryScope] = React.useState<string | null>(null)
    /**
     * An element to scroll into view after the next render (a plot revealed from the map). With `context` (its dispatch
     * card), the dispatch is brought into view first and the element is centred only if it would otherwise stay hidden.
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
     * record change, the plot card's close, the editor opening) — takes the next number. The bounce belongs to exactly one
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
    const [reportComment, setReportComment] = React.useState("")
    const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)
    const [reportSuccess, setReportSuccess] = React.useState(false)
    const [localReports, setLocalReports] = React.useState<Record<string, LocalReport>>({})
    const [approveDialogOpen, setApproveDialogOpen] = React.useState(false)
    const [isApprovingDispatch, setIsApprovingDispatch] = React.useState(false)
    const [nocIndex, setNocIndex] = React.useState(0)
    const [isSubmittingNoc, setIsSubmittingNoc] = React.useState(false)
    const [historyOpen, setHistoryOpen] = React.useState(false)
    const [historyItems, setHistoryItems] = React.useState<ReportHistoryEntry[] | null>(null)
    const [historyError, setHistoryError] = React.useState<string | null>(null)
    /**
     * This row's report history (one read per detail load, never one per dispatch): the source of the reports behind a
     * manual correction and of their field / plot highlights (deployment-report-index.ts, deployment-dispatch-view.ts);
     * never a dispatch status — history is context (the clock, the history dialog). null while unknown or when the read
     * failed (no correction is matched; the history dialog keeps its own error / Retry).
     */
    const [historyEntries, setHistoryEntries] = React.useState<ReportHistoryEntry[] | null>(null)
    /** The report-history read failed: reports can't be matched to dispatches (the list says so). */
    const [historyFailed, setHistoryFailed] = React.useState(false)
    const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
    const [deleteComment, setDeleteComment] = React.useState("")
    const [deleteError, setDeleteError] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [plotCommentDraft, setPlotCommentDraft] = React.useState<string | null>(null)
    const [isSavingPlotComment, setIsSavingPlotComment] = React.useState(false)
    const [toastMessage, setToastMessage] = React.useState<{ title: string; description: string; type: "success" | "error" } | null>(null)

    // Load the Matic detail data (getTrailerDetails + getDeploymentNocDetails) for the current deployment.
    // Re-runs when the authoritative row changes (e.g. after an approval) or after other mutations.
    React.useEffect(() => {
        if (!open || !row) return
        let cancelled = false
        setIsDetailLoading(true)
        setIsNocLoading(true)
        // One trailer read per dispatch status (deployment-dispatch-view.ts). A dispatch keeps its own franchise_status
        // (the status it was read with when the response has none). Trailer and NOC reads fail independently; each
        // failure is kept and shown, never replaced by mock data. The row's own read is required; the other statuses
        // are optional: if one fails, the rest is still shown, with a notice.
        const [primaryStatus, ...extraStatuses] = detailReadStatuses(row)
        const readDispatches = (status: DispatchStatus): Promise<TrailerDispatchItem[]> => deploymentApi.getTrailerDetails(buildTrailerDetailsRequest(row, status))
            .then((dispatches) => dispatches.map((d) => ({ ...d, franchise_status: d.franchise_status ?? status })))
        const trailerLoad = Promise.all([
            readDispatches(primaryStatus),
            Promise.all(extraStatuses.map((status) => readDispatches(status).then(
                (dispatches) => ({ dispatches, error: null as string | null }),
                (error: unknown) => ({ dispatches: [] as TrailerDispatchItem[], error: errorMessage(error) }),
            ))),
        ]).then(
            ([primary, extras]) => {
                if (cancelled) return
                setTrailers(mergeDispatchReads([primary, ...extras.map((extra) => extra.dispatches)]))
                setTrailersError(null)
                setFailedReads(extraStatuses.filter((_, i) => extras[i].error !== null))
                setTrailersNotice(extras.find((extra) => extra.error)?.error ?? null)
            },
            (error: unknown) => { if (!cancelled) { setTrailers([]); setTrailersError(errorMessage(error)); setFailedReads([]); setTrailersNotice(null) } },
        )
        const nocLoad = deploymentApi.getDeploymentNocDetails(buildNocDetailsRequest(row)).then(
            (noc) => { if (!cancelled) { setNocDetails(noc); setNocError(null) } },
            (error: unknown) => { if (!cancelled) { setNocDetails(null); setNocError(errorMessage(error)) } },
        ).finally(() => { if (!cancelled) setIsNocLoading(false) })
        Promise.allSettled([trailerLoad, nocLoad]).then(() => {
            if (!cancelled) setIsDetailLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [open, row, detailToken])

    // Report history for the Reported indicators and manual corrections: one read per detail load. No history = 404 = empty.
    React.useEffect(() => {
        if (!open || !row) return
        let cancelled = false
        deploymentApi.getFarmerReportedHistory(buildReportHistoryRequest(row)).then(
            (response) => { if (!cancelled) { setHistoryEntries(response.reported_farmer_details_result); setHistoryFailed(false) } },
            () => { if (!cancelled) { setHistoryEntries(null); setHistoryFailed(true) } },
        )
        return () => {
            cancelled = true
        }
    }, [open, row, detailToken])

    // A different deployment starts with every dispatch collapsed and no pending report / dialog state.
    React.useEffect(() => {
        setReportDispatchId(null)
        setApproveDispatchId(null)
        setCommentTarget(null)
        setReportedIds([])
        setReportComment("")
        setPlotCommentDraft(null)
        setFilterChoice(null)
        setCollapsedChoice(null)
        setExpandedChoice(null)
        setPlotChoice(null)
        revealRef.current = null
        setHistoryOpen(false)
        setApproveDialogOpen(false)
        setDeleteTarget(null)
        setTrailers([])
        setNocDetails(null)
        setTrailersError(null)
        setFailedReads([])
        setTrailersNotice(null)
        setNocError(null)
        setHistoryEntries(null)
        setHistoryFailed(false)
    }, [recordKey, open])

    // Live: an account (bootstrap) failure leaves every action disabled — say why.
    React.useEffect(() => {
        if (!open || session.status !== "error") return
        setToastMessage({ title: "Couldn't load your account", description: `${session.error ?? ""} Actions are disabled.`, type: "error" })
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [open, session.status, session.error])

    // Load-failure toasts (the Level 1 panel also shows the trailer error in place of the dispatch list).
    React.useEffect(() => {
        const failure = trailersError ?? nocError
        if (!open || !failure) return
        setToastMessage({ title: trailersError ? "Couldn't load trailer dispatches" : "Couldn't load NOC details", description: failure, type: "error" })
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [open, trailersError, nocError])

    const nocSummary = summarizeNoc(nocDetails)
    const nocReadiness = getNocReadiness(nocSummary, { loading: isNocLoading && nocDetails === null && !nocError, error: !!nocError })
    /** Why Approve is unavailable, shown beside the disabled button (Matic's NOC gates, in Matic's order). */
    const approveBlocker: string | null = !canMutate
        ? session.status === "ready" ? "You don't have permission to approve deployments." : session.status === "error" ? "Your account couldn't be loaded." : null
        : nocReadiness === "loading" ? "Checking NOC…"
        : nocError ? `NOC details are unavailable: ${nocError}`
        : getNocApprovalBlocker(nocSummary)
    /** Soft delete: AZ 1–3 (the type config), delete permission, and not on Verified rows (read-only). */
    const canDelete = session.status === "ready" && permissions.delete && deploymentType.supportsDelete && !!row && row.status !== "approved"
    /** What report history names among the loaded dispatches (deployment-report-index.ts); empty until it loads. */
    const reportIndex = React.useMemo(() => buildReportIndex(historyEntries ?? [], trailers), [historyEntries, trailers])
    /** Every loaded dispatch with its view status (deployment-dispatch-view.ts): what the local filter and the cards show. */
    const historyKnown = historyEntries !== null
    const dispatchViews = React.useMemo(
        () => (row ? classifyDispatches({ row, dispatches: trailers, reportIndex, historyKnown, fieldMarkers: deploymentType.reportedFieldMarkers }) : []),
        [row, trailers, reportIndex, historyKnown, deploymentType]
    )
    const filterCounts = row ? detailFilterCounts(dispatchViews, { row, failedReads, historyKnown }) : null
    /** The local filter: the row's default (where it was opened from) until the verifier picks another for this row. */
    const detailFilter: DetailFilter = filterChoice && filterChoice.key === recordKey ? filterChoice.filter : defaultDetailFilter(defaultTab, row?.status)
    const collapsedTrailers = new Set(collapsedChoice && collapsedChoice.key === recordKey ? collapsedChoice.trailers : [])
    const toggleTrailer = (trailerNo: string) => setCollapsedChoice((prev) => {
        const current = prev && prev.key === recordKey ? prev.trailers : []
        return { key: recordKey, trailers: current.includes(trailerNo) ? current.filter((t) => t !== trailerNo) : [...current, trailerNo] }
    })
    /** Opens a trailer group if it is collapsed (to reveal one of its dispatches). */
    const expandTrailer = (trailerNo: string) => setCollapsedChoice((prev) => (
        prev && prev.key === recordKey && prev.trailers.includes(trailerNo) ? { key: recordKey, trailers: prev.trailers.filter((t) => t !== trailerNo) } : prev
    ))
    const expandedDispatches = new Set(expandedChoice && expandedChoice.key === recordKey ? expandedChoice.ids : [])
    const expandedPlots = new Set(plotChoice && plotChoice.key === recordKey ? plotChoice.ids : [])
    const setPlotExpanded = (deploymentId: number, expand: boolean) => setPlotChoice((prev) => {
        const current = prev && prev.key === recordKey ? prev.ids : []
        if (current.includes(deploymentId) === expand) return prev
        return { key: recordKey, ids: expand ? [...current, deploymentId] : current.filter((id) => id !== deploymentId) }
    })
    const setDispatchExpanded = (deploymentDetailId: string, expand: boolean) => setExpandedChoice((prev) => {
        const current = prev && prev.key === recordKey ? prev.ids : []
        if (current.includes(deploymentDetailId) === expand) return prev
        return { key: recordKey, ids: expand ? [...current, deploymentDetailId] : current.filter((id) => id !== deploymentDetailId) }
    })
    const toggleDispatch = (deploymentDetailId: string) => setDispatchExpanded(deploymentDetailId, !expandedDispatches.has(deploymentDetailId))
    const dispatchById = (id: string | null) => (id ? trailers.find((d) => d.deployment_detail_id === id) ?? null : null)
    const viewById = (id: string | null) => (id ? dispatchViews.find((v) => v.dispatch.deployment_detail_id === id) ?? null : null)
    /**
     * Approve and Report (offersApprove / offersReport, deployment-dispatch-view.ts). Report: a dispatch waiting for the
     * verifier — plain pending, or pending with only the row's system validation (not a verifier report) — not on
     * Verified rows. A dispatch with an open verifier report is already in a correction workflow. Approve: one plain
     * Pending dispatch at a time, on Pending rows (unchanged). Each handler re-checks the gate for the dispatch it acts on.
     */
    const reportView = viewById(reportDispatchId)
    const canOfferReport = !!row && !!reportView && offersReport(row, reportView)
    const approveDispatch = dispatchById(approveDispatchId)
    const approveView = viewById(approveDispatchId)
    const canOfferApprove = !!row && !!approveView && offersApprove(row, approveView)
    /** Plot comments: viewed by anyone, edited on the dispatches of the row's own verification read (as before). */
    const commentDispatch = dispatchById(commentTarget?.dispatchId ?? null)
    const commentPlot = commentDispatch?.deployment_plots_data.find((p) => p.deployment_id === commentTarget?.deploymentId) ?? null
    const commentEditable = canMutate && (viewById(commentTarget?.dispatchId ?? null)?.inVerificationScope ?? false)
    const [comment, setComment] = React.useState("")
    const [isSavingComment, setIsSavingComment] = React.useState(false)
    const [localComments, setLocalComments] = React.useState<VerificationComment[]>([])
    const [isApproving, setIsApproving] = React.useState(false)
    const [showCommentInput, setShowCommentInput] = React.useState(false)
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
    const [isDataLoading, setIsDataLoading] = React.useState(false)
    const [isSurveyorPhoneVisible, setIsSurveyorPhoneVisible] = React.useState(false)
    const [mapCenter, setMapCenter] = React.useState<google.maps.LatLngLiteral | null>(null)
    const [mapZoom, setMapZoom] = React.useState<number>(17)
    const [isShowingSpecificLocation, setIsShowingSpecificLocation] = React.useState(false)
    const [isMapInteracted, setIsMapInteracted] = React.useState(false)
    const [resetCount, setResetCount] = React.useState(0)
    const [localFarmerPlots, setLocalFarmerPlots] = React.useState<MapPlot[]>([])
    /** V2: the plot whose boundary is being edited (full-screen, on this page), with the deployment it saves to. */
    const [boundaryTarget, setBoundaryTarget] = React.useState<{ mapPlot: MapPlot; deployment: SelectedDeployment } | null>(null)
    const [specificMarker, setSpecificMarker] = React.useState<google.maps.LatLngLiteral | null>(null)
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const isProgrammaticChange = React.useRef(false);


    // Synchronize map plots with the record when record or sheet open state changes
    // V2: map farmer from the data layer (mock farmer in mock mode, the loaded real plots in live mode).
    const baseFarmerData = React.useMemo(
        () => buildMapFarmer(record, trailers, { amountOf: deploymentType.plotAmount, sourceOf: deploymentType.dispatchSource }),
        [record, trailers, deploymentType]
    );
    React.useEffect(() => {
        if (record) setLocalFarmerPlots(baseFarmerData.plots);
    }, [record, open, baseFarmerData]);

    const dispatchActivityInfo = (
        <div className="space-y-2 text-xs text-left">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide text-[10px]">Dispatch Activity Log</h4>
            <div className="space-y-1 text-zinc-500 dark:text-zinc-400 font-medium">
                <p>• <strong>12 Jul 2026, 09:30 AM:</strong> Created by Operator John Doe</p>
                <p>• <strong>12 Jul 2026, 11:15 AM:</strong> Dispatched from Main Warehouse</p>
                <p>• <strong>13 Jul 2026, 02:45 PM:</strong> Received at Transit Hub Bangalore</p>
            </div>
        </div>
    )

    const deploymentActivityInfo = (
        <div className="space-y-2 text-xs text-left">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide text-[10px]">Deployment Activity Log</h4>
            <div className="space-y-1 text-zinc-500 dark:text-zinc-400 font-medium">
                <p>• <strong>14 Jul 2026, 10:00 AM:</strong> Assigned to Agent Rajesh Kumar</p>
                <p>• <strong>15 Jul 2026, 04:30 PM:</strong> GPS boundary confirmed on-site</p>
                <p>• <strong>16 Jul 2026, 11:00 AM:</strong> Seed varieties distributed</p>
            </div>
        </div>
    )

    const farmerData = React.useMemo(() => {
        return {
            ...baseFarmerData,
            plots: localFarmerPlots
        };
    }, [baseFarmerData, localFarmerPlots]);
    /** V2: marker semantics for this record's map plots — colour per source (fixed order), size per amount. */
    const markerSemantics = React.useMemo(() => ({ colors: sourceColors(farmerData.plots), scale: amountScale(farmerData.plots) }), [farmerData.plots]);

    // Calculate a persistent question location for this farmer
    const questionLocation = React.useMemo(() => {
        if (farmerData && farmerData.plots.length > 0) {
            return {
                lat: farmerData.plots[0].location.lat + 0.0005,
                lng: farmerData.plots[0].location.lng + 0.0005
            };
        }
        return null;
    }, [farmerData?.id]);
    
    // Use custom survey data if provided, otherwise fallback to default surveyData
    const activeSurveyData = customSurveyData || surveyData;

    // Reporting states
    const [isReportCommentMinimized, setIsReportCommentMinimized] = React.useState(false)
    const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false)
    const [scrollProgress, setScrollProgress] = React.useState(0)
    const [isApproveLoaded, setIsApproveLoaded] = React.useState(false)
    const scrollAreaRef = React.useRef<HTMLDivElement>(null)
    const [infoSwitchIndex, setInfoSwitchIndex] = React.useState(0)
    const [isInfoHovered, setIsInfoHovered] = React.useState(false)

    // Switch info every 5 seconds
    React.useEffect(() => {
        if (isInfoHovered) return;

        const timer = setInterval(() => {
            setInfoSwitchIndex(prev => (prev + 1) % 2);
        }, 5000);

        return () => clearInterval(timer);
    }, [isInfoHovered]);

    // Reset switch index when record changes
    React.useEffect(() => {
        setInfoSwitchIndex(0);
    }, [record?.id]);

    // Track scroll progress for Approve button
    React.useEffect(() => {
        // Wait for a bit longer to ensure the DOM and images are ready
        const initTimer = setTimeout(() => {
            const scrollArea = scrollAreaRef.current
            if (!scrollArea) return

            // Find the viewport element. Radix ScrollArea uses a specific data attribute.
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                             
            if (!viewport) return

            const handleScroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = viewport;
                const totalScrollable = scrollHeight - clientHeight;
                
                // If content is not scrollable (fits in view), it's effectively "at the bottom"
                if (totalScrollable <= 0) {
                    setScrollProgress(100)
                    setHasScrolledToBottom(true)
                    setIsApproveLoaded(true)
                    return
                }

                const progress = (scrollTop / totalScrollable) * 100
                setScrollProgress(progress)

                // If we've reached within 20px of the bottom, consider it "scrolled to bottom"
                if (scrollTop + clientHeight >= scrollHeight - 20) {
                    setHasScrolledToBottom(true)
                    setIsApproveLoaded(true)
                }
            }

            viewport.addEventListener('scroll', handleScroll)
            // Initial check
            handleScroll();

            // Store for cleanup
            (viewport as any)._cleanup = () => viewport.removeEventListener('scroll', handleScroll);
        }, 1200);

        return () => {
            clearTimeout(initTimer);
            const scrollArea = scrollAreaRef.current;
            if (scrollArea) {
                const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as any;
                if (viewport && viewport._cleanup) viewport._cleanup();
            }
        }
    }, [farmerData, activeSurveyData, open])

    // Reset scroll state when a new farmer is selected
    React.useEffect(() => {
        setHasScrolledToBottom(false)
        setScrollProgress(0)
        setIsApproveLoaded(false)
    }, [record?.id]) // Reset when record ID changes

    // Determine if we are previewing something else (image, video, file)
    const activePreview = previewItem && previewItem.type !== "map" ? previewItem : null;

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: env.googleMapsApiKey,
        libraries: LIBRARIES
    });

    const [mapVisible, setMapVisible] = React.useState(false)
    const [isMapReady, setIsMapReady] = React.useState(false)

    const onMapIdle = React.useCallback(() => {
        if (!isMapReady) {
            setIsMapReady(true);
        }
    }, [isMapReady]);

    // Reset state when record changes
    React.useEffect(() => {
        setComment("")
        setIsSavingComment(false)
        setLocalComments(record?.verificationComments || [])
        setIsApproving(false)
        setShowCommentInput(false)
        setPreviewItem(null);
        setZoom(1);
        setRotation(0);
        setImageMode("fit");
        setIsMapReady(false); // Reset map ready state
        setMapCenter(null); // Reset map center
        setSpecificMarker(null); // Reset specific marker
        setMapZoom(17); // Reset map zoom
        setIsShowingSpecificLocation(false); // Reset specific location state
        setIsMapInteracted(false); // Reset map interaction state
        setSelectedPlot(null); // V2: the previous record's plot selection doesn't carry over
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
            setIsDataLoading(false);
        }
    }, [record?.id, open])

    // V2: scroll to what the last change revealed (a plot picked on the map, the card left for Level 2 / 3), once.
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
            target.scrollIntoView({ block: reveal.block })
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

    if (!record) return null;

    // ── V2: workflow handlers (every call goes through deploymentApi — mock or live — then refetches) ──
    const refetchDetail = () => setDetailToken((t) => t + 1)
    /** After a successful mutation: reload the detail and reconcile the authoritative row, table and counts. */
    const afterMutation = () => {
        if (!row) {
            refetchDetail()
            return
        }
        // Live: a re-read row reloads the sheet by itself; reload explicitly only when it was not re-read.
        deploymentApi.reconcile(row).then(
            (rowRefreshed) => { if (!rowRefreshed) refetchDetail() },
            (error: unknown) => {
                refetchDetail()
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
                        setSpecificMarker(foundPlot.location);
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
    /** Report on an expanded Pending dispatch: its reportable values (source, plot amounts, locations) become selectable. */
    const startReport = (dispatch: TrailerDispatchItem) => {
        const view = viewById(dispatch.deployment_detail_id)
        if (!row || !canMutate || !view || !offersReport(row, view)) return
        setReportDispatchId(dispatch.deployment_detail_id)
        setReportedIds([])
        setReportComment("")
    }
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
     * Expands / collapses a dispatch; collapsing the one in report mode leaves report mode. Expanding selects the
     * dispatch on the map: its located plots are highlighted and the camera frames them — one plot is focused like a
     * deployment, several are fitted together, none leaves the camera where it is — then their markers bounce for as long
     * as the dispatch stays selected. It never opens the one-plot card. Collapsing removes its highlight (no camera move).
     */
    const toggleDispatchCard = (deploymentDetailId: string) => {
        const expanding = !expandedDispatches.has(deploymentDetailId)
        if (!expanding && reportDispatchId === deploymentDetailId) exitReportMode()
        toggleDispatch(deploymentDetailId)
        if (expanding) {
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
        const owner = trailers.find((d) => d.deployment_plots_data.some((p) => p.deployment_id === plot.deployment_id))
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
     * that dispatch, its trailer group and the dispatch open, the dispatch scrolls into view (then its plot card, if
     * needed), the plot card is marked and the dispatch briefly ringed. The plot is found by its stable id — the map's plot
     * id is the deployment_id (live map-data.ts) — never by a position in a list. (The mock map draws the demo map's own
     * plots, which carry no dispatch plot id: nothing is revealed there, as before.)
     */
    const selectPlotFromMap = (plot: Plot | null) => {
        const selection = newSelection() // a pick, or the card's close (a clear): the previous bounce stops
        setSelectedPlot(plot)
        setCameraFocus(null) // the map itself was clicked: no flight toward an older selection
        const seq = ++navSeqRef.current
        scrollCancelRef.current?.()
        scrollCancelRef.current = null
        setMapFocus(null)
        if (!plot) return
        bounceMarkers([plot.id], selection, "deployment") // the picked marker: the selected deployment
        const deploymentId = /^\d+$/.test(plot.id) ? Number(plot.id) : NaN
        const match = trailers.flatMap((dispatch) => dispatch.deployment_plots_data.map((p) => ({ dispatch, plot: p }))).find((x) => x.plot.deployment_id === deploymentId)
        if (!match) return
        const { dispatch: owner, plot: ownerPlot } = match
        const ownerView = viewById(owner.deployment_detail_id)
        if (ownerView && !inDetailFilter(ownerView, detailFilter)) setFilterChoice({ key: recordKey, filter: "all" })
        expandTrailer(owner.trailer_no)
        setDispatchExpanded(owner.deployment_detail_id, true)
        setHighlightDispatchId(owner.deployment_detail_id)
        setPlotExpanded(ownerPlot.deployment_id, true)
        setLocated({ deploymentId: ownerPlot.deployment_id, mapPlotId: plot.id })
        revealRef.current = { selector: `[data-plot-card="${ownerPlot.deployment_id}"]`, block: "center", context: `[data-dispatch-row="${owner.deployment_detail_id}"]`, seq, dispatchId: owner.deployment_detail_id, plotId: ownerPlot.deployment_id }
    }
    const toggleReportId = (id: string) =>
        setReportedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

    // Approve — one dispatch at a time; Matic's NOC gates first, then the confirmation dialog.
    const handleApproveClick = (dispatch: TrailerDispatchItem) => {
        const view = viewById(dispatch.deployment_detail_id)
        if (!row || !canMutate || !view || !offersApprove(row, view)) return
        if (nocError) {
            showToast("Cannot approve", `NOC details are unavailable: ${nocError}`, "error")
            return
        }
        const blocker = getNocApprovalBlocker(nocSummary)
        if (blocker) {
            showToast("Cannot approve", blocker, "error")
            return
        }
        setApproveDispatchId(dispatch.deployment_detail_id)
        setApproveDialogOpen(true)
    }
    const handleConfirmApprove = async () => {
        if (!approveDispatch || !row || !canMutate || !canOfferApprove || nocError || getNocApprovalBlocker(nocSummary)) return
        setIsApprovingDispatch(true)
        const result = await deploymentApi.updateDeploymentTrailerDispatch(buildApproveDispatchRequest(approveDispatch, session.verifierPhone))
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setIsApprovingDispatch(false)
        setApproveDialogOpen(false)
        if ("error" in result) {
            showToast("Approval failed", result.error, "error")
        } else if (result.status === 200) {
            showToast("Approved Successfully", "Deployment trailer dispatch data updated successfully!", "success")
            afterMutation()
        } else {
            showToast("Approval failed", "Failed to update deployment trailer dispatch data!", "error")
        }
    }

    // Report — the selected fields become one reportFarmerDetails call, then the dispatches are rejected.
    const handleReportSubmit = async () => {
        if (!row || !reportComment.trim() || !canMutate || row.status === "approved" || !canOfferReport) return
        const comment = reportComment.trim()
        const selections = toReportSelections(reportedIds, trailers)
        const { report, dispatchUpdate } = buildReportRequests(row, selections, comment, session.verifierPhone)
        setIsSubmittingReport(true)
        // Two calls, no rollback (as in matic-dash). If the report is saved but the dispatch update fails, say exactly
        // that — nothing is retried automatically — and reload the authoritative state.
        let failure: string | null = null
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
        }
        setIsSubmittingReport(false)
        if (failure && reportSaved) {
            setIsReportingFinalStep(false)
            exitReportMode()
            showToast("Report partly saved", `The reported fields were saved, but the dispatch status was not updated: ${failure}`, "error")
            afterMutation()
            return
        }
        if (failure) {
            showToast("Report failed", failure, "error")
            return
        }
        const at = Date.now()
        setLocalReports((prev) => {
            const next = { ...prev }
            for (const selection of selections) next[selection.dispatch.deployment_detail_id] = { comment, at }
            return next
        })
        setReportSuccess(true)
        setTimeout(() => {
            setReportSuccess(false)
            setIsReportingFinalStep(false)
            exitReportMode()
            afterMutation()
            showToast("Reported Successfully", "Reported farmer data successfully!", "success")
        }, 1500)
    }

    // NOC — view in the existing media preview; approve / reject while a decision is still needed.
    /** The row's AZ code for its own NOC (the NOC read asks for that AZ only). */
    const nocAzLabel = (azId: number) => (azId === row?.az_id && row.az_code ? row.az_code : `AZ ${azId}`)
    const openNocAt = (index: number) => {
        const doc = nocSummary.docs[index]
        if (!doc) return
        setNocIndex(index)
        setPreviewItem({ id: `noc-${doc.az_id}`, question: `NOC — ${nocAzLabel(doc.az_id)}`, label: `NOC — ${nocAzLabel(doc.az_id)}`, type: "image", answer: doc.noc })
    }
    const openNoc = () => {
        if (nocError) {
            showToast("NOC", `NOC details are unavailable: ${nocError}`, "error")
            return
        }
        if (nocSummary.docs.length === 0) {
            showToast("NOC", "No Noc found for this deployment", "error")
            return
        }
        // Undecided NOC first (the row's own AZ preferred), else the row's own AZ.
        const isUndecided = (doc: (typeof nocSummary.docs)[number]) => doc.franchise_status !== "approved"
        const ownIndex = nocSummary.docs.findIndex((doc) => doc.az_id === row?.az_id)
        const firstUndecided = nocSummary.docs.findIndex(isUndecided)
        const index = ownIndex >= 0 && isUndecided(nocSummary.docs[ownIndex]) ? ownIndex
            : firstUndecided >= 0 ? firstUndecided
            : Math.max(ownIndex, 0)
        openNocAt(index)
    }
    const handleNocDecision = async (decision: "approved" | "rejected") => {
        const doc = nocSummary.docs[nocIndex]
        if (!doc || !row || !canMutate || row.status === "approved" || doc.franchise_status === "approved") return
        setIsSubmittingNoc(true)
        const result = await deploymentApi.updateFarmerDeploymentNOC(buildNocDecisionRequest(row, doc.az_id, decision, session.verifierPhone))
            .catch((error: unknown) => ({ status: 0, error: errorMessage(error) }))
        setIsSubmittingNoc(false)
        if ("error" in result) {
            showToast("NOC update failed", result.error, "error")
        } else if (result.status === 200) {
            showToast(decision === "approved" ? "Noc qualified successfully" : "Noc reported successfully", `NOC for ${nocAzLabel(doc.az_id)} ${decision}.`, "success")
            setPreviewItem(null)
            afterMutation()
        } else {
            showToast("NOC update failed", decision === "approved" ? "Failed to qualify Noc" : "Failed to report Noc", "error")
        }
    }

    // Pre-Sample — Matic navigation (approved sampling → /samples/pre, otherwise the verification page).
    const openPreSample = () => {
        if (!row) return
        navigate(nocSummary.samplingStatus === "approved" ? `/samples/pre/${row.farmer_id}` : `/samples/verification/pre/${row.farmer_id}`)
    }

    // Report history — its own dialog (independent of any other panel), for every status; the row's AZ only.
    // No history (the API's 404) reads as an empty list; a real failure stays in the dialog with Retry.
    /** Report history: of one dispatch when opened from it (its deployment_detail_id), else of the whole deployment. */
    const openHistory = async (deploymentDetailId?: string) => {
        if (!row) return
        setHistoryScope(deploymentDetailId ?? null)
        setHistoryItems(null)
        setHistoryError(null)
        setHistoryOpen(true)
        try {
            const response = await deploymentApi.getFarmerReportedHistory(buildReportHistoryRequest(row))
            setHistoryItems(response.reported_farmer_details_result)
        } catch (error) {
            setHistoryError(errorMessage(error))
        }
    }

    // Delete — soft delete of a whole dispatch or one plot deployment (matic-dash handleDeleteSubmit; AZ 1–3 only).
    const openDelete = (target: DeleteTarget) => {
        // Only the dispatches of the row's own verification read can be deleted (as before the All view).
        if (!canDelete || !dispatchViews.find((v) => v.dispatch.deployment_detail_id === target.dispatch.deployment_detail_id)?.inVerificationScope) return
        setDeleteComment("")
        setDeleteError(false)
        setDeleteTarget(target)
    }
    const closeDelete = () => {
        setDeleteTarget(null)
        setDeleteComment("")
        setDeleteError(false)
    }
    const handleDeleteSubmit = async () => {
        if (!deleteTarget || !row) return
        if (!canDelete) {
            showToast("Delete failed", "You are not authorized for this action", "error")
            return
        }
        if (!deleteComment.trim()) {
            setDeleteError(true)
            return
        }
        const target = deleteTarget
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
            afterMutation()
        } else {
            showToast("Delete failed", "Failed to delete deployment trailer!", "error")
        }
    }

    // Plot comment — the single plot.comment field, from the plot card's comment dialog.
    const savePlotComment = async () => {
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
            afterMutation()
            showToast("Comment saved", `Comment ${saved.comment ? "updated" : "added"} for ${saved.plot_id}.`, "success")
        } else {
            showToast("Comment failed", "Something went wrong, failed to update comment on deployment!!", "error")
        }
    }

    const activeNocDoc = activePreview?.id.startsWith("noc-") ? nocSummary.docs[nocIndex] : undefined
    const canDecideNoc = !!activeNocDoc && canMutate && row?.status !== "approved" && activeNocDoc.franchise_status !== "approved"
    /** Dispatches the current report selection would mark for correction (every plot of each goes back). */
    const reportedDispatches = [...new Map(toReportSelections(reportedIds, trailers).map((s) => [s.dispatch.deployment_detail_id, s.dispatch])).values()]
    const reportsPlotField = reportedIds.some((id) => !id.startsWith("source_name:"))
    const verifiedAtMs = parseEpochMs(row?.verified_at)
    /** The deployment marked in the Level 1 list: the one located from its row, else (live) the map's selected plot. */
    const locatedPlotId: number | null = !selectedPlot ? null
        : located && located.mapPlotId === String(selectedPlot.id) ? located.deploymentId
        : /^\d+$/.test(String(selectedPlot.id)) ? Number(selectedPlot.id) : null
    const historyRows = historyItems ? toReportHistoryRows(historyScope ? historyForDispatch(historyItems, historyScope) : historyItems, trailers) : []
    const historyDispatch = historyScope ? trailers.find((d) => d.deployment_detail_id === historyScope) ?? null : null

    /** Status message — the existing Deployment subheader patterns (Pending has none: its amber badge is used). */
    const renderStatusSubheader = () => (
        <>
            {row?.status === "approved" && (
                <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border-b border-emerald-100/50 dark:border-emerald-900/20 px-6 py-2.5 flex items-center gap-2 text-left w-full animate-in fade-in duration-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                        Verified by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{row.verified_by ?? "—"}</strong>
                        {verifiedAtMs !== null ? <> • {format(new Date(verifiedAtMs), "dd MMM yyyy, hh:mm a")}</> : null}
                    </span>
                </div>
            )}
        </>
    )

    const handleSaveComment = () => {
        if (!comment.trim()) return
        setIsSavingComment(true)
        // Simulate API call
        setTimeout(() => {
            const newComment: VerificationComment = {
                id: `local-${Date.now()}`,
                verifier: "Current User", // In a real app, this would be the logged-in user
                date: new Date(),
                text: comment
            }
            setLocalComments(prev => [...prev, newComment])
            setComment("")
            setShowCommentInput(false)
            setIsSavingComment(false)
        }, 600)
    }

    const handleApprove = () => {
        setIsApproving(true)
        // Simulate API call with 1 second delay
        setTimeout(() => {
            console.log("Approving record:", record.id, "with comment:", comment)
            
            // Move to next record if available, otherwise close
            if (!isLast) {
                onNext()
                setIsApproving(false)
            } else {
                onOpenChange(false)
            }
        }, 1000)
    }

    const resetMapToFarmer = () => {
        setCameraFocus(null);
        setHighlightDispatchId(null);
        newSelection();
        if (mapRef.current) {
            isProgrammaticChange.current = true;
        }
        setMapCenter(null);
        setSpecificMarker(null);
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
        for (const dispatch of trailers) {
            const plot = dispatch.deployment_plots_data.find((p) => p.deployment_id === id)
            if (plot) return { dispatch, plot, view: viewById(dispatch.deployment_detail_id) }
        }
        return null
    }
    const selectedDeployment = deploymentOf(selectedMapPlot)
    /** Boundary editing: the existing edit permission (as for report / approve / comments). */
    const canEditBoundary = canMutate
    const openBoundaryEditor = () => {
        if (!canEditBoundary || !selectedMapPlot || !selectedDeployment) return
        newSelection() // the editor takes over: the map's bounce stops (the selection itself stays behind the editor)
        setBoundaryTarget({ mapPlot: selectedMapPlot, deployment: selectedDeployment })
    }
    /** The real save (matic-dash uploadGeoJson); rejects with a message so the editor keeps the shape. */
    const saveBoundary = async (path: google.maps.LatLngLiteral[], areaSquareMeters: number) => {
        if (!boundaryTarget || !canEditBoundary) throw new Error("Editing plot boundaries isn't allowed for this account.")
        const { mapPlot, deployment } = boundaryTarget
        const request = buildUploadGeoJsonRequest(deployment.plot, deployment.dispatch, path, areaSquareMeters)
        const result = await deploymentApi.uploadGeoJson(request).catch((error: unknown) => { throw new Error(errorMessage(error)) })
        if (result.status !== 200) throw new Error(`The server answered HTTP ${result.status}.`)
        // saved: the persisted outline is shown at once; the re-read then brings the server's copy
        setLocalFarmerPlots((plots) => plots.map((p) => (p.id === mapPlot.id ? { ...p, path } : p)))
        setSelectedPlot((p: MapPlot | null) => (p && p.id === mapPlot.id ? { ...p, path } : p))
        setBoundaryTarget(null)
        afterMutation()
        showToast("Boundary saved", `${plotLabel(deployment.plot)} · ${request.geoJsonData[0].calculated_area} acres`, "success")
    }
    const plotCard = selectedMapPlot ? (
        <PlotMapCard
            key={selectedMapPlot.id}
            mapPlot={selectedMapPlot}
            deployment={selectedDeployment}
            deploymentType={deploymentType}
            color={markerSemantics.colors.colorOf(selectedDeployment ? deploymentType.dispatchSource(selectedDeployment.dispatch) : selectedMapPlot.source)}
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

    // Determine if we should show the persistent map
    const showPersistentMap = mapVisible && record;

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
                                >
                                    <RotateCw className="h-4 w-4" />
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
                                    onClick={() => setPreviewItem(null)}
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
                                    onClick={() => setPreviewItem(null)}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black relative">
                            <video
                                key={item.answer as string}
                                src={item.answer as string}
                                controls
                                autoPlay
                                onError={() => setFailedVideoUrl(item.answer as string)}
                                className={cn(
                                    "w-full h-full transition-all duration-300 bg-black",
                                    imageMode === "fill" ? "object-cover" : "object-contain"
                                )}
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
                                    onClick={() => setPreviewItem(null)}
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
                    {/* Persistent Map Module - Positioned next to the side module, sliding with it */}
                    <div 
                        className={cn(
                            "map-preview-module absolute top-0 bottom-0 bg-white dark:bg-zinc-950 flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-all duration-500 ease-in-out z-[-1]",
                            open ? "opacity-100" : "opacity-0"
                        )}
                        style={{ 
                            width: "50vw", 
                            right: "100%",
                            pointerEvents: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 relative">
                            {/* Map Loader Overlay */}
                            <div className={cn(
                                "absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-opacity duration-300",
                                isMapReady ? "opacity-0 pointer-events-none" : "opacity-100"
                            )}>
                                <div className="text-center space-y-3">
                                    <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Initializing Map...</p>
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
                                            specificMarker={specificMarker}
                                            onReset={resetMapToFarmer}
                                            onInteraction={() => setIsMapInteracted(true)}
                                            resetCount={resetCount}
                                            questionLocation={questionLocation}
                                            setIsMapInteracted={setIsMapInteracted}
                                            mapRef={mapRef}
                                            isProgrammaticChange={isProgrammaticChange}
                                            hasLocationQuestion={hasLocationQuestion}
                                            selectedPlot={selectedPlot}
                                            setSelectedPlot={selectPlotFromMap}
                                            hoveredPlotId={hoveredPlotId}
                                            setHoveredPlotId={setHoveredPlotId}
                                            isShowingSpecificLocation={isShowingSpecificLocation}
                                            isMapInteracted={isMapInteracted}
                                            onEditClick={canEditBoundary ? openBoundaryEditor : undefined}
                                            editEnabled={!!selectedMapPlot && !!selectedDeployment}
                                            markerFill={(plot) => markerSemantics.colors.colorOf(plot.source)}
                                            markerDiameter={(plot) => markerSemantics.scale.diameterOf(plot.amount)}
                                            legend={{ sources: markerSemantics.colors.legend, scale: markerSemantics.scale, amountLabel: deploymentType.amountLabel }}
                                            detailsCard={plotCard}
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
                                                <DialogTitle className="sr-only">Edit plot boundary</DialogTitle>
                                                <DialogDescription className="sr-only">Full-screen map for editing the selected plot&apos;s boundary</DialogDescription>
                                                {boundaryTarget && (
                                                    <PlotBoundaryEditor
                                                        plots={farmerData.plots}
                                                        target={boundaryTarget.mapPlot}
                                                        title={plotLabel(boundaryTarget.deployment.plot)}
                                                        subtitle={[dispatchLabel(boundaryTarget.deployment.dispatch), deploymentType.dispatchSource(boundaryTarget.deployment.dispatch)].filter(Boolean).join(" · ")}
                                                        markerFill={(plot) => markerSemantics.colors.colorOf(plot.source)}
                                                        markerDiameter={(plot) => markerSemantics.scale.diameterOf(plot.amount)}
                                                        onCancel={() => setBoundaryTarget(null)}
                                                        onSave={saveBoundary}
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
                    </div>
                {/* Header section */}
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-12 w-12 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <AvatarImage src={record.farmer.avatar} />
                                    <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{record.farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                                        {record.farmer.name}
                                    </SheetTitle>
                                    <SheetDescription asChild>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 font-medium">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                {[record.village, record.block, record.state, record.country].filter(Boolean).join(", ")}
                                            </span>
                                        </div>
                                    </SheetDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 h-14">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    onClick={handleCloseAll}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Fixed Engagement Details Bar */}
                    <div className="bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        <div>{record.area} Acres . {record.plots} {record.plots === 1 ? "Plot" : "Plots"}</div>
                        <div>{[record.api.az_code || `AZ ${record.api.az_id}`, record.api.az_name].filter(Boolean).join(" . ")}</div>
                    </div>
                    {/* V2: Level 1 section header (fixed, like the existing "Deployments" header): "Dispatches", the local
                        filter dropdown under it, icon actions */}
                    {row && (
                        <DeploymentSummaryBar
                            row={row}
                            noc={nocSummary}
                            filter={!isDataLoading && !trailersError && trailers.length > 0 && filterCounts
                                ? <DetailStatusFilter value={detailFilter} counts={filterCounts} onChange={(filter) => setFilterChoice({ key: recordKey, filter })} />
                                : undefined}
                            onOpenHistory={() => openHistory()}
                            onOpenNoc={openNoc}
                            onOpenPreSample={openPreSample}
                        />
                    )}
                    {row && renderStatusSubheader()}
                    {/* V2: Level 1, still fixed: NOC readiness on Pending rows */}
                    {row && row.status === "pending" && (
                        <NocReadinessStrip row={row} readiness={nocReadiness} onOpenNoc={openNoc} />
                    )}
                    </div>


                {/* Content section - Style 5 (Feedback based) */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 relative [&>[data-radix-scroll-area-viewport]>div]:!block">
                    {isDataLoading || (isDetailLoading && trailers.length === 0) ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-in fade-in duration-500">
                            <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                        </div>
                    ) : row ? (
                        /* The deployment: every dispatch of the farmer + deployment + AZ, in collapsible trailer groups, through the local
                           filter; a dispatch expands in place into its working surface (plots, actions) */
                        <div className="p-6">
                            <DispatchCards
                                row={row}
                                deploymentType={deploymentType}
                                loadedStatuses={readStatuses.filter((status) => !failedReads.includes(status))}
                                dispatches={dispatchViews}
                                filter={detailFilter}
                                localReports={localReports}
                                reporterName={session.displayName}
                                trailersError={trailersError}
                                failedReads={failedReads}
                                readError={trailersNotice}
                                historyFailed={historyFailed}
                                expandedDispatches={expandedDispatches}
                                onToggleDispatch={toggleDispatchCard}
                                locatedPlotId={locatedPlotId}
                                work={{
                                    canMutate,
                                    approveBlocker,
                                    onReviewNoc: canMutate && nocSummary.docs.length > 0 && !nocError ? openNoc : undefined,
                                    reportDispatchId,
                                    reportedIds,
                                    onStartReport: startReport,
                                    onCancelReport: exitReportMode,
                                    onToggleReportField: toggleReportId,
                                    onFinalizeReport: () => setIsReportingFinalStep(true),
                                    onApprove: handleApproveClick,
                                    onComment: openComment,
                                    onDeletePlot: canDelete ? (dispatch, plot) => openDelete({ mode: "Deployment", dispatch, plot }) : undefined,
                                    onPreview: handleItemClick,
                                }}
                                onDeleteDispatch={canDelete ? (dispatch) => openDelete({ mode: "Dispatch", dispatch }) : undefined}
                                onRetry={refetchDetail}
                                reportIndex={reportIndex}
                                onOpenHistory={openHistory}
                                expandedPlots={expandedPlots}
                                onTogglePlot={togglePlotCard}
                                collapsedTrailers={collapsedTrailers}
                                onToggleTrailer={toggleTrailer}
                                onShowAll={() => setFilterChoice({ key: recordKey, filter: "all" })}
                                mapFocusDispatchId={mapFocus?.id ?? null}
                                mapFocusPlotId={mapFocus?.plotId ?? null}
                            />
                        </div>
                    ) : null}
                </ScrollArea>

                        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 flex flex-col relative">
                            <div className="p-4 flex items-center justify-between gap-4">
                                {/* Left: Navigation */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onPrevious}
                                        disabled={isFirst || isDataLoading}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex + 1} / {totalCount}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onNext}
                                        disabled={isLast || isDataLoading}
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

            </SheetContent>
        </Sheet>

            <Dialog open={!!activePreview} onOpenChange={(val) => {
                if (!val) setPreviewItem(null);
            }}>
                <DialogPortal>
                    <DialogContent className="max-w-[1200px] w-[95vw] h-[800px] max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl z-[500] flex items-center justify-center rounded-2xl [&>button]:hidden">
                        <DialogTitle className="sr-only">Attachment Preview</DialogTitle>
                        <DialogDescription className="sr-only">Basic view of the survey attachment</DialogDescription>
                        
                        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/5">
                            {activePreview && renderPreviewContent(activePreview)}
                            {/* V2: NOC review footer (matic-dash DocumentVerifierDialog: "Report" / "Approve") */}
                            {activeNocDoc && (
                                <div className="absolute bottom-0 inset-x-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
                                    <div className="text-left min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">NOC — {nocAzLabel(activeNocDoc.az_id)}</p>
                                        <p className="text-xs text-zinc-500">
                                            {canDecideNoc ? "This farmer has submitted an NOC, please review." : `Status: ${activeNocDoc.franchise_status}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {nocSummary.docs.length > 1 && (
                                            <div className="flex items-center gap-1 mr-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={nocIndex === 0} onClick={() => openNocAt(nocIndex - 1)}>
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-[11px] font-bold text-zinc-500 tabular-nums">{nocIndex + 1} / {nocSummary.docs.length}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={nocIndex === nocSummary.docs.length - 1} onClick={() => openNocAt(nocIndex + 1)}>
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {canDecideNoc && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    className="h-9 px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                                                    disabled={isSubmittingNoc}
                                                    onClick={() => handleNocDecision("rejected")}
                                                >
                                                    <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                    Report
                                                </Button>
                                                <Button
                                                    className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                    disabled={isSubmittingNoc}
                                                    onClick={() => handleNocDecision("approved")}
                                                >
                                                    {isSubmittingNoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Approve</>}
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
                                        disabled={isSubmittingReport || !reportComment.trim() || !permissions.edit}
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
                    {approveDispatch && (() => {
                        const reportedFields = reportedIds.filter((id) => id.endsWith(`:${approveDispatch.deployment_detail_id}`)).length
                        return (
                            <div className="bg-white dark:bg-zinc-950">
                                <div className="p-6 pb-0 space-y-1">
                                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Confirm approval</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {reportedFields === 0 ? 1 : 0} out of 1 trailer deployments can be approved.
                                    </p>
                                </div>
                                <div className="p-6">
                                    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-left">
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                                            {approveDispatch.trailer_no || dispatchLabel(approveDispatch)} (1)
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            {reportedFields === 0 ? "No reported fields" : `${reportedFields} reported field${reportedFields > 1 ? "s" : ""}`}
                                            {" · "}{approveDispatch.source_name} · {approveDispatch.num_tons} Tons · {formatDispatchDate(approveDispatch.date)}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                    <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={() => setApproveDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                        onClick={handleConfirmApprove}
                                        disabled={isApprovingDispatch || reportedFields > 0 || !permissions.edit}
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

            {/* V2: Report history (matic-dash getFarmerReportedHistory), independent of any other panel */}
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
                            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{historyScope ? "Report history" : "History"}</h3>
                            {historyScope ? (
                                <p data-history-scope={historyScope} className="text-sm font-mono font-semibold text-zinc-600 dark:text-zinc-300 [overflow-wrap:anywhere]">
                                    {historyDispatch ? dispatchLabel(historyDispatch) : `DISP-${historyScope}`}
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">Track the changes done so far{row ? ` · ${row.az_code || `AZ ${row.az_id}`}` : ""}.</p>
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
                                <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => openHistory(historyScope ?? undefined)}>Retry</Button>
                            </div>
                        ) : historyItems === null ? (
                            <div data-history-state="loading" className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 text-zinc-300 animate-spin" />
                            </div>
                        ) : historyRows.length === 0 ? (
                            <div data-history-state="empty" className="py-8 text-center space-y-1">
                                {historyScope ? (
                                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No report history for this dispatch.</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No report history</p>
                                        <p className="text-xs text-zinc-500">Nothing has been reported for this deployment ({row?.az_code || `AZ ${row?.az_id}`}).</p>
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
                                    disabled={isDeleting || !deleteComment.trim() || !canDelete}
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
