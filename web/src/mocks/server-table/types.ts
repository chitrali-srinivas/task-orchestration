// PROTOTYPE-ONLY — configuration for the in-memory mock "server" behind a table.
// This is where server-side behaviour (search, filtering, sorting, counts) is simulated in the browser.
// In production this logic lives in the backend; it is never transferred.

import type { TableSort } from "@/lib/server-table/types";

export type SearchableField<TData> =
    | keyof TData
    | string
    | ((row: TData) => string | number | undefined | null);

export interface TableConfig<TData, TFilters = Record<string, any>> {
    dataset: TData[];
    searchableFields?: SearchableField<TData>[];
    customFilterHandlers?: Record<
        string,
        (row: TData, filterValue: any) => boolean
    >;
    defaultSort?: TableSort;
    defaultPageSize?: number;
    minLatencyMs?: number;
    maxLatencyMs?: number;
    calculateSummaryCounts?: (
        dataset: TData[],
        activeFiltersWithoutTab?: TFilters
    ) => Record<string, number>;
}
