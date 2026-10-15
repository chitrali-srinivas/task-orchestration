/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — boundary editing for several plots in one session (backlog D): switching keeps edits,
// modified vs unchanged, invalid outlines block Save all, per-plot reset, Save all (one request per plot, seen in the
// Data / API Inspector), Cancel / Discard, and a partial failure (?mockFail=geometry-second) with Retry.
// Outlines are drawn by clicking the editor map (draw mode). Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor, exists } = L

const plotStates = (page) => page.$$eval("[data-boundary-plot]", (els) => els.map((e) => ({ id: e.getAttribute("data-boundary-plot"), state: e.getAttribute("data-boundary-plot-state"), active: e.hasAttribute("data-active"), problem: e.querySelector("[data-boundary-problem]")?.textContent.trim() ?? null })))
const stateOf = async (page, id) => (await plotStates(page)).find((p) => p.id === id)?.state
const saveEnabled = (page) => page.$eval("[data-boundary-save]", (b) => !b.disabled)
const saveLabel = (page) => page.$eval("[data-boundary-save]", (b) => b.textContent.trim())
const pointsText = (page) => page.$eval("[data-boundary-area]", (e) => e.textContent.trim())

async function selectPlot(page, id) {
    await page.evaluate((p) => document.querySelector(`[data-boundary-select="${p}"]`)?.click(), id)
    await waitFor(page, (p) => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-editor") === p, 5000, id)
    await sleep(900)
}
/** Clicks `points` (offsets in px from the map's centre) on the editor map, in draw mode. */
async function clickPoints(page, points) {
    const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 60 } })
    for (const [dx, dy] of points) {
        await page.mouse.click(box.x + dx, box.y + dy)
        await sleep(450)
    }
}
const SQUARE = [[-90, -60], [90, -60], [90, 60], [-90, 60]]
const BOW_TIE = [[-90, -60], [90, 60], [90, -60], [-90, 60]]
/** Redraw the active plot (from edit mode), place `points`, Finish when `finish`. */
async function redraw(page, points, finish = true) {
    if ((await page.$eval("[data-boundary-editor]", (e) => e.getAttribute("data-boundary-mode"))) === "edit") {
        await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click())
        await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "draw", 4000)
    } else {
        await page.evaluate(() => document.querySelector("[data-boundary-clear]")?.click())
    }
    await sleep(300)
    await clickPoints(page, points)
    if (finish) {
        await page.evaluate(() => document.querySelector("[data-boundary-finish]")?.click())
        await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 4000)
        await sleep(400)
    }
}

/** Opens the boundary editor on the first record (any tab) whose session can edit 2+ plots. Returns the plot ids. */
async function openMultiPlotEditor(page) {
    for (const tab of ["Pending", "Need Correction", "Verified"]) {
        await L.selectTab(page, tab)
        const rows = (await L.tableRows(page)).filter((r) => L.plotsOf(r) >= 2)
        for (const row of rows.slice(0, 6)) {
            await L.openRow(page, row.index)
            await page.evaluate(() => document.querySelectorAll("[data-dispatch-toggle]").forEach((t) => { if (!t.closest("[data-dispatch-row]")?.querySelector("[data-dispatch-body]")) t.click() }))
            await sleep(800)
            const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
            if (plot) {
                await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), plot)
                if (await waitFor(page, () => !!document.querySelector("[data-edit-boundary]"), 10000)) {
                    await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
                    await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
                    await sleep(2500)
                    const ids = (await plotStates(page)).map((p) => p.id)
                    if (ids.length >= 2) return { ids, tab, row: row.index }
                    await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
                    await sleep(500)
                }
            }
            await L.closeSheet(page)
        }
    }
    return null
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── A. edit two plots, invalid outlines, reset, Save all, persistence, Cancel / Discard ────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        const session = await openMultiPlotEditor(page)
        check("a record whose boundary session can edit 2+ plots", !!session, session ? `${session.ids.length} plots (${session.tab})` : "none found")
        if (session) {
            const [A, B] = session.ids
            const states = await plotStates(page)
            check("session opens on the plot the card was for; every plot unchanged", states.some((p) => p.active) && states.every((p) => p.state === "unchanged"), JSON.stringify(states.map((p) => p.state)))
            check("Save all disabled with nothing modified", !(await saveEnabled(page)))

            // plot A: a new outline
            await selectPlot(page, A)
            await redraw(page, SQUARE)
            check("plot A modified after a new outline", (await stateOf(page, A)) === "modified")
            check("Save all enabled (1)", (await saveEnabled(page)) && /Save all \(1\)/.test(await saveLabel(page)), await saveLabel(page))

            // plot B: invalid outlines block Save all; then a valid one
            await selectPlot(page, B)
            check("switching keeps plot A's edits (A still modified)", (await stateOf(page, A)) === "modified")
            await redraw(page, SQUARE.slice(0, 2), false)
            check("unfinished outline (2 points): plot B needs attention", (await stateOf(page, B)) === "invalid", (await plotStates(page)).find((p) => p.id === B)?.problem)
            check("unfinished outline blocks Save all", !(await saveEnabled(page)))
            await redraw(page, BOW_TIE)
            const bow = (await plotStates(page)).find((p) => p.id === B)
            check("self-crossing outline: plot B needs attention (\"crosses itself\")", bow?.state === "invalid" && /crosses itself/.test(bow?.problem ?? ""), bow?.problem)
            check("self-crossing outline blocks Save all", !(await saveEnabled(page)))
            await page.evaluate((id) => document.querySelector(`[data-boundary-reset-plot="${id}"]`)?.click(), B)
            await sleep(500)
            check("per-plot reset: B back to unchanged, A still modified", (await stateOf(page, B)) === "unchanged" && (await stateOf(page, A)) === "modified")
            await redraw(page, SQUARE)
            check("plot B modified with a valid outline", (await stateOf(page, B)) === "modified")
            check("Save all enabled (2)", (await saveEnabled(page)) && /Save all \(2\)/.test(await saveLabel(page)), await saveLabel(page))

            // back to A: its outline is the one drawn before
            await selectPlot(page, A)
            check("back on plot A: its drawn outline is kept (4 points)", /4 points/.test(await pointsText(page)), await pointsText(page))
            await L.screenshot(page, "v21-boundary-two-modified.png")

            // Escape asks first; Keep editing returns
            await page.keyboard.press("Escape")
            check("Escape with unsaved edits asks first", await waitFor(page, () => !!document.querySelector("[data-boundary-confirm]"), 4000))
            check("the confirmation counts the unsaved plots", /2 unsaved boundaries/.test(await page.$eval("[data-boundary-confirm]", (e) => e.textContent)))
            await page.evaluate(() => document.querySelector("[data-boundary-keep]")?.click())
            await sleep(500)
            check("Keep editing: still in the session with 2 modified", (await exists(page, "[data-boundary-editor]")) && (await page.$eval("[data-boundary-editor]", (e) => e.getAttribute("data-boundary-modified"))) === "2")

            // Save all
            await page.evaluate(() => document.querySelector("[data-boundary-save]")?.click())
            check("Save all: the editor closes when every plot saved", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 15000))
            check("Save all: the toast names 2 saved boundaries", await waitFor(page, () => /2 boundaries saved/.test(document.body.innerText), 5000))

            // reopen: both now unchanged with an outline (edit mode)
            await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
            await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
            await sleep(1500)
            await selectPlot(page, A)
            const reopenedA = { state: await stateOf(page, A), mode: await page.$eval("[data-boundary-editor]", (e) => e.getAttribute("data-boundary-mode")), points: await pointsText(page) }
            check("reopened: plot A unchanged, its saved 4-point outline editable", reopenedA.state === "unchanged" && reopenedA.mode === "edit" && /4 points/.test(reopenedA.points), JSON.stringify(reopenedA))

            // Cancel → Discard drops unsaved edits
            await redraw(page, [[-60, -40], [70, -50], [80, 50], [-50, 60], [-70, 0]])
            check("a new edit on A (5 points)", (await stateOf(page, A)) === "modified" && /5 points/.test(await pointsText(page)))
            await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
            check("Cancel with an unsaved edit asks first", await waitFor(page, () => !!document.querySelector("[data-boundary-confirm]"), 4000))
            check("the confirmation says the plot keeps its saved boundary", /keeps its saved boundary/.test(await page.$eval("[data-boundary-confirm]", (e) => e.textContent)))
            await page.evaluate(() => document.querySelector("[data-boundary-discard]")?.click())
            check("Discard closes the editor", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 5000))
            await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
            await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
            await sleep(1500)
            await selectPlot(page, A)
            check("after Discard: A keeps its saved 4-point outline", (await stateOf(page, A)) === "unchanged" && /4 points/.test(await pointsText(page)), await pointsText(page))
            await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
            await sleep(500)

            // the Inspector saw two single-plot saves
            await L.closeSheet(page)
            await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
            await waitFor(page, () => !!document.querySelector("[data-inspector]"), 6000)
            await page.evaluate(() => document.querySelector('[data-activity-filter="mutation"]')?.click())
            await sleep(400)
            const saves = await page.$$eval('[data-trace-entry][data-trace-path="/adminDeploymentSec/uploadGeoJsonData"]', (els) => els.map((e) => e.getAttribute("data-trace-state")))
            check("Inspector: Save all sent one uploadGeoJsonData per plot (2, both ok)", saves.length === 2 && saves.every((s) => s === "ok"), JSON.stringify(saves))
            await page.evaluate(() => document.querySelector('[data-trace-entry][data-trace-path="/adminDeploymentSec/uploadGeoJsonData"] button')?.click())
            await sleep(300)
            const body = await page.evaluate(() => document.querySelector("[data-trace-details]")?.innerText ?? "")
            // V2.1: one request per outline — the edited plot and, by containment, the farmer's deployments of the same round
            // inside it without a boundary (boundary-coverage.cjs checks which); each deployment once
            const sentIds = [...body.matchAll(/"deployment_id":\s*(\d+)/g)].map((m) => m[1])
            check("each request: one outline's entries — each deployment once — with a closed polygon", sentIds.length >= 1 && new Set(sentIds).size === sentIds.length && /"Polygon"/.test(body) && /"calculated_area"/.test(body), sentIds.join(","))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── B. partial failure: the 2nd save fails once → per-plot result, Retry ─────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockFail=geometry-second`, errors)
        await L.rowsLoaded(page)
        const session = await openMultiPlotEditor(page)
        if (!session) check("partial failure: a multi-plot record", false)
        else {
            const [A, B] = session.ids
            await selectPlot(page, A)
            await redraw(page, SQUARE)
            await selectPlot(page, B)
            await redraw(page, SQUARE)
            await page.evaluate(() => document.querySelector("[data-boundary-save]")?.click())
            check("partial failure: the result says 1 saved, 1 not saved", await waitFor(page, () => { const r = document.querySelector("[data-boundary-result]"); return !!r && r.getAttribute("data-saved") === "1" && r.getAttribute("data-failed") === "1" }, 15000))
            const after = await plotStates(page)
            const failed = after.find((p) => p.state === "failed"), saved = after.find((p) => p.state === "saved")
            check("the failed plot is marked failed, with the reason", !!failed && /could not be saved/.test(failed.problem ?? ""), failed?.problem)
            check("the saved plot is marked saved", !!saved)
            check("the editor stays open; Save all becomes Retry (1)", (await exists(page, "[data-boundary-editor]")) && /Retry \(1\)/.test(await saveLabel(page)), await saveLabel(page))
            await L.screenshot(page, "v21-boundary-partial.png")
            await page.evaluate(() => document.querySelector("[data-boundary-retry]")?.click())
            check("Retry saves the remaining plot and closes the editor", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 15000))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    if (!relevant.length) note("boundary suite done")
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
