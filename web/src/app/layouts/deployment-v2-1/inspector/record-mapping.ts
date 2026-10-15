// V2.1: DESIGN-TIME — how the Deployment API row (one dispatch) became the table row (dispatch-columns.tsx) and the
// tab counts (toToolbarCounts), field by field, for the Data / API Inspector. Mirrors the code; it doesn't change it.
import type { FieldMapping } from "@/components/data-inspector/api-trace"
import type { DeploymentStatusCounts, DeploymentV2Record } from "../data/schema"
import { getDeploymentRowKey, parseEpochMs } from "../data/adapter"

const empty = (v: unknown) => v === null || v === undefined || v === ""

/** A plain value straight from the API, or the default the UI shows instead. */
function plain(ui: string, source: string, raw: unknown, shown: unknown, defaultNote?: string): FieldMapping {
    if (empty(raw)) return { ui, source, raw, shown, kind: empty(shown) ? "missing" : "defaulted", note: defaultNote }
    return { ui, source, raw, shown, kind: "direct" }
}

/** A numeric API value (number or digit string) as a number; else null. */
const numeric = (v: unknown): number | null =>
    typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : null

/** A numeric cell: the API value, shown rounded to 2 decimals; "-" when it isn't a number. */
function numberCell(ui: string, source: string, raw: unknown, note: string): FieldMapping {
    const n = numeric(raw)
    return n === null
        ? { ui, source, raw, shown: undefined, kind: "missing", note: `${note} Not a number: the cell shows "-".` }
        : { ui, source, raw, shown: Math.round(n * 100) / 100, kind: typeof raw === "number" ? "direct" : "derived", note: typeof raw === "number" ? note : `${note} Digit string → number.` }
}

/**
 * V2.1 (live API audit, 2026-10-11): the selected table row IS one getDeploymentMetadata row = one dispatch; every
 * cell but Boundaries is read from it (components/dispatch-columns.tsx).
 */
export function describeRecordMapping(record: DeploymentV2Record): FieldMapping[] {
    const row = record.api
    const created = parseEpochMs(row.created_at)
    const verifiedAt = parseEpochMs(row.verified_at)
    const flagged = row.action_required === true
    return [
        { ui: "Row identity", source: "dispatch_id", raw: row.dispatch_id ?? null, shown: row.dispatch_id ?? null, kind: row.dispatch_id === null || row.dispatch_id === undefined ? "missing" : "direct", note: `One row = one dispatch; pages are deduplicated by it. Its deployment group (detail reads): ${getDeploymentRowKey(row)} (farmer · round · AZ).` },
        created === null
            ? { ui: "Submitted on", source: "created_at", raw: row.created_at, shown: undefined, kind: "missing", note: "Not epoch ms: the cell shows \"-\"." }
            : { ui: "Submitted on", source: "created_at", raw: row.created_at, shown: record.submittedOn, kind: "derived", note: "Epoch ms (number or digit string) → date." },
        row.dispatch_id === null || row.dispatch_id === undefined
            ? { ui: "Dispatch ID", source: "dispatch_id", raw: null, shown: undefined, kind: "missing", note: "No dispatch id: the row can't be opened or deduplicated." }
            : { ui: "Dispatch ID", source: "dispatch_id", raw: row.dispatch_id, shown: `DISP-${row.dispatch_id}`, kind: "derived", note: "Shown as DISP-n." },
        plain("Farmer", "farmer_name", row.farmer_name, record.farmer.name, "null → \"\" (shared cells call string methods on it)."),
        { ui: "Farmer id", source: "farmer_id", raw: row.farmer_id, shown: record.farmer.id, kind: typeof row.farmer_id === "string" ? "direct" : "derived", note: typeof row.farmer_id === "string" ? undefined : "Number → string." },
        plain("Farmer picture", "farmer_picture", row.farmer_picture, record.farmer.avatar),
        empty(row.phone_no) ? plain("Farmer phone", "phone_no", row.phone_no, record.farmer.phoneNumber) : { ui: "Farmer phone", source: "phone_no", raw: row.phone_no, shown: record.farmer.phoneNumber, kind: record.farmer.phoneNumber === row.phone_no ? "direct" : "derived", note: "10 digits → \"+91 xxxxx xxxxx\"." },
        plain("Village", "village_name", row.village_name, record.village),
        numberCell("Plots", "plots", row.plots, "The dispatch's plot count."),
        numberCell("Area", "actual_area", row.actual_area, "The deployment's ENROLLED area (Deployment V2's Area): the API sends the same value on every dispatch of the farmer · round · AZ."),
        numberCell("Cal. Area", "calculated_area", row.calculated_area, "The dispatch's calculated area (on live data the sum of its plots' area)."),
        { ui: "AZ", source: "az_id", raw: row.az_id, shown: record.azs, kind: "renamed", note: "Shown with the AZ code / name columns." },
        plain("AZ name", "az_name", row.az_name, record.azName),
        numberCell("Deployed", "deployed_amount", row.deployed_amount, "The dispatch's deployed amount."),
        { ui: "Status", source: "franchise_status", raw: row.franchise_status, shown: row.franchise_status ?? "No status sent", kind: "renamed", note: `The dispatch's own status, relabelled (approved → Verified · pending → Pending · rejected → Need Correction). The list's status filter value is "${row.status}" (need_correction = rejected). Never derived.` },
        flagged
            ? { ui: "Validation", source: "action_required · err_msg", raw: [row.action_required, row.err_msg], shown: `marker (${(row.err_msg ?? []).length} message${(row.err_msg ?? []).length === 1 ? "" : "s"})`, kind: "derived", note: "This dispatch is flagged: a marker beside its status; the messages on its card. Never a status." }
            : { ui: "Validation", source: "action_required · err_msg", raw: [row.action_required, row.err_msg], shown: undefined, kind: row.action_required === null ? "missing" : "direct", note: row.action_required === null ? "Not sent: nothing is shown (not read as \"valid\")." : "Not flagged: nothing is shown." },
        plain("Surveyor", "surveyor_name", row.surveyor_name, record.surveyor.name, "null → \"\"."),
        plain("Surveyor id", "surveyor_registred_no", row.surveyor_registred_no, record.surveyor.id, "null → \"\"."),
        row.verified_by
            ? { ui: "Verified By", source: "verified_by · franchise_verifier_id", raw: [row.verified_by, row.franchise_verifier_id], shown: row.verified_by, kind: "direct", note: "The dispatch's verifier; the phone in the hover card." }
            : { ui: "Verified By", source: "verified_by", raw: row.verified_by, shown: undefined, kind: "missing", note: "None sent (a pending dispatch): the cell shows \"-\"." },
        verifiedAt === null
            ? { ui: "Verified On", source: "verified_at", raw: row.verified_at, shown: undefined, kind: "missing", note: "No epoch-ms verified_at (a pending dispatch): the cell shows \"-\" (no fallback to the Submitted on date). Hidden on the Pending / Need Correction tabs." }
            : { ui: "Verified On", source: "verified_at", raw: row.verified_at, shown: new Date(verifiedAt), kind: "derived", note: "The dispatch's own decision time, epoch ms → date. Hidden on the Pending / Need Correction tabs." },
    ]
}

export function describeCountsMapping(counts: DeploymentStatusCounts | null): FieldMapping[] {
    const c = counts ?? ({} as Partial<DeploymentStatusCounts>)
    return [
        { ui: "All tab", source: "all", raw: c.all, shown: c.all, kind: c.all === undefined ? "missing" : "direct" },
        { ui: "Verified tab", source: "approved", raw: c.approved, shown: c.approved, kind: c.approved === undefined ? "missing" : "renamed" },
        { ui: "Pending tab", source: "pending", raw: c.pending, shown: c.pending, kind: c.pending === undefined ? "missing" : "direct" },
        { ui: "Need Correction tab", source: "need_correction", raw: c.need_correction, shown: c.need_correction, kind: c.need_correction === undefined ? "missing" : "renamed", note: "The UI's \"invalid\" count. Every count is of DISPATCHES for the active filters (without the tab's status); a count that isn't a number is shown as \"—\"." },
    ]
}
