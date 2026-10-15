/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the UI refinements: no Round / deployment number anywhere (R1), the table's column order
// and labels after Deployment V2 with AZ code / AZ name apart and nothing beneath Dispatch ID (R2 / R6 / R7), the farmer
// detail grouped by AZ (R3) with no per-deployment heading, NOC and Pre-Sample in the farmer header (R4) — the NOC
// farmer-level: one readiness strip, one view listing every document with per-document decisions, the card's Review NOC
// kept —, report history on the dispatch card (R5), the established dispatch card with the authoritative status — no
// `Reported` label (R8) — and no deployment-level validation notice or table marker (the API names no dispatch for it).
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor, exists } = L

const ROUND_TEXT = /\bRound\b|#Dep|Dep\.? No\b|Deployment No\b|deployment_num/
const sheetText = (page) => page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? "")
const tableText = (page) => page.evaluate(() => (document.querySelector("table")?.innerText ?? "") + "\n" + (document.querySelector("[data-dispatch-grain-notice]")?.innerText ?? ""))
const headers = (page) => page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim()).filter(Boolean))
const V2_HEADERS = (page) => page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim()).filter(Boolean))

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 0. Deployment V2's column order and labels (the reference), per tab ──────────────────────────
    const v2 = {}
    {
        const page = await L.open(browser, L.V2, errors)
        await L.rowsLoaded(page)
        for (const tab of ["Verified", "Pending", "All"]) {
            await L.selectTab(page, tab)
            v2[tab] = await V2_HEADERS(page)
        }
        note("V2 Oct 26 headers", JSON.stringify(v2))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 1. Table: order / labels after V2, AZ code and AZ name apart, Dispatch ID second and alone, no Round ─────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        const h = await headers(page)
        note("V2.1 headers (Verified)", h.join(" · "))
        const expected = ["Submitted on", "Dispatch ID", "Farmer", "Village", "Plots", "Boundaries", "Area", "Cal. Area", "AZ code", "AZ name", "Deployed", "Status", "Surveyor", "Verified By", "Verified On"]
        check("R2/R6: V2.1 columns follow V2's (All tab) order and labels, with Dispatch ID second (after Submitted on) and the dispatch-grain Boundaries column", h.join("|") === expected.join("|"), h.join(" · "))
        const v2Shared = v2.All ?? []
        const order = (list) => list.filter((t) => v2Shared.includes(t))
        check("R2: the columns V2.1 shares with V2 keep V2's relative order (Status where V2's All tab has it)", order(h).join("|") === order(v2Shared).join("|"), `${order(h).join(" · ")} vs ${order(v2Shared).join(" · ")}`)
        check("R6: V2's labels are reused where the meaning is the same (no raw API field names)", ["Submitted on", "Farmer", "Village", "Plots", "Area", "AZ code", "AZ name", "Deployed", "Surveyor", "Verified By", "Verified On"].every((t) => h.includes(t)) && !h.some((t) => /_|az_code|az_name|franchise/.test(t)))
        check("R7: AZ code and AZ name are separate columns", h.includes("AZ code") && h.includes("AZ name") && !h.includes("AZ"))
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        check("R7: the AZ cells show the code and the name separately (never combined)", rows.length > 0 && rows.every((r) => r.az && r.azName && !/·/.test(r.azName)), rows[0] ? `${rows[0].az} / ${rows[0].azName}` : "")
        const dispatchCells = await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-cell]")].map((c) => ({ text: c.closest("td")?.innerText.replace(/\s+/g, " ").trim(), lines: (c.closest("td")?.innerText ?? "").trim().split("\n").length })))
        check("R7: the Dispatch ID cell is the dispatch id alone — no Trailer No beneath it", dispatchCells.length > 0 && dispatchCells.every((c) => c.lines === 1 && /^DISP-\d+$/.test(c.text)), JSON.stringify(dispatchCells[0]))
        check("R1: no Round / deployment-number column or text in the table", !h.some((t) => ROUND_TEXT.test(t)) && !ROUND_TEXT.test(await tableText(page)))
        // cell parity with V2 / Samples (the Verified tab: every row verified): dates, person cells, badge, numbers
        const cells = await page.evaluate(() => {
            const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim())
            const idx = (t) => heads.indexOf(t)
            const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.querySelector("[data-dispatch-cell]") && r.querySelector("[data-row-verified-on]"))
            if (!tr) return null
            const td = (t) => tr.children[idx(t)]
            const person = (el) => el && { name: el.querySelector(".text-sm")?.textContent.trim() ?? "", phone: el.querySelector(".font-mono")?.textContent.trim() ?? "", card: !!el.querySelector("[data-state]") }
            return { submitted: td("Submitted on")?.textContent.trim(), verifiedOn: td("Verified On")?.textContent.trim(), surveyor: person(td("Surveyor")), verifier: person(td("Verified By")), status: td("Status")?.querySelector("[data-dispatch-status]")?.className ?? "", plotsClass: td("Plots")?.firstElementChild?.className ?? "" }
        })
        check("Verified On: a verified row shows V2's table date (dd MMM yy, uppercase) from the list row's verified_at", !!cells && /^\d{2} [A-Z]{3} \d{2}$/.test(cells.verifiedOn ?? ""), JSON.stringify(cells?.verifiedOn))
        check("Submitted on uses the same V2 table date", !!cells && /^\d{2} [A-Z]{3} \d{2}$/.test(cells.submitted ?? ""), cells?.submitted)
        check("Surveyor uses V2's person cell (hover card: name + masked phone)", !!cells?.surveyor && cells.surveyor.name !== "" && /\*{3,}\d{4}$/.test(cells.surveyor.phone) && cells.surveyor.card, JSON.stringify(cells?.surveyor))
        check("Verified By uses the same person cell as Samples' Verified By (name, hover card; the phone when the API sends one)", !!cells?.verifier && cells.verifier.name !== "" && cells.verifier.card, JSON.stringify(cells?.verifier))
        check("Status uses V2's table badge (px-2.5 py-0.5), not the card pill", !!cells && /px-2\.5/.test(cells.status) && !/text-\[9px\]/.test(cells.status))
        check("numeric cells are V2's plain text-sm (no monospace)", !!cells && /text-sm/.test(cells.plotsClass) && !/font-mono/.test(cells.plotsClass), cells?.plotsClass)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const unverified = await page.evaluate(() => { const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim()); const i = heads.indexOf("Verified On"); const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.querySelector("[data-dispatch-cell]") && !r.querySelector("[data-row-verified-on]")); return tr ? tr.children[i]?.textContent.trim() : null })
        check("Verified On: a row whose deployment has no verified_at shows V2's empty '-' (no substituted date)", unverified === "-", String(unverified))
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const pending = await headers(page)
        check("V2 parity: Verified By and Verified On are hidden on the Pending tab (as V2 hides its verification columns)", !pending.includes("Verified By") && !pending.includes("Verified On") && pending.join("|") === expected.slice(0, -2).join("|"), pending.join(" · "))
        check("R1 (Pending): no Round cell, and no validation marker on any dispatch row (the deployment-wide action_required names no dispatch; AZ code / AZ name are text only)", !(await exists(page, "[data-row-round], [data-row-validation], [data-row-az] svg, [data-row-az-name] svg")))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. Farmer detail: grouped by AZ (Samples pattern), NOC / Pre-Sample in the header, history on the card ──
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        // The detail reads EVERY list row of the farmer (across table pages): the first farmer of the mock has five
        // deployments over three AZs, two of them in one AZ — the grouping cases in one farmer.
        await L.openRow(page, rows[0].index)
        await L.detailLoaded(page)
        await sleep(600)
        const blocks = await L.detailSections(page)
        const farmerRows = await page.evaluate(() => Number(document.querySelector("[data-farmer-details]")?.getAttribute("data-farmer-rows")))
        const azs = new Set(blocks.map((b) => b.az))
        const multi = farmerRows > azs.size && azs.size > 1 ? { keys: new Set(blocks.map((b) => b.key)), azs } : null
        check("the opened farmer has several deployments, two of them in one AZ (the grouping cases)", !!multi, `${farmerRows} deployments across ${azs.size} AZs`)
        if (multi) {
            const sections = await L.azSections(page)
            check("R3: the detail has one section per AZ (data-az-section), not per trailer", sections.length === multi.azs.size && sections.every((s) => s.code) && !(await exists(page, "[data-trailer-section]")), JSON.stringify(sections.map((s) => [s.code, s.rows])))
            check("R3: every deployment (list row) of the farmer sits inside its AZ's section", blocks.length === multi.keys.size && blocks.every((b) => b.azSection && sections.find((s) => s.code === b.azSection && s.azId === b.az)))
            const twoInOne = sections.find((s) => s.rows > 1)
            const twoInOneRows = twoInOne ? await page.evaluate((code) => document.querySelectorAll(`[data-az-section="${code}"] [data-farmer-row]`).length, twoInOne.code) : 0
            check("R3: an AZ with two deployments lists both inside its one section with NO per-deployment heading (no 'Deployment submitted …' / status caption; the cards carry their own dates and statuses)", !!twoInOne && twoInOneRows === twoInOne.rows && twoInOne.captions.length === 0 && !/Deployment submitted/.test(await sheetText(page)), JSON.stringify(twoInOne))
            check("R3: the AZ section headers follow the Samples group header (code · name, dispatch counts)", await page.evaluate(() => [...document.querySelectorAll("[data-az-section] [data-az-toggle]")].every((b) => b.querySelector("[data-az-name]") && b.querySelector("[data-az-count]"))))
            check("R1: nothing in the detail says Round / deployment number", !ROUND_TEXT.test(await sheetText(page)))
            // collapse / expand an AZ
            await page.evaluate(() => document.querySelector("[data-az-section] [data-az-toggle]")?.click())
            await sleep(300)
            check("R3: an AZ section collapses and expands like a Samples group", (await L.azSections(page))[0].collapsed === true)
            await page.evaluate(() => document.querySelector("[data-az-section] [data-az-toggle]")?.click())
            await sleep(300)

            // R4: NOC and Pre-Sample in the farmer header, V2's icons; none on sections or cards
            const actions = await L.headerActions(page)
            check("R4: the NOC icon sits in the farmer header (V2's summary bar) with the farmer-level state", !!actions.noc && ["approved", "pending", "none", "unavailable"].includes(actions.noc.state), JSON.stringify(actions.noc))
            check("R4: the NOC label lists every AZ document separately — distinct documents are never merged", !!actions.noc && /^NOC — /.test(actions.noc.label) && [...multi.azs].filter((az) => (actions.noc.label.match(new RegExp(`AZ${az}`, "g")) ?? []).length >= 1).length >= 1, actions.noc?.label)
            check("R4: the Pre-Sample icon sits in the farmer header (the farmer has AZ 1–3 deployments)", !!actions.preSample && /^Pre-Sample — /.test(actions.preSample.label), JSON.stringify(actions.preSample))
            check("R4 / R5: no NOC, Pre-Sample or history action on AZ sections or dispatch cards (history is the card's clock)", !(await exists(page, "[data-az-section] [data-open-noc], [data-az-section] [data-open-pre-sample], [data-dispatch-row] [data-open-noc], [data-open-history]")))
            check("R5: no report-history action in the header", !actions.historyInHeader)
            // the counts are said ONCE, in the details bar; nothing repeats them beside the header icons
            const counts = await page.evaluate(() => ({
                details: document.querySelector("[data-farmer-details]")?.textContent.replace(/\s+/g, " ").trim() ?? "",
                summaryBar: document.querySelector("[data-summary-bar]")?.textContent.replace(/\s+/g, " ").trim() ?? "",
                icons: document.querySelectorAll("[data-summary-bar] [data-header-actions] button").length,
            }))
            check("the details bar states the counts ('n Deployments . n Dispatches')", /\d+ Deployments? \. \d+ Dispatch(es)?/.test(counts.details), counts.details)
            check("the summary bar beside the NOC / Pre-Sample icons no longer repeats 'n dispatches · n deployments'; the icons stay", !/\d+ dispatch(es)? · \d+ deployments?/i.test(counts.summaryBar) && counts.icons >= 2, counts.summaryBar)
            // the farmer-level NOC: ONE readiness strip in the fixed header (V2's, under the summary bar) and a view listing every document
            const strip = await L.farmerNoc(page)
            check("NOC: one farmer-level readiness strip sits in the fixed header (under the summary bar) — none per deployment or card", !!strip && strip.inHeader && strip.count === 1 && !(await exists(page, "[data-farmer-row] [data-noc-readiness], [data-dispatch-row] [data-noc-readiness]")), JSON.stringify(strip))
            check("NOC: the strip states the farmer's NOC state across its documents (the pending ones named by AZ, never a round) with a Review action", !!strip && strip.readiness === "pending" && strip.undecided >= 1 && /waiting for review|reported/.test(strip.text) && /AZ\d/.test(strip.text) && !ROUND_TEXT.test(strip.text) && /^Review NOC/.test(strip.action ?? ""), strip?.text)
            // the direct review: open NOC → a document at once (image, Report / Approve, Previous / Next, position) — no list layer
            check("NOC: the header NOC icon opens the review directly on a document (no list screen, no nested document dialog)", (await L.openNocReview(page)) && (await L.nocReview(page))?.state === "document" && !(await L.nocReview(page)).listLayer, JSON.stringify(await L.nocReview(page)))
            const rv = await L.nocReview(page)
            check("NOC: the first document shown is one still waiting for review, with its image, Report and Approve, labelled by AZ + submission date (never a round)", !!rv && rv.status !== "approved" && rv.image && rv.approve && rv.report && /^NOC — AZ\d/.test(rv.label) && !ROUND_TEXT.test(rv.label), JSON.stringify(rv))
            const total = rv?.pager ? Number(rv.pager.split("/")[1]) : 0
            check("NOC: Previous / Next with the position ('n / total') cover every document of the farmer; Previous is disabled on the first", !!rv && total >= 2 && rv.position === rv.pager && rv.prevDisabled === true && rv.nextDisabled === false, rv?.pager ?? "no pager")
            // waiting documents come first, then the approved ones; Next walks through every document
            const sequence = []
            for (let i = 0; i < 10; i++) {
                const r = await L.nocReview(page)
                if (!r) break
                sequence.push(`${r.az}:${r.status}`)
                if (r.nextDisabled !== false) break
                await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
                await sleep(250)
            }
            const firstApproved = sequence.findIndex((s) => /:approved$/.test(s))
            check("NOC: Next walks through every document in review order — waiting first, then approved", sequence.length === total && (firstApproved === -1 || sequence.slice(firstApproved).every((s) => /:approved$/.test(s))), sequence.join(" → "))
            const last = await L.nocReview(page)
            check("NOC: an approved document shows its status with no Report / Approve; Next is disabled on the last", !!last && last.nextDisabled === true && (last.status !== "approved" || (!last.approve && !last.report && /Status: approved/.test(last.statusLine))), JSON.stringify(last && [last.status, last.approve, last.statusLine]))
            await page.keyboard.press("ArrowLeft")
            await sleep(250)
            check("NOC: the arrow keys move between documents too", (await L.nocReview(page))?.position === `${total - 1}/${total}`, (await L.nocReview(page))?.position)
            await L.closeNocReview(page)
            check("NOC: Escape closes the review", !(await L.nocReview(page)))
            // a card's "Review NOC" (the secondary option above its Approve button) is kept and opens the same farmer-level view
            await L.expandAllDispatches(page)
            await sleep(500)
            // Independent gates are listed together: a pending NOC never hides missing plot boundaries (default mock: no geometry)
            const both = await page.evaluate(() => {
                const actions = [...document.querySelectorAll('[data-dispatch-actions][data-approve-blockers="noc boundary"]')][0]
                if (!actions) return null
                const lines = [...actions.querySelectorAll("[data-approve-blocker]")]
                const rects = lines.map((l) => l.getBoundingClientRect())
                const noc = actions.querySelector('[data-blocker-kind="noc"]'), boundary = actions.querySelector('[data-blocker-kind="boundary"]')
                return {
                    lines: lines.length,
                    nocText: noc?.textContent.replace(/\s+/g, " ").trim() ?? "",
                    nocAction: noc?.querySelector("[data-blocker-action]")?.textContent.trim() ?? null,
                    boundaryTitle: boundary?.querySelector("[data-blocker-title]")?.textContent.trim() ?? "",
                    boundaryAction: boundary?.querySelector("[data-blocker-action]")?.textContent.trim() ?? null,
                    noOverlap: rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 0.5),
                    approveDisabled: actions.querySelector("[data-approve]")?.disabled ?? null,
                    dispatch: actions.closest("[data-dispatch-row]")?.getAttribute("data-dispatch-row"),
                }
            })
            check("a dispatch blocked by both its NOC and its plot boundaries lists BOTH warnings, one line each, without overlap; Approve stays disabled", !!both && both.lines === 2 && /Noc/.test(both.nocText) && both.nocAction === "Review NOC" && both.boundaryTitle === "Boundaries required." && both.noOverlap && both.approveDisabled === true, JSON.stringify(both))
            if (both && both.boundaryAction === "Edit boundaries") {
                // the boundary warning's Edit boundaries opens the existing editor
                await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-blocker-kind="boundary"] [data-blocker-action]`)?.click(), both.dispatch)
                const opened = await waitFor(page, () => !!document.querySelector("[data-boundary-editor]"), 20000)
                check("Edit boundaries on the warning opens the existing boundary editor", opened)
                if (opened) {
                    await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
                    await sleep(400)
                    await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find((b) => /Discard/i.test(b.textContent))?.click())
                    await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 8000)
                    await sleep(500)
                }
            } else if (both) {
                // no link is offered only when the editor couldn't open: none of the dispatch's plots is on the map
                const located = await page.evaluate((id) => document.querySelectorAll(`[data-dispatch-row="${id}"] [data-plot-card][data-plot-location="valid"]`).length, both.dispatch)
                note("Edit boundaries link", `not offered on ${both.dispatch} (plots with a map location on the card: ${located}); the editor link is exercised by status-gate.cjs on a located dispatch`)
            }
            const reviewLink = await page.evaluate(() => {
                const b = [...document.querySelectorAll("[data-dispatch-row] [data-approve-blocker] button")].find((x) => /Review NOC/.test(x.textContent))
                if (!b) return null
                const actions = b.closest("[data-dispatch-actions]")
                const approve = actions?.querySelector("[data-approve]")
                const above = !!approve && !!(b.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING)
                const row = b.closest("[data-farmer-row]")?.getAttribute("data-farmer-row")
                b.click()
                return { row, above }
            })
            check("NOC: a dispatch card keeps its Review NOC option above its Approve button", !!reviewLink && reviewLink.above, JSON.stringify(reviewLink))
            if (reviewLink) {
                const opened = await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)
                const r = opened ? await L.nocReview(page) : null
                check("NOC: Review NOC opens the review directly on that deployment's waiting document", opened && !!r && r.key.startsWith(`${reviewLink.row}:`) && r.status !== "approved" && !r.listLayer, JSON.stringify(r && [r.key, r.status]))
                await L.closeNocReview(page)
            }
            // approving in the review: ONE document (its own row + AZ); the review stays open on the next waiting document; the strip follows
            if (await L.openNocReview(page)) {
                const before = await L.nocReview(page)
                check("NOC: the review opens on a waiting document that offers Approve", !!before && before.status !== "approved" && before.approve)
                if (before && before.approve) {
                    await page.evaluate(() => document.querySelector("[data-noc-approve]")?.click())
                    const toast = await waitFor(page, () => /Noc qualified successfully/.test(document.body.innerText), 8000)
                    const moved = await waitFor(page, (k) => { const d = document.querySelector("[data-noc-review]"); return !!d && d.getAttribute("data-noc-current") !== k && d.getAttribute("data-noc-current-status") !== "approved" }, 8000, before.key)
                    const after = await L.nocReview(page)
                    check("NOC: Approve decides THAT document only; the review stays open and moves on to the next waiting document", toast && moved && !!after && after.key !== before.key && after.status !== "approved" && after.approve && !after.listLayer, JSON.stringify(after && [after.key, after.status, after.position]))
                    // the row is re-read after the decision (reconcile + reload); the strip follows once the NOC read lands
                    await waitFor(page, (n) => Number(document.querySelector("[data-farmer-noc]")?.getAttribute("data-noc-undecided")) === n, 15000, (strip?.undecided ?? 0) - 1)
                    const stripAfter = await L.farmerNoc(page)
                    check("NOC: the farmer-level strip follows the decision (one fewer waiting for review)", !!stripAfter && !!strip && stripAfter.undecided === strip.undecided - 1 && stripAfter.readiness === "pending", JSON.stringify(stripAfter))
                    const pagerAfter = await L.nocReview(page)
                    check("NOC: the approved document is still reachable in the review (it moved behind the waiting ones)", !!pagerAfter && Number((pagerAfter.pager ?? "0/0").split("/")[1]) === total, pagerAfter?.pager)
                }
                await L.closeNocReview(page)
                await L.detailLoaded(page)
                await sleep(800)
            }

            // R5: history on the card: every card has the clock; states; the dialog is scoped to the dispatch
            await L.expandAllDispatches(page)
            await sleep(500)
            const cards = (await L.detailSections(page)).flatMap((s) => s.cards)
            check("R5: every dispatch card carries its own report-history control", cards.length > 0 && cards.every((c) => c.history !== null))
            check("R5: history reads settled (ready) for every deployment — no card shows another dispatch's history", cards.every((c) => c.history === "ready"))
            const withEntries = cards.find((c) => c.historyEntries)
            const withoutEntries = cards.find((c) => !c.historyEntries)
            if (withEntries) {
                await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-history-indicator]`)?.click(), withEntries.id)
                check("R5: the clock opens the history dialog scoped to THAT dispatch", await waitFor(page, (id) => document.querySelector("[data-history-scope]")?.getAttribute("data-history-scope") === id && !!document.querySelector('[data-history-entry]'), 8000, withEntries.id))
                await page.evaluate(() => document.querySelector("[data-history-close]")?.click())
                await sleep(300)
            } else note("history with entries", "no dispatch with history entries among this farmer's cards")
            if (withoutEntries) {
                await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-history-indicator]`)?.click(), withoutEntries.id)
                check("R5: a dispatch without history opens an explicit empty state (not another dispatch's entries)", await waitFor(page, (id) => document.querySelector("[data-history-scope]")?.getAttribute("data-history-scope") === id && document.querySelector('[data-history-state="empty"]') !== null, 8000, withoutEntries.id))
                await page.evaluate(() => document.querySelector("[data-history-close]")?.click())
                await sleep(300)
            }
            // switching dispatch cards: the dialog scope follows the card that opened it (no stale scope)
            if (withEntries && withoutEntries) {
                await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-history-indicator]`)?.click(), withoutEntries.id)
                await waitFor(page, (id) => document.querySelector("[data-history-scope]")?.getAttribute("data-history-scope") === id, 6000, withoutEntries.id)
                const loadingFirst = await page.evaluate(() => !!document.querySelector('[data-history-state="loading"]') || !!document.querySelector('[data-history-state="empty"]'))
                check("R5: a newly opened history never briefly shows the previous dispatch's entries (loading or its own state first)", loadingFirst)
                await page.evaluate(() => document.querySelector("[data-history-close]")?.click())
                await sleep(300)
            }

            // R8: the established card, no `Reported` label, status from franchise_status
            const labels = await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-row] [data-dispatch-badge]")].map((b) => b.textContent.trim()))
            check("R8: dispatch badges carry only the established labels (Verified / Pending / Need Correction)", labels.length > 0 && labels.every((l) => ["Verified", "Pending", "Need Correction"].includes(l)), [...new Set(labels)].join(", "))
            check("R8: no `Reported` label / pill on any card", !(await exists(page, "[data-reported-pending]")) && !(await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-row] span")].some((s) => /^Reported$/.test(s.textContent.trim())))))
            await L.closeSheet(page)
        }

        // R8 on the Pending tab: a validation-flagged Pending row (mock row index 1: farmer 1002, deployment 1, AZ 2, one
        // err_msg) keeps Pending cards from their own status; the deployment-wide flag is NOT shown in the detail (the API
        // names no dispatch, plot or field for it)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const flagged = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey === "1002-1-2")
        check("the mock's validation-flagged deployment has a dispatch on the Pending tab", !!flagged)
        if (flagged) {
            await L.openRow(page, flagged.index)
            await L.detailLoaded(page)
            await L.expandAllDispatches(page)
            await sleep(500)
            const block = (await L.detailSections(page)).find((b) => b.key === flagged.rowKey)
            // V2.1 (live API audit): validation is PER DISPATCH — never a deployment-level notice; the messages are on the
            // flagged dispatch's own card only
            const placement = await page.evaluate(() => {
                const notices = [...document.querySelectorAll("[data-dispatch-validation-notice]")]
                const outside = [...document.querySelectorAll('[role="dialog"] *')].filter((e) => e.children.length === 0 && /Video is missing/.test(e.textContent) && !e.closest("[data-dispatch-validation-notice]") && !e.closest("[data-dispatch-validation]"))
                return { notices: notices.length, cardsWithNotice: new Set(notices.map((n) => n.closest("[data-dispatch-row]")?.getAttribute("data-dispatch-row"))).size, outside: outside.length }
            })
            check("validation: no deployment-level notice; 'Video is missing' appears only inside a flagged dispatch's own card", !(await exists(page, "[data-system-validation], [data-validation-list], [data-validation-reason]")) && placement.notices >= 1 && placement.cardsWithNotice === placement.notices && placement.outside === 0, JSON.stringify(placement))
            check("validation: within the flagged deployment only the flagged dispatch carries it (its siblings don't)", !!block && block.cards.filter((c) => c.validation).length === 1 && block.cards.length > 1, JSON.stringify(block?.cards.map((c) => [c.dispatchId, c.validation])))
            check("R8: franchise_status = pending + action_required = true → Pending cards from their own status (no fabricated state)", !!block && block.cards.length > 0 && block.cards.every((c) => c.status !== "pending" || c.view === "pending"), JSON.stringify(block?.cards.map((c) => [c.status, c.view])))
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 3. Header NOC / card history: failures and the Pre-Sample disagreement are said, not hidden ───
    {
        const page = await L.open(browser, `${L.V21}?mockFail=noc`, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await sleep(800)
        const actions = await L.headerActions(page)
        check("R4: a failed NOC read is shown as unavailable in the header label (never as 'no NOC')", !!actions.noc && actions.noc.state === "unavailable" && /couldn't be loaded for AZ/.test(actions.noc.label), JSON.stringify(actions.noc))
        const failedStrip = await L.farmerNoc(page)
        check("NOC: the farmer-level strip says the NOC couldn't be loaded (which deployment) and offers Retry", !!failedStrip && failedStrip.readiness === "unavailable" && /couldn't be loaded for \d+ deployments? \(AZ\d/.test(failedStrip.text) && failedStrip.action === "Retry", JSON.stringify(failedStrip))
        const failedReview = (await L.openNocReview(page)) ? await L.nocReview(page) : null
        check("NOC: the review still opens on an available document and says which deployment's NOC couldn't be loaded, with Retry (never 'no NOC')", !!failedReview && failedReview.state === "document" && /couldn't be loaded for \d+ deployments? \(AZ\d/.test(failedReview.statusLine) && failedReview.retry, JSON.stringify(failedReview && [failedReview.state, failedReview.statusLine]))
        await page.evaluate(() => document.querySelector("[data-noc-review] [data-noc-retry]")?.click())
        check("NOC: Retry re-reads the NOC; the review and the strip recover", await waitFor(page, () => !document.querySelector("[data-noc-review] [data-noc-retry]") && document.querySelector("[data-farmer-noc]")?.getAttribute("data-farmer-noc") !== "unavailable", 15000))
        await L.closeNocReview(page)
        await L.closeSheet(page)
        // a farmer without any NOC document (mock farmer 1008): the review opens on a proper empty state, no navigation, no actions
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const noNocRow = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1008-"))
        check("the mock's farmer without a NOC is on the All tab", !!noNocRow)
        if (noNocRow) {
            await L.openRow(page, noNocRow.index)
            await L.detailLoaded(page)
            await sleep(600)
            // the missing-NOC warning: concise (a count and the distinct AZs, no per-deployment labels / dates), and no
            // report action — no API operation reports a NOC that doesn't exist (follow-up fixes report §3)
            const missingStrip = await L.farmerNoc(page)
            check("missing NOC: one concise line — 'NOC missing for n deployments (AZ…). Approval is blocked until the required NOCs are approved.'", !!missingStrip && missingStrip.readiness === "missing" && missingStrip.missing >= 2 && /^NOC missing for \d+ deployments \(AZ\d(, AZ\d)*\)\. Approval is blocked until the required NOCs are approved\.$/.test(missingStrip.text) && !/submitted/.test(missingStrip.text), JSON.stringify(missingStrip))
            const azsInText = (missingStrip?.text.match(/AZ\d/g) ?? [])
            check("missing NOC: each AZ is named once (identical deployment labels are never repeated)", azsInText.length === new Set(azsInText).size, azsInText.join(","))
            check("missing NOC: no report action is offered (none can complete), and no other action when there is no document to view", !!missingStrip && missingStrip.action === null && !(await exists(page, "[data-report-missing-noc]")))
            await L.expandAllDispatches(page)
            await sleep(500)
            const gateLines = await page.evaluate(() => [...document.querySelectorAll('[data-approve-blocker][data-blocker-kind="noc"]')].map((p) => p.textContent.trim()))
            check("missing NOC: the approval gate still blocks each pending dispatch ('No Noc found for this deployment')", gateLines.length > 0 && gateLines.every((t) => /No Noc found for this deployment/.test(t)) && (await page.evaluate(() => [...document.querySelectorAll("[data-approve]")].every((b) => b.disabled))), gateLines[0])
            const empty = (await L.openNocReview(page)) ? await L.nocReview(page) : null
            check("NOC: zero documents → the review shows an explicit 'No NOC found' state with no pager, Report or Approve", !!empty && empty.state === "empty" && /No NOC found/.test(empty.stateText) && empty.pager === null && !empty.approve && !empty.report, JSON.stringify(empty && [empty.state, empty.stateText]))
            await page.evaluate(() => document.querySelector("[data-noc-close]")?.click())
            check("NOC: the empty state closes with its Close button", await waitFor(page, () => !document.querySelector("[data-noc-review]"), 5000))
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }
    // ── 4. A deployment's dispatch count = its dispatch rows in the list (live API audit: trailers_deployed is no longer
    //       sent; each list row is a dispatch). Mock farmer 1002's round-2 AZ 3 deployment is listed with its dispatch
    //       rows, but its dispatch read returns none (the pattern seen on dev) — the detail says so, never "undefined".
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        const unavailableRows = rows.filter((r) => r.rowKey === "1002-2-3")
        check("the list holds the dispatch rows of the deployment whose dispatch read returns none", unavailableRows.length > 0, `${unavailableRows.length} rows`)
        if (unavailableRows.length > 0) {
            await L.openRow(page, unavailableRows[0].index)
            await L.detailLoaded(page)
            await sleep(800)
            const text = await sheetText(page)
            const section = (await L.detailSections(page)).find((s) => s.key === "1002-2-3")
            check("that deployment's section says its dispatches couldn't be loaded (never 'no dispatches', never 'undefined')", !!section && section.empty === "unavailable" && !/undefined/.test(text), JSON.stringify(section && [section.empty, section.cards.length]))
            const scope = await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-scope]")].map((p) => p.textContent.replace(/\s+/g, " ").trim()))
            check("deployments whose read returned all their dispatches show no count line (nothing to explain)", scope.length === 0, scope.join(" | "))
            // the developer diagnostic stays in the Data / API Inspector (Farmer rows → detail sections)
            await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
            await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
            await page.evaluate(() => document.querySelector('[data-inspector-tab="mapping"]')?.click())
            await waitFor(page, () => !!document.querySelector("[data-mapping-rows] [data-count-check]"), 8000)
            const checks = await page.evaluate(() => [...document.querySelectorAll("[data-mapping-rows] [data-count-check]")].map((c) => `${c.getAttribute("data-count-check")}: ${c.textContent.trim()}`))
            const listed = unavailableRows.length
            check("Inspector: the deployment whose read returned none is a mismatch against the dispatch rows the list holds", checks.some((c) => c === `mismatch: ${listed} fewer returned than the list holds`), checks.join(" | "))
            check("Inspector: every other deployment of the farmer matches its list dispatch rows", checks.filter((c) => c.startsWith("match")).length === checks.length - 1, checks.join(" | "))
            await page.keyboard.press("Escape")
            await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }
    {
        const page = await L.open(browser, `${L.V21}?mockFail=history`, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await sleep(800)
        const failed = await page.evaluate(() => document.querySelectorAll('[data-history-indicator="failed"]').length)
        check("R5: a failed history read shows the failed state on that deployment's cards (and only there)", failed > 0 && (await page.evaluate(() => document.querySelectorAll('[data-history-indicator="ready"]').length)) > 0, `${failed} failed clocks`)
        await page.evaluate(() => document.querySelector('[data-history-indicator="failed"]')?.click())
        check("R5: clicking the failed clock re-reads the history; the cards become ready", await waitFor(page, () => document.querySelectorAll('[data-history-indicator="failed"]').length === 0 && !document.querySelector('[data-history-indicator="loading"]'), 15000))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
