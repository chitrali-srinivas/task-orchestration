"use client"

// Plan jobs — a right sheet in two steps. Setup: the day, the active surveyors and the farmers to visit (each farmer is
// one stop covering all of their tasks due that day; by default every unassigned task due that day, or the tasks ticked
// on the Tasks page). Preview: what the planner proposes (jobs.ts planJobs), one job per surveyor in visiting order,
// plus what it left out and why. "Create jobs" saves them as created, for review before they are assigned.
import * as React from "react"
import { ArrowLeft, Search, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { STATUS, type Farmer, type LatLng, type Task } from "@/lib/orchestration/engine"
import { Job, JobPlan, Surveyor, UnplannedReason, Village, byUrgency, distanceKm, openJobFor, openJobsByTask, planJobs, stopLocation, visitableOn } from "@/lib/orchestration/jobs"
import { cn } from "@/lib/utils"
import { baseOf } from "../data/data-source"
import { formatKm, formatYmd } from "./columns"

const UNPLANNED_TEXT: Record<UnplannedReason, string> = {
    "no-capacity": "No surveyor has visits left that day",
    "no-location": "No location: no GPS at registration and the village isn't in the Villages master",
    "no-surveyor": "No surveyor selected",
}

interface PlanJobsSheetProps {
    today: string
    jobs: Job[]
    tasks: Task[]
    farmers: Farmer[]
    surveyors: Surveyor[]
    villages: Village[]
    /** Tasks ticked on the Tasks page ("Plan these"); empty = every unassigned task due that day. */
    initialTaskIds: string[]
    onClose: () => void
    onCreate: (plan: JobPlan, date: string) => void
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</Label>
                {right}
            </div>
            {children}
        </div>
    )
}

/** Mounted only while open (the page renders it with a key). */
export function PlanJobsSheet({ today, jobs, tasks, farmers, surveyors, villages, initialTaskIds, onClose, onCreate }: PlanJobsSheetProps) {
    const taskById = React.useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
    const farmerById = React.useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers])
    const code = (id: string) => (taskById.get(id) ? `T${taskById.get(id)!.taskNo}` : "?")
    const active = surveyors.filter((s) => s.active)

    const [step, setStep] = React.useState<"setup" | "preview">("setup")
    const [date, setDate] = React.useState(() => {
        const starts = initialTaskIds.map((id) => taskById.get(id)).filter((t) => t?.status === STATUS.planned).map((t) => t!.plannedStart)
        const earliest = starts.sort()[0]
        return earliest && earliest > today ? earliest : today
    })
    const [surveyorIds, setSurveyorIds] = React.useState<Set<string>>(() => new Set(active.map((s) => s.id)))
    // null = every farmer listed; otherwise only these (from the Tasks page, or after unticking).
    const [picked, setPicked] = React.useState<Set<string> | null>(() =>
        initialTaskIds.length > 0 ? new Set(initialTaskIds.map((id) => taskById.get(id)?.farmerId).filter((f): f is string => Boolean(f))) : null
    )
    const [query, setQuery] = React.useState("")

    // Farmers with tasks due that day that no open job holds, most urgent first.
    const candidates = React.useMemo(() => {
        const held = openJobsByTask(jobs)
        const due = tasks.filter((t) => visitableOn(t, date) && !held.has(t.id)).sort(byUrgency)
        const out: { farmerId: string; taskIds: string[] }[] = []
        due.forEach((t) => {
            const c = out.find((x) => x.farmerId === t.farmerId)
            if (c) c.taskIds.push(t.id)
            else out.push({ farmerId: t.farmerId, taskIds: [t.id] })
        })
        return out
    }, [jobs, tasks, date])

    const isPicked = (farmerId: string) => picked === null || picked.has(farmerId)
    const selected = candidates.filter((c) => isPicked(c.farmerId))
    const selectedTaskIds = selected.flatMap((c) => c.taskIds)
    const shown = candidates.filter((c) => {
        const f = farmerById.get(c.farmerId)
        const q = query.trim().toLowerCase()
        return !q || `${f?.name ?? ""} ${f?.village ?? ""}`.toLowerCase().includes(q)
    })
    const notDue = initialTaskIds.filter((id) => !candidates.some((c) => c.taskIds.includes(id))).length
    const busyJob = (s: Surveyor) => openJobFor(jobs, s.id, date)
    const chosenSurveyors = active.filter((s) => surveyorIds.has(s.id) && !busyJob(s))

    const toggleFarmer = (farmerId: string, on: boolean) =>
        setPicked((p) => {
            const next = new Set(p ?? candidates.map((c) => c.farmerId))
            if (on) next.add(farmerId)
            else next.delete(farmerId)
            return next
        })

    // Setup can't change while the preview shows, so the plan is simply worked out on render.
    const plan = step === "preview" ? planJobs({ date, surveyors: chosenSurveyors, tasks, taskIds: selectedTaskIds, jobs, farmers, villages }) : null
    const totalKm = plan?.jobs.reduce((sum, j) => sum + (j.km ?? 0), 0) ?? 0

    return (
        <Sheet open onOpenChange={(next) => !next && onClose()}>
            <SheetContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="w-full sm:max-w-[560px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[200] focus-visible:outline-none [&>button]:hidden"
            >
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{step === "setup" ? "Plan jobs" : `Plan for ${formatYmd(date)}`}</SheetTitle>
                        <SheetDescription className="mt-1 text-xs text-zinc-500">
                            {step === "setup"
                                ? "Pick the day, the surveyors and the farmers. The planner proposes one job per surveyor, in visiting order."
                                : "Nothing is saved yet. Created jobs can still be edited before you assign them."}
                        </SheetDescription>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onClose} title="Close">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                    {step === "setup" ? (
                        <div className="p-6 space-y-6">
                            <Section title="Job date">
                                <Input type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-[180px] text-sm" />
                            </Section>

                            <Section title={`Surveyors · ${chosenSurveyors.length} selected`}>
                                {active.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-center text-xs text-zinc-500">
                                        No active surveyors. Add them on{" "}
                                        <a href="/layouts/masters" className="font-semibold underline underline-offset-2">
                                            Masters → Surveyors
                                        </a>
                                        .
                                    </p>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                        {active.map((s) => {
                                            const busy = busyJob(s)
                                            const baseName = villages.find((v) => v.id === s.baseVillageId)?.name
                                            return (
                                                <label key={s.id} className={cn("flex items-center gap-3 px-3 py-2.5", busy ? "opacity-60" : "cursor-pointer hover:bg-muted/50")}>
                                                    <Checkbox
                                                        checked={!busy && surveyorIds.has(s.id)}
                                                        disabled={Boolean(busy)}
                                                        onCheckedChange={(v) =>
                                                            setSurveyorIds((ids) => {
                                                                const next = new Set(ids)
                                                                if (v) next.add(s.id)
                                                                else next.delete(s.id)
                                                                return next
                                                            })
                                                        }
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm">{s.name}</div>
                                                        <div className="truncate text-[11px] text-zinc-500">
                                                            {busy ? `Already has J${busy.jobNo} that day` : `${baseName ? `Base: ${baseName}` : "No base village"} · up to ${s.maxVisitsPerDay} visits`}
                                                        </div>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                )}
                            </Section>

                            <Section
                                title={`Farmers to visit · ${selected.length} of ${candidates.length} · ${selectedTaskIds.length} tasks`}
                                right={
                                    candidates.length > 0 && (
                                        <div className="flex gap-3 text-[11px] font-semibold">
                                            <button type="button" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setPicked(null)}>
                                                All
                                            </button>
                                            <button type="button" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setPicked(new Set())}>
                                                None
                                            </button>
                                        </div>
                                    )
                                }
                            >
                                {notDue > 0 && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                        {notDue} of the tasks picked on the Tasks page {notDue === 1 ? "isn't" : "aren't"} due on {formatYmd(date)} or {notDue === 1 ? "is" : "are"} already on a job.
                                    </p>
                                )}
                                {candidates.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-center text-xs text-zinc-500">
                                        No unassigned tasks are due on {formatYmd(date)}.
                                    </p>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                            <Input placeholder="Search farmer or village" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
                                        </div>
                                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                            {shown.map((c) => {
                                                const f = farmerById.get(c.farmerId)
                                                const located = stopLocation(f, villages)
                                                return (
                                                    <label key={c.farmerId} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                                                        <Checkbox checked={isPicked(c.farmerId)} onCheckedChange={(v) => toggleFarmer(c.farmerId, Boolean(v))} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-sm">{f?.name ?? "?"}</div>
                                                            <div className="truncate text-[11px] text-zinc-500">
                                                                {f?.village || "No village"} · {c.taskIds.map(code).join(", ")}
                                                                {!located && <span className="text-amber-600"> · no location</span>}
                                                            </div>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </Section>
                        </div>
                    ) : (
                        plan && (
                            <div className="p-6 space-y-5">
                                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {plan.jobs.length} {plan.jobs.length === 1 ? "job" : "jobs"} · {plan.jobs.reduce((n, j) => n + j.stops.length, 0)} stops ·{" "}
                                    {plan.jobs.reduce((n, j) => n + j.stops.reduce((m, s) => m + s.taskIds.length, 0), 0)} tasks · {formatKm(totalKm)}
                                    <span className="block text-[11px] font-normal text-zinc-500">Straight-line distances, round trip from each base village.</span>
                                </div>

                                {plan.jobs.map((j) => {
                                    const s = surveyors.find((x) => x.id === j.surveyorId)
                                    const base = baseOf(s, villages)
                                    const locs = j.stops.map((st) => stopLocation(farmerById.get(st.farmerId), villages))
                                    return (
                                        <div key={j.surveyorId} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 px-4 py-2.5">
                                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s?.name}</span>
                                                <span className="text-xs text-zinc-500">
                                                    {j.stops.length}/{s?.maxVisitsPerDay} visits{j.km !== undefined && ` · ${formatKm(j.km)}`}
                                                </span>
                                            </div>
                                            <ol className="divide-y divide-zinc-50 dark:divide-zinc-900">
                                                {j.stops.map((st, i) => {
                                                    const f = farmerById.get(st.farmerId)
                                                    const from: LatLng | undefined = i === 0 ? base : locs[i - 1]
                                                    const leg = from && locs[i] ? distanceKm(from, locs[i]!) : undefined
                                                    return (
                                                        <li key={st.farmerId} className="flex items-center gap-3 px-4 py-2 text-xs">
                                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                                                                {i + 1}
                                                            </span>
                                                            <span className="min-w-0 flex-1 truncate">
                                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{f?.name}</span>
                                                                <span className="text-zinc-500">
                                                                    {" "}
                                                                    · {f?.village || "No village"} · {st.taskIds.map(code).join(", ")}
                                                                </span>
                                                            </span>
                                                            {leg !== undefined && <span className="shrink-0 tabular-nums text-zinc-500">{formatKm(leg)}</span>}
                                                        </li>
                                                    )
                                                })}
                                            </ol>
                                        </div>
                                    )
                                })}

                                {plan.unplanned.length > 0 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
                                        <div className="border-b border-amber-200 dark:border-amber-900/50 px-4 py-2.5 text-sm font-bold text-amber-800 dark:text-amber-300">
                                            Unplanned · {plan.unplanned.length} {plan.unplanned.length === 1 ? "stop" : "stops"}
                                        </div>
                                        <ul className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                            {plan.unplanned.map((u) => (
                                                <li key={u.stop.farmerId} className="px-4 py-2 text-xs">
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{farmerById.get(u.stop.farmerId)?.name}</span>
                                                    <span className="text-zinc-600 dark:text-zinc-400"> · {u.stop.taskIds.map(code).join(", ")}</span>
                                                    <div className="text-[11px] text-amber-800 dark:text-amber-400">{UNPLANNED_TEXT[u.reason]}</div>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="px-4 py-2 text-[11px] text-amber-800 dark:text-amber-400">They stay pending and come first in the next plan. You can also add them to a job by hand.</p>
                                    </div>
                                )}
                                {plan.jobs.length === 0 && plan.unplanned.length === 0 && <p className="text-xs text-zinc-500">Nothing to plan.</p>}
                            </div>
                        )
                    )}
                </ScrollArea>

                <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 p-4 flex items-center justify-end gap-2">
                    {step === "setup" ? (
                        <>
                            <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button className="h-9 px-5 text-xs font-bold gap-1.5" disabled={chosenSurveyors.length === 0 || selected.length === 0} onClick={() => setStep("preview")}>
                                <Sparkles className="h-3.5 w-3.5" />
                                Preview plan
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" className="h-9 px-4 text-xs font-bold gap-1.5" onClick={() => setStep("setup")}>
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Back
                            </Button>
                            <Button className="h-9 px-5 text-xs font-bold" disabled={!plan || plan.jobs.length === 0} onClick={() => plan && onCreate(plan, date)}>
                                Create {plan?.jobs.length ?? 0} {plan?.jobs.length === 1 ? "job" : "jobs"}
                            </Button>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
