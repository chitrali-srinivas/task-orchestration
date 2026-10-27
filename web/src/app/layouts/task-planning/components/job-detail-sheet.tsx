"use client"

// Job workspace — full screen, laid out like the Deployment map view: the Google map in the middle (numbered stops, each
// leg labelled with distance and drive time, a legend card), the route's task list as a rim beside it (base → stops →
// base with the km and minutes between each pair of nodes), and the job on the right: surveyor, route info, actions
// (change surveyor or rearrange, each previewing the change in distance before it's saved; add tasks) and the timeline,
// with the previous / next pager and the status actions at the bottom. Changes are allowed until the surveyor accepts.
import * as React from "react"
import { format } from "date-fns"
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, MoreVertical, Search, Send, Shuffle, Trash2, Undo2, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { STATUS, type Farmer, type LatLng, type LocationSource, type Task } from "@/lib/orchestration/engine"
import {
    DEFAULT_MAX_VISITS,
    EFFORT,
    JOB_STATUS,
    Job,
    JobEvent,
    JobStop,
    Surveyor,
    Village,
    bestOrder,
    distanceKm,
    driveMinutes,
    isEditable,
    isOpen,
    jobEffort,
    openJobFor,
    openJobsByTask,
    stopLocation,
    unfinishedStops,
    visitableOn,
} from "@/lib/orchestration/jobs"
import type { SurveyModel } from "@/app/layouts/survey-builder/types/survey-schema"
import { cn } from "@/lib/utils"
import { JobRecord } from "../data/schema"
import { baseOf } from "../data/data-source"
import { formatKm, formatMinutes, formatYmd, initials } from "./columns"
import { JobStatusBadge } from "./job-status"
import { CloseJobDialog } from "./job-dialogs"
import { JobMap, MapCandidate, MapLeg, MapStop, hasMapKey } from "./job-map"

const LOCATION_LABEL: Record<LocationSource, string> = { gps: "GPS", plot: "plot centre", village: "village centre" }

function eventText(e: JobEvent): string {
    switch (e.action) {
        case "create":
            return e.by === "Planner" ? "Job created by the planner" : `Job created by ${e.by}`
        case "assign":
            return `Assigned to the surveyor by ${e.by}`
        case "unassign":
            return `Pulled back by ${e.by}`
        case "accept":
            return `Accepted by ${e.by}`
        case "decline":
            return `Declined by ${e.by}`
        case "start":
            return `Started by ${e.by}`
        case "close":
            return `Job sheet closed by ${e.by}`
        case "reassign":
            return `Handed to another surveyor by ${e.by}`
    }
}

const legText = (km: number, min: number) => `${km.toFixed(1)} km · ${min} min`
const signed = (n: number, unit: string, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)} ${unit}`

/** "19.7 km → 18.2 km (−1.5 km · −4 min)": what a change does to the round trip. */
function Delta({ fromKm, toKm, fromMin, toMin }: { fromKm?: number; toKm?: number; fromMin: number; toMin: number }) {
    if (fromKm === undefined || toKm === undefined) return <p className="text-[11px] text-zinc-500">No stop has a location, so distance can&apos;t be compared.</p>
    const dKm = toKm - fromKm
    const better = dKm < -0.05
    const worse = dKm > 0.05
    return (
        <p className={cn("text-xs tabular-nums", better ? "text-emerald-700 dark:text-emerald-400" : worse ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400")}>
            {formatKm(fromKm)} → <span className="font-semibold">{formatKm(toKm)}</span>{" "}
            {better || worse ? `(${signed(dKm, "km", 1)} · ${signed(toMin - fromMin, "min")})` : "(same distance)"}
        </p>
    )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{children}</h3>
            {right}
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 px-3 py-2">
            <div className="text-[10px] font-semibold text-zinc-500">{label}</div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</div>
        </div>
    )
}

interface JobDetailSheetProps {
    record: JobRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
    jobs: Job[]
    tasks: Task[]
    farmers: Farmer[]
    surveys: SurveyModel[]
    surveyors: Surveyor[]
    villages: Village[]
    onPrevious: () => void
    onNext: () => void
    isFirst: boolean
    isLast: boolean
    /** Position in the table's current page, -1 when the job is not on it. */
    currentIndex: number
    totalCount: number
    onAssign: () => void
    onUnassign: () => void
    onDelete: () => void
    onCloseSheet: (reasons: Record<number, string>) => void
    /** Save a rearranged order (farmer ids, every stop once). */
    onSaveOrder: (farmerIds: string[]) => void
    onChangeSurveyor: (surveyorId: string) => void
    /** Add tasks to this job (moving them off another job that isn't accepted yet). */
    onAddTasks: (taskIds: string[]) => void
    /** Move tasks to a surveyor's job on this job's day (a new created job if they have none). */
    onMoveTasks: (taskIds: string[], surveyorId: string) => void
    onRemoveTasks: (taskIds: string[]) => void
}

export function JobDetailSheet({
    record,
    open,
    onOpenChange,
    jobs,
    tasks,
    farmers,
    surveys,
    surveyors,
    villages,
    onPrevious,
    onNext,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    onAssign,
    onUnassign,
    onDelete,
    onCloseSheet,
    onSaveOrder,
    onChangeSurveyor,
    onAddTasks,
    onMoveTasks,
    onRemoveTasks,
}: JobDetailSheetProps) {
    const [closing, setClosing] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [activeKey, setActiveKey] = React.useState<string | null>(null)
    const [showOtherJobs, setShowOtherJobs] = React.useState(false)
    // Drafts belong to one job: switching jobs (pager) drops them.
    const [draft, setDraft] = React.useState<{ jobId: string; order: string[] } | null>(null)
    const [pending, setPending] = React.useState<{ jobId: string; surveyorId: string } | null>(null)

    const taskById = React.useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
    const farmerById = React.useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers])
    const surveyName = React.useMemo(() => new Map(surveys.map((s) => [s.id, s.name])), [surveys])
    const surveyorById = React.useMemo(() => new Map(surveyors.map((s) => [s.id, s])), [surveyors])

    if (!record) return null
    const job = record.job
    const surveyor = surveyorById.get(job.surveyorId)
    const editable = isEditable(job)
    const base = baseOf(surveyor, villages)
    const baseName = villages.find((v) => v.id === surveyor?.baseVillageId)?.name
    const maxVisits = surveyor?.maxVisitsPerDay ?? DEFAULT_MAX_VISITS
    const code = (id: string) => (taskById.get(id) ? `T${taskById.get(id)!.taskNo}` : "?")
    const farmerName = (id: string) => farmerById.get(id)?.name ?? "(unknown farmer)"
    const surveyorName = (id: string) => surveyorById.get(id)?.name ?? "removed surveyor"
    const locate = (farmerId: string) => stopLocation(farmerById.get(farmerId), villages)
    const effortOf = (stops: JobStop[], from?: LatLng) => jobEffort(stops.map((s) => locate(s.farmerId)), stops.map((s) => s.taskIds.length), from)

    // What the rim and the map show: the saved order, or the order being rearranged.
    const byFarmer = new Map(job.stops.map((s) => [s.farmerId, s]))
    const draftOrder =
        editable && draft?.jobId === job.id && draft.order.length === job.stops.length && draft.order.every((id) => byFarmer.has(id)) ? draft.order : null
    const shown = draftOrder ? draftOrder.map((id) => byFarmer.get(id)!) : job.stops
    const savedEffort = effortOf(job.stops, base)
    const effort = effortOf(shown, base)
    const best = bestOrder(job.stops, { locate, base })
    const bestEffort = effortOf(best, base)
    const bestSaves = savedEffort.km !== undefined && bestEffort.km !== undefined && savedEffort.km - bestEffort.km > 0.05
    const pendingSurveyor = editable && pending?.jobId === job.id && pending.surveyorId !== job.surveyorId ? surveyorById.get(pending.surveyorId) : undefined
    const pendingEffort = pendingSurveyor ? effortOf(job.stops, baseOf(pendingSurveyor, villages)) : undefined

    const located = shown.map((s) => locate(s.farmerId))
    const stopDone = (stop: JobStop) => stop.taskIds.every((id) => taskById.get(id)?.status !== STATUS.planned)
    const unfinished = unfinishedStops(job, tasks)
    const route = [baseName ? `Base ${baseName}` : null, ...shown.map((_, i) => String(i + 1)), baseName ? "base" : null].filter(Boolean).join(" → ")
    /** A farmer not on the job yet takes a visit; the job may be full. */
    const fullFor = (farmerId: string) => job.stops.length >= maxVisits && !byFarmer.has(farmerId)

    // Tasks due on the job's day it could take: unassigned ones, and ones on another job the surveyor hasn't accepted.
    const held = openJobsByTask(jobs)
    const pool = tasks.flatMap((t) => {
        if (!visitableOn(t, job.date)) return []
        const holder = held.get(t.id)?.job
        if (holder?.id === job.id || (holder && !isEditable(holder))) return []
        return [{ task: t, holder }]
    })
    const q = query.trim().toLowerCase()
    const matches = q
        ? pool
              .filter(({ task }) => {
                  const f = farmerById.get(task.farmerId)
                  return `t${task.taskNo} ${task.taskNo} ${f?.name ?? ""} ${f?.village ?? ""}`.toLowerCase().includes(q)
              })
              .slice(0, 8)
        : []

    // Other open jobs that day: where a task can move, and (when ticked) their stops on the map.
    const otherJobs = jobs.filter((j) => j.id !== job.id && j.date === job.date && isOpen(j))
    const moveJobs = otherJobs.filter(isEditable)
    const freeSurveyors = surveyors.filter((s) => s.active && s.id !== job.surveyorId && !openJobFor(jobs, s.id, job.date))

    // Map: stops, legs (labelled when they have length), candidates.
    const mapStops: MapStop[] = shown.flatMap((s, i) =>
        located[i] ? [{ key: `s:${s.farmerId}`, no: i + 1, label: farmerName(s.farmerId), location: located[i]!, done: stopDone(s) }] : []
    )
    const nodes = [...(base ? [{ key: "base", at: base }] : []), ...mapStops.map((s) => ({ key: s.key, at: s.location })), ...(base && mapStops.length > 0 ? [{ key: "base-end", at: base }] : [])]
    // A leg's label sits at its middle, or further along when that would cover a marker or another leg's label (legs can
    // pass right by a stop, or run back along the same road); when nowhere is clear, the least crowded spot.
    const placed: LatLng[] = []
    const labelAt = (a: LatLng, b: LatLng, km: number) => {
        const spots = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85].map((t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }))
        const room = (p: LatLng) => Math.min(...[...nodes.map((n) => n.at), ...placed].map((q) => distanceKm(p, q)))
        const spot = spots.find((p) => room(p) > Math.max(0.15 * km, 0.4)) ?? spots.reduce((best, p) => (room(p) > room(best) ? p : best))
        placed.push(spot)
        return spot
    }
    const legs: MapLeg[] = nodes.slice(1).flatMap((n, i) => {
        const from = nodes[i]
        const km = distanceKm(from.at, n.at)
        return km < 0.05 ? [] : [{ key: `${from.key}>${n.key}`, from: from.at, to: n.at, labelAt: labelAt(from.at, n.at, km), label: legText(km, driveMinutes(km)) }]
    })
    const addLabel = (farmerId: string, verb: string) => (editable && !fullFor(farmerId) ? `${verb} to ${record.jobCode}` : undefined)
    const unassignedFarmers = Array.from(new Set(pool.filter((p) => !p.holder).map((p) => p.task.farmerId)))
    const candidates: MapCandidate[] = [
        ...(editable
            ? unassignedFarmers.flatMap((farmerId) => {
                  const loc = locate(farmerId)
                  const ids = pool.filter((p) => !p.holder && p.task.farmerId === farmerId).map((p) => p.task.id)
                  return loc
                      ? [
                            {
                                key: `u:${farmerId}`,
                                label: farmerName(farmerId),
                                detail: `${ids.map(code).join(", ")} · unassigned${fullFor(farmerId) ? ` · ${record.jobCode} is full` : ""}`,
                                location: loc,
                                kind: "unassigned" as const,
                                actionLabel: addLabel(farmerId, "Add"),
                            },
                        ]
                      : []
              })
            : []),
        ...(showOtherJobs
            ? otherJobs.flatMap((j) =>
                  j.stops.flatMap((s) => {
                      const loc = locate(s.farmerId)
                      return loc
                          ? [
                                {
                                    key: `o:${j.id}:${s.farmerId}`,
                                    label: farmerName(s.farmerId),
                                    detail: `On J${j.jobNo} · ${surveyorName(j.surveyorId)}`,
                                    location: loc,
                                    kind: "other-job" as const,
                                    actionLabel: isEditable(j) ? addLabel(s.farmerId, "Move") : undefined,
                                },
                            ]
                          : []
                  })
              )
            : []),
    ]
    const pickCandidate = (key: string) => {
        const [kind, a, b] = key.split(":")
        if (kind === "u") onAddTasks(pool.filter((p) => !p.holder && p.task.farmerId === a).map((p) => p.task.id))
        if (kind === "o") onAddTasks(jobs.find((j) => j.id === a)?.stops.find((s) => s.farmerId === b)?.taskIds ?? [])
    }
    const selectStop = (key: string) => {
        setActiveKey(key)
        document.getElementById(`job-stop-${key}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
    const moveInDraft = (i: number, to: number) => {
        const order = shown.map((s) => s.farmerId)
        const [id] = order.splice(i, 1)
        order.splice(to, 0, id)
        setDraft({ jobId: job.id, order })
    }

    const connector = (km: number | undefined, min: number | undefined, key: string) => (
        <div key={key} className="flex items-center gap-2 pl-[11px] text-[10px] text-zinc-400 tabular-nums">
            <span className="h-4 border-l border-dashed border-zinc-300 dark:border-zinc-700" />
            {km === undefined ? "no location" : legText(km, min ?? 0)}
        </div>
    )

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="w-screen sm:max-w-none p-0 flex flex-col lg:flex-row gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[200] focus-visible:outline-none [&>button]:hidden"
                >
                    {/* Map, in the middle */}
                    <div className="relative h-[45vh] lg:h-auto lg:flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900">
                        <JobMap base={base} stops={mapStops} legs={legs} candidates={candidates} activeKey={activeKey} onSelectStop={selectStop} onPickCandidate={pickCandidate} />
                        {hasMapKey && (
                            <div className="absolute left-3 top-3 z-10 w-[230px] space-y-1.5 rounded-lg border border-zinc-200 bg-white/95 p-3 text-[11px] text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-300">
                                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Legend</div>
                                <div className="flex items-center gap-2">
                                    <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-zinc-900 bg-white text-[8px] font-bold text-zinc-900">B</span> Base village
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[8px] font-bold text-white">1</span> Stop, in visiting order
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-4 w-4 rounded-full bg-emerald-600" /> Stop done
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-zinc-200 bg-white px-1.5 text-[9px] font-semibold text-zinc-800">4.6 km · 11 min</span> Leg distance · drive
                                </div>
                                {editable && (
                                    <div className="flex items-center gap-2">
                                        <span className="ml-1 h-2.5 w-2.5 rounded-full bg-zinc-400" />
                                        <span className="ml-1">Unassigned that day: click to add</span>
                                    </div>
                                )}
                                <label className="flex cursor-pointer items-center gap-2">
                                    <Checkbox checked={showOtherJobs} onCheckedChange={(v) => setShowOtherJobs(Boolean(v))} className="h-3.5 w-3.5" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Other jobs&apos; stops
                                </label>
                                <p className="pt-1 text-[10px] text-zinc-400">Straight lines; road routes come with the Routes API.</p>
                            </div>
                        )}
                    </div>

                    {/* Rim: the route's tasks, numbered, with the leg between each pair of nodes */}
                    <div className="w-full lg:w-[320px] shrink-0 min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800">
                        <div className="shrink-0 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Route</div>
                            <div className="truncate text-[11px] text-zinc-500">{job.stops.length > 0 ? route : "No stops yet"}</div>
                            {draftOrder && <div className="mt-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400">Rearranging: not saved yet</div>}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
                            {shown.length === 0 ? (
                                <p className="py-8 text-center text-xs text-zinc-500">No tasks on this job. Add them on the right, or from the map.</p>
                            ) : (
                                <>
                                    {base && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-zinc-900 text-[10px] font-bold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100">B</span>
                                            Start · base {baseName}
                                        </div>
                                    )}
                                    {shown.map((stop, i) => {
                                        const key = `s:${stop.farmerId}`
                                        const farmer = farmerById.get(stop.farmerId)
                                        const done = stopDone(stop)
                                        return (
                                            <React.Fragment key={stop.farmerId}>
                                                {(base || i > 0) && connector(effort.stops[i].km, effort.stops[i].driveMin, `leg-${stop.farmerId}`)}
                                                <div
                                                    id={`job-stop-${key}`}
                                                    onClick={() => setActiveKey(key)}
                                                    className={cn(
                                                        "cursor-pointer rounded-lg border p-2.5 transition-colors",
                                                        activeKey === key ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30" : "border-zinc-200 dark:border-zinc-800 hover:bg-muted/40"
                                                    )}
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <span
                                                            className={cn(
                                                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                                                                done ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                                            )}
                                                        >
                                                            {i + 1}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{farmer?.name ?? "(unknown farmer)"}</div>
                                                            <div className="truncate text-[11px] text-zinc-500">
                                                                {farmer?.village || "No village"} · {located[i] ? LOCATION_LABEL[located[i]!.source] : <span className="text-amber-600">no location</span>} ·{" "}
                                                                {stop.taskIds.length * EFFORT.minutesPerTask} min on site
                                                            </div>
                                                        </div>
                                                        {draftOrder && (
                                                            <div className="flex shrink-0 flex-col">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" title="Earlier" disabled={i === 0} onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        moveInDraft(i, i - 1)
                                                                    }}>
                                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    title="Later"
                                                                    disabled={i === shown.length - 1}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        moveInDraft(i, i + 1)
                                                                    }}
                                                                >
                                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-1.5 space-y-1 pl-[34px]">
                                                        {stop.taskIds.map((taskId) => {
                                                            const t = taskById.get(taskId)
                                                            return (
                                                                <div key={taskId} className="flex items-center gap-1.5 text-xs">
                                                                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                                                                        <span className="font-mono font-semibold">{code(taskId)}</span> · {t ? surveyName.get(t.surveyId) ?? t.surveyId : "(deleted task)"}
                                                                    </span>
                                                                    <span className={cn("shrink-0 text-[10px] capitalize", t?.status === STATUS.planned ? "text-zinc-400" : "font-semibold text-emerald-600")}>{t?.status}</span>
                                                                    {editable && !draftOrder && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-zinc-500" title={`Move or remove ${code(taskId)}`} onClick={(e) => e.stopPropagation()}>
                                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="z-[600] w-60" onClick={(e) => e.stopPropagation()}>
                                                                                <DropdownMenuLabel className="text-[11px] font-semibold text-zinc-500">Move {code(taskId)} to</DropdownMenuLabel>
                                                                                {moveJobs.map((j) => {
                                                                                    const s = surveyorById.get(j.surveyorId)
                                                                                    const max = s?.maxVisitsPerDay ?? DEFAULT_MAX_VISITS
                                                                                    const full = j.stops.length >= max && !j.stops.some((x) => x.farmerId === stop.farmerId)
                                                                                    return (
                                                                                        <DropdownMenuItem key={j.id} disabled={full} onSelect={() => onMoveTasks([taskId], j.surveyorId)}>
                                                                                            J{j.jobNo} · {s?.name ?? "?"}
                                                                                            <span className="ml-auto text-[11px] text-zinc-400">
                                                                                                {j.stops.length}/{max}
                                                                                                {full ? " full" : ""}
                                                                                            </span>
                                                                                        </DropdownMenuItem>
                                                                                    )
                                                                                })}
                                                                                {freeSurveyors.map((s) => (
                                                                                    <DropdownMenuItem key={s.id} onSelect={() => onMoveTasks([taskId], s.id)}>
                                                                                        {s.name}
                                                                                        <span className="ml-auto text-[11px] text-zinc-400">new job</span>
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                                {moveJobs.length === 0 && freeSurveyors.length === 0 && <DropdownMenuItem disabled>No other surveyor that day</DropdownMenuItem>}
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => onRemoveTasks([taskId])}>
                                                                                    Remove from {record.jobCode}
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                        {stop.notDoneReason && (
                                                            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                                                Not done: {stop.notDoneReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        )
                                    })}
                                    {base && effort.returnKm !== undefined && (
                                        <>
                                            {connector(effort.returnKm, driveMinutes(effort.returnKm), "leg-return")}
                                            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-zinc-900 text-[10px] font-bold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100">B</span>
                                                Back to base {baseName}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: the job, route info, actions, timeline */}
                    <div className="w-full lg:w-[380px] shrink-0 min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800">
                        <div className="shrink-0 p-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-11 w-11 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{initials(record.surveyorName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <SheetTitle className="truncate text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{record.surveyorName}</SheetTitle>
                                        <SheetDescription asChild>
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                                                <CalendarDays className="h-3 w-3 shrink-0" />
                                                {record.jobCode} · {formatYmd(job.date)}
                                            </div>
                                        </SheetDescription>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    onClick={() => onOpenChange(false)}
                                    title="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                <span>
                                    {record.stopCount} {record.stopCount === 1 ? "stop" : "stops"} . {record.taskCount} {record.taskCount === 1 ? "task" : "tasks"} .{" "}
                                    {record.stopCount}/{maxVisits} visits
                                </span>
                                <JobStatusBadge status={job.status} long />
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
                            <div className="space-y-2">
                                <SectionTitle>Route info</SectionTitle>
                                <div className="grid grid-cols-2 gap-2">
                                    <Stat label="Distance" value={effort.km === undefined ? "-" : formatKm(effort.km)} />
                                    <Stat label="Day effort" value={formatMinutes(effort.totalMin)} />
                                    <Stat label="Drive" value={formatMinutes(effort.driveMin)} />
                                    <Stat label="On site" value={formatMinutes(effort.onSiteMin)} />
                                </div>
                                <p className="text-[10px] text-zinc-400">
                                    Round trip from the base village, straight-line at {EFFORT.driveKmh} km/h, {EFFORT.minutesPerTask} min per task on site.
                                    {record.unlocatedCount > 0 && ` ${record.unlocatedCount} stop${record.unlocatedCount === 1 ? " has" : "s have"} no location and ${record.unlocatedCount === 1 ? "isn't" : "aren't"} in the distance.`}
                                </p>
                            </div>

                            {editable ? (
                                <>
                                    <div className="space-y-2">
                                        <SectionTitle>Surveyor</SectionTitle>
                                        <Select value={pendingSurveyor?.id ?? job.surveyorId} onValueChange={(v) => setPending({ jobId: job.id, surveyorId: v })}>
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[600]">
                                                {surveyors
                                                    .filter((s) => s.active || s.id === job.surveyorId)
                                                    .map((s) => {
                                                        const busy = s.id !== job.surveyorId && openJobFor(jobs, s.id, job.date)
                                                        const small = job.stops.length > s.maxVisitsPerDay
                                                        return (
                                                            <SelectItem key={s.id} value={s.id} disabled={Boolean(busy) || small} className="text-sm">
                                                                {s.name}
                                                                <span className="ml-2 text-xs text-zinc-400">
                                                                    {s.id === job.surveyorId ? "current" : busy ? `has J${busy.jobNo} that day` : small ? `up to ${s.maxVisitsPerDay} visits` : ""}
                                                                </span>
                                                            </SelectItem>
                                                        )
                                                    })}
                                            </SelectContent>
                                        </Select>
                                        {pendingSurveyor && pendingEffort && (
                                            <div className="space-y-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                                                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                                                    {pendingSurveyor.name} starts from{" "}
                                                    {villages.find((v) => v.id === pendingSurveyor.baseVillageId)?.name ? `base ${villages.find((v) => v.id === pendingSurveyor.baseVillageId)?.name}` : "no base village"}.
                                                </p>
                                                <Delta fromKm={savedEffort.km} toKm={pendingEffort.km} fromMin={savedEffort.totalMin} toMin={pendingEffort.totalMin} />
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setPending(null)}>
                                                        Keep {surveyor?.name ?? "current"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 flex-1 text-xs"
                                                        onClick={() => {
                                                            onChangeSurveyor(pendingSurveyor.id)
                                                            setPending(null)
                                                        }}
                                                    >
                                                        Hand to {pendingSurveyor.name}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {job.stops.length > 1 && (
                                        <div className="space-y-2">
                                            <SectionTitle>Visiting order</SectionTitle>
                                            {draftOrder ? (
                                                <div className="space-y-2 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 p-3">
                                                    <p className="text-xs text-zinc-700 dark:text-zinc-300">Move stops with the arrows in the route list.</p>
                                                    <Delta fromKm={savedEffort.km} toKm={effort.km} fromMin={savedEffort.totalMin} toMin={effort.totalMin} />
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setDraft(null)}>
                                                            Discard
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 flex-1 text-xs"
                                                            onClick={() => {
                                                                onSaveOrder(draftOrder)
                                                                setDraft(null)
                                                            }}
                                                        >
                                                            Save order
                                                        </Button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
                                                        onClick={() => setDraft({ jobId: job.id, order: best.map((s) => s.farmerId) })}
                                                    >
                                                        Use the shortest order
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className={cn("text-xs", bestSaves ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500")}>
                                                        {bestSaves && savedEffort.km !== undefined && bestEffort.km !== undefined
                                                            ? `A shorter order saves ${formatKm(savedEffort.km - bestEffort.km)} (${formatMinutes(savedEffort.totalMin - bestEffort.totalMin)}).`
                                                            : "This is already the shortest order."}
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setDraft({ jobId: job.id, order: job.stops.map((s) => s.farmerId) })}>
                                                            Rearrange
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 flex-1 text-xs"
                                                            disabled={!bestSaves}
                                                            onClick={() => setDraft({ jobId: job.id, order: best.map((s) => s.farmerId) })}
                                                        >
                                                            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                                                            Preview shortest
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <SectionTitle>Add tasks</SectionTitle>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                            <Input placeholder="Task id or farmer (T12, Farmer 6)" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
                                        </div>
                                        {q && (
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                {matches.length === 0 ? (
                                                    <p className="px-3 py-2 text-[11px] text-zinc-500">No task due on {formatYmd(job.date)} matches. Tasks on accepted jobs can&apos;t be added.</p>
                                                ) : (
                                                    matches.map(({ task, holder }) => {
                                                        const full = fullFor(task.farmerId)
                                                        const f = farmerById.get(task.farmerId)
                                                        return (
                                                            <button
                                                                key={task.id}
                                                                type="button"
                                                                disabled={full}
                                                                onClick={() => {
                                                                    onAddTasks([task.id])
                                                                    setQuery("")
                                                                }}
                                                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <span className="truncate">
                                                                    <span className="font-mono font-semibold">T{task.taskNo}</span> · {surveyName.get(task.surveyId) ?? task.surveyId}
                                                                </span>
                                                                <span className="truncate text-[10px] text-zinc-500">
                                                                    {f?.name ?? "?"} · {f?.village || "No village"} ·{" "}
                                                                    {full ? `${record.jobCode} is full` : holder ? `on J${holder.jobNo}, moves here` : locate(task.farmerId) ? "unassigned" : "no location"}
                                                                </span>
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        )}
                                        {hasMapKey && <p className="text-[10px] text-zinc-400">Or click a grey pin on the map.</p>}
                                    </div>
                                </>
                            ) : (
                                job.status !== JOB_STATUS.closed && <p className="text-xs text-zinc-500">The surveyor accepted this job, so its surveyor and stops can no longer change.</p>
                            )}

                            <div className="space-y-3">
                                <SectionTitle>Timeline</SectionTitle>
                                <ol className="space-y-2.5 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                                    {[...job.history].reverse().map((e, i) => (
                                        <li key={`${e.at}-${i}`} className="relative">
                                            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                            <div className="text-sm text-zinc-900 dark:text-zinc-100">{eventText(e)}</div>
                                            {e.note && <div className="text-xs text-zinc-600 dark:text-zinc-400">{e.note}</div>}
                                            <div className="text-[11px] text-zinc-400">{format(new Date(e.at), "dd MMM yy, hh:mm a").toUpperCase()}</div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>

                        {/* Status actions and pager */}
                        <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 p-3 space-y-2">
                            {job.status !== JOB_STATUS.closed && (
                                <div className="flex gap-2">
                                    {job.status === JOB_STATUS.created && (
                                        <Button
                                            variant="outline"
                                            className="h-9 flex-1 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-950/20"
                                            onClick={onDelete}
                                        >
                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                            Delete job
                                        </Button>
                                    )}
                                    {job.status === JOB_STATUS.assigned && (
                                        <Button variant="outline" className="h-9 flex-1 text-xs font-bold border-zinc-200 dark:border-zinc-800" onClick={onUnassign}>
                                            <Undo2 className="mr-2 h-3.5 w-3.5" />
                                            Pull back
                                        </Button>
                                    )}
                                    {job.status !== JOB_STATUS.created && (
                                        <Button variant="outline" className="h-9 flex-1 text-xs font-bold border-zinc-200 dark:border-zinc-800" onClick={() => setClosing(true)}>
                                            <ClipboardCheck className="mr-2 h-3.5 w-3.5" />
                                            Close job sheet
                                        </Button>
                                    )}
                                    {job.status === JOB_STATUS.created && (
                                        <Button className="h-9 flex-1 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900" disabled={job.stops.length === 0 || Boolean(draftOrder)} onClick={onAssign}>
                                            <Send className="mr-2 h-3.5 w-3.5" />
                                            Assign
                                        </Button>
                                    )}
                                </div>
                            )}
                            {currentIndex >= 0 && (
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onPrevious} disabled={isFirst} title="Previous job">
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex + 1} / {totalCount}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onNext} disabled={isLast} title="Next job">
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {closing && (
                <CloseJobDialog
                    jobCode={record.jobCode}
                    doneStops={job.stops.length - unfinished.length}
                    unfinished={unfinished.map((i) => ({
                        index: i,
                        farmerName: farmerName(job.stops[i].farmerId),
                        taskCodes: job.stops[i].taskIds.filter((id) => taskById.get(id)?.status === STATUS.planned).map(code).join(", "),
                    }))}
                    onClose={() => setClosing(false)}
                    onConfirm={(reasons) => {
                        onCloseSheet(reasons)
                        setClosing(false)
                    }}
                />
            )}
        </>
    )
}
