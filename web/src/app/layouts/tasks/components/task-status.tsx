"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusLabel } from "../data/data-source"

// Deployment's status pill (outline, rounded-full); custom template statuses fall back to neutral.
const STATUS_STYLE: Record<string, string> = {
    planned: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
    collected: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    expired: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
    cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
}

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
    return (
        <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none", STATUS_STYLE[status] || STATUS_STYLE.planned, className)}>
            {statusLabel(status)}
        </Badge>
    )
}
