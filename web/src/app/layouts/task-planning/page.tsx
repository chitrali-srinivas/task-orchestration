"use client";

// Task planning — HQ turns pending tasks into jobs, built like the Deployment page (layouts/deployment): job status tabs
// with counts, filter sheet, column toggle, server-driven table (useServerTable + data/data-source.ts) and a detail sheet
// per job. A job is one surveyor's visits for one day. "Plan jobs" picks the day, the active surveyors and the farmers;
// the planner (lib/orchestration/jobs.ts) allocates and orders the stops. Lifecycle: created → assigned (HQ) → accepted
// → in progress (surveyor, on the phone) → job sheet closed. Opened from Tasks with ?plan=<task ids> or ?job=<job id>.
import * as React from "react";
import { format } from "date-fns";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { useServerTable } from "@/lib/server-table";
import type { Farmer, Task } from "@/lib/orchestration/engine";
import { JOB_STATUS, JOB_STATUSES, Job, JobPlan, Surveyor, Village } from "@/lib/orchestration/jobs";
import {
    addTasksToJob,
    changeJobSurveyor,
    createPlannedJobs,
    deleteCreatedJob,
    jobAction,
    loadFarmers,
    loadJobs,
    loadSurveyors,
    loadToday,
    loadVillages,
    refreshTasks,
    removeTasksFromJobs,
    saveJobOrder,
} from "@/lib/orchestration/store";
import { SurveyService } from "../survey-builder/services/survey-service";
import { SurveyModel } from "../survey-builder/types/survey-schema";
import { JobFilters, JobRecord } from "./data/schema";
import { JOB_STATUS_LABEL, buildJobRecords, useJobsDataSource } from "./data/data-source";
import { jobColumns } from "./components/columns";
import { JobsTable } from "./components/data-table";
import { JobsToolbar, StatusTab, sheetFilters } from "./components/data-table-toolbar";
import { JobDetailSheet } from "./components/job-detail-sheet";
import { PlanJobsSheet } from "./components/plan-jobs-sheet";
import { FilterDraft, FilterField, JobsFilterSheet, isFilterValueActive } from "./components/jobs-filter-sheet";

const ALL = "all";

export default function TaskPlanningPage() {
    const [today, setToday] = React.useState("");
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [farmers, setFarmers] = React.useState<Farmer[]>([]);
    const [surveys, setSurveys] = React.useState<SurveyModel[]>([]);
    const [jobs, setJobs] = React.useState<Job[]>([]);
    const [surveyors, setSurveyors] = React.useState<Surveyor[]>([]);
    const [villages, setVillages] = React.useState<Village[]>([]);
    const [activeTab, setActiveTab] = React.useState<string>(ALL);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
    const [initialFilterField, setInitialFilterField] = React.useState<string | null>(null);
    /** null = Plan jobs closed; otherwise the tasks it starts with (empty = every unassigned task due that day). */
    const [planTaskIds, setPlanTaskIds] = React.useState<string[] | null>(null);
    const [planKey, setPlanKey] = React.useState(0);

    React.useEffect(() => {
        const t = loadToday();
        setToday(t);
        setTasks(refreshTasks(t));
        setFarmers(loadFarmers());
        setJobs(loadJobs());
        setSurveyors(loadSurveyors());
        setVillages(loadVillages());
        SurveyService.getAllSurveys().then(setSurveys);
        // Links from the Tasks page: ?plan=<task ids> opens Plan jobs with them; ?job=<id> opens that job.
        const params = new URLSearchParams(window.location.search);
        const plan = params.get("plan");
        const job = params.get("job");
        if (plan !== null) setPlanTaskIds(plan.split(",").filter(Boolean));
        if (job) {
            setSelectedId(job);
            setIsSheetOpen(true);
        }
        if (plan !== null || job) window.history.replaceState(null, "", window.location.pathname);
    }, []);

    const records = React.useMemo(() => buildJobRecords(jobs, tasks, farmers, surveyors, villages), [jobs, tasks, farmers, surveyors, villages]);
    const dataSource = useJobsDataSource(records);
    const serverTable = useServerTable<JobRecord, JobFilters>({
        dataSource,
        initialFilters: {},
        initialPageSize: 20,
        debounceMs: 350,
    });

    const tabs: StatusTab[] = React.useMemo(() => {
        const fallback: Record<string, number> = { all: records.length };
        records.forEach((r) => (fallback[r.status] = (fallback[r.status] ?? 0) + 1));
        const counts = serverTable.summaryCounts ?? fallback;
        return [{ value: ALL, label: "All", count: counts.all ?? 0 }, ...JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABEL[s], count: counts[s] ?? 0 }))];
    }, [records, serverTable.summaryCounts]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        serverTable.setFilter("tabStatus", value === ALL ? undefined : value);
    };

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === ALL ? {} : { tabStatus: activeTab });
    }, [activeTab, serverTable]);

    // The status column is shown on the All tab only; on a status tab every row has that status.
    const columns = React.useMemo(() => {
        const all = jobColumns(today);
        return activeTab === ALL ? all : all.filter((c) => (c as { accessorKey?: string }).accessorKey !== "status");
    }, [today, activeTab]);

    const filterFields: FilterField[] = React.useMemo(() => {
        const villageNames = Array.from(new Set(records.flatMap((r) => r.villageList))).sort();
        return [
            { id: "date", label: "Job date", kind: "date" },
            { id: "surveyorName", label: "Surveyor", kind: "multi", options: surveyors.map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inactive)` })) },
            { id: "village", label: "Village", kind: "multi", options: villageNames.map((v) => ({ value: v, label: v })) },
        ];
    }, [records, surveyors]);

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

    const openPlan = (taskIds: string[] = []) => {
        setPlanKey((k) => k + 1);
        setPlanTaskIds(taskIds);
    };

    const createJobs = (plan: JobPlan, date: string) => {
        setJobs(createPlannedJobs(plan, date));
        setPlanTaskIds(null);
        handleTabChange(JOB_STATUS.created);
    };

    // Detail sheet
    const selectedRecord = records.find((r) => r.id === selectedId) ?? null;
    const currentIndex = selectedId ? serverTable.data.findIndex((r) => r.id === selectedId) : -1;
    const position = currentIndex >= 0 ? serverTable.pagination.pageIndex * serverTable.pagination.pageSize + currentIndex : -1;

    const handleRecordClick = (record: JobRecord) => {
        setSelectedId(record.id);
        setIsSheetOpen(true);
    };

    /** After a status change: on a status tab the job leaves the list, so move to the next row (or the previous, or close). */
    const afterStatusChange = (next: Job[]) => {
        const row = serverTable.data[currentIndex + 1] ?? serverTable.data[currentIndex - 1];
        setJobs(next);
        if (activeTab === ALL) return;
        if (row) setSelectedId(row.id);
        else setIsSheetOpen(false);
    };

    const emptyTitle = records.length === 0 ? "No jobs yet" : activeTab === ALL ? "No jobs found" : `No ${JOB_STATUS_LABEL[activeTab as keyof typeof JOB_STATUS_LABEL]?.toLowerCase()} jobs`;
    const emptyDescription = records.length === 0 ? "Click Plan jobs to turn pending tasks into jobs for your surveyors." : "There are no jobs with this status.";

    return (
        <NavBarType4
            pageTitle="Task planning"
            activeItemUrl="/layouts/task-planning"
            pageDescription="Turn pending tasks into jobs: one surveyor's visits for one day, in visiting order. Plan jobs, review and assign them; surveyors accept, start and close their job sheets on the phone."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                        <JobsTable
                            data={serverTable.data}
                            columns={columns}
                            toolbar={(table) => (
                                <JobsToolbar
                                    table={table}
                                    tabs={tabs}
                                    activeTab={activeTab}
                                    setActiveTab={handleTabChange}
                                    onOpenFilters={() => openFilters()}
                                    onPlanJobs={() => openPlan()}
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
                        />
                    </div>
                </div>

                <JobDetailSheet
                    record={selectedRecord}
                    open={isSheetOpen && selectedRecord !== null}
                    onOpenChange={setIsSheetOpen}
                    jobs={jobs}
                    tasks={tasks}
                    farmers={farmers}
                    surveys={surveys}
                    surveyors={surveyors}
                    villages={villages}
                    onPrevious={() => currentIndex > 0 && setSelectedId(serverTable.data[currentIndex - 1].id)}
                    onNext={() => currentIndex < serverTable.data.length - 1 && setSelectedId(serverTable.data[currentIndex + 1].id)}
                    isFirst={currentIndex <= 0}
                    isLast={currentIndex === serverTable.data.length - 1}
                    currentIndex={position}
                    totalCount={serverTable.totalCount}
                    onAssign={() => selectedId && afterStatusChange(jobAction(selectedId, "assign", { by: "HQ" }))}
                    onUnassign={() => selectedId && afterStatusChange(jobAction(selectedId, "unassign", { by: "HQ" }))}
                    onCloseSheet={(reasons) => selectedId && afterStatusChange(jobAction(selectedId, "close", { by: "HQ", reasons }))}
                    onDelete={() => {
                        if (!selectedId) return;
                        setJobs(deleteCreatedJob(selectedId));
                        setIsSheetOpen(false);
                    }}
                    onSaveOrder={(farmerIds) => selectedId && setJobs(saveJobOrder(selectedId, farmerIds))}
                    onChangeSurveyor={(surveyorId) => selectedId && setJobs(changeJobSurveyor(selectedId, surveyorId))}
                    onAddTasks={(taskIds) => selectedRecord && setJobs(addTasksToJob(taskIds, selectedRecord.surveyorId, selectedRecord.date))}
                    onMoveTasks={(taskIds, surveyorId) => selectedRecord && setJobs(addTasksToJob(taskIds, surveyorId, selectedRecord.date))}
                    onRemoveTasks={(taskIds) => setJobs(removeTasksFromJobs(taskIds))}
                />

                {planTaskIds && (
                    <PlanJobsSheet
                        key={planKey}
                        today={today}
                        jobs={jobs}
                        tasks={tasks}
                        farmers={farmers}
                        surveyors={surveyors}
                        villages={villages}
                        initialTaskIds={planTaskIds}
                        onClose={() => setPlanTaskIds(null)}
                        onCreate={createJobs}
                    />
                )}

                <JobsFilterSheet
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
