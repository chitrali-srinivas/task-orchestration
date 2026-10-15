// PORT-BOUND — the Samples data seam. Components and hooks depend on this interface only; data-source.ts binds it
// to the mock today. In matic-dash an HTTP client implements it against the real endpoints once they exist
// (the PROPOSED REST mapping is in the doc §15 and the Inspector's API section).
import type {
    ApproveSamplesRequest,
    ApproveSamplesResponse,
    FarmerSamplesDetail,
    FilterOptionsResponse,
    ListSamplesRequest,
    ListSamplesResponse,
    ReportSampleRequest,
    Sample,
    SampleEvent,
    SaveBoundaryRequest,
    SaveBoundaryResponse,
    Session,
    UpdateCommentRequest,
} from "../domain/types"

export interface SamplesApi {
    /** GET  /api/v1/me (the verifier and the sample-verification permission). */
    getSession(): Promise<Session>
    /** GET  /api/v1/samples/filter-options */
    getFilterOptions(): Promise<FilterOptionsResponse>
    /** GET  /api/v1/samples?bucket=&page=&page_size=&… — ONE ROW PER SAMPLE, plus per-tab sample counts for the same filters */
    listSamples(request: ListSamplesRequest, signal?: AbortSignal): Promise<ListSamplesResponse>
    /**
     * GET  /api/v1/farmers/{farmer_id}/samples — the detail: the FARMER a selected sample belongs to, every sample of
     * theirs across AZs, their plots, purpose counts and farmer-level validation. The id comes from the selected row.
     */
    getFarmerDetail(farmerId: string, signal?: AbortSignal): Promise<FarmerSamplesDetail>
    /** GET  /api/v1/farmers/{farmer_id}/sample-events */
    getFarmerHistory(farmerId: string, signal?: AbortSignal): Promise<SampleEvent[]>
    /** POST /api/v1/samples:approve  (Idempotency-Key header; per-sample outcome) */
    approveSamples(request: ApproveSamplesRequest): Promise<ApproveSamplesResponse>
    /** POST /api/v1/samples/{sample_id}/reports  (Idempotency-Key header; fields = what Matic's reportFarmerDetails names) */
    reportSample(request: ReportSampleRequest): Promise<Sample>
    /** PUT  /api/v1/samples/{sample_id}/plot-boundary  (Idempotency-Key header; creates or updates the plot) */
    saveBoundary(request: SaveBoundaryRequest): Promise<SaveBoundaryResponse>
    /** PATCH /api/v1/samples/{sample_id}  { comment } */
    updateComment(request: UpdateCommentRequest): Promise<Sample>
}

/** A unique key per user action, sent with every mutation (a retried request is applied once). */
export const newIdempotencyKey = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
