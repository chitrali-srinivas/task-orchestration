/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the table's order (the API's, as returned) and its header menus.
//   1. API order: no default sort — the list request carries no sort_by / sort_order until a column is sorted — and the
//      rows are shown exactly as the API returned them, checked against the response bodies in the Inspector trace
//      (every row, in order, page by page, deduplicated as the table does). On every status tab, across pages, after
//      a tab change (a column sort chosen on one tab is cleared on the next), an empty result and clearing filters.
//      The header shows the API's order only when the API REPORTS it (PROPOSED pagination.sort_by / sort_order; the
//      mock reports its own order — Submitted on, newest first; oldest first on Pending): that column's arrow, its
//      accessible name and Asc / Desc checked in its menu. A column sort chosen from a menu is shown instead.
//   1u. ?mockOrder=unsorted: the API returns a deliberately unsorted order (Submitted on and Verified On out of
//      chronological order, both ways) and reports no sort — the table keeps that order on load, across pages and
//      after tab changes, and no header shows an arrow. A hidden client-side sort by any column would fail these.
//   1b. ?mockValidation=oldest: on Pending (the mock server's oldest-first order) every flag is shown.
//   2. Header menus (root cause: the dispatch-grain columns had ids the API contract doesn't know and no accessor, so
//      TanStack gave them no sort / filter and the header rendered plain text; the chevron was shown on mouse hover
//      only). Every column the API can sort or filter has a menu, reachable and opened with the keyboard, with exactly
//      its capabilities; Dispatch ID and Boundaries have none. At 1600 and 1100 px, at both horizontal scroll edges.
//      The menu icon is hidden at rest (V2's design; a sorted column keeps its arrow) and shown on hover, on keyboard
//      focus and while the menu is open — fading in place, so the label never moves.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor } = L

const LIST = "/adminFarmApp/v4/getDeploymentMetadata"
/**
 * The header menus (column-capabilities.cjs — the verified matrix, also checked against the contract by
 * check-live-api.mjs): every column has one; Filter / Asc / Desc only where the API supports them; Hide column on all.
 */
const CAPS = require("./column-capabilities.cjs")
const EXPECTED = Object.fromEntries(CAPS.COLUMNS.map((c) => [c.title, { sort: !!c.sortBy, filter: !!c.filterKey, items: CAPS.menuOf(c) }]))
const HIDE_ONLY = CAPS.COLUMNS.filter((c) => !c.sortBy && !c.filterKey).map((c) => c.title)
const VERIFIED_ONLY = CAPS.COLUMNS.filter((c) => CAPS.VERIFIED_TAB_ONLY.includes(c.id)).map((c) => c.title)

const grain = (page) => page.evaluate(() => { const g = document.querySelector("[data-dispatch-grain]"); return g ? { rows: Number(g.getAttribute("data-dispatch-rows")), total: Number(g.getAttribute("data-dispatch-total")), flagged: Number(g.getAttribute("data-rows-flagged")) } : null })
const tabText = (page, name) => page.evaluate((n) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(n))?.querySelector("span")?.textContent.trim() ?? "", name)
/** Each loaded dispatch row: id, status, Submitted on (ms), flagged. */
const rowsNow = (page) => page.evaluate(() => [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]")).map((tr) => ({
    id: tr.querySelector("[data-dispatch-cell]").getAttribute("data-dispatch-cell"),
    status: tr.querySelector("[data-dispatch-status]")?.getAttribute("data-dispatch-status") ?? null,
    at: Number(tr.querySelector("[data-row-submitted]")?.getAttribute("data-row-submitted") ?? NaN),
    flagged: !!tr.querySelector("[data-dispatch-validation]"),
})))

/** The Inspector's trace (newest first): each list request's status / page / sort (the mock answers counts in memory: no trace entry — check-live-api.mjs checks the counts body). */
async function trace(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const out = await page.evaluate(async (paths) => {
        const read = async (p) => {
            const list = []
            for (const e of document.querySelectorAll(`[data-trace-entry][data-trace-path="${p}"]`)) {
                e.querySelector("button")?.click()
                await new Promise((r) => setTimeout(r, 30))
                const text = (e.querySelector("[data-trace-details]")?.textContent ?? "").split("Response body")[0]
                if (/"farmer_ids"/.test(text)) continue
                list.push({ status: (text.match(/"status":\s*"([a-z_]+)"/) ?? [])[1] ?? null, page: Number((text.match(/"page":\s*(\d+)/) ?? [])[1] ?? 0), sort: /"sort_by"/.test(text) ? `${(text.match(/"sort_by":\s*"([a-z_]+)"/) ?? [])[1]} ${(text.match(/"sort_order":\s*"([a-z]+)"/) ?? [])[1]}` : "(none)" })
            }
            return list
        }
        return { lists: await read(paths.LIST) }
    }, { LIST })
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return out
}

/**
 * The table-page requests in the Inspector trace, oldest first, parsed in the page: { id (the trace's sequence), status,
 * page, sent (the sort the request carried, "(none)" without one), ids (the dispatch ids the API returned, in its
 * order), at / verifiedAt (their Submitted on / verified_at), reported (the pagination's sort, null without one) }.
 * Farmer-row reads (farmer_ids) are left out.
 */
async function listTrace(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const out = await page.evaluate(async (path) => {
        const list = []
        for (const e of document.querySelectorAll(`[data-trace-entry][data-trace-path="${path}"]`)) {
            if (!e.querySelector("[data-trace-details]")) { e.querySelector("button")?.click(); await new Promise((r) => setTimeout(r, 30)) }
            let request = null, response = null
            for (const block of e.querySelectorAll("[data-trace-details] > div")) {
                const title = block.querySelector("p")?.textContent ?? ""
                const code = block.children[1]?.textContent ?? ""
                try {
                    if (/^Request body/i.test(title)) request = JSON.parse(code)
                    if (/^Response body/i.test(title)) response = JSON.parse(code)
                } catch { /* not JSON */ }
            }
            const body = request?.metadata ?? request ?? {}
            if (body.farmer_ids || !response) continue
            const rows = response.rows ?? response.data?.data ?? []
            const pag = response.pagination ?? response.data?.pagination ?? {}
            list.push({
                id: Number(e.getAttribute("data-trace-entry")),
                status: body.status ?? null,
                page: Number(body.page ?? 0),
                sent: body.sort_by ? `${body.sort_by} ${body.sort_order}` : "(none)",
                ids: rows.map((r) => String(r.dispatch_id)),
                at: rows.map((r) => Number(r.created_at)),
                verifiedAt: rows.map((r) => (r.verified_at == null ? null : Number(r.verified_at))),
                reported: pag.sort_by ? `${pag.sort_by} ${pag.sort_order}` : null,
            })
        }
        return list.sort((a, b) => a.id - b.id)
    }, LIST)
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return out
}
/** The newest trace sequence id so far (requests after it belong to the next action). */
const traceMark = async (page) => { const t = await listTrace(page); return t.length ? t[t.length - 1].id : 0 }
/**
 * What the API returned for the view since `mark` with `status`: the newest response per page, pages in order, joined
 * and deduplicated by dispatch id (first kept) — as the table's infinite scroll joins them.
 */
function apiView(entries, mark, status) {
    const byPage = new Map()
    for (const e of entries) if (e.id > mark && e.status === status) byPage.set(e.page, e)
    const pages = [...byPage.keys()].sort((a, b) => a - b).map((n) => byPage.get(n))
    const seen = new Set(), ids = [], at = [], verifiedAt = []
    for (const e of pages) e.ids.forEach((id, k) => { if (seen.has(id)) return; seen.add(id); ids.push(id); at.push(e.at[k]); verifiedAt.push(e.verifiedAt[k]) })
    return { pages, ids, at, verifiedAt, sent: [...new Set(pages.map((e) => e.sent))], reported: [...new Set(pages.map((e) => e.reported))] }
}
const ordered = (xs, dir) => xs.every((x, i) => i === 0 || (dir > 0 ? xs[i - 1] <= x : xs[i - 1] >= x))
/** Out of order both ways (needs 3+ values): what a hidden ascending or descending sort would change. */
const unsortedBothWays = (xs) => { const v = xs.filter((x) => x !== null && Number.isFinite(x)); return v.length >= 3 && !ordered(v, 1) && !ordered(v, -1) }
/** The header's sort as shown: every column's arrow / accessible name, and the grain's sort attributes. */
const headerSort = (page) => page.evaluate(() => ({
    arrows: [...document.querySelectorAll("[data-column-menu]")].map((b) => ({ id: b.getAttribute("data-column-menu"), dir: b.querySelector("svg.lucide-arrow-down") ? "desc" : b.querySelector("svg.lucide-arrow-up") ? "asc" : null, label: b.getAttribute("aria-label") })).filter((h) => h.dir || /sorted/.test(h.label ?? "")),
    source: document.querySelector("[data-dispatch-grain]")?.getAttribute("data-sort-source") ?? null,
    api: document.querySelector("[data-dispatch-grain]")?.getAttribute("data-api-sort") ?? null,
}))
/** Opens a column's menu and reads its items with their check marks (then closes it). */
async function menuChecks(page, columnId) {
    await page.evaluate((id) => { const b = document.querySelector(`[data-column-menu="${id}"]`); b?.scrollIntoView({ inline: "center", block: "nearest" }); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() }, columnId)
    await waitFor(page, () => document.querySelectorAll('[role="menuitem"]').length > 0, 4000)
    const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((m) => ({ text: m.textContent.trim(), checked: !!m.querySelector("svg.lucide-check") })))
    await page.keyboard.press("Escape")
    await sleep(400)
    return items
}

/** Opens a column's menu with the mouse and picks an item (Asc / Desc / Filter). */
async function pick(page, columnTitle, item) {
    await page.evaluate((x) => { const b = [...document.querySelectorAll("thead th")].find((th) => th.textContent.replace(/\s+/g, " ").trim() === x)?.querySelector("[data-column-menu]"); b?.scrollIntoView({ inline: "center", block: "nearest" }); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); b?.click() }, columnTitle)
    const opened = await waitFor(page, (i) => [...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.trim() === i), 4000, item)
    if (opened) await page.evaluate((i) => [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim() === i)?.click(), item)
    await sleep(1200)
    return opened
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    const STATUS_OF_TAB = { Pending: ["pending", "pending"], "Need Correction": ["need_correction", "rejected"], All: ["all", null], Verified: ["approved", "approved"] }
    /** The table's rows now vs what the API returned since `mark` for `status`. */
    const compare = async (page, mark, status) => {
        const rows = await rowsNow(page)
        const api = apiView(await listTrace(page), mark, status)
        return { rows, api, same: api.ids.length > 0 && JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(api.ids) }
    }

    // ── 1. API order (the mock reports its own order): no default sort, the rows as returned, the reported sort shown ──
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        let v = await compare(page, 0, "approved")
        let h = await headerSort(page)
        check("1. first load (Verified): the request sends no sort (no sort_by / sort_order)", v.api.pages.length > 0 && v.api.sent.join() === "(none)", JSON.stringify(v.api.sent))
        check("1. first load: the rows are exactly the API's, in its order (every row, row for row)", v.same, `${v.rows.length} rows · api ${v.api.ids.length}`)
        check("1. first load: the API reports its order (created_at desc) and the header shows it — Submitted on's Desc arrow and accessible name, no other column sorted", v.api.reported.join() === "created_at desc" && h.source === "api" && h.api === "created_at desc" && h.arrows.length === 1 && h.arrows[0].id === "submittedOn" && h.arrows[0].dir === "desc" && h.arrows[0].label === "Submitted on, sorted descending", JSON.stringify(h))
        const items = await menuChecks(page, "submittedOn")
        check("1. Submitted on's menu: Desc is checked, Asc is not", items.find((m) => m.text === "Desc")?.checked === true && items.find((m) => m.text === "Asc")?.checked === false, JSON.stringify(items))

        for (const [tab, [apiStatus, rowStatus]] of Object.entries(STATUS_OF_TAB)) {
            const mark = await traceMark(page)
            await L.selectTab(page, tab)
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, apiStatus)
            h = await headerSort(page)
            const want = apiStatus === "pending" ? "asc" : "desc"
            check(`1. ${tab}: the request keeps the tab's status, page 1, no sort`, v.api.pages[0]?.page === 1 && v.api.sent.join() === "(none)", JSON.stringify(v.api.pages.map((e) => `${e.status}/${e.page}/${e.sent}`)))
            check(`1. ${tab}: the rows are the tab's own, exactly in the API's order; the total is the server's count`, v.same && (rowStatus === null || v.rows.every((r) => r.status === rowStatus)) && String((await grain(page)).total) === (await tabText(page, tab)), `${v.rows.length} rows`)
            check(`1. ${tab}: the header shows the order the API reported (created_at ${want}): Submitted on, ${want === "asc" ? "Asc" : "Desc"} arrow`, v.api.reported.join() === `created_at ${want}` && h.source === "api" && h.arrows.length === 1 && h.arrows[0].id === "submittedOn" && h.arrows[0].dir === want, JSON.stringify(h))
        }

        // paging (All: several pages): every page request without a sort; the rows = the pages joined, in order
        {
            const mark = await traceMark(page)
            await L.selectTab(page, "Verified")
            await L.dispatchRowsLoaded(page)
            await L.selectTab(page, "All")
            await L.dispatchRowsLoaded(page)
            const all = await L.loadAllRows(page)
            v = await compare(page, mark, "all")
            const g = await grain(page)
            check("1. paging: pages 1..n were read, none with a sort", v.api.pages.length >= 2 && v.api.pages.every((e, k) => e.page === k + 1 && e.sent === "(none)"), JSON.stringify(v.api.pages.map((e) => `${e.page}:${e.sent}`)))
            check("1. paging: every row loaded once, the pages joined in the API's order, row for row; the count is the server total", all && v.same && v.rows.length === g.total && new Set(v.rows.map((r) => r.id)).size === v.rows.length, `${v.rows.length}/${g.total}`)
        }

        // a column sort: sent and shown; the next tab opens in its API order again
        {
            let mark = await traceMark(page)
            await pick(page, "Farmer", "Asc")
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, "all")
            h = await headerSort(page)
            check("1. a column sort (Farmer Asc) is sent (farmer_name asc) and shown on Farmer only; the rows are as the API returned them", v.api.sent.join() === "farmer_name asc" && v.same && h.source === "column" && h.arrows.length === 1 && h.arrows[0].id === "farmer" && h.arrows[0].dir === "asc", JSON.stringify({ sent: v.api.sent, h }))
            mark = await traceMark(page)
            await L.selectTab(page, "Pending")
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, "pending")
            h = await headerSort(page)
            check("1. a tab change clears the column sort: Pending's request sends none, its rows are in the API's order and the header shows the API's (Submitted on, Asc)", v.api.sent.join() === "(none)" && v.same && h.source === "api" && h.arrows.length === 1 && h.arrows[0].id === "submittedOn" && h.arrows[0].dir === "asc", JSON.stringify({ sent: v.api.sent, h }))
            await L.selectTab(page, "All")
            await L.dispatchRowsLoaded(page)
            await pick(page, "Verified By", "Desc")
            await L.dispatchRowsLoaded(page)
            mark = await traceMark(page)
            await L.selectTab(page, "Verified")
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, "approved")
            check("1. a Verified By sort is cleared on the next tab too (no sort sent; the API's order)", v.api.sent.join() === "(none)" && v.same, JSON.stringify(v.api.sent))
        }

        // an empty result (a Submitted on range with no data): no sort sent; clearing the filters restores the API's order
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("title") === "Filters" || b.hasAttribute("data-open-filters"))?.click())
        const sheet = await waitFor(page, () => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Filters/.test(d.textContent)), 5000)
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
        const picked = sheet && (await pickDay(0, "2024-06-01")) && (await pickDay(1, "2024-06-01"))
        await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Apply now")?.click())
        await waitFor(page, () => document.querySelectorAll("tbody tr [data-dispatch-cell]").length === 0, 15000)
        await sleep(1500)
        const empty = await page.evaluate(() => ({ cells: document.querySelectorAll("tbody tr [data-dispatch-cell]").length, text: (document.querySelector("tbody")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80) }))
        const ge = await grain(page)
        const tEmpty = await listTrace(page)
        check("1. an empty result: no rows, the empty state (not an error), total 0, every tab count 0", !!picked && empty.cells === 0 && empty.text.length > 0 && !/Couldn't load/i.test(empty.text) && ge.total === 0 && (await tabText(page, "All")) === "0" && (await tabText(page, "Pending")) === "0", JSON.stringify({ picked, empty, total: ge.total }))
        check("1. the empty result's request sends no sort", tEmpty[tEmpty.length - 1]?.status === "all" && tEmpty[tEmpty.length - 1]?.sent === "(none)", JSON.stringify(tEmpty.slice(-1).map((e) => `${e.status}/${e.sent}`)))
        const mark = tEmpty.length ? tEmpty[tEmpty.length - 1].id : 0
        await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear all filters")?.click())
        const restored = await waitFor(page, () => document.querySelectorAll("tbody tr [data-dispatch-cell]").length > 0, 15000)
        await L.dispatchRowsLoaded(page)
        v = await compare(page, mark, "all")
        check("1. clearing the filters restores the rows in the API's order, no sort sent", restored && v.same && v.api.sent.join() === "(none)", JSON.stringify(v.api.sent))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 1u. A deliberately unsorted API response (?mockOrder=unsorted): kept on load, across pages, after tab changes ──
    {
        const page = await L.open(browser, `${L.V21}?mockOrder=unsorted`, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        let v = await compare(page, 0, "approved")
        let h = await headerSort(page)
        check("1u. the fixture: the Verified tab's API response has Submitted on AND Verified On out of chronological order (neither ascending nor descending)", unsortedBothWays(v.api.at) && unsortedBothWays(v.api.verifiedAt), JSON.stringify({ at: v.api.at.slice(0, 6), verified: v.api.verifiedAt.slice(0, 6) }))
        check("1u. initial load: no sort sent, the rows exactly in the API's unsorted order", v.api.sent.join() === "(none)" && v.same, `${v.rows.map((r) => r.id).slice(0, 6).join(",")} vs ${v.api.ids.slice(0, 6).join(",")}`)
        check("1u. the table's own dates are as unsorted as the response (no hidden sort by Submitted on or Verified On)", unsortedBothWays(v.rows.map((r) => r.at)) && JSON.stringify(v.rows.map((r) => r.at)) === JSON.stringify(v.api.at))
        check("1u. the API reports no sort, so no header shows one", v.api.reported.join() === "" && h.source === "none" && h.api === null && h.arrows.length === 0, JSON.stringify(h))

        for (const [tab, [apiStatus]] of Object.entries(STATUS_OF_TAB)) {
            const mark = await traceMark(page)
            await L.selectTab(page, tab)
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, apiStatus)
            h = await headerSort(page)
            check(`1u. ${tab}: no sort sent; the rows exactly in the API's order${v.api.ids.length >= 3 ? ", which is out of chronological order" : ""}; no arrow`, v.api.sent.join() === "(none)" && v.same && (v.api.ids.length < 3 || unsortedBothWays(v.api.at)) && h.arrows.length === 0, `${v.rows.length} rows · ${JSON.stringify(v.api.at.slice(0, 5))}`)
        }

        // across pages: All, every page loaded; the joined pages out of order and kept as returned
        {
            const mark = await traceMark(page)
            await L.selectTab(page, "Verified")
            await L.dispatchRowsLoaded(page)
            await L.selectTab(page, "All")
            await L.dispatchRowsLoaded(page)
            const all = await L.loadAllRows(page)
            v = await compare(page, mark, "all")
            const firstOfPage2 = v.api.pages[1]?.at[0]
            const page1 = v.api.pages[0]?.at ?? []
            check("1u. paging: 2+ pages, each out of chronological order, page 2 starting inside page 1's date range (a per-page or whole-list sort would change it)", v.api.pages.length >= 2 && v.api.pages.every((e) => e.at.length < 3 || unsortedBothWays(e.at)) && firstOfPage2 > Math.min(...page1) && firstOfPage2 < Math.max(...page1), JSON.stringify(v.api.pages.map((e) => `${e.page}:${e.ids.length}`)))
            check("1u. paging: every row once, the pages joined in the API's order, row for row", all && v.same && new Set(v.rows.map((r) => r.id)).size === v.rows.length && v.rows.length === (await grain(page)).total, `${v.rows.length} rows`)
        }

        // a column sort on one tab, then a tab change: back to the API's unsorted order
        {
            await L.selectTab(page, "Pending")
            await L.dispatchRowsLoaded(page)
            await pick(page, "Submitted on", "Desc")
            await L.dispatchRowsLoaded(page)
            const sorted = await rowsNow(page)
            check("1u. a column sort is honoured (Submitted on Desc: the server's newest first)", sorted.length > 1 && ordered(sorted.map((r) => r.at), -1) && (await headerSort(page)).source === "column")
            const mark = await traceMark(page)
            await L.selectTab(page, "All")
            await L.dispatchRowsLoaded(page)
            v = await compare(page, mark, "all")
            h = await headerSort(page)
            check("1u. after the tab change: no sort sent, the rows back in the API's unsorted order, no arrow", v.api.sent.join() === "(none)" && v.same && unsortedBothWays(v.api.at) && h.arrows.length === 0, JSON.stringify({ sent: v.api.sent, h }))
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 1b. Only the oldest pending dispatches flagged (?mockValidation=oldest) ───────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockValidation=oldest`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const first = await rowsNow(page)
        const total = (await grain(page)).total
        check("1b. Pending in the mock server's own order (oldest first, reported and shown as Submitted on Asc) opens on the flagged dispatches", ordered(first.map((r) => r.at), 1) && first.filter((r) => r.flagged).length === Math.min(10, first.length) && (await headerSort(page)).arrows[0]?.dir === "asc", `${first.filter((r) => r.flagged).length} flagged of ${first.length}`)
        const loaded = await L.loadAllRows(page)
        const everyRow = await rowsNow(page)
        const flaggedAll = everyRow.filter((r) => r.flagged)
        const oldestTen = [...everyRow].sort((a, b) => a.at - b.at).slice(0, 10).map((r) => r.id).sort()
        check("1b. no flag is hidden: with every pending row loaded, all 10 flagged dispatches show their marker — the 10 oldest", loaded && everyRow.length === total && flaggedAll.length === 10 && JSON.stringify(flaggedAll.map((r) => r.id).sort()) === JSON.stringify(oldestTen), `${flaggedAll.length} flagged of ${everyRow.length}`)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. Header menus: capabilities, visibility at rest / hover / keyboard focus, keyboard opening, on screen ─────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        for (const width of [1600, 1100]) {
            await page.setViewport({ width, height: 900 })
            await sleep(700)
            // both horizontal edges: the columns in view there have their menu triggers, visible
            for (const edge of ["left", "right"]) {
                await page.evaluate((e) => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 20 && d.querySelector("table")); if (s) s.scrollLeft = e === "left" ? 0 : s.scrollWidth }, edge)
                await sleep(400)
                const inView = await page.evaluate(() => {
                    const s = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 20 && d.querySelector("table"))
                    const box = (s ?? document.querySelector("table")).getBoundingClientRect()
                    return [...document.querySelectorAll("thead th")].map((th) => {
                        const r = th.getBoundingClientRect()
                        const b = th.querySelector("[data-column-menu]")
                        const icon = b?.querySelector("svg")
                        const ir = icon?.getBoundingClientRect()
                        const sorted = /sorted/.test(b?.getAttribute("aria-label") ?? "")
                        return { title: th.textContent.replace(/\s+/g, " ").trim(), inView: r.left >= box.left - 1 && r.right <= box.right + 1, menu: !!b, sorted, restOpacity: icon ? getComputedStyle(icon).opacity : null, iconFits: !!icon && ir.width > 0 && ir.right <= r.right + 1 }
                    }).filter((h) => h.title && h.inView)
                })
                const bad = inView.filter((h) => (h.title in EXPECTED) !== h.menu || (h.menu && (!h.iconFits || h.restOpacity !== (h.sorted ? "1" : "0"))))
                check(`2. ${width}px, ${edge} edge: each column in view has a menu exactly when the API supports it; at rest its icon is hidden (a sorted column shows its arrow) and fits the header`, inView.length > 0 && bad.length === 0, bad.length ? JSON.stringify(bad) : inView.map((h) => h.title).join(", "))
            }
            const scrolls = await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 20 && d.querySelector("table")); return !!s && s.scrollWidth > s.clientWidth })
            if (width === 1100) check("2. 1100px: the table scrolls horizontally (the right-edge columns are reached by scrolling)", scrolls)
        }
        await page.setViewport({ width: 1600, height: 900 })
        await sleep(600)

        // the whole header row: a menu on every column (Hide column at least)
        const heads = await page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => ({ title: th.textContent.replace(/\s+/g, " ").trim(), menu: th.querySelector("[data-column-menu]")?.getAttribute("data-column-menu") ?? null })).filter((h) => h.title))
        check("2. All tab: every displayed column has a header menu", heads.length === Object.keys(EXPECTED).length && heads.every((h) => h.menu && h.title in EXPECTED), heads.map((h) => `${h.title}:${h.menu ?? "-"}`).join(" | "))
        check("2. Dispatch ID and Boundaries (no API sort or filter) have a menu too — Hide column only", HIDE_ONLY.join() === "Dispatch ID,Boundaries" && HIDE_ONLY.every((x) => heads.find((h) => h.title === x)?.menu))
        check("2. the column ids are the API contract's (plots / area / calArea / deployed / status / verifiedBy / verifiedOn)", ["plots", "area", "calArea", "deployed", "status", "verifiedBy", "verifiedOn"].every((id) => heads.some((h) => h.menu === id)))

        // keyboard: Tab walks the header menus in column order; each shows focus, opens with Enter, lists exactly its items
        await page.evaluate(() => document.querySelector('[data-column-menu="submittedOn"]')?.focus())
        const order = []
        for (let i = 0; i < 20; i++) {
            const at = await page.evaluate(() => document.activeElement?.getAttribute("data-column-menu") ?? null)
            if (!at) break
            order.push(at)
            await page.keyboard.press("Tab")
            await sleep(60)
        }
        const expectedOrder = heads.filter((h) => h.menu).map((h) => h.menu)
        check("2. keyboard: Tab reaches every header menu, in column order", JSON.stringify(order) === JSON.stringify(expectedOrder), order.join(" → "))

        const results = []
        for (const title of Object.keys(EXPECTED)) {
            await page.evaluate((x) => [...document.querySelectorAll("thead th")].find((th) => th.textContent.replace(/\s+/g, " ").trim() === x)?.scrollIntoView({ inline: "center", block: "nearest" }), title)
            await sleep(150)
            const sel = `[data-column-menu="${heads.find((h) => h.title === title).menu}"]`
            const btn = await page.$(sel)
            /** The icon's opacity and the label's box (the label must not move when the icon appears). */
            const look = () => page.evaluate((s) => { const b = document.querySelector(s); const i = b?.querySelector("svg"); const l = b?.querySelector("span")?.getBoundingClientRect(); return { op: i ? getComputedStyle(i).opacity : null, label: l ? `${Math.round(l.left * 2) / 2},${Math.round(l.width * 2) / 2}` : null, sorted: /sorted/.test(b?.getAttribute("aria-label") ?? "") } }, sel)
            await page.mouse.move(5, 5)
            await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
            await sleep(600)
            const rest = await look()
            await btn.hover()
            await sleep(250)
            const hoverLook = await look()
            const hover = hoverLook.op
            await page.mouse.move(5, 5)
            // keyboard focus: Shift+Tab then Tab lands on it with :focus-visible
            await page.evaluate((s) => document.querySelector(s)?.focus(), sel)
            await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift")
            await page.keyboard.press("Tab")
            await sleep(150)
            const focus = await page.evaluate((s) => { const b = document.querySelector(s); const i = b?.querySelector("svg"); return { focused: document.activeElement === b, visible: !!b?.matches(":focus-visible"), icon: i ? getComputedStyle(i).opacity : null } }, sel)
            const focusLook = await look()
            await page.keyboard.press("Enter")
            const opened = await waitFor(page, () => document.querySelectorAll('[role="menuitem"]').length > 0, 3000)
            const openLook = await look()
            const menu = await page.evaluate(() => { const m = document.querySelector('[role="menu"]'); const r = m?.getBoundingClientRect(); return m ? { items: [...m.querySelectorAll('[role="menuitem"]')].map((x) => x.textContent.trim()), onScreen: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight, focusInside: m.contains(document.activeElement) } : null })
            await page.keyboard.press("Escape")
            const closing = []
            for (let k = 0; k < 12; k++) { closing.push(Number((await look()).op)); await sleep(50) }
            const back = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel)
            const closedLook = await look()
            await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
            await sleep(600)
            const blurLook = await look()
            const want = EXPECTED[title].items
            const restWant = rest.sorted ? "1" : "0"
            const noFlicker = Math.min(...closing) >= 0.9
            const states = { rest: rest.op, hover, focus: focus.icon, open: openLook.op, closingMin: Math.min(...closing), closedFocused: closedLook.op, blurred: blurLook.op }
            const steady = [hoverLook, focusLook, openLook, closedLook, blurLook].every((x) => x.label === rest.label)
            const ok = rest.op === restWant && hover === "1" && focus.focused && focus.visible && focus.icon === "1" && opened && openLook.op === "1" && noFlicker && closedLook.op === "1" && blurLook.op === restWant && steady && !!menu && JSON.stringify(menu.items) === JSON.stringify(want) && menu.onScreen && menu.focusInside && back
            results.push({ title, ok, states, steady, items: menu?.items, onScreen: menu?.onScreen, back })
        }
        const failed = results.filter((r) => !r.ok)
        check("2. every supported column: icon hidden at rest, shown on hover, on keyboard focus (:focus-visible) and while open, kept through closing (no flicker while focus returns), hidden again after blur; the label never moves; Enter opens the menu with focus inside, fully on screen; Escape returns focus", failed.length === 0, failed.length ? JSON.stringify(failed) : `${results.length} columns`)
        check("2. each menu lists exactly its capabilities: sort-only columns have no Filter, Verified On has no Asc / Desc, Dispatch ID / Boundaries offer Hide column only", results.every((r) => r.ok || !r.items) && results.find((r) => r.title === "Plots")?.items?.join("/") === "Asc/Desc/Hide column" && results.find((r) => r.title === "Verified On")?.items?.join("/") === "Filter/Hide column" && results.find((r) => r.title === "Dispatch ID")?.items?.join("/") === "Hide column" && results.find((r) => r.title === "Boundaries")?.items?.join("/") === "Hide column", results.map((r) => `${r.title}: ${(r.items ?? []).join("/")}`).join(" | "))

        // the new menus do what they offer: a numeric sort reaches the server and orders the rows; Filter opens its sidebar section
        const valuesOf = (attr) => page.evaluate((a) => [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]")).map((tr) => { const c = tr.querySelector(`[data-cell="${a}"]`); return c && !c.hasAttribute("data-cell-missing") ? Number(c.getAttribute("data-value")) : null }), attr)
        for (const [title, attr, field] of [["Plots", "plots", "plots"], ["Cal. Area", "cal-area", "calculated_area"], ["Deployed", "deployed", "deployed_amount"]]) {
            await pick(page, title, "Desc")
            await L.dispatchRowsLoaded(page)
            const vals = (await valuesOf(attr)).filter((v) => v !== null)
            const t = await trace(page)
            check(`2. ${title} → Desc: sort_by ${field} desc is sent and the rows come back in that order`, t.lists[0]?.sort === `${field} desc` && vals.length > 1 && vals.every((v, i) => i === 0 || vals[i - 1] >= v), `${t.lists[0]?.sort} · ${vals.slice(0, 6).join(" ≥ ")}`)
        }
        for (const title of ["Verified By", "Verified On"]) {
            await pick(page, title, "Filter")
            const section = await waitFor(page, (x) => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Filters/.test(d.textContent) && d.textContent.includes(x)), 5000, title)
            check(`2. ${title} → Filter opens the filter sidebar with its ${title} section`, section)
            await page.keyboard.press("Escape")
            await waitFor(page, () => ![...document.querySelectorAll('[role="dialog"]')].some((d) => /Filters/.test(d.textContent)), 4000)
            await sleep(300)
        }

        // sticky header: scrolling the rows keeps the header row in place
        const before = await page.evaluate(() => document.querySelector("thead th")?.getBoundingClientRect().top)
        await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 50 && d.querySelector("table")); if (s) s.scrollTop = 400 })
        await sleep(400)
        const after = await page.evaluate(() => document.querySelector("thead th")?.getBoundingClientRect().top)
        check("2. the header stays in place (sticky) while the rows scroll", Math.abs(before - after) <= 1, `${before} → ${after}`)

        // Pending: the Verified-only columns (and their menus) are not shown
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const pendingHeads = await page.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => ({ title: th.textContent.replace(/\s+/g, " ").trim(), menu: !!th.querySelector("[data-column-menu]") })).filter((h) => h.title))
        check("2. Pending: no Verified By / Verified On column; every other supported column keeps its menu", VERIFIED_ONLY.every((x) => !pendingHeads.some((h) => h.title === x)) && Object.keys(EXPECTED).filter((x) => !VERIFIED_ONLY.includes(x)).every((x) => pendingHeads.find((h) => h.title === x)?.menu), pendingHeads.map((h) => h.title).join(", "))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    if (!relevant.length) note("scope", "mock mode only — live order / headers are checked separately (read-only)")
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
