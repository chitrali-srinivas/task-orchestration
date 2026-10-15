// PORT-BOUND — infinite scroll for the Deployment V2 table over the page-based table contract.
// useServerTable replaces its rows with each response. This data-source wrapper answers a request for page N with the
// rows of pages 1..N of the same query, so advancing useServerTable's page index shows every page loaded so far.
// useServerTable still owns the query, the page index (reset to page 1 on tab / filter / sort changes), cancellation
// and stale-response handling; the wrapped data source still does the request mapping and the API call.
"use client";

import * as React from "react";
import type { TableDataSource, TableResponse } from "@/lib/server-table";

interface LoadedPages<TData, TFilters> {
    /** The query without its page number: pages are only joined while this stays the same. */
    query: string;
    source: TableDataSource<TData, TFilters>;
    pages: TData[][];
}

/**
 * Wraps a data source so page N returns pages 1..N of the same query.
 * - page 1, a different query, or a refreshed source (new identity, e.g. after a mutation) starts over:
 *   pages 1..N are read again in order, so rows never mix queries;
 * - page N right after N-1 of the same query reads only page N and appends it;
 * - rows repeated across page boundaries (same `rowKey`) are shown once.
 */
export function useInfinitePagesDataSource<TData, TFilters>(
    inner: TableDataSource<TData, TFilters>,
    rowKey: (row: TData) => string
): TableDataSource<TData, TFilters> {
    const loaded = React.useRef<LoadedPages<TData, TFilters> | null>(null);
    const latestCall = React.useRef(0);

    return React.useMemo<TableDataSource<TData, TFilters>>(
        () => ({
            async fetch(query, signal) {
                const call = ++latestCall.current;
                const { page, ...rest } = query;
                const queryKey = JSON.stringify(rest);
                const previous = loaded.current;
                const appends = previous !== null && previous.source === inner && previous.query === queryKey && page === previous.pages.length + 1;

                let pages: TData[][];
                let last: TableResponse<TData>;
                if (appends) {
                    last = await inner.fetch(query, signal);
                    pages = [...previous.pages, last.rows];
                } else {
                    pages = [];
                    last = await inner.fetch({ ...query, page: 1 }, signal);
                    pages.push(last.rows);
                    for (let p = 2; p <= page; p++) {
                        last = await inner.fetch({ ...query, page: p }, signal);
                        pages.push(last.rows);
                    }
                }
                // Only the newest call records what is loaded (useServerTable ignores older responses too).
                if (call === latestCall.current) loaded.current = { query: queryKey, source: inner, pages };

                const seen = new Set<string>();
                const rows = pages.flat().filter((row) => {
                    const key = rowKey(row);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                return { ...last, rows };
            },
        }),
        [inner, rowKey]
    );
}
