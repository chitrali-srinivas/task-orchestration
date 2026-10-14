// Walks the whiteboard flow in an in-process Postgres (PGlite). Run: npm test
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const pg = new PGlite();
const rows = async (q, p) => (await pg.query(q, p)).rows;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail && " — " + detail}`); if (!ok) failed++; };

await pg.exec("create role anon; create role authenticated;");
for (const f of ["20261015000000_init.sql", "20261015000001_demo_season.sql"])
  await pg.exec(await readFile(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"));

const tasks = (farmer) => rows("select task_type, status, planned_start_date, planned_end_date from survey_response r join farmer f on f.id = r.farmer_id where f.name = $1 order by task_no", [farmer]);
const task = async (farmer, type) => (await rows("select task_id from survey_response r join farmer f on f.id = r.farmer_id where f.name = $1 and task_type = $2", [farmer, type]))[0].task_id;

let t = await rows("select count(*)::int as n from survey_response where task_type = 'Registration' and status = 'planned'");
check("Start: Registration planned for all 3 farmers", t[0].n === 3);

await pg.query("select submit_response($1, $2, 'dilip')", [await task("Srinivas", "Registration"), { name: "Srinivas", mobile: "9800000001" }]);
t = await tasks("Srinivas");
check("Registration submitted → pending verification, Enrollment planned", t[1]?.task_type === "Enrollment" && t[0].status === "pending verification", JSON.stringify(t));

const enr = await task("Srinivas", "Enrollment");
await pg.query("select submit_response($1, $2, 'dilip')", [enr, { land_acres: 5, eligible: "yes" }]);
await pg.query("select verify_task($1, 'discarded', 'srinivas', '@dilip the data is wrong')", [enr]);
await pg.query("select submit_response($1, $2, 'dilip', 'corrected')", [enr, { land_acres: 6, eligible: "yes" }]);
const log = await rows("select who, before, after, remarks from response_change_logs where task_id = $1 and before ? 'land_acres'", [enr]);
check("resubmit logs before/after with remarks", log.length === 1 && log[0].before.land_acres === 5 && log[0].after.land_acres === 6 && log[0].remarks === "corrected", JSON.stringify(log));
check("response version is 2", (await rows("select response_version from survey_response where task_id = $1", [enr]))[0].response_version === 2);
check("comment stored", (await rows("select comment from comments where task_id = $1", [enr])).length === 1);

await pg.query("select verify_task($1, 'verified', 'srinivas')", [enr]);
t = await tasks("Srinivas");
const dep = t.find((x) => x.task_type === "Deployment");
check("Enrollment verified → Deployment planned on trigger date, ends on valid_to", dep && iso(dep.planned_start_date) === "2026-07-01" && iso(dep.planned_end_date) === "2026-12-31", JSON.stringify(dep));

await pg.query("select submit_response($1, $2, 'dilip')", [await task("Srinivas", "Deployment"), { tons: 5, date: "2026-07-02" }]);
await pg.query("select verify_task($1, 'verified', 'srinivas')", [await task("Srinivas", "Deployment")]);
t = await tasks("Srinivas");
check("Deployment verified → Engagement 1 and Sample 1 planned", ["Engagement 1", "Sample 1"].every((n) => t.some((x) => x.task_type === n && x.status === "planned")), JSON.stringify(t.map((x) => x.task_type)));

// Ramesh is disqualified at Enrollment → End.
await pg.query("select submit_response($1, $2, 'dilip')", [await task("Ramesh", "Registration"), { name: "Ramesh" }]);
await pg.query("select submit_response($1, $2, 'dilip')", [await task("Ramesh", "Enrollment"), { eligible: "no" }]);
await pg.query("select verify_task($1, 'discarded', 'srinivas', 'not eligible')", [await task("Ramesh", "Enrollment")]);
t = await tasks("Ramesh");
check("Enrollment discarded → End: no Deployment, nothing planned", !t.some((x) => x.task_type === "Deployment") && !t.some((x) => x.status === "planned"), JSON.stringify(t));

await pg.query("insert into farmer (name, village, az_id) values ('Geeta', 'Achalpur', 'ERW')");
check("new farmer is allocated to the active season and gets Registration", (await tasks("Geeta")).length === 1);

console.log(failed ? `\n${failed} failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
