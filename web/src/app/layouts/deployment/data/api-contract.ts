// PORT-BOUND — production API capabilities for the Deployment table (verified read-only in matic-dash).
import type { TableApiContract } from "@/lib/server-table/contract";

export const deploymentApiContract: TableApiContract = {
    feature: "deployment",
    endpoint: "POST /adminFarmApp/v3/getDeploymentData (mapping to confirm — see notes)",
    source: "matic-dash@86e9fa7 src/services/api.ts (getDeploymentData, getDeploymentVerificationData)",
    pagination: "page",
    search: false,
    columnSearch: [],
    sort: [],
    filters: {
        submittedOn: "start_date / end_date (epoch ms)",
        village: "village_id[]",
        azs: "az_id[] (getDeploymentVerificationData only)",
    },
    notes: {
        endpoint:
            "Production has two deployment list calls: getDeploymentData (overview) and getDeploymentVerificationData (verification, also accepts az_id). Which one this prototype table maps to is a product/backend decision.",
        status: "Neither production call accepts a status parameter; the Verified / Pending / Need Correction tabs need API support.",
        azs_fixed: "The production client always sends az_ids: [1, 2, 3].",
        pagination: "Production requests rows: 500 per page.",
    },
};
