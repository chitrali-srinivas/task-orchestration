/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Backlog C evidence (mock mode): the map tile requests and their zoom levels while the camera moves between plots,
// V2 Oct 26 (zoom out → glide → zoom in) vs V2.1 (direct move when it is enough), on the same record and the same three
// plot-to-plot moves. Each run uses a fresh browser context with the HTTP cache disabled, so every tile is a request.
// What this measures is requests made by the browser — not Google billing (Maps JS bills map loads, not tiles).
const L = require("./lib.cjs")
const { check, note, sleep, waitFor } = L

const TILE = /googleapis\.com\/(kh|vt)\b|googleapis\.com\/maps\/vt|khms\d\.google|mts\d\.google/
const zoomOf = (url) => {
    const q = url.match(/[?&]z=(\d+)/)
    if (q) return Number(q[1])
    const pb = url.match(/!1i(\d+)/)
    return pb ? Number(pb[1]) : null
}

async function measure(browser, route, { reduced = false } = {}) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({ width: 1600, height: 1000 })
    await page.setCacheEnabled(false)
    if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])
    const tiles = []
    let recording = false
    await page.setRequestInterception(true)
    page.on("request", (r) => {
        const url = r.url()
        if (/maticarbon|identitytoolkit|securetoken/.test(new URL(url).host)) return r.abort("blockedbyclient")
        if (recording && TILE.test(url)) tiles.push(zoomOf(url))
        r.continue()
    })
    await page.goto(L.BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 })
    await L.rowsLoaded(page)
    await L.selectTab(page, "Pending")
    await L.dispatchRowsLoaded(page) // V2.1: the plot counts arrive with the dispatch rows (a no-op on V2 Oct 26)
    const row = (await L.tableRows(page)).find((r) => L.plotsOf(r) >= 3)
    if (!row) { await context.close(); return null }
    await L.openRow(page, row.index)
    await page.evaluate(() => document.querySelectorAll("[data-dispatch-toggle]").forEach((t) => t.click()))
    await waitFor(page, () => !!document.querySelector(".gm-style") && !document.querySelector("[data-map-cover]"), 30000)
    const plots = await page.$$eval('[data-plot-card][data-plot-location="valid"]', (els) => els.map((e) => e.getAttribute("data-plot-card")))
    const order = [...new Set(plots)].slice(0, 4)
    // settle on the first plot, then record the moves to the next ones
    await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), order[0])
    await sleep(4500)
    recording = true
    for (const id of order.slice(1)) {
        await page.evaluate((p) => document.querySelector(`[data-plot-card="${p}"] [data-plot-toggle]`)?.click(), id)
        await sleep(4000)
    }
    recording = false
    await context.close()
    const zooms = tiles.filter((z) => z !== null)
    const histogram = {}
    for (const z of zooms) histogram[z] = (histogram[z] ?? 0) + 1
    return { row: row.index, moves: order.length - 1, requests: tiles.length, minZoom: zooms.length ? Math.min(...zooms) : null, maxZoom: zooms.length ? Math.max(...zooms) : null, histogram }
}

;(async () => {
    const browser = await L.launch()
    const results = {}
    for (const [name, route, opts] of [["V2 Oct 26", L.V2, {}], ["V2.1", L.V21, {}], ["V2.1 reduced motion", L.V21, { reduced: true }]]) {
        const runs = []
        for (let i = 0; i < 2; i++) runs.push(await measure(browser, route, opts))
        results[name] = runs
        for (const r of runs) note(`${name}`, r ? `row ${r.row}, ${r.moves} moves: ${r.requests} tile requests, zoom ${r.minZoom}–${r.maxZoom}, by zoom ${JSON.stringify(r.histogram)}` : "no row with 3+ plots")
    }
    const v2 = results["V2 Oct 26"].filter(Boolean), v21 = results["V2.1"].filter(Boolean)
    if (v2.length && v21.length) {
        const avg = (rs) => Math.round(rs.reduce((n, r) => n + r.requests, 0) / rs.length)
        note("average tile requests during the moves", `V2 Oct 26 ${avg(v2)} · V2.1 ${avg(v21)}`)
        check("V2.1 never goes below V2's lowest zoom during plot-to-plot moves", Math.min(...v21.map((r) => r.minZoom)) >= Math.min(...v2.map((r) => r.minZoom)), `V2 min z ${Math.min(...v2.map((r) => r.minZoom))}, V2.1 min z ${Math.min(...v21.map((r) => r.minZoom))}`)
    } else check("both variants measured", false)
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
