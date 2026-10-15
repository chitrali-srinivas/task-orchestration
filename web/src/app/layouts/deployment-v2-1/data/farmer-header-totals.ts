// Deployment V2.1 — the farmer detail header's "N Plots · X Acres": the farmer's unique plots, and their total Cal. Area.
//
// Cal. Area is the table's Cal. Area column: the list row's `calculated_area`, read and rounded as the table reads it
// (dispatch-rows.ts dispatchQuantities). The API sends it per DISPATCH only — no plot carries one (live audit: absent
// on all 2,788 plots read), and on live data a dispatch's value is the sum of its plot deployments' areas. So the
// unique plots' total is the sum of their dispatches' Cal. Area, each dispatch once, and it can be stated only when
//   - every dispatch holding the farmer's plots has exactly one valid Cal. Area across its list records (no record →
//     not recorded; not a number or below 0 → invalid; records that disagree → conflicting; 0 → not confirmed, as the
//     API contract doesn't say 0 is a recorded area), and
//   - every plot is on one deployment record only: a plot recorded on several deployments is inside several of those
//     sums, and its share of a dispatch's value is unknown, so a total would count it more than once.
// Otherwise the area is unstated, with every reason. A plot's own `area` and its boundary geometry are not used.
import { apiNumber, shownQuantity } from "./dispatch-rows"
import type { DeploymentMetadataRow, TrailerDispatchItem } from "./schema"

export interface FarmerHeaderTotals {
    /** Unique plots across all of the farmer's dispatches (by `plot_id`; the deployment's id when a plot has none). */
    plots: number
    /** Σ Cal. Area of the unique plots, acres, 2 decimals (as the table shows it); null when it can't be stated. */
    area: number | null
    /** Why the area isn't stated (in the header's hover text); empty when it is. */
    reasons: string[]
}

type CalAreaRecord = { kind: "value"; value: number } | { kind: "missing" } | { kind: "invalid" } | { kind: "zero" }

/** One list record's Cal. Area, as the table reads it. */
function calAreaOf(row: Pick<DeploymentMetadataRow, "calculated_area">): CalAreaRecord {
    const raw: unknown = row.calculated_area
    if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return { kind: "missing" }
    const n = apiNumber(raw)
    if (n === null || n < 0) return { kind: "invalid" }
    const shown = shownQuantity(n)
    return shown === 0 ? { kind: "zero" } : { kind: "value", value: shown ?? n }
}

const plotKey = (plot: { plot_id: string; deployment_id: number }) =>
    plot.plot_id?.trim() ? `plot:${plot.plot_id.trim()}` : `deployment:${plot.deployment_id}`

const ofDispatches = (n: number, of: number) => `${n} of ${of} ${of === 1 ? "dispatch" : "dispatches"}`

/**
 * `dispatches`: the farmer's dispatch reads (plots per dispatch). `listRows`: the farmer's list rows as the API sent
 * them (one per dispatch; a dispatch sent twice stays twice, so disagreeing records can be seen).
 */
export function farmerHeaderTotals(dispatches: readonly TrailerDispatchItem[], listRows: readonly DeploymentMetadataRow[]): FarmerHeaderTotals {
    // the plots: each plot once, with the deployment records it is on (a dispatch read twice counts once)
    const deploymentsByPlot = new Map<string, Set<number>>()
    const holding = new Set<string>()
    const seenDispatch = new Set<string>()
    for (const dispatch of dispatches) {
        if (seenDispatch.has(dispatch.deployment_detail_id)) continue
        seenDispatch.add(dispatch.deployment_detail_id)
        for (const plot of dispatch.deployment_plots_data) {
            const key = plotKey(plot)
            const records = deploymentsByPlot.get(key) ?? new Set<number>()
            records.add(plot.deployment_id)
            deploymentsByPlot.set(key, records)
            holding.add(String(dispatch.dispatch_id))
        }
    }
    const plots = deploymentsByPlot.size

    // each dispatch holding a plot: its Cal. Area records from the list
    const recordsByDispatch = new Map<string, CalAreaRecord[]>()
    for (const row of listRows) {
        if (row.dispatch_id === null || row.dispatch_id === undefined) continue
        const id = String(row.dispatch_id)
        if (!holding.has(id)) continue
        recordsByDispatch.set(id, [...(recordsByDispatch.get(id) ?? []), calAreaOf(row)])
    }
    let missing = 0, invalid = 0, zero = 0, conflicting = 0, total = 0
    for (const id of holding) {
        const records = recordsByDispatch.get(id) ?? []
        if (records.length === 0 || records.every((r) => r.kind === "missing")) { missing++; continue }
        if (records.some((r) => r.kind === "invalid")) { invalid++; continue }
        const kinds = new Set(records.map((r) => (r.kind === "value" ? `value:${r.value}` : r.kind)))
        if (kinds.size > 1) { conflicting++; continue }
        const only = records[0]
        if (only.kind === "zero") { zero++; continue }
        if (only.kind === "value") total += only.value
    }
    const repeated = [...deploymentsByPlot.values()].filter((records) => records.size > 1).length

    const reasons: string[] = []
    const of = holding.size
    if (of === 0) reasons.push("No plots recorded for this farmer")
    if (missing > 0) reasons.push(`Cal. Area not recorded for ${ofDispatches(missing, of)}`)
    if (invalid > 0) reasons.push(`Cal. Area isn't a valid number for ${ofDispatches(invalid, of)}`)
    if (zero > 0) reasons.push(`Cal. Area is 0 for ${ofDispatches(zero, of)} (0 isn't a confirmed area)`)
    if (conflicting > 0) reasons.push(`Cal. Area differs between records of ${ofDispatches(conflicting, of)}`)
    if (repeated > 0) reasons.push(`${repeated} of ${plots} ${plots === 1 ? "plot" : "plots"} ${repeated === 1 ? "is" : "are"} on more than one deployment record; Cal. Area is per dispatch, so ${repeated === 1 ? "its area" : "their area"} can't be counted once`)
    return { plots, area: reasons.length === 0 ? Math.round(total * 100) / 100 : null, reasons }
}
