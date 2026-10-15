/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — requirement 4 (status authority: a card's state is its own franchise_status) with the
// live API audit's per-dispatch validation (action_required / err_msg are sent PER DISPATCH: the flagged dispatch shows a
// marker beside its status and its messages on its card — never on a sibling, never as a deployment-level notice, never
// as a status; a flagged pending dispatch offers Report, not Approve), and requirement 5 (the approval gate: every plot
// of the dispatch needs a valid SAVED boundary — missing / invalid / all saved, re-checked in the confirmation dialog,
// unsaved editor drawings don't count). Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor, exists } = L

/** Opens the first table row whose list row / AZ / status match, waits for the detail, returns its deployment blocks. */
async function openSection(page, { rowKey, az, status, rowStatus }) {
    const rows = await L.dispatchRows(page)
    const row = rows.find((r) => r.id && (rowKey === undefined || r.rowKey === rowKey) && (az === undefined || r.az === String(az)) && (status === undefined || r.status === status) && (rowStatus === undefined || r.rowStatus === rowStatus))
    if (!row) return null
    await L.openRow(page, row.index)
    await L.detailLoaded(page)
    await L.expandAllDispatches(page)
    await sleep(900)
    return { row, sections: await L.detailSections(page) }
}
const sectionOf = (sections, rowKey) => sections.find((s) => s.key === rowKey)
const sheetText = (page) => page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? "")

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1. Status authority and PER-DISPATCH validation (default mock) ───────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        // mock deployment 1002-1-2 (farmer 1002, deployment 1, AZ 2): ONE of its dispatches is flagged (action_required,
        // "Video is missing."); its siblings are not. Every one of them is pending.
        const FLAGGED = "1002-1-2"
        const groupRows = (await L.dispatchRows(page)).filter((r) => r.id && r.rowKey === FLAGGED)
        const marked = groupRows.filter((r) => r.validation !== null)
        check("table: the flagged dispatch carries a validation marker beside its status; its siblings in the same deployment don't", groupRows.length > 1 && marked.length === 1 && marked[0].validation === 1, JSON.stringify(groupRows.map((r) => [r.id, r.status, r.validation])))
        check("table: every dispatch of that deployment keeps its own status (pending) — the flag never changes a status", groupRows.every((r) => r.status === "pending"))
        const opened = marked.length ? await openSection(page, { rowKey: FLAGGED }) : null
        const sec = opened && sectionOf(opened.sections, FLAGGED)
        const flaggedCard = sec?.cards.find((c) => c.dispatchId === marked[0]?.id)
        const siblings = sec?.cards.filter((c) => c.dispatchId !== marked[0]?.id) ?? []
        check("detail: no deployment-level validation notice (it is per dispatch)", !!sec && !(await exists(page, "[data-system-validation], [data-validation-list], [data-validation-reason], [data-row-validation]")) && !/System validation required/.test(await sheetText(page)))
        const notice = flaggedCard ? await page.evaluate((id) => { const n = document.querySelector(`[data-dispatch-row="${id}"] [data-dispatch-validation-notice]`); return n ? { text: n.textContent.replace(/\s+/g, " ").trim(), marker: !!document.querySelector(`[data-dispatch-row="${id}"] [data-dispatch-validation]`) } : null }, flaggedCard.id) : null
        check("detail: the flagged dispatch's card shows its marker and its message ('Action required' · 'Video is missing.')", !!notice && notice.marker && /Action required/.test(notice.text) && /Video is missing\./.test(notice.text), JSON.stringify(notice))
        check("detail: its sibling cards show no validation (one dispatch's flag never reaches another)", siblings.length > 0 && siblings.every((c) => !c.validation), JSON.stringify(siblings.map((c) => [c.dispatchId, c.validation])))
        check("detail: every card keeps its own status (pending → Pending)", !!sec && sec.cards.every((c) => c.status === "pending" && c.view === "pending"), JSON.stringify(sec?.cards.map((c) => [c.status, c.view])))
        // the flagged pending dispatch offers Report, not Approve (the established Action Required rule), and says why;
        // its unflagged siblings are evaluated by the Approve gates as before
        const actions = flaggedCard ? await page.evaluate((id) => ({ approve: !!document.querySelector(`[data-dispatch-row="${id}"] [data-approve]`), report: !!document.querySelector(`[data-dispatch-row="${id}"] [data-start-report]`), gate: document.querySelector(`[data-dispatch-row="${id}"] [data-dispatch-actions]`)?.getAttribute("data-approve-gate") ?? null, why: document.querySelector(`[data-dispatch-row="${id}"] [data-validation-approve-blocker]`)?.textContent.trim() ?? null }), flaggedCard.id) : null
        check("approval: a flagged pending dispatch offers Report and no Approve, with the reason beside its actions", !!actions && !actions.approve && actions.report && actions.gate === "validation" && /report it instead of approving/.test(actions.why ?? ""), JSON.stringify(actions))
        check("approval: its unflagged pending siblings are offered Approve (the boundary / NOC gates decide)", siblings.every((c) => c.gate === "blocked" || c.gate === "ok"), JSON.stringify(siblings.map((c) => c.gate)))
        const validationOnCards = await page.evaluate(() => document.querySelectorAll('[data-dispatch-row] [data-origin-kind="validation"], [data-dispatch-row] [data-correction="system_validation"]').length)
        check("no card shows a 'system validation' correction origin (validation is never a correction / status)", validationOnCards === 0)
        // the Data / API Inspector lists the deployment's flagged dispatches — diagnostics
        await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
        await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
        await page.evaluate(() => document.querySelector('[data-inspector-tab="mapping"]')?.click())
        await waitFor(page, () => !!document.querySelector("[data-mapping-rows]"), 5000)
        const inspectorRow = await page.evaluate(() => [...document.querySelectorAll("[data-mapping-rows] tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())).find((cells) => cells[0] === "1" && cells[1] === "2"))
        check("Inspector: the deployment's row counts ONE flagged dispatch (Flagged dispatches = 1)", !!inspectorRow && inspectorRow[6] === "1", JSON.stringify(inspectorRow))
        await page.keyboard.press("Escape")
        await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
        await sleep(300)
        await L.closeSheet(page)

        // a deployment with an approved dispatch beside pending ones: each card its own status (opened from All, so the
        // detail's local filter lists every status)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const allRows = (await L.dispatchRows(page)).filter((r) => r.id)
        const mixedRow = allRows.find((r) => r.status === "approved" && allRows.some((x) => x.rowKey === r.rowKey && x.status === "pending"))
        const mixed = mixedRow ? await openSection(page, { rowKey: mixedRow.rowKey, status: "approved" }) : null
        const mixedSec = mixed && sectionOf(mixed.sections, mixed.row.rowKey)
        check("a deployment's section shows an approved (Verified) card beside pending ones — per dispatch; the group isn't 'verified'", !!mixedSec && mixedSec.groupVerified === "false" && mixedSec.cards.some((c) => c.status === "approved" && c.view === "verified") && mixedSec.cards.some((c) => c.status === "pending"), JSON.stringify(mixedSec?.cards.map((c) => [c.status, c.view])))
        check("Verified-by text sits on the approved card (its own verifier)", await page.evaluate(() => [...document.querySelectorAll('[data-dispatch-row][data-dispatch-status="approved"] span')].some((s) => /^Verified( by)?\b/.test(s.textContent.trim()))))
        await L.closeSheet(page)

        // Need Correction tab: rejected dispatches only; markers only where the API flags the dispatch
        await L.selectTab(page, "Need Correction")
        await L.dispatchRowsLoaded(page)
        const ncRows = (await L.dispatchRows(page)).filter((r) => r.id)
        check("Need Correction tab: only dispatches whose own status is rejected", ncRows.length > 0 && ncRows.every((r) => r.status === "rejected"), [...new Set(ncRows.map((r) => r.status))].join(","))
        const flaggedCount = await page.evaluate(() => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-rows-flagged")))
        check("Need Correction tab: a marker on exactly the rows the API flags (data-rows-flagged)", ncRows.filter((r) => r.validation !== null).length === flaggedCount, `${flaggedCount} flagged`)
        // mock deployment 1001-1-2: Need Correction WITHOUT action_required — no validation anywhere in its section
        const unflagged = allRows.find((r) => r.rowKey === "1001-1-2")
        check("the mock's Need Correction deployment without action_required is listed", !!unflagged)
        if (unflagged) {
            await L.selectTab(page, "All")
            await L.dispatchRowsLoaded(page)
            await L.loadAllRows(page)
            const o = await openSection(page, { rowKey: unflagged.rowKey })
            const s = o && sectionOf(o.sections, unflagged.rowKey)
            check("…no validation in its section; its rejected dispatch is Need Correction from its own status", !!s && s.cards.every((c) => !c.validation) && s.cards.some((c) => c.status === "rejected" && c.view === "need_correction"), JSON.stringify(s?.cards.map((c) => [c.status, c.view, c.validation])))
            await L.closeSheet(page)
        }
        // mock deployment 1007-1-2: one dispatch flagged with an EMPTY err_msg — the flag is shown, no reason is invented
        const noReason = allRows.find((r) => r.rowKey === "1007-1-2")
        check("the mock's deployment flagged with an EMPTY err_msg is listed", !!noReason)
        if (noReason) {
            const o = await openSection(page, { rowKey: noReason.rowKey })
            const s = o && sectionOf(o.sections, noReason.rowKey)
            const texts = await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-validation-notice]")].map((n) => n.textContent.replace(/\s+/g, " ").trim()))
            check("…its flagged dispatch says 'Action required' and that no reason was sent (nothing invented); only that card", !!s && s.cards.filter((c) => c.validation).length === 1 && texts.some((t) => /Action required/.test(t) && /No reason was sent/.test(t)), JSON.stringify(texts))
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. The approval gate without any saved boundary (default mock: no geometry) ───────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const o = await openSection(page, { status: "pending", rowStatus: "pending" })
        // cards whose Approve gate is evaluated (a flagged dispatch offers Report instead: gate "validation", section 1)
        const cards = o ? o.sections.flatMap((s) => s.cards).filter((c) => c.gate === "blocked" || c.gate === "ok") : []
        check("Approve is offered on pending dispatches of Pending rows (the gate is evaluated)", cards.length > 0)
        check("without saved boundaries every approvable dispatch is blocked, naming the plots without one", cards.length > 0 && cards.every((c) => c.gate === "blocked" && /no saved boundary/i.test(c.blocker ?? "") && /DEPL-/.test(c.blocker ?? "")), cards[0]?.blocker)
        check("the Approve button is disabled while blocked", await page.evaluate(() => [...document.querySelectorAll("[data-approve]")].every((b) => b.disabled)))
        check("Plots · boundaries in the table shows 0 saved", (await L.dispatchRows(page)).filter((r) => r.id).every((r) => r.boundaries === 0))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 3. Seeded boundaries: complete → approvable; one missing → blocked; one invalid → blocked ─────
    {
        const page = await L.open(browser, `${L.V21}?mockBoundaries=seed`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const table = (await L.dispatchRows(page)).filter((r) => r.id)
        check("the table's boundary count follows the seeded geometry (some plots saved, some not)", table.some((r) => r.boundaries === r.plots && r.plots > 0) && table.some((r) => r.boundaries < r.plots))
        // a deployment whose pending, unflagged dispatches cover the three seeded gate cases — every plot saved, one plot
        // missing, one saved outline invalid — classified from what each card reports (the seeding is by dispatch position
        // in the deployment, and a deployment's first dispatch may already be approved, so positions in the tab differ)
        let found = null
        const candidates = [...new Set(table.filter((r) => r.status === "pending" && r.validation === null).map((r) => r.rowKey))]
            .filter((key) => table.filter((x) => x.rowKey === key && x.status === "pending" && x.validation === null).length >= 3)
        for (const key of candidates.slice(0, 6)) {
            const r = table.find((x) => x.rowKey === key)
            await L.openRow(page, r.index)
            await L.detailLoaded(page)
            await L.expandAllDispatches(page)
            await sleep(900)
            const sec = sectionOf(await L.detailSections(page), key)
            const open = sec?.cards.filter((c) => c.status === "pending" && !c.validation) ?? []
            const complete = open.find((c) => c.gate === "ok")
            const missing = open.find((c) => c.gate === "blocked" && /no saved boundary/i.test(c.blocker ?? ""))
            const invalid = open.find((c) => c.gate === "blocked" && /invalid boundary/i.test(c.blocker ?? "") && /crosses itself/.test(c.blocker ?? ""))
            if (complete && missing && invalid) { found = { r, complete, missing, invalid }; break }
            await L.closeSheet(page)
        }
        check("a deployment with the three seeded gate cases (complete / one plot missing / one outline invalid) exists", !!found)
        if (found) {
            const { complete, missing, invalid } = found
            check("every plot saved → Approve available (gate ok)", complete?.gate === "ok" && complete.blocker === null, JSON.stringify(complete))
            check("one plot without a saved boundary → blocked, naming it", missing?.gate === "blocked" && /no saved boundary/i.test(missing.blocker ?? "") && /DEPL-/.test(missing.blocker ?? ""), missing?.blocker)
            check("an invalid (self-crossing) saved boundary → blocked, with the problem", invalid?.gate === "blocked" && /invalid boundary/i.test(invalid.blocker ?? "") && /crosses itself/.test(invalid.blocker ?? ""), invalid?.blocker)

            // Unsaved edits don't count: draw on the missing plot in the editor, cancel, the gate is unchanged
            const missingPlot = await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-plot-card][data-plot-location="valid"]:last-of-type`)?.getAttribute("data-plot-card"), missing.id)
            let editorTried = false
            if (missingPlot) {
                await page.evaluate((p) => document.querySelector(`[data-plot-card="${p}"] [data-plot-toggle]`)?.click(), missingPlot)
                if (await waitFor(page, () => !!document.querySelector("[data-edit-boundary]"), 10000)) {
                    await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
                    if (await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)) {
                        editorTried = true
                        await sleep(2500)
                        if ((await page.$eval("[data-boundary-editor]", (e) => e.getAttribute("data-boundary-mode"))) === "edit") {
                            await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click())
                            await sleep(300)
                        }
                        const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 60 } })
                        for (const [dx, dy] of [[-90, -60], [90, -60], [90, 60], [-90, 60]]) { await page.mouse.click(box.x + dx, box.y + dy); await sleep(400) }
                        await page.evaluate(() => document.querySelector("[data-boundary-finish]")?.click())
                        await sleep(500)
                        await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
                        await sleep(400)
                        await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find((b) => /Discard/i.test(b.textContent))?.click())
                        await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 8000)
                        await sleep(800)
                        const after = sectionOf(await L.detailSections(page), found.r.rowKey)?.cards.find((c) => c.id === missing.id)
                        check("an outline drawn but NOT saved doesn't count: the gate stays blocked", after?.gate === "blocked" && /no saved boundary/i.test(after.blocker ?? ""), after?.blocker)
                    }
                }
            }
            if (!editorTried) note("unsaved-edit check", "the boundary editor couldn't be opened on the missing plot in this run (map not ready) — covered by boundary.cjs")

            // The warning: the boundary line has the heading, the detail, and the way to the editor
            const boundaryLine = await page.evaluate((id) => { const p = document.querySelector(`[data-dispatch-row="${id}"] [data-approve-blocker][data-blocker-kind="boundary"]`); return p ? { title: p.querySelector("[data-blocker-title]")?.textContent.trim() ?? "", text: p.textContent.replace(/\s+/g, " ").trim(), action: p.querySelector("[data-blocker-action]")?.textContent.trim() ?? null } : null }, missing.id)
            check("the blocked dispatch's boundary warning is short: 'Boundaries required.' + the plots without one", !!boundaryLine && boundaryLine.title === "Boundaries required." && boundaryLine.text.startsWith("Boundaries required. No saved boundary: DEPL-") && boundaryLine.text.replace(boundaryLine.action ?? "", "").trim().length <= 120, JSON.stringify(boundaryLine))
            // the warning's Edit boundaries opens the existing editor (the link is offered only when one of the plots is on the map)
            if (boundaryLine?.action === "Edit boundaries") {
                await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-blocker-kind="boundary"] [data-blocker-action]`)?.click(), missing.id)
                const opened = await waitFor(page, () => !!document.querySelector("[data-boundary-editor]"), 20000)
                check("Edit boundaries on the warning opens the existing boundary editor", opened)
                if (opened) {
                    await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
                    await sleep(400)
                    await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find((b) => /Discard/i.test(b.textContent))?.click())
                    await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 8000)
                    await sleep(500)
                }
            } else {
                note("Edit boundaries link", "not offered on this dispatch: none of its plots has a map location in this run")
            }

            // The handler enforces the gate itself: invoking the disabled Approve button's React onClick directly (bypassing
            // the disabled attribute) opens no confirmation dialog and says why
            const bypass = await page.evaluate((id) => {
                const b = document.querySelector(`[data-dispatch-row="${id}"] [data-approve]`)
                if (!b) return "no button"
                if (!b.disabled) return "not disabled"
                const key = Object.keys(b).find((k) => k.startsWith("__reactProps$"))
                if (!key || typeof b[key].onClick !== "function") return "no handler"
                b[key].onClick({ preventDefault() {}, stopPropagation() {} })
                return "invoked"
            }, missing.id)
            const refused = bypass === "invoked" && (await waitFor(page, () => /Cannot approve/.test(document.body.innerText) && /Boundaries required./.test(document.body.innerText), 4000))
            await sleep(400)
            check("invoking the approve handler of a blocked dispatch directly is refused by the handler (toast with the boundary reason, no confirmation dialog)", refused && !(await exists(page, "[data-approve-dialog]")), bypass)

            // Fail-safe while the boundaries are being re-read: after the approval below the detail reloads; meanwhile the
            // remaining blocked dispatch must show its boundaries as "checking" (never as verified)
            await page.evaluate(() => {
                window.__boundaryChecking = false
                const seen = () => { if ([...document.querySelectorAll('[data-approve-blocker][data-blocker-kind="boundary"]')].some((p) => /Checking the plots' saved boundaries/.test(p.textContent))) window.__boundaryChecking = true }
                window.__boundaryObserver = new MutationObserver(seen)
                window.__boundaryObserver.observe(document.body, { subtree: true, childList: true, characterData: true })
            })

            // Success: approve the complete dispatch; the dialog re-states the gate plot by plot; the card becomes Verified
            await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-approve]`)?.click(), complete.id)
            check("the confirmation dialog opens with the gate ok", await waitFor(page, () => document.querySelector("[data-approve-dialog]")?.getAttribute("data-approve-dialog-gate") === "ok", 6000))
            const dialog = await page.evaluate(() => ({ saved: document.querySelectorAll('[data-approve-boundary="saved"]').length, other: document.querySelectorAll('[data-approve-boundary]:not([data-approve-boundary="saved"])').length, plots: Number(document.querySelector("[data-approve-boundaries]")?.getAttribute("data-approve-boundaries")), enabled: !document.querySelector("[data-approve-confirm]")?.disabled }))
            check("the dialog lists every plot as saved and enables Approve", dialog.plots > 0 && dialog.saved === dialog.plots && dialog.other === 0 && dialog.enabled, JSON.stringify(dialog))
            await page.evaluate(() => document.querySelector("[data-approve-confirm]")?.click())
            check("the approval succeeds (mock)", await waitFor(page, () => /Approved Successfully/.test(document.body.innerText), 8000))
            await waitFor(page, () => window.__boundaryChecking === true, 6000)
            check("while the detail re-reads after the approval, the other blocked dispatch's boundaries show 'Checking…' (unverified, never approvable)", await page.evaluate(() => { window.__boundaryObserver?.disconnect(); return window.__boundaryChecking === true }))
            // opened from the Pending tab, the local filter is Pending: the now-approved dispatch leaves it (it is in All)
            check("after the reload the approved dispatch leaves the Pending filter (its status is its own)", await waitFor(page, (id) => { const c = document.querySelector(`[data-dispatch-row="${id}"]`); return !c || c.getAttribute("data-dispatch-status") === "approved" }, 15000, complete.id))
            // the local filter is a Radix dropdown (opens on pointerdown) → All
            await page.evaluate(() => { const b = document.querySelector("[data-detail-filter]"); if (!b) return; b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b.click() })
            check("the local filter menu opens", await waitFor(page, () => !!document.querySelector('[data-filter-option="all"]'), 4000))
            await page.evaluate(() => document.querySelector('[data-filter-option="all"]')?.click())
            await waitFor(page, () => document.querySelector("[data-detail-filter]")?.getAttribute("data-detail-filter") === "all", 4000)
            check("in All the dispatch's own status is approved (Verified card)", await waitFor(page, (id) => document.querySelector(`[data-dispatch-row="${id}"]`)?.getAttribute("data-dispatch-status") === "approved", 15000, complete.id))
            // the table (Pending tab behind the sheet) follows the dispatch's own status: it leaves Pending, appears in Verified
            check("the approved dispatch leaves the Pending tab's table (its status is now approved)", await waitFor(page, (id) => !document.querySelector(`[data-dispatch-cell="${id}"]`), 15000, complete.dispatchId))
            await L.closeSheet(page)
            await L.selectTab(page, "Verified")
            await L.dispatchRowsLoaded(page)
            await L.loadAllRows(page) // newest first by Submitted on: an older dispatch approved now may be on a later page
            check("…and is listed in the Verified tab, approved (one row per dispatch, status from the dispatch)", await waitFor(page, (id) => document.querySelector(`[data-dispatch-cell="${id}"]`)?.closest("tr")?.querySelector("[data-dispatch-status]")?.getAttribute("data-dispatch-status") === "approved", 15000, complete.dispatchId))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    note("no plots / partial failure", "the no-plots gate is covered by check-payloads.mjs (a Need Correction row offers no Approve in the mock); the partial multi-plot save (one request per plot, Retry) by boundary.cjs")
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
