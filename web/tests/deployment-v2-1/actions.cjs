/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — M1 (the AWD / Mati Boost flows: per-type permissions, the ten report fields per plot,
// the AWD approve body, plot-only delete), P6 (string identifiers in the mutation payloads, seen in the Inspector),
// the Samples picture pattern on plot cards, and the Inspector's trace labels (ids only, phones masked).
// ?mockTypes=all adds AZ 4 / 5 / 6 rows; ?mockBoundaries=seed makes dispatches approvable. Prints PASS / FAIL lines.
const L = require("./lib.cjs")
const { check, note, sleep, waitFor } = L

async function openInspector(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    return waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
}
async function closeInspector(page) {
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
}
const traceEntries = (page) => page.evaluate(() => [...document.querySelectorAll("[data-trace-entry]")].map((e) => ({ source: e.getAttribute("data-trace-source"), kind: e.getAttribute("data-trace-kind"), state: e.getAttribute("data-trace-state"), path: e.getAttribute("data-trace-path"), text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 240) })))
/** Expands the first trace entry of `path` and returns its details text. */
async function traceDetails(page, path) {
    const ok = await page.evaluate((p) => { const e = [...document.querySelectorAll("[data-trace-entry]")].find((x) => x.getAttribute("data-trace-path") === p); if (!e) return false; e.querySelector("button")?.click(); return true }, path)
    if (!ok) return null
    await sleep(300)
    return page.evaluate(() => document.querySelector("[data-trace-details]")?.innerText ?? "")
}
/** Opens the farmer detail from the first dispatch row of the given AZ (the AZ 4 / 5 / 6 rows share farmer 1002, round 1). */
async function openAz(page, az) {
    const row = (await L.dispatchRows(page)).find((r) => r.id && r.az === String(az))
    if (!row) return null
    await L.openRow(page, row.index)
    await L.detailLoaded(page)
    await L.expandAllDispatches(page)
    await sleep(900)
    return row
}
const sectionSel = (az) => `[data-farmer-row][data-row-az="${az}"]`
/** Approves the row's NOC through the farmer-level NOC view when a dispatch's blocker (its text, not the Review NOC button) is the NOC. */
async function approveNocIfBlocking(page, az) {
    const blockers = await page.evaluate((s) => [...document.querySelectorAll(`${s} [data-approve-blocker] > span`)].map((e) => e.textContent ?? ""), sectionSel(az))
    if (!blockers.some((b) => /NOC/.test(b))) return "not-needed"
    // V2.1: the NOC is farmer-level — the header icon opens the review directly on a document; Next until the AZ's document shows, then Approve
    if (!(await L.openNocReview(page))) return "no-noc-dialog"
    await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 8000)
    let found = false
    for (let i = 0; i < 12; i++) {
        const r = await L.nocReview(page)
        if (r && r.az === String(az) && r.status !== "approved") { found = true; break }
        if (!r || r.nextDisabled !== false) break
        await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
        await sleep(300)
    }
    if (!found) { await L.closeNocReview(page); return "no-approve-for-az" }
    await page.evaluate(() => document.querySelector("[data-noc-approve]")?.click())
    await waitFor(page, () => /Noc qualified successfully/.test(document.body.innerText), 8000)
    await L.closeNocReview(page)
    await sleep(2000)
    await L.expandAllDispatches(page)
    await sleep(600)
    return "approved"
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1. AWD (AZ 4): report with the ten plot fields; the Inspector shows string identifiers ─────────
    {
        const page = await L.open(browser, `${L.V21}?mockTypes=all&mockBoundaries=seed`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 rows are on later pages
        const row = await openAz(page, 4)
        check("an AZ 4 (AWD) dispatch row opens the farmer's detail", !!row)
        const sec = (await L.detailSections(page)).find((s) => s.az === "4")
        check("the AZ 4 section is the awd type with its own cards", sec?.type === "awd" && sec.cards.length > 0, JSON.stringify(sec && { type: sec.type, cards: sec.cards.length }))
        check("the same farmer's AZ 1–3 rows are sections too (one detail per farmer)", (await L.detailSections(page)).some((s) => ["1", "2", "3"].includes(s.az)))
        const menus = await page.evaluate((s) => ({ dispatch: [...document.querySelectorAll(`${s} [data-dispatch-row] > div [data-more-menu]`)].map((m) => m.getAttribute("data-more-actions")), plot: [...document.querySelectorAll(`${s} [data-plot-card] [data-more-menu]`)].map((m) => m.getAttribute("data-more-actions")) }), sectionSel(4))
        check("AWD: no dispatch delete (matic-dash has none); plot delete offered on its plot cards", !menus.dispatch.some((a) => /delete-dispatch/.test(a ?? "")) && menus.plot.some((a) => /delete-deployment/.test(a ?? "")), JSON.stringify(menus))
        // report on the LAST dispatch of the section (the first one is approved later in this suite)
        await page.evaluate((s) => { const buttons = [...document.querySelectorAll(`${s} [data-start-report]`)].filter((b) => !b.disabled); buttons[buttons.length - 1]?.click() }, sectionSel(4))
        check("AWD: Report starts (the mock admin has the AWD edit permission)", await waitFor(page, (s) => document.querySelectorAll(`${s} [data-report-field]`).length > 0, 6000, sectionSel(4)))
        const fields = await page.evaluate((s) => ({ dispatchLevel: document.querySelectorAll(`${s} [data-report-fields="dispatch"]`).length, perPlot: [...document.querySelectorAll(`${s} [data-plot-report-fields]`)].map((p) => p.querySelectorAll('[data-report-field^="awd:"]').length), labels: [...document.querySelectorAll(`${s} [data-plot-report-fields]:first-of-type [data-report-field]`)].map((f) => f.textContent.trim().split(/\s{2,}|(?<=[a-z])(?=[A-Z0-9])/)[0]), missing: document.querySelectorAll(`${s} [data-report-field][data-report-value="missing"]`).length }), sectionSel(4))
        check("AWD: no dispatch-level report fields; TEN report fields per plot (matic-dash's list)", fields.dispatchLevel === 0 && fields.perPlot.length > 0 && fields.perPlot.every((n) => n === 10), JSON.stringify(fields.perPlot))
        check("AWD: a field the data lacks is shown as 'Not recorded' (sent as \"missing value\")", fields.missing > 0)
        const pick = async (prefix) => page.evaluate((s, p) => { const f = [...document.querySelectorAll(`${s} [data-report-field]`)].find((x) => x.getAttribute("data-report-field").startsWith(p)); if (!f) return false; (f.querySelector('button[role="checkbox"]') || f).click(); return true }, sectionSel(4), prefix)
        check("select Date and Picture of the first plot", (await pick("awd:date:")) && (await pick("awd:picture:")))
        await sleep(300)
        await page.evaluate((s) => document.querySelector(`${s} [data-finalize-report]`)?.click(), sectionSel(4))
        await waitFor(page, () => !!document.querySelector('[role="dialog"] textarea'), 6000)
        await page.type('[role="dialog"] textarea', "AWD report (test)")
        await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Submit Report/.test(b.textContent))?.click())
        check("the AWD report succeeds (mock)", await waitFor(page, () => /Reported Successfully/.test(document.body.innerText), 10000))
        await sleep(2500)
        await L.closeSheet(page)
        check("Inspector opens", await openInspector(page))
        await page.evaluate(() => document.querySelector('[data-activity-filter="mutation"]')?.click())
        await sleep(300)
        const report = await traceDetails(page, "/adminDeploymentSec/v3/reportFarmerDetails")
        check("the report payload has one entry per selected field, with the field key (date, picture)", !!report && /"date"/.test(report) && /"picture"/.test(report))
        check("P6: farmer_id and deployment_num are JSON STRINGS in the report payload", !!report && /"farmer_id":\s*"\d+"/.test(report) && /"deployment_num":\s*"\d+"/.test(report) && !/"deployment_num":\s*\d/.test(report))
        check("the report's date is sent as the API's raw dispatch date (not reformatted)", !!report && /"date":\s*("[^"]+"|\d+)/.test(report))
        check("phones are masked in the Inspector (verifier / surveyor ids never shown in full)", !!report && !/"(surveyor_no|franchise_verifier_id)":\s*"\d{7,}"/.test(report))
        await closeInspector(page)

        // Approve an AWD dispatch: NOC first if it blocks, then the AWD body in the Inspector
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 rows are on later pages
        await openAz(page, 4)
        const nocResult = await approveNocIfBlocking(page, 4)
        note("AWD NOC gate", nocResult)
        const approvable = await page.evaluate((s) => { const b = [...document.querySelectorAll(`${s} [data-approve]`)].find((x) => !x.disabled); if (!b) return null; const id = b.closest("[data-dispatch-row]")?.getAttribute("data-dispatch-row"); b.click(); return id }, sectionSel(4))
        check("an AWD dispatch with every boundary saved (seeded) and the NOC approved can be approved", !!approvable, approvable ? "" : await page.evaluate((s) => [...document.querySelectorAll(`${s} [data-approve-blocker]`)].map((b) => b.textContent.trim()).join(" | "), sectionSel(4)))
        if (approvable) {
            await waitFor(page, () => !!document.querySelector("[data-approve-confirm]"), 6000)
            await page.evaluate(() => document.querySelector("[data-approve-confirm]")?.click())
            check("the AWD approval succeeds (mock)", await waitFor(page, () => /Approved Successfully/.test(document.body.innerText), 8000))
            await sleep(2500)
            await L.closeSheet(page)
            await openInspector(page)
            await page.evaluate(() => document.querySelector('[data-activity-filter="mutation"]')?.click())
            await sleep(300)
            const entries = await traceEntries(page)
            check("the approve is traced as a mutation with the dispatch id in its label", entries.some((e) => e.kind === "mutation" && e.path === "/adminFarmApp/v3/updateDeploymentTrailerDispatch" && /Approve dispatch/.test(e.text)))
            const approve = await traceDetails(page, "/adminFarmApp/v3/updateDeploymentTrailerDispatch")
            check("AWD approve body: verifier_name \"Franchise\", verifier_id, farmer_id and deployment_num as strings, no hq_verifier_id", !!approve && /"verifier_name":\s*"Franchise"/.test(approve) && /"verifier_id"/.test(approve) && /"farmer_id":\s*"\d+"/.test(approve) && /"deployment_num":\s*"\d+"/.test(approve) && !/"hq_verifier_id"/.test(approve))
            await closeInspector(page)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 2. Permissions per type: without the AWD key, AZ 4 is view-only while AZ 1–3 still act ────────
    {
        const page = await L.open(browser, `${L.V21}?mockTypes=all&mockPermission=noawd`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 rows are on later pages
        await openAz(page, 4)
        const gates = await page.evaluate((s4) => ({
            awd: { approve: [...document.querySelectorAll(`${s4} [data-approve]`)].map((b) => b.disabled), report: [...document.querySelectorAll(`${s4} [data-start-report]`)].map((b) => b.disabled), blocker: document.querySelector(`${s4} [data-approve-blocker]`)?.textContent.trim() ?? "" },
            matic: { report: [...document.querySelectorAll('[data-farmer-row][data-row-az="1"] [data-start-report], [data-farmer-row][data-row-az="2"] [data-start-report], [data-farmer-row][data-row-az="3"] [data-start-report]')].map((b) => b.disabled) },
        }), sectionSel(4))
        check("?mockPermission=noawd: AZ 4 Approve / Report disabled with the permission reason", gates.awd.report.length > 0 && gates.awd.report.every(Boolean) && gates.awd.approve.every(Boolean) && /permission/i.test(gates.awd.blocker), JSON.stringify(gates.awd))
        check("…while the same farmer's AZ 1–3 rows keep their actions (the deployment edit key)", gates.matic.report.length > 0 && gates.matic.report.some((d) => !d), JSON.stringify(gates.matic))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 3. Mati Boost (AZ 5): its unit label (OPEN) and the boost amount field in the report ──────────
    {
        const page = await L.open(browser, `${L.V21}?mockTypes=all`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 rows are on later pages
        await openAz(page, 5)
        const sec = (await L.detailSections(page)).find((s) => s.az === "5")
        check("the AZ 5 section is the mati_boost type", sec?.type === "mati_boost")
        await page.evaluate((s) => [...document.querySelectorAll(`${s} [data-start-report]`)].find((b) => !b.disabled)?.click(), sectionSel(5))
        check("Mati Boost: ten report fields per plot too", await waitFor(page, (s) => [...document.querySelectorAll(`${s} [data-plot-report-fields]`)].some((p) => p.querySelectorAll("[data-report-field]").length === 10), 6000, sectionSel(5)))
        const legend = await page.evaluate(() => document.body.innerText)
        check("the legend / facts use matic-dash's Litres label for Mati Boost (unit OPEN with the backend)", /Litres/.test(legend))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 4. The Samples picture pattern on plot cards ────────────────────────────────────────────────
    {
        const page = await L.open(browser, L.V21, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "Pending")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page) // V2.1: one row per dispatch — the derived AZ 4 / 5 rows are on later pages
        // the mock row whose first plots have no picture: mock row index 5 (farmer 1006, deployment 1, AZ 3)
        const rows = await L.dispatchRows(page)
        const candidate = rows.find((r) => r.id && r.rowKey === "1006-1-3") ?? rows.find((r) => r.id && r.az === "3") ?? rows.find((r) => r.id)
        await L.openRow(page, candidate.index)
        await L.detailLoaded(page)
        await L.expandAllDispatches(page)
        await sleep(900)
        const thumbs = await page.evaluate(() => ({
            buttons: document.querySelectorAll("[data-plot-thumb-open]").length,
            labelled: [...document.querySelectorAll("[data-plot-thumb-open]")].every((b) => /^View the picture of DEPL-/.test(b.getAttribute("aria-label") ?? "")),
            states: [...new Set([...document.querySelectorAll("[data-plot-thumb]")].map((e) => e.getAttribute("data-plot-thumb")))],
            none: document.querySelectorAll('[data-plot-thumb="none"]').length,
        }))
        check("header thumbnails are buttons with an accessible name (Samples pattern)", thumbs.buttons > 0 && thumbs.labelled, JSON.stringify(thumbs))
        check("a plot without a picture shows the muted placeholder (no button)", thumbs.none > 0, JSON.stringify(thumbs))
        check("thumbnails settle to image / failed (loading state resolved)", await waitFor(page, () => ![...document.querySelectorAll("[data-plot-thumb]")].some((e) => e.getAttribute("data-plot-thumb") === "loading"), 15000))
        const withPicture = await page.evaluate(() => document.querySelector("[data-plot-thumb-open]")?.closest("[data-plot-card]")?.getAttribute("data-plot-card"))
        const without = await page.evaluate(() => document.querySelector('[data-plot-thumb="none"]')?.closest("[data-plot-card]")?.getAttribute("data-plot-card"))
        // the thumbnail opens the existing preview and does NOT toggle the card
        const expandedBefore = await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"]`)?.hasAttribute("data-plot-expanded"), withPicture)
        await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-plot-thumb-open]`)?.click(), withPicture)
        check("clicking the thumbnail opens the picture preview", await waitFor(page, () => !!document.querySelector('[role="dialog"] img[alt="Preview"]') || !!document.querySelector('[data-preview-state="failed"]'), 8000))
        check("…without toggling the plot card", (await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"]`)?.hasAttribute("data-plot-expanded"), withPicture)) === expandedBefore)
        await page.keyboard.press("Escape")
        await waitFor(page, () => !document.querySelector('[role="dialog"] img[alt="Preview"]'), 5000)
        // the "Picture" row: View on a plot with a picture, Not uploaded on one without
        for (const id of [withPicture, without]) {
            if (!id) continue
            await page.evaluate((p) => { const c = document.querySelector(`[data-plot-card="${p}"]`); if (c && !c.hasAttribute("data-plot-expanded")) c.querySelector("[data-plot-toggle]")?.click() }, id)
            await sleep(600)
        }
        const pictureRows = await page.evaluate((a, b) => ({
            view: !!document.querySelector(`[data-plot-card="${a}"] [data-detail-row="picture"] [data-picture-view]`),
            missing: b ? document.querySelector(`[data-plot-card="${b}"] [data-detail-row="picture"] [data-picture-missing]`)?.textContent.trim() : null,
            moreWith: document.querySelector(`[data-plot-card="${a}"] [data-more-menu]`)?.getAttribute("data-more-actions") ?? "",
            moreWithout: b ? document.querySelector(`[data-plot-card="${b}"] [data-more-menu]`)?.getAttribute("data-more-actions") ?? "" : null,
        }), withPicture, without)
        check("expanded details have a Picture row: View (opens the preview) / Not uploaded", pictureRows.view && (pictureRows.missing === null || pictureRows.missing === "Not uploaded"), JSON.stringify(pictureRows))
        check("More keeps \"View picture\" only where there is a picture", /view-picture/.test(pictureRows.moreWith) && (pictureRows.moreWithout === null || !/view-picture/.test(pictureRows.moreWithout)))
        await page.evaluate((id) => document.querySelector(`[data-plot-card="${id}"] [data-picture-view]`)?.click(), withPicture)
        check("the Picture row's View opens the preview", await waitFor(page, () => !!document.querySelector('[role="dialog"] img[alt="Preview"]') || !!document.querySelector('[data-preview-state="failed"]'), 8000))
        await page.keyboard.press("Escape")
        await sleep(400)
        await L.closeSheet(page)

        // Inspector trace labels: reads vs mutations, ids only
        await openInspector(page)
        const entries = await traceEntries(page)
        check("dispatch reads are labelled with farmer / round / AZ ids and 'all statuses' (status omitted)", entries.some((e) => e.path === "/adminDeploymentSec/v3/getTrailerDetails" && /farmer \d+ · round \d+ · AZ \d+ · all statuses/.test(e.text)))
        check("the farmer-rows read is labelled as such", entries.some((e) => e.path === "/adminFarmApp/v4/getDeploymentMetadata" && /Farmer rows · farmer \d+/.test(e.text)))
        check("reads and mutations are distinguished; nothing here was a mutation", entries.every((e) => e.kind === "read"))
        check("no phone number appears in the trace list", !/\b\d{10}\b/.test(entries.map((e) => e.text).join(" ")))
        await closeInspector(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
