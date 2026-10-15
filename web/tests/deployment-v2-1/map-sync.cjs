/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the map and the detail list stay in step, both ways (components/deployment-detail-sheet.tsx
// selectPlotFromMap / deploymentOf, the list's plot rows):
//   map → list   a click on a marker selects that plot: its card names the deployment, the list opens that deployment's
//                dispatch and plot row, marks it (data-located) and scrolls it into view — for markers of different
//                dispatches in turn;
//   list → map   a plot row picked in the list selects its plot on the map (the card names that deployment) and the
//                camera brings it into view;
//   map focus    a click on a plot's marker, or inside its boundary, flies the camera to that plot (centred on it,
//                zoomed in from the farmer's view) as a pick in the list does;
//   location     a plot row expanded, or its Location coordinates clicked, flies the camera to that plot (centred,
//                zoomed in from the farmer's view) and selects exactly that deployment — also after Reset View;
//   ids          the deployment revealed is always the one the card names (the mock reuses plot ids across deployments;
//                ?mockMap=dispatch: one marker per deployment, as live; the default demo map: plots linked by location).
// Markers are clicked at their real screen position, from the plot's coordinates and the map's settled bounds. The mock
// stacks several deployments on one spot (its dispatches reuse the demo plots' coordinates): a click there picks the top
// marker of the stack, so a check compares the list with the deployment the card names, never with a guessed one.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

/** The map's plots (id, lat, lng) and where each lies on screen now. */
const markers = (page) => page.evaluate(() => {
    const w = document.querySelector("[data-map-farmer]")
    const view = (w?.dataset.mapView ?? "").split(",").map(Number)
    const box = w?.getBoundingClientRect()
    const points = (w?.dataset.mapPoints ?? "").split("|").filter(Boolean).map((p) => { const [id, ll] = p.split("@"); const [lat, lng] = ll.split(",").map(Number); return { id, lat, lng } })
    if (view.length !== 4 || !box) return []
    const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    const [s, wst, n, e] = view
    return points.map((p) => ({ ...p, x: box.left + ((p.lng - wst) / (e - wst)) * box.width, y: box.top + ((merc(n) - merc(p.lat)) / (merc(n) - merc(s))) * box.height }))
        .filter((p) => p.x > box.left + 8 && p.x < box.right - 8 && p.y > box.top + 8 && p.y < box.bottom - 40)
        // a marker under an overlay (legend, plot card, controls) can't be clicked: the overlay takes the click
        .filter((p) => !["[data-map-legend]", "[data-plot-map-card]", "[data-map-controls]"].some((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return !!r && r.width > 0 && p.x >= r.left - 12 && p.x <= r.right + 12 && p.y >= r.top - 12 && p.y <= r.bottom + 12 }))
})
const selection = (page) => page.evaluate(() => {
    const card = document.querySelector("[data-plot-map-card]")
    const located = document.querySelector("[data-plot-card][data-located]")
    const viewport = document.querySelector("[data-radix-scroll-area-viewport]")
    const inView = (el) => {
        if (!el || !viewport) return false
        const a = el.getBoundingClientRect(), v = viewport.getBoundingClientRect()
        const topVisible = a.top >= v.top - 1 && a.top <= v.bottom - 24
        return topVisible && (a.bottom <= v.bottom + 1 || a.height > v.height - 24)
    }
    const dispatch = located?.closest("[data-dispatch-row]")
    return {
        card: card?.getAttribute("data-plot-map-card") ?? null,
        located: located?.getAttribute("data-plot-card") ?? null,
        plotExpanded: located?.hasAttribute("data-plot-expanded") ?? false,
        dispatch: dispatch?.getAttribute("data-dispatch-row") ?? null,
        dispatchOpen: !!dispatch?.querySelector("[data-dispatch-body]"),
        inView: inView(located),
    }
})
async function openFirst(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.openRow(page, 0)
    await L.detailLoaded(page)
    await waitFor(page, () => !document.querySelector("[data-map-cover]"), 20000)
    await sleep(2500)
    // the farmer's own framing (the row click focused its dispatch first)
    await page.evaluate(() => document.querySelector("[data-map-reset-view]")?.click())
    await sleep(2500)
}
async function clickMarker(page, m) {
    await page.mouse.click(m.x, m.y)
    await sleep(2600) // the guided scroll, then the plot row's focus
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    for (const [label, query] of [["one marker per deployment (?mockMap=dispatch, as live)", "?mockMap=dispatch"], ["the default demo map", ""]]) {
        const page = await L.open(browser, `${L.V21}${query}`, errors)
        await page.setViewport({ width: 1600, height: 900 })
        await openFirst(page)
        const ms = await markers(page)
        // markers at distinct places (stacked markers share a click)
        const distinct = ms.filter((m, i) => ms.findIndex((o) => Math.hypot(o.x - m.x, o.y - m.y) < 30) === i)
        const results = []
        for (const first of distinct.slice(0, 4)) {
            // a pick flies the camera to its plot: back to the farmer's view, and the marker's position read again
            await page.evaluate(() => { const b = document.querySelector("[data-map-reset-view]"); if (b && !b.disabled) b.click() })
            await sleep(2500)
            const m = (await markers(page)).find((x) => x.id === first.id)
            if (!m) continue
            await clickMarker(page, m)
            results.push({ marker: m.id, ...(await selection(page)) })
        }
        const cards = new Set(results.map((r) => r.card))
        check(`${label} — map → list: each marker click reveals the deployment its card names: the dispatch open, the plot row open, marked and in view`,
            results.length >= 2 && results.every((r) => r.card && r.located === r.card && r.dispatchOpen && r.plotExpanded && r.inView),
            JSON.stringify(results))
        check(`${label} — map → list follows each pick (different plots clicked → different deployments revealed, never stuck on the first)`, cards.size >= 2 && results.every((r) => r.located === r.card), JSON.stringify(results.map((r) => [r.card, r.dispatch])))

        // list → map: pick a plot row of another dispatch in the list
        const target = await page.evaluate((current) => {
            // a row not open yet (a click on an open row closes it)
            const rows = [...document.querySelectorAll('[data-plot-card][data-plot-location="valid"]:not([data-plot-expanded])')]
            const other = rows.find((r) => r.closest("[data-dispatch-row]")?.getAttribute("data-dispatch-row") !== current)
            return other?.getAttribute("data-plot-card") ?? null
        }, results[results.length - 1]?.dispatch ?? null)
        await L.expandAllDispatches(page)
        await sleep(500)
        await page.evaluate((id) => { const t = document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`); t?.scrollIntoView({ block: "center" }); t?.click() }, target)
        await waitFor(page, (id) => document.querySelector("[data-plot-map-card]")?.getAttribute("data-plot-map-card") === id, 8000, target)
        await sleep(2500)
        const listPick = await page.evaluate((id) => {
            const card = document.querySelector("[data-plot-map-card]")?.getAttribute("data-plot-map-card")
            const w = document.querySelector("[data-map-farmer]")
            const point = (w?.dataset.mapPoints ?? "").split("|").find((p) => p.startsWith(`${id}@`))
            return { card, point: point ?? null, zoom: Number(w?.dataset.mapZoom) }
        }, target)
        const onScreen = (await markers(page)).some((m) => m.id === listPick.point?.split("@")[0])
        check(`${label} — list → map: picking a plot row selects that deployment on the map and brings it into view`, !!target && listPick.card === target && (listPick.point === null || onScreen), JSON.stringify({ target, ...listPick, onScreen }))

        // and back: a marker click after a list pick still reveals the clicked one
        // any marker but the selected one (data-map-selected: the selected map plot, on both maps); none on screen at the
        // list pick's zoom → zoom out (keeps the selection) and look again
        const otherMarker = async () => {
            const selected = await page.evaluate(() => document.querySelector("[data-map-farmer]")?.getAttribute("data-map-selected"))
            const all = await markers(page)
            const sel = all.find((m) => m.id === selected)
            return all.find((m) => m.id !== selected && m.id !== target && (!sel || Math.hypot(m.x - sel.x, m.y - sel.y) > 40))
        }
        let again = await otherMarker()
        for (let i = 0; i < 3 && !again; i++) { await page.click("[data-map-zoom-out]"); await sleep(1200); again = await otherMarker() }
        if (again) {
            await clickMarker(page, again)
            const r = await selection(page)
            check(`${label} — after a list pick, a marker click elsewhere moves the selection there, and the list follows (one source of selection)`, r.card !== target && r.located === r.card && r.dispatchOpen && r.inView, JSON.stringify(r))
        }
        // map focus: a marker click flies the camera to that plot (from a zoomed-out view)
        await page.evaluate(() => document.querySelector("[data-map-reset-view]")?.click())
        await sleep(2500)
        const view = () => page.evaluate(() => {
            const w = document.querySelector("[data-map-farmer]")
            const v = (w?.dataset.mapView ?? "").split(",").map(Number)
            return v.length === 4 ? { lat: (v[0] + v[2]) / 2, lng: (v[1] + v[3]) / 2, zoom: Number(w.dataset.mapZoom), selected: w.getAttribute("data-map-selected") } : null
        })
        const before = await view()
        const pick = (await markers(page))[0]
        if (pick) {
            await page.mouse.click(pick.x, pick.y)
            await sleep(3500)
            const after = await view()
            const picked = (after?.selected && (await page.evaluate((id) => (document.querySelector("[data-map-farmer]")?.dataset.mapPoints ?? "").split("|").find((p) => p.startsWith(`${id}@`)), after.selected))) || null
            const [plat, plng] = (picked?.split("@")[1] ?? ",").split(",").map(Number)
            const centred = !!after && Number.isFinite(plat) && Math.abs(after.lat - plat) < 0.0025 && Math.abs(after.lng - plng) < 0.0025
            check(`${label} — map focus: a marker click flies the camera to that plot (centred on it, zoomed in from the farmer's view)`, !!after?.selected && centred && after.zoom > before.zoom, JSON.stringify({ before, after, picked }))
        }
        // …and a click inside a plot's boundary does the same (the outline's own click)
        await page.evaluate(() => document.querySelector("[data-map-reset-view]")?.click())
        await sleep(2500)
        const outline = await page.evaluate(() => {
            const w = document.querySelector("[data-map-farmer]")
            const v = (w?.dataset.mapView ?? "").split(",").map(Number), b = w?.getBoundingClientRect()
            const shapes = (w?.dataset.mapOutlines ?? "").split("|").filter(Boolean).map((s) => { const [id, c] = s.split("@"); const [lat, lng] = c.split(",").map(Number); return { id, lat, lng } })
            if (v.length !== 4 || !b || shapes.length === 0) return null
            const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
            const [s0, w0, n0, e0] = v
            const pts = shapes.map((p) => ({ ...p, x: b.left + ((p.lng - w0) / (e0 - w0)) * b.width, y: b.top + ((merc(n0) - merc(p.lat)) / (merc(n0) - merc(s0))) * b.height }))
            return pts.find((p) => p.x > b.left + 20 && p.x < b.right - 60 && p.y > b.top + 20 && p.y < b.bottom - 160) ?? null
        })
        if (outline) {
            const before2 = await view()
            await page.mouse.click(outline.x, outline.y)
            await sleep(3500)
            const after2 = await view()
            check(`${label} — map focus: a click inside a plot's boundary selects that plot and flies the camera to it`, after2?.selected === outline.id && Math.abs(after2.lat - outline.lat) < 0.0025 && Math.abs(after2.lng - outline.lng) < 0.0025 && after2.zoom > before2.zoom, JSON.stringify({ before2, after2, outline }))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // location → map: a plot row expanded, then (after Reset View) its Location coordinates clicked
    for (const [label, query] of [["one marker per deployment", "?mockMap=dispatch"], ["the default demo map", ""]]) {
        const page = await L.open(browser, `${L.V21}${query}`, errors)
        await page.setViewport({ width: 1600, height: 900 })
        await openFirst(page)
        await L.expandAllDispatches(page)
        await sleep(600)
        const camera = () => page.evaluate(() => {
            const w = document.querySelector("[data-map-farmer]")
            const v = (w?.dataset.mapView ?? "").split(",").map(Number)
            return v.length === 4 ? { lat: (v[0] + v[2]) / 2, lng: (v[1] + v[3]) / 2, zoom: Number(w.dataset.mapZoom) } : null
        })
        const farmerView = await camera()
        const target = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-plot-card][data-plot-location="valid"]:not([data-plot-expanded])')]; return r[r.length - 1]?.getAttribute("data-plot-card") ?? null })
        await page.evaluate((id) => { const t = document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`); t?.scrollIntoView({ block: "center" }); t?.click() }, target)
        await sleep(3500)
        const at = await page.evaluate((id) => { const m = (document.querySelector(`[data-plot-card="${id}"] [data-location-preview]`)?.textContent ?? "").match(/([\d.]+)° ([NS]), ([\d.]+)° ([EW])/); return m ? { lat: Number(m[1]) * (m[2] === "S" ? -1 : 1), lng: Number(m[3]) * (m[4] === "W" ? -1 : 1) } : null }, target)
        const near = (c) => !!c && !!at && Math.abs(c.lat - at.lat) < 0.0025 && Math.abs(c.lng - at.lng) < 0.0025
        const expanded = await camera()
        const cardAfterExpand = await page.evaluate(() => document.querySelector("[data-plot-map-card]")?.getAttribute("data-plot-map-card") ?? null)
        check(`${label} — a plot row expanded: the camera flies to that plot (centred, zoomed in from the farmer's view) and selects it`, near(expanded) && expanded.zoom > farmerView.zoom && cardAfterExpand === target, JSON.stringify({ target, at, farmerView, expanded, cardAfterExpand }))
        await page.evaluate(() => document.querySelector("[data-map-reset-view]")?.click())
        await sleep(2500)
        const reset = await camera()
        const loc = await page.evaluate((id) => { const e = document.querySelector(`[data-plot-card="${id}"] [data-plot-locate]`); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, target)
        if (loc) { await page.mouse.click(loc.x, loc.y); await sleep(3500) }
        const located = await camera()
        const cardAfterLocate = await page.evaluate(() => document.querySelector("[data-plot-map-card]")?.getAttribute("data-plot-map-card") ?? null)
        check(`${label} — the plot's Location clicked (after Reset View): the camera flies back to that plot and selects exactly that deployment`, !!loc && !near(reset) && near(located) && located.zoom > reset.zoom && cardAfterLocate === target, JSON.stringify({ reset, located, cardAfterLocate, button: !!loc }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // narrow: the map in the sheet — a marker click still reveals and scrolls the list; the card never covers the marker
    {
        const page = await L.open(browser, `${L.V21}?mockMap=dispatch`, errors)
        await page.setViewport({ width: 390, height: 844 })
        await openFirst(page)
        const m = (await markers(page))[0]
        await clickMarker(page, m)
        const r = await selection(page)
        const covered = await page.evaluate((pt) => {
            const card = document.querySelector("[data-plot-map-card]")?.getBoundingClientRect()
            return !!card && pt.x >= card.left && pt.x <= card.right && pt.y >= card.top && pt.y <= card.bottom
        }, m)
        const after = (await markers(page)).find((x) => x.id === m.id)
        const coveredAfter = after ? await page.evaluate((pt) => { const c = document.querySelector("[data-plot-map-card]")?.getBoundingClientRect(); return !!c && pt.x >= c.left && pt.x <= c.right && pt.y >= c.top && pt.y <= c.bottom }, after) : false
        check("390 px: a marker click reveals its deployment in the list (open, marked, in view)", r.card && r.located === r.card && r.dispatchOpen && r.inView, JSON.stringify(r))
        check("390 px: the selected plot's card never covers its marker", !covered && !coveredAfter, JSON.stringify({ covered, coveredAfter }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
