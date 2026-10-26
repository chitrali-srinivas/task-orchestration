/**
 * Routes (pure): which surveyor visits which farmers on which day, and in what order.
 *
 * Assignment is not a task status (statuses belong to the survey templates). A task is assigned when it is
 * on a published route: one route per surveyor per day, one stop per farmer visit, and a stop covers all of
 * that farmer's tasks due that day. Like engine.ts: no clock, no storage, no randomness.
 *
 * Phase 1 (now): HQ assigns by hand from the Tasks page and the route is published straight away.
 * Phase 2: a planner proposes draft routes (see README "Open points").
 */

import type { Farmer, LatLng, Located, STATUS, Task } from "./engine";

// Type-only import above keeps this file runnable by `node --test` without path resolution.
const PLANNED: typeof STATUS.planned = "planned";

/** Farmer visits a surveyor can make in a day when the Surveyors master leaves it empty. */
export const DEFAULT_MAX_VISITS = 8;

export interface Village {
    id: string;
    name: string;
    /** Village centre; production's village_list has it for most villages. */
    centre?: LatLng;
    radiusKm?: number;
}

export interface Surveyor {
    id: string;
    name: string;
    phone?: string;
    baseVillageId?: string;
    maxVisitsPerDay: number;
    active: boolean;
}

export interface RouteStop {
    farmerId: string;
    /** The farmer's tasks done on this visit. */
    taskIds: string[];
}

export interface Route {
    id: string;
    /** YYYY-MM-DD, the visit day. */
    date: string;
    surveyorId: string;
    /** Manual assignments are published straight away; drafts come with the planner. Done-ness is read from the tasks. */
    status: "draft" | "published";
    /** In visiting order. */
    stops: RouteStop[];
    createdAt: string;
    updatedAt: string;
}

/** A planned task can be visited on `date` once it has started and while it is still valid. */
export const visitableOn = (task: Task, date: string) =>
    task.status === PLANNED && task.plannedStart <= date && (!task.plannedEnd || task.plannedEnd >= date);

/** Most urgent first: earliest end date (indefinite last), then oldest planned start, then task number. */
export const byUrgency = (a: Task, b: Task) =>
    (a.plannedEnd || "9999-12-31").localeCompare(b.plannedEnd || "9999-12-31") || a.plannedStart.localeCompare(b.plannedStart) || a.taskNo - b.taskNo;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Where a farmer is visited: the location from registration, else the centre of their village (matched by name). */
export function stopLocation(farmer: Farmer | undefined, villages: Village[]): Located | undefined {
    if (!farmer) return undefined;
    if (farmer.location) return farmer.location;
    const centre = farmer.village ? villages.find((v) => sameName(v.name, farmer.village))?.centre : undefined;
    return centre ? { ...centre, source: "village" } : undefined;
}

/** Straight-line (great-circle) distance in km. Road distances come with a routing service. */
export function distanceKm(a: LatLng, b: LatLng): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface Assignment {
    route: Route;
    /** 1-based position of the task's stop on the route. */
    stopNo: number;
}

/** Task id → the published route and stop it is on. */
export function assignmentsByTask(routes: Route[]): Map<string, Assignment> {
    const out = new Map<string, Assignment>();
    routes
        .filter((r) => r.status === "published")
        .forEach((route) => route.stops.forEach((stop, i) => stop.taskIds.forEach((id) => out.set(id, { route, stopNo: i + 1 }))));
    return out;
}

/** The surveyor's published route for a day. */
export const routeFor = (routes: Route[], surveyorId: string, date: string) =>
    routes.find((r) => r.status === "published" && r.surveyorId === surveyorId && r.date === date);

export type SkipReason = "not-planned" | "not-started" | "ended";

export interface AssignmentPlan {
    /** Tasks that end up on the route, most urgent first (selected ones plus `added`). */
    taskIds: string[];
    /** The same farmers' other unassigned tasks due that day: one visit covers them all. */
    added: string[];
    /** Selected tasks that can't be visited that day. */
    skipped: { taskId: string; reason: SkipReason }[];
    /** Selected tasks that move off another route. */
    moved: { taskId: string; from: Route }[];
    /** Farmer visits on the surveyor's route that day, before and after. */
    visitsBefore: number;
    visitsAfter: number;
    overCapacity: boolean;
}

export interface AssignInput {
    routes: Route[];
    tasks: Task[];
    taskIds: string[];
    surveyorId: string;
    date: string;
    maxVisits: number;
}

/** What assigning `taskIds` to a surveyor for a day would do (the Assign dialog shows this before saving). */
export function planAssignment({ routes, tasks, taskIds, surveyorId, date, maxVisits }: AssignInput): AssignmentPlan {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const assigned = assignmentsByTask(routes);
    const target = routeFor(routes, surveyorId, date);

    const skipped: AssignmentPlan["skipped"] = [];
    const picked: Task[] = [];
    taskIds.forEach((id) => {
        const t = taskById.get(id);
        if (!t) return;
        if (t.status !== PLANNED) skipped.push({ taskId: id, reason: "not-planned" });
        else if (t.plannedStart > date) skipped.push({ taskId: id, reason: "not-started" });
        else if (t.plannedEnd && t.plannedEnd < date) skipped.push({ taskId: id, reason: "ended" });
        else picked.push(t);
    });

    const farmers = new Set(picked.map((t) => t.farmerId));
    const pickedIds = new Set(picked.map((t) => t.id));
    const added = tasks.filter((t) => farmers.has(t.farmerId) && !pickedIds.has(t.id) && !assigned.has(t.id) && visitableOn(t, date));
    const all = [...picked, ...added].sort(byUrgency);

    const moved = picked.flatMap((t) => {
        const from = assigned.get(t.id)?.route;
        return from && from.id !== target?.id ? [{ taskId: t.id, from }] : [];
    });

    const before = new Set(target?.stops.map((s) => s.farmerId) ?? []);
    const after = new Set([...before, ...farmers]);
    return {
        taskIds: all.map((t) => t.id),
        added: added.sort(byUrgency).map((t) => t.id),
        skipped,
        moved,
        visitsBefore: before.size,
        visitsAfter: after.size,
        overCapacity: after.size > maxVisits,
    };
}

/** Take tasks off every route; stops and routes left empty are dropped. */
export function unassignTasks(routes: Route[], taskIds: string[], now: string): Route[] {
    const remove = new Set(taskIds);
    return routes.flatMap((r) => {
        if (!r.stops.some((s) => s.taskIds.some((id) => remove.has(id)))) return [r];
        const stops = r.stops.map((s) => ({ ...s, taskIds: s.taskIds.filter((id) => !remove.has(id)) })).filter((s) => s.taskIds.length > 0);
        return stops.length > 0 ? [{ ...r, stops, updatedAt: now }] : [];
    });
}

/**
 * Put tasks on the surveyor's published route for `date` (created if needed). Tasks already there keep their
 * place; others move off any other route. New farmers become new stops at the end, most urgent first; a farmer
 * already on the route gets the tasks added to their stop. Over capacity nothing changes.
 */
export function assignTasks(input: AssignInput & { newId: string; now: string }): Route[] {
    const plan = planAssignment(input);
    if (plan.overCapacity || plan.taskIds.length === 0) return input.routes;
    const existing = routeFor(input.routes, input.surveyorId, input.date);
    const onTarget = new Set(existing?.stops.flatMap((s) => s.taskIds) ?? []);
    const toAdd = plan.taskIds.filter((id) => !onTarget.has(id));
    if (toAdd.length === 0) return input.routes;

    const routes = unassignTasks(input.routes, toAdd, input.now);
    const route: Route = existing
        ? { ...existing, stops: existing.stops.map((s) => ({ ...s, taskIds: [...s.taskIds] })), updatedAt: input.now }
        : { id: input.newId, date: input.date, surveyorId: input.surveyorId, status: "published", stops: [], createdAt: input.now, updatedAt: input.now };
    const farmerOf = new Map(input.tasks.map((t) => [t.id, t.farmerId]));
    toAdd.forEach((id) => {
        const farmerId = farmerOf.get(id)!;
        const stop = route.stops.find((s) => s.farmerId === farmerId);
        if (stop) stop.taskIds.push(id);
        else route.stops.push({ farmerId, taskIds: [id] });
    });
    return existing ? routes.map((r) => (r.id === existing.id ? route : r)) : [...routes, route];
}
