// PORT-BOUND — what a PROPOSED Jobs list endpoint should support (design-first: jobs live in the browser's localStorage
// today). The mock data source reports anything the table sends outside this contract (src/mocks/server-table/contract-check.ts).
import type { TableApiContract } from "@/lib/server-table/contract";

export const jobsApiContract: TableApiContract = {
    feature: "task-planning",
    endpoint: null,
    source: "PROPOSED — no production endpoint; data comes from web/src/lib/orchestration/store.ts (localStorage)",
    pagination: "page",
    search: false,
    columnSearch: ["jobCode", "date", "surveyorName", "village"],
    sort: ["sortKey", "jobCode", "date", "surveyorName", "status", "stopCount", "taskCount", "distanceKm", "villages", "updatedAt"],
    filters: {
        tabStatus: "status (created | assigned | accepted | in_progress | closed) — the tab; counts per status",
        date: "date_from / date_to (YYYY-MM-DD, inclusive)",
        surveyorName: "surveyor_ids[]",
        village: "villages[] (jobs with a stop in any of them)",
    },
    notes: {
        endpoint: "Jobs are created by the planner (planJobs in web/src/lib/orchestration/jobs.ts) or by HQ adding tasks; a list endpoint over them is still to be designed.",
        sort: "Without sort_by the API must return the newest day first, then job number.",
        distanceKm: "Straight-line km today (base village → stops → base). With the routing key it becomes the routing service's road distance.",
    },
};
