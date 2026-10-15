// PROTOTYPE-ONLY — an in-memory implementation of the PROPOSED Samples API (domain/types.ts) over the mock database.
// It plays the backend: statuses, buckets, counts, validation, approval blockers and boundary validation are all
// decided HERE, never in components. The UI calls SamplesApi, the store changes, the UI re-reads.
//
// URL flags (opt-in, for exercising states):
//   ?mockPermission=view       the session can't verify (actions disabled with an explanation)
//   ?mockFail=list|detail|boundary|approve|report   the first such call after load fails (error + retry paths)
import {
    distanceMeters,
    distanceToRingMeters,
    isSelfIntersecting,
    openRing,
    pointInRing,
    ringAreaAcres,
    ringsOverlap,
    type LatLng,
} from "../../domain/geometry"
import type {
    ApprovalBlocker,
    ApproveSamplesRequest,
    ApproveSamplesResponse,
    AzRef,
    BoundaryState,
    BucketCounts,
    FarmerRef,
    FarmerSamplesDetail,
    FilterOptionsResponse,
    ListSamplesRequest,
    ListSamplesResponse,
    MutationOutcome,
    PersonRef,
    PlotRef,
    PurposeCount,
    ReportSampleRequest,
    Sample,
    SampleEvent,
    SampleListRow,
    SaveBoundaryRequest,
    SaveBoundaryResponse,
    Session,
    StatusBucket,
    UpdateCommentRequest,
    ValidationCheck,
} from "../../domain/types"
import type { SamplesApi } from "../samples-api"
import { MOCK_VERIFIER_ID, createMockDb, isDevicePath, type DbPlot, type DbSample, type MockDb } from "./mock-db"

// ── Store ───────────────────────────────────────────────────────────────────────────────────────────

const db: MockDb = createMockDb()
const listeners = new Set<() => void>()
let storeVersion = 0
const emit = () => {
    storeVersion++
    listeners.forEach((l) => l())
}
export const subscribeMockSamples = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}
export const getMockSamplesVersion = () => storeVersion
/** The raw tables (Data / API Inspector only). */
export const getMockDb = (): Readonly<MockDb> => db

const flag = (name: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name))
const pendingFailures = new Set((flag("mockFail") ?? "").split(",").filter(Boolean))
const failOnce = (what: string) => {
    if (!pendingFailures.has(what)) return false
    pendingFailures.delete(what)
    return true
}
const canVerify = () => flag("mockPermission") !== "view"

const LATENCY_MS = 350
/** `fail`: an error to return. `failOnceAs`: a one-shot ?mockFail failure, consumed only when a response is delivered
 *  (an aborted read doesn't use it up). */
function respond<T>(value: T, signal?: AbortSignal, fail?: string, failOnceAs?: [key: string, message: string]): Promise<T> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"))
        const timer = setTimeout(() => {
            if (failOnceAs && failOnce(failOnceAs[0])) return reject(new Error(failOnceAs[1]))
            return fail ? reject(new Error(fail)) : resolve(structuredClone(value))
        }, LATENCY_MS)
        signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")) }, { once: true })
    })
}
const idempotent = new Map<string, unknown>()

// ── Lookups ─────────────────────────────────────────────────────────────────────────────────────────

const peopleById = new Map(db.people.map((p) => [p.id, p]))
const farmersById = new Map(db.farmers.map((f) => [f.id, f]))
const villagesById = new Map(db.villages.map((v) => [v.id, v]))
const azsById = new Map(db.azs.map((a) => [a.id, a]))
const responsesById = new Map(db.survey_responses.map((r) => [r.id, r]))
const plotsById = new Map(db.plots.map((p) => [p.plot_id, p]))

const person = (id: string | null): PersonRef | null => {
    if (!id) return null
    const p = peopleById.get(id)
    return p ? { id: p.id, name: p.name, phone: p.phone } : { id, name: null, phone: id }
}
const azRef = (id: number): AzRef => {
    const a = azsById.get(id)
    return a ? { id: a.id, code: a.code, name: a.name } : { id, code: `AZ${id}`, name: null }
}
const farmerRef = (id: string): FarmerRef => {
    const f = farmersById.get(id)
    const village = f?.village_id ? villagesById.get(f.village_id) : null
    return {
        id,
        name: f?.name ?? null,
        phone: f?.phone ?? null,
        village: village ? { id: village.id, name: village.name, block: village.block, district: village.district, state: village.state } : null,
        derived: f?.derived ?? true,
    }
}
const responseOf = (s: DbSample) => responsesById.get(s.survey_response_id)!
const plotOf = (s: DbSample): DbPlot | null => {
    const id = s.generated_plot_id ?? s.plot_id
    return id ? plotsById.get(id) ?? null : null
}
const geometryOf = (plotId: string) => db.plot_geometries.find((g) => g.plot_id === plotId) ?? null
const locationOf = (s: DbSample): LatLng | null => (s.lat === null || s.lng === null ? null : { lat: s.lat, lng: s.lng })
const formatDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

function plotRefOf(plot: DbPlot): PlotRef {
    const g = geometryOf(plot.plot_id)
    return {
        plot_id: plot.plot_id,
        origin: plot.origin,
        outline: g ? g.ring : null,
        outline_available: !!g,
        area_acres: g ? g.area_acres : null,
        deployment_id: plot.deployment_id,
        drawn_by: plot.origin === "generated" ? person(g?.updated_by ?? plot.created_by) : null,
        drawn_at: plot.origin === "generated" ? g?.updated_at ?? plot.created_at : null,
    }
}

// ── Server rules (PROPOSED — see docs §11) ─────────────────────────────────────────────────────────

const GPS_IN_PLOT_TOLERANCE_M = 30
const MIN_COLLECTION_DATE = Date.UTC(2020, 0, 1)
export const BOUNDARY_RULES = { minAcres: 0.02, maxAcres: 25 }

interface ReadIndex {
    photoCount: Map<string, string[]>
    gpsCount: Map<string, string[]>
    /** Samples with at least one report (open or completed). */
    reported: Set<string>
}
function buildIndex(): ReadIndex {
    const photoCount = new Map<string, string[]>()
    const gpsCount = new Map<string, string[]>()
    for (const s of db.samples) {
        if (s.picture_url) photoCount.set(s.picture_url, [...(photoCount.get(s.picture_url) ?? []), s.id])
        if (s.lat !== null && s.lng !== null) {
            const k = `${s.lat},${s.lng}`
            gpsCount.set(k, [...(gpsCount.get(k) ?? []), s.id])
        }
    }
    return { photoCount, gpsCount, reported: new Set(db.reports.map((r) => r.sample_id)) }
}
const codeOf = (id: string) => db.samples.find((s) => s.id === id)?.sample_code ?? id

function validate(s: DbSample, index: ReadIndex): ValidationCheck[] {
    const loc = locationOf(s)
    const plot = plotOf(s)
    const ring = plot ? geometryOf(plot.plot_id)?.ring ?? null : null
    const uploaded = !!s.picture_url && !isDevicePath(s.picture_url)
    const samePhoto = s.picture_url ? (index.photoCount.get(s.picture_url) ?? []).filter((id) => id !== s.id) : []
    const sameGps = loc ? (index.gpsCount.get(`${s.lat},${s.lng}`) ?? []).filter((id) => id !== s.id) : []
    const outside = loc && ring ? distanceToRingMeters(loc, ring) : 0
    const dateOk = s.collected_at !== null && s.collected_at >= MIN_COLLECTION_DATE && s.collected_at <= s.created_at + 86_400_000
    return [
        { code: "photo_present", label: "Photo uploaded", severity: "error", result: uploaded ? "pass" : "fail", message: uploaded ? null : s.picture_url ? "The photo never uploaded (a device path was saved instead of a file)." : "No photo was uploaded." },
        { code: "photo_unique", label: "Photo not reused", severity: "warning", result: !uploaded ? "not_applicable" : samePhoto.length ? "fail" : "pass", message: samePhoto.length ? `Same photo as ${samePhoto.map(codeOf).join(", ")}.` : null },
        { code: "gps_present", label: "GPS recorded", severity: "error", result: loc ? "pass" : "fail", message: loc ? null : "No GPS location was recorded." },
        { code: "gps_unique", label: "GPS not duplicated", severity: "warning", result: !loc ? "not_applicable" : sameGps.length ? "fail" : "pass", message: sameGps.length ? `Same coordinates as ${sameGps.map(codeOf).join(", ")}.` : null },
        { code: "gps_in_plot", label: "GPS inside the plot", severity: "warning", result: !loc || !ring ? "not_applicable" : outside > GPS_IN_PLOT_TOLERANCE_M ? "fail" : "pass", message: loc && ring && outside > GPS_IN_PLOT_TOLERANCE_M ? `Collected ${Math.round(outside)} m outside plot ${plot!.plot_id}.` : null },
        { code: "collection_date_valid", label: "Collection date valid", severity: "error", result: dateOk ? "pass" : "fail", message: dateOk ? null : s.collected_at === null ? "No collection date." : `Collection date ${formatDay(s.collected_at)} is ${s.collected_at > s.created_at ? "after the submission date" : "before 2020"}.` },
        { code: "sample_code_present", label: "Sample code recorded", severity: "error", result: s.sample_code ? "pass" : "fail", message: s.sample_code ? null : "No sample code was recorded." },
    ]
}

function boundaryStateOf(s: DbSample): BoundaryState {
    if (s.kind === "deployment") return "deployment_plot"
    if (plotOf(s)) return "control_plot"
    return locationOf(s) ? "boundary_required" : "not_located"
}
const openReportOf = (s: DbSample) => db.reports.find((r) => r.sample_id === s.id && r.state === "ongoing") ?? null

function bucketOf(s: DbSample, checks: ValidationCheck[]): StatusBucket {
    if (s.status === "approved") return "approved"
    if (s.status === "rejected") return "need_correction"
    return checks.some((c) => c.severity === "error" && c.result === "fail") ? "need_correction" : "pending"
}

function blockersOf(s: DbSample, checks: ValidationCheck[], state: BoundaryState): ApprovalBlocker[] {
    if (s.status === "approved") return [{ code: "not_pending", message: "This sample is already verified." }]
    if (s.status === "rejected") return [{ code: "open_report", message: "This sample was reported. It can be verified again after the surveyor's correction." }]
    const out: ApprovalBlocker[] = []
    if (!canVerify()) out.push({ code: "no_permission", message: "You don't have permission to approve samples." })
    if (state === "not_located") out.push({ code: "not_located", message: "This sample has no GPS location, so no plot can be drawn. Report it for correction." })
    if (state === "boundary_required") out.push({ code: "boundary_required", message: "Draw and save the plot boundary before approving this sample." })
    const failed = checks.filter((c) => c.severity === "error" && c.result === "fail" && c.code !== "gps_present")
    if (failed.length) out.push({ code: "validation_failed", message: `Failed checks: ${failed.map((c) => c.label.toLowerCase()).join(", ")}. Report the sample so the surveyor can correct it.` })
    return out
}

function toSample(s: DbSample, index: ReadIndex): Sample {
    const r = responseOf(s)
    const checks = validate(s, index)
    const state = boundaryStateOf(s)
    const blockers = blockersOf(s, checks, state)
    const plot = plotOf(s)
    const report = openReportOf(s)
    return {
        sample_id: s.id,
        sample_code: s.sample_code,
        kind: s.kind,
        purpose: s.purpose,
        survey_response_id: s.survey_response_id,
        farmer_id: r.farmer_id,
        az: azRef(r.az_id),
        location: locationOf(s),
        // a device path is not a picture the UI can show: the validation check explains it, the field is empty
        picture_url: s.picture_url && !isDevicePath(s.picture_url) ? s.picture_url : null,
        collected_at: s.collected_at,
        submitted_at: s.created_at,
        surveyor: person(r.surveyor_id),
        status: s.status,
        bucket: bucketOf(s, checks),
        hq_status: s.hq_status,
        // a pending sample has no verifier yet (6 CSV rows keep a stale verifier_id after a correction)
        verified_by: s.status === "pending" ? null : person(s.verifier_id),
        verified_at: s.status === "pending" ? null : s.verified_at,
        verifier_comment: s.verifier_comment,
        comment: s.comment,
        plot: plot ? plotRefOf(plot) : null,
        boundary_state: state,
        boundary_editable: canVerify() && s.kind === "control" && s.status === "pending" && !!locationOf(s) && (state === "boundary_required" || plot?.origin === "generated"),
        validation: checks,
        open_report: report ? {
            report_id: report.id,
            fields: report.fields,
            comment: report.comment,
            reported_by: person(report.reported_by) ?? { id: report.reported_by, name: null, phone: null },
            reported_at: report.reported_at,
        } : null,
        approval: { allowed: blockers.length === 0, blockers },
        can_report: canVerify() && s.status === "pending",
        has_report_history: index.reported.has(s.id),
        version: s.version,
        source: s.source,
    }
}

// ── Read models: sample rows (the table) and the farmer detail ─────────────────────────────────────

const emptyCounts = (): BucketCounts => ({ pending: 0, need_correction: 0, approved: 0 })
const needsBoundary = (s: Sample) => s.status === "pending" && s.boundary_state === "boundary_required"
const PURPOSE_ORDER = { pre: 0, start: 1, harvest: 2, eoy: 3, eo3y: 4, eo5y: 5 } as const
const KIND_ORDER = { control: 0, deployment: 1 } as const

const toListRow = (s: DbSample, index: ReadIndex): SampleListRow => ({ ...toSample(s, index), farmer: farmerRef(responseOf(s).farmer_id) })

/** Every filter of the list request except the tab, applied to ONE sample row. */
function rowMatches(req: ListSamplesRequest, row: SampleListRow): boolean {
    if (req.farmer_ids?.length && !req.farmer_ids.includes(row.farmer.id)) return false
    if (req.village_ids?.length && !(row.farmer.village && req.village_ids.includes(row.farmer.village.id))) return false
    if (req.az_ids?.length && !req.az_ids.includes(row.az.id)) return false
    if (req.kinds?.length && !req.kinds.includes(row.kind)) return false
    if (req.purposes?.length && !req.purposes.includes(row.purpose)) return false
    if (req.surveyor_ids?.length && !(row.surveyor && req.surveyor_ids.includes(row.surveyor.id))) return false
    if (req.verifier_ids?.length && !(row.verified_by && req.verifier_ids.includes(row.verified_by.id))) return false
    if (req.submitted_from !== undefined && row.submitted_at < req.submitted_from) return false
    if (req.submitted_to !== undefined && row.submitted_at > req.submitted_to) return false
    if (req.boundary?.length) {
        const required = needsBoundary(row)
        if (!((req.boundary.includes("required") && required) || (req.boundary.includes("none_required") && !required))) return false
    }
    return true
}

function sortRows(rows: SampleListRow[], by: ListSamplesRequest["sort_by"], dir: "asc" | "desc") {
    const key = (r: SampleListRow): string | number => {
        switch (by) {
            case "sample_code": return (r.sample_code ?? "").toLowerCase()
            case "farmer": return (r.farmer.name ?? r.farmer.id).toLowerCase()
            case "village": return (r.farmer.village?.name ?? "").toLowerCase()
            case "kind": return KIND_ORDER[r.kind]
            case "purpose": return PURPOSE_ORDER[r.purpose]
            case "plot": return needsBoundary(r) ? 0 : r.plot ? 2 : 1
            case "az": return r.az.code
            case "az_name": return r.az.name ?? ""
            case "surveyor": return (r.surveyor?.name ?? r.surveyor?.id ?? "").toLowerCase()
            case "verified_by": return (r.verified_by?.name ?? r.verified_by?.id ?? "").toLowerCase()
            case "verified_on": return r.verified_at ?? 0
            default: return r.submitted_at
        }
    }
    const m = dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
        const ka = key(a), kb = key(b)
        if (ka === kb) return a.sample_id.localeCompare(b.sample_id) // stable across pages
        return (ka > kb ? 1 : -1) * m
    })
}

// ── Mutation helpers ───────────────────────────────────────────────────────────────────────────────

let eventSeq = 900_000
function addEvent(sampleId: string, type: MockDb["events"][number]["type"], summary: string, reportId?: string) {
    db.events.push({ id: `ev-${eventSeq++}`, sample_id: sampleId, type, at: Date.now(), actor_id: MOCK_VERIFIER_ID, summary, report_id: reportId })
}
const findSample = (id: string) => db.samples.find((s) => s.id === id) ?? null
const staleMessage = "This sample changed since it was loaded. Reload the samples and try again."
let plotSeq = 500

function validateBoundary(ring: LatLng[], target: DbSample, keepPlotId: string | null): string | null {
    const points = openRing(ring)
    const distinct = points.filter((p, i) => points.findIndex((q) => distanceMeters(p, q) < 0.5) === i)
    if (distinct.length < 3) return "A boundary needs at least 3 distinct points."
    if (isSelfIntersecting(points)) return "The boundary's edges cross each other. Redraw it without crossing lines."
    const acres = ringAreaAcres(points)
    if (acres < BOUNDARY_RULES.minAcres || acres > BOUNDARY_RULES.maxAcres) {
        return `The boundary is ${acres.toFixed(3)} acres. A plot must be between ${BOUNDARY_RULES.minAcres} and ${BOUNDARY_RULES.maxAcres} acres.`
    }
    const loc = locationOf(target)
    if (!loc) return "This sample has no GPS location, so the boundary can't be checked against it."
    if (!pointInRing(loc, points)) return `The boundary must contain the sample's collected location (${target.sample_code ?? target.id}).`
    if (keepPlotId) {
        const outside = db.samples.filter((s) => (s.generated_plot_id ?? s.plot_id) === keepPlotId && s.status === "pending" && locationOf(s) && !pointInRing(locationOf(s)!, points))
        if (outside.length) return `Every sample assigned to plot ${keepPlotId} must stay inside it (${outside.length} would be outside).`
    }
    const farmerId = responseOf(target).farmer_id
    for (const plot of db.plots.filter((p) => p.farmer_id === farmerId && p.plot_id !== keepPlotId)) {
        const g = geometryOf(plot.plot_id)
        if (g && ringsOverlap(points, g.ring)) return `The boundary overlaps plot ${plot.plot_id}. Plots can't overlap.`
    }
    return null
}

// ── API ─────────────────────────────────────────────────────────────────────────────────────────────

export const mockSamplesApi: SamplesApi = {
    getSession(): Promise<Session> {
        return respond({ user: person(MOCK_VERIFIER_ID)!, can_verify: canVerify() })
    },

    getFilterOptions(): Promise<FilterOptionsResponse> {
        const farmers = db.farmers.map((f) => farmerRef(f.id)).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
        const people = (role: "surveyor" | "verifier") => db.people.filter((p) => p.role === role).map((p): PersonRef => ({ id: p.id, name: p.name, phone: p.phone }))
        return respond({
            farmers,
            villages: db.villages.map((v) => ({ id: v.id, name: v.name })),
            azs: db.azs.map((a) => azRef(a.id)),
            surveyors: people("surveyor"),
            verifiers: people("verifier"),
        })
    },

    listSamples(req: ListSamplesRequest, signal?: AbortSignal): Promise<ListSamplesResponse> {
        const index = buildIndex()
        const counts: ListSamplesResponse["counts"] = { all: 0, farmers: 0, ...emptyCounts() }
        const matching: SampleListRow[] = []
        const farmers = new Set<string>()
        for (const s of db.samples) {
            const row = toListRow(s, index)
            if (!rowMatches(req, row)) continue
            counts.all++
            counts[row.bucket]++
            if (req.bucket === "all" || row.bucket === req.bucket) {
                matching.push(row)
                farmers.add(row.farmer.id)
            }
        }
        counts.farmers = farmers.size
        const sorted = sortRows(matching, req.sort_by, req.sort_dir ?? "desc")
        const total = sorted.length
        const pageSize = Math.max(1, req.page_size)
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const page = Math.max(1, req.page)
        return respond({
            rows: sorted.slice((page - 1) * pageSize, page * pageSize),
            pagination: { page, page_size: pageSize, total, total_pages: totalPages },
            counts,
        }, signal, undefined, ["list", "The samples list could not be loaded (mock failure)."])
    },

    getFarmerDetail(farmerId: string, signal?: AbortSignal): Promise<FarmerSamplesDetail> {
        const members = db.samples.filter((s) => responseOf(s).farmer_id === farmerId)
        if (members.length === 0) return respond(null as unknown as FarmerSamplesDetail, signal, "This farmer no longer has samples.")
        const index = buildIndex()
        const samples = members.map((s) => toSample(s, index))
            .sort((a, b) => a.az.id - b.az.id || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || PURPOSE_ORDER[a.purpose] - PURPOSE_ORDER[b.purpose] || b.submitted_at - a.submitted_at || a.sample_id.localeCompare(b.sample_id))
        const azIds = [...new Set(samples.map((s) => s.az.id))].sort((a, b) => a - b)
        const plotIds = new Set(samples.map((s) => s.plot?.plot_id).filter((id): id is string => !!id))
        for (const p of db.plots) if (p.farmer_id === farmerId) plotIds.add(p.plot_id)
        const counts = emptyCounts()
        for (const s of samples) counts[s.bucket]++
        const purposeMap = new Map<string, PurposeCount>()
        for (const s of samples) {
            const k = `${s.kind}:${s.purpose}`
            const e = purposeMap.get(k) ?? { kind: s.kind, purpose: s.purpose, count: 0 }
            e.count++
            purposeMap.set(k, e)
        }
        const failing = samples.filter((s) => s.status === "pending" && s.validation.some((c) => c.severity === "error" && c.result === "fail"))
        return respond({
            farmer: farmerRef(farmerId),
            azs: azIds.map(azRef),
            samples,
            plots: [...plotIds].map((id) => plotRefOf(plotsById.get(id)!)),
            sample_counts: counts,
            purpose_counts: [...purposeMap.values()].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || PURPOSE_ORDER[a.purpose] - PURPOSE_ORDER[b.purpose]),
            action_required: failing.length > 0,
            err_msg: failing.flatMap((s) => s.validation.filter((c) => c.severity === "error" && c.result === "fail").map((c) => ({ msg: `${s.sample_code ?? s.sample_id}: ${c.message}`, key_name: c.code }))),
        }, signal, undefined, ["detail", "The samples of this farmer could not be loaded (mock failure)."])
    },

    getFarmerHistory(farmerId: string, signal?: AbortSignal): Promise<SampleEvent[]> {
        const byId = new Map(db.samples.filter((s) => responseOf(s).farmer_id === farmerId).map((s) => [s.id, s]))
        const events: SampleEvent[] = db.events
            .filter((e) => byId.has(e.sample_id))
            .map((e) => {
                const s = byId.get(e.sample_id)!
                const report = e.report_id ? db.reports.find((r) => r.id === e.report_id) : undefined
                return {
                    event_id: e.id, sample_id: s.id, sample_code: s.sample_code, purpose: s.purpose, kind: s.kind,
                    type: e.type, at: e.at, actor: person(e.actor_id), summary: e.summary,
                    ...(e.type === "reported" && report ? { report_state: report.state, report_fields: report.fields } : {}),
                }
            })
            .sort((a, b) => b.at - a.at || b.event_id.localeCompare(a.event_id))
        return respond(events, signal)
    },

    approveSamples(req: ApproveSamplesRequest): Promise<ApproveSamplesResponse> {
        if (idempotent.has(req.idempotency_key)) return respond(idempotent.get(req.idempotency_key) as ApproveSamplesResponse)
        if (failOnce("approve")) return respond(null as unknown as ApproveSamplesResponse, undefined, "Approval failed (mock failure). Nothing was approved.")
        const index = buildIndex()
        const results: MutationOutcome[] = req.sample_ids.map((id) => {
            const s = findSample(id)
            if (!s) return { sample_id: id, ok: false, error: "Sample not found." }
            if (req.versions[id] !== undefined && req.versions[id] !== s.version) return { sample_id: id, ok: false, error: staleMessage }
            const view = toSample(s, index)
            if (!view.approval.allowed) return { sample_id: id, ok: false, error: view.approval.blockers[0].message }
            s.status = "approved"
            s.verifier_id = MOCK_VERIFIER_ID
            s.verified_at = Date.now()
            s.verifier_comment = req.comment?.trim() || "Approved by admin"
            s.updated_at = s.verified_at
            s.version++
            addEvent(s.id, "approved", req.comment?.trim() ? `Approved — ${req.comment.trim()}` : "Approved")
            return { sample_id: id, ok: true }
        })
        const response = { results }
        idempotent.set(req.idempotency_key, response)
        if (results.some((r) => r.ok)) emit()
        return respond(response)
    },

    reportSample(req: ReportSampleRequest): Promise<Sample> {
        if (idempotent.has(req.idempotency_key)) return respond(idempotent.get(req.idempotency_key) as Sample)
        if (failOnce("report")) return respond(null as unknown as Sample, undefined, "The report could not be submitted (mock failure).")
        const s = findSample(req.sample_id)
        if (!s) return respond(null as unknown as Sample, undefined, "Sample not found.")
        if (s.version !== req.version) return respond(null as unknown as Sample, undefined, staleMessage)
        if (!canVerify() || s.status !== "pending") return respond(null as unknown as Sample, undefined, "Only a pending sample can be reported.")
        if (!req.comment.trim()) return respond(null as unknown as Sample, undefined, "A comment is required.")
        if (req.fields.length === 0) return respond(null as unknown as Sample, undefined, "Select at least one field to report.")
        const now = Date.now()
        const reportId = `rep-${now}`
        const comment = req.comment.trim()
        db.reports.push({ id: reportId, sample_id: s.id, fields: [...req.fields], comment, reported_by: MOCK_VERIFIER_ID, reported_at: now, state: "ongoing", closed_at: null })
        // one atomic write: the report and the sample's status change together (Matic sends two separate calls)
        s.status = "rejected"
        s.verifier_id = MOCK_VERIFIER_ID
        s.verified_at = now
        s.rejection_reason = comment
        s.updated_at = now
        s.version++
        // the reason is the verifier's text only; the fields travel structured (report.fields → event.report_fields)
        addEvent(s.id, "reported", `Reported — ${comment}`, reportId)
        const result = toSample(s, buildIndex())
        idempotent.set(req.idempotency_key, result)
        emit()
        return respond(result)
    },

    saveBoundary(req: SaveBoundaryRequest): Promise<SaveBoundaryResponse> {
        if (idempotent.has(req.idempotency_key)) return respond(idempotent.get(req.idempotency_key) as SaveBoundaryResponse)
        if (failOnce("boundary")) return respond(null as unknown as SaveBoundaryResponse, undefined, "The boundary could not be saved (mock failure).")
        const s = findSample(req.sample_id)
        if (!s) return respond(null as unknown as SaveBoundaryResponse, undefined, "Sample not found.")
        if (s.version !== req.version) return respond(null as unknown as SaveBoundaryResponse, undefined, staleMessage)
        const view = toSample(s, buildIndex())
        if (!view.boundary_editable) return respond(null as unknown as SaveBoundaryResponse, undefined, "This sample's boundary can't be changed.")
        const ring = (req.geometry.coordinates[0] ?? []).map(([lng, lat]) => ({ lat, lng }))
        const existing = plotOf(s)
        const keepPlotId = existing ? existing.plot_id : null
        const error = validateBoundary(ring, s, keepPlotId)
        if (error) return respond(null as unknown as SaveBoundaryResponse, undefined, error)

        const now = Date.now()
        const points = openRing(ring).map((p) => ({ lat: Math.round(p.lat * 1e7) / 1e7, lng: Math.round(p.lng * 1e7) / 1e7 }))
        const area = Math.round(ringAreaAcres(points) * 1000) / 1000 // the server's area, never the client's
        let plot = existing
        const assigned: string[] = []
        if (plot) {
            const g = geometryOf(plot.plot_id)
            if (g) Object.assign(g, { ring: points, area_acres: area, version: g.version + 1, updated_by: MOCK_VERIFIER_ID, updated_at: now })
            else db.plot_geometries.push({ plot_id: plot.plot_id, ring: points, area_acres: area, version: 1, updated_by: MOCK_VERIFIER_ID, updated_at: now })
            for (const x of db.samples.filter((x) => (x.generated_plot_id ?? x.plot_id) === plot!.plot_id && x.status === "pending")) {
                x.version++
                assigned.push(x.id)
                addEvent(x.id, g ? "boundary_updated" : "boundary_saved", g ? `Boundary updated · plot ${plot.plot_id} (${area} acres)` : `Boundary saved for plot ${plot.plot_id} (${area} acres)`)
            }
        } else {
            const r = responseOf(s)
            plotSeq++
            plot = { plot_id: `GP-${String(plotSeq).padStart(5, "0")}`, farmer_id: r.farmer_id, az_id: r.az_id, origin: "generated", deployment_id: null, created_by: MOCK_VERIFIER_ID, created_at: now }
            db.plots.push(plot)
            plotsById.set(plot.plot_id, plot)
            db.plot_geometries.push({ plot_id: plot.plot_id, ring: points, area_acres: area, version: 1, updated_by: MOCK_VERIFIER_ID, updated_at: now })
            // the target, plus the farmer's other boundary-required control samples whose GPS lies inside the outline
            const candidates = db.samples.filter((x) => x.id === s.id || (responseOf(x).farmer_id === r.farmer_id && x.kind === "control" && x.status === "pending"
                && !x.plot_id && !x.generated_plot_id && locationOf(x) && pointInRing(locationOf(x)!, points)))
            for (const x of candidates) {
                x.generated_plot_id = plot.plot_id
                x.updated_at = now
                x.version++
                assigned.push(x.id)
                addEvent(x.id, "boundary_saved", `Boundary saved · plot ${plot.plot_id} created (${area} acres)`)
            }
        }
        const response: SaveBoundaryResponse = { plot: plotRefOf(plot), assigned_sample_ids: assigned }
        idempotent.set(req.idempotency_key, response)
        emit()
        return respond(response)
    },

    updateComment(req: UpdateCommentRequest): Promise<Sample> {
        const s = findSample(req.sample_id)
        if (!s) return respond(null as unknown as Sample, undefined, "Sample not found.")
        if (!canVerify()) return respond(null as unknown as Sample, undefined, "You don't have permission to comment.")
        s.comment = req.comment.trim() || null
        s.updated_at = Date.now()
        s.version++
        addEvent(s.id, "comment_updated", s.comment ? `Comment: ${s.comment}` : "Comment removed")
        emit()
        return respond(toSample(s, buildIndex()))
    },
}
