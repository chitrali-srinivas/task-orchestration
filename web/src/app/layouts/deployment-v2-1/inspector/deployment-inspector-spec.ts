// V2.1: DESIGN-TIME — the Deployment V2.1 Data / API Inspector content for the generic Inspector
// (src/components/data-inspector). Provenance on every claim: OBSERVED (matic-dash code, the dev API or the schema dump
// recorded in docs/deployment) · PROPOSED (this design) · MOCK (the prototype's mock backend) · OPEN (needs a decision).
// Runtime facts (requests, responses, mappings) are not here: they are the Inspector's "API activity" and "Data mapping"
// sections (deployment-inspector.tsx), built from what the page actually did.
import type { CoverageItem, InspectorSpec } from "@/components/data-inspector/inspector-spec"
import type { DeploymentMetadataRow } from "../data/schema"
import { DEPLOYMENT_ENDPOINTS } from "../data/live-api"

const pretty = (o: unknown) => JSON.stringify(o, null, 2)

function coverage(rows: readonly DeploymentMetadataRow[]): CoverageItem[] {
    const by = <K extends string | number>(key: (r: DeploymentMetadataRow) => K) => {
        const m = new Map<K, number>()
        for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
        return m
    }
    const status = by((r) => r.status)
    const az = by((r) => r.az_id)
    return [
        { label: "Pending rows", count: status.get("pending") ?? 0 },
        { label: "Need Correction rows", count: status.get("need_correction") ?? 0 },
        { label: "Verified rows", count: status.get("approved") ?? 0 },
        ...[...az.entries()].sort((a, b) => a[0] - b[0]).map(([id, n]) => ({ label: `AZ ${id} rows`, count: n })),
        { label: "Rows without a farmer name", count: rows.filter((r) => !r.farmer_name).length },
        { label: "Rows without created_at", count: rows.filter((r) => r.created_at === null || r.created_at === "").length },
    ]
}

export function buildDeploymentInspectorSpec({ live, rows }: { live: boolean; rows: readonly DeploymentMetadataRow[] }): InspectorSpec {
    return {
        feature: "Deployment V2.1",
        summary: "Verifiers review farmer deployments (one row per farmer + round + AZ), open the farmer's dispatches and plots on a map, and approve, report, comment, delete or redraw plot boundaries.",
        dataSource: live
            ? { label: "Live: the matic-dash dev API (NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE=live)", provenance: "observed" }
            : { label: "Mock: an in-memory backend with API-shaped rows (default mode)", provenance: "mock" },
        primaryEntity: "Deployment row (farmer + deployment_num + AZ)",
        relatedEntities: ["Trailer (AZ 1–3 grouping)", "Dispatch (deployment_detail_id)", "Plot deployment (deployment_id)", "NOC (per AZ)", "Report history", "Verifier session"],
        apiStatus: { label: "Existing matic-dash APIs: v4 list + counts, v3 detail reads and mutations", provenance: "observed" },
        dataFlow: {
            read: {
                caption: "Table and detail reads. The table's query is mapped to the v4 contract; the API's rows and counts are shown as sent (labels only).",
                nodes: [
                    { label: "Table query", detail: "tab · filters · sort · page" },
                    { label: "query-mapper.ts", detail: "→ v4 bodies (unsupported → explicit error)", provenance: "observed" },
                    { label: "getDeploymentMetadata + getDeploymentStatusCounts", provenance: "observed" },
                    { label: "adapter.ts", detail: "row → table record; counts → tabs" },
                    { label: "Detail: getTrailerDetails ×3 statuses, NOC, history", provenance: "observed" },
                    { label: "Dispatch cards · plot cards · map markers" },
                ],
            },
            write: {
                caption: "Every mutation uses matic-dash's payload (request-builders.ts), then re-reads the authoritative state.",
                nodes: [
                    { label: "Verifier action", detail: "approve · report · NOC · comment · delete · boundary" },
                    { label: "Gate", detail: "type allows it · permission · verifier phone · row / dispatch state" },
                    { label: "request-builders.ts", detail: "matic-dash payloads", provenance: "observed" },
                    { label: "Mutation API", provenance: "observed" },
                    { label: "Reconcile", detail: "row, table and counts re-read; nothing is faked" },
                ],
            },
            technical: [
                "Mock mode answers the same calls in memory; the Inspector's API activity labels them Mock and shows the v4 request live mode would send for each table page.",
                "Live mode (NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE=live + NEXT_PUBLIC_MATI_API_BASE_URL) sends the app's Firebase session token (valid only if this app's Firebase project is the Matic API's), else the dev token in this browser's localStorage (mati_dev_auth_token). The Inspector records the source name, never a token.",
            ],
        },
        domain: {
            caption: "What one table row opens: the farmer's dispatches for that round and AZ, grouped by trailer on AZ 1–3.",
            tree: {
                label: "Farmer",
                children: [{
                    label: "Deployment row",
                    detail: "farmer_id + deployment_num + az_id",
                    relation: "1 → many",
                    primary: true,
                    children: [
                        { label: "Trailer", detail: "AZ 1–3 grouping (trailer_no)", relation: "optional", children: [
                            { label: "Dispatch", detail: "deployment_detail_id · franchise_status", relation: "1 → many", children: [
                                { label: "Plot deployment", detail: "deployment_id · location · geometry · amount", relation: "1 → many" },
                            ] },
                        ] },
                        { label: "NOC", detail: "per AZ, with the pre-sampling summary", relation: "0 → 1" },
                        { label: "Report history", detail: "farmer_reported_details entries", relation: "0 → many" },
                    ],
                }],
            },
            entities: [
                { name: "DeploymentMetadataRow", provenance: "observed", description: "One table row = ONE DISPATCH (v4 getDeploymentMetadata; live API audit 2026-10-11).", primaryKey: "dispatch_id (group: farmer_id + deployment_num + az_id)", relationships: ["→ its deployment group's dispatch read (getTrailerDetails: plots, boundaries, media)"], fields: [
                    { name: "dispatch_id", type: "number", note: "the row key" },
                    { name: "franchise_status · status", type: "pending | approved | rejected · the same as the filter value (need_correction = rejected)", note: "the dispatch's own; never recalculated" },
                    { name: "created_at / verified_at", type: "epoch ms (number or digit string)", note: "per dispatch; verified_at null while pending" },
                    { name: "farmer_name", type: "string | null", note: "null on some dev rows" },
                    { name: "plots · calculated_area · deployed_amount · num_tons", type: "number (digit strings live)", note: "per dispatch" },
                    { name: "actual_area", type: "number (digit string live)", note: "the deployment's ENROLLED area, repeated on each of its dispatches" },
                    { name: "action_required · err_msg", type: "boolean · string[]", note: "per dispatch: the marker and messages" },
                ] },
                { name: "TrailerDispatchItem", provenance: "observed", description: "One dispatch with its plot deployments (v3 getTrailerDetails, one read per deployment group, status omitted).", primaryKey: "deployment_detail_id (dispatch_id joins it to its list row)", relationships: ["→ plot deployments"], fields: [
                    { name: "franchise_status", type: "pending | approved | rejected" },
                    { name: "action_required · err_msg · verified_at · verified_by", type: "per dispatch", note: "the card's validation and verification" },
                    { name: "source_name · num_tons · trailer_no", type: "AZ 1–3" },
                    { name: "deployment_plots_data", type: "TrailerDeploymentPlot[]" },
                ] },
                { name: "TrailerDeploymentPlot", provenance: "observed", description: "One plot deployment (a card and a map marker).", primaryKey: "deployment_id", relationships: ["← dispatch"], fields: [
                    { name: "location", type: "{ lat, lng } | null" },
                    { name: "geometry", type: "GeoJSON polygon | null", note: "the boundary" },
                    { name: "amt_plot_deploy / boost_amount_plot_applied", type: "number", note: "marker size" },
                ] },
            ],
        },
        apis: [
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.metadata, provenance: "observed", purpose: "Table rows (one page) — one per dispatch; the tab's status filters dispatches.", usedBy: "Table · detail (the farmer's rows, every page)", inputs: ["status", "farmer / village / AZ / surveyor / verifier ids", "date ranges (epoch ms)", "sort_by / sort_order (whitelist)", "page / rows"], returns: "{ data: { data: rows[], pagination } }", notes: ["No free-text search: the v4 contract has none."] },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.counts, provenance: "observed", purpose: "Tab counts (dispatches).", usedBy: "Tabs", inputs: ["the same filters, without status / page / sort"], returns: "{ all, approved, pending, need_correction }" },
            { method: "GET", path: `${DEPLOYMENT_ENDPOINTS.surveyors} (and farmers, villages, AZs, verifiers)`, provenance: "observed", purpose: "Filter options.", usedBy: "Filter sidebar (live mode)", inputs: ["page", "rows", "search"], returns: "paged lists", notes: ["Surveyor / verifier options need a usable phone (7+ digits): the filter value is the phone number."] },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.trailerDetails, provenance: "observed", purpose: "A deployment group's dispatches and plots.", usedBy: "Detail · the table's Boundaries column", inputs: ["farmer_id", "deployment_num", "az_id", "status omitted (per-status fallback)"], returns: "dispatches with deployment_plots_data" },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.nocDetails, provenance: "observed", purpose: "NOC and pre-sampling summary.", usedBy: "Detail summary · NOC review", inputs: ["farmer_id", "deployment_num", "az_ids [row AZ]"], returns: "NOC per AZ" },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.reportHistory, provenance: "observed", purpose: "Report history.", usedBy: "History dialog · reported-field markers", inputs: ["farmer_id", "deployment_num", "form_name \"Deployment\"", "az_id"], returns: "entries; HTTP 404 = none" },
            { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.updateDispatch, provenance: "observed", purpose: "Approve, or reject the reported dispatches.", usedBy: "Approve · Report (2nd call)", inputs: ["deployment_trailer_dispatch_data[]"], returns: "HTTP 200" },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.reportFarmerDetails, provenance: "observed", purpose: "The reported fields.", usedBy: "Report (1st call)", inputs: ["reportData[]", "farmerReportedData[]"], returns: "HTTP 200", notes: ["Known backend blocker: the dev backend returns HTTP 400 for the tested AZ 1–3 record while creating a quality_system_defects row. No frontend workaround."] },
            { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.nocDecision, provenance: "observed", purpose: "Qualify / report a NOC.", usedBy: "NOC review", inputs: ["farmer_id", "deployment_num", "az_id", "status", "verifier"], returns: "HTTP 200" },
            { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.comment, provenance: "observed", purpose: "A plot comment.", usedBy: "Comment dialog", inputs: ["section_type 2", "id", "comment", "az_id"], returns: "HTTP 200" },
            { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.softDelete, provenance: "observed", purpose: "Soft delete a dispatch or plot deployments.", usedBy: "Delete dialogs", inputs: ["deletedBy Dispatch | Deployment", "dispatch_id | deployment_ids", "comment"], returns: "HTTP 200" },
            { method: "POST", path: DEPLOYMENT_ENDPOINTS.uploadGeoJson, provenance: "observed", purpose: "Plot boundaries.", usedBy: "Boundary editor (Save all)", inputs: ["geoJsonData[]: deployment_id, farmerId, az_id, calculated_area, geoJson"], returns: "HTTP 200", request: pretty({ geoJsonData: [{ deployment_id: 0, farmerId: "…", az_id: 1, calculated_area: 0.123, geoJson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [["[lng, lat] … closed ring"]] } }] } }] }), notes: ["matic-dash's shape-file assignment sends several entries in one request (observed in its client code). Whether that is atomic, and per-entry results, are not known: V2.1 sends one plot per request so each plot's result is exact."] },
        ],
        uiMappings: [
            { action: "Switch tab / filter / sort / scroll", data: "table query", api: "getDeploymentMetadata + getDeploymentStatusCounts", result: "rows + counts (the next page appends)" },
            { action: "Open a row", data: "farmer_id, deployment_num, az_id", api: "getTrailerDetails ×3 · NOC · history", result: "dispatch cards, plot cards, markers" },
            { action: "Approve a dispatch", data: "the dispatch + verifier phone", api: "updateDeploymentTrailerDispatch", result: "row re-read; dispatch moves to Verified" },
            { action: "Report fields", data: "selected fields + reason", api: "reportFarmerDetails, then updateDeploymentTrailerDispatch", result: "dispatch rejected for correction; full server error on failure" },
            { action: "Save all boundaries", data: "each modified plot's outline + area", api: "uploadGeoJsonData, one plot per request", result: "per-plot saved / failed; the map shows saved outlines" },
        ],
        database: {
            caption: "Column names only, from the schema dump recorded in docs/deployment (types, NOT NULL and keys are not known).",
            relations: ["deployment_trailer_dispatch 1 → many deployment_plots", "a report writes farmer_reported_data + farmer_reported_details, and the backend also creates quality_system_defects"],
            tables: [
                { name: "deployment_trailer_dispatch", provenance: "observed", purpose: "Dispatches and their verification status.", columns: ["deployment_detail_id", "farmer_id", "deployment_num", "az_id", "franchise_status", "hq_status", "is_deleted", "…"] },
                { name: "deployment_plots", provenance: "observed", purpose: "Plot deployments, location, geometry and amounts.", columns: ["deployment_id", "plot_id", "amt_plot_deploy", "boost_amount_plot_applied", "is_deleted", "…"] },
                { name: "farmer_reported_data / farmer_reported_details", provenance: "observed", purpose: "Reported fields and their history.", columns: ["farmer_id", "deployment_num", "az_id", "repeater_form_id", "entry_no", "reason", "…"] },
                { name: "quality_system_defects", provenance: "observed", purpose: "Quality defects the backend creates from a report (HSE page).", columns: ["defect_section", "defect_type", "defect_status", "reported_by", "village_manager", "…"], note: "The report 400 is a constraint failure on this insert (backend)." },
            ],
        },
        mockData: {
            sources: [
                { label: "mock-data.ts", detail: "deterministic rows shaped like getDeploymentMetadata", provenance: "mock" },
                { label: "trailer-details-mock.ts", detail: "dispatches, plots, NOC and history per row", provenance: "mock" },
                { label: "mock-backend.ts", detail: "in-memory store; mutations change it and the table re-reads", provenance: "mock" },
            ],
            records: [{ label: "Rows", value: rows.length }, { label: "Mode", value: live ? "live (mock data unused)" : "mock" }],
            coverage: coverage(rows),
        },
        workflows: [
            {
                id: "report",
                title: "Report fields for correction",
                summary: "Two calls, as matic-dash; success only after both succeed.",
                steps: [
                    { label: "Select fields", detail: "dispatch / plot fields" },
                    { label: "Reason", detail: "required" },
                    { decision: "Any field resolves to a dispatch?", branches: [
                        { label: "No", steps: [{ label: "In-dialog message; nothing sent", tone: "warning" }] },
                        { label: "Yes", steps: [{ label: "reportFarmerDetails" }, { decision: "HTTP 200?", branches: [
                            { label: "No", steps: [{ label: "Dialog stays open with the full server error", tone: "danger" }] },
                            { label: "Yes", steps: [{ label: "updateDeploymentTrailerDispatch" }, { label: "Success, or \"Report partly saved\"", tone: "success" }] },
                        ] }] },
                    ] },
                ],
            },
            {
                id: "boundary",
                title: "Edit boundaries of several plots",
                summary: "One editing session; each plot keeps its edits while you move between plots; Save all writes the modified plots one by one.",
                steps: [
                    { label: "Open the editor from the plot card" },
                    { label: "Edit plot A, switch to plot B, …", detail: "edits are kept per plot" },
                    { decision: "Every modified outline valid?", branches: [
                        { label: "No", steps: [{ label: "Save all disabled; the plot list says which plot needs attention", tone: "warning" }] },
                        { label: "Yes", steps: [{ label: "Save all: one uploadGeoJsonData per plot" }, { label: "Saved / failed per plot; failed ones stay editable", tone: "success" }] },
                    ] },
                ],
            },
        ],
        rules: [
            { title: "Who may act", rules: [
                { text: "Actions need the edit permission and the verifier's phone (the verifier id every mutation sends); without a phone the detail is view only, with the reason.", provenance: "proposed" },
                { text: "AZ 6+ is display only: no approve, report, NOC decision, comment edit, boundary edit or delete.", provenance: "proposed" },
                { text: "AWD / Mati Boost keep V2's current actions until the product decision on their workflow (audit M1).", provenance: "open" },
            ] },
            { title: "What the screen never does", rules: [
                { text: "Never recalculates status: tabs and counts are the API's.", provenance: "observed" },
                { text: "Never shows success before the API answers HTTP 200.", provenance: "observed" },
                { text: "Pre-Sample opens only for AZ 1–3 (where pre-sampling exists).", provenance: "proposed" },
            ] },
        ],
        openQuestions: [
            { area: "Report", question: "Fix the quality_system_defects insert that fails reportFarmerDetails (HTTP 400).", context: "Backend; next iteration." },
            { area: "AWD / Mati Boost", question: "Adopt matic-dash's AWD / Mati Boost actions (approve body, 10-field report, plot-only delete, Tons / Litres) in the demo?", context: "Audit M1." },
            { area: "Payload value types", question: "Send deployment_num / farmer_id as strings (matic-dash) or numbers (demo)?", context: "Audit P6: numbers worked in the demo's Phase 3C report; matic-dash's existing flows send strings." },
            { area: "Boundaries", question: "Is a multi-entry uploadGeoJsonData atomic, and can it report per-entry results?", context: "Needed before Save all can use one request." },
        ],
    }
}
