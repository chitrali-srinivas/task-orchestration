/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the Plot Drawing workspace's layout (components/plot-boundary-editor.tsx): one low
// toolbar, one panel docked beside the map (lg+) or a short strip above it (below lg), nothing floating over the map.
// At 1600 / 1280 / 1024 / 768 / 390 px: the toolbar is one 48 px row without overflow, with Reset / Cancel / Save on
// screen; the panel never overlaps the map; the map's unobstructed share of the screen is larger than the previous
// layout's (64 px header + two cards over the map — measured 2026-10-11: 74.7 / 68.4 / 67.0 / 71.9 % of the viewport at
// 1600×1000 / 1280×800 / 1024×768 / 768×900, the largest rectangle the cards left free); the active plot is marked in the
// list and named in the toolbar. Drawing still works at a narrow width (Redraw → 4 clicks → Finish → Modified → Reset).
// The editing behaviour itself (switching, invalid outlines, Save all, partial failure, discard) is boundary.cjs.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const BEFORE_SHARE = { 1600: 0.747, 1280: 0.684, 1024: 0.670, 768: 0.719 }
const SIZES = [[1600, 1000], [1280, 800], [1024, 768], [768, 900], [390, 844]]

const layout = (page) => page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
    const q = (s) => document.querySelector(s)
    const header = q("[data-boundary-toolbar]")
    const onScreen = (el) => { const b = box(el); return !!b && b.w > 0 && b.x >= 0 && b.r <= window.innerWidth + 0.5 && b.y >= 0 && b.b <= window.innerHeight + 0.5 }
    return {
        vw: window.innerWidth, vh: window.innerHeight,
        header: box(header), headerOverflow: header ? header.scrollWidth > header.clientWidth + 1 : null,
        panel: box(q("[data-boundary-panel]")), tools: box(q("[data-boundary-tools]")), plots: box(q("[data-boundary-plots]")),
        map: box(q("[data-boundary-editor] .gm-style")),
        actionsOnScreen: ["[data-boundary-reset]", "[data-boundary-cancel]", "[data-boundary-save]"].every((s) => onScreen(q(s))),
        toolsOnScreen: [...document.querySelectorAll("[data-boundary-tools] button")].every(onScreen),
        activeTitle: q("[data-boundary-active-title]")?.textContent.trim() ?? null,
        activeRows: [...document.querySelectorAll("[data-boundary-plot][data-active]")].map((li) => ({ title: li.querySelector("[data-boundary-select] span.font-mono")?.textContent.trim() /* the deployment id (the row also shows its plot id) */, current: li.querySelector("[data-boundary-select]")?.getAttribute("aria-current") })),
    }
})
const overlaps = (a, b) => !!a && !!b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5

async function openMultiPlotEditor(page) {
    for (const tab of ["Pending", "Need Correction", "Verified"]) {
        await L.selectTab(page, tab)
        const rows = (await L.tableRows(page)).filter((r) => L.plotsOf(r) >= 2)
        for (const row of rows.slice(0, 6)) {
            await L.openRow(page, row.index)
            await L.expandAllDispatches(page)
            await sleep(800)
            const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
            if (plot) {
                await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), plot)
                if (await waitFor(page, () => !!document.querySelector("[data-edit-boundary]"), 10000)) {
                    await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
                    await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
                    await sleep(2500)
                    if ((await page.$$("[data-boundary-plot]")).length >= 2) return true
                    await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
                    await sleep(500)
                }
            }
            await L.closeSheet(page)
        }
    }
    return false
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        check("the editor opens on a record with several plots", await openMultiPlotEditor(page))
        for (const [w, h] of SIZES) {
            await page.setViewport({ width: w, height: h })
            await sleep(1200)
            const m = await layout(page)
            const docked = w >= 1024
            const share = m.map ? (m.map.w * m.map.h) / (m.vw * m.vh) : 0
            check(`${w}px: the toolbar is one 48 px row, nothing overflows, Reset / Cancel / Save all on screen`, !!m.header && Math.round(m.header.h) === 48 && m.headerOverflow === false && m.actionsOnScreen, JSON.stringify({ h: m.header?.h, overflow: m.headerOverflow, actions: m.actionsOnScreen }))
            check(`${w}px: the panel is ${docked ? "docked left of the map (240 px)" : "a strip above the map"}; it never overlaps the map or the toolbar`,
                !!m.panel && !!m.map && !overlaps(m.panel, m.map) && !overlaps(m.header, m.map) && !overlaps(m.header, m.panel) && (docked ? Math.round(m.panel.w) === 240 && m.panel.r <= m.map.x + 0.5 : m.panel.b <= m.map.y + 0.5 && Math.round(m.map.w) === w),
                JSON.stringify({ panel: m.panel, map: m.map }))
            check(`${w}px: no tool or list floats over the map`, !overlaps(m.tools, m.map) && !overlaps(m.plots, m.map))
            check(`${w}px: the drawing tools are on screen`, m.toolsOnScreen)
            if (BEFORE_SHARE[w]) check(`${w}px: the map's unobstructed share of the screen grew (${(BEFORE_SHARE[w] * 100).toFixed(1)} % before)`, share > BEFORE_SHARE[w], `${(share * 100).toFixed(1)} %`)
            else check(`${w}px: the map keeps at least half of the screen`, share >= 0.5, `${(share * 100).toFixed(1)} %`)
            check(`${w}px: the active plot is the one marked in the list (aria-current) and named in the toolbar`, m.activeRows.length === 1 && m.activeRows[0].current === "true" && m.activeRows[0].title === m.activeTitle, JSON.stringify({ rows: m.activeRows, title: m.activeTitle }))
        }

        // switching keeps the toolbar and the list in step (768 px: the plot row scrolls horizontally if needed)
        await page.setViewport({ width: 768, height: 900 })
        await sleep(800)
        const other = await page.evaluate(() => [...document.querySelectorAll("[data-boundary-plot]")].find((li) => !li.hasAttribute("data-active"))?.getAttribute("data-boundary-plot"))
        await page.evaluate((id) => document.querySelector(`[data-boundary-select="${id}"]`)?.click(), other)
        await sleep(800)
        const afterSwitch = await layout(page)
        check("768px: picking another plot marks it active and names it in the toolbar", afterSwitch.activeRows.length === 1 && afterSwitch.activeRows[0].title === afterSwitch.activeTitle && (await page.evaluate((id) => document.querySelector(`[data-boundary-plot="${id}"]`)?.hasAttribute("data-active"), other)))

        // drawing at a narrow width: Redraw → 4 clicks on the map → Finish → Modified, Save enabled → Reset
        await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click())
        await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "draw", 4000)
        const center = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 60 } })
        // as boundary.cjs: below the centred marker, 450 ms apart (closer clicks are taken as a double click by the map)
        for (const [dx, dy] of [[-90, -60], [90, -60], [90, 60], [-90, 60]]) { await page.mouse.click(center.x + dx, center.y + dy); await sleep(450) }
        await page.evaluate(() => document.querySelector("[data-boundary-finish]")?.click())
        await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 4000)
        await sleep(400)
        const drawn = await page.evaluate(() => ({ state: document.querySelector("[data-boundary-plot][data-active]")?.getAttribute("data-boundary-plot-state"), area: document.querySelector("[data-boundary-area]")?.textContent.trim(), save: !document.querySelector("[data-boundary-save]")?.disabled }))
        check("768px: a new outline is drawn on the map (4 points), the plot is Modified and Save all is enabled", drawn.state === "modified" && /4 points/.test(drawn.area ?? "") && drawn.save, JSON.stringify(drawn))
        await page.evaluate(() => document.querySelector("[data-boundary-reset]")?.click())
        await sleep(400)
        const reset = await page.evaluate(() => ({ state: document.querySelector("[data-boundary-plot][data-active]")?.getAttribute("data-boundary-plot-state"), save: !document.querySelector("[data-boundary-save]")?.disabled }))
        check("768px: Reset plot returns it to its saved boundary (Unchanged, nothing to save)", reset.state === "unchanged" && reset.save === false, JSON.stringify(reset))
        await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
        check("Cancel closes the editor when nothing is unsaved", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 5000))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
