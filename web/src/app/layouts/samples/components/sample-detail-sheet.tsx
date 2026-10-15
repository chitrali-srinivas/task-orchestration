"use client"

// Samples — the detail, opened from ONE sample row and shown in the context of that sample's FARMER: every sample of
// theirs across their AZs (Farmer → AZ → samples), filtered by status, with the selected sample revealed (expanded,
// ringed, scrolled to, flown to on the map). Built in Deployment V2's detail-sheet language (deployment-detail-sheet.tsx):
// a right Sheet with the map module beside it, the header (avatar, farmer, location), the details bar (sample count
// with its purpose breakdown on hover · plots | the farmer's AZ codes), the fixed summary bar with V2's
// DetailStatusFilter and History action, the boundary readiness strip, collapsible AZ groups (V2's trailer groups)
// with one-line purpose rows, the cards, and Previous / Next FARMER.
//
// Workflow (every decision comes from the API — the sheet never derives a status, a blocker or a plot):
//   approve   one sample at a time, from its card (V2: one dispatch at a time); a confirm dialog
//   report    V2's flow: Report on the card → its reportable values become selectable → "Report Selected (n)" →
//             the finalize dialog (required comment) → success state → toast
//   boundary  control samples: Draw / Edit opens Deployment V2's PlotBoundaryEditor (reused); Save calls saveBoundary;
//             the server validates, creates the plot and its id, and assigns it
//   map       as V2: expanding a card flies to it; a marker click reveals its card (switching the status view if
//             needed, expanding and scrolling to it)
import * as React from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, MapPin, PencilRuler, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { env } from "@/platform/env"
import { DetailStatusFilter, EmptyBox, GroupHeader } from "@/app/layouts/deployment-v2-oct-26/components/deployment-details-panel"
import type { DetailFilter } from "@/app/layouts/deployment-v2-oct-26/components/deployment-dispatch-view"
import { PlotBoundaryEditor } from "@/app/layouts/deployment-v2-oct-26/components/plot-boundary-editor"
import type { MapPlot } from "@/app/layouts/deployment-v2-oct-26/data/map-data"
import { BUCKET_LABEL, KIND_LABEL, PURPOSE_LABEL, PURPOSE_LONG_LABEL, farmerName } from "../domain/labels"
import type { FarmerRef, ReportableField, Sample, SampleKind, SamplePurpose, StatusBucket } from "../domain/types"
import { samplesApi } from "../data/data-source"
import { newIdempotencyKey } from "../data/samples-api"
import { useFarmerDetail, useFarmerHistory } from "../data/use-samples-data"
import type { SamplesTab } from "./columns"
import { SampleCard, type ReportMode, type SampleCardActions } from "./sample-card"
import { ApproveDialog, CommentDialog, HistoryDialog, PhotoPreviewDialog, ReportFinalizeDialog } from "./sample-dialogs"
import { PURPOSE_COLOR } from "./sample-markers"
import { SamplesMap, type MapFocus } from "./samples-map"

// Same loader id + libraries as Deployment V2 (and matic-dash): the JS API loader refuses a second load with other options.
const LIBRARIES: "geometry"[] = ["geometry"]
const KIND_ORDER: SampleKind[] = ["control", "deployment"]
const PURPOSE_ORDER: SamplePurpose[] = ["pre", "start", "harvest", "eoy", "eo3y", "eo5y"]
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

/** The Samples buckets in V2's DetailFilter vocabulary (approved ↔ "verified"; the labels are V2's already). */
type LocalFilter = "all" | StatusBucket
const toV2Filter = (f: LocalFilter): DetailFilter => (f === "approved" ? "verified" : f)
const fromV2Filter = (f: DetailFilter): LocalFilter => (f === "verified" ? "approved" : f)
const FILTER_LABEL: Record<LocalFilter, string> = { all: "All", ...BUCKET_LABEL }

interface Toast { type: "success" | "error"; title: string; description: string }

/** V2's avatar initials, from the farmer's name (or the derived id when the dataset has no name). */
const initials = (farmer: { id: string; name: string | null }) => farmerName(farmer).replace(/[^A-Za-z0-9]/g, "").substring(0, 2).toUpperCase() || "?"

/** Deployment V2's NocReadinessStrip pattern: why approval is blocked for this view, and the way forward. */
function ReadinessStrip({ children, action, onAction, ...rest }: { children: React.ReactNode; action?: string; onAction?: () => void } & Record<`data-${string}`, string>) {
    return (
        <div className="px-6 py-2.5 border-b flex items-center gap-2 text-left w-full bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20" {...rest}>
            <PencilRuler className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="flex-1 min-w-0 text-[11px] font-medium text-amber-800 dark:text-amber-300">{children}</span>
            {action && onAction && (
                <button type="button" onClick={onAction} className="shrink-0 text-[10px] font-bold uppercase tracking-wider hover:underline underline-offset-2 text-amber-800 dark:text-amber-300">{action}</button>
            )}
        </div>
    )
}

/** PlotBoundaryEditor (Deployment V2, reused unchanged) draws MapPlots: samples become editor plots here. */
function toEditorPlot(s: Sample, withOutline: boolean): MapPlot {
    return {
        id: s.sample_id,
        farmerId: s.farmer_id,
        name: s.sample_code ?? s.sample_id,
        area: s.plot?.area_acres ?? 0,
        deployedTons: 0,
        path: withOutline ? s.plot?.outline ?? undefined : undefined,
        location: s.location!,
        color: "#ffffff",
        deploymentId: null,
        dispatchId: null,
        source: null,
        amount: null,
    }
}

export function SampleDetailSheet({
    farmerId,
    farmer,
    selectedSampleId,
    open,
    onOpenChange,
    onNext,
    onPrevious,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    openedFrom,
    canVerify,
}: {
    /** The FARMER in context (from the opened sample row, or Previous / Next). */
    farmerId: string | null
    /** The farmer as the table row carries it (header while the detail loads). */
    farmer: FarmerRef | null
    /** The sample row that opened the detail: revealed once the farmer's samples load. Null after Previous / Next. */
    selectedSampleId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onNext: () => void
    onPrevious: () => void
    isFirst: boolean
    isLast: boolean
    currentIndex: number
    totalCount: number
    openedFrom: SamplesTab
    canVerify: boolean
}) {
    const detail = useFarmerDetail(open ? farmerId : null)
    const data = detail.data && detail.data.farmer.id === farmerId ? detail.data : null
    const samples = React.useMemo(() => data?.samples ?? [], [data])
    const context = data?.farmer ?? farmer

    // local status view: opened from a tab → that tab; re-chosen per farmer (never carried to another one)
    const [filterChoice, setFilterChoice] = React.useState<{ key: string | null; filter: LocalFilter }>({ key: null, filter: "all" })
    const filter: LocalFilter = filterChoice.key === farmerId ? filterChoice.filter : openedFrom
    const setFilter = React.useCallback((f: LocalFilter) => setFilterChoice({ key: farmerId, filter: f }), [farmerId])
    const counts = data?.sample_counts
    const visible = React.useMemo(() => samples.filter((s) => filter === "all" || s.bucket === filter), [samples, filter])
    const inViewIds = React.useMemo(() => new Set(visible.map((s) => s.sample_id)), [visible])

    // selection shared by the map and the list, expanded cards, collapsed AZ groups (all per farmer)
    const [selection, setSelection] = React.useState<{ key: string | null; id: string | null }>({ key: null, id: null })
    const selectedId = selection.key === farmerId ? selection.id : null
    const [expanded, setExpanded] = React.useState<{ key: string | null; ids: Set<string> }>({ key: null, ids: new Set() })
    const expandedIds = React.useMemo(() => (expanded.key === farmerId ? expanded.ids : new Set<string>()), [expanded, farmerId])
    const [collapsedAzs, setCollapsedAzs] = React.useState<{ key: string | null; ids: Set<number> }>({ key: null, ids: new Set() })
    const collapsedAzIds = collapsedAzs.key === farmerId ? collapsedAzs.ids : new Set<number>()
    const [mapFocus, setMapFocus] = React.useState<MapFocus | null>(null)
    const [reveal, setReveal] = React.useState<{ id: string; seq: number } | null>(null)
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>())

    // V2's report mode: one card at a time, its selected fields, then the finalize dialog
    const [reportSampleId, setReportSampleId] = React.useState<string | null>(null)
    const [reportFields, setReportFields] = React.useState<ReportableField[]>([])
    const [reportComment, setReportComment] = React.useState("")
    const [finalizeOpen, setFinalizeOpen] = React.useState(false)
    const [reportSuccess, setReportSuccess] = React.useState(false)

    const [approveTarget, setApproveTarget] = React.useState<Sample | null>(null)
    const [commentTarget, setCommentTarget] = React.useState<Sample | null>(null)
    const [previewTarget, setPreviewTarget] = React.useState<Sample | null>(null)
    const [boundaryTarget, setBoundaryTarget] = React.useState<Sample | null>(null)
    const [historyTarget, setHistoryTarget] = React.useState<Sample | null>(null)
    const [busy, setBusy] = React.useState<"approve" | "report" | "comment" | null>(null)
    const [dialogError, setDialogError] = React.useState<string | null>(null)
    const [toast, setToast] = React.useState<Toast | null>(null)
    const idempotencyKey = React.useRef<string>("")
    const history = useFarmerHistory(farmerId, !!historyTarget)

    const exitReportMode = React.useCallback(() => {
        setReportSampleId(null)
        setReportFields([])
        setReportComment("")
        setFinalizeOpen(false)
    }, [])

    // another farmer resets the per-farmer working state
    const [stateFor, setStateFor] = React.useState<string | null>(farmerId)
    if (stateFor !== farmerId) {
        setStateFor(farmerId)
        setMapFocus(null)
        exitReportMode()
    }

    React.useEffect(() => {
        if (!toast) return
        const t = window.setTimeout(() => setToast(null), 4000)
        return () => window.clearTimeout(t)
    }, [toast])

    // a sample revealed (from the table row, the map or a dialog): once its card is rendered, scroll it into view
    React.useEffect(() => {
        if (!reveal) return
        const el = cardRefs.current.get(reveal.id)
        if (!el) return
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" })
    }, [reveal, visible])

    const { isLoaded } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: env.googleMapsApiKey, libraries: LIBRARIES })

    const select = React.useCallback((id: string | null) => setSelection({ key: farmerId, id }), [farmerId])
    const setExpandedIds = React.useCallback((update: (ids: Set<string>) => Set<string>) => setExpanded((prev) => ({ key: farmerId, ids: update(new Set(prev.key === farmerId ? prev.ids : [])) })), [farmerId])
    const toggleAz = (azId: number) => setCollapsedAzs((prev) => { const ids = new Set(prev.key === farmerId ? prev.ids : []); if (ids.has(azId)) ids.delete(azId); else ids.add(azId); return { key: farmerId, ids } })

    /** Select a sample and show it in the list (switching the status view / opening its AZ if needed), expanded and scrolled to. */
    const revealSample = React.useCallback((id: string | null, focusMap: boolean) => {
        select(id)
        if (!id) return
        const s = samples.find((x) => x.sample_id === id)
        if (s && filter !== "all" && s.bucket !== filter) setFilter(s.bucket)
        if (s) setCollapsedAzs((prev) => { if (prev.key !== farmerId || !prev.ids.has(s.az.id)) return prev; const ids = new Set(prev.ids); ids.delete(s.az.id); return { key: farmerId, ids } })
        setExpandedIds((ids) => ids.add(id))
        setReveal({ id, seq: Date.now() })
        if (focusMap && s?.location) setMapFocus({ sampleId: id, seq: Date.now() })
    }, [samples, filter, farmerId, select, setFilter, setExpandedIds])

    // The opened table row's sample: revealed once per sample, when its farmer's samples have loaded.
    const [revealedFor, setRevealedFor] = React.useState<string | null>(null)
    React.useEffect(() => {
        if (!open) { setRevealedFor(null); return }
        if (!selectedSampleId || !data || revealedFor === selectedSampleId) return
        if (!samples.some((s) => s.sample_id === selectedSampleId)) return
        setRevealedFor(selectedSampleId)
        revealSample(selectedSampleId, true)
    }, [open, selectedSampleId, data, samples, revealedFor, revealSample])

    /** V2: expanding a card selects and flies to it; collapsing never moves the map (and ends its report mode). */
    const toggleCard = (s: Sample) => {
        const opening = !expandedIds.has(s.sample_id)
        setExpandedIds((ids) => { if (ids.has(s.sample_id)) ids.delete(s.sample_id); else ids.add(s.sample_id); return ids })
        if (opening) {
            select(s.sample_id)
            if (s.location) setMapFocus({ sampleId: s.sample_id, seq: Date.now() })
        } else if (reportSampleId === s.sample_id) {
            exitReportMode()
        }
    }

    const openApprove = (s: Sample) => {
        idempotencyKey.current = newIdempotencyKey()
        setDialogError(null)
        setApproveTarget(s)
    }
    const confirmApprove = async () => {
        if (!approveTarget) return
        setBusy("approve")
        setDialogError(null)
        try {
            const res = await samplesApi.approveSamples({
                sample_ids: [approveTarget.sample_id],
                versions: { [approveTarget.sample_id]: approveTarget.version },
                idempotency_key: idempotencyKey.current,
            })
            const outcome = res.results[0]
            if (outcome && !outcome.ok) {
                setDialogError(outcome.error ?? "Refused by the server.")
                return
            }
            setApproveTarget(null)
            setToast({ type: "success", title: "Sample approved", description: `${approveTarget.sample_code ?? approveTarget.sample_id} moved to ${BUCKET_LABEL.approved}.` })
        } catch (e) {
            setDialogError(errorText(e))
        } finally {
            setBusy(null)
        }
    }

    /** Report on an expanded Pending sample (V2's startReport): its reportable values become selectable. */
    const startReport = (s: Sample) => {
        if (!s.can_report) return
        idempotencyKey.current = newIdempotencyKey()
        setDialogError(null)
        setReportSampleId(s.sample_id)
        setReportFields([])
        setReportComment("")
        select(s.sample_id)
    }
    const toggleReportField = (field: ReportableField) => setReportFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]))
    const reportTarget = reportSampleId ? samples.find((s) => s.sample_id === reportSampleId) ?? null : null
    /** The finalize dialog's Submit: the API records the report; V2's success state, then back to the list. */
    const submitReport = async () => {
        if (!reportTarget || reportFields.length === 0 || !reportComment.trim()) return
        setBusy("report")
        setDialogError(null)
        try {
            await samplesApi.reportSample({ sample_id: reportTarget.sample_id, version: reportTarget.version, fields: reportFields, comment: reportComment.trim(), idempotency_key: idempotencyKey.current })
            setReportSuccess(true)
            window.setTimeout(() => {
                setReportSuccess(false)
                exitReportMode()
                setToast({ type: "success", title: "Reported Successfully", description: `${reportTarget.sample_code ?? reportTarget.sample_id} moved to ${BUCKET_LABEL.need_correction}.` })
            }, 1500)
        } catch (e) {
            setDialogError(errorText(e))
        } finally {
            setBusy(null)
        }
    }

    const saveComment = async (comment: string) => {
        if (!commentTarget) return
        setBusy("comment")
        setDialogError(null)
        try {
            await samplesApi.updateComment({ sample_id: commentTarget.sample_id, comment })
            setCommentTarget(null)
            setToast({ type: "success", title: "Comment saved", description: commentTarget.sample_code ?? commentTarget.sample_id })
        } catch (e) {
            setDialogError(errorText(e))
        } finally {
            setBusy(null)
        }
    }
    const openBoundary = (s: Sample) => {
        if (!s.boundary_editable || !s.location) return
        idempotencyKey.current = newIdempotencyKey()
        select(s.sample_id)
        setBoundaryTarget(s)
    }
    /** The editor's Save: the API validates, creates / updates the plot and assigns it. A rejection keeps the editor open. */
    const saveBoundary = async (path: google.maps.LatLngLiteral[]) => {
        if (!boundaryTarget) return
        const ring = path.map((p) => [p.lng, p.lat] as [number, number])
        if (ring.length > 0) ring.push(ring[0]) // GeoJSON rings are closed (matic-dash's control-field save is not — a defect not copied)
        const res = await samplesApi.saveBoundary({
            sample_id: boundaryTarget.sample_id,
            version: boundaryTarget.version,
            geometry: { type: "Polygon", coordinates: [ring] },
            idempotency_key: idempotencyKey.current,
        })
        setBoundaryTarget(null)
        const others = res.assigned_sample_ids.length - 1
        setToast({
            type: "success",
            title: `Boundary saved · plot ${res.plot.plot_id}`,
            description: `${res.plot.area_acres} acres (server-calculated)${others > 0 ? ` · also assigned to ${others} other sample${others === 1 ? "" : "s"} inside it` : ""}. Approval is now available.`,
        })
    }

    const actions: SampleCardActions = {
        onApprove: openApprove,
        onStartReport: startReport,
        onComment: (s) => { setDialogError(null); setCommentTarget(s) },
        onHistory: (s) => setHistoryTarget(s),
        onPreview: (s) => setPreviewTarget(s),
        onDrawBoundary: openBoundary,
    }
    const reportModeFor = (s: Sample): ReportMode => ({
        active: reportSampleId === s.sample_id,
        selected: reportSampleId === s.sample_id ? reportFields : [],
        onToggleField: toggleReportField,
        onCancel: exitReportMode,
        onFinalize: () => { setDialogError(null); setFinalizeOpen(true) },
    })

    // the boundary strip for the current view (V2's NOC readiness strip on Pending)
    const needBoundary = visible.filter((s) => s.status === "pending" && s.approval.blockers.some((b) => b.code === "boundary_required"))
    const plotsCount = new Set(samples.map((s) => s.plot?.plot_id).filter(Boolean)).size

    // editor context: other samples (each plot's outline drawn once), the target with its own outline
    const editorContext = React.useMemo(() => {
        if (!boundaryTarget) return []
        const drawn = new Set<string>(boundaryTarget.plot ? [boundaryTarget.plot.plot_id] : [])
        return samples.filter((s) => s.location && s.sample_id !== boundaryTarget.sample_id).map((s) => {
            const pid = s.plot?.plot_id
            const withOutline = !!pid && !drawn.has(pid) && !!s.plot?.outline
            if (pid) drawn.add(pid)
            return toEditorPlot(s, withOutline)
        })
    }, [boundaryTarget, samples])
    const editorFill = (plot: MapPlot) => { const p = samples.find((s) => s.sample_id === plot.id)?.purpose; return p ? PURPOSE_COLOR[p] : null }

    const handleCloseAll = () => {
        setBoundaryTarget(null)
        exitReportMode()
        onOpenChange(false)
    }

    // Farmer → AZ → (purpose) → samples: V2's trailer groups, one per AZ, in the API's AZ order; the purpose rows are
    // one line each (label left, count right). A purpose is split by kind only when the AZ holds both kinds.
    const azSections = React.useMemo(() => (data?.azs ?? []).map((az) => {
        const all = samples.filter((s) => s.az.id === az.id)
        const shown = visible.filter((s) => s.az.id === az.id)
        const bothKinds = new Set(all.map((s) => s.kind)).size > 1
        const groups = PURPOSE_ORDER.flatMap((purpose) => KIND_ORDER.map((kind) => ({ kind, purpose, items: shown.filter((s) => s.kind === kind && s.purpose === purpose) }))).filter((g) => g.items.length > 0)
        return { az, total: all.length, shown: shown.length, bothKinds, groups }
    }).filter((sec) => sec.shown > 0), [data, samples, visible])
    const purposeBreakdown = React.useMemo(() => {
        const pc = data?.purpose_counts ?? []
        const bothKinds = new Set(pc.map((c) => c.kind)).size > 1
        return pc.map((c) => ({ key: `${c.kind}:${c.purpose}`, label: bothKinds ? `${PURPOSE_LONG_LABEL[c.purpose]} · ${KIND_LABEL[c.kind]}` : PURPOSE_LONG_LABEL[c.purpose], count: c.count }))
    }, [data])

    if (!farmerId || !context) return null
    const v = context.village
    const location = v ? [v.name, v.block, v.district, v.state].filter(Boolean).join(", ") : "Location not recorded"
    const v2Counts: Record<DetailFilter, number | null> = counts
        ? { all: samples.length, pending: counts.pending, need_correction: counts.need_correction, verified: counts.approved }
        : { all: null, pending: null, need_correction: null, verified: null }
    const azCodes = (data?.azs ?? []).filter((az) => az.id !== 0).map((az) => az.code)

    return (
        <>
            <Sheet open={open} onOpenChange={(val) => { if (!val) handleCloseAll() }}>
                <SheetContent
                    data-sample-detail={farmerId}
                    data-selected-sample={selectedId ?? undefined}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-visible z-[200] transition-all duration-500 ease-in-out focus-visible:outline-none [&>button]:hidden"
                    onPointerDownOutside={(e) => { if ((e.target as HTMLElement).closest(".map-preview-module")) e.preventDefault() }}
                >
                    {/* The map module, beside the sheet and sliding with it (Deployment V2) */}
                    <div
                        className={cn("map-preview-module absolute top-0 bottom-0 bg-white dark:bg-zinc-950 hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-all duration-500 ease-in-out z-[-1]", open ? "opacity-100" : "opacity-0")}
                        style={{ width: "50vw", right: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 overflow-hidden relative bg-zinc-100 dark:bg-zinc-900/50">
                            {isLoaded && data ? (
                                <SamplesMap
                                    samples={samples}
                                    plots={data.plots}
                                    inViewIds={inViewIds}
                                    selectedId={selectedId}
                                    onSelect={(id) => revealSample(id, false)}
                                    focus={mapFocus}
                                    onDrawBoundary={openBoundary}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center space-y-3">
                                        <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Initializing Map...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Header (V2): farmer, location · details bar · summary bar · readiness strip */}
                    <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
                        <div className="p-5">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Avatar className="h-12 w-12 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{initials(context)}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left min-w-0">
                                        <SheetTitle data-detail-farmer className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight truncate">{farmerName(context)}</SheetTitle>
                                        <SheetDescription asChild>
                                            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 font-medium">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{location}</span>
                                            </div>
                                        </SheetDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={handleCloseAll}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {/* Details bar (V2: "<area> Acres . N Plots | AZ code . AZ name"): the sample count carries its purpose breakdown on hover */}
                        <div className="bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            <div className="min-w-0 truncate">
                                {data ? (
                                    <>
                                        <HoverCard openDelay={100} closeDelay={100}>
                                            <HoverCardTrigger asChild>
                                                <button type="button" data-sample-count={samples.length} className="rounded-sm underline decoration-dotted decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 tabular-nums">
                                                    {samples.length} {samples.length === 1 ? "Sample" : "Samples"}
                                                </button>
                                            </HoverCardTrigger>
                                            <HoverCardContent align="start" side="bottom" data-sample-count-card className="w-72 z-[300] p-3">
                                                <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none mb-2">Samples by purpose</p>
                                                <ul className="space-y-1">
                                                    {purposeBreakdown.map((row) => (
                                                        <li key={row.key} data-purpose-count={row.key} className="flex items-center justify-between gap-3 text-xs">
                                                            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{row.label}</span>
                                                            <span className="shrink-0 tabular-nums font-semibold text-zinc-900 dark:text-zinc-50">{row.count}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </HoverCardContent>
                                        </HoverCard>
                                        {" . "}{plotsCount} {plotsCount === 1 ? "Plot" : "Plots"}
                                    </>
                                ) : "Loading samples…"}
                            </div>
                            <div data-detail-azs={azCodes.join(",")} className="shrink-0 truncate max-w-[55%]" title={azCodes.join(" · ")}>{azCodes.length > 0 ? azCodes.join(" · ") : "—"}</div>
                        </div>
                        <div data-summary-bar className="px-6 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
                            <div className="flex flex-col items-start gap-1 min-w-0">
                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">Samples</h2>
                                {data && <DetailStatusFilter value={toV2Filter(filter)} counts={v2Counts} onChange={(f) => setFilter(fromV2Filter(f))} noun="samples" />}
                            </div>
                        </div>
                        {data && needBoundary.length > 0 && (
                            <ReadinessStrip data-strip="boundary" action={needBoundary.some((s) => s.boundary_editable) ? "Draw boundary" : undefined} onAction={() => { const first = needBoundary.find((s) => s.boundary_editable); if (first) { revealSample(first.sample_id, false); openBoundary(first) } }}>
                                {needBoundary.length} control {needBoundary.length === 1 ? "sample needs" : "samples need"} a plot boundary before {needBoundary.length === 1 ? "it" : "they"} can be approved.
                            </ReadinessStrip>
                        )}
                    </div>

                    {/* Content: Farmer → AZ groups → purpose rows → sample cards, in the chosen status view */}
                    <ScrollArea className="flex-1 relative [&>[data-radix-scroll-area-viewport]>div]:!block">
                        {detail.isLoading && !data ? (
                            <div data-detail-state="loading" className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-in fade-in duration-500">
                                <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                            </div>
                        ) : detail.error && !data ? (
                            <div className="p-6">
                                <EmptyBox data-detail-state="error" title="Couldn't load the samples" detail={detail.error} icon="alert">
                                    <Button variant="outline" size="sm" className="mt-4 h-8 px-3 text-xs font-bold" onClick={detail.retry}>Retry</Button>
                                </EmptyBox>
                            </div>
                        ) : (
                            <div className="p-6 space-y-6">
                                {detail.error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">Refresh failed: {detail.error} <button className="underline" onClick={detail.retry}>Retry</button></p>}
                                {azSections.length === 0 && (
                                    <EmptyBox data-detail-state="empty" title={`No ${FILTER_LABEL[filter].toLowerCase()} samples`} detail={`${samples.length} other ${samples.length === 1 ? "sample is" : "samples are"} available in All for this farmer.`} icon="inbox">
                                        <Button variant="outline" size="sm" data-show-all className="mt-4 h-8 px-3 text-xs font-bold" onClick={() => setFilter("all")}>View all samples</Button>
                                    </EmptyBox>
                                )}
                                {azSections.map((section) => {
                                    const collapsed = collapsedAzIds.has(section.az.id)
                                    const azLabel = section.az.id === 0 ? "No AZ" : section.az.name ? `${section.az.code} · ${section.az.name}` : section.az.code
                                    return (
                                        <section key={section.az.id} data-az-section={section.az.code} data-az-collapsed={collapsed || undefined} className="space-y-3">
                                            <GroupHeader prefix="az" label={azLabel} shown={section.shown} total={section.total} noun="sample" filtered={filter !== "all"} collapsed={collapsed} onToggle={() => toggleAz(section.az.id)} />
                                            {!collapsed && section.groups.map(({ kind, purpose, items }) => (
                                                <div key={`${kind}:${purpose}`} data-purpose-group={`${kind}:${purpose}`} className="space-y-3">
                                                    <div className="flex items-center justify-between gap-3 px-0.5 text-xs">
                                                        <span className="truncate font-semibold text-zinc-700 dark:text-zinc-300" title={`${PURPOSE_LONG_LABEL[purpose]} (${PURPOSE_LABEL[purpose]})`}>
                                                            {section.bothKinds ? `${PURPOSE_LONG_LABEL[purpose]} · ${KIND_LABEL[kind]}` : PURPOSE_LONG_LABEL[purpose]}
                                                        </span>
                                                        <span data-purpose-group-count={items.length} className="shrink-0 tabular-nums font-medium text-zinc-500 dark:text-zinc-400">{items.length}</span>
                                                    </div>
                                                    {items.map((s) => (
                                                        <SampleCard
                                                            key={s.sample_id}
                                                            sample={s}
                                                            cardRef={(el) => { if (el) cardRefs.current.set(s.sample_id, el); else cardRefs.current.delete(s.sample_id) }}
                                                            expanded={expandedIds.has(s.sample_id)}
                                                            highlighted={selectedId === s.sample_id}
                                                            onToggle={() => toggleCard(s)}
                                                            canComment={canVerify}
                                                            report={reportModeFor(s)}
                                                            actions={actions}
                                                        />
                                                    ))}
                                                </div>
                                            ))}
                                        </section>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer (V2): Previous / Next over the table's FARMERS */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20">
                        <div className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" aria-label="Previous farmer" data-prev-farmer className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" onClick={onPrevious} disabled={isFirst}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <span data-farmer-position className="text-[11px] font-bold text-zinc-500 tabular-nums">{currentIndex + 1} / {totalCount}</span>
                                <Button variant="ghost" size="icon" aria-label="Next farmer" data-next-farmer className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" onClick={onNext} disabled={isLast}>
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Full-screen boundary editor (Deployment V2's, unchanged) */}
            <Dialog open={!!boundaryTarget} onOpenChange={() => { /* the editor decides (unsaved changes ask first) */ }}>
                <DialogContent
                    data-boundary-dialog
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                    className="fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none p-0 border-0 rounded-none bg-zinc-50 dark:bg-zinc-950 gap-0 flex flex-col z-[500] [&>button]:hidden"
                >
                    <DialogTitle className="sr-only">{boundaryTarget?.plot?.outline ? "Edit plot boundary" : "Draw plot boundary"}</DialogTitle>
                    <DialogDescription className="sr-only">Full-screen map for the sample&apos;s plot boundary</DialogDescription>
                    {boundaryTarget && isLoaded && (
                        <PlotBoundaryEditor
                            plots={editorContext}
                            target={toEditorPlot(boundaryTarget, true)}
                            title={boundaryTarget.sample_code ?? boundaryTarget.sample_id}
                            subtitle={[
                                `${KIND_LABEL[boundaryTarget.kind]} · ${PURPOSE_LABEL[boundaryTarget.purpose]}`,
                                boundaryTarget.plot ? `plot ${boundaryTarget.plot.plot_id}` : "new plot (id assigned on save)",
                                `must contain the sample's GPS point · ${farmerName(context)} · ${boundaryTarget.az.code}`,
                            ].join(" · ")}
                            markerFill={editorFill}
                            markerDiameter={() => 16}
                            onCancel={() => setBoundaryTarget(null)}
                            onSave={(path) => saveBoundary(path)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ApproveDialog sample={approveTarget} onCancel={() => setApproveTarget(null)} onConfirm={confirmApprove} submitting={busy === "approve"} error={approveTarget ? dialogError : null} />
            <ReportFinalizeDialog
                open={finalizeOpen && !!reportTarget}
                sample={reportTarget}
                fields={reportFields}
                comment={reportComment}
                onCommentChange={setReportComment}
                onCancel={() => setFinalizeOpen(false)}
                onSubmit={submitReport}
                submitting={busy === "report"}
                success={reportSuccess}
                error={finalizeOpen ? dialogError : null}
            />
            <CommentDialog sample={commentTarget} canEdit={canVerify} onCancel={() => setCommentTarget(null)} onSave={saveComment} saving={busy === "comment"} error={commentTarget ? dialogError : null} />
            <HistoryDialog sample={historyTarget} onClose={() => setHistoryTarget(null)} history={history} />
            <PhotoPreviewDialog sample={previewTarget} onClose={() => setPreviewTarget(null)} />

            {toast && (
                <div
                    role="status"
                    data-toast={toast.type}
                    className={cn(
                        "fixed top-4 right-4 z-[999] w-full max-w-[360px] p-4 rounded-xl shadow-lg border flex gap-3 animate-in fade-in slide-in-from-top-3 duration-300",
                        toast.type === "success" ? "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-50 dark:border-emerald-900/50" : "bg-red-50 text-red-950 border-red-200 dark:bg-red-950/90 dark:text-red-50 dark:border-red-900/50"
                    )}
                >
                    <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", toast.type === "success" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40")}>
                        {toast.type === "success" ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0 pr-4 text-left">
                        <h5 className="font-bold text-[12px] leading-tight mb-0.5">{toast.title}</h5>
                        <p className="text-[11px] font-medium leading-relaxed opacity-90">{toast.description}</p>
                    </div>
                    <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="absolute right-3 top-3 rounded-md p-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
            )}
        </>
    )
}
