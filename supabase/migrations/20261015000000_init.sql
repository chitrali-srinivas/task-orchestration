-- Mati task orchestration — backend, as drawn: Survey Template Master, Survey Response,
-- Response change logs, Comments, plus the Season and its flow (the arrows).

create table survey_template_master (
  id              text primary key,            -- e.g. Registration_india
  name            text not null,
  az_id           text not null,
  version         int  not null default 1,
  survey_details  jsonb not null,              -- [{key, label, type, options}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table season (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text not null,
  az_id       text not null,
  base_id     text,
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'planned'  -- planned | active | completed
);

create table farmer (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  mobile   text,
  village  text,
  az_id    text not null,
  base_id  text
);

-- One row = one arrow in the season flow.
-- from_template null = Start. to_template null = End.
create table season_flow (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references season(id) on delete cascade,
  from_template  text references survey_template_master(id),
  to_template    text references survey_template_master(id),
  on_status      text not null default 'pending verification',   -- status of the "from" task that fires the arrow
  trigger        text not null default 'immediately',            -- immediately | date
  trigger_date   date,
  validity       text not null default 'indefinite',             -- indefinite | range
  valid_from     date,
  valid_to       date,
  position       int  not null default 0
);

create table survey_response (
  task_id             uuid primary key default gen_random_uuid(),
  task_no             int generated always as identity,
  task_type           text not null,                             -- template name
  survey_template_id  text not null references survey_template_master(id),
  season_id           uuid not null references season(id),
  farmer_id           uuid not null references farmer(id),
  planned_start_date  date not null,
  planned_end_date    date,                                      -- null = indefinite
  response_version    int  not null default 0,
  status              text not null default 'planned'
                      check (status in ('planned', 'pending verification', 'verified', 'algo verified',
                                        'completed', 'discarded', 'cancelled')),
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

-- Follow one arrow for one farmer: create the "to" task.
create function create_task(f season_flow, p_farmer uuid, p_by text) returns void
language sql security definer set search_path = public as $$
  insert into survey_response (task_type, survey_template_id, season_id, farmer_id,
                               planned_start_date, planned_end_date, created_by, updated_by)
  select t.name, t.id, f.season_id, p_farmer,
         case f.trigger  when 'date'  then f.trigger_date else current_date end,
         case f.validity when 'range' then f.valid_to end,
         p_by, p_by
  from survey_template_master t
  where t.id = f.to_template
  on conflict do nothing;
$$;

-- Start → first forms, for every farmer in the season's AZ (and base, if set).
create function start_season(p_season uuid, p_farmer uuid default null) returns void
language sql security definer set search_path = public as $$
  select create_task(f, fa.id, 'season')
  from season s
  join season_flow f on f.season_id = s.id and f.from_template is null
  join farmer fa on fa.az_id = s.az_id and (s.base_id is null or fa.base_id = s.base_id)
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

-- allocate season: a new farmer joins the active season of their AZ / base.
create function on_farmer_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform start_season(s.id, new.id)
  from season s
  where s.az_id = new.az_id and s.status = 'active' and current_date between s.start_date and s.end_date;
  return new;
end $$;

create trigger farmer_added after insert on farmer for each row execute function on_farmer_added();

-- A task changed status: log it, then follow every arrow that starts from it with that status.
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
    if f.to_template is null then                       -- End: the farmer's season is over
      update survey_response set status = 'cancelled', updated_by = new.updated_by, updated_at = now()
      where season_id = new.season_id and farmer_id = new.farmer_id and status = 'planned';
    else
      perform create_task(f, new.farmer_id, new.updated_by);
    end if;
  end loop;
  return new;
end $$;

create trigger task_status after update of status on survey_response
for each row when (old.status <> new.status) execute function on_task_status();

-- ───────── Called from the phone and the admin page ─────────

create function submit_response(p_task uuid, p_response jsonb, p_by text, p_remarks text default null) returns void
language sql security definer set search_path = public as $$
  insert into response_change_logs (task_id, who, before, after, remarks)
  select task_id, p_by, survey_response, p_response, p_remarks
  from survey_response where task_id = p_task and survey_response is not null;

  update survey_response
  set survey_response = p_response, response_version = response_version + 1,
      status = 'pending verification', updated_by = p_by, updated_at = now()
  where task_id = p_task;
$$;

create function verify_task(p_task uuid, p_status text, p_by text, p_comment text default null) returns void
language sql security definer set search_path = public as $$
  insert into comments (task_id, who, comment) select p_task, p_by, p_comment where p_comment <> '';
  update survey_response set status = p_status, updated_by = p_by, updated_at = now() where task_id = p_task;
$$;

-- Demo access: the anon key can read and write everything. Add RLS when login arrives.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
