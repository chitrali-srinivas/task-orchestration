// PROTOTYPE-ONLY — the Samples mock database: normalized tables, as a backend would persist them (NOT the UI shape).
// The mock API (mock-samples-api.ts) is the only reader / writer; components never touch these arrays.
//
// Two inputs, kept apart on disk and marked on every record (`source`):
//   csv   the backend's sample export, imported by scripts/import-samples-csv.mjs into csv/samples-db.json
//         (2,188 control samples, every CSV column kept, one derived column `farmer_key`). Nothing in it is invented.
//   demo  csv/samples-demo.json, built by scripts/build-samples-demo.mjs FROM those rows: a few dozen records cloned
//         from real farmers (same surveyor, base, neighbourhood) with only the fields a use case needs changed —
//         deployment samples, farmers across 2–3 AZs, verified / rejected samples by the CSV's own verifiers, plot
//         outlines, a saved boundary, missing pictures / GPS, comments, corrected-report history. The export has no
//         names (phone numbers are the people ids), so a MOCK directory supplies them; `?mockNames=off` shows the
//         export as it is. The Inspector shows all of this provenance.
// Privacy: the import replaces the export's phone-number ids with synthetic placeholders and its Firebase photo URLs
// (which carry access tokens) with bundled demo images — neither reaches the repository (`source.sanitized`).
import csvDb from "./csv/samples-db.json"
import demoDb from "./csv/samples-demo.json"
import { ringAreaAcres, type LatLng } from "../../domain/geometry"
import type { HqStatus, ReportableField, SampleKind, SamplePurpose, VerificationStatus } from "../../domain/types"

// ── Tables ──────────────────────────────────────────────────────────────────────────────────────────

export type RecordSource = "csv" | "demo"
export interface DbVillage { id: string; name: string; block: string | null; district: string | null; state: string | null; center: LatLng }
export interface DbAz { id: number; code: string; name: string | null }
export interface DbPerson { id: string; name: string | null; role: "surveyor" | "verifier"; phone: string | null }
export interface DbFarmer { id: string; name: string | null; phone: string | null; village_id: string | null; derived: boolean; source: RecordSource }
export interface DbPlot {
    plot_id: string
    farmer_id: string
    az_id: number
    origin: "deployment" | "control_survey" | "generated"
    deployment_id: string | null
    created_by: string | null
    created_at: number
}
/** Plot geometry, versioned separately from the plot. The CSV export has none: demo outlines and saved boundaries only. */
export interface DbPlotGeometry { plot_id: string; ring: LatLng[]; area_acres: number; version: number; updated_by: string | null; updated_at: number }
/** The survey submission a sample came from (CSV survey_response_id; one purpose per response — observed). */
export interface DbSurveyResponse {
    id: string
    farmer_id: string
    az_id: number
    kind: SampleKind
    purpose: SamplePurpose
    surveyor_id: string | null
    submitted_at: number
}
export interface DbSample {
    id: string
    sample_code: string | null
    kind: SampleKind
    purpose: SamplePurpose
    survey_response_id: string
    entry_no: number | null
    lat: number | null
    lng: number | null
    picture_url: string | null
    collected_at: number | null
    created_at: number
    updated_at: number
    /** Plot from the survey / deployment (CSV plot_id). */
    plot_id: string | null
    /** Plot generated when a verifier saved a boundary (CSV generated_plot_id — null in every CSV row). */
    generated_plot_id: string | null
    status: VerificationStatus
    verifier_id: string | null
    verifier_comment: string | null
    verified_at: number | null
    /** Free-text reason as the CSV stores it; the report table holds the structured report. */
    rejection_reason: string | null
    hq_status: HqStatus | null
    comment: string | null
    base_id: number | null
    version: number
    source: RecordSource
}
export interface DbReport {
    id: string
    sample_id: string
    fields: ReportableField[]
    comment: string
    reported_by: string
    reported_at: number
    state: "ongoing" | "completed"
    closed_at: number | null
}
export interface DbEvent {
    id: string
    sample_id: string
    type: "collected" | "reported" | "corrected" | "approved" | "boundary_saved" | "boundary_updated" | "comment_updated"
    at: number
    actor_id: string | null
    summary: string
    report_id?: string
}

export interface MockDb {
    /** Provenance of the imported rows (Inspector). */
    source: {
        file: string
        generated_at: string
        row_count: number
        dropped_rows: number
        derived_columns: Record<string, string>
        not_in_source: string[]
        /** What the import replaced so nothing personal or secret is committed. */
        sanitized: { people: string; pictures: string }
        /** The derived demo records: how many, how they were made, what they cover. */
        demo: { file: string; generated_at: string; rules: string[]; counts: DemoDb["counts"]; coverage: DemoDb["coverage"] }
        /** Whether the mock name directory is applied (null with ?mockNames=off). */
        directory: string | null
    }
    villages: DbVillage[]
    azs: DbAz[]
    people: DbPerson[]
    farmers: DbFarmer[]
    plots: DbPlot[]
    plot_geometries: DbPlotGeometry[]
    survey_responses: DbSurveyResponse[]
    samples: DbSample[]
    reports: DbReport[]
    events: DbEvent[]
}

export interface CsvRow {
    id: string
    sample_code: string | null
    picture: string | null
    created_at: number | null
    updated_at: number | null
    surveyor_id: string | null
    generated_plot_id: string | null
    base_id: number | null
    collection_timestamp: number | null
    survey_response_id: string | null
    type: string | null
    purpose: string | null
    repeater_form_index: number | null
    status: string | null
    verifier_id: string | null
    verifier_comment: string | null
    rejection_reason: string | null
    plot_id: string | null
    lat: number | null
    long: number | null
    hq_verifier_id: string | null
    hq_rejected_reason: string | null
    hq_comment: string | null
    hq_status: string | null
    az_id: number | null
    farmer_key: string
}
/** A demo row: a CSV-shaped row cloned from a real one, plus what the case adds. */
interface DemoRow extends CsvRow {
    derived_from: string
    comment: string | null
    prior_report: { fields: ReportableField[]; comment: string; reported_at: number; corrected_at: number } | null
}
interface DemoDb {
    generated_at: string
    base: string
    seed: number
    rules: string[]
    counts: { demo_samples: number; demo_responses: number; demo_plots: number; geometries: number; overrides: number; farmers_touched: string[] }
    directory: { kind: string; note: string; people: Record<string, string>; farmers: Record<string, string>; azs: Record<string, string> }
    plots: { plot_id: string; farmer_key: string; az_id: number; origin: DbPlot["origin"]; deployment_id: string | null; created_by: string | null; created_at: number | null }[]
    geometries: { plot_id: string; ring: [number, number][]; created_by: string | null; created_at: number | null; note: string }[]
    overrides: { id: string; generated_plot_id: string }[]
    rows: DemoRow[]
    coverage: [string, number | string, string | string[]][]
}
const demo = demoDb as unknown as DemoDb

export const MOCK_VERIFIER_ID = "u-ver-0"
/** The mock's "now" — fixed so every load is identical (the demo rows end on 2026-10-03). */
export const MOCK_NOW = Date.UTC(2026, 9, 6, 9, 30)
/** OBSERVED in the CSV: 2 rows saved the phone's file path ("/data/user/0/earth.mati.farmer/…") instead of an upload. */
export const isDevicePath = (url: string | null) => !!url && /^(\/data\/|\/storage\/|\/sdcard|file:|content:|[A-Za-z]:\\)/.test(url)
/** `?mockNames=off` shows the export as it is: ids and roles instead of the mock directory's names. */
const namesOn = () => typeof window === "undefined" || new URLSearchParams(window.location.search).get("mockNames") !== "off"

// ── Rows → tables ───────────────────────────────────────────────────────────────────────────────────

const PURPOSES = new Set<string>(["pre", "start", "harvest", "eoy", "eo3y", "eo5y"])
const STATUSES = new Set<string>(["pending", "approved", "rejected"])

/**
 * The CSV's free-text rejection_reason as the report fields Matic would name (OBSERVED reasons: "location invalid",
 * "wrong picture", "marking"; the rest are test strings → no field, the text stays as the comment).
 */
export function reasonToFields(reason: string | null): ReportableField[] {
    const r = (reason ?? "").toLowerCase()
    if (!r) return []
    if (r.includes("location")) return ["location"]
    if (r.includes("picture") || r.includes("photo")) return ["picture"]
    if (r.includes("marking")) return ["sample_id"]
    return []
}

interface ImportContext {
    azIds: Set<number>
    people: Map<string, DbPerson>
    farmers: Map<string, DbFarmer>
    responses: Map<string, DbSurveyResponse>
    plots: Map<string, DbPlot>
    seq: { report: number; event: number }
    event: (sampleId: string, type: DbEvent["type"], at: number, actor: string | null, summary: string, reportId?: string) => void
}

/** One importer for both inputs: a CSV row and a demo row have the same columns (a demo row adds comment / prior_report). */
function importRows(db: MockDb, ctx: ImportContext, rows: (CsvRow | DemoRow)[], source: RecordSource) {
    for (const r of rows) {
        if (!r.survey_response_id || !r.created_at) continue
        const kind: SampleKind = r.type === "deployment" ? "deployment" : "control"
        const purpose = (PURPOSES.has(r.purpose ?? "") ? r.purpose : "pre") as SamplePurpose
        const status = (STATUSES.has(r.status ?? "") ? r.status : "pending") as VerificationStatus
        const azId = r.az_id ?? 0
        ctx.azIds.add(azId)
        if (r.surveyor_id && !ctx.people.has(r.surveyor_id)) ctx.people.set(r.surveyor_id, { id: r.surveyor_id, name: null, role: "surveyor", phone: r.surveyor_id })
        for (const v of [r.verifier_id, r.hq_verifier_id]) if (v && !ctx.people.has(v)) ctx.people.set(v, { id: v, name: null, role: "verifier", phone: v })
        if (!ctx.farmers.has(r.farmer_key)) ctx.farmers.set(r.farmer_key, { id: r.farmer_key, name: null, phone: null, village_id: null, derived: true, source })
        const resp = ctx.responses.get(r.survey_response_id)
        if (!resp) ctx.responses.set(r.survey_response_id, { id: r.survey_response_id, farmer_id: r.farmer_key, az_id: azId, kind, purpose, surveyor_id: r.surveyor_id, submitted_at: r.created_at })
        else resp.submitted_at = Math.min(resp.submitted_at, r.created_at)
        if (r.plot_id && !ctx.plots.has(r.plot_id)) ctx.plots.set(r.plot_id, { plot_id: r.plot_id, farmer_id: r.farmer_key, az_id: azId, origin: "control_survey", deployment_id: null, created_by: null, created_at: r.created_at })
        const verifiedAt = status !== "pending" && r.verifier_id ? r.updated_at ?? r.created_at : null
        const extra = "derived_from" in r ? r : null
        db.samples.push({
            id: r.id,
            sample_code: r.sample_code,
            kind,
            purpose,
            survey_response_id: r.survey_response_id,
            entry_no: r.repeater_form_index,
            lat: r.lat,
            lng: r.long,
            picture_url: r.picture,
            collected_at: r.collection_timestamp,
            created_at: r.created_at,
            updated_at: r.updated_at ?? r.created_at,
            plot_id: r.plot_id,
            generated_plot_id: r.generated_plot_id,
            status,
            verifier_id: r.verifier_id,
            verifier_comment: r.verifier_comment,
            verified_at: verifiedAt,
            rejection_reason: r.rejection_reason,
            hq_status: (r.hq_status as HqStatus | null) ?? null,
            comment: extra?.comment ?? null,
            base_id: r.base_id,
            version: 1,
            source,
        })
        ctx.event(r.id, "collected", r.created_at, r.surveyor_id, "Sample collected and submitted")
        if (extra?.prior_report) {
            const pr = extra.prior_report
            const id = `rep-${source}-${String(++ctx.seq.report).padStart(4, "0")}`
            db.reports.push({ id, sample_id: r.id, fields: pr.fields, comment: pr.comment, reported_by: r.verifier_id ?? MOCK_VERIFIER_ID, reported_at: pr.reported_at, state: "completed", closed_at: pr.corrected_at })
            ctx.event(r.id, "reported", pr.reported_at, r.verifier_id ?? MOCK_VERIFIER_ID, `Reported — ${pr.comment}`, id)
            ctx.event(r.id, "corrected", pr.corrected_at, r.surveyor_id, "Correction resubmitted by the surveyor", id)
        }
        if (extra?.comment) ctx.event(r.id, "comment_updated", r.created_at + 3_600_000, MOCK_VERIFIER_ID, `Comment: ${extra.comment}`)
        if (status === "approved" && verifiedAt) ctx.event(r.id, "approved", verifiedAt, r.verifier_id, r.verifier_comment ? `Approved — ${r.verifier_comment}` : "Approved")
        if (status === "rejected" && r.verifier_id) {
            const id = `rep-${source}-${String(++ctx.seq.report).padStart(4, "0")}`
            const fields = reasonToFields(r.rejection_reason)
            const comment = r.rejection_reason ?? ""
            db.reports.push({ id, sample_id: r.id, fields, comment, reported_by: r.verifier_id, reported_at: verifiedAt ?? r.created_at, state: "ongoing", closed_at: null })
            ctx.event(r.id, "reported", verifiedAt ?? r.created_at, r.verifier_id, `Reported${comment ? ` — ${comment}` : ""}`, id)
        }
    }
}

/** The demo additions: plots (rows reference them), rows, outlines, the saved-boundary overrides, the name directory. */
function importDemo(db: MockDb, ctx: ImportContext) {
    for (const p of demo.plots) ctx.plots.set(p.plot_id, { plot_id: p.plot_id, farmer_id: p.farmer_key, az_id: p.az_id, origin: p.origin, deployment_id: p.deployment_id, created_by: p.created_by, created_at: p.created_at ?? MOCK_NOW })
    importRows(db, ctx, demo.rows, "demo")
    for (const g of demo.geometries) {
        const ring = g.ring.map(([lat, lng]) => ({ lat, lng }))
        db.plot_geometries.push({ plot_id: g.plot_id, ring, area_acres: Math.round(ringAreaAcres(ring) * 1000) / 1000, version: 1, updated_by: g.created_by, updated_at: g.created_at ?? MOCK_NOW })
    }
    for (const o of demo.overrides) {
        const s = db.samples.find((x) => x.id === o.id)
        if (!s) continue
        s.generated_plot_id = o.generated_plot_id
        const plot = ctx.plots.get(o.generated_plot_id)
        ctx.event(s.id, "boundary_saved", plot?.created_at ?? MOCK_NOW, plot?.created_by ?? null, `Boundary saved · plot ${o.generated_plot_id} created`)
    }
    const names = namesOn()
    if (names) {
        for (const p of ctx.people.values()) p.name = demo.directory.people[p.id] ?? p.name
        for (const f of ctx.farmers.values()) f.name = demo.directory.farmers[f.id] ?? f.name
    }
    db.source.directory = names ? demo.directory.kind : null
}

export function createMockDb(): MockDb {
    const db: MockDb = {
        source: {
            file: csvDb.source,
            generated_at: csvDb.generated_at,
            row_count: csvDb.row_count,
            dropped_rows: csvDb.dropped_rows,
            derived_columns: csvDb.derived_columns,
            not_in_source: csvDb.not_in_source,
            sanitized: csvDb.sanitized,
            demo: { file: "samples-demo.json", generated_at: demo.generated_at, rules: demo.rules, counts: demo.counts, coverage: demo.coverage },
            directory: null,
        },
        villages: [], azs: [], people: [], farmers: [], plots: [], plot_geometries: [], survey_responses: [], samples: [], reports: [], events: [],
    }
    const ctx: ImportContext = {
        azIds: new Set(),
        people: new Map(),
        farmers: new Map(),
        responses: new Map(),
        plots: new Map(),
        seq: { report: 0, event: 0 },
        event: (sampleId, type, at, actor, summary, reportId) =>
            db.events.push({ id: `ev-${String(++ctx.seq.event).padStart(5, "0")}`, sample_id: sampleId, type, at, actor_id: actor, summary, report_id: reportId }),
    }
    importRows(db, ctx, csvDb.rows as CsvRow[], "csv")
    importDemo(db, ctx)
    // the session user (a verifier) — not in the export
    ctx.people.set(MOCK_VERIFIER_ID, { id: MOCK_VERIFIER_ID, name: "Admin (You)", role: "verifier", phone: null })
    const names = db.source.directory !== null
    for (const id of [...ctx.azIds].sort((a, b) => a - b)) db.azs.push({ id, code: id === 0 ? "—" : `AZ${id}`, name: names ? demo.directory.azs[String(id)] ?? null : null })
    db.people.push(...ctx.people.values())
    db.farmers.push(...ctx.farmers.values())
    db.survey_responses.push(...ctx.responses.values())
    db.plots.push(...ctx.plots.values())
    return db
}
