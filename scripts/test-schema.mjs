// Runs schema.sql + seed.sql in an in-process Postgres (PGlite) and walks the whiteboard flow.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const sql = async (f) => readFile(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8");
const pg = new PGlite();
const one = async (text, params) => (await pg.query(text, params)).rows[0];
const all = async (text, params) => (await pg.query(text, params)).rows;
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failed++; };

await pg.exec("create role anon; create role authenticated;");
await pg.exec(await sql("20261015000000_init.sql"));
await pg.exec(await sql("20261015000001_demo_season.sql"));

const season = await one("select * from seasons limit 1");
const tasks = () => all("select farmer_name, template_id, effective_status, closes_at from task_list order by task_no");

let t = await tasks();
check("season start opens Registration for each of 3 farmers", t.length === 3 && t.every((x) => x.template_id === "registration" && x.effective_status === "open"), JSON.stringify(t.map((x) => [x.farmer_name, x.template_id, x.effective_status])));

const srini = await one("select * from task_list where farmer_name = 'Srinivas' and template_id = 'registration'");
await pg.query("select submit_response($1, $2, $3)", [srini.id, { name: "Srinivas", mobile: "9800000001" }, "dilip"]);
t = await all("select template_id, effective_status, closes_at, reason from task_list where farmer_name = 'Srinivas' order by task_no");
check("submitting Registration marks it collected and opens Enrollment", t.length === 2 && t[0].effective_status === "collected" && t[1].template_id === "enrollment" && t[1].effective_status === "open", JSON.stringify(t));
check("Enrollment closes at end of season end date (on_date)", t[1].closes_at && new Date(t[1].closes_at).toISOString() === "2026-12-31T18:30:00.000Z", String(t[1].closes_at));
check("reason explains the task", t[1].reason === "Opened because Registration was collected", t[1].reason);

const enr = await one("select id from tasks where farmer_id = $1 and template_id = 'enrollment'", [srini.farmer_id]);
await pg.query("select submit_response($1, $2, $3)", [enr.id, { land_acres: 2.5, eligible: "yes", consent: "yes" }, "dilip"]);
let err = null;
try { await pg.query("select submit_response($1, $2, $3)", [enr.id, { land_acres: 3 }, "dilip"]); } catch (e) { err = e.message; }
check("a collected task cannot be resubmitted until reported", /cannot be submitted/.test(err || ""), err);

await pg.query("select review_task($1, 'reported', 'srinivas', '@dilip the land size is wrong')", [enr.id]);
await pg.query("select submit_response($1, $2, $3, $4)", [enr.id, { land_acres: 3, eligible: "yes", consent: "yes" }, "dilip", "corrected as asked"]);
const resp = await one("select version, data from responses where task_id = $1", [enr.id]);
const logs = await all("select field, before, after, remarks from change_logs where task_id = $1 and field <> 'status'", [enr.id]);
check("correction bumps response version and logs the field diff", resp.version === 2 && resp.data.land_acres === 3 && logs.length === 1 && logs[0].before === 2.5 && logs[0].after === 3 && logs[0].remarks === "corrected as asked", JSON.stringify({ resp, logs }));
const comments = await all("select author, body from comments where task_id = $1", [enr.id]);
check("report stored a comment", comments.length === 1 && comments[0].author === "srinivas", JSON.stringify(comments));

check("approval of Enrollment does not happen on collected (no deployment yet)", !(await one("select 1 from tasks where farmer_id = $1 and template_id = 'deployment'", [srini.farmer_id])));
await pg.query("select review_task($1, 'approved', 'srinivas')", [enr.id]);
t = await all("select template_id, effective_status from task_list where farmer_name = 'Srinivas' order by task_no");
check("approving Enrollment opens Deployment", t.some((x) => x.template_id === "deployment" && x.effective_status === "open"), JSON.stringify(t));

const dep = await one("select id from tasks where farmer_id = $1 and template_id = 'deployment'", [srini.farmer_id]);
await pg.query("select submit_response($1, $2, $3)", [dep.id, { tons: 5, date: "2026-07-01" }, "dilip"]);
await pg.query("select review_task($1, 'approved', 'srinivas')", [dep.id]);
t = await all("select template_id, effective_status, opens_at, closes_at from task_list where farmer_name = 'Srinivas' and template_id in ('engagement_1','sample_1') order by template_id");
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
check("approving Deployment plans Engagement 1 (+7d) and Sample 1 (+14d), both upcoming", t.length === 2 && t.every((x) => x.effective_status === "planned") && days(new Date(), t[0].opens_at) === 7 && days(new Date(), t[1].opens_at) === 14, JSON.stringify(t));
check("after_days close is relative to the open date", t.every((x) => days(x.opens_at, x.closes_at) === 30));
check("dedupe: approving again does not duplicate", (await all("select 1 from tasks where farmer_id = $1 and template_id = 'engagement_1'", [srini.farmer_id])).length === 1);

// Disqualification: Ramesh is not eligible.
const ram = await one("select * from task_list where farmer_name = 'Ramesh'");
await pg.query("select submit_response($1, $2, $3)", [ram.id, { name: "Ramesh", mobile: "x" }, "dilip"]);
const renr = await one("select id from tasks where farmer_id = $1 and template_id = 'enrollment'", [ram.farmer_id]);
await pg.query("select submit_response($1, $2, $3)", [renr.id, { land_acres: 1, eligible: "no", consent: "yes" }, "dilip"]);
const exit = await one("select reason from season_exits where farmer_id = $1", [ram.farmer_id]);
check("eligible = no ends the journey", !!exit, exit?.reason);
await pg.query("select review_task($1, 'approved', 'srinivas')", [renr.id]);
check("no further tasks open for an exited farmer", !(await one("select 1 from tasks where farmer_id = $1 and template_id = 'deployment'", [ram.farmer_id])));
check("submissions survive (never deleted)", (await all("select 1 from responses where task_id in ($1, $2)", [ram.id, renr.id])).length === 2);

// New farmer in an active season gets the start task.
await pg.query("insert into farmers (name, village, az_id) values ('Geeta', 'Achalpur', 'ERW')");
check("new farmer in an active season gets Registration", !!(await one("select 1 from task_list where farmer_name = 'Geeta' and template_id = 'registration' and effective_status = 'open'")));

// Fail-closed condition evaluation.
const ev = async (data, f, op, v) => (await one("select eval_condition($1, $2, $3, $4) as r", [data, f, op, v])).r;
check("eval: missing field is false", (await ev({}, "x", "eq", "1")) === false);
check("eval: non-numeric with gt is false", (await ev({ x: "abc" }, "x", "gt", "1")) === false);
check("eval: numeric gte", (await ev({ x: 5 }, "x", "gte", "5")) === true);
check("eval: array contains", (await ev({ x: ["a", "b"] }, "x", "contains", "b")) === true);
check("eval: no field means always", (await ev({}, null, null, null)) === true);

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
