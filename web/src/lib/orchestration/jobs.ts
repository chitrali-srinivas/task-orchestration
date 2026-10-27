/**
 * Jobs (pure): a surveyor's visits for one day, the job lifecycle, and the planner that creates jobs.
 *
 * A job is one surveyor, one date and an ordered list of stops: one stop per farmer visit, covering all of that
 * farmer's tasks due that day. Assignment is not a task status (statuses belong to the survey templates): a task is
 * held by the open job it is on, and by one open job at most.
 *
 * Lifecycle: created (planner draft, HQ reviews) → assigned (on the surveyor's phone) → accepted → in progress →
 * job sheet closed. A declined job goes back to created. Stops can be changed until the surveyor accepts. When the
 * sheet is closed, tasks still planned are released (with the reason they weren't done) and the next plan picks
 * them up first, because they are the oldest.
 *
 * Like engine.ts: no clock, no storage, no randomness. Distances are straight-line km unless a `distance` function
 * is passed (a routing service's road distances plug in there without changing the screens).
 */

import type { Farmer, LatLng, Located, STATUS, Task } from "./engine";

// Type-only imports above keep this file runnable by `node --test` without path resolution.
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

/* ------------------------------ Job record ------------------------------ */

export const JOB_STATUS = {
    created: "created",
    assigned: "assigned",
    accepted: "accepted",
    inProgress: "in_progress",
    closed: "closed",
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
/** Lifecycle order. */
export const JOB_STATUSES: JobStatus[] = [JOB_STATUS.created, JOB_STATUS.assigned, JOB_STATUS.accepted, JOB_STATUS.inProgress, JOB_STATUS.closed];
export const JOB_STATUS_NAME: Record<JobStatus, string> = {
    [JOB_STATUS.created]: "Job created",
    [JOB_STATUS.assigned]: "Job assigned",
    [JOB_STATUS.accepted]: "Job accepted",
    [JOB_STATUS.inProgress]: "In progress",
    [JOB_STATUS.closed]: "Job sheet closed",
};

export interface JobStop {
    farmerId: string;
    /** The farmer's tasks done on this visit. */
    taskIds: string[];
    /** Given when the job sheet is closed with some of the stop's tasks still planned. */
    notDoneReason?: string;
}

export type JobAction = "create" | "assign" | "unassign" | "accept" | "decline" | "start" | "close" | "reassign";
/** Status changes (create and reassign are recorded in the history but don't move the status). */
export type JobMove = Exclude<JobAction, "create" | "reassign">;

export interface JobEvent {
    action: JobAction;
    /** ISO timestamp */
    at: string;
    /** "Planner", "HQ" or the surveyor's name. */
    by: string;
    note?: string;
}

export interface Job {
    id: string;
    /** Human number, e.g. J12. */
    jobNo: number;
    /** YYYY-MM-DD, the visit day. */
    date: string;
    surveyorId: string;
    status: JobStatus;
    /** In visiting order. */
    stops: JobStop[];
    history: JobEvent[];
    createdAt: string;
    updatedAt: string;
}

export const isOpen = (job: Job) => job.status !== JOB_STATUS.closed;
/** Stops can be added, removed, moved and reordered until the surveyor accepts the job. */
export const isEditable = (job: Job) => job.status === JOB_STATUS.created || job.status === JOB_STATUS.assigned;
export const nextJobNo = (jobs: Job[]) => jobs.reduce((m, j) => Math.max(m, j.jobNo), 0) + 1;

/** A planned task can be visited on `date` once it has started and while it is still valid. */
export const visitableOn = (task: Task, date: string) =>
    task.status === PLANNED && task.plannedStart <= date && (!task.plannedEnd || task.plannedEnd >= date);

/** Most urgent first: earliest end date (indefinite last), then oldest planned start, then task number. */
export const byUrgency = (a: Task, b: Task) =>
    (a.plannedEnd || "9999-12-31").localeCompare(b.plannedEnd || "9999-12-31") || a.plannedStart.localeCompare(b.plannedStart) || a.taskNo - b.taskNo;

/** Stops whose tasks aren't all done yet (some still planned): they need a reason when the sheet is closed. */
export function unfinishedStops(job: Job, tasks: Task[]): number[] {
    const planned = new Set(tasks.filter((t) => t.status === PLANNED).map((t) => t.id));
    return job.stops.flatMap((s, i) => (s.taskIds.some((id) => planned.has(id)) ? [i] : []));
}

/* ------------------------------ Locations and distances ------------------------------ */

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

export type DistanceFn = (a: LatLng, b: LatLng) => number;

/** Length of base → stops → base (stops without a location are passed over); undefined when no stop has a location. */
export function routeKm(points: (LatLng | undefined)[], base?: LatLng, distance: DistanceFn = distanceKm): number | undefined {
    const known = points.filter((p): p is LatLng => Boolean(p));
    if (known.length === 0) return undefined;
    const path = base ? [base, ...known, base] : known;
    return path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
}

/* ------------------------------ Effort ------------------------------ */

/** Estimates until the routing service gives drive times: average speed on rural roads, and time on site per task. */
export const EFFORT = { driveKmh: 25, minutesPerTask: 20 } as const;

/** Estimated drive time for a distance. */
export const driveMinutes = (km: number) => Math.round((km / EFFORT.driveKmh) * 60);

export interface StopEffort {
    /** Km from the last located point before the stop (the base village for the first). */
    km?: number;
    driveMin?: number;
    onSiteMin: number;
}

export interface JobEffort {
    stops: StopEffort[];
    /** Km from the last located stop back to the base. */
    returnKm?: number;
    /** The whole round trip (routeKm). */
    km?: number;
    driveMin: number;
    onSiteMin: number;
    totalMin: number;
}

/** Drive and on-site time per stop and for the day. Legs pass over stops without a location, like routeKm. */
export function jobEffort(locations: (LatLng | undefined)[], taskCounts: number[], base?: LatLng, distance: DistanceFn = distanceKm): JobEffort {
    const stops: StopEffort[] = [];
    let last = base;
    for (const [i, loc] of locations.entries()) {
        const km = last && loc ? distance(last, loc) : undefined;
        stops.push({ km, driveMin: km === undefined ? undefined : driveMinutes(km), onSiteMin: (taskCounts[i] ?? 0) * EFFORT.minutesPerTask });
        if (loc) last = loc;
    }
    const returnKm = base && last && locations.some(Boolean) ? distance(last, base) : undefined;
    const km = routeKm(locations, base, distance);
    const driveMin = km === undefined ? 0 : driveMinutes(km);
    const onSiteMin = stops.reduce((sum, s) => sum + s.onSiteMin, 0);
    return { stops, returnKm, km, driveMin, onSiteMin, totalMin: driveMin + onSiteMin };
}

/* ------------------------------ Who holds which task ------------------------------ */

export interface JobRef {
    job: Job;
    /** 1-based position of the task's stop on the job. */
    stopNo: number;
}

const refs = (jobs: Job[]) => {
    const out = new Map<string, JobRef>();
    jobs.forEach((job) => job.stops.forEach((stop, i) => stop.taskIds.forEach((id) => out.set(id, { job, stopNo: i + 1 }))));
    return out;
};

/** Task id → the open job holding it. */
export const openJobsByTask = (jobs: Job[]) => refs(jobs.filter(isOpen));

/** Task id → the job to show for it: the open one, else the latest closed one (who did it, or why it wasn't done). */
export const lastJobByTask = (jobs: Job[]) =>
    refs([...jobs.filter((j) => !isOpen(j)).sort((a, b) => a.date.localeCompare(b.date) || a.jobNo - b.jobNo), ...jobs.filter(isOpen)]);

/** The surveyor's open job for a day (one at most). */
export const openJobFor = (jobs: Job[], surveyorId: string, date: string) => jobs.find((j) => isOpen(j) && j.surveyorId === surveyorId && j.date === date);

/* ------------------------------ Lifecycle ------------------------------ */

const MOVES: Record<JobMove, { from: JobStatus[]; to: JobStatus }> = {
    assign: { from: [JOB_STATUS.created], to: JOB_STATUS.assigned },
    unassign: { from: [JOB_STATUS.assigned], to: JOB_STATUS.created },
    accept: { from: [JOB_STATUS.assigned], to: JOB_STATUS.accepted },
    decline: { from: [JOB_STATUS.assigned], to: JOB_STATUS.created },
    start: { from: [JOB_STATUS.accepted], to: JOB_STATUS.inProgress },
    // The surveyor closes an accepted or started job; HQ can also close an assigned one.
    close: { from: [JOB_STATUS.assigned, JOB_STATUS.accepted, JOB_STATUS.inProgress], to: JOB_STATUS.closed },
};

export const canDo = (job: Job, action: JobMove) => MOVES[action].from.includes(job.status);

export interface ActionContext {
    now: string;
    by: string;
    /** Required for decline. */
    note?: string;
    /** close: all tasks (to find unfinished stops) and a reason for each unfinished stop, by stop index. */
    tasks?: Task[];
    reasons?: Record<number, string>;
}

/** Move a job along its lifecycle. Not allowed from its status, or missing a required reason: nothing changes. */
export function applyJobAction(jobs: Job[], jobId: string, action: JobMove, ctx: ActionContext): Job[] {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !canDo(job, action)) return jobs;
    if (action === "decline" && !ctx.note?.trim()) return jobs;
    let stops = job.stops;
    if (action === "close") {
        const unfinished = unfinishedStops(job, ctx.tasks ?? []);
        if (unfinished.some((i) => !ctx.reasons?.[i]?.trim())) return jobs;
        stops = job.stops.map((s, i) => (unfinished.includes(i) ? { ...s, notDoneReason: ctx.reasons![i].trim() } : s));
    }
    const event: JobEvent = { action, at: ctx.now, by: ctx.by, ...(ctx.note?.trim() ? { note: ctx.note.trim() } : {}) };
    return jobs.map((j) => (j.id === jobId ? { ...j, status: MOVES[action].to, stops, history: [...j.history, event], updatedAt: ctx.now } : j));
}

/* ------------------------------ Editing (until accepted) ------------------------------ */

const edit = (jobs: Job[], jobId: string, now: string, change: (stops: JobStop[]) => JobStop[] | null): Job[] => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !isEditable(job)) return jobs;
    const stops = change(job.stops.map((s) => ({ ...s, taskIds: [...s.taskIds] })));
    return stops ? jobs.map((j) => (j.id === jobId ? { ...j, stops, updatedAt: now } : j)) : jobs;
};

/** Only a job the surveyor never saw (created) can be deleted; its tasks become unassigned. */
export const deleteJob = (jobs: Job[], jobId: string) => jobs.filter((j) => !(j.id === jobId && j.status === JOB_STATUS.created));

export const reorderStop = (jobs: Job[], jobId: string, from: number, to: number, now: string) =>
    edit(jobs, jobId, now, (stops) => {
        if (from < 0 || from >= stops.length || to < 0 || to >= stops.length || from === to) return null;
        const [stop] = stops.splice(from, 1);
        stops.splice(to, 0, stop);
        return stops;
    });

export const removeStop = (jobs: Job[], jobId: string, index: number, now: string) =>
    edit(jobs, jobId, now, (stops) => (index >= 0 && index < stops.length ? stops.filter((_, i) => i !== index) : null));

/** Move a stop to another editable job on the same day (merged into the farmer's stop there); not past its capacity. */
export function moveStop(jobs: Job[], jobId: string, index: number, toJobId: string, maxVisits: number, now: string): Job[] {
    const from = jobs.find((j) => j.id === jobId);
    const to = jobs.find((j) => j.id === toJobId);
    const stop = from?.stops[index];
    if (!from || !to || !stop || from.id === to.id || !isEditable(from) || !isEditable(to) || from.date !== to.date) return jobs;
    const merging = to.stops.some((s) => s.farmerId === stop.farmerId);
    if (!merging && to.stops.length >= maxVisits) return jobs;
    const removed = removeStop(jobs, jobId, index, now);
    return edit(removed, toJobId, now, (stops) => {
        const existing = stops.find((s) => s.farmerId === stop.farmerId);
        if (existing) existing.taskIds.push(...stop.taskIds.filter((id) => !existing.taskIds.includes(id)));
        else stops.push({ farmerId: stop.farmerId, taskIds: [...stop.taskIds] });
        return stops;
    });
}

/** How to place stops by distance: each farmer's location and the surveyor's base village. */
export interface RouteContext {
    locate: (farmerId: string) => LatLng | undefined;
    base?: LatLng;
    distance?: DistanceFn;
}

/** Where a new stop adds the least to the round trip, without moving the others (ties go later); the end when it has no location. */
export function cheapestPosition(stops: JobStop[], farmerId: string, route: RouteContext): number {
    const loc = route.locate(farmerId);
    if (!loc) return stops.length;
    const points = stops.map((s) => route.locate(s.farmerId));
    let best = stops.length;
    let bestKm = Infinity;
    for (let p = stops.length; p >= 0; p--) {
        const km = routeKm([...points.slice(0, p), loc, ...points.slice(p)], route.base, route.distance) ?? 0;
        if (km < bestKm - 1e-9) {
            best = p;
            bestKm = km;
        }
    }
    return best;
}

/** The stops in the shortest round-trip order (the planner's ordering); stops without a location go last. */
export function bestOrder(stops: JobStop[], route: RouteContext): JobStop[] {
    const located = stops.filter((s) => route.locate(s.farmerId));
    const rest = stops.filter((s) => !route.locate(s.farmerId));
    const order = orderStops(located.map((s) => route.locate(s.farmerId)!), route.base, route.distance);
    return [...order.map((i) => located[i]), ...rest];
}

/** Reorder an editable job's stops for the shortest round trip. Already in that order: nothing changes. */
export const reoptimiseJob = (jobs: Job[], jobId: string, route: RouteContext, now: string) =>
    edit(jobs, jobId, now, (stops) => {
        const next = bestOrder(stops, route);
        return next.every((s, i) => s === stops[i]) ? null : next;
    });

/** Put an editable job's stops in the given farmer order (HQ rearranged them); it must name every stop once. */
export const setStopOrder = (jobs: Job[], jobId: string, farmerIds: string[], now: string) =>
    edit(jobs, jobId, now, (stops) => {
        const byFarmer = new Map(stops.map((s) => [s.farmerId, s]));
        if (farmerIds.length !== stops.length || new Set(farmerIds).size !== stops.length || !farmerIds.every((id) => byFarmer.has(id))) return null;
        return farmerIds.every((id, i) => id === stops[i].farmerId) ? null : farmerIds.map((id) => byFarmer.get(id)!);
    });

/** Hand an editable job to another surveyor who has no open job that day and enough visits; recorded in the history. */
export function changeSurveyor(jobs: Job[], jobId: string, surveyorId: string, maxVisits: number, ctx: { now: string; by: string; note?: string }): Job[] {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !isEditable(job) || job.surveyorId === surveyorId) return jobs;
    if (openJobFor(jobs, surveyorId, job.date) || job.stops.length > maxVisits) return jobs;
    const event: JobEvent = { action: "reassign", at: ctx.now, by: ctx.by, ...(ctx.note ? { note: ctx.note } : {}) };
    return jobs.map((j) => (j.id === jobId ? { ...j, surveyorId, history: [...j.history, event], updatedAt: ctx.now } : j));
}

/** Take tasks off the editable jobs holding them; stops left empty are dropped (the job stays, HQ can delete it). */
export function removeTasks(jobs: Job[], taskIds: string[], now: string): Job[] {
    const remove = new Set(taskIds);
    const touched = (j: Job) => isEditable(j) && j.stops.some((s) => s.taskIds.some((id) => remove.has(id)));
    if (!jobs.some(touched)) return jobs;
    return jobs.map((j) => {
        if (!touched(j)) return j;
        const stops = j.stops.map((s) => ({ ...s, taskIds: s.taskIds.filter((id) => !remove.has(id)) })).filter((s) => s.taskIds.length > 0);
        return { ...j, stops, updatedAt: now };
    });
}

/* ------------------------------ Adding tasks by hand ------------------------------ */

export type SkipReason = "not-planned" | "not-started" | "ended" | "locked";

/** Why a selected task can't go on a job for `date`; undefined when it can. */
function skipReason(t: Task, date: string, held: Map<string, JobRef>, target?: Job): SkipReason | undefined {
    if (t.status !== PLANNED) return "not-planned";
    if (t.plannedStart > date) return "not-started";
    if (t.plannedEnd && t.plannedEnd < date) return "ended";
    const holder = held.get(t.id)?.job;
    if (holder && holder.id !== target?.id && !isEditable(holder)) return "locked";
    return undefined;
}

/** One stop per farmer: the picked tasks plus the same farmers' other due tasks that no open job holds. */
function withFarmersOtherTasks(picked: Task[], tasks: Task[], held: Map<string, JobRef>, date: string) {
    const farmers = new Set(picked.map((t) => t.farmerId));
    const pickedIds = new Set(picked.map((t) => t.id));
    const added = tasks.filter((t) => farmers.has(t.farmerId) && !pickedIds.has(t.id) && !held.has(t.id) && visitableOn(t, date)).sort(byUrgency);
    return { all: [...picked, ...added].sort(byUrgency), added };
}

export interface AddPlan {
    /** The surveyor's open job that day, if any; a new created job otherwise. */
    target?: Job;
    /** The target was accepted or started: nothing can be added. */
    locked: boolean;
    /** Tasks that end up on the job, most urgent first (selected ones plus `added`). */
    taskIds: string[];
    /** The same farmers' other due tasks no open job holds: one visit covers them all. */
    added: string[];
    /** Selected tasks that can't go on the job. */
    skipped: { taskId: string; reason: SkipReason }[];
    /** Selected tasks that move off another job. */
    moved: { taskId: string; from: Job }[];
    /** Farmer visits on the job before and after. */
    visitsBefore: number;
    visitsAfter: number;
    overCapacity: boolean;
}

export interface AddInput {
    jobs: Job[];
    tasks: Task[];
    taskIds: string[];
    surveyorId: string;
    date: string;
    maxVisits: number;
}

/** What adding `taskIds` to the surveyor's job for a day would do (the Add to job dialog shows it before saving). */
export function planAddToJob({ jobs, tasks, taskIds, surveyorId, date, maxVisits }: AddInput): AddPlan {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const held = openJobsByTask(jobs);
    const target = openJobFor(jobs, surveyorId, date);
    const locked = Boolean(target && !isEditable(target));

    const skipped: AddPlan["skipped"] = [];
    const picked: Task[] = [];
    taskIds.forEach((id) => {
        const t = taskById.get(id);
        if (!t) return;
        const reason = skipReason(t, date, held, target);
        if (reason) skipped.push({ taskId: id, reason });
        else picked.push(t);
    });
    const { all, added } = withFarmersOtherTasks(picked, tasks, held, date);
    const moved = picked.flatMap((t) => {
        const from = held.get(t.id)?.job;
        return from && from.id !== target?.id ? [{ taskId: t.id, from }] : [];
    });

    const before = new Set(target?.stops.map((s) => s.farmerId) ?? []);
    const after = new Set([...before, ...picked.map((t) => t.farmerId)]);
    return {
        target,
        locked,
        taskIds: all.map((t) => t.id),
        added: added.map((t) => t.id),
        skipped,
        moved,
        visitsBefore: before.size,
        visitsAfter: after.size,
        overCapacity: after.size > maxVisits,
    };
}

/**
 * Put tasks on the surveyor's open job for `date`, or on a new created job. Tasks already there keep their place;
 * others move off their editable job. A new farmer becomes a new stop where it adds the least distance (with `route`;
 * at the end without), most urgent first. Locked target or over capacity: nothing changes.
 */
export function addToJob(input: AddInput & { newId: string; now: string; by: string; route?: RouteContext }): Job[] {
    const plan = planAddToJob(input);
    if (plan.locked || plan.overCapacity || plan.taskIds.length === 0) return input.jobs;
    const onTarget = new Set(plan.target?.stops.flatMap((s) => s.taskIds) ?? []);
    const toAdd = plan.taskIds.filter((id) => !onTarget.has(id));
    if (toAdd.length === 0) return input.jobs;

    const jobs = removeTasks(input.jobs, toAdd, input.now);
    const job: Job = plan.target
        ? { ...plan.target, stops: plan.target.stops.map((s) => ({ ...s, taskIds: [...s.taskIds] })), updatedAt: input.now }
        : newJob(input.newId, nextJobNo(input.jobs), input.date, input.surveyorId, [], input.now, input.by);
    const farmerOf = new Map(input.tasks.map((t) => [t.id, t.farmerId]));
    toAdd.forEach((id) => {
        const farmerId = farmerOf.get(id)!;
        const stop = job.stops.find((s) => s.farmerId === farmerId);
        if (stop) stop.taskIds.push(id);
        else job.stops.splice(input.route ? cheapestPosition(job.stops, farmerId, input.route) : job.stops.length, 0, { farmerId, taskIds: [id] });
    });
    return plan.target ? jobs.map((j) => (j.id === job.id ? job : j)) : [...jobs, job];
}

function newJob(id: string, jobNo: number, date: string, surveyorId: string, stops: JobStop[], now: string, by: string): Job {
    return { id, jobNo, date, surveyorId, status: JOB_STATUS.created, stops, history: [{ action: "create", at: now, by }], createdAt: now, updatedAt: now };
}

/* ------------------------------ Planner ------------------------------ */

export type UnplannedReason = "no-capacity" | "no-location" | "no-surveyor";

export interface PlannedJob {
    surveyorId: string;
    /** In visiting order. */
    stops: JobStop[];
    km?: number;
}

export interface JobPlan {
    jobs: PlannedJob[];
    /** Stops left out: they stay pending and come first in the next plan. */
    unplanned: { stop: JobStop; reason: UnplannedReason }[];
    /** Selected tasks that can't go on a job that day, or that an open job already holds. */
    skipped: { taskId: string; reason: SkipReason | "on-job" }[];
    /** Selected surveyors who already have an open job that day (not planned again). */
    busy: { surveyorId: string; job: Job }[];
}

export interface PlanInput {
    date: string;
    /** The surveyors HQ ticked. */
    surveyors: Surveyor[];
    tasks: Task[];
    /** The tasks HQ ticked. */
    taskIds: string[];
    jobs: Job[];
    farmers: Farmer[];
    villages: Village[];
    distance?: DistanceFn;
}

/**
 * Plan a day's jobs:
 *  1. one stop per farmer, covering all of that farmer's tasks due that day that no open job holds;
 *  2. most urgent stop first (earliest end date, then oldest planned start);
 *  3. each stop goes to the surveyor with visits left whose base village or stops so far are nearest (a surveyor
 *     with neither starts anywhere), so nearby farmers end up with the same surveyor;
 *  4. each job is ordered nearest-next from the base, then untangled (2-opt), as a round trip to the base;
 *  5. stops with no location, or no surveyor with visits left, are listed as unplanned.
 */
export function planJobs(input: PlanInput): JobPlan {
    const distance = input.distance ?? distanceKm;
    const held = openJobsByTask(input.jobs);
    const taskById = new Map(input.tasks.map((t) => [t.id, t]));
    const farmerById = new Map(input.farmers.map((f) => [f.id, f]));

    const skipped: JobPlan["skipped"] = [];
    const picked: Task[] = [];
    input.taskIds.forEach((id) => {
        const t = taskById.get(id);
        if (!t) return;
        const reason = held.has(id) ? "on-job" : skipReason(t, input.date, held);
        if (reason) skipped.push({ taskId: id, reason });
        else picked.push(t);
    });
    const { all } = withFarmersOtherTasks(picked, input.tasks, held, input.date);

    // Stops in priority order: the order of each farmer's most urgent task.
    const stops: { stop: JobStop; location?: LatLng }[] = [];
    all.forEach((t) => {
        const existing = stops.find((s) => s.stop.farmerId === t.farmerId);
        if (existing) existing.stop.taskIds.push(t.id);
        else stops.push({ stop: { farmerId: t.farmerId, taskIds: [t.id] }, location: stopLocation(farmerById.get(t.farmerId), input.villages) });
    });

    const busy = input.surveyors.flatMap((s) => {
        const job = openJobFor(input.jobs, s.id, input.date);
        return job ? [{ surveyorId: s.id, job }] : [];
    });
    const free = input.surveyors.filter((s) => s.active && !busy.some((b) => b.surveyorId === s.id));
    const base = new Map(free.map((s) => [s.id, input.villages.find((v) => v.id === s.baseVillageId)?.centre]));
    const allocated = new Map<string, { stop: JobStop; location: LatLng }[]>(free.map((s) => [s.id, []]));

    const unplanned: JobPlan["unplanned"] = [];
    stops.forEach(({ stop, location }) => {
        if (!location) return unplanned.push({ stop, reason: "no-location" });
        if (free.length === 0) return unplanned.push({ stop, reason: "no-surveyor" });
        const cost = (s: Surveyor) => {
            const points = [base.get(s.id), ...allocated.get(s.id)!.map((a) => a.location)].filter((p): p is LatLng => Boolean(p));
            return points.length === 0 ? 0 : Math.min(...points.map((p) => distance(p, location)));
        };
        const candidates = free.filter((s) => allocated.get(s.id)!.length < s.maxVisitsPerDay);
        if (candidates.length === 0) return unplanned.push({ stop, reason: "no-capacity" });
        const best = candidates.reduce((a, b) => {
            const d = cost(b) - cost(a);
            return d < -1e-9 || (Math.abs(d) <= 1e-9 && allocated.get(b.id)!.length < allocated.get(a.id)!.length) ? b : a;
        });
        allocated.get(best.id)!.push({ stop, location });
    });

    const jobs = free.flatMap((s) => {
        const list = allocated.get(s.id)!;
        if (list.length === 0) return [];
        const order = orderStops(list.map((a) => a.location), base.get(s.id), distance);
        return [{ surveyorId: s.id, stops: order.map((i) => list[i].stop), km: routeKm(order.map((i) => list[i].location), base.get(s.id), distance) }];
    });
    return { jobs, unplanned, skipped, busy };
}

/** Visiting order (indexes into `points`): nearest next from the base (or the first point), then 2-opt. */
export function orderStops(points: LatLng[], base: LatLng | undefined, distance: DistanceFn = distanceKm): number[] {
    const remaining = points.map((_, i) => i);
    let order: number[] = [];
    let at = base ?? points[0];
    while (remaining.length > 0) {
        let k = 0;
        remaining.forEach((idx, j) => {
            if (distance(at, points[idx]) < distance(at, points[remaining[k]]) - 1e-9) k = j;
        });
        const [next] = remaining.splice(k, 1);
        order.push(next);
        at = points[next];
    }
    const length = (o: number[]) => routeKm(o.map((i) => points[i]), base, distance) ?? 0;
    for (let improved = true; improved; ) {
        improved = false;
        for (let i = 0; i < order.length - 1; i++) {
            for (let k = i + 1; k < order.length; k++) {
                const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
                if (length(candidate) < length(order) - 1e-9) {
                    order = candidate;
                    improved = true;
                }
            }
        }
    }
    return order;
}

/** New created jobs from a plan (one per surveyor), numbered after the existing ones. */
export function jobsFromPlan(jobs: Job[], plan: JobPlan, date: string, newId: (i: number) => string, now: string): Job[] {
    const first = nextJobNo(jobs);
    return plan.jobs.map((p, i) => newJob(newId(i), first + i, date, p.surveyorId, p.stops, now, "Planner"));
}
