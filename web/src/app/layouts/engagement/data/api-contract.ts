// PORT-BOUND — production API capabilities for the Engagement table (verified read-only in matic-dash).
import type { TableApiContract } from "@/lib/server-table/contract";

export const engagementApiContract: TableApiContract = {
    feature: "engagement",
    endpoint: "POST /adminEngagementSec/v4/getEngagementMetadata",
    source:
        "matic-dash@86e9fa7 src/components/table-configs/adapters/engagement.adapter.ts (mapEngagementFiltersToApiQuery), src/components/engagement/api/engagement.api.ts",
    pagination: "page",
    search: false,
    columnSearch: [],
    sort: [],
    filters: {
        status: "status: pending | approved | rejected (from the tab or the sidebar Status field)",
        submittedOn: "start_date / end_date (epoch ms, start/end of day)",
        farmer: "farmer_ids[]",
        engagementType: "engagement_type[] (numeric type ids)",
        village: "village_ids[]",
        azs: "az_ids[]",
        surveyor: "surveyor_ids[]",
        verifiedBy: "verifier_ids[]",
        verifiedOn: "verified_on_start_date / verified_on_end_date (epoch ms)",
    },
    notes: {
        farmer: "Prototype filters by farmer name; production filters by farmer id, with options from GET /adminFarmApp/v4/getAllFarmersList {page, rows, search}. Same multi-select UX.",
        village: "Production options: GET /adminFarmApp/v4/getVillageList {page, rows, search}.",
        base: "No base request parameter; production scopes rows to the user's current base (base context).",
        counts: "Tab counts: POST /adminEngagementSec/v4/getEngagementStatusCounts with the same request body (counts follow filters).",
        sort: "Production sorts only the rows already loaded (client-side); no sort parameter.",
        pagination: "Production UI loads pages of `rows` with infinite scroll (has more = page < total_pages).",
    },
};
