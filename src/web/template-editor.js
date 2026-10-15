// Survey template editor, laid out like mati-carbon-demo's survey builder:
// question list on the left, editor panel (Basic / Options / Validation / Repeater / Advanced) on the right.
import { db, q, esc, toast, run } from "../lib/db.js";
import { ui } from "../lib/ui.js";
import { CATEGORIES, QUESTION_TYPES, typeOf } from "../lib/question-types.js";

const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
const keyOf = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const lbl = (text) => `<label class="text-xs font-semibold">${text}</label>`;
const hint = (text) => `<p class="text-[11px] text-muted-foreground">${text}</p>`;
const panelTitle = (title, sub) => `<div class="border-b px-4 py-3"><div class="text-sm font-semibold">${title}</div>${sub ? `<div class="text-xs text-muted-foreground">${sub}</div>` : ""}</div>`;
const typeSelect = (attrs, current, exclude = []) => `<select ${attrs} class="${ui.select}">${CATEGORIES.map((c) => `<optgroup label="${esc(c.name)}">${opt(QUESTION_TYPES.filter((y) => y.category === c.id && !exclude.includes(y.id)).map((y) => [y.id, y.label]), current)}</optgroup>`).join("")}</select>`;
const newQuestion = (type) => ({ label: "", key: "", type, required: false, options: typeOf(type).options ? [] : undefined,
  ...(type === "Repeater_QT" ? { repeater: { countSource: "self", fixedCount: 2, countKey: "", itemLabel: "Plot #{index}", children: [] } } : {}) });

export async function templateEditor(main, crumbs, id) {
  const t = id === "new"
    ? { name: "", az_name: "", questions: [], statuses: ["planned", "collected"] }
    : await q(db.from("survey_template_master").select("*").eq("id", id).single());
  crumbs.innerHTML = `<a href="#/templates" class="hover:text-foreground">Survey Templates</a> <span class="mx-1">›</span> ${id === "new" ? "New" : esc(t.name)}`;
  t.questions.forEach((x) => { if (x.type === "Repeater_QT" && !x.repeater) x.repeater = newQuestion("Repeater_QT").repeater; });
  let sel = "survey", tab = "basic", picker = null;   // picker: null | "top" | { parent: index }

  const listItem = (x, label, i, nested = false) => `
    <button data-sel="${i}" class="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left ${sel === i ? "bg-accent" : "hover:bg-accent/60"} ${nested ? "ml-6" : ""}">
      <span class="mt-0.5 rounded bg-muted px-1.5 font-mono text-[10px] font-bold">${label}</span>
      <span class="min-w-0 flex-1"><span class="block truncate text-sm ${x.label ? "" : "text-muted-foreground"}">${esc(x.label) || "Untitled question"}</span>
      <span class="text-[11px] text-muted-foreground">${esc(typeOf(x.type).label)}${x.required ? " · required" : ""}</span></span>
    </button>`;

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
            ${t.questions.map((x, i) => listItem(x, i + 1, i) + (x.repeater?.children ?? []).map((c, j) => `
              <div class="ml-6 flex items-start gap-2 px-3 py-1.5 text-left"><span class="mt-0.5 rounded bg-muted px-1.5 font-mono text-[10px] font-bold">${i + 1}.${j + 1}</span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm ${c.label ? "" : "text-muted-foreground"}">${esc(c.label) || "Untitled question"}</span><span class="text-[11px] text-muted-foreground">${esc(typeOf(c.type).label)} · in repeater</span></span></div>`).join("")).join("")}
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
        ${hint("1st = when the task is created · 2nd = after the surveyor submits · the rest are set by the verifier. Season Management uses these to trigger the next survey.")}
        <div class="flex flex-wrap gap-2">${t.statuses.map((s, i) => `<span class="${ui.badgeSec} gap-1 py-1">${i + 1}. ${esc(s)}<button data-ds="${i}" class="ml-1 text-muted-foreground hover:text-foreground">✕</button></span>`).join("")}</div>
        <div class="flex gap-2"><input id="newStatus" placeholder="Add a status, e.g. verified" class="${ui.input} max-w-xs"><button id="addS" class="${ui.outline}">Add</button></div>
      </div>
    </div>`;

  const validationBody = (x, ty) => ty.numeric ? `
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
      </div>` : `<p class="text-sm text-muted-foreground">No extra validation for ${esc(ty.label)} beyond “Required”.</p>`;

  // Repeater tab, after the builder's repeater-tab: count source, instance label, child questions.
  const repeaterBody = (x, i) => {
    const r = x.repeater, numeric = t.questions.filter((y, j) => j !== i && typeOf(y.type).numeric);
    const mode = (val, title, text, extra = "") => `
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-xs ${r.countSource === val ? "border-primary bg-accent/60" : "hover:bg-accent/40"}">
        <input type="radio" name="countSource" value="${val}" ${r.countSource === val ? "checked" : ""} data-r="countSource" class="mt-0.5 accent-primary">
        <span class="flex-1"><span class="block text-sm font-medium">${title}</span><span class="text-muted-foreground">${text}</span>${extra}</span></label>`;
    return `
      <div class="space-y-2">
        ${lbl("Repeat count source")}${hint("Where the phone gets the number of times to repeat this block.")}
        <div class="grid gap-2">
          ${mode("self", "Answer to this question (Self)", "The surveyor answers this question with a number (e.g. “How many plots do you have?”) and that number is the count.")}
          ${mode("question", "Another question", "Use the number answered in an earlier Number question of this survey.",
            `<span class="mt-2 block">${numeric.length ? `<select data-r="countKey" class="${ui.select} bg-background">${opt([["", "Pick a question…"], ...numeric.map((y) => [y.key, y.label || y.key])], r.countKey)}</select>` : `<span class="text-destructive">Add a Number question before this one first.</span>`}</span>`)}
          ${mode("fixed", "Fixed count", "Always repeat the same number of times.", `<span class="mt-2 block"><input type="number" min="1" max="50" data-r="fixedCount" value="${esc(r.fixedCount ?? 2)}" class="${ui.input} w-28 bg-background"></span>`)}
        </div>
      </div>
      <div class="space-y-1.5">${lbl("Instance tab label template")}<input data-r="itemLabel" value="${esc(r.itemLabel || "Plot #{index}")}" placeholder="e.g. Plot #{index} or Sub-Sample #{index}" class="${ui.input}">
        ${hint(`Preview: ${esc((r.itemLabel || "Plot #{index}").replace("#{index}", "1"))}, ${esc((r.itemLabel || "Plot #{index}").replace("#{index}", "2"))}`)}</div>
      <div class="space-y-2">
        ${lbl("Questions in this repeater block")}${hint("Asked once per instance. Answers are stored as a list under this question's column name.")}
        ${r.children.length ? r.children.map((c, j) => `
          <div class="space-y-2 rounded-lg border p-3" data-child="${j}">
            <div class="flex items-center gap-2"><span class="rounded bg-muted px-1.5 font-mono text-[10px] font-bold">${i + 1}.${j + 1}</span>
              <input data-c="label" value="${esc(c.label)}" placeholder="Question" class="${ui.input}">
              <button data-delc="${j}" title="Remove" class="${ui.icon} text-muted-foreground">✕</button></div>
            <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              ${typeSelect(`data-c="type"`, c.type, ["Repeater_QT"])}
              <input data-c="key" value="${esc(c.key)}" placeholder="column_name" class="${ui.input} font-mono">
              <label class="flex items-center gap-2 text-xs"><input type="checkbox" data-c="required" ${c.required ? "checked" : ""} class="h-4 w-4 accent-primary">Required</label>
            </div>
            ${typeOf(c.type).options ? `<textarea data-c="optionsText" rows="3" placeholder="Options, one per line" class="${ui.input} h-auto font-mono">${esc((c.options ?? []).join("\n"))}</textarea>` : ""}
          </div>`).join("") : `<div class="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground"><b class="block text-sm text-foreground">No questions in this repeater block</b>Click below to add one.</div>`}
        <button id="addChild" class="${ui.sm}">+ Add question to this block</button>
      </div>`;
  };

  const questionPanel = (x, i) => {
    const ty = typeOf(x.type), isRep = x.type === "Repeater_QT";
    const tabs = isRep ? [["basic", "Basic"], ["repeater", `Repeater (${x.repeater.children.length})`], ["advanced", "Advanced"]]
                       : [["basic", "Basic"], ...(ty.options ? [["options", "Options"]] : []), ["validation", "Validation"], ["advanced", "Advanced"]];
    if (!tabs.some(([k]) => k === tab)) tab = "basic";
    const body = {
      basic: `
        <div class="space-y-1.5">${lbl("Question")}<input data-q="label" value="${esc(x.label)}" placeholder="${isRep ? "e.g. How many plots do you have?" : "e.g. Are you the owner of the farm?"}" class="${ui.input}"></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">${lbl("Question type")}${typeSelect(`data-q="type"`, x.type)}${hint(esc(ty.description))}</div>
          <div class="space-y-1.5">${lbl("Column name")}<input data-q="key" value="${esc(x.key)}" placeholder="e.g. is_owner" class="${ui.input} font-mono">${hint("Key of the answer in the stored response.")}</div>
        </div>
        <label class="flex items-center gap-3 rounded-md border p-3"><input type="checkbox" data-q="required" ${x.required ? "checked" : ""} class="h-4 w-4 accent-primary"><span><span class="block text-sm font-medium">Required</span><span class="text-xs text-muted-foreground">The surveyor must answer before submitting.</span></span></label>
        <div class="space-y-1.5">${lbl("Help text")}<input data-q="help" value="${esc(x.help ?? "")}" placeholder="Shown under the question on the phone" class="${ui.input}"></div>`,
      options: `<div class="space-y-1.5">${lbl("Options, one per line")}<textarea data-q="optionsText" rows="8" placeholder="Yes&#10;No" class="${ui.input} h-auto font-mono">${esc((x.options ?? []).join("\n"))}</textarea></div>`,
      validation: validationBody(x, ty),
      repeater: isRep ? repeaterBody(x, i) : "",
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

  const typePicker = () => {
    const inBlock = picker !== "top";
    return `
    <div id="picker" class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div class="${ui.card} max-h-[85vh] w-full max-w-3xl overflow-auto">
        <div class="flex items-center justify-between border-b px-4 py-3"><div class="text-sm font-semibold">Select question type${inBlock ? " for the repeater block" : ""}</div><button id="closePicker" class="${ui.icon}">✕</button></div>
        <div class="space-y-5 p-4">${CATEGORIES.map((c) => {
          const types = QUESTION_TYPES.filter((y) => y.category === c.id && !(inBlock && y.id === "Repeater_QT"));
          return types.length ? `<div><div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(c.name)}</div>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${types.map((y) => `<button data-type="${esc(y.id)}" class="rounded-lg border p-3 text-left hover:bg-accent"><div class="text-sm font-medium">${esc(y.label)}</div><div class="text-[11px] text-muted-foreground">${esc(y.description)}</div></button>`).join("")}</div></div>` : "";
        }).join("")}</div>
      </div>
    </div>`;
  };

  // Typing updates state in place (focus is kept); structural changes re-render.
  const wire = (el, x, f, onLabel) => {
    if (f === "type") { el.onchange = () => { x.type = el.value; x.options = typeOf(x.type).options ? (x.options ?? []) : undefined; if (x.type === "Repeater_QT" && !x.repeater) x.repeater = newQuestion("Repeater_QT").repeater; draw(); }; return; }
    el.oninput = () => {
      if (f === "required") x.required = el.checked;
      else if (f === "optionsText") x.options = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
      else x[f] = el.value;
      if (f === "label" && !x._keyEdited) { x.key = keyOf(x.label); const k = el.closest("[data-child], section")?.querySelector(f === "label" && el.dataset.c ? "[data-c=key]" : "[data-q=key]"); if (k) k.value = x.key; }
      if (f === "key") x._keyEdited = true;
      if (onLabel && (f === "label" || f === "required")) onLabel();
    };
  };

  const bind = () => {
    main.querySelectorAll("[data-sel]").forEach((b) => b.onclick = () => { sel = b.dataset.sel === "survey" ? "survey" : Number(b.dataset.sel); tab = "basic"; draw(); });
    main.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
    main.querySelector("#addQ").onclick = () => { picker = "top"; draw(); };
    main.querySelector("#addChild")?.addEventListener("click", () => { picker = { parent: sel }; draw(); });
    main.querySelector("#closePicker")?.addEventListener("click", () => { picker = null; draw(); });
    main.querySelector("#picker")?.addEventListener("click", (e) => { if (e.target.id === "picker") { picker = null; draw(); } });
    main.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => {
      if (picker === "top") { t.questions.push(newQuestion(b.dataset.type)); sel = t.questions.length - 1; tab = "basic"; }
      else { t.questions[picker.parent].repeater.children.push(newQuestion(b.dataset.type)); tab = "repeater"; }
      picker = null; draw();
    });
    main.querySelectorAll("[data-t]").forEach((el) => el.oninput = () => { t[el.dataset.t] = el.value; });
    main.querySelectorAll("[data-q]").forEach((el) => wire(el, t.questions[sel], el.dataset.q, refreshList));
    main.querySelectorAll("[data-child]").forEach((row) => row.querySelectorAll("[data-c]").forEach((el) => wire(el, t.questions[sel].repeater.children[row.dataset.child], el.dataset.c)));
    main.querySelectorAll("[data-r]").forEach((el) => el.onchange = () => {
      const r = t.questions[sel].repeater, f = el.dataset.r;
      r[f] = f === "fixedCount" ? Number(el.value) : el.value;
      if (f === "countSource") draw();
      if (f === "itemLabel") el.closest(".space-y-1\\.5").querySelector("p").textContent = `Preview: ${(r.itemLabel || "Plot #{index}").replace("#{index}", "1")}, ${(r.itemLabel || "Plot #{index}").replace("#{index}", "2")}`;
    });
    main.querySelectorAll("[data-delc]").forEach((b) => b.onclick = () => { t.questions[sel].repeater.children.splice(b.dataset.delc, 1); draw(); });
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
    const num = (v) => (v === "" || v == null ? undefined : isNaN(v) ? v : Number(v));
    const clean = ({ _keyEdited, ...x }) => ({ ...x, key: x.key || keyOf(x.label), min: num(x.min), max: num(x.max), minLength: num(x.minLength), maxLength: num(x.maxLength) });
    t.questions.forEach((x, i) => {
      if (!x.label.trim()) throw new Error(`Question ${i + 1} has no text`);
      if (x.type === "Repeater_QT") {
        if (!x.repeater.children.length) throw new Error(`Question ${i + 1} is a repeater with no questions inside`);
        if (x.repeater.countSource === "question" && !x.repeater.countKey) throw new Error(`Question ${i + 1}: pick the question that gives the repeat count`);
        x.repeater.children.forEach((c, j) => { if (!c.label.trim()) throw new Error(`Question ${i + 1}.${j + 1} has no text`); });
      }
    });
    const questions = t.questions.map((x) => ({ ...clean(x), ...(x.repeater ? { repeater: { ...x.repeater, children: x.repeater.children.map(clean) } } : {}) }));
    const row = { name, az_name: t.az_name?.trim() || null, statuses: t.statuses, questions, updated_at: new Date().toISOString() };
    const saved = await q(id === "new" ? db.from("survey_template_master").insert(row).select().single()
                                       : db.from("survey_template_master").update(row).eq("id", id).select().single());
    toast("Saved"); location.hash = "#/templates/" + saved.id;
  };

  draw();
}
