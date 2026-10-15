/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — "Action required" is the server's validation of ONE dispatch, shown as sent.
// Live evidence (read-only, 2026-10-11): `action_required` / `err_msg` come per dispatch (list row and dispatch read agree,
// 42 of 42); AZ 6 ("Biomass pellet") dispatches never record video / source / cluster and the server flags every one with
// AZ 1's messages; AZ 4 (AWD) lacks the same fields and is never flagged; AZ 1 is flagged only where a field is empty.
// Whether AZ 6 REQUIRES those fields is a backend question (not stated by the API), so V2.1 neither adds nor removes a
// requirement. ?mockTypes=all&mockValidation=az copies that pattern (data/mock-backend.ts). Checked here:
//   - AZ 6: exactly the server's four messages, verbatim, in order, once each, on that dispatch only;
//   - AZ 1: its own different message (another AZ's requirements as the server sent them);
//   - a dispatch with no flag, and AZ 4 dispatches with the same empty fields: no Action required (nothing derived);
//   - a dispatch whose validation wasn't sent (null): nothing fabricated;
//   - isolation: no message reaches a sibling dispatch, another AZ or another farmer.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep } = L

const AZ6_MESSAGES = ["Video is missing.", "Cluster Name is missing.", "Source Name is missing.", "Amount Plot Deploy is missing."]
const AZ1_MESSAGES = ["Picture Deployment is missing."]
const ALL_MESSAGES = [...AZ6_MESSAGES, ...AZ1_MESSAGES]

/** The table's dispatch rows: index, dispatch id, AZ, the validation marker (count + label). */
const tableRows = (page) => page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((tr, index) => {
    const cell = tr.querySelector("[data-dispatch-cell]")
    if (!cell) return null
    const m = tr.querySelector("[data-dispatch-validation]")
    return { index, id: cell.getAttribute("data-dispatch-cell"), az: tr.querySelector("[data-row-az]")?.getAttribute("data-row-az") ?? null, marker: m ? { count: Number(m.getAttribute("data-validation-count")), label: m.getAttribute("aria-label") } : null }
}).filter(Boolean))

/** Every dispatch card of the open detail, expanded, with every message shown ("Show all"). */
async function cards(page) {
    await L.expandAllDispatches(page)
    await sleep(800)
    await page.evaluate(() => document.querySelectorAll("[data-validation-toggle]").forEach((b) => { if (b.getAttribute("aria-expanded") !== "true") b.click() }))
    await sleep(300)
    return page.evaluate(() => [...document.querySelectorAll("[data-dispatch-row]")].map((c) => {
        const notice = c.querySelector("[data-dispatch-validation-notice]")
        const text = c.textContent.replace(/\s+/g, " ")
        return {
            dispatchId: c.getAttribute("data-dispatch-id"),
            az: c.closest("[data-farmer-row]")?.getAttribute("data-row-az") ?? null,
            marker: c.querySelector("[data-dispatch-validation]")?.getAttribute("data-validation-count") ?? null,
            notice: !!notice,
            count: notice ? Number(notice.getAttribute("data-validation-count")) : null,
            messages: [...(notice?.querySelectorAll("[data-validation-message]") ?? [])].map((m) => m.textContent.trim()),
            actionRequired: (text.match(/Action required/g) ?? []).length,
            // the heading and the first message are adjacent in textContent: drop the heading first
            missingTexts: (text.replace(/Action required/g, " ").match(/[A-Z][A-Za-z ]+ is missing\./g) ?? []).map((t) => t.trim()),
        }
    }))
}
const occurrences = (list, message) => list.reduce((n, c) => n + c.messages.filter((m) => m === message).length + (c.messages.length === 0 && c.missingTexts.includes(message) ? 1 : 0), 0)

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    {
        const page = await L.open(browser, `${L.V21}?mockTypes=all&mockValidation=az`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const rows = await tableRows(page)
        const flagged = rows.filter((r) => r.marker)
        const az6 = flagged.find((r) => r.az === "6")
        const az1 = flagged.find((r) => r.az === "1")
        check("table: exactly two dispatches carry a marker — the AZ 6 and the AZ 1 dispatch the server flagged", flagged.length === 2 && !!az6 && !!az1, flagged.map((r) => `AZ ${r.az}:${r.marker.count}`).join(", "))
        check("table: the AZ 6 marker counts the server's 4 messages and names exactly them, in order", !!az6 && az6.marker.count === 4 && az6.marker.label === `Action required: ${AZ6_MESSAGES.join("; ")}`, az6?.marker.label)
        check("table: the AZ 1 marker carries only its own message (another AZ, different requirements, as sent)", !!az1 && az1.marker.count === 1 && az1.marker.label === `Action required: ${AZ1_MESSAGES[0]}`, az1?.marker.label)
        const az4 = rows.filter((r) => r.az === "4")
        check("table: AZ 4 dispatches — video / source / cluster empty, as live AWD, never flagged — show no marker", az4.length > 0 && az4.every((r) => !r.marker), `${az4.length} AZ 4 rows`)
        const az6Siblings = rows.filter((r) => r.az === "6" && r.id !== az6?.id)
        check("table: the AZ 6 sibling whose validation wasn't sent (null) shows no marker", az6Siblings.length > 0 && az6Siblings.every((r) => !r.marker), `${az6Siblings.length} sibling(s)`)

        // the farmer of the AZ 6 dispatch (the derived AZ 4 / 5 / 6 deployments are the same farmer's)
        await L.openRow(page, az6.index)
        await L.detailLoaded(page)
        await sleep(1000)
        const list = await cards(page)
        const flaggedCard = list.find((c) => c.dispatchId === az6.id)
        check("detail: the AZ 6 card shows the server's 4 messages verbatim, in order, once each (no extra, no missing field)", !!flaggedCard && flaggedCard.notice && flaggedCard.count === 4 && JSON.stringify(flaggedCard.messages) === JSON.stringify(AZ6_MESSAGES) && flaggedCard.marker === "4", JSON.stringify(flaggedCard))
        check("detail: the AZ 6 card says Action required once (no summary repeating the field list)", !!flaggedCard && flaggedCard.actionRequired === 1, String(flaggedCard?.actionRequired))
        const nullCard = list.find((c) => c.az === "6" && c.dispatchId !== az6.id)
        check("detail: the AZ 6 dispatch with no validation sent shows no Action required and no 'is missing' text (nothing fabricated)", !!nullCard && !nullCard.notice && nullCard.marker === null && nullCard.actionRequired === 0 && nullCard.missingTexts.length === 0, JSON.stringify(nullCard))
        const az4Cards = list.filter((c) => c.az === "4")
        check("detail: AZ 4 cards with the same empty fields show no Action required (requirements are never inferred from empty fields)", az4Cards.length > 0 && az4Cards.every((c) => !c.notice && c.marker === null && c.missingTexts.length === 0), `${az4Cards.length} cards`)
        const others = list.filter((c) => c.dispatchId !== az6.id && c.dispatchId !== az1.id)
        check("detail: every unflagged dispatch of the farmer shows no Action required", others.length > 0 && others.every((c) => !c.notice && c.actionRequired === 0), `${others.length} cards`)
        check("isolation: each AZ 6 message appears exactly once in the farmer's detail — on its own dispatch", AZ6_MESSAGES.every((m) => occurrences(list, m) === 1) && list.filter((c) => c.messages.some((m) => AZ6_MESSAGES.includes(m))).every((c) => c.dispatchId === az6.id))
        const az1Here = list.find((c) => c.dispatchId === az1.id)
        check("isolation: the AZ 1 message is only on its own dispatch (never on an AZ 6 / AZ 4 card)", list.filter((c) => c.messages.includes(AZ1_MESSAGES[0])).every((c) => c.dispatchId === az1.id) && (!az1Here || JSON.stringify(az1Here.messages) === JSON.stringify(AZ1_MESSAGES)))
        await L.closeSheet(page)

        // the AZ 1 dispatch's own detail (its farmer may differ): its message, and none of AZ 6's
        await L.openRow(page, az1.index)
        await L.detailLoaded(page)
        await sleep(1000)
        const az1List = await cards(page)
        const az1Card = az1List.find((c) => c.dispatchId === az1.id)
        check("detail: the AZ 1 card shows its one message, verbatim", !!az1Card && az1Card.notice && JSON.stringify(az1Card.messages) === JSON.stringify(AZ1_MESSAGES), JSON.stringify(az1Card))
        check("isolation: no AZ 6 message appears in the AZ 1 dispatch's detail unless it is the same farmer's AZ 6 dispatch", az1List.filter((c) => c.messages.some((m) => AZ6_MESSAGES.includes(m))).every((c) => c.dispatchId === az6.id))
        check("only the server's messages appear anywhere ('… is missing.' texts are all from err_msg)", [...list, ...az1List].every((c) => c.missingTexts.every((t) => ALL_MESSAGES.includes(t))), JSON.stringify([...new Set([...list, ...az1List].flatMap((c) => c.missingTexts))]))
        await L.closeSheet(page)
        blocked.push(...page.blockedApi)
        await page.close()
    }
    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
