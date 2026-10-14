import { db, q, esc, date, toast, run } from "../lib/db.js";
import { ui, field } from "../lib/ui.js";

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
    <header class="flex items-center gap-2 px-4 pt-4 pb-1">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      <select id="village" class="bg-transparent font-semibold outline-none"><option value="">All villages</option>${villages.map((v) => `<option ${v === village ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <button id="who" class="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold" title="Who are you?">${esc(who().slice(0, 2).toUpperCase())}</button>
    </header>
    <div id="body" class="flex flex-1 flex-col"></div>
    <nav class="flex border-t pb-3 pt-2">${[["task", "Task", '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'], ["farmer", "Farmer", '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>']].map(([k, l, p]) => `<button data-nav="${k}" class="flex flex-1 flex-col items-center gap-1 text-[11px] ${k === nav ? "text-foreground" : "text-muted-foreground"}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>${l}</button>`).join("")}</nav>`;
  app.querySelector("#village").onchange = (e) => { village = e.target.value; render(); };
  app.querySelector("#who").onclick = () => { const n = prompt("Your name", who()); if (n) { localStorage.setItem("who", n.trim()); render(); } };
  app.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => { nav = b.dataset.nav; open = null; render(); });
  open ? renderForm() : nav === "farmer" ? renderFarmers() : renderList();
}

function renderList() {
  const list = tasks.filter((t) => (tab === "pending") === isPending(t) && (!village || t.farmer.village === village));
  app.querySelector("#body").innerHTML = `
    <h1 class="px-4 pt-2 text-xl font-semibold">Task's</h1>
    <div class="px-4 py-3"><div class="${ui.tabs} w-full">${["pending", "completed"].map((k) => `<button data-tab="${k}" class="${ui.tab} flex-1 capitalize${k === tab ? ui.tabOn : ""}">${k}</button>`).join("")}</div></div>
    <div class="flex-1 space-y-2 px-4 pb-4">${list.map((t) => `
      <button class="w-full rounded-lg bg-muted p-3 text-left text-xs" data-task="${t.task_id}">
        <div class="flex justify-between text-[10px] text-muted-foreground"><span>T${t.task_no}</span><span>${t.planned_end_date ? "Ends: " + date(t.planned_end_date) : "Starts: " + date(t.planned_start_date)}</span></div>
        <div class="mt-1">Farmer: ${esc(t.farmer.name)}</div>
        <div class="font-medium">${esc(t.task_type)} ${tab === "completed" ? `<span class="${ui.badgeSec} ml-1 font-normal">${esc(t.status)}</span>` : ""}</div>
      </button>`).join("") || `<p class="py-10 text-center text-muted-foreground">Nothing ${tab}.</p>`}</div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
  app.querySelectorAll("[data-task]").forEach((el) => el.onclick = () => { open = tasks.find((t) => t.task_id === el.dataset.task); render(); });
}

function renderForm() {
  const t = open, fields = templates[t.survey_template_id].questions, v = t.survey_response ?? {};
  const input = (f) => {
    const dis = isPending(t) ? "" : "disabled", req = f.required ? "required" : "";
    if (f.type === "select") return `<select name="${f.key}" ${dis} ${req} class="${ui.select}"><option value="">—</option>${f.options.map((o) => `<option ${v[f.key] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    if (f.type === "yes/no") return `<select name="${f.key}" ${dis} ${req} class="${ui.select}"><option value="">—</option><option ${v[f.key] === "yes" ? "selected" : ""}>yes</option><option ${v[f.key] === "no" ? "selected" : ""}>no</option></select>`;
    return `<input name="${f.key}" type="${f.type}" value="${esc(v[f.key])}" ${dis} ${req} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} class="${ui.input}">`;
  };
  app.querySelector("#body").innerHTML = `
    <div class="flex-1 px-4 pb-4">
      <div class="flex items-center gap-2 py-2"><button id="back" class="${ui.icon}">←</button><h1 class="flex-1 text-lg font-semibold">${esc(t.task_type)}</h1><span class="${ui.badgeSec}">${esc(t.status)}</span></div>
      <p class="mb-3 text-xs text-muted-foreground">T${t.task_no} · Farmer: ${esc(t.farmer.name)} · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "no end"}</p>
      <form id="form" class="space-y-4">
        ${fields.map((f) => field(`${esc(f.label)}${f.required ? " *" : ""}`, input(f) + (f.help ? `<p class="text-xs text-muted-foreground">${esc(f.help)}</p>` : ""))).join("")}
        ${isPending(t) ? field("Remarks", `<input name="__remarks" class="${ui.input}">`) + `<button class="${ui.btn} w-full">Submit</button>` : ""}
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
    <h1 class="px-4 pt-2 text-xl font-semibold">Farmers</h1>
    <div class="flex-1 space-y-2 px-4 py-3">
      ${farmers.filter((f) => !village || f.village === village).map((f) => `<div class="rounded-lg bg-muted p-3 text-xs"><div class="font-medium">${esc(f.name)}</div><div class="text-muted-foreground">${esc(f.mobile ?? "")} · ${esc(f.village ?? "")}</div></div>`).join("") || `<p class="py-6 text-center text-muted-foreground">No farmers yet.</p>`}
      <form id="nf" class="${ui.card} space-y-3 p-4"><h2 class="${ui.cardTitle}">Register a farmer</h2>
        ${field("Name", `<input name="name" required class="${ui.input}">`)}${field("Mobile", `<input name="mobile" class="${ui.input}">`)}${field("Village", `<input name="village" value="${esc(village)}" class="${ui.input}">`)}
        <div class="grid grid-cols-2 gap-3">${field("Base", `<input name="base" value="${esc(s?.base ?? "")}" class="${ui.input}">`)}${field("AZ", `<input name="az_name" value="${esc(s?.az_name ?? "")}" class="${ui.input}">`)}</div>
        <button class="${ui.btn} w-full">Add farmer</button></form>
    </div>`;
  app.querySelector("#nf").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    await q(db.from("farmer").insert({ ...f, mobile: f.mobile || null, village: f.village || null, base: f.base || null, az_name: f.az_name || null }));
    toast("Farmer added"); nav = "task"; load();
  }); };
}

run(load);
