# Mati task orchestration engine (MVP)

No seed data: everything is created in the UI. All pages are in the Next.js app in `web/` (a copy of
[mati-carbon-demo](https://github.com/shashank-s73/mati-carbon-demo) with the HQ Admin pages added).

```bash
cd web && npm install && npx next dev -p 3100
```

| URL | Page |
|---|---|
| `/layouts/survey-builder/v1-0` | **Survey Builder** — the original builder, simplified; a survey has **statuses** (default `planned, collected, verified, expired, cancelled`) |
| `/layouts/survey-workflow` | **Survey Workflow** — one per season: which survey follows which, on what status, when its task is created, and for how long it is valid |
| `/layouts/tasks` | **Tasks** — HQ summary of every task: id, survey template, farmer, status, assigned surveyor and visit date, planned start/end, what created it; Assign / Verify / Cancel |
| `/phone` | **Phone simulator** — the surveyor app: register a farmer (fills the first survey), do pending tasks; pick a surveyor to see their route for today |
| `/layouts/masters` | **Masters** — Supplier info and Fleet records used by "Master data" questions; Villages and Surveyors used for routes |

Storage is the browser's localStorage for now (`mati.surveys`, `mati.workflows`, `mati.masters`, `mati.farmers`, `mati.tasks`, `mati.routes`, `mati.sim`). Swapping it for Supabase only touches `web/src/lib/orchestration/store.ts` and the per-page loaders.

## Deploy (Cloud Run)

The repository root has a `Dockerfile` that builds the Next.js app in `web/` (standalone output, listens on `$PORT`, default 8080). Point Cloud Run's "deploy from repository" at the repo root with the Dockerfile build type, or:

```bash
gcloud run deploy task-orchestration --source . --region <region> --allow-unauthenticated
```

Without Supabase variables the deployed app is the browser-only demo (data per browser).

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
- **`web/src/lib/orchestration/routes.ts`** — pure, like the engine: who visits which farmers on which day. `planAssignment` (what assigning would do: visits against capacity, the same farmers' other due tasks, moves, tasks that can't go that day), `assignTasks`, `unassignTasks`, `assignmentsByTask`, `stopLocation`, `distanceKm`. Tests: `node --test src/lib/orchestration/routes.test.ts`.
- **`web/src/lib/orchestration/store.ts`** — the only place that reads the clock and storage: `registerFarmer`, `submitTask`, `changeStatus`, `refreshTasks`, `assignToRoute`, `removeFromRoute`.
- **Task** = one survey for one farmer: `T<n>`, workflow step, survey template, farmer, status, planned start/end, parent task, response.
- **Trigger** → planned start: immediately = the day the condition was met; after n days; on a date; or n days after a **date answered in the previous survey** (e.g. sowing date + 30; falls back to the condition day if unanswered). A validity start later than that wins; validity end expires the task.
- **Registration** = filling the workflow's first survey on the phone, nothing else. The farmer's name and village are read from its answers (questions whose column name or title says "name" / "village"; otherwise the first text answer is the name), and their location from the first Map answer, else the first plot boundary's centre.
- **Route** = one surveyor's visits for one day, published when HQ assigns: one stop per farmer, covering all of that farmer's tasks due that day. Assignment is not a task status; "Assigned to" and "Visit date" on Tasks are read from the routes. A stop is visited at the farmer's registration location, else the village centre from the Villages master (matched by name). A task can be on one route at a time; reassigning moves it.
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
2. **Route planning and surveyor assignment of pending tasks** (proposal drafted 2026-10-26; phase 1 built 2026-10-26).
   Pending tasks become a daily visit plan per surveyor: one stop per farmer visit. Oldest first (and closest to expiry) decides what goes into the day's plan, and location decides the visiting order. Assignment is a separate route record, not a task status. Planner: rule-based and in-browser first (straight-line distances, capacity, village coverage), replaceable later by a routing service.
   - **Phase 1 (built): data and manual assignment.** Surveyors and Villages masters; farmer location from registration; the Route record; Assign from the Tasks table (ticked rows or the detail sheet); the phone shows the picked surveyor's route for today, then pending tasks on no route. Defaults used: assign per farmer visit; anyone covers any village; at most 8 visits a day unless the surveyor's master says otherwise; stops in the order assigned, most urgent first; the phone shows the route first and other unassigned pending tasks below. Tasks still planned after their visit day show "Missed" and are reassigned by hand.
   - **Phase 2: automatic planner and Route planning page** (draft routes, map, reorder / move / remove stops, publish).
   - **Phase 3: production** (server or routing service, road distances, arrival times, automatic carry-over, progress).
   Still to decide before phase 2: fixed village or base coverage per surveyor; daily capacity as visits or working hours; planning one day or a week ahead; whether the registration survey must capture a GPS point.

## Legacy (`src/`, Supabase)

`src/web`, `src/mobile` and `supabase/migrations` are the earlier static prototype with the in-database version of the same rules (`season_flow`, `survey_response`, `submit_response`, `set_status`). Run with `npm run dev` (port 3200); `npm test` runs its flow test in an in-process Postgres.
