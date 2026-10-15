// Deployment V2.1 — the port-bound rules without a browser: the request builders' EXACT payload field names and types
// (P6: report / NOC identifiers as strings, nothing converted with Number), the AWD / Mati Boost flows (M1), the approval
// boundary gate (requirement 5), the dispatch-grain table rows, Area / Cal. Area and the detail's groups (live API audit),
// and the status / per-dispatch validation rules (requirement 4).
// Compile first (see README.md):
//   npx tsc -p tests/deployment-v2-1/tsconfig.payloads.json
//   echo '{"type":"commonjs"}' > tests/deployment-v2-1/out/package.json
//   node tests/deployment-v2-1/check-payloads.mjs
// Nothing here calls a backend: the builders return plain objects that are inspected in memory.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const OUT = "./out/app/layouts/deployment-v2-1"
const rb = require(`${OUT}/data/request-builders.js`)
const gate = require(`${OUT}/data/boundary-gate.js`)
const rows = require(`${OUT}/data/dispatch-rows.js`)
const view = require(`${OUT}/components/deployment-dispatch-view.js`)
const types = require(`${OUT}/components/deployment-types.js`)
const totals = require(`${OUT}/data/farmer-header-totals.js`)
const coverage = require(`${OUT}/data/boundary-coverage.js`)

let failures = 0, passes = 0
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (ok) passes++; else failures++ }
const keysOf = (o) => Object.keys(o).sort().join(",")
const VERIFIER = "9000000001" // a test id, not a person's number

// ── Fixtures (shapes as data/schema.ts; ids are synthetic) ───────────────────────────────────────────
const row = (over = {}) => ({
    created_at: 1, epoch_date: 1, farmer_id: 1002, farmer_name: "", farmer_picture: null, phone_no: null, village_id: 1, village_name: "", deployment_num: 1,
    az_id: 1, az_code: "AZ1", az_name: "", plots: 2, actual_area: 1, calculated_area: 1, deployed_amount: 1, num_tons: 1, trailers_deployed: 2, status: "pending",
    franchise_status: "pending", action_required: false, err_msg: [], franchise_statuses: ["pending"], surveyor_registred_no: "", surveyor_name: "", surveyor_phone_no: null,
    franchise_verifier_id: null, verified_by: null, verified_at: null, total_count: 1, ...over,
})
const square = (lat, lng) => gate.SEEDED_VALID_OUTLINE({ lat, lng })
const bowTie = (lat, lng) => gate.SEEDED_INVALID_OUTLINE({ lat, lng })
const plot = (over = {}) => ({
    amt_plot_deploy: 2.5, area: 1.2, comment: null, deployment_id: 501, dispatch_id: 77, farmer_id: 1002, geometry: null, location: { lat: 21.1, lng: 78.1 },
    picture_deployment: "https://example.test/p.jpg", plot_id: "P-1", repeater_form_id: "rf", repeater_form_index: 1, is_location_reported: false, is_deployment_reported: false,
    verbal_plot_area_enrolled: null, boost_amount_plot_applied: null, source_name: "Quarry A", ...over,
})
const dispatch = (over = {}) => ({
    az_code: "AZ1", az_id: 1, date: 1700000000000, date_raw: "12-03-2025", deployment_detail_id: "DD-1", deployment_verifier_name: null, deployment_verifier_id: null, dispatch_id: 77,
    num_tons: 5, source_name: "Quarry A", surveyor_name: "", surveyor_registred_no: "", trailer_no: "T-1", video: null, village_name: "", cluster_name: "", repeater_form_index: 1,
    franchise_status: "pending", franchise_verifier_id: null, batch_id: null, field_condition: "dry", crop_stage: null, num_plots_unload: null,
    action_required: null, err_msg: null, verified_at: null, verified_by: null,
    deployment_plots_data: [plot(), plot({ deployment_id: 502, repeater_form_index: 2 })], ...over,
})

// ── P6: report identifiers are strings, exactly the fields matic-dash sends ───────────────────────────
{
    const d = dispatch()
    const { report, dispatchUpdate } = rb.buildReportRequests(row(), [{ kind: "source_name", dispatch: d }], "wrong source", VERIFIER)
    const e = report.reportData[0]
    check("report (source): exact field set", keysOf(e) === "az_id,deployment_filter_sec,deployment_num,entry_no,farmer_id,reason,repeater_form_id,source_name,surveyor_no,value", keysOf(e))
    check("report: farmer_id and deployment_num are STRINGS, never Number()", typeof e.farmer_id === "string" && e.farmer_id === "1002" && typeof e.deployment_num === "string" && e.deployment_num === "1")
    check("report: repeater_form_id (the dispatch id) is a string; az_id a number; entry_no null at dispatch level", typeof e.repeater_form_id === "string" && typeof e.az_id === "number" && e.entry_no === null)
    check("report: farmerReportedData is the same entry without `value` (reportData adds reason + value, as matic-dash)", !("value" in report.farmerReportedData[0]) && "value" in e && e.reason === "wrong source")
    const u = dispatchUpdate.deployment_trailer_dispatch_data[0]
    check("report → reject: exact field set", keysOf(u) === "az_id,deployment_detail_id,franchise_comment,franchise_rejected_reason,franchise_status,franchise_verifier_id,hq_comment,hq_rejected_reason,hq_status,hq_verifier_id", keysOf(u))
    check("report → reject: franchise_verifier_id is the verifier string, hq_verifier_id null, both statuses rejected", u.franchise_verifier_id === VERIFIER && u.hq_verifier_id === null && u.franchise_status === "rejected" && u.hq_status === "rejected")
    const plotReport = rb.buildReportRequests(row(), [{ kind: "mati_deployed", dispatch: d, plot: d.deployment_plots_data[1] }, { kind: "location", dispatch: d, plot: d.deployment_plots_data[0] }], "x", VERIFIER)
    check("report (plot fields): entry_no is the plot's repeater_form_index; location is a JSON string", plotReport.report.reportData[0].entry_no === 2 && plotReport.report.reportData[0].mati_deployed === 2.5 && typeof plotReport.report.reportData[1].location === "string" && JSON.parse(plotReport.report.reportData[1].location).lat === 21.1)
    check("report (two items of one dispatch): one reject entry per item (as matic-dash pushes them)", plotReport.dispatchUpdate.deployment_trailer_dispatch_data.length === 2)
    const empty = rb.buildReportRequests(row(), [], "x", VERIFIER)
    check("report with no selection builds no entries (the sheet refuses to send it)", empty.report.reportData.length === 0 && empty.dispatchUpdate.deployment_trailer_dispatch_data.length === 0)
}

// ── M1: AWD / Mati Boost report — the ten fields, values as sent, one reject per plot ─────────────────
{
    const d = dispatch({ az_id: 4, az_code: "AZ4" })
    const p = d.deployment_plots_data[0]
    const sel = (field) => ({ kind: "awd_field", field, dispatch: d, plot: p })
    const { report, dispatchUpdate } = rb.buildAwdReportRequests(row({ az_id: 4 }), [sel("date"), sel("picture"), sel("mati_deployed"), sel("crop_stage"), sel("date")], "why", VERIFIER, "amt_plot_deploy")
    check("AWD report: one entry per distinct field (a field selected twice is sent once)", report.reportData.length === 4, `${report.reportData.length}`)
    const TEN = ["mati_deployed", "location", "source_name", "date", "picture", "verbal_plot_area_enrolled", "boost_amount_plot_applied", "batch_id", "field_condition", "crop_stage"]
    const byField = Object.fromEntries(report.reportData.map((e) => [Object.keys(e).find((k) => TEN.includes(k)), e]))
    check("AWD report: every entry names exactly one of the ten fields", report.reportData.every((e) => Object.keys(e).filter((k) => TEN.includes(k)).length === 1))
    check("AWD report: each entry carries exactly one of the ten fields", keysOf(byField["date"]) === "az_id,date,deployment_filter_sec,deployment_num,entry_no,farmer_id,reason,repeater_form_id,surveyor_no,value", keysOf(byField["date"]))
    check("AWD report: `date` is the dispatch's date exactly as the API sent it (date_raw), not reformatted", byField["date"].date === "12-03-2025" && byField["date"].value === "12-03-2025")
    check("AWD report: a value the data lacks is sent as \"missing value\" (matic-dash)", byField["picture"].picture === "https://example.test/p.jpg" && byField["crop_stage"].crop_stage === "missing value")
    check("AWD report: Mati Deployed is the plot's amount field (AWD: amt_plot_deploy)", byField["mati_deployed"].mati_deployed === 2.5)
    check("AWD report: farmer_id (from the plot) and deployment_num are strings", byField["date"].farmer_id === "1002" && byField["date"].deployment_num === "1")
    check("AWD report: ONE reject of the plot's dispatch (not one per field)", dispatchUpdate.deployment_trailer_dispatch_data.length === 1 && dispatchUpdate.deployment_trailer_dispatch_data[0].deployment_detail_id === "DD-1")
    check("AWD report: farmerReportedData entries carry neither reason nor value (matic-dash onSubmitReportAWDFarmer)", report.farmerReportedData.every((f) => !("reason" in f) && !("value" in f)))
    const mb = rb.buildAwdReportRequests(row({ az_id: 5 }), [sel("mati_deployed")], "why", VERIFIER, "boost_amount_plot_applied")
    check("Mati Boost report: Mati Deployed reads boost_amount_plot_applied (0 when missing, as matic-dash's `|| 0`)", mb.report.reportData[0].mati_deployed === 0)
}

// ── M1: approve payloads — AZ 1–3 vs AWD / Mati Boost ─────────────────────────────────────────────────
{
    const d = dispatch()
    const a = rb.buildApproveDispatchRequest(d, VERIFIER).deployment_trailer_dispatch_data[0]
    check("approve (AZ 1–3): exact field set, hq_verifier_id null, no AWD extras", keysOf(a) === "az_id,deployment_detail_id,franchise_comment,franchise_rejected_reason,franchise_status,franchise_verifier_id,hq_comment,hq_rejected_reason,hq_status,hq_verifier_id" && a.hq_verifier_id === null, keysOf(a))
    const w = rb.buildAwdApproveDispatchRequest(row({ az_id: 4 }), dispatch({ az_id: 4 }), VERIFIER).deployment_trailer_dispatch_data[0]
    check("approve (AWD): the AZ 1–3 fields plus farmer_id, verifier_id, verifier_name, deployment_num; NO hq_verifier_id", keysOf(w) === "az_id,deployment_detail_id,deployment_num,farmer_id,franchise_comment,franchise_rejected_reason,franchise_status,franchise_verifier_id,hq_comment,hq_rejected_reason,hq_status,verifier_id,verifier_name" && !("hq_verifier_id" in w), keysOf(w))
    check("approve (AWD): farmer_id / deployment_num strings, verifier_name \"Franchise\", verifier ids the verifier string", w.farmer_id === "1002" && w.deployment_num === "1" && w.verifier_name === "Franchise" && w.verifier_id === VERIFIER && w.franchise_verifier_id === VERIFIER)
    const n = rb.buildNocDecisionRequest(row(), 1, "approved", VERIFIER)
    check("NOC decision: farmer_id, deployment_num and franchise_verifier_id are strings; hq_* null", typeof n.farmer_id === "string" && n.deployment_num === "1" && n.franchise_verifier_id === VERIFIER && n.hq_verifier_id === null && n.hq_status === null)
}

// ── M1: the type registry wires the flows ────────────────────────────────────────────────────────────
{
    const awd = types.getDeploymentType(4), mb = types.getDeploymentType(5), matic = types.getDeploymentType(1), az6 = types.getDeploymentType(6)
    check("AZ 6+: no actions (display only)", az6.actions === null && az6.supportsActions === false)
    check("AZ 1–3: deployment edit / delete keys, dispatch + plot delete", matic.actions.editPermission === "verifier.farm.deployment_verification.create" && matic.actions.deletePermission === "verifier.farm.deployment_verification.delete" && matic.actions.deleteScopes.dispatch && matic.actions.deleteScopes.plot)
    check("AWD: its own edit key; plot delete only (no dispatch delete); delete follows the edit key (OPEN)", awd.actions.editPermission === "verifier.farm.awd_deployment_verification.create" && !awd.actions.deleteScopes.dispatch && awd.actions.deleteScopes.plot && awd.actions.deletePermission === awd.actions.editPermission)
    check("Mati Boost: its own edit key", mb.actions.editPermission === "verifier.farm.mati_boost_deployment_verification.create")
    const d = dispatch({ az_id: 4 }), p = d.deployment_plots_data[0]
    const options = awd.actions.plotReportOptions(p, d, "")
    check("AWD: ten report options per plot, ids awd:<field>:<deployment_id>, matic-dash labels and order", options.length === 10 && options[0].id === "awd:mati_deployed:501" && options.map((o) => o.label).join("|") === "Mati Deployed|Location|Source Name|Date|Picture|Verbal Plot area enrolled|Boost amount plot applied|Batch ID|Field condition|Crop stage", options.map((o) => o.label).join("|"))
    check("AWD: no dispatch-level report options", awd.actions.dispatchReportOptions(d).length === 0)
    const approved = awd.actions.approveRequest(row({ az_id: 4 }), d, VERIFIER).deployment_trailer_dispatch_data[0]
    check("AWD: approveRequest is the AWD body (verifier_name present)", approved.verifier_name === "Franchise" && approved.deployment_num === "1")
    const maticApproved = matic.actions.approveRequest(row(), dispatch(), VERIFIER).deployment_trailer_dispatch_data[0]
    check("AZ 1–3: approveRequest is the plain body (no verifier_name)", !("verifier_name" in maticApproved) && maticApproved.hq_verifier_id === null)
    const sel = [{ kind: "awd_field", field: "location", dispatch: d, plot: p }]
    check("AWD: reportRequests → the AWD report (location as JSON); Mati Boost uses its amount field", awd.actions.reportRequests(row({ az_id: 4 }), sel, "c", VERIFIER).report.reportData[0].location === JSON.stringify(p.location))
    const maticSel = matic.actions.reportRequests(row(), sel, "c", VERIFIER)
    check("AZ 1–3: reportRequests ignores awd_field selections (nothing to send)", maticSel.report.reportData.length === 0)
}

// ── Requirement 5: the approval boundary gate ────────────────────────────────────────────────────────
{
    const label = (p) => `DEPL-${p.deployment_id}`
    const none = gate.dispatchBoundaryGate({ deployment_plots_data: [] }, label)
    check("gate: a dispatch with no plots cannot be approved", !none.ok && /no plots/i.test(none.reason), none.reason)
    const missing = gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: square(21.1, 78.1) }), plot({ deployment_id: 502, geometry: null })] }, label)
    check("gate: one plot without a saved boundary blocks, naming it", !missing.ok && missing.missing.length === 1 && /DEPL-502/.test(missing.reason) && /no saved boundary/i.test(missing.reason), missing.reason)
    const invalid = gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: bowTie(21.1, 78.1) })] }, label)
    check("gate: a self-crossing saved outline is invalid, with the problem", !invalid.ok && invalid.invalid.length === 1 && /crosses itself/.test(invalid.reason), invalid.reason)
    const tooFew = gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: { type: "Polygon", coordinates: [[[78.1, 21.1], [78.2, 21.1], [78.1, 21.1], [78.1, 21.1]]] } })] }, label)
    check("gate: fewer than 3 DISTINCT points is invalid (repeated points don't count)", !tooFew.ok && /Fewer than 3 distinct points/.test(tooFew.reason), tooFew.reason)
    const ok = gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: square(21.1, 78.1) }), plot({ deployment_id: 502, geometry: square(21.2, 78.2) })] }, label)
    check("gate: every plot with a valid saved boundary → ok, no reason", ok.ok && ok.reason === null && ok.checks.every((c) => c.state === "saved"))
    const feature = gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: JSON.stringify({ type: "Feature", geometry: square(21.1, 78.1) }) })] }, label)
    check("gate: a Feature / JSON-string geometry (as the API may send it) is read like a Polygon", feature.ok)
    const twice = [1, 2].map(() => gate.dispatchBoundaryGate({ deployment_plots_data: [plot({ geometry: null })], anything_else: "ignored" }, label))
    check("gate: a pure function of the dispatch's plots as returned — nothing else (no editor state) changes the result", !twice[0].ok && JSON.stringify(twice[0].reason) === JSON.stringify(twice[1].reason))

    // Cal. Area at dispatch grain: Σ of the plots' saved-boundary areas in acres (production's calculated_area: spherical
    // area × 0.00024710538146717, 3 decimals per plot); null unless every plot has a valid saved boundary
    const R = 6378137, rad = (deg) => (deg * Math.PI) / 180
    const exactAcres = (lat) => Math.round(R * R * rad(0.0006) * (Math.sin(rad(lat + 0.0003)) - Math.sin(rad(lat - 0.0003))) * 0.00024710538146717 * 1000) / 1000
    const one = gate.dispatchCalculatedAreaAcres({ deployment_plots_data: [plot({ geometry: square(21.1, 78.1) })] })
    check("Cal. Area: one plot's saved square = its spherical area in acres, 3 decimals (as production's calculated_area)", one !== null && Math.abs(one - exactAcres(21.1)) <= 0.001, `${one} vs ${exactAcres(21.1)}`)
    const two = gate.dispatchCalculatedAreaAcres({ deployment_plots_data: [plot({ geometry: square(21.1, 78.1) }), plot({ deployment_id: 502, geometry: square(25.4, 80.2) })] })
    check("Cal. Area: the dispatch value is the sum of its plots' values", two !== null && Math.abs(two - (exactAcres(21.1) + exactAcres(25.4))) <= 0.002, `${two}`)
    check("Cal. Area: null while any plot has no saved boundary (never a partial sum)", gate.dispatchCalculatedAreaAcres({ deployment_plots_data: [plot({ geometry: square(21.1, 78.1) }), plot({ deployment_id: 502, geometry: null })] }) === null)
    check("Cal. Area: null with an invalid (self-crossing) saved boundary, and for a dispatch with no plots", gate.dispatchCalculatedAreaAcres({ deployment_plots_data: [plot({ geometry: bowTie(21.1, 78.1) })] }) === null && gate.dispatchCalculatedAreaAcres({ deployment_plots_data: [] }) === null)
}

// ── Live API audit (2026-10-11): the list is dispatch-grain — table rows ARE list rows ─────────────────────────────
{
    const record = (over, id = 1) => ({ api: row(over), id })
    const list = [
        record({ dispatch_id: 11, farmer_id: 1001, franchise_status: "approved", status: "approved" }, 1),
        record({ dispatch_id: "12", farmer_id: 1001, franchise_status: " Pending ", status: "pending", action_required: true, err_msg: [" Video is missing. ", "", "Picture is missing."] }, 2),
        record({ dispatch_id: null, farmer_id: 1003, franchise_status: "something-else", status: "pending", action_required: null, err_msg: null }, 3),
    ]
    const out = rows.toDispatchRows(list)
    check("rows: one table row per list row, in list order — nothing expanded, filtered or dropped", out.length === 3 && out.map((r) => r.record.api.farmer_id).join(",") === "1001,1001,1003")
    check("rows: identity is the dispatch id (dispatch:<id>); a row without one keeps a positional key and no dispatchId", out[0].id === "dispatch:11" && out[1].id === "dispatch:12" && out[1].dispatchId === "12" && out[2].id === "row:3" && out[2].dispatchId === null)
    check("rows: the status is the row's own franchise_status (trimmed, case-folded); an unknown value is null — never guessed", out[0].franchiseStatus === "approved" && out[1].franchiseStatus === "pending" && out[2].franchiseStatus === null)
    check("rows: the group key (detail reads) is farmer · round · AZ", out[0].rowKey === "1001-1-1")
    check("validation: THIS row's flag and messages (trimmed, empty dropped); an unsent flag stays null (not 'valid')", out[1].validation.required === true && JSON.stringify(out[1].validation.messages) === JSON.stringify(["Video is missing.", "Picture is missing."]) && out[0].validation.required === false && out[0].validation.messages.length === 0 && out[2].validation.required === null)
    check("validation: never on a sibling — the unflagged dispatch of the same farmer carries none", out[0].validation.required === false && out[0].validation.messages.length === 0)
    const summary = rows.summarizeDispatchRows(out, 40)
    check("summary: loaded rows, the server total, rows without an id, flagged rows", summary.dispatchRows === 3 && summary.total === 40 && summary.withoutId === 1 && summary.flagged === 1, JSON.stringify(summary))
    check("farmerOrder: the distinct farmers of the loaded rows, in order", rows.farmerOrder(out).map((f) => f.farmerId).join(",") === "1001,1003")

    // Area / Cal. Area (Deployment V2's meanings) and the quantity format
    const q = rows.dispatchQuantities(row({ plots: "2", actual_area: "5.00", calculated_area: "2.83", deployed_amount: 5 }))
    check("Area is actual_area (the deployment's ENROLLED area), Cal. Area is calculated_area (the dispatch's) — different fields, different values", q.area === 5 && q.calArea === 2.83 && q.area !== q.calArea, JSON.stringify(q))
    check("quantities: digit strings are numbers ('5.00' → 5, '2' → 2); numbers rounded to 2 decimals", q.plots === 2 && q.deployed === 5 && rows.shownQuantity(4.5123) === 4.51 && rows.shownQuantity("0.115") === 0.12)
    const missing = rows.dispatchQuantities(row({ plots: null, actual_area: undefined, calculated_area: "", deployed_amount: "n/a" }))
    check("quantities: null / absent / empty / non-numeric → null (shown '-'), never 0", missing.plots === null && missing.area === null && missing.calArea === null && missing.deployed === null, JSON.stringify(missing))
    check("quantities: a 0 the API sends is a value (0), not a missing one", rows.shownQuantity("0.00") === 0 && rows.shownQuantity(0) === 0)
    check("apiNumber: numbers and digit strings only (no NaN / Infinity / '1e3' / ' ')", rows.apiNumber(Number.NaN) === null && rows.apiNumber(Infinity) === null && rows.apiNumber("1e3") === null && rows.apiNumber(" ") === null && rows.apiNumber("-1.5") === -1.5)

    // The detail's groups: a farmer's dispatch rows → one group per farmer · round · AZ
    const farmerRows = [
        row({ dispatch_id: 21, az_id: 1, created_at: 300, franchise_status: "approved", actual_area: 7.5, calculated_area: 2.5 }),
        row({ dispatch_id: 22, az_id: 1, created_at: 100, franchise_status: "pending", actual_area: 7.5, calculated_area: 3 }),
        row({ dispatch_id: 23, az_id: 2, created_at: 200, franchise_status: "rejected" }),
        row({ dispatch_id: 21, az_id: 1, created_at: 300, franchise_status: "approved" }),
    ]
    const groups = rows.groupDispatchRows(farmerRows)
    check("groups: one per farmer · round · AZ, in first-seen order; a dispatch id seen twice (page overlap) counted once", groups.length === 2 && groups[0].key === "1002-1-1" && groups[0].rows.length === 2 && groups[1].rows.length === 1)
    check("groups: the group row is the earliest dispatch row, with the list's dispatch count and their statuses (counted, not a status)", groups[0].row.dispatch_id === 22 && groups[0].row.trailers_deployed === 2 && JSON.stringify(groups[0].row.franchise_statuses) === JSON.stringify(["approved", "pending"]))
    check("groups: the enrolled area is the deployment's (the same on its dispatches); calculated areas stay per dispatch", groups[0].row.actual_area === 7.5 && groups[0].rows.map((r) => r.calculated_area).join(",") === "2.5,3")
    check("groupAllApproved: true only when every dispatch row is approved; the loaded read wins (it follows mutations first)", !rows.groupAllApproved(groups[0].rows, null) && rows.groupAllApproved([farmerRows[0]], null) && rows.groupAllApproved(groups[0].rows, [{ franchise_status: "approved" }, { franchise_status: "approved" }]) && !rows.groupAllApproved([], null))
}

// ── Requirement 4 + live API audit: status from franchise_status only; validation PER DISPATCH ─────────────────
{
    const index = { dispatches: new Map(), notShown: [] }
    const input = (allApproved = false) => ({ row: row(), allApproved, reportIndex: index, historyKnown: true, fieldMarkers: true })
    const flagged = view.classifyDispatch(dispatch({ franchise_status: "pending", action_required: true, err_msg: ["Video is missing."] }), input())
    const sibling = view.classifyDispatch(dispatch({ deployment_detail_id: "DD-2", franchise_status: "pending", action_required: false, err_msg: [] }), input())
    check("a flagged pending dispatch stays Pending — validation never becomes a state or a correction origin", flagged.view === "pending" && flagged.origins.length === 0 && view.correctionContexts(flagged).length === 0)
    check("the dispatch carries ITS validation (flag + messages); its sibling carries its own (none)", flagged.validation.required === true && flagged.validation.messages[0] === "Video is missing." && sibling.validation.required === false && sibling.validation.messages.length === 0)
    const nc = view.classifyDispatch(dispatch({ franchise_status: "rejected" }), input())
    check("a rejected dispatch is Need Correction from its own status", nc.view === "need_correction")
    const approved = view.classifyDispatch(dispatch({ franchise_status: "approved", action_required: true, err_msg: [] }), input())
    check("an approved dispatch is Verified even when flagged (the flag is shown, the status is not changed)", approved.view === "verified" && approved.validation.required === true)
    const unknown = view.classifyDispatch(dispatch({ franchise_status: null, action_required: null }), input())
    check("a dispatch without franchise_status is shown as Pending and flagged as not sent; an unsent flag stays unknown", unknown.view === "pending" && unknown.statusKnown === false && unknown.validation.required === null)
    const type = { supportsActions: true }
    check("Approve: a pending dispatch the API doesn't flag; an unsent flag doesn't block", view.offersApprove(sibling, type) && view.offersApprove(unknown, type))
    check("Approve: not on a flagged pending dispatch (Report instead — the established Action Required rule), with the reason", !view.offersApprove(flagged, type) && view.offersReport(flagged, type) && typeof view.validationApproveBlocker(flagged) === "string" && view.validationApproveBlocker(sibling) === null)
    check("Approve / Report: never on a non-pending dispatch, nor for a type without a workflow", !view.offersApprove(approved, type) && !view.offersReport(approved, type) && !view.offersReport(nc, type) && !view.offersApprove(sibling, { supportsActions: false }))
    check("verification scope: pending dispatches while the group isn't fully approved; approved ones once it is", sibling.inVerificationScope && !approved.inVerificationScope && view.classifyDispatch(dispatch({ franchise_status: "approved" }), input(true)).inVerificationScope)
    check("row validation helper (Inspector): the flag and its reasons; an empty err_msg gives no reasons", JSON.stringify(view.systemValidationOf(row({ action_required: true, err_msg: ["Video is missing."] }))) === JSON.stringify({ required: true, reasons: ["Video is missing."] }) && view.systemValidationOf(row({ action_required: true, err_msg: [] })).reasons.length === 0)
    const counts = view.detailFilterCounts([sibling, nc, approved], { readsOk: true })
    check("filter counts come from the dispatches' own statuses; unknown until every read succeeded", counts.pending === 1 && counts.need_correction === 1 && counts.verified === 1 && view.detailFilterCounts([sibling], { readsOk: false }).all === null)
    check("VIEW_OF_STATUS is a relabelling: approved→verified, pending→pending, rejected→need_correction", JSON.stringify(view.VIEW_OF_STATUS) === JSON.stringify({ approved: "verified", pending: "pending", rejected: "need_correction" }))
    check("mergeDispatchReads keeps the first occurrence of a dispatch id", view.mergeDispatchReads([[dispatch({ deployment_detail_id: "A", franchise_status: "approved" })], [dispatch({ deployment_detail_id: "A" })]]).length === 1)
}

// ── The all-status read ──────────────────────────────────────────────────────────────────────────────
{
    const req = rb.buildAllStatusTrailerDetailsRequest(row({ farmer_id: 1002, deployment_num: 2, az_id: 3 }))
    check("all-status read: farmer_id string, deployment_num, az_id array, NO status key", keysOf(req.trailerDetails[0]) === "az_id,deployment_num,farmer_id" && req.trailerDetails[0].farmer_id === "1002" && req.trailerDetails[0].az_id.join() === "3")
}

// ── The detail header's "N Plots · X Acres": unique plots, total Cal. Area (the table's calculated_area) ──────────
{
    const H = totals.farmerHeaderTotals
    // two dispatches: A (71) holds P-1, P-2; B (72) holds P-3 — every plot on one deployment record
    const A = (over = {}) => dispatch({ dispatch_id: 71, deployment_detail_id: "DD-A", deployment_plots_data: [plot({ deployment_id: 601, dispatch_id: 71, plot_id: "P-1", area: 9.99, geometry: square(21.1, 78.1) }), plot({ deployment_id: 602, dispatch_id: 71, plot_id: "P-2", area: 9.99 })], ...over })
    const B = (over = {}) => dispatch({ dispatch_id: 72, deployment_detail_id: "DD-B", deployment_plots_data: [plot({ deployment_id: 603, dispatch_id: 72, plot_id: "P-3", area: 9.99 })], ...over })
    const r71 = (calculated_area) => row({ dispatch_id: 71, calculated_area })
    const r72 = (calculated_area) => row({ dispatch_id: 72, calculated_area })

    const ok = H([A(), B()], [r71("2.50"), r72(1.25)])
    check("header: the total is the sum of the dispatches' Cal. Area (calculated_area, as the table reads it: '2.50' → 2.5)", ok.plots === 3 && ok.area === 3.75 && ok.reasons.length === 0, JSON.stringify(ok))
    check("header: a plot's own area and boundary geometry are never used (plots carry 9.99 acres and a saved square)", ok.area !== 3 * 9.99 && ok.area === 3.75)
    check("header: values rounded as the table shows them (0.115 → 0.12), the sum to 2 decimals (0.1 + 0.2 = 0.3)", H([A(), B()], [r71("0.115"), r72(1)]).area === 1.12 && H([A(), B()], [r71(0.1), r72(0.2)]).area === 0.3)

    // duplicates
    const dupRow = H([A(), B()], [r71("2.50"), r71(2.5), r72(1.25)])
    const dupRead = H([A(), A(), B()], [r71("2.50"), r72(1.25)])
    check("header: a dispatch's list record sent twice (same value), or a dispatch read twice, is counted once", dupRow.area === 3.75 && dupRead.area === 3.75 && dupRead.plots === 3, JSON.stringify({ dupRow, dupRead }))
    const shared = H([A(), B({ deployment_plots_data: [plot({ deployment_id: 603, dispatch_id: 72, plot_id: "P-1" })] })], [r71(2.5), r72(1.25)])
    check("header: a plot in two dispatches is counted once in Plots, and its area is never summed twice — the total is left unstated, with why",
        shared.plots === 2 && shared.area === null && shared.reasons.some((r) => /1 of 2 plots is on more than one deployment record/.test(r)), JSON.stringify(shared))
    const twiceInOne = H([A({ deployment_plots_data: [plot({ deployment_id: 601, plot_id: "P-1" }), plot({ deployment_id: 602, plot_id: "P-1" })] })], [r71(2.5)])
    check("header: a plot on two deployment records of ONE dispatch: Plots 1, total unstated", twiceInOne.plots === 1 && twiceInOne.area === null, JSON.stringify(twiceInOne))

    // missing / invalid / zero / conflicting → no total, never a zero, never a partial sum
    for (const [label, value] of [["null", null], ["absent", undefined], ["empty", ""]]) {
        const t = H([A(), B()], [r71(2.5), r72(value)])
        check(`header: Cal. Area ${label} for one dispatch → no total (not 2.5), "not recorded for 1 of 2 dispatches"`, t.area === null && t.reasons.includes("Cal. Area not recorded for 1 of 2 dispatches"), JSON.stringify(t))
    }
    const noRow = H([A(), B()], [r71(2.5)])
    check("header: a dispatch with no list row → no total (missing)", noRow.area === null && noRow.reasons.includes("Cal. Area not recorded for 1 of 2 dispatches"), JSON.stringify(noRow))
    for (const [label, value] of [["'n/a'", "n/a"], ["-1", -1], ["NaN", Number.NaN], ["'1e3'", "1e3"], ["Infinity", Infinity]]) {
        const t = H([A(), B()], [r71(2.5), r72(value)])
        check(`header: an invalid Cal. Area (${label}) never becomes 0 — no total, "isn't a valid number"`, t.area === null && t.reasons.includes("Cal. Area isn't a valid number for 1 of 2 dispatches"), JSON.stringify(t))
    }
    const zero = H([A(), B()], [r71(2.5), r72("0.00")])
    check("header: a Cal. Area of 0 is not taken as a recorded area (the contract doesn't confirm it) — no total, with why", zero.area === null && zero.reasons.some((r) => /is 0 for 1 of 2 dispatches/.test(r)), JSON.stringify(zero))
    const conflict = H([A(), B()], [r71(2.5), r71(3), r72(1.25)])
    const halfMissing = H([A(), B()], [r71(2.5), r71(null), r72(1.25)])
    check("header: records of one dispatch that disagree (2.5 vs 3; a value vs none) → no total, \"differs between records\"",
        conflict.area === null && conflict.reasons.includes("Cal. Area differs between records of 1 of 2 dispatches") && halfMissing.area === null && halfMissing.reasons.includes("Cal. Area differs between records of 1 of 2 dispatches"), JSON.stringify({ conflict, halfMissing }))
    const several = H([A(), B({ deployment_plots_data: [plot({ deployment_id: 603, dispatch_id: 72, plot_id: "P-1" })] })], [r71("x"), r72(null)])
    check("header: every reason is given, not just the first", several.reasons.length === 3, JSON.stringify(several.reasons))

    // scope and plot identity
    const other = H([A(), B()], [r71(2.5), r72(1.25), row({ dispatch_id: 99, calculated_area: 50 })])
    check("header: list rows of dispatches that hold none of the plots are not added", other.area === 3.75, JSON.stringify(other))
    const noIds = H([A({ deployment_plots_data: [plot({ deployment_id: 601, plot_id: "" }), plot({ deployment_id: 602, plot_id: "  " }), plot({ deployment_id: 604, plot_id: " P-9 " })] }), B({ deployment_plots_data: [plot({ deployment_id: 605, plot_id: "P-9" })] })], [r71(2), r72(1)])
    check("header: Plots — a plot without a plot_id counts by its deployment; plot_ids are trimmed ('P-9' twice = 1 plot)", noIds.plots === 3, JSON.stringify(noIds))
    const none = H([], [])
    check("header: no plots → no total, with why (never '0 Acres')", none.plots === 0 && none.area === null && none.reasons.includes("No plots recorded for this farmer"), JSON.stringify(none))
}

// ── Boundary containment (the original Deployment page's assignShapesToDeployments, without its defects) ───────────
{
    const { boundaryCoverage, isValidLocation, isInsideOutline } = coverage
    // a square outline around (21.1, 78.1): ±0.001°
    const outline = [{ lat: 21.099, lng: 78.099 }, { lat: 21.099, lng: 78.101 }, { lat: 21.101, lng: 78.101 }, { lat: 21.101, lng: 78.099 }]
    const at = (lat, lng) => ({ lat, lng })
    const dA = dispatch({ dispatch_id: 81, deployment_detail_id: "DD-81", az_id: 1, deployment_plots_data: [] })
    const dB = dispatch({ dispatch_id: 82, deployment_detail_id: "DD-82", az_id: 2, deployment_plots_data: [] })
    const dC = dispatch({ dispatch_id: 83, deployment_detail_id: "DD-83", az_id: 3, deployment_plots_data: [] })
    const target = { plot: plot({ deployment_id: 700, farmer_id: 1002, location: at(21.1, 78.1) }), dispatch: dA, round: 1 }
    const cand = (deployment_id, location, over = {}, d = dA, extra = {}) => ({ plot: plot({ deployment_id, farmer_id: 1002, location, geometry: null, ...over }), dispatch: d, round: 1, editable: true, ...extra })
    const ids = (r) => r.entries.map((e) => e.plot.deployment_id)
    const why = (r, id) => r.skipped.find((x) => x.plot.deployment_id === id)?.reason ?? null

    // several inside, others outside; the edited plot first
    const many = boundaryCoverage(target, outline, [cand(700, at(21.1, 78.1)), cand(701, at(21.1004, 78.1003), {}, dB), cand(702, at(21.0995, 78.0992), {}, dC), cand(703, at(21.11, 78.1)), cand(704, at(21.1, 78.2))])
    check("containment: every deployment of the farmer and round inside the outline is covered — the edited one first, the outside ones not", JSON.stringify(ids(many)) === "[700,701,702]" && why(many, 703) === "outside" && why(many, 704) === "outside", JSON.stringify({ ids: ids(many), skipped: many.skipped.map((x) => [x.plot.deployment_id, x.reason]) }))
    check("containment: the edited deployment is always saved, even with no other deployment inside (V2.1's editor targets it)", JSON.stringify(ids(boundaryCoverage(target, outline, [cand(703, at(21.11, 78.1))]))) === "[700]")

    // coordinates
    check("location: missing, (0, 0), out of range and non-numbers are not locations", !isValidLocation(null) && !isValidLocation(undefined) && !isValidLocation(at(0, 0)) && !isValidLocation(at(91, 78)) && !isValidLocation(at(21, 181)) && !isValidLocation(at(Number.NaN, 78)) && !isValidLocation({ lat: "21.1", lng: "78.1" }) && isValidLocation(at(21.1, 78.1)) && isValidLocation(at(0, 78.1)))
    const zeroOutline = [{ lat: -0.001, lng: -0.001 }, { lat: -0.001, lng: 0.001 }, { lat: 0.001, lng: 0.001 }, { lat: 0.001, lng: -0.001 }]
    const zero = boundaryCoverage({ ...target, plot: plot({ deployment_id: 700, farmer_id: 1002, location: at(0.0005, 0.0005) }) }, zeroOutline, [cand(710, at(0, 0)), cand(711, null)])
    check("location: a (0, 0) placeholder is never covered — even by an outline drawn around (0, 0); a missing one neither", JSON.stringify(ids(zero)) === "[700]" && why(zero, 710) === "no-location" && why(zero, 711) === "no-location", JSON.stringify(zero.skipped.map((x) => [x.plot.deployment_id, x.reason])))
    // an L-shaped outline: the notch (the missing quarter) is outside, the arm inside
    const L_SHAPE = [at(21.100, 78.100), at(21.100, 78.102), at(21.101, 78.102), at(21.101, 78.101), at(21.102, 78.101), at(21.102, 78.100)]
    check("point in polygon: inside, outside, and a concave outline's notch outside / arm inside", isInsideOutline(at(21.1, 78.1), outline) && !isInsideOutline(at(21.2, 78.1), outline) && !isInsideOutline(at(21.1015, 78.1015), L_SHAPE) && isInsideOutline(at(21.1005, 78.1015), L_SHAPE) && isInsideOutline(at(21.1015, 78.1005), L_SHAPE) && !isInsideOutline(at(21.1, 78.1), outline.slice(0, 2)))

    // duplicates
    const dup = boundaryCoverage(target, outline, [cand(700, at(21.1, 78.1)), cand(701, at(21.1004, 78.1003), {}, dB), cand(701, at(21.1004, 78.1003), {}, dB)])
    check("duplicates: a deployment listed twice (or the edited one listed again) is covered once", JSON.stringify(ids(dup)) === "[700,701]" && why(dup, 701) === "duplicate", JSON.stringify(ids(dup)))

    // scope and existing boundaries
    const square = gate.SEEDED_VALID_OUTLINE({ lat: 21.1003, lng: 78.1003 })
    const scope = boundaryCoverage(target, outline, [
        cand(720, at(21.1001, 78.1001), { farmer_id: 9999 }),
        cand(721, at(21.1001, 78.1002), {}, dA, { round: 2 }),
        cand(722, at(21.1002, 78.1001), {}, dA, { editable: false }),
        cand(723, at(21.1003, 78.1003), { geometry: square }),
        cand(724, at(21.1002, 78.1002), { geometry: gate.SEEDED_INVALID_OUTLINE({ lat: 21.1002, lng: 78.1002 }) }),
        cand(725, at(21.1001, 78.0998)),
    ], new Set([725]))
    check("scope: another farmer, another round, a deployment the verifier may not edit, and an excluded one are never covered", why(scope, 720) === "other-farmer" && why(scope, 721) === "other-round" && why(scope, 722) === "not-editable" && why(scope, 725) === "excluded", JSON.stringify(scope.skipped.map((x) => [x.plot.deployment_id, x.reason])))
    // production's rule: a deployment inside that already has a boundary gets the new outline too — flagged `replaces`
    const replaced = (r, id) => r.covered.find((c) => c.plot.deployment_id === id)?.replaces
    check("existing boundaries (production's rule): a deployment inside that has one (valid or not) is covered too — flagged as replacing it; one without is not flagged",
        ids(scope).includes(723) && ids(scope).includes(724) && replaced(scope, 723) === true && replaced(scope, 724) === true && replaced(many, 701) === false,
        JSON.stringify({ ids: ids(scope), covered: scope.covered.map((c) => [c.plot.deployment_id, c.replaces]) }))
    check("existing boundaries: farmer, round, editability, location and the outline still decide — a boundary changes nothing about scope",
        JSON.stringify(ids(scope)) === "[700,723,724]" && why(scope, 720) === "other-farmer" && why(scope, 721) === "other-round" && why(scope, 722) === "not-editable" && why(scope, 725) === "excluded", JSON.stringify(scope.skipped.map((x) => [x.plot.deployment_id, x.reason])))
    check("scope: an unknown round covers nothing but the edited deployment", JSON.stringify(ids(boundaryCoverage({ ...target, round: null }, outline, [cand(701, at(21.1004, 78.1003))]))) === "[700]")

    // the request: one entry per covered deployment, each with its own identifiers
    const req = rb.buildUploadGeoJsonEntriesRequest(many.entries, [{ lat: 21.099, lng: 78.099 }, { lat: 21.099, lng: 78.101 }, { lat: 21.101, lng: 78.101 }], 4046.86)
    const e = req.geoJsonData
    check("request: one entry per covered deployment, in one request, with that deployment's own id, farmer and AZ (not the first one's)", e.length === 3 && e.map((x) => x.deployment_id).join() === "700,701,702" && e.map((x) => x.az_id).join() === "1,2,3" && e.every((x) => x.farmerId === 1002), JSON.stringify(e.map((x) => [x.deployment_id, x.farmerId, x.az_id])))
    check("request: every entry carries the same closed polygon and the same calculated_area (acres, 3 dp); no plot_id (the contract has none)", e.every((x) => JSON.stringify(x.geoJson) === JSON.stringify(e[0].geoJson) && x.calculated_area === e[0].calculated_area && !("plot_id" in x)) && e[0].calculated_area === 1 && JSON.stringify(e[0].geoJson.features[0].geometry.coordinates[0][0]) === JSON.stringify(e[0].geoJson.features[0].geometry.coordinates[0][3]), JSON.stringify(e[0]))
    check("request: a deployment listed twice is sent once", rb.buildUploadGeoJsonEntriesRequest([many.entries[0], many.entries[0], many.entries[1]], outline, 100).geoJsonData.length === 2)
    let emptyError = null
    try { rb.buildUploadGeoJsonEntriesRequest([], outline, 100) } catch (error) { emptyError = String(error.message) }
    check("request: never an empty one — nothing to save is an error, not a request", !!emptyError && /nothing was sent/.test(emptyError), emptyError ?? "built")
    const single = rb.buildUploadGeoJsonRequest(target.plot, dA, outline, 100)
    check("request: the one-plot builder is unchanged (one entry, the plot's own identifiers)", single.geoJsonData.length === 1 && single.geoJsonData[0].deployment_id === 700 && single.geoJsonData[0].az_id === 1)
}

console.log(failures ? `\n${passes} passed, ${failures} FAILED` : `\nALL PASS (${passes})`)
process.exit(failures ? 1 : 0)
