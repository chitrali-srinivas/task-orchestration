# Mati task orchestration engine

Built from the whiteboard: admin configures a season's flow, the backend creates tasks, the surveyor phone shows them.

| URL | Page |
|---|---|
| `/web/` | **Admin** — Survey Template List, season (name, country), the Flow as arrows (From → To, Status, Trigger, Validity), Survey Responses with verification, comments and change logs |
| `/mobile/` | **Surveyor phone** — Task's: Pending / Completed / Reported, fill a form, submit |

## Backend (Supabase Postgres)

`supabase/migrations/20261015000000_init.sql`:

| Table | As drawn |
|---|---|
| `survey_template_master` | id, AZ id, version, created/updated at, survey details JSON |
| `season` | name, country, AZ, base, start, end, status |
| `season_flow` | one row per arrow: from → to, **Status** that fires it, **Trigger** (immediately / date), **Validity** (indefinite / start–end) |
| `survey_response` | task id, task type, template id, planned start/end, response version, status, created/updated by/at, response JSON |
| `response_change_logs` | task id, when, who, before, after, remarks |
| `comments` | task id, when, who, comment |

Task status: `planned → pending verification → verified / algo verified → completed`, or `discarded` / `cancelled`.

How tasks are created:
- Season set to **active** → every `Start → X` arrow creates task X for each farmer in the AZ. A farmer added later is allocated to the active season and gets the same.
- A task reaches the arrow's **Status** → the next task is created: planned start = today or the trigger date; planned end = the validity end date or none.
- An arrow to **End** cancels the farmer's remaining planned tasks.

Phone tabs: Pending = `planned`; Completed = submitted or verified; Reported = `discarded` (verifier sent it back — the surveyor resubmits).

## Run

Migrations are applied by the Supabase GitHub integration on every push to `main`. Locally:

```bash
npm install && npm test        # flow test in an in-process Postgres
npm run dev                    # http://localhost:3200/web/ and /mobile/
```
