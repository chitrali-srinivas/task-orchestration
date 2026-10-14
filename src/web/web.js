import { db, q, esc, fmtDate, fmtDateTime, describeRule, configured, setupPanel } from "../lib/db.js";

const app = document.getElementById("app");
if (!configured) setupPanel(app);

const state = { seasons: [], templates: [], seasonId: localStorage.getItem("mati.season") || null, tab: "flow", task: null };
const names = () => Object.fromEntries(state.templates.map((t) => [t.id, t.name]));
const ADMIN = "admin";

function toast(msg, isError) {
  const el = Object.assign(document.createElement("div"), { className: "toast" + (isError ? " error" : ""), textContent: msg });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
async function run(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

async function loadBase() {
  [state.seasons, state.templates] = await Promise.all([
    q(db.from("seasons").select("*").order("created_at")),
    q(db.from("survey_templates").select("*").order("name")),
  ]);
  if (!state.seasons.find((s) => s.id === state.seasonId)) state.seasonId = state.seasons[0]?.id || null;
}

// ───────── Layout ─────────
async function render() {
  const season = state.seasons.find((s) => s.id === state.seasonId);
  app.innerHTML = `
    <div class="layout">
      <aside>
        <div class="row" style="margin-bottom:12px"><h1 class="grow">Mati · Seasons</h1><a class="small" href="../mobile/">Mobile view ↗</a></div>
        ${state.seasons.map((s) => `<div class="season ${s.id === state.seasonId ? "active" : ""}" data-season="${s.id}">
            <div>${esc(s.name)}</div><div class="small muted">${esc(s.az_id)} · ${fmtDate(s.start_date)} → ${fmtDate(s.end_date)} <span class="chip ${s.status}">${s.status}</span></div></div>`).join("")}
        <details style="margin-top:12px"><summary class="muted">New season</summary>
          <form id="newSeason">
            <label>Name <input name="name" required></label>
            <label>AZ <input name="az_id" value="ERW" required></label>
            <div class="grid2"><label>Start <input name="start_date" type="date" required></label><label>End <input name="end_date" type="date" required></label></div>
            <button class="primary" style="margin-top:8px">Create</button>
          </form></details>
      </aside>
      <main id="main">${season ? "" : '<p class="empty">Create a season to begin.</p>'}</main>
    </div>`;
  app.querySelectorAll("[data-season]").forEach((el) => el.onclick = () => { state.seasonId = el.dataset.season; localStorage.setItem("mati.season", state.seasonId); render(); });
  app.querySelector("#newSeason").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const row = await q(db.from("seasons").insert(f).select().single());
    state.seasonId = row.id; await loadBase(); render();
  }); };
  if (season) await renderSeason(season);
}

async function renderSeason(season) {
  const main = app.querySelector("#main");
  const next = { draft: ["Start season", "active"], active: ["Complete season", "completed"], completed: [null] }[season.status];
  main.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <div class="grow"><h1>${esc(season.name)}</h1><div class="muted small">${esc(season.country)} · ${esc(season.az_id)} · ${fmtDate(season.start_date)} → ${fmtDate(season.end_date)} · ${esc(season.timezone)}</div></div>
      <span class="chip ${season.status}">${season.status}</span>
      ${next[0] ? `<button id="advance" class="primary">${next[0]}</button>` : ""}
    </div>
    <div class="tabs">${["flow", "tasks", "farmers", "templates"].map((t) => `<button data-tab="${t}" class="${state.tab === t ? "active" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
    <div id="tab"></div>`;
  main.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; renderSeason(season); });
  if (next[0]) main.querySelector("#advance").onclick = () => run(async () => {
    if (!confirm(`${next[0]}? ${next[1] === "active" ? "Season-start forms will be opened for every farmer in the AZ." : ""}`)) return;
    await q(db.from("seasons").update({ status: next[1] }).eq("id", season.id));
    await loadBase(); render(); toast(`Season is now ${next[1]}`);
  });
  await ({ flow: renderFlow, tasks: renderTasks, farmers: renderFarmers, templates: renderTemplates })[state.tab](season, main.querySelector("#tab"));
}

// ───────── Flow (rules) ─────────
async function renderFlow(season, el) {
  const rules = await q(db.from("season_rules").select("*").eq("season_id", season.id).order("position"));
  const opt = (list, sel) => list.map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("");
  el.innerHTML = `
    <div class="card">
      <h2>Flow</h2>
      <p class="muted small">Each line is one arrow in the season flow. Rules apply to future events; the farmer's data is never deleted.</p>
      ${rules.length ? rules.map((r, i) => `<div class="rule"><span class="n">${i + 1}.</span><span class="grow">${esc(describeRule(r, names()))}</span><button class="link" data-del="${r.id}">delete</button></div>`).join("") : '<p class="empty">No rules yet. Add the first one below.</p>'}
    </div>
    <div class="card">
      <h3>Add a rule</h3>
      <form id="rule">
        <div class="grid2">
          <label>When <select name="trigger_type"><option value="season_start">the season starts</option><option value="form_status">a form reaches a status</option></select></label>
          <span></span>
          <label class="fs">Form <select name="source_template_id">${opt(state.templates)}</select></label>
          <label class="fs">Status <select name="source_status"><option value="collected">collected (submitted)</option><option value="approved">approved</option><option value="reported">reported</option></select></label>
          <label class="fs">Only if field (optional) <input name="condition_field" placeholder="e.g. eligible"></label>
          <label class="fs">Operator / value <div class="row"><select name="condition_op" style="width:110px">${["eq", "neq", "gt", "gte", "lt", "lte", "contains"].map((o) => `<option>${o}</option>`).join("")}</select><input name="condition_value" class="grow" placeholder="value"></div></label>
          <label>Then <select name="action"><option value="open">open a form</option><option value="end">end the farmer's journey (disqualify)</option></select></label>
          <label class="op">Form <select name="template_id">${opt(state.templates)}</select></label>
          <label class="op">Opens <div class="row"><select name="open_type" style="width:140px"><option value="immediately">immediately</option><option value="after_days">after N days</option><option value="on_date">on date</option></select><input name="open_days" type="number" min="0" placeholder="days" class="grow"><input name="open_date" type="date" class="grow"></div></label>
          <label class="op">Closes <div class="row"><select name="close_type" style="width:140px"><option value="none">never (indefinite)</option><option value="after_days">N days after opening</option><option value="on_date">on date</option></select><input name="close_days" type="number" min="1" placeholder="days" class="grow"><input name="close_date" type="date" class="grow"></div></label>
        </div>
        <button class="primary" style="margin-top:8px">Add rule</button>
      </form>
    </div>`;
  const form = el.querySelector("#rule");
  const sync = () => {
    const isForm = form.trigger_type.value === "form_status", isOpen = form.action.value === "open";
    form.querySelectorAll(".fs").forEach((x) => x.style.display = isForm ? "" : "none");
    form.querySelectorAll(".op").forEach((x) => x.style.display = isOpen ? "" : "none");
    form.open_days.style.display = form.open_type.value === "after_days" ? "" : "none";
    form.open_date.style.display = form.open_type.value === "on_date" ? "" : "none";
    form.close_days.style.display = form.close_type.value === "after_days" ? "" : "none";
    form.close_date.style.display = form.close_type.value === "on_date" ? "" : "none";
    if (!isForm) form.action.value = "open";
    form.action.disabled = !isForm;
  };
  form.onchange = sync; sync();
  form.onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(form));
    const isForm = f.trigger_type === "form_status", isOpen = f.action === "open";
    const row = {
      season_id: season.id, position: rules.length + 1, trigger_type: f.trigger_type, action: isForm ? f.action : "open",
      source_template_id: isForm ? f.source_template_id : null, source_status: isForm ? f.source_status : null,
      condition_field: isForm && f.condition_field ? f.condition_field : null,
      condition_op: isForm && f.condition_field ? f.condition_op : null,
      condition_value: isForm && f.condition_field ? f.condition_value : null,
      template_id: isOpen ? f.template_id : null,
      open_type: isOpen ? f.open_type : "immediately", open_days: isOpen && f.open_type === "after_days" ? +f.open_days : null, open_date: isOpen && f.open_type === "on_date" ? f.open_date : null,
      close_type: isOpen ? f.close_type : "none", close_days: isOpen && f.close_type === "after_days" ? +f.close_days : null, close_date: isOpen && f.close_type === "on_date" ? f.close_date : null,
    };
    await q(db.from("season_rules").insert(row));
    toast("Rule added"); renderFlow(season, el);
  }); };
  el.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => run(async () => {
    if (!confirm("Delete this rule? Existing tasks are kept.")) return;
    await q(db.from("season_rules").delete().eq("id", b.dataset.del)); renderFlow(season, el);
  }));
}

// ───────── Tasks ─────────
async function renderTasks(season, el) {
  const tasks = await q(db.from("task_list").select("*").eq("season_id", season.id).order("task_no"));
  const counts = tasks.reduce((a, t) => (a[t.effective_status] = (a[t.effective_status] || 0) + 1, a), {});
  el.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 class="grow">Tasks</h2>${Object.entries(counts).map(([s, n]) => `<span class="chip ${s}">${s} ${n}</span>`).join(" ")}</div>
      ${tasks.length ? `<table><thead><tr><th>#</th><th>Farmer</th><th>Form</th><th>Status</th><th>Opens</th><th>Closes</th><th>Why</th></tr></thead><tbody>
        ${tasks.map((t) => `<tr class="clickable" data-task="${t.id}"><td>T${t.task_no}</td><td>${esc(t.farmer_name)}<div class="small muted">${esc(t.village || "")}</div></td><td>${esc(t.template_name)}</td><td><span class="chip ${t.effective_status}">${t.effective_status}</span></td><td>${fmtDate(t.opens_at)}</td><td>${t.closes_at ? fmtDate(t.closes_at) : "indefinite"}</td><td class="small muted">${esc(t.reason)}</td></tr>`).join("")}
      </tbody></table>` : '<p class="empty">No tasks yet. Start the season to open the first forms.</p>'}
    </div>`;
  el.querySelectorAll("[data-task]").forEach((tr) => tr.onclick = () => openTask(tasks.find((t) => t.id === tr.dataset.task), () => renderTasks(season, el)));
}

async function openTask(t, refresh) {
  const [resp, comments, logs] = await Promise.all([
    q(db.from("responses").select("*").eq("task_id", t.id).maybeSingle()),
    q(db.from("comments").select("*").eq("task_id", t.id).order("created_at")),
    q(db.from("change_logs").select("*").eq("task_id", t.id).order("changed_at", { ascending: false })),
  ]);
  const tpl = state.templates.find((x) => x.id === t.template_id);
  const label = (k) => tpl?.fields.find((f) => f.key === k)?.label || k;
  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.innerHTML = `
    <div class="row"><h2 class="grow">T${t.task_no} · ${esc(t.template_name)}</h2><button id="close">✕</button></div>
    <p class="muted">${esc(t.farmer_name)} · ${esc(t.village || "")} · <span class="chip ${t.effective_status}">${t.effective_status}</span></p>
    <p class="small muted">Opens ${fmtDateTime(t.opens_at)} · ${t.closes_at ? "closes " + fmtDateTime(t.closes_at) : "valid indefinitely"}<br>Why here: ${esc(t.reason)}</p>
    <div class="card"><h3>Response ${resp ? `<span class="muted small">v${resp.version} · by ${esc(resp.updated_by || "?")} · ${fmtDateTime(resp.updated_at)}</span>` : ""}</h3>
      ${resp ? `<table>${Object.entries(resp.data).map(([k, v]) => `<tr><th>${esc(label(k))}</th><td>${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`).join("")}</table>` : '<p class="muted">Not submitted yet.</p>'}
    </div>
    ${t.status === "collected" ? `<div class="card"><h3>Review</h3><textarea id="rc" placeholder="Comment (optional, required for report/discard)"></textarea>
      <div class="row" style="margin-top:8px"><button class="primary" data-review="approved">Approve</button><button data-review="reported">Report (needs correction)</button><button class="danger" data-review="discarded">Discard</button></div></div>` : ""}
    <div class="card"><h3>Comments</h3>
      ${comments.length ? `<ul>${comments.map((c) => `<li><b>@${esc(c.author)}</b> <span class="muted small">${fmtDateTime(c.created_at)}</span><br>${esc(c.body)}</li>`).join("")}</ul>` : '<p class="muted small">No comments.</p>'}
      <div class="row" style="margin-top:8px"><input id="cb" class="grow" placeholder="Write a comment…"><button id="cs">Post</button></div></div>
    <div class="card"><h3>Change log</h3>${logs.length ? `<ul class="log">${logs.map((l) => `<li>${fmtDateTime(l.changed_at)} · ${esc(l.changed_by || "system")} · <b>${esc(l.field === "status" ? "status" : label(l.field))}</b>: ${esc(JSON.stringify(l.before) ?? "—")} → ${esc(JSON.stringify(l.after) ?? "—")}${l.remarks ? ` <span class="muted">(${esc(l.remarks)})</span>` : ""}</li>`).join("")}</ul>` : '<p class="muted small">No changes yet.</p>'}</div>`;
  document.body.appendChild(drawer);
  const close = () => { drawer.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  drawer.querySelector("#close").onclick = close;
  drawer.querySelectorAll("[data-review]").forEach((b) => b.onclick = () => run(async () => {
    const comment = drawer.querySelector("#rc").value.trim();
    if (b.dataset.review !== "approved" && !comment) return toast("Add a comment explaining why", true);
    await q(db.rpc("review_task", { p_task: t.id, p_status: b.dataset.review, p_by: ADMIN, p_comment: comment || null }));
    toast(`Task ${b.dataset.review}`); close(); refresh();
  }));
  drawer.querySelector("#cs").onclick = () => run(async () => {
    const body = drawer.querySelector("#cb").value.trim();
    if (!body) return;
    await q(db.from("comments").insert({ task_id: t.id, author: ADMIN, body }));
    close(); openTask(t, refresh);
  });
}

// ───────── Farmers ─────────
async function renderFarmers(season, el) {
  const farmers = await q(db.from("farmers").select("*").eq("az_id", season.az_id).order("name"));
  const exits = await q(db.from("season_exits").select("*").eq("season_id", season.id));
  const exited = Object.fromEntries(exits.map((x) => [x.farmer_id, x.reason]));
  el.innerHTML = `
    <div class="card"><h2>Farmers in ${esc(season.az_id)}</h2>
      ${farmers.length ? `<table><thead><tr><th>Name</th><th>Mobile</th><th>Village</th><th>Journey</th></tr></thead><tbody>
        ${farmers.map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.mobile || "")}</td><td>${esc(f.village || "")}</td><td class="small">${exited[f.id] ? `<span class="chip cancelled">ended</span> <span class="muted">${esc(exited[f.id])}</span>` : "in progress"}</td></tr>`).join("")}
      </tbody></table>` : '<p class="empty">No farmers yet.</p>'}
    </div>
    <div class="card"><h3>Add farmer</h3><p class="muted small">In an active season, the season-start forms open for the new farmer right away.</p>
      <form id="farmer" class="row"><input name="name" placeholder="Name" required class="grow"><input name="mobile" placeholder="Mobile" class="grow"><input name="village" placeholder="Village" class="grow"><button class="primary">Add</button></form></div>`;
  el.querySelector("#farmer").onsubmit = (e) => { e.preventDefault(); run(async () => {
    await q(db.from("farmers").insert({ ...Object.fromEntries(new FormData(e.target)), az_id: season.az_id }));
    toast("Farmer added"); renderFarmers(season, el);
  }); };
}

// ───────── Templates ─────────
async function renderTemplates(season, el) {
  el.innerHTML = `
    <div class="card"><h2>Survey templates</h2>
      <table><thead><tr><th>ID</th><th>Name</th><th>Version</th><th>Fields</th></tr></thead><tbody>
        ${state.templates.map((t) => `<tr><td><code>${esc(t.id)}</code></td><td>${esc(t.name)}</td><td>${t.version}</td><td class="small muted">${t.fields.map((f) => `${esc(f.label)} (${f.type}${f.options ? ": " + f.options.join("/") : ""})`).join(", ")}</td></tr>`).join("")}
      </tbody></table></div>
    <div class="card"><h3>Add template</h3>
      <form id="tpl">
        <div class="grid2"><label>ID <input name="id" placeholder="plot_boundary" pattern="[a-z0-9_]+" required></label><label>Name <input name="name" required></label></div>
        <label>Fields, one per line: <code>key | label | type | option1,option2</code> (type: text, number, date, select)
          <textarea name="fields" placeholder="acres | Land (acres) | number&#10;crop | Crop | select | rice,wheat"></textarea></label>
        <button class="primary" style="margin-top:8px">Add template</button>
      </form></div>`;
  el.querySelector("#tpl").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const fields = f.fields.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((p) => p[0])
      .map(([key, label, type, opts]) => ({ key, label: label || key, type: type || "text", ...(opts ? { options: opts.split(",").map((s) => s.trim()) } : {}) }));
    await q(db.from("survey_templates").insert({ id: f.id, name: f.name, fields }));
    await loadBase(); toast("Template added"); renderTemplates(season, el);
  }); };
}

if (configured) run(async () => { await loadBase(); await render(); });
