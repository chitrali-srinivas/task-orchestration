import { db, q, esc, date, toast, run } from "../lib/db.js";

const TABS = {
  pending:   ["planned"],
  completed: ["pending verification", "verified", "algo verified", "completed"],
  reported:  ["discarded"],
};
const SURVEYOR = "dilip";
const app = document.getElementById("app");
let tasks = [], templates = {}, tab = "pending", village = "", open = null;

async function load() {
  const [t, tpl] = await Promise.all([
    q(db.from("survey_response").select("*, farmer(name, village), season!inner(status)").eq("season.status", "active").order("planned_start_date")),
    q(db.from("survey_template_master").select("*")),
  ]);
  tasks = t;
  templates = Object.fromEntries(tpl.map((x) => [x.id, x]));
  render();
}

function render() {
  const villages = [...new Set(tasks.map((t) => t.farmer.village).filter(Boolean))].sort();
  app.innerHTML = `
    <header>
      <select id="village"><option value="">All villages</option>${villages.map((v) => `<option ${v === village ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <div class="sr">SR</div>
    </header>
    <div id="body" style="flex:1;display:flex;flex-direction:column"></div>
    <nav>${[["☰", "Task"], ["👤", "Farmer"], ["🌾", "Village"], ["▦", "More"]].map(([i, l]) => `<button><span>${i}</span>${l}</button>`).join("")}</nav>`;
  app.querySelector("#village").onchange = (e) => { village = e.target.value; render(); };
  open ? renderForm() : renderList();
}

function renderList() {
  const list = tasks.filter((t) => TABS[tab].includes(t.status) && (!village || t.farmer.village === village));
  app.querySelector("#body").innerHTML = `
    <h1 class="title">Task's</h1>
    <div class="tabs">${Object.keys(TABS).map((k) => `<button data-tab="${k}" class="${k === tab ? "active" : ""}">${k}</button>`).join("")}</div>
    <div class="list">${list.map((t) => `
      <div class="task" data-task="${t.task_id}">
        <div class="top"><span>T${t.task_no}</span><span>Ends: ${t.planned_end_date ? date(t.planned_end_date) : "—"}</span></div>
        <div>Farmer: ${esc(t.farmer.name)}</div>
        <div>${esc(t.task_type)}</div>
      </div>`).join("") || `<p class="empty">Nothing ${tab}.</p>`}</div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
  app.querySelectorAll("[data-task]").forEach((el) => el.onclick = () => { open = tasks.find((t) => t.task_id === el.dataset.task); render(); });
}

function renderForm() {
  const t = open, fields = templates[t.survey_template_id].survey_details, v = t.survey_response ?? {};
  const editable = tab !== "completed";
  app.querySelector("#body").innerHTML = `
    <div class="list">
      <div class="row" style="padding:8px 0"><button id="back">←</button><h1 class="grow" style="margin:0">${esc(t.task_type)}</h1><span class="status">${esc(t.status)}</span></div>
      <p class="small muted">T${t.task_no} · Farmer: ${esc(t.farmer.name)} · Ends: ${t.planned_end_date ? date(t.planned_end_date) : "—"}</p>
      <form id="form">
        ${fields.map((f) => `<label>${esc(f.label)}${f.type === "select"
          ? `<select name="${f.key}" ${editable ? "" : "disabled"}><option value="">—</option>${f.options.map((o) => `<option ${v[f.key] === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
          : `<input name="${f.key}" type="${f.type}" value="${esc(v[f.key])}" ${editable ? "" : "disabled"}>`}</label>`).join("")}
        ${editable ? `<label>Remarks<input name="__remarks"></label><button class="primary" style="width:100%;margin-top:12px">Submit</button>` : ""}
      </form>
    </div>`;
  app.querySelector("#back").onclick = () => { open = null; render(); };
  app.querySelector("#form").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const data = Object.fromEntries(new FormData(e.target));
    const remarks = data.__remarks; delete data.__remarks;
    await q(db.rpc("submit_response", { p_task: t.task_id, p_response: data, p_by: SURVEYOR, p_remarks: remarks || null }));
    toast("Submitted"); open = null; tab = "completed"; load();
  }); };
}

run(load);
