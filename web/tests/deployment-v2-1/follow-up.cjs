/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the follow-up fixes: the compact detail header (2), the field / value hierarchy (3), plot
// rows as accordion rows (4), the AZ footer with View all dispatches (5), NOC photo Previous / Next (6), Area / Cal. Area (7 — the
// live API audit's mapping: Area = the deployment's enrolled actual_area, Cal. Area = the dispatch's calculated_area)
// and the dispatch Video field (8). The dispatch-status tabs (1) are in dispatch-table.cjs / check-payloads.mjs.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor, exists } = L

/** The first table row of farmer 1001 (the first mock farmer: five deployments over three AZs) on the current tab. */
const firstFarmerRow = async (page) => (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 2 / 3 / 4 / 8: the header, the field rows, the plot rows, the Video field (default mock) ─────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)

        // 2. compact header: the same content in less height
        const header = await page.evaluate(() => {
            const identity = document.querySelector("[data-detail-identity]")
            const r = (e) => (e ? Math.round(e.getBoundingClientRect().height) : null)
            const close = identity?.querySelector("button")
            const closeBox = close?.getBoundingClientRect(), idBox = identity?.getBoundingClientRect()
            return {
                identity: r(identity), details: r(document.querySelector("[data-farmer-details]")), summary: r(document.querySelector("[data-summary-bar]")),
                avatar: r(identity?.querySelector("span.relative, [class*='h-10']")),
                name: !!document.querySelector('[role="dialog"] h2')?.textContent.trim(),
                location: !!identity?.textContent.includes("Village"),
                closeCentered: !!closeBox && !!idBox && Math.abs((closeBox.top + closeBox.bottom) / 2 - (idBox.top + idBox.bottom) / 2) < 6,
                icons: document.querySelectorAll("[data-summary-bar] [data-header-actions] button").length,
            }
        })
        check("2. the identity band is compact (≤ 72 px; it was 96) and keeps the avatar, name, location and close", header.identity !== null && header.identity <= 72 && header.name && header.location && header.closeCentered, JSON.stringify(header))
        check("2. the details and summary bars are tighter (≤ 36 px / ≤ 64 px; they were 38 / 69) and keep the NOC / Pre-Sample icons", header.details <= 36 && header.summary <= 64 && header.icons >= 2, JSON.stringify(header))

        // 3. field / value hierarchy (Dispatch details and Deployment details share it)
        await L.expandAllDispatches(page)
        await sleep(500)
        await page.evaluate(() => document.querySelector("[data-dispatch-row] [data-plot-toggle]")?.click())
        await sleep(400)
        const type = await page.evaluate(() => {
            const read = (sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); return { size: s.fontSize, weight: s.fontWeight, color: s.color } }
            return {
                dispatchLabel: read("[data-dispatch-details] [data-detail-label]"), dispatchValue: read("[data-dispatch-details] [data-detail-value]"),
                plotLabel: read("[data-plot-details] [data-detail-label]"), plotValue: read("[data-plot-details] [data-detail-value]"),
            }
        })
        check("3. field rows are one step larger (12 px) in Dispatch details and Deployment details alike", ["dispatchLabel", "dispatchValue", "plotLabel", "plotValue"].every((k) => type[k]?.size === "12px"), JSON.stringify(type))
        check("3. labels are secondary (regular, muted), values carry the emphasis (medium, darker) — the same in both lists", type.dispatchLabel?.weight === "400" && type.dispatchValue?.weight === "500" && type.dispatchLabel.color !== type.dispatchValue.color && type.plotLabel?.weight === type.dispatchLabel.weight && type.plotValue?.weight === type.dispatchValue.weight, JSON.stringify(type))

        // 4. plot rows: accordion rows (a bottom divider, no box), the same toggle / keyboard behaviour
        const plotRow = await page.evaluate(() => {
            const c = document.querySelector("[data-plot-card]")
            if (!c) return null
            const s = getComputedStyle(c)
            return { top: s.borderTopWidth, left: s.borderLeftWidth, right: s.borderRightWidth, bottom: s.borderBottomWidth, radius: s.borderTopLeftRadius, last: c === c.parentElement.lastElementChild, listTop: getComputedStyle(c.parentElement).borderTopWidth }
        })
        check("4. a plot row is an accordion row: no top / side borders or rounded box; a divider separates rows", !!plotRow && plotRow.top === "0px" && plotRow.right === "0px" && plotRow.radius === "0px" && plotRow.listTop === "1px" && (plotRow.last || plotRow.bottom === "1px"), JSON.stringify(plotRow))
        const toggled = await page.evaluate(async () => {
            const card = document.querySelector("[data-plot-card]")
            const toggle = card.querySelector("[data-plot-toggle]")
            const before = card.hasAttribute("data-plot-expanded")
            toggle.focus()
            toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
            await new Promise((r) => setTimeout(r, 300))
            const after = card.hasAttribute("data-plot-expanded")
            return { before, after, aria: toggle.getAttribute("aria-expanded"), chevron: !!card.querySelector("[data-plot-chevron]") }
        })
        check("4. the row still expands / collapses from the keyboard (Enter), with aria-expanded and the chevron", toggled.before !== toggled.after && toggled.aria === String(toggled.after) && toggled.chevron, JSON.stringify(toggled))

        // 8. the Video field in Dispatch details: Play when the dispatch has a video, opening the existing player
        const videoRows = await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-row]")].map((c) => ({ id: c.getAttribute("data-dispatch-row"), row: !!c.querySelector('[data-dispatch-details] [data-detail-row="video"]'), play: !!c.querySelector("[data-video-play]"), missing: !!c.querySelector("[data-video-missing]"), header: c.querySelector("[data-dispatch-video]")?.getAttribute("data-dispatch-video") ?? null })))
        check("8. every (AZ 1–3) dispatch has a Video row in Dispatch details, in the Picture row's pattern", videoRows.length > 0 && videoRows.every((v) => v.row && (v.play || v.missing)), JSON.stringify(videoRows.slice(0, 3)))
        check("8. the Video row agrees with the dispatch's own video (the header icon: play ↔ Play, none ↔ Not uploaded)", videoRows.every((v) => (v.header === "play") === v.play && (v.header === "none") === v.missing))
        const withVideo = videoRows.find((v) => v.play)
        if (withVideo) {
            await page.evaluate((id) => document.querySelector(`[data-dispatch-row="${id}"] [data-video-play]`)?.click(), withVideo.id)
            check("8. Play opens the existing video preview", await waitFor(page, () => !!document.querySelector('[role="dialog"] video'), 6000))
            await page.keyboard.press("Escape")
            await sleep(400)
        }
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 8: a dispatch WITHOUT a video (mock row 1002-1-2: its first dispatch has none) ──────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // the table is newest first; the row may be on a later page
        const row = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey === "1002-1-2")
        check("the mock row without a video is listed", !!row)
        if (row) {
            await L.openRow(page, row.index)
            await L.detailLoaded(page)
            await L.expandAllDispatches(page)
            await sleep(600)
            const missing = await page.evaluate(() => [...document.querySelectorAll('[data-farmer-row="1002-1-2"] [data-dispatch-row]')].map((c) => ({ missing: c.querySelector("[data-video-missing]")?.textContent.trim() ?? null, header: c.querySelector("[data-dispatch-video]")?.getAttribute("data-dispatch-video") })))
            check("8. a dispatch without a video shows 'Not uploaded' (the empty-value treatment), never another dispatch's video", missing.some((m) => m.missing === "Not uploaded" && m.header === "none"), JSON.stringify(missing))
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 5: the AZ footer — the dispatches the local filter hides, with View all dispatches ──────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // the table follows the API's order (oldest first on the mock's Pending): the row may be on a later page
        const row = await firstFarmerRow(page)
        check("the first mock farmer has pending dispatches", !!row)
        if (row) {
            await L.openRow(page, row.index)
            await L.detailLoaded(page)
            await sleep(600)
            const filter = await page.evaluate(() => document.querySelector("[data-detail-filter]")?.getAttribute("data-detail-filter"))
            check("5. opened from the Pending tab, the detail's local filter is Pending (the tab decides)", filter === "pending", filter)
            const sections = await page.evaluate(() => [...document.querySelectorAll("[data-az-section]")].map((s) => ({
                code: s.getAttribute("data-az-section"),
                shown: Number(s.querySelector("[data-az-count]")?.getAttribute("data-az-count")),
                total: Number(s.querySelector("[data-az-total]")?.getAttribute("data-az-total")),
                more: s.querySelector("[data-az-more]") ? { n: Number(s.querySelector("[data-az-more]").getAttribute("data-az-more")), text: [...s.querySelector("[data-az-more]").children].map((c) => c.textContent.trim()).join(" "), last: s.lastElementChild === s.querySelector("[data-az-more]") } : null,
            })))
            const hiding = sections.filter((s) => s.total > s.shown)
            check("5. every AZ whose dispatches the filter hides ends with ONE compact line: 'n [more] dispatches in this AZ' + View all dispatches", hiding.length > 0 && hiding.every((s) => s.more && s.more.n === s.total - s.shown && s.more.last && new RegExp(`^${s.total - s.shown} ${s.shown > 0 ? "more " : ""}dispatch(es)? in this AZ View all dispatches$`).test(s.more.text)), JSON.stringify(sections))
            check("5. an AZ with nothing hidden has no footer", sections.filter((s) => s.total === s.shown).every((s) => s.more === null))
            check("5. no verbose 'No dispatches need correction / other dispatches are in All' text anywhere", !(await page.evaluate(() => /No (pending|verified) dispatches|need correction ·|other dispatch(es)? (is|are) in All/i.test(document.querySelector('[role="dialog"]')?.innerText ?? ""))))
            await page.evaluate(() => document.querySelector("[data-az-more] [data-show-all]")?.click())
            const toAll = await waitFor(page, () => document.querySelector("[data-detail-filter]")?.getAttribute("data-detail-filter") === "all", 5000)
            const after = await page.evaluate(() => [...document.querySelectorAll("[data-az-section]")].map((s) => ({ shown: Number(s.querySelector("[data-az-count]")?.getAttribute("data-az-count")), total: Number(s.querySelector("[data-az-total]")?.getAttribute("data-az-total")), more: !!s.querySelector("[data-az-more]") })))
            check("5. View all dispatches switches the detail to All: every dispatch of every AZ is listed, the footers are gone", toAll && after.every((s) => s.shown === s.total && !s.more), JSON.stringify(after))
            // a collapsed AZ hides its footer with its rows
            await page.evaluate(() => { const b = document.querySelector("[data-detail-filter]"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b.click() })
            await waitFor(page, () => !!document.querySelector('[data-filter-option="pending"]'), 4000)
            await page.evaluate(() => document.querySelector('[data-filter-option="pending"]')?.click())
            await sleep(400)
            const code = await page.evaluate(() => document.querySelector("[data-az-more]")?.closest("[data-az-section]")?.getAttribute("data-az-section"))
            if (code) {
                await page.evaluate((c) => document.querySelector(`[data-az-section="${c}"] [data-az-toggle]`)?.click(), code)
                await sleep(300)
                check("5. a collapsed AZ section shows no footer (only its header with the counts)", !(await exists(page, `[data-az-section="${code}"] [data-az-more]`)))
            }
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 6: NOC photos — Previous / Next across several photos of one deployment + AZ (?mockNoc=multi) ─────────
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=multi`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)
        check("6. the review opens directly on a document", (await L.openNocReview(page)) && (await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)))
        const imgSrc = () => page.evaluate(() => document.querySelector('[data-noc-review] img[alt="Preview"]')?.getAttribute("src") ?? null)
        const first = { ...(await L.nocReview(page)), src: await imgSrc() }
        const total = Number((first.pager ?? "0/0").split("/")[1])
        check("6. every photo is its own document: 3 photos per deployment + AZ → 15 documents for the farmer's 5 NOCs", total === 15, first.pager)
        check("6. the first document is a waiting photo, labelled with its photo position ('photo 1 of 3')", first.status !== "approved" && /photo 1 of 3$/.test(first.label) && first.prevDisabled === true, first.label)
        await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
        await sleep(400)
        const second = { ...(await L.nocReview(page)), src: await imgSrc() }
        check("6. Next shows ANOTHER document: new key, new image, the position and the label follow", second.key !== first.key && second.src !== first.src && second.position === `2/${total}` && second.pager === second.position && /photo 2 of 3$/.test(second.label), JSON.stringify({ first: [first.key, first.src, first.position], second: [second.key, second.src, second.position, second.label] }))
        await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
        await sleep(400)
        await page.evaluate(() => document.querySelector("[data-noc-prev]")?.click())
        await sleep(400)
        const back = { ...(await L.nocReview(page)), src: await imgSrc() }
        check("6. Previous goes back: the same document, image and position as before", back.key === second.key && back.src === second.src && back.position === second.position)
        // the action applies to the DISPLAYED document: its deployment + AZ (the API names no single photo)
        const shownLabel = back.label.replace(/^NOC — /, "")
        await page.evaluate(() => document.querySelector("[data-noc-approve]")?.click())
        const toast = await waitFor(page, () => /Noc qualified successfully/.test(document.body.innerText), 8000)
        const toastText = await page.evaluate(() => (document.body.innerText.match(/NOC for [^\n]* approved\./) ?? [""])[0])
        check("6. Approve acts on the displayed document (the toast names its deployment + AZ and photo)", toast && toastText === `NOC for ${shownLabel} approved.`, toastText)
        const moved = await waitFor(page, (k) => { const d = document.querySelector("[data-noc-review]"); const cur = d?.getAttribute("data-noc-current") ?? ""; return !!cur && cur.split(":").slice(0, 2).join(":") !== k.split(":").slice(0, 2).join(":") }, 8000, back.key)
        const next = await L.nocReview(page)
        check("6. after the decision the review moves to a document of ANOTHER deployment / AZ (the decision covered every photo of this one), still waiting", moved && !!next && next.status !== "approved", JSON.stringify(next && [next.key, next.status, next.position]))
        await waitFor(page, () => [...document.querySelectorAll("[data-farmer-noc]")].some((s) => Number(s.getAttribute("data-noc-undecided")) <= 6), 10000)
        const strip = await L.farmerNoc(page)
        check("6. the three photos of that deployment + AZ are approved together (the strip: 3 fewer waiting)", !!strip && strip.undecided === 6, JSON.stringify(strip))
        await L.closeNocReview(page)
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 7: Area / Cal. Area — Deployment V2's meanings on the dispatch-grain list (live API audit, 2026-10-11) ──────
    //   Area      = actual_area: the deployment's ENROLLED area — the same on every dispatch of the deployment
    //   Cal. Area = calculated_area: THIS dispatch's calculated area — from the API, not from saved boundaries
    // (Before: Area showed Σ plot area — the calculated area — and Cal. Area recomputed it from saved boundaries, so it
    // was "-" on 34 of 40 live dispatches that had a value.)
    for (const variant of ["", "?mockBoundaries=seed"]) {
        const page = await L.open(browser, `${L.V21}${variant}`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const label = variant ? "seeded boundaries" : "no saved boundaries"
        const cells = await page.evaluate(() => {
            const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim())
            const ia = heads.indexOf("Area"), ic = heads.indexOf("Cal. Area")
            return {
                position: ic === ia + 1,
                rows: [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]")).map((tr) => ({
                    id: tr.querySelector("[data-dispatch-cell]")?.getAttribute("data-dispatch-cell"),
                    rowKey: tr.querySelector("[data-row-key]")?.getAttribute("data-row-key"),
                    areaText: tr.children[ia]?.textContent.trim(), area: tr.children[ia]?.querySelector('[data-cell="area"]')?.getAttribute("data-value") ?? null,
                    calText: tr.children[ic]?.textContent.trim(), cal: tr.children[ic]?.querySelector('[data-cell="cal-area"]')?.getAttribute("data-value") ?? null,
                    calCls: tr.children[ic]?.querySelector('[data-cell="cal-area"]')?.className ?? "",
                    plots: Number(tr.querySelector('[data-cell="plots"]')?.getAttribute("data-value") ?? 0),
                    boundaries: Number(tr.querySelector("[data-dispatch-boundaries]")?.getAttribute("data-dispatch-boundaries") ?? 0),
                })),
            }
        })
        const rows = cells.rows
        if (!variant) check("7. Cal. Area sits right after Area, as in Deployment V2", cells.position)
        const byGroup = rows.reduce((m, r) => m.set(r.rowKey, [...(m.get(r.rowKey) ?? []), r]), new Map())
        const multi = [...byGroup.values()].filter((list) => list.length > 1)
        check(`7. (${label}) Area is the deployment's enrolled area: identical on every dispatch of a deployment`, multi.length > 0 && multi.every((list) => new Set(list.map((r) => r.area)).size === 1), `${multi.length} multi-dispatch deployments`)
        check(`7. (${label}) Cal. Area is per dispatch: dispatches of one deployment can differ`, multi.some((list) => new Set(list.map((r) => r.cal)).size > 1))
        check(`7. (${label}) enrolled and calculated areas are different fields with different values (not one copied into the other)`, rows.filter((r) => r.area !== null && r.cal !== null && r.area !== r.cal).length > rows.length / 2, `${rows.filter((r) => r.area !== r.cal).length} of ${rows.length} differ`)
        check(`7. (${label}) Cal. Area is shown for every dispatch the API gives one — whether or not its boundaries are saved`, rows.length > 0 && rows.every((r) => r.cal !== null) && rows.some((r) => r.plots > 0 && r.boundaries < r.plots && Number(r.cal) > 0), JSON.stringify(rows.filter((r) => r.cal === null).slice(0, 2)))
        check(`7. (${label}) the format: V2's text-sm, rounded to 2 decimals; a 0 the API sends shows 0 (a dispatch without plots)`, rows.every((r) => r.calText === String(Math.round(Number(r.cal) * 100) / 100) && /text-sm/.test(r.calCls)) && rows.filter((r) => r.plots === 0).every((r) => r.calText === "0"), JSON.stringify(rows.slice(0, 2)))
        if (variant) {
            // the same dispatch carries the same Cal. Area with or without saved boundaries (it is the API's, not derived)
            check("7. Cal. Area doesn't change when boundaries are saved (seeded == unseeded for the same dispatch)", JSON.stringify(rows.map((r) => [r.id, r.cal])) === JSON.stringify(globalThis.__calUnseeded ?? []), `${rows.length} rows compared`)
        } else {
            globalThis.__calUnseeded = rows.map((r) => [r.id, r.cal])
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── narrow viewport: the header and a card at 768 px ────────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await page.setViewport({ width: 768, height: 900 })
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)
        const narrow = await page.evaluate(() => {
            const sheet = document.querySelector("[data-summary-bar]")?.closest('[role="dialog"]')?.getBoundingClientRect()
            const close = document.querySelector("[data-detail-identity] button")?.getBoundingClientRect()
            const overflow = [...document.querySelectorAll("[data-detail-identity], [data-farmer-details], [data-summary-bar], [data-farmer-noc]")].some((e) => e.scrollWidth > e.clientWidth + 1)
            return { sheetW: sheet ? Math.round(sheet.width) : null, closeInside: !!close && !!sheet && close.right <= sheet.right && close.left >= sheet.left, overflow }
        })
        check("narrow (768 px): the header fits the sheet — the close button inside, no band overflowing", narrow.closeInside && !narrow.overflow, JSON.stringify(narrow))
        await L.screenshot(page, "follow-up-narrow-768.png")
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    note("screenshots", L.OUT)
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
