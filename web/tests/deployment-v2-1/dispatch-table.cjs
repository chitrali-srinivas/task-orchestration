/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the dispatch-level table on the live list contract (live API audit, 2026-10-11:
// getDeploymentMetadata returns one row per dispatch; its status filter, paging and getDeploymentStatusCounts are per
// dispatch). Each tab sends its status to the server and shows the server's dispatch count; a table row is a list row;
// pages are deduplicated by dispatch id; the Boundaries column reads once per deployment group; counts that can't be
// read are shown as unavailable; a row opens its FARMER's detail with one section per deployment group (never one per
// dispatch row) and the dispatch revealed. Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor } = L

const grain = (page) => page.evaluate(() => {
    const n = document.querySelector("[data-dispatch-grain]")
    if (!n) return null
    const num = (a) => Number(n.getAttribute(a))
    const status = document.querySelector("[data-dispatch-grain-notice]")
    return { rows: num("data-dispatch-rows"), total: num("data-dispatch-total"), withoutId: num("data-rows-without-id"), flagged: num("data-rows-flagged"), boundaryFailures: num("data-boundary-failures"), countsUnavailable: n.getAttribute("data-counts-unavailable") === "true", statusText: status?.textContent.replace(/\s+/g, " ").trim() ?? "", retry: !!status?.querySelector("[data-notice-retry]") }
})
const tabText = (page, name) => page.evaluate((n) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(n))?.querySelector("span")?.textContent.trim() ?? "", name)
const headerCells = (page) => page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => ({ title: th.textContent.replace(/\s+/g, " ").trim(), sortable: !!th.querySelector("button") })))
const farmerName = (page) => page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent.trim() ?? "")

/** The Inspector's trace: each table-page request's status / page (newest first) and the dispatch-read count. */
async function trace(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const out = await page.evaluate(async () => {
        const lists = []
        for (const e of document.querySelectorAll('[data-trace-entry][data-trace-path="/adminFarmApp/v4/getDeploymentMetadata"]')) {
            e.querySelector("button")?.click()
            await new Promise((r) => setTimeout(r, 40))
            const text = e.querySelector("[data-trace-details]")?.textContent ?? ""
            const farmerRead = /"farmer_ids"/.test(text)
            lists.push({ status: (text.match(/"status":\s*"([a-z_]+)"/) ?? [])[1] ?? null, page: Number((text.match(/"page":\s*(\d+)/) ?? [])[1] ?? 0), farmerRead })
        }
        return { lists, trailerReads: document.querySelectorAll('[data-trace-entry][data-trace-path="/adminDeploymentSec/v3/getTrailerDetails"]').length }
    })
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return { ...out, tablePages: out.lists.filter((l) => !l.farmerRead) }
}

/** Scrolls the table until every row of the query is loaded (or `max` scrolls). */
async function loadAll(page, max = 10) {
    for (let i = 0; i < max; i++) {
        const g = await grain(page)
        if (g && g.rows >= g.total) return true
        await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 50 && d.querySelector("table")); if (s) s.scrollTop = s.scrollHeight })
        await waitFor(page, (before) => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > before, 8000, g?.rows ?? 0)
        await sleep(300)
    }
    const g = await grain(page)
    return !!g && g.rows >= g.total
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1. Tabs = the server's status filter; counts = the server's dispatch counts ───────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        check("rows load", await L.rowsLoaded(page))
        check("the rows' Boundaries values settle (one read per deployment group)", await L.dispatchRowsLoaded(page))
        const counts = {}
        for (const tab of ["All", "Verified", "Pending", "Need Correction"]) counts[tab] = await tabText(page, tab)
        const n = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)]))
        check("every tab shows the server's dispatch count — a number, never 'n+'", Object.values(counts).every((v) => /^\d+$/.test(v)), JSON.stringify(counts))
        check("the counts are dispatch counts of one dataset: All = Verified + Pending + Need Correction", n.All === n.Verified + n.Pending + n["Need Correction"], JSON.stringify(n))
        let rows = (await L.dispatchRows(page)).filter((r) => r.id)
        let g = await grain(page)
        check("Verified (default): a page of the server's approved dispatches, each row its own dispatch id", rows.length > 0 && rows.length <= 20 && rows.every((r) => r.status === "approved") && new Set(rows.map((r) => r.id)).size === rows.length, `${rows.length} rows`)
        check("Verified: the tab count IS the server's total for the tab (pagination.total)", g.total === n.Verified, `tab ${n.Verified} · total ${g.total}`)
        let t = await trace(page)
        check("Verified: the list request carries status 'approved' (the server filters; nothing is filtered in the browser)", t.tablePages[0]?.status === "approved", JSON.stringify(t.tablePages.slice(0, 3)))
        for (const [tab, status, sent] of [["All", null, "all"], ["Pending", "pending", "pending"], ["Need Correction", "rejected", "need_correction"]]) {
            await L.selectTab(page, tab)
            await L.dispatchRowsLoaded(page)
            rows = (await L.dispatchRows(page)).filter((r) => r.id)
            g = await grain(page)
            t = await trace(page)
            check(`${tab}: the list request carries status '${sent}', page 1`, t.tablePages[0]?.status === sent && t.tablePages[0]?.page === 1, JSON.stringify(t.tablePages[0]))
            check(`${tab}: ${status ? `only dispatches whose own status is ${status}` : "dispatches of every status"}; ids unique`, rows.length > 0 && (status === null || rows.every((r) => r.status === status)) && new Set(rows.map((r) => r.id)).size === rows.length, [...new Set(rows.map((r) => r.status))].join(","))
            check(`${tab}: the tab count is the server's total for the tab`, g.total === n[tab], `tab ${n[tab]} · total ${g.total}`)
            if (status) check(`${tab}: each row's list status matches its dispatch status (need_correction = rejected)`, rows.every((r) => r.rowStatus === (status === "rejected" ? "need_correction" : status)))
        }
        // Need Correction is small: every row on one page — the table needs no extra list pages and no per-row reads to fill it
        const nc = (await L.dispatchRows(page)).filter((r) => r.id)
        check("Need Correction: every dispatch of the tab on the first page (count = rows)", nc.length === n["Need Correction"], `${nc.length} rows / ${n["Need Correction"]}`)

        // Mixed statuses in one deployment (farmer · round · AZ): its dispatches appear under their own statuses
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        check("All: every page loads by scrolling (rows = the server's total)", await loadAll(page))
        const all = (await L.dispatchRows(page)).filter((r) => r.id)
        check("pagination: no dispatch repeats across pages (ids unique over every loaded page)", new Set(all.map((r) => r.id)).size === all.length && all.length === n.All, `${all.length} rows, ${new Set(all.map((r) => r.id)).size} unique, total ${n.All}`)
        const byGroup = all.reduce((m, r) => m.set(r.rowKey, [...(m.get(r.rowKey) ?? []), r.status]), new Map())
        const mixed = [...byGroup.values()].filter((statuses) => new Set(statuses).size > 1)
        check("a deployment with dispatches of different statuses lists each dispatch under its own status", mixed.length > 0, `${mixed.length} mixed deployments`)
        check("the tab counts match the loaded All rows by status", ["approved", "pending", "rejected"].every((s, i) => all.filter((r) => r.status === s).length === [n.Verified, n.Pending, n["Need Correction"]][i]))
        // switching tabs starts the new tab from its first page
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const pendingFirst = (await L.dispatchRows(page)).filter((r) => r.id)
        g = await grain(page)
        check("a tab change re-queries from page 1: the Pending tab shows its first page only, all pending", pendingFirst.length <= 20 && pendingFirst.every((r) => r.status === "pending") && g.total === n.Pending, `${pendingFirst.length} rows`)

        // the columns
        const heads = await headerCells(page)
        const sortable = heads.filter((h) => h.sortable).map((h) => h.title), fixed = heads.filter((h) => !h.sortable).map((h) => h.title)
        // every column has a header menu (column-capabilities.cjs; table-order.cjs checks each one's items): Filter / Asc /
        // Desc where the API supports them, Hide column on all — Dispatch ID and Boundaries offer Hide column only
        check("every column has a header menu (Dispatch ID and Boundaries too — Hide column only)", ["Submitted on", "Dispatch ID", "Farmer", "Village", "Plots", "Boundaries", "Area", "Cal. Area", "AZ code", "AZ name", "Deployed", "Status", "Surveyor"].every((x) => sortable.includes(x)) && fixed.length === 0, `menus: ${sortable.join(", ")}`)
        // read the Pending rows again once their Boundaries reads have settled (the rows read above were captured right
        // after the tab change, while the new page's groups — not read on the All tab — could still be loading)
        await L.dispatchRowsLoaded(page)
        const pendingNow = (await L.dispatchRows(page)).filter((r) => r.id)
        // the mock's deployment whose dispatch read returns none (mock-backend.ts UNAVAILABLE_ROW, "1002-2-3"; ui-refinements.cjs)
        // correctly says its dispatches aren't in the read; every other dispatch shows saved / plots
        const UNAVAILABLE_GROUP = "1002-2-3"
        const notOk = pendingNow.filter((r) => r.rowKey === UNAVAILABLE_GROUP ? r.boundariesState !== "not-in-read" : !(r.boundariesState === "ok" && r.boundaries <= r.plots))
        check("Boundaries shows saved / plots for each dispatch (\"not in the read\" for the deployment whose read returns none)", pendingNow.length > 0 && notOk.length === 0, JSON.stringify(notOk.slice(0, 3).map((r) => ({ id: r.id, group: r.rowKey, state: r.boundariesState, boundaries: r.boundaries, plots: r.plots }))))
        // sorting (the server sorts; the mock data source sorts the person columns by name, as the v4 sort_by does)
        const sortBy = async (title, dir) => {
            await page.evaluate((x) => { const b = [...document.querySelectorAll("thead th button")].find((y) => y.textContent.replace(/\s+/g, " ").trim() === x); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() }, title)
            const opened = await waitFor(page, () => [...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.trim() === "Asc"), 4000)
            if (opened) await page.evaluate((d) => [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim() === d)?.click(), dir)
            await sleep(1200)
            await L.dispatchRowsLoaded(page)
            return opened
        }
        const namesIn = (title) => page.evaluate((x) => {
            const i = [...document.querySelectorAll("thead th")].findIndex((th) => th.textContent.replace(/\s+/g, " ").trim() === x)
            return [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]")).map((tr) => tr.children[i]?.querySelector(".text-sm")?.textContent.trim() ?? "")
        }, title)
        for (const [title, field] of [["Farmer", "farmer_name"], ["Surveyor", "surveyor_name"]]) {
            const openedAsc = await sortBy(title, "Asc")
            const asc = [...new Set(await namesIn(title))]
            await sortBy(title, "Desc")
            const desc = [...new Set(await namesIn(title))]
            const inOrder = (list, sign) => list.every((v, i) => i === 0 || Math.sign(list[i - 1].localeCompare(v, undefined, { numeric: true, sensitivity: "base" })) !== sign)
            check(`sorting by ${title}: Asc ascending, Desc descending by name (live: sort_by ${field})`, openedAsc && asc.length > 1 && asc[0] !== desc[0] && inOrder(asc, 1) && inOrder(desc, -1), `${asc.join(" < ")} | ${desc.join(" > ")}`)
        }
        await page.keyboard.press("Escape")
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. Request accounting: a tab needs its list page + counts; the Boundaries column one read per deployment ─────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        const visitedGroups = new Set((await L.dispatchRows(page)).filter((r) => r.id).map((r) => r.rowKey)) // the default Verified page
        await L.selectTab(page, "Need Correction")
        await L.dispatchRowsLoaded(page)
        await sleep(800)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        for (const r of rows) visitedGroups.add(r.rowKey)
        const t = await trace(page)
        const ncPages = t.tablePages.filter((l) => l.status === "need_correction")
        check("Need Correction: one list request fills the tab (no further pages, no client-side filtering)", ncPages.length === 1, JSON.stringify(ncPages))
        // each deployment group of the loaded rows is read once (cached across tabs); a group whose all-status read comes
        // back empty also gets the 3 per-status fallback reads — so at most 4 per group, never one per row of the dataset
        check("dispatch reads: at least one and at most 4 per deployment group of the visited tabs' loaded rows (Boundaries only)", t.trailerReads >= visitedGroups.size && t.trailerReads <= 4 * visitedGroups.size, `${t.trailerReads} reads · ${visitedGroups.size} groups`)
        note("requests: Need Correction", JSON.stringify({ listPagesForTab: ncPages.length, dispatchReads: t.trailerReads, rows: rows.length, groupsVisited: visitedGroups.size }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 3. A failed Boundaries read: only those cells fail (Retry); rows, statuses and counts are unaffected ─────────
    {
        const page = await L.open(browser, `${L.V21}?mockFail=trailers-row2`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        check("the failing deployment's Boundaries cells show an error with Retry", await waitFor(page, () => !!document.querySelector('[data-dispatch-boundaries-state="error"] [data-boundary-retry]'), 20000))
        const g = await grain(page)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        check("the rows, their statuses and the tab count are there regardless (the read only fills Boundaries)", rows.length > 0 && rows.every((r) => r.status) && Number(await tabText(page, "All")) === g.total)
        check("the status line above the rows reports the Boundaries failure with Retry", g.boundaryFailures === 1 && g.retry && /couldn.t be read/.test(g.statusText), JSON.stringify(g))
        await page.evaluate(() => document.querySelector("[data-boundary-retry]")?.click())
        check("Retry reads that deployment again: its cells show saved / plots and the status line disappears", await waitFor(page, () => !document.querySelector('[data-dispatch-boundaries-state="error"]') && !document.querySelector("[data-dispatch-grain-notice]"), 20000))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 4. Counts that can't be read are shown as unavailable — never guessed, never the previous query's ───────────
    {
        const page = await L.open(browser, `${L.V21}?mockFail=counts`, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        const texts = {}
        for (const tab of ["All", "Verified", "Pending", "Need Correction"]) texts[tab] = await tabText(page, tab)
        const g = await grain(page)
        check("counts unavailable: every tab shows '—' and the table says so (data-counts-unavailable)", Object.values(texts).every((v) => v === "—") && g.countsUnavailable, JSON.stringify(texts))
        check("counts unavailable: the rows still load", g.rows > 0)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        check("counts unavailable after a tab change too (no stale counts)", (await tabText(page, "Pending")) === "—" && (await tabText(page, "All")) === "—")
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 5. A row → its FARMER's detail: one section per deployment group, no duplicate cards, the dispatch revealed ──
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await loadAll(page)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        // a farmer with a deployment that has several dispatches, and more than one deployment
        const target = rows.find((r) => rows.filter((x) => x.rowKey === r.rowKey).length > 1 && rows.some((x) => x.farmer === r.farmer && x.rowKey !== r.rowKey))
        check("a farmer with a multi-dispatch deployment and other deployments exists", !!target)
        if (target) {
            const index = await page.evaluate((id) => [...document.querySelectorAll("tbody tr")].findIndex((tr) => tr.querySelector(`[data-dispatch-cell="${id}"]`)), target.id)
            await L.openRow(page, index)
            await L.detailLoaded(page)
            await sleep(800)
            const sections = await L.detailSections(page)
            const cards = sections.flatMap((s) => s.cards)
            const farmerGroups = new Set(rows.filter((r) => r.farmer === target.farmer).map((r) => r.rowKey))
            check("one section per deployment group (farmer · round · AZ) — never one per dispatch row", sections.length === farmerGroups.size && new Set(sections.map((s) => s.key)).size === sections.length, `${sections.length} sections, ${farmerGroups.size} groups`)
            check("no dispatch card is shown twice (a 3-dispatch group used to show 3 × 3 cards)", cards.length > 0 && new Set(cards.map((c) => c.id)).size === cards.length, `${cards.length} cards`)
            // one card per dispatch row of each deployment — except a deployment whose dispatch read returns none (the mock's
            // fixture of a pattern seen on dev): it says its dispatches couldn't be loaded instead of showing cards
            const perSection = sections.map((s) => ({ key: s.key, cards: s.cards.length, listed: rows.filter((r) => r.rowKey === s.key).length, empty: s.empty }))
            check("the farmer's dispatches are all there: each section has one card per dispatch row the list holds for it (or says they couldn't be loaded)", perSection.every((s) => s.cards === s.listed || (s.cards === 0 && s.empty === "unavailable")), JSON.stringify(perSection))
            const expanded = cards.filter((c) => c.expanded)
            check("the clicked dispatch is revealed: its card (same dispatch id) is the expanded one", expanded.length === 1 && expanded[0].dispatchId === target.id, JSON.stringify(expanded.map((c) => c.dispatchId)))
            const nameBefore = await farmerName(page)
            check("Next moves to the next FARMER", await page.evaluate(() => { const b = document.querySelector("[data-next-farmer]"); if (!b || b.disabled) return false; b.click(); return true }))
            await waitFor(page, (x) => (document.querySelector('[role="dialog"] h2')?.textContent.trim() ?? "") !== x, 10000, nameBefore)
            await L.detailLoaded(page)
            check("after Next another farmer is shown and nothing is pre-expanded", (await farmerName(page)) !== nameBefore && (await L.detailSections(page)).flatMap((s) => s.cards).every((c) => !c.expanded))
            check("Previous returns", await page.evaluate(() => { const b = document.querySelector("[data-prev-farmer]"); if (!b || b.disabled) return false; b.click(); return true }))
            await waitFor(page, (x) => (document.querySelector('[role="dialog"] h2')?.textContent.trim() ?? "") === x, 10000, nameBefore)
            check("Previous returns to the first farmer", (await farmerName(page)) === nameBefore)
            await L.closeSheet(page)
        }
        await L.screenshot(page, "v21-dispatch-table.png")
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 6. The farmer-rows read fails: the clicked dispatch's deployment still shows; Retry reads the rest ──────────
    {
        const page = await L.open(browser, `${L.V21}?mockFail=farmer-rows`, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        check("the farmer-rows failure is shown with Retry", await waitFor(page, () => !!document.querySelector("[data-farmer-rows-error]") && !!document.querySelector("[data-farmer-rows-retry]"), 10000))
        check("only the deployment opened from the table is shown meanwhile", (await page.evaluate(() => Number(document.querySelector("[data-farmer-details]")?.getAttribute("data-farmer-rows")))) === 1)
        await page.evaluate(() => document.querySelector("[data-farmer-rows-retry]")?.click())
        check("Retry reads the farmer's rows: the other deployments appear and the failure clears", await waitFor(page, () => !document.querySelector("[data-farmer-rows-error]") && Number(document.querySelector("[data-farmer-details]")?.getAttribute("data-farmer-rows")) > 1, 20000))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
