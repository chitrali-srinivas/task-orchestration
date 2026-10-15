"use client"

// Samples — the table toolbar, Deployment V2's (deployment-v2-oct-26/components/data-table-toolbar.tsx): status tabs
// with the server's counts, then the controls — the Data / API Inspector trigger, the filter pill (count + clear) and
// the Columns menu. No search (V2 has none; the API filters by ids).
import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { Eye, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ToolbarTab {
    value: string
    label: string
    /** The server's count for the tab; undefined / NaN while it loads (rendered blank, never guessed). */
    count?: number
}

const formatCount = (value: number | undefined) => (value !== undefined && Number.isFinite(value) ? value : "")

export function SamplesToolbar<TData>({
    table,
    tabs,
    activeTab,
    onTabChange,
    filterCount,
    onOpenFilters,
    onClearFilters,
    inspector,
    columnTitles,
}: {
    table: Table<TData>
    tabs: ToolbarTab[]
    activeTab: string
    onTabChange: (value: string) => void
    /** Filters applied from the filter sheet (not counting the tab). */
    filterCount: number
    onOpenFilters: () => void
    onClearFilters: () => void
    /** The Data / API Inspector trigger, rendered left of Filter. */
    inspector?: React.ReactNode
    columnTitles: Record<string, string>
}) {
    const isFiltered = filterCount > 0
    return (
        <div className="flex flex-row items-center justify-between gap-4 w-full mb-[16px] min-w-0 overflow-hidden">
            <div className="flex items-center min-w-0 flex-1 gap-4 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
                    <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto shrink-0">
                        <TabsList className="h-10 w-max justify-start bg-muted p-1">
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    data-tab={tab.value}
                                    className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                >
                                    {tab.label} <span data-tab-count className="ml-2 opacity-50 font-normal">{formatCount(tab.count)}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div data-toolbar-controls className="flex items-center gap-2 justify-end shrink-0">
                {inspector}

                <div className={cn(
                    "flex items-center h-10 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm transition-all overflow-hidden",
                    isFiltered ? "pl-3 pr-1 gap-2 bg-zinc-100/50 dark:bg-zinc-900/50" : ""
                )}>
                    {isFiltered ? (
                        <>
                            <button type="button" data-open-filters onClick={onOpenFilters} className="flex items-center gap-2 h-full hover:opacity-70 transition-opacity pr-1">
                                <Filter className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                                    {filterCount} {filterCount === 1 ? "filter" : "filters"}
                                </span>
                            </button>
                            <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:border-zinc-800" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClearFilters}
                                className="h-8 w-8 p-0 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-sm transition-colors shrink-0"
                                title="Clear all filters"
                                aria-label="Clear all filters"
                            >
                                <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            data-open-filters
                            className="h-10 w-10 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0 text-zinc-900 dark:text-zinc-50"
                            onClick={onOpenFilters}
                            title="Filters"
                            aria-label="Filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 relative overflow-visible shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50" title="Columns" aria-label="Columns">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1.5">Toggle Columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-[300px]">
                            {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {columnTitles[column.id] ?? column.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
