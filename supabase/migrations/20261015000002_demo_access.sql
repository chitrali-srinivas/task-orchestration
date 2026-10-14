-- Demo access: this project has row-level security on by default, so allow the anon key
-- to read and write every table until login arrives.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo all" on %I', t);
    execute format('create policy "demo all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
