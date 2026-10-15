// PROPOSED — NOT AN EXISTING BACKEND ENDPOINT. Documentation-only types for a future dispatch-level list, so that a
// backend implementation can replace the client-side expansion (dispatch-rows.ts, hooks/use-dispatch-rows.ts) with
// accurate server-side paging, sorting, filtering and counts. Nothing imports this module at runtime; no URL is called.
// The full proposal (semantics, errors, versioning) is in docs/deployment/deployment-v2-1-approved-decisions-implementation-report.md.
import type { DispatchStatus } from "./schema"

/** PROPOSED  POST /adminFarmApp/v5/getDispatchList  (name illustrative). */
export interface ProposedDispatchListRequest {
    /** The dispatch's own status (franchise_status), or "all". Counts are returned for every value regardless. */
    status?: DispatchStatus | "all"
    farmer_ids?: number[]
    village_ids?: number[]
    az_ids?: number[]
    deployment_nums?: number[]
    surveyor_ids?: string[]
    verifier_ids?: string[]
    /** Dispatch date range (epoch ms). */
    dispatch_date_start?: number | null
    dispatch_date_end?: number | null
    /** Boundary completeness filter: dispatches whose plots all have / don't all have saved boundaries. */
    boundaries?: "complete" | "incomplete"
    sort_by?: "dispatch_date" | "farmer_name" | "village_name" | "az_code" | "deployment_num" | "franchise_status" | "num_tons" | "plots" | "surveyor_name" | "verified_by" | "verified_at"
    sort_order?: "asc" | "desc"
    rows?: number
    page?: number
}

/** PROPOSED  one record per dispatch. */
export interface ProposedDispatchListRecord {
    /** Stable identifiers (both exist on every dispatch today). */
    dispatch_id: number
    deployment_detail_id: string
    // Farmer (display fields the table shows; the farmer-level detail still reads getTrailerDetails per row).
    farmer_id: number
    farmer_name: string | null
    village_id: number
    village_name: string
    // Deployment
    deployment_num: number
    az_id: number
    az_code: string
    az_name: string
    trailer_no: string | null
    source_name: string | null
    num_tons: number | null
    /** Dispatch date, epoch ms. */
    dispatch_date: number | null
    surveyor_name: string | null
    surveyor_registred_no: string | null
    /** AUTHORITATIVE dispatch status. */
    franchise_status: DispatchStatus
    deployment_verifier_name: string | null
    verified_at: number | null
    /**
     * Dispatch-grain validation — only if the backend can state it per dispatch. If validation stays row-grain, the
     * backend should instead return `row_action_required` / `row_err_msg` named as row-level, never per dispatch.
     */
    action_required: boolean | null
    err_msg: string[] | null
    /** Plot / boundary completeness, so the client needn't read every dispatch's plots to show it. */
    plots: number
    plots_with_boundary: number
    /** Open verifier reports on this dispatch (history exists), for the history indicator. */
    open_reports: number
}

/** PROPOSED  response envelope — the v4 shape, with dispatch-grain counts. */
export interface ProposedDispatchListResponse {
    status: number
    message: string
    data: {
        data: ProposedDispatchListRecord[]
        pagination: { total: number; page: number; rows: number; total_pages: number }
        /** Counts for the SAME filters, per dispatch status, plus the distinct farmers. */
        counts: { all: number; pending: number; approved: number; rejected: number; farmers: number }
    }
}
