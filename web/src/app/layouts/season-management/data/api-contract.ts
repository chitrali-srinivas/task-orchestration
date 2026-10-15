// PORT-BOUND — production API capabilities for the Season Management table.
// matic-dash has no Season Management feature or API (searched read-only at 86e9fa7), so every
// query parameter this prototype uses is a backend requirement.
import type { TableApiContract } from "@/lib/server-table/contract";

export const seasonApiContract: TableApiContract = {
    feature: "season-management",
    endpoint: null,
    source: "matic-dash@86e9fa7: no season list endpoint found",
    pagination: "none",
    search: false,
    columnSearch: [],
    sort: [],
    filters: {},
    notes: {
        endpoint: "New feature: list, create and update endpoints are all backend requirements.",
    },
};
