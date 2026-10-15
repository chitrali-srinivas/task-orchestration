// PORT-BOUND — Deployment V2.1: the order the list API says it applied to a page, so the table header can show it.
//
// The table sends no default sort (page.tsx): with no column sorted, the rows are in the API's own order. The header
// shows that order — the column's arrow, Asc / Desc checked in its menu — only when the API REPORTS it: PROPOSED
// response fields `pagination.sort_by` / `pagination.sort_order` (the live v4 getDeploymentMetadata response has
// neither yet; nothing is inferred from the rows, and nothing is assumed about the server's default). A reported
// sort_by without a table column (e.g. epoch_date) shows no arrow.
"use client"

import * as React from "react"
import type { TableDataSource, TableResponse } from "@/lib/server-table"
import { SORT_BY_COLUMN } from "./query-mapper"

export interface ReportedSort {
    /** The table column the API's sort_by belongs to (query-mapper.ts SORT_BY_COLUMN). */
    columnId: string
    /** The API's sort_by, as reported. */
    sortBy: string
    direction: "asc" | "desc"
}

/** A table response that may carry the API's reported sort (null: the API reported none, or one the table can't show). */
export type WithReportedSort<R> = R & { reportedSort?: ReportedSort | null }

/** The API's reported sort from a list page's pagination block; null when absent, unknown or malformed. */
export function readReportedSort(pagination: { sort_by?: unknown; sort_order?: unknown } | null | undefined): ReportedSort | null {
    const sortBy = pagination?.sort_by
    const order = typeof pagination?.sort_order === "string" ? pagination.sort_order.toLowerCase() : null
    if (typeof sortBy !== "string" || (order !== "asc" && order !== "desc")) return null
    const columnId = Object.keys(SORT_BY_COLUMN).find((id) => SORT_BY_COLUMN[id] === sortBy)
    return columnId ? { columnId, sortBy, direction: order } : null
}

/** The reported sort of each rows array the table received (keyed by the array itself, so it always describes the rows shown). */
const reportedByRows = new WeakMap<object, ReportedSort | null>()

/** The API's reported sort for the rows the table shows (null: none reported). */
export function reportedSortOf(rows: object): ReportedSort | null {
    return reportedByRows.get(rows) ?? null
}

/** Wraps the table's data source (outermost, so the rows recorded are the ones the table receives) to remember each response's reported sort. */
export function useReportedSortMemory<TData, TFilters>(inner: TableDataSource<TData, TFilters>): TableDataSource<TData, TFilters> {
    return React.useMemo<TableDataSource<TData, TFilters>>(() => ({
        async fetch(query, signal) {
            const response: WithReportedSort<TableResponse<TData>> = await inner.fetch(query, signal)
            reportedByRows.set(response.rows, response.reportedSort ?? null)
            return response
        },
    }), [inner])
}
