/**
 * Orchestration store: farmers + tasks in localStorage, and the actions that run the engine.
 * The engine (engine.ts) is pure; this file is the only place that reads the clock and storage.
 * Swapping this for Supabase later leaves the engine untouched.
 */

import { Workflow, loadWorkflows } from "@/app/layouts/survey-workflow/workflow-store";
import { Farmer, STATUS, Task, expireTasks, nextTasks, rootTasks } from "./engine";

const TASKS_KEY = "mati.tasks";
const FARMERS_KEY = "mati.farmers";
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

export const loadTasks = () => read<Task[]>(TASKS_KEY, []);
export const loadFarmers = () => read<Farmer[]>(FARMERS_KEY, []);
export const saveTasks = (t: Task[]) => write(TASKS_KEY, t);
export const saveFarmers = (f: Farmer[]) => write(FARMERS_KEY, f);

/** Simulated "today" (YYYY-MM-DD) shared by the phone and the task summary, so time can be moved by hand. */
export function loadToday(): string {
    return read<{ today?: string }>(SIM_KEY, {}).today || new Date().toISOString().slice(0, 10);
}
export const saveToday = (today: string) => write(SIM_KEY, { today });

const nowIso = () => new Date().toISOString();
const nextNo = (tasks: Task[]) => tasks.reduce((m, t) => Math.max(m, t.taskNo), 0) + 1;
const newIds = (prefix: string) => (i: number) => `${prefix}_${Date.now()}_${i}`;

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
 * Surveyor registers a farmer in a village by filling the workflow's first survey.
 * Creates the farmer, the registration task (already collected, with the response),
 * then lets the engine create whatever follows "collected" in the workflow.
 */
export function registerFarmer(input: { workflow: Workflow; rootStepId: string; name: string; village: string; response: Record<string, unknown>; today: string }) {
    const now = nowIso();
    const farmers = loadFarmers();
    const farmer: Farmer = { id: `farmer_${Date.now()}`, name: input.name, village: input.village, createdAt: now };
    saveFarmers([...farmers, farmer]);

    let tasks = loadTasks();
    const roots = rootTasks({ workflow: input.workflow, farmerId: farmer.id, existing: tasks, today: input.today, nextTaskNo: nextNo(tasks), newId: newIds("task"), now });
    tasks = [...tasks, ...roots];
    const reg = tasks.find((t) => t.farmerId === farmer.id && t.stepId === input.rootStepId);
    if (reg) tasks = applyStatus(tasks, input.workflow, reg.id, STATUS.collected, input.today, input.response);
    saveTasks(tasks);
    return { farmer, tasks };
}

/** Surveyor submits a pending task from the phone. */
export function submitTask(taskId: string, response: Record<string, unknown>, today: string): Task[] {
    return changeStatus(taskId, STATUS.collected, today, response);
}

/** HQ sets a status (verified / cancelled / …). Follow-on tasks are created by the workflow. */
export function changeStatus(taskId: string, status: string, today: string, response?: Record<string, unknown>): Task[] {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === taskId);
    const workflow = task && loadWorkflows().find((w) => w.id === task.workflowId);
    if (!task || !workflow) return tasks;
    const next = applyStatus(tasks, workflow, taskId, status, today, response);
    saveTasks(next);
    return next;
}

function applyStatus(tasks: Task[], workflow: Workflow, taskId: string, status: string, today: string, response?: Record<string, unknown>): Task[] {
    const now = nowIso();
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status, updatedAt: now, ...(response ? { response } : {}) } : t));
    const task = updated.find((t) => t.id === taskId)!;
    const created = nextTasks({ workflow, task, existing: updated, today, nextTaskNo: nextNo(updated), newId: newIds("task"), now });
    return [...updated, ...created];
}

/** Wipe simulation data (farmers + tasks), keeping surveys, masters and workflows. */
export function resetSimulation() {
    saveTasks([]);
    saveFarmers([]);
}
