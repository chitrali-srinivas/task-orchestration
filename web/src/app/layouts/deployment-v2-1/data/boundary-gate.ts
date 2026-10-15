// PORT-BOUND — V2.1 (requirement 5): the approval boundary gate. Approval of a dispatch needs EVERY plot of that
// dispatch (its deployment_plots_data — the API's plot ↔ dispatch relationship) to have a valid SAVED boundary: the
// plot's `geometry` as the detail read returned it. Nothing from the editor counts: an edit that isn't saved and
// re-read isn't a boundary. Pure functions; the geometry helpers are shared with the boundary editor.
// This is a FRONTEND gate. Whether the backend enforces the same rule is unverified (matic-dash's own approve flow has
// no boundary condition: deployment-trailer.tsx).
import { ringAreaAcres } from "../../samples/domain/geometry" // relative: the node checks (tests/deployment-v2-1) run the compiled module without the @/ alias
import { toPolygonPath } from "./live-normalize"
import type { TrailerDeploymentPlot, TrailerDispatchItem } from "./schema"

type LatLng = { lat: number; lng: number }

/** Segments p1p2 and p3p4 cross or touch (lng = x, lat = y; a small field, so planar is exact enough). */
function segmentsMeet(p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng): boolean {
    const cross = (a: LatLng, b: LatLng, c: LatLng) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng)
    const onSegment = (a: LatLng, b: LatLng, c: LatLng) => Math.min(a.lng, b.lng) <= c.lng && c.lng <= Math.max(a.lng, b.lng) && Math.min(a.lat, b.lat) <= c.lat && c.lat <= Math.max(a.lat, b.lat)
    const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4)
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
    return (d1 === 0 && onSegment(p3, p4, p1)) || (d2 === 0 && onSegment(p3, p4, p2)) || (d3 === 0 && onSegment(p1, p2, p3)) || (d4 === 0 && onSegment(p1, p2, p4))
}

/** The outline's edges cross each other (a "bow tie") — not a valid plot boundary. */
export function selfIntersects(path: LatLng[]): boolean {
    const n = path.length
    if (n < 4) return false
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (j === i + 1 || (i === 0 && j === n - 1)) continue // neighbouring edges share a point
            if (segmentsMeet(path[i], path[(i + 1) % n], path[j], path[(j + 1) % n])) return true
        }
    }
    return false
}

const samePoint = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9

/** The open ring of a saved outline (a closing point equal to the first is dropped); [] when none. */
export function openRing(path: LatLng[] | null | undefined): LatLng[] {
    const ring = (path ?? []).map((p) => ({ lat: p.lat, lng: p.lng }))
    if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) ring.pop()
    return ring
}

/** Why an outline isn't a valid boundary, or null: fewer than 3 DISTINCT points, or self-crossing edges. */
export function outlineProblem(path: LatLng[]): string | null {
    const ring = openRing(path)
    const distinct = ring.filter((p, i) => ring.findIndex((q) => samePoint(p, q)) === i)
    if (distinct.length < 3) return `Fewer than 3 distinct points (${distinct.length})`
    if (selfIntersects(ring)) return "The outline crosses itself"
    return null
}

export type PlotBoundaryState = "saved" | "missing" | "invalid"

export interface PlotBoundaryCheck {
    plot: TrailerDeploymentPlot
    state: PlotBoundaryState
    /** For `invalid`: the problem with the saved outline. */
    problem: string | null
}

/** The saved boundary of one plot as the API returned it: a parsable polygon that passes outlineProblem. */
export function checkPlotBoundary(plot: TrailerDeploymentPlot): PlotBoundaryCheck {
    const path = toPolygonPath(plot.geometry)
    if (!path || path.length === 0) return { plot, state: "missing", problem: null }
    const problem = outlineProblem(path)
    return problem ? { plot, state: "invalid", problem } : { plot, state: "saved", problem: null }
}

export interface DispatchBoundaryGate {
    /** Every plot of the dispatch has a valid saved boundary (and the dispatch has at least one plot). */
    ok: boolean
    checks: PlotBoundaryCheck[]
    missing: TrailerDeploymentPlot[]
    invalid: PlotBoundaryCheck[]
    /** Why approval is blocked, for the UI; null when `ok`. */
    reason: string | null
}

/**
 * The gate for ONE dispatch, from the dispatch the detail read returned (never from a farmer-level plot count: plots
 * belong to dispatches through deployment_plots_data, and only that relationship is used).
 */
export function dispatchBoundaryGate(dispatch: Pick<TrailerDispatchItem, "deployment_plots_data">, label = (plot: TrailerDeploymentPlot) => `DEPL-${plot.deployment_id}`): DispatchBoundaryGate {
    const checks = dispatch.deployment_plots_data.map(checkPlotBoundary)
    const missing = checks.filter((c) => c.state === "missing").map((c) => c.plot)
    const invalid = checks.filter((c) => c.state === "invalid")
    const total = checks.length
    if (total === 0) return { ok: false, checks, missing, invalid, reason: "This dispatch has no plots to approve." }
    // Short: the plots to fix, by label (the line's "Edit boundaries" link and the confirmation's plot list say the rest).
    const parts: string[] = []
    if (missing.length > 0) parts.push(`No saved boundary: ${missing.map(label).join(", ")}.`)
    if (invalid.length > 0) parts.push(`Invalid boundary: ${invalid.map((c) => `${label(c.plot)} (${c.problem})`).join(", ")}.`)
    return { ok: parts.length === 0, checks, missing, invalid, reason: parts.length ? parts.join(" ") : null }
}

/**
 * V2.1: a dispatch's Cal. Area (acres) — the table's "Cal. Area" at dispatch grain. The API sends `calculated_area`
 * only per LIST ROW (the deployment's total; getTrailerDetails plots carry no calculated area), and production makes
 * each plot's value from its saved polygon: spherical area × SQUARE_METERS_TO_ACRES, rounded to 3 decimals
 * (request-builders.ts buildUploadGeoJsonRequest → uploadGeoJson `calculated_area`). The same is done here from the
 * dispatch's own saved boundaries (Samples' spherical ring area). null unless EVERY plot of the dispatch has a valid
 * saved boundary — a partial sum is never shown, and the row's total is never copied onto its dispatches.
 */
export function dispatchCalculatedAreaAcres(dispatch: Pick<TrailerDispatchItem, "deployment_plots_data">): number | null {
    const checks = dispatch.deployment_plots_data.map(checkPlotBoundary)
    if (checks.length === 0 || checks.some((c) => c.state !== "saved")) return null
    return checks.reduce((sum, c) => sum + Math.round(ringAreaAcres(openRing(toPolygonPath(c.plot.geometry))) * 1000) / 1000, 0)
}

// ── Mock seeds (used by mock-backend.ts ?mockBoundaries=seed only) ───────────────────────────────────────────

/** A ~60 m square around a location, as a GeoJSON Polygon geometry ([lng, lat], closed ring). */
export function SEEDED_VALID_OUTLINE(at: LatLng): { type: "Polygon"; coordinates: number[][][] } {
    const d = 0.0003
    const ring = [[at.lng - d, at.lat - d], [at.lng + d, at.lat - d], [at.lng + d, at.lat + d], [at.lng - d, at.lat + d], [at.lng - d, at.lat - d]]
    return { type: "Polygon", coordinates: [ring] }
}

/** The same square with two corners swapped: its edges cross (a bow tie) — an INVALID saved outline. */
export function SEEDED_INVALID_OUTLINE(at: LatLng): { type: "Polygon"; coordinates: number[][][] } {
    const d = 0.0003
    const ring = [[at.lng - d, at.lat - d], [at.lng + d, at.lat + d], [at.lng + d, at.lat - d], [at.lng - d, at.lat + d], [at.lng - d, at.lat - d]]
    return { type: "Polygon", coordinates: [ring] }
}
