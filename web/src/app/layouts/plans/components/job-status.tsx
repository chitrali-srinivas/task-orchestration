"use client"

import { Badge } from "@/components/ui/badge"
import { JOB_STATUS_NAME, type JobStatus } from "@/lib/orchestration/jobs"
import { cn } from "@/lib/utils"
import { JOB_STATUS_LABEL } from "../data/data-source"

// Deployment's status pill (outline, rounded-full), one colour per lifecycle step.
const STATUS_STYLE: Record<JobStatus, string> = {
    created: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
    assigned: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50",
    accepted: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    closed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
}

export function JobStatusBadge({ status, long, className }: { status: JobStatus; long?: boolean; className?: string }) {
    return (
        <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none whitespace-nowrap", STATUS_STYLE[status], className)}>
            {(long ? JOB_STATUS_NAME : JOB_STATUS_LABEL)[status]}
        </Badge>
    )
}
