// Deployment V2.1 — the LIVE data layer without a network: the compiled live modules run in node against a stubbed
// `fetch` (a mocked transport), so every read and mutation flow is checked for the exact method, path, headers, body,
// envelope parsing, error handling, the status-omitted dispatch read with its per-status fallback, the Inspector trace
// (live / mutation labels, nothing credential-shaped) and the rule that live mode never falls back to mock data.
// This is NOT a live verification: no request leaves this process. Compile first (see README.md):
//   npx tsc -p tests/deployment-v2-1/tsconfig.live.json
//   echo '{"type":"commonjs"}' > tests/deployment-v2-1/out-live/package.json
//   node tests/deployment-v2-1/check-live-api.mjs
import Module, { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

// tsc keeps the app's `@/` path alias in the compiled requires; resolve it to the compiled tree (src → out-live).
const OUT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "out-live")
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
    return resolveFilename.call(this, request.startsWith("@/") ? path.join(OUT_ROOT, request.slice(2)) : request, ...rest)
}

// The data layer reads these at module load (src/platform/env.ts, data-mode.ts): a live build without a real host.
process.env.NEXT_PUBLIC_MATI_API_BASE_URL = "https://api.invalid.test"
process.env.NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE = "live"
process.env.NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS = ""
// The client reads the dev token from localStorage; the mock backend's module init reads window.location.search.
const TEST_TOKEN = "test-token-not-a-credential"
globalThis.window = { localStorage: { getItem: (key) => (key === "mati_dev_auth_token" ? TEST_TOKEN : null) }, location: { search: "" } }

// ── A stubbed transport: every request is recorded; responses are queued per test ────────────────────
const calls = []
let queue = []
globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, headers: init?.headers ?? {}, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
    const next = queue.shift()
    if (!next) throw new Error("no queued response")
    if (next instanceof Error) throw next
    const text = typeof next.body === "string" ? next.body : JSON.stringify(next.body)
    return { ok: next.status >= 200 && next.status < 300, status: next.status, statusText: next.statusText ?? "", text: async () => text }
}
const respond = (...responses) => { queue = responses }
const ok = (body) => ({ status: 200, body })
const last = () => calls[calls.length - 1]
const reset = () => { calls.length = 0; queue = [] }

const require = createRequire(import.meta.url)
const OUT = "./out-live/app/layouts/deployment-v2-1/data"
const { liveDeploymentApi, fetchDeploymentMetadata, fetchDeploymentStatusCounts, DEPLOYMENT_ENDPOINTS, lookupApi } = require(`${OUT}/live-api.js`)
const { deploymentApi } = require(`${OUT}/deployment-api.js`)
const { ApiError } = require(`${OUT}/api-client.js`)
const { deploymentTrace } = require(`${OUT}/api-trace.js`)
const { readRowDispatches } = require(`${OUT}/dispatch-reads.js`)
const { mapTableQueryToV4, UnsupportedQueryError } = require(`${OUT}/query-mapper.js`)
const { isLiveMode, isMutationInterceptMode } = require(`${OUT}/data-mode.js`)
const { liveDataSource, UNAVAILABLE_COUNTS } = require(`${OUT}/data-source.js`)

let failures = 0, passes = 0
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (ok) passes++; else failures++ }
const rejects = async (promise) => { try { await promise; return null } catch (e) { return e } }
const BASE = "https://api.invalid.test"

// ── Mode ─────────────────────────────────────────────────────────────────────────────────────────────
check("the build is a LIVE build (data-mode) and mutation interception is off", isLiveMode === true && isMutationInterceptMode === false)

// ── Transport: method, path, auth header, JSON body (no header or token ever leaves this test) ───────
{
    reset()
    const raw = { deployment_detail_id: "DD-7", dispatch_id: "77", az_id: "2", az_code: "AZ2", date: "1700000000000", num_tons: "5.5", franchise_status: "pending", trailer_no: "T1", surveyor_name: "", surveyor_registred_no: "", source_name: "Q", video: null, village_name: "", cluster_name: "", repeater_form_index: "1", deployment_plots_data: [{ deployment_id: "501", dispatch_id: "77", farmer_id: "1002", amt_plot_deploy: "2.5", area: "1.2", location: "{\"lat\":\"21.1\",\"lng\":\"78.1\"}", geometry: null, picture_deployment: "https://x.test/p.jpg", plot_id: "P1", repeater_form_id: "rf", repeater_form_index: "1", is_location_reported: 0, is_mati_deploy_reported: "1" }], action_required: "true", err_msg: [" Video is missing. ", null], verified_at: "1700000500000", verified_by: " Verifier A " }
    const rawSibling = { ...raw, deployment_detail_id: "DD-8", dispatch_id: "78", action_required: false, err_msg: [], verified_at: null, verified_by: null }
    const rawUnsent = { ...raw, deployment_detail_id: "DD-9", dispatch_id: "79", action_required: undefined, err_msg: "x", verified_at: "12-03-2025", verified_by: "" }
    respond(ok({ status: 200, message: "ok", data: [raw, rawSibling, rawUnsent] }))
    const dispatches = await deploymentApi.getTrailerDetails({ trailerDetails: [{ farmer_id: "1002", deployment_num: 1, az_id: [2] }] })
    const c = last()
    check("live mode routes through the configured API client to the production path (POST getTrailerDetails)", c.method === "POST" && c.url === `${BASE}${DEPLOYMENT_ENDPOINTS.trailerDetails}`)
    check("the request carries the configured bearer token and a JSON content type (values not printed)", c.headers.Authorization === `Bearer ${TEST_TOKEN}` && c.headers["Content-Type"] === "application/json")
    check("the body is the request builder's object, verbatim (status omitted, az_id sent)", JSON.stringify(c.body) === JSON.stringify({ trailerDetails: [{ farmer_id: "1002", deployment_num: 1, az_id: [2] }] }))
    const d = dispatches[0]
    check("the response envelope { data: [...] } is normalised: numeric strings → numbers, JSON location → {lat,lng}, flags → booleans", dispatches.length === 3 && d.dispatch_id === 77 && d.az_id === 2 && d.num_tons === 5.5 && d.date === 1700000000000 && d.date_raw === "1700000000000" && d.deployment_plots_data[0].location.lat === 21.1 && d.deployment_plots_data[0].is_deployment_reported === true && d.deployment_plots_data[0].deployment_id === 501)
    check("a dispatch's franchise_status is kept as sent", d.franchise_status === "pending")
    // V2.1 (live API audit): each dispatch's own validation and verification, read from ITS response item
    check("dispatch validation: action_required ('true' → true) and err_msg (non-empty strings, trimmed) of THIS dispatch", d.action_required === true && JSON.stringify(d.err_msg) === JSON.stringify(["Video is missing."]))
    check("dispatch validation: a sibling keeps its own (false, none) — nothing is copied between dispatches", dispatches[1].action_required === false && dispatches[1].err_msg.length === 0)
    check("dispatch validation: an unsent flag is null (not false); a non-array err_msg is null", dispatches[2].action_required === null && dispatches[2].err_msg === null)
    check("dispatch verification: verified_at epoch ms (digit string read), verified_by trimmed; text dates / empty names → null", d.verified_at === 1700000500000 && d.verified_by === "Verifier A" && dispatches[2].verified_at === null && dispatches[2].verified_by === null)
}

// ── Every endpoint V2.1 uses: production paths and methods (matic-dash src/services/api.ts, deployment.api.ts) ──
{
    const expected = {
        metadata: ["POST", "/adminFarmApp/v4/getDeploymentMetadata"],
        counts: ["POST", "/adminFarmApp/v4/getDeploymentStatusCounts"],
        trailerDetails: ["POST", "/adminDeploymentSec/v3/getTrailerDetails"],
        nocDetails: ["POST", "/adminFarmApp/v3/getDeploymentNocDetails"],
        reportHistory: ["POST", "/adminDeploymentSec/v3/getFarmerReportedHistory"],
        updateDispatch: ["PATCH", "/adminFarmApp/v3/updateDeploymentTrailerDispatch"],
        reportFarmerDetails: ["POST", "/adminDeploymentSec/v3/reportFarmerDetails"],
        nocDecision: ["PATCH", "/adminDeploymentSec/updateFarmerDeploymentNOC"],
        comment: ["PATCH", "/adminDeploymentSec/v3/comment"],
        softDelete: ["PATCH", "/adminDeploymentSec/v3/softDeleteDispatch"],
        uploadGeoJson: ["POST", "/adminDeploymentSec/uploadGeoJsonData"],
        farmers: ["GET", "/adminFarmApp/v4/getAllFarmersList"],
        villages: ["GET", "/adminFarmApp/v4/getVillageList"],
        azs: ["GET", "/adminFarmApp/v4/getAllAzData"],
        surveyors: ["GET", "/adminFarmApp/v4/getAllActiveSurveyorsList"],
        verifiers: ["GET", "/adminFarmApp/v4/getVerifiersList"],
    }
    check("DEPLOYMENT_ENDPOINTS are the production paths", Object.entries(expected).every(([key, [, path]]) => DEPLOYMENT_ENDPOINTS[key] === path), JSON.stringify(DEPLOYMENT_ENDPOINTS))
    const mutations = [
        ["updateDeploymentTrailerDispatch", "updateDispatch", { deployment_trailer_dispatch_data: [{ deployment_detail_id: "DD-7", franchise_status: "approved", franchise_verifier_id: "9000000001" }] }],
        ["reportFarmerDetails", "reportFarmerDetails", { reportData: [{ farmer_id: "1002", deployment_num: "1", surveyor_no: "9000000002" }], farmerReportedData: [] }],
        ["updateFarmerDeploymentNOC", "nocDecision", { farmer_id: "1002", deployment_num: "1", az_id: 2, status: "approved", franchise_verifier_id: "9000000001" }],
        ["updateComment", "comment", { section_type: 2, comment: "c", id: 501, az_id: 2 }],
        ["softDeleteDispatch", "softDelete", { comment: "c", deletedBy: "Deployment", deployment_ids: [501] }],
        ["uploadGeoJson", "uploadGeoJson", { geoJsonData: [{ deployment_id: 501, farmerId: 1002, az_id: 2, calculated_area: 0.1, geoJson: { type: "FeatureCollection", features: [] } }] }],
    ]
    for (const [method, key, body] of mutations) {
        reset()
        respond(ok({ status: 200, message: "ok", data: [] }))
        const result = await liveDeploymentApi[method](body)
        const c = last()
        check(`${method}: ${expected[key][0]} ${expected[key][1]} with the builder's body, HTTP 200 → { status: 200 }`, c.method === expected[key][0] && c.url === `${BASE}${expected[key][1]}` && JSON.stringify(c.body) === JSON.stringify(body) && result.status === 200)
    }
    // Failure semantics: a mutation never reads as success unless the server answered 2xx with a non-auth-failure body
    reset()
    respond({ status: 500, statusText: "Internal Server Error", body: { message: "boom" } })
    const e500 = await rejects(liveDeploymentApi.updateDeploymentTrailerDispatch({ deployment_trailer_dispatch_data: [] }))
    check("a non-2xx mutation response REJECTS with an ApiError carrying the status and the server's reason (never { status })", e500 instanceof ApiError && e500.status === 500 && /boom/.test(e500.message))
    reset()
    respond(ok({ success: false, msg: "Unauthorized" }))
    const eAuth = await rejects(liveDeploymentApi.reportFarmerDetails({ reportData: [], farmerReportedData: [] }))
    check("an HTTP 200 auth-failure body ({ success:false }) rejects as 401 (the dev API's shape)", eAuth instanceof ApiError && eAuth.status === 401)
    reset()
    respond({ status: 200, body: "<html>maintenance</html>" })
    const eHtml = await rejects(liveDeploymentApi.updateComment({ section_type: 2, comment: "c", id: 1, az_id: 1 }))
    check("a non-JSON 200 response rejects (never a silent success)", eHtml instanceof ApiError)
    reset()
    respond({ status: 400, statusText: "Bad Request", body: { status: 400, error: { code: "23502", table: "quality_system_defects", detail: "Failing row contains (…)" } } })
    const e400 = await rejects(liveDeploymentApi.reportFarmerDetails({ reportData: [], farmerReportedData: [] }))
    check("a 400 with a database diagnostic keeps the full server text in ApiError.details (the report dialog's Technical details)", e400 instanceof ApiError && /code: 23502/.test(e400.details ?? "") && /table: quality_system_defects/.test(e400.details ?? ""))
}

// ── List reads: v4 bodies, envelope checks, the farmer-rows read ───────────────────────────────────
{
    // V2.1 (live API audit): the farmer read pages until pagination.total (rows are dispatches; one page of 100 could drop groups)
    reset()
    const pageOf = (from, n) => Array.from({ length: n }, (_, i) => ({ farmer_id: 1002, deployment_num: 1, az_id: 2, dispatch_id: from + i }))
    respond(
        ok({ status: 200, message: "ok", data: { data: pageOf(1, 100), pagination: { total: 130, page: 1, rows: 100, total_pages: 2 } } }),
        ok({ status: 200, message: "ok", data: { data: pageOf(101, 30), pagination: { total: 130, page: 2, rows: 100, total_pages: 2 } } }),
    )
    const rows = await liveDeploymentApi.listFarmerRows("1002")
    const farmerBodies = calls.filter((c) => c.url.endsWith("/adminFarmApp/v4/getDeploymentMetadata")).map((c) => c.body)
    check("listFarmerRows: getDeploymentMetadata with farmer_ids (numbers) and status 'all', every page of 100 until pagination.total", farmerBodies.length === 2 && JSON.stringify(farmerBodies[0]) === JSON.stringify({ farmer_ids: [1002], status: "all", rows: 100, page: 1 }) && farmerBodies[1].page === 2 && rows.length === 130, `${farmerBodies.length} requests, ${rows.length} rows`)
    reset()
    respond(...Array.from({ length: 20 }, (_, i) => ok({ status: 200, message: "ok", data: { data: pageOf(i * 100 + 1, 100), pagination: { total: 5000, page: i + 1, rows: 100, total_pages: 50 } } })))
    const tooMany = await rejects(liveDeploymentApi.listFarmerRows("1002"))
    check("listFarmerRows: beyond its bound the read fails explicitly — never part of a farmer shown as all of it", tooMany instanceof ApiError && /more than/.test(tooMany.message))
    // list rows: dispatch_id, action_required, err_msg and the (no longer sent) trailers_deployed, read defensively
    reset()
    respond(ok({ status: 200, message: "ok", data: { data: [
        { farmer_id: 1, deployment_num: 1, az_id: 1, dispatch_id: 11, action_required: true, err_msg: [" Video is missing. ", "", 7, "Picture is missing."], trailers_deployed: 4 },
        { farmer_id: 2, deployment_num: 1, az_id: 1, dispatch_id: "12", action_required: "false", err_msg: [], trailers_deployed: "3" },
        { farmer_id: 3, deployment_num: 1, az_id: 1, action_required: 1, err_msg: "Video is missing." },
        { farmer_id: 4, deployment_num: 1, az_id: 1, dispatch_id: null, action_required: "yes", trailers_deployed: null },
        { farmer_id: 5, deployment_num: 1, az_id: 1, dispatch_id: "n/a", action_required: 0, trailers_deployed: "n/a" },
        { farmer_id: 6, deployment_num: 1, az_id: 1, dispatch_id: 16, trailers_deployed: 0 },
    ], pagination: { total: 6, page: 1, rows: 20, total_pages: 1 } } }))
    const listed = (await fetchDeploymentMetadata({ page: 1, rows: 20 })).rows
    check("list rows: dispatch_id is a number (a digit string read as one); absent / null / junk → null", JSON.stringify(listed.map((r) => r.dispatch_id)) === JSON.stringify([11, 12, null, null, null, 16]), JSON.stringify(listed.map((r) => r.dispatch_id)))
    check("list rows: action_required true / false (also \"false\", 1, 0); absent or anything else → null — never assumed false", JSON.stringify(listed.map((r) => r.action_required)) === JSON.stringify([true, false, true, null, false, null]), JSON.stringify(listed.map((r) => r.action_required)))
    check("list rows: err_msg keeps the array's non-empty strings (trimmed); a non-array is null", JSON.stringify(listed[0].err_msg) === JSON.stringify(["Video is missing.", "Picture is missing."]) && listed[1].err_msg.length === 0 && listed[2].err_msg === null && listed[5].err_msg === null)
    check("list rows: trailers_deployed is a number when sent (4, \"3\" → 3, 0 stays 0) and null when absent / null / non-numeric — never undefined", JSON.stringify(listed.map((r) => r.trailers_deployed)) === JSON.stringify([4, 3, null, null, null, 0]), JSON.stringify(listed.map((r) => r.trailers_deployed)))
    reset()
    respond(ok({ status: 200, message: "ok", data: { data: "not-a-list" } }))
    const bad = await rejects(fetchDeploymentMetadata({ page: 1, rows: 20 }))
    check("an envelope without data[] / pagination is a contract error, not an empty table", bad instanceof ApiError && /unexpected response/.test(bad.message))
    reset()
    respond(ok({ status: 200, message: "ok", data: { all: 10, approved: 4, pending: 5, need_correction: 1 } }))
    const counts = await fetchDeploymentStatusCounts({})
    check("getDeploymentStatusCounts: the { all, approved, pending, need_correction } envelope", counts.all === 10 && counts.need_correction === 1)
    reset()
    respond(ok({ status: 200, message: "ok", data: { all: 10 } }))
    check("counts missing a key → contract error", (await rejects(fetchDeploymentStatusCounts({}))) instanceof ApiError)
    const q = mapTableQueryToV4({ page: 2, pageSize: 20, filters: { status: "Pending", farmer: ["1002"] }, sort: { field: "farmer", direction: "desc" } })
    check("query-mapper: tab + id filters + sort → the v4 body; counts carry the same filters without status / paging / sort", q.metadata.status === "pending" && q.metadata.page === 2 && q.metadata.rows === 20 && q.metadata.sort_by === "farmer_name" && q.metadata.sort_order === "desc" && q.metadata.farmer_ids[0] === 1002 && q.counts.farmer_ids[0] === 1002 && !("status" in q.counts) && !("page" in q.counts))
    let unsupported = null
    // V2.1: the table has no default sort (page.tsx: the API's own order) — a query without a sort sends none, on every tab and page
    const defaults = ["All", "Verified", "Pending", "Invalid"].flatMap((tab) => [1, 3].map((page) => mapTableQueryToV4({ page, pageSize: 20, filters: tab === "All" ? {} : { status: tab }, sort: null })))
    check("query-mapper: no sort chosen → no sort_by / sort_order in the list body on any tab or page (the API's own order); the counts carry none either", defaults.every((d) => !("sort_by" in d.metadata) && !("sort_order" in d.metadata) && !("sort_by" in d.counts) && !("sort_order" in d.counts)) && defaults.map((d) => d.metadata.status).join() === "all,all,approved,approved,pending,pending,need_correction,need_correction", defaults.map((d) => `${d.metadata.status}/${d.metadata.page}/${d.metadata.sort_by} ${d.metadata.sort_order}`).join(", "))
    // V2.1: the dispatch columns' ids are the contract's (dispatch-columns.tsx): each header sort maps to its v4 sort_by
    const COLUMN_SORT = { plots: "plots", area: "actual_area", calArea: "calculated_area", deployed: "deployed_amount", status: "status", verifiedBy: "verified_by" }
    check("query-mapper: the dispatch columns' header sorts map to the v4 sort_by (plots / actual_area / calculated_area / deployed_amount / status / verified_by)", Object.entries(COLUMN_SORT).every(([field, key]) => mapTableQueryToV4({ page: 1, pageSize: 20, filters: {}, sort: { field, direction: "asc" } }).metadata.sort_by === key))
    let noVerifiedOnSort = null
    try { mapTableQueryToV4({ page: 1, pageSize: 20, filters: {}, sort: { field: "verifiedOn", direction: "asc" } }) } catch (e) { noVerifiedOnSort = e }
    check("query-mapper: Verified On has no v4 sort key (its header offers Filter only)", noVerifiedOnSort instanceof UnsupportedQueryError)
    // V2.1: the header-menu capability matrix (column-capabilities.cjs — the browser suites render it) against the contract
    const { COLUMNS } = require("./column-capabilities.cjs")
    const { deploymentV2ApiContract: contract } = require(`${OUT}/api-contract.js`)
    const sortsAs = (id) => { try { return mapTableQueryToV4({ page: 1, pageSize: 20, filters: {}, sort: { field: id, direction: "asc" } }).metadata.sort_by ?? null } catch (e) { return e instanceof UnsupportedQueryError ? null : "error" } }
    const sortMismatch = COLUMNS.filter((c) => (c.sortBy !== null) !== contract.sort.includes(c.id) || sortsAs(c.id) !== c.sortBy)
    check("column matrix ↔ contract: a column offers Asc / Desc exactly when the contract sorts it, and the mapper sends its sort_by (others are refused, never sent)", sortMismatch.length === 0, JSON.stringify(sortMismatch.map((c) => [c.id, c.sortBy, sortsAs(c.id)])))
    const filterKeys = Object.keys(contract.filters).filter((k) => k !== "status")
    check("column matrix ↔ contract: every Filter opens a contract filter, and every contract filter but status (the tabs) has a column", COLUMNS.every((c) => c.filterKey === null || c.filterKey in contract.filters) && filterKeys.every((k) => COLUMNS.some((c) => c.filterKey === k)), `columns: ${COLUMNS.filter((c) => c.filterKey).map((c) => `${c.id}→${c.filterKey}`).join(", ")}`)
    check("column matrix: every column can be hidden (a frontend action, independent of the API)", COLUMNS.every((c) => c.hide === true))
    try { mapTableQueryToV4({ page: 1, pageSize: 20, search: "x", filters: {} }) } catch (e) { unsupported = e }
    check("query-mapper: what v4 can't express (free-text search) is refused loudly, not dropped", unsupported instanceof UnsupportedQueryError)
}

// ── Detail reads: NOC, history (404 = none), lookups (paged GET) ──────────────────────────────────
{
    reset()
    respond(ok({ status: 200, message: "ok", data: { get_trailer_result: [{ noc: [{ noc: "https://x.test/noc.jpg", az_id: "2", franchise_status: "pending" }] }], get_pre_sampling_details_result: [{ total_sample_codes: "3", status: ["approved"] }] } }))
    const noc = await liveDeploymentApi.getDeploymentNocDetails({ farmer_id: "1002", deployment_num: 1, az_ids: [2] })
    check("getDeploymentNocDetails: body { farmer_id, deployment_num, az_ids }; NOC docs and the pre-sampling summary normalised", JSON.stringify(last().body) === JSON.stringify({ farmer_id: "1002", deployment_num: 1, az_ids: [2] }) && noc.get_trailer_result[0].noc[0].az_id === 2 && noc.get_pre_sampling_details_result[0].total_sample_codes === 3)
    reset()
    respond({ status: 404, statusText: "Not Found", body: { message: "No data found" } })
    const none = await liveDeploymentApi.getFarmerReportedHistory({ farmer_id: "1002", deployment_num: 1, form_name: "Deployment", az_id: 2 })
    check("getFarmerReportedHistory: body with form_name 'Deployment' + az_id; the API's 404 'No data found' is an empty history, not an error", JSON.stringify(last().body) === JSON.stringify({ farmer_id: "1002", deployment_num: 1, form_name: "Deployment", az_id: 2 }) && none.reported_farmer_details_result.length === 0)
    reset()
    respond({ status: 404, statusText: "Not Found", body: { message: "route missing" } })
    check("…but another 404 is still an error", (await rejects(liveDeploymentApi.getFarmerReportedHistory({ farmer_id: "1002", deployment_num: 1, form_name: "Deployment" }))) instanceof ApiError)
    reset()
    respond(ok({ status_code: 200, data: { data: [{ id: 1, az_code: "AZ1", az_name: "Wheat" }], pagination: { page: 1, total_pages: 2 } } }), ok({ status_code: 200, data: { data: [{ id: 2, az_code: "AZ2", az_name: null }], pagination: { page: 2, total_pages: 2 } } }))
    const azs = await lookupApi.azs()
    const g = calls[0]
    check("lookups: GET with page / rows / search params, every page read, options from ids", g.method === "GET" && /\/adminFarmApp\/v4\/getAllAzData\?page=1&rows=500&search=$/.test(g.url) && azs.options.length === 2 && azs.options[0].value === "1" && azs.pagesLoaded === 2)
}

// ── The dispatch read: status omitted first, the production per-status reads as fallback ──────────
{
    const row = { farmer_id: 1002, deployment_num: 1, az_id: 2, az_code: "AZ2", status: "pending", trailers_deployed: 2, franchise_statuses: ["pending"] }
    const dispatch = (id, status) => ({ deployment_detail_id: id, dispatch_id: 1, az_id: 2, franchise_status: status, deployment_plots_data: [] })
    reset()
    respond(ok({ status: 200, message: "ok", data: [dispatch("A", "pending"), dispatch("B", "approved")] }))
    const all = await readRowDispatches(row)
    check("status omitted returns dispatches → one read, mode all-status, statuses as sent", calls.length === 1 && !("status" in calls[0].body.trailerDetails[0]) && all.mode === "all-status" && all.dispatches.map((d) => d.franchise_status).join() === "pending,approved")
    reset()
    respond(ok({ status: 200, message: "ok", data: [] }), ok({ status: 200, message: "ok", data: [dispatch("A", null)] }), ok({ status: 200, message: "ok", data: [dispatch("B", "approved")] }), ok({ status: 200, message: "ok", data: [] }))
    const fb = await readRowDispatches(row)
    check("status omitted returns nothing although the row states dispatches → the three per-status reads (status SENT), merged, mode per-status-fallback; a dispatch without a status keeps the one it was read with", calls.length === 4 && calls.slice(1).map((c) => c.body.trailerDetails[0].status).join() === "pending,approved,rejected" && fb.mode === "per-status-fallback" && fb.dispatches.map((d) => `${d.deployment_detail_id}:${d.franchise_status}`).join() === "A:pending,B:approved")
    reset()
    respond({ status: 400, statusText: "Bad Request", body: { message: "status is required" } }, ok({ status: 200, message: "ok", data: [dispatch("A", "pending")] }), ok({ status: 200, message: "ok", data: [] }), ok({ status: 200, message: "ok", data: [] }))
    const fb2 = await readRowDispatches(row)
    check("status omitted REJECTED by the backend → the per-status fallback answers; the preferred read's failure is a trace note only", fb2.mode === "per-status-fallback" && fb2.dispatches.length === 1)
    reset()
    respond(ok({ status: 200, message: "ok", data: [] }))
    const empty = await readRowDispatches({ ...row, trailers_deployed: 0, franchise_statuses: [] })
    check("a row the list says has no dispatches: the empty status-omitted read is accepted (no fallback reads)", calls.length === 1 && empty.dispatches.length === 0 && empty.mode === "all-status")
    reset()
    respond(new Error("socket hang up"), new Error("socket hang up"), new Error("socket hang up"), new Error("socket hang up"))
    const both = await rejects(readRowDispatches(row))
    check("when the fallback fails too, the read rejects with both reasons (no invented dispatches)", both instanceof Error && /socket hang up/.test(both.message) && /fallback also failed/.test(both.message))
    const notes = deploymentTrace.getSnapshot().filter((e) => e.method === "NOTE" && /reading per status/.test(e.label ?? ""))
    check("each fallback is recorded in the Inspector trace as a client NOTE naming the row (farmer / AZ ids only)", notes.length >= 2 && notes.every((n) => /farmer 1002 · AZ 2/.test(n.label)))
}

// ── Live mode never falls back to mock data ───────────────────────────────────────────────────────
{
    reset()
    respond(new Error("ECONNREFUSED"))
    const err = await rejects(deploymentApi.getTrailerDetails({ trailerDetails: [{ farmer_id: "1002", deployment_num: 1, status: "pending", az_id: [2] }] }))
    check("a network failure in live mode REJECTS (ApiError, status 0) — no mock dispatches are returned", err instanceof ApiError && err.status === 0 && /ECONNREFUSED/.test(err.message))
    reset()
    respond(new Error("ECONNREFUSED"))
    const listErr = await rejects(deploymentApi.listFarmerRows("1002"))
    check("…the same for the farmer-rows read", listErr instanceof ApiError && listErr.status === 0)
    globalThis.window.localStorage.getItem = () => null
    reset()
    const noToken = await rejects(deploymentApi.getDeploymentNocDetails({ farmer_id: "1002", deployment_num: 1, az_ids: [2] }))
    check("without any session the request is refused before fetch (401, nothing sent)", noToken instanceof ApiError && noToken.status === 401 && calls.length === 0)
    globalThis.window.localStorage.getItem = (key) => (key === "mati_dev_auth_token" ? TEST_TOKEN : null)
    reset()
    respond({ status: 401, statusText: "Unauthorized", body: { success: false, code: "invalid_token", message: `Wrong number of segments in token: ${TEST_TOKEN}` } })
    const echoed = await rejects(deploymentApi.getDeploymentNocDetails({ farmer_id: "1002", deployment_num: 1, az_ids: [2] }))
    check("a server that echoes the bearer token in its auth error never gets it into the ApiError (message / details / body) — it is scrubbed", echoed instanceof ApiError && echoed.status === 401 && !echoed.message.includes(TEST_TOKEN) && !(echoed.details ?? "").includes(TEST_TOKEN) && !JSON.stringify(echoed.body).includes(TEST_TOKEN) && /\[redacted token\]/.test(echoed.message))
}

// ── The Inspector trace of all the above ─────────────────────────────────────────────────────────
{
    const entries = deploymentTrace.getSnapshot()
    const dump = JSON.stringify(entries)
    check("every traced request is labelled live (never mock) with its real method and path", entries.filter((e) => e.method !== "NOTE").every((e) => e.source === "live" && e.path.startsWith("/admin")))
    check("reads and mutations are distinguished by kind", entries.some((e) => e.kind === "read" && e.path === DEPLOYMENT_ENDPOINTS.trailerDetails) && entries.some((e) => e.kind === "mutation" && e.path === DEPLOYMENT_ENDPOINTS.updateDispatch))
    check("failed calls are traced as errors with the status; successful ones as ok with their status", entries.some((e) => e.state === "error" && e.status === 500) && entries.some((e) => e.state === "ok" && e.status === 200))
    check("labels name what a call concerns (farmer / AZ / dispatch ids)", entries.some((e) => /Dispatches · farmer 1002 · round 1 · AZ 2 · all statuses/.test(e.label ?? "")) && entries.some((e) => /Approve dispatch DD-7/.test(e.label ?? "")))
    check("the trace never contains the bearer token, an Authorization header or a cookie", !dump.includes(TEST_TOKEN) && !/Authorization|Bearer|cookie/i.test(dump))
    check("phone-shaped verifier / surveyor ids are masked in traced bodies", !dump.includes("9000000001") && !dump.includes("9000000002") && /••••/.test(dump))
}

// ── V2.1 (live API audit): the table's live query — the tab's status to the server, the server's dispatch counts ──
{
    // A URL-keyed stub for this block (the list and counts requests run concurrently).
    const queued = globalThis.fetch
    const byPath = new Map()
    globalThis.fetch = async (url, init) => {
        calls.push({ url: String(url), method: init?.method, headers: init?.headers ?? {}, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
        const answer = [...byPath].find(([suffix]) => String(url).endsWith(suffix))?.[1]
        if (!answer) throw new Error("no stubbed response")
        const text = JSON.stringify(answer.body)
        return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, statusText: "", text: async () => text }
    }
    const listOf = (n) => ({ status: 200, body: { status: 200, message: "ok", data: { data: Array.from({ length: n }, (_, i) => ({ farmer_id: 1000 + i, deployment_num: 1, az_id: 1, dispatch_id: 500 + i, status: "need_correction", franchise_status: "rejected" })), pagination: { total: n, page: 1, rows: 20, total_pages: 1 } } } })
    reset()
    byPath.set("/getDeploymentMetadata", listOf(3))
    byPath.set("/getDeploymentStatusCounts", { status: 200, body: { status: 200, message: "ok", data: { all: 30, approved: 20, pending: 7, need_correction: 3 } } })
    const page = await liveDataSource.fetch({ page: 1, pageSize: 20, filters: { status: "Invalid" }, sort: null })
    const listBody = calls.find((c) => c.url.endsWith("/getDeploymentMetadata"))?.body
    const countsBody = calls.find((c) => c.url.endsWith("/getDeploymentStatusCounts"))?.body
    check("tab → server: Need Correction sends status 'need_correction' to getDeploymentMetadata (no client-side status filter)", listBody?.status === "need_correction" && listBody?.page === 1 && listBody?.rows === 20, JSON.stringify(listBody))
    check("counts: getDeploymentStatusCounts gets the same filters without status / paging, and its numbers ARE the tab counts", !!countsBody && !("status" in countsBody) && !("page" in countsBody) && JSON.stringify(page.summaryCounts) === JSON.stringify({ all: 30, verified: 20, pending: 7, invalid: 3 }), JSON.stringify(page.summaryCounts))
    check("rows: the server's dispatch rows, as many as it returned, with its total", page.rows.length === 3 && page.totalCount === 3 && page.rows[0].api.dispatch_id === 500)
    const statusOf = async (tab) => {
        calls.length = 0
        await liveDataSource.fetch({ page: 1, pageSize: 20, filters: tab ? { status: tab } : {}, sort: null })
        return calls.find((c) => c.url.endsWith("/getDeploymentMetadata"))?.body?.status
    }
    check("tab → server: Verified → approved, Pending → pending, All → all", (await statusOf("Verified")) === "approved" && (await statusOf("Pending")) === "pending" && (await statusOf(undefined)) === "all")
    reset()
    byPath.set("/getDeploymentStatusCounts", { status: 500, body: { message: "counts down" } })
    const noCounts = await liveDataSource.fetch({ page: 1, pageSize: 20, filters: { status: "Invalid" }, sort: null })
    check("counts read failed: the rows still load and every tab count is explicitly unavailable (NaN → '—'), never guessed or the previous query's", noCounts.rows.length === 3 && Object.values(noCounts.summaryCounts).every((n) => Number.isNaN(n)) && noCounts.summaryCounts === UNAVAILABLE_COUNTS)
    reset()
    byPath.set("/getDeploymentStatusCounts", { status: 200, body: { status: 200, message: "ok", data: { all: 30 } } })
    const partialCounts = await liveDataSource.fetch({ page: 1, pageSize: 20, filters: {}, sort: null })
    check("counts missing a key: unavailable as well (a contract error, not a partial set)", Object.values(partialCounts.summaryCounts).every((n) => Number.isNaN(n)))
    reset()
    byPath.set("/getDeploymentMetadata", { status: 500, body: { message: "list down" } })
    const listDown = await rejects(liveDataSource.fetch({ page: 1, pageSize: 20, filters: {}, sort: null }))
    check("list read failed: the page fails (Retry) — no rows are invented, live never falls back to mock", listDown instanceof ApiError)

    // V2.1: the API's order is kept — a deliberately unsorted response (Submitted on, Verified On, dispatch ids and
    // farmer names all out of order) comes back row for row, on each page, and through the table's row mapping
    const { toDispatchRows } = require(`${OUT}/dispatch-rows.js`)
    const DAY = 86_400_000, T0 = Date.UTC(2026, 8, 1)
    const unsortedPage = (page, specs) => ({ status: 200, body: { status: 200, message: "ok", data: { data: specs.map(([dispatchId, day, verifiedDay, name]) => ({ farmer_id: 2000 + dispatchId, farmer_name: name, deployment_num: 1, az_id: 1, dispatch_id: dispatchId, status: "approved", franchise_status: "approved", created_at: T0 + day * DAY, verified_at: T0 + verifiedDay * DAY })), pagination: { total: 8, page, rows: 4, total_pages: 2 } } } })
    const PAGE1 = [[731, 5, 9, "Meena"], [118, 1, 12, "Zubair"], [904, 7, 3, "Arjun"], [266, 2, 8, "Kavya"]]
    const PAGE2 = [[512, 6, 1, "Bhavna"], [77, 0, 11, "Ravi"], [845, 8, 4, "Deepak"], [390, 3, 10, "Sunita"]]
    const monotonic = (xs) => xs.every((x, i) => i === 0 || xs[i - 1] <= x) || xs.every((x, i) => i === 0 || xs[i - 1] >= x)
    const fixture = [...PAGE1, ...PAGE2]
    check("unsorted fixture: Submitted on, Verified On, dispatch ids and farmer names are each out of order, ascending and descending, within each page and across both", [0, 1, 2, 3].every((k) => !monotonic(fixture.map((s) => s[k])) && !monotonic(PAGE1.map((s) => s[k])) && !monotonic(PAGE2.map((s) => s[k]))))
    reset()
    byPath.set("/getDeploymentStatusCounts", { status: 200, body: { status: 200, message: "ok", data: { all: 8, approved: 8, pending: 0, need_correction: 0 } } })
    byPath.set("/getDeploymentMetadata", unsortedPage(1, PAGE1))
    const p1 = await liveDataSource.fetch({ page: 1, pageSize: 4, filters: { status: "Verified" }, sort: null })
    const p1Body = calls.find((c) => c.url.endsWith("/getDeploymentMetadata"))?.body
    byPath.set("/getDeploymentMetadata", unsortedPage(2, PAGE2))
    calls.length = 0
    const p2 = await liveDataSource.fetch({ page: 2, pageSize: 4, filters: { status: "Verified" }, sort: null })
    const p2Body = calls.find((c) => c.url.endsWith("/getDeploymentMetadata"))?.body
    const ids = (records) => records.map((r) => r.api.dispatch_id).join()
    check("unsorted API response: no sort is requested (no sort_by / sort_order on page 1 or 2)", !!p1Body && !!p2Body && !("sort_by" in p1Body) && !("sort_order" in p1Body) && !("sort_by" in p2Body) && !("sort_order" in p2Body), JSON.stringify({ p1Body, p2Body }))
    check("unsorted API response: each page's rows come back exactly in the API's order (page 1, page 2)", ids(p1.rows) === PAGE1.map((s) => s[0]).join() && ids(p2.rows) === PAGE2.map((s) => s[0]).join(), `${ids(p1.rows)} | ${ids(p2.rows)}`)
    const tableRows = toDispatchRows([...p1.rows, ...p2.rows])
    check("unsorted API response: the table's row mapping keeps that order (page 1 then page 2, row for row; Submitted on still out of order)", tableRows.map((r) => r.dispatchId).join() === fixture.map((s) => String(s[0])).join() && !monotonic(tableRows.map((r) => Number(r.record.api.created_at))), tableRows.map((r) => r.dispatchId).join())
    check("unsorted API response without a reported sort: none is shown (reportedSort null — nothing inferred from the rows)", p1.reportedSort === null && p2.reportedSort === null)

    // V2.1: the order the API REPORTS (PROPOSED pagination.sort_by / sort_order) is what the header shows — read as sent
    const { readReportedSort } = require(`${OUT}/reported-sort.js`)
    const rs = (sort_by, sort_order) => JSON.stringify(readReportedSort({ sort_by, sort_order }))
    check("reported sort: a known sort_by → its table column and direction (created_at desc → Submitted on, farmer_name asc → Farmer; order case-insensitive)", rs("created_at", "desc") === JSON.stringify({ columnId: "submittedOn", sortBy: "created_at", direction: "desc" }) && rs("farmer_name", "ASC") === JSON.stringify({ columnId: "farmer", sortBy: "farmer_name", direction: "asc" }))
    check("reported sort: absent, a sort_by without a table column (epoch_date), or a malformed order → none shown", readReportedSort(undefined) === null && readReportedSort({}) === null && rs("epoch_date", "desc") === "null" && rs("created_at", "newest") === "null" && rs(7, "asc") === "null")
    const withSort = (page, specs, sort_by, sort_order) => { const r = unsortedPage(page, specs); r.body.data.pagination = { ...r.body.data.pagination, sort_by, sort_order }; return r }
    reset()
    byPath.set("/getDeploymentMetadata", withSort(1, PAGE1, "created_at", "asc"))
    const reported = await liveDataSource.fetch({ page: 1, pageSize: 4, filters: { status: "Pending" }, sort: null })
    check("live: a page whose pagination reports sort_by created_at, sort_order asc carries reportedSort Submitted on, asc; its rows stay exactly as returned", JSON.stringify(reported.reportedSort) === JSON.stringify({ columnId: "submittedOn", sortBy: "created_at", direction: "asc" }) && ids(reported.rows) === PAGE1.map((s) => s[0]).join(), JSON.stringify(reported.reportedSort))
    globalThis.fetch = queued
}

console.log(failures ? `\n${passes} passed, ${failures} FAILED` : `\nALL PASS (${passes})`)
process.exit(failures ? 1 : 0)
