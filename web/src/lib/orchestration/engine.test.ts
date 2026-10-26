// Run: node --test src/lib/orchestration/engine.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, expireTasks, farmerFromResponse, isPendingOnApp, nextTasks, rootTasks, type Task } from "./engine.ts";

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
        { id: "eng", surveyId: "s_eng", parentId: "dep", onStatus: "collected", trigger: "field" as const, fieldQuestionId: "q_sowing", days: 30 },
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

test("field trigger: n days after a date answered in the previous survey, else after the condition day", () => {
    const dep: Task = { id: "d", taskNo: 3, workflowId: "wf1", stepId: "dep", surveyId: "s_dep", farmerId: "f1", status: "collected", plannedStart: "2026-10-22", createdAt: "", updatedAt: "", response: { q_sowing: "2026-11-05" } };
    const withDate = nextTasks({ ...base, today: "2026-11-10", task: dep, existing: [dep], nextTaskNo: 4, newId: ids("n") });
    assert.deepEqual(withDate.map((t) => [t.surveyId, t.plannedStart]), [["s_eng", "2026-12-05"]]);

    const noAnswer = nextTasks({ ...base, today: "2026-11-10", task: { ...dep, response: {} }, existing: [dep], nextTaskNo: 4, newId: ids("n") });
    assert.equal(noAnswer[0].plannedStart, "2026-12-10");

    const range = nextTasks({ ...base, today: "2026-11-10", task: { ...dep, response: { q_sowing: { start: "2026-11-01", end: "2026-11-03" } } }, existing: [dep], nextTaskNo: 4, newId: ids("n") });
    assert.equal(range[0].plannedStart, "2026-12-01");
});

test("farmer name and village come from the registration answers", () => {
    const qs = [{ id: "q1", columnName: "farmer_name", titles: { en: "Farmer name" } }, { id: "q2", columnName: "village", titles: { en: "Village" } }, { id: "q3", columnName: "mobile" }];
    assert.deepEqual(farmerFromResponse(qs, { q1: "Srinivas", q2: { masterSetId: "villages", recordId: "v1", displayValue: "Achalpur" } }, "Farmer 1"), { name: "Srinivas", village: "Achalpur" });
    // No name/village question: first text answer is the name, village empty.
    assert.deepEqual(farmerFromResponse([{ id: "q3", columnName: "mobile" }], { q3: "9800000000" }, "Farmer 1"), { name: "9800000000", village: "" });
    assert.deepEqual(farmerFromResponse([{ id: "q3", columnName: "mobile" }], {}, "Farmer 7"), { name: "Farmer 7", village: "" });
});

test("farmer location: the registration GPS point, else the plot boundary's centre", () => {
    const qs = [{ id: "q1", columnName: "farmer_name" }, { id: "q2", type: "PolygonBoundary" }, { id: "q3", type: "Map" }];
    const plot = { vertices: [{ lat: 21, lng: 77 }, { lat: 22, lng: 78 }] };
    assert.deepEqual(farmerFromResponse(qs, { q1: "A", q2: plot, q3: { lat: 21.5, lng: 77.2, accuracy: 2 } }, "").location, { lat: 21.5, lng: 77.2, source: "gps" });
    assert.deepEqual(farmerFromResponse(qs, { q1: "A", q2: plot }, "").location, { lat: 21.5, lng: 77.5, source: "plot" });
    assert.equal("location" in farmerFromResponse(qs, { q1: "A" }, ""), false);
});
