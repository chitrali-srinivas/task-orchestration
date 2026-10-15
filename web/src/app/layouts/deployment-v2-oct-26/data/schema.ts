// PORT-BOUND — Deployment API contract types (field names exactly as the API sends them).
//   POST /adminFarmApp/v4/getDeploymentMetadata
//   POST /adminFarmApp/v4/getDeploymentStatusCounts
import type { EngagementRecord } from "@/app/layouts/deployment/data/schema"

/** Authoritative display status provided by the API. Never derived in the frontend. */
export type DeploymentStatus = "approved" | "pending" | "need_correction"

/**
 * Epoch milliseconds. The contract documents numbers; the dev API sends them as numeric strings
 * (e.g. "1781603699229"). Read them with parseEpochMs (adapter.ts), never with `new Date(value)` directly.
 */
export type EpochMs = number | string

/** One getDeploymentMetadata row. Row grain: farmer_id + deployment_num + az_id. Dates are epoch ms. */
export interface DeploymentMetadataRow {
    created_at: EpochMs
    epoch_date: EpochMs
    farmer_id: number
    /** null on some dev rows. */
    farmer_name: string | null
    farmer_picture: string | null
    phone_no: string | null
    village_id: number
    village_name: string
    deployment_num: number
    az_id: number
    az_code: string
    az_name: string
    plots: number
    actual_area: number
    calculated_area: number
    deployed_amount: number
    num_tons: number
    trailers_deployed: number
    status: DeploymentStatus
    franchise_status: string | null
    /**
     * The set of the row's dispatch statuses (e.g. ["approved", "pending", "rejected"]), as the API sends it.
     * Informational only: the row status above stays authoritative. Used by the detail to tell "no dispatches in
     * the shown statuses" from "dispatches exist but could not be loaded". Absent when the source does not send it.
     */
    franchise_statuses?: string[] | null
    action_required: boolean
    err_msg: string[] | null
    surveyor_registred_no: string | null
    surveyor_name: string | null
    surveyor_phone_no: string | null
    franchise_verifier_id: string | null
    verified_by: string | null
    verified_at: EpochMs | null
    total_count: number
}

/** getDeploymentStatusCounts response. `all` is provided by the API. */
export interface DeploymentStatusCounts {
    all: number
    approved: number
    pending: number
    need_correction: number
}

/**
 * Row shape consumed by the existing Deployment components (table, columns, detail sheet), carrying the
 * original API row so API-only fields (deployment_num, err_msg, …) stay available.
 */
export type DeploymentV2Record = Omit<EngagementRecord, "submittedOn"> & {
    /** Undefined when the API row has no valid created_at. */
    submittedOn: Date | undefined
    api: DeploymentMetadataRow
}

// ── Existing Matic detail flow (NOT part of the v4 metadata response) ────────────────────────────────
// The Ready to Verify / Need Correction detail panel in matic-dash is filled by two further calls made when
// a deployment is opened. Shapes mirror the raw fields matic-dash reads (src/services/api.ts).

/** A dispatch's own review status (getTrailerDetails `franchise_status`), independent of the row's status. */
export type DispatchStatus = "pending" | "approved" | "rejected"

/** POST /adminDeploymentSec/v3/getTrailerDetails → data[] (one item per trailer dispatch). */
export interface TrailerDispatchItem {
    az_code: string
    az_id: number
    /** Dispatch date, epoch ms (null when the API sends none). */
    date: number | null
    deployment_detail_id: string
    deployment_verifier_name: string | null
    deployment_verifier_id: string | null
    dispatch_id: number
    num_tons: number
    source_name: string
    surveyor_name: string
    surveyor_registred_no: string
    trailer_no: string
    video: string | null
    village_name: string
    cluster_name: string
    repeater_form_index: number
    /** The dispatch's own status; null when the response has none (matic-dash never reads it). */
    franchise_status: DispatchStatus | null
    /** Phone of the verifier who last decided the dispatch (null while pending). */
    franchise_verifier_id: string | null
    // Sent for every AZ, filled mostly for AWD (AZ 4) / Mati Boost (AZ 5) dispatches; null when empty.
    batch_id: string | null
    field_condition: string | null
    crop_stage: string | null
    num_plots_unload: number | null
    deployment_plots_data: TrailerDeploymentPlot[]
}

export interface TrailerDeploymentPlot {
    amt_plot_deploy: number
    area: number
    comment: string | null
    deployment_id: number
    dispatch_id: number
    farmer_id: number
    /** Plot shape / location are present in production; not mocked here (the map keeps the existing mock). */
    geometry: unknown | null
    location: { lat: number; lng: number } | null
    picture_deployment: string | null
    plot_id: string
    repeater_form_id: string
    repeater_form_index: number
    is_location_reported: boolean
    /** Amount-reported flag (the API sends it as `is_mati_deploy_reported`). */
    is_deployment_reported: boolean
    // AWD (AZ 4) / Mati Boost (AZ 5) plot values; null when empty. Units are not established by the API.
    verbal_plot_area_enrolled: number | null
    boost_amount_plot_applied: number | null
}

/** POST /adminFarmApp/v3/getDeploymentNocDetails → data (NOC per AZ + pre-sampling summary). */
export interface DeploymentNocDetails {
    get_trailer_result: { noc: { noc: string; az_id: number; franchise_status: string }[] }[]
    get_pre_sampling_details_result: { total_sample_codes: number; status: string[] }[]
}

/** Everything the detail panel loads for one deployment row. */
export interface DeploymentDetailData {
    trailers: TrailerDispatchItem[]
    noc: DeploymentNocDetails
}

// ── Requests / responses of the Matic detail workflow ────────────────────────────────────────────────
// Field names and values as built in matic-dash (src/components/deployment-trailer.tsx,
// src/components/ui/google-map.tsx, src/services/api.ts). Reads return the `response.data.data` payload.

/** POST /adminDeploymentSec/v3/getTrailerDetails */
export interface TrailerDetailsRequest {
    trailerDetails: { farmer_id: string; deployment_num: number; status: DispatchStatus; az_id?: number[] }[]
}

/** POST /adminFarmApp/v3/getDeploymentNocDetails */
export interface DeploymentNocDetailsRequest {
    farmer_id: string
    deployment_num: number
    az_ids: number[]
}

/** One entry of PATCH /adminFarmApp/v3/updateDeploymentTrailerDispatch (approve or report-reject). */
export interface TrailerDispatchUpdate {
    deployment_detail_id: string
    franchise_status: "approved" | "rejected"
    franchise_rejected_reason: string
    franchise_comment: string
    hq_status: "approved" | "rejected"
    hq_rejected_reason: null
    hq_comment: null
    franchise_verifier_id: string | null
    hq_verifier_id: null
    az_id: number
}

export interface UpdateDeploymentTrailerDispatchRequest {
    deployment_trailer_dispatch_data: TrailerDispatchUpdate[]
}

/** One reported field (farmerReportedData entry) of POST /adminDeploymentSec/v3/reportFarmerDetails. */
export interface ReportedFieldEntry {
    deployment_filter_sec: number
    /** Exactly one of source_name / mati_deployed / location is set, depending on the reported field. */
    source_name?: string
    mati_deployed?: number
    location?: string
    reason: string
    repeater_form_id: string
    entry_no: number | string | null
    surveyor_no: string
    farmer_id: string
    deployment_num: number
    az_id: number
}

/** reportData entry: the same fields plus the reported `value`. */
export interface ReportDataEntry extends ReportedFieldEntry {
    value: string | number
}

export interface ReportFarmerDetailsRequest {
    reportData: ReportDataEntry[]
    farmerReportedData: ReportedFieldEntry[]
}

/** PATCH /adminDeploymentSec/updateFarmerDeploymentNOC */
export interface NocDecisionRequest {
    farmer_id: string
    franchise_verifier_id: string | null
    franchise_rejected_reason: string
    franchise_comment: string
    hq_verifier_id: null
    hq_rejected_reason: null
    hq_comment: null
    hq_status: null
    status: "approved" | "rejected"
    az_id: number
    deployment_num: number
}

/** PATCH /adminDeploymentSec/v3/comment (matic-dash CommentObj; section_type 2 = Deployment). */
export interface CommentRequest {
    section_type: number
    comment: string
    id: number
    az_id: number
}

/** POST /adminDeploymentSec/v3/getFarmerReportedHistory */
export interface ReportHistoryRequest {
    farmer_id: string
    deployment_num: number
    form_name: "Deployment"
    /** AZ of the row (matic-dash's Reports page sends it; the API filters on it). */
    az_id?: number
}

/** A history entry's report lifecycle (matic-dash Reports page tabs: Ongoing / Completed). */
export type ReportHistoryStatus = "ongoing" | "completed"

/**
 * One getFarmerReportedHistory entry = one reported field. The source of truth for submitted reports, and so for V2's
 * Reported indicators (docs/deployment/deployment-v2-reported-field-mapping-investigation.md); never franchise_status
 * or the plot flags.
 */
export interface ReportHistoryEntry {
    /** Entry id; null when missing. The API can return the same entry twice (identical rows). */
    id: number | null
    /** The reported dispatch (its deployment_detail_id); null when the entry names none. Not a status signal. */
    repeater_form_id: string | null
    /** The reported plot: its 1-based repeater_form_index within that dispatch. null for dispatch-level fields (Source
     *  Name) and when the plot had no index. */
    entry_no: number | null
    /** The reported field as the API labels it ("Source Name", "Mati Deployed", "Location", …). */
    defect_type: string
    /** ongoing: no new value yet; completed: a new value was submitted. null when the API sent neither. */
    status: ReportHistoryStatus | null
    az_id: number | null
    reason: string
    comment: string | null
    surveyor_name: string
    /** Values as text; objects / arrays (e.g. a corrected location) are kept as JSON for the history display. */
    old_value: string
    new_value: string
    /** Epoch ms; null when missing. */
    created_at: number | null
    reported_by_name: string
    form_name: string
    farmer_name: string
    farmer_id: string
    updated_at: number | null
}

export interface ReportHistoryResponse {
    reported_farmer_details_result: ReportHistoryEntry[]
    franchise_status: string | null
}

/**
 * PATCH /adminDeploymentSec/v3/softDeleteDispatch (matic-dash SoftDeletePayload / deleteDeploymentTrailer).
 * "Dispatch" sends dispatch_id (the whole dispatch); "Deployment" sends deployment_ids (one plot deployment).
 */
export type SoftDeleteRequest =
    | { comment: string; deletedBy: "Dispatch"; dispatch_id: number }
    | { comment: string; deletedBy: "Deployment"; deployment_ids: number[] }

/** Mutations resolve with the HTTP status matic-dash checks (`response.status == 200`). */
export interface MutationResult {
    status: number
}

/**
 * POST /adminDeploymentSec/uploadGeoJsonData — a plot deployment's boundary (matic-dash services/api.ts uploadGeoJson,
 * as its deployment map sends it: components/ui/google-map.tsx assignShapesToDeployments). One entry per plot
 * deployment; the polygon is a GeoJSON FeatureCollection with one Polygon feature, [lng, lat] positions.
 */
export interface GeoJsonUploadItem {
    deployment_id: number
    farmerId: number
    az_id: number
    /** Acres, computed from the polygon (Google spherical area × 0.00024710538146717, 3 decimals), as matic-dash does. */
    calculated_area: number
    geoJson: {
        type: "FeatureCollection"
        features: { type: "Feature"; geometry: { type: "Polygon"; coordinates: number[][][] } }[]
    }
}

export interface UploadGeoJsonRequest {
    geoJsonData: GeoJsonUploadItem[]
}

// ── v4 list requests / responses (live mode) ─────────────────────────────────────────────────────────

export type DeploymentStatusFilter = "all" | DeploymentStatus

export type DeploymentSortBy =
    | "created_at" | "epoch_date" | "farmer_name" | "village_name" | "az_code" | "az_name" | "status"
    | "surveyor_name" | "verified_by" | "plots" | "actual_area" | "calculated_area" | "deployed_amount"

/** POST /adminFarmApp/v4/getDeploymentMetadata body (every filter optional). Dates are epoch ms. */
export interface DeploymentMetadataRequest {
    epoch_date_start?: number | null
    epoch_date_end?: number | null
    created_at_start?: number | null
    created_at_end?: number | null
    verified_on_start_date?: number | null
    verified_on_end_date?: number | null
    village_ids?: number[]
    farmer_ids?: number[]
    az_ids?: number[]
    surveyor_ids?: string[]
    verifier_ids?: string[]
    status?: DeploymentStatusFilter
    sort_by?: DeploymentSortBy
    sort_order?: "asc" | "desc"
    rows?: number
    page?: number
}

/** getDeploymentStatusCounts takes the same filters; pagination and sorting are ignored. */
export type DeploymentStatusCountsRequest = Omit<DeploymentMetadataRequest, "rows" | "page" | "sort_by" | "sort_order">

export interface DeploymentPagination {
    total: number
    page: number
    rows: number
    total_pages: number
}

export interface DeploymentMetadataResponse {
    status: number
    message: string
    data: { data: DeploymentMetadataRow[]; pagination: DeploymentPagination }
}

export interface DeploymentStatusCountsResponse {
    status: number
    message: string
    data: DeploymentStatusCounts
}

// ── v4 filter lookups (GET, params page / rows / search), as matic-dash reads them ───────────────────
// matic-dash: src/components/engagement/api/engagement-filter-options.api.ts

export interface LookupListResponse<TItem> {
    status_code?: number
    message?: string
    data?: { data?: TItem[]; pagination?: Partial<DeploymentPagination> }
}

export interface FarmerLookupItem { farmer_id: string | number; farmer_name?: string; phone_no?: string }
export interface VillageLookupItem { village_id: number; village_name?: string; base_id?: number }
export interface AzLookupItem { id: number; az_code?: string; az_name?: string }
export interface SurveyorLookupItem { surveyor_name?: string; phone_no?: string }
export interface VerifierLookupItem { verifier_name?: string; phone_no?: string }
