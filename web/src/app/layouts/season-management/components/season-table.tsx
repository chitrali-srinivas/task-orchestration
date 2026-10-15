"use client";

import {
    ColumnDef,
    flexRender,
    Table as TanStackTable,
} from "@tanstack/react-table";
import * as React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SeasonRecord } from "../data/schema";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeasonTableProps {
    table: TanStackTable<SeasonRecord>;
    columns: ColumnDef<SeasonRecord>[];
    onRowClick?: (row: SeasonRecord) => void;
    selectedId?: string;
    isLoading?: boolean;
    isInitialLoading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
    hasActiveFilters?: boolean;
    onClearFilters?: () => void;
}

export function SeasonTable({
    table,
    columns,
    onRowClick,
    selectedId,
    isLoading = false,
    error = null,
    onRetry,
    hasActiveFilters = false,
    onClearFilters,
}: SeasonTableProps) {
    const rows = table.getRowModel().rows;

    return (
        <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white dark:bg-zinc-950">
            <div className="flex-1 overflow-auto scrollbar-minimal w-full relative">
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
                                    );
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
                                <TableCell colSpan={columns.length} className="p-0">
                                    <div className="flex flex-col items-center justify-center h-[300px] w-full gap-3 text-center px-4">
                                        <AlertCircle className="h-8 w-8 text-red-500" />
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                Failed to load seasons
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {error.message || "An unexpected error occurred while fetching table data."}
                                            </p>
                                        </div>
                                        {onRetry && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={onRetry}
                                                className="gap-2 text-xs h-8"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                Retry
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : rows?.length ? (
                            rows.map((row) => {
                                const isSelected = selectedId === (row.original as any).id;
                                return (
                                    <TableRow
                                        key={row.id}
                                        data-state={isSelected ? "selected" : undefined}
                                        className={cn(
                                            "cursor-pointer transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted animate-in fade-in duration-200",
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
                                            );
                                        })}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-48 text-center p-6"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {hasActiveFilters ? "No matching seasons found" : "No seasons available"}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {hasActiveFilters
                                                ? "Try adjusting your search terms or clearing active filters."
                                                : "There are no season records in this view."}
                                        </p>
                                        {hasActiveFilters && onClearFilters && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={onClearFilters}
                                                className="mt-2 text-xs h-8"
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
    );
}
