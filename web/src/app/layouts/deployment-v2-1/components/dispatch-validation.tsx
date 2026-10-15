"use client"

// V2.1 (live API audit, 2026-10-11): a dispatch's own system validation — `action_required` / `err_msg`, which the API
// sends PER DISPATCH (on the list row and on the dispatch read). Shown only on the dispatch the API flags, never on a
// sibling, and never as a status (franchise_status alone is the status). Raw values stay in the Data / API Inspector.
//   ValidationMarker  beside the status (table row, card header): icon + message count; the messages as its label
//   ValidationNotice  under the card header: one line while collapsed; the messages (first 3, then "Show all") expanded
// matic-dash shows the same messages as "Why here?" on an Action Required deployment.
import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DispatchValidation } from "../data/dispatch-rows"

const NO_REASON = "No reason was sent with the flag."
const VISIBLE = 3

const summaryOf = (v: DispatchValidation) => (v.messages.length > 0 ? `Action required: ${v.messages.join("; ")}` : `Action required. ${NO_REASON}`)

/** Beside a dispatch's status: only when the API flags THIS dispatch (action_required true). */
export function ValidationMarker({ validation, className }: { validation: DispatchValidation; className?: string }) {
    if (validation.required !== true) return null
    const count = validation.messages.length
    const summary = summaryOf(validation)
    return (
        <span
            data-dispatch-validation="required"
            data-validation-count={count}
            title={summary}
            aria-label={summary}
            role="img"
            className={cn("inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300", className)}
        >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {count > 0 ? count : "!"}
        </span>
    )
}

/** Under a dispatch card's header: what the validation says, concisely (collapsed) or in full (expanded). */
export function ValidationNotice({ validation, full, className }: { validation: DispatchValidation; full: boolean; className?: string }) {
    const [showAll, setShowAll] = React.useState(false)
    if (validation.required !== true) return null
    const { messages } = validation
    if (!full) {
        const first = messages[0] ?? NO_REASON
        const more = messages.length - 1
        return (
            <p data-dispatch-validation-notice data-validation-full="false" data-validation-count={messages.length} title={summaryOf(validation)} className={cn("flex items-center gap-1.5 text-left text-[11px] leading-4 text-amber-800 dark:text-amber-300 min-w-0", className)}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="font-semibold shrink-0">Action required</span>
                <span className="truncate min-w-0">· {first}</span>
                {more > 0 && <span className="shrink-0 text-amber-700/80 dark:text-amber-300/80">+{more} more</span>}
            </p>
        )
    }
    const shown = showAll ? messages : messages.slice(0, VISIBLE)
    return (
        <div data-dispatch-validation-notice data-validation-full="true" data-validation-count={messages.length} className={cn("text-left text-[11px] leading-4 text-amber-800 dark:text-amber-300", className)}>
            <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Action required
            </p>
            {messages.length === 0 ? (
                <p className="mt-1 pl-5 text-amber-700/90 dark:text-amber-300/90">{NO_REASON}</p>
            ) : (
                <ul className="mt-1 pl-5 space-y-0.5 list-disc marker:text-amber-400">
                    {shown.map((message, i) => <li key={i} data-validation-message className="[overflow-wrap:anywhere]">{message}</li>)}
                </ul>
            )}
            {messages.length > VISIBLE && (
                <button
                    type="button"
                    data-validation-toggle
                    aria-expanded={showAll}
                    onClick={(e) => { e.stopPropagation(); setShowAll((v) => !v) }}
                    className="mt-1 ml-5 text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 hover:no-underline"
                >
                    {showAll ? "Show fewer" : `Show all ${messages.length}`}
                </button>
            )}
        </div>
    )
}
