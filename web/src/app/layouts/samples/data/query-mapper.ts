// PORT-BOUND — maps the shared table query (src/lib/server-table TableQuery) onto the PROPOSED ListSamplesRequest.
// Deployment V2's query-mapper.ts does the same for the v4 Deployment contract. There is no free-text or column
// search here (as in Deployment V2); filters send ids and epoch ranges, sort sends a whitelisted field name.
import type { TableQuery } from "@/lib/server-table/types"
import type { ListSamplesRequest, SampleKind, SamplePurpose, SampleSortField, StatusBucket } from "../domain/types"

/** The table's filter state (column filter ids → values from the filter sheet; `bucket` from the tabs). */
export interface SamplesTableFilters {
    bucket?: StatusBucket | "all"
    farmer?: string[]
    village?: string[]
    /** AZ ids as strings (filter-sheet values are strings). */
    az?: string[]
    kinds?: SampleKind[]
    purposes?: SamplePurpose[]
    surveyor?: string[]
    verifiedBy?: string[]
    boundary?: ("required" | "none_required")[]
    submitted?: { from?: Date | string; to?: Date | string }
}

/** Table column id → API `sort_by` (the whitelist; everything else is ignored, as the contract check reports). */
export const SORT_FIELD: Record<string, SampleSortField> = {
    submittedOn: "submitted",
    sample: "sample_code",
    farmer: "farmer",
    village: "village",
    kind: "kind",
    purpose: "purpose",
    plot: "plot",
    azs: "az",
    azName: "az_name",
    surveyor: "surveyor",
    verifiedBy: "verified_by",
    verifiedOn: "verified_on",
}

const list = <T extends string>(value: T[] | undefined): T[] | undefined => (value && value.length > 0 ? value : undefined)

/** Start of the `from` day / end of the `to` day, epoch ms (a one-day range matches the whole day). */
const dayStart = (d: Date | string | undefined) => {
    if (!d) return undefined
    const t = new Date(d)
    return Number.isNaN(t.getTime()) ? undefined : new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
}
const dayEnd = (d: Date | string | undefined) => {
    const start = dayStart(d)
    return start === undefined ? undefined : start + 24 * 60 * 60 * 1000 - 1
}

export function toListSamplesRequest(query: TableQuery<SamplesTableFilters>): ListSamplesRequest {
    const f = query.filters ?? {}
    const azIds = list(f.az)?.map(Number).filter((n) => Number.isFinite(n))
    const sortBy = query.sort ? SORT_FIELD[query.sort.field] : undefined
    return {
        bucket: f.bucket ?? "all",
        page: query.page,
        page_size: query.pageSize,
        farmer_ids: list(f.farmer),
        village_ids: list(f.village),
        az_ids: azIds && azIds.length > 0 ? azIds : undefined,
        kinds: list(f.kinds),
        purposes: list(f.purposes),
        surveyor_ids: list(f.surveyor),
        verifier_ids: list(f.verifiedBy),
        boundary: list(f.boundary),
        submitted_from: dayStart(f.submitted?.from),
        submitted_to: dayEnd(f.submitted?.to),
        sort_by: sortBy,
        sort_dir: sortBy && query.sort ? query.sort.direction : undefined,
    }
}
