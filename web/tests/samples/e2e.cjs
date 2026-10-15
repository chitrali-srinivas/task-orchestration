/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// End-to-end check of /layouts/samples over the CSV + derived demo dataset. "A<n>" = evidence for the 26-point audit;
// "S-<x>" = the demo-dataset scenarios A–O.
const L = require("./lib.cjs")
const { check, sleep, waitFor, click, domClick, text, texts, attr, exists } = L

const EXPECTED_HEADERS = ["Submitted on", "Farmer", "Village", "Sample ID", "Sample type", "Purpose", "Plot", "AZ code", "AZ name", "Surveyor", "Verified By", "Verified On"]
const EXPECTED_HEADERS_ALL = [...EXPECTED_HEADERS.slice(0, 9), "Status", ...EXPECTED_HEADERS.slice(9)]
const headerTexts = (page) => page.$$eval("thead th", (ths) => ths.map((th) => th.textContent.replace(/\s+/g, " ").trim()).filter(Boolean))
const rowCells = (page, n = 8) => page.$$eval("[data-row-id]", (rows, k) => rows.slice(0, k).map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim())), n)
const findRow = (page, pred) => page.$$eval("[data-row-id]", (rows, src) => { const f = new Function("t", `return ${src}`); return rows.find((r) => f([...r.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")))?.getAttribute("data-row-id") }, pred)
const cardIn = (page, az, pred) => page.$$eval(`[data-az-section="${az}"] [data-sample-card]`, (cards, src) => { const f = new Function("t", `return ${src}`); return cards.find((c) => f(c.textContent.replace(/\s+/g, " ")))?.getAttribute("data-sample-card") }, pred)
const NAME = /[A-Z][a-z]+ [A-Z][a-z]+/

;(async () => {
    const browser = await L.launch()
    const page = await browser.newPage()
    const consoleErrors = []
    L.collectErrors(page, consoleErrors)

    check("table rows load", await L.gotoSamples(page))
    await L.tableSettled(page)

    // ── A1 tabs ──
    const tabs = await page.$$eval("[data-tab]", (els) => els.map((e) => ({ id: e.getAttribute("data-tab"), label: e.textContent.replace(/\d+/g, "").replace(/\s+/g, " ").trim(), count: Number(e.querySelector("[data-tab-count]")?.textContent), active: e.getAttribute("data-state") === "active" })))
    console.log("tabs:", JSON.stringify(tabs))
    check("A1 tab order All · Verified · Pending · Need Correction, Verified selected", tabs.map((t) => t.label).join(" · ") === "All · Verified · Pending · Need Correction" && tabs.find((t) => t.active)?.label === "Verified")
    check("A1 / S-O tab counts are sample counts that sum to All", tabs.filter((t) => t.id !== "all").reduce((n, t) => n + t.count, 0) === tabs.find((t) => t.id === "all").count, JSON.stringify(tabs.map((t) => t.count)))
    check("A19 All = 2188 CSV + 30 demo = 2218; Verified = 38 CSV + 14 demo = 52", tabs.find((t) => t.id === "all")?.count === 2218 && tabs.find((t) => t.id === "approved")?.count === 52)

    // ── A2 / A4 / A7 / A11 / A26 table structure ──
    const headers = await headerTexts(page)
    check("A11 column order (Verified tab)", JSON.stringify(headers) === JSON.stringify(EXPECTED_HEADERS), headers.join(" | "))
    check("A2 no serial column; rows keyed by sample id", !headers.some((h) => /^(#|no\.?|entry|row|s\.?no)/i.test(h)) && await page.$$eval("[data-row-id]", (rows) => rows.every((r) => /^[0-9a-f-]{36}$/.test(r.getAttribute("data-row-id")))))
    check("A4 AZ code | AZ name adjacent", headers.indexOf("AZ name") === headers.indexOf("AZ code") + 1)
    check("A7 no search input", !(await exists(page, "[data-samples-search], [data-table-toolbar] input, input[type=search], input[placeholder*='Search' i]")))
    await page.evaluate(() => [...document.querySelectorAll("thead button")].find((b) => b.textContent.trim().startsWith("Sample ID"))?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })))
    const menuItems = (await waitFor(page, () => document.querySelectorAll('[role="menuitem"]').length > 0, 3000)) ? await texts(page, '[role="menuitem"]') : []
    check("A7 header menu has no Search item", menuItems.length > 0 && !menuItems.some((m) => /search/i.test(m)), menuItems.join(" | "))
    await page.keyboard.press("Escape")
    await sleep(200)
    const toolbar = await page.evaluate(() => { const i = document.querySelector("[data-toolbar-controls] [data-inspector-trigger]")?.getBoundingClientRect(); const f = document.querySelector("[data-toolbar-controls] [data-open-filters]")?.getBoundingClientRect(); return i && f ? { ok: i.right <= f.left && Math.abs(i.top - f.top) < 12 } : null })
    check("A26 Inspector left of Filter (rendered)", !!toolbar?.ok)

    // ── A3 / A5 / A6 Verified tab (names from the mock directory, masked phone ids) ──
    const vbIdx = headers.indexOf("Verified By"), voIdx = headers.indexOf("Verified On"), svIdx = headers.indexOf("Surveyor"), fIdx = headers.indexOf("Farmer"), vIdx = headers.indexOf("Village")
    const cells = await rowCells(page)
    check("A3 Verified By filled, Verified On DD MMM YY", cells.every((c) => c[vbIdx] !== "-" && /^\d{2} [A-Z]{3} \d{2}$/.test(c[voIdx])), cells.map((c) => `${c[vbIdx]} / ${c[voIdx]}`).slice(0, 2).join(" | "))
    check("A5 Surveyor = name over masked phone (V2 cell)", cells.every((c) => NAME.test(c[svIdx]) && /\*{6,}\d{4}$/.test(c[svIdx])), cells[0][svIdx])
    check("A19 Village '-' (not in the export); farmer named from the mock directory; AZ name from it", cells.every((c) => c[vIdx] === "-" && NAME.test(c[fIdx]) && /^(Wheat|Rice|Maize)$/.test(c[headers.indexOf("AZ name")])), `${cells[0][fIdx]} / ${cells[0][vIdx]} / ${cells[0][headers.indexOf("AZ name")]}`)
    const farmerHover = await L.hoverShows(page, "[data-row-id]:nth-child(1) td:nth-child(2) .cursor-help")
    check("A6 Farmer hover card (name; no phone in the export)", !!farmerHover && NAME.test(farmerHover), (farmerHover || "").slice(0, 80))
    const surveyorHover = await L.hoverShows(page, `[data-row-id]:nth-child(1) td:nth-child(${svIdx + 1}) .cursor-help`)
    check("A6 Surveyor hover card (name + masked phone)", !!surveyorHover && NAME.test(surveyorHover) && /\*{6,}\d{4}/.test(surveyorHover), (surveyorHover || "").slice(0, 80))
    const verifierHover = await L.hoverShows(page, `[data-row-id]:nth-child(1) td:nth-child(${vbIdx + 1}) .cursor-help`)
    check("A6 Verifier hover card (same component)", !!verifierHover && /\*{6,}\d{4}/.test(verifierHover), (verifierHover || "").slice(0, 80))
    await L.screenshot(page, "01-table-verified.png")
    await L.applyFilter(page, "farmer", "F-0073")
    const vCells = (await waitFor(page, () => document.querySelectorAll("[data-row-id]").length === 3, 8000)) ? await rowCells(page, 3) : []
    check("S-D Verified tab, F-0073: its 3 verified demo samples (AZ2 · Rice · Pre · Control)", vCells.length === 3 && vCells.every((c) => c[headers.indexOf("AZ code")] === "AZ2" && c[headers.indexOf("Purpose")] === "Pre" && c[headers.indexOf("Sample type")] === "Control"), vCells.map((c) => c.slice(3, 9).join(" ")).join(" | "))
    await L.clearFilters(page)

    // ── Pending tab: empty states; All tab: Status ──
    await L.selectTab(page, "pending")
    const pendingCells = await rowCells(page, 6)
    check("A3 Pending: Verified By / On = '-'", pendingCells.every((c) => c[vbIdx] === "-" && c[voIdx] === "-"))
    check("S-O Pending page 1 leads with the demo rows (Sep/Oct 2026)", pendingCells.every((c) => /(0[1-9] OCT 26|[23]\d SEP 26)/.test(c[0])), pendingCells.map((c) => c[0]).slice(0, 3).join(" | "))
    await L.selectTab(page, "all")
    check("A11 All tab adds Status after AZ name; V2 badge words", JSON.stringify(await headerTexts(page)) === JSON.stringify(EXPECTED_HEADERS_ALL) && await page.$$eval("[data-bucket-badge]", (b) => b.length > 0 && b.every((x) => /^(Verified|Pending|Need Correction)$/.test(x.textContent.trim()))))
    await L.selectTab(page, "pending")

    // ── S-A/B/C detail: F-0073 — one farmer, three AZs, both kinds, 6 purposes ──
    await L.applyFilter(page, "farmer", "F-0073")
    await waitFor(page, () => document.querySelectorAll("[data-row-id]").length === 20, 8000)
    await page.$eval("[data-samples-scroll]", (el) => el.scrollTo(0, el.scrollHeight))
    check("F-0073 Pending: 31 rows (20 + infinite scroll)", await waitFor(page, () => document.querySelectorAll("[data-row-id]").length === 31, 10000), String(await page.$$eval("[data-row-id]", (r) => r.length)))
    const eoyRowId = await findRow(page, 't.includes("| EOY |") && t.includes("| AZ2 |") && t.includes("Boundary required")')
    check("the AZ2 EOY (boundary required) row is present", !!eoyRowId)
    await domClick(page, `[data-row-id="${eoyRowId}"]`)
    check("A12 detail opens in the FARMER context", await waitFor(page, () => !!document.querySelector('[data-sample-detail="F-0073"]') && document.querySelectorAll("[data-sample-card]").length > 0, 15000))
    const farmerTitle = await text(page, "[data-detail-farmer]")
    check("A12 header: directory name; details bar lists AZ1, AZ2, AZ3", NAME.test(farmerTitle) && (await attr(page, "[data-detail-azs]", "data-detail-azs")) === "AZ1,AZ2,AZ3", `${farmerTitle} / ${await attr(page, "[data-detail-azs]", "data-detail-azs")}`)
    check("S-B Pending view: AZ groups AZ1 · AZ2 · AZ3", (await page.$$eval("[data-az-section]", (s) => s.map((x) => x.getAttribute("data-az-section")))).join(",") === "AZ1,AZ2,AZ3")
    check("A12 AZ2 group header: 'AZ2 · Rice · 5 of 8 samples' (V2 group header, filtered count)", await page.$eval('[data-az-section="AZ2"] [data-az-toggle]', (b) => /AZ2 · Rice\s*·\s*5 of 8 samples/.test(b.textContent.replace(/\s+/g, " "))), await text(page, '[data-az-section="AZ2"] [data-az-toggle]'))
    check("A12 selected sample revealed inside AZ2", await waitFor(page, (id) => !!document.querySelector(`[data-az-section="AZ2"] [data-sample-card="${id}"][data-highlighted][data-expanded]`), 8000, eoyRowId))
    const purposeRows = await page.$$eval("[data-purpose-group]", (gs) => gs.map((g) => { const head = g.firstElementChild; const spans = [...head.querySelectorAll("span")]; return { az: g.closest("[data-az-section]").getAttribute("data-az-section"), label: spans[0]?.textContent.trim(), count: spans[1]?.textContent.trim(), oneLine: head.getBoundingClientRect().height < 28 } }))
    console.log("purpose rows:", JSON.stringify(purposeRows))
    check("A21 / S-C purpose rows: label left, count right, one line; AZ1 shows 5 purposes", purposeRows.filter((p) => p.az === "AZ1").length === 5 && purposeRows.every((p) => /sample/.test(p.label) && /^\d+$/.test(p.count) && p.oneLine))
    check("A21 kind suffix only where an AZ holds both kinds (AZ2)", purposeRows.filter((p) => p.az === "AZ2").every((p) => /· (Control|Deployment)$/.test(p.label)) && purposeRows.filter((p) => p.az === "AZ1").every((p) => !/·/.test(p.label)))
    await page.hover("[data-sample-count]")
    await waitFor(page, () => document.querySelectorAll("[data-sample-count-card] [data-purpose-count]").length > 0, 3000)
    const breakdown = await page.$$eval("[data-sample-count-card] [data-purpose-count]", (lis) => lis.map((li) => ({ label: li.firstElementChild.textContent.trim(), count: Number(li.lastElementChild.textContent.trim()) })))
    console.log("count hover card:", JSON.stringify(breakdown))
    check("A23 / S-M '36 Samples' hover card: 7 purpose rows summing to 36 (both kinds)", (await text(page, "[data-sample-count]")) === "36 Samples" && breakdown.length === 7 && breakdown.reduce((n, r) => n + r.count, 0) === 36)
    await page.mouse.move(5, 5)
    await sleep(400)
    check("A8 / A9 / A22 no system-validation UI; boundary strip present", !(await exists(page, "[data-open-validation], [data-validation-list], [data-validation-dialog], [data-strip='validation']")) && (await exists(page, '[data-strip="boundary"]')))
    check("A20 / A25 footer = position + farmer nav only; no bulk UI", await page.evaluate(() => /^\d+ \/ \d+$/.test(document.querySelector("[data-farmer-position]").closest("div.border-t").textContent.replace(/\s+/g, " ").trim())) && !(await exists(page, '[data-sample-detail] input[type="checkbox"], [data-select-bar], [data-approve-selected]')))
    const align = await page.$eval(`[data-sample-card="${eoyRowId}"]`, (card) => { const line = card.querySelector('[data-approve-blocker="boundary_required"]'); const r = (el) => el.getBoundingClientRect(); const span = line.querySelector("span"); return { display: getComputedStyle(line).display, left: Math.round(r(line).left - r(card.querySelector("[data-sample-details]")).left), noOverflow: span.scrollWidth <= span.clientWidth + 1 } })
    check("A10 blocker line aligned (flex, flush, no overflow)", align.display === "flex" && Math.abs(align.left) <= 1 && align.noOverflow, JSON.stringify(align))
    await L.screenshot(page, "02-detail-f0073.png")

    // A17 / A14 / A13 on the revealed card (S-L GPS, S-J picture)
    const surveyorRow = await page.$eval(`[data-sample-card="${eoyRowId}"] [data-detail-row="surveyor"]`, (r) => ({ text: r.textContent.replace(/\s+/g, " ").trim(), hasHover: !!r.querySelector(".cursor-help") }))
    check("A17 Surveyor row = V2 SurveyorCell (name + masked phone)", surveyorRow.hasHover && NAME.test(surveyorRow.text) && /\*{6,}\d{4}/.test(surveyorRow.text), surveyorRow.text)
    const gps = await text(page, `[data-sample-card="${eoyRowId}"] [data-detail-row="location"]`)
    check("A14 / S-L GPS 'lat° N, lng° E' near the farmer's real fields (~22.10° N, 79.57° E)", /22\.\d{4}° N, 79\.\d{4}° E/.test(gps), gps)
    const media = await page.$eval(`[data-sample-card="${eoyRowId}"] [data-detail-row="picture"]`, (r) => r.textContent.replace(/\s+/g, " ").trim()).catch(() => null)
    check("A13 / S-J Picture field: 'Picture  View' (a normal detail row)", /^Picture\s*View$/.test(media ?? ""), media)
    await domClick(page, `[data-sample-card="${eoyRowId}"] [data-picture-view]`)
    check("A13 View opens the preview; the Firebase image loads", await waitFor(page, () => document.querySelector("[data-photo-preview]")?.getAttribute("data-photo-state") === "ok", 20000), await attr(page, "[data-photo-preview]", "data-photo-state"))
    await L.screenshot(page, "03-photo-preview.png")
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-photo-preview]"), 4000)
    await domClick(page, `[data-sample-card="${eoyRowId}"] [data-sample-thumb-open]`)
    check("A13 clicking the card-header picture opens the preview too", await waitFor(page, () => !!document.querySelector("[data-photo-preview]"), 5000))
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-photo-preview]"), 4000)

    // A18 map
    const mapOk = await waitFor(page, () => !!document.querySelector("[data-samples-map] .gm-style"), 20000)
    check("map renders", mapOk)
    check("A18 loader faded; selected card; Reset view after the fly-to", await waitFor(page, () => !!document.querySelector("[data-map-ready]") && !!document.querySelector("[data-map-selected-card]") && !!document.querySelector("[data-map-reset-view]"), 12000))
    check("legend lists purposes and both kinds", await page.$eval("[data-map-legend]", (e) => /EOY/.test(e.textContent) && /Deployment/.test(e.textContent) && /Control/.test(e.textContent)).catch(() => false))
    await sleep(2500)
    {
        const selectedCode = await page.$eval("[data-map-selected-card] .font-mono", (e) => e.textContent.trim()).catch(() => "")
        const markerTitles = await page.$$eval("[data-samples-map] [title*=' · ']", (els) => els.map((e) => e.getAttribute("title")))
        const other = markerTitles.find((t) => /· EOY · Control$/.test(t) && (!selectedCode || !t.startsWith(selectedCode))) ?? markerTitles.find((t) => !selectedCode || !t.startsWith(selectedCode))
        if (other) {
            try { await click(page, `[data-samples-map] [title="${other}"]`, 2) } catch { await page.$eval(`[data-samples-map] [title="${other}"]`, (el) => el.click()) }
            check("A18 map → list: marker click reveals its card", await waitFor(page, (c) => [...document.querySelectorAll("[data-sample-card][data-highlighted][data-expanded]")].some((e) => e.textContent.includes(c)), 6000, other.split(" · ")[0]), other.split(" · ")[0])
            await domClick(page, `[data-sample-card="${eoyRowId}"] [data-sample-toggle]`)
            await waitFor(page, (id) => !!document.querySelector(`[data-sample-card="${id}"][data-highlighted]`), 5000, eoyRowId)
            if (!(await exists(page, `[data-sample-card="${eoyRowId}"][data-expanded]`))) await domClick(page, `[data-sample-card="${eoyRowId}"] [data-sample-toggle]`)
        } else check("A18 map → list: marker click reveals its card", false, `no marker titles (${markerTitles.length})`)
    }

    // ── A15 / A16 / S-I report flow on an AZ2 DEPLOYMENT pre sample ──
    const depId = await cardIn(page, "AZ2", 't.includes("Deployment")')
    check("S-I a deployment sample card exists in AZ2", !!depId)
    if (!(await exists(page, `[data-sample-card="${depId}"][data-expanded]`))) await domClick(page, `[data-sample-card="${depId}"] [data-sample-toggle]`)
    check("S-I deployment card: Deployment type, deployment plot, no boundary blocker, Approve enabled", await waitFor(page, (id) => { const c = document.querySelector(`[data-sample-card="${id}"][data-expanded]`); return !!c && /Deployment/.test(c.querySelector('[data-detail-row="kind"]')?.textContent ?? "") && !c.querySelector("[data-approve-blocker]") && !c.querySelector("[data-approve-sample]").disabled }, 6000, depId))
    check("A18 expanding flies the map to it", await waitFor(page, (id) => !!document.querySelector(`[data-map-selected-card="${id}"]`), 8000, depId))
    await domClick(page, `[data-sample-card="${depId}"] [data-start-report]`)
    check("A15 report mode on the card (3 selectable fields, no dialog yet)", await waitFor(page, (id) => document.querySelectorAll(`[data-sample-card="${id}"] [data-report-field]`).length === 3 && !document.querySelector("[data-report-dialog]"), 5000, depId))
    const fieldLabels = await texts(page, `[data-sample-card="${depId}"] [data-report-field]`)
    check("A16 fields = Sample ID · GPS Coordinates · Sample Picture", /Sample ID/.test(fieldLabels[0]) && /GPS Coordinates/.test(fieldLabels[1]) && /Sample Picture/.test(fieldLabels[2]), fieldLabels.join(" | "))
    await domClick(page, `[data-sample-card="${depId}"] [data-report-field="location"]`)
    check("A15 'Report Selected (1)'", await waitFor(page, (id) => document.querySelector(`[data-sample-card="${id}"] [data-finalize-report]`)?.textContent.includes("Report Selected (1)"), 3000, depId))
    await domClick(page, `[data-sample-card="${depId}"] [data-finalize-report]`)
    await waitFor(page, () => !!document.querySelector("[data-report-dialog] [data-report-comment]"), 5000)
    check("A15 Submit disabled until a comment", await page.$eval("[data-submit-report]", (b) => b.disabled))
    await page.type("[data-report-comment]", "GPS point sits outside the deployment plot.")
    await domClick(page, "[data-submit-report]")
    check("A15 success → dialog closes → sample leaves Pending", await waitFor(page, () => !!document.querySelector("[data-report-success]"), 5000) && await waitFor(page, (id) => !document.querySelector("[data-report-dialog]") && !document.querySelector(`[data-sample-card="${id}"]`), 8000, depId))
    await L.chooseDetailFilter(page, "need_correction")
    check("S-G Need Correction view: the reported deployment sample + the two AZ3 demo cases", await waitFor(page, (id) => !!document.querySelector(`[data-sample-card="${id}"][data-bucket="need_correction"]`) && document.querySelectorAll('[data-az-section="AZ3"] [data-sample-card]').length === 2, 6000, depId))
    for (const id of await page.$$eval('[data-az-section="AZ3"] [data-sample-card]', (c) => c.map((x) => x.getAttribute("data-sample-card")))) if (!(await exists(page, `[data-sample-card="${id}"][data-expanded]`))) await domClick(page, `[data-sample-card="${id}"] [data-sample-toggle]`)
    await sleep(400)
    const az3Text = await text(page, '[data-az-section="AZ3"]')
    check("S-G / S-L AZ3: rejected 'location invalid' → V2 correction block naming GPS Coordinates; the no-GPS sample reads 'Not recorded'", /location invalid/.test(az3Text) && /GPS Coordinates/.test(az3Text) && /Not recorded/.test(az3Text))
    await L.screenshot(page, "04-need-correction.png")
    await L.chooseDetailFilter(page, "pending")

    // ── S-H boundary workflow on the AZ2 EOY card → approve ──
    if (mapOk) {
        await domClick(page, `[data-sample-card="${eoyRowId}"] [data-draw-boundary]`)
        const editor = await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 15000)
        check("S-H boundary editor opens in draw mode", editor && (await attr(page, "[data-boundary-editor]", "data-boundary-mode")) === "draw")
        await sleep(2000)
        const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2, d = 160
        for (const [dx, dy] of [[-d, -d], [d, -d], [d, d], [-d, d]]) { await page.mouse.click(cx + dx, cy + dy); await sleep(700) }
        await click(page, "[data-boundary-finish]")
        await sleep(400)
        await click(page, "[data-boundary-save]")
        const saved = await waitFor(page, () => !document.querySelector("[data-boundary-editor]") && !!document.querySelector('[data-toast="success"]'), 10000)
        const toast = saved ? await text(page, "[data-toast]") : ""
        check("S-H boundary saved: generated plot, assigned to the other EOY sample too", saved && /GP-\d{5}/.test(toast) && /also assigned to 1 other sample/.test(toast), toast)
        if (saved) {
            await waitFor(page, (id) => !document.querySelector(`[data-sample-card="${id}"] [data-approve-sample]`)?.disabled, 8000, eoyRowId)
            await domClick(page, `[data-sample-card="${eoyRowId}"] [data-approve-sample]`)
            await waitFor(page, () => !!document.querySelector("[data-approve-dialog]"), 4000)
            await click(page, "[data-confirm-approve]")
            check("S-H / S-F approve after boundary; the sample leaves Pending", await waitFor(page, () => [...document.querySelectorAll("[data-toast]")].some((t) => /approved/i.test(t.textContent)), 8000) && await waitFor(page, (id) => !document.querySelector(`[data-sample-card="${id}"]`), 8000, eoyRowId))
        }
    }
    await page.evaluate(() => document.querySelectorAll("[data-toast] [aria-label=Dismiss]").forEach((b) => b.click()))
    await sleep(400)
    check("no History action in the detail header", !(await exists(page, "[data-open-history]")))
    await L.chooseDetailFilter(page, "need_correction")
    await domClick(page, `[data-sample-card="${depId}"] [data-history-indicator]`)
    await waitFor(page, () => !!document.querySelector("[data-history-dialog]"), 5000)
    check("the reported card's history icon opens that sample's history", await waitFor(page, () => document.querySelectorAll("[data-history-entry]").length >= 2, 15000), `${await page.$$eval("[data-history-entry]", (x) => x.length)} entries, state ${await attr(page, "[data-history-state]", "data-history-state")}`)
    await page.keyboard.press("Escape")
    await sleep(300)
    await L.closeSheet(page)

    // ── A24 / S-N farmer navigation across page-1 farmers ──
    await L.clearFilters(page)
    await waitFor(page, () => document.querySelectorAll("[data-row-id]").length >= 20, 10000)
    await domClick(page, "[data-row-id]")
    await waitFor(page, () => !!document.querySelector("[data-sample-detail]") && document.querySelectorAll("[data-sample-card]").length > 0, 15000)
    const visited = [await attr(page, "[data-sample-detail]", "data-sample-detail")]
    const pos0 = await text(page, "[data-farmer-position]")
    check("A24 position counts farmers; Previous disabled first", /^1 \/ \d+$/.test(pos0) && Number(pos0.split(" / ")[1]) < tabs.find((t) => t.id === "pending").count && await page.$eval("[data-prev-farmer]", (b) => b.disabled), pos0)
    for (let i = 0; i < 3; i++) {
        const before = visited[visited.length - 1]
        await domClick(page, "[data-next-farmer]")
        const moved = await waitFor(page, (prev) => { const d = document.querySelector("[data-sample-detail]"); return !!d && d.getAttribute("data-sample-detail") !== prev && document.querySelectorAll("[data-sample-card]").length > 0 }, 10000, before)
        const now = await attr(page, "[data-sample-detail]", "data-sample-detail")
        check(`A24 Next farmer ${i + 1}: ${before} → ${now} (${await text(page, "[data-detail-farmer]")}, AZs ${await attr(page, "[data-detail-azs]", "data-detail-azs")}, ${await page.$$eval("[data-sample-card]", (c) => c.length)} cards)`, moved && !visited.includes(now))
        visited.push(now)
    }
    await domClick(page, "[data-prev-farmer]")
    check("A24 Previous returns", await waitFor(page, (id) => document.querySelector("[data-sample-detail]")?.getAttribute("data-sample-detail") === id, 10000, visited[2]))
    check("S-N four distinct real farmers visited", new Set(visited).size === 4 && visited.every((v) => /^F-\d{4}$/.test(v)), visited.join(" → "))
    await L.closeSheet(page)

    // ── S-A / S-K / A18 F-1366: 9 control pre without plot + 8 deployment; clustering; missing picture ──
    if (mapOk) {
        await L.applyFilter(page, "farmer", "F-1366")
        await domClick(page, "[data-row-id]")
        await waitFor(page, () => !!document.querySelector('[data-sample-detail="F-1366"]') && document.querySelectorAll("[data-sample-card]").length > 0, 15000)
        check("S-A F-1366: 17 samples, both kinds in one AZ; Pending view 11 cards (9 real pre + 2 demo start)", (await text(page, "[data-sample-count]")) === "17 Samples" && (await page.$$eval("[data-sample-card]", (c) => c.length)) === 11, `${await text(page, "[data-sample-count]")} / ${await page.$$eval("[data-sample-card]", (c) => c.length)}`)
        await waitFor(page, () => !!document.querySelector("[data-samples-map] .gm-style") && !!document.querySelector("[data-map-ready]"), 15000)
        await sleep(2500)
        if (await exists(page, "[data-map-reset-view]")) await click(page, "[data-map-reset-view]")
        await sleep(1200)
        let clusters = await page.$$eval("[data-samples-map] div[title*='zoom in to separate']", (els) => els.length)
        for (let z = 0; z < 4 && clusters === 0; z++) { await page.evaluate(() => document.querySelector('[data-samples-map] button[title="Zoom out"]')?.click()); await sleep(900); clusters = await page.$$eval("[data-samples-map] div[title*='zoom in to separate']", (els) => els.length) }
        check("A18 clustering", clusters > 0, `${clusters} clusters`)
        await L.screenshot(page, "05-clusters.png")
        await L.chooseDetailFilter(page, "need_correction")
        const nc = await page.$$eval("[data-sample-card]", (cards) => cards.map((c) => c.getAttribute("data-sample-card")))
        for (const id of nc) if (!(await exists(page, `[data-sample-card="${id}"][data-expanded]`))) await domClick(page, `[data-sample-card="${id}"] [data-sample-toggle]`)
        await sleep(400)
        const pictureRows = await texts(page, '[data-sample-card] [data-detail-row="picture"]')
        check("S-K missing picture: 'Sample picture — Not uploaded' on the pending deployment start sample", pictureRows.some((t) => /Not uploaded/.test(t)), pictureRows.join(" | "))
        check("S-G rejected deployment EOY: reason 'wrong picture' + the Picture row highlighted (field kept structured); a reason-less rejection also shows", nc.length === 3 && await page.evaluate(() => /wrong picture/.test(document.querySelector("[data-sample-detail]").textContent)) && (await page.$$eval('[data-correction-field="picture"]', (r) => r.length)) >= 1, `${nc.length} cards`)
        await L.screenshot(page, "06-f1366-need-correction.png")
        await L.closeSheet(page)
        await L.clearFilters(page)
    }

    // ── S-H(b) F-0214: a boundary already saved (generated plot, editable) ──
    await L.applyFilter(page, "farmer", "F-0214")
    await domClick(page, "[data-row-id]")
    await waitFor(page, () => !!document.querySelector('[data-sample-detail="F-0214"]') && document.querySelectorAll("[data-sample-card][data-expanded]").length > 0, 15000)
    check("S-H(b) F-0214: plot GP-00001 on the card, Approve enabled; details bar '3 Samples . 1 Plot'", await page.evaluate(() => { const c = document.querySelector("[data-sample-card][data-expanded]"); return /GP-00001/.test(c.textContent) && !c.querySelector("[data-approve-sample]").disabled }) && /3 Samples . 1 Plot/.test(await page.$eval("[data-sample-count]", (e) => e.parentElement.textContent.replace(/\s+/g, " "))))
    await L.closeSheet(page)
    await L.clearFilters(page)

    // ── Inspector provenance ──
    await click(page, "[data-inspector-trigger]")
    await waitFor(page, () => document.querySelectorAll("[data-inspector-tab]").length > 3, 5000)
    await click(page, '[data-inspector-tab="mock-data"]')
    await waitFor(page, () => !!document.querySelector('[data-inspector-section="mock-data"]'), 3000)
    check("A19 inspector names the CSV, the demo records and the mock name directory", await page.$eval("[data-inspector]", (e) => /sample_data\.csv/.test(e.textContent) && /samples-demo\.json/.test(e.textContent) && /30 records cloned/.test(e.textContent) && /Name directory/.test(e.textContent)))
    check("A19 inspector masks phone ids", !(await page.$eval("[data-inspector]", (e) => /\+91\d{10}/.test(e.textContent))))

    const relevant = L.relevantErrors(consoleErrors)
    console.log("console errors:", JSON.stringify(consoleErrors.slice(0, 12), null, 1))
    check("no unexpected console errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
