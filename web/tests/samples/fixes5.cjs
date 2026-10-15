/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Browser checks for the 5 Samples UX corrections (states A–M of the request).
const L = require("./lib.cjs")
const { check, sleep, waitFor, domClick, text, attr, exists } = L

const cardByCode = (page, code) => page.$$eval("[data-sample-card]", (cards, c) => cards.find((x) => x.querySelector("[data-sample-toggle] .font-mono")?.textContent.trim() === c)?.getAttribute("data-sample-card"), code)
const sel = (id) => `[data-sample-card="${id}"]`
const expand = async (page, id) => { if (!(await exists(page, `${sel(id)}[data-expanded]`))) { await domClick(page, `${sel(id)} [data-sample-toggle]`); await waitFor(page, (s) => !!document.querySelector(`${s}[data-expanded]`), 4000, sel(id)) } }
const collapse = async (page, id) => { if (await exists(page, `${sel(id)}[data-expanded]`)) { await domClick(page, `${sel(id)} [data-sample-toggle]`); await waitFor(page, (s) => !document.querySelector(`${s}[data-expanded]`), 4000, sel(id)) } }
const closePreview = async (page) => { await page.keyboard.press("Escape"); await waitFor(page, () => !document.querySelector("[data-photo-preview]"), 4000); await sleep(200) }
const rowIds = (page, id) => page.$$eval(`${sel(id)} [data-sample-details] [data-detail-row]`, (rows) => rows.map((r) => r.getAttribute("data-detail-row")))

async function openFarmer(page, farmerId, tab = "all") {
    await L.closeSheet(page)
    await L.clearFilters(page)
    await L.selectTab(page, tab)
    await L.applyFilter(page, "farmer", farmerId)
    await domClick(page, "[data-row-id]")
    await waitFor(page, (f) => !!document.querySelector(`[data-sample-detail="${f}"]`) && document.querySelectorAll("[data-sample-card]").length > 0, 15000, farmerId)
    await sleep(800)
}

;(async () => {
    const browser = await L.launch()
    const page = await browser.newPage()
    const errors = []
    L.collectErrors(page, errors)
    await L.gotoSamples(page)
    await L.tableSettled(page)

    // ── F-0086 (All view): reported samples, a pending sample with a completed report, verified samples ──
    await openFarmer(page, "F-0086")
    check("detail opened in the All view", (await attr(page, "[data-detail-filter]", "data-detail-filter")) === "all")
    // FIX 1 — no generic history in the detail header
    check("FIX1 no History action in the detail header / summary bar", !(await exists(page, "[data-open-history]")) && (await page.$$eval("[data-summary-bar] button", (b) => b.filter((x) => !x.hasAttribute("data-detail-filter")).length)) === 0)
    const withHistory = await cardByCode(page, "LAQPYM")
    const without = await cardByCode(page, "QDDARF")
    check("LAQPYM (pending, completed report) and QDDARF (verified, never reported) found", !!withHistory && !!without)
    await collapse(page, withHistory)
    check("FIX1-A sample with history, COLLAPSED: history icon in its card header", await exists(page, `${sel(withHistory)} [data-sample-toggle] [data-history-indicator]`))
    await expand(page, withHistory)
    check("FIX1-B sample with history, EXPANDED: history icon still in its card header", await exists(page, `${sel(withHistory)} [data-sample-toggle] [data-history-indicator]`))
    check("FIX1-C sample without history: no icon", !(await exists(page, `${sel(without)} [data-history-indicator]`)))
    const iconCount = await page.$$eval("[data-history-indicator]", (els) => els.length)
    const reportedCards = await page.$$eval("[data-sample-card]", (cards) => cards.filter((c) => c.querySelector("[data-history-indicator]")).length)
    check("FIX1 every history icon sits inside a sample card", iconCount === reportedCards && iconCount === 13, `${iconCount} icons (12 CSV 'marking' reports + LAQPYM)`)
    await domClick(page, `${sel(withHistory)} [data-history-indicator]`)
    check("FIX1 clicking it opens THIS sample's history", await waitFor(page, () => document.querySelector("[data-history-dialog] [data-history-sample]")?.textContent.trim() === "LAQPYM" && document.querySelectorAll("[data-history-entry]").length > 0, 8000))
    const entries = await page.$$eval("[data-history-entry]", (es) => es.map((e) => ({ type: e.getAttribute("data-history-entry"), text: e.textContent.replace(/\s+/g, " ") })))
    console.log("LAQPYM history:", JSON.stringify(entries.map((e) => e.type)))
    check("FIX1 history = reported → corrected → comment → collected of that sample only; no 'show the whole farmer'", entries.some((e) => e.type === "reported") && entries.some((e) => e.type === "corrected") && !(await page.$eval("[data-history-dialog]", (d) => /whole farmer/i.test(d.textContent))))
    await L.screenshot(page, "fix1-history.png")
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-history-dialog]"), 4000)

    // FIX 2 — verified sample: no verification rows in Sample details; the card's verified footer stays
    await expand(page, without)
    const verifiedRows = await rowIds(page, without)
    console.log("verified sample rows:", verifiedRows.join(","))
    check("FIX2-D verified sample: no Verified by / Verified on / Verifier note rows", !verifiedRows.some((r) => /verified_by|verified_on|verifier_comment/.test(r)))
    check("FIX2 the card's 'Verified by … •' footer is still shown", await page.$eval(`${sel(without)} [data-sample-toggle]`, (h) => /Verified by/.test(h.textContent)))
    check("FIX2 rows flow without gaps (contiguous list, alternating stripes intact)", await page.$eval(`${sel(without)} [data-sample-details] dl`, (dl) => [...dl.children].every((c) => c.hasAttribute("data-detail-row"))))
    const pendingRows = await rowIds(page, withHistory)
    check("FIX2-E pending sample rows: Sample ID … GPS, Picture, Plot (no verification rows)", JSON.stringify(pendingRows) === JSON.stringify(["sample_id", "kind", "purpose", "az", "submitted", "collected", "surveyor", "location", "picture", "plot"]), pendingRows.join(","))

    // FIX 3 — Picture is a normal field ("Picture   View"); no media card
    const pic = await page.$eval(`${sel(without)} [data-detail-row="picture"]`, (r) => ({ label: r.querySelector("[data-detail-label]").textContent.trim(), value: r.querySelector("[data-detail-value]").textContent.trim(), height: Math.round(r.getBoundingClientRect().height) }))
    check("FIX3-F 'Picture — View' is a standard DetailRow (one line)", pic.label === "Picture" && pic.value === "View" && pic.height <= 26, JSON.stringify(pic))
    check("FIX3 no dedicated picture card / media field / large preview in the card body", !(await exists(page, "[data-sample-body] [data-media-field], [data-sample-picture]")) && await page.$$eval("[data-sample-body] img", (imgs) => imgs.length === 0))
    await domClick(page, `${sel(without)} [data-picture-view]`)
    check("FIX3-J Picture → View opens the image viewer (loads)", await waitFor(page, () => document.querySelector("[data-photo-preview]")?.getAttribute("data-photo-state") === "ok", 20000), await attr(page, "[data-photo-preview]", "data-photo-state"))
    await closePreview(page)

    // FIX 4 — header thumbnail clickable in both states; the card doesn't toggle
    await domClick(page, `${sel(without)} [data-sample-thumb-open]`)
    check("FIX4-I EXPANDED card: header thumbnail opens the viewer", await waitFor(page, () => !!document.querySelector("[data-photo-preview]"), 5000))
    await closePreview(page)
    check("FIX4 …and the card stays expanded (only the thumbnail acted)", await exists(page, `${sel(without)}[data-expanded]`))
    await collapse(page, without)
    const thumb = await page.$eval(`${sel(without)} [data-sample-thumb-open]`, (b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
    await page.click(`${sel(without)} [data-sample-thumb-open]`)
    check("FIX4-H COLLAPSED card: a real mouse click on the thumbnail opens the viewer", await waitFor(page, () => !!document.querySelector("[data-photo-preview]"), 5000))
    await closePreview(page)
    check("FIX4 …the card stays collapsed; thumbnail keeps its 32×32 size", !(await exists(page, `${sel(without)}[data-expanded]`)) && thumb.w === 32 && thumb.h === 32, JSON.stringify(thumb))
    await page.focus(`${sel(without)} [data-sample-thumb-open]`)
    await page.keyboard.press("Enter")
    check("FIX4 keyboard: Enter on the focused thumbnail opens the viewer (not the card)", await waitFor(page, () => !!document.querySelector("[data-photo-preview]"), 5000) && !(await exists(page, `${sel(without)}[data-expanded]`)))
    await closePreview(page)
    await L.screenshot(page, "fix4-thumbs.png")

    // ── F-1366: no-picture states; the report flow (one field, two fields) ──
    await openFarmer(page, "F-1366")
    const noPic = await cardByCode(page, "MEQGQC")
    check("FIX4/FIX3-G sample without picture: placeholder is not a button; Picture row reads 'Not uploaded'", !!noPic && !(await exists(page, `${sel(noPic)} [data-sample-thumb-open]`)) && (await exists(page, `${sel(noPic)} [data-plot-thumb="none"]`)) && (await (async () => { await expand(page, noPic); return /Not uploaded/.test(await text(page, `${sel(noPic)} [data-detail-row="picture"]`)) })()))
    await L.chooseDetailFilter(page, "pending")
    const REASON2 = "GPS location is incorrect and does not match the sample location."
    const REASON1 = "The photo shows a different bag."
    async function report(code, fields, reason) {
        const id = await cardByCode(page, code)
        await expand(page, id)
        await domClick(page, `${sel(id)} [data-start-report]`)
        await waitFor(page, (s) => document.querySelectorAll(`${s} [data-report-field]`).length === 3, 5000, sel(id))
        for (const f of fields) await domClick(page, `${sel(id)} [data-report-field="${f}"]`)
        const btn = await text(page, `${sel(id)} [data-finalize-report]`)
        const selected = await page.$$eval(`${sel(id)} [data-report-field]`, (opts) => opts.filter((o) => o.getAttribute("data-selected") !== null || o.getAttribute("aria-pressed") === "true" || o.getAttribute("aria-checked") === "true" || o.querySelector('[data-state="checked"]')).map((o) => o.getAttribute("data-report-field")))
        await domClick(page, `${sel(id)} [data-finalize-report]`)
        await waitFor(page, () => !!document.querySelector("[data-report-dialog] [data-report-comment]"), 5000)
        const prefilled = await page.$eval("[data-report-comment]", (t) => t.value)
        await page.type("[data-report-comment]", reason)
        const typed = await page.$eval("[data-report-comment]", (t) => t.value)
        await domClick(page, "[data-submit-report]")
        await waitFor(page, () => !!document.querySelector("[data-report-success]"), 6000)
        await waitFor(page, () => !document.querySelector("[data-report-dialog]"), 8000)
        return { id, btn, selected, prefilled, typed }
    }
    const one = await report("UB8BA5", ["picture"], REASON1)
    check("FIX5-K one field: 'Report Selected (1)'; the comment box starts empty (no field names injected)", one.btn.includes("Report Selected (1)") && one.prefilled === "" && one.typed === REASON1, JSON.stringify({ btn: one.btn, selected: one.selected, prefilled: one.prefilled }))
    const two = await report("J9AG8N", ["sample_id", "location"], REASON2)
    check("FIX5-L two fields: 'Report Selected (2)'; comment box empty before typing", two.btn.includes("Report Selected (2)") && two.prefilled === "", JSON.stringify({ btn: two.btn, selected: two.selected }))
    await L.chooseDetailFilter(page, "need_correction")
    for (const id of [one.id, two.id]) await expand(page, id)
    await sleep(400)
    const block2 = await text(page, `${sel(two.id)} [data-correction-detail]`)
    console.log("correction block (2 fields):", block2)
    check("FIX5-M reason shown = the user's text only (no field names prepended)", block2.includes(REASON2) && !/Sample ID|GPS Coordinates|Sample Picture/.test(block2), block2.slice(0, 160))
    const red2 = await page.$$eval(`${sel(two.id)} [data-correction-field]`, (rows) => rows.map((r) => r.getAttribute("data-correction-field")))
    check("FIX5 reported fields = structured highlight: Sample ID + GPS rows red, Picture not", JSON.stringify(red2.sort()) === JSON.stringify(["location", "sample_id"]), red2.join(","))
    const block1 = await text(page, `${sel(one.id)} [data-correction-detail]`)
    const red1 = await page.$$eval(`${sel(one.id)} [data-correction-field]`, (rows) => rows.map((r) => r.getAttribute("data-correction-field")))
    check("FIX5 one-field report: reason only; Picture row red", block1.includes(REASON1) && !/Sample Picture/.test(block1) && red1.join() === "picture", `${block1.slice(0, 100)} | ${red1}`)
    await L.screenshot(page, "fix5-need-correction.png")
    check("FIX1 the newly reported samples now show the history icon on their cards", await exists(page, `${sel(two.id)} [data-history-indicator]`) && await exists(page, `${sel(one.id)} [data-history-indicator]`))
    await domClick(page, `${sel(two.id)} [data-history-indicator]`)
    await waitFor(page, () => document.querySelectorAll("[data-history-entry='reported']").length > 0, 8000)
    const rep = await page.$eval("[data-history-entry='reported']", (e) => ({ chips: [...e.querySelectorAll("[data-history-fields] span")].map((s) => s.textContent.trim()), summary: e.querySelector("p.text-xs")?.textContent.trim() }))
    console.log("history report entry:", JSON.stringify(rep))
    check("FIX5 history: fields as chips (Sample ID, GPS Coordinates); summary carries the reason only", JSON.stringify(rep.chips) === JSON.stringify(["Sample ID", "GPS Coordinates"]) && rep.summary === `Reported — ${REASON2}`, JSON.stringify(rep))
    await page.keyboard.press("Escape")

    const relevant = L.relevantErrors(errors)
    check("no console errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
