/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the NOC review footer keeps Previous / Next and Report / Approve in fixed, separate places.
// Before the fix the pager and the conditional Report / Approve shared one right-aligned group: on an approved document
// (no actions) the pager moved to the right edge, so Previous on document 10 sat exactly where document 9's Approve
// appears — a second Previous click approved a NOC. ?mockNoc=nourl gives the first farmer 15 documents: pending and
// approved, with an image, without one ("No NOC image was sent.") and with a broken link.
//   1. Previous / Next keep the same boxes on every document (every status and body), at 1600 and 390 px.
//   2. Report / Approve never overlap a navigation box; what is under each navigation button's centre is that button.
//   3. Real mouse clicks at the SAME screen points walk all documents forward and back, across the pending ↔ approved
//      boundary, without ever sending a decision.
//   4. Previous / Next select the right document (positions and keys in order, there and back).
//   5. Report and Approve are each clickable and send exactly their own decision (one request, its status, its AZ);
//      the navigation doesn't move while a decision is in flight.
//   6. Keyboard: Tab order Previous → Next → Report → Approve; Enter on Next keeps focus on Next across the boundary
//      and never decides; the arrow keys still move between documents.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L
const NOC_DECISION = "/adminDeploymentSec/updateFarmerDeploymentNOC"

const state = (page) => page.evaluate(() => {
    const d = document.querySelector("[data-noc-review]")
    if (!d) return null
    const box = (sel) => { const e = d.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
    /** What is actually under a control's centre (hit test). */
    const hit = (sel) => {
        const e = d.querySelector(sel)
        if (!e) return null
        const r = e.getBoundingClientRect()
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        // a disabled button (first / last document) lets the pointer through: then it must land on the navigation area
        return at?.closest("[data-noc-prev]") ? "prev" : at?.closest("[data-noc-next]") ? "next" : at?.closest("[data-noc-approve]") ? "approve" : at?.closest("[data-noc-report]") ? "report" : at?.closest("[data-noc-nav]") || (e.disabled && at?.closest("[data-noc-footer]") && !at.closest("[data-noc-actions]")) ? (e.disabled ? "disabled-nav" : "other") : "other"
    }
    return {
        key: d.getAttribute("data-noc-current"), position: d.getAttribute("data-noc-position"), status: d.getAttribute("data-noc-current-status"),
        body: d.querySelector("[data-noc-no-image]") ? "no-image" : d.querySelector("[data-preview-state='failed']") ? "failed" : "image",
        prev: box("[data-noc-prev]"), next: box("[data-noc-next]"), report: box("[data-noc-report]"), approve: box("[data-noc-approve]"), actions: box("[data-noc-actions]"),
        hitPrev: hit("[data-noc-prev]"), hitNext: hit("[data-noc-next]"),
    }
})
const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5
const overlaps = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b
const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** The NOC decisions the mock recorded in the Inspector trace (status + AZ from each request body). */
async function decisions(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(500)
    const out = await page.evaluate(async (path) => {
        const list = []
        for (const e of document.querySelectorAll(`[data-trace-entry][data-trace-path="${path}"]`)) {
            e.querySelector("button")?.click()
            await new Promise((r) => setTimeout(r, 40))
            const text = (e.querySelector("[data-trace-details]")?.textContent ?? "").split("Response body")[0]
            list.push({ status: (text.match(/"status":\s*"([a-z_]+)"/) ?? [])[1] ?? null, az: Number((text.match(/"az_id":\s*"?(\d+)/) ?? [])[1] ?? NaN) })
        }
        return list
    }, NOC_DECISION)
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-inspector]"), 5000)
    await sleep(300)
    return out
}

async function openReview(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.loadAllRows(page)
    const row = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))
    await L.openRow(page, row.index)
    await L.detailLoaded(page)
    await sleep(800)
    await L.openNocReview(page)
    return waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)
}
/** Waits until the shown document changed from `key` (and its image / no-image body settled). */
const changed = async (page, key) => { await waitFor(page, (k) => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-current") !== k, 4000, key); await sleep(350) }

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── 1–4: positions, hit areas and real clicks across every document (1600 px) ─────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=nourl`, errors)
        check("the NOC review opens on a document", await openReview(page))
        await sleep(600)
        const first = await state(page)
        const total = Number(first.position.split("/")[1])
        const nextPoint = centre(first.next)
        const seen = [first]
        // forward: always the same screen point (Next's centre on document 1)
        for (let i = 1; i < total; i++) {
            const key = seen[seen.length - 1].key
            await page.mouse.click(nextPoint.x, nextPoint.y)
            await changed(page, key)
            seen.push(await state(page))
        }
        const prevPoint = centre(seen[seen.length - 1].prev)
        const back = [seen[seen.length - 1]]
        for (let i = 1; i < total; i++) {
            const key = back[back.length - 1].key
            await page.mouse.click(prevPoint.x, prevPoint.y)
            await changed(page, key)
            back.push(await state(page))
        }
        const all = [...seen, ...back]
        const kinds = [...new Set(all.map((s) => `${s.status}/${s.body}`))]
        check("1. the documents cover every state: pending and approved, each with an image, without one and with a broken link", ["pending/image", "pending/no-image", "pending/failed", "approved/image", "approved/no-image", "approved/failed"].every((k) => kinds.includes(k)), kinds.join(", "))
        check("1. Previous and Next have the same boxes on every document (every status and body)", all.every((s) => same(s.prev, first.prev) && same(s.next, first.next)), JSON.stringify({ prev: first.prev, next: first.next, differ: all.filter((s) => !same(s.prev, first.prev) || !same(s.next, first.next)).map((s) => s.position) }))
        const navBoxes = all.flatMap((s) => [s.prev, s.next])
        const actionBoxes = all.flatMap((s) => [s.report, s.approve]).filter(Boolean)
        check("2. Report / Approve never overlap a Previous / Next box seen on ANY document", actionBoxes.length > 0 && actionBoxes.every((a) => navBoxes.every((n) => !overlaps(a, n))), `${actionBoxes.length} action boxes vs ${navBoxes.length} navigation boxes`)
        const navHit = (h, want) => h === want || h === "disabled-nav"
        check("2. on every document, what is under Previous's and Next's centres is Previous and Next (a disabled one: its own navigation area) — never Approve / Report", all.every((s) => navHit(s.hitPrev, "prev") && navHit(s.hitNext, "next")) && all.some((s) => s.hitPrev === "prev") && all.some((s) => s.hitNext === "next"), JSON.stringify(all.filter((s) => !navHit(s.hitPrev, "prev") || !navHit(s.hitNext, "next")).map((s) => [s.position, s.hitPrev, s.hitNext])))
        const pendingActions = all.filter((s) => s.status === "pending")
        check("2. the decision slot is fixed: Report / Approve keep their boxes on every pending document, and the slot keeps its place when they are absent", pendingActions.every((s) => same(s.report, pendingActions[0].report) && same(s.approve, pendingActions[0].approve)) && all.every((s) => same(s.actions, first.actions)))
        const boundary = all.findIndex((s, i) => i > 0 && s.status !== all[i - 1].status)
        check("3. across the pending → approved boundary (actions disappear) and back (they appear) the navigation doesn't move", boundary > 0 && all.every((s, i) => i === 0 || s.status === all[i - 1].status || (same(s.prev, all[i - 1].prev) && same(s.next, all[i - 1].next))), `first boundary at ${all[boundary]?.position}`)
        const fwd = seen.map((s) => s.position), bwd = back.map((s) => s.position)
        check("4. Next (clicked at one fixed point) visits 1 → n in order; Previous (one fixed point) returns n → 1", fwd.every((p, i) => p === `${i + 1}/${total}`) && bwd.every((p, i) => p === `${total - i}/${total}`), `${fwd.join(" ")} | ${bwd.join(" ")}`)
        check("4. Previous returns to exactly the documents Next showed (same keys, reverse order)", JSON.stringify(back.map((s) => s.key)) === JSON.stringify([...seen].reverse().map((s) => s.key)))
        await L.closeNocReview(page)
        await L.closeSheet(page)
        const sent = await decisions(page)
        check("3. 2 × (n − 1) navigation clicks sent no NOC decision", sent.length === 0, `${sent.length} decisions`)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── 5–6: keyboard, then Report / Approve each sending only their own decision ─────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=nourl`, errors)
        await openReview(page)
        await sleep(600)
        const start = await state(page)
        // Tab order within the footer on a pending document
        await page.evaluate(() => document.querySelector("[data-noc-prev]")?.removeAttribute("disabled"))
        await page.evaluate(() => document.querySelector("[data-noc-next]")?.focus())
        const order = ["next"]
        for (let i = 0; i < 2; i++) {
            await page.keyboard.press("Tab")
            order.push(await page.evaluate(() => { const a = document.activeElement; return a?.closest("[data-noc-report]") ? "report" : a?.closest("[data-noc-approve]") ? "approve" : a?.closest("[data-noc-next]") ? "next" : a?.closest("[data-noc-prev]") ? "prev" : a?.tagName ?? "none" }))
        }
        check("6. Tab order: Next → Report → Approve (navigation first, the decision after)", order.join(" → ") === "next → report → approve", order.join(" → "))
        // Enter on Next, repeatedly, across the pending → approved boundary: focus stays on Next, no decision
        await page.evaluate(() => document.querySelector("[data-noc-next]")?.focus())
        const total = Number(start.position.split("/")[1])
        const visited = [start.position]
        let focusKept = true
        for (let i = 1; i < total; i++) {
            const key = (await state(page)).key
            await page.keyboard.press("Enter")
            await changed(page, key)
            visited.push((await state(page)).position)
            if (i < total - 1) focusKept = focusKept && (await page.evaluate(() => !!document.activeElement?.closest("[data-noc-next]")))
        }
        check("6. Enter on Next walks every document with focus kept on Next (across the boundary where Approve disappears)", visited.every((p, i) => p === `${i + 1}/${total}`) && focusKept, `${visited.join(" ")} · focus kept: ${focusKept}`)
        // arrow keys still move between documents
        await page.evaluate(() => document.querySelector("[data-noc-review]")?.focus())
        let key = (await state(page)).key
        await page.keyboard.press("ArrowLeft")
        await changed(page, key)
        const left = await state(page)
        key = left.key
        await page.keyboard.press("ArrowRight")
        await changed(page, key)
        const right = await state(page)
        check("6. the arrow keys still move between documents (Left: previous, Right: next)", left.position === `${total - 1}/${total}` && right.position === `${total}/${total}`, `${left.position} → ${right.position}`)
        await L.closeNocReview(page)
        await L.closeSheet(page)
        check("6. the keyboard walk sent no NOC decision", (await decisions(page)).length === 0)

        // Report on the first document, Approve on the next waiting one — each one request, its own status and AZ
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        const row = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(600)
        await L.openNocReview(page)
        await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)
        await sleep(500)
        const before = await state(page)
        const reportAz = Number(await page.evaluate(() => document.querySelector("[data-noc-review]").getAttribute("data-noc-az")))
        const rp = centre(before.report)
        await page.mouse.click(rp.x, rp.y)
        const during = await state(page)
        check("5. while the report is in flight, Previous / Next stay where they were", same(during.prev, before.prev) && same(during.next, before.next))
        await waitFor(page, () => /reported/i.test(document.body.innerText), 8000)
        await sleep(1500)
        const afterReport = await state(page)
        const approveAz = Number(await page.evaluate(() => document.querySelector("[data-noc-review]").getAttribute("data-noc-az")))
        const ap = centre(afterReport.approve)
        await page.mouse.click(ap.x, ap.y)
        const duringApprove = await state(page)
        check("5. while the approval is in flight, Previous / Next and Report stay where they were (Approve has a fixed width)", same(duringApprove.prev, before.prev) && same(duringApprove.next, before.next) && same(duringApprove.report, before.report))
        await waitFor(page, () => /Noc qualified successfully/.test(document.body.innerText), 8000)
        await sleep(1500)
        await L.closeNocReview(page)
        await L.closeSheet(page)
        const sent = await decisions(page)
        const statuses = sent.map((d) => d.status).sort()
        check("5. Report and Approve each sent exactly one decision of their own kind: rejected (Report) and approved (Approve)", sent.length === 2 && JSON.stringify(statuses) === JSON.stringify(["approved", "rejected"]), JSON.stringify(sent))
        check("5. each decision is for the document that was shown when its button was clicked (its AZ)", sent.some((d) => d.status === "rejected" && d.az === reportAz) && sent.some((d) => d.status === "approved" && d.az === approveAz), JSON.stringify({ sent, reportAz, approveAz }))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── narrow (390 px): navigation and decision on separate rows, both fixed ─────────────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=nourl`, errors)
        await page.setViewport({ width: 390, height: 844 })
        await openReview(page)
        await sleep(600)
        const first = await state(page)
        const total = Number(first.position.split("/")[1])
        const all = [first]
        for (let i = 1; i < total; i++) {
            const key = all[all.length - 1].key
            await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
            await changed(page, key)
            all.push(await state(page))
        }
        check("390px: Previous / Next keep their boxes on every document", all.every((s) => same(s.prev, first.prev) && same(s.next, first.next)))
        const navBoxes = all.flatMap((s) => [s.prev, s.next])
        check("390px: Report / Approve never overlap navigation (their own row), and every navigation centre hits its button", all.flatMap((s) => [s.report, s.approve]).filter(Boolean).every((a) => navBoxes.every((n) => !overlaps(a, n))) && all.every((s) => (s.hitPrev === "prev" || s.hitPrev === "disabled-nav") && (s.hitNext === "next" || s.hitNext === "disabled-nav")))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
