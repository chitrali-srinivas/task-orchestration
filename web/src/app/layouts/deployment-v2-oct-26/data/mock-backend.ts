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

/** Mock permission model (matic-dash: verifier.farm.deployment_verification.create / .delete). */
export interface MockPermissions {
    /** `.create` — approve, report, comment, NOC decisions. */
    edit: boolean
    /** `.delete` — soft delete of a dispatch or a plot deployment (AZ 1–3). */
    delete: boolean
}

export function getMockPermissions(): MockPermissions {
    const flag = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mockPermission") : null
    return { edit: flag !== "view", delete: flag !== "view" && flag !== "nodelete" }
}

interface StoredDispatch {
    item: TrailerDispatchItem
    franchiseStatus: DispatchStatus
}

const NO_DISPATCH_ROW = 29
const UNAVAILABLE_ROW = 33
const ZERO_PLOT_ROW = 3
const MIXED_PENDING_ROW = 27
const MIXED_NC_ROW = 30
let failNextTrailerRead = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "trailers"
/** ?mockFail=geometry → the first boundary save fails (to exercise the editor's error / retry path). */
let failNextGeometrySave = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "geometry"
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
const dispatchesByRow = new Map<string, StoredDispatch[]>()
const nocByGroup = new Map<string, { noc: string; az_id: number; franchise_status: string }[]>()
const preSamplingByGroup = new Map<string, { total_sample_codes: number; status: string[] }>()
/** History per farmer + deployment + AZ (the API filters it by az_id). */
const historyByRow = new Map<string, ReportHistoryEntry[]>()

rows.forEach((row, index) => {
    const initial = buildInitialDeploymentDetail(row, index)
    if (index === NO_DISPATCH_ROW) initial.dispatches = []
    if (index === ZERO_PLOT_ROW && initial.dispatches[0]) initial.dispatches[0].deployment_plots_data = []
    const stored = initial.dispatches.map((item, d) => ({ item, franchiseStatus: initialDispatchStatus(row, index, d, initial.dispatches.length) }))
    dispatchesByRow.set(getDeploymentRowKey(row), stored)
    if (index === UNAVAILABLE_ROW) unavailableRowKeys.add(getDeploymentRowKey(row))
    // trailers_deployed is the row's dispatch count on the dev API (every status); the store keeps it that way.
    rows[index] = { ...row, trailers_deployed: stored.length, franchise_statuses: statusesOf(stored) }
    if (index === NO_DISPATCH_ROW) rows[index] = { ...rows[index], plots: 0, num_tons: 0, deployed_amount: 0 }
    const key = groupKey(row.farmer_id, row.deployment_num)
    if (initial.noc) nocByGroup.set(key, [...(nocByGroup.get(key) ?? []), initial.noc])
    if (!preSamplingByGroup.has(key)) preSamplingByGroup.set(key, initial.preSampling)
    // Earlier reports (trailer-details-mock.ts HISTORY_FIXTURES), independent of the dispatches' current statuses.
    historyByRow.set(historyKey(row.farmer_id, row.deployment_num, row.az_id), buildInitialReportHistory(row, index, initial.dispatches))
})
/** Ids for reports submitted in this session (above every fixture id). */
let nextReportEntryId = 100_000
// The zero-plot fixture keeps the row's totals in line with its remaining plots.
recomputeTotals(getDeploymentRowKey(rows[ZERO_PLOT_ROW]))

// ── Subscription (the table and the sheet re-read rows after a mutation) ────────────────────────────
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function subscribeDeploymentStore(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** Current metadata rows (a new array after every mutation). */
export function getDeploymentRowsSnapshot(): DeploymentMetadataRow[] {
    return rows
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
        // Not every dispatch approved: the server's validation flag decides (a rejected dispatch doesn't).
        return { ...row, franchise_statuses, status: row.action_required ? "need_correction" : "pending" }
    })
}

/** After a soft delete: the row's totals follow the remaining dispatches (Σ tons, Σ plot amounts, counts). */
function recomputeTotals(rowKey: string) {
    const list = dispatchesByRow.get(rowKey) ?? []
    const plots = list.flatMap((d) => d.item.deployment_plots_data)
    const round2 = (n: number) => Math.round(n * 100) / 100
    rows = rows.map((row) => getDeploymentRowKey(row) !== rowKey ? row : {
        ...row,
        plots: plots.length,
        actual_area: round2(plots.reduce((sum, p) => sum + p.area, 0)),
        deployed_amount: round2(plots.reduce((sum, p) => sum + p.amt_plot_deploy, 0)),
        num_tons: round2(list.reduce((sum, d) => sum + d.item.num_tons, 0)),
        trailers_deployed: list.length,
        franchise_statuses: statusesOf(list),
    })
}

/** What a read returns for a stored dispatch: the item with its current status. */
const toResponseItem = ({ item, franchiseStatus }: StoredDispatch): TrailerDispatchItem => ({ ...item, franchise_status: franchiseStatus })

// ── Endpoints ───────────────────────────────────────────────────────────────────────────────────────
export const mockDeploymentApi = {
    /** Returns exactly the dispatches of the requested status (pending / approved / rejected), as the dev API does. */
    getTrailerDetails(request: TrailerDetailsRequest): Promise<TrailerDispatchItem[]> {
        if (failNextTrailerRead) {
            failNextTrailerRead = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("Trailer details could not be loaded (mock failure).")), LATENCY_MS))
        }
        const { farmer_id, deployment_num, status, az_id } = request.trailerDetails[0]
        const matches = rows
            .filter((row) => String(row.farmer_id) === farmer_id && row.deployment_num === deployment_num && (!az_id?.length || az_id.includes(row.az_id)))
            .filter((row) => !unavailableRowKeys.has(getDeploymentRowKey(row)))
            .flatMap((row) => dispatchesByRow.get(getDeploymentRowKey(row)) ?? [])
            .filter((d) => d.franchiseStatus === status)
            .map(toResponseItem)
        return respond(matches)
    },

    getDeploymentNocDetails(request: DeploymentNocDetailsRequest): Promise<DeploymentNocDetails> {
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
            touched.set(found.rowKey, update.franchise_verifier_id)
        }
        touched.forEach((verifierId, rowKey) => recomputeRow(rowKey, verifierId))
        emit()
        return respond({ status: 200 })
    },

    reportFarmerDetails(request: ReportFarmerDetailsRequest): Promise<MutationResult> {
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
            const defectType = entry.source_name !== undefined ? "Source Name" : entry.mati_deployed !== undefined ? "Mati Deployed" : "Location"
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
        const matching = rows.filter((r) => String(r.farmer_id) === request.farmer_id && r.deployment_num === request.deployment_num
            && (request.az_id === undefined || r.az_id === request.az_id))
        const entries = matching.flatMap((r) => historyByRow.get(historyKey(r.farmer_id, r.deployment_num, r.az_id)) ?? [])
        return respond({ reported_farmer_details_result: entries, franchise_status: matching[0]?.franchise_status ?? null })
    },

    /** Plot boundary: each listed plot deployment's geometry becomes the uploaded polygon (as later reads return it). */
    uploadGeoJson(request: UploadGeoJsonRequest): Promise<MutationResult> {
        if (failNextGeometrySave) {
            failNextGeometrySave = false
            return new Promise((_, reject) => setTimeout(() => reject(new Error("The boundary could not be saved (mock failure).")), LATENCY_MS))
        }
        for (const entry of request.geoJsonData) {
            const geometry = entry.geoJson.features[0]?.geometry ?? null
            for (const list of dispatchesByRow.values()) {
                for (const { item } of list) {
                    const plot = item.deployment_plots_data.find((p) => p.deployment_id === entry.deployment_id)
                    if (plot) plot.geometry = geometry
                }
            }
        }
        emit()
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
