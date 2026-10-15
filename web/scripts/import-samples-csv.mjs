#!/usr/bin/env node
// Samples mock database — imports the backend's sample export (sample_data.csv) into the mock DB the Samples layout
// reads: src/app/layouts/samples/data/mock/csv/samples-db.json.
//
//   node scripts/import-samples-csv.mjs "C:/path/to/sample_data.csv"
//
// What it does (and does not do):
//   - keeps every CSV column the UI or the Inspector uses, with the CSV's own names and values (no invented data);
//   - drops the one row with no `type` (it has only id, code, picture and a point — not a sample record);
//   - adds ONE derived column, `farmer_key`: the CSV has no farmer id, so samples are grouped into farmers by the
//     links the CSV does have — a survey response is one farmer's visit, a plot belongs to one farmer (union-find
//     over survey_response_id and plot_id). Farmer names, villages and AZ names are NOT in the CSV and stay null;
//   - PRIVACY — nothing personal or secret reaches the repository:
//       · the export identifies surveyors / verifiers by PHONE NUMBER. Each one becomes a synthetic placeholder with the
//         same country prefix and length that can't be a real number (+91 0000000001 …, +260 000000001 …), stable per
//         person, so roles, filters and the masked display (****0001) behave exactly as with the export;
//       · photos are Firebase download URLs carrying ACCESS TOKENS. Each distinct photo becomes one of the demo images
//         bundled in /public (rows that shared a photo still share one URL, so duplicate-photo checks still apply);
//         device paths (no token, nothing personal) and missing photos are kept as they are.
//     The original CSV is only read, never written.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const csvPath = process.argv[2]
if (!csvPath) {
    console.error("usage: node scripts/import-samples-csv.mjs <sample_data.csv>")
    process.exit(1)
}
const here = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(here, "..", "src", "app", "layouts", "samples", "data", "mock", "csv", "samples-db.json")

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas / quotes / newlines). */
function parseCsv(text) {
    const rows = []
    let row = [], field = "", quoted = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
            } else field += c
        } else if (c === '"') quoted = true
        else if (c === ",") { row.push(field); field = "" }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++
            row.push(field); field = ""
            if (row.some((v) => v !== "")) rows.push(row)
            row = []
        } else field += c
    }
    if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row) }
    return rows
}

const [header, ...lines] = parseCsv(fs.readFileSync(csvPath, "utf8"))
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
const isNull = (v) => v === undefined || v === null || v.trim() === "" || v.trim().toUpperCase() === "NULL"
const str = (r, k) => (isNull(r[idx[k]]) ? null : r[idx[k]].trim())
const num = (r, k) => (isNull(r[idx[k]]) ? null : Number(r[idx[k]]))

const records = lines.filter((r) => !isNull(r[idx.type]))
const dropped = lines.length - records.length

// ── privacy: synthetic people ids, bundled demo photos (deterministic: first appearance by created_at) ──
const byTime = [...records].sort((a, b) => (num(a, "created_at") ?? 0) - (num(b, "created_at") ?? 0) || (str(a, "id") < str(b, "id") ? -1 : 1))
const personId = new Map()
for (const r of byTime) for (const k of ["surveyor_id", "verifier_id", "hq_verifier_id"]) {
    const v = str(r, k)
    if (!v || personId.has(v)) continue
    const n = personId.size + 1
    personId.set(v, v.startsWith("+260") ? `+260${String(n).padStart(9, "0")}` : v.startsWith("+91") ? `+91${String(n).padStart(10, "0")}` : `+00${String(n).padStart(10, "0")}`)
}
const DEMO_IMAGES = ["/ricebag.png", "/basaltrocky_d.webp", "/Farm%20Satellite%20View.png"]
const isUpload = (v) => /^https?:\/\//i.test(v)
const photoUrl = new Map()
for (const r of byTime) {
    const v = str(r, "picture")
    if (!v || !isUpload(v) || photoUrl.has(v)) continue
    const n = photoUrl.size
    photoUrl.set(v, `${DEMO_IMAGES[n % DEMO_IMAGES.length]}?photo=${n + 1}`)
}
const person = (r, k) => { const v = str(r, k); return v ? personId.get(v) : null }
const picture = (r) => { const v = str(r, "picture"); return v && isUpload(v) ? photoUrl.get(v) : v }

// ── derived farmer key: union-find over survey_response_id and plot_id ────────────────────────────
const parent = new Map()
const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
for (const r of records) {
    const resp = `r:${str(r, "survey_response_id")}`
    find(resp)
    const plot = str(r, "plot_id")
    if (plot) union(resp, `p:${plot}`)
}
// stable farmer numbering: by the cluster's earliest created_at
const clusterFirst = new Map()
for (const r of records) {
    const root = find(`r:${str(r, "survey_response_id")}`)
    const t = num(r, "created_at") ?? Number.MAX_SAFE_INTEGER
    clusterFirst.set(root, Math.min(clusterFirst.get(root) ?? Number.MAX_SAFE_INTEGER, t))
}
const roots = [...clusterFirst.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map(([root]) => root)
const farmerKey = new Map(roots.map((root, i) => [root, `F-${String(i + 1).padStart(4, "0")}`]))

const rows = records.map((r) => ({
    id: str(r, "id"),
    sample_code: str(r, "sample_code"),
    picture: picture(r),
    created_at: num(r, "created_at"),
    updated_at: num(r, "updated_at"),
    surveyor_id: person(r, "surveyor_id"),
    generated_plot_id: str(r, "generated_plot_id"),
    base_id: num(r, "base_id"),
    collection_timestamp: num(r, "collection_timestamp"),
    survey_response_id: str(r, "survey_response_id"),
    type: str(r, "type"),
    purpose: str(r, "purpose"),
    repeater_form_index: num(r, "repeater_form_index"),
    status: str(r, "status"),
    verifier_id: person(r, "verifier_id"),
    verifier_comment: str(r, "verifier_comment"),
    rejection_reason: str(r, "rejection_reason"),
    plot_id: str(r, "plot_id"),
    lat: num(r, "lat"),
    long: num(r, "long"),
    hq_verifier_id: person(r, "hq_verifier_id"),
    hq_rejected_reason: str(r, "hq_rejected_reason"),
    hq_comment: str(r, "hq_comment"),
    hq_status: str(r, "hq_status"),
    az_id: num(r, "az_id"),
    farmer_key: farmerKey.get(find(`r:${str(r, "survey_response_id")}`)),
}))

const out = {
    source: path.basename(csvPath),
    generated_at: new Date().toISOString(),
    columns: header,
    row_count: rows.length,
    dropped_rows: dropped,
    derived_columns: { farmer_key: "union-find over survey_response_id and plot_id; numbered by the cluster's earliest created_at" },
    sanitized: {
        people: `${personId.size} phone-number ids replaced by synthetic placeholders (+910000000001 …), stable per person`,
        pictures: `${photoUrl.size} Firebase download URLs (with access tokens) replaced by bundled demo images; rows that shared a photo still share one`,
    },
    not_in_source: ["farmer name", "farmer phone", "village", "AZ code / name (only az_id)", "surveyor / verifier names (only phone-number ids)", "plot geometry", "deployment-type samples (type is always control)"],
    rows,
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(out))
const farmers = new Set(rows.map((r) => r.farmer_key)).size
console.log(`wrote ${path.relative(process.cwd(), outPath)}: ${rows.length} rows (${dropped} dropped), ${farmers} derived farmers, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`)
