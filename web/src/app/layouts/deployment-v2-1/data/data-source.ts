// PROTOTYPE-ONLY — the single swap point between the Deployment V2 UI and its data (see data-mode.ts).
// mock: API-shaped rows from the V2 mock backend (mock-backend.ts) mapped through the port-bound adapter. The
//       table re-reads rows whenever a detail-sheet mutation (approve, report, …) changes the store.
// live: the v4 getDeploymentMetadata + getDeploymentStatusCounts APIs (live-api.ts), with the table query mapped
//       by query-mapper.ts. Status and counts are the API's; nothing is recalculated here.
"use client";

import * as React from "react";
import type { TableDataSource, TableResponse } from "@/lib/server-table";
import { MockTableService, useMockTableDataSource, withApiContract } from "@/mocks/server-table";
import type { EngagementFilters } from "@/app/layouts/deployment/data/table-config";
import type { DeploymentMetadataRow, DeploymentV2Record } from "./schema";
import { getMockDeploymentStatusCounts } from "./mock-data";
import { getDispatchRowsSnapshot, mockDefaultListSort, subscribeDeploymentStore } from "./mock-backend";
import { toDeploymentV2Record, toToolbarCounts } from "./adapter";
import { createDeploymentV2TableConfig } from "./table-config";
import { dispatchQuantities } from "./dispatch-rows";
import { deploymentV2ApiContract } from "./api-contract";
import { isLiveMode } from "./data-mode";
import { mapTableQueryToV4, SORT_BY_COLUMN } from "./query-mapper";
import { readReportedSort, type WithReportedSort } from "./reported-sort";
import { fetchDeploymentMetadata, fetchDeploymentStatusCounts } from "./live-api";
import { getLiveRowsSnapshot, getLiveVersion, subscribeLiveStore } from "./live-store";
import { DEPLOYMENT_ENDPOINTS } from "./live-api";
import { deploymentTrace } from "./api-trace";

type DeploymentV2DataSource = TableDataSource<DeploymentV2Record, EngagementFilters>;

/**
 * V2.1: the tab counts when the counts read failed or sent no usable numbers — "unknown", never a guess and never the
 * previous query's counts (useServerTable keeps the last counts it received, so a response always carries counts).
 */
export const UNAVAILABLE_COUNTS = { all: Number.NaN, verified: Number.NaN, pending: Number.NaN, invalid: Number.NaN };

// ── mock ────────────────────────────────────────────────────────────────────────────────────────────

/** V2.1: the mock's list rows at the live grain — one per dispatch (mock-backend.ts getDispatchRowsSnapshot). */
function useMockDeploymentRows(): DeploymentMetadataRow[] {
    return React.useSyncExternalStore(subscribeDeploymentStore, getDispatchRowsSnapshot, getDispatchRowsSnapshot);
}

/**
 * V2.1: the mock's getDeploymentStatusCounts — dispatch counts per status for the SAME filters as the page, without
 * the status (as the live endpoint is called: query-mapper.ts `counts`), computed by the same in-memory filter.
 */
function withMockCounts(source: DeploymentV2DataSource, counter: DeploymentV2DataSource): DeploymentV2DataSource {
    /** ?mockFail=counts → every counts read "fails": the rows load, the tab counts are unavailable (never guessed). */
    const countsFail = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "counts";
    return {
        async fetch(query, signal) {
            if (countsFail) return { ...(await source.fetch(query, signal)), summaryCounts: UNAVAILABLE_COUNTS };
            const filters = { ...(query.filters ?? {}) } as EngagementFilters & { status?: unknown };
            delete filters.status;
            const [page, all] = await Promise.all([
                source.fetch(query, signal),
                counter.fetch({ ...query, filters, page: 1, pageSize: 1_000_000, sort: null }, signal),
            ]);
            return { ...page, summaryCounts: toToolbarCounts(getMockDeploymentStatusCounts(all.rows.map((record) => record.api))) };
        },
    };
}

/**
 * V2.1: the person columns sort by the person's NAME, as the v4 API does (query-mapper.ts SORT_BY_COLUMN: farmer →
 * farmer_name, surveyor → surveyor_name). The in-memory mock sorts on the record field named by the column id, and
 * `farmer` / `surveyor` are objects there — every comparison tied, so Asc / Desc changed nothing (the header showed
 * the arrow while the rows stayed put). The mock is pointed at the name; the contract check still sees the column id.
 */
// Verified By / Status: the row's own verified_by / status, the fields the API sorts by (the record has no verifiedBy).
// Area / Cal. Area / Deployed: the shared mock compares numbers as DATES first (mock-table-service.ts parseDateValue:
// new Date(2.5) is 2 ms), so 2.12 / 2.5 / 2.15 tied and the decimal columns didn't sort; they sort on the value in
// hundredths (an integer, so that comparison is exact) — see withMockSortKeys.
const MOCK_SORT_FIELD: Record<string, string> = {
    farmer: "farmer.name",
    surveyor: "surveyor.name",
    verifiedBy: "api.verified_by",
    status: "api.status",
    area: "mockSortKeys.area",
    calArea: "mockSortKeys.calArea",
    deployed: "mockSortKeys.deployed",
};
/** The decimal columns' mock sort keys: the shown value (dispatch-rows.ts dispatchQuantities) in hundredths; none when missing. */
function withMockSortKeys(record: DeploymentV2Record): DeploymentV2Record & { mockSortKeys: Record<"area" | "calArea" | "deployed", number | undefined> } {
    const q = dispatchQuantities(record.api);
    const key = (n: number | null) => (n === null ? undefined : Math.round(n * 100));
    return { ...record, mockSortKeys: { area: key(q.area), calArea: key(q.calArea), deployed: key(q.deployed) } };
}
function withNameSort(source: DeploymentV2DataSource): DeploymentV2DataSource {
    return {
        fetch(query, signal) {
            const field = query.sort ? MOCK_SORT_FIELD[query.sort.field] : undefined;
            return source.fetch(field && query.sort ? { ...query, sort: { ...query.sort, field } } : query, signal);
        },
    };
}

function useMockDeploymentV2DataSource(): DeploymentV2DataSource {
    const rows = useMockDeploymentRows();
    const config = React.useMemo(() => createDeploymentV2TableConfig(rows.map((row, i) => withMockSortKeys(toDeploymentV2Record(row, i)))), [rows]);
    const service = useMockTableDataSource(config);
    const counter = React.useMemo(() => new MockTableService<DeploymentV2Record, EngagementFilters>({ ...config, minLatencyMs: 0, maxLatencyMs: 0, calculateSummaryCounts: undefined }), [config]);
    return React.useMemo(() => traceMockTable(withMockServerSort(withMockPages(withApiContract(withMockCounts(withNameSort(service), counter), deploymentV2ApiContract)))), [service, counter]);
}

/**
 * V2.1 (mock only): the mock server's side of the list order. A request with a sort is answered in that order; one
 * without is answered in the mock server's own order (mock-backend.ts mockDefaultListSort: by default the order the live
 * server was seen to use; ?mockServerSort=none / ?mockOrder=unsorted: the store's order, unsorted). Each page reports
 * the sort it applied, as the PROPOSED pagination.sort_by / sort_order would (none when unsorted) — data/reported-sort.ts.
 */
function withMockServerSort(source: DeploymentV2DataSource): DeploymentV2DataSource {
    return {
        async fetch(query, signal) {
            let status: string = "all";
            try {
                status = mapTableQueryToV4(query).metadata.status ?? "all";
            } catch {
                // a query the v4 contract can't express: the mock still answers it, as for All
            }
            const own = query.sort ? null : mockDefaultListSort(status);
            const sort = query.sort ?? (own ? { field: own.columnId, direction: own.order } : null);
            const sortBy = sort ? SORT_BY_COLUMN[sort.field] : undefined;
            const response: WithReportedSort<TableResponse<DeploymentV2Record>> = await source.fetch(sort === query.sort ? query : { ...query, sort }, signal);
            return { ...response, reportedSort: sort && sortBy ? readReportedSort({ sort_by: sortBy, sort_order: sort.direction }) : null };
        },
    };
}

/**
 * V2.1 (mock only), for the detail's background paging: ?mockPages=slow / slower → every page after the first answers
 * after 2.5 s / 9 s; ?mockFail=page → the first request for a page after the first fails once (Retry reads it again).
 */
const mockPagesMode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mockPages") : null;
const mockPagesDelayMs = mockPagesMode === "slower" ? 9000 : mockPagesMode === "slow" ? 2500 : 0;
let failNextLaterPage = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFail") === "page";
function withMockPages(source: DeploymentV2DataSource): DeploymentV2DataSource {
    return {
        async fetch(query, signal) {
            if (query.page > 1 && failNextLaterPage) {
                failNextLaterPage = false;
                await new Promise((resolve) => setTimeout(resolve, 300));
                throw new Error("The next page could not be loaded (mock failure).");
            }
            if (query.page > 1 && mockPagesDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, mockPagesDelayMs));
            return source.fetch(query, signal);
        },
    };
}

/**
 * V2.1: each table page the mock answers is recorded in the Inspector trace — the body is the v4 request live mode would
 * send for the same query (or why the v4 contract can't express it), the response the API-shaped rows and counts.
 */
function traceMockTable(source: DeploymentV2DataSource): DeploymentV2DataSource {
    return {
        async fetch(query, signal) {
            let v4: unknown = null;
            const notes = ["Mock: answered in memory (client-side filter, sort and page) — no network request. Live mode sends this body to getDeploymentMetadata and its counts variant to getDeploymentStatusCounts."];
            try {
                v4 = mapTableQueryToV4(query);
            } catch (error) {
                notes.push(`Live mode would not send this query: ${(error as Error).message}`);
            }
            const finish = deploymentTrace.start({ source: "mock", kind: "read", method: "POST", path: DEPLOYMENT_ENDPOINTS.metadata, label: `Table page ${query.page}`, request: v4 ?? { tableQuery: query }, notes });
            try {
                const response: WithReportedSort<TableResponse<DeploymentV2Record>> = await source.fetch(query, signal);
                const applied = response.reportedSort;
                finish({
                    status: 200,
                    response: {
                        pagination: { page: response.page, rows: response.pageSize, total: response.totalCount, total_pages: response.pageCount, ...(applied && { sort_by: applied.sortBy, sort_order: applied.direction }) },
                        counts: response.summaryCounts,
                        rows: response.rows.map((record) => record.api),
                    },
                });
                return response;
            } catch (error) {
                finish({ error: (error as Error)?.message ?? String(error) });
                throw error;
            }
        },
    };
}

// ── live ────────────────────────────────────────────────────────────────────────────────────────────

/** Live mode: rows re-read from the API after a mutation (live-store.ts); otherwise the sheet uses its row. */
function useLiveDeploymentRows(): DeploymentMetadataRow[] {
    return React.useSyncExternalStore(subscribeLiveStore, getLiveRowsSnapshot, getLiveRowsSnapshot);
}

/** Live table data source (exported for the node checks: tests/deployment-v2-1/check-live-api.mjs). */
export const liveDataSource: DeploymentV2DataSource = {
    async fetch(query, signal): Promise<TableResponse<DeploymentV2Record>> {
        const { metadata, counts } = mapTableQueryToV4(query);
        // V2.1: the rows don't depend on the counts — a failed or malformed counts read leaves the rows shown and the
        // tab counts explicitly unavailable (UNAVAILABLE_COUNTS; the failure is in the Inspector trace).
        const [listResult, countsResult] = await Promise.allSettled([
            fetchDeploymentMetadata(metadata, signal),
            fetchDeploymentStatusCounts(counts, signal),
        ]);
        if (listResult.status === "rejected") throw listResult.reason;
        const list = listResult.value;
        const { total, page, rows, total_pages } = list.pagination;
        const offset = (page - 1) * rows;
        const response: WithReportedSort<TableResponse<DeploymentV2Record>> = {
            // V2.1: the rows in the API's order, as returned (no client-side sort)
            rows: list.rows.map((row, index) => toDeploymentV2Record(row, offset + index)),
            totalCount: total,
            page,
            pageSize: rows,
            pageCount: total_pages,
            hasNextPage: page < total_pages,
            hasPreviousPage: page > 1,
            summaryCounts: countsResult.status === "fulfilled" ? toToolbarCounts(countsResult.value) : UNAVAILABLE_COUNTS,
            // V2.1: the order the API says it applied (PROPOSED pagination.sort_by / sort_order; null until it sends them)
            reportedSort: readReportedSort(list.pagination),
        };
        return response;
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

/**
 * The authoritative list rows: a new array after every mutation (mock: the store's dispatch rows; live: the rows
 * re-read after a mutation). Consumers use its identity to know the data changed (and the Inspector reads it).
 */
export const useDeploymentRows = isLiveMode ? useLiveDeploymentRows : useMockDeploymentRows;

export const useDeploymentV2DataSource = isLiveMode ? useLiveDeploymentV2DataSource : useMockDeploymentV2DataSource;
