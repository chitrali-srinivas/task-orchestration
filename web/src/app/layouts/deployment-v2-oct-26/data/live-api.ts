// PORT-BOUND (endpoints and response checks) — live Deployment V2 calls against the Matic admin API.
// Connected: v4 list + counts, v4 filter lookups, the detail reads (trailer / NOC + pre-sampling / report history)
// and the detail mutations (dispatch approve / reject, report, NOC decision, plot comment, soft delete). Failures always
// surface — live mode never falls back to the mock backend.
import { ApiError, matiApi } from "./api-client"
import type {
    AzLookupItem,
    DeploymentMetadataRequest,
    DeploymentMetadataResponse,
    DeploymentStatusCountsRequest,
    DeploymentStatusCountsResponse,
    FarmerLookupItem,
    LookupListResponse,
    SurveyorLookupItem,
    VerifierLookupItem,
    VillageLookupItem,
} from "./schema"
import type { DeploymentApi } from "./deployment-api"
import { normalizeNocDetails, normalizeReportHistory, normalizeTrailerDetails } from "./live-normalize"

export const DEPLOYMENT_ENDPOINTS = {
    metadata: "/adminFarmApp/v4/getDeploymentMetadata",
    counts: "/adminFarmApp/v4/getDeploymentStatusCounts",
    farmers: "/adminFarmApp/v4/getAllFarmersList",
    villages: "/adminFarmApp/v4/getVillageList",
    azs: "/adminFarmApp/v4/getAllAzData",
    surveyors: "/adminFarmApp/v4/getAllActiveSurveyorsList",
    verifiers: "/adminFarmApp/v4/getVerifiersList",
    trailerDetails: "/adminDeploymentSec/v3/getTrailerDetails",
    nocDetails: "/adminFarmApp/v3/getDeploymentNocDetails",
    reportHistory: "/adminDeploymentSec/v3/getFarmerReportedHistory",
    updateDispatch: "/adminFarmApp/v3/updateDeploymentTrailerDispatch",
    reportFarmerDetails: "/adminDeploymentSec/v3/reportFarmerDetails",
    nocDecision: "/adminDeploymentSec/updateFarmerDeploymentNOC",
    comment: "/adminDeploymentSec/v3/comment",
    softDelete: "/adminDeploymentSec/v3/softDeleteDispatch",
    uploadGeoJson: "/adminDeploymentSec/uploadGeoJsonData",
} as const

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

function contractError(endpoint: string, expected: string, body: unknown): ApiError {
    const snippet = JSON.stringify(body)?.slice(0, 300)
    return new ApiError(`POST ${endpoint} returned an unexpected response (expected ${expected}): ${snippet}`, 200, endpoint, body)
}

// ── v4 list ─────────────────────────────────────────────────────────────────────────────────────────

export async function fetchDeploymentMetadata(request: DeploymentMetadataRequest, signal?: AbortSignal) {
    const { body } = await matiApi.post<DeploymentMetadataResponse>(DEPLOYMENT_ENDPOINTS.metadata, request, signal)
    const pagination = body?.data?.pagination
    if (!Array.isArray(body?.data?.data) || !pagination || ![pagination.total, pagination.page, pagination.rows, pagination.total_pages].every(isNumber)) {
        throw contractError(DEPLOYMENT_ENDPOINTS.metadata, "{ data: { data: [], pagination: { total, page, rows, total_pages } } }", body)
    }
    return { rows: body.data.data, pagination }
}

export async function fetchDeploymentStatusCounts(request: DeploymentStatusCountsRequest, signal?: AbortSignal) {
    const { body } = await matiApi.post<DeploymentStatusCountsResponse>(DEPLOYMENT_ENDPOINTS.counts, request, signal)
    const counts = body?.data
    if (!counts || ![counts.all, counts.approved, counts.pending, counts.need_correction].every(isNumber)) {
        throw contractError(DEPLOYMENT_ENDPOINTS.counts, "{ data: { all, approved, pending, need_correction } }", body)
    }
    return counts
}

// ── v4 filter lookups (option value = what the list filter expects) ────────────────────────────────

export interface FilterOption {
    label: string
    value: string
}

/**
 * The V2 sidebar searches its option list locally, so every lookup page is loaded (matic-dash instead pages with
 * server search). Pages come from `pagination.total_pages`; MAX_LOOKUP_PAGES bounds the request count.
 */
export const LOOKUP_PAGE_SIZE = 500
const MAX_LOOKUP_PAGES = 40
const LOOKUP_CONCURRENCY = 4

async function fetchLookupPage<TItem>(endpoint: string, page: number) {
    const { body } = await matiApi.get<LookupListResponse<TItem>>(endpoint, { page, rows: LOOKUP_PAGE_SIZE, search: "" })
    const items = body?.data?.data
    if (!Array.isArray(items)) throw contractError(endpoint, "{ data: { data: [] } }", body)
    return { items, totalPages: body.data?.pagination?.total_pages }
}

async function fetchLookup<TItem>(endpoint: string, toOption: (item: TItem) => FilterOption | null) {
    const first = await fetchLookupPage<TItem>(endpoint, 1)
    const totalPages = isNumber(first.totalPages) ? first.totalPages : 1
    // Options must never look complete when they are not: beyond the bound the lookup fails explicitly.
    if (totalPages > MAX_LOOKUP_PAGES) {
        throw new ApiError(`GET ${endpoint} has ${totalPages} pages of ${LOOKUP_PAGE_SIZE}; more than the ${MAX_LOOKUP_PAGES} pages V2 loads.`, 200, endpoint)
    }
    const pages: TItem[][] = [first.items]
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    for (let i = 0; i < remaining.length; i += LOOKUP_CONCURRENCY) {
        const batch = await Promise.all(remaining.slice(i, i + LOOKUP_CONCURRENCY).map((page) => fetchLookupPage<TItem>(endpoint, page)))
        pages.push(...batch.map((b) => b.items))
    }
    const options = pages.flat().map(toOption).filter((o): o is FilterOption => o !== null)
    return { options, pagesLoaded: pages.length, totalPages }
}

export const lookupApi = {
    farmers: () => fetchLookup<FarmerLookupItem>(DEPLOYMENT_ENDPOINTS.farmers, (item) =>
        item.farmer_id === undefined || item.farmer_id === null ? null
            : { value: String(item.farmer_id), label: item.farmer_name?.trim() || String(item.farmer_id) }),
    villages: () => fetchLookup<VillageLookupItem>(DEPLOYMENT_ENDPOINTS.villages, (item) =>
        item.village_id === undefined || item.village_id === null ? null
            : { value: String(item.village_id), label: item.village_name?.trim() || String(item.village_id) }),
    azs: () => fetchLookup<AzLookupItem>(DEPLOYMENT_ENDPOINTS.azs, (item) =>
        item.id === undefined || item.id === null ? null
            : { value: String(item.id), label: [item.az_code, item.az_name?.trim()].filter(Boolean).join(" - ") || `AZ ${item.id}` }),
    // Surveyor / verifier filters take phone numbers; entries without one cannot be filtered on and are skipped.
    surveyors: () => fetchLookup<SurveyorLookupItem>(DEPLOYMENT_ENDPOINTS.surveyors, (item) =>
        item.phone_no ? { value: item.phone_no, label: item.surveyor_name?.trim() || item.phone_no } : null),
    verifiers: () => fetchLookup<VerifierLookupItem>(DEPLOYMENT_ENDPOINTS.verifiers, (item) =>
        item.phone_no ? { value: item.phone_no, label: item.verifier_name?.trim() || item.phone_no } : null),
}

// ── Detail reads (response `data` normalized at this boundary) ────────────────────────────────────

type DataEnvelope = { data?: unknown }

/** getFarmerReportedHistory answers a farmer without history with HTTP 404 "No data found" (observed on dev). */
const isNoHistoryResponse = (error: unknown) =>
    error instanceof ApiError && error.status === 404 && /no data found/i.test(error.message)

async function fetchReportHistory(request: unknown) {
    try {
        return normalizeReportHistory((await matiApi.post<DataEnvelope>(DEPLOYMENT_ENDPOINTS.reportHistory, request)).body?.data)
    } catch (error) {
        if (isNoHistoryResponse(error)) return normalizeReportHistory(null)
        throw error
    }
}

// ── Mutations: the HTTP status is the result (matic-dash treats exactly 200 as success). Non-2xx responses and
//    auth-failure bodies already throw in the client, so a failed call can never read as success. ─────────────
const mutation = async (method: "post" | "patch", path: string, body: unknown) => ({ status: (await matiApi[method]<unknown>(path, body)).status })

export const liveDeploymentApi: Omit<DeploymentApi, "reconcile"> = {
    getTrailerDetails: async (request) => normalizeTrailerDetails((await matiApi.post<DataEnvelope>(DEPLOYMENT_ENDPOINTS.trailerDetails, request)).body?.data),
    getDeploymentNocDetails: async (request) => normalizeNocDetails((await matiApi.post<DataEnvelope>(DEPLOYMENT_ENDPOINTS.nocDetails, request)).body?.data),
    getFarmerReportedHistory: (request) => fetchReportHistory(request),
    updateDeploymentTrailerDispatch: (request) => mutation("patch", DEPLOYMENT_ENDPOINTS.updateDispatch, request),
    reportFarmerDetails: (request) => mutation("post", DEPLOYMENT_ENDPOINTS.reportFarmerDetails, request),
    updateFarmerDeploymentNOC: (request) => mutation("patch", DEPLOYMENT_ENDPOINTS.nocDecision, request),
    // The real comment response is `data.data` (matic-dash ignores it); success is the HTTP status, as for the others.
    updateComment: (request) => mutation("patch", DEPLOYMENT_ENDPOINTS.comment, request),
    // matic-dash deleteDeploymentTrailer: PATCH, success = HTTP 200.
    softDeleteDispatch: (request) => mutation("patch", DEPLOYMENT_ENDPOINTS.softDelete, request),
    // matic-dash uploadGeoJson: POST; it treats a resolved request as success (V2: HTTP 200, as for the others).
    uploadGeoJson: (request) => mutation("post", DEPLOYMENT_ENDPOINTS.uploadGeoJson, request),
}
