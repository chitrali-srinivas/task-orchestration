// PROTOTYPE-ONLY — the single swap point between the Deployment V2 UI and its data (see data-mode.ts).
// mock: API-shaped rows from the V2 mock backend (mock-backend.ts) mapped through the port-bound adapter. The
//       table re-reads rows whenever a detail-sheet mutation (approve, report, …) changes the store.
// live: the v4 getDeploymentMetadata + getDeploymentStatusCounts APIs (live-api.ts), with the table query mapped
//       by query-mapper.ts. Status and counts are the API's; nothing is recalculated here.
"use client";

import * as React from "react";
import type { TableDataSource, TableResponse } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import type { EngagementFilters } from "@/app/layouts/deployment/data/table-config";
import type { DeploymentMetadataRow, DeploymentV2Record } from "./schema";
import { deploymentMetadataRows, getMockDeploymentStatusCounts } from "./mock-data";
import { getDeploymentRowsSnapshot, subscribeDeploymentStore } from "./mock-backend";
import { toDeploymentV2Record, toToolbarCounts } from "./adapter";
import { createDeploymentV2TableConfig } from "./table-config";
import { deploymentV2ApiContract } from "./api-contract";
import { isLiveMode } from "./data-mode";
import { mapTableQueryToV4 } from "./query-mapper";
import { fetchDeploymentMetadata, fetchDeploymentStatusCounts } from "./live-api";
import { getLiveRowsSnapshot, getLiveVersion, subscribeLiveStore } from "./live-store";

type DeploymentV2DataSource = TableDataSource<DeploymentV2Record, EngagementFilters>;

// ── mock ────────────────────────────────────────────────────────────────────────────────────────────

function useMockDeploymentRows(): DeploymentMetadataRow[] {
    return React.useSyncExternalStore(subscribeDeploymentStore, getDeploymentRowsSnapshot, getDeploymentRowsSnapshot);
}

function useMockDeploymentV2DataSource(): DeploymentV2DataSource {
    const rows = useMockDeploymentRows();
    const config = React.useMemo(() => createDeploymentV2TableConfig(rows.map(toDeploymentV2Record)), [rows]);
    return useMockTableDataSource(config, deploymentV2ApiContract);
}

// ── live ────────────────────────────────────────────────────────────────────────────────────────────

/** Live mode: rows re-read from the API after a mutation (live-store.ts); otherwise the sheet uses its row. */
function useLiveDeploymentRows(): DeploymentMetadataRow[] {
    return React.useSyncExternalStore(subscribeLiveStore, getLiveRowsSnapshot, getLiveRowsSnapshot);
}

const liveDataSource: DeploymentV2DataSource = {
    async fetch(query, signal): Promise<TableResponse<DeploymentV2Record>> {
        const { metadata, counts } = mapTableQueryToV4(query);
        const [list, statusCounts] = await Promise.all([
            fetchDeploymentMetadata(metadata, signal),
            fetchDeploymentStatusCounts(counts, signal),
        ]);
        const { total, page, rows, total_pages } = list.pagination;
        const offset = (page - 1) * rows;
        return {
            rows: list.rows.map((row, index) => toDeploymentV2Record(row, offset + index)),
            totalCount: total,
            page,
            pageSize: rows,
            pageCount: total_pages,
            hasNextPage: page < total_pages,
            hasPreviousPage: page > 1,
            summaryCounts: toToolbarCounts(statusCounts),
        };
    },
};

/** A new data-source identity after each mutation makes useServerTable refetch rows and counts. */
function useLiveDeploymentV2DataSource(): DeploymentV2DataSource {
    const version = React.useSyncExternalStore(subscribeLiveStore, getLiveVersion, getLiveVersion);
    return React.useMemo(() => {
        void version; // the identity change is the refetch signal
        return { fetch: (query, signal) => liveDataSource.fetch(query, signal) };
    }, [version]);
}

// ── exports (the mode is fixed per build, so each hook is chosen once) ─────────────────────────────

/** Deployment rows the detail sheet re-reads after a mutation (mock store; empty in live mode). */
export const useDeploymentRows = isLiveMode ? useLiveDeploymentRows : useMockDeploymentRows;

export const useDeploymentV2DataSource = isLiveMode ? useLiveDeploymentV2DataSource : useMockDeploymentV2DataSource;

/** Tab counts shown before the first response. Live: none (blank) until the counts endpoint responds. */
export const deploymentV2FallbackCounts = isLiveMode
    ? { all: Number.NaN, verified: Number.NaN, pending: Number.NaN, invalid: Number.NaN }
    : toToolbarCounts(getMockDeploymentStatusCounts(deploymentMetadataRows));
