#!/usr/bin/env node
// Builds the Samples DEMO dataset from the imported CSV (samples-db.json, untouched) — a small set of records DERIVED
// from real rows so every important use case can be demonstrated without hand-editing data:
//   deployment samples, farmers with samples in 2–3 AZs, verified samples by several verifiers, rejected samples with
//   the CSV's real rejection vocabulary, control plots with and without a boundary, a boundary saved in this workflow,
//   pictures present / missing, GPS missing, comments and corrected-report history.
// Every demo record keeps its source row's farmer, surveyor, base and neighbourhood; only the fields a case needs
// change. Deterministic (seeded). Output: samples-demo.json next to the source — the mock DB merges both.
//
//   node scripts/build-samples-demo.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(here, "..", "src", "app", "layouts", "samples", "data", "mock", "csv")
const SRC = path.join(DIR, "samples-db.json")
const OUT = path.join(DIR, "samples-demo.json")
const SEED = 20261008

const src = JSON.parse(fs.readFileSync(SRC, "utf8"))
const rows = src.rows
const byFarmer = new Map()
for (const r of rows) { if (!byFarmer.has(r.farmer_key)) byFarmer.set(r.farmer_key, []); byFarmer.get(r.farmer_key).push(r) }

// ── deterministic helpers ───────────────────────────────────────────────────────────────────────────
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const rand = mulberry32(SEED)
const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("")
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`
const usedCodes = new Set(rows.map((r) => r.sample_code).filter(Boolean))
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function code() { for (;;) { const c = Array.from({ length: 6 }, () => ALNUM[Math.floor(rand() * ALNUM.length)]).join(""); if (!usedCodes.has(c)) { usedCodes.add(c); return c } } }
const DAY = 86_400_000, IST = 5.5 * 3_600_000, M_PER_DEG_LAT = 111_320
const day = (iso) => Date.parse(`${iso}T00:00:00.000Z`)
/** A realistic submission time: 09:00–16:30 IST on the given day. */
const at = (iso) => day(iso) - IST + (9 * 60 + Math.floor(rand() * 450)) * 60_000
const istMidnight = (ms) => { const d = new Date(ms + IST); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST }
const offset = (p, east, north) => ({ lat: p.lat + north / M_PER_DEG_LAT, lng: p.lng + east / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180)) })
const round6 = (n) => Math.round(n * 1e6) / 1e6
const centroid = (pts) => ({ lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length })
const located = (list) => list.filter((r) => r.lat != null && r.long != null).map((r) => ({ lat: r.lat, lng: r.long }))
/** A field-shaped rectangle (w × h metres, rotated) around a centre. Open ring, [lat, lng] pairs. */
function rectangle(center, w, h, angleDeg) {
    const a = (angleDeg * Math.PI) / 180
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => { const p = offset(center, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)); return [round6(p.lat), round6(p.lng)] })
}
/** The smallest rectangle around real sample points plus a margin (used to give an existing plot an outline). */
function boxAround(pts, marginM) {
    const lat = pts.map((p) => p.lat), lng = pts.map((p) => p.lng)
    const c = { lat: (Math.min(...lat) + Math.max(...lat)) / 2, lng: (Math.min(...lng) + Math.max(...lng)) / 2 }
    const h = (Math.max(...lat) - Math.min(...lat)) * M_PER_DEG_LAT + 2 * marginM
    const w = (Math.max(...lng) - Math.min(...lng)) * M_PER_DEG_LAT * Math.cos((c.lat * Math.PI) / 180) + 2 * marginM
    return rectangle(c, Math.max(w, 2 * marginM), Math.max(h, 2 * marginM), 0)
}
// pictures: the export's (sanitised) photo references of the same purpose, spread so clones don't all share one image
const picturePool = {}
const isDevicePath = (v) => /^(\/data\/|\/storage\/|\/sdcard|file:|content:)/.test(v)
for (const r of rows) if (r.picture && !isDevicePath(r.picture)) (picturePool[r.purpose] ||= []).push(r.picture)
const pictureCursor = {}
const picture = (purpose) => { const pool = picturePool[purpose]; const i = (pictureCursor[purpose] = ((pictureCursor[purpose] ?? -1) + 37) % pool.length); return pool[i] }

// the CSV's verifiers, most active first (synthetic placeholders for the export's phone-number ids)
const verifierCount = new Map()
for (const r of rows) if (r.verifier_id) verifierCount.set(r.verifier_id, (verifierCount.get(r.verifier_id) ?? 0) + 1)
const V = [...verifierCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
if (V.length !== 6) throw new Error(`expected 6 verifiers, got ${V.length}`)

// ── the demo cases ──────────────────────────────────────────────────────────────────────────────────
const demo = { rows: [], plots: [], geometries: [], overrides: [], responses: 0 }
const farmerInfo = (key) => {
    const list = byFarmer.get(key)
    if (!list) throw new Error(`unknown farmer ${key}`)
    const pts = located(list)
    return { list, center: centroid(pts), surveyor: list[0].surveyor_id, base: list[0].base_id ?? null, plotId: list.find((r) => r.plot_id)?.plot_id ?? null }
}
function newPlot(farmer, azId, origin, center, size, opts = {}) {
    const plot_id = origin === "generated" ? `GP-${String(demo.plots.filter((p) => p.origin === "generated").length + 1).padStart(5, "0")}` : uuid()
    demo.plots.push({ plot_id, farmer_key: farmer, az_id: azId, origin, deployment_id: origin === "deployment" ? `DEP-${farmer}-${azId}` : null, created_by: opts.createdBy ?? null, created_at: opts.createdAt ?? null })
    if (size) demo.geometries.push({ plot_id, ring: rectangle(center, size[0], size[1], size[2]), created_by: opts.createdBy ?? null, created_at: opts.createdAt ?? null, note: opts.note ?? `${origin} plot outline derived around the samples' GPS points` })
    return plot_id
}
/**
 * Clones a farmer's reality into `count` new samples of one purpose: same farmer, surveyor and base; a new survey
 * response in `az`; GPS within ±spread m of a centre offset from the farmer's own fields; pictures from real uploads.
 */
function group({ farmer, az, type, purpose, count, status, verifier = null, reason = null, plot = null, created, offsetM = [0, 0], spread = 20, edits = {}, verifiedDaysLater = 2 }) {
    const info = farmerInfo(farmer)
    const center = offset(info.center, offsetM[0], offsetM[1])
    const response = uuid()
    demo.responses++
    const createdAt = at(created)
    const out = []
    for (let i = 0; i < count; i++) {
        const st = Array.isArray(status) ? status[i] : status
        const why = Array.isArray(reason) ? reason[i] : reason
        const p = offset(center, (rand() - 0.5) * 2 * spread, (rand() - 0.5) * 2 * spread)
        const verifiedAt = st === "pending" ? null : createdAt + verifiedDaysLater * DAY + Math.floor(rand() * 6) * 3_600_000
        const row = {
            id: uuid(),
            sample_code: code(),
            picture: picture(purpose),
            created_at: createdAt + i * 90_000,
            updated_at: verifiedAt ?? createdAt + i * 90_000,
            surveyor_id: info.surveyor,
            generated_plot_id: null,
            base_id: info.base,
            collection_timestamp: istMidnight(createdAt),
            survey_response_id: response,
            type,
            purpose,
            repeater_form_index: i + 1,
            status: st,
            verifier_id: st === "pending" ? null : verifier,
            verifier_comment: st === "approved" ? "Approved by admin" : null,
            rejection_reason: st === "rejected" ? why : null,
            plot_id: typeof plot === "string" ? plot : null,
            lat: round6(p.lat),
            long: round6(p.lng),
            hq_verifier_id: null,
            hq_rejected_reason: null,
            hq_comment: null,
            hq_status: st === "approved" ? null : "pending",
            az_id: az,
            farmer_key: farmer,
            derived_from: info.list[i % info.list.length].id,
            comment: null,
            prior_report: null,
        }
        Object.assign(row, edits[i] ?? {})
        demo.rows.push(row)
        out.push(row)
    }
    return { rows: out, center }
}

// F-0073 — the stress case: 25 real control samples in AZ1 (5 purposes) + demo AZ2 (control with an outlined plot,
// control without a plot, deployment) + demo AZ3 (control, one without GPS, one rejected) = ONE FARMER, THREE AZs.
{
    const f = "F-0073", info = farmerInfo(f)
    const c2 = offset(info.center, 420, 180)
    const cp = newPlot(f, 2, "control_survey", c2, [70, 55, 12], { createdAt: at("2026-09-24") })
    const pre = group({ farmer: f, az: 2, type: "control", purpose: "pre", count: 3, status: "approved", verifier: V[1], plot: cp, created: "2026-09-24", offsetM: [420, 180] })
    pre.rows[0].comment = "Checked on site — bag label legible, plot matches the survey."
    group({ farmer: f, az: 2, type: "control", purpose: "eoy", count: 2, status: "pending", created: "2026-10-01", offsetM: [520, 300] })
    const dp = newPlot(f, 2, "deployment", offset(info.center, -380, 300), [95, 70, 8], { createdAt: at("2026-09-10") })
    group({ farmer: f, az: 2, type: "deployment", purpose: "pre", count: 3, status: "pending", plot: dp, created: "2026-10-02", offsetM: [-380, 300] })
    group({ farmer: f, az: 3, type: "control", purpose: "eo3y", count: 3, status: ["pending", "pending", "rejected"], verifier: V[2], reason: "location invalid", created: "2026-09-29", offsetM: [700, -450], edits: { 1: { lat: null, long: null } } })
}
// F-0086 — 24 real samples (6 purposes, 12 rejected "marking") + demo AZ2 verified control with an outlined plot; the
// farmer's real AZ1 plot gets an outline (a boundary already complete); one pending clone with a corrected report.
{
    const f = "F-0086", info = farmerInfo(f)
    const cp = newPlot(f, 2, "control_survey", offset(info.center, 350, -200), [80, 60, -6], { createdAt: at("2026-09-22") })
    group({ farmer: f, az: 2, type: "control", purpose: "start", count: 3, status: "approved", verifier: V[0], plot: cp, created: "2026-09-22", offsetM: [350, -200] })
    const realPlotRows = info.list.filter((r) => r.plot_id === info.plotId)
    demo.geometries.push({ plot_id: info.plotId, ring: boxAround(located(realPlotRows), 15), created_by: null, created_at: at("2026-09-22"), note: "outline added around the real plot's samples (the export has no geometry)" })
    const one = group({ farmer: f, az: 1, type: "control", purpose: "pre", count: 1, status: "pending", plot: info.plotId, created: "2026-09-26", offsetM: [0, 0], spread: 15 })
    one.rows[0].prior_report = { fields: ["sample_id"], comment: "marking", reported_at: at("2026-09-27"), corrected_at: at("2026-09-30") }
    one.rows[0].comment = "Re-collected after the surveyor fixed the bag label."
}
// F-0033 — 3 real control pre samples in AZ2 + demo AZ1 deployment: verified pre (one without a verifier note) and
// pending harvest with a corrected location report → a second multi-AZ farmer, verified deployment samples.
{
    const f = "F-0033", info = farmerInfo(f)
    const dp = newPlot(f, 1, "deployment", offset(info.center, -300, -250), [90, 65, 20], { createdAt: at("2026-09-05") })
    group({ farmer: f, az: 1, type: "deployment", purpose: "pre", count: 3, status: "approved", verifier: V[3], plot: dp, created: "2026-09-21", offsetM: [-300, -250], edits: { 1: { verifier_comment: null } } })
    const h = group({ farmer: f, az: 1, type: "deployment", purpose: "harvest", count: 2, status: "pending", plot: dp, created: "2026-09-30", offsetM: [-300, -250] })
    h.rows[0].prior_report = { fields: ["location"], comment: "location invalid", reported_at: at("2026-10-01"), corrected_at: at("2026-10-03") }
}
// F-1366 — 9 real control pre samples without a plot (2026-09) + demo deployment on a plot: verified pre (one without
// a picture), pending start (one without a picture → Need Correction), rejected EOY ("wrong picture" and no reason).
{
    const f = "F-1366", info = farmerInfo(f)
    const dp = newPlot(f, 1, "deployment", offset(info.center, 250, 120), [85, 70, -15], { createdAt: at("2026-08-28") })
    group({ farmer: f, az: 1, type: "deployment", purpose: "pre", count: 3, status: "approved", verifier: V[4], plot: dp, created: "2026-09-23", offsetM: [250, 120], edits: { 2: { picture: null } } })
    group({ farmer: f, az: 1, type: "deployment", purpose: "start", count: 3, status: "pending", plot: dp, created: "2026-10-01", offsetM: [250, 120], edits: { 1: { picture: null } } })
    group({ farmer: f, az: 1, type: "deployment", purpose: "eoy", count: 2, status: "rejected", verifier: V[5], reason: ["wrong picture", null], plot: dp, created: "2026-09-28", offsetM: [250, 120] })
}
// F-0082 — 3 real samples (start / eo3y / eo5y, one rejected) + demo AZ2 verified harvest → a fourth multi-AZ farmer.
{
    const f = "F-0082"
    group({ farmer: f, az: 2, type: "control", purpose: "harvest", count: 2, status: "approved", verifier: V[2], created: "2026-09-25", offsetM: [280, 160], verifiedDaysLater: 4 })
}
// F-0214 — 3 real pending pre samples 5 m apart with no plot: a boundary SAVED in this workflow (generated plot,
// editable) — the three rows reference the generated plot.
{
    const f = "F-0214", info = farmerInfo(f)
    const gp = newPlot(f, 1, "generated", centroid(located(info.list)), null, { createdBy: "u-ver-0", createdAt: at("2026-09-30") })
    demo.geometries.push({ plot_id: gp, ring: boxAround(located(info.list), 22), created_by: "u-ver-0", created_at: at("2026-09-30"), note: "boundary drawn by the verifier around the three samples (saved in this workflow)" })
    for (const r of info.list) demo.overrides.push({ id: r.id, generated_plot_id: gp })
}

// ── a MOCK name directory: names are not in the export; production joins the farmer / user APIs ──────
const IN_FIRST = ["Ramesh", "Suresh", "Mahesh", "Rajendra", "Dinesh", "Kailash", "Santosh", "Prakash", "Mukesh", "Rakesh", "Ganesh", "Lokesh", "Naresh", "Umesh", "Yogesh", "Bhupendra", "Devendra", "Narendra", "Jitendra", "Ravindra", "Sunita", "Anita", "Savita", "Kavita", "Geeta", "Seema", "Rekha", "Meena", "Lata", "Asha", "Pushpa", "Sarita", "Manju", "Radha", "Kamla", "Shanti", "Durga", "Laxmi", "Phool", "Rajni", "Ashok", "Vinod", "Manoj", "Arun", "Deepak", "Sanjay", "Vijay", "Ajay", "Pankaj", "Kamlesh"]
const IN_LAST = ["Patel", "Yadav", "Verma", "Sahu", "Thakur", "Kushwaha", "Lodhi", "Rajput", "Dhakad", "Jatav", "Prajapati", "Chouhan", "Rathore", "Meena", "Gurjar", "Kol", "Gond", "Baiga", "Uikey", "Markam", "Dhurve", "Paraste", "Tekam", "Netam", "Sharma", "Tiwari", "Mishra", "Dubey", "Pandey", "Shukla", "Singh", "Kumar", "Ahirwar", "Vishwakarma", "Soni", "Jain"]
const ZM_FIRST = ["Mwansa", "Chanda", "Bwalya", "Mutale", "Mulenga", "Chileshe", "Lombe", "Kabwe", "Musonda", "Nachula", "Sifuba", "Monde"]
const ZM_LAST = ["Phiri", "Banda", "Mwila", "Tembo", "Zulu", "Mumba", "Chisanga", "Kapata", "Lungu", "Sakala", "Makoli", "Mbewe"]
const pick = (list) => list[Math.floor(rand() * list.length)]
const usedNames = new Set()
function personName(zambian) {
    for (let tries = 0; tries < 50; tries++) {
        const n = zambian ? `${pick(ZM_FIRST)} ${pick(ZM_LAST)}` : `${pick(IN_FIRST)} ${pick(IN_LAST)}`
        if (!usedNames.has(n)) { usedNames.add(n); return n }
    }
    return zambian ? `${pick(ZM_FIRST)} ${pick(ZM_LAST)}` : `${pick(IN_FIRST)} ${pick(IN_LAST)}`
}
const directory = { kind: "mock-directory", note: "Names are NOT in the export (it carries phone numbers as surveyor / verifier ids and no farmer column). Generated deterministically so the demo reads like Deployment V2; disable with ?mockNames=off. Production joins the farmer and user APIs.", people: {}, farmers: {}, azs: { 1: "Wheat", 2: "Rice", 3: "Maize" } }
const peopleIds = new Set()
for (const r of rows) { if (r.surveyor_id) peopleIds.add(r.surveyor_id); if (r.verifier_id) peopleIds.add(r.verifier_id); if (r.hq_verifier_id) peopleIds.add(r.hq_verifier_id) }
for (const id of [...peopleIds].sort()) directory.people[id] = personName(id.startsWith("+26"))
for (const [key, list] of [...byFarmer.entries()].sort()) directory.farmers[key] = personName(list.some((r) => r.lat != null && r.lat < 0))

// ── coverage matrix (computed from the data, the report prints it) ────────────────────────────────
const all = [...rows.map((r) => ({ ...r, source: "csv" })), ...demo.rows.map((r) => ({ ...r, source: "demo" }))]
const overridden = new Set(demo.overrides.map((o) => o.id))
const outlined = new Set(demo.geometries.map((g) => g.plot_id))
const byF2 = new Map()
for (const r of all) { if (!byF2.has(r.farmer_key)) byF2.set(r.farmer_key, []); byF2.get(r.farmer_key).push(r) }
const farmersWhere = (pred) => [...byF2.entries()].filter(([, v]) => pred(v)).map(([k]) => k)
const ex = (list, n = 3) => list.slice(0, n).map((r) => r.sample_code ?? r.id.slice(0, 8))
const coverage = [
    ["Control sample", all.filter((r) => r.type === "control").length, ex(all.filter((r) => r.type === "control" && r.source === "demo"))],
    ["Deployment sample", all.filter((r) => r.type === "deployment").length, ex(all.filter((r) => r.type === "deployment"))],
    ...["pre", "start", "harvest", "eoy", "eo3y", "eo5y"].map((p) => [p.toUpperCase(), all.filter((r) => r.purpose === p).length, ex(all.filter((r) => r.purpose === p && r.source === "demo"))]),
    ["Pending", all.filter((r) => r.status === "pending").length, ex(all.filter((r) => r.status === "pending" && r.source === "demo"))],
    ["Approved (Verified)", all.filter((r) => r.status === "approved").length, ex(all.filter((r) => r.status === "approved" && r.source === "demo"))],
    ["Need Correction / Rejected", all.filter((r) => r.status === "rejected").length, ex(all.filter((r) => r.status === "rejected" && r.source === "demo"))],
    ["Verified (verifier set)", all.filter((r) => r.verifier_id && r.status !== "pending").length, [...new Set(all.filter((r) => r.verifier_id && r.status !== "pending").map((r) => r.verifier_id))].length + " verifiers"],
    ["Unverified", all.filter((r) => r.status === "pending").length, "every pending row"],
    ["Farmer with multiple AZs", farmersWhere((v) => new Set(v.map((r) => r.az_id)).size > 1).length, farmersWhere((v) => new Set(v.map((r) => r.az_id)).size > 1)],
    ["Farmer with 3 AZs", farmersWhere((v) => new Set(v.map((r) => r.az_id)).size > 2).length, farmersWhere((v) => new Set(v.map((r) => r.az_id)).size > 2)],
    ["Farmer with multiple purposes", farmersWhere((v) => new Set(v.map((r) => r.purpose)).size > 1).length, ["F-0073", "F-0086", "F-0033"]],
    ["Farmer with mixed statuses", farmersWhere((v) => new Set(v.map((r) => r.status)).size > 1).length, ["F-0073", "F-0086", "F-1366"]],
    ["Farmer with both sample types", farmersWhere((v) => new Set(v.map((r) => r.type)).size > 1).length, farmersWhere((v) => new Set(v.map((r) => r.type)).size > 1)],
    ["Control sample without plot", all.filter((r) => r.type === "control" && !r.plot_id && !overridden.has(r.id)).length, ["F-0073 AZ2 EOY", "F-1366 pre ×9"]],
    ["Control sample with plot (no outline)", all.filter((r) => r.type === "control" && r.plot_id && !outlined.has(r.plot_id)).length, "most CSV plots"],
    ["Control sample with plot + outline", all.filter((r) => r.type === "control" && ((r.plot_id && outlined.has(r.plot_id)) || overridden.has(r.id))).length, ["F-0086 AZ1 + AZ2", "F-0073 AZ2 pre", "F-0214 (GP-00001)"]],
    ["Deployment sample with plot", all.filter((r) => r.type === "deployment" && r.plot_id).length, ["F-0073 AZ2", "F-0033 AZ1", "F-1366 AZ1"]],
    ["Sample with picture", all.filter((r) => r.picture && !isDevicePath(r.picture)).length, "CSV uploads"],
    ["Sample without picture", all.filter((r) => !r.picture).length, ex(demo.rows.filter((r) => !r.picture))],
    ["Valid GPS", all.filter((r) => r.lat != null).length, "—"],
    ["Missing GPS", all.filter((r) => r.lat == null).length, ex(demo.rows.filter((r) => r.lat == null))],
    ["Multiple surveyors", new Set(all.map((r) => r.surveyor_id)).size, "40 (CSV)"],
    ["Multiple verifiers", new Set(all.filter((r) => r.verifier_id).map((r) => r.verifier_id)).size, "6 (CSV), all used by demo rows"],
    ["Report / rejection data", all.filter((r) => r.status === "rejected").length, ["location invalid", "wrong picture", "marking", "(no reason)"]],
    ["Comments (verifier note / sample note)", all.filter((r) => r.verifier_comment).length + " / " + demo.rows.filter((r) => r.comment).length, ex(demo.rows.filter((r) => r.comment))],
    ["History (corrected report)", demo.rows.filter((r) => r.prior_report).length, ex(demo.rows.filter((r) => r.prior_report))],
    ["Missing optional data (demo rows)", demo.rows.filter((r) => !r.picture || r.lat == null || (r.status === "approved" && !r.verifier_comment) || (r.status === "rejected" && !r.rejection_reason)).length + ` of ${demo.rows.length}`, "picture, GPS, verifier note, report reason"],
]

const out = {
    generated_at: new Date().toISOString(),
    base: path.basename(SRC),
    seed: SEED,
    rules: [
        "Every demo sample is cloned from a real row of the same farmer: same surveyor, base and neighbourhood (GPS within 20 m of a centre a few hundred metres from the farmer's own fields); only the fields a case needs change.",
        "Verifiers are the CSV's six verifier ids, rotated; verified_at is 2–4 days after submission; approved rows carry the CSV's 'Approved by admin' note unless the case is 'approved without a note'.",
        "Rejection reasons use the CSV's real vocabulary ('location invalid', 'wrong picture', 'marking') or none.",
        "Deployment plots and control-plot outlines are field-sized rectangles around the samples' GPS points (the export has no geometry).",
        "F-0214's three real rows reference generated plot GP-00001 to show a boundary saved in this workflow (the only edit to CSV rows).",
        "Pictures reuse the export's (sanitised) picture references of the same purpose, spread; a few rows have none.",
        "Names come from a MOCK directory (not in the export); disable with ?mockNames=off.",
    ],
    counts: { demo_samples: demo.rows.length, demo_responses: demo.responses, demo_plots: demo.plots.length, geometries: demo.geometries.length, overrides: demo.overrides.length, farmers_touched: [...new Set(demo.rows.map((r) => r.farmer_key))] },
    directory,
    plots: demo.plots,
    geometries: demo.geometries,
    overrides: demo.overrides,
    rows: demo.rows,
    coverage,
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 0))
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${demo.rows.length} demo samples, ${demo.plots.length} plots, ${demo.geometries.length} outlines, ${demo.overrides.length} overrides, ${Object.keys(directory.people).length} people + ${Object.keys(directory.farmers).length} farmer names (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
console.log("| Use case | Count | Example |\n|---|---|---|")
for (const [name, count, example] of coverage) console.log(`| ${name} | ${count} | ${Array.isArray(example) ? example.join(", ") : example} |`)
console.log("demo farmers:", JSON.stringify(Object.fromEntries(out.counts.farmers_touched.map((f) => [f, directory.farmers[f]]))))
