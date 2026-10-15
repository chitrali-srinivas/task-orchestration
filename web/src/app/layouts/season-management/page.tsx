"use client";

import * as React from "react";
import {
    ColumnFiltersState,
    VisibilityState,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { columns as defaultColumns } from "./components/columns";
import { SeasonTable } from "./components/season-table";
import { SeasonToolbar } from "./components/season-toolbar";
import { SeasonTimeline } from "./components/season-timeline";
import { SeasonDetailSheet } from "./components/season-detail-sheet";
import {
    SeasonFilterSidebar,
    SeasonFilterValue,
    DEFAULT_SEASON_FILTERS,
} from "./components/season-filter-sidebar";
import { SeasonRecord, SeasonQueryFilters } from "./data/schema";
import { useSeasonDataSource, initialSeasons } from "./data/data-source";
import { format } from "date-fns";
import { useServerTable } from "@/lib/server-table";

export default function SeasonManagementPage() {
    const [seasons, setSeasons] = React.useState<SeasonRecord[]>(initialSeasons);
    const [selectedRecord, setSelectedRecord] = React.useState<SeasonRecord | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
    const [drawerMode, setDrawerMode] = React.useState<"create" | "edit">("edit");
    const [viewMode, setViewMode] = React.useState<"table" | "timeline">("table");

    // Facet Filter Sidebar State
    const [isFilterSidebarOpen, setIsFilterSidebarOpen] = React.useState(false);
    const [initialFilterField, setInitialFilterField] = React.useState<string | null>(null);

    const handleOpenFilterForColumn = (columnId: string) => {
        setInitialFilterField(columnId);
        setIsFilterSidebarOpen(true);
    };

    // Table State
    const [rowSelection, setRowSelection] = React.useState({});
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    // Table data (prototype: in-memory mock; production: API-backed data source)
    const dataSource = useSeasonDataSource(seasons);

    // Use Server Table Hook
    const serverTable = useServerTable<SeasonRecord, SeasonQueryFilters>({
        dataSource,
        initialFilters: {
            statusTab: "All",
            ...DEFAULT_SEASON_FILTERS,
        },
        initialPageSize: 1000,
        debounceMs: 350,
    });

    const activeTab = serverTable.filters.statusTab || "All";

    const handleTabChange = (val: string) => {
        serverTable.setFilter("statusTab", val);
    };

    // Map SeasonFilterValue to TanStack ColumnFiltersState
    const mapSeasonFiltersToColumnFilters = React.useCallback((
        filters: Partial<SeasonFilterValue>,
        existingColumnFilters: ColumnFiltersState = []
    ): ColumnFiltersState => {
        const stringFilters = existingColumnFilters.filter(
            (f) => typeof f.value === "string" && f.value.trim().length > 0
        );
        const next: ColumnFiltersState = [...stringFilters];

        if (filters.seasonIds && filters.seasonIds.length > 0) {
            next.push({ id: "id", value: filters.seasonIds });
        }
        if (filters.bases && filters.bases.length > 0) {
            next.push({ id: "baseName", value: filters.bases });
        }
        if (filters.countries && filters.countries.length > 0) {
            next.push({ id: "country", value: filters.countries });
        }
        if (filters.azNames && filters.azNames.length > 0) {
            next.push({ id: "azName", value: filters.azNames });
        }
        if (filters.seasons && filters.seasons.length > 0) {
            next.push({ id: "season", value: filters.seasons });
        }
        if (filters.statuses && filters.statuses.length > 0) {
            next.push({ id: "status", value: filters.statuses });
        }
        if (filters.createdBy && filters.createdBy.length > 0) {
            next.push({ id: "createdBy", value: filters.createdBy });
        }
        if (filters.updatedBy && filters.updatedBy.length > 0) {
            next.push({ id: "updatedBy", value: filters.updatedBy });
        }
        if (filters.startDate?.from || filters.startDate?.to) {
            next.push({ id: "seasonStart", value: filters.startDate });
        }
        if (filters.endDate?.from || filters.endDate?.to) {
            next.push({ id: "seasonEnd", value: filters.endDate });
        }

        return next;
    }, []);

    // Forward in-column search filters to the server hook and sync facet filters
    const handleColumnFiltersChange = (updater: any) => {
        const nextFilters = typeof updater === "function" ? updater(columnFilters) : updater;
        setColumnFilters(nextFilters);

        // Extract string searches and facet filter values
        const colSearches: Record<string, string> = {};
        const colFilterMap: Record<string, any> = {};

        for (const f of nextFilters) {
            if (typeof f.value === "string") {
                if (f.value.trim().length > 0) {
                    colSearches[f.id] = f.value;
                }
            } else if (f.value !== undefined && f.value !== null) {
                colFilterMap[f.id] = f.value;
            }
        }

        // Update column searches on server table
        for (const col of defaultColumns) {
            const colId = (col as any).accessorKey || (col as any).id;
            if (colId) {
                serverTable.setColumnSearch(colId, colSearches[colId]);
            }
        }

        // Keep serverTable.filters synchronized when facet filters are modified or cleared via column header
        serverTable.setFilters((prev) => ({
            ...prev,
            seasonIds: colFilterMap["id"] || [],
            bases: colFilterMap["baseName"] || [],
            countries: colFilterMap["country"] || [],
            azNames: colFilterMap["azName"] || [],
            seasons: colFilterMap["season"] || [],
            statuses: colFilterMap["status"] || [],
            createdBy: colFilterMap["createdBy"] || [],
            updatedBy: colFilterMap["updatedBy"] || [],
            startDate: colFilterMap["seasonStart"] || { from: undefined, to: undefined },
            endDate: colFilterMap["seasonEnd"] || { from: undefined, to: undefined },
        }));
    };

    // React Table instance configured in Server / Manual mode
    const table = useReactTable({
        data: serverTable.data,
        columns: defaultColumns,
        pageCount: serverTable.pageCount,
        rowCount: serverTable.totalCount,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        state: {
            sorting: serverTable.sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination: serverTable.pagination,
        },
        onSortingChange: serverTable.onSortingChange,
        onColumnFiltersChange: handleColumnFiltersChange,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: serverTable.onPaginationChange,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            openFilterForColumn: handleOpenFilterForColumn,
        },
    });

    const handleRecordClick = (record: SeasonRecord) => {
        setSelectedRecord(record);
        setDrawerMode("edit");
        setIsDrawerOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedRecord(null);
        setDrawerMode("create");
        setIsDrawerOpen(true);
    };

    const handleSaveSeason = (saved: SeasonRecord) => {
        setSeasons(prev => {
            const index = prev.findIndex(s => s.id === saved.id);
            if (index >= 0) {
                const updated = [...prev];
                updated[index] = saved;
                return updated;
            } else {
                return [saved, ...prev];
            }
        });
        setSelectedRecord(saved);
    };

    // Options for Facet Filter Sidebar derived from available records
    const allSeasonIds = React.useMemo(() => {
        const fromData = seasons.map(s => s.id);
        const selected = serverTable.filters.seasonIds || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.seasonIds]);

    const allBases = React.useMemo(() => {
        const fromData = seasons.map(s => s.baseName);
        const selected = serverTable.filters.bases || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.bases]);

    const allAzNames = React.useMemo(() => {
        const fromData = seasons.map(s => s.azName);
        const selected = serverTable.filters.azNames || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.azNames]);

    const allCountries = React.useMemo(() => {
        const fromData = seasons.map(s => s.country);
        const selected = serverTable.filters.countries || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.countries]);

    const allSeasons = React.useMemo(() => {
        const fromData = seasons.map(s => s.season || "Kharif");
        const selected = serverTable.filters.seasons || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.seasons]);

    const allStatuses = React.useMemo(() => {
        const fromData = seasons.map(s => s.status);
        const selected = serverTable.filters.statuses || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.statuses]);

    const allCreatedBy = React.useMemo(() => {
        const fromData = seasons.map(s => s.createdBy);
        const selected = serverTable.filters.createdBy || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.createdBy]);

    const allUpdatedBy = React.useMemo(() => {
        const fromData = seasons.map(s => s.updatedBy).filter(Boolean);
        const selected = serverTable.filters.updatedBy || [];
        return Array.from(new Set([...selected, ...fromData])).filter(Boolean);
    }, [seasons, serverTable.filters.updatedBy]);

    // Navigation in Drawer
    const handleNext = () => {
        if (!selectedRecord) return;
        const currentIndex = serverTable.data.findIndex(r => r.id === selectedRecord.id);
        if (currentIndex < serverTable.data.length - 1) {
            setSelectedRecord(serverTable.data[currentIndex + 1]);
        }
    };

    const handlePrevious = () => {
        if (!selectedRecord) return;
        const currentIndex = serverTable.data.findIndex(r => r.id === selectedRecord.id);
        if (currentIndex > 0) {
            setSelectedRecord(serverTable.data[currentIndex - 1]);
        }
    };

    const currentIndex = selectedRecord ? serverTable.data.findIndex(r => r.id === selectedRecord.id) : -1;
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === serverTable.data.length - 1;

    // Count active facet filters
    const sidebarFilterCount = React.useMemo(() => {
        const f = serverTable.filters;
        return (
            (f.seasonIds?.length || 0) +
            (f.bases?.length || 0) +
            (f.countries?.length || 0) +
            (f.azNames?.length || 0) +
            (f.seasons?.length || 0) +
            (f.statuses?.length || 0) +
            (f.createdBy?.length || 0) +
            (f.updatedBy?.length || 0) +
            (f.startDate?.from || f.startDate?.to ? 1 : 0) +
            (f.endDate?.from || f.endDate?.to ? 1 : 0)
        );
    }, [serverTable.filters]);

    // Summary counts for tabs
    const counts = (serverTable.summaryCounts as {
        all: number;
        draft: number;
        planned: number;
        inprogress: number;
        completed: number;
        cancelled: number;
    } | undefined) || {
        all: seasons.length,
        draft: seasons.filter(s => s.status === "Draft").length,
        planned: seasons.filter(s => s.status === "Planned").length,
        inprogress: seasons.filter(s => s.status === "Inprogress").length,
        completed: seasons.filter(s => s.status === "Completed").length,
        cancelled: seasons.filter(s => s.status === "Cancelled").length,
    };

    const handleResetAllFilters = () => {
        setColumnFilters([]);
        serverTable.clearFilters({
            statusTab: "All",
            ...DEFAULT_SEASON_FILTERS,
        });
    };

    return (
        <NavBarType4
            pageTitle="Season Management"
            activeItemUrl="/layouts/season-management"
            pageDescription="Track and manage agricultural seasons, chronological 21-activity timelines, Gantt schedules, and operational parameters across bases."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    {/* Permanently Mounted Hoisted Toolbar */}
                    <div className="shrink-0 min-w-0 w-full">
                        <SeasonToolbar
                            table={table}
                            activeTab={activeTab}
                            setActiveTab={handleTabChange}
                            counts={counts}
                            searchTerm={serverTable.searchDraft}
                            onSearchChange={serverTable.setSearch}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onNewSeason={handleCreateNew}
                            filterCount={sidebarFilterCount}
                            onOpenFilterSidebar={() => setIsFilterSidebarOpen(true)}
                            onResetFilters={() => {
                                setColumnFilters(prev => prev.filter(f => typeof f.value === "string" && f.value.trim().length > 0));
                                serverTable.setFilters((prev) => ({
                                    ...prev,
                                    ...DEFAULT_SEASON_FILTERS,
                                }));
                            }}
                        />
                    </div>

                    {/* View Content (Table or Timeline) */}
                    <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                        {viewMode === "table" ? (
                            <SeasonTable
                                table={table}
                                columns={defaultColumns}
                                onRowClick={handleRecordClick}
                                selectedId={selectedRecord?.id}
                                isLoading={serverTable.isLoading}
                                isInitialLoading={serverTable.isInitialLoading}
                                error={serverTable.error}
                                onRetry={serverTable.retry}
                                hasActiveFilters={serverTable.hasActiveFilters}
                                onClearFilters={handleResetAllFilters}
                            />
                        ) : (
                            <div className="flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
                                <SeasonTimeline
                                    seasons={serverTable.data.length > 0 ? serverTable.data : seasons}
                                    selectedSeasonId={selectedRecord?.id}
                                    onSelectSeason={(id) => {
                                        const found = seasons.find(s => s.id === id);
                                        if (found) setSelectedRecord(found);
                                    }}
                                    onEditSeason={(s) => {
                                        setSelectedRecord(s);
                                        setDrawerMode("edit");
                                        setIsDrawerOpen(true);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right-Side Details Drawer */}
                <SeasonDetailSheet
                    open={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    season={selectedRecord}
                    mode={drawerMode}
                    onSave={handleSaveSeason}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    isFirst={isFirst}
                    isLast={isLast}
                    currentIndex={currentIndex}
                    totalCount={serverTable.totalCount}
                />

                {/* Right-Side Filter Side Menu */}
                <SeasonFilterSidebar
                    open={isFilterSidebarOpen}
                    onOpenChange={(open) => {
                        setIsFilterSidebarOpen(open);
                        if (!open) setInitialFilterField(null);
                    }}
                    initialOpenField={initialFilterField}
                    filters={serverTable.filters}
                    onApply={(newFilters) => {
                        serverTable.setFilters((prev) => ({
                            ...prev,
                            ...newFilters,
                        }));
                        setColumnFilters(prev => mapSeasonFiltersToColumnFilters(newFilters, prev));
                    }}
                    onReset={() => {
                        serverTable.setFilters((prev) => ({
                            statusTab: prev.statusTab,
                            ...DEFAULT_SEASON_FILTERS,
                        }));
                        setColumnFilters(prev => prev.filter(f => typeof f.value === "string" && f.value.trim().length > 0));
                    }}
                    seasonIds={allSeasonIds}
                    bases={allBases}
                    countries={allCountries}
                    azNames={allAzNames}
                    seasons={allSeasons}
                    statuses={allStatuses}
                    createdByList={allCreatedBy}
                    updatedByList={allUpdatedBy}
                />

                {/* Footer Section */}
                <div className="shrink-0 py-3 px-1 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <div className="flex items-center gap-4">
                            <span>Season Framework v2.1.0-stable</span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span>All rights reserved by Mati Carbon Pvt</span>
                                <button className="text-zinc-900 dark:text-zinc-300 hover:underline underline-offset-2 font-bold">TnC</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Session ID:</span>
                                <span className="font-mono text-zinc-600 dark:text-zinc-400">MC-SEASON-8824</span>
                            </div>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Last Refreshed:</span>
                                <span className="text-zinc-600 dark:text-zinc-400" suppressHydrationWarning>{format(new Date(), "dd MMM yyyy, hh:mm aa")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </NavBarType4>
    );
}
