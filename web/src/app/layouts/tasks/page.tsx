"use client";

// Tasks — HQ view of every task the survey workflows created, built like the Deployment page (layouts/deployment):
// status tabs with counts, filter sheet, column toggle, server-driven table (useServerTable + data/data-source.ts),
// and a detail sheet per row where collected tasks are verified and tasks are cancelled with a reason.
// No date selection: all tasks, paginated, in work-queue order (status level, then oldest planned start first), so
// pending tasks read oldest first for surveyor assignment. The simulated "today" is set on the Phone simulator.
// Planned tasks are assigned to a surveyor's route for a day: tick rows → Assign, or Assign in the detail sheet.
import * as React from "react";
import { format } from "date-fns";
import { RowSelectionState } from "@tanstack/react-table";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { useServerTable } from "@/lib/server-table";
import { Farmer, STATUS, Task } from "@/lib/orchestration/engine";
import { Route, Surveyor } from "@/lib/orchestration/routes";
import {
    assignToRoute,
    cancelTask,
    changeStatus,
    loadFarmers,
    loadRoutes,
    loadSurveyors,
    loadToday,
    refreshTasks,
    removeFromRoute,
} from "@/lib/orchestration/store";
import { Workflow, loadWorkflows } from "../survey-workflow/workflow-store";
import { SurveyService } from "../survey-builder/services/survey-service";
import { SurveyModel } from "../survey-builder/types/survey-schema";
import { TaskFilters, TaskRecord } from "./data/schema";
import { buildTaskRecords, statusLabel, statusOrder, useTasksDataSource } from "./data/data-source";
import { UNASSIGNED } from "./data/table-config";
import { selectColumn, taskColumns } from "./components/columns";
import { AssignDialog } from "./components/assign-dialog";
import { TasksTable } from "./components/data-table";
import { StatusTab, TasksToolbar, sheetFilters } from "./components/data-table-toolbar";
import { TaskDetailSheet } from "./components/task-detail-sheet";
import { FilterDraft, FilterField, TasksFilterSheet, isFilterValueActive } from "./components/tasks-filter-sheet";

const ALL = "all";

export default function TasksPage() {
    const [today, setToday] = React.useState("");
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [farmers, setFarmers] = React.useState<Farmer[]>([]);
    const [surveys, setSurveys] = React.useState<SurveyModel[]>([]);
    const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
    const [routes, setRoutes] = React.useState<Route[]>([]);
    const [surveyors, setSurveyors] = React.useState<Surveyor[]>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [assignIds, setAssignIds] = React.useState<string[] | null>(null);
    const [activeTab, setActiveTab] = React.useState<string>(ALL);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
    const [initialFilterField, setInitialFilterField] = React.useState<string | null>(null);

    React.useEffect(() => {
        const t = loadToday();
        setToday(t);
        setTasks(refreshTasks(t));
        setFarmers(loadFarmers());
        setWorkflows(loadWorkflows());
        setRoutes(loadRoutes());
        setSurveyors(loadSurveyors());
        SurveyService.getAllSurveys().then(setSurveys);
    }, []);

    const records = React.useMemo(
        () => buildTaskRecords(tasks, farmers, surveys, workflows, routes, surveyors),
        [tasks, farmers, surveys, workflows, routes, surveyors]
    );
    const dataSource = useTasksDataSource(records);
    const serverTable = useServerTable<TaskRecord, TaskFilters>({
        dataSource,
        initialFilters: {},
        initialPageSize: 20,
        debounceMs: 350,
    });

    // Tabs follow the status levels the table is sorted by.
    const tabs: StatusTab[] = React.useMemo(() => {
        const statuses = statusOrder(tasks, surveys);
        const fallback: Record<string, number> = { all: records.length };
        records.forEach((r) => (fallback[r.status] = (fallback[r.status] ?? 0) + 1));
        const counts = serverTable.summaryCounts ?? fallback;
        return [{ value: ALL, label: "All", count: counts.all ?? 0 }, ...statuses.map((s) => ({ value: s, label: statusLabel(s), count: counts[s] ?? 0 }))];
    }, [surveys, tasks, records, serverTable.summaryCounts]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        serverTable.setFilter("tabStatus", value === ALL ? undefined : value);
    };

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === ALL ? {} : { tabStatus: activeTab });
    }, [activeTab, serverTable]);

    // The status column is shown on the All tab only; on a status tab every row has that status.
    // Checkboxes only where planned tasks are listed (only those can be assigned).
    const columns = React.useMemo(() => {
        const all = taskColumns(today);
        const shown = activeTab === ALL ? all : all.filter((c) => (c as { accessorKey?: string }).accessorKey !== "status");
        return activeTab === ALL || activeTab === STATUS.planned ? [selectColumn, ...shown] : shown;
    }, [today, activeTab]);

    // Ticked rows that are still planned (a ticked task may have been collected or cancelled since).
    const selectedIds = React.useMemo(() => {
        const planned = new Set(records.filter((r) => r.status === STATUS.planned).map((r) => r.id));
        return Object.keys(rowSelection).filter((id) => rowSelection[id] && planned.has(id));
    }, [records, rowSelection]);

    const assign = (surveyorId: string, date: string) => {
        if (!assignIds) return;
        setRoutes(assignToRoute(assignIds, surveyorId, date));
        setAssignIds(null);
        setRowSelection({});
    };

    const filterFields: FilterField[] = React.useMemo(() => {
        const surveyOptions = new Map(records.map((r) => [r.surveyId, r.surveyName]));
        const villages = Array.from(new Set(records.map((r) => r.village).filter(Boolean))).sort();
        return [
            { id: "surveyName", label: "Survey template", kind: "multi", options: Array.from(surveyOptions, ([value, label]) => ({ value, label })) },
            { id: "farmerName", label: "Farmer", kind: "multi", options: farmers.map((f) => ({ value: f.id, label: f.village ? `${f.name} (${f.village})` : f.name })) },
            { id: "village", label: "Village", kind: "multi", options: villages.map((v) => ({ value: v, label: v })) },
            {
                id: "createdFrom",
                label: "Created from",
                kind: "multi",
                options: [
                    { value: "registration", label: "Registration" },
                    { value: "follow-up", label: "Follow-up task" },
                ],
            },
            {
                id: "assignedTo",
                label: "Assigned to",
                kind: "multi",
                options: [{ value: UNASSIGNED, label: "Unassigned" }, ...surveyors.map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inactive)` }))],
            },
            { id: "visitDate", label: "Visit date", kind: "date" },
            { id: "plannedStart", label: "Planned start", kind: "date" },
            { id: "plannedEnd", label: "Planned end", kind: "date" },
        ];
    }, [records, farmers, surveyors]);

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
    const parent = selectedRecord?.parentTaskId ? records.find((r) => r.id === selectedRecord.parentTaskId) : undefined;
    const followUps = React.useMemo(
        () => (selectedId ? records.filter((r) => r.parentTaskId === selectedId).sort((a, b) => a.taskNo - b.taskNo) : []),
        [records, selectedId]
    );

    const handleRecordClick = (record: TaskRecord) => {
        setSelectedId(record.id);
        setIsSheetOpen(true);
    };

    /** After an action: on a status tab the task leaves the list, so move to the next row (or the previous, or close). */
    const afterAction = (next: Task[]) => {
        const row = serverTable.data[currentIndex + 1] ?? serverTable.data[currentIndex - 1];
        setTasks(next);
        if (activeTab === ALL) return;
        if (row) setSelectedId(row.id);
        else setIsSheetOpen(false);
    };

    const emptyTitle = records.length === 0 ? "No tasks yet" : activeTab === ALL ? "No tasks found" : `No ${statusLabel(activeTab).toLowerCase()} tasks`;
    const emptyDescription = records.length === 0 ? "Register a farmer in the Phone simulator to create the first ones." : "There are no tasks with this status.";

    return (
        <NavBarType4
            pageTitle="Tasks"
            activeItemUrl="/layouts/tasks"
            pageDescription="Every task the survey workflows created: one survey for one farmer. Assign planned tasks to a surveyor's route, verify collected surveys, cancel tasks that are no longer needed, and follow each task back to the survey that created it."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                        <TasksTable
                            data={serverTable.data}
                            columns={columns}
                            toolbar={(table) => (
                                <TasksToolbar
                                    table={table}
                                    tabs={tabs}
                                    activeTab={activeTab}
                                    setActiveTab={handleTabChange}
                                    onOpenFilters={() => openFilters()}
                                    selectedCount={selectedIds.length}
                                    onAssignSelected={() => setAssignIds(selectedIds)}
                                    onClearSelection={() => setRowSelection({})}
                                />
                            )}
                            onRowClick={handleRecordClick}
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
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            canSelectRow={(row) => row.original.status === STATUS.planned}
                        />
                    </div>
                </div>

                <TaskDetailSheet
                    record={selectedRecord}
                    open={isSheetOpen && selectedRecord !== null}
                    onOpenChange={setIsSheetOpen}
                    survey={surveys.find((s) => s.id === selectedRecord?.surveyId)}
                    parent={parent}
                    followUps={followUps}
                    onSelectTask={setSelectedId}
                    onPrevious={() => currentIndex > 0 && setSelectedId(serverTable.data[currentIndex - 1].id)}
                    onNext={() => currentIndex < serverTable.data.length - 1 && setSelectedId(serverTable.data[currentIndex + 1].id)}
                    isFirst={currentIndex <= 0}
                    isLast={currentIndex === serverTable.data.length - 1}
                    currentIndex={position}
                    totalCount={serverTable.totalCount}
                    onVerify={() => selectedId && afterAction(changeStatus(selectedId, STATUS.verified, today))}
                    onCancel={(reason) => selectedId && afterAction(cancelTask(selectedId, reason, today))}
                    onAssign={() => selectedId && setAssignIds([selectedId])}
                    onUnassign={() => selectedId && setRoutes(removeFromRoute([selectedId]))}
                />

                {assignIds && (
                    <AssignDialog
                        key={assignIds.join("|")}
                        taskIds={assignIds}
                        tasks={tasks}
                        records={records}
                        routes={routes}
                        surveyors={surveyors}
                        today={today}
                        onClose={() => setAssignIds(null)}
                        onAssign={assign}
                    />
                )}

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

                {/* Footer Section */}
                <div className="shrink-0 py-3 px-1 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <div className="flex items-center gap-4">
                            <span>Version 1.2.4-stable</span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span>All rights reserved by Mati Carbon Pvt</span>
                                <button className="text-zinc-900 dark:text-zinc-300 hover:underline underline-offset-2 font-bold">TnC</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Session ID:</span>
                                <span className="font-mono text-zinc-600 dark:text-zinc-400">MC-8824-X92</span>
                            </div>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Last Refreshed:</span>
                                <span className="text-zinc-600 dark:text-zinc-400" suppressHydrationWarning>
                                    {format(new Date(), "dd MMM yyyy, hh:mm aa")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </NavBarType4>
    );
}
