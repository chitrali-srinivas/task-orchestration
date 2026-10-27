// Run: node --test src/lib/orchestration/jobs.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Farmer, Task } from "./engine.ts";
import {
    addToJob,
    applyJobAction,
    changeSurveyor,
    cheapestPosition,
    deleteJob,
    distanceKm,
    jobEffort,
    jobsFromPlan,
    lastJobByTask,
    moveStop,
    openJobsByTask,
    orderStops,
    planAddToJob,
    planJobs,
    removeTasks,
    reoptimiseJob,
    reorderStop,
    setStopOrder,
    stopLocation,
    unfinishedStops,
    type Job,
    type Surveyor,
} from "./jobs.ts";

const task = (id: string, taskNo: number, farmerId: string, extra: Partial<Task> = {}): Task => ({
    id,
    taskNo,
    workflowId: "wf1",
    stepId: "s",
    surveyId: "s_enr",
    farmerId,
    status: "planned",
    plannedStart: "2026-10-20",
    createdAt: "",
    updatedAt: "",
    ...extra,
});

const tasks = [
    task("t1", 1, "f1"),
    task("t2", 2, "f1", { plannedEnd: "2026-10-30" }), // same farmer, more urgent
    task("t3", 3, "f2", { plannedStart: "2026-10-01" }),
    task("t4", 4, "f3", { plannedStart: "2026-11-15" }), // not started on the 27th
    task("t5", 5, "f4", { plannedEnd: "2026-10-25" }), // ended before the 27th
    task("t6", 6, "f5", { status: "collected" }),
];
const add = { tasks, surveyorId: "ravi", date: "2026-10-27", maxVisits: 8, now: "2026-10-26T00:00:00Z", newId: "j1", by: "HQ" };
const ctx = { now: "2026-10-27T08:00:00Z", by: "HQ" };

test("add to job: one stop per farmer, the farmer's other due tasks come along, a new job starts as created", () => {
    const plan = planAddToJob({ ...add, jobs: [], taskIds: ["t1", "t3", "t4", "t5", "t6"] });
    assert.deepEqual(plan.taskIds, ["t2", "t3", "t1"]); // most urgent first: end date, then oldest start
    assert.deepEqual(plan.added, ["t2"]);
    assert.deepEqual(plan.skipped.map((s) => s.reason), ["not-started", "ended", "not-planned"]);

    const jobs = addToJob({ ...add, jobs: [], taskIds: ["t1", "t3"] });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, "created");
    assert.equal(jobs[0].jobNo, 1);
    assert.deepEqual(jobs[0].stops, [
        { farmerId: "f1", taskIds: ["t2", "t1"] },
        { farmerId: "f2", taskIds: ["t3"] },
    ]);
    assert.equal(openJobsByTask(jobs).get("t3")?.stopNo, 2);
});

test("add to job: appends to the surveyor's job for the day, moves tasks off another editable job, never past capacity", () => {
    let jobs = addToJob({ ...add, jobs: [], taskIds: ["t3"] });
    jobs = addToJob({ ...add, jobs, taskIds: ["t1"], newId: "j2" });
    assert.deepEqual(jobs.map((j) => j.stops.map((s) => s.farmerId)), [["f2", "f1"]]);

    assert.deepEqual(planAddToJob({ ...add, jobs, taskIds: ["t3"], surveyorId: "asha" }).moved.map((m) => m.from.id), ["j1"]);
    jobs = addToJob({ ...add, jobs, taskIds: ["t3"], surveyorId: "asha", newId: "j3" });
    assert.deepEqual(jobs.map((j) => [j.surveyorId, j.jobNo, j.stops.map((s) => s.farmerId)]), [["ravi", 1, ["f1"]], ["asha", 2, ["f2"]]]);

    assert.equal(planAddToJob({ ...add, jobs: [], taskIds: ["t1", "t3"], maxVisits: 1 }).overCapacity, true);
    assert.deepEqual(addToJob({ ...add, jobs: [], taskIds: ["t1", "t3"], maxVisits: 1 }), []);
});

test("lifecycle: created → assigned → accepted → in progress → closed; decline goes back to created; wrong moves change nothing", () => {
    let jobs = addToJob({ ...add, jobs: [], taskIds: ["t1", "t3"] });
    assert.equal(applyJobAction(jobs, "j1", "accept", ctx), jobs); // not assigned yet
    jobs = applyJobAction(jobs, "j1", "assign", ctx);
    assert.equal(applyJobAction(jobs, "j1", "decline", { ...ctx, by: "Ravi" }), jobs); // decline needs a reason
    const declined = applyJobAction(jobs, "j1", "decline", { ...ctx, by: "Ravi", note: "On leave" });
    assert.equal(declined[0].status, "created");
    assert.deepEqual(declined[0].history.map((e) => e.action), ["create", "assign", "decline"]);

    jobs = applyJobAction(applyJobAction(jobs, "j1", "accept", { ...ctx, by: "Ravi" }), "j1", "start", { ...ctx, by: "Ravi" });
    assert.equal(jobs[0].status, "in_progress");
    // Locked once accepted: no edits, nothing added, its tasks can't be moved.
    assert.equal(reorderStop(jobs, "j1", 0, 1, ""), jobs);
    assert.equal(planAddToJob({ ...add, jobs, taskIds: ["t1"] }).locked, true);
    assert.deepEqual(planAddToJob({ ...add, jobs, taskIds: ["t1"], surveyorId: "asha" }).skipped, [{ taskId: "t1", reason: "locked" }]);
    assert.equal(removeTasks(jobs, ["t1"], ""), jobs);

    // Closing: f1's stop is done, f2's isn't and needs a reason; its task is released.
    const now = tasks.map((t) => (t.id === "t1" || t.id === "t2" ? { ...t, status: "collected" } : t));
    assert.deepEqual(unfinishedStops(jobs[0], now), [1]);
    assert.equal(applyJobAction(jobs, "j1", "close", { ...ctx, tasks: now }), jobs);
    const closed = applyJobAction(jobs, "j1", "close", { ...ctx, by: "Ravi", tasks: now, reasons: { 1: "Farmer away" } });
    assert.equal(closed[0].status, "closed");
    assert.equal(closed[0].stops[1].notDoneReason, "Farmer away");
    assert.equal(openJobsByTask(closed).has("t3"), false);
    assert.equal(lastJobByTask(closed).get("t3")?.job.id, "j1");
});

test("editing until accepted: reorder, move a stop within capacity, delete only created jobs, removing tasks keeps the job", () => {
    let jobs = addToJob({ ...add, jobs: [], taskIds: ["t1", "t3"] });
    jobs = reorderStop(jobs, "j1", 1, 0, "");
    assert.deepEqual(jobs[0].stops.map((s) => s.farmerId), ["f2", "f1"]);

    const other: Job = { ...jobs[0], id: "j2", jobNo: 2, surveyorId: "asha", stops: [{ farmerId: "f9", taskIds: ["x"] }] };
    jobs = [...jobs, other];
    assert.equal(moveStop(jobs, "j1", 0, "j2", 1, ""), jobs); // asha is full
    const moved = moveStop(jobs, "j1", 0, "j2", 8, "");
    assert.deepEqual(moved.map((j) => j.stops.map((s) => s.farmerId)), [["f1"], ["f9", "f2"]]);

    assert.deepEqual(removeTasks(moved, ["t1", "t2"], "")[0].stops, []);
    const assigned = applyJobAction(moved, "j2", "assign", ctx);
    assert.equal(deleteJob(assigned, "j2").length, 2);
    assert.equal(deleteJob(assigned, "j1").length, 1);
});

// Planner: three villages in a line (west → east), two surveyors based at the ends.
const villages = [
    { id: "vw", name: "West", centre: { lat: 21, lng: 77.0 } },
    { id: "vm", name: "Middle", centre: { lat: 21, lng: 77.1 } },
    { id: "ve", name: "East", centre: { lat: 21, lng: 77.2 } },
];
const farmer = (id: string, village: string): Farmer => ({ id, name: id, village, createdAt: "" });
const farmers = [farmer("a", "West"), farmer("b", "East"), farmer("c", "West"), farmer("d", "East"), farmer("e", "Nowhere")];
const surveyor = (id: string, baseVillageId: string, maxVisitsPerDay = 8): Surveyor => ({ id, name: id, baseVillageId, maxVisitsPerDay, active: true });
const ptasks = [
    task("pa", 1, "a", { plannedEnd: "2026-10-28" }),
    task("pb", 2, "b"),
    task("pc", 3, "c"),
    task("pd", 4, "d"),
    task("pe", 5, "e"),
];
const plan = (extra: Partial<Parameters<typeof planJobs>[0]> = {}) =>
    planJobs({ date: "2026-10-27", surveyors: [surveyor("west", "vw"), surveyor("east", "ve")], tasks: ptasks, taskIds: ptasks.map((t) => t.id), jobs: [], farmers, villages, ...extra });

test("planner: nearby farmers go to the nearest surveyor; no location is unplanned; jobs are round trips from the base", () => {
    const p = plan();
    assert.deepEqual(p.jobs.map((j) => [j.surveyorId, j.stops.map((s) => s.farmerId)]), [["west", ["a", "c"]], ["east", ["b", "d"]]]);
    assert.deepEqual(p.unplanned, [{ stop: { farmerId: "e", taskIds: ["pe"] }, reason: "no-location" }]);
    assert.equal(p.jobs[0].km, 0); // both farmers at the base village centre

    const created = jobsFromPlan([], p, "2026-10-27", (i) => `j${i}`, "now");
    assert.deepEqual(created.map((j) => [j.jobNo, j.status, j.history[0].by]), [[1, "created", "Planner"], [2, "created", "Planner"]]);
});

test("planner: capacity leaves the least urgent stops unplanned; busy surveyors and held tasks are skipped", () => {
    const p = plan({ surveyors: [surveyor("west", "vw", 1)], taskIds: ["pa", "pc", "pb"] });
    assert.deepEqual(p.jobs.map((j) => j.stops.map((s) => s.farmerId)), [["a"]]); // pa is the most urgent (earliest end)
    assert.deepEqual(p.unplanned.map((u) => [u.stop.farmerId, u.reason]), [["b", "no-capacity"], ["c", "no-capacity"]]);

    const jobs = addToJob({ jobs: [], tasks: ptasks, taskIds: ["pb"], surveyorId: "east", date: "2026-10-27", maxVisits: 8, newId: "j1", now: "", by: "HQ" });
    const q = plan({ jobs });
    assert.deepEqual(q.busy.map((b) => b.surveyorId), ["east"]);
    assert.deepEqual(q.skipped, [{ taskId: "pb", reason: "on-job" }]);
    assert.deepEqual(q.jobs.map((j) => [j.surveyorId, j.stops.map((s) => s.farmerId)]), [["west", ["a", "c", "d"]]]);
});

test("visiting order: nearest next from the base, then crossings removed", () => {
    // Base at 0; points at 3, 1, 2 along a line → visit 1, 2, 3.
    const pt = (x: number) => ({ lat: 0, lng: x });
    assert.deepEqual(orderStops([pt(3), pt(1), pt(2)], pt(0)), [1, 2, 0]);
    // Square corners from the base at a corner: the round trip goes around, not across.
    const square = [{ lat: 1, lng: 1 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
    const order = orderStops(square, { lat: 0, lng: 0 });
    assert.ok(JSON.stringify(order) === "[1,0,2]" || JSON.stringify(order) === "[2,0,1]");
});

test("stop location: registration GPS, else the village centre matched by name; distances are straight-line km", () => {
    const vs = [{ id: "v1", name: "Achalpur", centre: { lat: 21.25, lng: 77.5 } }];
    const gps = { id: "f1", name: "A", village: "Achalpur", createdAt: "", location: { lat: 21.3, lng: 77.6, source: "gps" as const } };
    assert.equal(stopLocation(gps, vs)?.source, "gps");
    assert.deepEqual(stopLocation({ ...gps, location: undefined, village: " achalpur " }, vs), { lat: 21.25, lng: 77.5, source: "village" });
    assert.equal(stopLocation({ ...gps, location: undefined, village: "Unknown" }, vs), undefined);
    assert.equal(Math.round(distanceKm({ lat: 21, lng: 77 }, { lat: 22, lng: 77 })), 111);
});

// Job workspace: effort, placing added stops, re-optimising, handing a job to another surveyor.
// Points on a plane (x, y) with straight-line distance keep the numbers easy to check; the base is at the origin.
const at = (x: number, y = 0) => ({ lat: y, lng: x });
const line = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot(a.lat - b.lat, a.lng - b.lng);
const planeRoute = (xy: Record<string, [number, number]>) => ({ locate: (id: string) => (id in xy ? at(...xy[id]) : undefined), base: at(0), distance: line });
const jobOf = (stops: string[], extra: Partial<Job> = {}): Job => ({
    id: "j1",
    jobNo: 1,
    date: "2026-10-27",
    surveyorId: "ravi",
    status: "created",
    stops: stops.map((farmerId) => ({ farmerId, taskIds: [`t_${farmerId}`] })),
    history: [],
    createdAt: "",
    updatedAt: "",
    ...extra,
});

test("effort: drive time at 25 km/h plus 20 minutes per task; legs pass over stops without a location", () => {
    const e = jobEffort([at(10), undefined, at(20)], [1, 1, 2], at(0), line);
    assert.deepEqual(e.stops.map((s) => [s.km, s.driveMin, s.onSiteMin]), [[10, 24, 20], [undefined, undefined, 20], [10, 24, 40]]);
    assert.equal(e.returnKm, 20);
    assert.equal(e.km, 40);
    assert.deepEqual([e.driveMin, e.onSiteMin, e.totalMin], [96, 80, 176]);
});

test("added stops go where they add the least distance, without moving the others; no location goes last", () => {
    // Round trip base → a (0,10) → b (10,10) → base; c sits on the a–b leg, e beyond b.
    const route = planeRoute({ a: [0, 10], b: [10, 10], c: [5, 10], e: [15, 10] });
    const stops = jobOf(["a", "b"]).stops;
    assert.equal(cheapestPosition(stops, "c", route), 1);
    assert.equal(cheapestPosition(stops, "e", route), 2);
    assert.equal(cheapestPosition(stops, "nowhere", route), 2);

    const tasks = [task("t_a", 1, "a"), task("t_b", 2, "b"), task("t_c", 3, "c")];
    let jobs = addToJob({ jobs: [], tasks, taskIds: ["t_a", "t_b"], surveyorId: "ravi", date: "2026-10-27", maxVisits: 8, newId: "j1", now: "", by: "HQ", route });
    jobs = addToJob({ jobs, tasks, taskIds: ["t_c"], surveyorId: "ravi", date: "2026-10-27", maxVisits: 8, newId: "j2", now: "", by: "HQ", route });
    assert.deepEqual(jobs[0].stops.map((s) => s.farmerId), ["a", "c", "b"]);
});

test("re-optimise orders the stops for the shortest round trip, unlocated last; accepted jobs stay as they are", () => {
    // Corners of a square around the base: the shortest round trip goes around it, not across.
    const route = planeRoute({ a: [0, 10], b: [10, 10], c: [10, 0] });
    const jobs = [jobOf(["b", "u", "c", "a"])];
    assert.deepEqual(reoptimiseJob(jobs, "j1", route, "")[0].stops.map((s) => s.farmerId), ["c", "b", "a", "u"]);
    const ordered = [jobOf(["c", "b", "a"])];
    assert.equal(reoptimiseJob(ordered, "j1", route, ""), ordered);
    const accepted = [jobOf(["b", "a"], { status: "accepted" })];
    assert.equal(reoptimiseJob(accepted, "j1", route, ""), accepted);
});

test("change surveyor: only before acceptance, to someone free that day with enough visits; recorded in the history", () => {
    const jobs = [jobOf(["a", "b"])];
    const moved = changeSurveyor(jobs, "j1", "asha", 8, { now: "n", by: "HQ", note: "From Ravi to Asha" });
    assert.equal(moved[0].surveyorId, "asha");
    assert.deepEqual(moved[0].history.at(-1), { action: "reassign", at: "n", by: "HQ", note: "From Ravi to Asha" });

    const ashaBusy = [...jobs, jobOf(["c"], { id: "j2", jobNo: 2, surveyorId: "asha" })];
    assert.equal(changeSurveyor(ashaBusy, "j1", "asha", 8, { now: "", by: "HQ" }), ashaBusy);
    assert.equal(changeSurveyor(jobs, "j1", "asha", 1, { now: "", by: "HQ" }), jobs);
    const accepted = [jobOf(["a"], { status: "accepted" })];
    assert.equal(changeSurveyor(accepted, "j1", "asha", 8, { now: "", by: "HQ" }), accepted);
});

test("rearranging: a saved order must name every stop once; accepted jobs can't be rearranged", () => {
    const jobs = [jobOf(["a", "b", "c"])];
    assert.deepEqual(setStopOrder(jobs, "j1", ["c", "a", "b"], "")[0].stops.map((s) => s.farmerId), ["c", "a", "b"]);
    assert.equal(setStopOrder(jobs, "j1", ["a", "b", "c"], ""), jobs); // unchanged order
    assert.equal(setStopOrder(jobs, "j1", ["a", "b"], ""), jobs); // missing a stop
    assert.equal(setStopOrder(jobs, "j1", ["a", "a", "b"], ""), jobs);
    const accepted = [jobOf(["a", "b"], { status: "accepted" })];
    assert.equal(setStopOrder(accepted, "j1", ["b", "a"], ""), accepted);
});
