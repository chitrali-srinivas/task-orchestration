"use client"

// Farmer detail — the Tasks detail sheet's layout (tasks/components/task-detail-sheet.tsx) for one farmer: header with
// the village, details bar (registered, where planning finds them), the location, the tasks by status and every task
// with its job; each task opens on the Tasks page. Footer: the previous / next pager.
import * as React from "react"
import { ChevronLeft, ChevronRight, Inbox, MapPin, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { JOB_STATUS_NAME } from "@/lib/orchestration/jobs"
import { formatYmd, initials } from "@/app/layouts/tasks/components/columns"
import { TaskStatusBadge } from "@/app/layouts/tasks/components/task-status"
import { statusLabel } from "@/app/layouts/tasks/data/data-source"
import { FarmerRecord } from "../data/schema"
import { LocationBadge } from "./columns"

const LOCATION_NOTE: Record<FarmerRecord["locationSource"], string> = {
    gps: "From the GPS point captured at registration.",
    plot: "The centre of the plot boundary drawn at registration.",
    village: "No point was captured, so visits go to the village centre (Masters - Village).",
    none: "No point was captured and the village has no centre, so planning can't place this farmer. Add the village's centre in Masters - Village.",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h3>
            {children}
        </div>
    )
}

interface FarmerDetailSheetProps {
    record: FarmerRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onPrevious: () => void
    onNext: () => void
    isFirst: boolean
    isLast: boolean
    /** Position in the table, -1 when the farmer is not on the current page. */
    currentIndex: number
    totalCount: number
}

export function FarmerDetailSheet({ record, open, onOpenChange, onPrevious, onNext, isFirst, isLast, currentIndex, totalCount }: FarmerDetailSheetProps) {
    if (!record) return null
    const statuses = Object.entries(record.statusCounts)

    return (
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
                                    <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{initials(record.name)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left min-w-0">
                                    <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight truncate">{record.name}</SheetTitle>
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
                        <div className="truncate">Registered {formatYmd(record.registeredOn)}</div>
                        <LocationBadge source={record.locationSource} label={record.locationLabel} className="shrink-0" />
                    </div>
                </div>

                {/* Body */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                        <Section title="Location">
                            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-1">
                                {record.location ? (
                                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                                        {record.location.lat.toFixed(6)}, {record.location.lng.toFixed(6)}
                                    </div>
                                ) : (
                                    <div className="text-sm text-zinc-500">No location</div>
                                )}
                                <p className="text-xs text-zinc-500">{LOCATION_NOTE[record.locationSource]}</p>
                            </div>
                        </Section>

                        <Section title={`Tasks · ${record.taskCount}`}>
                            {statuses.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {statuses.map(([status, n]) => (
                                        <span key={status} className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                            <TaskStatusBadge status={status} /> {n}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {record.tasks.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center">
                                    <Inbox className="h-5 w-5 text-zinc-400" />
                                    <p className="text-xs text-zinc-500">No tasks for this farmer.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                    {record.tasks.map((t) => (
                                        <a
                                            key={t.id}
                                            href={`/layouts/tasks?task=${t.id}`}
                                            className="flex items-start justify-between gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                                            title={`Open ${t.taskCode} on the Tasks page`}
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                                    <span className="font-mono font-semibold">{t.taskCode}</span> · {t.surveyName}
                                                </div>
                                                <div className="text-[11px] text-zinc-500">
                                                    {formatYmd(t.plannedStart)} → {t.plannedEnd ? formatYmd(t.plannedEnd) : "indefinite"}
                                                    {t.jobCode && t.jobStatus && ` · ${t.jobCode} ${JOB_STATUS_NAME[t.jobStatus].toLowerCase()}${t.visitDate ? ` on ${formatYmd(t.visitDate)}` : ""}`}
                                                </div>
                                                {t.jobNote && <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">{t.jobNote}</div>}
                                                {t.statusComment && <div className="text-[11px] text-zinc-500">{statusLabel(t.status)}: {t.statusComment}</div>}
                                            </div>
                                            <TaskStatusBadge status={t.status} className="shrink-0" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </Section>
                    </div>
                </ScrollArea>

                {/* Footer: pager */}
                <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevious} disabled={isFirst} title="Previous farmer">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext} disabled={isLast} title="Next farmer">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <span className="text-xs text-zinc-500">{currentIndex >= 0 ? `${currentIndex + 1} of ${totalCount}` : `${totalCount} farmers`}</span>
                </div>
            </SheetContent>
        </Sheet>
    )
}
