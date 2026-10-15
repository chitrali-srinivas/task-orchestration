/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — hover previews in the farmer detail (components/media-hover-preview.tsx) on a plot's
// picture thumbnail, a dispatch's video button and a plot's Location row:
//   - a pointer resting on the trigger opens the preview after a short delay; sweeping across the triggers opens none;
//     leaving closes it;
//   - keyboard focus opens it (the Location row is reachable by Tab); closing the viewer with the mouse doesn't pop it;
//   - touch: a long press opens it without opening the viewer; a tap still opens the viewer;
//   - a click still opens the viewer (picture / video);
//   - the picture preview shows the thumbnail's own URL (nothing else is downloaded); the video preview plays the video
//     itself, muted, inline, at normal speed (the mock's sample URL is answered with a local clip), one at a time, and
//     stops — its element gone, no more requests — when the card closes; a video that can't be loaded says so (the
//     sample URL's real 403); the location preview shows the plot's coordinates (the row's, to 4 dp);
//   - the card stays inside the viewport and off its trigger (1600 and 390 px).
// Prints PASS / FAIL lines; exits non-zero on a failure.
const fs = require("fs")
const path = require("path")
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const isOpen = (page, kind) => page.evaluate((k) => document.querySelector(`[data-hover-preview="${k}"]`)?.getAttribute("data-state") === "open", kind)
const anyOpen = (page) => page.evaluate(() => !!document.querySelector('[data-hover-preview][data-state="open"]'))
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 } }, sel)
/** A neutral spot in the detail (the farmer avatar): no trigger under it. */
const rest = async (page) => { const a = await rect(page, "[data-farmer-avatar]"); await page.mouse.move(a.cx, a.cy); return a }
const overlaps = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b
const IMAGE = '[data-hover-preview-trigger="image"]'
const VIDEO = '[data-hover-preview-trigger="video"]'

async function openDetail(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.openRow(page, 0)
    await L.detailLoaded(page)
    await sleep(800)
    await L.expandAllDispatches(page)
    await sleep(800)
    // open the first plot that has a picture (its Location row renders inside it)
    await page.evaluate(() => [...document.querySelectorAll("[data-plot-toggle]")].find((t) => t.querySelector("[data-plot-thumb-open]") && t.getAttribute("aria-expanded") !== "true")?.click())
    await waitFor(page, () => !!document.querySelector("[data-location-preview]"), 6000)
    await page.evaluate(() => document.querySelector(`[data-hover-preview-trigger="image"]`)?.scrollIntoView({ block: "center" }))
    await sleep(500)
}

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []
    // the mock's sample video (a public demo URL, no longer served) → a local 20 s clip, so the preview can really play
    const clip = { match: /\.mp4(\?|$)/, contentType: "video/webm", body: fs.readFileSync(path.join(__dirname, "fixtures", "clip.webm")) }
    const page = await L.open(browser, L.V21, errors, { fulfil: [clip] })
    const requests = []
    page.on("request", (r) => requests.push(r.url()))
    await openDetail(page)
    const counts = await page.evaluate(() => ["image", "video", "location"].map((k) => document.querySelectorAll(`[data-hover-preview-trigger="${k}"]`).length))
    check("triggers: plot pictures, dispatch videos and the Location row", counts.every((n) => n > 0), `image ${counts[0]} · video ${counts[1]} · location ${counts[2]}`)

    // ── picture: delay, contents, no new download, leave closes ──────────────────────────────────────────────────────
    await rest(page)
    await sleep(400)
    const thumbSrc = await page.$eval(`${IMAGE} img`, (i) => i.currentSrc || i.src)
    const t = await rect(page, IMAGE)
    const mark = requests.length
    await page.mouse.move(t.cx, t.cy)
    await sleep(200)
    const early = await isOpen(page, "image")
    await sleep(700)
    const opened = await isOpen(page, "image")
    check("picture: not open 200 ms after the pointer arrives, open after the delay", !early && opened, JSON.stringify({ early, opened }))
    const shown = await page.evaluate(() => { const i = document.querySelector('[data-hover-preview="image"] img'); return i ? (i.currentSrc || i.src) : null })
    check("picture: the preview shows the thumbnail's own picture", shown === thumbSrc, `${shown} vs ${thumbSrc}`)
    await sleep(400)
    const fetched = requests.slice(mark).filter((u) => !/\/_next\/|__nextjs|webpack|hot-update|^data:/.test(u))
    check("picture: hovering downloads nothing but that same picture", fetched.every((u) => u === thumbSrc), fetched.join(", ") || "no requests")
    const card = await rect(page, '[data-hover-preview="image"]')
    check("picture: the card is inside the viewport and off its trigger (1600 px)", card.x >= 0 && card.y >= 0 && card.r <= 1600 && card.b <= 1000 && !overlaps(card, t), JSON.stringify({ card, trigger: t }))
    await rest(page)
    check("picture: leaving closes it", await waitFor(page, () => !document.querySelector('[data-hover-preview="image"][data-state="open"]'), 2000))
    await sleep(400)

    // ── sweeping across the triggers opens nothing ───────────────────────────────────────────────────────────────────
    await page.evaluate(() => {
        window.__previewSeen = false
        window.__previewObserver = new MutationObserver(() => { if (document.querySelector("[data-hover-preview]")) window.__previewSeen = true })
        window.__previewObserver.observe(document.body, { childList: true, subtree: true })
    })
    const sweep = await page.evaluate(() => [...document.querySelectorAll("[data-hover-preview-trigger]")].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }).filter((p) => p.y > 0 && p.y < innerHeight))
    for (const p of sweep) { await page.mouse.move(p.x, p.y, { steps: 3 }); await sleep(90) }
    await rest(page)
    await sleep(900)
    const seen = await page.evaluate(() => { window.__previewObserver.disconnect(); return window.__previewSeen })
    check("a quick sweep across the triggers opens no preview", sweep.length >= 2 && !seen, `${sweep.length} triggers swept, preview seen: ${seen}`)

    // ── video: the video itself, muted, inline, at normal speed; one at a time; stopped on close ────────────────────
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), VIDEO)
    await sleep(400)
    const v = await rect(page, VIDEO)
    const vMark = requests.length
    await page.mouse.move(v.cx, v.cy)
    const playing = await waitFor(page, () => document.querySelector('[data-hover-preview="video"] [data-hover-preview-state]')?.getAttribute("data-hover-preview-state") === "video", 8000)
    const sample = () => page.evaluate(() => { const el = document.querySelector('[data-hover-preview="video"] video'); return el ? { t: el.currentTime, muted: el.muted, rate: el.playbackRate, paused: el.paused, inline: el.playsInline, network: el.networkState, ready: el.readyState, src: (el.getAttribute("src") ?? "").slice(-24), state: document.querySelector('[data-hover-preview="video"] [data-hover-preview-state]')?.getAttribute("data-hover-preview-state") } : null })
    const va = await sample()
    await sleep(1000)
    const vb = await sample()
    const video = await page.evaluate(() => {
        const c = document.querySelector('[data-hover-preview="video"]')
        return { open: c?.getAttribute("data-state") === "open", videos: document.querySelectorAll("video").length, text: c?.textContent ?? "" }
    })
    const videoRequests = requests.slice(vMark).filter((u) => /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(u))
    check("video: the preview plays the video itself — muted, inline, at normal speed (1×), advancing; the only <video> on the page; the file name shown",
        playing && video.open && !!va && !!vb && vb.muted && vb.inline && vb.rate === 1 && !vb.paused && vb.t - va.t > 0.5 && vb.t - va.t < 1.6 && video.videos === 1 && /\.mp4/.test(video.text) && videoRequests.length >= 1,
        JSON.stringify({ playing, va, vb, ...video, requests: videoRequests.length }))
    // a second video trigger: still one stream
    const others = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }).filter((p) => p.y > 0 && p.y < innerHeight), VIDEO)
    const second = others.find((p) => Math.hypot(p.x - v.cx, p.y - v.cy) > 20)
    if (second) {
        await page.mouse.move(second.x, second.y)
        await waitFor(page, () => document.querySelector('[data-hover-preview="video"] [data-hover-preview-state]')?.getAttribute("data-hover-preview-state") === "video", 8000)
        const streams = await page.evaluate(() => [...document.querySelectorAll("video")].filter((el) => !el.paused && el.getAttribute("src")).length)
        check("video: moving to another video's trigger — one preview, one stream", streams === 1, `${streams} playing`)
    }
    await rest(page)
    await waitFor(page, () => !document.querySelector('[data-hover-preview="video"]'), 3000)
    const closeMark = requests.length
    await sleep(1500)
    const afterClose = { videos: await page.evaluate(() => document.querySelectorAll("video").length), requests: requests.slice(closeMark).filter((u) => /\.(mp4|webm)(\?|$)/i.test(u)).length }
    check("video: closing the card stops the preview — its element gone, no more video requests", afterClose.videos === 0 && afterClose.requests === 0, JSON.stringify(afterClose))
    await sleep(300)

    // ── location: keyboard (Tab) reaches it; the coordinates are the row's ───────────────────────────────────────────
    await page.focus(IMAGE + " button")
    let reached = false
    for (let i = 0; i < 40 && !reached; i++) {
        await page.keyboard.press("Tab")
        reached = await page.evaluate(() => document.activeElement?.hasAttribute("data-location-preview") ?? false)
    }
    await sleep(800)
    const loc = await page.evaluate(() => ({ open: document.querySelector('[data-hover-preview="location"]')?.getAttribute("data-state") === "open", coords: document.querySelector("[data-hover-preview-coordinates]")?.textContent ?? "", row: document.activeElement?.textContent ?? "" }))
    const nums = (s) => (s.match(/-?\d+\.\d+/g) ?? []).map(Number)
    const [pLat, pLng] = nums(loc.coords), [rLat, rLng] = nums(loc.row)
    check("location: Tab reaches the Location row and focus opens its preview", reached && loc.open, JSON.stringify({ reached, open: loc.open }))
    check("location: the preview's coordinates are the row's (5 dp → 4 dp)", Number.isFinite(pLat) && Math.abs(pLat - rLat) < 0.00006 && Math.abs(pLng - rLng) < 0.00006, `${loc.coords} | ${loc.row}`)
    await page.keyboard.press("Tab")
    check("location: moving focus on closes it", await waitFor(page, () => !document.querySelector('[data-hover-preview="location"][data-state="open"]'), 2000))

    // ── picture: keyboard focus opens it ─────────────────────────────────────────────────────────────────────────────
    await page.focus(IMAGE + " button")
    await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift")
    await page.keyboard.press("Tab")
    await sleep(800)
    check("picture: keyboard focus on the thumbnail opens its preview", await isOpen(page, "image"))
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
    await sleep(400)

    // ── clicks unchanged: the viewer opens; closing it with the mouse doesn't pop the preview ────────────────────────
    const t2 = await rect(page, IMAGE)
    await page.mouse.click(t2.cx, t2.cy)
    const viewer = await waitFor(page, () => !!document.querySelector("[data-image-stage] img"), 6000)
    check("picture: a click opens the picture viewer (as before)", viewer)
    await page.mouse.move(5, 5)
    await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^close$/i.test(b.getAttribute("aria-label") ?? b.textContent.trim()) && b.closest('[role="dialog"]')?.querySelector("[data-image-stage]"))?.click())
    await waitFor(page, () => !document.querySelector("[data-image-stage]"), 4000)
    // the mouse that closed it is not over the trigger
    await sleep(1000)
    check("picture: after the viewer closes (mouse), the preview doesn't pop up on the returned focus", !(await isOpen(page, "image")))
    const v2 = await rect(page, VIDEO)
    await page.mouse.click(v2.cx, v2.cy)
    check("video: a click opens the video viewer (as before)", await waitFor(page, () => !!document.querySelector("[data-video-player]"), 6000))
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-video-player]"), 4000)
    await rest(page)
    await sleep(600)

    // ── touch: long press = preview (no viewer); tap = viewer ────────────────────────────────────────────────────────
    const cdp = await page.target().createCDPSession()
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
    const touch = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) })
    const t3 = await rect(page, IMAGE)
    await touch("touchStart", [[t3.cx, t3.cy]]); await sleep(700); await touch("touchEnd", [])
    await sleep(500)
    const pressed = await page.evaluate(() => ({ open: document.querySelector('[data-hover-preview="image"]')?.getAttribute("data-state") === "open", viewer: !!document.querySelector("[data-image-stage]") }))
    check("touch: a long press opens the preview and not the viewer", pressed.open && !pressed.viewer, JSON.stringify(pressed))
    const a = await rect(page, "[data-farmer-avatar]")
    await touch("touchStart", [[a.cx, a.cy]]); await sleep(40); await touch("touchEnd", [])
    check("touch: a tap elsewhere closes it", await waitFor(page, () => !document.querySelector('[data-hover-preview="image"][data-state="open"]'), 2000))
    await sleep(400)
    await touch("touchStart", [[t3.cx, t3.cy]]); await sleep(60); await touch("touchEnd", [])
    check("touch: a tap on the thumbnail opens the viewer (as before)", await waitFor(page, () => !!document.querySelector("[data-image-stage] img"), 6000))
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false })
    await page.keyboard.press("Escape")
    await waitFor(page, () => !document.querySelector("[data-image-stage]"), 4000)
    await sleep(600)

    // ── narrow: the card stays inside the viewport and off its trigger ───────────────────────────────────────────────
    await page.setViewport({ width: 390, height: 844 })
    await sleep(1200)
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), IMAGE)
    await sleep(500)
    await rest(page).catch(() => page.mouse.move(2, 2))
    const t4 = await rect(page, IMAGE)
    await page.mouse.move(t4.cx, t4.cy)
    await sleep(900)
    const narrow = await rect(page, '[data-hover-preview="image"]')
    check("picture: the card is inside the viewport and off its trigger (390 px)", !!narrow && narrow.x >= 0 && narrow.y >= 0 && narrow.r <= 390 && narrow.b <= 844 && !overlaps(narrow, t4), JSON.stringify({ card: narrow, trigger: t4 }))
    await page.mouse.move(2, 2)

    {
        const failing = await L.open(browser, L.V21, errors) // no stand-in: the sample URL answers 403
        await openDetail(failing)
        await failing.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), VIDEO)
        await sleep(400)
        const fv = await rect(failing, VIDEO)
        await failing.mouse.move(fv.cx, fv.cy)
        const failed = await waitFor(failing, () => document.querySelector('[data-hover-preview="video"] [data-hover-preview-state]')?.getAttribute("data-hover-preview-state") === "video-failed", 10000)
        const text = await failing.evaluate(() => document.querySelector('[data-hover-preview="video"]')?.textContent ?? "")
        check("video: a video that can't be loaded — the preview says so (no endless spinner), the card's title and file name stay", failed && /couldn.t be loaded/.test(text) && /\.mp4/.test(text), text.slice(0, 120))
        blocked.push(...failing.blockedApi)
        await failing.close()
    }
    check("no preview left open", await waitFor(page, () => !document.querySelector('[data-hover-preview][data-state="open"]'), 2000) && !(await anyOpen(page)))
    blocked.push(...page.blockedApi)
    await page.close()
    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
