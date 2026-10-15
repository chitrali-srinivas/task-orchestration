/**
 * Orchestration engine (pure).
 *
 * Given a workflow and a task whose status just changed, decides which tasks to create next.
 * No clock, no storage, no randomness: "today" and ids come in as arguments, so the same input
 * always gives the same output and the logic can run in the browser, on a server or in a DB job.
 *
 * Vocabulary
 *  - Workflow step: "survey X runs after survey Y reaches status S, task created <trigger>, valid <from-to>".
 *  - Task: one survey to do for one farmer. It is what flows to the phone app.
 *  - Task status: the survey template's statuses (planned → collected → verified | cancelled | expired).
 */

import type { Workflow, WorkflowStep } from "@/app/layouts/survey-workflow/workflow-store";

export const END_STEP = "__end__";
export const STATUS = {
    planned: "planned",
    collected: "collected",
    verified: "verified",
    expired: "expired",
    cancelled: "cancelled",
} as const;

export interface Task {
    id: string;
    /** Human number shown on the phone, e.g. T12. */
    taskNo: number;
    workflowId: string;
    stepId: string;
    surveyId: string;
    farmerId: string;
    status: string;
    /** YYYY-MM-DD. The app shows the task from this day on. */
    plannedStart: string;
    /** YYYY-MM-DD. After this day a still-planned task expires. Empty = indefinite. */
    plannedEnd?: string;
    /** Task whose status change created this one (empty for registration tasks). */
    parentTaskId?: string;
    response?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface Farmer {
    id: string;
    name: string;
    village: string;
    createdAt: string;
}

/** YYYY-MM-DD + n days (UTC, so no DST surprises). */
export function addDays(ymd: string, n: number): string {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** Day the task for `step` is created, counting from `today` (the day the condition was met). */
export function plannedStartFor(step: WorkflowStep, today: string): string {
    if (step.trigger === "days") return addDays(today, step.days ?? 0);
    if (step.trigger === "date" && step.date) return step.date;
    return today;
}

/** Validity window applied to a task: explicit dates win; otherwise start = planned start, end = indefinite. */
export function validityFor(step: WorkflowStep, plannedStart: string): { plannedStart: string; plannedEnd?: string } {
    return {
        plannedStart: step.validFrom && step.validFrom > plannedStart ? step.validFrom : plannedStart,
        plannedEnd: step.validTo || undefined,
    };
}

export interface NextTasksInput {
    workflow: Workflow;
    /** The task whose status just changed (already holding its new status). */
    task: Task;
    /** All tasks that exist, used to avoid creating the same step twice for a farmer. */
    existing: Task[];
    today: string;
    nextTaskNo: number;
    newId: (i: number) => string;
    now: string;
}

/**
 * Steps that follow `task`'s step on its current status become new planned tasks for the same farmer.
 * End steps create nothing. A step already holding a task for this farmer is skipped (idempotent).
 */
export function nextTasks({ workflow, task, existing, today, nextTaskNo, newId, now }: NextTasksInput): Task[] {
    const children = workflow.steps.filter((s) => s.parentId === task.stepId && s.onStatus === task.status && s.surveyId !== END_STEP);
    const out: Task[] = [];
    children.forEach((step) => {
        const dup = existing.some((t) => t.farmerId === task.farmerId && t.stepId === step.id) || out.some((t) => t.stepId === step.id);
        if (dup) return;
        const window = validityFor(step, plannedStartFor(step, today));
        out.push({
            id: newId(out.length),
            taskNo: nextTaskNo + out.length,
            workflowId: workflow.id,
            stepId: step.id,
            surveyId: step.surveyId,
            farmerId: task.farmerId,
            status: STATUS.planned,
            ...window,
            parentTaskId: task.id,
            createdAt: now,
            updatedAt: now,
        });
    });
    return out;
}

/** Tasks for the workflow's first steps (after Start) when a farmer is registered. */
export function rootTasks(input: Omit<NextTasksInput, "task"> & { farmerId: string }): Task[] {
    const roots = input.workflow.steps.filter((s) => s.parentId === null && s.surveyId !== END_STEP);
    const out: Task[] = [];
    roots.forEach((step) => {
        if (input.existing.some((t) => t.farmerId === input.farmerId && t.stepId === step.id)) return;
        const window = validityFor(step, plannedStartFor(step, input.today));
        out.push({
            id: input.newId(out.length),
            taskNo: input.nextTaskNo + out.length,
            workflowId: input.workflow.id,
            stepId: step.id,
            surveyId: step.surveyId,
            farmerId: input.farmerId,
            status: STATUS.planned,
            ...window,
            createdAt: input.now,
            updatedAt: input.now,
        });
    });
    return out;
}

/** Planned tasks whose validity ended before `today` become expired. */
export function expireTasks(tasks: Task[], today: string, now: string): Task[] {
    return tasks.map((t) => (t.status === STATUS.planned && t.plannedEnd && t.plannedEnd < today ? { ...t, status: STATUS.expired, updatedAt: now } : t));
}

/** What the phone shows: planned tasks that have started. Future-dated tasks stay hidden until their day. */
export function isPendingOnApp(task: Task, today: string): boolean {
    return task.status === STATUS.planned && task.plannedStart <= today;
}
