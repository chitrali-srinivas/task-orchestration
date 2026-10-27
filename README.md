# Mati task orchestration engine (MVP)

No seed data: everything is created in the UI. All pages are in the Next.js app in `web/` (a copy of
[mati-carbon-demo](https://github.com/shashank-s73/mati-carbon-demo) with the HQ Admin pages added).

```bash
cd web && npm install && npx next dev -p 3100
```

## Environment

Copy `web/.env.example` to `web/.env.local` (git-ignored) and fill it in, then restart the dev server: `NEXT_PUBLIC_*` values are built into the browser bundle.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **Required for maps**: the Task planning job map (also the Deployment and Map view pages). In Google Cloud, enable the **Maps JavaScript API** for the key and restrict it to your site addresses (`http://localhost:3100/*`, the Cloud Run URL). Without it the map panel says how to set it; lists, distances and effort still work. |
| `GOOGLE_ROUTES_API_KEY` | **Road routes** in the job workspace: road line, road km and drive minutes per leg (Google Routes API `computeRoutes`, driving, no traffic). **Server-only** (no `NEXT_PUBLIC_` prefix): only `src/app/api/routes/compute/route.ts` reads it, so it never reaches the browser. Enable the **Routes API** and restrict the key to it. Without it the workspace shows straight lines and estimated drive times. |

Road routes are fetched once per stop sequence and cached in the browser (`mati.roadRoutes`), so browsing jobs doesn't call Google again; the planner itself still allocates and orders stops on straight-line distances. The `/api/routes/compute` endpoint is open to anyone who can reach the app, so put the deployed app behind sign-in (or add rate limits) before sharing it widely, or the Routes key can be spent by others.

| URL | Page |
|---|---|
| `/layouts/survey-builder/v1-0` | **Survey Builder** — the original builder, simplified; a survey has **statuses** (default `planned, collected, verified, expired, cancelled`) |
| `/layouts/survey-workflow` | **Survey Workflow** — one per season: which survey follows which, on what status, when its task is created, and for how long it is valid |
| `/layouts/tasks` | **Tasks** — HQ summary of every task: id, survey template, farmer, status, job, assigned surveyor and visit date, planned start/end, what created it; Plan these / Add to job / Verify / Cancel |
| `/layouts/task-planning` | **Task planning** — jobs (one surveyor's visits for one day): Plan jobs (pick the day, active surveyors and farmers; the planner allocates and orders the stops); the full-screen job workspace (Google map in the middle with numbered stops and each leg's distance / drive time; the route's tasks as a rim beside it; on the right the route info and actions: change surveyor or rearrange with a preview of the change in distance, add tasks by id / farmer or from the map, move a task to another surveyor, remove); Assign, follow progress, close job sheets |
| `/phone` | **Phone simulator** — the surveyor app: register a farmer (fills the first survey), do pending tasks; pick a surveyor to accept / decline, start and close their jobs |
| `/layouts/masters` | **Masters** — Supplier info and Fleet records used by "Master data" questions; Villages and Surveyors used for jobs |

Storage is the browser's localStorage for now (`mati.surveys`, `mati.workflows`, `mati.masters`, `mati.farmers`, `mati.tasks`, `mati.jobs`, `mati.sim`). Swapping it for Supabase only touches `web/src/lib/orchestration/store.ts` and the per-page loaders.

## Deploy (Cloud Run)

The repository root has a `Dockerfile` that builds the Next.js app in `web/` (standalone output, listens on `$PORT`, default 8080). Point Cloud Run's "deploy from repository" at the repo root with the Dockerfile build type, or:

```bash
gcloud run deploy task-orchestration --source . --region <region> --allow-unauthenticated
```

Without Supabase variables the deployed app is the browser-only demo (data per browser).

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must be present **when the image is built** (it's baked into the browser bundle); the Dockerfile takes it as a build argument. With Docker:

```bash
docker build --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key> -t <region>-docker.pkg.dev/<project>/<repo>/task-orchestration .
docker push <region>-docker.pkg.dev/<project>/<repo>/task-orchestration
gcloud run deploy task-orchestration --image <region>-docker.pkg.dev/<project>/<repo>/task-orchestration --region <region> --allow-unauthenticated
```

With Cloud Run's "deploy from repository", add the key as a Docker build argument in the build trigger. Setting it only as a runtime variable on the service has no effect.

`GOOGLE_ROUTES_API_KEY` is the opposite: it's read by the server at request time, so set it on the Cloud Run **service** (ideally from Secret Manager), not as a build argument:

```bash
gcloud run services update task-orchestration --region <region> --set-secrets GOOGLE_ROUTES_API_KEY=<secret-name>:latest
```

## Orchestration framework

```
Survey Builder ──► survey templates (questions + statuses)
Survey Workflow ─► steps: Start → Survey A ─(status S, trigger, validity)─► Survey B … → End
Phone / HQ ──────► status changes on tasks
                        │
                        ▼
          engine.nextTasks(workflow, task, existing, today)   ← pure, deterministic
                        │
                        ▼
                 new planned tasks ──► phone (when plannedStart ≤ today)
```

- **`web/src/lib/orchestration/engine.ts`** — pure functions, no clock/storage: `rootTasks` (registration), `nextTasks` (follow the arrows whose `onStatus` matches the task's new status; idempotent per farmer+step; End creates nothing), `expireTasks` (planned + past validity → expired), `isPendingOnApp` (planned and started). Tests: `node --test src/lib/orchestration/engine.test.ts`.
- **`web/src/lib/orchestration/jobs.ts`** — pure, like the engine: jobs, their lifecycle and the planner. `planJobs` (allocate and order a day's stops across the chosen surveyors), `jobsFromPlan`, `applyJobAction` (assign / unassign / accept / decline / start / close, with the allowed moves), stop edits (`reorderStop`, `moveStop`, `removeStop`, `deleteJob`), `planAddToJob` / `addToJob` / `removeTasks`, `openJobsByTask`, `stopLocation`, `distanceKm`, `routeKm`. Distances are straight-line; a routing service's road distances plug in through the `distance` parameter. Tests: `node --test src/lib/orchestration/jobs.test.ts`.
- **`web/src/lib/orchestration/store.ts`** — the only place that reads the clock and storage: `registerFarmer`, `submitTask` (also starts an accepted job), `changeStatus`, `refreshTasks`, `createPlannedJobs`, `jobAction`, `addTasksToJob`, `removeTasksFromJobs` and the stop edits. Phase-1 routes in `mati.routes` are converted to jobs on first load.
- **Task** = one survey for one farmer: `T<n>`, workflow step, survey template, farmer, status, planned start/end, parent task, response.
- **Trigger** → planned start: immediately = the day the condition was met; after n days; on a date; or n days after a **date answered in the previous survey** (e.g. sowing date + 30; falls back to the condition day if unanswered). A validity start later than that wins; validity end expires the task.
- **Registration** = filling the workflow's first survey on the phone, nothing else. The farmer's name and village are read from its answers (questions whose column name or title says "name" / "village"; otherwise the first text answer is the name), and their location from the first Map answer, else the first plot boundary's centre.
- **Job** = one surveyor's visits for one day: one stop per farmer, covering all of that farmer's tasks due that day. Assignment is not a task status; "Job", "Assigned to" and "Visit date" on Tasks are read from the jobs, and a task is on one open job at most. A stop is visited at the farmer's registration location, else the village centre from the Villages master (matched by name).
- **Job lifecycle** = created (by the planner or HQ; HQ can reorder, move, remove and add stops, or delete it) → assigned (HQ; on the surveyor's phone; HQ can pull it back) → accepted (surveyor; stops locked) → in progress (surveyor taps Start, or submits the first task) → job sheet closed (surveyor at the end of the day, or HQ). Declining (with a reason) sends it back to created. Closing needs a reason for every stop with tasks still planned; those tasks are released and come first in the next plan.
- **Job workspace** = a job opened on Task planning, full screen like the Deployment map view: the map in the middle (numbered stops, the road route from the Google Routes API with each leg labelled with road distance and drive time, or straight lines and estimates without a Routes key; a legend; the day's unassigned tasks as grey pins to add), the route as a rim beside it (base → stops → base with the km and minutes between each pair of nodes; tasks of one farmer share a number), and on the right the route info (distance, drive, on site, day effort: 25 km/h straight-line plus 20 minutes per task, `EFFORT` in jobs.ts) and the actions. Changing the surveyor or rearranging the stops (or taking the shortest order) first shows the change in distance and time, then saves. Added tasks go where they add the least distance; a task can move to another surveyor's job that day (or a new job) or be removed. All of this only until the surveyor accepts.
- **Planner** = for a day: one stop per farmer; most urgent first (earliest end date, then oldest planned start); each stop to the surveyor with visits left whose base village or stops so far are nearest; each job ordered nearest-next from the base, then untangled (2-opt), as a round trip; stops without a location or capacity are listed as unplanned. Surveyors who already have an open job that day are skipped.
- **Today** is a simulated date, set on the phone simulator (the Tasks page has no date selection), so day-based triggers and expiry can be tried by hand.

## Open points

1. **Sampling trigger: a step that runs for only a percentage of the previous step's farmers** (raised 2026-10-26).
   Today every arrow is one-to-one: when a farmer's task reaches status S, that farmer gets the next task (immediately, after n days, on a date, or n days after an answered date, within a validity window). Some surveys must instead run on a **random sample** of everyone who completed the previous step(s), e.g. Engagement 1 done for 100 farmers → Engagement 2 for only x% of them, measured by **farmers, acres or weight** (tonnes deployed).
   This is a population-level rule, so it can't be decided when one task changes status the way today's triggers are. To decide:
   - **When the sample is drawn:** when HQ presses "Draw sample", on a date, when the previous step's validity ends, or after n completions. Or per completion with probability x% (simple, but the actual share drifts: 10% of 100 can come out as 7 or 14).
   - **Basis:** farmer count, or the sum of a Number answer in the previous survey (acres enrolled, tonnes deployed). The step points at that question, like the "date answered" trigger does. For acres and weight: pick farmers at random until the selected total reaches x% of the population total.
   - **Scope:** x% overall, or per village / AZ / base, with a minimum per group?
   - **Farmers who complete the previous step after the draw:** a second draw, or excluded?
   - **Farmers not selected:** the branch simply ends for them, or they follow another arrow?
   - **Audit:** the engine stays pure: draws use a seeded random generator, and the seed, the population snapshot and the selected farmers are stored. Anyone can then re-run the draw and check that the selection was random.
2. **Route planning and surveyor assignment of pending tasks** (proposal drafted 2026-10-26; phase 1 built 2026-10-26; phase 2 built 2026-10-27 as Task planning).
   Pending tasks become a daily visit plan per surveyor: one stop per farmer visit. Oldest first (and closest to expiry) decides what goes into the day's plan, and location decides the visiting order. Assignment is a separate job record, not a task status. Planner: rule-based and in-browser first (straight-line distances, capacity, village coverage), replaceable later by a routing service.
   - **Phase 1 (built): data and manual assignment.** Surveyors and Villages masters; farmer location from registration; the Route record; Assign from the Tasks table (ticked rows or the detail sheet); the phone shows the picked surveyor's route for today, then pending tasks on no route. Defaults used: assign per farmer visit; anyone covers any village; at most 8 visits a day unless the surveyor's master says otherwise; stops in the order assigned, most urgent first; the phone shows the route first and other unassigned pending tasks below. Tasks still planned after their visit day show "Missed" and are reassigned by hand.
   - **Phase 2 (built): Task planning.** Routes became jobs with a lifecycle (job created → assigned → accepted → in progress → job sheet closed); the planner allocates a day's stops across the surveyors HQ picks; the Task planning page shows jobs with a map (Esri imagery, straight lines), stop editing, Assign, and the timeline; the phone accepts / declines, starts and closes job sheets; Tasks gets a Job column, Plan these and Add to job. Defaults used: a created job already has a surveyor; surveyors can decline with a reason; the surveyor closes the job sheet (HQ can too), with a reason per unfinished stop; one day per plan; anyone covers any village, nearest surveyor first, a maximum number of visits per day.
   - **Phase 3: production** (server or routing service, road distances, arrival times, automatic carry-over, progress).
   Still to decide: fixed village or base coverage per surveyor; daily capacity as visits or working hours; planning a week ahead; whether the registration survey must capture a GPS point; the planner allocating and ordering on road distances (Routes API route matrix) instead of straight lines; traffic-aware times for the job's day; minutes on site per survey template instead of one 20-minute default; sign-in or rate limits in front of `/api/routes/compute` when deployed.

## Legacy (`src/`, Supabase)

`src/web`, `src/mobile` and `supabase/migrations` are the earlier static prototype with the in-database version of the same rules (`season_flow`, `survey_response`, `submit_response`, `set_status`). Run with `npm run dev` (port 3200); `npm test` runs its flow test in an in-process Postgres.
