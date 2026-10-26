// PORT-BOUND — what a PROPOSED Tasks list endpoint should support (design-first: tasks live in the browser's
// localStorage today, and the Supabase prototype in supabase/migrations has no list API). The mock data source
// reports anything the table sends outside this contract (src/mocks/server-table/contract-check.ts).
import type { TableApiContract } from "@/lib/server-table/contract";

export const tasksApiContract: TableApiContract = {
    feature: "tasks",
    endpoint: null,
    source: "PROPOSED — no production endpoint; data comes from web/src/lib/orchestration/store.ts (localStorage)",
    pagination: "page",
    search: false,
    columnSearch: ["taskCode", "surveyName", "farmerName", "village", "assignedTo", "visitDate", "createdFrom", "plannedStart", "plannedEnd"],
    sort: ["taskNo", "taskCode", "surveyName", "farmerName", "village", "status", "assignedTo", "visitDate", "plannedStart", "plannedEnd", "createdFrom", "updatedAt"],
    filters: {
        tabStatus: "status (planned | collected | verified | expired | cancelled | custom template status) — the tab; counts per status",
        surveyName: "survey_ids[]",
        farmerName: "farmer_ids[]",
        village: "villages[]",
        createdFrom: "origin[] (registration | follow-up)",
        plannedStart: "planned_start_from / planned_start_to (YYYY-MM-DD, inclusive)",
        plannedEnd: "planned_end_from / planned_end_to (YYYY-MM-DD, inclusive; indefinite tasks never match)",
        assignedTo: "surveyor_ids[] (\"unassigned\" = on no published route)",
        visitDate: "visit_date_from / visit_date_to (YYYY-MM-DD, inclusive; unassigned tasks never match)",
    },
    notes: {
        endpoint: "Tasks are created by the orchestration engine (web/src/lib/orchestration/engine.ts); a list endpoint over them is still to be designed.",
        sort: "Without sort_by the API must return the work-queue order: status level (template lifecycle order, pending first), then planned start oldest first, then task number. Pending tasks in this order feed route planning for surveyor assignment.",
        assignedTo: "Assigned to / visit date / stop come from published routes (one per surveyor per day, one stop per farmer visit; web/src/lib/orchestration/routes.ts), joined onto each task row. They are not task fields.",
    },
};
