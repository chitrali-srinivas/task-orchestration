// Exercises the compiled Samples mock API (no UI; compile it first — see README.md) over the CSV-derived DB + the derived demo records:
// provenance, the sample-centric list, FARMER detail (multi-AZ), rules, the V2-shaped report, boundary + approval.
import { mockSamplesApi as api, getMockDb } from "./out/data/mock/mock-samples-api.js"

let failures = 0
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) failures++ }
const mask = (p) => (p ? String(p).replace(/.(?=.{4})/g, "*") : p)

const db = getMockDb()
console.log("tables:", Object.fromEntries(Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])))
console.log("source:", db.source.file, "rows:", db.source.row_count, "| demo:", JSON.stringify(db.source.demo.counts), "| directory:", db.source.directory)
const csvSamples = db.samples.filter((s) => s.source === "csv"), demoSamples = db.samples.filter((s) => s.source === "demo")
check("CSV is the base: 2188 CSV samples + 30 demo samples derived from them", csvSamples.length === 2188 && demoSamples.length === 30, `${csvSamples.length} csv + ${demoSamples.length} demo`)
const responsesById = new Map(db.survey_responses.map((r) => [r.id, r]))
check("no new farmers: every demo row belongs to a real derived farmer (1383)", db.farmers.length === 1383 && demoSamples.every((s) => db.farmers.some((f) => f.id === responsesById.get(s.survey_response_id).farmer_id)))
check("demo rows keep their farmer's surveyor", demoSamples.every((s) => { const r = responsesById.get(s.survey_response_id); const real = db.survey_responses.find((x) => x.farmer_id === r.farmer_id && x.id !== r.id && db.samples.some((y) => y.survey_response_id === x.id && y.source === "csv")); return !real || real.surveyor_id === r.surveyor_id }))
check("mock name directory applied (node: names on) and flagged in provenance", db.source.directory === "mock-directory" && db.people.filter((p) => p.id !== "u-ver-0").every((p) => p.name) && db.farmers.every((f) => f.name && f.derived))
check("people ids stay the export's phone numbers (masked in the UI)", db.people.filter((p) => p.id !== "u-ver-0").every((p) => /^\+\d{10,13}$/.test(p.id) && p.phone === p.id))
check("AZs 1–3 with mock names", db.azs.filter((a) => a.id > 0).map((a) => `${a.code}:${a.name}`).join(",") === "AZ1:Wheat,AZ2:Rice,AZ3:Maize", db.azs.map((a) => a.code).join(","))
check("outlines: 7 demo geometries; one generated plot", db.plot_geometries.length === 7 && db.plots.filter((p) => p.origin === "generated").length === 1, `${db.plot_geometries.length}`)

// ── list: one row per sample ────────────────────────────────────────────────────────────────────────
const all = await api.listSamples({ bucket: "all", page: 1, page_size: 20 })
console.log("counts:", all.counts)
check("All total == number of samples in the DB (one row per sample) = 2218", all.pagination.total === db.samples.length && all.counts.all === 2218, `${all.pagination.total}`)
check("row identity is the sample id (unique)", new Set(all.rows.map((r) => r.sample_id)).size === all.rows.length)
check("counts.farmers = distinct farmers of the tab", all.counts.farmers === 1383, `${all.counts.farmers}`)
for (const b of ["pending", "need_correction", "approved"]) {
    const r = await api.listSamples({ bucket: b, page: 1, page_size: 5000 })
    check(`${b} tab total == counts.${b} and rows all in that bucket`, r.pagination.total === all.counts[b] && r.rows.every((row) => row.bucket === b), `${r.pagination.total}`)
}
check("tab counts sum to all", all.counts.pending + all.counts.need_correction + all.counts.approved === all.counts.all)
check("Verified = 38 CSV approvals + 14 demo approvals", all.counts.approved === 52, `${all.counts.approved}`)
const approvedRows = (await api.listSamples({ bucket: "approved", page: 1, page_size: 5000 })).rows
check("verified rows carry verifier (directory name, phone id) + verified_at; the 1 CSV approval without a verifier shows none", approvedRows.filter((r) => !r.verified_by).length === 1 && approvedRows.filter((r) => r.verified_by).every((r) => r.verified_at && r.verified_by.name && /^\+\d+$/.test(r.verified_by.id)))
check("demo approvals use 5 different verifiers; CSV + demo together use all 6", new Set(approvedRows.filter((r) => r.source === "demo").map((r) => r.verified_by.id)).size === 5 && new Set(approvedRows.filter((r) => r.verified_by).map((r) => r.verified_by.id)).size === 6)
const pendingRows = (await api.listSamples({ bucket: "pending", page: 1, page_size: 5000 })).rows
check("pending rows have no verifier", pendingRows.every((r) => r.verified_by === null && r.verified_at === null))
const dep = await api.listSamples({ bucket: "all", page: 1, page_size: 100, kinds: ["deployment"] })
check("16 deployment samples, all demo, all on a deployment plot (read-only)", dep.rows.length === 16 && dep.rows.every((r) => r.source === "demo" && r.plot?.origin === "deployment" && r.boundary_state === "deployment_plot" && !r.boundary_editable), `${dep.rows.length}`)
check("deployment statuses: 6 verified · 2 rejected · one pending without a picture → Need Correction", dep.rows.filter((r) => r.status === "approved").length === 6 && dep.rows.filter((r) => r.status === "rejected").length === 2 && dep.rows.filter((r) => r.status === "pending" && r.bucket === "need_correction").length === 1)
const az3 = await api.listSamples({ bucket: "all", page: 1, page_size: 100, az_ids: [3] })
check("AZ3 exists only through demo rows (F-0073)", az3.rows.length === 3 && az3.rows.every((r) => r.farmer.id === "F-0073"))
const need = await api.listSamples({ bucket: "pending", page: 1, page_size: 5000, boundary: ["required"] })
check("boundary=required → pending control samples without any plot", need.rows.length > 1000 && need.rows.every((r) => r.kind === "control" && r.plot === null && r.boundary_state === "boundary_required"), `${need.rows.length}`)
const byVerifier = await api.listSamples({ bucket: "all", page: 1, page_size: 100, verifier_ids: [approvedRows.find((r) => r.source === "demo").verified_by.id] })
check("verifiedBy filter works on a phone id", byVerifier.rows.length > 0 && byVerifier.rows.every((r) => r.verified_by))
const dated = await api.listSamples({ bucket: "all", page: 1, page_size: 5000, submitted_from: Date.UTC(2026, 8, 20), submitted_to: Date.UTC(2026, 9, 5) })
check("submitted date range → all 30 demo rows (+ the CSV's late-September rows)", dated.rows.filter((r) => r.source === "demo").length === 30, `${dated.rows.length}`)
const p1 = await api.listSamples({ bucket: "pending", page: 1, page_size: 20 })
const p2 = await api.listSamples({ bucket: "pending", page: 2, page_size: 20 })
check("pages don't overlap; demo farmers lead the Pending tab (newest)", !p1.rows.some((r) => p2.rows.some((x) => x.sample_id === r.sample_id)) && p1.rows.slice(0, 5).every((r) => r.source === "demo"), [...new Set(p1.rows.map((r) => r.farmer.id))].join(","))

// ── detail: F-0073, ONE FARMER, THREE AZs, both kinds ───────────────────────────────────────────────
const a = await api.getFarmerDetail("F-0073")
check("F-0073: AZ1 · AZ2 · AZ3, 36 samples (25 CSV + 11 demo), 3 plots", a.azs.map((z) => z.id).join(",") === "1,2,3" && a.samples.length === 36 && a.plots.length === 3, `${a.samples.length} samples, ${a.plots.length} plots`)
check("F-0073 sample_counts: 3 verified · 31 pending · 2 need correction (no GPS; rejected)", a.sample_counts.approved === 3 && a.sample_counts.pending === 31 && a.sample_counts.need_correction === 2, JSON.stringify(a.sample_counts))
check("F-0073 purpose_counts: 7 rows summing to 36, both kinds", a.purpose_counts.length === 7 && a.purpose_counts.reduce((n, c) => n + c.count, 0) === 36 && new Set(a.purpose_counts.map((c) => c.kind)).size === 2, JSON.stringify(a.purpose_counts.map((c) => `${c.kind}:${c.purpose}=${c.count}`)))
check("F-0073 farmer has a directory name; AZ names present", !!a.farmer.name && a.azs.every((z) => z.name), `${a.farmer.name} / ${a.azs.map((z) => z.name).join(",")}`)
const eoy2 = a.samples.filter((s) => s.az.id === 2 && s.purpose === "eoy")
check("AZ2 control EOY (demo): no plot → boundary_required, editable, blocked with the exact message", eoy2.length === 2 && eoy2.every((s) => s.boundary_state === "boundary_required" && s.boundary_editable && s.approval.blockers.some((b) => b.message === "Draw and save the plot boundary before approving this sample.")))
const pre2 = a.samples.filter((s) => s.az.id === 2 && s.kind === "control" && s.purpose === "pre")
check("AZ2 control pre (demo): verified, on a control plot WITH an outline", pre2.length === 3 && pre2.every((s) => s.status === "approved" && s.plot?.outline_available && s.plot.area_acres > 0 && s.verified_by?.name))
check("one AZ2 pre sample carries a verifier note and a sample comment", pre2.some((s) => s.verifier_comment === "Approved by admin") && pre2.some((s) => s.comment))
const az3s = a.samples.filter((s) => s.az.id === 3)
check("AZ3 control EO3Y (demo): pending · pending without GPS (not_located → Need Correction) · rejected 'location invalid' (field location)", az3s.length === 3 && az3s.some((s) => s.location === null && s.boundary_state === "not_located" && s.bucket === "need_correction") && az3s.some((s) => s.status === "rejected" && s.open_report?.fields.join() === "location"))
const csvPlotRows = a.samples.filter((s) => s.source === "csv" && s.plot)
check("F-0073 CSV plot rows: outline not in dataset, approval not blocked by that", csvPlotRows.length > 0 && csvPlotRows.every((s) => !s.plot.outline_available && s.boundary_state === "control_plot"))

const b = await api.getFarmerDetail("F-0086")
check("F-0086: 24 CSV + 4 demo, AZ1 · AZ2; real AZ1 plot now outlined; AZ2 start verified", b.samples.length === 28 && b.azs.length === 2 && b.plots.filter((p) => p.outline_available).length === 2 && b.samples.filter((s) => s.az.id === 2).every((s) => s.status === "approved"))
const hb = await api.getFarmerHistory("F-0086")
check("F-0086 history: a completed report (reported → corrected) on the demo pre sample, plus the CSV 'marking' reports", hb.some((e) => e.type === "corrected") && hb.some((e) => e.report_state === "completed") && hb.filter((e) => e.type === "reported").length >= 13)
const c = await api.getFarmerDetail("F-0033")
check("F-0033: AZ2 CSV control + AZ1 demo deployment (3 verified, one without a note; 2 pending harvest)", c.azs.map((z) => z.id).join(",") === "1,2" && c.samples.filter((s) => s.kind === "deployment" && s.status === "approved").length === 3 && c.samples.some((s) => s.status === "approved" && s.verifier_comment === null))
const d = await api.getFarmerDetail("F-1366")
check("F-1366: 9 CSV control pre without plot + 8 demo deployment; pending without picture → Need Correction; rejected 'wrong picture' and one with no reason", d.samples.length === 17 && d.samples.some((s) => s.picture_url === null && s.status === "pending" && s.bucket === "need_correction") && d.samples.some((s) => s.open_report?.fields.join() === "picture") && d.samples.some((s) => s.status === "rejected" && s.open_report?.fields.length === 0))
const e = await api.getFarmerDetail("F-0214")
check("F-0214: the three CSV rows reference generated plot GP-00001 (saved boundary) → control_plot, editable, approvable", e.samples.length === 3 && e.samples.every((s) => s.plot?.plot_id === "GP-00001" && s.plot.origin === "generated" && s.plot.outline_available && s.boundary_editable && s.approval.allowed))
const he = await api.getFarmerHistory("F-0214")
check("F-0214 history has the boundary_saved events", he.filter((ev) => ev.type === "boundary_saved").length === 3)
const f = await api.getFarmerDetail("F-0082")
check("F-0082: fourth multi-AZ farmer (AZ1 CSV + AZ2 demo verified harvest)", f.azs.length === 2 && f.samples.filter((s) => s.az.id === 2).every((s) => s.status === "approved"))
const csvFarmer = await api.getFarmerDetail("F-0072")
check("CSV 'location invalid' → report field location (unchanged)", csvFarmer.samples.some((s) => s.open_report?.fields.join() === "location"))

// ── report (V2 flow: fields + comment) ──────────────────────────────────────────────────────────────
const target = a.samples.find((s) => s.kind === "deployment" && s.status === "pending")
try { await api.reportSample({ sample_id: target.sample_id, version: target.version, fields: [], comment: "x", idempotency_key: "r-0" }); check("report without fields refused", false) }
catch (err) { check("report without fields refused", /field/i.test(err.message)) }
try { await api.reportSample({ sample_id: target.sample_id, version: target.version, fields: ["location"], comment: "  ", idempotency_key: "r-1" }); check("report without comment refused", false) }
catch (err) { check("report without comment refused", /comment/i.test(err.message)) }
const reported = await api.reportSample({ sample_id: target.sample_id, version: target.version, fields: ["location", "picture"], comment: "Point is off the plot; photo blurred.", idempotency_key: "r-2" })
check("report → rejected + need_correction + open report with the fields", reported.status === "rejected" && reported.bucket === "need_correction" && reported.open_report.fields.join() === "location,picture")
const replay = await api.reportSample({ sample_id: target.sample_id, version: target.version, fields: ["location", "picture"], comment: "Point is off the plot; photo blurred.", idempotency_key: "r-2" })
check("idempotent report replay", replay.version === reported.version)
const histAfter = await api.getFarmerHistory("F-0073")
const repEvent = histAfter.find((ev) => ev.sample_id === target.sample_id && ev.type === "reported")
check("report reason stays the comment only; fields are structured (open_report.fields, event.report_fields)", reported.open_report.comment === "Point is off the plot; photo blurred." && repEvent?.summary === "Reported — Point is off the plot; photo blurred." && repEvent.report_fields.join() === "location,picture", repEvent?.summary)
check("has_report_history: true after the report; false on a never-reported sample", reported.has_report_history === true && a.samples.find((s) => s.purpose === "eoy" && s.az.id === 2).has_report_history === false)
check("has_report_history on CSV rejections and on a completed (corrected) report", b.samples.filter((s) => s.status === "rejected").every((s) => s.has_report_history) && b.samples.some((s) => s.status === "pending" && s.has_report_history && !s.open_report))

// ── boundary + approval on the AZ2 EOY samples ──────────────────────────────────────────────────────
const t = eoy2[0]
const refused = await api.approveSamples({ sample_ids: [t.sample_id], versions: { [t.sample_id]: t.version }, idempotency_key: "t-1" })
check("server refuses approve without boundary", refused.results[0].ok === false, refused.results[0].error)
const square = (c0, dd) => [[c0.lng - dd, c0.lat - dd], [c0.lng + dd, c0.lat - dd], [c0.lng + dd, c0.lat + dd], [c0.lng - dd, c0.lat + dd], [c0.lng - dd, c0.lat - dd]]
try { await api.saveBoundary({ sample_id: t.sample_id, version: t.version, geometry: { type: "Polygon", coordinates: [square({ lat: t.location.lat + 0.01, lng: t.location.lng + 0.01 }, 0.0004)] }, idempotency_key: "t-2" }); check("boundary not containing the sample is rejected", false) }
catch (err) { check("boundary not containing the sample is rejected", /must contain/.test(err.message)) }
const pts = eoy2.map((s) => s.location)
const minLat = Math.min(...pts.map((p) => p.lat)) - 0.0002, maxLat = Math.max(...pts.map((p) => p.lat)) + 0.0002
const minLng = Math.min(...pts.map((p) => p.lng)) - 0.0002, maxLng = Math.max(...pts.map((p) => p.lng)) + 0.0002
const ring = [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]
const saved = await api.saveBoundary({ sample_id: t.sample_id, version: t.version, geometry: { type: "Polygon", coordinates: [ring] }, idempotency_key: "t-5" })
check("valid boundary saved: a new generated id (not the demo's GP-00001), assigned to both EOY samples", /^GP-\d{5}$/.test(saved.plot.plot_id) && saved.plot.plot_id !== "GP-00001" && saved.assigned_sample_ids.length === 2, `${saved.plot.plot_id} ${saved.plot.area_acres} ac, assigned ${saved.assigned_sample_ids.length}`)
const a2 = await api.getFarmerDetail("F-0073")
const t2 = a2.samples.find((s) => s.sample_id === t.sample_id)
check("after save: control_plot + approval allowed; 4 plots", t2.boundary_state === "control_plot" && t2.approval.allowed && a2.plots.length === 4, JSON.stringify(t2.approval))
const ok = await api.approveSamples({ sample_ids: [t2.sample_id], versions: { [t2.sample_id]: t2.version }, idempotency_key: "t-7" })
check("approve after boundary succeeds; verified_by = session user", ok.results[0].ok && (await api.getFarmerDetail("F-0073")).samples.find((s) => s.sample_id === t.sample_id).verified_by?.id === "u-ver-0")
const after = (await api.listSamples({ bucket: "all", page: 1, page_size: 1 })).counts
check("tab counts move by exactly one sample per mutation", after.approved === all.counts.approved + 1 && after.need_correction === all.counts.need_correction + 1 && after.pending === all.counts.pending - 2, JSON.stringify(after))
console.log("demo farmer names (directory):", ["F-0073", "F-0086", "F-0033", "F-1366", "F-0082", "F-0214"].map((id) => `${id}=${db.farmers.find((x) => x.id === id)?.name}`).join(", "), "| a verifier id (masked):", mask(approvedRows.find((r) => r.verified_by)?.verified_by.id))
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS")
process.exit(failures ? 1 : 0)
