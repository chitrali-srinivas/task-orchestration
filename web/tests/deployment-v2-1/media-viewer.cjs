/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Deployment V2.1 (mock mode) — the media viewer (components/deployment-detail-sheet.tsx ImagePreview,
// components/deployment-video-player.tsx):
//   image  the stage is the space between the viewer's header and footer (the footer never covers it); portrait and
//          landscape images are shown whole (object-contain) at 1600 and 390 px; double-click / double-tap zoom in and
//          back; pinch zooms; drag pans while zoomed, bounded; Rotate composes with zoom; Fit to view resets; no gesture
//          moves to another document, closes the viewer or sends a NOC decision (?mockNoc=multi: the NOC review);
//   video  the controls fade 2 s after the last interaction while playing, stay while paused, while a control has focus
//          and while the pointer is over them; mouse click = play / pause, double-click ≠ play / pause; touch tap = show
//          the controls (not play / pause), double-tap = seek; ← / → seek.
// Prints PASS / FAIL lines; exits non-zero on a failure.
const fs = require("fs")
const path = require("path")
const L = require("./lib.cjs")
const { check, sleep, waitFor } = L

const svg = (w, h) => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='#a1a1aa'/></svg>`)
const stage = (page) => page.evaluate(() => {
    const s = document.querySelector("[data-image-stage]")
    if (!s) return null
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height } }
    const img = s.querySelector("img")
    return { zoom: Number(s.dataset.zoom), pan: s.dataset.pan, rotation: Number(s.dataset.rotation), stage: r(s), media: r(document.querySelector("[data-media-stage]")), footer: r(document.querySelector("[data-noc-footer]")), img: r(img), nat: img ? [img.naturalWidth, img.naturalHeight] : null, key: document.querySelector("[data-noc-review]")?.getAttribute("data-noc-current") ?? null, open: !!document.querySelector("[data-noc-review]") }
})
/** The rendered picture inside an object-contain box. */
const contentBox = (img, nat) => { const k = Math.min(img.w / nat[0], img.h / nat[1]); const w = nat[0] * k, h = nat[1] * k; return { x: img.x + (img.w - w) / 2, y: img.y + (img.h - h) / 2, r: img.x + (img.w + w) / 2, b: img.y + (img.h + h) / 2 } }
async function openNocReview(page) {
    await L.rowsLoaded(page)
    await L.selectTab(page, "All")
    await L.dispatchRowsLoaded(page)
    await L.loadAllRows(page)
    const row = (await L.dispatchRows(page)).find((r) => r.id && r.rowKey && r.rowKey.startsWith("1001-"))
    await L.openRow(page, row.index)
    await L.detailLoaded(page)
    await sleep(800)
    await L.openNocReview(page)
    await waitFor(page, () => !!document.querySelector("[data-image-stage] img"), 8000)
    await sleep(800)
}
async function decisions(page) {
    await page.evaluate(() => document.querySelector("[data-inspector-trigger]")?.click())
    await waitFor(page, () => !!document.querySelector("[data-inspector]"), 8000)
    await page.evaluate(() => document.querySelector('[data-inspector-tab="activity"]')?.click())
    await sleep(400)
    const n = await page.evaluate(() => document.querySelectorAll('[data-trace-entry][data-trace-path="/adminDeploymentSec/updateFarmerDeploymentNOC"]').length)
    await page.keyboard.press("Escape")
    await sleep(300)
    return n
}
const centre = (b) => ({ x: (b.x + b.r) / 2, y: (b.y + b.b) / 2 })

;(async () => {
    const browser = await L.launch()
    const errors = []
    const blocked = []

    // ── image: layout (the footer never covers it), portrait / landscape, desktop / narrow ────────────────────────────
    {
        const page = await L.open(browser, `${L.V21}?mockNoc=multi`, errors)
        await openNocReview(page)
        for (const [w, h] of [[1600, 1000], [390, 844]]) {
            await page.setViewport({ width: w, height: h })
            await sleep(900)
            for (const [label, src] of [["portrait", svg(300, 600)], ["landscape", svg(800, 400)]]) {
                await page.evaluate((u) => { const i = document.querySelector("[data-image-stage] img"); i.src = u }, src)
                await waitFor(page, () => { const i = document.querySelector("[data-image-stage] img"); return !!i && i.complete && i.naturalWidth > 0 }, 5000)
                await sleep(300)
                const s = await stage(page)
                const c = contentBox(s.img, s.nat)
                const clear = s.footer ? s.media.b <= s.footer.y + 0.5 : true
                const whole = c.x >= s.stage.x - 0.5 && c.r <= s.stage.r + 0.5 && c.y >= s.stage.y - 0.5 && c.b <= s.stage.b + 0.5 && c.b <= (s.footer ? s.footer.y : h) + 0.5 && c.y >= 0 && c.r <= w + 0.5
                check(`image ${w}px ${label}: the stage ends where the footer begins, and the whole image is inside it (aspect kept)`, clear && whole && Math.abs((c.r - c.x) / (c.b - c.y) - s.nat[0] / s.nat[1]) < 0.02, JSON.stringify({ stage: s.stage, footer: s.footer, content: c }))
            }
        }
        await page.setViewport({ width: 1600, height: 1000 })
        await sleep(900)

        // ── image gestures (mouse) ───────────────────────────────────────────────────────────────────────────────────
        let s = await stage(page)
        const key = s.key
        const mid = centre(s.stage)
        await page.mouse.click(mid.x, mid.y, { count: 2 })
        await sleep(400)
        s = await stage(page)
        check("double-click zooms in (2×)", s.zoom === 2, JSON.stringify({ zoom: s.zoom }))
        // drag pans, bounded to what the zoomed image overflows
        await page.mouse.move(mid.x, mid.y); await page.mouse.down(); await page.mouse.move(mid.x + 120, mid.y + 60, { steps: 6 }); await page.mouse.up(); await sleep(300)
        const panned = await stage(page)
        await page.mouse.move(mid.x, mid.y); await page.mouse.down(); await page.mouse.move(mid.x + 3000, mid.y + 3000, { steps: 10 }); await page.mouse.up(); await sleep(300)
        const far = await stage(page)
        const [fx, fy] = far.pan.split(",").map(Number)
        const maxX = (far.stage.w * 2 - far.stage.w) / 2, maxY = (far.stage.h * 2 - far.stage.h) / 2
        check("drag pans the zoomed image, and only as far as it overflows the stage (it can't be lost)", panned.pan !== "0,0" && Math.abs(fx - maxX) <= 1 && Math.abs(fy - maxY) <= 1, JSON.stringify({ panned: panned.pan, far: far.pan, max: [maxX, maxY] }))
        // rotate keeps the zoom; Fit resets everything
        await page.evaluate(() => [...document.querySelectorAll('[data-noc-review] button')].find((b) => b.getAttribute("aria-label") === "Rotate 90°")?.click())
        await sleep(400)
        s = await stage(page)
        check("Rotate turns the image and keeps the zoom", s.rotation === 90 && s.zoom === 2, JSON.stringify({ rotation: s.rotation, zoom: s.zoom }))
        await page.click("[data-preview-fit]")
        await sleep(400)
        s = await stage(page)
        check("Fit to view: zoom 1, upright, centred", s.zoom === 1 && s.rotation === 0 && s.pan === "0,0", JSON.stringify({ zoom: s.zoom, rotation: s.rotation, pan: s.pan }))
        await page.mouse.click(mid.x, mid.y, { count: 2 }); await sleep(350)
        await page.mouse.click(mid.x, mid.y, { count: 2 }); await sleep(350)
        s = await stage(page)
        check("a second double-click returns to the zoom it came from (1×, centred)", s.zoom === 1 && s.pan === "0,0", JSON.stringify({ zoom: s.zoom, pan: s.pan }))
        // a double-click on a toolbar button is two button clicks, never a zoom
        const rotate = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-noc-review] button')].find((x) => x.getAttribute("aria-label") === "Rotate 90°"); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
        await page.mouse.click(rotate.x, rotate.y, { count: 2 }); await sleep(400)
        s = await stage(page)
        check("double-clicking a toolbar button doesn't zoom", s.zoom === 1, JSON.stringify({ zoom: s.zoom, rotation: s.rotation }))
        await page.click("[data-preview-fit]"); await sleep(300)

        // ── image gestures (touch, through the DevTools protocol) ─────────────────────────────────────────────────────
        const cdp = await page.target().createCDPSession()
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
        const touch = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) })
        const tap = async (x, y) => { await touch("touchStart", [[x, y]]); await sleep(40); await touch("touchEnd", []) }
        await tap(mid.x, mid.y); await sleep(120); await tap(mid.x, mid.y); await sleep(450)
        s = await stage(page)
        check("double-tap zooms in (2×)", s.zoom === 2, JSON.stringify({ zoom: s.zoom }))
        await page.click("[data-preview-fit]"); await sleep(400)
        await touch("touchStart", [[mid.x - 40, mid.y], [mid.x + 40, mid.y]])
        for (let i = 1; i <= 6; i++) { await touch("touchMove", [[mid.x - 40 - i * 15, mid.y], [mid.x + 40 + i * 15, mid.y]]); await sleep(30) }
        await touch("touchEnd", [])
        await sleep(400)
        s = await stage(page)
        check("pinch (two fingers apart) zooms in", s.zoom > 1.5, JSON.stringify({ zoom: s.zoom }))
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false })
        await page.click("[data-preview-fit]"); await sleep(300)

        s = await stage(page)
        check("no image gesture moved to another document or closed the viewer", s.open && s.key === key, JSON.stringify({ key: s.key, was: key }))
        await L.closeNocReview(page)
        await L.closeSheet(page)
        check("…and no NOC decision was sent", (await decisions(page)) === 0)
        blocked.push(...page.blockedApi)
        await page.close()
    }

    // ── video controls ────────────────────────────────────────────────────────────────────────────────────────────────
    {
        // the mock's sample video (a public demo URL, no longer served) → a local 20 s clip (fixtures/clip.webm)
        const clip = { match: /\.mp4(\?|$)/, contentType: "video/webm", body: fs.readFileSync(path.join(__dirname, "fixtures", "clip.webm")) }
        const page = await L.open(browser, L.V21, errors, { fulfil: [clip] })
        await L.rowsLoaded(page)
        await L.selectTab(page, "All")
        await L.dispatchRowsLoaded(page)
        await L.openRow(page, 0)
        await L.detailLoaded(page)
        await sleep(800)
        await page.evaluate(() => document.querySelector('[data-dispatch-video="play"]')?.click())
        await waitFor(page, () => !!document.querySelector("[data-video-player] video"), 8000)
        const loaded = await waitFor(page, () => { const v = document.querySelector("[data-video-player] video"); return !!v && v.readyState >= 2 && Number.isFinite(v.duration) }, 20000)
        check("video: the clip loads in the viewer", loaded)
        const vs = () => page.evaluate(() => { const p = document.querySelector("[data-video-player]"); const v = p?.querySelector("video"); return { controls: p?.getAttribute("data-controls"), playing: !!v && !v.paused, t: v ? Math.round(v.currentTime * 10) / 10 : null, d: v?.duration } })
        const box = await page.$eval("[data-video-player] video", (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
        await page.mouse.move(box.x + box.w / 2, box.y + 40)
        await page.evaluate(() => { const v = document.querySelector("[data-video-player] video"); v.muted = true })
        // it autoplays (as the native player did); Play only if the browser held it paused
        if (await page.$eval("[data-video-player] video", (v) => v.paused)) await page.click("[data-video-toggle]")
        await waitFor(page, () => !document.querySelector("[data-video-player] video")?.paused, 5000)
        await page.mouse.move(box.x + box.w / 2, box.y + 40) // the pointer back over the video (off the controls)
        await page.mouse.move(box.x + box.w / 2 + 5, box.y + 45)
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
        await sleep(2700)
        let v = await vs()
        check("video: playing, untouched for 2 s → the controls fade out", v.playing && v.controls === "hidden", JSON.stringify(v))
        await page.mouse.move(box.x + box.w / 2 + 30, box.y + 60)
        await sleep(200)
        v = await vs()
        check("video: moving the pointer brings them back", v.controls === "visible", JSON.stringify(v))
        // pointer over the controls: they stay
        const bar = await page.$eval("[data-video-controls]", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
        await page.mouse.move(bar.x, bar.y)
        await sleep(2800)
        v = await vs()
        check("video: with the pointer over the controls they stay while playing (no flicker, no fade)", v.playing && v.controls === "visible", JSON.stringify(v))
        // focus inside the controls: they stay
        await page.mouse.move(box.x + box.w / 2, box.y + 40)
        await page.focus("[data-video-mute]")
        await sleep(2800)
        v = await vs()
        check("video: a focused control is never hidden", v.playing && v.controls === "visible", JSON.stringify(v))
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
        // paused: they stay
        await page.focus("[data-video-player]")
        await page.keyboard.press("k")
        await sleep(2800)
        v = await vs()
        check("video: paused (K) → the controls stay", !v.playing && v.controls === "visible", JSON.stringify(v))
        // keyboard seek
        const t0 = (await vs()).t
        await page.keyboard.press("ArrowRight")
        await sleep(300)
        const t1 = (await vs()).t
        check("video: → seeks forward 5 s", Number.isFinite(v.d) ? Math.abs(t1 - Math.min(v.d, t0 + 5)) <= 0.6 : true, JSON.stringify({ t0, t1, d: v.d }))
        // mouse: click = play / pause (after the double-click window), double-click ≠ play / pause
        const before = (await vs()).playing
        await page.mouse.click(box.x + box.w / 2, box.y + 60)
        await sleep(600)
        const afterClick = (await vs()).playing
        await page.mouse.click(box.x + box.w / 2, box.y + 60, { count: 2 })
        await sleep(600)
        const afterDouble = (await vs()).playing
        check("video: a click toggles play / pause; a double-click doesn't (it is fullscreen's)", afterClick !== before && afterDouble === afterClick, JSON.stringify({ before, afterClick, afterDouble }))
        if (!afterDouble) { await page.click("[data-video-toggle]"); await sleep(400) }
        // touch: tap = show the controls only; double-tap = seek
        const cdp = await page.target().createCDPSession()
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
        const touch = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) })
        const tap = async (x, y) => { await touch("touchStart", [[x, y]]); await sleep(40); await touch("touchEnd", []) }
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
        await page.mouse.move(5, 5)
        await sleep(2800)
        const hiddenBefore = await vs()
        await tap(box.x + box.w * 0.5, box.y + 60)
        await sleep(500)
        const afterTap = await vs()
        check("video: a tap shows the hidden controls and doesn't pause", hiddenBefore.controls === "hidden" && afterTap.controls === "visible" && afterTap.playing === hiddenBefore.playing, JSON.stringify({ hiddenBefore, afterTap }))
        await page.evaluate(() => { document.querySelector("[data-video-player] video").currentTime = 2 })
        await sleep(300)
        const tBefore = (await vs()).t
        await tap(box.x + box.w * 0.8, box.y + 60); await sleep(100); await tap(box.x + box.w * 0.8, box.y + 60)
        await sleep(600)
        const afterDoubleTap = await vs()
        check("video: a double-tap on the right half seeks forward (and doesn't pause)", afterDoubleTap.t > tBefore + 1 && afterDoubleTap.playing === afterTap.playing, JSON.stringify({ tBefore, after: afterDoubleTap }))
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false })
        // the controls are named
        const names = await page.$$eval("[data-video-controls] button, [data-video-controls] input", (els) => els.map((e) => e.getAttribute("aria-label")))
        check("video: every control has an accessible name", names.length >= 4 && names.every(Boolean), names.join(", "))
        await page.keyboard.press("Escape")
        check("Escape closes the viewer", await waitFor(page, () => !document.querySelector("[data-video-player]"), 5000))
        blocked.push(...page.blockedApi)
        await page.close()
    }

    const relevant = L.relevantErrors(errors)
    check("no page errors", relevant.length === 0, relevant.slice(0, 3).join(" || "))
    check("no request reached a Matic API host (mock mode)", blocked.length === 0, blocked.slice(0, 3).join(", "))
    await L.finish(browser)
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2) })
