// PORT-BOUND — Deployment V2.1: which plot deployments one saved outline covers (polygon containment).
//
// The original Deployment page (matic-dash components/ui/google-map.tsx assignShapesToDeployments / getDeploymentId)
// tests every loaded deployment's location against the drawn polygon (google.maps.geometry.poly.containsLocation) and
// sends one uploadGeoJsonData entry per enclosed deployment, the same polygon and area on each, in one request. V2.1
// keeps that principle without the original's defects, and without anything the backend contract doesn't confirm:
//   - the plot being edited is always saved (V2.1's editor targets it: unchanged behaviour);
//   - another deployment is added when it belongs to the same farmer and deployment round, the verifier may edit it,
//     its location is a real one (not missing, not (0, 0), in range) and lies inside the outline, and the caller doesn't
//     exclude it (a plot edited in the same save, or one already covered by an earlier outline of that save);
//   - as on the production page, a deployment inside that already has a boundary gets the new one too (`replaces`: the
//     editor lists it before Save all, the toast after — never silent);
//   - each deployment once, each entry with that deployment's own farmer and AZ (the original copied the first loaded
//     deployment's onto every entry).
// The contract sends no plot_id (neither the original nor V2 sends one): whether the backend gives the covered
// deployments one Plot ID is NOT known — nothing here assumes it.
import { checkPlotBoundary } from "./boundary-gate"
import type { TrailerDeploymentPlot, TrailerDispatchItem } from "./schema"

export interface LatLngPoint {
    lat: number
    lng: number
}

/** A real location: finite, in range, and not the (0, 0) placeholder a missing one is often sent as. */
export function isValidLocation(location: { lat: unknown; lng: unknown } | null | undefined): location is LatLngPoint {
    if (!location) return false
    const { lat, lng } = location
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
    return !(Math.abs(lat) < 1e-9 && Math.abs(lng) < 1e-9)
}

/** Point in polygon (even–odd ray casting on lat / lng, as containsLocation does for a plot-sized outline). */
export function isInsideOutline(point: LatLngPoint, outline: LatLngPoint[]): boolean {
    if (outline.length < 3) return false
    let inside = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const a = outline[i], b = outline[j]
        if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside
    }
    return inside
}

export interface CoverageCandidate {
    plot: TrailerDeploymentPlot
    dispatch: TrailerDispatchItem
    /** The deployment round (the row's deployment_num); null when unknown — then never covered. */
    round: number | null
    /** The signed-in verifier may edit this deployment's boundary. */
    editable: boolean
}

export type CoverageSkipReason = "duplicate" | "other-farmer" | "other-round" | "not-editable" | "no-location" | "outside" | "excluded"

export interface BoundaryCoverage {
    /** What the save sends: the edited deployment first, then each covered one — each once. */
    entries: { plot: TrailerDeploymentPlot; dispatch: TrailerDispatchItem }[]
    /** The deployments added by containment (entries without the edited one); `replaces`: it had a boundary before. */
    covered: { plot: TrailerDeploymentPlot; dispatch: TrailerDispatchItem; replaces: boolean }[]
    /** Every other candidate and why it isn't covered (diagnostics, tests, the UI's note). */
    skipped: { plot: TrailerDeploymentPlot; reason: CoverageSkipReason }[]
}

/**
 * The deployments one outline covers. `target`: the deployment being edited (always saved). `candidates`: every
 * loaded deployment (the target may be among them). `exclude`: deployment ids never covered here.
 */
export function boundaryCoverage(
    target: { plot: TrailerDeploymentPlot; dispatch: TrailerDispatchItem; round: number | null },
    outline: LatLngPoint[],
    candidates: CoverageCandidate[],
    exclude: ReadonlySet<number> = new Set()
): BoundaryCoverage {
    const entries = [{ plot: target.plot, dispatch: target.dispatch }]
    const covered: BoundaryCoverage["covered"] = []
    const skipped: BoundaryCoverage["skipped"] = []
    const seen = new Set<number>([target.plot.deployment_id])
    for (const c of candidates) {
        const id = c.plot.deployment_id
        if (seen.has(id)) {
            if (id !== target.plot.deployment_id) skipped.push({ plot: c.plot, reason: "duplicate" })
            continue
        }
        seen.add(id)
        const reason: CoverageSkipReason | null =
            String(c.plot.farmer_id) !== String(target.plot.farmer_id) ? "other-farmer"
                : target.round === null || c.round !== target.round ? "other-round"
                : exclude.has(id) ? "excluded"
                : !c.editable ? "not-editable"
                : !isValidLocation(c.plot.location) ? "no-location"
                : !isInsideOutline(c.plot.location, outline) ? "outside"
                : null
        if (reason) skipped.push({ plot: c.plot, reason })
        else {
            entries.push({ plot: c.plot, dispatch: c.dispatch })
            covered.push({ plot: c.plot, dispatch: c.dispatch, replaces: checkPlotBoundary(c.plot).state !== "missing" })
        }
    }
    return { entries, covered, skipped }
}

/**
 * One key per outline, so an outline several deployments share (the same polygon copied onto each: the API stores a
 * boundary per deployment) is drawn once: the open ring (a closing point dropped), coordinates to 6 decimals (~10 cm; the same shape stored twice can differ in the last float digits).
 */
export function outlineKey(path: LatLngPoint[] | null | undefined): string {
    const ring = [...(path ?? [])]
    if (ring.length > 1 && Math.abs(ring[0].lat - ring[ring.length - 1].lat) < 1e-9 && Math.abs(ring[0].lng - ring[ring.length - 1].lng) < 1e-9) ring.pop()
    return ring.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";")
}
