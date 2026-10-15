/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node (CommonJS) test script, run with `node` */
// Shared helpers for the Samples browser suites (puppeteer-core over the installed Chrome, headless).
// Settings (environment): BASE = the running app (default the `npm run dev` port), CHROME_PATH = the Chrome binary,
// PROFILE = a scratch Chrome profile name (created in the OS temp folder; give parallel runs different names).
// Screenshots go to tests/samples/shots/ (git-ignored).
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

const state = { failures: 0 }
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) state.failures++ }
const note = (name, extra) => console.log(`INFO  ${name}${extra ? "  — " + extra : ""}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(page, fn, timeout = 15000, ...args) {
    try { await page.waitForFunction(fn, { timeout, polling: 150 }, ...args); return true } catch { return false }
}
async function click(page, selector, tries = 8) {
    for (let i = 0; i < tries; i++) {
        try { await page.waitForSelector(selector, { visible: true, timeout: 4000 }); await page.click(selector); return }
        catch (e) { if (i === tries - 1) throw new Error(`click ${selector}: ${e.message}`); await sleep(250) }
    }
}
/** Rows and most buttons are plain onClick targets: a DOM click is immune to a handle going stale between query and click. */
async function domClick(page, selector, timeout = 10000) {
    await page.waitForSelector(selector, { timeout })
    await page.$eval(selector, (el) => el.click())
}
const text = (page, selector) => page.$eval(selector, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null)
const texts = (page, selector) => page.$$eval(selector, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()))
const attr = (page, selector, name) => page.$eval(selector, (e, n) => e.getAttribute(n), name).catch(() => null)
const exists = async (page, selector) => !!(await page.$(selector))
const tableSettled = (page, timeout = 10000) => waitFor(page, () => !document.querySelector('[data-table-state="loading"]') && !document.querySelector('[data-load-more="true"]'), timeout)

async function launch() {
    return puppeteer.launch({
        executablePath: CHROME, headless: "new", userDataDir: path.join(os.tmpdir(), `samples-e2e-${process.env.PROFILE || "default"}`),
        args: ["--window-size=1440,900", "--no-first-run", "--no-default-browser-check", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
        defaultViewport: { width: 1440, height: 900 },
    })
}
function collectErrors(page, sink) {
    page.on("console", (m) => { if (m.type() === "error") sink.push(m.text().slice(0, 300)) })
    page.on("pageerror", (e) => sink.push("pageerror: " + String(e).slice(0, 300)))
}
const relevantErrors = (errors) => errors.filter((e) => !/Download the React DevTools|favicon|ERR_FILE_NOT_FOUND|net::ERR|Failed to load resource|data\/user\/0|hydrat/i.test(e))

async function gotoSamples(page, query = "") {
    await page.goto(`${BASE}/layouts/samples${query}`, { waitUntil: "domcontentloaded", timeout: 120000 })
    return waitFor(page, () => document.querySelectorAll("[data-row-id]").length > 0 || !!document.querySelector('[data-table-state="error"]') || !!document.querySelector('[data-table-state="empty"]'), 90000)
}
async function selectTab(page, tab) {
    await click(page, `[data-tab="${tab}"]`)
    await waitFor(page, (t) => document.querySelector(`[data-tab="${t}"]`)?.getAttribute("data-state") === "active", 5000, tab)
    await tableSettled(page)
}
/** The filter sheet: pick one option of a multi-select field and apply (what a verifier does to narrow the table). */
async function applyFilter(page, field, option) {
    await click(page, "[data-open-filters]")
    await waitFor(page, (f) => !!document.querySelector(`[data-filter-field="${f}"]`), 6000, field)
    await click(page, `[data-filter-field="${field}"] [role="button"]`)
    const found = await waitFor(page, (o) => !!document.querySelector(`[data-filter-option="${o}"]`), 6000, option)
    if (!found) throw new Error(`filter option ${option} not found`)
    await page.$eval(`[data-filter-option="${option}"]`, (el) => el.click())
    await page.keyboard.press("Escape")
    await sleep(250)
    await click(page, "[data-apply-filters]")
    await waitFor(page, () => !document.querySelector("[data-filter-sheet]") || !document.querySelector("[data-apply-filters]"), 5000)
    await sleep(500)
    await tableSettled(page)
}
async function clearFilters(page) {
    if (await page.$('[title="Clear all filters"]')) {
        await click(page, '[title="Clear all filters"]')
        await sleep(500)
        await tableSettled(page)
    }
}
/** The detail's status dropdown (V2's DetailStatusFilter). */
async function openDetailFilter(page) {
    await page.evaluate(() => document.querySelector("[data-detail-filter]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })))
    await waitFor(page, () => !!document.querySelector("[data-filter-option]"), 3000)
}
async function chooseDetailFilter(page, value) {
    await openDetailFilter(page)
    await page.evaluate((v) => document.querySelector(`[data-filter-option="${v}"]`)?.click(), value)
    await waitFor(page, (v) => document.querySelector("[data-detail-filter]")?.getAttribute("data-detail-filter") === v, 5000, value)
    await sleep(300)
}
async function closeSheet(page) {
    await page.keyboard.press("Escape")
    await sleep(300)
    if (await page.$("[data-sample-detail]")) await page.evaluate(() => document.querySelector('[data-sample-detail] [aria-label="Close"]')?.click())
    await page.waitForFunction(() => !document.querySelector("[data-sample-detail]"), { timeout: 5000 }).catch(() => {})
    await sleep(400)
}
/** Radix hover cards open on pointer enter after a short delay. */
async function hoverShows(page, selector, contentSelector = "[data-radix-popper-content-wrapper]") {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 })
    await page.hover(selector)
    const ok = await waitFor(page, (s) => { const el = document.querySelector(s); return !!el && el.getBoundingClientRect().height > 0 }, 3000, contentSelector)
    const content = ok ? await text(page, contentSelector) : null
    await page.mouse.move(5, 5)
    await sleep(350)
    return content
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(OUT, name) }) }
const finish = async (browser) => { console.log(state.failures ? `\n${state.failures} FAILED` : "\nALL PASS"); await browser.close(); process.exit(state.failures ? 1 : 0) }

module.exports = { BASE, OUT, state, check, note, sleep, waitFor, click, domClick, text, texts, attr, exists, tableSettled, launch, collectErrors, relevantErrors, gotoSamples, selectTab, applyFilter, clearFilters, openDetailFilter, chooseDetailFilter, closeSheet, hoverShows, screenshot, finish }
