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

const TYPES = ["text", "number", "date", "select", "yes/no"];
const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
const empty = (t) => `<p class="py-10 text-center text-sm text-muted-foreground">${t}</p>`;
const card = (title, body, desc = "", right = "") =>
  `<section class="${ui.card} mb-4"><div class="${ui.cardHead} flex-row items-start justify-between"><div><h2 class="${ui.cardTitle}">${title}</h2>${desc ? `<p class="${ui.cardDesc} mt-1">${desc}</p>` : ""}</div>${right}</div><div class="${ui.cardBody}">${body}</div></section>`;

// ───────── Routing ─────────
window.addEventListener("hashchange", route);
route();

function route() {
  const [, section = "templates", id] = location.hash.split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("bg-sidebar-accent", a.dataset.nav === section));
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("font-medium", a.dataset.nav === section));
  run(() => ({ templates: id ? templateEditor : templateList, seasons: id ? seasonPage : seasonList })[section](id));
}

// ───────── Survey Templates ─────────
async function templateList() {
  crumbs.textContent = "Survey Templates";
  const list = await q(db.from("survey_template_master").select("id, name, az_name, version, questions, statuses").order("name"));
  main.innerHTML = `
    <div class="mb-4 flex items-center justify-between"><h1 class="text-2xl font-semibold tracking-tight">Survey Templates</h1><a href="#/templates/new" class="${ui.btn}">New survey template</a></div>
    <input id="search" placeholder="Search surveys" class="${ui.input} mb-4 max-w-sm">
    <div class="${ui.card}"><table class="${ui.table}"><thead><tr class="border-b"><th class="${ui.th}">Survey</th><th class="${ui.th}">AZ</th><th class="${ui.th}">Questions</th><th class="${ui.th}">Statuses</th><th class="${ui.th}">Version</th></tr></thead><tbody id="rows"></tbody></table><div id="none"></div></div>`;
  const draw = (f = "") => {
    const rows = list.filter((t) => t.name.toLowerCase().includes(f.toLowerCase()));
    main.querySelector("#rows").innerHTML = rows.map((t) => `<tr class="${ui.tr} cursor-pointer" onclick="location.hash='#/templates/${t.id}'"><td class="${ui.td} font-medium">${esc(t.name)}</td><td class="${ui.td}">${esc(t.az_name ?? "")}</td><td class="${ui.td}">${t.questions.length}</td><td class="${ui.td}">${t.statuses.map((s) => `<span class="${ui.badgeSec} mr-1">${esc(s)}</span>`).join("")}</td><td class="${ui.td}">v${t.version}</td></tr>`).join("");
    main.querySelector("#none").innerHTML = rows.length ? "" : empty("No survey templates yet.");
  };
  draw();
  main.querySelector("#search").oninput = (e) => draw(e.target.value);
}

async function templateEditor(id) {
  const t = id === "new" ? { name: "", az_name: "", questions: [], statuses: ["planned", "collected"] }
                         : await q(db.from("survey_template_master").select("*").eq("id", id).single());
  crumbs.innerHTML = `<a href="#/templates" class="hover:text-foreground">Survey Templates</a> <span class="mx-1">›</span> ${id === "new" ? "New" : esc(t.name)}`;
  const draw = () => {
    main.innerHTML = `
      <div class="mb-4 flex items-center justify-between"><h1 class="text-2xl font-semibold tracking-tight">${id === "new" ? "New survey template" : esc(t.name)}</h1><button id="save" class="${ui.btn}">Save</button></div>
      ${card("Survey", `<div class="grid gap-4 sm:grid-cols-[1fr_200px]">${field("Survey name", `<input id="name" value="${esc(t.name)}" class="${ui.input}">`)}${field("AZ", `<input id="az" value="${esc(t.az_name ?? "")}" class="${ui.input}">`)}</div>`)}
      ${card("Questions", `
        <div class="hidden sm:grid grid-cols-[2fr_130px_80px_2fr_36px_36px] gap-2 pb-2 text-xs font-medium text-muted-foreground"><span>Question</span><span>Type</span><span>Required</span><span>Options (for select)</span><span></span><span></span></div>
        ${t.questions.map((qn, i) => `
          <div class="grid grid-cols-2 sm:grid-cols-[2fr_130px_80px_2fr_36px_36px] items-center gap-2 py-1" data-i="${i}">
            <input data-f="label" value="${esc(qn.label)}" placeholder="Question" class="${ui.input}">
            <select data-f="type" class="${ui.select}">${opt(TYPES.map((x) => [x, x]), qn.type)}</select>
            <label class="flex items-center justify-center"><input type="checkbox" data-f="required" ${qn.required ? "checked" : ""} class="h-4 w-4 rounded border-input accent-primary"></label>
            <input data-f="options" value="${esc((qn.options ?? []).join(", "))}" placeholder="a, b, c" class="${ui.input}" ${qn.type === "select" ? "" : "disabled"}>
            <button data-adv="${i}" title="Settings" class="${ui.icon}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
            <button data-del="${i}" title="Remove" class="${ui.icon} text-muted-foreground">✕</button>
            ${qn._adv ? `<div class="col-span-full grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-4">
              ${field("Key", `<input data-f="key" value="${esc(qn.key)}" class="${ui.input} bg-background">`)}
              ${field("Min", `<input data-f="min" type="number" value="${esc(qn.min ?? "")}" class="${ui.input} bg-background">`)}
              ${field("Max", `<input data-f="max" type="number" value="${esc(qn.max ?? "")}" class="${ui.input} bg-background">`)}
              ${field("Help text", `<input data-f="help" value="${esc(qn.help ?? "")}" class="${ui.input} bg-background">`)}</div>` : ""}
          </div>`).join("")}
        <button id="addQ" class="${ui.outline} mt-2">+ Add question</button>`)}
      ${card("Survey statuses", `
        <div class="mb-3 flex flex-wrap gap-2">${t.statuses.map((s, i) => `<span class="${ui.badgeSec} gap-1 py-1">${i + 1}. ${esc(s)}<button data-ds="${i}" class="ml-1 text-muted-foreground hover:text-foreground">✕</button></span>`).join("")}</div>
        <div class="flex gap-2"><input id="newStatus" placeholder="Add a status, e.g. verified" class="${ui.input} max-w-xs"><button id="addS" class="${ui.outline}">Add</button></div>`,
        "1st = when the task is created · 2nd = after the surveyor submits · the rest are set by the verifier. Season Management uses these to trigger the next survey.")}`;
    const read = () => { t.name = main.querySelector("#name").value; t.az_name = main.querySelector("#az").value; readQuestions(); };
    const readQuestions = () => main.querySelectorAll("[data-i]").forEach((row) => {
      const qn = t.questions[row.dataset.i];
      row.querySelectorAll("[data-f]").forEach((el) => qn[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value);
      qn.options = qn.type === "select" ? String(qn.options ?? "").split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      qn.key = qn.key || qn.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    });
    const addStatus = () => { const v = main.querySelector("#newStatus").value.trim(); if (v) { read(); t.statuses.push(v); draw(); } };
    main.querySelector("#addQ").onclick = () => { read(); t.questions.push({ label: "", type: "text", required: false, key: "" }); draw(); };
    main.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { read(); t.questions.splice(b.dataset.del, 1); draw(); });
    main.querySelectorAll("[data-adv]").forEach((b) => b.onclick = () => { read(); t.questions[b.dataset.adv]._adv = !t.questions[b.dataset.adv]._adv; draw(); });
    main.querySelectorAll("[data-f=type]").forEach((s) => s.onchange = () => { read(); draw(); });
    main.querySelectorAll("[data-ds]").forEach((b) => b.onclick = () => { read(); t.statuses.splice(b.dataset.ds, 1); draw(); });
    main.querySelector("#addS").onclick = addStatus;
    main.querySelector("#newStatus").onkeydown = (e) => e.key === "Enter" && addStatus();
    main.querySelector("#save").onclick = () => run(async () => {
      read();
      const row = { name: t.name.trim(), az_name: t.az_name.trim() || null, statuses: t.statuses, updated_at: new Date().toISOString(),
                    questions: t.questions.map(({ _adv, ...qn }) => ({ ...qn, min: qn.min === "" ? undefined : qn.min, max: qn.max === "" ? undefined : qn.max })) };
      if (!row.name) throw new Error("Give the survey a name");
      if (row.statuses.length < 2) throw new Error("A survey needs at least two statuses (created, submitted)");
      const saved = await q(id === "new" ? db.from("survey_template_master").insert(row).select().single()
                                         : db.from("survey_template_master").update(row).eq("id", id).select().single());
      toast("Saved"); location.hash = "#/templates/" + saved.id;
    });
  };
  draw();
}

// ───────── Season Management ─────────
async function seasonList() {
  crumbs.textContent = "Season Management";
  const list = await q(db.from("season").select("*").order("created_at", { ascending: false }));
  main.innerHTML = `
    <div class="mb-4 flex items-center justify-between"><h1 class="text-2xl font-semibold tracking-tight">Season Management</h1><button id="new" class="${ui.btn}">New season</button></div>
    <div class="${ui.card}"><table class="${ui.table}"><thead><tr class="border-b"><th class="${ui.th}">Season</th><th class="${ui.th}">Base</th><th class="${ui.th}">AZ</th><th class="${ui.th}">Status</th></tr></thead>
      <tbody>${list.map((s) => `<tr class="${ui.tr} cursor-pointer" onclick="location.hash='#/seasons/${s.id}'"><td class="${ui.td} font-medium">${esc(s.name)}</td><td class="${ui.td}">${esc(s.base ?? "")}</td><td class="${ui.td}">${esc(s.az_name ?? "")}</td><td class="${ui.td}"><span class="${s.status === "active" ? ui.badgeOk : ui.badgeSec}">${esc(s.status)}</span></td></tr>`).join("")}</tbody></table>
      ${list.length ? "" : empty("No seasons yet.")}</div>`;
  main.querySelector("#new").onclick = () => run(async () => {
    const name = prompt("Season name"); if (!name) return;
    const s = await q(db.from("season").insert({ name }).select().single()); location.hash = "#/seasons/" + s.id;
  });
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

  const condition = (a) => {
    const whenTask = a.start_date ? `on ${date(a.start_date)}` : a.delay_days ? `after ${a.delay_days} days` : "immediately";
    return `<div class="my-2 text-xs text-muted-foreground">${a.from_template ? `when status of <b class="text-foreground">${esc(tpl(a.from_template)?.name)}</b> = <b class="text-foreground">${esc(a.on_status)}</b> → ` : "when the season starts → "}create task <b class="text-foreground">${whenTask}</b>${a.end_date ? `, ends <b class="text-foreground">${date(a.end_date)}</b>` : ""}</div>`;
  };
  const addForm = (from) => `
    <form class="${ui.card} my-2 max-w-xl space-y-3 p-4" data-add="${from}">
      ${field("Survey", `<input list="surveys" name="survey" placeholder="Search and pick a survey" required class="${ui.input}">`)}
      <datalist id="surveys">${available.map((t) => `<option value="${esc(t.name)}">`).join("")}</datalist>
      ${from ? field(`When status of ${esc(tpl(from).name)} =`, `<select name="on_status" class="${ui.select}">${opt(tpl(from).statuses.map((s) => [s, s]))}</select>`) : ""}
      ${field("Create task", `<div class="flex gap-2"><select name="mode" class="${ui.select} w-40"><option value="now">Immediately</option><option value="days">After N days</option><option value="date">On date</option></select><input name="days" type="number" min="1" placeholder="days" class="${ui.input} w-24"><input name="start_date" type="date" class="${ui.input} w-44"></div>`)}
      ${field("Ends on (optional)", `<input name="end_date" type="date" class="${ui.input} w-44">`)}
      <div class="flex gap-2 pt-1"><button class="${ui.btn}">Add</button><button type="button" data-cancel class="${ui.outline}">Cancel</button></div>
    </form>`;
  const branch = (from) => arrows.filter((a) => (a.from_template ?? "") === from).map((a) => `
    <div class="ml-5 border-l-2 pl-5">${condition(a)}
      <span class="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 font-medium shadow-sm">${esc(tpl(a.to_template)?.name)}<button data-del="${a.id}" class="text-xs text-muted-foreground hover:text-destructive" title="Remove">✕</button></span>
      ${branch(a.to_template)}
      ${adding === a.to_template ? addForm(a.to_template) : `<div class="my-2"><button data-plus="${a.to_template}" class="${ui.link}">+ Next survey after ${esc(tpl(a.to_template)?.name)}</button></div>`}
    </div>`).join("");

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
      ${card("Flow", `
        <span class="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Start</span>
        ${branch("")}
        <div class="ml-5 border-l-2 pl-5">${adding === "" ? addForm("") : `<div class="my-2"><button data-plus="" class="${ui.link}">+ Survey when the season starts</button></div>`}</div>`,
        "Top-down: pick the survey, the status of the previous survey that triggers it, and when its task is created.")}
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
