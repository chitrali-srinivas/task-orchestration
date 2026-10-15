// DESIGN-TIME — the Samples Data / API Inspector content, as plain data for the generic Inspector
// (src/components/data-inspector). Live numbers come from the mock DB; everything else is what the Samples discovery
// established (docs/samples/samples-feature-discovery-and-design.md). Provenance on every claim:
// OBSERVED (matic-dash code / the CSV export) · PROPOSED (this design) · MOCK (demo data / mock backend) · OPEN.
import type { CoverageItem, InspectorSpec } from "@/components/data-inspector/inspector-spec"
import { maskPhone } from "../domain/labels"
import type { DbSample, MockDb } from "../data/mock/mock-db"

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null)
const pretty = (o: unknown) => JSON.stringify(o, null, 2)

/** A representative mock record (the selected sample when there is one). Phones masked, picture URL shortened. */
function exampleRecord(db: Readonly<MockDb>, sampleId: string | null): { title: string; json: string } {
    const s: DbSample | undefined = (sampleId ? db.samples.find((x) => x.id === sampleId) : undefined)
        ?? db.samples.find((x) => x.source === "demo" && x.kind === "control" && x.status === "pending" && !x.plot_id && x.lat !== null)
    if (!s) return { title: "No record", json: "{}" }
    const r = db.survey_responses.find((x) => x.id === s.survey_response_id)
    return {
        title: `${sampleId ? "The selected sample" : "A representative sample"} as the mock database stores it (source: ${s.source}). The API returns it enriched with bucket, blockers, plot and people — see API contract.`,
        json: pretty({
            id: s.id, sample_code: s.sample_code, source: s.source, kind: s.kind, purpose: s.purpose, status: s.status,
            survey_response_id: s.survey_response_id, farmer_id: r?.farmer_id ?? null, az_id: r?.az_id ?? null, surveyor_id: r?.surveyor_id ? maskPhone(r.surveyor_id) : null,
            lat: s.lat, lng: s.lng, picture_url: s.picture_url ? s.picture_url.split("?")[0] : null,
            plot_id: s.plot_id, generated_plot_id: s.generated_plot_id,
            collected_at: iso(s.collected_at), created_at: iso(s.created_at),
            verifier_id: s.verifier_id ? maskPhone(s.verifier_id) : null, verified_at: iso(s.verified_at), verifier_comment: s.verifier_comment, rejection_reason: s.rejection_reason,
            version: s.version,
        }),
    }
}

function coverage(db: Readonly<MockDb>): CoverageItem[] {
    const azsByFarmer = new Map<string, Set<number>>()
    for (const r of db.survey_responses) {
        if (!azsByFarmer.has(r.farmer_id)) azsByFarmer.set(r.farmer_id, new Set())
        azsByFarmer.get(r.farmer_id)!.add(r.az_id)
    }
    const multiAz = [...azsByFarmer.entries()].filter(([, azs]) => azs.size > 1)
    const count = (pred: (s: DbSample) => boolean) => db.samples.filter(pred).length
    return [
        { label: "Pending", count: count((s) => s.status === "pending") },
        { label: "Verified (approved)", count: count((s) => s.status === "approved") },
        { label: "Reported (rejected)", count: count((s) => s.status === "rejected") },
        { label: "Control samples", count: count((s) => s.kind === "control") },
        { label: "Deployment samples", count: count((s) => s.kind === "deployment"), example: "demo" },
        { label: "Farmers with several AZs", count: multiAz.length, example: multiAz.slice(0, 2).map(([f]) => f).join(", ") },
        { label: "Control sample needing a boundary", count: count((s) => s.kind === "control" && s.status === "pending" && !s.plot_id && !s.generated_plot_id && s.lat !== null) },
        { label: "Plot outlines", count: db.plot_geometries.length, example: "demo" },
        { label: "Boundary saved in this workflow", count: db.plots.filter((p) => p.origin === "generated").length },
        { label: "Missing picture", count: count((s) => !s.picture_url) },
        { label: "Missing GPS", count: count((s) => s.lat === null) },
        { label: "Corrected report in history", count: db.events.filter((e) => e.type === "corrected").length },
    ]
}

export function buildSamplesInspectorSpec(db: Readonly<MockDb>, selectedSampleId: string | null): Omit<InspectorSpec, "mockData"> & { mockData: Omit<InspectorSpec["mockData"], "extra"> } {
    const csv = db.samples.filter((s) => s.source === "csv").length
    const demo = db.samples.length - csv
    return {
        feature: "Samples",
        summary: "A verifier reviews deployment and control samples (one table row per sample), opens a sample in the context of its farmer — every AZ, every purpose — and approves it, reports fields for correction, or draws a control plot's boundary first.",
        dataSource: { label: "CSV export + demo records", provenance: "mock" },
        primaryEntity: "Sample",
        relatedEntities: ["Farmer", "AZ", "Plot", "Surveyor", "Verifier", "Report", "Event"],
        apiStatus: { label: "Proposed (no Samples API yet)", provenance: "proposed" },
        dataFlow: {
            read: {
                caption: "Two reads drive the screen: GET /samples for the table (one row per sample, counts per tab) and GET /farmers/{id}/samples for the detail. Components only know the SamplesApi interface — in matic-dash an HTTP client replaces the mock.",
                nodes: [
                    { label: "Samples UI", detail: "Table · farmer detail · map" },
                    { label: "Samples API", detail: "GET /samples · GET /farmers/{id}/samples", provenance: "proposed" },
                    { label: "Sample domain", detail: "Server computes status bucket, blockers, plot state", provenance: "proposed" },
                    { label: "Database", detail: "Today: CSV export + demo records", provenance: "mock" },
                ],
            },
            write: {
                caption: "Approve, Report, Save boundary and Comment all follow this path. The UI never decides a status — it sends the sample's version and an idempotency key, the server re-checks and answers.",
                nodes: [
                    { label: "User action", detail: "Approve · Report · Save boundary · Comment" },
                    { label: "UI check", detail: "Enabled only when the server allows; required inputs" },
                    { label: "API request", detail: "+ version + Idempotency-Key", provenance: "proposed" },
                    { label: "Server write", detail: "Re-check rules, one atomic write + history event", provenance: "proposed" },
                    { label: "Response", detail: "Updated sample, or a reason (409 / 422)" },
                    { label: "UI update", detail: "Refetch table + detail; tab counts move" },
                ],
            },
            technical: [
                "Seam: components → data/samples-api.ts (SamplesApi) → data/data-source.ts → mock/mock-samples-api.ts. Only data-source.ts changes at migration.",
                "Reads are abortable; a mutation bumps a data version that makes the table and the detail refetch (matic-dash: React Query invalidation).",
                "The table uses Deployment V2's infinite-pages wrapper over the page-based list contract (20 samples per page).",
                "The mock simulates 350 ms latency, one-shot failures (?mockFail=list|detail|boundary|approve|report) and a view-only session (?mockPermission=view).",
            ],
        },
        domain: {
            caption: "Sample is the entity. The farmer is the detail's context — one farmer can have samples in several AZs.",
            tree: {
                label: "Farmer",
                detail: "derived today — the export has no farmer column",
                children: [{
                    label: "AZ",
                    relation: "1 → many",
                    detail: "through the survey response",
                    children: [{
                        label: "Sample",
                        relation: "1 → many",
                        primary: true,
                        detail: "one physical sample",
                        children: [
                            { label: "Type · Purpose", detail: "control / deployment · pre, start, harvest, EOY, EO3Y, EO5Y" },
                            { label: "Status", detail: "pending / approved / rejected → shown as Pending / Verified / Need Correction" },
                            { label: "Plot", relation: "optional", detail: "survey / deployment plot, or created by a drawn boundary", children: [{ label: "Plot outline", relation: "optional", detail: "polygon, versioned" }] },
                            { label: "Surveyor", detail: "collected it" },
                            { label: "Verifier", relation: "optional", detail: "approved or reported it" },
                            { label: "Report · Events", relation: "0 → many", detail: "correction requests and history" },
                        ],
                    }],
                }],
            },
            entities: [
                {
                    name: "Sample", provenance: "observed", primaryKey: "sample_id",
                    description: "One physical sample a surveyor collected. The CSV export is this table; the API adds server-derived state.",
                    relationships: ["Farmer", "AZ", "Plot", "Surveyor", "Verifier", "Report", "Event"],
                    fields: [
                        { name: "sample_id", type: "uuid", note: "row identity" },
                        { name: "sample_code", type: "string | null", note: "shown as Sample ID" },
                        { name: "kind", type: "control | deployment", note: "CSV: type" },
                        { name: "purpose", type: "pre … eo5y" },
                        { name: "location", type: "{lat, lng} | null", note: "CSV: lat / long" },
                        { name: "picture_url", type: "url | null" },
                        { name: "collected_at · submitted_at", type: "epoch ms" },
                        { name: "status", type: "pending | approved | rejected", note: "changes only through approve / report" },
                        { name: "bucket", type: "pending | need_correction | approved", note: "PROPOSED · server-derived" },
                        { name: "approval", type: "{allowed, blockers[]}", note: "PROPOSED · server-derived" },
                        { name: "boundary_state · boundary_editable", type: "enum · boolean", note: "PROPOSED · server-derived" },
                        { name: "verified_by · verified_at", type: "Person · epoch ms", note: "null while pending" },
                        { name: "open_report", type: "{fields[], comment, by, at} | null" },
                        { name: "comment", type: "string | null", note: "never changes status" },
                        { name: "version", type: "int", note: "PROPOSED · optimistic concurrency" },
                    ],
                },
                {
                    name: "Farmer", provenance: "open", primaryKey: "farmer_id",
                    description: "The detail's context. The export has no farmer column: today farmers are derived from samples sharing a survey response or plot (F-0001 …).",
                    relationships: ["AZ (via survey response)", "Sample", "Plot"],
                    fields: [{ name: "farmer_id", type: "string" }, { name: "name · phone", type: "string | null", note: "not in the export (mock directory)" }, { name: "village", type: "{…} | null", note: "not in the export" }],
                },
                {
                    name: "AZ", provenance: "observed", primaryKey: "az_id",
                    description: "The programme zone a sample belongs to. Shown as two columns, AZ code and AZ name (Deployment V2).",
                    relationships: ["Sample", "Farmer"],
                    fields: [{ name: "az_id", type: "int" }, { name: "code", type: "string", note: "AZ1 …" }, { name: "name", type: "string | null", note: "not in the export" }],
                },
                {
                    name: "Plot", provenance: "proposed", primaryKey: "plot_id",
                    description: "Where a sample was taken. Deployment plots are read-only here; a control sample without one needs a boundary drawn before approval.",
                    relationships: ["Sample", "Plot outline", "Farmer"],
                    fields: [{ name: "plot_id", type: "string", note: "survey id, or generated (GP-…)" }, { name: "origin", type: "deployment | control_survey | generated" }, { name: "outline", type: "polygon | null", note: "versioned; none in the export" }, { name: "area_acres", type: "number", note: "server-computed" }],
                },
                {
                    name: "Report", provenance: "proposed", primaryKey: "report_id",
                    description: "A correction request: which fields are wrong and why. Replaces the free-text rejection_reason.",
                    relationships: ["Sample", "Verifier"],
                    fields: [{ name: "fields", type: "(sample_id | location | picture)[]" }, { name: "comment", type: "string", note: "required" }, { name: "state", type: "ongoing | completed" }, { name: "reported_by · reported_at", type: "Person · epoch ms" }],
                },
                {
                    name: "Person (surveyor / verifier)", provenance: "observed", primaryKey: "id",
                    description: "The export stores phone numbers as ids (the committed mock data uses synthetic placeholders). The UI masks them (****1234) and needs display names from a user lookup.",
                    relationships: ["Sample"],
                    fields: [{ name: "id", type: "string", note: "a phone number in the export" }, { name: "name", type: "string | null", note: "not in the export (mock directory)" }],
                },
            ],
        },
        apis: [
            {
                method: "GET", path: "/api/v1/samples", provenance: "proposed",
                purpose: "Table rows — one row per sample — plus the sample count for every tab.",
                usedBy: "Samples table, tabs, infinite scroll",
                inputs: ["bucket", "page", "page_size", "farmer_ids[]", "az_ids[]", "kinds[]", "purposes[]", "surveyor_ids[]", "verifier_ids[]", "boundary[]", "submitted_from/to", "sort_by", "sort_dir"],
                returns: "{ rows: Sample[], pagination, counts }",
                request: "GET /api/v1/samples?bucket=pending&page=1&page_size=20&kinds=control&sort_by=submitted&sort_dir=desc",
                response: pretty({ rows: [{ sample_id: "…", sample_code: "RXRK4Z", kind: "control", purpose: "eoy", bucket: "pending", farmer: { id: "F-0073", name: "…" }, az: { id: 2, code: "AZ2", name: "Rice" }, plot: null, boundary_state: "boundary_required", verified_by: null }], pagination: { page: 1, page_size: 20, total: 1996, total_pages: 100 }, counts: { all: 2218, approved: 52, pending: 1996, need_correction: 170, farmers: 1304 } }),
                notes: ["No text search (as Deployment V2); filters send ids.", "Counts are samples for the same filters; `farmers` is the detail's Previous / Next total.", "Stable tie-break on sample_id so pages never overlap."],
            },
            {
                method: "GET", path: "/api/v1/farmers/{farmer_id}/samples", provenance: "proposed",
                purpose: "The detail: every sample of one farmer across their AZs, with plots and counts.",
                usedBy: "Detail sheet, map, Previous / Next farmer",
                inputs: ["farmer_id"],
                returns: "{ farmer, azs[], samples[], plots[], sample_counts, purpose_counts[] }",
                response: pretty({ farmer: { id: "F-0073", name: "…", village: null }, azs: [{ id: 1, code: "AZ1" }, { id: 2, code: "AZ2" }, { id: 3, code: "AZ3" }], samples: ["Sample …"], plots: [{ plot_id: "…", origin: "deployment", outline: "[…]", area_acres: 1.6 }], sample_counts: { pending: 31, need_correction: 2, approved: 3 }, purpose_counts: [{ kind: "control", purpose: "eoy", count: 7 }] }),
                notes: ["Bucket, blockers and boundary_editable are computed by the server; the UI only renders them.", "The status dropdown filters these samples locally."],
            },
            {
                method: "GET", path: "/api/v1/farmers/{farmer_id}/sample-events", provenance: "proposed",
                purpose: "History events of the farmer's samples, newest first; each card's history dialog shows its own sample's events.",
                usedBy: "Sample card → history icon (shown when the sample has been reported)",
                inputs: ["farmer_id"],
                returns: "SampleEvent[]",
                response: pretty([{ type: "reported", sample_code: "CSKPUJ", at: 1759300000000, actor: { id: "****4250" }, summary: "Reported — location invalid", report_state: "ongoing", report_fields: ["location"] }]),
            },
            {
                method: "GET", path: "/api/v1/samples/filter-options", provenance: "proposed",
                purpose: "Lists for the filter sheet.",
                usedBy: "Filter sheet",
                inputs: [],
                returns: "{ farmers[], villages[], azs[], surveyors[], verifiers[] }",
            },
            {
                method: "POST", path: "/api/v1/samples:approve", provenance: "proposed",
                purpose: "Approve a sample (one at a time from the UI, as Deployment V2).",
                usedBy: "Card → Approve → confirm dialog",
                inputs: ["sample_ids[]", "versions{}", "Idempotency-Key"],
                returns: "{ results: [{ sample_id, ok, error? }] }",
                request: pretty({ sample_ids: ["…"], versions: { "…": 3 } }),
                response: pretty({ results: [{ sample_id: "…", ok: false, error: "Draw and save the plot boundary before approving this sample." }] }),
                notes: ["Blockers are re-checked server-side; a stale version is refused.", "Matic approves deployment samples per AZ and control samples per sample — per-sample is an open question."],
            },
            {
                method: "POST", path: "/api/v1/samples/{sample_id}/reports", provenance: "proposed",
                purpose: "Report fields for correction — the sample moves to Need Correction.",
                usedBy: "Card report mode → Report Selected (n) → dialog",
                inputs: ["fields[]", "comment", "version", "Idempotency-Key"],
                returns: "Sample (status rejected, open_report)",
                request: pretty({ fields: ["location"], comment: "GPS point sits outside the deployment plot.", version: 2 }),
                response: pretty({ sample_id: "…", status: "rejected", bucket: "need_correction", open_report: { fields: ["location"], comment: "GPS point sits outside the deployment plot." } }),
                notes: ["Fields come from matic-dash's reportFarmerDetails (sample_id, location) plus picture (CSV 'wrong picture') — picture is an open question.", "One atomic write; Matic sends report + reject as two calls today."],
            },
            {
                method: "PUT", path: "/api/v1/samples/{sample_id}/plot-boundary", provenance: "proposed",
                purpose: "Save a control sample's plot boundary: creates the plot and assigns it.",
                usedBy: "Boundary editor → Save",
                inputs: ["geometry (GeoJSON Polygon)", "version", "Idempotency-Key"],
                returns: "{ plot, assigned_sample_ids[] }",
                request: pretty({ geometry: { type: "Polygon", coordinates: [[[79.571, 22.1], [79.572, 22.1], [79.572, 22.101], [79.571, 22.101], [79.571, 22.1]]] }, version: 1 }),
                response: pretty({ plot: { plot_id: "GP-00501", origin: "generated", area_acres: 1.94 }, assigned_sample_ids: ["…", "…"] }),
                notes: ["422 with a human reason when the shape is invalid; 409 when the version is stale.", "No matic-dash endpoint creates a plot or generates a plot id today."],
            },
            {
                method: "PATCH", path: "/api/v1/samples/{sample_id}", provenance: "proposed",
                purpose: "Save the verifier's note on a sample (never changes status).",
                usedBy: "Card → Comment",
                inputs: ["comment"],
                returns: "Sample",
            },
        ],
        uiMappings: [
            { action: "Open the page / switch tab / filter", data: "tab, filters, page", api: "GET /samples", result: "Table rows + tab counts" },
            { action: "Open a sample", data: "its farmer id", api: "GET /farmers/{id}/samples", result: "Detail: AZ groups, cards, map" },
            { action: "Previous / Next farmer", data: "next farmer in the table", api: "GET /farmers/{id}/samples", result: "Another farmer's detail" },
            { action: "Open a sample's history", data: "sample (card icon)", api: "GET /farmers/{id}/sample-events", result: "That sample's history" },
            { action: "Approve", data: "sample id + version", api: "POST /samples:approve", result: "Verified; counts move" },
            { action: "Report", data: "fields + comment + version", api: "POST /samples/{id}/reports", result: "Need Correction" },
            { action: "Save boundary", data: "polygon + version", api: "PUT /samples/{id}/plot-boundary", result: "Plot assigned; Approve unlocks" },
            { action: "Comment", data: "text", api: "PATCH /samples/{id}", result: "Note saved" },
        ],
        database: {
            caption: "What exists today versus what this design proposes. The API's response shapes are read models, not tables.",
            relations: [
                "sample.survey_response_id → survey_response.id",
                "survey_response.farmer_id → farmer.id",
                "sample.plot_id → plot.plot_id",
                "plot_geometry.plot_id → plot.plot_id",
                "sample_report.sample_id → sample.sample_id",
                "sample_event.sample_id → sample.sample_id",
            ],
            tables: [
                { name: "samples (export)", provenance: "observed", purpose: "The control-sample table the CSV was exported from; Matic's control approve / reject writes it.", columns: ["id", "sample_code", "picture", "created_at", "updated_at", "surveyor_id", "generated_plot_id", "base_id", "collection_timestamp", "survey_response_id", "type", "purpose", "repeater_form_id", "repeater_form_index", "status", "verifier_id", "verifier_comment", "rejection_reason", "plot_id", "lat", "long", "hq_verifier_id", "hq_rejected_reason", "hq_comment", "hq_status", "az_id"], note: "Real table name unknown. No farmer column. generated_plot_id is null in every row." },
                { name: "sampling_details, start_sample_details, …", provenance: "observed", purpose: "Deployment samples appear to live in per-purpose tables (names only, from matic-dash).", columns: ["(not visible from the frontend)"] },
                { name: "sample", provenance: "proposed", purpose: "Keep the existing table; add farmer_id and version; one plot_id FK.", columns: ["sample_id", "farmer_id", "az_id", "kind", "purpose", "status", "plot_id", "lat", "lng", "picture_url", "collected_at", "verifier_id", "verified_at", "comment", "version"] },
                { name: "plot", provenance: "proposed", purpose: "Survey, deployment and generated plots.", columns: ["plot_id", "farmer_id", "az_id", "origin", "deployment_id", "created_by", "created_at"] },
                { name: "plot_geometry", provenance: "proposed", purpose: "Versioned outline with a server-computed area.", columns: ["plot_id", "version", "geometry (Polygon, SRID 4326)", "area_acres", "updated_by", "updated_at"] },
                { name: "sample_report", provenance: "proposed", purpose: "Structured correction requests.", columns: ["id", "sample_id", "fields[]", "comment", "reported_by", "reported_at", "state", "closed_at"] },
                { name: "sample_event", provenance: "proposed", purpose: "Append-only history.", columns: ["id", "sample_id", "type", "at", "actor_id", "payload"] },
            ],
        },
        mockData: {
            sources: [
                { label: db.source.file, detail: `${db.source.row_count.toLocaleString("en-IN")} rows of the real export, imported unchanged (${db.source.dropped_rows} row without a type dropped). Phone-number ids and token-bearing photo URLs are replaced with placeholders at import.`, provenance: "observed" },
                { label: db.source.demo.file, detail: `${demo} records cloned from real farmers to show what the export can't: deployment samples, several AZs per farmer, outlines, a saved boundary.`, provenance: "mock" },
                { label: "Name directory", detail: db.source.directory ? "Generated names for people, farmers and AZs (the export has none). Add ?mockNames=off to see the raw ids." : "Off (?mockNames=off): ids and roles as exported.", provenance: "mock" },
            ],
            records: [
                { label: "Samples", value: db.samples.length },
                { label: "From CSV", value: csv },
                { label: "Demo", value: demo },
                { label: "Farmers", value: db.farmers.length },
                { label: "Plots", value: db.plots.length },
                { label: "Reports", value: db.reports.length },
            ],
            coverage: coverage(db),
            example: exampleRecord(db, selectedSampleId),
        },
        workflows: [
            {
                id: "approval",
                title: "Approval",
                summary: "A pending sample is approved one at a time. A control sample without a plot needs its boundary first.",
                steps: [
                    { label: "Pending sample", detail: "opened in its farmer's detail" },
                    { label: "Server checks", detail: "photo, GPS, sample code, collection date" },
                    {
                        decision: "Boundary required?",
                        branches: [
                            { label: "Yes — control sample, no plot", steps: [{ label: "Draw boundary", tone: "warning" }, { label: "Save", detail: "server validates the shape" }, { label: "Plot created + assigned", detail: "to every such sample inside it" }] },
                            { label: "No", steps: [{ label: "Approve available" }] },
                        ],
                    },
                    { label: "Approve", detail: "confirm dialog", tone: "action" },
                    { label: "Verified", detail: "verified by / on recorded", tone: "success" },
                ],
                technical: [
                    "A failed check moves the sample to Need Correction instead (it can only be reported).",
                    "PUT /samples/{id}/plot-boundary → POST /samples:approve, both with the sample's version and an Idempotency-Key.",
                    "Deployment samples use their deployment's plot and never need a boundary here.",
                ],
            },
            {
                id: "report",
                title: "Reporting",
                summary: "Deployment V2's flow: pick what is wrong on the card, then explain it.",
                steps: [
                    { label: "Pending sample", detail: "expanded card" },
                    { label: "Report", detail: "the card enters report mode", tone: "action" },
                    { label: "Select fields", detail: "Sample ID · GPS Coordinates · Sample Picture" },
                    { label: "Report Selected (n)" },
                    { label: "Add a comment", detail: "required" },
                    { label: "Submit" },
                    { label: "Need Correction", detail: "open report shown on the card", tone: "danger" },
                    { label: "Surveyor corrects", detail: "back to Pending (open question)" },
                ],
                technical: ["POST /samples/{id}/reports { fields, comment, version } — one atomic write: status rejected + open report + history event."],
            },
        ],
        rules: [
            {
                title: "Approval",
                rules: [
                    { text: "Only a pending sample can be approved.", provenance: "observed" },
                    { text: "A control sample without a plot needs a saved boundary first.", provenance: "proposed" },
                    { text: "A sample failing a blocking check (photo, GPS, code, date) can't be approved.", provenance: "proposed" },
                    { text: "Which checks block approval.", provenance: "open" },
                    { text: "The verifier needs the sample-verification permission (key undecided).", provenance: "open" },
                    { text: "The request must carry the version the verifier saw.", provenance: "proposed" },
                ],
            },
            {
                title: "Reporting",
                rules: [
                    { text: "Only a pending sample can be reported.", provenance: "proposed" },
                    { text: "At least one field: Sample ID or GPS Coordinates.", provenance: "observed" },
                    { text: "Sample Picture as a reportable field.", provenance: "open" },
                    { text: "A comment is required.", provenance: "proposed" },
                ],
            },
            {
                title: "Boundary",
                rules: [
                    { text: "Only pending control samples with GPS get a boundary; deployment plots are read-only.", provenance: "proposed" },
                    { text: "The boundary must contain the sample's GPS point.", provenance: "observed" },
                    { text: "At least 3 points; edges must not cross; no overlap with the farmer's other plots.", provenance: "proposed" },
                    { text: "Area limits (mock: 0.02–25 acres) and the plot id format.", provenance: "open" },
                ],
            },
            {
                title: "Status",
                rules: [
                    { text: "Status is the backend's: pending / approved / rejected.", provenance: "observed" },
                    { text: "The tab (Pending · Verified · Need Correction) is computed by the server, never the UI.", provenance: "proposed" },
                    { text: "A comment never changes status.", provenance: "proposed" },
                ],
            },
        ],
        openQuestions: [
            { area: "Data", question: "Which table links a sample to its farmer?", context: "The export has no farmer column; the prototype derives farmers from shared survey responses / plots." },
            { area: "Data", question: "Where do farmer names, villages, AZ names and people names come from?", context: "The export has ids (phone numbers for people) only." },
            { area: "Data", question: "Will deployment samples join this table (type = deployment)?" },
            { area: "API", question: "Which endpoint creates a plot and generates its id?", context: "None in matic-dash; generated_plot_id is null in every exported row." },
            { area: "Rules", question: "Which validation checks block approval?", context: "Matic only returns free-text err_msg." },
            { area: "Rules", question: "Is a boundary required for every control purpose?", context: "16 approved rows in the export have no plot." },
            { area: "Rules", question: "Can Sample Picture be reported?", context: "matic-dash reports sample_id and location only; the export has 'wrong picture' rejections." },
            { area: "Rules", question: "Boundary limits: area range, overlap policy, GPS tolerance." },
            { area: "Workflow", question: "How does a corrected sample return to Pending?" },
            { area: "Workflow", question: "Per-sample approval for deployment samples (Matic approves them per AZ)?" },
            { area: "Access", question: "Which permission key gates sample verification?" },
            { area: "Data", question: "What are the hq_* fields for?", context: "A separate HQ review track; no Matic sample screen uses it." },
        ],
    }
}
