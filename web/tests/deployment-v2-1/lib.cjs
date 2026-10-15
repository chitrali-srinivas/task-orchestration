/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Shared helpers for the Deployment V2.1 browser suites (puppeteer-core over the installed Chrome, headless), against the
// running app in MOCK mode. Every request to a Matic API / Firebase host is aborted: nothing reaches an API.
// Settings (environment): BASE = the running app (default the `npm run dev` port), CHROME_PATH = the Chrome binary,
// PROFILE = a scratch Chrome profile name (created in the OS temp folder; give parallel runs different names).
// Screenshots go to tests/deployment-v2-1/shots/ (git-ignored).
const puppeteer = require("puppeteer-core")
const path = require("path")
const fs = require("fs")
const os = require("os")

const BASE = process.env.BASE || "http://127.0.0.1:3000"
const OUT = path.join(__dirname, "shots")
const DEFAULT_CHROME = {
    win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "/usr/bin/google-chrome",
}
const CHROME = process.env.CHROME_PATH || DEFAULT_CHROME[process.platform] || DEFAULT_CHROME.linux
fs.mkdirSync(OUT, { recursive: true })

const V21 = "/layouts/deployment-v2-1"
const V2 = "/layouts/deployment-v2-oct-26"
const API_HOST = /maticarbon|identitytoolkit|securetoken|firebaseinstallations/

const state = { failures: 0, passes: 0 }
const check = (name, ok, extra = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`)
    if (ok) state.passes++
    else state.failures++
}
const note = (name, extra) => console.log(`INFO  ${name}${extra ? "  — " + extra : ""}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(page, fn, timeout = 15000, ...args) {
    try { await page.waitForFunction(fn, { timeout, polling: 150 }, ...args); return true } catch { return false }
}
async function domClick(page, selector, timeout = 10000) {
    await page.waitForSelector(selector, { timeout })
    await page.$eval(selector, (el) => el.click())
}
const exists = async (page, selector) => !!(await page.$(selector))

async function launch() {
    return puppeteer.launch({
        executablePath: CHROME, headless: "new", userDataDir: path.join(os.tmpdir(), `deployment-v21-${process.env.PROFILE || "default"}`),
        args: ["--window-size=1600,1000", "--no-first-run", "--no-default-browser-check", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
        defaultViewport: { width: 1600, height: 1000 },
    })
}

/** A new tab on BASE + url: errors collected, API hosts blocked (counted in page.blockedApi).
 *  `fulfil`: [{ match: RegExp, body: Buffer, contentType }] — matching requests are answered from those bytes
 *  (honouring a Range header, so a video can seek) instead of the network. */
async function open(browser, url, sink, { fulfil = [] } = {}) {
    const page = await browser.newPage()
    page.blockedApi = []
    page.on("console", (m) => { if (m.type() === "error") sink.push(m.text().slice(0, 300)) })
    page.on("pageerror", (e) => sink.push("pageerror: " + String(e).slice(0, 300)))
    await page.setRequestInterception(true)
    page.on("request", (r) => {
        if (r.isInterceptResolutionHandled()) return
        const local = fulfil.find((f) => f.match.test(r.url()))
        if (local) {
            const size = local.body.length
            const range = /bytes=(\d*)-(\d*)/.exec(r.headers().range || "")
            const headers = { "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes" }
            if (!range) return r.respond({ status: 200, contentType: local.contentType, headers, body: local.body })
            const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
            const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1
            return r.respond({ status: 206, contentType: local.contentType, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}` }, body: local.body.subarray(start, end + 1) })
        }
        const host = new URL(r.url()).host
        if (API_HOST.test(host)) { page.blockedApi.push(`${r.method()} ${host}`); return r.abort("blockedbyclient") }
        r.continue()
    })
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 180000 })
    return page
}
const relevantErrors = (errors) => errors.filter((e) => !/Download the React DevTools|favicon|ERR_FILE_NOT_FOUND|net::ERR|Failed to load resource|ERR_BLOCKED_BY_CLIENT|hydrat/i.test(e))

/** The list page loaded (V2.1: its rows are dispatch rows — one per dispatch ID — plus note rows while a list row's dispatches load / failed). */
const rowsLoaded = (page, timeout = 90000) => waitFor(page, () => document.querySelectorAll("tbody tr").length > 0 && !document.querySelector("tbody tr td[colspan]"), timeout)
/** The table's rows are in and their Boundaries values settled (V2.1: rows ARE the list's dispatch rows; only the Boundaries column reads further). */
const dispatchRowsLoaded = (page, timeout = 90000) => waitFor(page, () => document.querySelectorAll("tbody tr").length > 0 && !document.querySelector('[data-dispatch-boundaries-state="loading"]') && !document.querySelector("tbody tr td[colspan]"), timeout)
/** V2.1: scrolls the table until every row of the query is loaded (the tab's server total), or `max` scrolls. */
async function loadAllRows(page, max = 12) {
    const state = () => page.evaluate(() => { const g = document.querySelector("[data-dispatch-grain]"); return g ? { rows: Number(g.getAttribute("data-dispatch-rows")), total: Number(g.getAttribute("data-dispatch-total")) } : null })
    for (let i = 0; i < max; i++) {
        const g = await state()
        if (g && g.rows >= g.total) break
        await page.evaluate(() => { const s = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 50 && d.querySelector("table")); if (s) s.scrollTop = s.scrollHeight })
        await waitFor(page, (before) => Number(document.querySelector("[data-dispatch-grain]")?.getAttribute("data-dispatch-rows")) > before, 8000, g?.rows ?? 0)
    }
    await dispatchRowsLoaded(page)
    const g = await state()
    return !!g && g.rows >= g.total
}
/** The dispatch rows of the table (V2.1): dispatch id, status, farmer / AZ cells, quantities, boundaries, validation. */
const dispatchRows = (page) => page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((tr, index) => {
    const cell = tr.querySelector("[data-dispatch-cell]")
    const value = (attr) => { const el = tr.querySelector(`[data-cell="${attr}"]`); return !el ? undefined : el.hasAttribute("data-cell-missing") ? null : Number(el.getAttribute("data-value")) }
    return {
        index,
        /** The dispatch_id (V2.1: a list row IS a dispatch). */
        id: cell?.getAttribute("data-dispatch-cell") || null,
        note: null,
        status: tr.querySelector("[data-dispatch-status]")?.getAttribute("data-dispatch-status") ?? null,
        // by header title, not position (the column order is a product decision and changes)
        farmer: tr.children[[...document.querySelectorAll("thead th")].findIndex((th) => th.textContent.replace(/\s+/g, " ").trim() === "Farmer")]?.textContent.replace(/\s+/g, " ").trim() ?? "",
        village: tr.children[[...document.querySelectorAll("thead th")].findIndex((th) => th.textContent.replace(/\s+/g, " ").trim() === "Village")]?.textContent.replace(/\s+/g, " ").trim() ?? "",
        /** The list row the dispatch belongs to (farmer + deployment + AZ; the deployment number is never displayed). */
        rowKey: tr.querySelector("[data-row-key]")?.getAttribute("data-row-key") ?? null,
        /** The list row's `status` filter value (need_correction = rejected) — the dispatch's own status is `status`. */
        rowStatus: tr.querySelector("[data-row-status]")?.getAttribute("data-row-status") ?? null,
        az: tr.querySelector("[data-row-az]")?.getAttribute("data-row-az") ?? null,
        azName: tr.querySelector("[data-row-az-name]")?.textContent.trim() ?? null,
        plots: value("plots") ?? 0,
        area: value("area"),
        calArea: value("cal-area"),
        deployed: value("deployed"),
        boundaries: Number(tr.querySelector("[data-dispatch-boundaries]")?.getAttribute("data-dispatch-boundaries") ?? 0),
        boundariesState: tr.querySelector("[data-dispatch-boundaries-state]")?.getAttribute("data-dispatch-boundaries-state") ?? null,
        validation: tr.querySelector("[data-dispatch-validation]") ? Number(tr.querySelector("[data-dispatch-validation]").getAttribute("data-validation-count")) : null,
    }
}))
/** The plot count of a table row ("Plots" in both V2 Oct 26 and V2.1). */
const plotsOf = (row) => Number((row.by["Plots"] ?? "").split(" ")[0] || 0)
async function selectTab(page, name) {
    await page.evaluate((n) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(n))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })), name)
    await page.evaluate((n) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(n))?.click(), name)
    await waitFor(page, (n) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(n))?.getAttribute("data-state") === "active", 5000, name)
    await sleep(1200)
}
/** The table's rows as cell texts keyed by header ("Farmer", "Plots", "AZs", …). */
const tableRows = (page) => page.evaluate(() => {
    const heads = [...document.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim())
    return [...document.querySelectorAll("tbody tr")].map((tr, index) => {
        const cells = [...tr.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim())
        return { index, cells, by: Object.fromEntries(heads.map((h, i) => [h, cells[i] ?? ""])) }
    })
})
/** Opens the table row at `index` (V2.1: a dispatch row opens its FARMER's detail) and waits for the detail's row sections and cards. */
async function openRow(page, index) {
    await page.evaluate((i) => document.querySelectorAll("tbody tr")[i]?.click(), index)
    await waitFor(page, () => document.querySelectorAll("[data-farmer-row]").length > 0 && (document.querySelectorAll("[data-dispatch-row]").length > 0 || !!document.querySelector('[data-dispatch-empty]:not([data-dispatch-empty="loading"])')), 30000)
    await sleep(1500)
}
/** Opens a row of the V2 Oct 26 table (its detail is per list row: dispatch cards or an empty / error state). */
async function openV2Row(page, index) {
    await page.evaluate((i) => document.querySelectorAll("tbody tr")[i]?.click(), index)
    await waitFor(page, () => document.querySelectorAll("[data-dispatch-row]").length > 0 || !!document.querySelector("[data-dispatch-empty]"), 30000)
    await sleep(1500)
}
/** Waits until no row section of the open detail is still loading its dispatches. */
const detailLoaded = (page, timeout = 30000) => waitFor(page, () => document.querySelectorAll("[data-farmer-row]").length > 0 && !document.querySelector('[data-dispatch-empty="loading"]') && !document.querySelector("[data-detail-loading]"), timeout)
/** Expands every collapsed dispatch card in the detail. */
const expandAllDispatches = (page) => page.evaluate(() => document.querySelectorAll("[data-dispatch-toggle]").forEach((t) => { if (!t.closest("[data-dispatch-row]")?.querySelector("[data-dispatch-body]")) t.click() }))
/** The detail's AZ sections (the Samples pattern): code, id, how many deployments (rows) it holds, collapsed, card count. */
const azSections = (page) => page.evaluate(() => [...document.querySelectorAll("[data-az-section]")].map((s) => ({
    code: s.getAttribute("data-az-section"),
    azId: s.getAttribute("data-az-id"),
    rows: Number(s.getAttribute("data-az-rows")),
    collapsed: s.hasAttribute("data-az-collapsed"),
    shown: Number(s.querySelector("[data-az-count]")?.getAttribute("data-az-count") ?? 0),
    total: Number(s.querySelector("[data-az-total]")?.getAttribute("data-az-total") ?? 0),
    cards: s.querySelectorAll("[data-dispatch-row]").length,
    captions: [...s.querySelectorAll("[data-row-caption]")].map((c) => c.textContent.replace(/\s+/g, " ").trim()),
})))
/** The detail's deployment blocks (one per list row, inside their AZ section): key, status, type, card ids / statuses. */
const detailSections = (page) => page.evaluate(() => [...document.querySelectorAll("[data-farmer-row]")].map((s) => ({
    key: s.getAttribute("data-farmer-row"),
    /** "true" when every dispatch of the deployment group is approved. */
    groupVerified: s.getAttribute("data-group-verified"),
    az: s.getAttribute("data-row-az"),
    azSection: s.closest("[data-az-section]")?.getAttribute("data-az-section") ?? null,
    type: s.getAttribute("data-row-type"),
    empty: s.querySelector("[data-dispatch-empty]")?.getAttribute("data-dispatch-empty") ?? null,
    cards: [...s.querySelectorAll("[data-dispatch-row]")].map((c) => ({ id: c.getAttribute("data-dispatch-row"), dispatchId: c.getAttribute("data-dispatch-id"), validation: !!c.querySelector("[data-dispatch-validation-notice]"), status: c.getAttribute("data-dispatch-status"), view: c.getAttribute("data-dispatch-view"), expanded: c.hasAttribute("data-expanded"), gate: c.querySelector("[data-approve-gate]")?.getAttribute("data-approve-gate") ?? null, blocker: c.querySelector("[data-approve-blocker]") ? [...c.querySelectorAll("[data-approve-blocker]")].map((b) => b.textContent.replace(/\s+/g, " ").trim()).join(" | ") : null, blockerKinds: c.querySelector("[data-approve-gate]")?.getAttribute("data-approve-blockers") ?? null, history: c.querySelector("[data-history-indicator]")?.getAttribute("data-history-indicator") ?? null, historyEntries: !!c.querySelector("[data-history-entries]") })),
})))
/** The detail heading's farmer-level NOC / Pre-Sample actions (V2's icons), as rendered. */
const headerActions = (page) => page.evaluate(() => {
    const noc = document.querySelector("[data-summary-bar] [data-open-noc]")
    const pre = document.querySelector("[data-summary-bar] [data-open-pre-sample]")
    return {
        noc: noc ? { state: noc.getAttribute("data-noc-state"), label: noc.getAttribute("aria-label") } : null,
        preSample: pre ? { count: pre.getAttribute("data-pre-sample-count"), label: pre.getAttribute("aria-label") } : null,
        historyInHeader: !!document.querySelector("[data-summary-bar] [data-open-history]"),
    }
})
/** The FARMER's NOC readiness strip in the fixed header (under the summary bar): readiness, text, its action, counts. */
const farmerNoc = (page) => page.evaluate(() => {
    const wrap = document.querySelector("[data-farmer-noc]")
    if (!wrap) return null
    const strip = wrap.querySelector("[data-noc-readiness]")
    return {
        readiness: wrap.getAttribute("data-farmer-noc"),
        undecided: Number(wrap.getAttribute("data-noc-undecided")),
        approved: Number(wrap.getAttribute("data-noc-approved")),
        missing: Number(wrap.getAttribute("data-noc-missing")),
        text: strip?.querySelector("[data-noc-readiness-text]")?.textContent.trim() ?? "",
        action: strip?.querySelector("[data-noc-action]")?.textContent.trim() ?? null,
        inHeader: !!strip && strip.closest("[data-radix-scroll-area-viewport]") === null && strip.closest("[data-az-section]") === null,
        count: document.querySelectorAll("[data-noc-readiness]").length,
    }
})
/** The direct NOC review (the preview dialog): what it shows — a document (with its position, status, actions) or a loading / error / empty state. */
const nocReview = (page) => page.evaluate(() => {
    const dialog = document.querySelector("[data-noc-review]")
    if (!dialog) return null
    const footer = dialog.querySelector("[data-noc-footer]")
    return {
        state: dialog.getAttribute("data-noc-review"),
        key: dialog.getAttribute("data-noc-current"),
        az: dialog.getAttribute("data-noc-az"),
        status: dialog.getAttribute("data-noc-current-status"),
        position: dialog.getAttribute("data-noc-position"),
        pager: dialog.querySelector("[data-noc-pager]")?.getAttribute("data-noc-pager") ?? null,
        prevDisabled: dialog.querySelector("[data-noc-prev]")?.disabled ?? null,
        nextDisabled: dialog.querySelector("[data-noc-next]")?.disabled ?? null,
        label: footer ? ([...footer.querySelectorAll("p")].find((p) => /^NOC — /.test(p.textContent))?.textContent.trim() ?? "") : "",
        statusLine: footer?.querySelector("[data-noc-status-line]")?.textContent.replace(/\s+/g, " ").trim() ?? "",
        approve: !!dialog.querySelector("[data-noc-approve]"),
        report: !!dialog.querySelector("[data-noc-report]"),
        retry: !!dialog.querySelector("[data-noc-retry]"),
        image: !!dialog.querySelector("img[alt='Preview']"),
        imageFailed: !!dialog.querySelector('[data-preview-state="failed"]'),
        stateText: dialog.querySelector("[data-noc-state]")?.textContent.replace(/\s+/g, " ").trim() ?? "",
        listLayer: !!document.querySelector("[data-noc-dialog], [data-noc-doc], [data-noc-view]"),
    }
})
/** Opens the NOC review from the header icon and waits for the dialog. */
async function openNocReview(page) {
    await page.evaluate(() => document.querySelector("[data-summary-bar] [data-open-noc]")?.click())
    return waitFor(page, () => !!document.querySelector("[data-noc-review]"), 8000)
}
async function closeNocReview(page) {
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-noc-review]"), 5000)
    await sleep(300)
}
async function closeSheet(page) {
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-dispatch-row]") && !document.querySelector("[data-summary-bar]"), 6000)
    await sleep(500)
}
/** The detail footer's Previous / Next: the buttons either side of the "n / total" counter. */
const clickNav = (page, which) => page.evaluate((w) => {
    const counter = document.querySelector('[role="dialog"] [data-nav-counter]') ?? [...document.querySelectorAll('[role="dialog"] span')].find((s) => /^\d+ \/ \d+\+?$/.test(s.textContent.trim()))
    const button = w === "next" ? counter?.nextElementSibling : counter?.previousElementSibling
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false
    button.click()
    return true
}, which)

async function screenshot(page, name) { await page.screenshot({ path: path.join(OUT, name) }) }
const finish = async (browser) => {
    console.log(state.failures ? `\n${state.passes} passed, ${state.failures} FAILED` : `\nALL PASS (${state.passes})`)
    await browser.close()
    process.exit(state.failures ? 1 : 0)
}

module.exports = { BASE, OUT, V21, V2, state, check, note, sleep, waitFor, domClick, exists, launch, open, relevantErrors, rowsLoaded, dispatchRowsLoaded, loadAllRows, dispatchRows, plotsOf, selectTab, tableRows, openRow, openV2Row, detailLoaded, expandAllDispatches, azSections, detailSections, headerActions, farmerNoc, nocReview, openNocReview, closeNocReview, closeSheet, clickNav, screenshot, finish }
