-- Mati task orchestration — backend.
-- HQ Admin creates survey templates (questions + the survey's own statuses) and seasons
-- (a flow: Start → survey → next survey …). The flow creates tasks (survey_response rows).

create table survey_template_master (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  az_name     text,
  version     int  not null default 1,
  questions   jsonb not null default '[]',               -- [{key, label, type, required, options, min, max, help}]
  statuses    text[] not null default '{planned,collected}',
  -- statuses[1] = task created · statuses[2] = surveyor submitted · the rest are set by the verifier
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table season (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  base        text,
  az_name     text,
  status      text not null default 'planned',          -- planned | active | completed
  created_at  timestamptz not null default now()
);

create table farmer (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mobile      text,
  village     text,
  base        text,
  az_name     text,
  created_at  timestamptz not null default now()
);

-- One row = one arrow of the season flow. from_template null = Start.
create table season_flow (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references season(id) on delete cascade,
  from_template  uuid references survey_template_master(id),
  to_template    uuid not null references survey_template_master(id),
  on_status      text,                                   -- status of the "from" survey that fires this arrow
  delay_days     int  not null default 0,                -- create the task N days later (0 = immediately)
  start_date     date,                                   -- …or on this date
  end_date       date,                                   -- task ends on this date (null = no end)
  position       int  not null default 0,
  unique (season_id, to_template)
);

create table survey_response (
  task_id             uuid primary key default gen_random_uuid(),
  task_no             int generated always as identity,
  task_type           text not null,                     -- template name
  survey_template_id  uuid not null references survey_template_master(id),
  season_id           uuid not null references season(id),
  farmer_id           uuid not null references farmer(id),
  planned_start_date  date not null,
  planned_end_date    date,
  response_version    int  not null default 0,
  status              text not null,
  survey_response     jsonb,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  unique (season_id, farmer_id, survey_template_id)
);

create table response_change_logs (
  id       int generated always as identity primary key,
  task_id  uuid not null references survey_response(task_id),
  "when"   timestamptz not null default now(),
  who      text,
  before   jsonb,
  after    jsonb,
  remarks  text
);

create table comments (
  id       int generated always as identity primary key,
  task_id  uuid not null references survey_response(task_id),
  "when"   timestamptz not null default now(),
  who      text not null,
  comment  text not null
);

-- ───────── Flow ─────────

-- Follow one arrow for one farmer: create the task for the "to" survey.
create function create_task(f season_flow, p_farmer uuid, p_by text) returns void
language sql security definer set search_path = public as $$
  insert into survey_response (task_type, survey_template_id, season_id, farmer_id,
                               planned_start_date, planned_end_date, status, created_by, updated_by)
  select t.name, t.id, f.season_id, p_farmer,
         coalesce(f.start_date, current_date + f.delay_days), f.end_date, t.statuses[1], p_by, p_by
  from survey_template_master t
  where t.id = f.to_template
  on conflict do nothing;
$$;

-- Start arrows, for every farmer of the season's AZ / base (or one farmer).
create function start_season(p_season uuid, p_farmer uuid default null) returns void
language sql security definer set search_path = public as $$
  select create_task(f, fa.id, 'season')
  from season s
  join season_flow f on f.season_id = s.id and f.from_template is null
  join farmer fa on (s.az_name is null or fa.az_name = s.az_name) and (s.base is null or fa.base = s.base)
  where s.id = p_season and s.status = 'active' and (p_farmer is null or fa.id = p_farmer)
  order by f.position;
$$;

create function on_season_active() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform start_season(new.id);
  return new;
end $$;

create trigger season_active after update of status on season
for each row when (new.status = 'active' and old.status <> 'active') execute function on_season_active();

-- A new farmer joins every active season of their AZ / base.
create function on_farmer_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform start_season(s.id, new.id) from season s where s.status = 'active';
  return new;
end $$;

create trigger farmer_added after insert on farmer for each row execute function on_farmer_added();

-- A task changed status: log it, then follow the arrows that start from it with that status.
create function on_task_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare f season_flow;
begin
  insert into response_change_logs (task_id, who, before, after)
  values (new.task_id, new.updated_by, to_jsonb(old.status), to_jsonb(new.status));

  for f in select * from season_flow
           where season_id = new.season_id and from_template = new.survey_template_id and on_status = new.status
           order by position
  loop
    perform create_task(f, new.farmer_id, new.updated_by);
  end loop;
  return new;
end $$;

create trigger task_status after update of status on survey_response
for each row when (old.status <> new.status) execute function on_task_status();

-- ───────── Called from the pages ─────────

-- Surveyor submits: keep the previous answers in the log, bump the version, move to statuses[2].
create function submit_response(p_task uuid, p_response jsonb, p_by text, p_remarks text default null) returns void
language sql security definer set search_path = public as $$
  insert into response_change_logs (task_id, who, before, after, remarks)
  select task_id, p_by, survey_response, p_response, p_remarks
  from survey_response where task_id = p_task and survey_response is not null;

  update survey_response r
  set survey_response = p_response, response_version = response_version + 1,
      status = t.statuses[2], updated_by = p_by, updated_at = now()
  from survey_template_master t
  where r.task_id = p_task and t.id = r.survey_template_id;
$$;

-- Verifier sets a status (one of the survey's statuses), optionally with a comment.
create function set_status(p_task uuid, p_status text, p_by text, p_comment text default null) returns void
language sql security definer set search_path = public as $$
  insert into comments (task_id, who, comment) select p_task, p_by, p_comment where p_comment <> '';
  update survey_response set status = p_status, updated_by = p_by, updated_at = now() where task_id = p_task;
$$;

-- Demo access: the anon key can read and write everything. Add RLS when login arrives.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
