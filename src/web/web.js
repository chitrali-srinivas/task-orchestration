import { db, q, esc, date, when, toast, run } from "../lib/db.js";

const STATUSES = ["planned", "pending verification", "verified", "algo verified", "completed", "discarded", "cancelled"];
const ADMIN = "admin";
const app = document.getElementById("app");
let templates = [], seasons = [], season = null;

const name = (id) => templates.find((t) => t.id === id)?.name ?? id;
const node = (id) => id ? `<span class="node">Survey: ${esc(name(id))}</span>` : "";
const describe = (a) =>
  `Status: ${esc(a.on_status)} · Trigger: ${a.trigger === "date" ? "date " + date(a.trigger_date) : "immediately"} · ` +
  `Validity: ${a.validity === "range" ? date(a.valid_from) + " – " + date(a.valid_to) : "indefinite"}`;

async function load() {
  [templates, seasons] = await Promise.all([
    q(db.from("survey_template_master").select("*").order("created_at")),
    q(db.from("season").select("*").order("start_date")),
  ]);
  season = seasons.find((s) => s.id === season?.id) ?? seasons[0] ?? null;
  render();
}

async function render() {
  const [arrows, tasks] = season ? await Promise.all([
    q(db.from("season_flow").select("*").eq("season_id", season.id).order("position")),
    q(db.from("survey_response").select("*, farmer(name, village)").eq("season_id", season.id).order("task_no")),
  ]) : [[], []];
  const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
  const tplOpts = templates.map((t) => [t.id, "Survey: " + t.name]);

  app.innerHTML = `
    <aside class="card">
      <h2>Survey Template List</h2>
      ${templates.map((t) => `<div class="box">Survey: ${esc(t.name)}<div class="small muted">${esc(t.id)} · v${t.version}</div></div>`).join("")}
      <a class="small" href="../mobile/">Surveyor phone ↗</a>
    </aside>
    <main>
      <div class="card">
        <div class="row">
          <select id="pick" style="width:auto">${opt(seasons.map((s) => [s.id, s.name]), season?.id)}</select>
          ${season ? `<span class="status">${esc(season.status)}</span>` : ""}
          ${season?.status === "planned" ? `<button id="start" class="primary">Start season</button>` : ""}
          <span class="grow"></span>
          <button id="newSeason">New season</button>
        </div>
        ${season ? `<p style="margin-top:8px"><b>Season name:</b> ${esc(season.name)}<br><b>Country:</b> ${esc(season.country)} · <b>AZ:</b> ${esc(season.az_id)} · ${date(season.start_date)} – ${date(season.end_date)}</p>` : ""}
      </div>

      ${season ? `
      <div class="card">
        <h2>Flow</h2>
        ${arrows.map((a) => `
          <div class="arrow">
            <button class="link" data-del="${a.id}" title="Delete arrow">✕</button>
            <div>${a.from_template ? node(a.from_template) : '<span class="node start">Start</span>'} → ${a.to_template ? node(a.to_template) : '<span class="node end">End</span>'}
              <div class="small muted">${describe(a)}</div></div>
          </div>`).join("") || '<p class="empty">No arrows yet.</p>'}
        <form id="arrow" class="grid" style="margin-top:12px">
          <label>From <select name="from_template">${opt([["", "Start"], ...tplOpts])}</select></label>
          <label>To <select name="to_template">${opt([...tplOpts, ["", "End"]])}</select></label>
          <label>Status <select name="on_status">${opt(STATUSES.map((s) => [s, s]), "pending verification")}</select></label>
          <label>Trigger <div class="row"><select name="trigger" style="width:130px"><option value="immediately">Immediately</option><option value="date">Date</option></select><input name="trigger_date" type="date" class="grow"></div></label>
          <label>Validity <div class="row"><select name="validity" style="width:130px"><option value="indefinite">Indefinite</option><option value="range">Start – end</option></select><input name="valid_from" type="date" class="grow"><input name="valid_to" type="date" class="grow"></div></label>
          <label>&nbsp;<button class="primary" style="width:100%">Add arrow</button></label>
        </form>
      </div>

      <div class="card">
        <h2>Survey Responses</h2>
        <table><thead><tr><th>Task ID</th><th>Task type</th><th>Farmer</th><th>Status</th><th>Planned start</th><th>Planned end</th><th>Version</th></tr></thead>
        <tbody>${tasks.map((t) => `<tr data-task="${t.task_id}"><td>T${t.task_no}</td><td>${esc(t.task_type)}</td><td>${esc(t.farmer.name)} <span class="muted small">${esc(t.farmer.village ?? "")}</span></td><td><span class="status">${esc(t.status)}</span></td><td>${date(t.planned_start_date)}</td><td>${t.planned_end_date ? date(t.planned_end_date) : "indefinite"}</td><td>${t.response_version}</td></tr>`).join("")}</tbody></table>
        ${tasks.length ? "" : '<p class="empty">No tasks. Start the season.</p>'}
      </div>` : '<p class="empty">Create a season.</p>'}
    </main>`;

  app.querySelector("#pick").onchange = (e) => { season = seasons.find((s) => s.id === e.target.value); render(); };
  app.querySelector("#newSeason").onclick = () => run(async () => {
    const n = prompt("Season name"); if (!n) return;
    const row = { name: n, country: prompt("Country", "India, Asia"), az_id: prompt("AZ id", "ERW"), start_date: prompt("Start date (YYYY-MM-DD)"), end_date: prompt("End date (YYYY-MM-DD)") };
    season = await q(db.from("season").insert(row).select().single()); load();
  });
  app.querySelector("#start")?.addEventListener("click", () => run(async () => {
    await q(db.from("season").update({ status: "active" }).eq("id", season.id)); toast("Season started"); load();
  }));
  app.querySelector("#arrow")?.addEventListener("submit", (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    await q(db.from("season_flow").insert({ ...f, season_id: season.id, position: arrows.length + 1,
      from_template: f.from_template || null, to_template: f.to_template || null,
      trigger_date: f.trigger_date || null, valid_from: f.valid_from || null, valid_to: f.valid_to || null }));
    render();
  }); });
  app.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => run(async () => {
    await q(db.from("season_flow").delete().eq("id", b.dataset.del)); render();
  }));
  app.querySelectorAll("[data-task]").forEach((tr) => tr.onclick = () => openTask(tasks.find((t) => t.task_id === tr.dataset.task)));
}

async function openTask(t) {
  const [logs, comments] = await Promise.all([
    q(db.from("response_change_logs").select("*").eq("task_id", t.task_id).order("when", { ascending: false })),
    q(db.from("comments").select("*").eq("task_id", t.task_id).order("when")),
  ]);
  const el = document.createElement("div");
  el.className = "drawer";
  el.innerHTML = `
    <div class="row"><h1 class="grow">T${t.task_no} · ${esc(t.task_type)}</h1><button id="close">✕</button></div>
    <p class="muted">${esc(t.farmer.name)} · <span class="status">${esc(t.status)}</span> · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "indefinite"}</p>
    <div class="card"><h3>Survey response (v${t.response_version})</h3>
      ${t.survey_response ? `<table>${Object.entries(t.survey_response).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : '<p class="muted">Not submitted yet.</p>'}
      <p class="small muted" style="margin-top:8px">Created ${when(t.created_at)} by ${esc(t.created_by)} · Updated ${when(t.updated_at)} by ${esc(t.updated_by)}</p></div>
    <div class="card"><h3>Verification</h3><input id="comment" placeholder="Comment, e.g. @dilip the data is wrong">
      <div class="row" style="margin-top:8px">${["verified", "algo verified", "completed", "discarded"].map((s) => `<button data-set="${s}">${s}</button>`).join("")}</div></div>
    <div class="card"><h3>Comments</h3>${comments.map((c) => `<div class="box"><b>${esc(c.who)}</b> <span class="small muted">${when(c.when)}</span><br>${esc(c.comment)}</div>`).join("") || '<p class="muted small">None.</p>'}
      <div class="row"><input id="newComment" class="grow" placeholder="Add a comment"><button id="post">Post</button></div></div>
    <div class="card"><h3>Response change logs</h3>${logs.map((l) => `<div class="box small"><b>${esc(l.who ?? "system")}</b> · ${when(l.when)}<br>before: ${esc(JSON.stringify(l.before))}<br>after: ${esc(JSON.stringify(l.after))}${l.remarks ? `<br>remarks: ${esc(l.remarks)}` : ""}</div>`).join("") || '<p class="muted small">None.</p>'}</div>`;
  document.body.appendChild(el);
  el.querySelector("#close").onclick = () => el.remove();
  el.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => run(async () => {
    await q(db.rpc("verify_task", { p_task: t.task_id, p_status: b.dataset.set, p_by: ADMIN, p_comment: el.querySelector("#comment").value }));
    el.remove(); toast(`Marked ${b.dataset.set}`); render();
  }));
  el.querySelector("#post").onclick = () => run(async () => {
    await q(db.from("comments").insert({ task_id: t.task_id, who: ADMIN, comment: el.querySelector("#newComment").value }));
    el.remove(); openTask(t);
  });
}

run(load);
