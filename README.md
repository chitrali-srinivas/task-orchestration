# Mati lean — season orchestration on Supabase

Two static pages, one Postgres schema, no build step.

| URL | Who | What |
|---|---|---|
| `/web/` | Admin | Seasons, the **Flow** (rules), tasks with review (approve / report / discard), comments, change log, farmers, templates |
| `/mobile/` | Surveyor | Village filter, **Pending / Completed / Reported** tabs, fill and resubmit forms, register farmers |

The orchestration runs inside Postgres:

- `seasons.status → active` opens every `season_start` rule for every farmer in the AZ. A farmer added later gets the same.
- `tasks.status` changes fire the `form_status` rules: open the next form (immediately / after N days / on a date, with an optional close) or end the farmer's journey when a condition on the answers matches (e.g. `eligible eq no`).
- `submit_response(task, data, by, remarks)` stores the answers, bumps the response version and writes a field-level change log on corrections.
- `review_task(task, 'approved' | 'reported' | 'discarded', by, comment)` records the review and a comment.
- Nothing deletes a submission. Ending a journey only cancels tasks that were never submitted.

## Setup

1. Create a Supabase project. In **SQL Editor** run [supabase/schema.sql](supabase/schema.sql), then [supabase/seed.sql](supabase/seed.sql).
2. Put the project URL and anon key in [src/lib/config.js](src/lib/config.js), or paste them into the setup panel the pages show on first load (stored in the browser).
3. Serve `src/` from any static host. Locally:

```bash
npm run dev
```

Then open http://localhost:3200/web/ and http://localhost:3200/mobile/. To deploy, upload `src/` to Vercel / Netlify / Supabase Storage; the two URLs are `<host>/web/` and `<host>/mobile/`.

## Tests

The schema and the whiteboard flow (Registration → Enrollment → Deployment → Engagement/Sample, disqualification, corrections) run in an in-process Postgres:

```bash
npm install && npm test
```

## Not yet

Login (the anon key can read and edit everything), file/photo fields, a drawn flow canvas, offline mode. Add those on top; the schema does not need to change for the first three.
