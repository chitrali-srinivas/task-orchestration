// Deployment V2 — the detail's dispatch picture: every dispatch of the opened farmer + deployment + AZ, classified for
// the local All / Pending / Need Correction / Verified filter. A V2-only presentation layer over the existing reads:
//   reads    one getTrailerDetails per dispatch status (pending, approved, rejected), each built by the existing
//            buildTrailerDetailsRequest. The row's own verification read (detailDispatchStatuses) comes first and is
//            required; the other two are optional. Plus the detail's one report-history read (unchanged).
//   backend  every dispatch keeps its backend state (its franchise_status: pending / approved / rejected).
//   view     what the verifier sees:
//     verified         approved.
//     need_correction  needs correction, with its origin(s):
//                        manual_report      report history names the dispatch (repeater_form_id) and the report is
//                                           open: a rejected dispatch with history, or a pending one with an ongoing
//                                           entry. A completed report on a pending dispatch is history, not a correction.
//                        system_validation  the row failed the server's validation (V4 status need_correction, i.e.
//                                           action_required). Row-level, as matic-dash's Action Required: the API has
//                                           no dispatch-level validation field, so it applies to every pending dispatch
//                                           of the row; err_msg text is never mapped to a dispatch or a field.
//                                           Not a verifier report: a dispatch flagged only by it is still the pending
//                                           dispatch the pending read returned — listed under Pending as well, and
//                                           manually reportable (isSystemValidationOnly / awaitsVerification). It never
//                                           creates report history or a Reported state.
//     pending          awaiting verification, with no open correction.
//   Report history is context, never a state: a completed report doesn't change a dispatch's view, and the UI shows
//   one state per dispatch (correctionContexts says why a Need Correction dispatch needs correction).
//     unmatched        internal only, not a user-facing state: rejected, but no report history names it (or history
//                      couldn't be loaded). Listed under All with no verification badge, read-only (no Approve /
//                      Report), never counted as Need Correction.
// Nothing here reads franchise_statuses or the plot is_*_reported flags, and nothing is guessed: a field is highlighted
// only for an established history label (AZ 1–3), a plot only when entry_no names exactly one.
import type { DeploymentMetadataRow, DispatchStatus, ReportHistoryEntry, TrailerDispatchItem } from "../data/schema"
import { detailDispatchStatuses } from "../data/request-builders"
import { entrySummary, locateReportEntry, reportedFieldId, reportedFieldKind, type ReportIndex } from "./deployment-report-index"

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────

export const DISPATCH_READ_STATUSES: readonly DispatchStatus[] = ["pending", "approved", "rejected"]

/** A detail's trailer reads: the row's verification read first (required), then the other statuses (optional). */
export function detailReadStatuses(row: DeploymentMetadataRow): DispatchStatus[] {
    const primary = detailDispatchStatuses(row)[0] ?? "pending"
    return [primary, ...DISPATCH_READ_STATUSES.filter((status) => status !== primary)]
}

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

// ── Filter ──────────────────────────────────────────────────────────────────────────────────────────

export type DetailFilter = "all" | "pending" | "need_correction" | "verified"
export const DETAIL_FILTERS: readonly DetailFilter[] = ["all", "pending", "need_correction", "verified"]
export const DETAIL_FILTER_LABEL: Record<DetailFilter, string> = { all: "All", pending: "Pending", need_correction: "Need Correction", verified: "Verified" }

/** The table context the detail was opened from (page.tsx defaultTab). */
export type DetailOpenedFrom = "all" | "verified" | "pending" | "need_correction" | "details"

/**
 * Opened from the All tab → All; from a status tab → the opened row's own status. Recomputed for every newly opened
 * row (Previous / Next included); a filter chosen in the detail never carries over to another row.
 */
export function defaultDetailFilter(openedFrom: DetailOpenedFrom | undefined, rowStatus: DeploymentMetadataRow["status"] | undefined): DetailFilter {
    if (!openedFrom || openedFrom === "all" || openedFrom === "details" || !rowStatus) return "all"
    return rowStatus === "approved" ? "verified" : rowStatus === "need_correction" ? "need_correction" : "pending"
}

// ── Classification ──────────────────────────────────────────────────────────────────────────────────

export type DispatchView = "pending" | "need_correction" | "verified" | "unmatched"
export type CorrectionOrigin = "manual_report" | "system_validation"

/** The verifier-facing states (`unmatched` has none). */
export const DISPATCH_VIEW_LABEL: Record<Exclude<DispatchView, "unmatched">, string> = { pending: "Pending", need_correction: "Need Correction", verified: "Verified" }

export interface ClassifiedDispatch {
    dispatch: TrailerDispatchItem
    /** The backend state, retained (the status the dispatch was read with when the response has none). */
    backendStatus: DispatchStatus
    view: DispatchView
    /** Why it needs correction; empty unless `view` is need_correction. */
    origins: CorrectionOrigin[]
    /** One concise reason: the latest open report's reason, else the row's validation message (err_msg). */
    reason: string | null
    /** The verifier report behind a manual correction: its reason, reporter and time, each null when the entry has none. */
    report: { reason: string | null; by: string | null; at: number | null } | null
    /** The row's validation message when system validation applies (never mapped to a field). */
    systemReason: string | null
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

/** The row's validation messages (the "Why here?" text), or null when none were sent. */
export function systemValidationReason(row: DeploymentMetadataRow): string | null {
    const text = (row.err_msg ?? []).map((message) => message.trim()).filter(Boolean).join(" ")
    return text || null
}

export interface ClassifyInput {
    row: DeploymentMetadataRow
    dispatches: TrailerDispatchItem[]
    reportIndex: ReportIndex
    /** History loaded; false while it loads or after a failed read (no report can be matched then). */
    historyKnown: boolean
    /** Field cards may be highlighted for this type (deployment-types.ts reportedFieldMarkers: AZ 1–3 only). */
    fieldMarkers: boolean
}

export function classifyDispatch(dispatch: TrailerDispatchItem, input: ClassifyInput): ClassifiedDispatch {
    const { row, reportIndex, historyKnown, fieldMarkers } = input
    const backendStatus: DispatchStatus = dispatch.franchise_status ?? "pending"
    const entries = historyKnown ? reportIndex.dispatches.get(dispatch.deployment_detail_id)?.entries ?? [] : []
    const open = entries.filter(isOpenEntry)
    const origins: CorrectionOrigin[] = []
    let view: DispatchView
    let reportEntries: ReportHistoryEntry[] = []
    if (backendStatus === "approved") {
        view = "verified"
    } else if (backendStatus === "rejected") {
        // The report's dispatch update rejected it: matched by history, it needs correction; otherwise its origin is unknown.
        if (entries.length > 0) {
            origins.push("manual_report")
            reportEntries = open.length > 0 ? open : entries
        }
        view = origins.length > 0 ? "need_correction" : "unmatched"
    } else {
        if (open.length > 0) {
            origins.push("manual_report")
            reportEntries = open
        }
        if (row.status === "need_correction") origins.push("system_validation")
        view = origins.length > 0 ? "need_correction" : "pending"
    }
    const correctionFields = new Set<string>()
    const correctionPlots = new Set<number>()
    const correctionUnplacedFields = new Set<"mati_deployed" | "location">()
    for (const entry of reportEntries) {
        const located = locateReportEntry(entry, [dispatch])
        if (!located) continue
        if (located.plot) correctionPlots.add(located.plot.repeater_form_index)
        const fieldId = fieldMarkers ? reportedFieldId(entry, located) : null
        if (fieldId) correctionFields.add(fieldId)
        const kind = fieldMarkers ? reportedFieldKind(entry) : null
        if (!located.plot && (kind === "mati_deployed" || kind === "location")) correctionUnplacedFields.add(kind)
    }
    const shown = origins.includes("manual_report") ? latestEntry(reportEntries) : null
    const report = shown ? { reason: entryText(shown), by: shown.reported_by_name?.trim() || null, at: shown.created_at } : null
    const systemReason = origins.includes("system_validation") ? systemValidationReason(row) : null
    const reason = view !== "need_correction" ? null : report?.reason ?? systemReason
    return {
        dispatch,
        backendStatus,
        view,
        origins,
        reason,
        report,
        systemReason,
        correctionFields,
        correctionPlots,
        correctionUnplacedFields,
        correctionLabels: entrySummary(reportEntries, dispatch),
        inVerificationScope: backendStatus === (detailDispatchStatuses(row)[0] ?? "pending"),
    }
}

export function classifyDispatches(input: ClassifyInput): ClassifiedDispatch[] {
    return input.dispatches.map((dispatch) => classifyDispatch(dispatch, input))
}

/**
 * A pending dispatch flagged only by the row's system validation (action_required + err_msg) — no verifier report is
 * open on it. Product decision: system validation is not a manual report. The dispatch is still the PENDING dispatch
 * the pending read returned: it shows its Need Correction badge and validation reason, and stays manually reportable.
 */
export const isSystemValidationOnly = (item: ClassifiedDispatch) =>
    item.view === "need_correction" && item.backendStatus === "pending" && item.origins.length === 1 && item.origins[0] === "system_validation"

/** Waiting for the verifier: a plain pending dispatch, or a pending one flagged only by system validation. */
export const awaitsVerification = (item: ClassifiedDispatch) => item.view === "pending" || isSystemValidationOnly(item)

/**
 * The local filter. Pending lists every dispatch waiting for the verifier — including system-validation-only ones,
 * which are also listed under Need Correction (their badge). A pending dispatch with an open verifier report is in a
 * correction workflow: Need Correction only.
 */
export const inDetailFilter = (dispatch: ClassifiedDispatch, filter: DetailFilter) =>
    filter === "all" || (filter === "pending" ? awaitsVerification(dispatch) : dispatch.view === filter)

// ── Correction context (presentation only: the classification above decides the state) ───────────────

/**
 * Why a Need Correction dispatch needs correction, and who / what said so: a verifier's report (its reason, reporter
 * and time) or the row's validation (its message; the data has no validation time). A missing value stays null.
 */
export interface CorrectionContext {
    origin: CorrectionOrigin
    reason: string | null
    by: string | null
    at: number | null
}

/** Every origin's context, the verifier's report first (it names this dispatch), then the row's validation. */
export function correctionContexts(item: ClassifiedDispatch): CorrectionContext[] {
    if (item.view !== "need_correction") return []
    const contexts: CorrectionContext[] = []
    if (item.origins.includes("manual_report")) contexts.push({ origin: "manual_report", reason: item.report?.reason ?? null, by: item.report?.by ?? null, at: item.report?.at ?? null })
    if (item.origins.includes("system_validation")) contexts.push({ origin: "system_validation", reason: item.systemReason, by: null, at: null })
    return contexts
}

/** The one context a collapsed dispatch shows: the verifier's report when there is one, else the row's validation. */
export const primaryCorrection = (item: ClassifiedDispatch): CorrectionContext | null => correctionContexts(item)[0] ?? null

// ── Dispatch actions (the established V2 gates, in one place) ─────────────────────────────────────────

/**
 * Report: a dispatch waiting for the verifier (plain pending, or pending with only the row's system validation), on
 * rows that aren't Verified. A dispatch with an open verifier report is already in a correction workflow; Verified is
 * read-only. The report workflow itself (selection, Finalize dialog, request sequence, payloads) is unchanged.
 */
export const offersReport = (row: DeploymentMetadataRow, item: ClassifiedDispatch) => row.status !== "approved" && awaitsVerification(item)

/** Approve: one Pending dispatch at a time, on Pending rows. */
export const offersApprove = (row: DeploymentMetadataRow, item: ClassifiedDispatch) => row.status === "pending" && item.view === "pending"

// ── Counts ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Filter counts over the loaded dispatches, or null where they can't be known: a count is shown only when every
 * read (and the history) that decides it succeeded.
 *   All              every read.
 *   Verified         the approved read.
 *   Pending          the pending read, and history (a pending dispatch with an open report is not waiting for the
 *                    verifier; one flagged only by system validation is).
 *   Need Correction  the pending and rejected reads, and history — except on a Need Correction row whose reads found
 *                    no rejected dispatch (its pending dispatches all need correction then).
 * A system-validation-only dispatch counts under both Pending and Need Correction (it is listed in both); All counts
 * each dispatch once.
 */
export function detailFilterCounts(
    dispatches: ClassifiedDispatch[],
    { row, failedReads, historyKnown }: { row: DeploymentMetadataRow; failedReads: DispatchStatus[]; historyKnown: boolean }
): Record<DetailFilter, number | null> {
    const ok = (status: DispatchStatus) => !failedReads.includes(status)
    const count = (filter: DetailFilter) => dispatches.filter((d) => inDetailFilter(d, filter)).length
    const ncRow = row.status === "need_correction"
    const anyRejected = dispatches.some((d) => d.backendStatus === "rejected")
    return {
        all: failedReads.length === 0 ? count("all") : null,
        verified: ok("approved") ? count("verified") : null,
        pending: ok("pending") && historyKnown ? count("pending") : null,
        need_correction: ok("pending") && ok("rejected") && (historyKnown || (ncRow && !anyRejected)) ? count("need_correction") : null,
    }
}

// ── Trailer sections ────────────────────────────────────────────────────────────────────────────────

export interface TrailerSection {
    /** The trailer number ("" for dispatches without one). */
    trailerNo: string
    /** Its dispatches in the current filter, in API order. */
    dispatches: ClassifiedDispatch[]
    /** All its loaded dispatches. */
    total: number
}

/** Loaded dispatches grouped by trailer number (API order), keeping only trailers with a dispatch in the filter. */
export function trailerSections(dispatches: ClassifiedDispatch[], filter: DetailFilter): TrailerSection[] {
    const sections: TrailerSection[] = []
    for (const dispatch of dispatches) {
        const trailerNo = dispatch.dispatch.trailer_no
        let section = sections.find((s) => s.trailerNo === trailerNo)
        if (!section) {
            section = { trailerNo, dispatches: [], total: 0 }
            sections.push(section)
        }
        section.total += 1
        if (inDetailFilter(dispatch, filter)) section.dispatches.push(dispatch)
    }
    return sections.filter((section) => section.dispatches.length > 0)
}
