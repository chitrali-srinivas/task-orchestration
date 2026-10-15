"use client"

// Samples — the verification table. Deployment V2's table (deployment-v2-oct-26/components/data-table.tsx): the same
// header, rows, loading / error / empty states and infinite scroll, with one change — the toolbar is a slot, so the
// Samples tabs, filters and Inspector sit above it without forking V2's deployment-specific toolbar.
// Rows are server-paged (useServerTable): sorting, filtering and paging are never done here.
import * as React from "react"
import {
    type ColumnDef,
    type ColumnFiltersState,
    type OnChangeFn,
    type SortingState,
    type Table as TanstackTable,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/** Distance from the bottom of the scroll container at which the next page is requested (as V2). */
const LOAD_MORE_THRESHOLD_PX = 240

export interface SamplesTableProps<TData> {
    columns: ColumnDef<TData, unknown>[]
    data: TData[]
    getRowId: (row: TData) => string
    onRowClick?: (row: TData) => void
    selectedId?: string | null
    /** The toolbar above the table; it receives the table (column visibility, filter state). */
    renderToolbar: (table: TanstackTable<TData>) => React.ReactNode
    /** Opens the filter sheet on a column's section (column header "Filter"). */
    onOpenFilterForColumn?: (columnId: string) => void
    isLoading?: boolean
    error?: Error | null
    onRetry?: () => void
    hasActiveFilters?: boolean
    onClearFilters?: () => void
    sorting: SortingState
    onSortingChange: OnChangeFn<SortingState>
    columnFilters: ColumnFiltersState
    onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
    columnVisibility: VisibilityState
    onColumnVisibilityChange: OnChangeFn<VisibilityState>
    hasMore?: boolean
    onLoadMore?: () => void
    isLoadingMore?: boolean
    loadMoreError?: Error | null
    onRetryLoadMore?: () => void
    emptyTitle?: string
    emptyDetail?: string
}

export function SamplesTable<TData>({
    columns,
    data,
    getRowId,
    onRowClick,
    selectedId,
    renderToolbar,
    onOpenFilterForColumn,
    isLoading = false,
    error = null,
    onRetry,
    hasActiveFilters = false,
    onClearFilters,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange,
    columnVisibility,
    onColumnVisibilityChange,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false,
    loadMoreError = null,
    onRetryLoadMore,
    emptyTitle = "No samples found",
    emptyDetail = "There are no samples in this category.",
}: SamplesTableProps<TData>) {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const maybeLoadMore = React.useCallback(() => {
        const el = scrollRef.current
        if (!el || !hasMore || !onLoadMore || isLoading || isLoadingMore || loadMoreError) return
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= LOAD_MORE_THRESHOLD_PX) onLoadMore()
    }, [hasMore, onLoadMore, isLoading, isLoadingMore, loadMoreError])
    React.useEffect(() => {
        maybeLoadMore()
    }, [maybeLoadMore, data.length])

    // useReactTable returns a stable instance whose methods the compiler can't memoise; this table is server-driven.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getRowId: (row) => getRowId(row),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        state: { sorting, columnFilters, columnVisibility },
        onSortingChange,
        onColumnFiltersChange,
        onColumnVisibilityChange,
        getCoreRowModel: getCoreRowModel(),
        meta: { openFilterForColumn: onOpenFilterForColumn },
    })
    const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length

    return (
        <div className="flex flex-col h-full gap-0 w-full relative overflow-hidden min-w-0">
            <div className="shrink-0 min-w-0 w-full">{renderToolbar(table)}</div>
            <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white dark:bg-zinc-950">
                <div ref={scrollRef} onScroll={maybeLoadMore} data-samples-scroll className="flex-1 overflow-auto scrollbar-minimal w-full relative [overflow-anchor:none]">
                    <Table className="relative w-full border-collapse">
                        <TableHeader className="sticky top-0 z-30 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            style={{ minWidth: header.column.columnDef.size }}
                                            className="whitespace-nowrap h-12 px-4 text-left align-middle bg-muted/50 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30"
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={visibleColumnCount} className="p-0">
                                        <div data-table-state="loading" className="flex flex-col items-center justify-center h-[400px] w-full gap-3 animate-in fade-in duration-500">
                                            <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : error ? (
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={visibleColumnCount} className="h-64 text-center">
                                        <div data-table-state="error" className="flex flex-col items-center justify-center gap-3">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Couldn&apos;t load records</p>
                                            <p className="text-xs text-zinc-500 max-w-sm">{error.message || "An unexpected error occurred while querying records."}</p>
                                            {onRetry && (
                                                <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 h-8 text-xs font-medium mt-1">
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Retry
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows.length ? (
                                <>
                                    {table.getRowModel().rows.map((row) => {
                                        const isSelected = selectedId === row.id
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-row-id={row.id}
                                                data-state={isSelected ? "selected" : undefined}
                                                className={cn(
                                                    "cursor-pointer transition-all hover:bg-muted/50 data-[state=selected]:bg-muted animate-in fade-in slide-in-from-bottom-1 duration-300",
                                                    isSelected ? "bg-muted/50" : ""
                                                )}
                                                onClick={() => onRowClick?.(row.original)}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} style={{ minWidth: cell.column.columnDef.size }} className="whitespace-nowrap p-4 align-middle">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    {(isLoadingMore || loadMoreError) && (
                                        <TableRow className="hover:bg-transparent border-none" data-load-more={isLoadingMore ? "loading" : "error"}>
                                            <TableCell colSpan={visibleColumnCount} className="p-0">
                                                <div className="flex items-center justify-center gap-3 py-5">
                                                    {isLoadingMore ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 text-zinc-300 animate-spin" />
                                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading more records...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-xs text-zinc-500 max-w-sm truncate">
                                                                Couldn&apos;t load more records{loadMoreError?.message ? `: ${loadMoreError.message}` : ""}
                                                            </p>
                                                            {onRetryLoadMore && (
                                                                <Button variant="outline" size="sm" onClick={onRetryLoadMore} className="gap-1.5 h-8 text-xs font-medium shrink-0">
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                    Retry
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={visibleColumnCount} className="h-48 text-center">
                                        <div data-table-state="empty" className="flex flex-col items-center justify-center gap-2">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{hasActiveFilters ? "No matching records found" : emptyTitle}</p>
                                            <p className="text-xs text-zinc-500">{hasActiveFilters ? "Try adjusting your search or filters." : emptyDetail}</p>
                                            {hasActiveFilters && onClearFilters && (
                                                <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-2 h-8 text-xs">Clear all filters</Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
