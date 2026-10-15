/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode, ?mockBoundaries=seed: saved outlines on most plots) — the Edit boundaries controls, by
// behaviour (components/plot-boundary-editor.tsx). The panel's tool section: the step ("Drawing outline" / "Editing
// outline") with points / area, one line of guidance for the state, Undo / Redo first, the step's start-over action
// (Clear points / Redraw outline), and the step's primary action last (Finish shape, or Delete point N for a selected point).
//   new boundary (draw), existing boundary (edit) · add / select / move / insert / delete points · Undo / Redo restore the
//   exact geometry (also Clear, Finish, Redraw, Reset, right-click) · Finish ≠ Save · invalid geometry · Cancel / Reset /
//   unsaved · Save success and failure · switching plots keeps each plot's history · contextual and disabled controls ·
//   keyboard (Tab order, Ctrl+Z / Ctrl+Shift+Z, Delete) · 768 px layout.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L
const UPLOAD = "/adminDeploymentSec/uploadGeoJsonData"
const SQUARE = [[-90, -60], [90, -60], [90, 60], [-90, 60]]
const BOW_TIE = [[-90, -60], [90, 60], [90, -60], [-90, 60]]

const st = (page) => page.evaluate(() => {
    const e = document.querySelector("[data-boundary-editor]")
    if (!e) return null
    const q = (s) => document.querySelector(s)
    const btn = (s) => { const b = q(s); return b ? (b.disabled ? "disabled" : "enabled") : "absent" }
    const shape = e.getAttribute("data-boundary-shape") ?? ""
    return {
        plot: e.getAttribute("data-boundary-editor"), mode: e.getAttribute("data-boundary-mode"), n: shape ? shape.split(";").length : 0, shape,
        sel: e.getAttribute("data-boundary-selected-vertex"), step: q("[data-boundary-tools] p")?.textContent.trim() ?? "",
        hint: q("[data-boundary-hint]")?.textContent.trim() ?? "", problem: q("[data-boundary-active-problem]")?.textContent.trim() ?? null,
        undo: btn("[data-boundary-undo]"), redo: btn("[data-boundary-redo]"), clear: btn("[data-boundary-clear]"), redraw: btn("[data-boundary-redraw]"),
        finish: btn("[data-boundary-finish]"), del: btn("[data-boundary-delete-point]"), delLabel: q("[data-boundary-delete-point]")?.textContent.trim() ?? null,
        save: btn("[data-boundary-save]"), state: q("[data-boundary-plot][data-active]")?.getAttribute("data-boundary-plot-state"),
        undoName: q("[data-boundary-undo]")?.getAttribute("aria-label"), redoName: q("[data-boundary-redo]")?.getAttribute("aria-label"),
    }
})
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel)
const centre = (page) => page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 60 } })
async function points(page, list) { const c = await centre(page); for (const [dx, dy] of list) { await page.mouse.click(c.x + dx, c.y + dy); await sleep(450) } }
async function draw(page, list) {
    if ((await st(page)).mode === "edit") { await click(page, "[data-boundary-redraw]"); await sleep(400) }
    await points(page, list)
    await click(page, "[data-boundary-finish]")
    await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 4000)
    await sleep(600)
}
const undo = async (page) => { await click(page, "[data-boundary-undo]"); await sleep(700) }
const redo = async (page) => { await click(page, "[data-boundary-redo]"); await sleep(700) }
async function select(page, id) {
    await click(page, `[data-boundary-select="${id}"]`)
    await waitFor(page, (p) => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-editor") === p, 5000, id)
    await sleep(1200)
}
async function uploads(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const n = await page.evaluate((p) => document.querySelectorAll(`[data-trace-entry][data-trace-path="${p}"]`).length, UPLOAD)
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return n
}
async function openEditor(page) {
    await L.rowsLoaded(page)
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
                    await click(page, "[data-edit-boundary]")
                    await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
                    await sleep(2500)
                    const ids = await page.$$eval("[data-boundary-plot]", (els) => els.map((e) => e.getAttribute("data-boundary-plot")))
                    if (ids.length >= 3) return ids
                    await click(page, "[data-boundary-cancel]")
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
    {
        const page = await L.open(browser, `${L.V21}?mockBoundaries=seed`, errors)
        const ids = await openEditor(page)
        check("the editor opens on a record with several plots (seeded outlines)", !!ids, String(ids?.length))
        // ── an existing boundary: the editing step ─────────────────────────────────────────────────────────────
        let s = await st(page)
        const A = s.plot
        const saved = s.shape
        check("existing boundary: 'Editing outline', guidance to drag / select, Undo / Redo disabled, no Delete point until a point is selected, Redraw outline offered, no Finish", s.mode === "edit" && s.step === "Editing outline" && /Click a point to select it/.test(s.hint) && s.undo === "disabled" && s.redo === "disabled" && s.del === "absent" && s.redraw === "enabled" && s.finish === "absent", JSON.stringify(s))
        check("Undo / Redo have accessible names", s.undoName === "Undo" && s.redoName === "Redo")

        // ── starting over: Redraw is undoable ──────────────────────────────────────────────────────────────────
        await click(page, "[data-boundary-redraw]")
        await sleep(500)
        s = await st(page)
        check("Redraw outline → the drawing step: 'Click on the map to place the first point.', Finish disabled, Clear disabled, Undo enabled", s.mode === "draw" && s.step === "Drawing outline" && s.hint === "Click on the map to place the first point." && s.finish === "disabled" && s.clear === "disabled" && s.undo === "enabled", JSON.stringify(s))
        await undo(page)
        s = await st(page)
        check("Undo after Redraw brings the outline back exactly (editing step, same points)", s.mode === "edit" && s.shape === saved && s.redo === "enabled", JSON.stringify({ mode: s.mode, same: s.shape === saved }))
        await redo(page)
        s = await st(page)
        check("Redo repeats the Redraw (drawing step, no points)", s.mode === "draw" && s.n === 0, JSON.stringify(s))

        // ── drawing: guidance per point, Undo / Redo of points, Clear is undoable ──────────────────────────────────
        const c = await centre(page)
        const hints = []
        for (const [dx, dy] of SQUARE.slice(0, 3)) { await page.mouse.click(c.x + dx, c.y + dy); await sleep(450); hints.push((await st(page)).hint) }
        check("drawing guidance follows the points: 2 more → 1 more → close it (Finish shape; nothing saved until Save all)", /Place 2 more points/.test(hints[0]) && /Place 1 more point\b/.test(hints[1]) && /Finish shape/.test(hints[2]) && /Save all/.test(hints[2]), JSON.stringify(hints))
        s = await st(page)
        const three = s.shape
        check("3 points: Finish shape enabled, Clear points enabled", s.n === 3 && s.finish === "enabled" && s.clear === "enabled", JSON.stringify(s))
        await undo(page)
        check("Undo removes the last point (2 left; Finish disabled again)", (await st(page)).n === 2 && (await st(page)).finish === "disabled")
        await redo(page)
        check("Redo puts it back exactly", (await st(page)).shape === three)
        await page.mouse.click(c.x + SQUARE[3][0], c.y + SQUARE[3][1]); await sleep(450)
        const four = (await st(page)).shape
        await click(page, "[data-boundary-clear]"); await sleep(400)
        check("Clear points removes every point", (await st(page)).n === 0)
        await undo(page)
        check("Undo after Clear restores all 4 points", (await st(page)).shape === four)

        // ── Finish ≠ Save ──────────────────────────────────────────────────────────────────────────────────────
        await click(page, "[data-boundary-finish]")
        await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 4000)
        await sleep(600)
        s = await st(page)
        check("Finish shape closes the outline (editing step, 4 points) — the plot is Modified, Save all enabled: finishing doesn't save", s.mode === "edit" && s.n === 4 && s.state === "modified" && s.save === "enabled", JSON.stringify(s))
        const drawn = s.shape

        // ── points: select (contextual Delete), move, insert, delete; each undoable ─────────────────────────────────
        await page.mouse.click(c.x + 90, c.y - 60); await sleep(500)
        s = await st(page)
        check("clicking a point selects it: 'Point 2 selected', and only then Delete point 2 appears", s.sel === "1" && /^Point 2 selected/.test(s.hint) && s.del === "enabled" && s.delLabel === "Delete point 2", JSON.stringify(s))
        await page.mouse.click(c.x - 200, c.y + 150); await sleep(500)
        s = await st(page)
        check("a click off the outline clears the selection (Delete point gone)", s.sel === null && s.del === "absent", JSON.stringify(s))
        await page.mouse.click(c.x + 90, c.y - 60); await sleep(500)
        await click(page, "[data-boundary-delete-point]"); await sleep(700)
        s = await st(page)
        check("Delete point removes that point (3 left) and clears the selection", s.n === 3 && s.sel === null && s.del === "absent" && !s.shape.includes(drawn.split(";")[1]), JSON.stringify(s))
        await undo(page)
        check("Undo restores the deleted point exactly", (await st(page)).shape === drawn)
        await redo(page)
        const afterDelete = await st(page)
        check("Redo deletes it again", afterDelete.n === 3)
        await page.mouse.click(c.x - 90, c.y - 60); await sleep(500)
        s = await st(page)
        check("with 3 points a selected point can't be deleted: Delete point disabled, the guidance says why", s.sel !== null && s.del === "disabled" && /needs at least 3 points/.test(s.hint), JSON.stringify(s))
        await undo(page)
        check("Undo back to 4 points", (await st(page)).shape === drawn)
        // move a point
        await page.mouse.move(c.x + 90, c.y + 60); await page.mouse.down(); await page.mouse.move(c.x + 110, c.y + 80, { steps: 8 }); await page.mouse.move(c.x + 130, c.y + 100, { steps: 8 }); await page.mouse.up(); await sleep(800)
        s = await st(page)
        check("dragging a point moves it (same count, new outline)", s.n === 4 && s.shape !== drawn)
        await undo(page)
        check("one Undo puts the moved point back exactly", (await st(page)).shape === drawn)
        // insert at a midpoint
        await page.mouse.move(c.x, c.y - 60); await page.mouse.down(); await page.mouse.move(c.x, c.y - 90, { steps: 8 }); await page.mouse.move(c.x, c.y - 110, { steps: 8 }); await page.mouse.up(); await sleep(800)
        check("dragging a midpoint adds a point (5)", (await st(page)).n === 5)
        await undo(page)
        check("one Undo removes the added point exactly", (await st(page)).shape === drawn)
        // keyboard: Delete key on a selected point, Ctrl+Z / Ctrl+Shift+Z
        await page.mouse.click(c.x + 90, c.y + 60); await sleep(500)
        await page.keyboard.press("Delete"); await sleep(700)
        check("Delete key removes the selected point", (await st(page)).n === 3)
        await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control"); await sleep(700)
        check("Ctrl+Z undoes it", (await st(page)).shape === drawn)
        await page.keyboard.down("Control"); await page.keyboard.down("Shift"); await page.keyboard.press("z"); await page.keyboard.up("Shift"); await page.keyboard.up("Control"); await sleep(700)
        check("Ctrl+Shift+Z redoes it", (await st(page)).n === 3)
        await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control"); await sleep(700)
        // right-click a point deletes it — also undoable
        await page.mouse.click(c.x - 90, c.y + 60, { button: "right" }); await sleep(700)
        check("right-click on a point deletes it", (await st(page)).n === 3)
        await undo(page)
        check("…and Undo restores it", (await st(page)).shape === drawn)

        // ── keyboard order and focus ────────────────────────────────────────────────────────────────────────────
        await page.mouse.click(c.x + 90, c.y - 60); await sleep(500)
        await page.evaluate(() => document.querySelector("[data-boundary-undo]")?.focus())
        const order = []
        for (let i = 0; i < 4; i++) {
            order.push(await page.evaluate(() => { const a = document.activeElement; return ["undo", "redo", "clear", "redraw", "finish", "delete-point"].find((k) => a?.hasAttribute(`data-boundary-${k}`)) ?? a?.tagName ?? "none" }))
            await page.keyboard.press("Tab")
        }
        const visible = await page.evaluate(() => { const b = document.querySelector("[data-boundary-undo]"); b?.focus(); return b?.matches(":focus") })
        check("Tab order in the tools: Undo → Redo → Redraw outline → Delete point (history, start-over, the step's action)", order.join(" → ") === "undo → redo → redraw → delete-point" && visible, order.join(" → "))
        await page.mouse.click(c.x - 200, c.y + 150); await sleep(400)

        // ── invalid geometry: guidance, Save blocked, recoverable ────────────────────────────────────────────────
        await draw(page, BOW_TIE)
        s = await st(page)
        check("a self-crossing outline: the problem is shown under the guidance, the plot needs attention, Save all is disabled", s.problem === "The outline crosses itself" && s.state === "invalid" && s.save === "disabled", JSON.stringify(s))
        await undo(page)
        s = await st(page)
        check("Undo returns to the drawing before Finish (4 points, nothing lost)", s.mode === "draw" && s.n === 4, JSON.stringify(s))
        await undo(page); await undo(page); await undo(page); await undo(page); await undo(page)
        s = await st(page)
        check("…and further back to the valid outline drawn before", s.mode === "edit" && s.shape === drawn, JSON.stringify({ mode: s.mode, n: s.n }))

        // ── switching plots keeps each plot's own context and history ──────────────────────────────────────────────
        const B = ids.find((id) => id !== A)
        await select(page, B)
        s = await st(page)
        check("another plot: its own outline and step; its Undo is disabled (no history yet)", s.plot === B && s.undo === "disabled" && s.sel === null, JSON.stringify(s))
        await select(page, A)
        s = await st(page)
        check("back on the first plot: its edited outline and its history are kept (Undo enabled)", s.plot === A && s.shape === drawn && s.undo === "enabled", JSON.stringify({ plot: s.plot, same: s.shape === drawn, undo: s.undo }))

        // ── Reset (to the saved outline) is undoable; Cancel asks with unsaved edits ─────────────────────────────────
        await click(page, "[data-boundary-reset]"); await sleep(700)
        s = await st(page)
        check("Reset plot → the saved outline, Unchanged, nothing to save", s.shape === saved && s.state === "unchanged" && s.save === "disabled", JSON.stringify({ state: s.state, save: s.save }))
        await undo(page)
        s = await st(page)
        check("Undo after Reset brings the edits back (Modified)", s.shape === drawn && s.state === "modified")
        await click(page, "[data-boundary-cancel]")
        check("Cancel with unsaved edits asks first", await waitFor(page, () => !!document.querySelector("[data-boundary-confirm]"), 4000))
        await click(page, "[data-boundary-keep]")
        await waitFor(page, () => !document.querySelector("[data-boundary-confirm]"), 4000)
        await sleep(400)
        check("Keep editing returns with the edits intact", (await st(page))?.shape === drawn)

        // ── 768 px: the tools stay in their strip, on screen, never over the map ─────────────────────────────────
        await page.setViewport({ width: 768, height: 900 })
        await sleep(1000)
        const narrow = await page.evaluate(() => {
            const t = document.querySelector("[data-boundary-tools]").getBoundingClientRect()
            const m = document.querySelector("[data-boundary-editor] .gm-style").getBoundingClientRect()
            const onScreen = [...document.querySelectorAll("[data-boundary-tools] button")].every((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight })
            return { overlap: t.bottom > m.top + 0.5 && t.top < m.bottom, onScreen, toolsH: Math.round(t.height) }
        })
        check("768px: every tool is on screen and the tools never overlap the map", narrow.onScreen && !narrow.overlap, JSON.stringify(narrow))
        await page.setViewport({ width: 1600, height: 1000 })
        await sleep(800)

        // ── Save: Finish never saved; Save all writes the modified plot once, then closes ───────────────────────────
        const beforeSave = await page.evaluate(() => document.querySelector("[data-boundary-modified]")?.getAttribute("data-boundary-modified"))
        await click(page, "[data-boundary-save]")
        const closed = await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 15000)
        await L.closeSheet(page)
        const n = await uploads(page)
        check("Save all writes each modified plot once (Finish / Undo / Redo wrote nothing) and closes the editor", closed && n === Number(beforeSave), `${n} upload(s) for ${beforeSave} modified`)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── save failure: edits kept, history kept, Retry ─────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockBoundaries=seed&mockFail=geometry`, errors)
        const ids = await openEditor(page)
        await draw(page, SQUARE)
        const drawn = (await st(page)).shape
        await click(page, "[data-boundary-save]")
        await waitFor(page, () => !!document.querySelector("[data-boundary-result]"), 15000)
        await sleep(500)
        let s = await st(page)
        check("a failed save keeps the edits (same outline, Failed) and the history (Undo enabled); Save becomes Retry", !!ids && s.shape === drawn && s.state === "failed" && s.undo === "enabled" && (await page.$eval("[data-boundary-save]", (b) => b.textContent.trim())).startsWith("Retry"), JSON.stringify(s))
        await click(page, "[data-boundary-retry]")
        check("Retry saves it and the editor closes", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 15000))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
