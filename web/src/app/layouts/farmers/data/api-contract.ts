// PORT-BOUND — what a PROPOSED Farmers list endpoint should support (design-first: farmers live in the browser's
// localStorage today). The mock data source reports anything the table sends outside this contract
// (src/mocks/server-table/contract-check.ts).
import type { TableApiContract } from "@/lib/server-table/contract";

export const farmersApiContract: TableApiContract = {
    feature: "farmers",
    endpoint: null,
    source: "PROPOSED — no production endpoint; data comes from web/src/lib/orchestration/store.ts (localStorage)",
    pagination: "page",
    search: false,
    columnSearch: ["name", "village", "locationSource", "registeredOn", "nextJobCode", "nextVisit"],
    sort: ["name", "village", "locationSource", "registeredAt", "registeredOn", "taskCount", "planned", "collected", "verified", "nextJobCode", "nextVisit"],
    filters: {
        tabLocation: "location_source (gps | plot | village | none) — the tab; counts per source",
        village: "villages[]",
        locationSource: "location_sources[]",
        registeredOn: "registered_from / registered_to (YYYY-MM-DD, inclusive)",
        nextVisit: "next_visit_from / next_visit_to (YYYY-MM-DD, inclusive; farmers on no open job never match)",
    },
    notes: {
        endpoint: "Farmers are created when the phone submits the workflow's first survey (registration); a list endpoint over them is still to be designed.",
        sort: "Without sort_by the API must return the newest registrations first.",
        locationSource: "The registration's GPS point, else its plot boundary's centre, else the centre of the farmer's village (Villages master); planning can't place a farmer with none.",
    },
};
