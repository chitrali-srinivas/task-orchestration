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
      <input id="who" value="${esc(localStorage.getItem("who") ?? "")}" placeholder="Your name" class="ml-auto h-8 w-28 rounded-full bg-muted px-3 text-right text-xs font-semibold outline-none placeholder:font-normal">
    </header>
    <div id="body" class="flex flex-1 flex-col"></div>
    <nav class="flex border-t pb-3 pt-2">${[["task", "Task", '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'], ["farmer", "Farmer", '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>']].map(([k, l, p]) => `<button data-nav="${k}" class="flex flex-1 flex-col items-center gap-1 text-[11px] ${k === nav ? "text-foreground" : "text-muted-foreground"}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>${l}</button>`).join("")}</nav>`;
  app.querySelector("#village").onchange = (e) => { village = e.target.value; render(); };
  app.querySelector("#who").onchange = (e) => localStorage.setItem("who", e.target.value.trim());
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

// ───────── One control per question type (types from the survey builder) ─────────
const EMOJIS = ["😠", "🙁", "😐", "🙂", "😄"];
function control(f, v, on) {
  const dis = on ? "" : "disabled", req = f.required ? "required" : "", n = esc(f.key);
  const choices = (type, opts, checked) => `<div class="space-y-2">${opts.map((o) => `<label class="flex items-center gap-2 rounded-md border px-3 py-2"><input type="${type}" name="${n}" value="${esc(o)}" ${checked(o) ? "checked" : ""} ${dis} ${type === "radio" ? req : ""} class="h-4 w-4 accent-primary"><span>${esc(o)}</span></label>`).join("")}</div>`;
  const text = (type, extra = "") => `<input type="${type}" name="${n}" value="${esc(v ?? f.default ?? "")}" ${dis} ${req} ${extra} class="${ui.input}">`;
  const pair = (a, b, type = "text", ph = ["", ""]) => `<div class="grid grid-cols-2 gap-2"><input type="${type}" name="${n}.${a}" value="${esc(v?.[a] ?? "")}" placeholder="${ph[0]}" ${dis} ${req} class="${ui.input}"><input type="${type}" name="${n}.${b}" value="${esc(v?.[b] ?? "")}" placeholder="${ph[1]}" ${dis} ${req} class="${ui.input}"></div>`;
  switch (f.type) {
    case "Radio":             return choices("radio", f.options ?? [], (o) => v === o);
    case "Checkbox":          return choices("checkbox", f.options ?? [], (o) => (v ?? []).includes(o));
    case "Dropdown":          return `<select name="${n}" ${dis} ${req} class="${ui.select}"><option value="">—</option>${(f.options ?? []).map((o) => `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    case "Selected Dropdown": return `<input list="dl-${n}" name="${n}" value="${esc(v ?? "")}" placeholder="Type to search" ${dis} ${req} class="${ui.input}"><datalist id="dl-${n}">${(f.options ?? []).map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;
    case "Rank":              return `<p class="text-[11px] text-muted-foreground">Number each option in order of preference (1 = first).</p><div class="space-y-2">${(f.options ?? []).map((o) => `<div class="flex items-center gap-2"><input type="number" min="1" max="${f.options.length}" name="${n}.${esc(o)}" value="${esc(v?.[o] ?? "")}" ${dis} class="${ui.input} w-16"><span>${esc(o)}</span></div>`).join("")}</div>`;
    case "Emoji":             return `<div class="flex justify-between">${EMOJIS.map((e, i) => `<label class="cursor-pointer"><input type="radio" name="${n}" value="${i + 1}" ${Number(v) === i + 1 ? "checked" : ""} ${dis} ${req} class="peer sr-only"><span class="block rounded-full border p-2 text-2xl peer-checked:border-primary peer-checked:bg-accent">${e}</span></label>`).join("")}</div>`;
    case "Rating":            return `<div class="flex gap-2">${[1, 2, 3, 4, 5].map((i) => `<label class="cursor-pointer"><input type="radio" name="${n}" value="${i}" ${Number(v) === i ? "checked" : ""} ${dis} ${req} class="peer sr-only"><span class="block h-10 w-10 rounded-md border text-center leading-10 peer-checked:bg-primary peer-checked:text-primary-foreground">${i}</span></label>`).join("")}</div>`;
    case "TextArea":          return `<textarea name="${n}" rows="4" ${dis} ${req} ${f.minLength ? `minlength="${f.minLength}"` : ""} ${f.maxLength ? `maxlength="${f.maxLength}"` : ""} class="${ui.input} h-auto">${esc(v ?? "")}</textarea>`;
    case "Number":            return `<div class="flex items-center gap-2">${text("number", `${f.format === "integer" ? 'step="1"' : 'step="any"'} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}`)}${f.unit ? `<span class="text-sm text-muted-foreground">${esc(f.unit)}</span>` : ""}</div>`;
    case "Date":              return text("date", `${f.min ? `min="${f.min}"` : ""} ${f.max ? `max="${f.max}"` : ""}`);
    case "DateRange":         return pair("from", "to", "date");
    case "Time":              return text("time");
    case "Picture Input": case "Audio": case "Video": case "Document":
      return `<input type="file" name="${n}" ${{ "Picture Input": 'accept="image/*" capture="environment"', Audio: 'accept="audio/*"', Video: 'accept="video/*" capture="environment"', Document: 'accept=".pdf,.doc,.docx,.xls,.xlsx"' }[f.type]} ${dis} ${req && !v ? "required" : ""} class="${ui.input} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs">${v ? `<p class="text-[11px] text-muted-foreground">Attached: ${esc(v)}</p>` : ""}`;
    case "Map":               return pair("lat", "lng", "number", ["Latitude", "Longitude"]) + (on ? `<button type="button" data-gps="${n}" class="${ui.sm} mt-2">Use my location</button>` : "");
    case "PolygonBoundary":   return `<textarea name="${n}" rows="3" placeholder="lat,lng per line" ${dis} ${req} class="${ui.input} h-auto font-mono text-xs">${esc(v ?? "")}</textarea>`;
    case "QRCode":            return text("text", 'placeholder="Scan or type the code"');
    case "Repeater_QT":       return `<p class="text-xs text-muted-foreground">Repeater groups are not supported on this phone build yet.</p>`;
    default:                  return text("text", `${f.minLength ? `minlength="${f.minLength}"` : ""} ${f.maxLength ? `maxlength="${f.maxLength}"` : ""} ${f.regex ? `pattern="${esc(f.regex)}"` : ""}`);
  }
}

// Read the answers back out of the form, per type.
function answers(form, fields) {
  const fd = new FormData(form), out = {};
  for (const f of fields) {
    const k = f.key;
    switch (f.type) {
      case "Checkbox":        out[k] = fd.getAll(k); break;
      case "Rank":            out[k] = Object.fromEntries((f.options ?? []).map((o) => [o, Number(fd.get(`${k}.${o}`)) || null])); break;
      case "DateRange":       out[k] = { from: fd.get(`${k}.from`) || null, to: fd.get(`${k}.to`) || null }; break;
      case "Map":             out[k] = { lat: Number(fd.get(`${k}.lat`)) || null, lng: Number(fd.get(`${k}.lng`)) || null }; break;
      case "Number": case "Rating": case "Emoji": out[k] = fd.get(k) === "" || fd.get(k) == null ? null : Number(fd.get(k)); break;
      case "Picture Input": case "Audio": case "Video": case "Document": { const file = fd.get(k); out[k] = file?.name || open.survey_response?.[k] || null; break; }
      case "Repeater_QT":     break;
      default:                out[k] = fd.get(k) ?? null;
    }
  }
  return out;
}

function renderForm() {
  const t = open, fields = templates[t.survey_template_id].questions, v = t.survey_response ?? {}, on = isPending(t);
  app.querySelector("#body").innerHTML = `
    <div class="flex-1 px-4 pb-4">
      <div class="flex items-center gap-2 py-2"><button id="back" class="${ui.icon}">←</button><h1 class="flex-1 text-lg font-semibold">${esc(t.task_type)}</h1><span class="${ui.badgeSec}">${esc(t.status)}</span></div>
      <p class="mb-3 text-xs text-muted-foreground">T${t.task_no} · Farmer: ${esc(t.farmer.name)} · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "no end"}</p>
      <form id="form" class="space-y-5">
        ${fields.map((f, i) => `<div class="space-y-1.5"><label class="${ui.label}"><span class="mr-1 text-muted-foreground">${i + 1}.</span>${esc(f.label)}${f.required ? ' <span class="text-destructive">*</span>' : ""}</label>${control(f, v[f.key], on)}${f.help ? `<p class="text-xs text-muted-foreground">${esc(f.help)}</p>` : ""}</div>`).join("")}
        ${on ? field("Remarks", `<input name="__remarks" class="${ui.input}">`) + `<button class="${ui.btn} w-full">Submit</button>` : ""}
      </form>
    </div>`;
  app.querySelector("#back").onclick = () => { open = null; render(); };
  app.querySelectorAll("[data-gps]").forEach((b) => b.onclick = () => navigator.geolocation?.getCurrentPosition((p) => {
    app.querySelector(`[name="${b.dataset.gps}.lat"]`).value = p.coords.latitude.toFixed(6);
    app.querySelector(`[name="${b.dataset.gps}.lng"]`).value = p.coords.longitude.toFixed(6);
  }, () => toast("Location not available", true)));
  app.querySelector("#form").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const data = answers(e.target, fields);
    const remarks = new FormData(e.target).get("__remarks");
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
