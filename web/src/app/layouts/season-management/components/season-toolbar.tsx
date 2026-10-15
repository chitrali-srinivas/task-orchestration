"use client";

import { Table } from "@tanstack/react-table";
import * as React from "react";
import {
    Eye,
    Filter,
    X,
    Plus,
    CalendarDays,
    Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SeasonToolbarProps<TData> {
    table?: Table<TData>;
    activeTab: string;
    setActiveTab: (val: string) => void;
    counts: {
        all: number;
        draft: number;
        planned: number;
        inprogress: number;
        completed: number;
        cancelled: number;
    };
    searchTerm?: string;
    onSearchChange?: (val: string) => void;
    viewMode: "table" | "timeline";
    onViewModeChange: (mode: "table" | "timeline") => void;
    onNewSeason: () => void;
    filterCount: number;
    onOpenFilterSidebar: () => void;
    onResetFilters: () => void;
}

export function SeasonToolbar<TData>({
    table,
    activeTab,
    setActiveTab,
    counts,
    searchTerm,
    onSearchChange,
    viewMode,
    onViewModeChange,
    onNewSeason,
    filterCount,
    onOpenFilterSidebar,
    onResetFilters,
}: SeasonToolbarProps<TData>) {
    const isFiltered = filterCount > 0;

    return (
        <div className="flex flex-row items-center justify-between gap-3 w-full mb-3 min-w-0 py-1">
            {/* Left: Status Filter Tabs */}
            <div className="flex items-center min-w-0 flex-1 gap-3">
                <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto shrink-0">
                        <TabsList className="h-10 w-max justify-start bg-muted p-1">
                            <TabsTrigger
                                value="All"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                All <span className="ml-2 opacity-50 font-normal">{counts.all}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Draft"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Draft <span className="ml-2 opacity-50 font-normal">{counts.draft}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Planned"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Planned <span className="ml-2 opacity-50 font-normal">{counts.planned}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Inprogress"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Inprogress <span className="ml-2 opacity-50 font-normal">{counts.inprogress}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Completed"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Completed <span className="ml-2 opacity-50 font-normal">{counts.completed}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Cancelled"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Cancelled <span className="ml-2 opacity-50 font-normal">{counts.cancelled}</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Right: Filter Button (opens right side menu), Column Toggle, View Switcher (Tabs), + New Season */}
            <div className="flex items-center gap-2 justify-end shrink-0 py-0.5">
                {/* 1. Filter Button matching deployment / engagement toolbar styling */}
                <div className={cn(
                    "flex items-center h-10 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm transition-all overflow-hidden",
                    isFiltered ? "pl-3 pr-1 gap-2 bg-zinc-100/50 dark:bg-zinc-900/50" : ""
                )}>
                    {isFiltered ? (
                        <>
                            <button
                                onClick={onOpenFilterSidebar}
                                className="flex items-center gap-2 h-full hover:opacity-70 transition-opacity pr-1 text-zinc-900 dark:text-zinc-50"
                            >
                                <Filter className="h-4 w-4" />
                                <span className="text-sm font-medium whitespace-nowrap">
                                    {filterCount} {filterCount === 1 ? "filter" : "filters"}
                                </span>
                            </button>
                            <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:border-zinc-800" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onResetFilters();
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
                            onClick={onOpenFilterSidebar}
                            title="Filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* 3. Column Visibility Dropdown */}
                {table && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                disabled={viewMode !== "table"}
                                className={cn(
                                    "h-10 w-10 relative overflow-visible shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50",
                                    viewMode !== "table" && "opacity-40 cursor-not-allowed"
                                )}
                                title={viewMode === "table" ? "Columns" : "Columns (Table view only)"}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1.5">
                                Toggle Columns
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <ScrollArea className="h-[280px]">
                                {table
                                    .getAllColumns()
                                    .filter(
                                        (column) =>
                                            typeof column.accessorFn !== "undefined" && column.getCanHide()
                                    )
                                    .map((column) => {
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                className="capitalize text-xs"
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                                onSelect={(e) => e.preventDefault()}
                                            >
                                                {column.id.replace(/([A-Z])/g, " $1").trim()}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* 4. View Switcher: Table vs Timeline (default shadcn Tabs with icon-only triggers) */}
                <Tabs
                    value={viewMode}
                    onValueChange={(v) => onViewModeChange(v as "table" | "timeline")}
                    className="shrink-0"
                >
                    <TabsList className="h-10 bg-muted p-1 border border-zinc-200 dark:border-zinc-800">
                        <TabsTrigger
                            value="table"
                            className="h-8 w-8 p-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            title="Table View"
                        >
                            <Table2 className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger
                            value="timeline"
                            className="h-8 w-8 p-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            title="Timeline View"
                        >
                            <CalendarDays className="h-4 w-4" />
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* 5. Primary Button: + New Season */}
                <Button
                    onClick={onNewSeason}
                    className="h-10 px-4 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 gap-1.5 shadow-sm shrink-0"
                >
                    <Plus className="h-4 w-4" />
                    <span>New Season</span>
                </Button>
            </div>
        </div>
    );
}
