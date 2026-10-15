// Run: node --test src/lib/orchestration/engine.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, expireTasks, isPendingOnApp, nextTasks, rootTasks, type Task } from "./engine.ts";

const wf = {
    id: "wf1",
    name: "Kharif",
    country: "India",
    status: "active" as const,
    createdAt: "",
    updatedAt: "",
    steps: [
        { id: "reg", surveyId: "s_reg", parentId: null, onStatus: "", trigger: "immediately" as const },
        { id: "enr", surveyId: "s_enr", parentId: "reg", onStatus: "collected", trigger: "immediately" as const },
        { id: "end", surveyId: "__end__", parentId: "reg", onStatus: "cancelled", trigger: "immediately" as const },
        { id: "dep", surveyId: "s_dep", parentId: "enr", onStatus: "verified", trigger: "days" as const, days: 7, validTo: "2026-12-31" },
        { id: "smp", surveyId: "s_smp", parentId: "enr", onStatus: "verified", trigger: "date" as const, date: "2026-11-20" },
    ],
};
const ids = (p: string) => (i: number) => `${p}${i}`;
const base = { workflow: wf, today: "2026-10-15", now: "2026-10-15T00:00:00Z" };

test("registration creates the root task, planned today", () => {
    const t = rootTasks({ ...base, farmerId: "f1", existing: [], nextTaskNo: 1, newId: ids("r") });
    assert.equal(t.length, 1);
    assert.equal(t[0].surveyId, "s_reg");
    assert.equal(t[0].status, "planned");
    assert.equal(t[0].plannedStart, "2026-10-15");
});

test("collected registration immediately creates the enrollment task; End creates nothing", () => {
    const reg: Task = { ...rootTasks({ ...base, farmerId: "f1", existing: [], nextTaskNo: 1, newId: ids("r") })[0], status: "collected" };
    const next = nextTasks({ ...base, task: reg, existing: [reg], nextTaskNo: 2, newId: ids("n") });
    assert.deepEqual(next.map((t) => t.surveyId), ["s_enr"]);
    assert.equal(next[0].parentTaskId, reg.id);
    assert.equal(next[0].taskNo, 2);

    const cancelled = { ...reg, status: "cancelled" };
    assert.equal(nextTasks({ ...base, task: cancelled, existing: [reg], nextTaskNo: 2, newId: ids("n") }).length, 0);
});

test("branching: verified enrollment creates deployment (+7 days) and sample (fixed date)", () => {
    const enr: Task = { id: "e", taskNo: 2, workflowId: "wf1", stepId: "enr", surveyId: "s_enr", farmerId: "f1", status: "verified", plannedStart: "2026-10-15", createdAt: "", updatedAt: "" };
    const next = nextTasks({ ...base, task: enr, existing: [enr], nextTaskNo: 3, newId: ids("n") });
    assert.deepEqual(next.map((t) => [t.surveyId, t.plannedStart, t.plannedEnd]), [
        ["s_dep", "2026-10-22", "2026-12-31"],
        ["s_smp", "2026-11-20", undefined],
    ]);
    // Idempotent: running again creates nothing new.
    assert.equal(nextTasks({ ...base, task: enr, existing: [enr, ...next], nextTaskNo: 5, newId: ids("x") }).length, 0);
});

test("future tasks are hidden on the app until their day; planned tasks expire after validity", () => {
    const t: Task = { id: "d", taskNo: 3, workflowId: "wf1", stepId: "dep", surveyId: "s_dep", farmerId: "f1", status: "planned", plannedStart: "2026-10-22", plannedEnd: "2026-12-31", createdAt: "", updatedAt: "" };
    assert.equal(isPendingOnApp(t, "2026-10-21"), false);
    assert.equal(isPendingOnApp(t, "2026-10-22"), true);
    assert.equal(expireTasks([t], "2026-12-31", "")[0].status, "planned");
    assert.equal(expireTasks([t], "2027-01-01", "")[0].status, "expired");
});

test("addDays crosses month ends", () => {
    assert.equal(addDays("2026-10-28", 7), "2026-11-04");
});
