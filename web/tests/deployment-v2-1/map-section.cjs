/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the farmer detail's map section (components/deployment-detail-sheet.tsx MapPreviewContent
// and the map panel, components/map-overlays.tsx, components/map-camera.ts overlayPadding):
//   - from 1024 px the map is beside the sheet, wholly on screen; below 1024 px it is IN the sheet, under the farmer's
//     name and totals (it used to hang off-screen to the left, its controls and legend with it);
//   - one control group (zoom in / out, Reset View) bottom-right on the map — Google's own zoom / camera controls off;
//     Reset View always in place: disabled while the view is the farmer's framing, enabled once the user zooms, and it
//     returns the camera to the farmer's framing;
//   - the legend: Deployment V2's (two stacked sections, ≤ 13.75rem) bottom-left on the map beside the sheet; in the
//     sheet the same sections side by side as a strip under the map (never over it), out of the way while a card shows;
//   - the selected plot's card: its dispatch in the header (ID left, status at the other end, one line, shown once),
//     the plot's title, its rows (facts, source), the full-width boundary action — top-right on the map beside the
//     sheet; in the sheet the same card under the map, so it never covers the plot it describes;
//   - nothing overlaps (card / controls / legend / the no-plots note) and nothing leaves the map or the window, at
//     1600 × 900, 1280 × 800, 1100 × 800, 1024 × 768, 768 × 1024 and 390 × 844; no horizontal scroll;
//   - in the sheet: Next moves to the next farmer and the map follows; one plot (?mockMap=one) and no plot locations
//     (?mockMap=none) read correctly; the loading cover covers the map only.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const SIZES = [[1600, 900], [1280, 800], [1100, 800], [1024, 768], [768, 1024], [390, 844]]
const layout = (page) => page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width === 0 && b.height === 0 ? null : { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height } }
    const q = (s) => document.querySelector(s)
    const controls = q("[data-map-controls]")
    return {
        vw: innerWidth, vh: innerHeight, docOverflow: document.documentElement.scrollWidth - innerWidth,
        panel: r(q(".map-preview-module")), map: r(q("[data-map-farmer]")), controls: r(controls), legend: r(q("[data-map-legend]")),
        card: r(q("[data-plot-map-card]")), note: r(q("[data-map-no-plots]")), details: r(q("[data-farmer-details]")), sheet: r(q("[data-detail-identity]")?.closest('[role="dialog"]')),
        controlNames: controls ? [...controls.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")) : [],
        reset: q("[data-map-reset-view]") ? (q("[data-map-reset-view]").disabled ? "disabled" : "enabled") : "absent",
        googleZoom: document.querySelectorAll('.gm-style button[title="Zoom in"], .gm-style button[title="Zoom out"]').length,
        googleCamera: document.querySelectorAll('.gm-style button[title="Map camera controls"]').length,
        zoom: Number(q("[data-map-farmer]")?.getAttribute("data-map-zoom")),
        farmer: q("[data-map-farmer]")?.getAttribute("data-map-farmer") ?? null,
        sheetOverflow: (() => { const s = q("[data-detail-identity]")?.closest('[role="dialog"]'); return s ? s.scrollWidth - s.clientWidth : 0 })(),
    }
})
const inside = (a, b, slack = 0.5) => !!a && !!b && a.x >= b.x - slack && a.y >= b.y - slack && a.r <= b.r + slack && a.b <= b.b + slack
const overlap = (a, b) => !!a && !!b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5
async function openFirst(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.openRow(page, 0)
    await L.detailLoaded(page)
    await waitFor(page, () => !document.querySelector("[data-map-cover]"), 20000)
    await sleep(2500)
}
async function selectPlot(page) {
    await L.expandAllDispatches(page)
    await sleep(500)
    const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
    await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), plot)
    await waitFor(page, () => !!document.querySelector("[data-plot-map-card]"), 8000)
    await sleep(2500)
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    for (const [w, h] of SIZES) {
        const page = await L.open(browser, L.V21, errors)
        await page.setViewport({ width: w, height: h })
        await openFirst(page)
        const wide = w >= 1024
        const d = await layout(page)
        const where = wide
            ? d.panel && d.panel.x >= -0.5 && d.panel.r <= d.sheet.x + 1 && Math.abs(d.panel.h - h) <= 1
            : d.panel && d.panel.x >= d.sheet.x - 0.5 && d.panel.r <= d.vw + 0.5 && d.panel.y >= d.details.b - 0.5
        check(`${w}×${h}: the map is ${wide ? "beside the sheet, wholly on screen" : "in the sheet, under the farmer's name and totals, wholly on screen"}`, !!where, JSON.stringify({ panel: d.panel, sheet: d.sheet, details: d.details }))
        // opened from a table row, the view is that dispatch's plots: Reset view (back to the farmer's framing) is live
        check(`${w}×${h}: one control group on the map — Zoom in, Zoom out, Reset view; Google's own zoom / camera controls off`,
            inside(d.controls, d.map) && d.controlNames.join(",") === "Zoom in,Zoom out,Reset view" && d.reset === "enabled" && d.googleZoom === 0 && d.googleCamera === 0, JSON.stringify({ controls: d.controls, names: d.controlNames, reset: d.reset, googleZoom: d.googleZoom, googleCamera: d.googleCamera }))
        const legendPlace = wide ? inside(d.legend, d.map) && d.legend.w <= 221 && d.legend.h <= 160 && d.legend.x <= d.map.x + 12 && !overlap(d.legend, d.controls) : d.legend && d.legend.y >= d.map.b - 0.5 && inside(d.legend, d.panel)
        check(`${w}×${h}: the legend is ${wide ? "Deployment V2's card, bottom-left on the map (≤ 13.75rem), clear of the controls" : "a strip under the map, never over it"}`, !!legendPlace, JSON.stringify({ legend: d.legend, map: d.map, controls: d.controls }))
        check(`${w}×${h}: no horizontal scroll (page or sheet)`, d.docOverflow <= 0 && d.sheetOverflow <= 0, JSON.stringify({ doc: d.docOverflow, sheet: d.sheetOverflow }))

        await selectPlot(page)
        const s = await layout(page)
        const card = await page.evaluate(() => {
            const c = document.querySelector("[data-plot-map-card]")
            const head = c?.querySelector("[data-plot-map-header]")
            const edit = c?.querySelector("[data-edit-boundary]")?.getBoundingClientRect()
            return {
                region: c?.getAttribute("aria-label") ?? "",
                noPlotIdLine: !c?.querySelector("[data-plot-map-title]") && !/DEPL-\d+/.test(c?.textContent ?? ""),
                close: !!head?.querySelector("[data-plot-map-close]"),
                edit: edit ? { w: Math.round(edit.width), cardW: Math.round(c.getBoundingClientRect().width) } : null,
                rows: [...(c?.querySelectorAll("[data-plot-map-row]") ?? [])].map((e) => e.getAttribute("data-plot-map-row")),
                head: (() => { const d = c?.querySelector("[data-plot-map-dispatch]"), st = c?.querySelector("[data-plot-map-status]"); if (!d || !st) return null; const a = d.getBoundingClientRect(), b = st.getBoundingClientRect(); return { sameLine: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) <= 3, statusRight: b.left > a.right - 1, ids: (c.textContent.match(/DISP-\d+/g) ?? []).length } })(),
                legendShown: !!document.querySelector("[data-map-legend]") && getComputedStyle(document.querySelector("[data-map-legend]")).display !== "none",
            }
        })
        const content = /^Selected plot DEPL-\d+/.test(card.region) && card.noPlotIdLine && card.close && card.rows.includes("source") && !card.rows.includes("dispatch") && card.rows.length >= 3 && !!card.head && card.head.sameLine && card.head.statusRight && card.head.ids === 1 && !!card.edit && card.edit.w >= card.edit.cardW - 24
        const place = wide
            ? inside(s.card, s.map) && s.card.w <= 273 && s.card.r >= s.map.r - 16 && s.card.y <= s.map.y + 16
            : s.card && s.card.y >= s.map.b - 0.5 && inside(s.card, s.panel) && s.card.w >= s.map.w - 2 && !card.legendShown
        check(`${w}×${h}: the selected plot's card — its dispatch once, in the header (ID left, status at the other end, one line), no repeated ID line above the plot's rows (Plot Number first), the full-width boundary action — ${wide ? "top-right on the map (17rem)" : "under the map, full width, the legend stepping aside"}`,
            content && place, JSON.stringify({ card, box: s.card, map: s.map }))
        check(`${w}×${h}: the card overlaps neither the controls nor the legend${wide ? "" : ", and leaves the map uncovered"}`, !overlap(s.card, s.controls) && !(card.legendShown && overlap(s.card, s.legend)) && (wide || !overlap(s.card, s.map)), JSON.stringify({ card: s.card, controls: s.controls, legend: s.legend, map: s.map }))
        if (w === 1600 || w === 390) await page.screenshot({ path: require("path").join(L.OUT, `map-section-${w}x${h}.png`) })
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── zoom / Reset View ────────────────────────────────────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockMap=dispatch`, errors)
        await page.setViewport({ width: 1280, height: 800 })
        await openFirst(page)
        const framed = await layout(page)
        await page.click("[data-map-zoom-in]")
        await sleep(1500)
        const zoomed = await layout(page)
        await page.click("[data-map-zoom-out]"); await sleep(800)
        await page.click("[data-map-zoom-out]"); await sleep(1500)
        const out = await layout(page)
        check("zoom buttons: + is one level in, − one level out; a user zoom enables Reset view", zoomed.zoom === framed.zoom + 1 && out.zoom === framed.zoom - 1 && zoomed.reset === "enabled", JSON.stringify({ framed: framed.zoom, zoomed: zoomed.zoom, out: out.zoom, reset: zoomed.reset }))
        await page.click("[data-map-reset-view]")
        await sleep(2500)
        const reset = await layout(page)
        await page.click("[data-map-zoom-in]"); await sleep(1200)
        await page.click("[data-map-reset-view]"); await sleep(2500)
        const again = await layout(page)
        check("Reset view returns to the farmer's framing and is disabled there; the same framing every time", reset.reset === "disabled" && again.reset === "disabled" && again.zoom === reset.zoom && again.farmer === framed.farmer, JSON.stringify({ opened: framed.zoom, reset: reset.zoom, again: again.zoom, state: [reset.reset, again.reset] }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── in the sheet: Next, one plot, no plot locations, the loading cover ─────────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockMap=dispatch`, errors)
        await page.setViewport({ width: 390, height: 844 })
        await openFirst(page)
        const before = await layout(page)
        await L.clickNav(page, "next")
        const cover = await page.evaluate(() => { const c = document.querySelector("[data-map-cover]"); const m = document.querySelector(".map-preview-module"); if (!c || !m) return null; const a = c.getBoundingClientRect(), b = m.getBoundingClientRect(); return { inPanel: a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5 } })
        await L.detailLoaded(page)
        await waitFor(page, () => !document.querySelector("[data-map-cover]"), 20000)
        await sleep(2500)
        const after = await layout(page)
        check("390 px: Next moves to the next farmer and the map in the sheet follows (its plots, its framing)", after.farmer && after.farmer !== before.farmer && inside(after.controls, after.map), JSON.stringify({ before: before.farmer, after: after.farmer }))
        check("390 px: the loading cover covers the map panel only (when it showed)", cover === null || cover.inPanel, JSON.stringify(cover))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    for (const [mode, expectNote] of [["one", false], ["none", true]]) {
        const page = await L.open(browser, `${L.V21}?mockMap=${mode}`, errors)
        await page.setViewport({ width: 390, height: 844 })
        await openFirst(page)
        // the farmer's framing (the row click focused its dispatch first)
        if (mode === "one") { await page.evaluate(() => document.querySelector("[data-map-reset-view]")?.click()); await sleep(2500) }
        const d = await layout(page)
        const plots = await page.evaluate(() => Number(document.querySelector("[data-map-farmer]")?.getAttribute("data-map-plots")))
        const ok = expectNote ? inside(d.note, d.map) && !overlap(d.note, d.controls) && plots === 0 : plots === 1 && d.zoom === 18 && !d.note
        check(`390 px: ${mode === "one" ? "one plot: framed at the zoom cap (18), no note" : "no plot locations: the note on the map, clear of the controls"}`, ok, JSON.stringify({ plots, zoom: d.zoom, note: d.note, controls: d.controls }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
