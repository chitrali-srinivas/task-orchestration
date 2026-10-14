import { db, q, esc, date, when, toast, run } from "../lib/db.js";

const main = document.getElementById("main");
const whoInput = document.getElementById("who");
whoInput.value = localStorage.getItem("who") ?? "";
whoInput.onchange = () => localStorage.setItem("who", whoInput.value);
const who = () => whoInput.value || "hq";

const TYPES = ["text", "number", "date", "select", "yes/no"];
const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");

// ───────── Routing ─────────
window.addEventListener("hashchange", route);
route();

function route() {
  const [, section = "templates", id] = location.hash.split("/");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.id === "nav-" + section));
  run(() => ({ templates: id ? templateEditor : templateList, seasons: id ? seasonPage : seasonList })[section](id));
}

// ───────── Survey Templates ─────────
async function templateList() {
  const list = await q(db.from("survey_template_master").select("id, name, az_name, version, questions, statuses").order("name"));
  main.innerHTML = `
    <div class="row"><h1 class="grow">Survey Templates</h1><a href="#/templates/new"><button class="primary">New survey template</button></a></div>
    <input id="search" placeholder="Search surveys" style="margin:12px 0">
    <div class="card list" id="list"></div>`;
  const draw = (f = "") => main.querySelector("#list").innerHTML = list.filter((t) => t.name.toLowerCase().includes(f.toLowerCase()))
    .map((t) => `<a href="#/templates/${t.id}"><b>${esc(t.name)}</b> <span class="muted small">v${t.version} · ${t.questions.length} questions · statuses: ${esc(t.statuses.join(" → "))}</span></a>`).join("")
    || '<p class="empty">No survey templates yet.</p>';
  draw();
  main.querySelector("#search").oninput = (e) => draw(e.target.value);
}

async function templateEditor(id) {
  const t = id === "new" ? { name: "", az_name: "", questions: [], statuses: ["planned", "collected"] }
                         : await q(db.from("survey_template_master").select("*").eq("id", id).single());
  const draw = () => {
    main.innerHTML = `
      <div class="row"><a href="#/templates">← Surveys</a><h1 class="grow" style="margin:0">${id === "new" ? "New survey template" : esc(t.name)}</h1><button id="save" class="primary">Save</button></div>
      <div class="card">
        <div class="row"><label class="grow">Survey name<input id="name" value="${esc(t.name)}"></label><label>AZ<input id="az" value="${esc(t.az_name ?? "")}"></label></div>
      </div>
      <div class="card">
        <h2>Questions</h2>
        <div class="q small muted"><span>Question</span><span>Type</span><span>Required</span><span>Options (for select)</span><span></span><span></span></div>
        ${t.questions.map((qn, i) => `
          <div class="q" data-i="${i}">
            <input data-f="label" value="${esc(qn.label)}" placeholder="Question">
            <select data-f="type">${opt(TYPES.map((x) => [x, x]), qn.type)}</select>
            <input type="checkbox" data-f="required" ${qn.required ? "checked" : ""}>
            <input data-f="options" value="${esc((qn.options ?? []).join(", "))}" placeholder="a, b, c" ${qn.type === "select" ? "" : "disabled"}>
            <button data-adv="${i}" title="Settings">⚙</button>
            <button data-del="${i}" title="Remove">✕</button>
            ${qn._adv ? `<div class="adv">
              <label>Key<input data-f="key" value="${esc(qn.key)}"></label>
              <label>Min<input data-f="min" type="number" value="${esc(qn.min ?? "")}"></label>
              <label>Max<input data-f="max" type="number" value="${esc(qn.max ?? "")}"></label>
              <label>Help text<input data-f="help" value="${esc(qn.help ?? "")}"></label></div>` : ""}
          </div>`).join("")}
        <button id="addQ">+ Add question</button>
      </div>
      <div class="card">
        <h2>Survey statuses</h2>
        <p class="small muted">1st = when the task is created · 2nd = after the surveyor submits · the rest are set by the verifier. Season Management uses these to trigger the next survey.</p>
        <div>${t.statuses.map((s, i) => `<span class="chip">${i + 1}. ${esc(s)}<button data-ds="${i}">✕</button></span>`).join("")}</div>
        <div class="row"><input id="newStatus" placeholder="Add a status, e.g. verified" style="max-width:260px"><button id="addS">Add</button></div>
      </div>`;
    const read = () => main.querySelectorAll(".q[data-i]").forEach((row) => {
      const qn = t.questions[row.dataset.i];
      row.querySelectorAll("[data-f]").forEach((el) => qn[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value);
      qn.options = qn.type === "select" ? String(qn.options ?? "").split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      qn.key = qn.key || qn.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    });
    main.querySelector("#addQ").onclick = () => { read(); t.questions.push({ label: "", type: "text", required: false, key: "" }); draw(); };
    main.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { read(); t.questions.splice(b.dataset.del, 1); draw(); });
    main.querySelectorAll("[data-adv]").forEach((b) => b.onclick = () => { read(); t.questions[b.dataset.adv]._adv = !t.questions[b.dataset.adv]._adv; draw(); });
    main.querySelectorAll("[data-f=type]").forEach((s) => s.onchange = () => { read(); draw(); });
    main.querySelectorAll("[data-ds]").forEach((b) => b.onclick = () => { read(); t.statuses.splice(b.dataset.ds, 1); draw(); });
    main.querySelector("#addS").onclick = () => { const v = main.querySelector("#newStatus").value.trim(); if (v) { read(); t.statuses.push(v); draw(); } };
    main.querySelector("#save").onclick = () => run(async () => {
      read();
      const row = { name: main.querySelector("#name").value.trim(), az_name: main.querySelector("#az").value.trim() || null,
                    statuses: t.statuses, updated_at: new Date().toISOString(),
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
  const list = await q(db.from("season").select("*").order("created_at", { ascending: false }));
  main.innerHTML = `
    <div class="row"><h1 class="grow">Season Management</h1><button id="new" class="primary">New season</button></div>
    <div class="card list">${list.map((s) => `<a href="#/seasons/${s.id}"><b>${esc(s.name)}</b> <span class="muted small">${esc(s.base ?? "")} · ${esc(s.az_name ?? "")} · ${esc(s.status)}</span></a>`).join("") || '<p class="empty">No seasons yet.</p>'}</div>`;
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
  const tpl = (tid) => templates.find((t) => t.id === tid);
  const inFlow = new Set(arrows.map((a) => a.to_template));
  const available = templates.filter((t) => !inFlow.has(t.id));
  let adding = null;   // from_template id ("" = Start) whose add form is open

  const condition = (a) => {
    const whenTask = a.start_date ? `on ${date(a.start_date)}` : a.delay_days ? `after ${a.delay_days} days` : "immediately";
    return `<div class="cond">${a.from_template ? `when status of <b>${esc(tpl(a.from_template)?.name)}</b> = <b>${esc(a.on_status)}</b> → ` : "when the season starts → "}create task <b>${whenTask}</b>${a.end_date ? `, ends <b>${date(a.end_date)}</b>` : ""}</div>`;
  };
  const addForm = (from) => `
    <form class="card" data-add="${from}" style="max-width:560px">
      <label>Survey<input list="surveys" name="survey" placeholder="Search and pick a survey" required autofocus></label>
      <datalist id="surveys">${available.map((t) => `<option value="${esc(t.name)}">`).join("")}</datalist>
      ${from ? `<label>When status of ${esc(tpl(from).name)} =<select name="on_status">${opt(tpl(from).statuses.map((s) => [s, s]))}</select></label>` : ""}
      <label>Create task<div class="row"><select name="mode" style="width:150px"><option value="now">Immediately</option><option value="days">After N days</option><option value="date">On date</option></select><input name="days" type="number" min="1" placeholder="days" style="width:90px"><input name="start_date" type="date" style="width:170px"></div></label>
      <label>Ends on (optional)<input name="end_date" type="date" style="width:170px"></label>
      <div class="row" style="margin-top:8px"><button class="primary">Add</button><button type="button" data-cancel>Cancel</button></div>
    </form>`;
  const branch = (from) => arrows.filter((a) => (a.from_template ?? "") === from).map((a) => `
    <div class="step">${condition(a)}<span class="node">${esc(tpl(a.to_template)?.name)}</span> <button class="link small" data-del="${a.id}">remove</button>
      ${branch(a.to_template)}
      ${adding === a.to_template ? addForm(a.to_template) : `<div class="add"><button class="link" data-plus="${a.to_template}">+ Next survey after ${esc(tpl(a.to_template)?.name)}</button></div>`}
    </div>`).join("");

  const draw = () => {
    main.innerHTML = `
      <div class="row"><a href="#/seasons">← Seasons</a><h1 class="grow" style="margin:0">${esc(season.name)}</h1>
        <span class="status">${esc(season.status)}</span>
        ${season.status === "planned" ? '<button id="start" class="primary">Start season</button>' : ""}
        ${season.status === "active" ? '<button id="complete">Complete season</button>' : ""}</div>
      <div class="card"><div class="row">
        <label class="grow">Season name<input id="name" value="${esc(season.name)}"></label>
        <label>Base<input id="base" value="${esc(season.base ?? "")}"></label>
        <label>AZ name<input id="az" value="${esc(season.az_name ?? "")}"></label>
        <label>&nbsp;<button id="save">Save</button></label></div></div>
      <div class="card">
        <h2>Flow</h2>
        <span class="node start">Start</span>
        ${branch("")}
        <div class="step">${adding === "" ? addForm("") : '<div class="add"><button class="link" data-plus="">+ Survey when the season starts</button></div>'}</div>
      </div>
      <div class="card">
        <h2>Survey Responses (tasks)</h2>
        <table><thead><tr><th>Task</th><th>Survey</th><th>Farmer</th><th>Status</th><th>Start</th><th>End</th><th>v</th></tr></thead>
        <tbody>${tasks.map((t) => `<tr data-task="${t.task_id}"><td>T${t.task_no}</td><td>${esc(t.task_type)}</td><td>${esc(t.farmer.name)}</td><td><span class="status">${esc(t.status)}</span></td><td>${date(t.planned_start_date)}</td><td>${t.planned_end_date ? date(t.planned_end_date) : "—"}</td><td>${t.response_version}</td></tr>`).join("")}</tbody></table>
        ${tasks.length ? "" : '<p class="empty">No tasks yet. Tasks appear when the season starts and farmers exist.</p>'}
      </div>`;
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
  el.className = "drawer";
  el.innerHTML = `
    <div class="row"><h1 class="grow">T${t.task_no} · ${esc(t.task_type)}</h1><button id="close">✕</button></div>
    <p class="muted">${esc(t.farmer.name)} · <span class="status">${esc(t.status)}</span> · ${date(t.planned_start_date)} – ${t.planned_end_date ? date(t.planned_end_date) : "no end"}</p>
    <div class="card"><h3>Response (v${t.response_version})</h3>
      ${t.survey_response ? `<table>${Object.entries(t.survey_response).map(([k, v]) => `<tr><th>${esc(label[k] ?? k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : '<p class="muted">Not submitted yet.</p>'}
      <p class="small muted" style="margin-top:8px">Created ${when(t.created_at)} by ${esc(t.created_by)} · Updated ${when(t.updated_at)} by ${esc(t.updated_by)}</p></div>
    <div class="card"><h3>Set status</h3><input id="comment" placeholder="Comment (optional)">
      <div class="row" style="margin-top:8px">${(tpl(t.survey_template_id)?.statuses ?? []).map((s) => `<button data-set="${esc(s)}" ${s === t.status ? "disabled" : ""}>${esc(s)}</button>`).join("")}</div></div>
    <div class="card"><h3>Comments</h3>${comments.map((c) => `<div class="box"><b>${esc(c.who)}</b> <span class="small muted">${when(c.when)}</span><br>${esc(c.comment)}</div>`).join("") || '<p class="muted small">None.</p>'}
      <div class="row"><input id="newComment" class="grow" placeholder="Add a comment"><button id="post">Post</button></div></div>
    <div class="card"><h3>Change log</h3>${logs.map((l) => `<div class="box small"><b>${esc(l.who ?? "system")}</b> · ${when(l.when)}<br>before: ${esc(JSON.stringify(l.before))}<br>after: ${esc(JSON.stringify(l.after))}${l.remarks ? `<br>remarks: ${esc(l.remarks)}` : ""}</div>`).join("") || '<p class="muted small">None.</p>'}</div>`;
  document.body.appendChild(el);
  el.querySelector("#close").onclick = () => el.remove();
  el.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => run(async () => {
    await q(db.rpc("set_status", { p_task: t.task_id, p_status: b.dataset.set, p_by: who(), p_comment: el.querySelector("#comment").value }));
    el.remove(); toast(`Status: ${b.dataset.set}`); refresh();
  }));
  el.querySelector("#post").onclick = () => run(async () => {
    const comment = el.querySelector("#newComment").value.trim(); if (!comment) return;
    await q(db.from("comments").insert({ task_id: t.task_id, who: who(), comment }));
    el.remove(); openTask(t, tpl, refresh);
  });
}
