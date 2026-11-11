"use client"

// Jobs table — copied from Tasks (tasks/components/data-table.tsx), which follows Deployment's EngagementTable: server-driven
// TanStack table with sticky header, loading / error / empty states and row click → detail sheet. The toolbar is passed
// in (its tabs and filters are the page's), the pager is shown under the table, and the empty state text comes from the page.
import {
    ColumnDef,
    ColumnFiltersState,
    OnChangeFn,
    PaginationState,
    SortingState,
    Table as TanstackTable,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import * as React from "react"
import { Loader2, RotateCcw } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DataTablePagination } from "./data-table-pagination"

interface JobsTableProps<TData extends { id: string }, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    toolbar: (table: TanstackTable<TData>) => React.ReactNode
    onRowClick?: (row: TData) => void
    selectedId?: string
    /** Column ids that have a section in the filter sheet (their header menu offers "Filter"). */
    filterFields: string[]
    onOpenFilterForColumn: (columnId: string) => void
    isLoading?: boolean
    error?: Error | null
    onRetry?: () => void
    hasActiveFilters?: boolean
    onClearFilters?: () => void
    emptyTitle: string
    emptyDescription: string
    pageCount?: number
    rowCount?: number
    pagination?: PaginationState
    onPaginationChange?: OnChangeFn<PaginationState>
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
    columnFilters?: ColumnFiltersState
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
}

export function JobsTable<TData extends { id: string }, TValue>({
    columns,
    data,
    toolbar,
    onRowClick,
    selectedId,
    filterFields,
    onOpenFilterForColumn,
    isLoading = false,
    error = null,
    onRetry,
    hasActiveFilters = false,
    onClearFilters,
    emptyTitle,
    emptyDescription,
    pageCount,
    rowCount,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    columnFilters = [],
    onColumnFiltersChange,
}: JobsTableProps<TData, TValue>) {
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

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
            columnFilters,
            pagination: pagination ?? { pageIndex: 0, pageSize: 20 },
        },
        onSortingChange,
        onColumnFiltersChange,
        onPaginationChange,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        meta: {
            openFilterForColumn: onOpenFilterForColumn,
            filterFields,
        },
    })

    const visibleColumnCount = table.getVisibleLeafColumns().length

    return (
        <div className="flex flex-col h-full gap-0 w-full relative overflow-hidden min-w-0">
            <div className="shrink-0 min-w-0 w-full overflow-hidden">{toolbar(table)}</div>
            <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white dark:bg-zinc-950">
                <div className="flex-1 overflow-auto scrollbar-minimal w-full relative">
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
                                    <TableCell colSpan={visibleColumnCount} className="h-64 p-0 text-center">
                                        <div className="sticky left-0 flex flex-col items-center justify-center gap-3 px-4 w-[calc(100vw-var(--sidebar-width)-3rem)] min-w-0">
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
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const isSelected = selectedId === row.original.id
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
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} style={{ minWidth: cell.column.columnDef.size }} className="whitespace-nowrap p-4 align-middle">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={visibleColumnCount} className="h-48 p-0 text-center">
                                        {/* Kept in the visible part of a wide table, like the loading state. */}
                                        <div className="sticky left-0 flex flex-col items-center justify-center gap-2 px-4 w-[calc(100vw-var(--sidebar-width)-3rem)] min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {hasActiveFilters ? "No matching records found" : emptyTitle}
                                            </p>
                                            <p className="text-xs text-zinc-500">{hasActiveFilters ? "Try adjusting your search or filters." : emptyDescription}</p>
                                            {hasActiveFilters && onClearFilters && (
                                                <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-2 h-8 text-xs">
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
            <div className="shrink-0 pt-3">
                <DataTablePagination table={table} selectedId={selectedId} />
            </div>
        </div>
    )
}
