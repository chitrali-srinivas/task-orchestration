/**
 * Orchestration store: farmers, tasks and jobs in localStorage, and the actions that run the engine.
 * The engine (engine.ts) and jobs (jobs.ts) are pure; this file is the only place that reads the clock and storage.
 * Swapping this for Supabase later leaves them untouched.
 */

import { Workflow, loadWorkflows } from "@/app/layouts/survey-workflow/workflow-store";
import { loadMasterRecords } from "@/app/layouts/survey-builder/lib/master-data-registry";
import { Farmer, QuestionRef, STATUS, Task, expireTasks, farmerFromResponse, nextTasks, rootTasks } from "./engine";
import {
    ActionContext,
    DEFAULT_MAX_VISITS,
    JOB_STATUS,
    Job,
    JobMove,
    JobPlan,
    RouteContext,
    Surveyor,
    Village,
    addToJob,
    applyJobAction,
    changeSurveyor,
    deleteJob,
    jobsFromPlan,
    openJobsByTask,
    removeTasks,
    setStopOrder,
    stopLocation,
} from "./jobs";

const TASKS_KEY = "mati.tasks";
const FARMERS_KEY = "mati.farmers";
const JOBS_KEY = "mati.jobs";
/** Phase-1 storage (published routes), converted to jobs on first load. */
const LEGACY_ROUTES_KEY = "mati.routes";
const SIM_KEY = "mati.sim";

function read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
function write(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* ignore */
    }
}

export const loadTasks = () => dedupeIds(read<Task[]>(TASKS_KEY, []));
export const loadFarmers = () => read<Farmer[]>(FARMERS_KEY, []);
export const saveTasks = (t: Task[]) => write(TASKS_KEY, t);
export const saveFarmers = (f: Farmer[]) => write(FARMERS_KEY, f);
export const saveJobs = (j: Job[]) => write(JOBS_KEY, j);

export function loadJobs(): Job[] {
    if (typeof window !== "undefined" && window.localStorage.getItem(JOBS_KEY) === null) {
        type LegacyRoute = Pick<Job, "id" | "date" | "surveyorId" | "stops" | "createdAt" | "updatedAt"> & { status: "draft" | "published" };
        const legacy = read<LegacyRoute[]>(LEGACY_ROUTES_KEY, []);
        if (legacy.length > 0) {
            // Published routes were on the phone already: they become assigned jobs.
            saveJobs(
                legacy.map((r, i) => ({
                    ...r,
                    jobNo: i + 1,
                    status: r.status === "published" ? JOB_STATUS.assigned : JOB_STATUS.created,
                    history: [{ action: "create", at: r.createdAt, by: "HQ" }, ...(r.status === "published" ? [{ action: "assign" as const, at: r.createdAt, by: "HQ" }] : [])],
                }))
            );
            window.localStorage.removeItem(LEGACY_ROUTES_KEY);
        }
    }
    return read<Job[]>(JOBS_KEY, []);
}

/** Simulation settings kept by the phone: the simulated "today" and which surveyor the phone belongs to. */
interface Sim {
    today?: string;
    surveyorId?: string;
}
const saveSim = (patch: Sim) => write(SIM_KEY, { ...read<Sim>(SIM_KEY, {}), ...patch });

/** Simulated "today" (YYYY-MM-DD) shared by the phone and the task summary, so time can be moved by hand. */
export function loadToday(): string {
    return read<Sim>(SIM_KEY, {}).today || new Date().toISOString().slice(0, 10);
}
export const saveToday = (today: string) => saveSim({ today });
export const loadPhoneSurveyor = () => read<Sim>(SIM_KEY, {}).surveyorId || "";
export const savePhoneSurveyor = (surveyorId: string) => saveSim({ surveyorId });

const coordinate = (v: unknown) => {
    const n = parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : undefined;
};

/** Villages master records (Masters page) as route planning reads them. */
export function loadVillages(): Village[] {
    return loadMasterRecords("villages").map((r) => {
        const lat = coordinate(r.lat);
        const lng = coordinate(r.lng);
        return { id: r.id, name: String(r.villageName || ""), centre: lat !== undefined && lng !== undefined ? { lat, lng } : undefined, radiusKm: coordinate(r.radiusKm) };
    });
}

/** Surveyors master records: an empty "Max visits per day" means the default, an empty "Active" means active. */
export function loadSurveyors(): Surveyor[] {
    return loadMasterRecords("surveyors").map((r) => ({
        id: r.id,
        name: String(r.surveyorName || "Unnamed surveyor"),
        phone: r.phone || undefined,
        baseVillageId: r.baseVillageId || undefined,
        maxVisitsPerDay: parseInt(String(r.maxVisitsPerDay ?? ""), 10) || DEFAULT_MAX_VISITS,
        active: r.active !== "No",
    }));
}

const nowIso = () => new Date().toISOString();
const nextNo = (tasks: Task[]) => tasks.reduce((m, t) => Math.max(m, t.taskNo), 0) + 1;
// Ids must stay unique even when several tasks are created in the same millisecond
// (registration creates the root task and its follow-ons in one go).
let seq = 0;
const newIds = (prefix: string) => (i: number) => `${prefix}_${Date.now()}_${(seq++).toString(36)}${i}`;

/** Repair tasks saved by an earlier build whose ids collided: later duplicates get a unique id. */
function dedupeIds(tasks: Task[]): Task[] {
    const seen = new Set<string>();
    let changed = false;
    const out = tasks.map((t) => {
        if (!seen.has(t.id)) {
            seen.add(t.id);
            return t;
        }
        changed = true;
        return { ...t, id: `${t.id}_${t.taskNo}` };
    });
    if (changed) saveTasks(out);
    return out;
}

/** Workflows the phone can run: active ones first, then drafts (the starting survey is always open). */
export const phoneWorkflows = () =>
    loadWorkflows()
        .filter((w) => w.status !== "completed")
        .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));

/** Apply expiry for `today` and persist. Called by pages on load / when the date changes. */
export function refreshTasks(today: string): Task[] {
    const before = loadTasks();
    const after = expireTasks(before, today, nowIso());
    if (after.some((t, i) => t !== before[i])) saveTasks(after);
    return after;
}

/**
 * Surveyor registers a farmer by filling the workflow's first survey (nothing else is asked).
 * The farmer's name and village are read from the answers. Creates the farmer, the registration
 * task (already collected, with the response), then lets the engine create whatever follows
 * "collected" in the workflow.
 */
export function registerFarmer(input: { workflow: Workflow; rootStepId: string; questions: QuestionRef[]; response: Record<string, unknown>; today: string }) {
    const now = nowIso();
    const farmers = loadFarmers();
    const { name, village, location } = farmerFromResponse(input.questions, input.response, `Farmer ${farmers.length + 1}`);
    const farmer: Farmer = { id: `farmer_${Date.now()}`, name, village, ...(location ? { location } : {}), createdAt: now };
    saveFarmers([...farmers, farmer]);

    let tasks = loadTasks();
    const roots = rootTasks({ workflow: input.workflow, farmerId: farmer.id, existing: tasks, today: input.today, nextTaskNo: nextNo(tasks), newId: newIds("task"), now });
    tasks = [...tasks, ...roots];
    const reg = tasks.find((t) => t.farmerId === farmer.id && t.stepId === input.rootStepId);
    if (reg) tasks = applyStatus(tasks, input.workflow, reg.id, STATUS.collected, input.today, input.response);
    saveTasks(tasks);
    return { farmer, tasks };
}

/** Surveyor submits a pending task from the phone. The first task submitted on an accepted job starts the job. */
export function submitTask(taskId: string, response: Record<string, unknown>, today: string): Task[] {
    const tasks = changeStatus(taskId, STATUS.collected, today, response);
    const job = openJobsByTask(loadJobs()).get(taskId)?.job;
    if (job?.status === JOB_STATUS.accepted) {
        const by = loadSurveyors().find((s) => s.id === job.surveyorId)?.name ?? "Surveyor";
        jobAction(job.id, "start", { by, note: "Started with the first submitted task" });
    }
    return tasks;
}

/** HQ sets a status (verified / cancelled / …), optionally with a comment. Follow-on tasks are created by the workflow. */
export function changeStatus(taskId: string, status: string, today: string, response?: Record<string, unknown>, comment?: string): Task[] {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === taskId);
    const workflow = task && loadWorkflows().find((w) => w.id === task.workflowId);
    if (!task || !workflow) return tasks;
    const next = applyStatus(tasks, workflow, taskId, status, today, response, comment);
    saveTasks(next);
    return next;
}

/** HQ cancels a task; the reason is kept on the task. */
export const cancelTask = (taskId: string, reason: string, today: string) => changeStatus(taskId, STATUS.cancelled, today, undefined, reason);

function applyStatus(tasks: Task[], workflow: Workflow, taskId: string, status: string, today: string, response?: Record<string, unknown>, comment?: string): Task[] {
    const now = nowIso();
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status, updatedAt: now, ...(response ? { response } : {}), ...(comment ? { statusComment: comment } : {}) } : t));
    const task = updated.find((t) => t.id === taskId)!;
    const created = nextTasks({ workflow, task, existing: updated, today, nextTaskNo: nextNo(updated), newId: newIds("task"), now });
    return [...updated, ...created];
}

const maxVisitsOf = (surveyorId: string) => loadSurveyors().find((s) => s.id === surveyorId)?.maxVisitsPerDay ?? DEFAULT_MAX_VISITS;

/** Farmer locations and the surveyor's base village, for placing and ordering stops by distance. */
function routeContext(surveyorId: string): RouteContext {
    const villages = loadVillages();
    const farmerById = new Map(loadFarmers().map((f) => [f.id, f]));
    const base = villages.find((v) => v.id === loadSurveyors().find((s) => s.id === surveyorId)?.baseVillageId)?.centre;
    return { locate: (farmerId) => stopLocation(farmerById.get(farmerId), villages), base };
}

const updateJobs = (change: (jobs: Job[], now: string) => Job[]): Job[] => {
    const next = change(loadJobs(), nowIso());
    saveJobs(next);
    return next;
};

/** HQ creates the planned jobs (status created, for review before they are assigned). */
export const createPlannedJobs = (plan: JobPlan, date: string) =>
    updateJobs((jobs, now) => [...jobs, ...jobsFromPlan(jobs, plan, date, newIds("job"), now)]);

/** Move a job along its lifecycle (HQ: assign / unassign / close; surveyor: accept / decline / start / close). */
export const jobAction = (jobId: string, action: JobMove, ctx: Omit<ActionContext, "now" | "tasks">) =>
    updateJobs((jobs, now) => applyJobAction(jobs, jobId, action, { ...ctx, now, tasks: loadTasks() }));

/**
 * HQ adds tasks to a surveyor's job for a day (a new created job if they have none), or moves them there from
 * another job. The same farmers' other tasks due that day come along, since one visit covers them; a new stop goes
 * where it adds the least distance. An accepted job or over capacity: nothing changes.
 */
export const addTasksToJob = (taskIds: string[], surveyorId: string, date: string) =>
    updateJobs((jobs, now) =>
        addToJob({
            jobs,
            tasks: loadTasks(),
            taskIds,
            surveyorId,
            date,
            maxVisits: maxVisitsOf(surveyorId),
            newId: newIds("job")(0),
            now,
            by: "HQ",
            route: routeContext(surveyorId),
        })
    );

/** HQ saves a rearranged stop order. */
export const saveJobOrder = (jobId: string, farmerIds: string[]) => updateJobs((jobs, now) => setStopOrder(jobs, jobId, farmerIds, now));

/** HQ hands a job (not yet accepted) to another surveyor. */
export const changeJobSurveyor = (jobId: string, surveyorId: string) =>
    updateJobs((jobs, now) => {
        const surveyors = loadSurveyors();
        const from = surveyors.find((s) => s.id === jobs.find((j) => j.id === jobId)?.surveyorId)?.name ?? "removed surveyor";
        const to = surveyors.find((s) => s.id === surveyorId)?.name ?? "?";
        return changeSurveyor(jobs, jobId, surveyorId, maxVisitsOf(surveyorId), { now, by: "HQ", note: `From ${from} to ${to}` });
    });

/** HQ takes tasks off their (not yet accepted) job; they become unassigned again. */
export const removeTasksFromJobs = (taskIds: string[]) => updateJobs((jobs, now) => removeTasks(jobs, taskIds, now));

export const deleteCreatedJob = (jobId: string) => updateJobs((jobs) => deleteJob(jobs, jobId));

/** Wipe simulation data (farmers, tasks and jobs), keeping surveys, masters and workflows. */
export function resetSimulation() {
    saveTasks([]);
    saveFarmers([]);
    saveJobs([]);
}
