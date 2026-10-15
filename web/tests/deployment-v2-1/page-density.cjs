/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the list page's chrome (page.tsx padding, data-table-toolbar.tsx, data-table.tsx):
//   - more table rows on screen than before the compact pass (measured before it: 9 / 8 / 7 fully visible rows at
//     1600×900 / 1280×800 / 1024×768 — page p-6, toolbar h-10, header h-12, cells p-4);
//   - the table starts ≤ 130 px from the top; header row ≤ 40 px; data rows ≤ 56 px with nothing clipped in a cell;
//   - every tab fully visible and unclipped (≥ 1024 px); the tab strip, Inspector, Filters and Columns are all present,
//     ≥ 36 px, and don't overlap; no horizontal page scroll;
//   - 768 px: the same controls present, inside the viewport, not overlapping; the last tab reachable by scrolling the
//     tab strip;
//   - only a vertical scroll loads the next page: with the end of the loaded rows within the load-more distance (the
//     denser rows bring it there sooner), scrolling sideways to reach a column fetches nothing; scrolling down does;
//   - Deployment V2 Oct 26 keeps its own spacing (page p-6, header h-12, cells p-4) — the compact pass is V2.1-only.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const BEFORE = { "1600x900": 9, "1280x800": 8, "1024x768": 7 }
const measure = (page) => page.evaluate(() => {
    const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height } }
    const table = document.querySelector("table")
    const scroller = table?.closest("div.overflow-auto") ?? table?.parentElement
    const sb = scroller.getBoundingClientRect()
    const rows = [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]"))
    const visible = rows.filter((tr) => { const b = tr.getBoundingClientRect(); return b.top >= sb.top && b.bottom <= sb.bottom })
    const clipped = visible.slice(0, 10).flatMap((tr) => [...tr.querySelectorAll("td")].filter((td) => td.scrollHeight > td.clientHeight + 1).map((td) => td.textContent.trim().slice(0, 30)))
    const tablist = document.querySelector('[role="tablist"]')
    const strip = tablist?.parentElement?.closest(".overflow-x-auto") ?? tablist
    const stripBox = box(strip)
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => ({ name: t.textContent.trim().replace(/\s+/g, " "), box: box(t), truncated: t.scrollWidth > t.clientWidth + 1 }))
    const controls = {
        tabs: stripBox,
        inspector: box(document.querySelector("[data-inspector-trigger]")),
        filters: box(document.querySelector('button[title="Filters"]') ?? [...document.querySelectorAll("button")].find((b) => /\bfilters?\b/i.test(b.textContent))),
        columns: box(document.querySelector('button[title="Columns"]')),
    }
    return {
        tableTop: Math.round(sb.top), header: Math.round(box(document.querySelector("thead tr"))?.h ?? 0), row: Math.round(box(rows[0])?.h ?? 0),
        visible: visible.length, clipped, tabs, tablist: box(tablist), stripBox, controls,
        pageOverflow: document.documentElement.scrollWidth - innerWidth, vw: innerWidth, vh: innerHeight,
    }
})
const overlap = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5
const pairsOverlapping = (controls) => {
    const names = Object.keys(controls).filter((k) => controls[k])
    const out = []
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (overlap(controls[names[i]], controls[names[j]])) out.push(`${names[i]}×${names[j]}`)
    return out
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    const page = await L.open(browser, L.V21, errors)
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)

    for (const [w, h] of [[1600, 900], [1280, 800], [1024, 768]]) {
        await page.setViewport({ width: w, height: h })
        await sleep(900)
        const m = await measure(page)
        const key = `${w}x${h}`
        check(`${key}: more rows on screen than before the pass (${BEFORE[key]})`, m.visible > BEFORE[key], `${m.visible} rows`)
        check(`${key}: the table starts ≤ 130 px down; header ≤ 40 px; rows ≤ 56 px; no cell clipped`, m.tableTop <= 130 && m.header <= 40 && m.row <= 56 && m.clipped.length === 0, JSON.stringify({ tableTop: m.tableTop, header: m.header, row: m.row, clipped: m.clipped }))
        const hidden = m.tabs.filter((t) => t.truncated || t.box.x < m.stripBox.x - 0.5 || t.box.r > m.stripBox.r + 0.5 || t.box.y < m.tablist.y - 0.5 || t.box.b > m.tablist.b + 0.5)
        check(`${key}: all four tabs fully visible, labels unclipped`, m.tabs.length === 4 && hidden.length === 0, m.tabs.map((t) => `${t.name} ${Math.round(t.box.w)}×${Math.round(t.box.h)}`).join(" · "))
        const missing = Object.entries(m.controls).filter(([, b]) => !b).map(([k]) => k)
        const small = Object.entries(m.controls).filter(([k, b]) => b && (b.h < 36 || (k !== "tabs" && b.w < 36))).map(([k, b]) => `${k} ${Math.round(b.w)}×${Math.round(b.h)}`)
        check(`${key}: tab strip, Inspector, Filters and Columns present, ≥ 36 px, not overlapping`, missing.length === 0 && small.length === 0 && pairsOverlapping(m.controls).length === 0, JSON.stringify({ missing, small, overlapping: pairsOverlapping(m.controls) }))
        check(`${key}: no horizontal page scroll`, m.pageOverflow <= 0, `${m.pageOverflow}px`)
    }

    // ── narrow ───────────────────────────────────────────────────────────────────────────────────────────────────────
    await page.setViewport({ width: 768, height: 1024 })
    await sleep(900)
    const n = await measure(page)
    const missing = Object.entries(n.controls).filter(([, b]) => !b).map(([k]) => k)
    const outside = Object.entries(n.controls).filter(([, b]) => b && (b.x < 0 || b.r > n.vw + 0.5)).map(([k]) => k)
    check("768 px: tab strip, Inspector, Filters and Columns present, inside the viewport, not overlapping", missing.length === 0 && outside.length === 0 && pairsOverlapping(n.controls).length === 0, JSON.stringify({ missing, outside, overlapping: pairsOverlapping(n.controls) }))
    check("768 px: no horizontal page scroll; rows on screen", n.pageOverflow <= 0 && n.visible > 0, JSON.stringify({ overflow: n.pageOverflow, rows: n.visible }))
    const last = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('[role="tab"]')]
        const t = tabs[tabs.length - 1]
        t.scrollIntoView({ inline: "end", block: "nearest" })
        const strip = t.closest(".overflow-x-auto")
        const s = strip.getBoundingClientRect(), b = t.getBoundingClientRect()
        return { name: t.textContent.trim(), inside: b.left >= s.left - 0.5 && b.right <= s.right + 0.5 }
    })
    check("768 px: the last tab can be scrolled into the strip", last.inside, JSON.stringify(last))
    blocked.push(...page.blockedApi)
    await page.close()

    // ── load more: sideways scrolling never fetches the next page ────────────────────────────────────────────────────
    {
        const page2 = await L.open(browser, L.V21, errors)
        await page2.setViewport({ width: 1100, height: 700 })
        await L.rowsLoaded(page2)
        await L.selectTab(page2, "All")
        await L.dispatchRowsLoaded(page2)
        await sleep(1000)
        const rowsNow = () => page2.evaluate(() => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")))
        const scroller = () => page2.evaluate(() => { const el = document.querySelector("table").closest("div.overflow-auto"); return { toEnd: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight), sideways: el.scrollWidth > el.clientWidth } })
        const first = await rowsNow()
        // a taller window: the end of the loaded rows is now within the load-more distance, with no scroll yet
        await page2.setViewport({ width: 1100, height: 1200 })
        await sleep(1200)
        const pre = { rows: await rowsNow(), ...(await scroller()) }
        await page2.evaluate(() => { document.querySelector("table").closest("div.overflow-auto").scrollLeft = 240 })
        await sleep(1500)
        const sideways = await rowsNow()
        check("load more: a sideways scroll fetches no rows, even with the end of the loaded rows within reach", pre.rows === first && pre.toEnd <= 240 && pre.sideways && sideways === first, JSON.stringify({ first, pre, afterSideways: sideways }))
        await page2.evaluate(() => { document.querySelector("table").closest("div.overflow-auto").scrollTop += 1 })
        const loaded = await waitFor(page2, (n) => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > n, 8000, first)
        check("load more: scrolling down loads the next page", loaded, JSON.stringify({ first, now: await rowsNow() }))
        blocked.push(...page2.blockedApi)
        await page2.close()
    }

    // ── V2 Oct 26 untouched ──────────────────────────────────────────────────────────────────────────────────────────
    {
        const v2 = await L.open(browser, L.V2, errors)
        await L.rowsLoaded(v2)
        await v2.setViewport({ width: 1600, height: 900 })
        await sleep(900)
        const s = await v2.evaluate(() => {
            const th = document.querySelector("thead tr")
            const td = document.querySelector("tbody tr td")
            const page = document.querySelector("table")?.closest(".p-6")
            return { header: Math.round(th.getBoundingClientRect().height), cellPad: getComputedStyle(td).paddingTop, pagePad: page ? getComputedStyle(page).paddingTop : null }
        })
        check("V2 Oct 26 keeps its own spacing (page 24 px, header 48 px, cells 16 px)", s.header === 48 && s.cellPad === "16px" && s.pagePad === "24px", JSON.stringify(s))
        blocked.push(...v2.blockedApi)
        await v2.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
