// PROTOTYPE-ONLY — initial data for the V2 mock backend (mock-backend.ts), derived deterministically from a
// metadata row so totals agree (Σ dispatch tons = num_tons, Σ plots = plots). Kept separate from the v4
// metadata mock on purpose:
//   metadata (v4)                → mock-data.ts
//   getTrailerDetails (v3)        → dispatches + plots
//   getDeploymentNocDetails      → NOC per AZ + pre-sampling summary
//   getFarmerReportedHistory     → earlier reports
// Plot locations reuse the existing demo map's plots (MOCK_FARMERS[0], which the V2 map shows), so a
// location card points at a plot that exists on the map. No new coordinates are invented.
import { MOCK_FARMERS } from "@/data/mockData"
import type { DeploymentMetadataRow, ReportHistoryEntry, TrailerDeploymentPlot, TrailerDispatchItem } from "./schema"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const SOURCES = ["Bargi Warehouse", "Kundam Rock Yard", "Shahpura Depot"]
const CLUSTERS = ["Cluster 1", "Cluster 2"]
const PICTURES = ["/basaltrocky_d.webp", "/Farm Satellite View.png", "/ricebag.png"]
const SAMPLE_VIDEO = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
const NOC_DOCUMENT = "/file.svg"
const PLOT_COMMENTS = ["Plot boundary confirmed with the farmer on site.", "Rock dust spread evenly; some residue near the bund."]
/** Farmers without an uploaded NOC (shows Matic's "No Noc found for this deployment" gate). */
const FARMERS_WITHOUT_NOC = new Set([1008])

const MAP_PLOTS = MOCK_FARMERS[0]?.plots ?? []

/** Split `total` into `parts` values (2 decimals) that add up to `total`. */
function split(total: number, parts: number): number[] {
    const base = Math.floor((total / parts) * 100) / 100
    const values = Array.from({ length: parts }, () => base)
    values[parts - 1] = Math.round((total - base * (parts - 1)) * 100) / 100
    return values
}

/**
 * A plot's repeater_form_index: 1-based within its dispatch, as on dev (each dispatch restarts at 1). Two fixtures
 * use other dev shapes: a dispatch listing its plots [2, 1], and one indexed [1, 3] (a gap) — an index is never the
 * card's position.
 */
function plotIndex(rowIndex: number, d: number, p: number, count: number): number {
    if (rowIndex === 3 && d === 2) return count - p
    if (rowIndex === 30 && d === 1) return p === 0 ? 1 : p + 2
    return p + 1
}

export interface InitialDeploymentDetail {
    dispatches: TrailerDispatchItem[]
    /** NOC for this row's AZ (the NOC response groups these per farmer + deployment). */
    noc: { noc: string; az_id: number; franchise_status: string } | null
    preSampling: { total_sample_codes: number; status: string[] }
}

export function buildInitialDeploymentDetail(row: DeploymentMetadataRow, rowIndex: number): InitialDeploymentDetail {
    const messages = row.err_msg ?? []
    const videoMissing = messages.includes("Video is missing.")
    const pictureMissing = messages.includes("Deployment picture is missing.")
    const trailerMissing = messages.includes("Trailer details are missing.")

    // One dispatch per trailer at least, never more dispatches than plots.
    const dispatchCount = Math.max(1, Math.min(row.plots, Math.max(row.trailers_deployed ?? 0, Math.min(4, Math.ceil(row.num_tons / 4)))))
    const tonsPerDispatch = split(row.num_tons, dispatchCount)
    const plotCounts = Array.from({ length: dispatchCount }, (_, i) =>
        Math.floor(row.plots / dispatchCount) + (i < row.plots % dispatchCount ? 1 : 0))
    const trailerNos = Array.from({ length: row.trailers_deployed ?? 0 }, (_, t) =>
        `MP 22 ${String.fromCharCode(65 + ((row.farmer_id + t) % 26))}B ${4100 + ((row.farmer_id * 7 + t * 13) % 900)}`)

    let plotSeq = 0
    const dispatches: TrailerDispatchItem[] = tonsPerDispatch.map((tons, d) => {
        const dispatchId = row.farmer_id * 1000 + row.deployment_num * 100 + row.az_id * 10 + d
        const areas = split(row.actual_area / dispatchCount, plotCounts[d])
        const amounts = split(row.deployed_amount / dispatchCount, plotCounts[d])
        return {
            az_code: row.az_code,
            az_id: row.az_id,
            date: Number(row.epoch_date) + d * 3 * HOUR,
            date_raw: Number(row.epoch_date) + d * 3 * HOUR,
            deployment_detail_id: `DD-${dispatchId}`,
            deployment_verifier_name: row.verified_by,
            deployment_verifier_id: row.franchise_verifier_id,
            dispatch_id: dispatchId,
            num_tons: tons,
            source_name: SOURCES[(row.farmer_id + d) % SOURCES.length],
            surveyor_name: row.surveyor_name ?? "",
            surveyor_registred_no: row.surveyor_registred_no ?? "",
            trailer_no: trailerMissing && d === 0 ? "" : trailerNos[d % trailerNos.length],
            video: videoMissing && d === 0 ? null : SAMPLE_VIDEO,
            village_name: row.village_name,
            cluster_name: CLUSTERS[(row.village_id + d) % CLUSTERS.length],
            repeater_form_index: d + 1,
            // The store sets the dispatch's status when it answers (mock-backend.ts); AZ 4 / 5 fields stay empty (AZ 1–3 mock).
            franchise_status: null,
            franchise_verifier_id: null,
            batch_id: null,
            field_condition: null,
            crop_stage: null,
            num_plots_unload: null,
            // V2.1: set per dispatch by the store when it answers (mock-backend.ts toResponseItem), as live sends them.
            action_required: null,
            err_msg: null,
            verified_at: null,
            verified_by: null,
            deployment_plots_data: Array.from({ length: plotCounts[d] }, (_, p) => {
                const mapPlot = MAP_PLOTS.length > 0 ? MAP_PLOTS[plotSeq % MAP_PLOTS.length] : null
                plotSeq += 1
                return {
                    amt_plot_deploy: amounts[p],
                    area: areas[p],
                    comment: rowIndex % 3 === 0 && d === 0 && p === 0 ? PLOT_COMMENTS[rowIndex % PLOT_COMMENTS.length] : null,
                    deployment_id: dispatchId * 100 + p,
                    dispatch_id: dispatchId,
                    farmer_id: row.farmer_id,
                    geometry: null,
                    location: mapPlot ? { ...mapPlot.location } : null,
                    picture_deployment: pictureMissing && p === 0 ? null : PICTURES[(plotSeq + d) % PICTURES.length],
                    plot_id: `P${row.farmer_id % 1000}-${String(plotSeq).padStart(2, "0")}`,
                    repeater_form_id: `RF-${dispatchId}`,
                    repeater_form_index: plotIndex(rowIndex, d, p, plotCounts[d]),
                    is_location_reported: false,
                    is_deployment_reported: false,
                    verbal_plot_area_enrolled: null,
                    boost_amount_plot_applied: null,
                    source_name: null,
                }
            }),
        }
    })

    // NOC per AZ: approved deployments have an approved NOC; half of the pending farmers too (so both the
    // approvable and the NOC-blocked Pending cases exist); need-correction deployments are still pending.
    const nocStatus =
        row.status === "approved" ? "approved"
        : row.status === "pending" && row.farmer_id % 2 === 0 ? "approved"
        : "pending"

    return {
        dispatches,
        noc: FARMERS_WITHOUT_NOC.has(row.farmer_id) ? null : { noc: NOC_DOCUMENT, az_id: row.az_id, franchise_status: nocStatus },
        preSampling: { total_sample_codes: row.plots % 4, status: [row.status === "approved" ? "approved" : "pending"] },
    }
}

/** One fixture report: its dispatch (index in the row, or one that no longer exists), field, plot and state. */
interface HistoryFixture {
    d: number | "missing"
    field: string
    /** The plot's repeater_form_index (null / absent: none, as dev stores Source Name and index-less plots). */
    entryNo?: number | null
    /** A new value was submitted (status "completed"); otherwise the report is "ongoing". */
    completed?: boolean
    /** The API returned this entry twice (an identical row, seen on dev). */
    twice?: boolean
}

/**
 * Earlier submitted reports, keyed by row index, shaped like getFarmerReportedHistory on dev
 * (docs/deployment/deployment-v2-reported-field-mapping-investigation.md): one entry per reported field;
 * repeater_form_id = the dispatch, entry_no = the plot's 1-based repeater_form_index (null for Source Name),
 * defect_type "Source Name" / "Mati Deployed" / "Location". History is independent of dispatch status: it names pending,
 * verified and rejected dispatches, and a rejected dispatch can have none (row 14).
 */
const HISTORY_FIXTURES: Record<number, HistoryFixture[]> = {
    // Pending, two trailers: an earlier, corrected Source Name report and an ongoing Location report on the other trailer.
    1: [{ d: 0, field: "Source Name", completed: true }, { d: 1, field: "Location", entryNo: 3 }],
    // Verified, with history (it persists after verification); one row is returned twice.
    2: [{ d: 1, field: "Mati Deployed", entryNo: 1, completed: true }, { d: 1, field: "Location", entryNo: 1, completed: true, twice: true }],
    // Need Correction, five dispatches on five trailers, all pending (the dev 1746439333379-1-1 pattern): reports on the
    // 2nd, 3rd and 5th dispatch only. Two plots of one dispatch, a re-reported plot with two fields, plots listed [2, 1],
    // and one entry for a dispatch that no longer exists.
    3: [
        { d: 1, field: "Location", entryNo: 1, completed: true },
        { d: 1, field: "Location", entryNo: 1 },
        { d: 1, field: "Mati Deployed", entryNo: 1, completed: true },
        { d: 1, field: "Location", entryNo: 2, completed: true },
        { d: 2, field: "Mati Deployed", entryNo: 1 },
        { d: 4, field: "Source Name", completed: true },
        { d: 4, field: "Mati Deployed", entryNo: 1, completed: true },
        { d: "missing", field: "Source Name" },
    ],
    5: [{ d: 0, field: "Source Name", completed: true }],
    // Need Correction: the rejected dispatch's report, a Location report without entry_no (its plot can't be
    // identified), and a label with no established field ("Picture") on plot 2.
    8: [{ d: 2, field: "Source Name" }, { d: 0, field: "Location", entryNo: null }, { d: 1, field: "Picture", entryNo: 2 }],
    13: [{ d: 0, field: "Source Name", completed: true }],
    17: [{ d: 0, field: "Source Name", completed: true }],
    // Pending row whose dispatches are all rejected: two of the four have history (the other two are rejected without).
    21: [{ d: 0, field: "Source Name", completed: true }, { d: 0, field: "Source Name" }, { d: 1, field: "Mati Deployed", entryNo: 1 }],
    // Pending, four trailers — the whole picture (mock-backend.ts MIXED_PENDING_ROW): d0 verified, d1 an earlier
    // corrected amount (still Pending), d2 reported and rejected (Need Correction), d3 untouched (Pending).
    27: [{ d: 1, field: "Mati Deployed", entryNo: 1, completed: true }, { d: 2, field: "Source Name" }],
    // Need Correction — the whole picture (mock-backend.ts MIXED_NC_ROW): d0 verified; d1 plots indexed [1, 3] and an
    // ongoing Location report (report + validation); d2 the row's validation only; d3 the rejected dispatch's report.
    30: [{ d: 1, field: "Location", entryNo: 3 }, { d: 3, field: "Source Name" }],
}

const REPORT_REASONS: Record<string, string> = {
    "Source Name": "Source name did not match the dispatch record.",
    "Mati Deployed": "Amount deployed differs from the dispatch slip.",
    "Location": "Plot location does not match the farm boundary.",
}

const locationText = (location: { lat: number; lng: number } | null | undefined) => (location ? JSON.stringify(location) : "")

/** The fixture field's value now (on the dispatch / plot) and the different value it had when it was reported. */
function fixtureValues(field: string, dispatch: TrailerDispatchItem | null, plot: TrailerDeploymentPlot | null): { now: string; before: string } {
    if (field === "Source Name") {
        const now = dispatch?.source_name ?? SOURCES[0]
        return { now, before: SOURCES.find((s) => s !== now) ?? now }
    }
    if (field === "Mati Deployed") {
        const amount = plot?.amt_plot_deploy ?? 0
        return { now: String(amount), before: String(Math.round((amount + 0.5) * 100) / 100) }
    }
    if (field === "Location") {
        const other = MAP_PLOTS.find((p) => locationText(p.location) !== locationText(plot?.location))?.location
        return { now: locationText(plot?.location), before: locationText(other) }
    }
    return { now: plot?.picture_deployment ?? "", before: "" }
}

/** The row's earlier report history (HISTORY_FIXTURES), with deterministic ids (row index × 100 + n). */
export function buildInitialReportHistory(row: DeploymentMetadataRow, rowIndex: number, dispatches: TrailerDispatchItem[]): ReportHistoryEntry[] {
    const entries: ReportHistoryEntry[] = []
    for (const [k, fx] of (HISTORY_FIXTURES[rowIndex] ?? []).entries()) {
        const dispatch = fx.d === "missing" ? null : dispatches[fx.d] ?? null
        if (fx.d !== "missing" && !dispatch) continue
        const entryNo = fx.entryNo ?? null
        const plot = dispatch && entryNo !== null ? dispatch.deployment_plots_data.find((p) => p.repeater_form_index === entryNo) ?? null : null
        const { now, before } = fixtureValues(fx.field, dispatch, plot)
        const createdAt = Number(row.created_at) + (fx.completed ? -3 * DAY : DAY) + k * HOUR
        const entry: ReportHistoryEntry = {
            id: rowIndex * 100 + k + 1,
            // A dispatch that no longer exists: an id no generated dispatch has (a row has at most 5 dispatches).
            repeater_form_id: dispatch ? dispatch.deployment_detail_id : `DD-${row.farmer_id * 1000 + row.deployment_num * 100 + row.az_id * 10 + 9}`,
            entry_no: entryNo,
            defect_type: fx.field,
            status: fx.completed ? "completed" : "ongoing",
            az_id: row.az_id,
            reason: REPORT_REASONS[fx.field] ?? "Picture does not show the deployment.",
            comment: null,
            surveyor_name: row.surveyor_name ?? "",
            old_value: fx.completed ? before : now,
            new_value: fx.completed ? now : "",
            created_at: createdAt,
            reported_by_name: k % 2 === 0 ? "Verifier B" : "Verifier A",
            form_name: "Deployment",
            farmer_name: row.farmer_name ?? "",
            farmer_id: String(row.farmer_id),
            updated_at: fx.completed ? createdAt + DAY : createdAt,
        }
        entries.push(entry)
        if (fx.twice) entries.push({ ...entry })
    }
    return entries
}
