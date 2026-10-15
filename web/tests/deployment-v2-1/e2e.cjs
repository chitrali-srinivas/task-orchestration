/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode): version selector + routing, isolation from V2, the Data / API Inspector, the per-type gates
// (AZ 6 display only, Pre-Sample AZ 1–3), the verifier gate, the report dialog's full server error, and the map cover on
// Previous / Next. Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor, exists } = L

const bodyText = (page) => page.evaluate(() => document.body.innerText)
/** Verified-by text in the detail OUTSIDE the dispatch cards (V2's header strip; V2.1 keeps it on the cards only). */
const headerVerifiedBy = (page) => page.evaluate(() => [...document.querySelectorAll('[role="dialog"] span')].filter((s) => /^Verified by\b/.test(s.textContent.trim()) && !s.closest("[data-dispatch-row]")).length)
const expandAllDispatches = L.expandAllDispatches
/** V2.1: Pre-Sample is a FARMER-level header action (shown when the farmer has an AZ 1–3 deployment). */
const preSampleShown = (page) => page.evaluate(() => !!document.querySelector("[data-summary-bar] [data-open-pre-sample]"))
async function openInspector(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    return waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
}
async function inspectorTab(page, id) {
    await page.evaluate((t) => document.querySelector(`[data-inspector-tab="${t}"]`)?.click(), id)
    return waitFor(page, (t) => !!document.querySelector(`[data-inspector-section="${t}"]`), 5000, id)
}
const traceEntries = (page) => page.evaluate(() => [...document.querySelectorAll("[data-trace-entry]")].map((e) => ({ source: e.getAttribute("data-trace-source"), kind: e.getAttribute("data-trace-kind"), state: e.getAttribute("data-trace-state"), path: e.getAttribute("data-trace-path") })))
async function closeInspector(page) {
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
}
/** First dispatch row of the current tab whose farmer detail offers an enabled Approve (some are NOC- or boundary-blocked). */
async function openApprovableRow(page, max = 12) {
    const rows = (await L.dispatchRows(page)).filter((r) => r.id)
    const seen = new Set()
    for (const r of rows) {
        if (seen.size >= max) break
        if (seen.has(r.farmer)) continue
        seen.add(r.farmer)
        await L.openRow(page, r.index)
        await L.detailLoaded(page)
        await expandAllDispatches(page)
        await sleep(800)
        if (await page.evaluate(() => [...document.querySelectorAll("[data-approve]")].some((b) => !b.disabled))) return r
        await L.closeSheet(page)
    }
    return null
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1. Version selector and routing ─────────────────────────────────────────────────────────────
    {
        const page = await L.open(browser, "/layouts/deployment-versions", errors)
        await waitFor(page, () => document.querySelectorAll('a[href^="/layouts/deployment"]').length >= 3, 90000)
        const links = await page.$$eval('a[href^="/layouts/deployment"]', (as) => as.map((a) => a.getAttribute("href")))
        check("selector lists the existing layout, V2 Oct 26 and V2.1", ["/layouts/deployment", "/layouts/deployment-v2-oct-26", "/layouts/deployment-v2-1"].every((h) => links.includes(h)), links.join(", "))
        check("selector shows the V2.1 card", /Deployment V2\.1/.test(await bodyText(page)))
        await page.evaluate(() => document.querySelector('a[href="/layouts/deployment-v2-1"]').click())
        check("selecting V2.1 opens its route", await waitFor(page, () => location.pathname === "/layouts/deployment-v2-1", 90000))
        check("V2.1 loads rows", await L.rowsLoaded(page))
        check("V2.1 page title", /Deployment V2\.1/.test(await bodyText(page)))
        await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 })
        check("refresh keeps V2.1 and reloads rows", (await L.rowsLoaded(page)) && page.url().endsWith("/layouts/deployment-v2-1"))
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 60000 })
        check("browser Back returns to the selector", await waitFor(page, () => location.pathname === "/layouts/deployment-versions", 30000))
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 60000 })
        check("browser Forward returns to V2.1", (await waitFor(page, () => location.pathname === "/layouts/deployment-v2-1", 30000)) && (await L.rowsLoaded(page)))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. Isolation: V2 Oct 26 and the existing layout unchanged; V2.1 differs only where intended ───
    let v2Tabs = null
    {
        const page = await L.open(browser, L.V2, errors)
        check("V2 Oct 26 loads rows", await L.rowsLoaded(page))
        check("V2 Oct 26 keeps its title", /Deployment V2 Oct 26/.test(await bodyText(page)))
        check("V2 Oct 26 has no Inspector trigger", !(await exists(page, "[data-inspector-trigger]")))
        v2Tabs = await page.$$eval('[role="tab"]', (ts) => ts.map((t) => t.textContent.replace(/\d+/g, "").trim()).join(" · "))
        await L.openV2Row(page, 0)
        check("V2 Oct 26 still shows its header \"Verified by\" strip on a Verified row", (await headerVerifiedBy(page)) >= 1)
        check("V2 Oct 26 still has the map-level boundary button", await waitFor(page, () => !!document.querySelector("[data-map-edit-boundary]"), 20000))
        blocked.push(...page.blockedApi)
        await page.close()
    }
    {
        const page = await L.open(browser, "/layouts/deployment", errors)
        check("the existing Deployment layout still loads", await waitFor(page, () => document.querySelectorAll("tbody tr").length > 0, 90000))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 3. V2.1 parity + backlog A / B + the Data / API Inspector (seeded boundaries so an approve can pass the gate) ──
    {
        const page = await L.open(browser, `${L.V21}?mockBoundaries=seed`, errors)
        await L.rowsLoaded(page)
        // the labels (V2.1's counts are dispatch counts, "n+" while list rows remain unloaded — the count is not compared)
        const tabs = await page.$$eval('[role="tab"]', (ts) => ts.map((t) => t.textContent.replace(/\d+\+?/g, "").trim()).join(" · "))
        check("V2.1 tabs match V2 Oct 26 (labels and order)", tabs === v2Tabs, tabs)
        const trigger = await page.evaluate(() => {
            const t = document.querySelector("[data-inspector-trigger]")?.getBoundingClientRect()
            const f = (document.querySelector('button[title="Filters"]') ?? [...document.querySelectorAll("button")].find((b) => /\d+ filters?/.test(b.textContent)))?.getBoundingClientRect()
            return t && f ? { left: t.left < f.left, sameRow: Math.abs(t.top - f.top) < 12 } : null
        })
        check("Inspector trigger sits left of Filter", !!trigger && trigger.left && trigger.sameRow, JSON.stringify(trigger))

        // Inspector before any row is opened
        check("Inspector opens", await openInspector(page))
        check("Inspector opens on API activity", await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.hasAttribute("data-active")))
        const first = await traceEntries(page)
        check("API activity shows the table read (mock getDeploymentMetadata, ok)", first.some((e) => e.source === "mock" && e.path === "/adminFarmApp/v4/getDeploymentMetadata" && e.state === "ok"), JSON.stringify(first.slice(-3)))
        // V2.1: the newest entries are the per-row dispatch reads; expand the TABLE read (getDeploymentMetadata) itself
        await page.evaluate(() => [...document.querySelectorAll("[data-trace-entry]")].find((e) => e.getAttribute("data-trace-path") === "/adminFarmApp/v4/getDeploymentMetadata")?.querySelector("button")?.click())
        await sleep(300)
        const details = await page.evaluate(() => document.querySelector("[data-trace-details]")?.innerText ?? "")
        check("an entry expands to its request body and response", /Request body/i.test(details) && /Response body/i.test(details) && /"pagination"/.test(details))
        check("the request is the v4 body live mode would send (status / page / rows)", /"page"/.test(details) && /"rows"/.test(details))
        const inspectorText = await page.evaluate(() => document.querySelector("[data-inspector]")?.innerText ?? "")
        check("Inspector shows no token / bearer / cookie values", !/Bearer\s+(?!\[redacted\])\S{8,}|eyJ[\w-]{10,}\.|mati_dev_auth_token\s*[:=]/i.test(inspectorText))
        check("the 12 Inspector sections (10 standard + activity + mapping)", (await page.$$("[data-inspector-tab]")).length === 12)
        await inspectorTab(page, "mapping")
        check("Data mapping: counts → tabs mapping", await exists(page, "[data-mapping-counts]"))
        check("Data mapping: asks to open a row first", await exists(page, "[data-mapping-empty]"))
        await closeInspector(page)

        // open a Verified dispatch row → its farmer's detail → backlog A / B, then the mapping of that record
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await expandAllDispatches(page)
        await sleep(800)
        check("backlog A: no \"Verified by\" strip in the detail header", (await headerVerifiedBy(page)) === 0)
        check("backlog A: the verified dispatch card still states its verifier", await page.evaluate(() => [...document.querySelectorAll("[data-dispatch-row] span")].some((s) => /^Verified( by)?\b/.test(s.textContent.trim()))))
        check("backlog B: no map-level boundary button", await waitFor(page, () => !!document.querySelector(".gm-style"), 30000) && !(await exists(page, "[data-map-edit-boundary]")))
        await L.closeSheet(page)
        check("Inspector opens again (page unaffected)", await openInspector(page))
        await inspectorTab(page, "mapping")
        check("Data mapping: the selected row's cells, field by field", await waitFor(page, () => document.querySelectorAll("[data-mapping-record] tbody tr").length >= 15, 5000))
        check("Data mapping: the last opened record's dispatches and markers", (await exists(page, "[data-mapping-dispatches]")) && (await exists(page, "[data-mapping-markers]")))
        const kinds = await page.$$eval("[data-mapping-record] [data-mapping-kind]", (els) => [...new Set(els.map((e) => e.getAttribute("data-mapping-kind")))])
        check("mappings are classified (direct / renamed / derived …)", kinds.includes("direct") && kinds.includes("renamed") && kinds.includes("derived"), kinds.join(", "))
        // regression (QA-06, then the live API audit): the mapping names the table's real sources — the selected row IS one
        // dispatch: Verified On its own verified_at (no created_at fallback), Plots its plots, Area the deployment's
        // ENROLLED actual_area, Cal. Area its calculated_area
        const mapping = await page.$$eval("[data-mapping-record] tbody tr", (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.replace(/\s+/g, " ").trim())))
        const cellOf = (ui) => mapping.find((cells) => cells[0] === ui)?.join(" | ") ?? ""
        const verifiedOnMap = cellOf("Verified On"), plotsMap = cellOf("Plots"), areaMap = cellOf("Area"), calMap = cellOf("Cal. Area")
        check("Data mapping: Verified On is the dispatch's verified_at (no created_at fallback); Plots the dispatch's plots; Area the deployment's enrolled actual_area; Cal. Area the dispatch's calculated_area", verifiedOnMap !== "" && !/created_at/.test(verifiedOnMap) && /^Plots \| plots/.test(plotsMap) && /^Area \| actual_area/.test(areaMap) && /ENROLLED/.test(areaMap) && /^Cal\. Area \| calculated_area/.test(calMap), JSON.stringify({ verifiedOnMap, plotsMap, areaMap, calMap }))
        await inspectorTab(page, "activity")
        const afterOpen = await traceEntries(page)
        check("API activity shows the detail reads (getTrailerDetails, NOC, history)", ["/adminDeploymentSec/v3/getTrailerDetails", "/adminFarmApp/v3/getDeploymentNocDetails", "/adminDeploymentSec/v3/getFarmerReportedHistory"].every((p) => afterOpen.some((e) => e.path === p)))
        check("no mutation was recorded by reading", !afterOpen.some((e) => e.kind === "mutation"))
        await closeInspector(page)

        // a real (mock) mutation shows up in the Inspector
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        const approvable = await openApprovableRow(page)
        if (approvable) {
            await page.evaluate(() => [...document.querySelectorAll("[data-approve]")].find((b) => !b.disabled)?.click())
            await waitFor(page, () => !!document.querySelector("[data-approve-confirm]"), 5000)
            await page.evaluate(() => document.querySelector("[data-approve-confirm]")?.click())
            await sleep(2500)
            await L.closeSheet(page)
            await openInspector(page)
            await page.evaluate(() => document.querySelector('[data-activity-filter="mutation"]')?.click())
            await sleep(300)
            const mutations = await traceEntries(page)
            check("an approve appears under Mutations (mock PATCH updateDeploymentTrailerDispatch, ok)", mutations.some((e) => e.kind === "mutation" && e.source === "mock" && e.path === "/adminFarmApp/v3/updateDeploymentTrailerDispatch" && e.state === "ok"), JSON.stringify(mutations))
            await page.evaluate(() => document.querySelector("[data-trace-entry] button")?.click())
            await sleep(300)
            check("the mutation's payload is shown", /deployment_trailer_dispatch_data/.test(await page.evaluate(() => document.querySelector("[data-trace-details]")?.innerText ?? "")))
            await closeInspector(page)
        } else note("approve not exercised", "no Pending farmer with an enabled Approve among the first loaded rows")
        await L.screenshot(page, "v21-table.png")
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 4. Per-type gates (audit M2 / P2, M1): ?mockTypes=all adds AZ 4 / 5 / 6 rows to farmer 1002's round 1 ──
    // V2.1: the detail is the farmer's, so each AZ is checked within ITS row section.
    {
        const page = await L.open(browser, `${L.V21}?mockTypes=all`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 / 6 dispatches are on later pages
        const rows = (await L.dispatchRows(page)).filter((r) => r.id)
        const byAz = (az) => rows.find((r) => r.az === String(az))
        // Pre-Sample is farmer-level: farmer 1002 has AZ 1–3 deployments, so the header shows it whichever AZ row was opened
        for (const [az, expectActions, expectPreSample] of [[6, false, true], [4, true, true], [5, true, true], [1, true, true]]) {
            const row = byAz(az)
            if (!row) { check(`AZ${az} row present`, false); continue }
            await L.openRow(page, row.index)
            await L.detailLoaded(page)
            await expandAllDispatches(page)
            await sleep(800)
            const sel = `[data-farmer-row][data-row-az="${az}"]`
            const actions = await page.evaluate((s) => ({ approve: document.querySelectorAll(`${s} [data-approve]`).length, report: document.querySelectorAll(`${s} [data-start-report]`).length, type: document.querySelector(s)?.getAttribute("data-row-type") }), sel)
            const preSample = await preSampleShown(page)
            if (expectActions) check(`AZ${az} (${actions.type}): Approve / Report offered in its section (M1: the type's own flow)`, actions.approve + actions.report > 0, JSON.stringify(actions))
            else check(`AZ${az} (${actions.type}): display only — no Approve, no Report in its section`, actions.approve === 0 && actions.report === 0, JSON.stringify(actions))
            check(`AZ${az} opened: Pre-Sample ${expectPreSample ? "shown" : "hidden"} in the farmer header (farmer-level, AZ 1–3 deployments only)`, preSample === expectPreSample)
            check(`AZ${az} opened: no Pre-Sample / NOC action on the AZ section itself`, !(await exists(page, `[data-az-section] [data-open-pre-sample], [data-az-section] [data-open-noc]`)))
            if (az === 6) {
                const located = await page.evaluate((s) => document.querySelector(`${s} [data-plot-card][data-plot-location="valid"]`)?.getAttribute("data-plot-card"), sel)
                if (located) {
                    await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-toggle]`)?.click(), located)
                    await waitFor(page, () => !!document.querySelector("[data-plot-map-card]"), 10000)
                    check("AZ6: the plot's map card offers no boundary edit", (await exists(page, "[data-plot-map-card]")) && !(await exists(page, "[data-edit-boundary]")))
                }
            }
            await L.closeSheet(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 5. Verifier gate (audit M3): no phone → view only, with the reason ──────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockVerifier=nophone`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await expandAllDispatches(page)
        await sleep(800)
        const gate = await page.evaluate(() => ({
            approveEnabled: [...document.querySelectorAll("[data-approve]")].some((b) => !b.disabled),
            reportEnabled: [...document.querySelectorAll("[data-start-report]")].some((b) => !b.disabled),
            blocker: document.querySelector("[data-approve-blocker]")?.textContent.trim() ?? null,
        }))
        check("no verifier phone: Approve and Report disabled", !gate.approveEnabled && !gate.reportEnabled, JSON.stringify(gate))
        check("no verifier phone: the reason is shown", /no phone number/i.test(gate.blocker ?? ""), gate.blocker)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 6. Report failure (audit P4): ?mockFail=report-400 simulates the live 400 ────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockFail=report-400`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await expandAllDispatches(page)
        await sleep(600)
        await page.evaluate(() => [...document.querySelectorAll("[data-start-report]")].find((b) => !b.disabled)?.click())
        await waitFor(page, () => document.querySelectorAll("[data-report-field]").length > 0, 6000)
        await page.evaluate(() => { const f = document.querySelector("[data-report-field]"); (f.querySelector('button[role="checkbox"]') || f.querySelector("input,button") || f).click() })
        await sleep(400)
        await page.evaluate(() => document.querySelector("[data-finalize-report]")?.click())
        await waitFor(page, () => !!document.querySelector('[role="dialog"] textarea'), 6000)
        await page.type('[role="dialog"] textarea', "Wrong source recorded (test)")
        const submit = () => page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Submit Report/.test(b.textContent))?.click())
        await submit()
        const failed = await waitFor(page, () => !!document.querySelector("[data-dialog-error]"), 8000)
        const shown = await page.evaluate(() => ({
            line: document.querySelector("[data-dialog-error]")?.textContent.trim() ?? "",
            details: document.querySelector("[data-dialog-error-details] pre")?.textContent ?? "",
            dialogOpen: /Report Survey/.test(document.body.innerText),
            success: /Reported Successfully/.test(document.body.innerText),
        }))
        check("rejected report: the dialog stays open, no success", failed && shown.dialogOpen && !shown.success)
        check("rejected report: concise line with endpoint + HTTP 400", /reportFarmerDetails failed \(HTTP 400\)/.test(shown.line) && /Technical details/.test(shown.line), shown.line)
        check("Technical details: the complete server text (not cut)", shown.details.includes("Failing row contains (") && shown.details.includes("[simulated by the V2.1 mock backend]"), `${shown.details.length} chars`)
        check("Technical details: the database fields the server sent (code, table) and no invented column", /code: 23502/.test(shown.details) && /table: quality_system_defects/.test(shown.details) && !/column:/.test(shown.details))
        await page.evaluate(() => document.querySelector("[data-dialog-error-details] summary")?.click())
        check("Technical details expand", await page.evaluate(() => document.querySelector("[data-dialog-error-details]")?.open === true))
        await submit()
        check("the next submit succeeds (the simulated failure is one-shot)", await waitFor(page, () => /Reported Successfully/.test(document.body.innerText), 10000))
        await sleep(2500)
        await L.closeSheet(page)
        await openInspector(page)
        await page.evaluate(() => document.querySelector('[data-activity-filter="error"]')?.click())
        await sleep(300)
        const errs = await traceEntries(page)
        check("Inspector lists the failed report under Errors", errs.some((e) => e.path === "/adminDeploymentSec/v3/reportFarmerDetails" && e.state === "error"))
        await closeInspector(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 7. Previous / Next (audit P1): the map is covered while the next record loads ──────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await waitFor(page, () => !!document.querySelector(".gm-style") && !document.querySelector("[data-map-cover]"), 30000)
        const seen = []
        check("Next is available", await L.clickNav(page, "next"))
        for (let i = 0; i < 20; i++) { seen.push(await page.evaluate(() => document.querySelector("[data-map-cover]")?.getAttribute("data-map-cover") ?? null)); await sleep(60) }
        check("Next: the map shows the \"loading\" cover while the record loads", seen.includes("loading-record"), [...new Set(seen)].join(","))
        check("Next: the cover clears once the record loaded", await waitFor(page, () => !document.querySelector("[data-map-cover]"), 15000))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
