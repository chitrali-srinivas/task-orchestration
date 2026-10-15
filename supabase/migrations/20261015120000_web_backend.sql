-- Backend for the Next.js app (web/): survey templates, masters, workflows, farmers, tasks.
-- One table per collection; the full object the app works with is kept in `data` (jsonb) and
-- the columns that matter for querying are copied out of it. Ids are assigned by the app so the
-- same objects work in the browser-only demo and against Postgres.
-- Prefixed wf_ so they do not clash with the earlier prototype's tables (farmer, season, …).

create table if not exists wf_survey_template (
  id         text primary key,
  name       text not null,
  status     text not null default 'Draft',           -- Draft | Published | Archived (builder status)
  data       jsonb not null,                           -- SurveyModel (questions, statuses, locales, …)
  updated_at timestamptz not null default now()
);

create table if not exists wf_master_record (
  id         text primary key,
  set_id     text not null,                            -- suppliers | fleet
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists wf_master_record_set on wf_master_record (set_id);

create table if not exists wf_workflow (
  id         text primary key,
  name       text not null,
  country    text,
  status     text not null default 'draft',            -- draft | active | completed
  data       jsonb not null,                           -- Workflow incl. steps[]
  updated_at timestamptz not null default now()
);

create table if not exists wf_farmer (
  id         text primary key,
  name       text not null,
  village    text,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists wf_task (
  id             text primary key,
  task_no        bigint not null,
  workflow_id    text references wf_workflow (id),
  step_id        text,
  survey_id      text,
  farmer_id      text references wf_farmer (id),
  status         text not null,                        -- planned | collected | verified | expired | cancelled | …
  planned_start  date,
  planned_end    date,
  parent_task_id text,
  data           jsonb not null,                       -- Task incl. response
  updated_at     timestamptz not null default now()
);
create index if not exists wf_task_farmer on wf_task (farmer_id);
create index if not exists wf_task_status on wf_task (status);

-- Small shared settings (today's simulated date lives here as id = 'today').
create table if not exists wf_setting (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Demo access (no login yet): the anon key may read and write these tables.
do $$
declare t text;
begin
  for t in select unnest(array['wf_survey_template','wf_master_record','wf_workflow','wf_farmer','wf_task','wf_setting']) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo all" on %I', t);
    execute format('create policy "demo all" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
  end loop;
end $$;
