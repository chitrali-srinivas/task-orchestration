// PORT-BOUND — normalizes raw dev-API detail responses into the V2 detail model, so no component has to know
// the API's quirks (numeric strings, nullable fields, JSON-string locations, varying geometry shapes).
// Field lists follow what matic-dash reads (src/services/api.ts getTrailerDetails / getNocDetailsWithSamplingCount /
// getReportDetails). Nothing is invented: a value that cannot be read becomes null / "" / false, never a guess.
import type {
    DeploymentNocDetails,
    DispatchStatus,
    ReportHistoryEntry,
    ReportHistoryResponse,
    ReportHistoryStatus,
    TrailerDeploymentPlot,
    TrailerDispatchItem,
} from "./schema"
import { parseEpochMs } from "./adapter"

type Raw = Record<string, unknown>

const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v)

/** A raw value parseEpochMs can inspect (number or string); anything else is no date. */
const asEpochInput = (v: unknown): number | string | null => (typeof v === "number" || typeof v === "string" ? v : null)

/** Number, or a numeric string (the dev API serializes bigint / numeric columns as strings). Else null. */
export function toNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value.trim())
    return null
}

const toStr = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")
const toNullableStr = (value: unknown): string | null => {
    const s = toStr(value).trim()
    return s === "" ? null : s
}
/** Media: a trimmed absolute http(s) URL, else null (matic-dash trims video URLs before playing them). */
export function toMediaUrl(value: unknown): string | null {
    const s = toStr(value).trim()
    return /^https?:\/\//i.test(s) ? s : null
}

export interface LatLngLiteral {
    lat: number
    lng: number
}

const validLatLng = (lat: number | null, lng: number | null): LatLngLiteral | null =>
    lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? { lat, lng } : null

/**
 * Plot location: `{lat, lng}` (numbers or numeric strings), or the same as a JSON string. `0,0` and out-of-range
 * values are treated as missing (matic-dash substitutes 0,0 for missing locations; V2 does not fabricate one).
 */
export function toLocation(value: unknown): LatLngLiteral | null {
    let v = value
    if (typeof v === "string") {
        try { v = JSON.parse(v) } catch { return null }
    }
    if (!isRecord(v)) return null
    return validLatLng(toNumber(v.lat), toNumber(v.lng))
}

/**
 * Plot outline from `geometry`: a GeoJSON Polygon (matic-dash draws `coordinates[0]` as [lng, lat]), also accepted
 * as a Feature / FeatureCollection (first feature) or a JSON string. Anything else — null, WKT, malformed rings,
 * fewer than 3 valid points — has no outline.
 */
export function toPolygonPath(value: unknown): LatLngLiteral[] | null {
    let v = value
    if (typeof v === "string") {
        try { v = JSON.parse(v) } catch { return null }
    }
    if (!isRecord(v)) return null
    const geometry = v.type === "FeatureCollection" && Array.isArray(v.features) ? (v.features[0] as Raw | undefined)?.geometry
        : v.type === "Feature" ? v.geometry
        : v
    if (!isRecord(geometry) || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) return null
    const ring = geometry.coordinates[0]
    if (!Array.isArray(ring)) return null
    const path: LatLngLiteral[] = []
    for (const point of ring) {
        if (!Array.isArray(point)) return null
        const ll = validLatLng(toNumber(point[1]), toNumber(point[0]))
        if (!ll) return null
        path.push(ll)
    }
    return path.length >= 3 ? path : null
}

/** Flags arrive as booleans or 0 / 1 (numbers or strings). */
const toFlag = (value: unknown): boolean => value === true || toNumber(value) === 1

/** V2.1: a validation flag that may be unknown — true / false (or "true" / "false" / 1 / 0), else null (never assumed false). */
export const toFlagOrNull = (value: unknown): boolean | null =>
    value === true || value === "true" || toNumber(value) === 1 ? true
        : value === false || value === "false" || toNumber(value) === 0 ? false
        : null

/** V2.1: a list of messages — the array's non-empty strings (trimmed); null when the value isn't an array. */
export const toMessageList = (value: unknown): string[] | null =>
    Array.isArray(value) ? value.filter((m): m is string => typeof m === "string").map((m) => m.trim()).filter(Boolean) : null

const DISPATCH_STATUSES: readonly DispatchStatus[] = ["pending", "approved", "rejected"]
const toDispatchStatus = (value: unknown): DispatchStatus | null => {
    const s = toStr(value).trim().toLowerCase()
    return (DISPATCH_STATUSES as readonly string[]).includes(s) ? (s as DispatchStatus) : null
}

function normalizePlot(raw: unknown): TrailerDeploymentPlot | null {
    if (!isRecord(raw)) return null
    const deploymentId = toNumber(raw.deployment_id)
    if (deploymentId === null) return null
    return {
        amt_plot_deploy: toNumber(raw.amt_plot_deploy) ?? 0,
        area: toNumber(raw.area) ?? 0,
        comment: toNullableStr(raw.comment),
        deployment_id: deploymentId,
        dispatch_id: toNumber(raw.dispatch_id) ?? 0,
        farmer_id: toNumber(raw.farmer_id) ?? 0,
        geometry: raw.geometry ?? null,
        location: toLocation(raw.location),
        picture_deployment: toMediaUrl(raw.picture_deployment),
        plot_id: toStr(raw.plot_id),
        repeater_form_id: toStr(raw.repeater_form_id),
        repeater_form_index: toNumber(raw.repeater_form_index) ?? 0,
        is_location_reported: toFlag(raw.is_location_reported),
        // The API names the amount flag `is_mati_deploy_reported` (matic-dash reads `is_deployment_reported`, never sent).
        is_deployment_reported: toFlag(raw.is_mati_deploy_reported) || toFlag(raw.is_deployment_reported),
        verbal_plot_area_enrolled: toNumber(raw.verbal_plot_area_enrolled),
        boost_amount_plot_applied: toNumber(raw.boost_amount_plot_applied),
        source_name: toNullableStr(raw.source_name),
    }
}

function normalizeDispatch(raw: unknown): TrailerDispatchItem | null {
    if (!isRecord(raw)) return null
    const deploymentDetailId = toNullableStr(raw.deployment_detail_id)
    if (!deploymentDetailId) return null
    return {
        az_code: toStr(raw.az_code),
        az_id: toNumber(raw.az_id) ?? 0,
        // `date` is epoch ms for most dispatches, but some send "dd-MM-yyyy" text (not an epoch; `new Date()` misreads
        // or rejects it). The same dispatch's `epoch_date` is its epoch ms (equal to `date` whenever `date` is one).
        date: parseEpochMs(asEpochInput(raw.date)) ?? parseEpochMs(asEpochInput(raw.epoch_date)),
        date_raw: asEpochInput(raw.date),
        deployment_detail_id: deploymentDetailId,
        deployment_verifier_name: toNullableStr(raw.deployment_verifier_name),
        deployment_verifier_id: toNullableStr(raw.deployment_verifier_id),
        dispatch_id: toNumber(raw.dispatch_id) ?? 0,
        num_tons: toNumber(raw.num_tons) ?? 0,
        source_name: toStr(raw.source_name),
        surveyor_name: toStr(raw.surveyor_name),
        surveyor_registred_no: toStr(raw.surveyor_registred_no),
        trailer_no: toStr(raw.trailer_no),
        video: toMediaUrl(raw.video),
        village_name: toStr(raw.village_name),
        cluster_name: toStr(raw.cluster_name),
        repeater_form_index: toNumber(raw.repeater_form_index) ?? 0,
        franchise_status: toDispatchStatus(raw.franchise_status),
        franchise_verifier_id: toNullableStr(raw.franchise_verifier_id),
        batch_id: toNullableStr(raw.batch_id),
        field_condition: toNullableStr(raw.field_condition),
        crop_stage: toNullableStr(raw.crop_stage),
        num_plots_unload: toNumber(raw.num_plots_unload),
        deployment_plots_data: (Array.isArray(raw.deployment_plots_data) ? raw.deployment_plots_data : [])
            .map(normalizePlot)
            .filter((p): p is TrailerDeploymentPlot => p !== null),
        // V2.1 (live API audit): this dispatch's own validation and verification (null when not sent).
        action_required: toFlagOrNull(raw.action_required),
        err_msg: toMessageList(raw.err_msg),
        verified_at: parseEpochMs(asEpochInput(raw.verified_at)),
        verified_by: toNullableStr(raw.verified_by),
    }
}

/** getTrailerDetails `data` → dispatches (entries without a deployment_detail_id cannot be acted on and are dropped). */
export function normalizeTrailerDetails(data: unknown): TrailerDispatchItem[] {
    return (Array.isArray(data) ? data : []).map(normalizeDispatch).filter((d): d is TrailerDispatchItem => d !== null)
}

/** getDeploymentNocDetails `data` → NOC per AZ + pre-sampling summary (only index 0 is read, as in matic-dash). */
export function normalizeNocDetails(data: unknown): DeploymentNocDetails {
    const d = isRecord(data) ? data : {}
    const trailer = Array.isArray(d.get_trailer_result) && isRecord(d.get_trailer_result[0]) ? d.get_trailer_result[0] : {}
    const noc = (Array.isArray(trailer.noc) ? trailer.noc : [])
        .filter(isRecord)
        .map((n) => ({ noc: toMediaUrl(n.noc) ?? "", az_id: toNumber(n.az_id) ?? 0, franchise_status: toStr(n.franchise_status) }))
    const pre = Array.isArray(d.get_pre_sampling_details_result) && isRecord(d.get_pre_sampling_details_result[0]) ? d.get_pre_sampling_details_result[0] : null
    return {
        get_trailer_result: [{ noc }],
        get_pre_sampling_details_result: pre
            ? [{ total_sample_codes: toNumber(pre.total_sample_codes) ?? 0, status: (Array.isArray(pre.status) ? pre.status : []).map(toStr) }]
            : [],
    }
}

/** A history value as text without losing it: objects / arrays (a corrected location) stay JSON for the display. */
const toHistoryValue = (value: unknown): string =>
    typeof value === "string" ? value
        : typeof value === "number" || typeof value === "boolean" ? String(value)
        : value === null || value === undefined ? ""
        : JSON.stringify(value)

/** entry_no: the plot's 1-based repeater_form_index. "", 0 and anything else that isn't a positive integer → null. */
const toEntryNo = (value: unknown): number | null => {
    const n = toNumber(value)
    return n !== null && Number.isInteger(n) && n > 0 ? n : null
}

const toReportStatus = (value: unknown): ReportHistoryStatus | null => {
    const s = toStr(value).trim().toLowerCase()
    return s === "ongoing" || s === "completed" ? s : null
}

/** getFarmerReportedHistory `data` → history entries with epoch-ms dates (every entry the API sent, in its order). */
export function normalizeReportHistory(data: unknown): ReportHistoryResponse {
    const d = isRecord(data) ? data : {}
    const entries: ReportHistoryEntry[] = (Array.isArray(d.reported_farmer_details_result) ? d.reported_farmer_details_result : [])
        .filter(isRecord)
        .map((e) => ({
            id: toNumber(e.id),
            repeater_form_id: toNullableStr(e.repeater_form_id),
            entry_no: toEntryNo(e.entry_no),
            defect_type: toStr(e.defect_type),
            status: toReportStatus(e.status),
            az_id: toNumber(e.az_id),
            reason: toStr(e.reason),
            comment: toNullableStr(e.comment),
            surveyor_name: toStr(e.surveyor_name),
            old_value: toHistoryValue(e.old_value),
            new_value: toHistoryValue(e.new_value),
            created_at: parseEpochMs(asEpochInput(e.created_at)),
            reported_by_name: toStr(e.reported_by_name),
            form_name: toStr(e.form_name),
            farmer_name: toStr(e.farmer_name),
            farmer_id: toStr(e.farmer_id),
            updated_at: parseEpochMs(asEpochInput(e.updated_at)),
        }))
    return { reported_farmer_details_result: entries, franchise_status: toNullableStr(d.franchise_status) }
}
