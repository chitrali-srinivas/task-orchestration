/**
 * Orchestration engine (pure).
 *
 * Given a workflow and a task whose status just changed, decides which tasks to create next.
 * No clock, no storage, no randomness: "today" and ids come in as arguments, so the same input
 * always gives the same output and the logic can run in the browser, on a server or in a DB job.
 *
 * Vocabulary
 *  - Workflow step: "survey X runs after survey Y reaches status S, task created <trigger>, valid <from-to>".
 *  - Task: one survey to do about one subject (a farmer today; other kinds later). It is what flows to the phone app.
 *  - Task status: the survey template's statuses (planned → collected → verified | cancelled | expired).
 *  - Farmer status: fixed in code (registered → NOC received → verified, or blacklisted). A workflow starts for a
 *    farmer once they reach its start status (verified by default); registration itself is not part of a workflow.
 */

import type { Workflow, WorkflowStep } from "@/app/layouts/survey-workflow/workflow-store";
import type { SystemFieldKey } from "@/app/layouts/survey-builder/lib/system-fields";

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
    /** What the task is about. Farmers today; other kinds can be added without changing tasks or jobs. */
    subject: Subject;
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

/** What a task (and a job stop) is about. Only farmers so far; a village, sample, cart or place can join the union. */
export type Subject = { kind: "farmer"; id: string };
export const farmerSubject = (id: string): Subject => ({ kind: "farmer", id });
/** One string per subject, for grouping and comparing ("farmer:farmer_123"). */
export const subjectKey = (s: Subject) => `${s.kind}:${s.id}`;
export const sameSubject = (a: Subject, b: Subject) => a.kind === b.kind && a.id === b.id;
/** The farmer a subject is, if it is one. */
export const farmerIdOf = (s: Subject | undefined) => (s?.kind === "farmer" ? s.id : undefined);

/** Tasks saved before subjects had `farmerId`; they become farmer subjects. */
export function migrateTask(t: Task & { farmerId?: string }): Task {
    if (t.subject || !t.farmerId) return t;
    const { farmerId, ...rest } = t;
    return { ...rest, subject: farmerSubject(farmerId) };
}

export interface LatLng {
    lat: number;
    lng: number;
}

/** Where a farmer's location comes from: the plot boundary or a GPS point in the registration survey, or the village centre. */
export type LocationSource = "gps" | "plot" | "village";
export type Located = LatLng & { source: LocationSource };

export interface Farmer {
    id: string;
    name: string;
    village: string;
    /** Read from the registration answers (the plot boundary's centre, else a GPS point from older surveys). */
    location?: Located;
    /** Missing on farmers saved before statuses existed: they count as registered. */
    status?: FarmerStatus;
    /** Every status change, oldest first (registration is the first entry). */
    history?: FarmerEvent[];
    /** The registration survey's answers, kept on the farmer (registration is not a task). */
    registration?: { surveyId: string; surveyVersion?: number; response: Record<string, unknown>; at: string; by: string };
    createdAt: string;
}

/* ------------------------------ Farmer status (fixed in code) ------------------------------ */

export const FARMER_STATUS = {
    registered: "registered",
    nocReceived: "noc_received",
    verified: "verified",
    blacklisted: "blacklisted",
} as const;
export type FarmerStatus = (typeof FARMER_STATUS)[keyof typeof FARMER_STATUS];
/** Onboarding order (blacklisted sits outside it). */
export const FARMER_STATUSES: FarmerStatus[] = [FARMER_STATUS.registered, FARMER_STATUS.nocReceived, FARMER_STATUS.verified, FARMER_STATUS.blacklisted];
export const FARMER_STATUS_LABEL: Record<FarmerStatus, string> = {
    registered: "Registered",
    noc_received: "NOC received",
    verified: "Verified",
    blacklisted: "Blacklisted",
};
/** Statuses a workflow can start on, in onboarding order. */
export const START_STATUSES: FarmerStatus[] = [FARMER_STATUS.registered, FARMER_STATUS.nocReceived, FARMER_STATUS.verified];
export const DEFAULT_START_STATUS: FarmerStatus = FARMER_STATUS.verified;

export type FarmerAction = "noc" | "verify" | "blacklist" | "unblacklist";

export interface FarmerEvent {
    action: "register" | FarmerAction;
    status: FarmerStatus;
    at: string;
    by: string;
    note?: string;
}

export const farmerStatusOf = (f: Pick<Farmer, "status"> | undefined): FarmerStatus => f?.status ?? FARMER_STATUS.registered;

/** Who may do what (roles from Masters - Users); the role switcher in the user menu stands in for sign-in. */
export const FARMER_ACTIONS: Record<FarmerAction, { label: string; from: FarmerStatus[]; roles: string[]; needsNote: boolean }> = {
    noc: { label: "Mark NOC received", from: [FARMER_STATUS.registered], roles: ["Verifier", "Admin", "Super Admin"], needsNote: false },
    verify: { label: "Verify", from: [FARMER_STATUS.nocReceived], roles: ["Verifier", "Admin", "Super Admin"], needsNote: false },
    blacklist: { label: "Blacklist", from: [FARMER_STATUS.registered, FARMER_STATUS.nocReceived, FARMER_STATUS.verified], roles: ["Admin", "Super Admin"], needsNote: true },
    unblacklist: { label: "Lift blacklist", from: [FARMER_STATUS.blacklisted], roles: ["Admin", "Super Admin"], needsNote: true },
};

export const canFarmerDo = (farmer: Pick<Farmer, "status">, action: FarmerAction) => FARMER_ACTIONS[action].from.includes(farmerStatusOf(farmer));

/** Status before the blacklist (lifting it goes back there). */
function statusBeforeBlacklist(farmer: Farmer): FarmerStatus {
    const events = farmer.history ?? [];
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].action === "blacklist") return i > 0 ? events[i - 1].status : FARMER_STATUS.registered;
    }
    return FARMER_STATUS.registered;
}

/** Move a farmer along their status. Not allowed from the current status, or a required reason missing: undefined. */
export function applyFarmerAction(farmer: Farmer, action: FarmerAction, ctx: { by: string; note?: string; now: string }): Farmer | undefined {
    const rule = FARMER_ACTIONS[action];
    const note = ctx.note?.trim();
    if (!canFarmerDo(farmer, action) || (rule.needsNote && !note)) return undefined;
    const status: FarmerStatus =
        action === "noc" ? FARMER_STATUS.nocReceived : action === "verify" ? FARMER_STATUS.verified : action === "blacklist" ? FARMER_STATUS.blacklisted : statusBeforeBlacklist(farmer);
    const event: FarmerEvent = { action, status, at: ctx.now, by: ctx.by, ...(note ? { note } : {}) };
    return { ...farmer, status, history: [...(farmer.history ?? []), event] };
}

/** A farmer has reached `start` (or a later onboarding status); blacklisted farmers never have. */
export function reachedStatus(farmer: Pick<Farmer, "status">, start: FarmerStatus): boolean {
    const status = farmerStatusOf(farmer);
    if (status === FARMER_STATUS.blacklisted) return false;
    return START_STATUSES.indexOf(status) >= START_STATUSES.indexOf(start);
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
        const dup = existing.some((t) => sameSubject(t.subject, task.subject) && t.stepId === step.id) || out.some((t) => t.stepId === step.id);
        if (dup) return;
        const window = validityFor(step, plannedStartFor(step, today, task.response));
        out.push({
            id: newId(out.length),
            taskNo: nextTaskNo + out.length,
            workflowId: workflow.id,
            stepId: step.id,
            surveyId: step.surveyId,
            subject: task.subject,
            status: STATUS.planned,
            ...window,
            parentTaskId: task.id,
            createdAt: now,
            updatedAt: now,
        });
    });
    return out;
}

/** Tasks for the workflow's first steps (after Start) for one subject (a farmer who reached the start status). */
export function rootTasks(input: Omit<NextTasksInput, "task"> & { subject: Subject }): Task[] {
    const roots = input.workflow.steps.filter((s) => s.parentId === null && s.surveyId !== END_STEP);
    const out: Task[] = [];
    roots.forEach((step) => {
        if (input.existing.some((t) => sameSubject(t.subject, input.subject) && t.stepId === step.id)) return;
        const window = validityFor(step, plannedStartFor(step, input.today));
        out.push({
            id: input.newId(out.length),
            taskNo: input.nextTaskNo + out.length,
            workflowId: input.workflow.id,
            stepId: step.id,
            surveyId: step.surveyId,
            subject: input.subject,
            status: STATUS.planned,
            ...window,
            createdAt: input.now,
            updatedAt: input.now,
        });
    });
    return out;
}

export interface StartInput {
    workflows: Workflow[];
    farmers: Farmer[];
    existing: Task[];
    today: string;
    nextTaskNo: number;
    newId: (i: number) => string;
    now: string;
}

/**
 * Root tasks still missing for farmers who have reached each active workflow's start status (verified unless the
 * workflow says otherwise). Idempotent: a farmer gets a step's task once, even if it was later cancelled. Run it after
 * registration, after a farmer status change and when a workflow becomes active.
 */
export function workflowStartTasks({ workflows, farmers, existing, today, nextTaskNo, newId, now }: StartInput): Task[] {
    const out: Task[] = [];
    workflows
        .filter((w) => w.status === "active")
        .forEach((workflow) => {
            const start = workflow.startOn ?? DEFAULT_START_STATUS;
            farmers
                .filter((f) => reachedStatus(f, start))
                .forEach((farmer) => {
                    const created = rootTasks({
                        workflow,
                        subject: farmerSubject(farmer.id),
                        existing: [...existing, ...out],
                        today,
                        nextTaskNo: nextTaskNo + out.length,
                        newId: (i) => newId(out.length + i),
                        now,
                    });
                    out.push(...created);
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
    /** Farmer Enrollment surveys tag the questions planning needs (survey-builder/lib/system-fields.ts). */
    systemKey?: SystemFieldKey;
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

/**
 * The system plot field first (production's plot_location: a GPS point; a drawn boundary gives its centre), then any
 * plot boundary, then the first GPS point (Map answer).
 */
function locationFromResponse(questions: QuestionRef[], response: Record<string, unknown>): Located | undefined {
    const tagged = questions.find((q) => q.systemKey === "farmer.plot");
    const taggedPoint = tagged ? response[tagged.id] : undefined;
    if (isLatLng(taggedPoint)) return { lat: taggedPoint.lat, lng: taggedPoint.lng, source: "gps" };
    const plots = [...(tagged ? [tagged] : []), ...questions.filter((q) => q.type === "PolygonBoundary" && q.systemKey !== "farmer.plot")];
    for (const q of plots) {
        const vertices = ((response[q.id] as { vertices?: unknown[] } | undefined)?.vertices ?? []).filter(isLatLng);
        if (vertices.length === 0) continue;
        const mean = (key: "lat" | "lng") => vertices.reduce((sum, v) => sum + v[key], 0) / vertices.length;
        return { lat: mean("lat"), lng: mean("lng"), source: "plot" };
    }
    const point = questions.filter((q) => q.type === "Map").map((q) => response[q.id]).find(isLatLng);
    return point ? { lat: point.lat, lng: point.lng, source: "gps" } : undefined;
}

/**
 * Farmer name, village and location from the first survey's answers. Farmer Enrollment surveys tag these questions
 * (systemKey farmer.name / farmer.village / farmer.plot) and the tagged answer wins. Older surveys fall back to a guess:
 * the question whose column name or title mentions "name" / "village"; otherwise the first text answer is the name.
 * The location is the plot boundary's centre, else a GPS point (absent when the survey has neither).
 */
export function farmerFromResponse(questions: QuestionRef[], response: Record<string, unknown>, fallbackName: string): { name: string; village: string; location?: Located } {
    const find = (re: RegExp) => questions.find((q) => re.test(q.columnName || "") || re.test(q.titles?.en || ""));
    const byKey = (key: SystemFieldKey) => questions.find((q) => q.systemKey === key);
    const pick = (q?: QuestionRef) => (q ? answerText(response[q.id]) : "");
    const name = pick(byKey("farmer.name")) || pick(find(/name/i)) || questions.map((q) => pick(q)).find(Boolean) || fallbackName;
    const village = pick(byKey("farmer.village")) || pick(find(/village/i));
    const location = locationFromResponse(questions, response);
    return { name, village, ...(location ? { location } : {}) };
}
