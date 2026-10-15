/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — a NOC document without an image link (?mockNoc=nourl: the first mock farmer's NOC read
// returns, per AZ, its document, one with noc: null and one whose link doesn't load). Before the fix the review rendered
// <img src=""> for a null link: an empty frame that neither loaded nor failed. Now:
//   - no link   → "No NOC image was sent." (role=status), no <img>, not the failed-image text, not "No NOC found";
//   - bad link  → the existing "This image couldn't be loaded." (the link failed);
//   - good link → the image;
//   - the document stays in the review: label, position, Previous / Next (buttons and arrow keys), and Report / Approve
//     exactly as for the farmer's documents WITH an image of the same status (the gate is unchanged; nothing clicked);
//   - a farmer with no NOC document still gets "No NOC found" (never the no-image state).
// Prints PASS / FAIL lines; exits non-zero on a failure.
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

/** The review's current document and its body state. */
const shown = (page) => page.evaluate(() => {
    const dialog = document.querySelector("[data-noc-review]")
    if (!dialog) return null
    const img = dialog.querySelector("img[alt='Preview']")
    const noImage = dialog.querySelector("[data-noc-no-image]")
    return {
        key: dialog.getAttribute("data-noc-current"),
        state: dialog.getAttribute("data-noc-review"),
        status: dialog.getAttribute("data-noc-current-status"),
        position: dialog.getAttribute("data-noc-position"),
        body: noImage ? "no-image" : dialog.querySelector('[data-preview-state="failed"]') ? "failed" : img ? (img.complete && img.naturalWidth > 0 ? "image" : img.getAttribute("src") ? "image-loading" : "image-empty-src") : dialog.querySelector("[data-noc-state]") ? `frame:${dialog.querySelector("[data-noc-state]").getAttribute("data-noc-state")}` : "nothing",
        emptySrcImg: [...dialog.querySelectorAll("img")].some((i) => !i.getAttribute("src")),
        statusRegion: noImage?.querySelector('[role="status"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
        failedText: /couldn't be loaded/.test(dialog.querySelector('[data-preview-state="failed"]')?.textContent ?? ""),
        noNocText: /No NOC found/.test(dialog.textContent),
        label: [...(dialog.querySelector("[data-noc-footer]")?.querySelectorAll("p") ?? [])].find((p) => /^NOC — /.test(p.textContent))?.textContent.trim() ?? "",
        pager: dialog.querySelector("[data-noc-pager]")?.getAttribute("data-noc-pager") ?? null,
        prev: !!dialog.querySelector("[data-noc-prev]"),
        next: !!dialog.querySelector("[data-noc-next]"),
        actions: [dialog.querySelector("[data-noc-report]") ? "Report" : null, dialog.querySelector("[data-noc-approve]") ? "Approve" : null].filter(Boolean).join("+") || "none",
        actionsEnabled: [...dialog.querySelectorAll("[data-noc-report], [data-noc-approve]")].every((b) => !b.disabled),
        closeLabel: noImage?.querySelector("[data-noc-close]")?.getAttribute("aria-label") ?? null,
    }
})
/** Waits until an image document has settled (loaded or failed). */
const settled = (page) => waitFor(page, () => { const d = document.querySelector("[data-noc-review]"); if (!d) return true; if (d.querySelector("[data-noc-no-image], [data-preview-state='failed']")) return true; const i = d.querySelector("img[alt='Preview']"); return !i || (i.complete && i.naturalWidth > 0) }, 8000)

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=nourl`, errors)
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.loadAllRows(page)
        const row = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))
        check("the first mock farmer (the ?mockNoc=nourl fixture) is on the All tab", !!row)
        await L.openRow(page, row.index)
        await L.detailLoaded(page)
        await sleep(800)
        check("the review opens on a document", (await L.openNocReview(page)) && (await waitFor(page, () => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-review") === "document", 6000)))

        // walk every document with Next (the buttons), recording each one's body
        const docs = []
        for (let i = 0; i < 40; i++) {
            await settled(page)
            await sleep(150)
            const s = await shown(page)
            docs.push(s)
            if (!s.next || (s.pager && s.pager.split("/")[0] === s.pager.split("/")[1])) break
            await page.evaluate(() => document.querySelector("[data-noc-next]")?.click())
            await waitFor(page, (k) => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-current") !== k, 4000, s.key)
        }
        const total = Number((docs[0]?.pager ?? "0/0").split("/")[1])
        const noImage = docs.filter((d) => d.body === "no-image")
        const failed = docs.filter((d) => d.body === "failed")
        const images = docs.filter((d) => d.body === "image")
        check("every document is reachable with Next (one per position)", docs.length === total && new Set(docs.map((d) => d.key)).size === total, `${docs.length}/${total}`)
        check("documents without an image link are kept in the review (not removed): one per NOC of the farmer", noImage.length > 0 && noImage.length === failed.length && noImage.length === images.length, JSON.stringify({ noImage: noImage.length, failed: failed.length, images: images.length }))
        check("no link → 'No NOC image was sent.' in a status region; no <img>, no empty src anywhere", noImage.every((d) => d.statusRegion?.startsWith("No NOC image was sent.") && !d.emptySrcImg), JSON.stringify(noImage[0]))
        check("no link is not the failed-image state, not 'No NOC found', not a loading / error frame", noImage.every((d) => !d.failedText && !d.noNocText && d.state === "document"))
        check("bad link → the existing 'This image couldn't be loaded.' (distinct from no link)", failed.every((d) => d.failedText && d.statusRegion === null))
        check("good link → the image renders", images.length > 0 && images.every((d) => !d.failedText && d.statusRegion === null))
        check("no link: the document keeps its label, position and pager", noImage.every((d) => /^NOC — /.test(d.label) && d.position && d.pager === d.position && d.prev && d.next), JSON.stringify(noImage.map((d) => [d.label, d.position])))
        // safeguards: the same Report / Approve as the image documents of the same status (unchanged gate)
        const byStatus = (list) => Object.fromEntries(list.map((d) => [d.status, `${d.actions}${d.actionsEnabled ? "" : "(disabled)"}`]))
        const imageActions = byStatus(images)
        check("no link: Report / Approve exactly as for the documents WITH an image of the same status (the gate is unchanged)", noImage.every((d) => imageActions[d.status] === `${d.actions}${d.actionsEnabled ? "" : "(disabled)"}`), JSON.stringify({ noImage: byStatus(noImage), images: imageActions }))
        check("no link: its Close button is labelled", noImage.every((d) => d.closeLabel === "Close"))

        // arrow keys move off and back onto a no-image document (first walk back to it with Previous, one click at a time)
        const target = noImage[0]
        const posOf = (d) => Number((d?.position ?? "0/0").split("/")[0])
        for (let i = 0; i < 40; i++) {
            const now = await shown(page)
            if (now.key === target.key) break
            await page.evaluate((back) => document.querySelector(back ? "[data-noc-prev]" : "[data-noc-next]")?.click(), posOf(now) > posOf(target))
            await waitFor(page, (k) => document.querySelector("[data-noc-review]")?.getAttribute("data-noc-current") !== k, 4000, now.key)
        }
        const onIt = await shown(page)
        await page.evaluate(() => document.querySelector("[data-noc-review]")?.focus())
        await page.keyboard.press("ArrowRight")
        await sleep(300)
        const right = await shown(page)
        await page.keyboard.press("ArrowLeft")
        await sleep(300)
        const left = await shown(page)
        check("arrow keys: Right leaves the no-image document, Left returns to it (still the no-image state)", onIt.key === target.key && right.key !== target.key && left.key === target.key && left.body === "no-image", JSON.stringify([onIt.position, right.position, left.position]))
        await L.closeNocReview(page)
        check("the review closes", !(await page.evaluate(() => !!document.querySelector("[data-noc-review]"))))
        await L.closeSheet(page)

        // a farmer with NO NOC document (mock farmer 1008) keeps "No NOC found" — never the no-image state
        const none = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1008-"))
        if (none) {
            await L.openRow(page, none.index)
            await L.detailLoaded(page)
            await sleep(600)
            const opened = await L.openNocReview(page)
            const s = opened ? await shown(page) : null
            check("missing NOC (no document) → 'No NOC found', never 'No NOC image was sent.'", !!s && s.state === "empty" && s.noNocText && s.body !== "no-image", JSON.stringify(s && [s.state, s.body]))
            await page.evaluate(() => document.querySelector("[data-noc-close]")?.click())
            await waitFor(page, () => !document.querySelector("[data-noc-review]"), 5000)
            await L.closeSheet(page)
        } else {
            check("the mock's farmer without a NOC is on the All tab", false)
        }
        blocked.push(...page.blockedApi)
        await page.close()
    }
    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
