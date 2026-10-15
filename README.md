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
| `/layouts/tasks` | **Tasks** — HQ summary of every task: id, survey template, farmer, status, planned start/end, what created it; Verify / Cancel |
| `/phone` | **Phone simulator** — the surveyor app: register a farmer (fills the first survey), do pending tasks |
| `/layouts/masters` | **Masters** — Supplier info and Fleet master records used by "Master data" questions |

Storage is the browser's localStorage for now (`mati.surveys`, `mati.workflows`, `mati.masters`, `mati.farmers`, `mati.tasks`, `mati.sim`). Swapping it for Supabase only touches `web/src/lib/orchestration/store.ts` and the per-page loaders.

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
- **`web/src/lib/orchestration/store.ts`** — the only place that reads the clock and storage: `registerFarmer`, `submitTask`, `changeStatus`, `refreshTasks`.
- **Task** = one survey for one farmer: `T<n>`, workflow step, survey template, farmer, status, planned start/end, parent task, response.
- **Trigger** → planned start: immediately = the day the condition was met; after n days; on a date. A validity start later than that wins; validity end expires the task.
- **Today** is a simulated date (shared by the phone and the task summary) so day-based triggers and expiry can be tried by hand.

## Legacy (`src/`, Supabase)

`src/web`, `src/mobile` and `supabase/migrations` are the earlier static prototype with the in-database version of the same rules (`season_flow`, `survey_response`, `submit_response`, `set_status`). Run with `npm run dev` (port 3200); `npm test` runs its flow test in an in-process Postgres.
