/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Edge states for /layouts/samples (demo dataset) + Deployment V2 regression (list, detail, trailer groups, map).
const L = require("./lib.cjs")
const { check, sleep, waitFor, click, domClick, text, attr, exists, texts } = L

;(async () => {
    const browser = await L.launch()
    const errors = []
    const open = async (url) => {
        const page = await browser.newPage()
        L.collectErrors(page, errors)
        await page.goto(L.BASE + url, { waitUntil: "domcontentloaded", timeout: 120000 })
        return page
    }
    const findRow = (page, pred) => page.$$eval("[data-row-id]", (rows, src) => { const f = new Function("t", `return ${src}`); return rows.find((r) => f([...r.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")))?.getAttribute("data-row-id") }, pred)
    const openFarmerSample = async (page, tab, farmerId, pred) => {
        await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 60000)
        if (tab) await L.selectTab(page, tab)
        await L.applyFilter(page, "farmer", farmerId)
        await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 10000)
        const rowId = pred ? await findRow(page, pred) : await attr(page, "[data-row-id]", "data-row-id")
        if (!rowId) throw new Error(`no row for ${farmerId} ${pred}`)
        await domClick(page, `[data-row-id="${rowId}"]`)
        await waitFor(page, (f) => !!document.querySelector(`[data-sample-detail="${f}"]`) && document.querySelectorAll("[data-sample-card]").length > 0, 15000, farmerId)
        return rowId
    }
    const EOY_AZ2 = 't.includes("| EOY |") && t.includes("| AZ2 |") && t.includes("Boundary required")'

    // 1. list failure → error state + Retry
    {
        const page = await open("/layouts/samples?mockFail=list")
        check("list failure shows the error state", await waitFor(page, () => document.querySelector('[data-table-state="error"]')?.textContent.includes("mock failure"), 30000))
        await page.evaluate(() => [...document.querySelectorAll('[data-table-state="error"] button')].find((b) => b.textContent.includes("Retry"))?.click())
        check("Retry recovers the list", await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 10000))
        await page.close()
    }
    // 2. view-only permission on a pending deployment sample
    {
        const page = await open("/layouts/samples?mockPermission=view")
        const rowId = await openFarmerSample(page, "pending", "F-0073", 't.includes("Deployment")')
        check("view-only: Approve + Report disabled with the server's reason", await waitFor(page, (id) => { const c = document.querySelector(`[data-sample-card="${id}"][data-expanded]`); return !!c && c.querySelector("[data-approve-sample]").disabled && c.querySelector("[data-start-report]").disabled && /permission/.test(c.querySelector('[data-approve-blocker="no_permission"]')?.textContent ?? "") }, 8000, rowId))
        check("no validation strip in this state", !(await exists(page, '[data-strip="validation"]')))
        await page.close()
    }
    // 3. ?mockNames=off → the export as it is (ids and roles, no directory names)
    {
        const page = await open("/layouts/samples?mockNames=off")
        await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 60000)
        const cells = await page.$$eval("[data-row-id]", (rows) => rows.slice(0, 5).map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim())))
        check("names off: farmer = derived id, surveyor / verifier = role + masked phone, AZ name '-'", cells.every((c) => /F-\d{4}/.test(c[1]) && /^Surveyor\s*\*{6,}\d{4}$/.test(c[9]) && /^Verifier\s*\*{6,}\d{4}$/.test(c[10]) && c[8] === "-"), cells[0].slice(1, 11).join(" | "))
        await page.close()
    }
    // 4. boundary save failure → editor keeps the shape + Retry (strip action)
    {
        const page = await open("/layouts/samples?mockFail=boundary")
        await openFarmerSample(page, "pending", "F-0073", EOY_AZ2)
        await waitFor(page, () => !!document.querySelector('[data-strip="boundary"]'), 10000)
        await page.evaluate(() => [...document.querySelectorAll('[data-strip="boundary"] button')].find((b) => /draw boundary/i.test(b.textContent))?.click())
        const editor = await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)
        check("strip action opens the editor", editor)
        if (editor) {
            await sleep(2000)
            const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
            const cx = box.x + box.w / 2, cy = box.y + box.h / 2, d = 150
            for (const [dx, dy] of [[-d, -d], [d, -d], [d, d], [-d, d]]) { await page.mouse.click(cx + dx, cy + dy); await sleep(700) }
            await click(page, "[data-boundary-finish]")
            await click(page, "[data-boundary-save]")
            check("save failure shown, shape kept", await waitFor(page, () => !!document.querySelector("[data-boundary-error]") && document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 8000))
            await click(page, "[data-boundary-retry]")
            check("Retry saves", await waitFor(page, () => !document.querySelector("[data-boundary-editor]") && !!document.querySelector('[data-toast="success"]'), 10000))
        }
        await page.close()
    }
    // 5. invalid boundary → server reason; discard
    {
        const page = await open("/layouts/samples")
        const rowId = await openFarmerSample(page, "pending", "F-0073", EOY_AZ2)
        await domClick(page, `[data-sample-card="${rowId}"] [data-draw-boundary]`)
        if (await waitFor(page, () => !!document.querySelector("[data-boundary-editor] .gm-style"), 20000)) {
            await sleep(2000)
            const box = await page.$eval("[data-boundary-editor] .gm-style", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
            const x0 = box.x + 80, y0 = box.y + 200
            for (const [dx, dy] of [[0, 0], [90, 0], [90, 90], [0, 90]]) { await page.mouse.click(x0 + dx, y0 + dy); await sleep(700) }
            await click(page, "[data-boundary-finish]")
            await click(page, "[data-boundary-save]")
            const msg = await waitFor(page, () => !!document.querySelector("[data-boundary-error]"), 8000) ? await text(page, "[data-boundary-error]") : ""
            check("server rejects a boundary that misses the sample", /must contain the sample/.test(msg), msg.slice(0, 100))
            await click(page, "[data-boundary-cancel]")
            await click(page, "[data-boundary-discard]")
            check("discard closes the editor", await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 5000))
        } else check("editor opens", false)
        await page.close()
    }
    // 6. edit an existing saved boundary (F-0214, generated plot) from the map control
    {
        const page = await open("/layouts/samples")
        await openFarmerSample(page, "pending", "F-0214", null)
        await waitFor(page, () => !!document.querySelector("[data-samples-map] .gm-style") && !!document.querySelector("[data-map-ready]"), 20000)
        await sleep(2000)
        const offered = await waitFor(page, () => !document.querySelector("[data-map-draw-boundary]")?.disabled, 5000)
        check("saved boundary: map control offers Edit for the selected sample's generated plot", offered)
        if (offered) {
            await click(page, "[data-map-draw-boundary]")
            check("editor opens in EDIT mode with the saved outline", await waitFor(page, () => document.querySelector("[data-boundary-editor]")?.getAttribute("data-boundary-mode") === "edit", 15000))
            await click(page, "[data-boundary-cancel]")
            await waitFor(page, () => !document.querySelector("[data-boundary-editor]"), 5000)
        }
        await page.close()
    }
    // 7. CSV rejection (F-0072 'location invalid'), unchanged by the demo
    {
        const page = await open("/layouts/samples")
        const rowId = await openFarmerSample(page, "need_correction", "F-0072", 't.includes("EOWB62")')
        check("Need Correction default filter; correction block names GPS Coordinates; Firebase picture with View; no actions", (await attr(page, "[data-detail-filter]", "data-detail-filter")) === "need_correction" && await page.$eval(`[data-sample-card="${rowId}"]`, (c) => /location invalid/.test(c.textContent) && /GPS Coordinates/.test(c.textContent) && c.querySelector('[data-detail-row="picture"] [data-picture-view]')?.textContent.trim() === "View" && !c.querySelector("[data-approve-sample]")))
        await page.close()
    }
    // 8. CSV verified sample card: Verified by / on rows, verified footer
    {
        const page = await open("/layouts/samples")
        await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 60000)
        const rowId = await findRow(page, '/[A-Z]{3} \\d{2}$/.test(t.trim()) && !/ - $/.test(t)')
        await domClick(page, `[data-row-id="${rowId}"]`)
        await waitFor(page, (id) => !!document.querySelector(`[data-sample-card="${id}"][data-expanded]`), 15000, rowId)
        const footer = await page.$eval(`[data-sample-card="${rowId}"] [data-sample-toggle]`, (h) => h.textContent.replace(/\s+/g, " "))
        check("verified card: no verification rows in Sample details; the header footer shows Verified by <name> • <date-time>", !(await exists(page, `[data-sample-card="${rowId}"] [data-detail-row="verified_by"], [data-sample-card="${rowId}"] [data-detail-row="verified_on"], [data-sample-card="${rowId}"] [data-detail-row="verifier_comment"]`)) && /Verified by [A-Z][a-z]+ [A-Z][a-z]+ • \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} [AP]M/.test(footer), footer.slice(-60))
        await page.close()
    }
    // 9. phone width
    {
        const page = await browser.newPage()
        await page.setViewport({ width: 390, height: 844 })
        await page.goto(L.BASE + "/layouts/samples", { waitUntil: "domcontentloaded" })
        await waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0, 30000)
        check("no horizontal page scroll at 390px", (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1)
        await page.close()
    }
    // 10. Deployment V2 regression
    {
        const page = await open("/layouts/deployment-v2-oct-26")
        check("Deployment V2 loads rows", await waitFor(page, () => document.querySelectorAll("tbody tr").length > 2, 60000))
        check("V2 tabs unchanged", (await texts(page, '[role="tab"]')).map((t) => t.replace(/\d+/g, "").trim()).join(" · ") === "All · Verified · Pending · Need Correction")
        await click(page, "tbody tr")
        check("V2 detail: status filter + dispatch cards + trailer group header hooks", await waitFor(page, () => !!document.querySelector("[data-detail-filter]") && document.querySelectorAll("[data-dispatch-row]").length > 0, 20000) && await page.$eval("[data-trailer-toggle]", (b) => !!b.querySelector("[data-trailer-name]") && !!b.querySelector("[data-trailer-count]")).catch(() => false))
        await click(page, "[data-dispatch-toggle]")
        check("V2 dispatch card expands; map renders", await waitFor(page, () => !!document.querySelector("[data-dispatch-body]"), 6000) && await waitFor(page, () => !!document.querySelector(".map-preview-module .gm-style"), 20000))
        await page.close()
        const idx = await open("/layouts")
        check("layouts index links to Samples", await waitFor(idx, () => !!document.querySelector('a[href="/layouts/samples"]'), 30000))
        await idx.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
