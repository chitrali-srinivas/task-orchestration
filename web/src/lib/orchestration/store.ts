/**
 * Orchestration store: farmers + tasks, and the actions that run the engine.
 * The engine (engine.ts) is pure; this file is the only place that reads the clock. Storage
 * (Supabase or localStorage) is behind lib/backend.
 */

import { Workflow, loadWorkflows } from "@/app/layouts/survey-workflow/workflow-store";
import { Farmer, QuestionRef, STATUS, Task, expireTasks, farmerFromResponse, nextTasks, rootTasks } from "./engine";

import * as backend from "@/lib/backend";

export const loadTasks = () => dedupeIds(backend.get<Task>("tasks"));
export const loadFarmers = () => backend.get<Farmer>("farmers");
export const saveTasks = (t: Task[]) => backend.set("tasks", t);
export const saveFarmers = (f: Farmer[]) => backend.set("farmers", f);

/** Simulated "today" (YYYY-MM-DD) shared by the phone and the task summary, so time can be moved by hand. */
export function loadToday(): string {
    const row = backend.get<{ id: string; today?: string }>("settings").find((r) => r.id === "today");
    return row?.today || new Date().toISOString().slice(0, 10);
}
export const saveToday = (today: string) => backend.set("settings", [{ id: "today", today }]);

/** Pages call this before their first read; resolves immediately in local (demo) mode. */
export const ready = backend.ready;

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
    const { name, village } = farmerFromResponse(input.questions, input.response, `Farmer ${farmers.length + 1}`);
    const farmer: Farmer = { id: `farmer_${Date.now()}`, name, village, createdAt: now };
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
