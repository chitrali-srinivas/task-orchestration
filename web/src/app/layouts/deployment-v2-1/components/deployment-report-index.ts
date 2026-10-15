// Deployment V2 — what submitted reports name: the report-history index behind the "Reported" indicators.
// Submitted reports come from getFarmerReportedHistory (loaded once per detail load), mapped as established in
// docs/deployment/deployment-v2-reported-field-mapping-investigation.md:
//   repeater_form_id → the dispatch's deployment_detail_id
//   entry_no         → the plot's repeater_form_index within that dispatch (1-based; indexes restart per dispatch)
//   defect_type      → the reported field (one entry = one field; a field can be reported more than once)
// Field cards are matched only for the labels established on dev: "Source Name", "Mati Deployed" and "Location".
// Nothing here reads franchise_status / franchise_statuses, the plot is_*_reported flags, action_required or err_msg,
// and nothing is guessed: no array position, no "only plot" fallback, no field for an unknown label, and an entry
// naming no loaded dispatch is counted as not shown instead of being attached elsewhere.
import type { ReportHistoryEntry, ReportHistoryStatus, TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import { dispatchLabel, plotLabel, reportId } from "./deployment-field-cards"

export type FieldKind = "source_name" | "mati_deployed" | "location"

/** Established history labels (matched trimmed, case-insensitive) and the field each names, in display order. */
const FIELD_LABELS: readonly { label: string; kind: FieldKind }[] = [
    { label: "Source Name", kind: "source_name" },
    { label: "Mati Deployed", kind: "mati_deployed" },
    { label: "Location", kind: "location" },
]

const knownField = (entry: ReportHistoryEntry) => {
    const label = entry.defect_type.trim().toLowerCase()
    return FIELD_LABELS.find((field) => field.label.toLowerCase() === label) ?? null
}

/** The established field an entry names ("Source Name" / "Mati Deployed" / "Location"), or null for any other label. */
export function reportedFieldKind(entry: ReportHistoryEntry): FieldKind | null {
    return knownField(entry)?.kind ?? null
}

/** The entry's field for display: the established spelling, or the API's own label for any other field. */
export function reportedFieldLabel(entry: ReportHistoryEntry): string {
    return knownField(entry)?.label ?? (entry.defect_type.trim() || "Reported field")
}

/** Labels once each: established fields first (in their order), then other labels as first seen. */
function addLabel(labels: string[], label: string): string[] {
    if (labels.includes(label)) return labels
    const rank = (l: string) => {
        const i = FIELD_LABELS.findIndex((field) => field.label === l)
        return i === -1 ? FIELD_LABELS.length : i
    }
    return [...labels, label].sort((a, b) => rank(a) - rank(b))
}

/** Identical rows collapsed (the API can return an entry twice). Distinct entries, even for one field, are all kept. */
export function distinctHistoryEntries(entries: ReportHistoryEntry[]): ReportHistoryEntry[] {
    const seen = new Set<string>()
    return entries.filter((entry) => {
        const key = JSON.stringify(entry)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

/**
 * The history of ONE dispatch: the distinct entries whose repeater_form_id is its deployment_detail_id (the established
 * mapping). An entry without repeater_form_id, or naming another dispatch, is never shown here — nothing is guessed.
 */
export function historyForDispatch(entries: ReportHistoryEntry[], deploymentDetailId: string): ReportHistoryEntry[] {
    return distinctHistoryEntries(entries).filter((entry) => !!entry.repeater_form_id && entry.repeater_form_id === deploymentDetailId)
}

/** The loaded dispatch an entry names, and its plot when entry_no identifies exactly one; null when it names none. */
export function locateReportEntry(
    entry: ReportHistoryEntry,
    dispatches: TrailerDispatchItem[]
): { dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot | null } | null {
    if (!entry.repeater_form_id) return null
    const dispatch = dispatches.find((d) => d.deployment_detail_id === entry.repeater_form_id)
    if (!dispatch) return null
    const plots = entry.entry_no !== null && entry.entry_no > 0
        ? dispatch.deployment_plots_data.filter((p) => p.repeater_form_index === entry.entry_no)
        : []
    return { dispatch, plot: plots.length === 1 ? plots[0] : null }
}

/** The field card an entry names: only for an established label, and for a plot field only when its plot is known. */
export function reportedFieldId(entry: ReportHistoryEntry, located: { dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot | null }): string | null {
    const kind = knownField(entry)?.kind ?? null
    if (kind === "source_name") return reportId.source(located.dispatch)
    if (kind === "location" && located.plot) return reportId.location(located.plot)
    if (kind === "mati_deployed" && located.plot) return reportId.amount(located.plot)
    return null
}

export interface PlotReportInfo {
    /** History entries placed on this plot. */
    entries: ReportHistoryEntry[]
    /** Reported field labels, one per field. */
    fields: string[]
}

export interface DispatchReportInfo {
    /** Every history entry naming this dispatch. */
    entries: ReportHistoryEntry[]
    /** Labels of the entries placed on this dispatch or on one of its plots, one per field. */
    fields: string[]
    /** Labels of entries whose plot can't be identified (no entry_no for a plot field, or no single plot with it). */
    plotNotIdentified: string[]
    /** Plots with report history, by their repeater_form_index (indexes are per dispatch). */
    plots: Map<number, PlotReportInfo>
}

export interface ReportIndex {
    /** Dispatches with report history, by deployment_detail_id. */
    dispatches: Map<string, DispatchReportInfo>
    /** Field-card ids (deployment-field-cards.ts reportId) named by an entry with an established field label. */
    fieldIds: Set<string>
    /** Entries naming no loaded dispatch: no dispatch id, a dispatch no longer there, or one this view doesn't load. */
    notShown: ReportHistoryEntry[]
}

export function buildReportIndex(entries: ReportHistoryEntry[], dispatches: TrailerDispatchItem[]): ReportIndex {
    const index: ReportIndex = { dispatches: new Map(), fieldIds: new Set(), notShown: [] }
    for (const entry of distinctHistoryEntries(entries)) {
        const located = locateReportEntry(entry, dispatches)
        if (!located) {
            index.notShown.push(entry)
            continue
        }
        const { dispatch, plot } = located
        const label = reportedFieldLabel(entry)
        const kind = knownField(entry)?.kind ?? null
        const info: DispatchReportInfo = index.dispatches.get(dispatch.deployment_detail_id) ?? { entries: [], fields: [], plotNotIdentified: [], plots: new Map() }
        index.dispatches.set(dispatch.deployment_detail_id, info)
        info.entries.push(entry)
        if (plot) {
            const plotInfo: PlotReportInfo = info.plots.get(plot.repeater_form_index) ?? { entries: [], fields: [] }
            plotInfo.entries.push(entry)
            plotInfo.fields = addLabel(plotInfo.fields, label)
            info.plots.set(plot.repeater_form_index, plotInfo)
            info.fields = addLabel(info.fields, label)
        } else if (entry.entry_no !== null || kind === "mati_deployed" || kind === "location") {
            // A plot was named (or a plot field was reported) but no single plot of this dispatch matches.
            info.plotNotIdentified = addLabel(info.plotNotIdentified, label)
        } else {
            info.fields = addLabel(info.fields, label)
        }
        const fieldId = reportedFieldId(entry, located)
        if (fieldId) index.fieldIds.add(fieldId)
    }
    return index
}

/** The summary items of a dispatch: its reported fields, then those whose plot can't be identified. */
export function dispatchReportSummary(info: DispatchReportInfo): string[] {
    return [...info.fields, ...info.plotNotIdentified.map((label) => `${label} (plot not identified)`)]
}

/** The summary items of some of a dispatch's entries (e.g. its open reports), by the same rules as its summary line. */
export function entrySummary(entries: ReportHistoryEntry[], dispatch: TrailerDispatchItem): string[] {
    let fields: string[] = []
    let plotNotIdentified: string[] = []
    for (const entry of distinctHistoryEntries(entries)) {
        const located = locateReportEntry(entry, [dispatch])
        if (!located) continue
        const label = reportedFieldLabel(entry)
        const kind = knownField(entry)?.kind ?? null
        if (!located.plot && (entry.entry_no !== null || kind === "mati_deployed" || kind === "location")) plotNotIdentified = addLabel(plotNotIdentified, label)
        else fields = addLabel(fields, label)
    }
    return [...fields, ...plotNotIdentified.map((label) => `${label} (plot not identified)`)]
}

// ── Report History dialog rows ──────────────────────────────────────────────────────────────────────

/** A history value as readable text: `{lat, lng}` → "lat, lng" (as matic-dash shows it); arrays → their items. */
export function formatHistoryValue(value: string): string {
    const text = value.trim()
    if (!text.startsWith("{") && !text.startsWith("[")) return value
    try {
        return readableValue(JSON.parse(text))
    } catch {
        return value
    }
}

function readableValue(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (Array.isArray(value)) return value.map(readableValue).filter((s) => s !== "").join("; ")
    if (typeof value === "object") {
        const o = value as Record<string, unknown>
        return o.lat !== undefined && o.lng !== undefined ? `${o.lat}, ${o.lng}` : JSON.stringify(o)
    }
    return String(value)
}

export interface ReportHistoryRow {
    key: string
    field: string
    status: ReportHistoryStatus | null
    /** The loaded dispatch (and plot) the entry names, e.g. "DISP-28446 / DEPL-701"; null when it names none loaded. */
    target: string | null
    oldValue: string
    newValue: string
    reason: string
    reportedBy: string
    surveyorName: string
    createdAt: number | null
}

/** Dialog rows: every distinct entry in the API's order (nothing filtered by field, dispatch or status). */
export function toReportHistoryRows(entries: ReportHistoryEntry[], dispatches: TrailerDispatchItem[]): ReportHistoryRow[] {
    return distinctHistoryEntries(entries).map((entry, i) => {
        const located = locateReportEntry(entry, dispatches)
        return {
            key: `${entry.id ?? "entry"}:${i}`,
            field: reportedFieldLabel(entry),
            status: entry.status,
            target: located ? [dispatchLabel(located.dispatch), located.plot ? plotLabel(located.plot) : null].filter(Boolean).join(" / ") : null,
            oldValue: formatHistoryValue(entry.old_value),
            newValue: formatHistoryValue(entry.new_value),
            reason: entry.reason,
            reportedBy: entry.reported_by_name || "Verifier",
            surveyorName: entry.surveyor_name,
            createdAt: entry.created_at,
        }
    })
}
