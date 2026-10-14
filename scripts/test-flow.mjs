// Creates templates, a season and a flow the way HQ Admin would, then walks it. Run: npm test
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const pg = new PGlite();
const rows = async (q, p) => (await pg.query(q, p)).rows;
const one = async (q, p) => (await rows(q, p))[0];
const iso = (d) => new Date(d).toISOString().slice(0, 10);
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail && " — " + detail}`); if (!ok) failed++; };

await pg.exec("create role anon; create role authenticated;");
await pg.exec(await readFile(new URL("../supabase/migrations/20261015000000_init.sql", import.meta.url), "utf8"));

// HQ Admin: two templates with their own statuses, one season, three arrows.
const reg = (await one("insert into survey_template_master (name, questions, statuses) values ('Registration', '[{\"key\":\"name\",\"label\":\"Name\",\"type\":\"text\"}]', '{planned,collected,verified,rejected}') returning id")).id;
const enr = (await one("insert into survey_template_master (name, questions, statuses) values ('Enrollment', '[{\"key\":\"acres\",\"label\":\"Acres\",\"type\":\"number\"}]', '{planned,collected,approved,disqualified}') returning id")).id;
const dep = (await one("insert into survey_template_master (name, statuses) values ('Deployment', '{planned,collected,verified}') returning id")).id;
const season = (await one("insert into season (name, base, az_name) values ('Kharif 2026', 'Seoni', 'ERW') returning id")).id;
await pg.query("insert into season_flow (season_id, from_template, to_template, position) values ($1, null, $2, 1)", [season, reg]);
await pg.query("insert into season_flow (season_id, from_template, to_template, on_status, position) values ($1, $2, $3, 'collected', 2)", [season, reg, enr]);
await pg.query("insert into season_flow (season_id, from_template, to_template, on_status, delay_days, end_date, position) values ($1, $2, $3, 'approved', 7, '2026-12-31', 3)", [season, enr, dep]);

await pg.query("insert into farmer (name, village, base, az_name) values ('Srinivas', 'Achalpur', 'Seoni', 'ERW')");
check("no tasks before the season starts", (await rows("select 1 from survey_response")).length === 0);

await pg.query("update season set status = 'active' where id = $1", [season]);
const tasks = () => rows("select task_type, status, planned_start_date, planned_end_date from survey_response order by task_no");
let t = await tasks();
check("Start → Registration task in the survey's first status", t.length === 1 && t[0].task_type === "Registration" && t[0].status === "planned", JSON.stringify(t));

const task = async (type) => (await one("select task_id from survey_response where task_type = $1", [type])).task_id;
await pg.query("select submit_response($1, $2, 'dilip')", [await task("Registration"), { name: "Srinivas" }]);
t = await tasks();
check("submit → second status, and the 'collected' arrow creates Enrollment", t[0].status === "collected" && t[1]?.task_type === "Enrollment", JSON.stringify(t));

await pg.query("select submit_response($1, $2, 'dilip')", [await task("Enrollment"), { acres: 5 }]);
await pg.query("select set_status($1, 'disqualified', 'hq', 'not eligible')", [await task("Enrollment")]);
check("a status with no arrow creates nothing", (await tasks()).length === 2);

await pg.query("select submit_response($1, $2, 'dilip', 'corrected')", [await task("Enrollment"), { acres: 6 }]);
const log = await rows("select before, after, remarks from response_change_logs where task_id = $1 and before ? 'acres'", [await task("Enrollment")]);
check("resubmit logs before/after + remarks, version 2", log.length === 1 && log[0].before.acres === 5 && log[0].after.acres === 6 && (await one("select response_version from survey_response where task_id = $1", [await task("Enrollment")])).response_version === 2, JSON.stringify(log));

await pg.query("select set_status($1, 'approved', 'hq')", [await task("Enrollment")]);
t = await tasks();
const d = t.find((x) => x.task_type === "Deployment");
check("approved → Deployment after 7 days, ends 2026-12-31", d && iso(d.planned_start_date) === iso(Date.now() + 7 * 864e5) && iso(d.planned_end_date) === "2026-12-31", JSON.stringify(d));

await pg.query("insert into farmer (name, base, az_name) values ('Geeta', 'Seoni', 'ERW')");
check("a farmer added later gets the Start task", (await rows("select 1 from survey_response r join farmer f on f.id = r.farmer_id where f.name = 'Geeta'")).length === 1);
check("comment stored", (await rows("select 1 from comments")).length === 1);

console.log(failed ? `\n${failed} failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
