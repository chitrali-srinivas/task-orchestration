/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Browser checks for the redesigned Data / API Inspector (generic shell + Samples spec), at several widths.
const L = require("./lib.cjs")
const { check, sleep, waitFor, click, domClick, text, texts, exists } = L

const SECTIONS = ["overview", "data-flow", "domain", "api", "ui-api", "database", "mock-data", "workflows", "rules", "open-questions"]
const visible = (page, selector) => page.$$eval(selector, (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).length)
const overflow = (page) => page.$eval("[data-inspector-body]", (b) => b.scrollWidth - b.clientWidth)

;(async () => {
    const browser = await L.launch()
    const page = await browser.newPage()
    const errors = []
    L.collectErrors(page, errors)
    await L.gotoSamples(page)
    await L.tableSettled(page)
    // open a farmer first so the Inspector has a selected record
    await L.selectTab(page, "pending")
    await L.applyFilter(page, "farmer", "F-0073")
    await domClick(page, "[data-row-id]")
    await waitFor(page, () => document.querySelectorAll("[data-sample-card]").length > 0, 15000)
    await L.closeSheet(page)

    await click(page, "[data-inspector-trigger]")
    check("1 Inspector opens", await waitFor(page, () => !!document.querySelector("[data-inspector-section='overview']"), 5000))
    const width = await page.$eval("[data-inspector]", (e) => Math.round(e.getBoundingClientRect().width / window.innerWidth * 100))
    check("sheet is ~75% of the window", width >= 74 && width <= 76, `${width}%`)
    const tabs = await page.$$eval("[data-inspector-tab]", (t) => t.map((x) => x.getAttribute("data-inspector-tab")))
    check("IA: Overview · Data flow · Domain · API · UI→API · Database · Mock data · Workflows · Rules · Open questions", JSON.stringify(tabs) === JSON.stringify(SECTIONS), tabs.join(","))

    // ── Overview ──
    const facts = await text(page, "[data-inspector-facts]")
    check("2 Overview answers source / primary entity / related entities / API status", /Data source/.test(facts) && /Primary entity\s*Sample/.test(facts) && /Farmer · AZ · Plot/.test(facts) && /Proposed/.test(facts), facts)
    check("4 Overview shows the UI → API → Domain → DB flow (4 nodes)", (await visible(page, "[data-overview-flow] [data-flow-node]")) === 4)
    const words = await page.$eval("[data-inspector-section='overview']", (s) => s.innerText.split(/\s+/).filter(Boolean).length)
    check("3 Overview is short (no dump): < 220 words, no code blocks, no tables", words < 220 && !(await exists(page, "[data-inspector-section='overview'] pre, [data-inspector-section='overview'] table")), `${words} words`)
    check("11 provenance legend: Observed / Proposed / Mock / Open question", (await texts(page, "[data-provenance-legend] [data-provenance]")).join("|") === "Observed|Proposed|Mock|Open question")
    await L.screenshot(page, "inspector-overview.png")
    await click(page, "[data-overview-link='open-questions']")
    check("overview 'at a glance' links jump to their section", await waitFor(page, () => !!document.querySelector("[data-inspector-section='open-questions']"), 3000))

    // ── Data flow ──
    await click(page, "[data-inspector-tab='data-flow']")
    check("4 data-flow diagrams: read (4 nodes) + write (6 nodes)", (await visible(page, "[data-flow='read'] [data-flow-node]")) === 4 && (await visible(page, "[data-flow='write'] [data-flow-node]")) === 6)
    check("technical details collapsed by default", (await visible(page, "[data-disclosure-content]")) === 0 && (await exists(page, "[data-disclosure='View technical details']")))
    // ── Domain ──
    await click(page, "[data-inspector-tab='domain']")
    const tree = await page.$$eval("[data-domain-tree] [data-tree-node]", (n) => n.map((x) => x.getAttribute("data-tree-node")))
    check("5 domain diagram: Farmer → AZ → Sample → Plot (+ purpose, status, people, reports)", tree.slice(0, 3).join(">") === "Farmer>AZ>Sample" && tree.includes("Plot") && tree.includes("Plot outline"), tree.join(","))
    check("entity cards with fields collapsed (View fields)", (await visible(page, "[data-entity-card]")) >= 5 && (await visible(page, "[data-entity-card] table")) === 0)
    await page.focus("[data-entity-card='Sample'] [data-disclosure='View fields']")
    await page.keyboard.press("Enter")
    check("keyboard: Enter expands 'View fields'", await waitFor(page, () => !!document.querySelector("[data-entity-card='Sample'] table"), 3000))
    await L.screenshot(page, "inspector-domain.png")
    // ── API ──
    await click(page, "[data-inspector-tab='api']")
    const cards = await page.$$eval("[data-api-card]", (c) => c.map((x) => x.getAttribute("data-api-card")))
    check("API cards: 4 reads + 4 actions, all PROPOSED", cards.length === 8 && (await page.$$eval("[data-api-card]", (c) => c.every((x) => x.querySelector("[data-provenance='proposed']")))), cards.join(" | "))
    check("7/8 request + response collapsed; no JSON visible by default", (await visible(page, "[data-inspector-section='api'] pre")) === 0 && (await exists(page, "[data-disclosure='View request']")))
    await domClick(page, "[data-api-card='POST /api/v1/samples/{sample_id}/reports'] [data-disclosure='View request']")
    check("View request reveals the payload (fields + comment kept separate)", await waitFor(page, () => /"fields"[\s\S]*"comment"/.test(document.querySelector("[data-api-card='POST /api/v1/samples/{sample_id}/reports'] pre")?.textContent ?? ""), 3000))
    // ── UI → API ──
    await click(page, "[data-inspector-tab='ui-api']")
    const mapRows = await page.$$eval("[data-ui-mapping] tbody tr", (r) => r.map((x) => x.cells[0].textContent.trim()))
    check("12 UI → API table: action | data | API | result", mapRows.length === 8 && mapRows.includes("Approve") && mapRows.includes("Save boundary"), mapRows.join(", "))
    // ── Database ──
    await click(page, "[data-inspector-tab='database']")
    check("9 DB: OBSERVED and PROPOSED groups, schemas collapsed", (await exists(page, "[data-db-group='observed']")) && (await exists(page, "[data-db-group='proposed']")) && (await visible(page, "[data-disclosure-content]")) === 0)
    // ── Mock data ──
    await click(page, "[data-inspector-tab='mock-data']")
    const sources = await page.$$eval("[data-mock-source]", (s) => s.map((x) => `${x.getAttribute("data-mock-source")}:${x.querySelector("[data-provenance]").getAttribute("data-provenance")}`))
    check("10 mock data summarised: CSV OBSERVED, demo + names MOCK; coverage list; selected farmer chain", sources[0] === "sample_data.csv:observed" && sources.slice(1).every((s) => s.endsWith(":mock")) && (await visible(page, "[data-mock-coverage] li")) >= 10 && /F-0073/.test(await text(page, "[data-inspector-chain]")), sources.join(" | "))
    check("10 no raw rows: no table, record JSON collapsed", !(await exists(page, "[data-inspector-section='mock-data'] table")) && (await visible(page, "[data-inspector-section='mock-data'] pre")) === 0)
    await domClick(page, "[data-disclosure='View sample record']")
    check("View sample record shows ONE record, phones masked", await waitFor(page, () => { const t = document.querySelector("[data-inspector-section='mock-data'] pre")?.textContent ?? ""; return /"sample_code"/.test(t) && !/\+91\d{10}/.test(t) }, 3000))
    // ── Workflows ──
    await click(page, "[data-inspector-tab='workflows']")
    check("6/13 workflow diagrams: approval (with the boundary decision) + reporting", (await exists(page, "[data-workflow='approval'] [data-workflow-decision='Boundary required?']")) && (await visible(page, "[data-workflow='report'] [data-workflow-step]")) === 8)
    await L.screenshot(page, "inspector-workflows.png")
    // ── Rules / Open questions ──
    await click(page, "[data-inspector-tab='rules']")
    check("rules grouped (Approval, Reporting, Boundary, Status) with provenance on each", (await page.$$eval("[data-rule-group]", (g) => g.map((x) => x.getAttribute("data-rule-group")))).join(",") === "Approval,Reporting,Boundary,Status" && await page.$$eval("[data-rule-group] li", (li) => li.every((x) => x.querySelector("[data-provenance]"))))
    await click(page, "[data-inspector-tab='open-questions']")
    check("open questions listed with an area tag", (await visible(page, "[data-open-questions] li")) >= 10)

    // ── 14 no horizontal overflow, every section, several widths ──
    for (const [w, h] of [[2557, 1357], [1920, 1080], [1440, 900], [1280, 800], [1024, 768], [820, 1180]]) {
        await page.setViewport({ width: w, height: h })
        await sleep(300)
        let worst = 0, where = ""
        for (const id of SECTIONS) {
            await click(page, `[data-inspector-tab='${id}']`)
            await sleep(120)
            const o = await overflow(page)
            if (o > worst) { worst = o; where = id }
        }
        check(`14 no horizontal overflow at ${w}px`, worst <= 1, worst ? `${worst}px in ${where}` : "")
    }
    await page.setViewport({ width: 1440, height: 900 })
    await click(page, "[data-inspector-tab='overview']")

    const relevant = L.relevantErrors(errors)
    check("17 no console errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
