// PORT-BOUND — V2.1: the dispatch-level table rows and the detail's dispatch groups.
//
// Live API audit (verified 2026-10-11): getDeploymentMetadata returns ONE ROW PER DISPATCH. Its `status` filter and
// getDeploymentStatusCounts work per dispatch (need_correction = franchise_status rejected). So a table row IS a list
// row: the server filters, pages, sorts and counts the dispatches; nothing here expands, filters or counts them. (The
// earlier client-side expansion — read every row's dispatches, filter by status in the browser, count "n+" — assumed
// a farmer + deployment_num + az_id row grain and is gone.)
//
// The detail still works per GROUP (farmer + deployment_num + az_id): its dispatch read (getTrailerDetails), NOC and
// history are per group. groupDispatchRows() turns a farmer's dispatch rows into those groups. Pure functions; nothing
// here invents a dispatch, a status or a count.
import { getDeploymentRowKey } from "./adapter"
import type { DeploymentMetadataRow, DeploymentV2Record, DispatchStatus } from "./schema"

const DISPATCH_STATUSES: readonly DispatchStatus[] = ["pending", "approved", "rejected"]

/** The dispatch's own status as its list row sends it (`franchise_status`); null when absent or not a known value. */
export function listDispatchStatus(row: Pick<DeploymentMetadataRow, "franchise_status">): DispatchStatus | null {
    const s = typeof row.franchise_status === "string" ? row.franchise_status.trim().toLowerCase() : ""
    return (DISPATCH_STATUSES as readonly string[]).includes(s) ? (s as DispatchStatus) : null
}

/**
 * A table row's identity: its dispatch id. A response row without one gets a positional key — it is shown (never
 * dropped or merged into another dispatch), but it can't be deduplicated across pages or selected.
 */
export const dispatchRowKey = (record: Pick<DeploymentV2Record, "id" | "api">) =>
    record.api.dispatch_id !== null && record.api.dispatch_id !== undefined ? `dispatch:${record.api.dispatch_id}` : `row:${record.id}`

/** A dispatch's system validation, as the API sends it for THAT dispatch. `required` null = not sent (unknown). */
export interface DispatchValidation {
    required: boolean | null
    messages: string[]
}

export const validationOf = (source: { action_required: boolean | null; err_msg: string[] | null }): DispatchValidation => ({
    required: source.action_required,
    messages: (source.err_msg ?? []).map((m) => m.trim()).filter(Boolean),
})

/** A numeric API value (a number, or a digit string such as "5.00" — the dev API sends both) → number; anything else → null. */
export function apiNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value.trim())
    return null
}

/** A quantity as the table shows it: rounded to 2 decimals (acres for areas, the type's unit for Deployed); null → "-". */
export const shownQuantity = (value: unknown): number | null => {
    const n = apiNumber(value)
    return n === null ? null : Math.round(n * 100) / 100
}

/**
 * The quantity cells of one dispatch row (Deployment V2's meanings):
 *   Area      actual_area      — the ENROLLED area of the deployment (farmer · round · AZ); the API repeats it on every
 *                                dispatch of the deployment (live: identical within 60 of 60 groups)
 *   Cal. Area calculated_area  — THIS dispatch's calculated area (live: Σ of its plots' area; differs between dispatches)
 *   Plots     plots            — this dispatch's plots
 *   Deployed  deployed_amount  — this dispatch's amount
 * Never derived from another field: a value that isn't a number is null (shown "-"); a 0 the API sends stays 0.
 */
export function dispatchQuantities(row: Pick<DeploymentMetadataRow, "plots" | "actual_area" | "calculated_area" | "deployed_amount">) {
    return {
        plots: shownQuantity(row.plots),
        area: shownQuantity(row.actual_area),
        calArea: shownQuantity(row.calculated_area),
        deployed: shownQuantity(row.deployed_amount),
    }
}

/** A table row: one dispatch (= one list row). */
export interface DispatchDisplayRow {
    /** Row identity (dispatchRowKey). */
    id: string
    /** The dispatch's group (farmer + deployment_num + az_id) — what its detail reads are keyed by. */
    rowKey: string
    record: DeploymentV2Record
    /** The dispatch id as a string; null when the row carries none. */
    dispatchId: string | null
    /** The dispatch's own status (franchise_status); null when not sent. */
    franchiseStatus: DispatchStatus | null
    validation: DispatchValidation
}

export function toDispatchRows(records: DeploymentV2Record[]): DispatchDisplayRow[] {
    return records.map((record) => ({
        id: dispatchRowKey(record),
        rowKey: getDeploymentRowKey(record.api),
        record,
        dispatchId: record.api.dispatch_id !== null && record.api.dispatch_id !== undefined ? String(record.api.dispatch_id) : null,
        franchiseStatus: listDispatchStatus(record.api),
        validation: validationOf(record.api),
    }))
}

/** What the table region reports about the loaded rows (data attributes; the Inspector explains the grain). */
export interface DispatchRowsSummary {
    /** Dispatch rows loaded so far (all pages). */
    dispatchRows: number
    /** The server's total for the active tab and filters (pagination.total). */
    total: number
    /** Loaded rows without a dispatch id (shown, not deduplicable). */
    withoutId: number
    /** Loaded rows the API flags with action_required. */
    flagged: number
}

export function summarizeDispatchRows(rows: DispatchDisplayRow[], total: number): DispatchRowsSummary {
    return {
        dispatchRows: rows.length,
        total,
        withoutId: rows.filter((r) => r.dispatchId === null).length,
        flagged: rows.filter((r) => r.validation.required === true).length,
    }
}

/** The distinct farmers of the loaded rows, in list order (Previous / Next in the detail moves between farmers). */
export function farmerOrder(rows: DispatchDisplayRow[]): { farmerId: string; row: DeploymentMetadataRow }[] {
    const out: { farmerId: string; row: DeploymentMetadataRow }[] = []
    const seen = new Set<string>()
    for (const r of rows) {
        const farmerId = String(r.record.api.farmer_id)
        if (seen.has(farmerId)) continue
        seen.add(farmerId)
        out.push({ farmerId, row: r.record.api })
    }
    return out
}

// ── The detail's groups (farmer + deployment_num + az_id) ───────────────────────────────────────────────────────

/** One deployment group of a farmer, built from its dispatch rows. */
export interface DispatchGroup {
    key: string
    /**
     * The group as one row, for group-level fields only (farmer, village, AZ, deployment_num, actual_area — the enrolled
     * area) and request building: the group's earliest dispatch row, with `trailers_deployed` = how many dispatch rows
     * the list holds for the group and `franchise_statuses` = their statuses (the list's own rows, counted — not a
     * status). Its per-dispatch fields (status, verified_at, action_required, …) describe that one dispatch only and are
     * not read as the group's.
     */
    row: DeploymentMetadataRow
    /** The group's dispatch rows (one per dispatch id). */
    rows: DeploymentMetadataRow[]
}

const createdMs = (row: DeploymentMetadataRow) => {
    const n = typeof row.created_at === "number" ? row.created_at : Number(row.created_at)
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

/** A farmer's dispatch rows → its groups, in first-seen order; a dispatch id seen twice is kept once. */
export function groupDispatchRows(rows: DeploymentMetadataRow[]): DispatchGroup[] {
    const byKey = new Map<string, DeploymentMetadataRow[]>()
    const seenDispatch = new Set<string>()
    for (const row of rows) {
        if (row.dispatch_id !== null && row.dispatch_id !== undefined) {
            const id = String(row.dispatch_id)
            if (seenDispatch.has(id)) continue
            seenDispatch.add(id)
        }
        const key = getDeploymentRowKey(row)
        const list = byKey.get(key)
        if (list) list.push(row)
        else byKey.set(key, [row])
    }
    return [...byKey].map(([key, list]) => {
        const earliest = list.reduce((a, b) => (createdMs(b) < createdMs(a) ? b : a))
        const statuses = [...new Set(list.map(listDispatchStatus).filter((s): s is DispatchStatus => s !== null))].sort()
        return { key, rows: list, row: { ...earliest, trailers_deployed: list.length, franchise_statuses: statuses } }
    })
}

/**
 * Whether every dispatch of a group is approved — the established "Verified deployment" rule at dispatch grain (the
 * row status it replaces was approved exactly when all its dispatches were). From the group's dispatch read when it
 * has loaded (it follows mutations first), else from its list rows. Unknown (nothing known) is false: not read-only.
 */
export function groupAllApproved(listRows: DeploymentMetadataRow[], readDispatches: { franchise_status: DispatchStatus | null }[] | null): boolean {
    if (readDispatches && readDispatches.length > 0) return readDispatches.every((d) => d.franchise_status === "approved")
    return listRows.length > 0 && listRows.every((r) => listDispatchStatus(r) === "approved")
}
