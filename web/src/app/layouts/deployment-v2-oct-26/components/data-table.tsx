// Deployment V2 Oct 26 — copy of src/app/layouts/deployment/components/data-table.tsx.
// Changes: `counts` may carry the API's `all` count, passed through to the toolbar copy below; infinite scroll —
// near the bottom of the scroll container the table asks for the next page (`onLoadMore`), shows a loading row
// while it loads and, if it fails, an error row with Retry, keeping the rows already loaded.
"use client"

import {
    ColumnDef,
    ColumnFiltersState,
    OnChangeFn,
    PaginationState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import * as React from "react"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { DataTableToolbar } from "./data-table-toolbar"
import { cn } from "@/lib/utils"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    onRowClick?: (row: TData) => void
    activeTab: string
    setActiveTab: (value: string) => void
    counts: {
        /** Provided by getDeploymentStatusCounts; shown as-is for the All tab. */
        all?: number
        verified: number
        pending: number
        invalid: number
    }
    selectedId?: string
    isLoading?: boolean
    isInitialLoading?: boolean
    error?: Error | null
    onRetry?: () => void
    hasActiveFilters?: boolean
    onClearFilters?: () => void
    pageCount?: number
    rowCount?: number
    pagination?: PaginationState
    onPaginationChange?: OnChangeFn<PaginationState>
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
    columnFilters?: ColumnFiltersState
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
    /** Infinite scroll: another page exists after the rows shown. */
    hasMore?: boolean
    /** Infinite scroll: load the next page (called near the bottom of the scroll container). */
    onLoadMore?: () => void
    /** The next page is loading (the rows already shown stay). */
    isLoadingMore?: boolean
    /** Loading the next page failed (the rows already shown stay). */
    loadMoreError?: Error | null
    onRetryLoadMore?: () => void
}

/** Distance from the bottom of the scroll container at which the next page is requested. */
const LOAD_MORE_THRESHOLD_PX = 240

export function EngagementTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    activeTab,
    setActiveTab,
    counts,
    selectedId,
    isLoading = false,
    error = null,
    onRetry,
    hasActiveFilters = false,
    onClearFilters,
    pageCount,
    rowCount,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    columnFilters = [],
    onColumnFiltersChange,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false,
    loadMoreError = null,
    onRetryLoadMore,
}: DataTableProps<TData, TValue>) {
    const [rowSelection, setRowSelection] = React.useState({})

    // Infinite scroll: ask for the next page once the scroll container is near its bottom — on scroll, and after
    // rows change (a page that does not fill the container). The parent decides whether a request is sent.
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const maybeLoadMore = React.useCallback(() => {
        const el = scrollRef.current
        if (!el || !hasMore || !onLoadMore || isLoading || isLoadingMore || loadMoreError) return
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= LOAD_MORE_THRESHOLD_PX) onLoadMore()
    }, [hasMore, onLoadMore, isLoading, isLoadingMore, loadMoreError])
    React.useEffect(() => {
        maybeLoadMore()
    }, [maybeLoadMore, data.length])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

    const activeColumnIds = React.useMemo(() => {
        return columns.map(col => (col as any).id || (col as any).accessorKey).filter(Boolean)
    }, [columns])

    const [filterSidebarOpen, setFilterSidebarOpen] = React.useState(false)
    const [initialFilterField, setInitialFilterField] = React.useState<string | null>(null)

    const handleOpenFilterForColumn = (columnId: string) => {
        setInitialFilterField(columnId)
        setFilterSidebarOpen(true)
    }

    const table = useReactTable({
        data,
        columns,
        pageCount: pageCount ?? 1,
        rowCount: rowCount ?? data.length,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        state: {
            sorting: sorting ?? [],
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination: pagination ?? { pageIndex: 0, pageSize: 20 },
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange,
        onColumnFiltersChange,
        onPaginationChange,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            openFilterForColumn: handleOpenFilterForColumn,
        },
    })

    return (
        <div className="flex flex-col h-full gap-0 w-full relative overflow-hidden min-w-0">
            <div className="shrink-0 min-w-0 w-full overflow-hidden">
                <DataTableToolbar
                    table={table}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    counts={counts}
                    activeColumns={activeColumnIds}
                    isLoading={isLoading}
                    filterSidebarOpen={filterSidebarOpen}
                    setFilterSidebarOpen={setFilterSidebarOpen}
                    initialFilterField={initialFilterField}
                    setInitialFilterField={setInitialFilterField}
                />
            </div>
            <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white dark:bg-zinc-950">
                {/* overflow-anchor: none — appended pages must land below the view. With scroll anchoring the browser
                    keeps the bottom "Loading more" row in view, which would ask for page after page. */}
                <div ref={scrollRef} onScroll={maybeLoadMore} className="flex-1 overflow-auto scrollbar-minimal w-full relative [overflow-anchor:none]">
                    <Table className="relative w-full border-collapse">
                        <TableHeader className="sticky top-0 z-30 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                style={{ 
                                                    minWidth: header.column.columnDef.size,
                                                }}
                                                className="whitespace-nowrap h-12 px-4 text-left align-middle bg-muted/50 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="p-0"
                                    >
                                        <div className="flex flex-col items-center justify-center h-[400px] w-full gap-3 animate-in fade-in duration-500 relative">
                                            <div className="sticky left-0 right-0 flex flex-col items-center justify-center w-[calc(100vw-var(--sidebar-width)-3rem)] min-w-0">
                                                <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : error ? (
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-64 text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                Couldn't load records
                                            </p>
                                            <p className="text-xs text-zinc-500 max-w-sm">
                                                {error.message || "An unexpected error occurred while querying records."}
                                            </p>
                                            {onRetry && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={onRetry}
                                                    className="gap-1.5 h-8 text-xs font-medium mt-1"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Retry
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                <>
                                {table.getRowModel().rows.map((row) => {
                                    const isSelected = selectedId === String((row.original as any).id)
                                    return (
                                        <TableRow
                                            key={row.id}
                                            data-state={isSelected ? "selected" : undefined}
                                            className={cn(
                                                "cursor-pointer transition-all hover:bg-muted/50 data-[state=selected]:bg-muted animate-in fade-in slide-in-from-bottom-1 duration-300",
                                                isSelected ? "bg-muted/50" : ""
                                            )}
                                            onClick={() => onRowClick?.(row.original)}
                                        >
                                            {row.getVisibleCells().map((cell) => {
                                                return (
                                                    <TableCell 
                                                        key={cell.id} 
                                                        style={{ 
                                                            minWidth: cell.column.columnDef.size,
                                                        }}
                                                        className="whitespace-nowrap p-4 align-middle"
                                                    >
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    )
                                })}
                                {(isLoadingMore || loadMoreError) && (
                                    <TableRow className="hover:bg-transparent border-none" data-load-more={isLoadingMore ? "loading" : "error"}>
                                        <TableCell colSpan={columns.length} className="p-0">
                                            <div className="sticky left-0 flex items-center justify-center gap-3 py-5 w-[calc(100vw-var(--sidebar-width)-3rem)] min-w-0">
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
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={onRetryLoadMore}
                                                                className="gap-1.5 h-8 text-xs font-medium shrink-0"
                                                            >
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
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-48 text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {hasActiveFilters ? "No matching records found" : "No records found"}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {hasActiveFilters
                                                    ? "Try adjusting your search or filters."
                                                    : "There are no records in this category."}
                                            </p>
                                            {hasActiveFilters && onClearFilters && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={onClearFilters}
                                                    className="mt-2 h-8 text-xs"
                                                >
                                                    Clear all filters
                                                </Button>
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
