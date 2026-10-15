// PORT-BOUND — the Samples domain and its PROPOSED API contract (design-first: there is no Samples API yet).
// The UI depends only on these types. The mock backend (data/mock/*) implements them over the imported CSV
// (data/mock/csv/samples-db.json) plus demo records derived from it (samples-demo.json); a real API client implements the same SamplesApi later
// (data/samples-api.ts). Field names are snake_case as the Matic APIs use.
//
// Provenance (details in docs/samples/samples-feature-discovery-and-design.md):
//   OBSERVED  kind (CSV `type`), purpose, status, verifier_comment, rejection_reason, plot_id, generated_plot_id,
//             picture, lat/long, collection_timestamp, created_at, az_id, hq_status, surveyor_id / verifier_id
//             (phone numbers), survey_response_id (CSV columns); Matic's report payload keys `sample_id` / `location`
//             (what a sample report can name); err_msg {msg, key_name} + action_required (Matic verification payloads).
//   DERIVED   farmer_id: the CSV has no farmer column; samples are grouped by shared survey_response_id / plot_id.
//   PROPOSED  everything with no Matic or CSV source: the server-computed bucket, structured validation checks,
//             approval blockers, the boundary mutation and generated plot id, the event history, idempotency keys.
//   NOT IN SOURCE (null in CSV-derived data): farmer / surveyor / verifier names, villages, AZ names, plot outlines.

import type { LatLng } from "./geometry"

export type { LatLng }

// ── Enums ───────────────────────────────────────────────────────────────────────────────────────────

/** OBSERVED: CSV `type` (only "control" in the export); Matic splits the two kinds into separate stacks. */
export type SampleKind = "deployment" | "control"

/** OBSERVED: CSV `purpose` and Matic SampleType / ControlFieldType (pre, start, harvest, EOY, EO3Y, EO5Y). */
export type SamplePurpose = "pre" | "start" | "harvest" | "eoy" | "eo3y" | "eo5y"
export const SAMPLE_PURPOSES: readonly SamplePurpose[] = ["pre", "start", "harvest", "eoy", "eo3y", "eo5y"]

/** OBSERVED: CSV `status` — the authoritative verification decision on a sample. */
export type VerificationStatus = "pending" | "approved" | "rejected"

/** OBSERVED: CSV `hq_status` (pending / approved / null). Not used by any Matic sample screen; never shown as the status. */
export type HqStatus = "pending" | "approved" | "rejected"

/**
 * PROPOSED: the verifier-facing bucket, COMPUTED BY THE SERVER from status + open reports + blocking validation.
 * Shown with Deployment V2's words (approved → "Verified"). The UI renders it; it never derives it.
 *   approved         status = approved
 *   need_correction  status = rejected with an open report, or status = pending with a blocking system-validation check
 *   pending          status = pending, nothing blocking from validation, no open report
 */
export type StatusBucket = "pending" | "need_correction" | "approved"
export const STATUS_BUCKETS: readonly StatusBucket[] = ["pending", "need_correction", "approved"]

/** PROPOSED: where a sample's plot stands. */
export type BoundaryState =
    | "deployment_plot" //    the plot of the deployment the sample was taken from (read-only here)
    | "control_plot" //       a control plot exists (outline known, or not in this dataset) — approval allowed
    | "boundary_required" //  control sample without any plot → draw + save creates the plot
    | "not_located" //        no GPS: nothing to draw around (validation reports it)

export type ValidationSeverity = "error" | "warning"
export type ValidationResult = "pass" | "fail" | "not_applicable"

/** PROPOSED check codes (Matic only has free-text err_msg {msg, key_name}; key_name values are UNKNOWN). */
export type ValidationCode =
    | "photo_present"
    | "photo_unique"
    | "gps_present"
    | "gps_unique"
    | "gps_in_plot"
    | "collection_date_valid"
    | "sample_code_present"

export interface ValidationCheck {
    code: ValidationCode
    label: string
    severity: ValidationSeverity
    result: ValidationResult
    /** Why it failed (null when it passed / doesn't apply). */
    message: string | null
}

/** PROPOSED: why Approve is not available, from the server. The UI shows `message` verbatim. */
export type ApprovalBlockerCode = "boundary_required" | "validation_failed" | "open_report" | "not_pending" | "no_permission" | "not_located"
export interface ApprovalBlocker {
    code: ApprovalBlockerCode
    message: string
}

/**
 * What a sample report can name. OBSERVED in matic-dash: reportFarmerDetails rows for samples carry `sample_id` or
 * `location` (samples-map.tsx onReportSample), and the sample payload has is_sample_reported / is_location_reported;
 * the CSV's rejection reasons add "wrong picture" (no Matic payload key for it — OPEN).
 */
export type ReportableField = "sample_id" | "location" | "picture"
export const REPORTABLE_FIELDS: readonly ReportableField[] = ["sample_id", "location", "picture"]

// ── Resources ───────────────────────────────────────────────────────────────────────────────────────

/** A person as the data knows them. CSV-derived people have an id (the phone number Matic stores — a synthetic placeholder in the committed mock data) and no name. */
export interface PersonRef {
    id: string
    name: string | null
    phone: string | null
}

export interface AzRef {
    /** OBSERVED: numeric az_id (CSV 1 / 2; Matic AZ 1–3 deployment, 4 AWD, 5 Mati Boost). 0: not recorded. */
    id: number
    code: string
    /** Not in the CSV (Matic: az_name from /getAllAzData). */
    name: string | null
}

export interface FarmerRef {
    /** Derived farmers: F-0001 … (rows sharing a survey response / plot); the export has no farmer column. */
    id: string
    /** Not in the CSV. */
    name: string | null
    phone: string | null
    village: { id: string; name: string; block: string | null; district: string | null; state: string | null } | null
    /** The id was derived from sample links, not read from a farmer record. */
    derived: boolean
}

export interface PlotRef {
    plot_id: string
    /** Whether the id came from the field survey / deployment, or was generated when a verifier drew the boundary. */
    origin: "deployment" | "control_survey" | "generated"
    /** GeoJSON Polygon outer ring as {lat,lng}, open. Null when the dataset holds no outline for the plot. */
    outline: LatLng[] | null
    /** False when the dataset has no geometry for this plot (the CSV export carries none): nothing is drawn, nothing is blocked. */
    outline_available: boolean
    /** Server-computed area of the outline (acres); null without an outline. */
    area_acres: number | null
    deployment_id: string | null
    /** Control plots drawn in this workflow: who drew it, when. */
    drawn_by: PersonRef | null
    drawn_at: number | null
}

export interface OpenReport {
    report_id: string
    /** The fields the report names (empty when a legacy rejection_reason names none). */
    fields: ReportableField[]
    comment: string
    reported_by: PersonRef
    reported_at: number
}

/** One sample as the API returns it. */
export interface Sample {
    sample_id: string
    /** OBSERVED: CSV sample_code (free text, nullable). */
    sample_code: string | null
    kind: SampleKind
    purpose: SamplePurpose
    survey_response_id: string
    farmer_id: string
    az: AzRef
    /** GPS where the sample was collected; null when not recorded. */
    location: LatLng | null
    /** Photo URL; null when not uploaded. */
    picture_url: string | null
    /** OBSERVED: collection_timestamp (a date picked on the device; epoch ms). */
    collected_at: number | null
    /** OBSERVED: created_at (submission; epoch ms). */
    submitted_at: number
    surveyor: PersonRef | null
    /** Authoritative verification decision (OBSERVED `status`). */
    status: VerificationStatus
    /** Server-computed bucket (PROPOSED). */
    bucket: StatusBucket
    hq_status: HqStatus | null
    verified_by: PersonRef | null
    verified_at: number | null
    verifier_comment: string | null
    comment: string | null
    plot: PlotRef | null
    boundary_state: BoundaryState
    /** Whether the verifier may draw / edit this sample's boundary now (server decides). */
    boundary_editable: boolean
    validation: ValidationCheck[]
    open_report: OpenReport | null
    approval: { allowed: boolean; blockers: ApprovalBlocker[] }
    can_report: boolean
    /** PROPOSED: the sample has been reported at least once (open or completed) — its card shows the history action (V2). */
    has_report_history: boolean
    /** Optimistic-concurrency token: mutations send it back (PROPOSED). */
    version: number
    /** Where the mock record came from (Inspector only). */
    source: "csv" | "demo"
}

/** Counts per bucket. */
export type BucketCounts = Record<StatusBucket, number>

/** One table row: ONE sample, with its farmer (the detail's context). */
export interface SampleListRow extends Sample {
    farmer: FarmerRef
}

export interface PurposeCount {
    kind: SampleKind
    purpose: SamplePurpose
    count: number
}

/** The detail: a FARMER and every sample of theirs, across AZs. PROPOSED read model — not a DB table. */
export interface FarmerSamplesDetail {
    farmer: FarmerRef
    /** The AZs the farmer's samples belong to, in id order. */
    azs: AzRef[]
    samples: Sample[]
    /** Plots referenced by the farmer's samples (map context). */
    plots: PlotRef[]
    sample_counts: BucketCounts
    purpose_counts: PurposeCount[]
    /** Farmer-level validation (Matic action_required / err_msg). */
    action_required: boolean
    err_msg: { msg: string; key_name: string }[]
}

export type SampleEventType =
    | "collected"
    | "validated"
    | "reported"
    | "corrected"
    | "approved"
    | "boundary_saved"
    | "boundary_updated"
    | "comment_updated"

export interface SampleEvent {
    event_id: string
    sample_id: string
    sample_code: string | null
    purpose: SamplePurpose
    kind: SampleKind
    type: SampleEventType
    at: number
    actor: PersonRef | null
    /** Human summary ("Reported: Sample ID, GPS Coordinates — …"). */
    summary: string
    /** For reports: the report's state (ongoing until a correction closes it). */
    report_state?: "ongoing" | "completed"
    /** For reports: the reported fields (structured — never written into `summary`). */
    report_fields?: ReportableField[]
}

// ── Requests / responses ────────────────────────────────────────────────────────────────────────────

export type SampleSortField = "sample_code" | "submitted" | "farmer" | "village" | "kind" | "purpose" | "plot" | "az" | "az_name" | "surveyor" | "verified_by" | "verified_on"

export interface ListSamplesRequest {
    /** Tab: a bucket, or "all". */
    bucket: StatusBucket | "all"
    page: number
    page_size: number
    farmer_ids?: string[]
    village_ids?: string[]
    az_ids?: number[]
    kinds?: SampleKind[]
    purposes?: SamplePurpose[]
    surveyor_ids?: string[]
    verifier_ids?: string[]
    boundary?: ("required" | "none_required")[]
    submitted_from?: number
    submitted_to?: number
    sort_by?: SampleSortField
    sort_dir?: "asc" | "desc"
}

export interface ListSamplesResponse {
    rows: SampleListRow[]
    pagination: { page: number; page_size: number; total: number; total_pages: number }
    /** SAMPLES per tab for the SAME filters (the tab itself excluded), and the distinct farmers in the current tab. */
    counts: { all: number; farmers: number } & BucketCounts
}

export interface ApproveSamplesRequest {
    sample_ids: string[]
    /** Each sample's version as read (stale versions are refused). */
    versions: Record<string, number>
    comment?: string
    idempotency_key: string
}
export interface MutationOutcome {
    sample_id: string
    ok: boolean
    error?: string
}
export interface ApproveSamplesResponse {
    results: MutationOutcome[]
}

export interface ReportSampleRequest {
    sample_id: string
    version: number
    /** The reported fields (Matic: sample_id / location rows in reportFarmerDetails). */
    fields: ReportableField[]
    comment: string
    idempotency_key: string
}

export interface SaveBoundaryRequest {
    sample_id: string
    version: number
    /** GeoJSON Polygon geometry, closed outer ring, [lng, lat] order. */
    geometry: { type: "Polygon"; coordinates: [number, number][][] }
    idempotency_key: string
}
export interface SaveBoundaryResponse {
    plot: PlotRef
    /** Every sample the plot was assigned to (the target plus boundary-required control samples of the farmer inside it). */
    assigned_sample_ids: string[]
}

export interface UpdateCommentRequest {
    sample_id: string
    comment: string
}

export interface FilterOptionsResponse {
    farmers: FarmerRef[]
    villages: { id: string; name: string }[]
    azs: AzRef[]
    surveyors: PersonRef[]
    verifiers: PersonRef[]
}

export interface Session {
    user: PersonRef
    /** PROPOSED permission key: verifier.farm.sample_verification.create (no such key exists in Matic yet). */
    can_verify: boolean
}
