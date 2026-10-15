"use client";

import * as React from "react";
import { PaginationState, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { TableDataSource, TableQuery, TableSort } from "./types";

export interface UseServerTableOptions<TData, TFilters = Record<string, any>> {
    /** Where rows come from: a mock in mati-demo (feature data/data-source.ts), an API adapter in production. */
    dataSource: TableDataSource<TData, TFilters>;
    initialFilters?: TFilters;
    initialSearch?: string;
    initialSort?: TableSort | null;
    initialPageSize?: number;
    debounceMs?: number;
}

export function useServerTable<TData, TFilters = Record<string, any>>({
    dataSource,
    initialFilters = {} as TFilters,
    initialSearch = "",
    initialSort = null,
    initialPageSize = 20,
    debounceMs = 350,
}: UseServerTableOptions<TData, TFilters>) {
    // 2. Query State
    const [searchDraft, setSearchDraft] = React.useState<string>(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = React.useState<string>(initialSearch);
    const [isDebouncing, setIsDebouncing] = React.useState(false);

    // Column-specific searches (e.g. from column header search inputs)
    const [columnSearchesDraft, setColumnSearchesDraft] = React.useState<Record<string, string>>({});
    // Starts as the draft's own object: the debounce effect's first run then changes nothing, so a table mounts with
    // ONE request (a distinct `{}` here made every table fetch twice on mount, the first request thrown away).
    const [debouncedColumnSearches, setDebouncedColumnSearches] = React.useState<Record<string, string>>(columnSearchesDraft);

    const [filters, setFiltersState] = React.useState<TFilters>(initialFilters);
    const [sorting, setSortingState] = React.useState<SortingState>(
        initialSort ? [{ id: initialSort.field, desc: initialSort.direction === "desc" }] : []
    );
    const [pagination, setPaginationState] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: initialPageSize,
    });

    // 3. Response State
    const [data, setData] = React.useState<TData[]>([]);
    const [totalCount, setTotalCount] = React.useState<number>(0);
    const [pageCount, setPageCount] = React.useState<number>(1);
    const [summaryCounts, setSummaryCounts] = React.useState<Record<string, number> | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [isInitialLoading, setIsInitialLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<Error | null>(null);

    // 4. Stale-Response & Cancellation Tracking
    const requestIdRef = React.useRef<number>(0);
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // 5. Debounce Search Draft -> Debounced Search (350ms)
    React.useEffect(() => {
        setIsDebouncing(true);
        const timer = setTimeout(() => {
            setDebouncedSearch(searchDraft);
            setIsDebouncing(false);
            // Reset to page 1 on search change
            setPaginationState((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchDraft, debounceMs]);

    // Debounce Column Searches
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedColumnSearches(columnSearchesDraft);
            setPaginationState((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [columnSearchesDraft, debounceMs]);

    // 6. Data Fetching Effect
    const fetchData = React.useCallback(async () => {
        // Abort previous in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const currentRequestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);

        // Map TanStack sorting state to TableSort
        const sort: TableSort | null =
            sorting.length > 0
                ? {
                      field: sorting[0].id,
                      direction: sorting[0].desc ? "desc" : "asc",
                  }
                : null;

        const query: TableQuery<TFilters> = {
            page: pagination.pageIndex + 1, // 1-indexed for server query
            pageSize: pagination.pageSize,
            search: debouncedSearch,
            columnSearches: debouncedColumnSearches,
            filters,
            sort,
        };

        try {
            const response = await dataSource.fetch(query, controller.signal);

            // Stale check: only update state if this is the newest request
            if (currentRequestId === requestIdRef.current) {
                setData(response.rows);
                setTotalCount(response.totalCount);
                setPageCount(response.pageCount);
                if (response.summaryCounts) {
                    setSummaryCounts(response.summaryCounts);
                }
                setIsLoading(false);
                setIsInitialLoading(false);
            }
        } catch (err: any) {
            if (err.name === "AbortError") {
                // Request was cancelled by newer query, do not update error state
                return;
            }
            if (currentRequestId === requestIdRef.current) {
                setError(err instanceof Error ? err : new Error(String(err)));
                setIsLoading(false);
                setIsInitialLoading(false);
            }
        }
    }, [
        dataSource,
        debouncedSearch,
        debouncedColumnSearches,
        filters,
        sorting,
        pagination.pageIndex,
        pagination.pageSize,
    ]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // An unmounted table abandons its in-flight request (the response has no consumer; nothing is applied).
    React.useEffect(() => () => abortControllerRef.current?.abort(), []);

    // 7. Action Handlers
    const setSearch = React.useCallback((val: string) => {
        setSearchDraft(val);
    }, []);

    const clearSearch = React.useCallback(() => {
        setSearchDraft("");
        setDebouncedSearch("");
        setPaginationState((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const setColumnSearch = React.useCallback((columnId: string, value: string | undefined) => {
        setColumnSearchesDraft((prev) => {
            const next = { ...prev };
            if (value === undefined || value === "") {
                delete next[columnId];
            } else {
                next[columnId] = value;
            }
            return next;
        });
    }, []);

    const setFilter = React.useCallback((key: keyof TFilters, value: any) => {
        setFiltersState((prev) => ({
            ...prev,
            [key]: value,
        }));
        setPaginationState((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const setFilters = React.useCallback(
        (updater: TFilters | ((prev: TFilters) => TFilters)) => {
            setFiltersState((prev) => {
                const next = typeof updater === "function" ? (updater as any)(prev) : updater;
                return next;
            });
            setPaginationState((prev) => ({ ...prev, pageIndex: 0 }));
        },
        []
    );

    const [columnFilters, setColumnFiltersState] = React.useState<ColumnFiltersState>([]);

    const onColumnFiltersChange = React.useCallback(
        (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
            setColumnFiltersState((prev) => {
                const next = typeof updater === "function" ? updater(prev) : updater;

                // Sync string filters to column searches, and others to structured filters
                const nextColSearches: Record<string, string> = {};
                const nextFilters: Record<string, any> = { ...(filters as Record<string, any>) };

                // Track which keys are present in the current column filters
                const activeColFilterKeys = new Set<string>();

                next.forEach((filter) => {
                    activeColFilterKeys.add(filter.id);
                    if (typeof filter.value === "string") {
                        if (filter.value.trim()) {
                            nextColSearches[filter.id] = filter.value;
                        }
                    } else if (filter.value !== undefined && filter.value !== null) {
                        nextFilters[filter.id] = filter.value;
                    }
                });

                // Clear any column searches that were removed
                setColumnSearchesDraft(nextColSearches);

                // Remove only the structured filters this sync owns: column filters that existed before and are
                // gone now. Filters set outside the columns (e.g. the status tab via setFilter) are kept, so the
                // query always matches the tab the UI shows as selected.
                prev.forEach((filter) => {
                    if (!activeColFilterKeys.has(filter.id)) {
                        delete nextFilters[filter.id];
                    }
                });

                setFiltersState(nextFilters as TFilters);
                setPaginationState((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
                return next;
            });
        },
        [filters]
    );

    const onPaginationChange = React.useCallback(
        (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
            setPaginationState((prev) => {
                const next = typeof updater === "function" ? updater(prev) : updater;
                return next;
            });
        },
        []
    );

    const onSortingChange = React.useCallback(
        (updater: SortingState | ((prev: SortingState) => SortingState)) => {
            setSortingState((prev) => {
                const next = typeof updater === "function" ? updater(prev) : updater;
                return next;
            });
            setPaginationState((prev) => ({ ...prev, pageIndex: 0 }));
        },
        []
    );

    const clearFilters = React.useCallback((defaultFilters?: TFilters) => {
        setFiltersState(defaultFilters || ({} as TFilters));
        setColumnFiltersState([]);
        setColumnSearchesDraft({});
        setDebouncedColumnSearches({});
        setPaginationState((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const retry = React.useCallback(() => {
        fetchData();
    }, [fetchData]);

    const hasActiveFilters = React.useMemo(() => {
        const hasSearch = Boolean(debouncedSearch && debouncedSearch.trim().length > 0);
        const hasColSearches = Object.keys(debouncedColumnSearches).length > 0;
        const hasColFilters = columnFilters.length > 0;
        const hasStructuredFilters = Object.entries(filters as Record<string, any>).some(([k, val]) => {
            if (val === undefined || val === null || val === "" || val === "All") return false;
            if (k === "tabStatus" || k === "statusTab") return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === "object") {
                return Boolean(val.from || val.to || val.min !== undefined || val.max !== undefined);
            }
            return true;
        });
        return hasSearch || hasColSearches || hasColFilters || hasStructuredFilters;
    }, [debouncedSearch, debouncedColumnSearches, columnFilters, filters]);

    return {
        // Query & State
        searchDraft,
        setSearch,
        clearSearch,
        isDebouncing,
        isSearching: isDebouncing || (isLoading && Boolean(debouncedSearch || Object.keys(debouncedColumnSearches).length > 0)),
        columnSearches: columnSearchesDraft,
        setColumnSearch,

        filters,
        setFilter,
        setFilters,
        columnFilters,
        setColumnFilters: setColumnFiltersState,
        clearFilters,
        hasActiveFilters,

        sorting,
        setSorting: setSortingState,
        onSortingChange,

        pagination,
        setPagination: setPaginationState,
        onPaginationChange,
        onColumnFiltersChange,

        // Data & Response
        data,
        totalCount,
        pageCount,
        summaryCounts,
        isLoading,
        isInitialLoading,
        error,
        retry,
    };
}
