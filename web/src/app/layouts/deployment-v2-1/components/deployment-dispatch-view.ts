// Deployment V2.1 — the detail's dispatch picture: every dispatch of the opened FARMER (every row — round + AZ — every
// status), for the local All / Pending / Need Correction / Verified filter. A presentation layer over the reads:
//   reads    V2.1: ONE getTrailerDetails per deployment GROUP (farmer + deployment_num + az_id — the list's dispatch rows
//            grouped, hooks/use-farmer-detail.ts), `status` omitted — every dispatch with its own franchise_status.
//   status   `franchise_status` IS the dispatch's status (requirement 4). Nothing here derives a status from report
//            history, NOC state, action_required, err_msg or the row status:
//              approved → Verified · pending → Pending · rejected → Need Correction.
//   context  Report history is context, never a state: the open verifier report naming a dispatch explains a Need
//            Correction (rejected) dispatch and marks a Pending one as reported; a completed report is history.
//   validation  V2.1 (live API audit, 2026-10-11): `action_required` / `err_msg` are sent PER DISPATCH (on the dispatch
//            read and on the dispatch's list row) and differ between dispatches of one deployment. Each dispatch shows
//            its own (ClassifiedDispatch.validation); one dispatch's never reaches a sibling, a plot or a field, and it
//            never changes a status. A flagged pending dispatch offers Report, not Approve (offersApprove) — the
//            established rule (matic-dash: Action Required → Report; V2.1's former "Approve on Pending rows only").
// Nothing here reads franchise_statuses or the plot is_*_reported flags, and nothing is guessed: a field is highlighted
// only for an established history label (AZ 1–3), a plot only when entry_no names exactly one.
import type { DeploymentMetadataRow, DispatchStatus, ReportHistoryEntry, TrailerDispatchItem } from "../data/schema"
import { validationOf, type DispatchValidation } from "../data/dispatch-rows"
import { entrySummary, locateReportEntry, reportedFieldId, reportedFieldKind, type ReportIndex } from "./deployment-report-index"
import type { DeploymentTypeConfig } from "./deployment-types"

// ── Reads (the read itself is data/dispatch-reads.ts: status omitted, per-status fallback) ──────────────────────

/** The reads' dispatches, each once (a dispatch returned by two reads keeps the first), in read order. */
export function mergeDispatchReads(reads: TrailerDispatchItem[][]): TrailerDispatchItem[] {
    const seen = new Set<string>()
    const merged: TrailerDispatchItem[] = []
    for (const dispatch of reads.flat()) {
        if (seen.has(dispatch.deployment_detail_id)) continue
        seen.add(dispatch.deployment_detail_id)
        merged.push(dispatch)
    }
    return merged
}

// ── Filter ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type DetailFilter = "all" | "pending" | "need_correction" | "verified"
export const DETAIL_FILTERS: readonly DetailFilter[] = ["all", "pending", "need_correction", "verified"]
export const DETAIL_FILTER_LABEL: Record<DetailFilter, string> = { all: "All", pending: "Pending", need_correction: "Need Correction", verified: "Verified" }

/** The table context the detail was opened from (page.tsx defaultTab). */
export type DetailOpenedFrom = "all" | "verified" | "pending" | "need_correction" | "details"

/**
 * Opened from the All tab → All; from a status tab → that tab's dispatch status (V2.1: the tabs are dispatch-status
 * views, so the TAB decides — never the opened list row's status, which may differ from the dispatch's). Recomputed for
 * every newly opened farmer (Previous / Next included); a filter chosen in the detail never carries over to another farmer.
 */
export function defaultDetailFilter(openedFrom: DetailOpenedFrom | undefined): DetailFilter {
    if (openedFrom === "verified" || openedFrom === "pending" || openedFrom === "need_correction") return openedFrom
    return "all"
}

// ── Status ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type DispatchView = "pending" | "need_correction" | "verified"
/** The only origin a dispatch-level correction can have: a verifier's report (system validation is row-scoped). */
export type CorrectionOrigin = "manual_report" | "system_validation"

export const DISPATCH_VIEW_LABEL: Record<DispatchView, string> = { pending: "Pending", need_correction: "Need Correction", verified: "Verified" }

/** franchise_status → the verifier-facing label. The ONLY status mapping; it is a relabelling, not a derivation. */
export const VIEW_OF_STATUS: Record<DispatchStatus, DispatchView> = { approved: "verified", pending: "pending", rejected: "need_correction" }

/** The row's system validation, at ROW scope: the backend's flag and its reasons (possibly none). */
export interface SystemValidation {
    required: boolean
    reasons: string[]
}

export function systemValidationOf(row: Pick<DeploymentMetadataRow, "action_required" | "err_msg">): SystemValidation {
    return { required: row.action_required === true, reasons: (row.err_msg ?? []).map((m) => m.trim()).filter(Boolean) }
}

/** The row's validation messages as one text (the "Why here?" text), or null when none were sent. */
export function systemValidationReason(row: DeploymentMetadataRow): string | null {
    const text = systemValidationOf(row).reasons.join(" ")
    return text || null
}

export interface ClassifiedDispatch {
    dispatch: TrailerDispatchItem
    /** franchise_status as returned; `pending` only when the response carried none (the normaliser's null). */
    backendStatus: DispatchStatus
    /** Whether the response carried a franchise_status at all (false: assumed pending, said so in the UI). */
    statusKnown: boolean
    view: DispatchView
    /** V2.1: THIS dispatch's system validation, as its read sent it (required null: not sent). Never a status. */
    validation: DispatchValidation
    /** Which contexts explain the dispatch: a verifier's report naming it (history), when there is one. */
    origins: CorrectionOrigin[]
    /** One concise reason: the latest open report's reason; null when no report explains the state. */
    reason: string | null
    /** The open verifier report naming this dispatch: its reason, reporter and time, each null when the entry has none. */
    report: { reason: string | null; by: string | null; at: number | null } | null
    /** Field-card ids (deployment-field-cards.ts reportId) an open report names: highlighted while it needs correction. */
    correctionFields: Set<string>
    /** repeater_form_index of the plots an open report names. */
    correctionPlots: Set<number>
    /**
     * Plot fields an open report names (established labels "Mati Deployed" / "Location", AZ 1–3) on this dispatch whose
     * plot can't be identified: no entry_no, or no single plot with it. Shown on the dispatch, never guessed onto a plot.
     */
    correctionUnplacedFields: Set<"mati_deployed" | "location">
    /** The fields the open report names, for the card ("Location", "Mati Deployed (plot not identified)", …). */
    correctionLabels: string[]
    /**
     * In the row's own verification read (pending on Pending / Need Correction rows, approved on Verified rows): the
     * dispatches V2 listed before the All view. Delete and plot comments stay limited to these.
     */
    inVerificationScope: boolean
}

/** A report still waiting for its correction (ongoing; a missing status is not treated as completed). */
const isOpenEntry = (entry: ReportHistoryEntry) => entry.status !== "completed"

const entryText = (entry: ReportHistoryEntry) => entry.reason?.trim() || entry.comment?.trim() || null

/** The latest entry with a reason (else the latest entry): what a correction shows (the History dialog keeps every entry). */
function latestEntry(entries: ReportHistoryEntry[]): ReportHistoryEntry | null {
    const sorted = [...entries].sort((a, b) => (b.created_at ?? -Infinity) - (a.created_at ?? -Infinity))
    return sorted.find((entry) => entryText(entry) !== null) ?? sorted[0] ?? null
}

export interface ClassifyInput {
    row: DeploymentMetadataRow
    /**
     * V2.1: every dispatch of the deployment group is approved (data/dispatch-rows.ts groupAllApproved) — the
     * "Verified deployment" scope the former row status gave: verification work is on approved dispatches then,
     * on pending ones otherwise.
     */
    allApproved: boolean
    dispatches: TrailerDispatchItem[]
    reportIndex: ReportIndex
    /** History loaded; false while it loads or after a failed read (no report can be matched then). */
    historyKnown: boolean
    /** Field cards may be highlighted for this type (deployment-types.ts reportedFieldMarkers: AZ 1–3 only). */
    fieldMarkers: boolean
}

export function classifyDispatch(dispatch: TrailerDispatchItem, input: ClassifyInput): ClassifiedDispatch {
    const { allApproved, reportIndex, historyKnown, fieldMarkers } = input
    const statusKnown = dispatch.franchise_status !== null
    const backendStatus: DispatchStatus = dispatch.franchise_status ?? "pending"
    const view = VIEW_OF_STATUS[backendStatus]
    const entries = historyKnown ? reportIndex.dispatches.get(dispatch.deployment_detail_id)?.entries ?? [] : []
    const open = entries.filter(isOpenEntry)
    // The report explaining a Need Correction (rejected) dispatch: its open entries, else any entry naming it.
    const reportEntries = view === "need_correction" ? (open.length > 0 ? open : entries) : open
    const origins: CorrectionOrigin[] = reportEntries.length > 0 ? ["manual_report"] : []
    const correctionFields = new Set<string>()
    const correctionPlots = new Set<number>()
    const correctionUnplacedFields = new Set<"mati_deployed" | "location">()
    // Field / plot highlights belong to a correction in progress (rejected): on a pending dispatch an open report is context only.
    const highlighted = view === "need_correction" ? reportEntries : []
    for (const entry of highlighted) {
        const located = locateReportEntry(entry, [dispatch])
        if (!located) continue
        if (located.plot) correctionPlots.add(located.plot.repeater_form_index)
        const fieldId = fieldMarkers ? reportedFieldId(entry, located) : null
        if (fieldId) correctionFields.add(fieldId)
        const kind = fieldMarkers ? reportedFieldKind(entry) : null
        if (!located.plot && (kind === "mati_deployed" || kind === "location")) correctionUnplacedFields.add(kind)
    }
    const shown = reportEntries.length > 0 ? latestEntry(reportEntries) : null
    const report = shown ? { reason: entryText(shown), by: shown.reported_by_name?.trim() || null, at: shown.created_at } : null
    return {
        dispatch,
        backendStatus,
        statusKnown,
        view,
        origins,
        reason: view === "need_correction" ? report?.reason ?? null : null,
        report,
        correctionFields,
        correctionPlots,
        correctionUnplacedFields,
        correctionLabels: entrySummary(highlighted, dispatch),
        inVerificationScope: backendStatus === (allApproved ? "approved" : "pending"),
        validation: validationOf(dispatch),
    }
}

export function classifyDispatches(input: ClassifyInput): ClassifiedDispatch[] {
    return input.dispatches.map((dispatch) => classifyDispatch(dispatch, input))
}

/** Waiting for the verifier: the dispatch's own status is pending. */
export const awaitsVerification = (item: ClassifiedDispatch) => item.view === "pending"

/** The local filter: each dispatch under its own status. */
export const inDetailFilter = (dispatch: ClassifiedDispatch, filter: DetailFilter) => filter === "all" || dispatch.view === filter

// ── Correction context (presentation only: franchise_status decides the state) ─────────────────────────────────

/**
 * Why a Need Correction dispatch needs correction, and who said so: the verifier's report (its reason, reporter and
 * time) when history names the dispatch. A rejected dispatch no report names has a context with no reason (said so).
 */
export interface CorrectionContext {
    origin: CorrectionOrigin
    reason: string | null
    by: string | null
    at: number | null
}

/** The report context of a Need Correction dispatch (one entry: the verifier's report, or "no details" without one). */
export function correctionContexts(item: ClassifiedDispatch): CorrectionContext[] {
    if (item.view !== "need_correction") return []
    return [{ origin: "manual_report", reason: item.report?.reason ?? null, by: item.report?.by ?? null, at: item.report?.at ?? null }]
}

/** The one context a collapsed dispatch shows. */
export const primaryCorrection = (item: ClassifiedDispatch): CorrectionContext | null => correctionContexts(item)[0] ?? null

// ── Dispatch actions (the established V2 gates, in one place) ────────────────────────────────────────────────────

/**
 * Report: a dispatch whose own status is pending, for a type with a workflow (a pending dispatch means its deployment
 * isn't fully Verified). A dispatch an open report already names stays reportable (the backend accepts further
 * reports); the card shows the open report as context. The report workflow itself is unchanged.
 */
export const offersReport = (item: ClassifiedDispatch, type: Pick<DeploymentTypeConfig, "supportsActions">) =>
    type.supportsActions && item.view === "pending"

/**
 * Approve: one Pending dispatch at a time, unless the API flags THAT dispatch with action_required — then it offers
 * Report, not Approve: matic-dash offers Approve on Ready to Verify only (Action Required → Report), and V2.1's former
 * rule (Approve on Pending ROWS only — need_correction rows were the action-required ones) at dispatch grain. A flag the
 * API didn't send (null) doesn't block. The status is not changed. The boundary and NOC gates apply on top.
 */
export const offersApprove = (item: ClassifiedDispatch, type: Pick<DeploymentTypeConfig, "supportsActions">) =>
    type.supportsActions && item.view === "pending" && item.validation.required !== true

/** Why a pending dispatch offers no Approve because of its own validation flag (null when it doesn't apply). */
export const validationApproveBlocker = (item: ClassifiedDispatch): string | null =>
    item.view === "pending" && item.validation.required === true ? "Flagged for correction by validation: report it instead of approving." : null

// ── Counts ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Filter counts over the loaded dispatches: known when every dispatch read succeeded (each dispatch carries its own
 * status, so history isn't needed to count); null otherwise.
 */
export function detailFilterCounts(dispatches: ClassifiedDispatch[], { readsOk }: { readsOk: boolean }): Record<DetailFilter, number | null> {
    const count = (filter: DetailFilter) => dispatches.filter((d) => inDetailFilter(d, filter)).length
    return {
        all: readsOk ? count("all") : null,
        verified: readsOk ? count("verified") : null,
        pending: readsOk ? count("pending") : null,
        need_correction: readsOk ? count("need_correction") : null,
    }
}
