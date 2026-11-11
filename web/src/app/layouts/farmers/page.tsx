"use client";

// Farmers — every farmer registered on the phone, built like the Tasks page (layouts/tasks) and reusing its table,
// toolbar and filter sheet: location tabs with counts (where planning finds each farmer), filter sheet, column toggle,
// server-driven table (useServerTable + data/data-source.ts), and a detail sheet per row with the farmer's tasks.
// Newest registrations first.
import * as React from "react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { useServerTable } from "@/lib/server-table";
import { Farmer, Task } from "@/lib/orchestration/engine";
import { Job, Surveyor, Village } from "@/lib/orchestration/jobs";
import { loadFarmers, loadJobs, loadSurveyors, loadToday, loadVillages, refreshTasks } from "@/lib/orchestration/store";
import { Workflow, loadWorkflows } from "../survey-workflow/workflow-store";
import { SurveyService } from "../survey-builder/services/survey-service";
import { SurveyModel } from "../survey-builder/types/survey-schema";
import { buildTaskRecords } from "../tasks/data/data-source";
import { TasksTable } from "../tasks/components/data-table";
import { StatusTab, TasksToolbar, sheetFilters } from "../tasks/components/data-table-toolbar";
import { FilterDraft, FilterField, TasksFilterSheet, isFilterValueActive } from "../tasks/components/tasks-filter-sheet";
import { FarmerFilters, FarmerRecord } from "./data/schema";
import { LOCATION_LABEL, LOCATION_SOURCES, buildFarmerRecords, useFarmersDataSource } from "./data/data-source";
import { farmerColumns } from "./components/columns";
import { FarmerDetailSheet } from "./components/farmer-detail-sheet";

const ALL = "all";

export default function FarmersPage() {
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [farmers, setFarmers] = React.useState<Farmer[]>([]);
    const [surveys, setSurveys] = React.useState<SurveyModel[]>([]);
    const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
    const [jobs, setJobs] = React.useState<Job[]>([]);
    const [surveyors, setSurveyors] = React.useState<Surveyor[]>([]);
    const [villages, setVillages] = React.useState<Village[]>([]);
    const [activeTab, setActiveTab] = React.useState<string>(ALL);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
    const [initialFilterField, setInitialFilterField] = React.useState<string | null>(null);

    React.useEffect(() => {
        setTasks(refreshTasks(loadToday()));
        setFarmers(loadFarmers());
        setWorkflows(loadWorkflows());
        setJobs(loadJobs());
        setSurveyors(loadSurveyors());
        setVillages(loadVillages());
        SurveyService.getAllSurveys().then(setSurveys);
    }, []);

    const taskRecords = React.useMemo(
        () => buildTaskRecords(tasks, farmers, surveys, workflows, jobs, surveyors),
        [tasks, farmers, surveys, workflows, jobs, surveyors]
    );
    const records = React.useMemo(() => buildFarmerRecords(farmers, taskRecords, villages), [farmers, taskRecords, villages]);
    const dataSource = useFarmersDataSource(records);
    const serverTable = useServerTable<FarmerRecord, FarmerFilters>({
        dataSource,
        initialFilters: {},
        initialPageSize: 20,
        debounceMs: 350,
    });

    const tabs: StatusTab[] = React.useMemo(() => {
        const fallback: Record<string, number> = { all: records.length };
        records.forEach((r) => (fallback[r.locationSource] = (fallback[r.locationSource] ?? 0) + 1));
        const counts = serverTable.summaryCounts ?? fallback;
        return [{ value: ALL, label: "All", count: counts.all ?? 0 }, ...LOCATION_SOURCES.map((s) => ({ value: s, label: LOCATION_LABEL[s], count: counts[s] ?? 0 }))];
    }, [records, serverTable.summaryCounts]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        serverTable.setFilter("tabLocation", value === ALL ? undefined : (value as FarmerFilters["tabLocation"]));
    };

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === ALL ? {} : { tabLocation: activeTab as FarmerFilters["tabLocation"] });
    }, [activeTab, serverTable]);

    // The location column is shown on the All tab only; on a location tab every row has that source.
    const columns = React.useMemo(
        () => (activeTab === ALL ? farmerColumns : farmerColumns.filter((c) => (c as { accessorKey?: string }).accessorKey !== "locationSource")),
        [activeTab]
    );

    const filterFields: FilterField[] = React.useMemo(() => {
        const villageNames = Array.from(new Set(records.map((r) => r.village).filter(Boolean))).sort();
        return [
            { id: "village", label: "Village", kind: "multi", options: villageNames.map((v) => ({ value: v, label: v })) },
            { id: "locationSource", label: "Location", kind: "multi", options: LOCATION_SOURCES.map((s) => ({ value: s, label: LOCATION_LABEL[s] })) },
            { id: "registeredOn", label: "Registered", kind: "date" },
            { id: "nextVisit", label: "Next visit", kind: "date" },
        ];
    }, [records]);

    const appliedFilters: FilterDraft = React.useMemo(
        () => Object.fromEntries(sheetFilters(serverTable.columnFilters).map((f) => [f.id, f.value as FilterDraft[string]])),
        [serverTable.columnFilters]
    );

    const applyFilters = (draft: FilterDraft) => {
        serverTable.onColumnFiltersChange((prev) => [
            // Header searches stay; sheet filters are replaced by the draft.
            ...prev.filter((f) => typeof f.value === "string"),
            ...Object.entries(draft)
                .filter(([, value]) => isFilterValueActive(value))
                .map(([id, value]) => ({ id, value })),
        ]);
    };

    const openFilters = (field: string | null = null) => {
        setInitialFilterField(field);
        setFilterSheetOpen(true);
    };

    // Detail sheet
    const selectedRecord = records.find((r) => r.id === selectedId) ?? null;
    const currentIndex = selectedId ? serverTable.data.findIndex((r) => r.id === selectedId) : -1;
    const position = currentIndex >= 0 ? serverTable.pagination.pageIndex * serverTable.pagination.pageSize + currentIndex : -1;

    const emptyTitle = records.length === 0 ? "No farmers yet" : activeTab === ALL ? "No farmers found" : `No farmers with ${LOCATION_LABEL[activeTab as keyof typeof LOCATION_LABEL].toLowerCase()}`;
    const emptyDescription = records.length === 0 ? "Register a farmer in the Phone simulator to see them here." : "Try another tab or clear the filters.";

    return (
        <NavBarType4
            pageTitle="Farmers"
            activeItemUrl="/layouts/farmers"
            pageDescription="Every farmer registered on the phone: where planning finds them, their tasks by status and their next visit. Open a farmer to see all of their tasks."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                        <TasksTable
                            data={serverTable.data}
                            columns={columns}
                            toolbar={(table) => (
                                <TasksToolbar table={table} tabs={tabs} activeTab={activeTab} setActiveTab={handleTabChange} onOpenFilters={() => openFilters()} />
                            )}
                            onRowClick={(record) => {
                                setSelectedId(record.id);
                                setIsSheetOpen(true);
                            }}
                            selectedId={isSheetOpen ? selectedId ?? undefined : undefined}
                            filterFields={filterFields.map((f) => f.id)}
                            onOpenFilterForColumn={openFilters}
                            isLoading={serverTable.isLoading}
                            error={serverTable.error}
                            onRetry={serverTable.retry}
                            hasActiveFilters={serverTable.hasActiveFilters}
                            onClearFilters={handleClearFilters}
                            emptyTitle={emptyTitle}
                            emptyDescription={emptyDescription}
                            pageCount={serverTable.pageCount}
                            rowCount={serverTable.totalCount}
                            pagination={serverTable.pagination}
                            onPaginationChange={serverTable.onPaginationChange}
                            sorting={serverTable.sorting}
                            onSortingChange={serverTable.onSortingChange}
                            columnFilters={serverTable.columnFilters}
                            onColumnFiltersChange={serverTable.onColumnFiltersChange}
                        />
                    </div>
                </div>

                <FarmerDetailSheet
                    record={selectedRecord}
                    open={isSheetOpen && selectedRecord !== null}
                    onOpenChange={setIsSheetOpen}
                    onPrevious={() => currentIndex > 0 && setSelectedId(serverTable.data[currentIndex - 1].id)}
                    onNext={() => currentIndex < serverTable.data.length - 1 && setSelectedId(serverTable.data[currentIndex + 1].id)}
                    isFirst={currentIndex <= 0}
                    isLast={currentIndex === serverTable.data.length - 1}
                    currentIndex={position}
                    totalCount={serverTable.totalCount}
                />

                <TasksFilterSheet
                    open={filterSheetOpen}
                    onOpenChange={(open) => {
                        setFilterSheetOpen(open);
                        if (!open) setInitialFilterField(null);
                    }}
                    fields={filterFields}
                    applied={appliedFilters}
                    onApply={applyFilters}
                    initialOpenField={initialFilterField}
                />
            </div>
        </NavBarType4>
    );
}
