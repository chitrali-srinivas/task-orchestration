/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — polygon containment on a boundary save (data/boundary-coverage.ts, the sheet's
// saveBoundaryPlot; the original Deployment page's assignShapesToDeployments without its defects):
//   - the saved outline also goes to every deployment of the same farmer and round whose location lies inside it and
//     that has no boundary yet — in ONE uploadGeoJsonData request, the edited deployment first, each deployment once,
//     each entry with its OWN farmer and AZ, the same polygon and area. Checked against an independent computation from
//     the dispatch reads (the Inspector trace: request rounds, response plots) and the polygon the request carries;
//   - a deployment of another round at the same spot is left as it is; one that already has a boundary gets the new
//     outline too (the production page's rule), listed before Save all ("Also saves to: … (replaces its outline)");
//   - after the save the farmer is read again — every AZ row holding a covered deployment — and every covered
//     deployment then has the boundary; the toast names what the outline also covered;
//   - a failed save that covered several deployments says its outcome isn't confirmed and the detail is read again
//     (?mockFail=geometry: nothing applied; ?mockFail=geometry-partial: the first entry applied, then the failure — the
//     re-read shows exactly that);
//   - with ?mockBoundaries=seed (the neighbours already have boundaries) the editor names them before Save all, and the
//     request carries exactly those;
//   - the reported flow (?mockMap=dispatch&mockBoundaries=seed: one map plot per deployment, as live, each with a saved
//     outline): a new outline on plot A, then B's outline removed (Redraw, no points) while B lies inside A's —
//     B is "Covered" (not "Needs attention"), Save all is allowed, one request carries A and B (B's old boundary
//     replaced, as asked), both end saved with A's polygon; every plot in the list shows its plot id.
// The mock stacks several deployments on one spot (its dispatches reuse the demo plots' coordinates), which is what makes
// containment visible here. Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L
const UPLOAD = "/adminDeploymentSec/uploadGeoJsonData"
const READ = "/adminDeploymentSec/v3/getTrailerDetails"
const SQUARE = [[-90, -60], [90, -60], [90, 60], [-90, 60]]

/** Every trace entry of `path`, oldest first: { id (the trace's global sequence: orders entries across paths), request, response, state }. */
async function trace(page, path) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(500)
    const raw = await page.evaluate(async (p) => {
        const out = []
        for (const e of document.querySelectorAll(`[data-trace-entry][data-trace-path="${p}"]`)) {
            e.querySelector("button")?.click()
            await new Promise((r) => setTimeout(r, 30))
            out.push({ id: Number(e.getAttribute("data-trace-entry")), text: e.querySelector("[data-trace-details]")?.textContent ?? "", state: e.getAttribute("data-trace-state") })
        }
        return out.reverse()
    }, path)
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    const json = (text) => { const i = text.search(/[[{]/); if (i < 0) return null; for (let end = text.length; end > i; end--) { try { return JSON.parse(text.slice(i, end)) } catch { /* shorter */ } } return null }
    return raw.sort((a, b) => a.id - b.id).map(({ id, text, state }) => {
        const r = text.indexOf("Response body")
        const reqText = (r >= 0 ? text.slice(0, r) : text).replace(/^[\s\S]*?Request body/, "")
        return { id, request: json(reqText), response: r >= 0 ? json(text.slice(r).replace(/^Response body[^[{]*/, "")) : null, state }
    })
}
/** The plots the dispatch reads returned, each with its dispatch's AZ and the read's round (the newest read wins). */
function plotsFrom(reads) {
    const byId = new Map()
    for (const { request, response } of reads) {
        const round = request?.trailerDetails?.[0]?.deployment_num ?? null
        for (const d of Array.isArray(response) ? response : []) for (const p of d.deployment_plots_data ?? []) {
            byId.set(p.deployment_id, { id: p.deployment_id, farmer: String(p.farmer_id), location: p.location, geometry: p.geometry, az: d.az_id, round: round === null ? null : Number(round) })
        }
    }
    return byId
}
const insideRing = (pt, ring) => {
    let c = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j]
        if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) c = !c
    }
    return c
}
const real = (l) => !!l && Number.isFinite(l.lat) && Number.isFinite(l.lng) && !(l.lat === 0 && l.lng === 0)

async function openEditorOnFirstPlot(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.openRow(page, 0)
    await L.detailLoaded(page)
    await L.expandAllDispatches(page)
    await sleep(800)
    const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
    await page.evaluate((id) => { const t = document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`); t?.scrollIntoView({ block: "center" }); t?.click() }, plot)
    await waitFor(page, () => !!document.querySelector("[data-edit-boundary]"), 10000)
    await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
    await sleep(2500)
    return Number(plot)
}
/** Draws a square around the map's centre; `zoomOut` steps first (a new outline opens at zoom 19 on its plot alone —
 *  three steps out the square spans its neighbours, as a field around several deployment points does). */
async function drawSquare(page, zoomOut = 0) {
    if ((await page.$eval("[data-boundary-editor]", (e) => e.getAttribute("data-boundary-mode"))) === "edit") {
        await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click())
        await sleep(400)
    }
    for (let i = 0; i < zoomOut; i++) {
        await page.evaluate(() => document.querySelector('[data-boundary-editor] .gm-style button[aria-label="Zoom out"]')?.click())
        await sleep(700)
    }
    const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 60 } })
    for (const [dx, dy] of SQUARE) { await page.mouse.click(box.x + dx, box.y + dy); await sleep(450) }
    await page.evaluate(() => document.querySelector("[data-boundary-finish]")?.click())
    await sleep(500)
}
async function saveAll(page) {
    await page.evaluate(() => document.querySelector("[data-boundary-save]")?.click())
    await waitFor(page, () => !document.querySelector("[data-boundary-editor]") || !!document.querySelector("[data-boundary-problem]"), 20000)
    await sleep(2500)
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── A. a save that covers stacked deployments (default mock) ────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        const target = await openEditorOnFirstPlot(page)
        await drawSquare(page, 3)
        await saveAll(page)
        const toast = await page.evaluate(() => document.body.innerText.match(/also covers[^\n]*/)?.[0] ?? null)
        await L.closeSheet(page)
        const uploads = await trace(page, UPLOAD)
        const reads = await trace(page, READ)
        const body = uploads[0]?.request
        const entries = body?.geoJsonData ?? []
        const ring = entries[0]?.geoJson?.features?.[0]?.geometry?.coordinates?.[0] ?? []
        // the reads before the save and after it (the trace's sequence orders them around the upload)
        const uploadId = uploads[0]?.id ?? Infinity
        const all = plotsFrom(reads.filter((r) => r.state === "ok" && r.id < uploadId))
        const t = all.get(target)
        const expected = [...all.values()].filter((p) => p.id !== target && p.farmer === t?.farmer && p.round !== null && p.round === t?.round && real(p.location) && insideRing(p.location, ring) && !p.geometry).map((p) => p.id).sort((a, b) => a - b)
        const sent = entries.map((e) => e.deployment_id)
        check("A. one uploadGeoJsonData request; the edited deployment first; each deployment once", uploads.length === 1 && sent[0] === target && new Set(sent).size === sent.length, JSON.stringify({ requests: uploads.length, sent }))
        check("A. containment: it also carries every deployment of the same farmer and round inside the outline with no boundary — exactly those (independent computation from the reads)", JSON.stringify(sent.slice(1).sort((a, b) => a - b)) === JSON.stringify(expected) && expected.length >= 1, JSON.stringify({ sent: sent.slice(1), expected }))
        const azOk = entries.every((e) => all.get(e.deployment_id) && e.az_id === all.get(e.deployment_id).az && String(e.farmerId) === all.get(e.deployment_id).farmer)
        const azs = new Set(entries.map((e) => e.az_id))
        check("A. each entry carries its OWN deployment's AZ and farmer — never the first one's", azOk, JSON.stringify(entries.map((e) => [e.deployment_id, e.az_id, all.get(e.deployment_id)?.az])))
        check("A. …across AZs: the covered deployments span more than one AZ here", azs.size >= 2, JSON.stringify([...azs]))
        check("A. every entry: the same polygon and calculated_area; no plot_id", entries.every((e) => JSON.stringify(e.geoJson) === JSON.stringify(entries[0].geoJson) && e.calculated_area === entries[0].calculated_area && !("plot_id" in e)))
        const otherRound = [...all.values()].filter((p) => p.farmer === t?.farmer && p.round !== t?.round && real(p.location) && insideRing(p.location, ring))
        check("A. a deployment of ANOTHER round at the same spot is not covered", otherRound.length > 0 && otherRound.every((p) => !sent.includes(p.id)), `${otherRound.length} other-round deployments inside the outline, none sent`)
        // after the save: the farmer read again, every covered deployment with the boundary, in every AZ row
        const after = reads.filter((r) => r.state === "ok" && r.id > uploadId)
        const reread = plotsFrom(after)
        const rereadAzs = new Set(after.map((r) => JSON.stringify(r.request?.trailerDetails?.[0]?.az_id ?? null)))
        check("A. after the save the farmer is read again — every AZ row holding a covered deployment — and every covered deployment has the boundary", sent.every((id) => !!reread.get(id)?.geometry) && [...azs].every((az) => [...rereadAzs].some((a) => a.includes(String(az)))), JSON.stringify({ withBoundary: sent.filter((id) => !!reread.get(id)?.geometry).length, of: sent.length, rereadAzs: [...rereadAzs] }))
        check("A. the toast names what the outline also covered", !!toast && new RegExp(`also covers .*DEPL-${sent[1]}`).test(toast), toast ?? "no 'also covers'")
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── B. neighbours that already have boundaries get the outline too — named before Save all (?mockBoundaries=seed) ──
    {
        const page = await L.open(browser, `${L.V21}?mockBoundaries=seed`, errors)
        const target = await openEditorOnFirstPlot(page)
        await drawSquare(page)
        // the edited plot is the active one (on the demo map its list id is the demo plot's, not the deployment's)
        const notice = await page.evaluate(() => document.querySelector("[data-boundary-plot][data-active] [data-boundary-also-saves]")?.textContent.trim() ?? "")
        await saveAll(page)
        await L.closeSheet(page)
        const uploads = await trace(page, UPLOAD)
        const reads = await trace(page, READ)
        const entries = uploads[0]?.request?.geoJsonData ?? []
        const ring = entries[0]?.geoJson?.features?.[0]?.geometry?.coordinates?.[0] ?? []
        const all = plotsFrom(reads.filter((r) => r.state === "ok" && r.id < (uploads[0]?.id ?? Infinity)))
        const t = all.get(target)
        const inside = [...all.values()].filter((p) => p.id !== target && p.farmer === t?.farmer && p.round === t?.round && real(p.location) && insideRing(p.location, ring))
        const withBoundary = inside.filter((p) => !!p.geometry)
        const sent = entries.map((e) => e.deployment_id)
        check("B. a deployment inside that already has a boundary gets the new outline too (the production page's rule) — exactly the inside ones of the farmer and round", withBoundary.length > 0 && sent[0] === target && JSON.stringify(sent.slice(1).sort((a, b) => a - b)) === JSON.stringify(inside.map((p) => p.id).sort((a, b) => a - b)), JSON.stringify({ sent, inside: inside.map((p) => p.id), withBoundary: withBoundary.map((p) => p.id) }))
        check("B. …named before Save all: \"Also saves to\" lists each of them, the ones with a boundary as \"(replaces its outline)\"", /^Also saves to:/.test(notice) && inside.every((p) => notice.includes(`DEPL-${p.id}`)) && withBoundary.every((p) => notice.includes(`DEPL-${p.id} (replaces its outline)`)), notice.slice(0, 220))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── C. failures: nothing applied / the first entry applied — not confirmed either way; the detail is read again ─
    for (const [mode, label] of [["geometry", "nothing applied"], ["geometry-partial", "the first entry applied, then the failure"]]) {
        const page = await L.open(browser, `${L.V21}?mockFail=${mode}`, errors)
        const target = await openEditorOnFirstPlot(page)
        await drawSquare(page, 3)
        await saveAll(page)
        const problem = await page.evaluate(() => document.querySelector("[data-boundary-problem]")?.textContent ?? "")
        const stillOpen = await page.evaluate(() => !!document.querySelector("[data-boundary-editor]"))
        await sleep(2500)
        await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
        await sleep(400)
        await page.evaluate(() => document.querySelector("[data-boundary-discard]")?.click())
        await sleep(600)
        await L.closeSheet(page)
        const uploads = await trace(page, UPLOAD)
        const reads = await trace(page, READ)
        const entries = uploads[0]?.request?.geoJsonData ?? []
        const after = reads.filter((r) => r.state === "ok" && r.id > (uploads[0]?.id ?? Infinity))
        const reread = plotsFrom(after)
        const applied = entries.filter((e) => !!reread.get(e.deployment_id)?.geometry).map((e) => e.deployment_id)
        const expectedApplied = mode === "geometry" ? [] : [entries[0]?.deployment_id]
        check(`C. ${label}: the editor stays open and says the save covered ${entries.length} deployments and isn't confirmed`, stillOpen && entries.length > 1 && /covered \d+ deployments/.test(problem) && /isn.t confirmed/.test(problem), problem.slice(0, 200))
        check(`C. ${label}: the detail is read again and shows what the backend kept`, uploads[0]?.state !== "ok" && after.length > 0 && JSON.stringify(applied) === JSON.stringify(expectedApplied) && entries[0]?.deployment_id === target, JSON.stringify({ applied, expectedApplied, rereads: after.length }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── D. the reported flow: B's outline removed to be covered by A's new outline ──────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockMap=dispatch&mockBoundaries=seed`, errors)
        const A = await openEditorOnFirstPlot(page)
        const plotIds = await page.$$eval("[data-boundary-plot]", (els) => els.map((e) => ({ id: e.getAttribute("data-boundary-plot"), plotId: e.querySelector("[data-boundary-plot-id]")?.getAttribute("data-boundary-plot-id") ?? null })))
        check("D. the editor's list shows each plot's plot id under its deployment", plotIds.length >= 2 && plotIds.every((p) => !!p.plotId), JSON.stringify(plotIds.slice(0, 4)))
        // A: a new outline (zoomed out: it spans the points at A's spot); B: a deployment at A's spot
        await drawSquare(page, 3)
        const points = await page.evaluate(() => (document.querySelector("[data-map-farmer]")?.dataset.mapPoints ?? "").split("|").filter(Boolean).map((p) => { const [id, ll] = p.split("@"); return { id, ll } }))
        const atA = points.find((p) => p.id === String(A))?.ll
        const listed = new Set(plotIds.map((p) => p.id))
        const B = points.find((p) => p.id !== String(A) && p.ll === atA && listed.has(p.id))?.id
        await page.evaluate((id) => document.querySelector(`[data-boundary-select="${id}"]`)?.click(), B)
        await waitFor(page, (id) => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-editor") === id, 5000, B)
        await sleep(800)
        await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click()) // B's outline removed, nothing drawn
        await sleep(600)
        const st = await page.evaluate((id) => {
            const li = document.querySelector(`[data-boundary-plot="${id}"]`)
            const save = document.querySelector("[data-boundary-save]")
            return { state: li?.getAttribute("data-boundary-plot-state"), coveredBy: li?.querySelector("[data-boundary-covered-by]")?.getAttribute("data-boundary-covered-by") ?? null, problem: li?.querySelector("[data-boundary-problem]")?.textContent ?? null, save: save ? !save.disabled : null, hint: document.querySelector("[data-boundary-hint]")?.textContent ?? "" }
        }, B)
        check("D. B (outline removed, inside A's new outline) is \"Covered\" by A — not \"Needs attention\" — and Save all is allowed", !!B && st.state === "covered" && st.coveredBy === String(A) && !st.problem && st.save === true && /saved with it/.test(st.hint), JSON.stringify({ A, B, ...st }))
        await saveAll(page)
        const closed = await page.evaluate(() => !document.querySelector("[data-boundary-editor]"))
        const toast = await page.evaluate(() => document.body.innerText.match(/also covers[^\n]*/)?.[0] ?? "")
        // the detail map after the re-read: an outline shared by several deployments is drawn once, not stacked
        await sleep(2500)
        const drawn = await page.evaluate(() => {
            const w = document.querySelector("[data-map-farmer]")
            return { outlined: (w?.dataset.mapOutlines ?? "").split("|").filter(Boolean).length, drawn: Number(w?.getAttribute("data-map-outlines-drawn")) }
        })
        await L.closeSheet(page)
        const uploads = await trace(page, UPLOAD)
        const reads = await trace(page, READ)
        const entries = uploads[0]?.request?.geoJsonData ?? []
        const sent = entries.map((e) => String(e.deployment_id))
        const after = plotsFrom(reads.filter((r) => r.state === "ok" && r.id > (uploads[0]?.id ?? Infinity)))
        // distinct outlines, independently: the shapes the API returned after the save (ring, closing point dropped, 6 dp)
        const shapeKey = (g) => { const ring = [...((g?.coordinates ?? g?.features?.[0]?.geometry?.coordinates ?? [])[0] ?? [])]; if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop(); return ring.length >= 3 ? ring.map(([x, y]) => `${Number(y).toFixed(6)},${Number(x).toFixed(6)}`).join(";") : null }
        const farmerOfA = after.get(Number(A))?.farmer
        const shapes = [...after.values()].filter((p) => p.farmer === farmerOfA && real(p.location)).map((p) => shapeKey(p.geometry)).filter(Boolean)
        const distinct = new Set(shapes).size
        check("D. on the detail map an outline shared by several deployments is drawn once: one per distinct outline the API returned, fewer than the deployments with one", drawn.drawn === distinct && distinct < shapes.length && drawn.outlined === shapes.length, JSON.stringify({ ...drawn, distinct, withOutline: shapes.length }))
        const sameGeometry = (id) => JSON.stringify(after.get(Number(id))?.geometry?.coordinates ?? after.get(Number(id))?.geometry) === JSON.stringify(entries[0]?.geoJson?.features?.[0]?.geometry?.coordinates)
        check("D. one request carries A first and B (its old boundary replaced, as asked) — B isn't saved separately", uploads.length === 1 && sent[0] === String(A) && sent.includes(String(B)), JSON.stringify({ requests: uploads.length, sent }))
        check("D. the editor closes (nothing failed); the toast names B; after the re-read A and B have A's polygon", closed && toast.includes(`DEPL-${B}`) && sameGeometry(A) && sameGeometry(B), JSON.stringify({ closed, toast: toast.slice(0, 120), A: sameGeometry(A), B: sameGeometry(B) }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors).filter((e) => !/mock failure/.test(e))
    check("no page errors (the deliberate mock failures aside)", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
