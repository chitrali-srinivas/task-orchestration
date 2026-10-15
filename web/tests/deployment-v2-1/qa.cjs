/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — exploratory QA for the end-to-end QA report: accessibility scans (axe-core, already a
// project dependency), keyboard behaviour, the date filter's end day, request accounting per tab, reliability under
// repeated navigation, a fast farmer switch, NOC double-click protection and 200 % text zoom. Assertions are PASS /
// FAIL lines; findings that need judgement are INFO lines and are also written to shots/qa-findings.json.
// Exits non-zero on a FAIL.
const fs = require("fs")
const path = require("path")
const L = require("./lib.cjs")
const { check, note, sleep, waitFor } = L

const findings = {}
const record = (key, value) => { findings[key] = value; note(key, typeof value === "string" ? value : JSON.stringify(value).slice(0, 400)) }

/** axe-core over the current document (or a selector), WCAG 2.0 / 2.1 A + AA rules; violations summarised. */
async function axeScan(page, context) {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") })
    return page.evaluate(async (ctx) => {
        const result = await window.axe.run(ctx ? document.querySelector(ctx) : document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] })
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) }))
    }, context ?? null)
}

/** The Data / API Inspector's trace entries (path, source, state). */
async function traceEntries(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(500)
    const entries = await page.evaluate(() => [...document.querySelectorAll("[data-trace-entry]")].map((e) => ({ path: e.getAttribute("data-trace-path"), kind: e.getAttribute("data-trace-kind"), state: e.getAttribute("data-trace-state"), text: e.textContent.replace(/\s+/g, " ").slice(0, 120) })))
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return entries
}

const firstFarmerRow = async (page) => (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── Table: accessibility, keyboard, date filter end day, request accounting ─────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        record("axe: table page (All tab)", await axeScan(page))

        // header dropdown by keyboard: focus → Enter opens the menu → Escape closes it, focus returns to the trigger
        const kb = await page.evaluate(() => { const b = [...document.querySelectorAll("thead th button")][0]; b?.focus(); return { label: b?.textContent.trim(), focused: document.activeElement === b } })
        await page.keyboard.press("Enter")
        const opened = await waitFor(page, () => document.querySelectorAll('[role="menuitem"]').length > 0, 3000)
        await page.keyboard.press("ArrowDown")
        const itemFocused = await page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem")
        await page.keyboard.press("Escape")
        await sleep(300)
        const returned = await page.evaluate(() => document.activeElement?.closest("thead") !== null && document.activeElement?.tagName === "BUTTON")
        check("keyboard: a header dropdown opens with Enter, arrows move through its items, Escape closes it and returns focus to the header", kb.focused && opened && itemFocused && returned, JSON.stringify({ ...kb, opened, itemFocused, returned }))

        // table rows: can a keyboard user open a dispatch? (V2 Oct 26 compared, to tell inherited from new)
        const rowKb = await page.evaluate(() => { const tr = document.querySelector("tbody tr"); return { tabindex: tr?.getAttribute("tabindex"), role: tr?.getAttribute("role"), focusableInside: !!tr?.querySelector("a[href], button:not([disabled]), [tabindex='0']") } })
        record("keyboard: V2.1 table rows (open a dispatch)", rowKb)
        // regression (QA fix): a row is in the tab order and Enter on it opens that dispatch's detail
        await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((tr) => tr.querySelector("[data-dispatch-cell]"))?.focus())
        const rowFocused = await page.evaluate(() => document.activeElement?.tagName === "TR")
        await page.keyboard.press("Enter")
        const kbOpened = await waitFor(page, () => !!document.querySelector("[data-summary-bar]"), 8000)
        await page.keyboard.press("Escape")
        const kbClosed = await waitFor(page, () => !document.querySelector("[data-summary-bar]"), 5000)
        await sleep(400)
        check("keyboard: a table row takes focus (tabindex 0) and Enter opens its dispatch detail", rowKb.tabindex === "0" && rowFocused && kbOpened && kbClosed, JSON.stringify({ ...rowKb, rowFocused, kbOpened, kbClosed }))

        // date filter end day: Submitted on from D to D (a day that has rows) must keep that day's rows
        const target = await page.evaluate(() => {
            const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim())
            const i = heads.indexOf("Submitted on")
            const first = [...document.querySelectorAll("tbody tr")].find((tr) => tr.querySelector("[data-dispatch-cell]"))
            return first ? first.children[i]?.textContent.trim() : null
        })
        record("date filter: target day (first row's Submitted on)", target)
        const pickDay = async (which, iso) => {
            // Submitted on is the sheet's FIRST date section, so its From / To are the first two popover triggers. The
            // table itself is role="grid" too, so every calendar lookup is scoped to [data-slot="calendar"] (the popover).
            const index = which === "from" ? 0 : 1
            const toggle = () => page.evaluate((i) => [...document.querySelectorAll('[role="dialog"] button[aria-haspopup="dialog"]')][i]?.click(), index)
            await toggle()
            if (!(await waitFor(page, () => !!document.querySelector('[data-slot="calendar"] [role="grid"]'), 4000))) return "no calendar"
            const [y, m] = iso.split("-").map(Number)
            for (let i = 0; i < 60; i++) {
                const step = await page.evaluate((ty, tm) => {
                    const label = document.querySelector('[data-slot="calendar"] [role="grid"]')?.getAttribute("aria-label") ?? ""
                    const shown = new Date(`1 ${label}`)
                    if (Number.isNaN(shown.getTime())) return "unreadable:" + label
                    const diff = (ty - shown.getFullYear()) * 12 + (tm - 1 - shown.getMonth())
                    if (diff === 0) return "there"
                    const nav = [...document.querySelectorAll('[data-slot="calendar"] button')].find((b) => (b.getAttribute("aria-label") ?? "") === (diff < 0 ? "Go to the Previous Month" : "Go to the Next Month"))
                    nav?.click()
                    return nav ? "stepped" : "no nav"
                }, y, m)
                if (step === "there") break
                if (step !== "stepped") return step
                await sleep(60)
            }
            const clicked = await page.evaluate((d) => {
                const cell = document.querySelector(`[data-slot="calendar"] td[data-day="${d}"]:not([data-outside]) button`)
                if (!cell) return false
                cell.click()
                return true
            }, iso)
            await sleep(200)
            // close the popover by toggling its own trigger — Escape / an outside click would also dismiss the Filters sheet
            if (await page.evaluate(() => !!document.querySelector('[data-slot="calendar"]'))) await toggle()
            await waitFor(page, () => !document.querySelector('[data-slot="calendar"]'), 3000)
            return clicked ? "picked" : "no day cell"
        }
        let dateCheck = { attempted: false }
        if (target) {
            const [dd, mon, yy] = target.split(" ")
            const months = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }
            const day = `20${yy}-${String(months[mon]).padStart(2, "0")}-${dd.padStart(2, "0")}`
            await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("title") === "Filters" || /^Filters?$/.test(b.getAttribute("aria-label") ?? "") || b.hasAttribute("data-open-filters"))?.click())
            if (await waitFor(page, () => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Filters/.test(d.textContent)), 5000)) {
                // expand the Submitted on section
                await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^Submitted on/.test(b.textContent.trim()))?.click())
                await sleep(400)
                const from = await pickDay("from", day)
                const to = await pickDay("to", day)
                const triggerText = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button[aria-haspopup="dialog"]')].slice(0, 2).map((b) => b.textContent.trim()))
                await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Apply now")?.click())
                await sleep(1500)
                await L.dispatchRowsLoaded(page, 20000)
                const shown = await page.evaluate((t) => {
                    const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim())
                    const i = heads.indexOf("Submitted on")
                    const rows = [...document.querySelectorAll("tbody tr")].filter((tr) => tr.querySelector("[data-dispatch-cell]"))
                    return { rows: rows.length, onDay: rows.filter((tr) => tr.children[i]?.textContent.trim() === t).length, empty: /No (results|records|deployments)/i.test(document.querySelector("tbody")?.textContent ?? "") }
                }, target)
                // the v4 body the table sent for this query (the Inspector's newest getDeploymentMetadata entry)
                await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
                await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
                await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
                await sleep(500)
                const body = await page.evaluate(async () => {
                    const entries = [...document.querySelectorAll('[data-trace-entry][data-trace-path="/adminFarmApp/v4/getDeploymentMetadata"]')]
                    const withDates = []
                    for (const e of entries) {
                        e.querySelector("button")?.click()
                        await new Promise((r) => setTimeout(r, 80))
                        const text = e.querySelector("[data-trace-details]")?.textContent ?? ""
                        const start = text.match(/"created_at_start":\s*(\d+)/)?.[1], end = text.match(/"created_at_end":\s*(\d+)/)?.[1]
                        if (start || end) withDates.push({ start: Number(start), end: Number(end) })
                    }
                    return withDates[0] ?? null
                })
                await page.keyboard.press("Escape")
                await sleep(300)
                const fmt = (ms) => (ms ? new Date(ms).toString().slice(0, 24) : null)
                dateCheck = { attempted: true, day, from, to, triggerText, ...shown, sentStart: fmt(body?.start), sentEnd: fmt(body?.end), endIsEndOfDay: body?.end ? new Date(body.end).getHours() === 23 && new Date(body.end).getMinutes() === 59 : null }
            }
        }
        record("date filter: Submitted on from D to D", dateCheck)
        if (dateCheck.attempted && dateCheck.from === "picked" && dateCheck.to === "picked") {
            check("date filter: a range ending on day D keeps day D's records (end of the range = end of the day, as matic-dash's transformStartDateAndEndDate)", dateCheck.onDay > 0, JSON.stringify(dateCheck))
            check("date filter: the request's created_at_end is the END of the picked day (23:59 local), not its start", dateCheck.endIsEndOfDay === true, JSON.stringify({ sentStart: dateCheck.sentStart, sentEnd: dateCheck.sentEnd }))
        } else {
            note("date filter", "the calendar could not be driven in this run — source evidence only")
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── Request accounting: dispatch reads per tab (status tabs read every loaded list row) ──────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Need Correction")
        await L.dispatchRowsLoaded(page)
        await sleep(1500)
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        const entries = await traceEntries(page)
        const listPages = entries.filter((e) => e.path === "/adminFarmApp/v4/getDeploymentMetadata").length
        const reads = entries.filter((e) => e.path === "/adminDeploymentSec/v3/getTrailerDetails").map((e) => e.text.replace(/^\S+\s+/, ""))
        const byLabel = reads.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map())
        const repeated = [...byLabel].filter(([, n]) => n > 1)
        const rowKeys = new Set(rows.map((r) => r.rowKey))
        record("requests: Need Correction tab", { listPages, dispatchReads: reads.length, allStatusReads: reads.filter((t) => t.includes("all statuses")).length, perStatusReads: reads.filter((t) => !t.includes("all statuses")).length, distinctReads: byLabel.size, rejectedDispatchesShown: rows.length, listRowsWithThem: rowKeys.size, sample: reads.slice(0, 2) })
        check("requests: no identical dispatch read is sent twice while the table settles (the per-status fallback reads are distinct requests)", repeated.length === 0, JSON.stringify(repeated.slice(0, 3)))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── Detail sheet: a11y, Escape, repeated navigation, fast farmer switch ──────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)
        await L.expandAllDispatches(page)
        await sleep(400)
        const detailAxe = await axeScan(page, '[role="dialog"]')
        record("axe: detail sheet (first farmer, cards expanded)", detailAxe)
        // regression (QA fixes): the Close button is named and the farmer avatar image has alt text
        const fixedRules = detailAxe.filter((v) => v.id === "button-name" || v.id === "image-alt")
        const imgs = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] img')].map((i) => ({ alt: i.getAttribute("alt"), rounded: /rounded-full/.test(i.parentElement?.className ?? "") })))
        check("axe: the detail sheet has no button-name or image-alt violation (Close label, avatar alt)", fixedRules.length === 0, JSON.stringify({ fixedRules, avatarImgs: imgs.filter((i) => i.rounded), imgCount: imgs.length }))
        const iconButtons = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title") && !b.querySelector(".sr-only")).length)
        check("every icon-only button in the detail has an accessible name (aria-label / title / sr-only text)", iconButtons === 0, `${iconButtons} unnamed`)
        const headings = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] h1, [role="dialog"] h2, [role="dialog"] h3')].map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 30)}`))
        record("headings in the detail (reading order)", headings)

        // Escape closes the sheet
        await page.keyboard.press("Escape")
        check("Escape closes the detail sheet", await waitFor(page, () => !document.querySelector("[data-summary-bar]"), 5000))

        // repeated open / close + Next through the farmers: errors, DOM growth, heap
        // the table body grows on purpose (Next pages farmers in, in the background); a leak shows in everything else
        const domOutsideRows = () => page.evaluate(() => ({ nodes: document.querySelectorAll("*").length - document.querySelectorAll("tbody, tbody *").length, rows: document.querySelectorAll("tbody tr").length, heap: performance.memory?.usedJSHeapSize ?? null }))
        const before = await domOutsideRows()
        const errorsBefore = L.relevantErrors(errors).length
        for (let i = 0; i < 8; i++) {
            const rows = (await L.dispatchRows(page)).filter((r) => r.id)
            await L.openRow(page, rows[(i * 5) % rows.length].index)
            await L.detailLoaded(page)
            for (let n = 0; n < 3; n++) { await L.clickNav(page, "next"); await sleep(500) }
            await L.closeSheet(page)
        }
        await sleep(1000)
        const after = await domOutsideRows()
        record("reliability: 8 × (open, Next ×3, close)", { before, after, newErrors: L.relevantErrors(errors).length - errorsBefore })
        check("reliability: repeated open / Next / close leaves no extra DOM behind (outside the table rows Next pages in) and raises no page errors", after.nodes <= before.nodes * 1.1 && L.relevantErrors(errors).length === errorsBefore, JSON.stringify({ before: before.nodes, after: after.nodes }))

        // fast farmer switch: Next while the farmer is still loading → the sheet ends on ONE farmer, never mixed
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        await page.evaluate((i) => document.querySelectorAll("tbody tr")[i]?.click(), rows[0].index)
        await waitFor(page, () => !!document.querySelector("[data-summary-bar]"), 10000)
        for (let n = 0; n < 3; n++) { await L.clickNav(page, "next"); await sleep(60) }
        await L.detailLoaded(page)
        await sleep(1200)
        const consistency = await page.evaluate(() => {
            const keys = [...document.querySelectorAll("[data-farmer-row]")].map((s) => s.getAttribute("data-farmer-row"))
            const farmers = [...new Set(keys.map((k) => k.split("-")[0]))]
            return { farmers, name: document.querySelector('[role="dialog"] h2')?.textContent.trim() ?? "", position: [...document.querySelectorAll('[role="dialog"] span')].find((s) => /^\d+ \/ \d+$/.test(s.textContent.trim()))?.textContent.trim() }
        })
        check("fast farmer switch: after clicking Next during loading, every deployment shown belongs to ONE farmer (no stale mix)", consistency.farmers.length === 1, JSON.stringify(consistency))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── NOC review: a11y and double-click protection ──────────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)
        await L.openNocReview(page)
        await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)
        record("axe: NOC review dialog", await axeScan(page, "[data-noc-review]"))
        // a real double click on Approve (two input events): one decision request only
        await page.click("[data-noc-approve]", { count: 2 })
        await waitFor(page, () => /Noc qualified successfully/.test(document.body.innerText), 8000)
        await sleep(1500)
        // and two clicks dispatched in the SAME task (no render between them) — the stricter case
        await page.evaluate(() => { const b = document.querySelector("[data-noc-approve]"); b?.click(); b?.click() })
        await waitFor(page, () => [...document.body.innerText.matchAll(/Noc qualified successfully/g)].length >= 1, 8000)
        await sleep(1500)
        await L.closeNocReview(page)
        await L.closeSheet(page)
        const decisions = (await traceEntries(page)).filter((e) => e.path === "/adminDeploymentSec/updateFarmerDeploymentNOC").length
        check("NOC Approve: a double click and two same-task clicks send ONE decision each (2 in total, never 3–4)", decisions === 2, `${decisions} updateFarmerDeploymentNOC`)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 200 % text zoom: the table toolbar and the detail header reflow without horizontal overflow ─────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
        await sleep(600)
        const row = await firstFarmerRow(page)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(800)
        const zoom = await page.evaluate(() => {
            const sheet = document.querySelector("[data-summary-bar]")?.closest('[role="dialog"]')
            const bands = [...document.querySelectorAll("[data-detail-identity], [data-farmer-details], [data-summary-bar], [data-farmer-noc]")]
            return { sheetScrollsX: sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : null, bandOverflow: bands.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => [...b.attributes].map((a) => a.name).find((n) => n.startsWith("data-"))), closeVisible: !!document.querySelector("[data-detail-identity] button")?.getBoundingClientRect().width }
        })
        record("200 % text zoom: detail header", zoom)
        await L.screenshot(page, "qa-zoom-200.png")
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    fs.writeFileSync(path.join(L.OUT, "qa-findings.json"), JSON.stringify(findings, null, 2))
    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
