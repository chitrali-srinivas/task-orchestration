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

## Storage: browser demo or Supabase

All stores go through `web/src/lib/backend` (a write-through cache). The mode is chosen by environment:

| Mode | When | Where data lives |
|---|---|---|
| **local** (default) | no Supabase variables | the browser's localStorage, per browser (`mati.surveys`, `mati.workflows`, `mati.masters`, `mati.farmers`, `mati.tasks`, `mati.sim`) |
| **supabase** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (see `web/.env.local.example`) | Postgres tables `wf_survey_template`, `wf_master_record`, `wf_workflow`, `wf_farmer`, `wf_task`, `wf_setting` |

To use Supabase: run `supabase/migrations/20261015120000_web_backend.sql` on the project (SQL editor, or `supabase db push`), copy `web/.env.local.example` to `web/.env.local`, restart. For Cloud Run pass the two values as build args (`--build-arg`) or substitutions. Pages call `ready()` once, which loads every table into memory; every save upserts the changed rows and deletes removed ones in the background. The orchestration engine still runs in the browser that triggers the status change; moving it server-side (a Postgres trigger or an API route) is the next step. Access is "demo all" for the anon key until login exists.

`node scripts/test-web-backend.mjs` applies the migration to an in-process Postgres and round-trips a row per table.

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
- **`web/src/lib/orchestration/store.ts`** — the only place that reads the clock and storage: `registerFarmer`, `submitTask`, `changeStatus`, `refreshTasks`.
- **Task** = one survey for one farmer: `T<n>`, workflow step, survey template, farmer, status, planned start/end, parent task, response.
- **Trigger** → planned start: immediately = the day the condition was met; after n days; on a date; or n days after a **date answered in the previous survey** (e.g. sowing date + 30; falls back to the condition day if unanswered). A validity start later than that wins; validity end expires the task.
- **Registration** = filling the workflow's first survey on the phone, nothing else. The farmer's name and village are read from its answers (questions whose column name or title says "name" / "village"; otherwise the first text answer is the name).
- **Today** is a simulated date (shared by the phone and the task summary) so day-based triggers and expiry can be tried by hand.

## Legacy (`src/`, Supabase)

`src/web`, `src/mobile` and `supabase/migrations` are the earlier static prototype with the in-database version of the same rules (`season_flow`, `survey_response`, `submit_response`, `set_status`). Run with `npm run dev` (port 3200); `npm test` runs its flow test in an in-process Postgres.
