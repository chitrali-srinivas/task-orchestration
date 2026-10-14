// Survey template editor, laid out like mati-carbon-demo's survey builder:
// question list on the left, editor panel (Basic / Options / Validation / Advanced) on the right.
import { db, q, esc, toast, run } from "../lib/db.js";
import { ui, field } from "../lib/ui.js";
import { CATEGORIES, QUESTION_TYPES, typeOf } from "../lib/question-types.js";

const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
const keyOf = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const lbl = (text) => `<label class="text-xs font-semibold">${text}</label>`;
const panelTitle = (title, sub) => `<div class="border-b px-4 py-3"><div class="text-sm font-semibold">${title}</div>${sub ? `<div class="text-xs text-muted-foreground">${sub}</div>` : ""}</div>`;

export async function templateEditor(main, crumbs, id) {
  const t = id === "new"
    ? { name: "", az_name: "", questions: [], statuses: ["planned", "collected"] }
    : await q(db.from("survey_template_master").select("*").eq("id", id).single());
  crumbs.innerHTML = `<a href="#/templates" class="hover:text-foreground">Survey Templates</a> <span class="mx-1">›</span> ${id === "new" ? "New" : esc(t.name)}`;
  let sel = "survey", tab = "basic", picker = false;

  const draw = () => {
    const qn = sel === "survey" ? null : t.questions[sel];
    main.innerHTML = `
      <div class="mb-4 flex items-center justify-between gap-3">
        <div><h1 class="text-2xl font-semibold tracking-tight">${t.name ? esc(t.name) : "New survey template"}</h1>
          <p class="text-sm text-muted-foreground">${t.questions.length} question${t.questions.length === 1 ? "" : "s"} · statuses: ${esc(t.statuses.join(" → "))}</p></div>
        <button id="save" class="${ui.btn}">Save</button>
      </div>
      <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside class="${ui.card} overflow-hidden">
          ${panelTitle("Questions", "Click a question to edit it")}
          <div class="p-2">
            <button data-sel="survey" class="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${sel === "survey" ? "bg-accent font-medium" : "hover:bg-accent/60"}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>Survey settings</button>
            ${t.questions.map((x, i) => `
              <button data-sel="${i}" class="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left ${sel === i ? "bg-accent" : "hover:bg-accent/60"}">
                <span class="mt-0.5 rounded bg-muted px-1.5 font-mono text-[10px] font-bold">${i + 1}</span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm ${x.label ? "" : "text-muted-foreground"}">${esc(x.label) || "Untitled question"}</span>
                <span class="text-[11px] text-muted-foreground">${esc(typeOf(x.type).label)}${x.required ? " · required" : ""}</span></span>
              </button>`).join("")}
            <button id="addQ" class="${ui.sm} mt-2 w-full">+ Add question</button>
          </div>
        </aside>
        <section class="${ui.card} overflow-hidden">${qn ? questionPanel(qn, sel) : surveyPanel()}</section>
      </div>
      ${picker ? typePicker() : ""}`;
    bind();
  };

  const surveyPanel = () => `
    ${panelTitle("Survey settings", "Name, AZ and the statuses a task of this survey can have")}
    <div class="space-y-5 p-4">
      <div class="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div class="space-y-1.5">${lbl("Survey name")}<input data-t="name" value="${esc(t.name)}" placeholder="e.g. Farmer Registration" class="${ui.input}"></div>
        <div class="space-y-1.5">${lbl("AZ")}<input data-t="az_name" value="${esc(t.az_name ?? "")}" placeholder="e.g. ERW" class="${ui.input}"></div>
      </div>
      <div class="space-y-2">
        ${lbl("Survey statuses")}
        <p class="text-xs text-muted-foreground">1st = when the task is created · 2nd = after the surveyor submits · the rest are set by the verifier. Season Management uses these to trigger the next survey.</p>
        <div class="flex flex-wrap gap-2">${t.statuses.map((s, i) => `<span class="${ui.badgeSec} gap-1 py-1">${i + 1}. ${esc(s)}<button data-ds="${i}" class="ml-1 text-muted-foreground hover:text-foreground">✕</button></span>`).join("")}</div>
        <div class="flex gap-2"><input id="newStatus" placeholder="Add a status, e.g. verified" class="${ui.input} max-w-xs"><button id="addS" class="${ui.outline}">Add</button></div>
      </div>
    </div>`;

  const questionPanel = (x, i) => {
    const ty = typeOf(x.type);
    const tabs = [["basic", "Basic"], ...(ty.options ? [["options", "Options"]] : []), ["validation", "Validation"], ["advanced", "Advanced"]];
    const body = {
      basic: `
        <div class="space-y-1.5">${lbl("Question")}<input data-q="label" value="${esc(x.label)}" placeholder="e.g. Are you the owner of the farm?" class="${ui.input}"></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Question type")}<select data-q="type" class="${ui.select}">${CATEGORIES.map((c) => `<optgroup label="${esc(c.name)}">${opt(QUESTION_TYPES.filter((y) => y.category === c.id).map((y) => [y.id, y.label]), x.type)}</optgroup>`).join("")}</select>
            <p class="text-[11px] text-muted-foreground">${esc(ty.description)}</p></div>
          <div class="space-y-1.5">${lbl("Column name")}<input data-q="key" value="${esc(x.key)}" placeholder="e.g. is_owner" class="${ui.input} font-mono"><p class="text-[11px] text-muted-foreground">Key of the answer in the stored response.</p></div>
        </div>
        <label class="flex items-center gap-3 rounded-md border p-3"><input type="checkbox" data-q="required" ${x.required ? "checked" : ""} class="h-4 w-4 accent-primary"><span><span class="block text-sm font-medium">Required</span><span class="text-xs text-muted-foreground">The surveyor must answer before submitting.</span></span></label>
        <div class="space-y-1.5">${lbl("Help text")}<input data-q="help" value="${esc(x.help ?? "")}" placeholder="Shown under the question on the phone" class="${ui.input}"></div>`,
      options: `
        <div class="space-y-1.5">${lbl("Options, one per line")}<textarea data-q="optionsText" rows="8" placeholder="Yes&#10;No" class="${ui.input} h-auto font-mono">${esc((x.options ?? []).join("\n"))}</textarea></div>`,
      validation: ty.numeric ? `
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-1.5">${lbl("Number format")}<select data-q="format" class="${ui.select}">${opt([["decimal", "Decimal (12.50)"], ["integer", "Whole number (42)"]], x.format ?? "decimal")}</select></div>
          <div class="space-y-1.5">${lbl("Minimum")}<input data-q="min" type="number" value="${esc(x.min ?? "")}" placeholder="e.g. 0" class="${ui.input}"></div>
          <div class="space-y-1.5">${lbl("Maximum")}<input data-q="max" type="number" value="${esc(x.max ?? "")}" placeholder="e.g. 500" class="${ui.input}"></div>
        </div>` : ty.text ? `
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Minimum length")}<input data-q="minLength" type="number" value="${esc(x.minLength ?? "")}" placeholder="e.g. 1" class="${ui.input}"></div>
          <div class="space-y-1.5">${lbl("Maximum length")}<input data-q="maxLength" type="number" value="${esc(x.maxLength ?? "")}" placeholder="e.g. 200" class="${ui.input}"></div>
        </div>
        <div class="space-y-1.5">${lbl("Pattern (regex, optional)")}<input data-q="regex" value="${esc(x.regex ?? "")}" placeholder="e.g. ^[0-9]{10}$" class="${ui.input} font-mono"></div>` : x.type === "Date" ? `
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Earliest date")}<input data-q="min" type="date" value="${esc(x.min ?? "")}" class="${ui.input}"></div>
          <div class="space-y-1.5">${lbl("Latest date")}<input data-q="max" type="date" value="${esc(x.max ?? "")}" class="${ui.input}"></div>
        </div>` : x.type === "Checkbox" ? `
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Minimum selections")}<input data-q="min" type="number" value="${esc(x.min ?? "")}" class="${ui.input}"></div>
          <div class="space-y-1.5">${lbl("Maximum selections")}<input data-q="max" type="number" value="${esc(x.max ?? "")}" class="${ui.input}"></div>
        </div>` : `<p class="text-sm text-muted-foreground">No extra validation for ${esc(ty.label)} beyond “Required”.</p>`,
      advanced: `
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Unit (optional)")}<input data-q="unit" value="${esc(x.unit ?? "")}" placeholder="e.g. acres, kg, tons" class="${ui.input}"></div>
          <div class="space-y-1.5">${lbl("Default value (optional)")}<input data-q="default" value="${esc(x.default ?? "")}" class="${ui.input}"></div>
        </div>
        <div class="rounded-md border border-destructive/40 p-3"><div class="mb-2 text-sm font-medium">Delete question</div><button id="delQ" class="${ui.sm} text-destructive">Delete “${esc(x.label) || "Untitled question"}”</button></div>`,
    }[tab];
    return `
      ${panelTitle(`Question ${i + 1}`, esc(ty.label))}
      <div class="flex gap-1 border-b px-4">${tabs.map(([k, l]) => `<button data-tab="${k}" class="-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}">${l}</button>`).join("")}</div>
      <div class="space-y-4 p-4">${body}</div>`;
  };

  const typePicker = () => `
    <div id="picker" class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div class="${ui.card} max-h-[85vh] w-full max-w-3xl overflow-auto">
        <div class="flex items-center justify-between border-b px-4 py-3"><div class="text-sm font-semibold">Select question type</div><button id="closePicker" class="${ui.icon}">✕</button></div>
        <div class="space-y-5 p-4">${CATEGORIES.map((c) => {
          const types = QUESTION_TYPES.filter((y) => y.category === c.id);
          return types.length ? `<div><div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(c.name)}</div>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${types.map((y) => `<button data-type="${esc(y.id)}" class="rounded-lg border p-3 text-left hover:bg-accent"><div class="text-sm font-medium">${esc(y.label)}</div><div class="text-[11px] text-muted-foreground">${esc(y.description)}</div></button>`).join("")}</div></div>` : "";
        }).join("")}</div>
      </div>
    </div>`;

  const bind = () => {
    main.querySelectorAll("[data-sel]").forEach((b) => b.onclick = () => { sel = b.dataset.sel === "survey" ? "survey" : Number(b.dataset.sel); tab = "basic"; draw(); });
    main.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
    main.querySelector("#addQ").onclick = () => { picker = true; draw(); };
    main.querySelector("#closePicker")?.addEventListener("click", () => { picker = false; draw(); });
    main.querySelector("#picker")?.addEventListener("click", (e) => { if (e.target.id === "picker") { picker = false; draw(); } });
    main.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => {
      t.questions.push({ label: "", key: "", type: b.dataset.type, required: false, options: typeOf(b.dataset.type).options ? [] : undefined });
      sel = t.questions.length - 1; tab = "basic"; picker = false; draw();
    });
    // Typing updates state in place (no re-render, so focus is kept); structural changes re-render.
    main.querySelectorAll("[data-t]").forEach((el) => el.oninput = () => { t[el.dataset.t] = el.value; });
    main.querySelectorAll("[data-q]").forEach((el) => {
      const x = t.questions[sel], f = el.dataset.q;
      if (f === "type") { el.onchange = () => { x.type = el.value; x.options = typeOf(x.type).options ? (x.options ?? []) : undefined; draw(); }; return; }
      el.oninput = () => {
        if (f === "required") x.required = el.checked;
        else if (f === "optionsText") x.options = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
        else x[f] = el.value;
        if (f === "label" && !x._keyEdited) { x.key = keyOf(x.label); main.querySelector("[data-q=key]").value = x.key; }
        if (f === "key") x._keyEdited = true;
        if (f === "label" || f === "required") refreshList();
      };
    });
    main.querySelector("#delQ")?.addEventListener("click", () => { t.questions.splice(sel, 1); sel = "survey"; draw(); });
    main.querySelectorAll("[data-ds]").forEach((b) => b.onclick = () => { t.statuses.splice(b.dataset.ds, 1); draw(); });
    const addStatus = () => { const v = main.querySelector("#newStatus").value.trim(); if (v) { t.statuses.push(v); draw(); } };
    main.querySelector("#addS")?.addEventListener("click", addStatus);
    main.querySelector("#newStatus")?.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), addStatus()));
    main.querySelector("#save").onclick = () => run(save);
  };

  const refreshList = () => {
    const b = main.querySelector(`[data-sel="${sel}"]`), x = t.questions[sel];
    if (b) b.innerHTML = `<span class="mt-0.5 rounded bg-muted px-1.5 font-mono text-[10px] font-bold">${sel + 1}</span><span class="min-w-0 flex-1"><span class="block truncate text-sm ${x.label ? "" : "text-muted-foreground"}">${esc(x.label) || "Untitled question"}</span><span class="text-[11px] text-muted-foreground">${esc(typeOf(x.type).label)}${x.required ? " · required" : ""}</span></span>`;
  };

  const save = async () => {
    const name = t.name.trim();
    if (!name) throw new Error("Give the survey a name (Survey settings)");
    if (t.statuses.length < 2) throw new Error("A survey needs at least two statuses (created, submitted)");
    const blank = t.questions.findIndex((x) => !x.label.trim());
    if (blank >= 0) throw new Error(`Question ${blank + 1} has no text`);
    const num = (v) => (v === "" || v == null ? undefined : isNaN(v) ? v : Number(v));
    const questions = t.questions.map(({ _keyEdited, ...x }) => ({ ...x, key: x.key || keyOf(x.label), min: num(x.min), max: num(x.max), minLength: num(x.minLength), maxLength: num(x.maxLength) }));
    const row = { name, az_name: t.az_name?.trim() || null, statuses: t.statuses, questions, updated_at: new Date().toISOString() };
    const saved = await q(id === "new" ? db.from("survey_template_master").insert(row).select().single()
                                       : db.from("survey_template_master").update(row).eq("id", id).select().single());
    toast("Saved"); location.hash = "#/templates/" + saved.id;
  };

  draw();
}
