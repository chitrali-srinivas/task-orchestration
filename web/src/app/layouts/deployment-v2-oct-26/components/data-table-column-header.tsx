"use client"

// Deployment V2 Oct 26 — copy of src/app/layouts/deployment/components/data-table-column-header.tsx.
// Only change: no in-column "Search". The v4 Deployment API has no text search, so the shared header's search
// (a column search the live API cannot serve) is not offered. "Filter" still opens the filter sidebar, and only
// for columns that can filter (page.tsx turns filtering off for columns the API cannot filter).

import * as React from "react"
import { useMemo } from "react"
import type { Column, Table } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, Check, ChevronDown, EyeOff, Filter, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableColumnHeaderProps<TData, TValue>
    extends React.HTMLAttributes<HTMLDivElement> {
    column: Column<TData, TValue>
    title: string
    table?: Table<TData>
    onOpenFilter?: (columnId: string) => void
}

/** A sidebar filter value: a date range or a number range. */
type RangeFilterValue = { from?: Date | string; to?: Date | string; min?: number | null; max?: number | null }

/** The table meta the V2 data table provides (opens the filter sidebar on a column's section). */
type TableMeta = { openFilterForColumn?: (columnId: string) => void }

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
    table,
    onOpenFilter,
}: DataTableColumnHeaderProps<TData, TValue>) {
    const rawFilterValue = column.getFilterValue()

    // Determine if this column has an active filter (handles arrays and date/range objects from the sidebar)
    const isFiltered = useMemo(() => {
        if (rawFilterValue === undefined || rawFilterValue === null) return false
        if (typeof rawFilterValue === "string") return rawFilterValue.trim().length > 0
        if (Array.isArray(rawFilterValue)) {
            return rawFilterValue.length > 0 && rawFilterValue.some(v => v !== undefined && v !== null && v !== "")
        }
        if (typeof rawFilterValue === "object") {
            const obj = rawFilterValue as RangeFilterValue
            return Boolean(obj.from || obj.to || (obj.min !== undefined && obj.min !== null) || (obj.max !== undefined && obj.max !== null))
        }
        return false
    }, [rawFilterValue])

    const displayFilterValue = useMemo(() => {
        if (rawFilterValue === undefined || rawFilterValue === null) return ""
        if (typeof rawFilterValue === "string") return rawFilterValue
        if (Array.isArray(rawFilterValue)) {
            const valid = rawFilterValue.filter(v => v !== undefined && v !== null && v !== "")
            if (valid.length === 2 && (valid[0] instanceof Date || (typeof valid[0] === "string" && (valid[0].includes("-") || valid[0].includes("/"))))) {
                return `${valid[0]} to ${valid[1]}`
            }
            if (valid.length === 2 && (typeof valid[0] === "number" || typeof valid[1] === "number")) {
                return `${valid[0]} - ${valid[1]}`
            }
            return valid.join(", ")
        }
        if (typeof rawFilterValue === "object") {
            const obj = rawFilterValue as RangeFilterValue
            if (obj.from && obj.to) return `${obj.from} - ${obj.to}`
            if (obj.from) return `From ${obj.from}`
            if (obj.to) return `To ${obj.to}`
            if (obj.min !== undefined && obj.max !== undefined) return `${obj.min} - ${obj.max}`
            if (obj.min !== undefined) return `Min: ${obj.min}`
            if (obj.max !== undefined) return `Max: ${obj.max}`
        }
        return String(rawFilterValue)
    }, [rawFilterValue])

    const isSorted = column.getIsSorted()
    const openFilter = onOpenFilter ?? (table?.options.meta as TableMeta | undefined)?.openFilterForColumn

    if (!column.getCanSort() && !column.getCanFilter()) {
        return (
            <div className={cn("text-xs font-semibold text-zinc-900 dark:text-zinc-100", className)}>
                {title}
            </div>
        )
    }

    return (
        <div className={cn("flex items-center space-x-1", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        title={isFiltered ? `Filtered by: "${displayFilterValue}"` : undefined}
                        className="-ml-3 h-8 px-3 justify-start text-left data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800 group/header hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors select-none"
                    >
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover/header:text-zinc-900 dark:group-hover/header:text-zinc-50 transition-colors">
                            {title}
                        </span>

                        {/* Active Filter Indicator Dot on the right in place of filter icon */}
                        {isFiltered && (
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 animate-pulse shrink-0 ml-1.5" />
                        )}

                        {/* Sorting Indicators */}
                        {isSorted === "desc" ? (
                            <ArrowDown className="ml-1 h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 stroke-[2]" />
                        ) : isSorted === "asc" ? (
                            <ArrowUp className="ml-1 h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 stroke-[2]" />
                        ) : (
                            <ChevronDown
                                className={cn(
                                    "ml-1 h-3.5 w-3.5 transition-transform duration-200 text-zinc-400",
                                    isFiltered ? "opacity-100 text-zinc-700 dark:text-zinc-300" : "opacity-0 group-hover/header:opacity-100 group-data-[state=open]/header:opacity-100",
                                    "group-data-[state=open]/header:rotate-180"
                                )}
                            />
                        )}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={4}
                    className="w-48 p-1 shadow-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg z-[300]"
                >
                    {/* Clear Filter action if active */}
                    {isFiltered && (
                        <>
                            <DropdownMenuItem
                                onClick={() => column.setFilterValue(undefined)}
                                className="text-xs text-red-600 dark:text-red-400 cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-md focus:bg-red-50 dark:focus:bg-red-950/30 font-medium"
                            >
                                <div className="flex items-center gap-2">
                                    <X className="h-3.5 w-3.5" />
                                    <span>Clear filter</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-zinc-100 dark:bg-zinc-800" />
                        </>
                    )}

                    {/* 1. Filter Action (Opens Filter Sidebar with this column's filter open) */}
                    {column.getCanFilter() && (
                        <>
                            <DropdownMenuItem
                                onClick={() => openFilter?.(column.id)}
                                className="text-xs cursor-pointer flex items-center gap-2 py-1.5 px-2.5 rounded-md focus:bg-zinc-100 dark:focus:bg-zinc-900"
                            >
                                <Filter className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Filter</span>
                            </DropdownMenuItem>
                            {column.getCanSort() && <DropdownMenuSeparator className="my-1 bg-zinc-100 dark:bg-zinc-800" />}
                        </>
                    )}

                    {/* 2. Sorting Controls */}
                    {column.getCanSort() && (
                        <>
                            <DropdownMenuItem
                                onClick={() => column.toggleSorting(false)}
                                className="text-xs cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-md focus:bg-zinc-100 dark:focus:bg-zinc-900"
                            >
                                <div className="flex items-center gap-2">
                                    <ArrowUp className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>Asc</span>
                                </div>
                                {isSorted === "asc" && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 stroke-[2.5]" />}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => column.toggleSorting(true)}
                                className="text-xs cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-md focus:bg-zinc-100 dark:focus:bg-zinc-900"
                            >
                                <div className="flex items-center gap-2">
                                    <ArrowDown className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>Desc</span>
                                </div>
                                {isSorted === "desc" && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 stroke-[2.5]" />}
                            </DropdownMenuItem>
                        </>
                    )}

                    {/* 3. Column Visibility */}
                    {column.getCanHide() && (
                        <>
                            <DropdownMenuSeparator className="my-1 bg-zinc-100 dark:bg-zinc-800" />
                            <DropdownMenuItem
                                onClick={() => column.toggleVisibility(false)}
                                className="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer flex items-center gap-2 py-1.5 px-2.5 rounded-md focus:bg-zinc-100 dark:focus:bg-zinc-900"
                            >
                                <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                                <span>Hide</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
