/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — Hide column, from every column's header menu (a frontend action: TanStack column
// visibility; nothing about the API changes). Checked:
//   - every displayed column has a menu, and a column without API sort / filter (Dispatch ID, Boundaries) can be hidden;
//   - hiding sends no request, and the list requests that follow are byte-identical to a session where nothing is hidden
//     (status, page, sort — the default Submitted on sort included while its column is hidden);
//   - a row click still opens the right dispatch with Dispatch ID hidden;
//   - hidden columns stay hidden across status tabs, paging, sorting, an empty filtered result and clearing the filters
//     (Verified By: also across tabs that don't show it); the other menus keep working; the toolbar's Columns list shows
//     every hidden column and brings it back.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const CAPS = require("./column-capabilities.cjs")
const { check, sleep, waitFor } = L
const LIST = "/adminFarmApp/v4/getDeploymentMetadata"
const HIDE = ["submittedOn", "dispatch", "dispatchBoundaries", "village", "verifiedBy"]
const titleOf = (id) => CAPS.COLUMNS.find((c) => c.id === id).title

const heads = (page) => page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => ({ title: th.textContent.replace(/\s+/g, " ").trim(), menu: th.querySelector("[data-column-menu]")?.getAttribute("data-column-menu") ?? null })).filter((h) => h.title))
const shownIds = async (page) => (await heads(page)).map((h) => h.menu)
const cellsOf = (page) => page.evaluate(() => ({ dispatch: document.querySelectorAll("tbody [data-dispatch-cell]").length, boundaries: document.querySelectorAll("tbody [data-dispatch-boundaries-state]").length, submitted: document.querySelectorAll("tbody [data-row-submitted]").length, rows: document.querySelectorAll("tbody tr").length }))
/** The list request bodies (oldest first), as sent — the mock trace records the v4 body live mode would send. */
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
async function hide(page, id) {
    await page.evaluate((x) => { const b = document.querySelector(`[data-column-menu="${x}"]`); b?.scrollIntoView({ inline: "center", block: "nearest" }); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() }, id)
    const opened = await waitFor(page, (x) => !!document.querySelector(`[data-column-hide="${x}"]`), 4000, id)
    const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent.trim()))
    await page.evaluate((x) => document.querySelector(`[data-column-hide="${x}"]`)?.click(), id)
    await waitFor(page, (x) => !document.querySelector(`[data-column-menu="${x}"]`), 4000, id)
    await sleep(300)
    return { opened, items }
}
async function sortBy(page, id, dir) {
    await page.evaluate((x) => { const b = document.querySelector(`[data-column-menu="${x}"]`); b?.scrollIntoView({ inline: "center", block: "nearest" }); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() }, id)
    await waitFor(page, () => [...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.trim() === "Asc"), 4000)
    await page.evaluate((d) => [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim() === d)?.click(), dir)
    await sleep(1200)
    await L.dispatchRowsLoaded(page)
}
const loadPage2 = async (page) => {
    const before = await page.evaluate(() => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")))
    await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 50 && d.querySelector("table")); if (s) s.scrollTop = s.scrollHeight })
    await waitFor(page, (b) => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > b, 10000, before)
    await L.dispatchRowsLoaded(page)
    return { before, after: await page.evaluate(() => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows"))) }
}
/** The same actions in both sessions: Pending → All → page 2 → Farmer Asc. */
async function sequence(page, onStep) {
    await L.selectTab(page, "Pending"); await L.dispatchRowsLoaded(page); await onStep("Pending tab")
    await L.selectTab(page, "All"); await L.dispatchRowsLoaded(page); await onStep("back to All")
    const paged = await loadPage2(page); await onStep(`page 2 (${paged.before} → ${paged.after} rows)`)
    await sortBy(page, "farmer", "Asc"); await onStep("sorted by Farmer")
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    let baseline = null

    // ── a session where nothing is hidden: the list requests the sequence sends ─────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const n0 = (await listBodies(page)).length
        await sequence(page, async () => {})
        baseline = (await listBodies(page)).slice(n0)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── the same session with five columns hidden first ─────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const all = await heads(page)
        check("every displayed column has a header menu (All tab)", all.length === CAPS.COLUMNS.length && all.every((h) => h.menu), all.map((h) => `${h.title}:${h.menu ?? "-"}`).join(" | "))
        const firstId = await page.evaluate(() => document.querySelector("tbody tr [data-dispatch-cell]")?.getAttribute("data-dispatch-cell"))
        const nBefore = (await listBodies(page)).length
        const menus = {}
        for (const id of HIDE) menus[id] = await hide(page, id)
        const nAfter = (await listBodies(page)).length
        check("Hide column is in every one of these menus and hides the column (Dispatch ID / Boundaries: their only item)", HIDE.every((id) => menus[id].opened && menus[id].items.includes("Hide column")) && menus.dispatch.items.join("/") === "Hide column" && menus.dispatchBoundaries.items.join("/") === "Hide column", JSON.stringify(menus))
        const ids = await shownIds(page)
        const cells = await cellsOf(page)
        check("the hidden columns are gone — headers and cells (Dispatch ID, Boundaries, Submitted on cells: 0); the rest stay", HIDE.every((id) => !ids.includes(id)) && cells.dispatch === 0 && cells.boundaries === 0 && cells.submitted === 0 && cells.rows > 0 && ids.length === CAPS.COLUMNS.length - HIDE.length, JSON.stringify({ ids, cells }))
        check("hiding sends no request (frontend only)", nAfter === nBefore, `${nBefore} → ${nAfter} list requests`)
        // the other menus still work
        await page.evaluate(() => { const b = document.querySelector('[data-column-menu="farmer"]'); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() })
        await waitFor(page, () => document.querySelectorAll('[role="menuitem"]').length > 0, 3000)
        const farmerItems = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent.trim()).join("/"))
        await page.keyboard.press("Escape")
        await sleep(300)
        check("another column's menu still opens with its full items", farmerItems === "Filter/Asc/Desc/Hide column", farmerItems)
        // a row still opens the right dispatch with its id column hidden
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await sleep(800)
        const expanded = (await L.detailSections(page)).flatMap((s) => s.cards).filter((c) => c.expanded).map((c) => c.dispatchId)
        check("with Dispatch ID hidden, a row click still opens and reveals that row's dispatch", expanded.length === 1 && expanded[0] === firstId, JSON.stringify({ expanded, firstId }))
        await L.closeSheet(page)

        // the same sequence: the requests match the baseline byte for byte, and the columns stay hidden at every step
        const n0 = (await listBodies(page)).length
        const steps = []
        await sequence(page, async (step) => {
            const shown = await shownIds(page)
            const tab = await page.evaluate(() => document.querySelector('[role="tab"][data-state="active"]')?.textContent.trim() ?? "")
            const expectHidden = HIDE.filter((id) => !(tab.startsWith("Pending") && CAPS.VERIFIED_TAB_ONLY.includes(id)))
            steps.push({ step, ok: expectHidden.every((id) => !shown.includes(id)) && (await cellsOf(page)).dispatch === 0 })
        })
        const after = (await listBodies(page)).slice(n0)
        check("hidden columns stay hidden across a status tab change, back, the next page and a sort (Verified By too, after a tab that doesn't show it)", steps.length === 4 && steps.every((s) => s.ok), JSON.stringify(steps))
        check("the list requests are identical to the session with nothing hidden (status, page, sort)", after.length > 0 && JSON.stringify(after) === JSON.stringify(baseline), JSON.stringify({ hidden: after, baseline }))
        check("…the chosen sort is sent, and no other request carries one (no default sort, Submitted on hidden or not)", after.some((b) => /"sort_by":"farmer_name"/.test(b)) && after.filter((b) => !/farmer_name/.test(b)).every((b) => !/"sort_by"/.test(b)) && baseline.filter((b) => !/farmer_name/.test(b)).every((b) => !/"sort_by"/.test(b)))

        // a filter with an empty result (Submitted on 2024-06-01) and clearing it: still hidden; the empty state renders
        await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("title") === "Filters" || b.hasAttribute("data-open-filters"))?.click())
        await waitFor(page, () => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Filters/.test(d.textContent)), 5000)
        const pickDay = async (index, iso) => {
            const toggle = () => page.evaluate((i) => [...document.querySelectorAll('[role="dialog"] button[aria-haspopup="dialog"]')][i]?.click(), index)
            await toggle()
            if (!(await waitFor(page, () => !!document.querySelector('[data-slot="calendar"] [role="grid"]'), 4000))) return false
            const [y, m] = iso.split("-").map(Number)
            for (let i = 0; i < 60; i++) {
                const step = await page.evaluate((ty, tm) => {
                    const label = document.querySelector('[data-slot="calendar"] [role="grid"]')?.getAttribute("aria-label") ?? ""
                    const shown = new Date(`1 ${label}`)
                    if (Number.isNaN(shown.getTime())) return "unreadable"
                    const diff = (ty - shown.getFullYear()) * 12 + (tm - 1 - shown.getMonth())
                    if (diff === 0) return "there"
                    const nav = [...document.querySelectorAll('[data-slot="calendar"] button')].find((b) => (b.getAttribute("aria-label") ?? "") === (diff < 0 ? "Go to the Previous Month" : "Go to the Next Month"))
                    nav?.click()
                    return nav ? "stepped" : "no nav"
                }, y, m)
                if (step === "there") break
                if (step !== "stepped") return false
                await sleep(60)
            }
            const clicked = await page.evaluate((d) => { const c = document.querySelector(`[data-slot="calendar"] td[data-day="${d}"]:not([data-outside]) button`); if (!c) return false; c.click(); return true }, iso)
            await sleep(200)
            if (await page.evaluate(() => !!document.querySelector('[data-slot="calendar"]'))) await toggle()
            await waitFor(page, () => !document.querySelector('[data-slot="calendar"]'), 3000)
            return clicked
        }
        const picked = (await pickDay(0, "2024-06-01")) && (await pickDay(1, "2024-06-01"))
        await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Apply now")?.click())
        await waitFor(page, () => document.querySelectorAll("tbody tr [data-cell]").length === 0 && /No matching records/.test(document.querySelector("tbody")?.innerText ?? ""), 15000)
        await sleep(800)
        const filtered = { shown: await shownIds(page), empty: await page.evaluate(() => /No matching records/.test(document.querySelector("tbody")?.innerText ?? "")) }
        check("a filtered empty result: the empty state renders and the hidden columns stay hidden", !!picked && filtered.empty && HIDE.every((id) => !filtered.shown.includes(id)), JSON.stringify(filtered))
        await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear all filters")?.click())
        await waitFor(page, () => document.querySelectorAll("tbody tr [data-cell]").length > 0, 15000)
        await L.dispatchRowsLoaded(page)
        const cleared = await shownIds(page)
        check("clearing the filters brings the rows back with the columns still hidden", HIDE.every((id) => !cleared.includes(id)) && (await cellsOf(page)).rows > 0, cleared.join(","))
        const scroll = await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 1 && d.querySelector("table")); if (!s) return { scrolls: false }; s.scrollLeft = s.scrollWidth; return { scrolls: true, left: s.scrollLeft > 0 } })
        await page.setViewport({ width: 1100, height: 900 })
        await sleep(500)
        const narrow = await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 1 && d.querySelector("table")); if (!s) return null; s.scrollLeft = s.scrollWidth; return s.scrollLeft > 0 })
        check("the table still scrolls horizontally with columns hidden (1100 px)", narrow === true, JSON.stringify({ scroll, narrow }))
        await page.setViewport({ width: 1600, height: 1000 })
        await sleep(400)

        // the toolbar's Columns list shows every hidden column (also Dispatch ID / Boundaries) and brings them back
        await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("title") === "Columns"); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() })
        await waitFor(page, () => document.querySelectorAll('[role="menuitemcheckbox"]').length > 0, 4000)
        const listed = await page.evaluate(() => [...document.querySelectorAll('[role="menuitemcheckbox"]')].map((m) => ({ title: m.textContent.trim(), checked: m.getAttribute("aria-checked") === "true" })))
        check("the Columns list names every column of the tab, the hidden ones unchecked", HIDE.every((id) => listed.some((l) => l.title.toLowerCase() === titleOf(id).toLowerCase() && !l.checked)), JSON.stringify(listed))
        for (const id of ["dispatch", "dispatchBoundaries"]) {
            await page.evaluate((t) => [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((m) => m.textContent.trim().toLowerCase() === t.toLowerCase())?.click(), titleOf(id))
            await sleep(300)
        }
        await page.keyboard.press("Escape")
        await sleep(500)
        const restored = await shownIds(page)
        const restoredCells = await cellsOf(page)
        check("Dispatch ID and Boundaries come back from the Columns list, with their cells", restored.includes("dispatch") && restored.includes("dispatchBoundaries") && restoredCells.dispatch > 0 && restoredCells.boundaries > 0, JSON.stringify({ restored, restoredCells }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
