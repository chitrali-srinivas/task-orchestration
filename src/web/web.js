import { db, q, esc, date, when, toast, run } from "../lib/db.js";
import { ui, field } from "../lib/ui.js";

const main = document.getElementById("main");
const crumbs = document.getElementById("crumbs");
const whoInput = document.getElementById("who");
whoInput.value = localStorage.getItem("who") ?? "";
whoInput.onchange = () => { localStorage.setItem("who", whoInput.value); avatar(); };
const who = () => whoInput.value || "hq";
const avatar = () => document.getElementById("avatar").textContent = who().slice(0, 2).toUpperCase();
avatar();

const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
const empty = (t) => `<p class="py-10 text-center text-sm text-muted-foreground">${t}</p>`;
const card = (title, body, desc = "", right = "") =>
  `<section class="${ui.card} mb-4"><div class="${ui.cardHead} flex-row items-start justify-between"><div><h2 class="${ui.cardTitle}">${title}</h2>${desc ? `<p class="${ui.cardDesc} mt-1">${desc}</p>` : ""}</div>${right}</div><div class="${ui.cardBody}">${body}</div></section>`;

// ───────── Routing ─────────
window.addEventListener("hashchange", route);
route();

function route() {
  const [, section = "seasons", id] = location.hash.split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("bg-sidebar-accent", a.dataset.nav === section));
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("font-medium", a.dataset.nav === section));
  run(() => ({ seasons: id ? seasonPage : seasonList })[section] ? ({ seasons: id ? seasonPage : seasonList })[section](id) : (location.hash = "#/seasons"));
}

// ───────── Season Management ─────────
async function seasonList() {
  crumbs.textContent = "Season Management";
  const list = await q(db.from("season").select("*").order("created_at", { ascending: false }));
  main.innerHTML = `
    <div class="mb-4 flex items-center justify-between"><h1 class="text-2xl font-semibold tracking-tight">Season Management</h1></div>
    ${card("New season", `<form id="new" class="grid items-end gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
      ${field("Season name", `<input name="name" required placeholder="e.g. Kharif 2026" class="${ui.input}">`)}
      ${field("Base", `<input name="base" placeholder="e.g. Seoni" class="${ui.input}">`)}
      ${field("AZ name", `<input name="az_name" placeholder="e.g. ERW" class="${ui.input}">`)}
      <button class="${ui.btn}">Create season</button></form>`)}
    <div class="${ui.card}"><table class="${ui.table}"><thead><tr class="border-b"><th class="${ui.th}">Season</th><th class="${ui.th}">Base</th><th class="${ui.th}">AZ</th><th class="${ui.th}">Status</th></tr></thead>
      <tbody>${list.map((s) => `<tr class="${ui.tr} cursor-pointer" onclick="location.hash='#/seasons/${s.id}'"><td class="${ui.td} font-medium">${esc(s.name)}</td><td class="${ui.td}">${esc(s.base ?? "")}</td><td class="${ui.td}">${esc(s.az_name ?? "")}</td><td class="${ui.td}"><span class="${s.status === "active" ? ui.badgeOk : ui.badgeSec}">${esc(s.status)}</span></td></tr>`).join("")}</tbody></table>
      ${list.length ? "" : empty("No seasons yet.")}</div>`;
  main.querySelector("#new").onsubmit = (e) => { e.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const s = await q(db.from("season").insert({ name: f.name.trim(), base: f.base || null, az_name: f.az_name || null }).select().single());
    location.hash = "#/seasons/" + s.id;
  }); };
}

async function seasonPage(id) {
  const [season, templates, arrows, tasks] = await Promise.all([
    q(db.from("season").select("*").eq("id", id).single()),
    q(db.from("survey_template_master").select("id, name, statuses, questions").order("name")),
    q(db.from("season_flow").select("*").eq("season_id", id).order("position")),
    q(db.from("survey_response").select("*, farmer(name, village)").eq("season_id", id).order("task_no")),
  ]);
  crumbs.innerHTML = `<a href="#/seasons" class="hover:text-foreground">Season Management</a> <span class="mx-1">›</span> ${esc(season.name)}`;
  const tpl = (tid) => templates.find((t) => t.id === tid);
  const inFlow = new Set(arrows.map((a) => a.to_template));
  const available = templates.filter((t) => !inFlow.has(t.id));
  let adding = null;   // from_template id ("" = Start) whose add form is open

  // Edge label on the connector above a node.
  const condition = (a) => {
    const whenTask = a.start_date ? `on ${date(a.start_date)}` : a.delay_days ? `after ${a.delay_days} days` : "immediately";
    return `<div class="mb-1 max-w-[220px] text-center text-[11px] leading-snug text-muted-foreground">${a.from_template ? `status = <b class="text-foreground">${esc(a.on_status)}</b>` : "season starts"}<br>create task <b class="text-foreground">${whenTask}</b>${a.end_date ? `<br>ends <b class="text-foreground">${date(a.end_date)}</b>` : ""}</div>`;
  };
  const addForm = (from) => `
    <form class="${ui.card} w-[300px] space-y-3 p-4 text-left" data-add="${from}">
      ${field("Survey", `<input list="surveys" name="survey" placeholder="Search and pick a survey" required class="${ui.input}">`)}
      <datalist id="surveys">${available.map((t) => `<option value="${esc(t.name)}">`).join("")}</datalist>
      ${from ? field(`When status of ${esc(tpl(from).name)} =`, `<select name="on_status" class="${ui.select}">${opt(tpl(from).statuses.map((s) => [s, s]))}</select>`) : ""}
      ${field("Create task", `<div class="flex flex-wrap gap-2"><select name="mode" class="${ui.select} w-full"><option value="now">Immediately</option><option value="days">After N days</option><option value="date">On date</option></select><input name="days" type="number" min="1" placeholder="days" class="${ui.input} w-24"><input name="start_date" type="date" class="${ui.input} w-40"></div>`)}
      ${field("Ends on (optional)", `<input name="end_date" type="date" class="${ui.input} w-40">`)}
      <div class="flex gap-2 pt-1"><button class="${ui.btn}">Add</button><button type="button" data-cancel class="${ui.outline}">Cancel</button></div>
    </form>`;
  // One tree node per arrow; its children are the arrows that start from it. Rendered as a CSS tree (ul/li with connector lines).
  const node = (a) => `
    <li>${condition(a)}
      <div class="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-sm">${esc(tpl(a.to_template)?.name)}<button data-del="${a.id}" class="text-xs text-muted-foreground hover:text-destructive" title="Remove">✕</button></div>
      ${children(a.to_template)}
    </li>`;
  const children = (from) => `<ul>${arrows.filter((a) => (a.from_template ?? "") === from).map(node).join("")}
    <li class="add">${adding === from ? addForm(from) : `<button data-plus="${from}" class="rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">+ ${from ? "Next survey" : "Survey when the season starts"}</button>`}</li></ul>`;
  const tree = () => `
    <div class="tree overflow-x-auto pb-2"><ul><li>
      <span class="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Start</span>
      ${children("")}
    </li></ul></div>`;

  const draw = () => {
    main.innerHTML = `
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3"><h1 class="text-2xl font-semibold tracking-tight">${esc(season.name)}</h1><span class="${season.status === "active" ? ui.badgeOk : ui.badgeSec}">${esc(season.status)}</span></div>
        <div class="flex gap-2">${season.status === "planned" ? `<button id="start" class="${ui.btn}">Start season</button>` : ""}${season.status === "active" ? `<button id="complete" class="${ui.outline}">Complete season</button>` : ""}</div>
      </div>
      ${card("Season", `<div class="grid items-end gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
        ${field("Season name", `<input id="name" value="${esc(season.name)}" class="${ui.input}">`)}
        ${field("Base", `<input id="base" value="${esc(season.base ?? "")}" class="${ui.input}">`)}
        ${field("AZ name", `<input id="az" value="${esc(season.az_name ?? "")}" class="${ui.input}">`)}
        <button id="save" class="${ui.outline}">Save</button></div>`)}
      ${card("Flow", tree(), "Top-down: each survey hangs under the survey that triggers it. Pick the survey, the status that triggers it, and when its task is created.")}
      ${card("Survey Responses", `
        <table class="${ui.table}"><thead><tr class="border-b"><th class="${ui.th}">Task</th><th class="${ui.th}">Survey</th><th class="${ui.th}">Farmer</th><th class="${ui.th}">Status</th><th class="${ui.th}">Start</th><th class="${ui.th}">End</th><th class="${ui.th}">v</th></tr></thead>
        <tbody>${tasks.map((t) => `<tr class="${ui.tr} cursor-pointer" data-task="${t.task_id}"><td class="${ui.td}">T${t.task_no}</td><td class="${ui.td} font-medium">${esc(t.task_type)}</td><td class="${ui.td}">${esc(t.farmer.name)}</td><td class="${ui.td}"><span class="${ui.badgeSec}">${esc(t.status)}</span></td><td class="${ui.td}">${date(t.planned_start_date)}</td><td class="${ui.td}">${t.planned_end_date ? date(t.planned_end_date) : "—"}</td><td class="${ui.td}">${t.response_version}</td></tr>`).join("")}</tbody></table>
        ${tasks.length ? "" : empty("No tasks yet. Tasks appear when the season starts and farmers exist.")}`, "One row per task (survey_response). Click a row to review it.")}`;
    main.querySelector("#save").onclick = () => run(async () => {
      await q(db.from("season").update({ name: main.querySelector("#name").value, base: main.querySelector("#base").value || null, az_name: main.querySelector("#az").value || null }).eq("id", id));
      toast("Saved"); seasonPage(id);
    });
    main.querySelector("#start")?.addEventListener("click", () => run(async () => {
      if (!arrows.some((a) => !a.from_template)) throw new Error("Add at least one survey under Start first");
      await q(db.from("season").update({ status: "active" }).eq("id", id)); toast("Season started"); seasonPage(id);
    }));
    main.querySelector("#complete")?.addEventListener("click", () => run(async () => {
      await q(db.from("season").update({ status: "completed" }).eq("id", id)); seasonPage(id);
    }));
    main.querySelectorAll("[data-plus]").forEach((b) => b.onclick = () => { adding = b.dataset.plus; draw(); });
    main.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => { adding = null; draw(); });
    main.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => run(async () => {
      const a = arrows.find((x) => x.id === b.dataset.del);
      if (arrows.some((x) => x.from_template === a.to_template)) throw new Error("Remove the surveys after it first");
      await q(db.from("season_flow").delete().eq("id", a.id)); seasonPage(id);
    }));
    main.querySelectorAll("form[data-add]").forEach((f) => f.onsubmit = (e) => { e.preventDefault(); run(async () => {
      const v = Object.fromEntries(new FormData(f));
      const t = available.find((x) => x.name === v.survey.trim());
      if (!t) throw new Error("Pick a survey from the list");
      await q(db.from("season_flow").insert({
        season_id: id, from_template: f.dataset.add || null, to_template: t.id, on_status: v.on_status ?? null,
        delay_days: v.mode === "days" ? Number(v.days || 0) : 0, start_date: v.mode === "date" && v.start_date ? v.start_date : null,
        end_date: v.end_date || null, position: arrows.length + 1 }));
      seasonPage(id);
    }); });
    main.querySelectorAll("[data-task]").forEach((tr) => tr.onclick = () => openTask(tasks.find((t) => t.task_id === tr.dataset.task), tpl, () => seasonPage(id)));
  };
  draw();
}

async function openTask(t, tpl, refresh) {
  const [logs, comments] = await Promise.all([
    q(db.from("response_change_logs").select("*").eq("task_id", t.task_id).order("when", { ascending: false })),
    q(db.from("comments").select("*").eq("task_id", t.task_id).order("when")),
  ]);
  const label = Object.fromEntries((tpl(t.survey_template_id)?.questions ?? []).map((qn) => [qn.key, qn.label]));
  const el = document.createElement("div");
  el.className = "fixed inset-0 z-40 flex justify-end bg-black/40";
  el.innerHTML = `<div class="h-full w-full max-w-lg overflow-auto border-l bg-background p-6 shadow-xl">
    <div class="mb-1 flex items-center justify-between"><h2 class="text-lg font-semibold">T${t.task_no} · ${esc(t.task_type)}</h2><button id="close" class="${ui.icon}">✕</button></div>
    <p class="mb-4 text-sm text-muted-foreground">${esc(t.farmer.name)} · <span class="${ui.badgeSec}">${esc(t.status)}</span> · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "no end"}</p>
    ${card(`Response <span class="font-normal text-muted-foreground">v${t.response_version}</span>`,
      (t.survey_response ? `<table class="${ui.table}">${Object.entries(t.survey_response).map(([k, v]) => `<tr class="border-b"><th class="${ui.th} w-1/2">${esc(label[k] ?? k)}</th><td class="${ui.td}">${esc(v)}</td></tr>`).join("")}</table>` : `<p class="text-sm text-muted-foreground">Not submitted yet.</p>`)
      + `<p class="mt-3 text-xs text-muted-foreground">Created ${when(t.created_at)} by ${esc(t.created_by)} · Updated ${when(t.updated_at)} by ${esc(t.updated_by)}</p>`)}
    ${card("Set status", `<input id="comment" placeholder="Comment (optional)" class="${ui.input} mb-3"><div class="flex flex-wrap gap-2">${(tpl(t.survey_template_id)?.statuses ?? []).map((s) => `<button data-set="${esc(s)}" class="${ui.sm}" ${s === t.status ? "disabled" : ""}>${esc(s)}</button>`).join("")}</div>`)}
    ${card("Comments", comments.map((c) => `<div class="mb-2 rounded-md bg-muted p-3 text-sm"><b>${esc(c.who)}</b> <span class="text-xs text-muted-foreground">${when(c.when)}</span><br>${esc(c.comment)}</div>`).join("") + `<div class="flex gap-2"><input id="newComment" placeholder="Add a comment" class="${ui.input}"><button id="post" class="${ui.outline}">Post</button></div>`)}
    ${card("Change log", logs.map((l) => `<div class="mb-2 rounded-md bg-muted p-3 text-xs"><b>${esc(l.who ?? "system")}</b> · ${when(l.when)}<br>before: ${esc(JSON.stringify(l.before))}<br>after: ${esc(JSON.stringify(l.after))}${l.remarks ? `<br>remarks: ${esc(l.remarks)}` : ""}</div>`).join("") || `<p class="text-sm text-muted-foreground">None.</p>`)}
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.onclick = (e) => e.target === el && close();
  el.querySelector("#close").onclick = close;
  el.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => run(async () => {
    await q(db.rpc("set_status", { p_task: t.task_id, p_status: b.dataset.set, p_by: who(), p_comment: el.querySelector("#comment").value }));
    close(); toast(`Status: ${b.dataset.set}`); refresh();
  }));
  el.querySelector("#post").onclick = () => run(async () => {
    const comment = el.querySelector("#newComment").value.trim(); if (!comment) return;
    await q(db.from("comments").insert({ task_id: t.task_id, who: who(), comment }));
    close(); openTask(t, tpl, refresh);
  });
}
