// PORT-BOUND — production API capabilities for the Deployment V2 table (the v4 Deployment contract).
// The existing table UI is kept as-is; anything it sends that this contract does not support is reported
// by the mock data source as a "[C] backend requirement" (see src/mocks/server-table/contract-check.ts).
import type { TableApiContract } from "@/lib/server-table/contract";

export const deploymentV2ApiContract: TableApiContract = {
    feature: "deployment-v2",
    endpoint: "POST /adminFarmApp/v4/getDeploymentMetadata (+ POST /adminFarmApp/v4/getDeploymentStatusCounts)",
    source: "Deployment API contract v4 (getDeploymentMetadata / getDeploymentStatusCounts)",
    pagination: "page",
    search: false,
    columnSearch: [],
    // Table column ids that map onto the API `sort_by` values.
    sort: ["submittedOn", "farmer", "village", "azs", "azName", "status", "surveyor", "verifiedBy", "plots", "area", "calArea", "deployed"],
    filters: {
        status: "status (all | approved | pending | need_correction)",
        farmer: "farmer_ids[] (ids from /adminFarmApp/v4/getAllFarmersList)",
        village: "village_ids[] (ids from /adminFarmApp/v4/getVillageList)",
        azs: "az_ids[] (ids from /adminFarmApp/v4/getAllAzData)",
        surveyor: "surveyor_ids[] (from /adminFarmApp/v4/getAllActiveSurveyorsList)",
        verifiedBy: "verifier_ids[] (from /adminFarmApp/v4/getVerifiersList)",
        submittedOn: "created_at_start / created_at_end (epoch ms)",
        verifiedOn: "verified_on_start_date / verified_on_end_date (epoch ms)",
    },
    notes: {
        sort: "sort_by fields: created_at, epoch_date, farmer_name, village_name, az_code, az_name, status, surveyor_name, verified_by, plots, actual_area, calculated_area, deployed_amount. verified_at is not sortable.",
        deployed: "No deployed_amount range filter in the contract.",
        matiDeployed: "No deployed_amount range filter in the contract.",
        search: "No free-text search in the contract; column filters send ids.",
    },
};
