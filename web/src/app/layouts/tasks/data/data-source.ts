// PROTOTYPE-ONLY — the single swap point between the Tasks UI and its data.
// mati-demo: rows are joined from the orchestration store (localStorage) and served by the in-memory mock.
// Production: replace this file with an API-backed TableDataSource (map TableQuery → request, call the API,
// map the response → TableResponse); the joined row shape is data/schema.ts.
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import type { Farmer, Task } from "@/lib/orchestration/engine";
import { Route, Surveyor, assignmentsByTask } from "@/lib/orchestration/routes";
import type { Workflow } from "@/app/layouts/survey-workflow/workflow-store";
import { DEFAULT_SURVEY_STATUSES, SurveyModel } from "@/app/layouts/survey-builder/types/survey-schema";
import { TaskFilters, TaskRecord } from "./schema";
import { createTasksTableConfig } from "./table-config";
import { tasksApiContract } from "./api-contract";

export const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

/** Status levels in lifecycle order: the default template statuses, custom template statuses, then any other status a task has. */
export function statusOrder(tasks: Task[], surveys: SurveyModel[]): string[] {
    return Array.from(new Set([...DEFAULT_SURVEY_STATUSES, ...surveys.flatMap((s) => s.statuses ?? []), ...tasks.map((t) => t.status)]));
}

/** Join each task with its farmer, survey template, workflow, parent and route (what a list API would return). */
export function buildTaskRecords(tasks: Task[], farmers: Farmer[], surveys: SurveyModel[], workflows: Workflow[], routes: Route[], surveyors: Surveyor[]): TaskRecord[] {
    const statusRank = new Map(statusOrder(tasks, surveys).map((s, i) => [s, i]));
    const farmerById = new Map(farmers.map((f) => [f.id, f]));
    const surveyById = new Map(surveys.map((s) => [s.id, s]));
    const workflowById = new Map(workflows.map((w) => [w.id, w]));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const surveyorById = new Map(surveyors.map((s) => [s.id, s]));
    const assignments = assignmentsByTask(routes);
    return tasks.map((t) => {
        const farmer = farmerById.get(t.farmerId);
        const survey = surveyById.get(t.surveyId);
        const workflow = workflowById.get(t.workflowId);
        const parent = t.parentTaskId ? taskById.get(t.parentTaskId) : undefined;
        // The step's trigger status, not the parent's current one (a collected parent may be verified since).
        const onStatus = workflow?.steps.find((s) => s.id === t.stepId)?.onStatus;
        const assignment = assignments.get(t.id);
        return {
            id: t.id,
            taskNo: t.taskNo,
            taskCode: `T${t.taskNo}`,
            status: t.status,
            surveyId: t.surveyId,
            surveyName: survey?.name || "(missing survey)",
            surveyVersion: survey?.version,
            workflowName: workflow?.name || "(missing workflow)",
            farmerId: t.farmerId,
            farmerName: farmer?.name || "(unknown farmer)",
            village: farmer?.village || "",
            plannedStart: t.plannedStart,
            plannedEnd: t.plannedEnd || undefined,
            createdFrom: parent ? `T${parent.taskNo} · ${statusLabel(onStatus || parent.status)}` : "Registration",
            parentTaskId: t.parentTaskId,
            updatedAt: t.updatedAt,
            statusComment: t.statusComment,
            ...(assignment && {
                surveyorId: assignment.route.surveyorId,
                assignedTo: surveyorById.get(assignment.route.surveyorId)?.name || "(removed surveyor)",
                visitDate: assignment.route.date,
                routeId: assignment.route.id,
                stopNo: assignment.stopNo,
                stopCount: assignment.route.stops.length,
            }),
            queueKey: `${String(statusRank.get(t.status) ?? 99).padStart(2, "0")}|${t.plannedStart}|${String(t.taskNo).padStart(6, "0")}`,
            task: t,
        };
    });
}

export function useTasksDataSource(records: TaskRecord[]): TableDataSource<TaskRecord, TaskFilters> {
    const config = React.useMemo(() => createTasksTableConfig(records), [records]);
    return useMockTableDataSource(config, tasksApiContract);
}
