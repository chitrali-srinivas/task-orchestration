// PORT-BOUND — maps the V2 table query onto the v4 getDeploymentMetadata / getDeploymentStatusCounts bodies.
// Anything the v4 contract cannot express (free-text search, column search, unsupported sort or filter) is
// rejected with UnsupportedQueryError instead of being dropped, so the table shows the mismatch.
import type { TableQuery } from "@/lib/server-table/types"
import type { EngagementFilters } from "@/app/layouts/deployment/data/table-config"
import type {
    DeploymentMetadataRequest,
    DeploymentSortBy,
    DeploymentStatusCountsRequest,
    DeploymentStatusFilter,
} from "./schema"

export class UnsupportedQueryError extends Error {
    constructor(readonly unsupported: string[]) {
        super(`Not supported by the live Deployment API: ${unsupported.join("; ")}. Clear it to continue.`)
        this.name = "UnsupportedQueryError"
    }
}

/** Table column id → v4 `sort_by` (the contract's whitelist; verified_at / deployment_num are not sortable). */
export const SORT_BY_COLUMN: Record<string, DeploymentSortBy> = {
    submittedOn: "created_at",
    farmer: "farmer_name",
    village: "village_name",
    azs: "az_code",
    azName: "az_name",
    status: "status",
    surveyor: "surveyor_name",
    verifiedBy: "verified_by",
    plots: "plots",
    area: "actual_area",
    calArea: "calculated_area",
    deployed: "deployed_amount",
}

/** UI status labels (tabs and the sidebar Status filter) → v4 `status`. */
const STATUS_BY_LABEL: Record<string, DeploymentStatusFilter> = {
    All: "all",
    Verified: "approved",
    Pending: "pending",
    Invalid: "need_correction",
    "Need Correction": "need_correction",
}

/** Filter keys the mapper translates; every other active filter key is unsupported. */
const MAPPED_FILTERS = new Set(["status", "farmer", "village", "azs", "surveyor", "verifiedBy", "submittedOn", "verifiedOn"])

function isActive(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return false
    if (Array.isArray(value)) return value.some((v) => v !== undefined && v !== null && v !== "")
    if (typeof value === "object" && !(value instanceof Date)) {
        const o = value as Record<string, unknown>
        return Object.values(o).some((v) => v !== undefined && v !== null && v !== "")
    }
    return true
}

function toList(value: unknown): string[] {
    if (value === undefined || value === null || value === "") return []
    return (Array.isArray(value) ? value : [value]).filter((v) => v !== undefined && v !== null && v !== "").map(String)
}

function toDateRange(value: unknown): { from?: number; to?: number } {
    if (!isActive(value)) return {}
    const [from, to] = Array.isArray(value)
        ? value
        : [(value as { from?: Date }).from, (value as { to?: Date }).to]
    const epoch = (d: unknown) => (d ? new Date(d as Date).getTime() : undefined)
    return { from: epoch(from), to: epoch(to) }
}

export interface DeploymentQueryBodies {
    metadata: DeploymentMetadataRequest
    counts: DeploymentStatusCountsRequest
}

export function mapTableQueryToV4(query: TableQuery<EngagementFilters>): DeploymentQueryBodies {
    const unsupported: string[] = []
    const filters = (query.filters ?? {}) as Record<string, unknown>

    if (query.search?.trim()) unsupported.push("free-text search")
    for (const [column, value] of Object.entries(query.columnSearches ?? {})) {
        if (value?.trim()) unsupported.push(`column search on "${column}"`)
    }
    for (const [key, value] of Object.entries(filters)) {
        if (isActive(value) && !MAPPED_FILTERS.has(key)) unsupported.push(`filter "${key}"`)
    }
    if (query.sort && !SORT_BY_COLUMN[query.sort.field]) unsupported.push(`sort by "${query.sort.field}"`)

    // Status: tab (single label) or sidebar Status filter (labels). v4 takes one status value.
    const statusLabels = toList(filters.status)
    let status: DeploymentStatusFilter = "all"
    if (statusLabels.length > 1) unsupported.push("more than one Status value")
    else if (statusLabels.length === 1) {
        const mapped = STATUS_BY_LABEL[statusLabels[0]]
        if (mapped) status = mapped
        else unsupported.push(`status "${statusLabels[0]}"`)
    }

    // Id filters: option values are ids (farmer_id / village_id / AZ id) or phone numbers (surveyor / verifier).
    const numericIds = (key: string, label: string): number[] | undefined => {
        const values = toList(filters[key])
        if (values.length === 0) return undefined
        const ids = values.map(Number)
        const invalid = values.filter((_, i) => !Number.isFinite(ids[i]))
        if (invalid.length > 0) unsupported.push(`${label} filter needs ids (got "${invalid.join('", "')}")`)
        return ids
    }
    const phoneIds = (key: string): string[] | undefined => {
        const values = toList(filters[key])
        return values.length > 0 ? values : undefined
    }

    const created = toDateRange(filters.submittedOn)
    const verified = toDateRange(filters.verifiedOn)

    const counts: DeploymentStatusCountsRequest = {
        ...(created.from !== undefined && { created_at_start: created.from }),
        ...(created.to !== undefined && { created_at_end: created.to }),
        ...(verified.from !== undefined && { verified_on_start_date: verified.from }),
        ...(verified.to !== undefined && { verified_on_end_date: verified.to }),
    }
    const farmerIds = numericIds("farmer", "Farmer")
    const villageIds = numericIds("village", "Village")
    const azIds = numericIds("azs", "AZ")
    const surveyorIds = phoneIds("surveyor")
    const verifierIds = phoneIds("verifiedBy")
    if (farmerIds) counts.farmer_ids = farmerIds
    if (villageIds) counts.village_ids = villageIds
    if (azIds) counts.az_ids = azIds
    if (surveyorIds) counts.surveyor_ids = surveyorIds
    if (verifierIds) counts.verifier_ids = verifierIds

    if (unsupported.length > 0) throw new UnsupportedQueryError(unsupported)

    const metadata: DeploymentMetadataRequest = {
        ...counts,
        status,
        ...(query.sort && { sort_by: SORT_BY_COLUMN[query.sort.field], sort_order: query.sort.direction }),
        rows: query.pageSize,
        page: query.page,
    }
    // Counts: same filters, without status (each tab needs its own count), pagination or sorting.
    return { metadata, counts }
}
