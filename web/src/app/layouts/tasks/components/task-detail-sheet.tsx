"use client"

// Task detail — Deployment's detail sheet (deployment/components/engagement-detail-sheet.tsx) for one task: farmer header,
// details bar, the task's dates, route assignment and lineage, the survey response, and a footer with the previous / next
// pager and the HQ actions (assign planned tasks to a surveyor, verify, cancel). Cancelling asks for a reason, as
// Deployment's Report asks for a comment. No map yet: the route map comes with the Route planning page.
import * as React from "react"
import { format } from "date-fns"
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, MapPin, Route as RouteIcon, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { STATUS } from "@/lib/orchestration/engine"
import { cn } from "@/lib/utils"
import type { QuestionModel, SurveyModel } from "@/app/layouts/survey-builder/types/survey-schema"
import { TaskRecord } from "../data/schema"
import { formatYmd, initials } from "./columns"
import { TaskStatusBadge } from "./task-status"

type Answer = { kind: "empty" } | { kind: "text"; text: string } | { kind: "images"; urls: string[] }

const questionTitle = (q: QuestionModel) => q.titles?.en || Object.values(q.titles ?? {})[0] || q.columnName || q.id

function optionLabel(q: QuestionModel | undefined, value: string | number): string {
    const option = q?.options?.find((o) => o.value === value || o.id === value)
    return option ? option.labels?.en || Object.values(option.labels ?? {})[0] || option.value : String(value)
}

/** Readable text for any stored answer shape (choice values, dates, date ranges, master records, locations, boundaries). */
function answerText(q: QuestionModel | undefined, value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return optionLabel(q, value)
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (Array.isArray(value)) return value.map((v) => answerText(q, v)).filter(Boolean).join(", ")
    if (value && typeof value === "object") {
        const o = value as Record<string, unknown>
        if (typeof o.displayValue === "string") return o.displayValue
        if (typeof o.start === "string") return o.end ? `${o.start} → ${o.end}` : o.start
        if (typeof o.lat === "number" && typeof o.lng === "number") return `${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}`
        if (typeof o.vertexCount === "number") return `Boundary · ${o.vertexCount} points${o.estimatedAreaAcres ? ` · ~${o.estimatedAreaAcres} acres` : ""}`
        return JSON.stringify(value)
    }
    return ""
}

function answerOf(q: QuestionModel | undefined, value: unknown): Answer {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return { kind: "empty" }
    if (q?.type === "Picture Input") {
        const urls = (Array.isArray(value) ? value : [value]).filter((u): u is string => typeof u === "string")
        if (urls.length > 0) return { kind: "images", urls }
    }
    const text = answerText(q, value)
    return text ? { kind: "text", text } : { kind: "empty" }
}

const NO_RESPONSE: Record<string, string> = {
    [STATUS.planned]: "The surveyor hasn't submitted this survey yet.",
    [STATUS.expired]: "This task expired before it was collected.",
    [STATUS.cancelled]: "This task was cancelled before it was collected.",
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between pt-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{children}</h3>
            {right}
        </div>
    )
}

function EmptyBox({ title, text }: { title: string; text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/5 select-none">
            <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
                <Inbox className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase block mb-1">{title}</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[260px]">{text}</p>
        </div>
    )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
            <div className="text-sm text-zinc-900 dark:text-zinc-100">{children}</div>
        </div>
    )
}

interface TaskDetailSheetProps {
    record: TaskRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
    survey?: SurveyModel
    parent?: TaskRecord
    followUps: TaskRecord[]
    onSelectTask: (id: string) => void
    onPrevious: () => void
    onNext: () => void
    isFirst: boolean
    isLast: boolean
    /** Position in the table's current page, -1 when the task is not on it (e.g. opened from a lineage link). */
    currentIndex: number
    totalCount: number
    onVerify: () => void
    onCancel: (reason: string) => void
    onAssign: () => void
    onUnassign: () => void
}

export function TaskDetailSheet({
    record,
    open,
    onOpenChange,
    survey,
    parent,
    followUps,
    onSelectTask,
    onPrevious,
    onNext,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    onVerify,
    onCancel,
    onAssign,
    onUnassign,
}: TaskDetailSheetProps) {
    const [cancelOpen, setCancelOpen] = React.useState(false)
    const [reason, setReason] = React.useState("")

    const answers = React.useMemo(() => {
        const response = record?.task.response
        if (!response) return []
        const questions = survey?.questions ?? []
        const known = new Set(questions.map((q) => q.id))
        return [
            ...questions.map((q) => ({ id: q.id, label: `${q.displayIndex || q.number}. ${questionTitle(q)}`, answer: answerOf(q, response[q.id]) })),
            // Answers to questions no longer in the template (it was edited after collection).
            ...Object.keys(response)
                .filter((key) => !known.has(key))
                .map((key) => ({ id: key, label: key, answer: answerOf(undefined, response[key]) })),
        ]
    }, [record, survey])

    if (!record) return null
    const canVerify = record.status === STATUS.collected
    const canCancel = record.status === STATUS.collected || record.status === STATUS.planned
    const canAssign = record.status === STATUS.planned
    const answeredCount = answers.filter((a) => a.answer.kind !== "empty").length

    const submitCancel = () => {
        onCancel(reason.trim())
        setCancelOpen(false)
        setReason("")
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[200] focus-visible:outline-none [&>button]:hidden"
                >
                    {/* Header */}
                    <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                        <div className="p-5">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Avatar className="h-12 w-12 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{initials(record.farmerName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left min-w-0">
                                        <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight truncate">{record.farmerName}</SheetTitle>
                                        <SheetDescription asChild>
                                            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 font-medium">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{record.village || "No village recorded"}</span>
                                            </div>
                                        </SheetDescription>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    onClick={() => onOpenChange(false)}
                                    title="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {/* Details bar */}
                        <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between gap-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            <div className="truncate">
                                <span className="font-mono">{record.taskCode}</span> . {record.surveyName}
                                {record.surveyVersion !== undefined && ` v${record.surveyVersion}`}
                            </div>
                            <div className="truncate shrink-0 max-w-[45%]">{record.workflowName}</div>
                        </div>
                    </div>

                    {/* Body */}
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <SectionTitle right={<TaskStatusBadge status={record.status} />}>Task</SectionTitle>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <Detail label="Planned start">{formatYmd(record.plannedStart)}</Detail>
                                    <Detail label="Planned end">{record.plannedEnd ? formatYmd(record.plannedEnd) : <span className="text-zinc-500">Indefinite</span>}</Detail>
                                    <Detail label="Created from">
                                        {parent ? (
                                            <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onSelectTask(parent.id)}>
                                                {record.createdFrom}
                                            </button>
                                        ) : (
                                            record.createdFrom
                                        )}
                                    </Detail>
                                    <Detail label="Last updated">{format(new Date(record.updatedAt), "dd MMM yy, hh:mm a").toUpperCase()}</Detail>
                                    <Detail label="Assigned to">
                                        {record.assignedTo ?? <span className="text-zinc-500">{canAssign ? "Unassigned" : "-"}</span>}
                                    </Detail>
                                    <Detail label="Visit">
                                        {record.visitDate ? (
                                            <>
                                                {formatYmd(record.visitDate)}
                                                <span className="text-zinc-500"> · stop {record.stopNo} of {record.stopCount}</span>
                                            </>
                                        ) : (
                                            <span className="text-zinc-500">-</span>
                                        )}
                                    </Detail>
                                </div>
                                {canAssign && record.routeId && (
                                    <button type="button" className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100" onClick={onUnassign}>
                                        Remove from {record.assignedTo}&apos;s route
                                    </button>
                                )}
                                {record.statusComment && (
                                    <div
                                        className={cn(
                                            "rounded-lg border p-3 text-xs space-y-1",
                                            record.status === STATUS.cancelled
                                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                                                : "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                        )}
                                    >
                                        <div className="font-bold uppercase tracking-wider text-[10px]">{record.status === STATUS.cancelled ? "Cancellation reason" : "Comment"}</div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{record.statusComment}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <SectionTitle right={answers.length > 0 && <span className="text-xs font-semibold text-zinc-500">{answeredCount} / {answers.length} answered</span>}>
                                    Survey response
                                </SectionTitle>
                                {answers.length === 0 ? (
                                    <EmptyBox title="No response yet" text={NO_RESPONSE[record.status] ?? "This task has no survey response."} />
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                        {answers.map(({ id, label, answer }) => (
                                            <div key={id} className="px-4 py-3 space-y-1">
                                                <div className="text-xs text-zinc-500">{label}</div>
                                                {answer.kind === "empty" ? (
                                                    <div className="text-sm text-zinc-400">Not answered</div>
                                                ) : answer.kind === "images" ? (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {answer.urls.map((url) => (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img key={url} src={url} alt="" className="h-20 w-20 rounded-md object-cover border border-zinc-200 dark:border-zinc-800" />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words">{answer.text}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <SectionTitle>Follow-up tasks</SectionTitle>
                                {followUps.length === 0 ? (
                                    <p className="text-xs text-zinc-500">None yet. The workflow creates them when this task reaches a status that has a next step.</p>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                        {followUps.map((child) => (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() => onSelectTask(child.id)}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm truncate">
                                                        <span className="font-mono font-semibold">{child.taskCode}</span> · {child.surveyName}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500">Planned start {formatYmd(child.plannedStart)}</div>
                                                </div>
                                                <TaskStatusBadge status={child.status} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer: pager + actions */}
                    <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {currentIndex >= 0 && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" onClick={onPrevious} disabled={isFirst} title="Previous task">
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex + 1} / {totalCount}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" onClick={onNext} disabled={isLast} title="Next task">
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {canCancel && (
                                <Button
                                    variant="outline"
                                    className="h-9 px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all dark:hover:bg-red-950/20"
                                    onClick={() => setCancelOpen(true)}
                                >
                                    <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                    Cancel task
                                </Button>
                            )}
                            {canAssign && (
                                <Button
                                    className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                    onClick={onAssign}
                                >
                                    <RouteIcon className="mr-2 h-3.5 w-3.5" />
                                    {record.routeId ? "Reassign" : "Assign"}
                                </Button>
                            )}
                            {canVerify && (
                                <Button
                                    className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                    onClick={onVerify}
                                >
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                    Verify
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Cancel reason (Deployment's report comment pop-up) */}
            <Dialog
                open={cancelOpen}
                onOpenChange={(next) => {
                    setCancelOpen(next)
                    if (!next) setReason("")
                }}
            >
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <div className="bg-white dark:bg-zinc-950">
                        <div className="p-6 pb-0 flex items-start justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Cancel task</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                    You are cancelling{" "}
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {record.taskCode} · {record.surveyName}
                                    </span>{" "}
                                    for {record.farmerName}. The surveyor will no longer see it.
                                </DialogDescription>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={() => setCancelOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-6 space-y-2">
                            <Label htmlFor="cancel-reason" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="cancel-reason"
                                placeholder="Why is this task being cancelled?"
                                className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>
                        <div className="p-6 pt-0 flex items-center justify-end gap-3">
                            <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={() => setCancelOpen(false)}>
                                Keep task
                            </Button>
                            <Button className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-none" onClick={submitCancel} disabled={!reason.trim()}>
                                <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                Cancel task
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
