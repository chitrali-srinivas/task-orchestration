// Applies the web backend migration to an in-process Postgres and round-trips one row per table.
// Run: node scripts/test-web-backend.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const pg = new PGlite();
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail && " — " + detail}`); if (!ok) failed++; };

await pg.exec("create role anon; create role authenticated;");
await pg.exec(await readFile(new URL("../supabase/migrations/20261015120000_web_backend.sql", import.meta.url), "utf8"));

const tables = ["wf_survey_template", "wf_master_record", "wf_workflow", "wf_farmer", "wf_task", "wf_setting"];
for (const t of tables) {
  const rls = (await pg.query("select relrowsecurity from pg_class where relname = $1", [t])).rows[0];
  check(`${t} exists with RLS on`, rls?.relrowsecurity === true);
}

// The same upsert shape lib/backend uses: id + data + indexed columns.
await pg.query("insert into wf_workflow (id, name, country, status, data) values ('wf1', 'Kharif', 'India', 'active', '{\"id\":\"wf1\",\"steps\":[]}')");
await pg.query("insert into wf_farmer (id, name, village, data) values ('f1', 'Srinivas', 'Achalpur', '{\"id\":\"f1\"}')");
await pg.query(
  "insert into wf_task (id, task_no, workflow_id, step_id, survey_id, farmer_id, status, planned_start, planned_end, data) values ('t1', 1, 'wf1', 's1', 'srv1', 'f1', 'planned', '2026-11-01', null, '{\"id\":\"t1\",\"taskNo\":1}')"
);
await pg.query("insert into wf_task (id, task_no, workflow_id, step_id, survey_id, farmer_id, status, planned_start, data) values ('t1', 1, 'wf1', 's1', 'srv1', 'f1', 'collected', '2026-11-01', '{\"id\":\"t1\",\"taskNo\":1,\"status\":\"collected\"}') on conflict (id) do update set status = excluded.status, data = excluded.data, updated_at = now()");
const task = (await pg.query("select status, data->>'status' as data_status, planned_start from wf_task where id = 't1'")).rows[0];
check("task upsert keeps columns and data in step", task.status === "collected" && task.data_status === "collected", JSON.stringify(task));

let refErr = null;
try { await pg.query("insert into wf_task (id, task_no, farmer_id, status, data) values ('t2', 2, 'nobody', 'planned', '{}')"); } catch (e) { refErr = e.message; }
check("task must reference an existing farmer", Boolean(refErr));

await pg.query("insert into wf_setting (id, data) values ('today', '{\"id\":\"today\",\"today\":\"2026-11-01\"}')");
check("setting round-trips", (await pg.query("select data->>'today' as d from wf_setting where id = 'today'")).rows[0].d === "2026-11-01");

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
