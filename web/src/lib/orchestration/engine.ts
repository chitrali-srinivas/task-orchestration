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
    /** Comment given with the last HQ status change (required when cancelling). */
    statusComment?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LatLng {
    lat: number;
    lng: number;
}

/** Where a farmer's location comes from: a GPS point or plot boundary in the registration survey, or the village centre. */
export type LocationSource = "gps" | "plot" | "village";
export type Located = LatLng & { source: LocationSource };

export interface Farmer {
    id: string;
    name: string;
    village: string;
    /** Read from the registration answers (Map question, else the plot boundary's centre). */
    location?: Located;
    createdAt: string;
}

/** YYYY-MM-DD + n days (UTC, so no DST surprises). */
export function addDays(ymd: string, n: number): string {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A date answer from a survey response: Date questions store "YYYY-MM-DD", DateRange stores {start,end}. */
export function dateFromResponse(response: Record<string, unknown> | undefined, questionId: string | undefined): string | undefined {
    if (!response || !questionId) return undefined;
    const v = response[questionId];
    const s = typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { start?: unknown }).start === "string" ? (v as { start: string }).start : undefined;
    return s && YMD.test(s) ? s : undefined;
}

/**
 * Day the task for `step` is created, counting from `today` (the day the condition was met).
 * For trigger "field" the base is a date answered in the previous survey (`parentResponse`);
 * if that answer is missing the condition day is used instead.
 */
export function plannedStartFor(step: WorkflowStep, today: string, parentResponse?: Record<string, unknown>): string {
    if (step.trigger === "days") return addDays(today, step.days ?? 0);
    if (step.trigger === "date" && step.date) return step.date;
    if (step.trigger === "field") return addDays(dateFromResponse(parentResponse, step.fieldQuestionId) ?? today, step.days ?? 0);
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
        const window = validityFor(step, plannedStartFor(step, today, task.response));
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

/** A question as the engine needs it to read a registration response. */
export interface QuestionRef {
    id: string;
    type?: string;
    columnName?: string;
    titles?: Record<string, string>;
}

function answerText(v: unknown): string {
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    if (Array.isArray(v)) return v.map(answerText).filter(Boolean).join(", ");
    if (v && typeof v === "object") {
        const o = v as { displayValue?: unknown; start?: unknown };
        if (typeof o.displayValue === "string") return o.displayValue;
        if (typeof o.start === "string") return o.start;
    }
    return "";
}

const isLatLng = (v: unknown): v is LatLng =>
    Boolean(v) && typeof (v as LatLng).lat === "number" && typeof (v as LatLng).lng === "number";

/** First Map answer (GPS point), else the centre of the first plot boundary (PolygonBoundary vertices). */
function locationFromResponse(questions: QuestionRef[], response: Record<string, unknown>): Located | undefined {
    const point = questions.filter((q) => q.type === "Map").map((q) => response[q.id]).find(isLatLng);
    if (point) return { lat: point.lat, lng: point.lng, source: "gps" };
    for (const q of questions.filter((q) => q.type === "PolygonBoundary")) {
        const vertices = ((response[q.id] as { vertices?: unknown[] } | undefined)?.vertices ?? []).filter(isLatLng);
        if (vertices.length === 0) continue;
        const mean = (key: "lat" | "lng") => vertices.reduce((sum, v) => sum + v[key], 0) / vertices.length;
        return { lat: mean("lat"), lng: mean("lng"), source: "plot" };
    }
    return undefined;
}

/**
 * Farmer name, village and location from the first survey's answers: the question whose column name or
 * title mentions "name" / "village" wins; otherwise the first text answer is the name. The location is the
 * first GPS point, else the first plot boundary's centre (absent when the survey has neither).
 */
export function farmerFromResponse(questions: QuestionRef[], response: Record<string, unknown>, fallbackName: string): { name: string; village: string; location?: Located } {
    const find = (re: RegExp) => questions.find((q) => re.test(q.columnName || "") || re.test(q.titles?.en || ""));
    const pick = (q?: QuestionRef) => (q ? answerText(response[q.id]) : "");
    const name = pick(find(/name/i)) || questions.map((q) => pick(q)).find(Boolean) || fallbackName;
    const village = pick(find(/village/i));
    const location = locationFromResponse(questions, response);
    return { name, village, ...(location ? { location } : {}) };
}
