// Run: node --test src/lib/orchestration/farmers.test.ts   (Node 24 strips types natively)
// Farmer statuses, workflows starting on a farmer status, and the data migrations that came with them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFarmerAction, canFarmerDo, farmerStatusOf, migrateTask, reachedStatus, workflowStartTasks, type Farmer, type Task } from "./engine.ts";
import { migrateJob, type Job } from "./jobs.ts";
import { dropRegistrationSteps, type Workflow } from "../../app/layouts/survey-workflow/workflow-store.ts";

const ctx = (note?: string) => ({ by: "Verifier", now: "2026-11-13T10:00:00Z", ...(note ? { note } : {}) });
const farmer = (id: string, extra: Partial<Farmer> = {}): Farmer => ({ id, name: id, village: "Test Village A", createdAt: "2026-11-13T09:00:00Z", ...extra });

test("farmer status: registered → NOC received → verified, in that order only", () => {
    const f = farmer("f1");
    assert.equal(farmerStatusOf(f), "registered"); // saved before statuses existed
    assert.equal(applyFarmerAction(f, "verify", ctx()), undefined); // no NOC yet
    const noc = applyFarmerAction(f, "noc", ctx())!;
    assert.equal(noc.status, "noc_received");
    assert.equal(canFarmerDo(noc, "noc"), false);
    const verified = applyFarmerAction(noc, "verify", ctx())!;
    assert.equal(verified.status, "verified");
    assert.deepEqual(verified.history!.map((e) => [e.action, e.status, e.by]), [["noc", "noc_received", "Verifier"], ["verify", "verified", "Verifier"]]);
});

test("blacklist needs a reason, works from any onboarding status, and lifting it goes back to where the farmer was", () => {
    const verified = farmer("f1", { status: "verified", history: [{ action: "register", status: "registered", at: "", by: "S" }, { action: "noc", status: "noc_received", at: "", by: "V" }, { action: "verify", status: "verified", at: "", by: "V" }] });
    assert.equal(applyFarmerAction(verified, "blacklist", ctx("  ")), undefined);
    const black = applyFarmerAction(verified, "blacklist", ctx("Duplicate registration"))!;
    assert.equal(black.status, "blacklisted");
    assert.equal(black.history!.at(-1)!.note, "Duplicate registration");
    assert.equal(canFarmerDo(black, "verify"), false);
    assert.equal(applyFarmerAction(black, "unblacklist", ctx()), undefined); // reason required
    assert.equal(applyFarmerAction(black, "unblacklist", ctx("Checked: not a duplicate"))!.status, "verified");
    assert.equal(applyFarmerAction(farmer("f2"), "blacklist", ctx("x"))!.status, "blacklisted");
});

test("reached status: a later onboarding status counts; blacklisted never does", () => {
    assert.equal(reachedStatus({ status: "verified" }, "registered"), true);
    assert.equal(reachedStatus({ status: "noc_received" }, "verified"), false);
    assert.equal(reachedStatus({}, "registered"), true);
    assert.equal(reachedStatus({ status: "blacklisted" }, "registered"), false);
});

const wf = (id: string, extra: Partial<Workflow> = {}): Workflow => ({
    id,
    name: id,
    country: "India",
    status: "active",
    createdAt: "",
    updatedAt: "",
    steps: [
        { id: `${id}_a`, surveyId: "s_sample", parentId: null, onStatus: "", trigger: "immediately" },
        { id: `${id}_b`, surveyId: "s_next", parentId: `${id}_a`, onStatus: "collected", trigger: "immediately" },
    ],
    ...extra,
});
const start = (workflows: Workflow[], farmers: Farmer[], existing: Task[] = []) =>
    workflowStartTasks({ workflows, farmers, existing, today: "2026-11-13", nextTaskNo: existing.length + 1, newId: (i) => `t${existing.length + i}`, now: "" });

test("workflows start for verified farmers by default, in active workflows only, once per farmer and step", () => {
    const farmers = [farmer("reg"), farmer("ok", { status: "verified" }), farmer("bad", { status: "blacklisted" })];
    const created = start([wf("w1"), wf("draft", { status: "draft" })], farmers);
    assert.deepEqual(created.map((t) => [t.workflowId, t.stepId, t.subject.id, t.taskNo]), [["w1", "w1_a", "ok", 1]]);
    assert.deepEqual(start([wf("w1")], farmers, created), []); // idempotent
    // A workflow that starts on Registered takes every farmer not blacklisted.
    assert.deepEqual(start([wf("w2", { startOn: "registered" })], farmers).map((t) => t.subject.id), ["reg", "ok"]);
});

test("migrations: tasks and job stops move from farmerId to a farmer subject; registration steps leave workflows", () => {
    const old = { id: "t1", taskNo: 1, workflowId: "w", stepId: "s", surveyId: "x", farmerId: "f1", status: "planned", plannedStart: "2026-11-13", createdAt: "", updatedAt: "" } as unknown as Task;
    const task = migrateTask(old);
    assert.deepEqual(task.subject, { kind: "farmer", id: "f1" });
    assert.equal("farmerId" in task, false);
    assert.equal(migrateTask(task), task);

    const job = { id: "j", jobNo: 1, date: "", surveyorId: "s", status: "created", stops: [{ farmerId: "f1", taskIds: ["t1"] }], history: [], createdAt: "", updatedAt: "" } as unknown as Job;
    const moved = migrateJob(job);
    assert.deepEqual(moved.stops, [{ subject: { kind: "farmer", id: "f1" }, taskIds: ["t1"] }]);
    assert.equal(migrateJob(moved), moved);

    const steps = [
        { id: "reg", surveyId: "s_reg", parentId: null, onStatus: "", trigger: "immediately" as const },
        { id: "enr", surveyId: "s_enr", parentId: "reg", onStatus: "collected", trigger: "days" as const, days: 3 },
        { id: "dep", surveyId: "s_dep", parentId: "enr", onStatus: "verified", trigger: "immediately" as const },
    ];
    const lifted = dropRegistrationSteps(steps, (id) => id === "s_reg");
    assert.deepEqual(lifted.map((s) => [s.id, s.parentId, s.onStatus]), [["enr", null, ""], ["dep", "enr", "verified"]]);
    assert.equal(dropRegistrationSteps(lifted, (id) => id === "s_reg"), lifted);
});
