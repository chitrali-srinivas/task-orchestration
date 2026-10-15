/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the farmer detail's UX pass:
//   1. avatar — the photo keeps its proportions (object-cover in a square box; ?mockAvatar=wide is 2:1), a broken one
//      falls back to the initials (?mockAvatar=broken);
//   2. map camera on Previous / Next (?mockMap=dispatch: each farmer's own plots) — every plot inside the view at zoom
//      11–18, never framed on the previous farmer's plots (the stale-plot root cause), one plot (?mockMap=one) at the
//      zoom cap, none (?mockMap=none) → overview + note, the user's own zoom kept (no refit while exploring);
//   5. header totals — unique plots (by plot_id; from the dispatch reads in the Inspector trace) and their total Cal. Area
//      = the sum of the table's Cal. Area cells for the farmer (?mockCalArea=unique,distinct); a repeated list record
//      doesn't inflate it; a plot on several deployment records, a missing / invalid / 0 / conflicting Cal. Area → "Area —"
//      with why; not the plots' own area; loading until the farmer's rows are read (?mockCalArea=slow), unavailable when
//      that read fails (?mockFail=farmer-rows);
//   6. the map's plot card and legend — the card: its dispatch in the header (ID left, status at the other end, one
//      line; not repeated in the rows), the plot's title, its facts and source, the edit action; the legend: Deployment
//      V2's (two stacked sections, colour · source then size · amount, ≤ 13.75rem wide); no overlap with each other or
//      the map controls (1600 and 1100 px).
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const cam = (page) => page.evaluate(() => {
    const w = document.querySelector("[data-map-farmer]")
    if (!w) return null
    const v = (w.dataset.mapView ?? "").split(",").map(Number), e = (w.dataset.mapPlotExtent ?? "").split(",").map(Number)
    return { farmer: w.dataset.mapFarmer, plots: Number(w.dataset.mapPlots), extent: w.dataset.mapPlotExtent ?? null, zoom: Number(w.dataset.mapZoom), view: w.dataset.mapView ?? null, inside: e.length === 4 && v.length === 4 && e.every(Number.isFinite) ? e[0] >= v[0] && e[1] >= v[1] && e[2] <= v[2] && e[3] <= v[3] : null, noPlots: document.querySelector("[data-map-no-plots]")?.textContent.trim() ?? null }
})
const settledCam = async (page) => { await waitFor(page, () => !document.querySelector("[data-map-cover]"), 20000); await sleep(2500); return cam(page) }
async function openFirst(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.openRow(page, 0)
    await L.detailLoaded(page)
    await sleep(1500)
}
async function traceReads(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(500)
    const texts = await page.evaluate(async () => {
        const out = []
        for (const e of document.querySelectorAll('[data-trace-entry][data-trace-path="/adminDeploymentSec/v3/getTrailerDetails"]')) {
            e.querySelector("button")?.click()
            await new Promise((r) => setTimeout(r, 30))
            out.push(e.querySelector("[data-trace-details]")?.textContent ?? "")
        }
        return out
    })
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return texts.map((t) => { try { return JSON.parse(t.slice(t.indexOf("Response body")).replace(/^Response body[^[{]*/, "")) } catch { return null } }).filter(Array.isArray)
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1. avatar ─────────────────────────────────────────────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockAvatar=wide`, errors)
        await openFirst(page)
        const a = await page.evaluate(() => { const img = document.querySelector("[data-farmer-avatar] img"); const box = document.querySelector("[data-farmer-avatar]")?.getBoundingClientRect(); return img ? { fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition, nat: [img.naturalWidth, img.naturalHeight], img: [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)], box: [Math.round(box.width), Math.round(box.height)] } : null })
        check("1. a 2:1 photo is cropped to the square avatar (object-fit: cover, centred), never stretched; the avatar stays 40 × 40", !!a && a.nat[0] === 300 && a.nat[1] === 150 && a.fit === "cover" && a.pos === "50% 50%" && a.box[0] === 40 && a.box[1] === 40 && a.img[0] === a.img[1], JSON.stringify(a))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    {
        const page = await L.open(browser, `${L.V21}?mockAvatar=broken`, errors)
        await openFirst(page)
        await sleep(1000)
        const a = await page.evaluate(() => ({ img: !!document.querySelector("[data-farmer-avatar] img"), fallback: document.querySelector("[data-farmer-avatar]")?.textContent.trim() ?? "", name: document.querySelector('[role="dialog"] h2')?.textContent.trim() ?? "" }))
        check("1. a photo that doesn't load shows the initials (the existing fallback); the name stays", !a.img && a.fallback.length === 2 && a.name.length > 0 && a.name.slice(0, 2).toUpperCase() === a.fallback, JSON.stringify(a))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. map camera ─────────────────────────────────────────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockMap=dispatch`, errors)
        await openFirst(page)
        const seen = [await settledCam(page)]
        let staleFrames = 0
        for (let i = 0; i < 2; i++) {
            // sample the map wrapper while the next farmer loads: never the new farmer with the previous farmer's plots
            await page.evaluate(() => {
                window.__camSamples = []
                window.__camTimer = setInterval(() => { const w = document.querySelector("[data-map-farmer]"); if (w) window.__camSamples.push([w.dataset.mapFarmer, w.dataset.mapPlotOwners ?? ""]) }, 25)
            })
            if (!(await L.clickNav(page, "next"))) break
            await L.detailLoaded(page, 30000)
            const now = await settledCam(page)
            const samples = await page.evaluate(() => { clearInterval(window.__camTimer); return window.__camSamples })
            // a frame is stale when the map draws plots of another farmer than the one shown (the plots' own farmer ids)
            staleFrames += samples.filter(([farmer, owners]) => owners !== "" && owners !== farmer).length
            seen.push(now)
        }
        check("2. Next → every farmer's plots are all inside the view at a useful zoom (11–18), without clicking a dispatch", seen.length >= 3 && seen.every((c) => c.plots > 0 && c.inside === true && c.zoom >= 11 && c.zoom <= 18), JSON.stringify(seen.map((c) => [c.farmer, c.plots, c.zoom, c.inside])))
        check("2. while the next farmer loads, the map is never framed on the previous farmer's plots under the new farmer (root cause)", staleFrames === 0, `${staleFrames} stale frames`)
        // the user zooms out; nothing refits while they explore
        const before = await cam(page)
        await page.evaluate(() => document.querySelector("[data-map-zoom-out]")?.click()) // the map's own control group (Google's zoom control is off)
        await sleep(1500)
        const zoomedOut = await cam(page)
        await sleep(3000)
        const later = await cam(page)
        check("2. the user's own zoom is kept: no refit while exploring", zoomedOut.zoom === before.zoom - 1 && later.zoom === zoomedOut.zoom && later.view === zoomedOut.view, JSON.stringify([before.zoom, zoomedOut.zoom, later.zoom]))
        // Previous returns to a fitted view of that farmer again
        await L.clickNav(page, "prev")
        await L.detailLoaded(page, 30000)
        const back = await settledCam(page)
        check("2. Previous frames that farmer's plots again (a new farmer is always framed)", back.inside === true && back.zoom >= 11 && back.zoom <= 18 && back.farmer === seen[seen.length - 2].farmer, JSON.stringify(back))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    {
        const page = await L.open(browser, `${L.V21}?mockMap=one`, errors)
        await openFirst(page)
        // the farmer fit itself: a row click also flies to the clicked dispatch's plots (its own zoom) — Next has none
        await L.clickNav(page, "next")
        await L.detailLoaded(page, 30000)
        const c = await settledCam(page)
        check("2. one plot (after Next — no dispatch focus): framed at the zoom cap (18), inside the view", c.plots === 1 && c.inside === true && c.zoom === 18, JSON.stringify(c))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    {
        const page = await L.open(browser, `${L.V21}?mockMap=none`, errors)
        await openFirst(page)
        const c = await settledCam(page)
        check("2. no plot locations: the overview (zoom 5) and a note — never the previous view", c.plots === 0 && c.zoom === 5 && c.noPlots === "No plot locations for this farmer", JSON.stringify(c))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 5. header totals: unique plots, total Cal. Area (the table's Cal. Area column) ────────────────────────────────
    /** Unique plots of a farmer in the dispatch reads (plot_id trimmed, else the deployment), its plot deployments, Σ plot area. */
    const plotsFrom = (reads, farmer) => {
        const keys = new Set()
        let deployments = 0, plotArea = 0
        for (const body of reads) for (const d of body) for (const p of d.deployment_plots_data ?? []) {
            if (String(p.farmer_id) !== farmer) continue
            deployments++
            plotArea += Number(p.area) || 0
            keys.add(String(p.plot_id ?? "").trim() ? `plot:${String(p.plot_id).trim()}` : `deployment:${p.deployment_id}`)
        }
        return { plots: keys.size, deployments, plotArea: Math.round(plotArea * 100) / 100 }
    }
    const headerTotals = (page) => page.evaluate(() => { const a = document.querySelector("[data-farmer-area]"); const p = document.querySelector("[data-farmer-plots]"); return { plots: p?.getAttribute("data-farmer-plots") ?? null, area: a?.getAttribute("data-farmer-area") ?? null, title: a?.getAttribute("title") ?? "", text: document.querySelector("[data-farmer-details]")?.textContent.replace(/\s+/g, " ").trim() ?? "" } })
    /** Opens farmer 1001 (the mock's first farmer) and reads its header once settled; the table's Cal. Area for that farmer. */
    const openFarmer = async (query, { settle = true } = {}) => {
        const page = await L.open(browser, `${L.V21}${query}`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))
        const table = { dispatches: rows.length, calArea: rows.every((r) => typeof r.calArea === "number") ? Math.round(rows.reduce((t, r) => t + r.calArea, 0) * 100) / 100 : null }
        await L.openRow(page, rows[0].index)
        if (settle) {
            await L.detailLoaded(page)
            await waitFor(page, () => /^\d+$/.test(document.querySelector("[data-farmer-plots]")?.getAttribute("data-farmer-plots") ?? ""), 20000)
        }
        return { page, table }
    }
    const done = async (page) => { blocked.push(...page.blockedApi); await page.close() }
    let uniqueTotal = null
    {
        const { page, table } = await openFarmer("?mockCalArea=unique,distinct")
        const shown = await headerTotals(page)
        await L.closeSheet(page)
        const expected = plotsFrom(await traceReads(page), "1001")
        uniqueTotal = Number(shown.area)
        check("5. the header states the farmer's unique plots and the SUM of the table's Cal. Area for them (each dispatch once)",
            Number(shown.plots) === expected.plots && table.calArea !== null && Math.abs(Number(shown.area) - table.calArea) < 0.006 && /Plots? \. [\d.]+ Acres/.test(shown.text) && /Total Cal\. Area of \d+ plots/.test(shown.title),
            JSON.stringify({ shown, table, expected }))
        check("5. …not the plots' own area: the total differs from the sum of the plots' `area` in the dispatch reads", Math.abs(Number(shown.area) - expected.plotArea) > 0.05, `header ${shown.area} · Σ plot area ${expected.plotArea}`)
        await done(page)
    }
    {
        const { page } = await openFarmer("?mockCalArea=unique,distinct,duplicate")
        const shown = await headerTotals(page)
        check("5. a dispatch's list record sent twice doesn't inflate the total (same as without the repeat)", uniqueTotal !== null && Number(shown.area) === uniqueTotal, JSON.stringify({ shown, uniqueTotal }))
        await done(page)
    }
    {
        const { page } = await openFarmer("?mockCalArea=unique,distinct&mockPlotArea=missing")
        const shown = await headerTotals(page)
        check("5. a plot without its own area doesn't change the Cal. Area total (the header doesn't read the plot area)", Number(shown.area) === uniqueTotal, JSON.stringify({ shown, uniqueTotal }))
        await done(page)
    }
    {
        const { page } = await openFarmer("")
        const shown = await headerTotals(page)
        await L.closeSheet(page)
        const expected = plotsFrom(await traceReads(page), "1001")
        check("5. plots repeated across dispatches are counted once (Plots = the independent count, fewer than the plot deployments)", Number(shown.plots) === expected.plots && expected.plots < expected.deployments, JSON.stringify({ shown: shown.plots, expected }))
        check("5. …and their area is never summed twice: the total is unstated, with why", shown.area === "unknown" && /plots are on more than one deployment record; Cal\. Area is per dispatch/.test(shown.title), shown.title)
        await done(page)
    }
    for (const [mode, reason] of [["missing", /Cal\. Area not recorded for 1 of \d+ dispatches/], ["invalid", /Cal\. Area isn't a valid number for 1 of \d+ dispatches/], ["zero", /Cal\. Area is 0 for 1 of \d+ dispatches/], ["conflict", /Cal\. Area differs between records of 1 of \d+ dispatches/]]) {
        const { page } = await openFarmer(`?mockCalArea=unique,distinct,${mode}`)
        const shown = await headerTotals(page)
        const label = await page.evaluate(() => document.querySelector("[data-farmer-area]")?.textContent.trim())
        check(`5. Cal. Area ${mode} for one dispatch → "Area —" (no total, never a 0 or a partial sum), why in its title`, shown.area === "unknown" && label === "Area —" && reason.test(shown.title) && Number(shown.plots) > 0, JSON.stringify(shown))
        await done(page)
    }
    {
        // the farmer's rows answer after 8 s; the clicked row's own dispatch read is in long before
        const { page } = await openFarmer("?mockCalArea=slow", { settle: false })
        await sleep(500)
        const early = await headerTotals(page)
        await waitFor(page, () => /^\d+$/.test(document.querySelector("[data-farmer-plots]")?.getAttribute("data-farmer-plots") ?? ""), 20000)
        const later = await headerTotals(page)
        check("5. loading: until the farmer's rows are read, \"Plots …\" — never one group's totals as the farmer's", early.plots === "loading" && /Plots … \./.test(early.text) && early.area === null && /^\d+$/.test(later.plots ?? ""), JSON.stringify({ early, later }))
        await done(page)
    }
    {
        const { page } = await openFarmer("?mockFail=farmer-rows", { settle: false })
        await waitFor(page, () => document.querySelector("[data-farmer-plots]")?.getAttribute("data-farmer-plots") === "unavailable", 20000)
        const shown = await headerTotals(page)
        const open = await page.evaluate(() => !!document.querySelector("[data-summary-bar]"))
        check("5. the farmer's rows fail to load: \"Plots unavailable\" (not left loading, no total), the detail stays open", shown.plots === "unavailable" && /Plots unavailable/.test(shown.text) && shown.area === null && open, JSON.stringify({ shown, open }))
        await done(page)
    }

    // ── 6. plot card and legend ───────────────────────────────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await openFirst(page)
        await L.expandAllDispatches(page)
        await sleep(600)
        const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
        await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), plot)
        await waitFor(page, () => !!document.querySelector("[data-plot-map-card]"), 10000)
        for (const [w, h] of [[1600, 1000], [1100, 800]]) {
            await page.setViewport({ width: w, height: h })
            await sleep(1200)
            const m = await page.evaluate(() => {
                const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height } }
                return {
                    card: r("[data-plot-map-card]"), legend: r("[data-map-legend]"), controls: r("[data-map-controls]"), map: r("[data-map-farmer]"),
                    rows: [...document.querySelectorAll("[data-plot-map-row]")].map((e) => e.getAttribute("data-plot-map-row")),
                    head: (() => { const d = document.querySelector("[data-plot-map-dispatch]"), st = document.querySelector("[data-plot-map-status]"); if (!d || !st) return null; const a = d.getBoundingClientRect(), b = st.getBoundingClientRect(); return { id: d.textContent.trim(), sameLine: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) <= 3, statusRight: b.left > a.right - 1, idsInCard: (document.querySelector("[data-plot-map-card]").textContent.match(/DISP-\d+/g) ?? []).length } })(),
                    sections: [...document.querySelectorAll("[data-map-legend] p")].map((e) => e.textContent.trim()).filter((t) => /·/.test(t)),
                    edit: !!document.querySelector("[data-edit-boundary]"), title: document.querySelector("[data-plot-map-title]")?.textContent.trim(), region: document.querySelector("[data-plot-map-card]")?.getAttribute("aria-label"),
                    sources: document.querySelectorAll("[data-legend-source]").length, size: !!document.querySelector("[data-legend-size]"), amount: document.querySelector("[data-legend-amount]")?.textContent.trim() ?? null,
                }
            })
            const overlap = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b
            check(`6. ${w}px: the legend is Deployment V2's — "Colour · source" then "Size · amount", stacked, ≤ 13.75rem wide — with every item: sources, the size scale and its amount label`, m.legend.w <= 221 && m.sections.length === 2 && /^Colour · source$/i.test(m.sections[0]) && /^Size · /i.test(m.sections[1]) && m.sources > 0 && m.size && !!m.amount, JSON.stringify({ legend: m.legend, sections: m.sections, sources: m.sources, amount: m.amount }))
            check(`6. ${w}px: the plot card — its dispatch once, in the header (ID left, status at the other end, one line), its title, its facts and source, its edit action and its region name`, m.card.w * m.card.h < 280 * 255 && m.rows.includes("source") && !m.rows.includes("dispatch") && m.rows.length >= 3 && !!m.head && m.head.sameLine && m.head.statusRight && m.head.idsInCard === 1 && m.edit && /^Selected plot /.test(m.region ?? ""), JSON.stringify({ card: [Math.round(m.card.w), Math.round(m.card.h)], rows: m.rows }))
            check(`6. ${w}px: card, legend and map controls don't overlap each other and stay inside the map`, !overlap(m.card, m.legend) && !overlap(m.card, m.controls) && !overlap(m.legend, m.controls) && [m.card, m.legend, m.controls].every((b) => b.x >= m.map.x - 1 && b.r <= m.map.r + 1 && b.y >= m.map.y - 1 && b.b <= m.map.b + 1))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
