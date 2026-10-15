/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — Previous / Next across table pages while the farmer detail stays open (page.tsx: the
// table's own load more, triggered from the detail; components/deployment-detail-sheet.tsx: the footer). The mock's All
// tab: 87 dispatch rows, 20 per page, 8 farmers (3 on page 1). Checked:
//   - opening a farmer among the last 3 loaded loads the next page in the background, once; the counter grows ("n / m+"),
//     the same farmer stays selected, the detail isn't remounted and its state (expanded dispatches) is kept;
//   - a farmer earlier than the last 3 loads nothing; Next into the last 3 does;
//   - Next at the last loaded farmer while that page is in flight (?mockPages=slow): a loading state on the footer's own
//     row (no layout shift), rapid clicks ask once, and the detail moves on when the farmer arrives;
//   - Next walks every farmer across all pages, each once (farmers repeated across dispatches are one entry), and is
//     disabled only at the server's end (the counter loses its "+");
//   - a failed page (?mockFail=page): quiet while farmers remain, an error with Retry at the last loaded farmer; Retry
//     loads it with the detail open and the selection kept;
//   - the next page keeps the tab, the sort and the filters (Pending, a header-menu sort — the trace's request bodies);
//   - a tab change while a page is in flight: the old query's page never lands in the new result set;
//   - an overlay opened over the detail (the boundary editor, with an unsaved edit) drops a pending Next — the page
//     arriving never switches farmers under it (?mockPages=slower, ?mockBoundaries=seed);
//   - Deployment V2 Oct 26 loads nothing in the background while its detail is open.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const LIST = "/adminFarmApp/v4/getDeploymentMetadata"
const grain = (page) => page.evaluate(() => { const g = document.querySelector("[data-dispatch-grain]"); return { rows: Number(g?.getAttribute("data-dispatch-rows")), total: Number(g?.getAttribute("data-dispatch-total")) } })
const nav = (page) => page.evaluate(() => {
    const next = document.querySelector("[data-next-farmer]")
    const counter = document.querySelector("[data-nav-counter]")
    const footer = counter?.closest(".border-t")?.getBoundingClientRect()
    const nb = next?.getBoundingClientRect()
    return {
        open: !!document.querySelector("[data-summary-bar]"), farmer: document.querySelector("[data-map-farmer]")?.getAttribute("data-map-farmer") ?? null,
        counter: counter?.textContent.trim() ?? null, more: counter?.hasAttribute("data-nav-more") ?? false,
        status: document.querySelector("[data-nav-status]")?.getAttribute("data-nav-status") ?? null, statusText: document.querySelector("[data-nav-status]")?.textContent.trim() ?? "",
        nextDisabled: next?.disabled ?? null, nextBusy: next?.getAttribute("aria-busy") === "true",
        footer: footer ? Math.round(footer.height) : null, nextBox: nb ? [Math.round(nb.left), Math.round(nb.top), Math.round(nb.width), Math.round(nb.height)].join(",") : null,
    }
})
const farmersInTable = async (page) => [...new Set((await L.dispatchRows(page)).filter((r) => r.rowKey).map((r) => r.rowKey.split("-")[0]))]
async function openFarmer(page, farmerId) {
    const row = (await L.dispatchRows(page)).find((r) => r.rowKey?.startsWith(`${farmerId}-`))
    await L.openRow(page, row.index)
    await L.detailLoaded(page)
}
const clickNext = (page) => page.evaluate(() => { const b = document.querySelector("[data-next-farmer]"); if (!b || b.disabled) return false; b.click(); return true })
/** The list request bodies (oldest first) as the trace records them — the farmer reads (farmer_ids) left out. */
async function listBodies(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const bodies = await page.evaluate(async (path) => {
        const out = []
        for (const e of document.querySelectorAll(`[data-trace-entry][data-trace-path="${path}"]`)) {
            e.querySelector("button")?.click()
            await new Promise((r) => setTimeout(r, 30))
            const text = (e.querySelector("[data-trace-details]")?.textContent ?? "").split("Response body")[0].replace(/^Request body/, "").replace(/\s+/g, "")
            if (!/"farmer_ids"/.test(text)) out.push(text)
        }
        return out.reverse()
    }, LIST)
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return bodies
}
const pageOf = (body) => Number(/"page":(\d+)/.exec(body)?.[1] ?? 0)
const withoutPage = (body) => body.replace(/"page":\d+,?/, "")
async function allTab(browser, query, errors) {
    const page = await L.open(browser, `${L.V21}${query}`, errors)
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    return page
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    const done = async (page) => { blocked.push(...page.blockedApi); await page.close() }

    // ── 1–3, 5: background prefetch near the end; counter; selection, mount and state kept ─────────────────────────
    {
        const page = await allTab(browser, "?mockPages=slower", errors)
        const page1 = await farmersInTable(page)
        await openFarmer(page, page1[1]) // the 2nd of 3 loaded: among the last 3
        await page.evaluate(() => { window.__summary = document.querySelector("[data-summary-bar]") })
        await L.expandAllDispatches(page)
        await sleep(300)
        const expanded = await page.evaluate(() => document.querySelectorAll("[data-dispatch-body]").length)
        const before = await nav(page)
        await waitFor(page, () => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > 20, 15000)
        await sleep(800)
        const after = await nav(page)
        const kept = await page.evaluate(() => ({ same: window.__summary === document.querySelector("[data-summary-bar]"), expanded: document.querySelectorAll("[data-dispatch-body]").length }))
        check("1. opening a farmer among the last 3 loaded loads the next page in the background (20 → 40 rows), the detail open", (await grain(page)).rows === 40 && after.open, JSON.stringify({ grain: await grain(page) }))
        check("3. the counter takes the new farmers and says more may follow ('2 / 3+' → '2 / 5+')", before.counter === "2 / 3+" && after.counter === "2 / 5+" && after.more, JSON.stringify({ before: before.counter, after: after.counter }))
        check("5. the selected farmer stays selected; the detail isn't remounted and keeps its expanded dispatches", after.farmer === page1[1] && kept.same && kept.expanded === expanded && expanded > 0, JSON.stringify({ farmer: after.farmer, kept, expanded }))
        await sleep(10500)
        check("2. no further page while the selection is earlier than the last 3 loaded (repeated renders ask nothing)", (await grain(page)).rows === 40)
        await L.closeSheet(page)
        // reopen the first farmer: 5 loaded, index 0 → nothing; Next twice → index 2 of 5 → page 3
        await openFarmer(page, page1[0])
        await sleep(2000)
        const quiet = (await grain(page)).rows
        await clickNext(page); await L.detailLoaded(page)
        await sleep(2000)
        const stillQuiet = (await grain(page)).rows
        const quietStatus = (await nav(page)).status
        await clickNext(page); await L.detailLoaded(page)
        await waitFor(page, () => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > 40, 15000)
        check("1. a farmer before the last 3 loads nothing; Next into the last 3 loads the next page — quietly (no message while farmers remain)", quiet === 40 && stillQuiet === 40 && quietStatus === "idle" && (await grain(page)).rows === 60, JSON.stringify({ quiet, stillQuiet, quietStatus, now: await grain(page) }))
        await L.closeSheet(page)
        const bodies = await listBodies(page)
        const later = bodies.map(pageOf).filter((n) => n > 1)
        check("2. each later page was asked for once (2, 3)", later.join(",") === "2,3", bodies.map(pageOf).join(","))
        await done(page)
    }

    // ── 2, 4: Next at the last loaded farmer while the page is in flight; rapid clicks ──────────────────────────────
    {
        const page = await allTab(browser, "?mockPages=slower", errors)
        const page1 = await farmersInTable(page)
        await openFarmer(page, page1[1]) // among the last 3: its page 2 starts now (9 s)
        const idle = await nav(page)
        await clickNext(page); await L.detailLoaded(page) // the last loaded farmer, page 2 still in flight
        const atEnd = await nav(page)
        for (let i = 0; i < 5; i++) { await clickNext(page); await sleep(60) }
        await sleep(200)
        const waiting = await nav(page)
        check("4. at the last loaded farmer while the next page is in flight: 'Loading more farmers…' and a spinner on Next, on the footer's own row (no layout shift)",
            idle.status === "idle" && atEnd.farmer === page1[2] && atEnd.status === "loading" && atEnd.nextBusy && /Loading more farmers/.test(atEnd.statusText) && atEnd.footer === idle.footer && atEnd.nextBox === idle.nextBox && !atEnd.nextDisabled,
            JSON.stringify({ idle, atEnd }))
        check("4. Next pressed there (five times, rapidly) waits: the farmer stays, still loading", waiting.farmer === page1[2] && waiting.status === "loading" && waiting.counter === "3 / 3+", JSON.stringify(waiting))
        await waitFor(page, (f) => document.querySelector("[data-map-farmer]")?.getAttribute("data-map-farmer") !== f, 15000, page1[2])
        await L.detailLoaded(page)
        const moved = await nav(page)
        const page2Farmer = (await farmersInTable(page))[3]
        check("4. …and moves on to the first farmer of the new page once it arrives (one step, not five)", moved.farmer === page2Farmer && moved.counter === "4 / 5+" && moved.status === "idle", JSON.stringify({ moved, page2Farmer }))
        await L.closeSheet(page)
        const pages = (await listBodies(page)).map(pageOf)
        check("2. five rapid Next clicks asked for page 2 once", pages.filter((p) => p === 2).length === 1, pages.join(","))
        await done(page)
    }

    // ── 6, 7, 11: every farmer across every page, once each; Next disabled only at the end ───────────────────────────
    {
        const page = await allTab(browser, "", errors)
        const first = (await farmersInTable(page))[0]
        await openFarmer(page, first)
        const visited = [first]
        const counters = []
        for (let i = 0; i < 20; i++) {
            const n = await nav(page)
            counters.push(n.counter)
            if (n.nextDisabled) break
            const from = n.farmer
            await clickNext(page)
            await waitFor(page, (f) => { const now = document.querySelector("[data-map-farmer]")?.getAttribute("data-map-farmer"); return !!now && now !== f }, 15000, from)
            await L.detailLoaded(page)
            visited.push((await nav(page)).farmer)
        }
        const end = await nav(page)
        const g = await grain(page)
        await L.closeSheet(page)
        const all = await farmersInTable(page)
        check("6. Next walks across every page with the detail open (20 → 87 rows)", g.rows === g.total && g.total === 87 && end.open !== false, JSON.stringify({ g, counters }))
        check("11. each farmer once, in list order — farmers on several dispatches / pages are one entry", visited.length === all.length && new Set(visited).size === visited.length && visited.join(",") === all.join(","), JSON.stringify({ visited, all }))
        check("7. Next is disabled only at the true end; the counter there has no '+'", end.nextDisabled === true && end.counter === `${all.length} / ${all.length}` && !end.more && counters.slice(0, -1).every((c) => /\+$/.test(c) || c.endsWith(` / ${all.length}`)), JSON.stringify({ end, counters }))
        await done(page)
    }

    // ── 8: a failed page — quiet while farmers remain, Retry at the last loaded farmer ───────────────────────────────
    {
        const page = await allTab(browser, "?mockFail=page", errors)
        const page1 = await farmersInTable(page)
        await openFarmer(page, page1[0])
        await sleep(1500)
        const quiet = await nav(page)
        await clickNext(page); await L.detailLoaded(page)
        await clickNext(page); await L.detailLoaded(page)
        await sleep(800)
        const failed = await nav(page)
        check("8. the page fails: no message while farmers remain to navigate; at the last loaded one 'Couldn't load more farmers.' + Retry, the detail open, the farmer kept, Next still possible",
            quiet.status === "idle" && failed.status === "error" && /Couldn.t load more farmers/.test(failed.statusText) && failed.open && failed.farmer === page1[2] && failed.nextDisabled === false && (await grain(page)).rows === 20,
            JSON.stringify({ quiet, failed }))
        await page.evaluate(() => document.querySelector("[data-nav-retry]")?.click())
        await waitFor(page, () => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > 20, 10000)
        await sleep(600)
        const retried = await nav(page)
        await clickNext(page)
        await waitFor(page, (f) => document.querySelector("[data-map-farmer]")?.getAttribute("data-map-farmer") !== f, 10000, page1[2])
        await L.detailLoaded(page)
        const onward = await nav(page)
        check("8. Retry loads the page without closing the detail; the selection holds, then Next continues to the new page's farmer", retried.status === "idle" && retried.farmer === page1[2] && /^3 \/ \d+\+$/.test(retried.counter) && Number(retried.counter.split("/ ")[1].replace("+", "")) > 3 && onward.counter.startsWith("4 / ") && onward.farmer !== page1[2], JSON.stringify({ retried, onward }))
        await done(page)
    }

    // ── 9: the next page keeps the tab, the sort and the filters ─────────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await page.evaluate(() => { const b = document.querySelector('[data-column-menu="farmer"]'); b?.scrollIntoView({ inline: "center", block: "nearest" }); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() })
        await waitFor(page, () => [...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.trim() === "Desc"), 4000)
        await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim() === "Desc")?.click())
        await sleep(1200)
        await L.dispatchRowsLoaded(page)
        const farmers = await farmersInTable(page)
        await openFarmer(page, farmers[farmers.length - 1])
        await waitFor(page, () => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > 20, 10000)
        await L.closeSheet(page)
        const bodies = await listBodies(page)
        const p1 = bodies.filter((b) => pageOf(b) === 1).pop(), p2 = bodies.find((b) => pageOf(b) === 2)
        check("9. the background page keeps the tab (pending), the sort (farmer_name desc) and the filters — only the page differs",
            !!p1 && !!p2 && withoutPage(p1) === withoutPage(p2) && /"status":"pending"/.test(p2) && /"sort_by":"farmer_name"/.test(p2) && /"sort_order":"desc"/.test(p2), JSON.stringify({ p1, p2 }))
        await done(page)
    }

    // ── 10: a tab change while a page is in flight ───────────────────────────────────────────────────────────────────
    {
        const page = await allTab(browser, "?mockPages=slow", errors)
        const page1 = await farmersInTable(page)
        await openFarmer(page, page1[2]) // its page 2 is in flight for 2.5 s
        await L.closeSheet(page)
        await L.selectTab(page, "Pending")
        await sleep(4000)
        const g = await grain(page)
        const statuses = [...new Set((await L.dispatchRows(page)).map((r) => r.rowStatus))]
        check("10. the All tab's page landing after a switch to Pending never joins Pending's rows (page 1 only, all pending)", g.rows === 20 && statuses.join(",") === "pending" && g.total < 87, JSON.stringify({ g, statuses }))
        await done(page)
    }

    // ── 12: an overlay with unsaved edits drops a pending Next ───────────────────────────────────────────────────────
    {
        const page = await allTab(browser, "?mockPages=slower&mockBoundaries=seed", errors)
        const page1 = await farmersInTable(page)
        await openFarmer(page, page1[2]) // the last loaded: page 2 in flight for 9 s
        await L.expandAllDispatches(page)
        await sleep(600)
        const plot = await page.evaluate(() => document.querySelector('[data-plot-card][data-plot-location="valid"]')?.getAttribute("data-plot-card"))
        await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), plot)
        await waitFor(page, () => !!document.querySelector("[data-edit-boundary]"), 10000)
        await clickNext(page) // pending: waits for page 2
        const pending = await nav(page)
        await page.evaluate(() => document.querySelector("[data-edit-boundary]")?.click())
        await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
        await sleep(1500)
        await page.evaluate(() => document.querySelector("[data-boundary-redraw]")?.click()) // an unsaved edit: redraw, then 3 points
        await sleep(400)
        const c = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
        for (const [dx, dy] of [[-80, -50], [80, -50], [80, 50]]) { await page.mouse.click(c.x + dx, c.y + dy); await sleep(500) }
        const edited = await page.evaluate(() => ({ shape: document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-shape") ?? "", mode: document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") }))
        await waitFor(page, () => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > 20, 15000)
        await sleep(1500)
        const after = await page.evaluate(() => ({ editor: !!document.querySelector("[data-boundary-editor]"), shape: document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-shape") ?? "", mode: document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode"), farmer: document.querySelector("[data-map-farmer]")?.getAttribute("data-map-farmer") }))
        check("12. a pending Next is dropped when the boundary editor opens: the page arrives (20 → 40) and the editor stays, its unsaved edit intact, on the same farmer",
            pending.status === "loading" && edited.shape.split(";").length === 3 && after.editor && after.shape === edited.shape && after.mode === edited.mode && after.farmer === page1[2] && !!plot, JSON.stringify({ pending: pending.status, edited, after }))
        await page.evaluate(() => document.querySelector("[data-boundary-cancel]")?.click())
        await sleep(600)
        await page.evaluate(() => [...document.querySelectorAll('[role="alertdialog"] button, [role="dialog"] button')].find((b) => /^discard/i.test(b.textContent.trim()))?.click())
        await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 6000)
        const back = await nav(page)
        check("12. …and after the editor is closed, the farmer is still the same, Next free to use", back.farmer === page1[2] && back.status === "idle" && back.nextDisabled === false, JSON.stringify(back))
        await done(page)
    }

    // ── 14: Deployment V2 Oct 26 and the original Deployment page unchanged ─────────────────────────────────────────
    {
        const changed = require("child_process").execSync("git status --porcelain -- src/app/layouts/deployment-v2-oct-26 src/app/layouts/deployment", { cwd: require("path").join(__dirname, "..", "..") }).toString().trim()
        const page = await L.open(browser, L.V2, errors)
        await L.rowsLoaded(page)
        await L.openV2Row(page, 0)
        await sleep(1500)
        const v2 = await page.evaluate(() => ({ counter: [...document.querySelectorAll('[role="dialog"] span')].map((s) => s.textContent.trim()).find((t) => /^\d+ \/ \d+$/.test(t)) ?? null, newHooks: !!document.querySelector("[data-nav-counter], [data-nav-status]") }))
        check("14. Deployment V2 Oct 26 and the original Deployment page: no file changed; V2's detail keeps its own 'n / m' footer, without V2.1's paging hooks", changed === "" && !!v2.counter && !v2.newHooks, JSON.stringify({ changed, v2 }))
        await done(page)
    }

    const relevant = L.relevantErrors(errors).filter((e) => !/next page could not be loaded \(mock failure\)/.test(e))
    check("no page errors (the mock's deliberate page failure aside)", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
