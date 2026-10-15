// PROTOTYPE-ONLY — mock server rules for the Deployment V2 table: the existing Deployment rules, with tab
// counts taken from the API-shaped getDeploymentStatusCounts mock.
import type { TableConfig } from "@/mocks/server-table";
import { createDeploymentTableConfig, type EngagementFilters } from "@/app/layouts/deployment/data/table-config";
import type { EngagementRecord } from "@/app/layouts/deployment/data/schema";
import type { DeploymentV2Record } from "./schema";
import { getMockDeploymentStatusCounts } from "./mock-data";
import { toToolbarCounts } from "./adapter";

export function createDeploymentV2TableConfig(dataset: DeploymentV2Record[]): TableConfig<DeploymentV2Record, EngagementFilters> {
    return {
        // Mock rows always carry a valid created_at, so submittedOn is always a Date here.
        ...createDeploymentTableConfig(dataset as EngagementRecord[]),
        dataset,
        calculateSummaryCounts: (rows) => toToolbarCounts(getMockDeploymentStatusCounts(rows.map((row) => row.api))),
    } as TableConfig<DeploymentV2Record, EngagementFilters>;
}
