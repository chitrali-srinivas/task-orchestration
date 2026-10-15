// PORT-BOUND — the table data contract shared by every server-driven table.
// UI components and `useServerTable` only depend on these types. Where the rows come from is a
// TableDataSource: a mock in mati-demo (src/mocks/server-table), an API-backed adapter in production.

export interface TableSort {
    field: string;
    direction: "asc" | "desc";
}

export interface TableQuery<TFilters = Record<string, any>> {
    page: number;
    pageSize: number;
    search: string;
    columnSearches?: Record<string, string>;
    filters: TFilters;
    sort: TableSort | null;
}

export interface TableResponse<TData> {
    rows: TData[];
    totalCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    summaryCounts?: Record<string, number>;
}

/**
 * Supplies rows for a TableQuery. Must reject with a DOMException named "AbortError" when `signal` aborts.
 * Production implementation: map TableQuery → API request (adapter), call the API, map the response → TableResponse.
 */
export interface TableDataSource<TData, TFilters = Record<string, unknown>> {
    fetch(query: TableQuery<TFilters>, signal?: AbortSignal): Promise<TableResponse<TData>>;
}
