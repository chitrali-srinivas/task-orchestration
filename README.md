# Mati task orchestration engine (MVP)

No seed data: everything is created in the UI. All pages are in the Next.js app in `web/` (started from
[mati-carbon-demo](https://github.com/shashank-s73/mati-carbon-demo), now trimmed to the pages in the sidebar).

```bash
cd web && npm install && npx next dev -p 3100
```

## Environment

Copy `web/.env.example` to `web/.env.local` (git-ignored) and fill it in, then restart the dev server: `NEXT_PUBLIC_*` values are built into the browser bundle.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **Required for maps**: the job map on Plans and the location picker on the Masters pages (users' homes, village centres). In Google Cloud, enable the **Maps JavaScript API** for the key and restrict it to your site addresses (`http://localhost:3100/*`, the Cloud Run URL). Without it the map panel says how to set it; lists, distances and effort still work. |
| `GOOGLE_ROUTES_API_KEY` | **Road routes** in the job workspace: road line, road km and drive minutes per leg (Google Routes API `computeRoutes`, driving, no traffic). **Server-only** (no `NEXT_PUBLIC_` prefix): only `src/app/api/routes/compute/route.ts` reads it, so it never reaches the browser. Enable the **Routes API** and restrict the key to it. Without it the workspace shows straight lines and estimated drive times. |

Road routes are fetched once per stop sequence and cached in the browser (`mati.roadRoutes`), so browsing jobs doesn't call Google again; the planner itself still allocates and orders stops on straight-line distances. The `/api/routes/compute` endpoint is open to anyone who can reach the app, so put the deployed app behind sign-in (or add rate limits) before sharing it widely, or the Routes key can be spent by others.

`/` opens Season management. The sidebar has Dashboard, then four sections: **Verification** (Farmers, Tasks, Plans), **Science** (Samples, Carts, Tests, Shipments), **Admin** (Season Management and one page per master) and **Super Admin** (Survey Builder, Survey Workflow, Phone simulator). Dashboard and the Science items are placeholders until those pages are built. The other demo pages that came with mati-carbon-demo were removed (they're in git history).

| URL | Page |
|---|---|
| `/layouts/farmers` | **Farmers** — every farmer registered on the phone, with **status tabs** (Registered, NOC received, Verified, Blacklisted): status, village, where planning finds them (plot centre, GPS point from older surveys, village centre or no location), date registered, tasks by status and next visit. The detail sheet has the status actions the current role may take (Mark NOC received and Verify: Verifier and up; Blacklist and Lift blacklist, with a reason: Admin and up), the status history, the registration answers and all of the farmer's tasks |
| `/layouts/tasks` | **Tasks** — HQ summary of every task: id, survey template, farmer, status, job, assigned surveyor and visit date, planned start/end, what created it; Plan these / Add to job / Verify / Cancel (`?task=<id>` opens one) |
| `/layouts/plans` | **Plans** (was Task planning; `/layouts/task-planning` redirects here) — jobs (one surveyor's visits for one day): Plan jobs (pick the day, active surveyors and farmers; the planner allocates and orders the stops); the full-screen job workspace (Google map in the middle with numbered stops and each leg's distance / drive time; the route's tasks as a numbered list; surveyor change, rearrange, add and remove on the right) |
| `/layouts/season-management` | **Season management** — seasons table with timeline, filters and a detail sheet (mock data) |
| `/layouts/masters/<id>` | **Masters** — one page each: `villages` (centre picked on a map, radius), `users` (name, phone, one role: Surveyor, Verifier, Admin or Super Admin; home location picked on a map, required for surveyors; base village and max visits per day for surveyors), `fleet`, `drivers` (licence, supplier, vehicle) and `suppliers`. Used by "Master data" questions; villages and Surveyor users also feed Plans. `/layouts/masters` opens Villages |
| `/layouts/survey-builder/v1-0` | **Survey Builder** — the original builder, simplified; a survey has a **category** and **statuses** (default `planned, collected, verified, expired, cancelled`). It opens with the **production questionnaire** loaded (see below): 77 surveys under their production ids. Questions can only be of the **27 types the field app renders** (the 5 newer ones included: Time, Mobile Number, Natural Number 1–200, Decimal up to 1,000,000 and 10,000,000); Dropdown, Number, Date, DateRange and PolygonBoundary are no longer offered. The Advanced tab shows each question's production JSON, and the survey menu exports the survey as production JSON. Production's **Farmer_Registration** is built in: only a **Super Admin** can edit it, and its three **system fields** (`farmer_name`, `village_name`, plus a locked `plot_location` GPS point after the village) can't be deleted, duplicated, retyped, made optional, hidden by logic or put in a repeater |
| `/layouts/survey-workflow` | **Survey Workflow** — one per season: which survey follows which, on what status, when its task is created, and for how long it is valid. **Start** says which farmer status starts the workflow for a farmer (Verified by default; Registered or NOC received also possible); only **active** workflows start. Registration is not a step |
| `/phone` | **Phone simulator** — the surveyor app: register a farmer (fills the built-in Farmer Registration survey; the farmer starts as Registered), do pending tasks; pick a surveyor to accept / decline, start and close their jobs. A survey can't be submitted while a required question on show is unanswered |
| `/layouts/release-notes` | **Release notes** — opened from the version (`v1.2.4`) in the page footer; the version and notes live in `web/src/lib/release-notes.ts` (add each release at the top) |

The old Surveyors master moved into Users: on first load its records become Surveyor users with the same ids, so jobs keep their surveyor.

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

## Production questionnaire

`web/src/app/layouts/survey-builder/data/questionnaire.prod.json` is the field app's questionnaire (an export of its questionnaire table): 11 questionnaire rows, the 66 task surveys inside the Farmer_Registration row (one per AZ and stage: plot enrollment, dispatch, sampling, NoC, engagement…), 873 questions. `lib/production-contract.ts` reads and writes that format; `lib/production-seed.ts` adds every survey to the browser's survey store on first use (surveys already there are left as they are, a newer file only adds what's new).

The contract, as the file shows it: every question has the same 28 fields; `Qn_Num` is the position and `Qn_In` the label (a child is its parent's label + `.k`); show-if is `Is_Cond` + `Parent_Dep` + `Opt_Dep` (the parent's option **indexes**) on the child and `Qn_Deps` (child numbers) on the parent; repeaters use `Repeater`, `Qn_Repeat` and `Parent_Repeat`; yes/no fields are booleans; `Qn_Disp_Value` is the type's display name; `Min_Char`/`Max_Char` are length limits or, for number types, the value range. Survey ids (row id or `qID`), tables, AZ and group fields are carried through unchanged, since the app picks how to render a survey by its id. `lib/production-contract.test.ts` exports the whole file again and checks it equals the original, question by question.

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

- **`web/src/lib/orchestration/engine.ts`** — pure functions, no clock/storage: farmer statuses (`applyFarmerAction`, `reachedStatus`), `workflowStartTasks` (first-step tasks for farmers who reached each active workflow's start status; idempotent), `rootTasks`, `nextTasks` (follow the arrows whose `onStatus` matches the task's new status; idempotent per subject+step; End creates nothing), `expireTasks` (planned + past validity → expired), `isPendingOnApp` (planned and started). Tests: `node --test src/lib/orchestration/*.test.ts`.
- **`web/src/lib/orchestration/jobs.ts`** — pure, like the engine: jobs, their lifecycle and the planner. `planJobs` (allocate and order a day's stops across the chosen surveyors), `jobsFromPlan`, `applyJobAction` (assign / unassign / accept / decline / start / close, with the allowed moves), stop edits (`reorderStop`, `moveStop`, `removeStop`, `deleteJob`), `planAddToJob` / `addToJob` / `removeTasks`, `openJobsByTask`, `stopLocation`, `distanceKm`, `routeKm`. Distances are straight-line; a routing service's road distances plug in through the `distance` parameter. Tests: `node --test src/lib/orchestration/jobs.test.ts`.
- **`web/src/lib/orchestration/store.ts`** — the only place that reads the clock and storage: `registerFarmer`, `submitTask` (also starts an accepted job), `changeStatus`, `refreshTasks`, `createPlannedJobs`, `jobAction`, `addTasksToJob`, `removeTasksFromJobs` and the stop edits. Phase-1 routes in `mati.routes` are converted to jobs on first load.
- **Task** = one survey about one **subject**: `T<n>`, workflow step, survey template, subject, status, planned start/end, parent task, response. The subject is `{ kind: "farmer", id }` today; other kinds (village, sample, cart, shipment, place) can be added so non-farmer tasks can be planned, without changing tasks or jobs (job stops are per subject too). Tasks and jobs saved with `farmerId` are converted on load.
- **Farmer status** (fixed in code) = Registered → NOC received → Verified, or Blacklisted from any of them. Blacklisting cancels the farmer's planned tasks (and takes them off jobs not yet accepted) and stops new tasks; lifting it returns the farmer to the status they had. Every change is kept in the farmer's history.
- **Roles** = Surveyor, Verifier, Admin, Super Admin (as in Masters - Users), picked under "Signed in as" in the user menu until sign-in exists (`lib/current-role.ts`, kept in the browser). They decide what the screens allow; they aren't security.
- **Trigger** → planned start: immediately = the day the condition was met; after n days; on a date; or n days after a **date answered in the previous survey** (e.g. sowing date + 30; falls back to the condition day if unanswered). A validity start later than that wins; validity end expires the task.
- **Registration** = filling the built-in registration survey (production's Farmer_Registration) on the phone, outside any workflow. The answers are kept on the farmer, who starts as Registered; a workflow starts for them when they reach its start status. The farmer's name, village and location are read from its system fields (`systemKey` `farmer.name` → `farmer_name`, `farmer.village` → `village_name`, `farmer.plot` → `plot_location`; see `web/src/app/layouts/survey-builder/lib/system-fields.ts`). The location is the plot's GPS point (a drawn plot boundary would give its centre). Older surveys without system fields fall back to a guess: questions whose column name or title says "name" / "village" (otherwise the first text answer is the name), and the first plot boundary's centre, else the first Map (GPS) answer.
- **Job** = one surveyor's visits for one day: one stop per farmer, covering all of that farmer's tasks due that day. Assignment is not a task status; "Job", "Assigned to" and "Visit date" on Tasks are read from the jobs, and a task is on one open job at most. A stop is visited at the farmer's registration location, else the village centre from the Villages master (matched by name).
- **Job lifecycle** = created (by the planner or HQ; HQ can reorder, move, remove and add stops, or delete it) → assigned (HQ; on the surveyor's phone; HQ can pull it back) → accepted (surveyor; stops locked) → in progress (surveyor taps Start, or submits the first task) → job sheet closed (surveyor at the end of the day, or HQ). Declining (with a reason) sends it back to created. Closing needs a reason for every stop with tasks still planned; those tasks are released and come first in the next plan.
- **Job workspace** = a job opened on Plans, full screen like the Deployment map view: the map in the middle (numbered stops, the road route from the Google Routes API with each leg labelled with road distance and drive time, or straight lines and estimates without a Routes key; a legend; the day's unassigned tasks as grey pins to add), the route as a rim beside it (base → stops → base with the km and minutes between each pair of nodes; tasks of one farmer share a number), and on the right the route info (distance, drive, on site, day effort: 25 km/h straight-line plus 20 minutes per task, `EFFORT` in jobs.ts) and the actions. Changing the surveyor or rearranging the stops (or taking the shortest order) first shows the change in distance and time, then saves. Added tasks go where they add the least distance; a task can move to another surveyor's job that day (or a new job) or be removed. All of this only until the surveyor accepts.
- **Planner** = for a day: one stop per farmer; most urgent first (earliest end date, then oldest planned start); each stop to the surveyor with visits left whose start or stops so far are nearest; each job ordered nearest-next from the start, then untangled (2-opt), as a round trip back to it. A surveyor's day starts and ends at **home** when the Users master has it, otherwise at their base village centre (`dayStart`); road routes, walking and effort use the same point; stops without a location or capacity are listed as unplanned. Surveyors who already have an open job that day are skipped.
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
   Still to decide: fixed village or base coverage per surveyor; daily capacity as visits or working hours; planning a week ahead; the planner allocating and ordering on road distances (Routes API route matrix) instead of straight lines; traffic-aware times for the job's day; minutes on site per survey template instead of one 20-minute default; sign-in or rate limits in front of `/api/routes/compute` when deployed.

## Legacy (`src/`, Supabase)

`src/web`, `src/mobile` and `supabase/migrations` are the earlier static prototype with the in-database version of the same rules (`season_flow`, `survey_response`, `submit_response`, `set_status`). Run with `npm run dev` (port 3200); `npm test` runs its flow test in an in-process Postgres.
