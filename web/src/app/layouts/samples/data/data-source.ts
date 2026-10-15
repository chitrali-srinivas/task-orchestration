// PROTOTYPE-ONLY — the single swap point between the Samples UI and its data.
// Today: the in-memory mock backend (mock/mock-samples-api.ts). In matic-dash: an HTTP SamplesApi client, and
// React Query invalidation in place of the store-version subscription below. Nothing else changes.
"use client"

import * as React from "react"
import type { TableDataSource, TableResponse } from "@/lib/server-table"
import { withApiContract } from "@/mocks/server-table"
import type { SampleListRow } from "../domain/types"
import { samplesApiContract } from "./api-contract"
import { toListSamplesRequest, type SamplesTableFilters } from "./query-mapper"
import type { SamplesApi } from "./samples-api"
import { getMockDb, getMockSamplesVersion, mockSamplesApi, subscribeMockSamples } from "./mock/mock-samples-api"
import type { MockDb } from "./mock/mock-db"

export const samplesApi: SamplesApi = mockSamplesApi

/** Changes after every successful mutation: readers refetch (production: invalidate the sample queries). */
export function useSamplesDataVersion(): number {
    return React.useSyncExternalStore(subscribeMockSamples, getMockSamplesVersion, getMockSamplesVersion)
}

/** The table's data source: TableQuery → listSamples (one row per sample) → TableResponse (+ the server's sample counts per tab). */
export function useSamplesTableDataSource(): TableDataSource<SampleListRow, SamplesTableFilters> {
    const version = useSamplesDataVersion()
    return React.useMemo(() => {
        void version // a new identity after a mutation makes useServerTable refetch rows and counts
        const source: TableDataSource<SampleListRow, SamplesTableFilters> = {
            async fetch(query, signal): Promise<TableResponse<SampleListRow>> {
                const res = await samplesApi.listSamples(toListSamplesRequest(query), signal)
                const { page, page_size, total, total_pages } = res.pagination
                return {
                    rows: res.rows,
                    totalCount: total,
                    page,
                    pageSize: page_size,
                    pageCount: total_pages,
                    hasNextPage: page < total_pages,
                    hasPreviousPage: page > 1,
                    summaryCounts: res.counts,
                }
            },
        }
        return withApiContract(source, samplesApiContract)
    }, [version])
}

/** Data / API Inspector only: the mock database as stored (re-read after every mutation). */
export function useMockDbSnapshot(): Readonly<MockDb> {
    useSamplesDataVersion()
    return getMockDb()
}
