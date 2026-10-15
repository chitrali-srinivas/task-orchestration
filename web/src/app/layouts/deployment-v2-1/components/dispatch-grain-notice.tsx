"use client"

// V2.1: what the table is, and the only states above the rows that need acting on.
// Live API audit (2026-10-11): the list API returns one row per dispatch; its status filter, paging and counts are per
// dispatch. The table lists exactly those rows — the explanation (DISPATCH_GRAIN_COPY) is in the Data / API Inspector.
// Above the rows: Boundaries values that couldn't be read (Retry) and rows the API sent without a dispatch id.
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const DISPATCH_GRAIN_COPY = "One row per dispatch, as the list API returns them. The tabs filter, page and count dispatches on the server (getDeploymentMetadata status; getDeploymentStatusCounts). The Boundaries column reads each loaded deployment's plots (getTrailerDetails), once per farmer · round · AZ."

export function DispatchGrainStatus({ boundaryFailures, withoutId, onRetryFailed }: { boundaryFailures: number; withoutId: number; onRetryFailed: () => void }) {
    if (boundaryFailures === 0 && withoutId === 0) return null
    return (
        <div data-dispatch-grain-notice data-boundary-failures={boundaryFailures} data-rows-without-id={withoutId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4">
            {boundaryFailures > 0 && (
                <span data-notice-failed className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-300 font-medium">
                    <AlertCircle className="h-3 w-3" aria-hidden />
                    Boundaries of {boundaryFailures} deployment{boundaryFailures === 1 ? "" : "s"} couldn&apos;t be read.
                    <Button variant="outline" size="sm" data-notice-retry onClick={onRetryFailed} className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider">Retry</Button>
                </span>
            )}
            {withoutId > 0 && <span data-notice-without-id className="text-amber-700 dark:text-amber-300">{withoutId} row{withoutId === 1 ? "" : "s"} arrived without a dispatch id (shown, but can&apos;t be opened).</span>}
        </div>
    )
}
