import { db, q, esc, fmtDate, fmtDateTime, configured, setupPanel } from "../lib/db.js";

const app = document.getElementById("app");
if (!configured) setupPanel(app);

const state = {
  surveyor: localStorage.getItem("mati.surveyor") || "dilip",
  village: localStorage.getItem("mati.village") || "",
  tab: "pending", nav: "task", tasks: [], templates: {}, farmers: [], screen: null,
};
const TABS = { pending: ["open", "planned"], completed: ["collected", "approved", "discarded", "expired", "cancelled"], reported: ["reported"] };

function toast(msg, isError) {
  const el = Object.assign(document.createElement("div"), { className: "toast" + (isError ? " error" : ""), textContent: msg });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
async function run(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

async function load() {
  const [tasks, templates, farmers] = await Promise.all([
    q(db.from("task_list").select("*").eq("season_status", "active").order("opens_at")),
    q(db.from("survey_templates").select("*")),
    q(db.from("farmers").select("*").order("name")),
  ]);
  state.tasks = tasks; state.farmers = farmers;
  state.templates = Object.fromEntries(templates.map((t) => [t.id, t]));
}

function villages() { return [...new Set(state.farmers.map((f) => f.village).filter(Boolean))].sort(); }

function render() {
  const vs = villages();
  if (state.village && !vs.includes(state.village)) state.village = "";
  app.innerHTML = `
    <header>
      <select id="village" aria-label="Village"><option value="">All villages</option>${vs.map((v) => `<option ${v === state.village ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <div class="avatar" id="who" title="Change surveyor">${esc(state.surveyor.slice(0, 2).toUpperCase())}</div>
    </header>
    <div id="body" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
    <nav>
      ${[["task", "☰", "Task"], ["farmer", "👤", "Farmer"], ["village", "🌾", "Village"], ["more", "▦", "More"]].map(([k, i, l]) => `<button data-nav="${k}" class="${state.nav === k ? "active" : ""}"><span>${i}</span>${l}</button>`).join("")}
    </nav>`;
  app.querySelector("#village").onchange = (e) => { state.village = e.target.value; localStorage.setItem("mati.village", state.village); render(); };
  app.querySelector("#who").onclick = () => { const n = prompt("Surveyor name", state.surveyor); if (n) { state.surveyor = n.trim(); localStorage.setItem("mati.surveyor", state.surveyor); render(); } };
  app.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => { state.nav = b.dataset.nav; state.screen = null; render(); });
  const body = app.querySelector("#body");
  if (state.screen) renderForm(body, state.screen);
  else if (state.nav === "farmer") renderFarmers(body);
  else if (state.nav === "task") renderTasks(body);
  else body.innerHTML = '<p class="empty">Coming later.</p>';
}

function renderTasks(body) {
  const list = state.tasks.filter((t) => TABS[state.tab].includes(t.effective_status) && (!state.village || t.village === state.village));
  body.innerHTML = `
    <h1 class="title">Tasks</h1>
    <div class="tabs">${Object.keys(TABS).map((k) => `<button data-tab="${k}" class="${state.tab === k ? "active" : ""}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
    <div class="list">${list.length ? list.map((t) => `
      <div class="task ${t.effective_status === "planned" ? "upcoming" : ""}" data-task="${t.id}" role="button" tabindex="0">
        <div class="top"><span>T${t.task_no}</span><span>${t.effective_status === "planned" ? "Opens: " + fmtDate(t.opens_at) : t.closes_at ? "Ends: " + fmtDate(t.closes_at) : "No end date"}</span></div>
        <div>Farmer: ${esc(t.farmer_name)}</div>
        <div>${esc(t.template_name)} ${state.tab !== "pending" ? `<span class="chip ${t.effective_status}">${t.effective_status}</span>` : ""}</div>
      </div>`).join("") : `<p class="empty">Nothing ${state.tab}.</p>`}</div>`;
  body.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  body.querySelectorAll("[data-task]").forEach((el) => {
    const open = () => { state.screen = state.tasks.find((t) => t.id === el.dataset.task); render(); };
    el.onclick = open; el.onkeydown = (e) => e.key === "Enter" && open();
  });
}

async function renderForm(body, t) {
  const tpl = state.templates[t.template_id];
  const editable = ["open", "reported"].includes(t.effective_status);
  body.innerHTML = '<p class="empty">Loading…</p>';
  const [resp, comments] = await Promise.all([
    q(db.from("responses").select("*").eq("task_id", t.id).maybeSingle()),
    q(db.from("comments").select("*").eq("task_id", t.id).order("created_at")),
  ]);
  const v = (k) => resp?.data?.[k] ?? "";
  body.innerHTML = `
    <div class="screen">
      <div class="row" style="padding:8px 0"><button id="back">← Back</button><h2 class="grow" style="margin:0">${esc(tpl.name)}</h2><span class="chip ${t.effective_status}">${t.effective_status}</span></div>
      <p class="muted small">T${t.task_no} · ${esc(t.farmer_name)} · ${esc(t.village || "")}<br>${esc(t.reason)}</p>
      ${t.effective_status === "reported" && comments.length ? `<div class="card" style="border-color:var(--danger)"><b>Needs correction</b><ul>${comments.map((c) => `<li>@${esc(c.author)}: ${esc(c.body)}</li>`).join("")}</ul></div>` : ""}
      <form id="f" class="card">
        ${tpl.fields.map((f) => `<label>${esc(f.label)}
          ${f.type === "select" ? `<select name="${esc(f.key)}" ${editable ? "" : "disabled"}><option value="">—</option>${f.options.map((o) => `<option ${v(f.key) === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
            : `<input name="${esc(f.key)}" type="${f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}" ${f.type === "number" ? 'step="any"' : ""} value="${esc(v(f.key))}" ${editable ? "" : "disabled"}>`}
        </label>`).join("")}
        ${editable ? `<label>Remarks (optional) <input name="__remarks"></label><button class="primary" style="width:100%;margin-top:10px">${resp ? "Resubmit" : "Submit"}</button>` : `<p class="muted small">${resp ? `Submitted v${resp.version} by ${esc(resp.updated_by || "?")} on ${fmtDateTime(resp.updated_at)}` : "Not yet open."}</p>`}
      </form>
    </div>`;
  body.querySelector("#back").onclick = () => { state.screen = null; render(); };
  body.querySelector("#f").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const raw = Object.fromEntries(new FormData(e.target));
    const remarks = raw.__remarks || null; delete raw.__remarks;
    const data = Object.fromEntries(tpl.fields.map((f) => [f.key, f.type === "number" && raw[f.key] !== "" ? Number(raw[f.key]) : raw[f.key] || null]));
    await q(db.rpc("submit_response", { p_task: t.id, p_data: data, p_by: state.surveyor, p_remarks: remarks }));
    toast("Submitted"); state.screen = null; state.tab = "completed"; await load(); render();
  }); };
}

function renderFarmers(body) {
  const list = state.farmers.filter((f) => !state.village || f.village === state.village);
  body.innerHTML = `
    <h1 class="title">Farmers</h1>
    <div class="list">
      ${list.map((f) => `<div class="task"><div>${esc(f.name)}</div><div class="small muted">${esc(f.mobile || "")} · ${esc(f.village || "")}</div></div>`).join("") || '<p class="empty">No farmers.</p>'}
      <form id="nf" class="card"><h3>Register a farmer</h3>
        <label>Name <input name="name" required></label><label>Mobile <input name="mobile"></label><label>Village <input name="village" value="${esc(state.village)}" required></label>
        <button class="primary" style="width:100%;margin-top:10px">Add</button></form>
    </div>`;
  body.querySelector("#nf").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const az = state.tasks[0]?.az_id || (await q(db.from("seasons").select("az_id").eq("status", "active").limit(1).single())).az_id;
    await q(db.from("farmers").insert({ ...Object.fromEntries(new FormData(e.target)), az_id: az }));
    toast("Farmer added; their first task is ready"); await load(); state.nav = "task"; render();
  }); };
}

if (configured) run(async () => { await load(); render(); });
