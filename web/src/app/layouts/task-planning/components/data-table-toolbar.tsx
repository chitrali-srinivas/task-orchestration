"use client"

// Jobs toolbar — copied from Tasks (tasks/components/data-table-toolbar.tsx), Deployment's DataTableToolbar: job status tabs
// with counts on the left; Plan jobs, the filter button (with count and clear) and the column toggle on the right.
import { Table } from "@tanstack/react-table"
import { Eye, Filter, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface StatusTab {
    value: string
    label: string
    count: number
}

/** Filters set from the filter sheet (header searches are strings and are not counted). */
export const sheetFilters = (filters: { id: string; value: unknown }[]) =>
    filters.filter((f) => {
        if (typeof f.value === "string") return false
        if (Array.isArray(f.value)) return f.value.length > 0
        const range = f.value as { from?: Date; to?: Date } | undefined
        return Boolean(range?.from || range?.to)
    })

interface JobsToolbarProps<TData> {
    table: Table<TData>
    tabs: StatusTab[]
    activeTab: string
    setActiveTab: (value: string) => void
    onOpenFilters: () => void
    onPlanJobs: () => void
}

export function JobsToolbar<TData>({ table, tabs, activeTab, setActiveTab, onOpenFilters, onPlanJobs }: JobsToolbarProps<TData>) {
    const filterCount = sheetFilters(table.getState().columnFilters).length
    const isFiltered = filterCount > 0
    const clearSheetFilters = () => table.setColumnFilters((prev) => prev.filter((f) => typeof f.value === "string"))

    return (
        <div className="flex flex-row items-center justify-between gap-4 w-full mb-[16px] min-w-0 overflow-hidden">
            <div className="flex items-center min-w-0 flex-1 gap-4 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto shrink-0">
                        <TabsList className="h-10 w-max justify-start bg-muted p-1">
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                >
                                    {tab.label} <span className="ml-2 opacity-50 font-normal">{tab.count}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="flex items-center gap-2 justify-end shrink-0">
                <Button className="h-10 px-4 text-xs font-bold gap-1.5 shadow-sm" onClick={onPlanJobs}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Plan jobs
                </Button>
                <div
                    className={cn(
                        "flex items-center h-10 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm transition-all overflow-hidden",
                        isFiltered ? "pl-3 pr-1 gap-2 bg-zinc-100/50 dark:bg-zinc-900/50" : ""
                    )}
                >
                    {isFiltered ? (
                        <>
                            <button onClick={onOpenFilters} className="flex items-center gap-2 h-full hover:opacity-70 transition-opacity pr-1">
                                <Filter className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                                    {filterCount} {filterCount === 1 ? "filter" : "filters"}
                                </span>
                            </button>
                            <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:border-zinc-800" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    clearSheetFilters()
                                }}
                                className="h-8 w-8 p-0 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-sm transition-colors shrink-0"
                                title="Clear all filters"
                            >
                                <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0 text-zinc-900 dark:text-zinc-50"
                            onClick={onOpenFilters}
                            title="Filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 relative overflow-visible shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50" title="Columns">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1.5">Toggle Columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-[300px]">
                            {table
                                .getAllColumns()
                                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                        onSelect={(e) => e.preventDefault()}
                                    >
                                        {(column.columnDef.meta as { title?: string } | undefined)?.title ?? column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
