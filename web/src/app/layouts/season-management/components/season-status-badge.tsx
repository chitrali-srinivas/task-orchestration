"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SeasonStatus, ActivityStatus } from "../data/schema";

interface StatusBadgeProps {
    status: SeasonStatus | ActivityStatus | string;
    className?: string;
    showDot?: boolean;
}

export function SeasonStatusBadge({ status, className }: StatusBadgeProps) {
    // There is no "Resolved" state in Season Management; fallback to Completed if passed
    const rawStatus = (status || "").trim();
    const isResolved = rawStatus.toLowerCase() === "resolved";
    const effectiveStatus = isResolved ? "Completed" : rawStatus;
    const normalized = effectiveStatus.toLowerCase();

    let style = "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-400 dark:border-zinc-900/50";

    switch (normalized) {
        case "planned":
            style = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50";
            break;
        case "completed":
            style = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50";
            break;
        case "inprogress":
        case "in progress":
        case "in-progress":
            style = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50";
            break;
        case "cancelled":
        case "canceled":
            style = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50";
            break;
        case "draft":
            style = "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-400 dark:border-zinc-900/50";
            break;
    }

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-semibold px-2.5 py-0.5 rounded-full border shadow-none text-xs capitalize whitespace-nowrap",
                style,
                className
            )}
        >
            {effectiveStatus}
        </Badge>
    );
}

