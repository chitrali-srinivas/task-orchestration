import { db, q, esc, date, toast, run } from "../lib/db.js";

const app = document.getElementById("app");
let tasks = [], templates = {}, farmers = [], seasons = [];
let tab = "pending", nav = "task", village = "", open = null;
const who = () => localStorage.getItem("who") || "surveyor";

async function load() {
  const [t, tpl, f, s] = await Promise.all([
    q(db.from("survey_response").select("*, farmer(name, village), season!inner(status)").eq("season.status", "active").order("planned_start_date")),
    q(db.from("survey_template_master").select("id, name, questions, statuses")),
    q(db.from("farmer").select("*").order("name")),
    q(db.from("season").select("*").eq("status", "active")),
  ]);
  tasks = t; farmers = f; seasons = s;
  templates = Object.fromEntries(tpl.map((x) => [x.id, x]));
  render();
}

// Pending = the survey's first status (task created). Completed = anything after.
const isPending = (t) => t.status === templates[t.survey_template_id]?.statuses[0];

function render() {
  const villages = [...new Set(farmers.map((f) => f.village).filter(Boolean))].sort();
  app.innerHTML = `
    <header>
      <select id="village"><option value="">All villages</option>${villages.map((v) => `<option ${v === village ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <div class="sr" id="who" title="Who are you?">${esc(who().slice(0, 2).toUpperCase())}</div>
    </header>
    <div id="body" style="flex:1;display:flex;flex-direction:column"></div>
    <nav>${[["task", "☰", "Task"], ["farmer", "👤", "Farmer"]].map(([k, i, l]) => `<button data-nav="${k}" class="${k === nav ? "active" : ""}"><span>${i}</span>${l}</button>`).join("")}</nav>`;
  app.querySelector("#village").onchange = (e) => { village = e.target.value; render(); };
  app.querySelector("#who").onclick = () => { const n = prompt("Your name", who()); if (n) { localStorage.setItem("who", n.trim()); render(); } };
  app.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => { nav = b.dataset.nav; open = null; render(); });
  open ? renderForm() : nav === "farmer" ? renderFarmers() : renderList();
}

function renderList() {
  const list = tasks.filter((t) => (tab === "pending") === isPending(t) && (!village || t.farmer.village === village));
  app.querySelector("#body").innerHTML = `
    <h1 class="title">Task's</h1>
    <div class="tabs">${["pending", "completed"].map((k) => `<button data-tab="${k}" class="${k === tab ? "active" : ""}">${k}</button>`).join("")}</div>
    <div class="list">${list.map((t) => `
      <div class="task" data-task="${t.task_id}">
        <div class="top"><span>T${t.task_no}</span><span>${t.planned_end_date ? "Ends: " + date(t.planned_end_date) : "Starts: " + date(t.planned_start_date)}</span></div>
        <div>Farmer: ${esc(t.farmer.name)}</div>
        <div>${esc(t.task_type)} ${tab === "completed" ? `<span class="status">${esc(t.status)}</span>` : ""}</div>
      </div>`).join("") || `<p class="empty">Nothing ${tab}.</p>`}</div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
  app.querySelectorAll("[data-task]").forEach((el) => el.onclick = () => { open = tasks.find((t) => t.task_id === el.dataset.task); render(); });
}

function renderForm() {
  const t = open, fields = templates[t.survey_template_id].questions, v = t.survey_response ?? {};
  const input = (f) => {
    const dis = isPending(t) ? "" : "disabled", req = f.required ? "required" : "";
    if (f.type === "select") return `<select name="${f.key}" ${dis} ${req}><option value="">—</option>${f.options.map((o) => `<option ${v[f.key] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    if (f.type === "yes/no") return `<select name="${f.key}" ${dis} ${req}><option value="">—</option><option ${v[f.key] === "yes" ? "selected" : ""}>yes</option><option ${v[f.key] === "no" ? "selected" : ""}>no</option></select>`;
    return `<input name="${f.key}" type="${f.type}" value="${esc(v[f.key])}" ${dis} ${req} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}>`;
  };
  app.querySelector("#body").innerHTML = `
    <div class="list">
      <div class="row" style="padding:8px 0"><button id="back">←</button><h1 class="grow" style="margin:0">${esc(t.task_type)}</h1><span class="status">${esc(t.status)}</span></div>
      <p class="small muted">T${t.task_no} · Farmer: ${esc(t.farmer.name)} · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "no end"}</p>
      <form id="form">
        ${fields.map((f) => `<label>${esc(f.label)}${f.required ? " *" : ""}${input(f)}${f.help ? `<div class="small muted">${esc(f.help)}</div>` : ""}</label>`).join("")}
        ${isPending(t) ? `<label>Remarks<input name="__remarks"></label><button class="primary" style="width:100%;margin-top:12px">Submit</button>` : ""}
      </form>
    </div>`;
  app.querySelector("#back").onclick = () => { open = null; render(); };
  app.querySelector("#form").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const data = Object.fromEntries(new FormData(e.target));
    const remarks = data.__remarks; delete data.__remarks;
    await q(db.rpc("submit_response", { p_task: t.task_id, p_response: data, p_by: who(), p_remarks: remarks || null }));
    toast("Submitted"); open = null; tab = "completed"; load();
  }); };
}

function renderFarmers() {
  const s = seasons[0];
  app.querySelector("#body").innerHTML = `
    <h1 class="title">Farmers</h1>
    <div class="list">
      ${farmers.filter((f) => !village || f.village === village).map((f) => `<div class="task"><div>${esc(f.name)}</div><div class="muted">${esc(f.mobile ?? "")} · ${esc(f.village ?? "")}</div></div>`).join("") || '<p class="empty">No farmers yet.</p>'}
      <form id="nf" class="card"><h3>Register a farmer</h3>
        <label>Name<input name="name" required></label><label>Mobile<input name="mobile"></label><label>Village<input name="village" value="${esc(village)}"></label>
        <label>Base<input name="base" value="${esc(s?.base ?? "")}"></label><label>AZ<input name="az_name" value="${esc(s?.az_name ?? "")}"></label>
        <button class="primary" style="width:100%;margin-top:12px">Add farmer</button></form>
    </div>`;
  app.querySelector("#nf").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    await q(db.from("farmer").insert({ ...f, mobile: f.mobile || null, village: f.village || null, base: f.base || null, az_name: f.az_name || null }));
    toast("Farmer added"); nav = "task"; load();
  }); };
}

run(load);
