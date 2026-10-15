// PROTOTYPE-ONLY — the single swap point between the Engagement UI and its data.
// mati-demo: in-memory mock. Production: replace this file with an API-backed TableDataSource
// (map TableQuery → production request, call the API, map the response → TableResponse).
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import { engagementData } from "./mock-data";
import { EngagementRecord, EngagementFilters } from "./schema";
import { createEngagementTableConfig } from "./table-config";
import { engagementApiContract } from "./api-contract";

export function useEngagementDataSource(): TableDataSource<EngagementRecord, EngagementFilters> {
    const config = React.useMemo(() => createEngagementTableConfig(engagementData), []);
    return useMockTableDataSource(config, engagementApiContract);
}

/** Tab counts shown before the first response arrives. Production: undefined until the counts endpoint responds. */
export const engagementFallbackCounts = {
    verified: engagementData.filter(item => item.status === "Verified").length,
    pending: engagementData.filter(item => item.status === "Pending").length,
    invalid: engagementData.filter(item => item.status === "Invalid").length,
};
