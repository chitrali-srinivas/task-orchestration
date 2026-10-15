// PROTOTYPE-ONLY — mock server rules for the Deployment table (reuses the Engagement mock rules).
import type { TableConfig } from "@/mocks/server-table";
import { EngagementRecord } from "./schema";
import { EngagementFilters, createEngagementTableConfig } from "@/app/layouts/engagement/data/table-config";

export type { EngagementFilters };

export function createDeploymentTableConfig(dataset: EngagementRecord[]): TableConfig<EngagementRecord, EngagementFilters> {
    return createEngagementTableConfig(dataset);
}
