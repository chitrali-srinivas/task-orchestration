// PORT-BOUND — pure builders for the Matic Deployment workflow requests, reproducing matic-dash exactly:
//   trailer / NOC loading      src/services/api.ts            getTrailerDetails, getNocDetailsWithSamplingCount
//   approve                    src/components/deployment-trailer.tsx  handleConfirmAzsSubmit
//   report submit              src/components/ui/google-map.tsx       onSubmitReportFarmer
//   NOC decision               src/components/deployment-trailer.tsx  handleQulifyNoc / handleReportNoc
//   comment                    src/components/deployment-trailer.tsx  handleCommentSubmit
//   report history             src/services/api.ts            getReportDetails (+ az_id, as src/pages/Reports.tsx sends it)
//   delete                     src/components/deployment-trailer.tsx  handleDeleteSubmit
// V2 departure, deliberate and documented at the builder: the NOC read asks for the row's AZ only.
import type {
    CommentRequest,
    DeploymentMetadataRow,
    DeploymentNocDetails,
    DeploymentNocDetailsRequest,
    DispatchStatus,
    NocDecisionRequest,
    ReportDataEntry,
    ReportFarmerDetailsRequest,
    ReportHistoryRequest,
    ReportHistoryResponse,
    ReportedFieldEntry,
    SoftDeleteRequest,
    TrailerDeploymentPlot,
    TrailerDetailsRequest,
    TrailerDispatchItem,
    TrailerDispatchUpdate,
    UpdateDeploymentTrailerDispatchRequest,
    UploadGeoJsonRequest,
} from "./schema"

/** The AZ ids matic-dash sends to getDeploymentNocDetails for every row (DEPLOYMENT_AZ_IDS). V2 sends the row's AZ. */
export const DEPLOYMENT_AZ_IDS = [1, 2, 3]
/** getDeploymentTypeForComment("Deployment") in matic-dash. */
export const DEPLOYMENT_COMMENT_SECTION_TYPE = 2
/** deployment_filter_sec used by every Deployment report entry in matic-dash. */
const DEPLOYMENT_FILTER_SEC = 2

// ── Loading ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Approved deployments load approved dispatches; pending / need-correction ones load "pending" (matic-dash).
 * `status` overrides that per read (detailDispatchStatuses).
 */
export function buildTrailerDetailsRequest(row: DeploymentMetadataRow, status?: DispatchStatus): TrailerDetailsRequest {
    return {
        trailerDetails: [{
            farmer_id: String(row.farmer_id),
            deployment_num: row.deployment_num || 1,
            status: status ?? (row.status === "approved" ? "approved" : "pending"),
            az_id: [row.az_id],
        }],
    }
}

/**
 * The dispatch statuses the detail shows for a row, one trailer read each, as matic-dash loads them:
 *   Pending and Need Correction → pending. matic-dash reads "pending" on both of its verification tabs (Ready to
 *     Verify / Action Required) for Deployment, AWD and Mati Boost (matic-dash/src/components/deployment-details1.tsx:58,
 *     :68; pages/AWDVerification.tsx and pages/MatiBoostVerification.tsx pass status="pending").
 *   Verified → approved (read-only), as matic-dash's overview pages.
 * A rejected (reported) dispatch is therefore not shown: it is with the surveyor until it is resubmitted
 * (docs/deployment/deployment-v2-verification-state-audit.md).
 */
export function detailDispatchStatuses(row: DeploymentMetadataRow): DispatchStatus[] {
    if (row.status === "approved") return ["approved"]
    return ["pending"]
}

/**
 * NOC for the row's AZ only (product decision: NOC is AZ-specific). matic-dash sends [1, 2, 3] for every row; the
 * endpoint answers `az_ids: [row.az_id]` with that AZ's NOC for AZ 1–6 (observed on dev).
 */
export function buildNocDetailsRequest(row: DeploymentMetadataRow): DeploymentNocDetailsRequest {
    return { farmer_id: String(row.farmer_id), deployment_num: row.deployment_num, az_ids: [row.az_id] }
}

/** matic-dash getReportDetails body + the row's AZ (the API filters history by az_id; matic-dash Reports sends it). */
export function buildReportHistoryRequest(row: DeploymentMetadataRow): ReportHistoryRequest {
    return { farmer_id: String(row.farmer_id), deployment_num: row.deployment_num, form_name: "Deployment", az_id: row.az_id }
}

// ── Approve (one dispatch; the request is still an array) ───────────────────────────────────────────

export function buildApproveDispatchRequest(dispatch: TrailerDispatchItem, verifierId: string | null): UpdateDeploymentTrailerDispatchRequest {
    return {
        deployment_trailer_dispatch_data: [{
            deployment_detail_id: dispatch.deployment_detail_id,
            franchise_status: "approved",
            franchise_rejected_reason: "Approved by Franchise",
            franchise_comment: "Approved by Franchise",
            hq_status: "approved",
            hq_rejected_reason: null,
            hq_comment: null,
            franchise_verifier_id: verifierId,
            hq_verifier_id: null,
            az_id: dispatch.az_id,
        }],
    }
}

export interface NocSummary {
    docs: DeploymentNocDetails["get_trailer_result"][number]["noc"]
    allApproved: boolean
    samplingCount: number
    samplingStatus: string
}

export function summarizeNoc(noc: DeploymentNocDetails | null): NocSummary {
    const docs = noc?.get_trailer_result[0]?.noc ?? []
    const preSampling = noc?.get_pre_sampling_details_result[0]
    return {
        docs,
        allApproved: docs.length > 0 && docs.every((doc) => doc.franchise_status === "approved"),
        samplingCount: preSampling?.total_sample_codes ?? 0,
        samplingStatus: preSampling?.status?.[0] ?? "",
    }
}

/**
 * Matic's NOC approval gates (before the confirmation dialog opens), in Matic's order. Returns the
 * blocking message, or null. The reported-source gate is applied inside the confirmation dialog, as in
 * matic-dash's ConfirmSourceDialog; status is checked by the caller (only Pending rows offer Approve).
 */
export function getNocApprovalBlocker(noc: NocSummary): string | null {
    if (noc.docs.length === 0) return "No Noc found for this deployment"
    if (!noc.allApproved) return "Please approve all Noc to proceed"
    return null
}

export type NocReadiness = "loading" | "unavailable" | "missing" | "approved" | "pending" | "rejected"

/** NOC state for the row's AZ, for display before Approve (the gate itself stays getNocApprovalBlocker). */
export function getNocReadiness(noc: NocSummary, state: { loading: boolean; error: boolean }): NocReadiness {
    if (state.loading) return "loading"
    if (state.error) return "unavailable"
    if (noc.docs.length === 0) return "missing"
    if (noc.allApproved) return "approved"
    return noc.docs.some((doc) => doc.franchise_status === "rejected") ? "rejected" : "pending"
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────────────

/** A field the user selected in report mode. Only the fields Matic reports are representable. */
export type ReportSelection =
    | { kind: "source_name"; dispatch: TrailerDispatchItem }
    | { kind: "mati_deployed"; dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot }
    | { kind: "location"; dispatch: TrailerDispatchItem; plot: TrailerDeploymentPlot }

/**
 * Builds both calls of matic-dash's report submit: reportFarmerDetails, then updateDeploymentTrailerDispatch
 * rejecting the dispatch of every reported item (one entry per item, as matic-dash pushes them).
 */
export function buildReportRequests(
    row: DeploymentMetadataRow,
    selections: ReportSelection[],
    comment: string,
    verifierId: string | null
): { report: ReportFarmerDetailsRequest; dispatchUpdate: UpdateDeploymentTrailerDispatchRequest } {
    const reportData: ReportDataEntry[] = []
    const farmerReportedData: ReportedFieldEntry[] = []
    const dispatchUpdates: TrailerDispatchUpdate[] = []

    for (const selection of selections) {
        const { dispatch } = selection
        const common = {
            deployment_filter_sec: DEPLOYMENT_FILTER_SEC,
            reason: comment,
            repeater_form_id: dispatch.deployment_detail_id || "",
            surveyor_no: dispatch.surveyor_registred_no || "",
            farmer_id: String(row.farmer_id),
            deployment_num: row.deployment_num,
            az_id: dispatch.az_id,
        }
        if (selection.kind === "source_name") {
            const entry: ReportedFieldEntry = { ...common, source_name: dispatch.source_name, entry_no: null }
            farmerReportedData.push(entry)
            reportData.push({ ...entry, value: dispatch.source_name })
        } else if (selection.kind === "mati_deployed") {
            // matic-dash: entry_no: item.entryNo || "" (plot repeater_form_index)
            const entry: ReportedFieldEntry = { ...common, mati_deployed: selection.plot.amt_plot_deploy, entry_no: selection.plot.repeater_form_index || "" }
            farmerReportedData.push(entry)
            reportData.push({ ...entry, value: selection.plot.amt_plot_deploy })
        } else {
            const location = JSON.stringify(selection.plot.location)
            const entry: ReportedFieldEntry = { ...common, location, entry_no: selection.plot.repeater_form_index || "" }
            farmerReportedData.push(entry)
            reportData.push({ ...entry, value: location })
        }
        dispatchUpdates.push({
            deployment_detail_id: dispatch.deployment_detail_id,
            franchise_verifier_id: verifierId,
            franchise_rejected_reason: comment,
            franchise_comment: comment,
            hq_verifier_id: null,
            hq_rejected_reason: null,
            hq_comment: null,
            hq_status: "rejected",
            franchise_status: "rejected",
            az_id: dispatch.az_id,
        })
    }

    return {
        report: { reportData, farmerReportedData },
        dispatchUpdate: { deployment_trailer_dispatch_data: dispatchUpdates },
    }
}

// ── NOC decision ────────────────────────────────────────────────────────────────────────────────────

export function buildNocDecisionRequest(
    row: DeploymentMetadataRow,
    azId: number,
    decision: "approved" | "rejected",
    verifierId: string | null
): NocDecisionRequest {
    const reason = decision === "approved" ? "Noc approved by franchise" : "Noc rejected by franchise"
    return {
        farmer_id: String(row.farmer_id),
        franchise_verifier_id: verifierId,
        franchise_rejected_reason: reason,
        franchise_comment: reason,
        hq_verifier_id: null,
        hq_rejected_reason: null,
        hq_comment: null,
        hq_status: null,
        status: decision,
        az_id: azId,
        deployment_num: row.deployment_num,
    }
}

// ── Comment (plot level) ────────────────────────────────────────────────────────────────────────────

export function buildCommentRequest(plot: TrailerDeploymentPlot, dispatch: TrailerDispatchItem, comment: string): CommentRequest {
    return { section_type: DEPLOYMENT_COMMENT_SECTION_TYPE, comment, id: plot.deployment_id, az_id: dispatch.az_id }
}

// ── Plot boundary (matic-dash uploadGeoJson) ────────────────────────────────────────────────────────

/** matic-dash google-map.tsx SQUARE_METERS_TO_ACRES. */
export const SQUARE_METERS_TO_ACRES = 0.00024710538146717

/**
 * One plot deployment's new boundary. `path` is the polygon's vertices ([lat, lng] literals, not closed); the ring is
 * closed here (GeoJSON), positions as [lng, lat]. `areaSquareMeters` is the polygon's spherical area.
 */
export function buildUploadGeoJsonRequest(
    plot: TrailerDeploymentPlot,
    dispatch: TrailerDispatchItem,
    path: { lat: number; lng: number }[],
    areaSquareMeters: number
): UploadGeoJsonRequest {
    const ring = path.map((p) => [p.lng, p.lat])
    const first = ring[0], last = ring[ring.length - 1]
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([...first])
    return {
        geoJsonData: [{
            deployment_id: plot.deployment_id,
            farmerId: plot.farmer_id,
            az_id: dispatch.az_id,
            calculated_area: Math.round(areaSquareMeters * SQUARE_METERS_TO_ACRES * 1000) / 1000,
            geoJson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] } }] },
        }],
    }
}

// ── Delete (soft delete; matic-dash handleDeleteSubmit) ───────────────────────────────────────────────

/** Deletes the entire dispatch and all deployments under it. */
export function buildDeleteDispatchRequest(dispatch: TrailerDispatchItem, comment: string): SoftDeleteRequest {
    return { comment: comment.trim(), deletedBy: "Dispatch", dispatch_id: dispatch.dispatch_id }
}

/** Deletes only the selected plot deployment. */
export function buildDeleteDeploymentRequest(plot: TrailerDeploymentPlot, comment: string): SoftDeleteRequest {
    return { comment: comment.trim(), deletedBy: "Deployment", deployment_ids: [Number(plot.deployment_id)] }
}

// ── Report history (response → display rows, as matic-dash getReportDetails maps it) ────────────────

export interface ReportHistoryItem {
    fieldName: string
    oldValue: string
    newValue: string
    reason: string
    reportedBy: string
    surveyorName: string
    createdAt: number | null
    isImage: boolean
}

export function mapReportHistory(response: ReportHistoryResponse): ReportHistoryItem[] {
    return response.reported_farmer_details_result.map((entry) => ({
        fieldName: entry.defect_type,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        reason: entry.reason,
        reportedBy: entry.reported_by_name || "Verifier",
        surveyorName: entry.surveyor_name,
        createdAt: entry.created_at,
        isImage: entry.old_value?.includes("https://") || entry.new_value?.includes("https://"),
    }))
}
