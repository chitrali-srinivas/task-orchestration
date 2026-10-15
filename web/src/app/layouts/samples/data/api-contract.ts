// PORT-BOUND — what the PROPOSED Samples list endpoint supports (design-first: there is no Samples list API in
// matic-dash yet — verification there reads one farmer's samples at a time via getControlFieldsData / the
// verification payloads). The mock data source reports anything the table sends outside this contract
// (src/mocks/server-table/contract-check.ts), exactly as Deployment V2's api-contract.ts does for the v4 contract.
import type { TableApiContract } from "@/lib/server-table/contract"

export const samplesApiContract: TableApiContract = {
    feature: "samples",
    endpoint: null,
    source: "PROPOSED — docs/samples/samples-feature-discovery-and-design.md §API; matic-dash has no sample list endpoint (read-only audit of adminFarmApp sample / control-field calls)",
    pagination: "page",
    // Deployment V2 has no free-text or column search; neither does Samples.
    search: false,
    columnSearch: [],
    // Table column ids that map onto `sort_by` (data/query-mapper.ts SORT_FIELD).
    sort: ["submittedOn", "sample", "farmer", "village", "kind", "purpose", "plot", "azs", "azName", "surveyor", "verifiedBy", "verifiedOn"],
    filters: {
        bucket: "bucket (all | approved | pending | need_correction) — the tab; counts are returned per bucket for the same filters",
        farmer: "farmer_ids[] (ids from GET /samples/filter-options)",
        village: "village_ids[]",
        az: "az_ids[]",
        kinds: "kinds[] (deployment | control)",
        purposes: "purposes[] (pre | start | harvest | eoy | eo3y | eo5y)",
        surveyor: "surveyor_ids[]",
        verifiedBy: "verifier_ids[]",
        boundary: "boundary[] (required | none_required) — server-computed boundary state",
        submitted: "submitted_from / submitted_to (epoch ms, inclusive day range)",
    },
    notes: {
        sort: "sort_by: submitted, sample_code, farmer, village, kind, purpose, plot, az, az_name, surveyor, verified_by, verified_on.",
        search: "No free-text search (as Deployment V2); filters send ids.",
        status: "The Status column is display-only (the tab is the status filter), as in Deployment V2's All tab.",
    },
}
