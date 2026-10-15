"use client"

// Deployment V2.1 — the FARMER-level detail's content, in the existing Deployment pattern:
//   DetailHeading         V2's summary bar: "Dispatches", the local filter dropdown under it (over   ┐ fixed, above the
//                         every AZ), the farmer-level NOC / Pre-Sample icons, what is shown          ┘ scrolling content
//   NocReadinessStrip     under the summary bar (V2's place): the FARMER's NOC state across its documents — what it
//                         means for Approve — with the way to the farmer-level NOC view; never repeated per row / card
//   GroupHeader           one section per AZ (the sheet; the Samples pattern), collapsible
//   DispatchCards         every dispatch the row's read returned (every status), flat under its AZ: Dispatch (expands
//                         in place) → its deployment (plot) cards. As in matic-dash, the expanded dispatch is the
//                         working surface — there is no dispatch or plot page: its facts, correction, plot cards
//                         (picture, facts, comment, delete, map focus), report selection and Approve are all here;
//                         media, comments, reports and approval open dialogs over it. Report history is the card's clock.
// A card shows ONE state, the dispatch's own franchise_status relabelled (deployment-dispatch-view.ts): Verified /
// Pending / Need Correction — never derived from history, NOC, validation or the row. V2.1 (live API audit): the
// API sends `action_required` / `err_msg` PER DISPATCH; a card shows its own dispatch's (dispatch-validation.tsx:
// a marker beside the status, the messages under the header), never a sibling's. A Need Correction card shows its
// context: the verifier's report naming it (reason, who, when) when history has one. Report history is context,
// never a second state: the clock opens it; an open report on a Pending dispatch is a "Reported" note. Delete sits in
// the card's More menu (dispatch) and on the plot card (deployment), where the type allows it. A report submitted in
// this session shows as the dispatch's correction until history names it. The plot picture follows the Samples pattern
// (sample-card.tsx): a clickable header thumbnail, a "Picture" row with View / Not uploaded, "View picture" in More.
import * as React from "react"
import { format } from "date-fns"
import { flexRender, type CellContext } from "@tanstack/react-table"
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, FileSpreadsheet, ImageOff, Inbox, Info, Loader2, MessageSquareText, Microscope, Monitor, MoreHorizontal, Play, RotateCw, Trash2, User, VideoOff } from "lucide-react"
import type { SurveyItem } from "@/app/components/survey/SurveyComponents"
import { allColumns as deploymentTableColumns } from "@/app/layouts/deployment/components/columns"
import type { EngagementRecord } from "@/app/layouts/deployment/data/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { DeploymentMetadataRow, TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import type { NocReadiness } from "../data/request-builders"
import { toDeploymentV2Record } from "../data/adapter"
import type { DeploymentTypeConfig } from "./deployment-types"
import { dispatchLabel, formatDispatchDate, plotLabel, type ReportOption } from "./deployment-field-cards"
import type { ReportIndex } from "./deployment-report-index"
import {
    DETAIL_FILTERS,
    DETAIL_FILTER_LABEL,
    DISPATCH_VIEW_LABEL,
    correctionContexts,
    inDetailFilter,
    offersApprove,
    offersReport,
    validationApproveBlocker,
    primaryCorrection,
    type ClassifiedDispatch,
    type CorrectionContext,
    type CorrectionOrigin,
    type DetailFilter,
    type DispatchView,
} from "./deployment-dispatch-view"
import { ValidationMarker, ValidationNotice } from "./dispatch-validation"
import { MediaHoverPreview } from "./media-hover-preview"

export type DeploymentStatusLabel = "Verified" | "Pending" | "Need Correction"

/** Existing Deployment status-badge classes. */
export const STATUS_BADGE_CLASS: Record<DeploymentStatusLabel, string> = {
    Verified: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    Pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    "Need Correction": "bg-red-50 text-red-700 border-red-200 dark:bg-red-955/30 dark:text-red-400 dark:border-red-900/50",
}

/** A dispatch's view status in the existing badge palette. */
export const VIEW_BADGE_CLASS: Record<DispatchView, string> = {
    verified: STATUS_BADGE_CLASS.Verified,
    pending: STATUS_BADGE_CLASS.Pending,
    need_correction: STATUS_BADGE_CLASS["Need Correction"],
}

/**
 * The dispatch's own status (franchise_status), relabelled — never derived (deployment-dispatch-view.ts). The established
 * V2 badge, with no extra labels: a response that carried no status is shown as Pending; `data-status-known` and the
 * title say so without inventing a state.
 */
export function DispatchViewBadge({ view, statusKnown = true, className }: { view: DispatchView; statusKnown?: boolean; className?: string }) {
    return (
        <Badge
            variant="outline"
            data-dispatch-badge={view}
            data-status-known={statusKnown ? undefined : "false"}
            title={statusKnown ? undefined : "The API sent no franchise_status for this dispatch; shown as Pending."}
            className={cn("text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full border shadow-none", VIEW_BADGE_CLASS[view], className)}
        >
            {DISPATCH_VIEW_LABEL[view]}
        </Badge>
    )
}

/** The list row's status (the table's tab), in the same palette. */
const ROW_STATUS_LABEL: Record<DeploymentMetadataRow["status"], DeploymentStatusLabel> = { approved: "Verified", pending: "Pending", need_correction: "Need Correction" }
export function RowStatusBadge({ status }: { status: DeploymentMetadataRow["status"] }) {
    const label = ROW_STATUS_LABEL[status]
    return (
        <Badge variant="outline" data-row-badge={status} className={cn("text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full border shadow-none", STATUS_BADGE_CLASS[label])}>
            {label}
        </Badge>
    )
}

// ── Need Correction: why, then who / what said so (one state; report history is context, never a badge) ──

const ORIGIN_ICON: Record<CorrectionOrigin, typeof User> = { manual_report: User, system_validation: Monitor }

/** The existing timestamp style; null when the time is unknown (it is then left out, never a placeholder). */
const formatWhen = (ms: number | null | undefined) => (ms === null || ms === undefined ? null : format(new Date(ms), "dd MMM yyyy, hh:mm a"))

/** Left indent of the lines under a correction's reason: the "!" icon (14px) + its gap (6px), so they align with the text. */
const CORRECTION_INDENT = "pl-5"

/**
 * One correction, compact (no banner, no fixed height): a circled "!" with the reason (one line on a collapsed card, in
 * full when `full`), and directly under the reason text its origin — a verifier's report (person icon, the reporter and
 * the time when known) or the server's validation (computer icon, "System validation"), styled apart.
 */
export function CorrectionBlock({ context, full = false, className }: { context: CorrectionContext; full?: boolean; className?: string }) {
    const Icon = ORIGIN_ICON[context.origin]
    const reason = context.reason ?? "No details were provided."
    const manual = context.origin === "manual_report"
    const who = manual ? context.by ?? "Verifier" : "System validation"
    return (
        <div data-correction={context.origin} className={cn("text-left w-full min-w-0", className)}>
            <div className="flex items-start gap-1.5 min-w-0">
                <AlertCircle className="h-3.5 w-3.5 mt-px text-red-600 dark:text-red-400 shrink-0" aria-hidden />
                <p
                    data-correction-reason
                    className={cn("min-w-0 flex-1 font-medium text-red-700 dark:text-red-300", full ? "text-xs leading-snug [overflow-wrap:anywhere]" : "text-[11px] leading-4 truncate")}
                    title={full ? undefined : reason}
                >
                    {reason}
                </p>
            </div>
            <p
                data-correction-origin-line
                data-origin-kind={manual ? "report" : "validation"}
                className={cn("mt-0.5 flex items-center gap-1 min-w-0 text-[10px] leading-4", CORRECTION_INDENT, manual ? "font-semibold text-zinc-600 dark:text-zinc-300" : "font-medium text-zinc-400 dark:text-zinc-500")}
            >
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{[who, formatWhen(context.at)].filter(Boolean).join(" · ")}</span>
            </p>
        </div>
    )
}

/** Need Correction on a collapsed card: ONE correction (the verifier's report when there is one, else the validation). */
export function CorrectionSummary({ item, className }: { item: ClassifiedDispatch; className?: string }) {
    const context = primaryCorrection(item)
    if (!context) return null
    return (
        <div data-correction-summary data-correction-origin={item.origins.join(" ")} className={cn("w-full min-w-0", className)}>
            <CorrectionBlock context={context} />
        </div>
    )
}

export interface LocalReport {
    comment: string
    at: number
}

// ── More (⋯) menu on a card (MATI row-actions pattern) ───────────────────────────────────────────────

export interface CardAction {
    label: string
    onSelect: () => void
    destructive?: boolean
    /** data attribute value identifying the action (tests). */
    id: string
}

/** Renders nothing when no action is allowed. Clicks never reach the card underneath (no accidental drill-down). */
export function CardMoreMenu({ label, actions, size = "md" }: { label: string; actions: CardAction[]; size?: "md" | "sm" }) {
    if (actions.length === 0) return null
    const stop = (e: React.SyntheticEvent) => e.stopPropagation()
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    data-more-menu
                    data-more-actions={actions.map((action) => action.id).join(" ")}
                    className={cn("p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50", size === "sm" ? "h-7 w-7" : "h-8 w-8")}
                    onClick={stop}
                    onKeyDown={stop}
                >
                    <span className="sr-only">{label}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 z-[300]" onClick={stop}>
                {actions.map((action) => (
                    <DropdownMenuItem
                        key={action.id}
                        data-card-action={action.id}
                        onSelect={action.onSelect}
                        className={cn("flex items-center gap-2 text-xs font-medium cursor-pointer", action.destructive && "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30")}
                    >
                        {action.destructive && <Trash2 className="h-3.5 w-3.5" />}
                        {action.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ── Fixed Level 1 header: summary + actions, NOC, the local status filter ───────────────────────────

/** Header icon action (the sheet's ghost icon-button style) with its label as tooltip and accessible name. */
function SummaryAction({ label, onClick, children, ...rest }: { label: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string | boolean>) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={label}
                        className="relative h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={onClick}
                        {...rest}
                    >
                        {children}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="z-[400]">
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/** The farmer-level NOC action in the detail heading: what the farmer's NOC reads say, across the farmer's AZs. */
export interface HeaderNocAction {
    /** The tooltip / accessible name ("NOC — AZ1: approved, AZ2: pending" …). */
    label: string
    /** approved: every known document approved · pending: some not approved · none: no document · unavailable: a read failed. */
    state: "approved" | "pending" | "none" | "unavailable" | "loading"
    onOpen: () => void
}

/** The farmer-level Pre-Sample action in the detail heading (AZ 1–3 deployments only). */
export interface HeaderPreSampleAction {
    label: string
    /** The sample-code count when every deployment agrees; null when the deployments differ (the label says so). */
    count: number | null
    onOpen: () => void
}

/**
 * V2.1: the fixed heading of the farmer-level detail (Deployment V2's summary bar): "Dispatches", the local filter (over
 * every AZ of the farmer) under it, the farmer-level NOC and Pre-Sample actions (V2's icons, at V2's place), and — only
 * while it applies — the loading / failed read state. The counts are NOT repeated here: the details bar above states
 * them. Report history is NOT here: it is on each dispatch card (requirement 5).
 */
export function DetailHeading({ filter, dispatches, deployments, loading, failed, noc, preSample }: {
    /** The local filter dropdown, under the heading (absent while there is nothing to filter). */
    filter?: React.ReactNode
    dispatches: number
    deployments: number
    loading: boolean
    /** Deployments (rows) whose dispatch read failed. */
    failed: number
    noc?: HeaderNocAction
    preSample?: HeaderPreSampleAction
}) {
    return (
        <div data-summary-bar className="px-6 py-2 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3">
            <div className="flex flex-col items-start gap-1 min-w-0">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none truncate min-w-0">Dispatches</h2>
                {filter}
            </div>
            <div className="flex items-start gap-2 shrink-0" data-detail-scope data-detail-dispatches={dispatches} data-detail-deployments={deployments}>
                {/* The counts are in the details bar above ("n Deployments . n Dispatches"); only the transient read state is
                    said here — loading, or how many deployments' reads failed — and nothing at all otherwise. */}
                {(loading || failed > 0) && (
                    <p className="text-right text-[11px] font-medium leading-4 pt-1.5">
                        {loading && <span data-detail-loading className="block text-zinc-400">Loading…</span>}
                        {!loading && failed > 0 && <span data-detail-failed={failed} className="block text-amber-700 dark:text-amber-300">{failed} not loaded</span>}
                    </p>
                )}
                {(noc || preSample) && (
                    <div data-header-actions className="flex items-center gap-1">
                        {noc && (
                            <SummaryAction label={noc.label} onClick={noc.onOpen} data-open-noc data-noc-state={noc.state}>
                                <FileSpreadsheet className="h-4 w-4" />
                                {(noc.state === "approved" || noc.state === "pending" || noc.state === "unavailable") && (
                                    <span className={cn(
                                        "absolute top-0.5 right-0.5 h-2 w-2 rounded-full border border-white dark:border-zinc-950",
                                        noc.state === "approved" ? "bg-emerald-500" : noc.state === "pending" ? "bg-amber-500" : "bg-red-500"
                                    )} />
                                )}
                            </SummaryAction>
                        )}
                        {preSample && (
                            <SummaryAction label={preSample.label} onClick={preSample.onOpen} data-open-pre-sample data-pre-sample-count={preSample.count ?? "varies"}>
                                <Microscope className="h-4 w-4" />
                                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-1 rounded-full bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-[8px] font-bold flex items-center justify-center">
                                    {preSample.count ?? "·"}
                                </span>
                            </SummaryAction>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * The FARMER's NOC state in the fixed header (V2's NOC readiness strip, at V2's place under the summary bar): one line
 * across the farmer's NOC documents — what it means for Approve — and the way to the farmer-level NOC view. The text is
 * the sheet's (it names the documents; distinct documents are never merged); the gate itself is unchanged.
 */
export function NocReadinessStrip({ readiness, text, action }: { readiness: NocReadiness; text: string; /** The strip's one action (Review / View NOC, Retry); absent: none. */ action?: { label: string; onClick: () => void } }) {
    const ok = readiness === "approved"
    const muted = readiness === "loading"
    return (
        <div
            data-noc-readiness={readiness}
            className={cn(
                "px-6 py-2 border-b flex items-center gap-2 text-left w-full",
                ok && "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-900/20",
                muted && "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800",
                !ok && !muted && "bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20"
            )}
        >
            {muted ? <Loader2 className="h-4 w-4 text-zinc-400 animate-spin shrink-0" />
                : ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
            <span data-noc-readiness-text className={cn(
                "flex-1 min-w-0 text-[11px] font-medium [overflow-wrap:anywhere]",
                ok ? "text-emerald-700 dark:text-emerald-300" : muted ? "text-zinc-500" : "text-amber-800 dark:text-amber-300"
            )}>
                {text}
            </span>
            {action && (
                <button
                    type="button"
                    data-noc-action
                    onClick={action.onClick}
                    className={cn(
                        "shrink-0 text-[10px] font-bold uppercase tracking-wider hover:underline underline-offset-2",
                        ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"
                    )}
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
/**
 * The detail's local dispatch filter: a small dropdown in the sheet's dropdown pattern (the language menu: bold uppercase
 * items, a check on the selected one). It filters the loaded dispatches of this farmer + deployment + AZ only (never
 * the table). A count is left out where it can't be known (deployment-dispatch-view.ts).
 */
export function DetailStatusFilter({ value, counts, onChange, noun = "dispatches" }: { value: DetailFilter; counts: Record<DetailFilter, number | null>; onChange: (filter: DetailFilter) => void; /** What the list holds, for the accessible name. */ noun?: string }) {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    data-detail-filter={value}
                    data-filter-count={counts[value] ?? ""}
                    aria-label={`Show ${DETAIL_FILTER_LABEL[value]} ${noun}`}
                    className="inline-flex items-center gap-1 h-6 -ml-1.5 px-1.5 rounded-md text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300"
                >
                    {DETAIL_FILTER_LABEL[value]}
                    {counts[value] !== null && <span className="font-normal opacity-60 tabular-nums">{counts[value]}</span>}
                    <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 z-[300]">
                {DETAIL_FILTERS.map((filter) => (
                    <DropdownMenuItem
                        key={filter}
                        data-filter-option={filter}
                        data-filter-count={counts[filter] ?? ""}
                        data-selected={filter === value ? "" : undefined}
                        onSelect={() => onChange(filter)}
                        className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                        <span>{DETAIL_FILTER_LABEL[filter]}</span>
                        <span className="flex items-center gap-2">
                            {counts[filter] !== null && <span className="font-normal text-zinc-400 tabular-nums">{counts[filter]}</span>}
                            {filter === value ? <Check className="h-3 w-3" /> : <span className="w-3" aria-hidden />}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ── Scrolling Level 1 content: the dispatch cards ───────────────────────────────────────────────────

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}${word.endsWith("ch") ? "es" : "s"}`}`

/**
 * What a row's dispatch list can show, in priority order (V2.1: ONE read per row, every status):
 *   loading      the read is in flight and nothing has been returned yet;
 *   error        the read failed (never shown as empty);
 *   list         dispatches were returned;
 *   unavailable  the list has dispatch rows for the group (the group row's trailers_deployed / franchise_statuses —
 *                data/dispatch-rows.ts groupDispatchRows counts them), but the read returned none;
 *   unconfirmed  the read returned none and the group's dispatch count isn't known yet (only the seed row is known) —
 *                "none" is not claimed;
 *   none         the row states 0 dispatches and the read returned none.
 */
export type DispatchListState = "loading" | "error" | "list" | "unavailable" | "unconfirmed" | "none"

export function resolveDispatchListState(row: DeploymentMetadataRow, dispatchCount: number, error: string | null | undefined, loading: boolean): DispatchListState {
    if (error) return "error"
    if (dispatchCount > 0) return "list"
    if (loading) return "loading"
    const stated = row.trailers_deployed
    if ((row.franchise_statuses ?? []).length > 0 || (stated !== null && stated > 0)) return "unavailable"
    return stated === null ? "unconfirmed" : "none"
}

/** The existing Deployment empty state (dashed box), for every non-list state. */
function EmptyDispatches({ state, error, onRetry }: { state: Exclude<DispatchListState, "list">; error?: string | null; onRetry: () => void }) {
    if (state === "loading") {
        return (
            <div data-dispatch-empty="loading" className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/20">
                <Loader2 className="h-5 w-5 text-zinc-300 animate-spin" aria-hidden />
                <span className="mt-2 text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">Loading dispatches…</span>
            </div>
        )
    }
    const content: Record<Exclude<typeof state, "loading">, { title: string; detail: string; retry: boolean }> = {
        error: { title: "Couldn't load dispatches", detail: error ?? "", retry: true },
        unavailable: { title: "Dispatch details are unavailable", detail: "The deployment lists dispatches, but the read returned none.", retry: true },
        unconfirmed: { title: "No dispatches returned", detail: "The server returned no dispatch for this deployment and didn't state how many it has.", retry: true },
        none: { title: "No dispatches recorded", detail: "There are no deployment dispatches to display for this deployment.", retry: false },
    }
    const { title, detail, retry } = content[state]
    return (
        <EmptyBox data-dispatch-empty={state} title={title} detail={detail} icon={retry ? "alert" : "inbox"}>
            {retry && (
                <Button variant="outline" size="sm" data-dispatch-retry className="mt-4 h-8 px-3 text-xs font-bold" onClick={onRetry}>
                    <RotateCw className="mr-2 h-3.5 w-3.5" />
                    Retry
                </Button>
            )}
        </EmptyBox>
    )
}

export function EmptyBox({ title, detail, icon, children, ...rest }: { title: string; detail: string; icon: "alert" | "inbox"; children?: React.ReactNode } & Record<`data-${string}`, string>) {
    return (
        <div {...rest} className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/5 select-none animate-in fade-in duration-300">
            <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
                {icon === "alert" ? <AlertCircle className="h-5 w-5 text-zinc-400 dark:text-zinc-500" /> : <Inbox className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />}
            </div>
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase block mb-1">{title}</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[280px] break-words">{detail}</p>
            {children}
        </div>
    )
}

/**
 * Report-history entries this view can't place on a dispatch: they name no dispatch, one no longer there, or one that
 * couldn't be loaded. Said once, subtly, instead of being hidden or guessed.
 */
function ReportsNotShown({ count, onOpenHistory }: { count: number; onOpenHistory: () => void }) {
    return (
        <div data-reports-not-shown={count} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left select-none">
            <AlertCircle className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" aria-hidden />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                {count} reported {count === 1 ? "item is" : "items are"} not on the dispatches shown here.
            </span>
            <button
                type="button"
                onClick={onOpenHistory}
                className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:underline underline-offset-2"
            >
                View report history
            </button>
        </div>
    )
}

/** The row's report-history read as the dispatch card shows it (V2.1: history sits on the card, scoped to the dispatch). */
export type HistoryReadState = "loading" | "ready" | "failed"

/**
 * The dispatch card's report-history action (the clock): opens the history of THIS dispatch. Always present, so the
 * three states are distinct — loading (the row's history read is in flight), ready (a dot when entries name the
 * dispatch; none otherwise — the dialog then says so), failed (amber; the click re-reads the row's history).
 */
export function HistoryIndicator({ state, hasEntries, onOpen, onRetry }: { state: HistoryReadState; hasEntries: boolean; onOpen: () => void; onRetry?: () => void }) {
    const label = state === "loading" ? "Report history (loading…)" : state === "failed" ? "Report history couldn't be loaded — retry" : hasEntries ? "Report history" : "Report history (none)"
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        data-history-indicator={state}
                        data-history-entries={hasEntries ? "" : undefined}
                        aria-label={label}
                        disabled={state === "loading"}
                        className={cn("relative h-8 w-8 p-0", state === "failed" ? "text-amber-600 hover:text-amber-800 dark:text-amber-400" : hasEntries ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50")}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (state === "failed") onRetry?.()
                            else onOpen()
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                        {state === "ready" && hasEntries && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-zinc-200" aria-hidden />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="z-[400]">
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/**
 * The collapsible group header the detail lists use ("<label> · N <noun>s" over a separator). `prefix` names its
 * data attributes (data-<prefix>-toggle / -name / -count / -total) so each list keeps its own hooks.
 */
export function GroupHeader({ prefix, label, shown, total, noun, filtered, collapsed, onToggle }: {
    prefix: string
    label: string
    shown: number
    total: number
    noun: string
    filtered: boolean
    collapsed: boolean
    onToggle: () => void
}) {
    const Chevron = collapsed ? ChevronRight : ChevronDown
    return (
        <button
            type="button"
            {...{ [`data-${prefix}-toggle`]: "" }}
            aria-expanded={!collapsed}
            onClick={onToggle}
            className="w-full flex items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 text-left select-none text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 rounded-sm"
        >
            <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold">
                <span {...{ [`data-${prefix}-name`]: "" }} className="truncate min-w-0" title={label}>{label}</span>
                <span aria-hidden className="shrink-0 text-zinc-300 dark:text-zinc-600">·</span>
                <span {...{ [`data-${prefix}-count`]: shown, [`data-${prefix}-total`]: total }} className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {filtered && shown !== total ? `${shown} of ${plural(total, noun)}` : plural(shown, noun)}
                </span>
            </span>
            <Chevron className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        </button>
    )
}

/** A field item's value as one line of text (a location shows its coordinates). */
export const fieldValue = (item: SurveyItem): string =>
    item.type === "map" ? item.meta ?? ""
        : Array.isArray(item.answer) ? item.answer.map(String).join(", ")
        : typeof item.answer === "string" || typeof item.answer === "number" ? String(item.answer)
        : ""

/** The media URL of a field item, or null when the field has none. */
const mediaUrl = (item: SurveyItem | undefined): string | null => (item && typeof item.answer === "string" && item.answer.trim() ? item.answer : null)

/**
 * A reportable value in report mode: select it to include it in the report. The options are the type's
 * (deployment-types.ts actions: AZ 1–3 field rows, AWD / Mati Boost's ten plot fields); a missing value is said so.
 */
export function ReportFieldOption({ option, selected, onToggle }: { option: ReportOption; selected: boolean; onToggle: () => void }) {
    const missing = option.value.trim() === ""
    return (
        <label
            data-report-field={option.id}
            data-selected={selected ? "" : undefined}
            data-report-value={missing ? "missing" : "present"}
            className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] cursor-pointer select-none min-w-0 transition-colors",
                selected ? "border-red-300 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20" : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            )}
        >
            <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Report ${option.label}`} className="shrink-0" />
            <span className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-300">{option.label}</span>
            <span className={cn("truncate min-w-0 ml-auto text-right", missing ? "italic text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400")} title={missing ? "No value recorded" : option.value}>
                {missing ? "Not recorded" : option.value}
            </span>
        </label>
    )
}

/** The plot-field labels of the field cards (deployment-field-cards.ts), for a reported field whose plot is unknown. */
const UNPLACED_FIELD_LABEL: Record<"mati_deployed" | "location", string> = { mati_deployed: "Amount Deployed", location: "GPS Coordinates" }

/**
 * A plot field an open report names on this dispatch without naming its plot (no entry_no, or none matching): shown
 * on the dispatch as reported, with the plot left open — never guessed onto a plot card.
 */
function UnplacedCorrectionField({ kind }: { kind: "mati_deployed" | "location" }) {
    return (
        <div
            data-correction-field-unplaced={kind}
            title="The report names this field but not its plot (no entry number), so no plot is marked."
            className="flex items-baseline justify-between gap-3 rounded-sm bg-red-50/60 dark:bg-red-950/20 border-l-2 border-l-red-500 pl-2 pr-1 py-1 text-[11px] min-w-0"
        >
            <span className="shrink-0 font-semibold text-red-800 dark:text-red-300">{UNPLACED_FIELD_LABEL[kind]}</span>
            <span className="truncate min-w-0 text-right italic text-red-700/80 dark:text-red-300/80">Plot not identified</span>
        </div>
    )
}

/**
 * A plot's comment, readable in place: it wraps (no horizontal overflow); past four lines it is clamped with an explicit
 * Show more / Show less. The comment icon stays for adding / editing.
 */
export function CommentPreview({ text }: { text: string }) {
    const ref = React.useRef<HTMLParagraphElement>(null)
    const [expanded, setExpanded] = React.useState(false)
    const [clamped, setClamped] = React.useState(false)
    React.useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const measure = () => { if (!expanded) setClamped(el.scrollHeight > el.clientHeight + 1) }
        measure()
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
        observer?.observe(el)
        return () => observer?.disconnect()
    }, [text, expanded])
    return (
        <div data-comment-box className="min-w-0">
            <p
                ref={ref}
                data-comment-preview
                data-comment-expanded={expanded ? "" : undefined}
                className={cn("text-[11px] leading-4 italic text-zinc-600 dark:text-zinc-400 whitespace-pre-line [overflow-wrap:anywhere]", !expanded && "line-clamp-4")}
            >
                &ldquo;{text}&rdquo;
            </p>
            {(clamped || expanded) && (
                <button
                    type="button"
                    data-comment-toggle
                    aria-expanded={expanded}
                    onClick={(e) => {
                        e.stopPropagation()
                        setExpanded((v) => !v)
                    }}
                    className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline underline-offset-2"
                >
                    {expanded ? "Show less" : "Show more"}
                </button>
            )}
        </div>
    )
}

/**
 * Expanded details (dispatch or deployment): a heading over label + value rows. Values wrap (nothing is clipped); a value
 * an open report names is a red row (`data-correction-field`), in place — the same field, not a second copy.
 */
export function DetailList({ title, children, ...rest }: { title: string; children: React.ReactNode } & Record<`data-${string}`, string | boolean>) {
    return (
        <section {...rest} className="text-left min-w-0">
            <p className="mb-1.5 text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none">{title}</p>
            <dl className="space-y-0.5 min-w-0">{children}</dl>
        </section>
    )
}

/** One label + value row of an expanded details list (also the map's plot card rows). */
export function DetailRow({ id, label, correctionId, className, children }: { id: string; label: string; correctionId?: string; className?: string; children: React.ReactNode }) {
    const red = !!correctionId
    return (
        <div
            data-detail-row={id}
            data-correction-field={correctionId}
            // V2.1: one step larger (text-xs, the dispatch summary's / Samples' card text size) with the hierarchy carried by
            // weight and tone — the label regular and muted, the value medium and dark — so a value reads first
            className={cn(
                "grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-3 rounded-sm px-2 py-1 text-xs leading-5 min-w-0",
                red ? "bg-red-50/60 dark:bg-red-950/20 border-l-2 border-l-red-500" : "odd:bg-zinc-50/70 dark:odd:bg-zinc-900/30",
                className
            )}
        >
            <dt data-detail-label className={cn("font-normal [overflow-wrap:anywhere]", red ? "text-red-800 dark:text-red-300" : "text-zinc-500 dark:text-zinc-400")}>{label}</dt>
            <dd data-detail-value className={cn("min-w-0 font-medium [overflow-wrap:anywhere]", red ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-100")}>{children}</dd>
        </div>
    )
}

/** The Deployment table's surveyor column (deployment/components/columns.tsx): its cell is the surveyor hover card. */
const TABLE_SURVEYOR_COLUMN = deploymentTableColumns.find((column) => column.id === "surveyor")
export type TableSurveyor = EngagementRecord["surveyor"]

/**
 * The dispatch's surveyor in the table's record shape (adapter.ts toDeploymentV2Record): the row's own surveyor — the
 * table's mapping, phone included — when it is the same surveyor (registration number, else name); otherwise the
 * dispatch's name and registration number (no phone is sent with a dispatch). Null when the dispatch names none.
 */
export function dispatchSurveyor(dispatch: TrailerDispatchItem, row: DeploymentMetadataRow): TableSurveyor | null {
    const name = (dispatch.surveyor_name || "").trim()
    if (!name) return null
    const rowSurveyor = toDeploymentV2Record(row, 0).surveyor
    const reg = (dispatch.surveyor_registred_no || "").trim()
    const same = reg && rowSurveyor.id.trim() ? reg === rowSurveyor.id.trim() : name.toLowerCase() === rowSurveyor.name.trim().toLowerCase()
    return same ? { ...rowSurveyor, name } : { name, id: reg, phoneNumber: undefined }
}

/**
 * The surveyor with the table's own hover card (the same component, rendered through the table's column), its trigger
 * set in the card's text size. Falls back to the plain name if the table column is ever missing.
 */
export function SurveyorCell({ surveyor }: { surveyor: TableSurveyor }) {
    const cell = TABLE_SURVEYOR_COLUMN?.cell
    if (!cell || typeof cell === "string") return <span>{surveyor.name}</span>
    const context = { row: { original: { surveyor } } } as unknown as CellContext<EngagementRecord, unknown>
    // Clicks in the hover card (portalled, but React events still bubble to the card) must not toggle the dispatch.
    return (
        <span data-surveyor-hover onClick={(e) => e.stopPropagation()} className="block min-w-0 [&_.text-sm]:text-xs [&_.text-sm]:leading-5 [&_.text-sm]:font-medium [&_.text-sm]:truncate [&_.text-sm]:block">
            {flexRender(cell, context)}
        </span>
    )
}

export type ThumbnailState = "loading" | "image" | "failed" | "none"

/**
 * The plot's picture as a small thumbnail, part of the card header (the Samples pattern: the caller wraps it in a
 * button that opens the preview); a muted placeholder when there is none or it can't be loaded, a pulse while it loads.
 * `onStateChange` tells the caller what the thumbnail knows (the "Picture" row says "couldn't be loaded" from it).
 */
export function PlotThumbnail({ item, noun = "deployment picture", onStateChange }: { item: SurveyItem | undefined; noun?: string; onStateChange?: (state: ThumbnailState) => void }) {
    const url = mediaUrl(item)
    const [state, setState] = React.useState<Exclude<ThumbnailState, "none">>("loading")
    const report = React.useRef(onStateChange)
    React.useEffect(() => { report.current = onStateChange })
    React.useEffect(() => { report.current?.(url ? state : "none") }, [url, state])
    if (!item) return null
    if (!url || state === "failed") {
        return (
            <div
                data-plot-thumb={url ? "failed" : "none"}
                title={url ? "The picture couldn't be loaded" : `No ${noun}`}
                className="h-8 w-8 shrink-0 rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center"
            >
                <ImageOff className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" aria-hidden />
            </div>
        )
    }
    return (
        <span data-plot-thumb={state} className={cn("h-8 w-8 shrink-0 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800", state === "loading" && "animate-pulse bg-zinc-100 dark:bg-zinc-800")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className={cn("h-full w-full object-cover", state === "loading" && "opacity-0")} onLoad={() => setState("image")} onError={() => setState("failed")} />
        </span>
    )
}

/** Icon button in a card (ghost icon-button style); clicks never reach the card underneath. */
export function CardIconAction({ label, onClick, children, disabled, pressed, ...rest }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; pressed?: boolean } & Record<`data-${string}`, string | boolean | undefined>) {
    return (
        <Button
            variant="ghost"
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            disabled={disabled}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            onClick={(e) => {
                e.stopPropagation()
                onClick()
            }}
            onKeyDown={(e) => e.stopPropagation()}
            {...rest}
        >
            {children}
        </Button>
    )
}

interface PlotCardProps {
    plot: TrailerDeploymentPlot
    deploymentType: DeploymentTypeConfig
    villageName: string
    /** The dispatch's open report names this plot (red edge). */
    correction: boolean
    /** Field ids an open report names (red values). */
    correctionFields: Set<string>
    located: boolean
    /** Just picked on the map: a brief, soft emphasis (with its dispatch's). */
    focused: boolean
    /** Expanded: the labelled deployment details (collapsed: the compact summary). */
    expanded: boolean
    /** Expands / collapses the card; expanding also focuses the plot on the map (collapsing never moves the map). */
    onToggle: () => void
    /** Report mode on this plot's dispatch: the type's report options for this plot become selectable. */
    reporting: boolean
    /** The type's report options for this plot (deployment-types.ts actions.plotReportOptions). */
    reportOptions: ReportOption[]
    reportedIds: string[]
    onToggleReportField: (id: string) => void
    onPreview: (item: SurveyItem) => void
    /** Set when the plot's Location value can show it on the map (it has a location and the map can focus it). */
    onLocate?: () => void
    /** Set when the plot's comment can be viewed or edited here. */
    onComment?: () => void
    /** Set when the plot deployment may be deleted here (the existing permission / scope gates decide). */
    onDelete?: () => void
}

/**
 * A deployment (plot) of an expanded dispatch: a compact accordion. The header is the one control — it expands /
 * collapses the card, and expanding focuses the plot on the map (there is no separate map button).
 *   Collapsed: thumbnail (the Samples pattern: a button opening the preview when there is a picture), DEPL id, the type's
 *              compact plot facts (deployment-types.ts), the fields an open report names (one red line); comment, More
 *              (View picture · Comment · Delete deployment, as allowed), chevron.
 *   Expanded:  "Deployment details" — label + value rows from the type's plot field builders (only what the data has;
 *              values wrap; a value an open report names is red in place), a "Picture" row (View / Not uploaded, with
 *              the thumbnail's loading / failed state), then the comment, readable in full.
 * In report mode the type's report options for this plot are selectable in either state.
 */
function PlotCard({ plot, deploymentType, villageName, correction, correctionFields, located, focused, expanded, onToggle, reporting, reportOptions, reportedIds, onToggleReportField, onPreview, onLocate, onComment, onDelete }: PlotCardProps) {
    const label = plotLabel(plot)
    const fields = deploymentType.plotFieldItems(plot, villageName)
    const facts = deploymentType.plotCardFacts(plot)
    const flagged = fields.items.filter((item) => correctionFields.has(item.id))
    // The picture: the plot's picture_deployment (the type's own image item when it builds one — its id carries the
    // report marker — else a plain item for the preview). `pictureState` is what the thumbnail knows.
    const pictureUrl = plot.picture_deployment
    const picture: SurveyItem = fields.items.find((item) => item.type === "image")
        ?? { id: `picture:${plot.deployment_id}`, question: `Picture of ${label}`, type: "image", answer: pictureUrl ?? "", label: "Deployment Picture" }
    const [pictureState, setPictureState] = React.useState<ThumbnailState>(pictureUrl ? "loading" : "none")
    const openPicture = (e: React.SyntheticEvent) => {
        e.stopPropagation()
        onPreview(picture)
    }
    // Details: every field the type builds for this plot except the picture (its own row below), present-only.
    const details = fields.items.filter((item) => item.type !== "image" && fieldValue(item).trim() !== "")
    const bodyId = `plot-details-${plot.deployment_id}`
    const Chevron = expanded ? ChevronUp : ChevronDown
    // The card's actions, the dispatch card's More-menu pattern; Delete keeps its existing gates (onDelete set or not).
    const moreActions: CardAction[] = [
        ...(pictureUrl ? [{ id: "view-picture", label: "View picture", onSelect: () => onPreview(picture) }] : []),
        ...(onComment ? [{ id: "comment", label: plot.comment ? "Comment" : "Add comment", onSelect: onComment }] : []),
        ...(onDelete ? [{ id: "delete-deployment", label: "Delete deployment", destructive: true, onSelect: onDelete }] : []),
    ]
    return (
        <div
            data-plot-card={plot.deployment_id}
            data-plot-index={plot.repeater_form_index}
            data-plot-location={plot.location ? "valid" : "none"}
            data-located={located ? "" : undefined}
            data-correction-plot={correction ? "" : undefined}
            data-plot-expanded={expanded ? "" : undefined}
            data-plot-focus={focused ? "" : undefined}
            // V2.1: an accordion row (the AZ section headers' pattern, Shadcn's accordion item): full width, a bottom divider
            // instead of a box, the same header / body / states inside
            className={cn(
                "border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 overflow-hidden transition-[background-color,box-shadow] duration-500 ease-out motion-reduce:transition-none",
                located && "bg-emerald-50/40 dark:bg-emerald-950/20",
                focused && "ring-2 ring-inset ring-emerald-300/70 dark:ring-emerald-600/50 bg-emerald-50/80 dark:bg-emerald-950/30",
                correction && "border-l-2 border-l-red-500 dark:border-l-red-500"
            )}
        >
            <div
                role="button"
                tabIndex={0}
                data-plot-toggle
                aria-expanded={expanded}
                aria-controls={expanded ? bodyId : undefined}
                title={expanded ? `Hide the details of ${label}` : `Show the details of ${label}`}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        onToggle()
                    }
                }}
                className="flex items-center gap-2 px-1 py-1.5 cursor-pointer select-none hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700"
            >
                {pictureUrl ? (
                    <MediaHoverPreview preview={{ kind: "image", url: pictureUrl, title: label, caption: "Deployment picture · click to open" }}>
                    <button
                        type="button"
                        data-plot-thumb-open
                        aria-label={`View the picture of ${label}`}
                        title="View picture"
                        className="flex shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 hover:opacity-90"
                        onClick={openPicture}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        <PlotThumbnail key={pictureUrl} item={picture} onStateChange={setPictureState} />
                    </button>
                    </MediaHoverPreview>
                ) : (
                    <PlotThumbnail key="none" item={picture} onStateChange={setPictureState} />
                )}
                <div className="flex-1 min-w-0 text-left">
                    <span data-plot-label className="block font-bold text-xs leading-4 text-zinc-900 dark:text-zinc-50 font-mono truncate">{label}</span>
                    {facts.length > 0 && <span data-plot-facts className="block text-[11px] leading-4 text-zinc-500 font-mono truncate" title={facts.join(" · ")}>{facts.join(" · ")}</span>}
                    {/* Collapsed: what an open report names on this plot, in one line (the full rows are in the details). */}
                    {!expanded && flagged.length > 0 && (
                        <span data-plot-correction-summary={flagged.map((item) => item.id).join(" ")} className="mt-0.5 flex items-center gap-1 min-w-0 text-[11px] leading-4 font-medium text-red-700 dark:text-red-300">
                            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{flagged.map((item) => item.label).join(" · ")}</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center shrink-0 -mr-1 -my-0.5">
                    {onComment && (
                        <CardIconAction label={plot.comment ? `Comment on ${label}` : `Add a comment to ${label}`} onClick={onComment} data-plot-comment={plot.comment ? "has" : "none"}>
                            <MessageSquareText className={cn("h-3.5 w-3.5", plot.comment && "text-zinc-700 dark:text-zinc-300")} />
                        </CardIconAction>
                    )}
                    <CardMoreMenu label={`More actions for ${label}`} actions={moreActions} size="sm" />
                    <Chevron data-plot-chevron className="h-4 w-4 ml-0.5 text-zinc-400 shrink-0" aria-hidden />
                </div>
            </div>
            {expanded && (
                <div id={bodyId} data-plot-details className="px-1 pb-2.5 pt-0.5 space-y-2 min-w-0">
                    <DetailList title="Deployment details">
                        {details.map((item) => (
                            <DetailRow key={item.id} id={item.id.split(":")[0]} label={item.label} correctionId={correctionFields.has(item.id) ? item.id : undefined}>
                                {item.type === "map" && plot.location ? (
                                    // V2.1: the plot's own coordinates on hover / focus (no map image fetched); a click shows the plot
                                    // on the map — the camera flies there, as when the plot is picked
                                    <MediaHoverPreview preview={{ kind: "location", lat: plot.location.lat, lng: plot.location.lng, title: label, caption: onLocate ? "Click to show it on the map" : villageName || undefined }}>
                                        {onLocate ? (
                                            <button type="button" data-location-preview data-plot-locate={plot.deployment_id} aria-label={`Show ${label} on the map (${fieldValue(item)})`} onClick={(e) => { e.stopPropagation(); onLocate() }} className="text-left underline decoration-dotted decoration-zinc-300 underline-offset-2 rounded-sm hover:decoration-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400">{fieldValue(item)}</button>
                                        ) : (
                                            <span tabIndex={0} data-location-preview className="underline decoration-dotted decoration-zinc-300 underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400">{fieldValue(item)}</span>
                                        )}
                                    </MediaHoverPreview>
                                ) : fieldValue(item)}
                            </DetailRow>
                        ))}
                        {/* The picture row (Samples pattern): View opens the existing preview; "Not uploaded" when none. */}
                        <DetailRow id="picture" label="Picture" correctionId={correctionFields.has(picture.id) ? picture.id : undefined}>
                            {pictureUrl ? (
                                <span className="inline-flex flex-wrap items-center gap-x-1.5 min-w-0">
                                    <button
                                        type="button"
                                        data-picture-view
                                        onClick={openPicture}
                                        className="font-semibold underline underline-offset-2 decoration-zinc-300 hover:decoration-current focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-sm"
                                    >
                                        View
                                    </button>
                                    {pictureState === "loading" && <span data-picture-state="loading" className="text-zinc-400">Loading…</span>}
                                    {pictureState === "failed" && <span data-picture-state="failed" className="italic text-zinc-500 dark:text-zinc-400">Couldn&apos;t be loaded</span>}
                                </span>
                            ) : (
                                <span data-picture-missing>Not uploaded</span>
                            )}
                        </DetailRow>
                    </DetailList>
                    {plot.comment && (
                        <section data-plot-comment-section className="text-left min-w-0">
                            <p className="mb-1 text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none">Comment</p>
                            <CommentPreview text={plot.comment} />
                        </section>
                    )}
                </div>
            )}
            {reporting && reportOptions.length > 0 && (
                <div data-plot-report-fields className="px-2 pb-2 space-y-1.5 min-w-0">
                    {reportOptions.map((option) => (
                        <ReportFieldOption key={option.id} option={option} selected={reportedIds.includes(option.id)} onToggle={() => onToggleReportField(option.id)} />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * One reason Approve is unavailable. Independent gates are listed together (a missing NOC never hides missing plot
 * boundaries); a permission blocker is listed alone (the other gates don't matter then).
 */
export interface ApproveBlocker {
    kind: "permission" | "noc" | "boundary"
    /** A short heading for the line ("Boundaries required."); null when the text says it all. */
    title: string | null
    text: string
}

/** Everything the expanded dispatch needs to act: the established gates and the existing handlers (deployment-detail-sheet). */
export interface DispatchWork {
    /** The signed-in verifier may change data on this row's type (session ready + the type's edit permission). */
    canMutate: boolean
    /**
     * Every reason Approve is unavailable for THIS dispatch — permission, NOC, and the boundary gate (requirement 5:
     * every plot of the dispatch needs a valid SAVED boundary; while the dispatch is being re-read the boundaries count
     * as unverified) — each shown on its own line above Approve; [] when it may be approved.
     */
    approveBlockersFor: (dispatch: TrailerDispatchItem) => ApproveBlocker[]
    /**
     * The boundary editor's opener for this dispatch (its first plot without a valid saved boundary that is on the map);
     * undefined when none of its plots is on the map or editing isn't allowed — no link is shown then.
     */
    editBoundariesFor?: (dispatch: TrailerDispatchItem) => (() => void) | undefined
    /** Opens the NOC review (from the approve blocker). */
    onReviewNoc?: () => void
    /** The dispatch in report mode (one at a time) and the values selected for the report (report-mode ids). */
    reportDispatchId: string | null
    reportedIds: string[]
    onStartReport: (dispatch: TrailerDispatchItem) => void
    onCancelReport: () => void
    onToggleReportField: (id: string) => void
    /** "Report Selected (n)": the existing Finalize Report dialog. */
    onFinalizeReport: () => void
    /** Approve this one dispatch (the existing NOC gates, then the confirmation dialog). */
    onApprove: (dispatch: TrailerDispatchItem) => void
    /** The comment dialog of a plot. */
    onComment: (dispatch: TrailerDispatchItem, plot: TrailerDeploymentPlot) => void
    /** Set when plot deployments may be deleted here (offered on the row's own verification read). */
    onDeletePlot?: (dispatch: TrailerDispatchItem, plot: TrailerDeploymentPlot) => void
    /** The existing media preview (video, picture). */
    onPreview: (item: SurveyItem) => void
    /** Shows a plot on the map: selected, its dispatch highlighted, the camera flies to it (the plot's Location value). */
    onLocatePlot?: (plot: TrailerDeploymentPlot) => void
}

/** The full correction of an expanded dispatch: every origin once, in full, then the report-history link. */
function CorrectionDetails({ item, onOpenHistory }: { item: ClassifiedDispatch; onOpenHistory: () => void }) {
    const contexts = correctionContexts(item)
    if (contexts.length === 0) return null
    return (
        <div data-correction-detail data-correction-origin={item.origins.join(" ")} className="space-y-2 text-left w-full min-w-0">
            {contexts.map((context) => <CorrectionBlock key={context.origin} context={context} full />)}
            {contexts.some((c) => c.origin === "manual_report") && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onOpenHistory()
                    }}
                    className="ml-5 w-fit text-left text-[10px] text-red-700/80 dark:text-red-300/80 font-semibold uppercase tracking-wider hover:underline underline-offset-2"
                >
                    View report history
                </button>
            )}
        </div>
    )
}

interface DispatchCardProps {
    item: ClassifiedDispatch
    row: DeploymentMetadataRow
    deploymentType: DeploymentTypeConfig
    localReport: LocalReport | undefined
    reporterName: string
    reportIndex: ReportIndex
    /** The row's report-history read (the card's clock shows loading / failed / ready). */
    historyState: HistoryReadState
    onRetryHistory?: () => void
    /** Expanded in place: the dispatch's working surface (its plots and actions). */
    expanded: boolean
    onToggle: () => void
    /** The plot located on the map (its deployment_id), if it is one of this dispatch's. */
    locatedPlotId: number | null
    onDelete?: () => void
    /** This dispatch's report history (scoped to it). */
    onOpenHistory: () => void
    work: DispatchWork
    /** Just picked on the map: briefly ringed so the map ↔ list relationship is visible. */
    mapFocused: boolean
    /** The plot picked on the map (its deployment_id), briefly emphasised with its dispatch. */
    focusedPlotId: number | null
    /** Expanded plot cards (by deployment_id) and their toggle. */
    expandedPlots: Set<number>
    onTogglePlot: (plot: TrailerDeploymentPlot) => void
}

/**
 * The existing Deployment dispatch card, expanding in place (several may be open; all start closed).
 *   Collapsed: compact and scannable — DISP id, date, ONE state, its actions, and one summary line (AZ · plots · the
 *              type's row facts · surveyor; truncated, the full text as tooltip); for Need Correction, its one correction.
 *   Expanded:  the working surface — the full correction; "Dispatch details" (label + value rows from the type's dispatch
 *              field builders, present-only; a value an open report names is red in place); every deployment (plot)
 *              card (the same collapse / expand language); the dispatch's Report / Approve.
 * Report history is the clock (scoped to this dispatch), never a second state.
 */
function DispatchCard({ item, row, deploymentType, localReport, reporterName, reportIndex, historyState, onRetryHistory, expanded, onToggle, locatedPlotId, onDelete, onOpenHistory, work, mapFocused, focusedPlotId, expandedPlots, onTogglePlot }: DispatchCardProps) {
    const { dispatch, view, origins } = item
    const manual = origins.includes("manual_report")
    const hasHistory = reportIndex.dispatches.has(dispatch.deployment_detail_id)
    const trailer = dispatch.trailer_no.trim()
    const facts = deploymentType.dispatchCardFacts(dispatch)
    const fields = deploymentType.dispatchFieldItems(dispatch)
    const video = fields.items.find((field) => field.type === "video")
    const videoUrl = mediaUrl(video)
    const surveyor = dispatchSurveyor(dispatch, row)
    const az = dispatch.az_code || row.az_code
    // V2.1 (live API audit): the dispatch's OWN verifier and decision time (getTrailerDetails verified_by / verified_at).
    const verifier = dispatch.deployment_verifier_name ?? dispatch.verified_by
    const verifiedAtMs = view === "verified" ? dispatch.verified_at : null
    const footer = "mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60"
    const label = dispatchLabel(dispatch)
    const plots = dispatch.deployment_plots_data
    const bodyId = `dispatch-body-${dispatch.deployment_detail_id}`
    const Chevron = expanded ? ChevronDown : ChevronRight
    const reporting = work.reportDispatchId === dispatch.deployment_detail_id
    const canReport = offersReport(item, deploymentType)
    const canApprove = offersApprove(item, deploymentType)
    /** V2.1: a pending dispatch the API flags offers Report, not Approve — said beside the actions. */
    const validationBlocker = validationApproveBlocker(item)
    const approveBlockers = canApprove ? work.approveBlockersFor(dispatch) : []
    const approveBlocked = approveBlockers.length > 0
    // Report options are the type's (deployment-types.ts actions): none for types without a workflow.
    const dispatchReportOptions = deploymentType.actions?.dispatchReportOptions(dispatch) ?? []
    const plotReportOptions = (plot: TrailerDeploymentPlot) => deploymentType.actions?.plotReportOptions(plot, dispatch, dispatch.village_name) ?? []
    const plotCount = plots.length === 0 ? "No plots" : plural(plots.length, "Plot")
    // Collapsed: one line — AZ · plots · trailer · the type's row facts (deployment-types.ts) · surveyor; present-only, truncated.
    const summary = [`${az} · ${plotCount}`, trailer ? `Trailer ${trailer}` : null, ...facts, surveyor?.name].filter((part): part is string => !!part && part.trim() !== "")
    // Expanded: the type's dispatch fields (deployment-field-cards.ts), present-only. The video has its own icon; the
    // derived plot count is the AZ row.
    const details = fields.items.filter((field) => field.type !== "video" && !field.id.startsWith("num_plots:") && fieldValue(field).trim() !== "")
    // A value an open report names on the dispatch (Source Name) — red in place, in the details.
    const correctionIds = view === "need_correction" ? item.correctionFields : EMPTY_IDS
    // Plot fields an open report names without identifying the plot (no entry_no): shown under Deployments, never on a plot.
    const unplaced = view === "need_correction" ? (["mati_deployed", "location"] as const).filter((kind) => item.correctionUnplacedFields.has(kind)) : []
    const selectedCount = work.reportedIds.length
    return (
        <Card
            data-dispatch-row={dispatch.deployment_detail_id}
            data-dispatch-id={dispatch.dispatch_id}
            data-dispatch-status={item.backendStatus}
            data-dispatch-view={view}
            data-expanded={expanded ? "" : undefined}
            data-reporting={reporting ? "" : undefined}
            data-map-focus={mapFocused ? "" : undefined}
            className={cn(
                // A map pick's focus: a soft emerald ring + lift that eases in and settles back (no flash, no pulse).
                "border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950 transition-[box-shadow,border-color] duration-500 ease-out motion-reduce:transition-none",
                reporting && "border-red-200 dark:border-red-900/50",
                mapFocused && "border-emerald-300 dark:border-emerald-700 shadow-md ring-2 ring-emerald-300/60 dark:ring-emerald-600/40"
            )}
        >
            <div
                role="button"
                tabIndex={0}
                data-dispatch-toggle
                aria-expanded={expanded}
                aria-controls={expanded ? bodyId : undefined}
                className="p-3.5 flex flex-col select-none cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700"
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        onToggle()
                    }
                }}
            >
                <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex flex-col text-left min-w-0">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 font-mono">{label}</span>
                        <span className="text-[11px] text-zinc-500 font-mono block mt-0.5">{formatDispatchDate(dispatch.date)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <DispatchViewBadge view={view} statusKnown={item.statusKnown} />
                        {/* V2.1: THIS dispatch's validation flag, beside its status (never a status itself). */}
                        <ValidationMarker validation={item.validation} />
                        {/* Report history of THIS dispatch (the clock): context, never a state. */}
                        <HistoryIndicator state={historyState} hasEntries={hasHistory} onOpen={onOpenHistory} onRetry={onRetryHistory} />
                        {video && (videoUrl
                            ? (
                                <MediaHoverPreview preview={{ kind: "video", url: videoUrl, title: label, caption: "Deployment video · click to play" }}>
                                    <CardIconAction label={`Play the deployment video of ${label}`} onClick={() => work.onPreview(video)} data-dispatch-video="play"><Play className="h-4 w-4" /></CardIconAction>
                                </MediaHoverPreview>
                            )
                            : <span data-dispatch-video="none" title="No deployment video" className="h-7 w-7 inline-flex items-center justify-center text-zinc-300 dark:text-zinc-600"><VideoOff className="h-4 w-4" aria-hidden /></span>)}
                        <CardMoreMenu
                            label={`More actions for ${label}`}
                            actions={onDelete ? [{ id: "delete-dispatch", label: "Delete dispatch", destructive: true, onSelect: onDelete }] : []}
                        />
                        <Chevron data-dispatch-chevron className="h-4 w-4 text-zinc-400 shrink-0" aria-hidden />
                    </div>
                </div>
                {/* Collapsed: one compact summary line (the labelled details are in the expanded card). */}
                {!expanded && (
                    <p data-dispatch-summary className="mt-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-400 text-left truncate min-w-0" title={summary.join(" · ")}>
                        {summary.map((part, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span aria-hidden className="text-zinc-300 dark:text-zinc-600">{"  ·  "}</span>}
                                <span data-summary-part={i === 0 ? "az" : surveyor && i === summary.length - 1 ? "surveyor" : "fact"}>{part}</span>
                            </React.Fragment>
                        ))}
                    </p>
                )}
                {/* V2.1: the dispatch's validation messages — one line collapsed, the list expanded (the API's, as sent). */}
                {item.validation.required === true && <ValidationNotice validation={item.validation} full={expanded} className={footer} />}
                {view === "verified" && (
                    <div className={cn(footer, "flex items-center gap-1.5 text-left w-full")}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified{verifier ? <> by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{verifier}</strong></> : null}
                            {verifiedAtMs !== null ? <> • {format(new Date(verifiedAtMs), "dd MMM yyyy, hh:mm a")}</> : null}
                        </span>
                    </div>
                )}
                {/* Need Correction: one line while collapsed; the full correction while expanded (said once either way). */}
                {view === "need_correction" && (expanded
                    ? <div className={footer}><CorrectionDetails item={item} onOpenHistory={onOpenHistory} /></div>
                    : <CorrectionSummary item={item} className={footer} />)}
                {/* This session's report, until report history names it (it is then the correction above). */}
                {localReport && !manual && view !== "need_correction" && (
                    <div data-local-report className={footer}>
                        <CorrectionBlock context={{ origin: "manual_report", reason: localReport.comment, by: reporterName, at: localReport.at }} full={expanded} />
                    </div>
                )}
            </div>
            {expanded && (
                <div id={bodyId} data-dispatch-body className="px-3.5 pb-3.5">
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
                        <DetailList title="Dispatch details" data-dispatch-details>
                            <DetailRow id="az" label="AZ">{`${az} · ${plotCount}`}</DetailRow>
                            {details.map((field) => (
                                <DetailRow key={field.id} id={field.id.split(":")[0]} label={field.label} correctionId={correctionIds.has(field.id) ? field.id : undefined}>
                                    {fieldValue(field)}
                                </DetailRow>
                            ))}
                            {surveyor && (
                                <DetailRow id="surveyor" label="Surveyor">
                                    <SurveyorCell surveyor={surveyor} />
                                </DetailRow>
                            )}
                            {/* The dispatch's own video (getTrailerDetails `video`), in the Picture row's pattern: Play opens the
                                existing player; "Not uploaded" when the API sent none. Absent for a type that has no dispatch video. */}
                            {video && (
                                <DetailRow id="video" label="Video" correctionId={correctionIds.has(video.id) ? video.id : undefined}>
                                    {videoUrl ? (
                                        <MediaHoverPreview preview={{ kind: "video", url: videoUrl, title: label, caption: "Deployment video · click to play" }}>
                                        <button
                                            type="button"
                                            data-video-play
                                            onClick={(e) => { e.stopPropagation(); work.onPreview(video) }}
                                            className="font-semibold underline underline-offset-2 decoration-zinc-300 hover:decoration-current focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-sm"
                                        >
                                            Play
                                        </button>
                                        </MediaHoverPreview>
                                    ) : (
                                        <span data-video-missing>Not uploaded</span>
                                    )}
                                </DetailRow>
                            )}
                        </DetailList>
                        {/* Report mode: the instruction (information only), then the field selection — the dispatch's
                            reportable values here, each plot's on its card, all in the same option style. */}
                        {reporting && (
                            <div data-report-mode className="space-y-3 text-left">
                                <div data-report-info role="note" className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/10 px-2.5 py-2">
                                    <Info className="h-3.5 w-3.5 mt-px shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                                    <p data-report-warning className="text-[11px] leading-4 text-amber-900 dark:text-amber-200">
                                        Select what needs correction. Reporting marks this whole dispatch for correction, including {plots.length === 1 ? "its plot" : `all ${plots.length} of its plots`}.
                                    </p>
                                </div>
                                {dispatchReportOptions.length > 0 && (
                                    <div data-report-fields="dispatch" className="space-y-1.5">
                                        <p className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none">Dispatch fields</p>
                                        {dispatchReportOptions.map((option) => (
                                            <ReportFieldOption key={option.id} option={option} selected={work.reportedIds.includes(option.id)} onToggle={() => work.onToggleReportField(option.id)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none text-left">
                            Deployments ({plots.length})
                        </div>
                        {/* Deployment fields an open report names without identifying which deployment (no entry_no): at
                            the deployment level, not attached to any one card. */}
                        {unplaced.length > 0 && (
                            <div data-deployments-unplaced className="space-y-1.5 text-left">
                                {unplaced.map((kind) => <UnplacedCorrectionField key={kind} kind={kind} />)}
                            </div>
                        )}
                        {plots.length === 0 ? (
                            <p data-no-plots className="text-xs text-zinc-500 dark:text-zinc-400 text-left select-none">No plots</p>
                        ) : (
                            <div data-plot-list className="border-t border-zinc-100 dark:border-zinc-800">
                                {plots.map((plot) => (
                                    <PlotCard
                                        key={plot.deployment_id}
                                        plot={plot}
                                        deploymentType={deploymentType}
                                        villageName={dispatch.village_name}
                                        correction={manual && item.correctionPlots.has(plot.repeater_form_index)}
                                        correctionFields={correctionIds}
                                        located={locatedPlotId === plot.deployment_id}
                                        focused={mapFocused && focusedPlotId === plot.deployment_id}
                                        expanded={expandedPlots.has(plot.deployment_id)}
                                        onToggle={() => onTogglePlot(plot)}
                                        reporting={reporting}
                                        reportOptions={reporting ? plotReportOptions(plot) : EMPTY_OPTIONS}
                                        reportedIds={work.reportedIds}
                                        onToggleReportField={work.onToggleReportField}
                                        onPreview={work.onPreview}
                                        onLocate={work.onLocatePlot && plot.location ? () => work.onLocatePlot?.(plot) : undefined}
                                        onComment={plot.comment || (work.canMutate && item.inVerificationScope) ? () => work.onComment(dispatch, plot) : undefined}
                                        onDelete={work.onDeletePlot && item.inVerificationScope ? () => work.onDeletePlot?.(dispatch, plot) : undefined}
                                    />
                                ))}
                            </div>
                        )}
                        {/* The dispatch's own actions: Report (a Pending dispatch) and Approve (a Pending dispatch the API doesn't flag). */}
                        {(canReport || canApprove) && (
                            <div data-dispatch-actions data-approve-gate={canApprove ? (approveBlocked ? "blocked" : "ok") : validationBlocker ? "validation" : undefined} data-approve-blockers={canApprove ? approveBlockers.map((b) => b.kind).join(" ") : undefined} className="pt-1 space-y-2">
                                {!reporting && validationBlocker && (
                                    <p data-validation-approve-blocker className="flex items-center gap-2 text-left text-[11px] leading-4 font-medium text-amber-800 dark:text-amber-300">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{validationBlocker}</span>
                                    </p>
                                )}
                                {canApprove && !reporting && approveBlocked && (
                                    <div className="space-y-1.5">
                                        {/* One line per independent gate, each the Samples readiness-strip row: icon · the reason (wraps,
                                            left-aligned, in full) · its one action at the end */}
                                        {approveBlockers.map((blocker) => {
                                            const editBoundaries = blocker.kind === "boundary" ? work.editBoundariesFor?.(dispatch) : undefined
                                            const action = blocker.kind === "noc" ? work.onReviewNoc && { label: "Review NOC", onClick: work.onReviewNoc }
                                                : editBoundaries ? { label: "Edit boundaries", onClick: editBoundaries }
                                                : undefined
                                            return (
                                                <p key={blocker.kind} data-approve-blocker data-blocker-kind={blocker.kind} className="flex items-center gap-2 text-left text-[11px] leading-4 font-medium text-amber-800 dark:text-amber-300">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                    <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                                                        {blocker.title && <span data-blocker-title className="font-semibold">{blocker.title} </span>}
                                                        {blocker.text}
                                                    </span>
                                                    {action && (
                                                        <button type="button" data-blocker-action={blocker.kind} onClick={action.onClick} className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 hover:no-underline">
                                                            {action.label}
                                                        </button>
                                                    )}
                                                </p>
                                            )
                                        })}
                                    </div>
                                )}
                                <div className="flex items-center justify-end gap-2">
                                    {reporting ? (
                                        <>
                                            <Button variant="outline" data-cancel-report className="h-8 px-3 text-xs font-bold" onClick={work.onCancelReport}>
                                                Cancel
                                            </Button>
                                            <Button
                                                data-finalize-report
                                                className="h-8 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                                                disabled={selectedCount === 0}
                                                onClick={work.onFinalizeReport}
                                            >
                                                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                                {selectedCount === 0 ? "Report" : `Report Selected (${selectedCount})`}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            {canReport && (
                                                <Button
                                                    variant="outline"
                                                    data-start-report
                                                    className="h-8 px-3 text-xs font-bold text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-950/20"
                                                    disabled={!work.canMutate}
                                                    onClick={() => work.onStartReport(dispatch)}
                                                >
                                                    <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                                    Report
                                                </Button>
                                            )}
                                            {canApprove && (
                                                <Button
                                                    data-approve
                                                    className="h-8 px-4 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                    disabled={!work.canMutate || approveBlocked}
                                                    onClick={() => work.onApprove(dispatch)}
                                                >
                                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Approve
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    )
}

const EMPTY_IDS: Set<string> = new Set()
const EMPTY_OPTIONS: ReportOption[] = []

interface DispatchCardsProps {
    row: DeploymentMetadataRow
    deploymentType: DeploymentTypeConfig
    /** The row's dispatch read is in flight (with nothing returned yet, the list shows its loading box). */
    loading: boolean
    /** Every dispatch the row's read returned (every status), classified (deployment-dispatch-view.ts). */
    dispatches: ClassifiedDispatch[]
    /** The local filter; trailer sections and cards follow it. */
    filter: DetailFilter
    localReports: Record<string, LocalReport>
    reporterName: string
    /** Expanded dispatches (by deployment_detail_id; every dispatch starts collapsed). */
    expandedDispatches: Set<string>
    onToggleDispatch: (deploymentDetailId: string) => void
    /** The plot located on the map (its deployment_id): expanding a plot card locates its plot. */
    locatedPlotId: number | null
    /** The expanded dispatch's actions (gates + the sheet's existing handlers). */
    work: DispatchWork
    /** Set when the verifier may delete dispatches here; offered on the dispatches of the row's verification read. */
    onDeleteDispatch?: (dispatch: TrailerDispatchItem) => void
    /** Set when the row's dispatch read failed: shown instead of the cards. */
    trailersError?: string | null
    /** The row's report-history read: loading / ready / failed (each card's clock shows it; a failure is also said once). */
    historyState: HistoryReadState
    /** Reads the dispatches and history again (error / unavailable states, notices). */
    onRetry: () => void
    /** What report history names among the loaded dispatches (empty while the history is unknown or failed). */
    reportIndex: ReportIndex
    /** Report history: of one dispatch (its deployment_detail_id) when opened from that dispatch, else of the deployment. */
    onOpenHistory: (deploymentDetailId?: string) => void
    /** Expanded plot cards (by deployment_id; every plot starts collapsed) and their toggle. */
    expandedPlots: Set<number>
    onTogglePlot: (plot: TrailerDeploymentPlot) => void
    /** The dispatch a map pick just revealed (deployment_detail_id), briefly ringed; null otherwise. */
    mapFocusDispatchId: string | null
    /** The plot that map pick named (deployment_id), briefly emphasised inside that dispatch; null otherwise. */
    mapFocusPlotId: number | null
}

export function DispatchCards({
    row,
    deploymentType,
    loading,
    dispatches,
    filter,
    localReports,
    reporterName,
    expandedDispatches,
    onToggleDispatch,
    locatedPlotId,
    work,
    onDeleteDispatch,
    trailersError,
    historyState,
    onRetry,
    reportIndex,
    onOpenHistory,
    mapFocusDispatchId,
    mapFocusPlotId,
    expandedPlots,
    onTogglePlot,
}: DispatchCardsProps) {
    const state = resolveDispatchListState(row, dispatches.length, trailersError, loading)
    // Report history this view can't place on a dispatch (not after a failed read: nothing is known then).
    const notShown = state !== "error" && reportIndex.notShown.length > 0
        ? <ReportsNotShown count={reportIndex.notShown.length} onOpenHistory={() => onOpenHistory()} />
        : null
    const historyNotice = state !== "error" && historyState === "failed" ? (
        <p data-history-notice className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            Report history couldn&apos;t be loaded, so reports can&apos;t be matched to dispatches.{" "}
            <button type="button" onClick={onRetry} className="text-[10px] font-bold uppercase tracking-wider hover:underline underline-offset-2">Retry</button>
        </p>
    ) : null
    if (state !== "list") {
        const empty = <EmptyDispatches state={state} error={trailersError} onRetry={onRetry} />
        return notShown || historyNotice ? <div className="space-y-4">{historyNotice}{notShown}{empty}</div> : empty
    }
    // The list row's stated count vs what the read returned. Only "fewer returned" is the user's concern (dispatches may be
    // missing from the list); "more returned than stated" and "no stated count" are API inconsistencies / missing
    // metadata, listed in the Data / API Inspector (Farmer rows → detail sections), never in the detail.
    const stated = row.trailers_deployed
    const missingCount = stated !== null && stated > dispatches.length ? stated - dispatches.length : 0
    const listed = dispatches.filter((d) => inDetailFilter(d, filter))
    // V2.1: no trailer groups — the farmer-level detail groups by AZ (the sheet); a dispatch names its trailer on its card.
    const card = (item: ClassifiedDispatch) => (
        <DispatchCard
            key={item.dispatch.deployment_detail_id}
            item={item}
            row={row}
            deploymentType={deploymentType}
            localReport={localReports[item.dispatch.deployment_detail_id]}
            reporterName={reporterName}
            reportIndex={reportIndex}
            historyState={historyState}
            onRetryHistory={onRetry}
            expanded={expandedDispatches.has(item.dispatch.deployment_detail_id)}
            onToggle={() => onToggleDispatch(item.dispatch.deployment_detail_id)}
            locatedPlotId={locatedPlotId}
            onDelete={onDeleteDispatch && item.inVerificationScope ? () => onDeleteDispatch(item.dispatch) : undefined}
            onOpenHistory={() => onOpenHistory(item.dispatch.deployment_detail_id)}
            work={work}
            mapFocused={mapFocusDispatchId === item.dispatch.deployment_detail_id}
            focusedPlotId={mapFocusPlotId}
            expandedPlots={expandedPlots}
            onTogglePlot={onTogglePlot}
        />
    )
    return (
        <div className="space-y-4">
            {(missingCount > 0 || loading || historyNotice || notShown) && (
                <div className="space-y-1 text-left select-none">
                    {/* Fewer dispatches returned than the deployment states: said plainly (never reconciled). */}
                    {missingCount > 0 && stated !== null && (
                        <p data-dispatch-scope data-dispatch-stated={stated} data-dispatch-returned={dispatches.length} className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            {dispatches.length} of {plural(stated, "dispatch")} loaded — {missingCount} {missingCount === 1 ? "wasn't" : "weren't"} returned by the server.
                        </p>
                    )}
                    {loading && (
                        <p data-dispatch-reloading className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            Refreshing dispatches…
                        </p>
                    )}
                    {historyNotice}
                    {notShown}
                </div>
            )}
            {listed.length === 0 ? (
                // The local filter lists none of this deployment's dispatches: nothing here — the AZ section's footer
                // says how many dispatches of the AZ the filter hides, with View all dispatches (the sheet).
                filter === "all" ? <EmptyBox data-dispatch-empty="filter" data-filter-empty={filter} title="No dispatches" detail="There are no deployment dispatches to display." icon="inbox" /> : null
            ) : (
                <div className="space-y-4">{listed.map(card)}</div>
            )}
        </div>
    )
}
