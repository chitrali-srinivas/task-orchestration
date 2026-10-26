// Run: node --test src/lib/orchestration/routes.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./engine.ts";
import { assignTasks, assignmentsByTask, distanceKm, planAssignment, stopLocation, unassignTasks, type Route } from "./routes.ts";

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
const base = { tasks, surveyorId: "ravi", date: "2026-10-27", maxVisits: 8, now: "2026-10-26T00:00:00Z", newId: "r1" };

test("one stop per farmer: the farmer's other due tasks come along; tasks that can't be visited that day are skipped", () => {
    const plan = planAssignment({ ...base, routes: [], taskIds: ["t1", "t3", "t4", "t5", "t6"] });
    assert.deepEqual(plan.taskIds, ["t2", "t3", "t1"]); // most urgent first: end date, then oldest start
    assert.deepEqual(plan.added, ["t2"]);
    assert.deepEqual(plan.skipped, [
        { taskId: "t4", reason: "not-started" },
        { taskId: "t5", reason: "ended" },
        { taskId: "t6", reason: "not-planned" },
    ]);
    assert.equal(plan.visitsAfter, 2);

    const routes = assignTasks({ ...base, routes: [], taskIds: ["t1", "t3"] });
    assert.equal(routes.length, 1);
    assert.equal(routes[0].status, "published");
    assert.deepEqual(routes[0].stops, [
        { farmerId: "f1", taskIds: ["t2", "t1"] },
        { farmerId: "f2", taskIds: ["t3"] },
    ]);
    assert.equal(assignmentsByTask(routes).get("t3")?.stopNo, 2);
});

test("assigning again appends to the surveyor's route for that day; reassigning moves a task off the other route", () => {
    let routes = assignTasks({ ...base, routes: [], taskIds: ["t3"] });
    routes = assignTasks({ ...base, routes, taskIds: ["t1"], newId: "r2" });
    assert.deepEqual(routes.map((r) => r.stops.map((s) => s.farmerId)), [["f2", "f1"]]);

    const plan = planAssignment({ ...base, routes, taskIds: ["t3"], surveyorId: "asha" });
    assert.deepEqual(plan.moved.map((m) => [m.taskId, m.from.surveyorId]), [["t3", "ravi"]]);
    routes = assignTasks({ ...base, routes, taskIds: ["t3"], surveyorId: "asha", newId: "r3" });
    assert.deepEqual(routes.map((r) => [r.surveyorId, r.stops.map((s) => s.farmerId)]), [["ravi", ["f1"]], ["asha", ["f2"]]]);

    // Already on the route: nothing changes.
    assert.equal(assignTasks({ ...base, routes, taskIds: ["t1"] }), routes);
});

test("capacity counts farmer visits; over capacity nothing is assigned", () => {
    const plan = planAssignment({ ...base, routes: [], taskIds: ["t1", "t2", "t3"], maxVisits: 1 });
    assert.equal(plan.visitsAfter, 2);
    assert.equal(plan.overCapacity, true);
    assert.deepEqual(assignTasks({ ...base, routes: [], taskIds: ["t1", "t2", "t3"], maxVisits: 1 }), []);
    assert.equal(planAssignment({ ...base, routes: [], taskIds: ["t1", "t2"], maxVisits: 1 }).overCapacity, false);
});

test("unassigning drops empty stops and empty routes", () => {
    const routes: Route[] = assignTasks({ ...base, routes: [], taskIds: ["t1", "t3"] });
    assert.deepEqual(unassignTasks(routes, ["t3"], "").map((r) => r.stops.map((s) => s.farmerId)), [["f1"]]);
    assert.deepEqual(unassignTasks(routes, ["t1", "t2", "t3"], ""), []);
});

test("stop location: registration GPS, else the village centre matched by name; distances are straight-line km", () => {
    const villages = [{ id: "v1", name: "Achalpur", centre: { lat: 21.25, lng: 77.5 } }];
    const gps = { id: "f1", name: "A", village: "Achalpur", createdAt: "", location: { lat: 21.3, lng: 77.6, source: "gps" as const } };
    assert.equal(stopLocation(gps, villages)?.source, "gps");
    assert.deepEqual(stopLocation({ ...gps, location: undefined, village: " achalpur " }, villages), { lat: 21.25, lng: 77.5, source: "village" });
    assert.equal(stopLocation({ ...gps, location: undefined, village: "Unknown" }, villages), undefined);
    assert.equal(Math.round(distanceKm({ lat: 21, lng: 77 }, { lat: 22, lng: 77 })), 111);
});
