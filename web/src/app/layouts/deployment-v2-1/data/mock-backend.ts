// PROTOTYPE-ONLY — in-memory mock of the Matic Deployment backend used by Deployment V2.
// It owns all mutation state. The UI never edits status locally: it calls an endpoint, the store changes,
// the UI refetches and renders what the store returns.
//
// Endpoints (request bodies are built by request-builders.ts exactly as matic-dash builds them):
//   getTrailerDetails                POST  /adminDeploymentSec/v3/getTrailerDetails
//   getDeploymentNocDetails          POST  /adminFarmApp/v3/getDeploymentNocDetails
//   updateDeploymentTrailerDispatch  PATCH /adminFarmApp/v3/updateDeploymentTrailerDispatch
//   reportFarmerDetails              POST  /adminDeploymentSec/v3/reportFarmerDetails
//   updateFarmerDeploymentNOC        PATCH /adminDeploymentSec/updateFarmerDeploymentNOC
//   updateComment                    PATCH /adminDeploymentSec/v3/comment
//   getFarmerReportedHistory         POST  /adminDeploymentSec/v3/getFarmerReportedHistory
//   softDeleteDispatch               PATCH /adminDeploymentSec/v3/softDeleteDispatch
//
// Every dispatch carries its own franchise_status (pending / approved / rejected), as the dev API returns it, and
// getTrailerDetails answers each status with exactly those dispatches (observed dev behavior).
// Initial dispatch states: some Pending rows have approved dispatches beside the pending ones and a Pending row can
// have no pending dispatch left (all reported) — both seen on dev — and some Need Correction rows also have a
// rejected dispatch (a report made on an Action Required deployment). The detail reads every status and shows the
// whole picture (components/deployment-dispatch-view.ts).
//
// Mock-only parts (a real backend decides these; they are simulated here so the prototype reacts):
//   - after a dispatch update the deployment row's status is recomputed with the rule observed on dev
//     (all dispatches approved → approved, else action_required → need_correction, else pending). action_required
//     is the server's validation result: a report rejects its dispatch but never sets it, as matic-dash categorises
//     rows by action_required alone (matic-dash/src/services/api.ts:2321);
//   - a soft delete hides the dispatch / plot from every read and recomputes the row's totals.
//
// Fixture rows for the detail's data states (deterministic, by row index):
//   - NO_DISPATCH_ROW: a farmer with no dispatches at all (trailers_deployed 0, franchise_statuses []);
//   - UNAVAILABLE_ROW: the row says it has pending dispatches, but every trailer read returns none
//     (the pattern seen on dev row 3386);
//   - ZERO_PLOT_ROW: its first dispatch has no plots (seen on dev AWD dispatches);
//   - MIXED_PENDING_ROW / MIXED_NC_ROW: the whole dispatch picture in one row — a verified dispatch beside a reported
//     (rejected) one, and untouched (Pending row) or validation-flagged (Need Correction row) pending ones.
// Report history (getFarmerReportedHistory) comes from trailer-details-mock.ts HISTORY_FIXTURES, shaped like dev
// entries; a report submitted here adds entries the same way. A report's dispatch update rejects the dispatch, but
// history is never derived from a dispatch's status.
//
// URL flags: ?mockPermission=view → no edit / delete permission (actions disabled);
//            ?mockPermission=nodelete → edit permission without delete;
//            ?mockFail=trailers → the first trailer read after page load fails (to exercise Retry).
import type {
    CommentRequest,
    DeploymentMetadataRow,
    DeploymentNocDetails,
    DeploymentNocDetailsRequest,
    MutationResult,
    NocDecisionRequest,
    ReportFarmerDetailsRequest,
    ReportHistoryEntry,
    ReportHistoryRequest,
    ReportHistoryResponse,
    SoftDeleteRequest,
    TrailerDetailsRequest,
    DispatchStatus,
    TrailerDispatchItem,
    UpdateDeploymentTrailerDispatchRequest,
    UploadGeoJsonRequest,
} from "./schema"
import { getDeploymentRowKey } from "./adapter"
import { apiErrorFromResponse } from "./api-client"
import { AWD_REPORT_FIELDS } from "../components/deployment-field-cards"
import { SEEDED_INVALID_OUTLINE, SEEDED_VALID_OUTLINE } from "./boundary-gate"
import { deploymentMetadataRows } from "./mock-data"
import { buildInitialDeploymentDetail, buildInitialReportHistory } from "./trailer-details-mock"

/** The signed-in mock verifier (matic-dash reads `mati_admin_phone_no` from localStorage). */
export const MOCK_ADMIN = { phone: "9800012345", name: "Admin (You)" }

const VERIFIER_NAMES: Record<string, string> = {
    [MOCK_ADMIN.phone]: MOCK_ADMIN.name,
    "9812345678": "Verifier A",
    "9811122233": "Verifier B",
    "9899988877": "Verifier C",
}

/** Mock permission model (matic-dash: verifier.farm.deployment_verification.create / .delete, + V2.1 the AWD / Mati Boost keys). */
export interface MockPermissions {
    /** `.create` — approve, report, comment, NOC decisions. */
    edit: boolean
    /** `.delete` — soft delete of a dispatch or a plot deployment (AZ 1–3). */
    delete: boolean
    /** V2.1 (M1): verifier.farm.awd_deployment_verification.create. */
    awdEdit: boolean
    /** V2.1 (M1): verifier.farm.mati_boost_deployment_verification.create. */
    matiBoostEdit: boolean
}

/** ?mockPermission=view (nothing) · nodelete · noawd (no AWD / Mati Boost keys). */
export function getMockPermissions(): MockPermissions {
    const flag = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mockPermission") : null
    return {
        edit: flag !== "view",
        delete: flag !== "view" && flag !== "nodelete",
        awdEdit: flag !== "view" && flag !== "noawd",
        matiBoostEdit: flag !== "view" && flag !== "noawd",
    }
}

interface StoredDispatch {
    item: TrailerDispatchItem
    franchiseStatus: DispatchStatus
    /** V2.1 (live API audit): THIS dispatch's system validation (the server's; a report never sets it). */
    validation: { action_required: boolean | null; err_msg: string[] | null }
    /** V2.1: when this dispatch was approved / rejected (epoch ms); null while pending. */
    verifiedAt: number | null
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const round2 = (n: number) => Math.round(n * 100) / 100
/** The verifier recorded on dispatches decided before the session (the seeded rows' verifier, else Verifier A). */
const SEEDED_VERIFIER_PHONE = "9812345678"

/**
 * V2.1: a group's seeded validation (mock-data.ts, per farmer + deployment + AZ) belongs to ONE of its dispatches —
 * the rejected one when there is one, else the LAST not approved, else the first — so sibling dispatches carry none
 * (the live API sends action_required / err_msg per dispatch, and they differ within a group). The last open one (not
 * the first) so a group's first dispatch — the one ?mockBoundaries=seed saves completely — stays approvable.
 */
function validationTarget(statuses: DispatchStatus[]): number {
    const rejected = statuses.indexOf("rejected")
    if (rejected >= 0) return rejected
    for (let i = statuses.length - 1; i >= 0; i--) if (statuses[i] !== "approved") return i
    return 0
}

const NO_DISPATCH_ROW = 29
const UNAVAILABLE_ROW = 33
const ZERO_PLOT_ROW = 3
const MIXED_PENDING_ROW = 27
const MIXED_NC_ROW = 30
let failNextTrailerRead = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "trailers"
/** ?mockFail=geometry → the first boundary save fails (to exercise the editor's error / retry path). */
let failNextGeometrySave = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "geometry"
/**
 * V2.1: ?mockFail=report-400 → the first report is rejected the way the live dev backend rejects it today (HTTP 400 while
 * creating a quality_system_defects row). SIMULATED: a synthetic body of the same shape — long PostgreSQL detail, with
 * `code` / `table` — to exercise the dialog's full error and Technical details. No column is named (the live one isn't known).
 */
let failNextReport400 = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "report-400"
const SIMULATED_REPORT_400 = {
    status: 400,
    error: {
        severity: "ERROR",
        code: "23502",
        table: "quality_system_defects",
        detail: "Failing row contains (9001, Deployment, Source Name, 1782880000000, null, Mock Farmer, null, null, null, null, null, null, Opened, null, Mock report reason long enough for the database to cut it at sixt..., 1782880000000, 1782879999969, t, MOCK VILLAGE, null, Mock Surveyor, 9300001, Admin (You), 101, 1, 1, 92000013, null, Mock Source, null, null). [simulated by the V2.1 mock backend]",
    },
}
/** V2.1: ?mockFail=farmer-rows → the first farmer-rows read fails once (the detail's error state). */
let failFarmerRows = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "farmer-rows"
/**
 * V2.1: ?mockFail=trailers-row2 → every dispatch read of the SECOND row of the All tab's first page (the served order) fails until the row's
 * reads have failed 4 times — the status-omitted read AND its three per-status fallbacks (data/dispatch-reads.ts) — so
 * the row shows as failed with Retry (a partial dispatch-level table); the Retry then succeeds. Filled in at init.
 */
const failTrailerRowReads = new Map<string, number>()
/** V2.1: ?mockFail=noc → the first NOC read fails once; ?mockFail=history → the first report-history read fails once. */
let failNextNocRead = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "noc"
let failNextHistoryRead = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "history"
/**
 * V2.1: ?mockTrailers=status-required → a backend that answers NOTHING to a getTrailerDetails without `status` (the
 * production contract always sends one): the status-omitted read returns [], so the per-status fallback
 * (data/dispatch-reads.ts) is exercised.
 */
const trailersStatusRequired = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockTrailers") === "status-required"
/** V2.1: ?mockNoc=multi → the first mock farmer's NOC read returns three photos per AZ (the NOC review's Previous / Next). */
const mockNocMulti = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockNoc") === "multi"
/**
 * V2.1: ?mockNoc=nourl → the first mock farmer's NOC read returns, per AZ, its document plus one WITHOUT an image link
 * (noc: null, as the raw API can send it) and one whose link doesn't load (a missing file) — the NOC review's no-image
 * and failed-image states. Same AZ and status as the document; nothing is invented about the image.
 */
const mockNocNoUrl = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockNoc") === "nourl"
/**
 * V2.1: ?mockValidation=oldest → only the OLDEST pending dispatches carry a validation flag (the live pattern seen on
 * 2026-10-11): the 10 earliest by Submitted on get action_required + "Video is missing.", every other dispatch none.
 */
const mockValidationOldest = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockValidation") === "oldest"
/**
 * V2.1: ?mockOrder=unsorted → the list serves its dispatch rows in a deliberately unsorted order — from both ends of the
 * store inward (1st, last, 2nd, second to last, …) — so Submitted on, Verified On and the ids run out of order on every
 * tab and across pages. The tests use it to prove the table shows the rows exactly as the API returns them.
 */
const mockOrderUnsorted = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockOrder") === "unsorted"
/**
 * V2.1: the mock server's OWN order for a list request without a sort (the table sends none by default: page.tsx).
 * By default the order the live server was seen to use (read-only, 2026-10-11): pending oldest first, the other statuses
 * newest first, by Submitted on — an observation, not a documented contract; Need Correction wasn't observed and follows
 * All. ?mockServerSort=none (or ?mockOrder=unsorted) → no own order: the rows as stored (or scrambled), nothing reported.
 * data-source.ts applies it and reports it as the PROPOSED pagination.sort_by / sort_order.
 */
const mockServerSortNone = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockServerSort") === "none"
export function mockDefaultListSort(status: string): { columnId: "submittedOn"; order: "asc" | "desc" } | null {
    if (mockServerSortNone || mockOrderUnsorted) return null
    return { columnId: "submittedOn", order: status === "pending" ? "asc" : "desc" }
}
/** The order the mock list serves `list` in: as stored, or (?mockOrder=unsorted) from both ends inward. */
function servedOrder<T>(list: T[]): T[] {
    if (!mockOrderUnsorted) return list
    const out: T[] = []
    for (let i = 0, j = list.length - 1; i <= j; i++, j--) {
        out.push(list[i])
        if (j !== i) out.push(list[j])
    }
    return out
}
/**
 * V2.1: ?mockValidation=az (with ?mockTypes=all) → the per-AZ validation pattern seen live (read-only, 2026-10-11):
 *   AZ 6 (live "Biomass pellet"): its dispatches carry no video / source / cluster (0 of 12 live reads) and the server
 *     flags every one with AZ 1's messages — the first AZ 6 dispatch gets the live set (AZ6_LIVE_MESSAGES), the second
 *     none at all (action_required / err_msg null: validation not sent);
 *   AZ 4 (live AWD): the same fields empty and never flagged (0 of 10 live rows);
 *   AZ 1: one pending dispatch with its own message, its siblings none.
 * Every other dispatch has no flag. The fixture copies what the API sent; it states no AZ's requirements.
 */
const mockValidationAz = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockValidation") === "az"
const AZ6_LIVE_MESSAGES = ["Video is missing.", "Cluster Name is missing.", "Source Name is missing.", "Amount Plot Deploy is missing."]
const OLDEST_FLAGGED = 10
/** V2.1: ?mockFail=geometry-partial → the first boundary save that carries several entries applies its FIRST entry,
 *  then fails (an outcome the client can't confirm: the detail must be read again). */
let partialGeometrySave = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "geometry-partial"
/** V2.1: ?mockFail=geometry-second → the second boundary save of the page fails once (a partial Save all). */
let geometrySavesUntilFailure = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "geometry-second" ? 2 : 0
const unavailableRowKeys = new Set<string>()

/** The row's dispatch-status set, as the API's franchise_statuses (sorted, unique). */
const statusesOf = (list: StoredDispatch[]) => [...new Set(list.map((d) => d.franchiseStatus))].sort()

const groupKey = (farmerId: string | number, deploymentNum: string | number) => `${farmerId}-${deploymentNum}`
const historyKey = (farmerId: string | number, deploymentNum: string | number, azId: string | number) => `${farmerId}-${deploymentNum}-${azId}`

/** Initial dispatch status (see header): deterministic per row, so the same cases exist on every load. */
function initialDispatchStatus(row: DeploymentMetadataRow, rowIndex: number, d: number, count: number): DispatchStatus {
    if (row.status === "approved") return "approved"
    if (row.status === "pending") {
        if (rowIndex % 11 === 10 && row.farmer_id % 2 === 0) return "rejected" // every dispatch reported: nothing left to review
        if (rowIndex === MIXED_PENDING_ROW && d === 2) return "rejected" // reported (its history: trailer-details-mock.ts)
        if (rowIndex % 4 === 3 && count > 1 && d === 0) return "approved"
        return "pending"
    }
    if (rowIndex === MIXED_NC_ROW && d === 0) return "approved"
    return rowIndex % 2 === 0 && count > 1 && d === count - 1 ? "rejected" : "pending"
}

// ── Store ────────────────────────────────────────────────────────────────────────────────────────────
let rows: DeploymentMetadataRow[] = deploymentMetadataRows.map((row) => ({ ...row }))
/**
 * V2.1: ?mockTypes=all → three extra rows for the deployment types the default mock data has none of: AWD (AZ 4), Mati
 * Boost (AZ 5) and an unconfigured AZ 6 — DERIVED from the pending row 1 (same farmer and round; only the AZ changes), to
 * exercise the per-type gates (actions, Pre-Sample). Opt-in: the default dataset stays the V2 one.
 */
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockTypes") === "all") {
    const base = rows[1]
    const extra = [
        { az_id: 4, az_code: "AZ4", az_name: "AWD" },
        { az_id: 5, az_code: "AZ5", az_name: "Mati Boost" },
        { az_id: 6, az_code: "AZ6", az_name: "Unconfigured" },
    ].map((az) => ({ ...base, ...az }))
    rows = [...rows, ...extra].map((row, _i, all) => ({ ...row, total_count: all.length }))
}
const dispatchesByRow = new Map<string, StoredDispatch[]>()
const nocByGroup = new Map<string, { noc: string; az_id: number; franchise_status: string }[]>()
const preSamplingByGroup = new Map<string, { total_sample_codes: number; status: string[] }>()
/** History per farmer + deployment + AZ (the API filters it by az_id). */
const historyByRow = new Map<string, ReportHistoryEntry[]>()

rows.forEach((row, index) => {
    const initial = buildInitialDeploymentDetail(row, index)
    if (index === NO_DISPATCH_ROW) initial.dispatches = []
    if (index === ZERO_PLOT_ROW && initial.dispatches[0]) initial.dispatches[0].deployment_plots_data = []
    const statuses = initial.dispatches.map((_, d) => initialDispatchStatus(row, index, d, initial.dispatches.length))
    const target = validationTarget(statuses)
    const stored: StoredDispatch[] = initial.dispatches.map((item, d) => {
        const franchiseStatus = statuses[d]
        const decided = franchiseStatus !== "pending"
        // A dispatch decided before the session: its verifier (the row's, else Verifier A) and decision time.
        const verifierPhone = decided ? row.franchise_verifier_id ?? SEEDED_VERIFIER_PHONE : null
        if (decided) {
            item.franchise_verifier_id = verifierPhone
            item.deployment_verifier_name = verifierPhone ? VERIFIER_NAMES[verifierPhone] ?? null : null
        }
        const verifiedAt = !decided ? null : franchiseStatus === "approved" && row.verified_at !== null ? Number(row.verified_at) : Number(row.created_at) + (2 + d) * DAY
        const validation = row.action_required === true && d === target
            ? { action_required: true, err_msg: [...(row.err_msg ?? [])] }
            : { action_required: false, err_msg: [] }
        return { item, franchiseStatus, validation, verifiedAt }
    })
    dispatchesByRow.set(getDeploymentRowKey(row), stored)
    if (index === UNAVAILABLE_ROW) unavailableRowKeys.add(getDeploymentRowKey(row))
    // The store's GROUP row (farmer + deployment + AZ) keeps its dispatch count / statuses for the mock's own rules.
    rows[index] = { ...row, trailers_deployed: stored.length, franchise_statuses: statusesOf(stored) }
    if (index === NO_DISPATCH_ROW) rows[index] = { ...rows[index], plots: 0, num_tons: 0, deployed_amount: 0 }
    const key = groupKey(row.farmer_id, row.deployment_num)
    if (initial.noc) {
        // ?mockNoc=multi: the first farmer's NOC has three PHOTOS per AZ (same AZ, same status, different images) — the
        // NOC read returns them all; a decision (keyed by farmer + deployment + AZ) applies to every photo of that AZ.
        const firstFarmer = row.farmer_id === deploymentMetadataRows[0].farmer_id
        const photos = mockNocMulti && firstFarmer
            ? [initial.noc, { ...initial.noc, noc: "/globe.svg" }, { ...initial.noc, noc: "/window.svg" }]
            : mockNocNoUrl && firstFarmer
                ? [initial.noc, { ...initial.noc, noc: null as unknown as string }, { ...initial.noc, noc: "/mock-noc-missing-file.jpg" }]
                : [initial.noc]
        nocByGroup.set(key, [...(nocByGroup.get(key) ?? []), ...photos])
    }
    if (!preSamplingByGroup.has(key)) preSamplingByGroup.set(key, initial.preSampling)
    // Earlier reports (trailer-details-mock.ts HISTORY_FIXTURES), independent of the dispatches' current statuses.
    historyByRow.set(historyKey(row.farmer_id, row.deployment_num, row.az_id), buildInitialReportHistory(row, index, initial.dispatches))
})
/** Ids for reports submitted in this session (above every fixture id). */
let nextReportEntryId = 100_000
if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    if (params.get("mockFail") === "trailers-row2") {
        // The All tab's second row in the order the mock serves it (page.tsx sends no sort): the mock server's own order
        // for All (mockDefaultListSort: newest first by Submitted on — a dispatch row's is its group's created_at + d
        // hours, as buildDispatchRows sends it), else the stored order — its deployment's reads fail.
        const dispatchRows = rows.flatMap((row) => (dispatchesByRow.get(getDeploymentRowKey(row)) ?? []).map((_, d) => ({ row, at: Number(row.created_at) + d * HOUR })))
        const served = mockDefaultListSort("all") ? [...dispatchRows].sort((a, b) => b.at - a.at) : servedOrder(dispatchRows)
        if (served[1]) failTrailerRowReads.set(getDeploymentRowKey(served[1].row), 4)
    }
    /**
     * V2.1: ?mockBoundaries=seed → saved boundaries as a backend would return them (plot.geometry), to exercise the
     * approval gate: every plot gets a valid outline, except — per row — the LAST plot of the second dispatch (no
     * boundary) and the FIRST plot of the third dispatch (a self-crossing outline). Rows with one dispatch are complete.
     */
    if (params.get("mockBoundaries") === "seed") {
        for (const list of dispatchesByRow.values()) {
            list.forEach(({ item }, d) => {
                item.deployment_plots_data.forEach((plot, p) => {
                    if (!plot.location) return
                    if (d === 1 && p === item.deployment_plots_data.length - 1) return
                    plot.geometry = d === 2 && p === 0 ? SEEDED_INVALID_OUTLINE(plot.location) : SEEDED_VALID_OUTLINE(plot.location)
                })
            })
        }
    }
    // ?mockValidation=oldest: Submitted on per dispatch as the list sends it (buildDispatchRows: row created_at + d hours).
    if (mockValidationOldest) {
        const pending: { stored: StoredDispatch; createdAt: number }[] = []
        for (const row of rows) {
            (dispatchesByRow.get(getDeploymentRowKey(row)) ?? []).forEach((stored, d) => {
                stored.validation = { action_required: false, err_msg: [] }
                if (stored.franchiseStatus === "pending") pending.push({ stored, createdAt: Number(row.created_at) + d * HOUR })
            })
        }
        pending.sort((a, b) => a.createdAt - b.createdAt).slice(0, OLDEST_FLAGGED).forEach(({ stored }) => {
            stored.validation = { action_required: true, err_msg: ["Video is missing."] }
        })
    }
    if (mockValidationAz) {
        for (const list of dispatchesByRow.values()) for (const stored of list) stored.validation = { action_required: false, err_msg: [] }
        const base = rows[1]
        const listOfAz = (az: number) => {
            const row = rows.find((r) => r.farmer_id === base.farmer_id && r.deployment_num === base.deployment_num && r.az_id === az)
            return row ? dispatchesByRow.get(getDeploymentRowKey(row)) ?? [] : []
        }
        // as live AZ 6 / AZ 4 reads: no video, source or cluster recorded (the normaliser makes the text fields "")
        const unrecorded = (stored: StoredDispatch) => { stored.item.video = null; stored.item.source_name = ""; stored.item.cluster_name = "" }
        const az6 = listOfAz(6)
        az6.forEach(unrecorded)
        if (az6[0]) az6[0].validation = { action_required: true, err_msg: [...AZ6_LIVE_MESSAGES] }
        if (az6[1]) az6[1].validation = { action_required: null, err_msg: null }
        listOfAz(4).forEach(unrecorded)
        const az1 = rows.filter((r) => r.az_id === 1).flatMap((r) => dispatchesByRow.get(getDeploymentRowKey(r)) ?? []).find((s) => s.franchiseStatus === "pending")
        if (az1) az1.validation = { action_required: true, err_msg: ["Picture Deployment is missing."] }
    }
}
/**
 * V2.1 (mock only), for the detail header checks (mockPlotArea takes a comma list): ?mockAvatar=wide → every farmer photo is a 2:1 image (300 × 150);
 * ?mockAvatar=broken → a photo URL that doesn't load; ?mockPlotArea=missing → the first farmer's first plot has no area
 * (0 — what the live normaliser makes of a missing one); ?mockPlotArea=consistent → every record of each of the first
 * farmer's plots carries the same area (the default mock reuses plot ids with different areas).
 */
if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    const avatar = params.get("mockAvatar")
    if (avatar === "wide" || avatar === "broken") {
        const picture = avatar === "wide"
            ? "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><rect width='100' height='150' fill='#3f3f46'/><rect x='100' width='200' height='150' fill='#d4d4d8'/></svg>")
            : "/mock-missing-avatar.png"
        rows = rows.map((row) => ({ ...row, farmer_picture: picture }))
    }
    const plotAreaModes = (params.get("mockPlotArea") ?? "").split(",")
    if (plotAreaModes.includes("consistent")) {
        // the first farmer's plots: every record of a plot_id carries that plot's first recorded area (as one field would)
        const firstArea = new Map<string, number>()
        for (const row of rows.filter((r) => r.farmer_id === deploymentMetadataRows[0].farmer_id)) {
            for (const { item } of dispatchesByRow.get(getDeploymentRowKey(row)) ?? []) {
                for (const plot of item.deployment_plots_data) {
                    if (!firstArea.has(plot.plot_id)) firstArea.set(plot.plot_id, plot.area)
                    plot.area = firstArea.get(plot.plot_id) ?? plot.area
                }
            }
        }
    }
    if (plotAreaModes.includes("missing")) {
        // every record of the first farmer's first plot (by plot_id) has no area
        const farmerRows = rows.filter((r) => r.farmer_id === deploymentMetadataRows[0].farmer_id)
        const plotId = dispatchesByRow.get(getDeploymentRowKey(farmerRows[0] ?? rows[0]))?.[0]?.item.deployment_plots_data[0]?.plot_id
        for (const row of farmerRows) for (const { item } of dispatchesByRow.get(getDeploymentRowKey(row)) ?? []) for (const plot of item.deployment_plots_data) if (plot.plot_id === plotId) plot.area = 0
    }
}
/**
 * V2.1 (mock only), for the header's Cal. Area total (a comma list; the first mock farmer only):
 *   unique     every plot deployment is its own plot (its own plot_id), so no plot is on two deployment records;
 *   distinct   each dispatch row's calculated_area is a fixed value unrelated to its plots' `area` (0.37, 0.78, 1.19, …);
 *   missing / invalid / zero   the first dispatch row's calculated_area is null / "n/a" / 0;
 *   duplicate / conflict       the farmer read returns the first dispatch row twice — the same value / that value + 1;
 *   slow       the farmer read answers after 8 s (the header's loading state).
 */
const calAreaModes = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("mockCalArea") ?? "").split(",").filter(Boolean) : []
const calAreaFarmer = deploymentMetadataRows[0]?.farmer_id
if (calAreaModes.includes("unique")) {
    for (const row of rows.filter((r) => r.farmer_id === calAreaFarmer)) {
        for (const { item } of dispatchesByRow.get(getDeploymentRowKey(row)) ?? []) {
            for (const plot of item.deployment_plots_data) plot.plot_id = `PU-${plot.deployment_id}`
        }
    }
}
/** The first farmer's dispatch rows with the fixture's calculated_area values (the table and the farmer read alike). */
function withCalAreaFixture(list: DeploymentMetadataRow[]): DeploymentMetadataRow[] {
    if (calAreaModes.length === 0) return list
    let i = 0
    return list.map((row) => {
        if (row.farmer_id !== calAreaFarmer) return row
        const index = i++
        let value: unknown = calAreaModes.includes("distinct") ? round2(0.37 + index * 0.41) : row.calculated_area
        if (index === 0 && calAreaModes.includes("missing")) value = null
        if (index === 0 && calAreaModes.includes("invalid")) value = "n/a"
        if (index === 0 && calAreaModes.includes("zero")) value = 0
        return { ...row, calculated_area: value as number }
    })
}
// The zero-plot fixture keeps the row's totals in line with its remaining plots.
recomputeTotals(getDeploymentRowKey(rows[ZERO_PLOT_ROW]))
// V2.1 (M1): the derived Mati Boost row (?mockTypes=all) records a boost amount per plot (dev Mati Boost plots carry
// boost_amount_plot_applied; the derived row otherwise copies AZ 2's trailer data), so its facts, map size and the
// "Boost amount plot applied" report value have something to show.
for (const row of rows) {
    if (row.az_id !== 5) continue
    for (const { item } of dispatchesByRow.get(getDeploymentRowKey(row)) ?? []) {
        for (const plot of item.deployment_plots_data) if (plot.boost_amount_plot_applied === null) plot.boost_amount_plot_applied = plot.amt_plot_deploy
    }
}

// ── The list as the live API serves it: ONE ROW PER DISPATCH (live API audit, verified 2026-10-11) ──────────────

/** The verifier's name for a decided dispatch (the session's verifier included). */
const verifierNameOf = (item: TrailerDispatchItem) =>
    (item.franchise_verifier_id ? VERIFIER_NAMES[item.franchise_verifier_id] : null) ?? item.deployment_verifier_name ?? null

/**
 * V2.1: getDeploymentMetadata rows at the live grain — one per dispatch of every group row, in group order. Per
 * dispatch (as live): dispatch_id, franchise_status, status (need_correction = rejected), created_at, epoch_date,
 * verified_at / verified_by / franchise_verifier_id, num_tons, plots, calculated_area (Σ its plots' area, as live:
 * Σ plot.area = calculated_area), deployed_amount (Σ its plots' amounts), action_required, err_msg. Deployment-level
 * (copied onto each dispatch, as live): actual_area — the ENROLLED area — and the farmer / village / AZ fields. No
 * trailers_deployed / franchise_statuses (live sends neither). A group without dispatches has no list row.
 */
function buildDispatchRows(): DeploymentMetadataRow[] {
    const out: DeploymentMetadataRow[] = []
    for (const row of rows) {
        const list = dispatchesByRow.get(getDeploymentRowKey(row)) ?? []
        list.forEach((stored, d) => {
            const { item } = stored
            const plots = item.deployment_plots_data
            const decided = stored.franchiseStatus !== "pending"
            out.push({
                ...row,
                dispatch_id: item.dispatch_id,
                franchise_status: stored.franchiseStatus,
                status: stored.franchiseStatus === "rejected" ? "need_correction" : stored.franchiseStatus,
                created_at: Number(row.created_at) + d * HOUR,
                epoch_date: item.date ?? row.epoch_date,
                plots: plots.length,
                calculated_area: round2(plots.reduce((sum, p) => sum + (p.area || 0), 0)),
                deployed_amount: round2(plots.reduce((sum, p) => sum + (p.amt_plot_deploy || 0), 0)),
                num_tons: item.num_tons,
                action_required: stored.validation.action_required,
                err_msg: stored.validation.err_msg === null ? null : [...stored.validation.err_msg],
                verified_at: decided ? stored.verifiedAt : null,
                verified_by: decided ? verifierNameOf(item) : null,
                franchise_verifier_id: decided ? item.franchise_verifier_id : null,
                surveyor_name: item.surveyor_name || row.surveyor_name,
                surveyor_registred_no: item.surveyor_registred_no || row.surveyor_registred_no,
                trailers_deployed: null,
                franchise_statuses: undefined,
            })
        })
    }
    return servedOrder(withCalAreaFixture(out.map((r) => ({ ...r, total_count: out.length }))))
}
let dispatchRowsSnapshot: DeploymentMetadataRow[] = buildDispatchRows()

// ── Subscription (the table and the sheet re-read rows after a mutation) ────────────────────────────
const listeners = new Set<() => void>()
const emit = () => {
    dispatchRowsSnapshot = buildDispatchRows()
    listeners.forEach((listener) => listener())
}

export function subscribeDeploymentStore(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** The mock's GROUP rows (farmer + deployment + AZ) — internal state behind the dispatch rows (a new array after every mutation). */
export function getDeploymentRowsSnapshot(): DeploymentMetadataRow[] {
    return rows
}

/** V2.1: the list rows the table and the farmer read are served — one per dispatch (a new array after every mutation). */
export function getDispatchRowsSnapshot(): DeploymentMetadataRow[] {
    return dispatchRowsSnapshot
}

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────
const LATENCY_MS = 300
const respond = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS))

function findDispatch(deploymentDetailId: string): { rowKey: string; stored: StoredDispatch } | null {
    for (const [rowKey, list] of dispatchesByRow) {
        const stored = list.find((d) => d.item.deployment_detail_id === deploymentDetailId)
        if (stored) return { rowKey, stored }
    }
    return null
}

/** Mock backend rule for the deployment status after a dispatch change (see header comment). */
function recomputeRow(rowKey: string, verifierId: string | null) {
    const list = dispatchesByRow.get(rowKey) ?? []
    rows = rows.map((row) => {
        if (getDeploymentRowKey(row) !== rowKey) return row
        const franchise_statuses = statusesOf(list)
        if (list.length > 0 && list.every((d) => d.franchiseStatus === "approved")) {
            return {
                ...row,
                franchise_statuses,
                status: "approved",
                franchise_status: "approved",
                action_required: false,
                err_msg: [],
                franchise_verifier_id: verifierId,
                verified_by: verifierId ? VERIFIER_NAMES[verifierId] ?? verifierId : row.verified_by,
                verified_at: Date.now(),
            }
        }
        // V2.1: not every dispatch approved — the row keeps its stored status (an approved row that lost a fully-approved
        // state goes back to pending). `action_required` / `err_msg` are independent flags the mock never derives a status
        // from (requirement 4); they stay as seeded.
        return { ...row, franchise_statuses, status: row.status === "approved" ? "pending" : row.status }
    })
}

/**
 * After a soft delete: the group row's totals follow the remaining dispatches (Σ tons, Σ plot amounts, counts). V2.1:
 * actual_area is the ENROLLED area — a deleted dispatch doesn't change it (it used to be overwritten with Σ plot area,
 * which is the calculated area).
 */
function recomputeTotals(rowKey: string) {
    const list = dispatchesByRow.get(rowKey) ?? []
    const plots = list.flatMap((d) => d.item.deployment_plots_data)
    rows = rows.map((row) => getDeploymentRowKey(row) !== rowKey ? row : {
        ...row,
        plots: plots.length,
        deployed_amount: round2(plots.reduce((sum, p) => sum + p.amt_plot_deploy, 0)),
        num_tons: round2(list.reduce((sum, d) => sum + d.item.num_tons, 0)),
        trailers_deployed: list.length,
        franchise_statuses: statusesOf(list),
    })
}

/** What a read returns for a stored dispatch: the item with its current status, validation and verification (as live). */
const toResponseItem = ({ item, franchiseStatus, validation, verifiedAt }: StoredDispatch): TrailerDispatchItem => ({
    ...item,
    franchise_status: franchiseStatus,
    action_required: validation.action_required,
    err_msg: validation.err_msg === null ? null : [...validation.err_msg],
    verified_at: franchiseStatus === "pending" ? null : verifiedAt,
    verified_by: franchiseStatus === "pending" ? null : verifierNameOf(item),
})

// ── Endpoints ───────────────────────────────────────────────────────────────────────────────────────
export const mockDeploymentApi = {
    /**
     * V2.1: every list row of a farmer — what getDeploymentMetadata answers for farmer_ids + status "all": one row per
     * DISPATCH (every status, AZ and round), as live. The detail groups them by farmer + deployment + AZ.
     */
    listFarmerRows(farmerId: string): Promise<DeploymentMetadataRow[]> {
        if (failFarmerRows) {
            failFarmerRows = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("The farmer's deployments could not be loaded (mock failure).")), LATENCY_MS))
        }
        const farmerRows = dispatchRowsSnapshot.filter((row) => String(row.farmer_id) === farmerId)
        if (String(calAreaFarmer) === farmerId && farmerRows.length > 0) {
            // ?mockCalArea=duplicate / conflict: the API sends the first dispatch twice
            const first = farmerRows[0]
            if (calAreaModes.includes("duplicate")) farmerRows.push({ ...first })
            if (calAreaModes.includes("conflict")) farmerRows.push({ ...first, calculated_area: round2(Number(first.calculated_area) + 1) })
            if (calAreaModes.includes("slow")) return new Promise((resolve) => setTimeout(() => resolve(structuredClone(farmerRows)), 8000))
        }
        return respond(farmerRows)
    },

    /**
     * As the dev API answered (docs/deployment/deployment-v2-phase-3e-backend-api-answers.md): a status returns that
     * status's dispatches; V2.1: `status` omitted returns EVERY dispatch of the row, each with its franchise_status;
     * `az_id` omitted returns an empty list.
     */
    getTrailerDetails(request: TrailerDetailsRequest): Promise<TrailerDispatchItem[]> {
        if (failNextTrailerRead) {
            failNextTrailerRead = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("Trailer details could not be loaded (mock failure).")), LATENCY_MS))
        }
        const { farmer_id, deployment_num, status, az_id } = request.trailerDetails[0]
        if (!az_id?.length) return respond([])
        if (status === undefined && trailersStatusRequired) return respond([])
        const matches = rows
            .filter((row) => String(row.farmer_id) === farmer_id && row.deployment_num === deployment_num && az_id.includes(row.az_id))
            .filter((row) => !unavailableRowKeys.has(getDeploymentRowKey(row)))
        const failing = matches.map(getDeploymentRowKey).find((key) => (failTrailerRowReads.get(key) ?? 0) > 0)
        if (failing !== undefined) {
            const remaining = (failTrailerRowReads.get(failing) ?? 1) - 1
            if (remaining > 0) failTrailerRowReads.set(failing, remaining)
            else failTrailerRowReads.delete(failing)
            return new Promise((_, reject) => setTimeout(() => reject(new Error("Trailer details could not be loaded (mock failure).")), LATENCY_MS))
        }
        const dispatches = matches
            .flatMap((row) => dispatchesByRow.get(getDeploymentRowKey(row)) ?? [])
            .filter((d) => status === undefined || d.franchiseStatus === status)
            .map(toResponseItem)
        return respond(dispatches)
    },

    getDeploymentNocDetails(request: DeploymentNocDetailsRequest): Promise<DeploymentNocDetails> {
        if (failNextNocRead) {
            failNextNocRead = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("NOC details could not be loaded (mock failure).")), LATENCY_MS))
        }
        const key = groupKey(request.farmer_id, request.deployment_num)
        const noc = (nocByGroup.get(key) ?? []).filter((doc) => request.az_ids.includes(doc.az_id))
        const preSampling = preSamplingByGroup.get(key)
        return respond({
            get_trailer_result: [{ noc }],
            get_pre_sampling_details_result: preSampling ? [preSampling] : [],
        })
    },

    updateDeploymentTrailerDispatch(request: UpdateDeploymentTrailerDispatchRequest): Promise<MutationResult> {
        const touched = new Map<string, string | null>()
        for (const update of request.deployment_trailer_dispatch_data) {
            const found = findDispatch(update.deployment_detail_id)
            if (!found) continue
            found.stored.franchiseStatus = update.franchise_status
            found.stored.item.franchise_verifier_id = update.franchise_verifier_id
            found.stored.verifiedAt = Date.now() // an update always approves or rejects
            touched.set(found.rowKey, update.franchise_verifier_id)
        }
        touched.forEach((verifierId, rowKey) => recomputeRow(rowKey, verifierId))
        emit()
        return respond({ status: 200 })
    },

    reportFarmerDetails(request: ReportFarmerDetailsRequest): Promise<MutationResult> {
        if (failNextReport400) {
            failNextReport400 = false
            return new Promise((_, reject) => setTimeout(() => reject(apiErrorFromResponse("POST /adminDeploymentSec/v3/reportFarmerDetails", 400, "Bad Request", SIMULATED_REPORT_400)), LATENCY_MS))
        }
        for (const entry of request.reportData) {
            const found = findDispatch(entry.repeater_form_id)
            if (!found) continue
            const row = rows.find((r) => getDeploymentRowKey(r) === found.rowKey)
            // Plot-level reports flag the plot (is_deployment_reported / is_location_reported).
            const plot = entry.entry_no === null ? undefined
                : found.stored.item.deployment_plots_data.find((p) => (p.repeater_form_index || "") === entry.entry_no)
            if (plot && entry.mati_deployed !== undefined) plot.is_deployment_reported = true
            if (plot && entry.location !== undefined) plot.is_location_reported = true
            // The history entry as dev stores it: one per field, the API's label, "" entry_no stored as null, ongoing.
            // V2.1 (M1): AWD / Mati Boost entries name one of the ten fields (matic-dash labels).
            const reported = AWD_REPORT_FIELDS.find(({ key }) => entry[key] !== undefined)
            const defectType = reported?.label ?? "Location"
            const key = historyKey(entry.farmer_id, entry.deployment_num, entry.az_id)
            historyByRow.set(key, [...(historyByRow.get(key) ?? []), {
                id: nextReportEntryId++,
                repeater_form_id: entry.repeater_form_id || null,
                entry_no: typeof entry.entry_no === "number" && entry.entry_no > 0 ? entry.entry_no : null,
                defect_type: defectType,
                status: "ongoing",
                az_id: entry.az_id,
                reason: entry.reason,
                comment: null,
                surveyor_name: found.stored.item.surveyor_name,
                old_value: String(entry.value),
                new_value: "",
                created_at: Date.now(),
                reported_by_name: MOCK_ADMIN.name,
                form_name: "Deployment",
                farmer_name: row?.farmer_name ?? "",
                farmer_id: entry.farmer_id,
                updated_at: Date.now(),
            }])
        }
        emit()
        return respond({ status: 200 })
    },

    updateFarmerDeploymentNOC(request: NocDecisionRequest): Promise<MutationResult> {
        const key = groupKey(request.farmer_id, request.deployment_num)
        nocByGroup.set(key, (nocByGroup.get(key) ?? []).map((doc) =>
            doc.az_id === request.az_id ? { ...doc, franchise_status: request.status } : doc))
        emit()
        return respond({ status: 200 })
    },

    updateComment(request: CommentRequest): Promise<MutationResult> {
        for (const list of dispatchesByRow.values()) {
            for (const { item } of list) {
                const plot = item.deployment_plots_data.find((p) => p.deployment_id === request.id)
                if (plot) plot.comment = request.comment
            }
        }
        emit()
        return respond({ status: 200 })
    },

    /** History of one farmer + deployment, for one AZ when `az_id` is sent (every AZ otherwise). */
    getFarmerReportedHistory(request: ReportHistoryRequest): Promise<ReportHistoryResponse> {
        if (failNextHistoryRead) {
            failNextHistoryRead = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("Report history could not be loaded (mock failure).")), LATENCY_MS))
        }
        const matching = rows.filter((r) => String(r.farmer_id) === request.farmer_id && r.deployment_num === request.deployment_num
            && (request.az_id === undefined || r.az_id === request.az_id))
        const entries = matching.flatMap((r) => historyByRow.get(historyKey(r.farmer_id, r.deployment_num, r.az_id)) ?? [])
        return respond({ reported_farmer_details_result: entries, franchise_status: matching[0]?.franchise_status ?? null })
    },

    /** Plot boundary: each listed plot deployment's geometry becomes the uploaded polygon (as later reads return it). */
    uploadGeoJson(request: UploadGeoJsonRequest): Promise<MutationResult> {
        if (geometrySavesUntilFailure > 0 && --geometrySavesUntilFailure === 0) {
            return new Promise((_, reject) => setTimeout(() => reject(new Error("The boundary could not be saved (mock failure).")), LATENCY_MS))
        }
        if (failNextGeometrySave) {
            failNextGeometrySave = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("The boundary could not be saved (mock failure).")), LATENCY_MS))
        }
        const partial = partialGeometrySave && request.geoJsonData.length > 1
        if (partial) partialGeometrySave = false
        for (const entry of partial ? request.geoJsonData.slice(0, 1) : request.geoJsonData) {
            const geometry = entry.geoJson.features[0]?.geometry ?? null
            for (const list of dispatchesByRow.values()) {
                for (const { item } of list) {
                    const plot = item.deployment_plots_data.find((p) => p.deployment_id === entry.deployment_id)
                    if (plot) plot.geometry = geometry
                }
            }
        }
        emit()
        if (partial) return new Promise((_, reject) => setTimeout(() => reject(new Error("The boundary save timed out (mock failure).")), LATENCY_MS))
        return respond({ status: 200 })
    },

    /** Soft delete: the dispatch (with its plots) or the listed plot deployments disappear from every read. */
    softDeleteDispatch(request: SoftDeleteRequest): Promise<MutationResult> {
        const touched = new Set<string>()
        for (const [rowKey, list] of dispatchesByRow) {
            if (request.deletedBy === "Dispatch") {
                const next = list.filter((d) => d.item.dispatch_id !== request.dispatch_id)
                if (next.length !== list.length) {
                    dispatchesByRow.set(rowKey, next)
                    touched.add(rowKey)
                }
            } else {
                const ids = new Set(request.deployment_ids)
                for (const d of list) {
                    const plots = d.item.deployment_plots_data.filter((p) => !ids.has(p.deployment_id))
                    if (plots.length !== d.item.deployment_plots_data.length) {
                        d.item.deployment_plots_data = plots
                        touched.add(rowKey)
                    }
                }
            }
        }
        touched.forEach(recomputeTotals)
        emit()
        return respond({ status: 200 })
    },
}
