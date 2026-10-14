-- Mati lean season orchestration — Postgres / Supabase schema.
-- Run once in the Supabase SQL editor (then run seed.sql).
--
-- The orchestration lives in the database:
--   season start / new farmer      -> tasks for every "season_start" rule
--   task status changes            -> tasks for every matching "form_status" rule
-- Field data is never deleted: cancelling only touches tasks nobody has submitted.

-- ───────────────────────── Tables ─────────────────────────

create table survey_templates (
  id          text primary key,                       -- e.g. 'registration_india'
  name        text not null,
  az_id       text not null default 'ERW',
  version     int  not null default 1,
  fields      jsonb not null default '[]'::jsonb,     -- [{key,label,type,options?}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text not null default 'India',
  az_id       text not null,
  timezone    text not null default 'Asia/Kolkata',
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create table farmers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mobile      text,
  village     text,
  az_id       text not null,
  created_at  timestamptz not null default now()
);

-- One row = one arrow in the season flow.
create table season_rules (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references seasons(id) on delete cascade,
  action              text not null default 'open' check (action in ('open', 'end')),  -- 'end' = disqualify farmer
  template_id         text references survey_templates(id),                            -- form to open
  trigger_type        text not null check (trigger_type in ('season_start', 'form_status')),
  source_template_id  text references survey_templates(id),
  source_status       text check (source_status in ('collected', 'approved', 'reported')),
  condition_field     text,
  condition_op        text check (condition_op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains')),
  condition_value     text,
  open_type           text not null default 'immediately' check (open_type in ('immediately', 'after_days', 'on_date')),
  open_days           int check (open_days >= 0),
  open_date           date,
  close_type          text not null default 'none' check (close_type in ('none', 'after_days', 'on_date')),
  close_days          int check (close_days > 0),
  close_date          date,
  position            int not null default 0,
  created_at          timestamptz not null default now(),
  check ((action = 'open') = (template_id is not null)),
  check (trigger_type = 'season_start' or (source_template_id is not null and source_status is not null)),
  check (trigger_type = 'form_status' or action = 'open'),
  check (open_type <> 'after_days' or open_days is not null),
  check (open_type <> 'on_date' or open_date is not null),
  check (close_type <> 'after_days' or close_days is not null),
  check (close_type <> 'on_date' or close_date is not null),
  check ((condition_field is null) = (condition_op is null))
);

-- planned = created, waiting for its window (shown as open / expired by the clock, see task_list)
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  task_no     bigint generated always as identity,
  season_id   uuid not null references seasons(id),
  template_id text not null references survey_templates(id),
  farmer_id   uuid not null references farmers(id),
  rule_id     uuid references season_rules(id) on delete set null,
  status      text not null default 'planned'
              check (status in ('planned', 'collected', 'approved', 'reported', 'discarded', 'cancelled')),
  opens_at    timestamptz not null,
  closes_at   timestamptz,                             -- null = valid indefinitely
  reason      text not null,                           -- "why is this task here?"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (season_id, template_id, farmer_id)           -- dedupe: one task per form per farmer per season
);

create table responses (
  task_id           uuid primary key references tasks(id),
  template_version  int not null,
  version           int not null default 1,            -- +1 on every resubmission
  data              jsonb not null,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_by        text,
  updated_at        timestamptz not null default now()
);

create table change_logs (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references tasks(id),
  changed_at  timestamptz not null default now(),
  changed_by  text,
  field       text not null,                           -- answer key, or 'status'
  before      jsonb,
  after       jsonb,
  remarks     text
);

create table comments (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references tasks(id),
  author      text not null,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);

-- Farmers whose journey ended this season (e.g. disqualified at enrollment).
create table season_exits (
  season_id   uuid not null references seasons(id),
  farmer_id   uuid not null references farmers(id),
  reason      text not null,
  created_at  timestamptz not null default now(),
  primary key (season_id, farmer_id)
);

create index on tasks (season_id, status);
create index on tasks (farmer_id);
create index on change_logs (task_id);
create index on comments (task_id);

-- ───────────────────────── Views ─────────────────────────

create view task_list with (security_invoker = true) as
select
  t.*,
  case
    when t.status = 'planned' and t.closes_at is not null and t.closes_at <= now() then 'expired'
    when t.status = 'planned' and t.opens_at <= now() then 'open'
    else t.status
  end as effective_status,
  st.name   as template_name,
  f.name    as farmer_name,
  f.village as village,
  s.name    as season_name,
  s.status  as season_status
from tasks t
join survey_templates st on st.id = t.template_id
join farmers f on f.id = t.farmer_id
join seasons s on s.id = t.season_id;

-- ───────────────────────── Engine ─────────────────────────

create function local_midnight(d date, tz text) returns timestamptz
language sql immutable as $$ select d::timestamp at time zone tz $$;

-- Fails closed: a missing answer or a non-numeric value for a numeric operator is false.
create function eval_condition(data jsonb, field text, op text, val text) returns boolean
language plpgsql immutable as $$
declare
  v jsonb := data -> field;
  s text;
  a numeric;
  b numeric;
begin
  if field is null then return true; end if;
  if v is null or v = 'null'::jsonb then return false; end if;
  if jsonb_typeof(v) = 'array' then
    return op = 'contains' and v ? val;
  end if;
  s := v #>> '{}';
  if op = 'eq' then return lower(s) = lower(val); end if;
  if op = 'neq' then return lower(s) <> lower(val); end if;
  if op = 'contains' then return position(lower(val) in lower(s)) > 0; end if;
  begin
    a := s::numeric;
    b := val::numeric;
  exception when others then
    return false;
  end;
  return case op when 'gt' then a > b when 'gte' then a >= b when 'lt' then a < b when 'lte' then a <= b else false end;
end $$;

create function open_task(r season_rules, p_farmer uuid, p_base timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s seasons;
  o timestamptz;
  c timestamptz;
begin
  if exists (select 1 from season_exits where season_id = r.season_id and farmer_id = p_farmer) then
    return;
  end if;
  select * into s from seasons where id = r.season_id;
  o := case r.open_type
         when 'immediately' then p_base
         when 'after_days'  then p_base + make_interval(days => r.open_days)
         else greatest(p_base, local_midnight(r.open_date, s.timezone))
       end;
  c := case r.close_type
         when 'none'       then null
         when 'after_days' then o + make_interval(days => r.close_days)
         else local_midnight(r.close_date + 1, s.timezone)   -- end of the close date
       end;
  insert into tasks (season_id, template_id, farmer_id, rule_id, opens_at, closes_at, reason)
  values (r.season_id, r.template_id, p_farmer, r.id, o, c, p_reason)
  on conflict (season_id, template_id, farmer_id) do nothing;
end $$;

-- Creates the season-start tasks for every farmer in the AZ (or one farmer).
create function seed_start_tasks(p_season uuid, p_farmer uuid default null, p_rule uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  s seasons;
  r season_rules;
  f record;
begin
  select * into s from seasons where id = p_season;
  if s.status <> 'active' then return; end if;
  for r in
    select * from season_rules
    where season_id = p_season and trigger_type = 'season_start' and (p_rule is null or id = p_rule)
    order by position
  loop
    for f in select id from farmers where az_id = s.az_id and (p_farmer is null or id = p_farmer) loop
      perform open_task(r, f.id, greatest(now(), local_midnight(s.start_date, s.timezone)),
                        format('Opened at the start of season %s', s.name));
    end loop;
  end loop;
end $$;

create function on_season_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then perform seed_start_tasks(new.id); end if;
  return new;
end $$;

create trigger seasons_status after update of status on seasons
for each row when (old.status is distinct from new.status) execute function on_season_status();

create function on_farmer_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select id from seasons where az_id = new.az_id and status = 'active' loop
    perform seed_start_tasks(s.id, new.id);
  end loop;
  return new;
end $$;

create trigger farmers_insert after insert on farmers
for each row execute function on_farmer_insert();

-- A start rule added to a running season applies to every farmer already in it.
create function on_rule_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.trigger_type = 'season_start' then perform seed_start_tasks(new.season_id, null, new.id); end if;
  return new;
end $$;

create trigger season_rules_insert after insert on season_rules
for each row execute function on_rule_insert();

create function on_task_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r season_rules;
  answers jsonb;
  form_name text;
  why text;
begin
  insert into change_logs (task_id, changed_by, field, before, after, remarks)
  values (new.id, nullif(current_setting('mati.actor', true), ''), 'status',
          to_jsonb(old.status), to_jsonb(new.status), nullif(current_setting('mati.remarks', true), ''));

  select data into answers from responses where task_id = new.id;
  select name into form_name from survey_templates where id = new.template_id;

  for r in
    select * from season_rules
    where season_id = new.season_id and trigger_type = 'form_status'
      and source_template_id = new.template_id and source_status = new.status
    order by position
  loop
    continue when not eval_condition(coalesce(answers, '{}'::jsonb), r.condition_field, r.condition_op, r.condition_value);
    why := format('%s was %s', form_name, new.status)
        || case when r.condition_field is null then ''
                else format(' and %s %s %s', r.condition_field, r.condition_op, r.condition_value) end;
    if r.action = 'end' then
      insert into season_exits (season_id, farmer_id, reason)
      values (new.season_id, new.farmer_id, 'Journey ended because ' || why)
      on conflict do nothing;
      update tasks set status = 'cancelled', reason = reason || ' · cancelled because ' || why, updated_at = now()
      where season_id = new.season_id and farmer_id = new.farmer_id and status = 'planned';
    else
      perform open_task(r, new.farmer_id, now(), 'Opened because ' || why);
    end if;
  end loop;
  return new;
end $$;

create trigger tasks_status after update of status on tasks
for each row when (old.status is distinct from new.status) execute function on_task_status();

-- ───────────────────────── API (called with supabase.rpc) ─────────────────────────

create function submit_response(p_task uuid, p_data jsonb, p_by text, p_remarks text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  st text;
  old_data jsonb;
  k text;
begin
  select effective_status into st from task_list where id = p_task;
  if st is null then raise exception 'Task not found'; end if;
  if st not in ('open', 'reported') then raise exception 'This task is % and cannot be submitted', st; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Answers must be an object'; end if;

  perform set_config('mati.actor', coalesce(p_by, ''), true);
  perform set_config('mati.remarks', coalesce(p_remarks, ''), true);

  select data into old_data from responses where task_id = p_task;
  if old_data is null then
    insert into responses (task_id, template_version, data, created_by, updated_by)
    select p_task, st2.version, p_data, p_by, p_by
    from tasks t join survey_templates st2 on st2.id = t.template_id where t.id = p_task;
  else
    for k in select key from jsonb_object_keys(old_data) key union select key from jsonb_object_keys(p_data) key loop
      if (old_data -> k) is distinct from (p_data -> k) then
        insert into change_logs (task_id, changed_by, field, before, after, remarks)
        values (p_task, p_by, k, old_data -> k, p_data -> k, p_remarks);
      end if;
    end loop;
    update responses set data = p_data, version = version + 1, updated_by = p_by, updated_at = now()
    where task_id = p_task;
  end if;

  update tasks set status = 'collected', updated_at = now() where id = p_task;
end $$;

create function review_task(p_task uuid, p_status text, p_by text, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if p_status not in ('approved', 'reported', 'discarded') then raise exception 'Unknown review result %', p_status; end if;
  select status into st from tasks where id = p_task for update;
  if st is null then raise exception 'Task not found'; end if;
  if st <> 'collected' then raise exception 'Only collected tasks can be reviewed (this one is %)', st; end if;

  perform set_config('mati.actor', coalesce(p_by, ''), true);
  perform set_config('mati.remarks', coalesce(p_comment, ''), true);
  if nullif(trim(coalesce(p_comment, '')), '') is not null then
    insert into comments (task_id, author, body) values (p_task, coalesce(p_by, 'admin'), p_comment);
  end if;
  update tasks set status = p_status, updated_at = now() where id = p_task;
end $$;

-- ───────────────────────── Access ─────────────────────────
-- Demo mode: no login yet. Everyone with the anon key can read everything and edit
-- setup data; tasks, responses and logs change only through the functions above.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on survey_templates, seasons, farmers, season_rules to anon, authenticated;
grant insert on comments to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['survey_templates', 'seasons', 'farmers', 'season_rules', 'tasks',
                           'responses', 'change_logs', 'comments', 'season_exits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select to anon, authenticated using (true)', t);
  end loop;
  foreach t in array array['survey_templates', 'seasons', 'farmers', 'season_rules'] loop
    execute format('create policy "write" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
  execute 'create policy "add" on comments for insert to anon, authenticated with check (true)';
end $$;
