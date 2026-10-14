# Mati task orchestration engine (MVP)

No seed data: everything is created in the UI.

| URL | Page |
|---|---|
| `/web/` | **HQ Admin** — Survey Templates, Season Management |
| `/mobile/` | **Surveyor phone** — Task's (Pending / Completed), fill and submit, register farmers |

## HQ Admin

**Survey Templates** — one page per survey: questions (question, type, required, options; ⚙ for key, min, max, help text) and the survey's own **statuses**. The first status is set when a task is created, the second when the surveyor submits, the rest are set by the verifier. Season Management uses these statuses to trigger the next survey.

**Season Management** — season name, base, AZ, status, and the flow, top-down:

```
Start
└─ when the season starts → create task immediately
   [Registration]
   └─ when status of Registration = collected → create task immediately
      [Enrollment]
      └─ when status of Enrollment = approved → create task after 7 days, ends 31 Dec
         [Deployment]
```

Each "+ Next survey" asks for: the survey (search and pick), the status of the previous survey that triggers it, when to create the task (immediately / after N days / on a date) and an optional end date. **Start season** creates the Start tasks for every farmer of the season's AZ / base; a farmer registered later gets them too.

## Backend (Supabase Postgres)

`supabase/migrations/20261015000000_init.sql` — applied by the Supabase GitHub integration on every push to `main`.

| Table | Holds |
|---|---|
| `survey_template_master` | name, AZ, version, questions JSON, statuses |
| `season` | name, base, AZ, status |
| `farmer` | name, mobile, village, base, AZ |
| `season_flow` | one row per arrow: from survey (null = Start) → to survey, on_status, delay_days / start_date, end_date |
| `survey_response` | the task: type, template, season, farmer, planned start/end, response version, status, response JSON, created/updated by/at |
| `response_change_logs` | when, who, before, after, remarks |
| `comments` | when, who, comment |

Functions: `submit_response(task, answers, by, remarks)` and `set_status(task, status, by, comment)`. A status change follows every arrow whose `from` survey and `on_status` match and creates the next task.

## Run

```bash
npm install && npm test        # flow test in an in-process Postgres
npm run dev                    # http://localhost:3200/web/ and /mobile/
```
