"use client"

// Add tasks to a surveyor's job for a day — styled like the cancel-reason dialog (Deployment's report pop-up). Before
// saving it shows what happens (jobs.ts planAddToJob): visits added against the surveyor's daily capacity, a new created
// job when they have none that day, the same farmers' other due tasks that come along, tasks moving off another job,
// and tasks that can't go (not due that day, or on a job the surveyor already accepted).
import * as React from "react"
import { Route as RouteIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUS, Task } from "@/lib/orchestration/engine"
import { JOB_STATUS, JOB_STATUS_NAME, Job, SkipReason, Surveyor, openJobFor, openJobsByTask, planAddToJob } from "@/lib/orchestration/jobs"
import { cn } from "@/lib/utils"
import { TaskRecord } from "../data/schema"
import { formatYmd } from "./columns"

interface AddToJobDialogProps {
    taskIds: string[]
    tasks: Task[]
    records: TaskRecord[]
    jobs: Job[]
    surveyors: Surveyor[]
    today: string
    onClose: () => void
    onAdd: (surveyorId: string, date: string) => void
}

/** Mounted only while open (the page renders it with a key), so its defaults are worked out once per opening. */
export function AddToJobDialog({ taskIds, tasks, records, jobs, surveyors, today, onClose, onAdd }: AddToJobDialogProps) {
    const recordById = React.useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
    const active = surveyors.filter((s) => s.active)

    // Defaults: the surveyor the selected tasks are already with (when it's one), and today or the earliest start after it.
    const [surveyorId, setSurveyorId] = React.useState(() => {
        const held = openJobsByTask(jobs)
        const current = new Set(taskIds.map((id) => held.get(id)?.job.surveyorId))
        const only = current.size === 1 ? [...current][0] : undefined
        return only && active.some((s) => s.id === only) ? only : ""
    })
    const [date, setDate] = React.useState(() => {
        const starts = taskIds.map((id) => recordById.get(id)).filter((r) => r?.status === STATUS.planned).map((r) => r!.plannedStart)
        const earliest = starts.sort()[0]
        return earliest && earliest > today ? earliest : today
    })

    const surveyor = active.find((s) => s.id === surveyorId)
    const plan = surveyor ? planAddToJob({ jobs, tasks, taskIds, surveyorId, date, maxVisits: surveyor.maxVisitsPerDay }) : null
    const onTarget = new Set(plan?.target?.stops.flatMap((s) => s.taskIds) ?? [])
    const newTaskIds = plan?.taskIds.filter((id) => !onTarget.has(id)) ?? []
    const surveyorName = (id: string) => surveyors.find((s) => s.id === id)?.name ?? "another surveyor"

    const farmerCount = new Set(taskIds.map((id) => recordById.get(id)?.farmerId)).size
    const code = (id: string) => recordById.get(id)?.taskCode ?? id
    const skipText = (id: string, reason: SkipReason) => {
        const r = recordById.get(id)
        if (reason === "not-started") return `${code(id)} starts ${formatYmd(r!.plannedStart)}`
        if (reason === "ended") return `${code(id)} ended ${formatYmd(r!.plannedEnd!)}`
        if (reason === "locked") return `${code(id)} is on ${r?.jobCode ?? "a job"}, already accepted`
        return `${code(id)} is ${r?.status ?? "not planned"}`
    }
    const jobOn = (s: Surveyor) => openJobFor(jobs, s.id, date)
    const canAdd = Boolean(plan && !plan.locked && !plan.overCapacity && newTaskIds.length > 0 && date)
    const target = plan?.target

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-[520px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                <div className="bg-white dark:bg-zinc-950">
                    <div className="p-6 pb-0 flex items-start justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Add to a job</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                {taskIds.length} {taskIds.length === 1 ? "task" : "tasks"} for {farmerCount} {farmerCount === 1 ? "farmer" : "farmers"}. A job is one surveyor&apos;s
                                visits for a day; each farmer is one stop, covering all of that farmer&apos;s tasks due then.
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {active.length === 0 ? (
                        <div className="m-6 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center space-y-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No surveyors yet</p>
                            <p className="text-xs text-zinc-500">
                                Add them on{" "}
                                <a href="/layouts/masters" className="font-semibold underline underline-offset-2">
                                    Masters → Surveyors
                                </a>
                                , then come back.
                            </p>
                        </div>
                    ) : (
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-[1fr_170px] gap-3">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Surveyor</Label>
                                    <Select value={surveyorId} onValueChange={setSurveyorId}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select a surveyor" />
                                        </SelectTrigger>
                                        <SelectContent className="z-[600]">
                                            {active.map((s) => {
                                                const job = jobOn(s)
                                                return (
                                                    <SelectItem key={s.id} value={s.id} className="text-sm">
                                                        {s.name}
                                                        <span className="ml-2 text-xs text-zinc-400">
                                                            {job ? `J${job.jobNo} · ${job.stops.length}/${s.maxVisitsPerDay}` : `no job · 0/${s.maxVisitsPerDay}`}
                                                        </span>
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="job-date" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Job date
                                    </Label>
                                    <Input id="job-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
                                </div>
                            </div>

                            {plan && surveyor && (
                                <div
                                    className={cn(
                                        "rounded-lg border p-3 text-xs space-y-1.5 leading-relaxed",
                                        plan.locked || plan.overCapacity
                                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                                            : "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                    )}
                                >
                                    {plan.locked && target ? (
                                        <p className="font-semibold">
                                            J{target.jobNo} ({surveyor.name}, {formatYmd(date)}) is already {target.status === JOB_STATUS.accepted ? "accepted" : "in progress"}: its stops can&apos;t
                                            change. Pick another surveyor or day.
                                        </p>
                                    ) : plan.overCapacity ? (
                                        <p className="font-semibold">
                                            That makes {plan.visitsAfter} visits on {formatYmd(date)}; {surveyor.name} can make at most {surveyor.maxVisitsPerDay} a day. Pick fewer
                                            farmers, another surveyor or another day.
                                        </p>
                                    ) : plan.taskIds.length === 0 ? (
                                        <p className="font-semibold">None of these tasks can go on a job on {formatYmd(date)}.</p>
                                    ) : newTaskIds.length === 0 ? (
                                        <p className="font-semibold">Already on J{target?.jobNo}.</p>
                                    ) : target ? (
                                        <p className="font-semibold">
                                            {plan.visitsAfter > plan.visitsBefore
                                                ? `Adds ${plan.visitsAfter - plan.visitsBefore} ${plan.visitsAfter - plan.visitsBefore === 1 ? "visit" : "visits"} to`
                                                : "Adds the tasks to visits already on"}{" "}
                                            J{target.jobNo} ({JOB_STATUS_NAME[target.status].toLowerCase()}): {plan.visitsAfter} of {surveyor.maxVisitsPerDay} visits.
                                            {target.status === JOB_STATUS.assigned && " The surveyor sees the change before accepting."}
                                        </p>
                                    ) : (
                                        <p className="font-semibold">
                                            Creates a job for {surveyor.name} on {formatYmd(date)} with {plan.visitsAfter} {plan.visitsAfter === 1 ? "visit" : "visits"}. It starts as created:
                                            assign it on Task planning to send it to the phone.
                                        </p>
                                    )}
                                    {plan.added.length > 0 && <p>Also adds {plan.added.map(code).join(", ")}: same farmer, due that day.</p>}
                                    {plan.moved.length > 0 && (
                                        <p>Moves {plan.moved.map((m) => `${code(m.taskId)} off J${m.from.jobNo} (${surveyorName(m.from.surveyorId)})`).join("; ")}.</p>
                                    )}
                                    {plan.skipped.length > 0 && <p>Left out: {plan.skipped.map((s) => skipText(s.taskId, s.reason)).join("; ")}.</p>}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-6 pt-0 flex items-center justify-end gap-3">
                        <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button className="h-9 px-4 text-xs font-bold" disabled={!canAdd} onClick={() => onAdd(surveyorId, date)}>
                            <RouteIcon className="mr-2 h-3.5 w-3.5" />
                            Add {newTaskIds.length > 0 ? `${newTaskIds.length} ${newTaskIds.length === 1 ? "task" : "tasks"}` : ""}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
