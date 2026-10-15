// PORT-BOUND — pure geometry for sample locations and plot boundaries. No map SDK, no framework: the mock server's
// boundary validation and the UI's previews use the same rules, and production can run them in a worker or drop them
// for the backend's own checks. Coordinates are WGS84 { lat, lng } in degrees; rings are open (first point not repeated).

export interface LatLng {
    lat: number
    lng: number
}

/** WGS84 equatorial radius (m) — the sphere google.maps.geometry.spherical.computeArea uses, so areas agree with it. */
const EARTH_RADIUS_M = 6378137
/** matic-dash google-map.tsx SQUARE_METERS_TO_ACRES (also Deployment V2 request-builders.ts). */
export const SQUARE_METERS_TO_ACRES = 0.00024710538146717

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** A ring without a repeated closing point (GeoJSON rings repeat the first point at the end). */
export function openRing(ring: LatLng[]): LatLng[] {
    if (ring.length > 1) {
        const first = ring[0], last = ring[ring.length - 1]
        if (Math.abs(first.lat - last.lat) < 1e-12 && Math.abs(first.lng - last.lng) < 1e-12) return ring.slice(0, -1)
    }
    return ring
}

/** Spherical polygon area in m² (the spherical-excess formula Google's computeArea uses). */
export function ringAreaSquareMeters(ring: LatLng[]): number {
    const points = openRing(ring)
    if (points.length < 3) return 0
    let total = 0
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i]
        const p2 = points[(i + 1) % points.length]
        total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)))
    }
    return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2)
}

export const ringAreaAcres = (ring: LatLng[]) => ringAreaSquareMeters(ring) * SQUARE_METERS_TO_ACRES

/** Ray casting; points on an edge count as inside. Planar in lat/lng, which is exact enough at plot scale. */
export function pointInRing(point: LatLng, ring: LatLng[]): boolean {
    const points = openRing(ring)
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j]
        const crosses = a.lat > point.lat !== b.lat > point.lat
        if (crosses && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside
    }
    return inside
}

const orientation = (p: LatLng, q: LatLng, r: LatLng) => {
    const v = (q.lat - p.lat) * (r.lng - q.lng) - (q.lng - p.lng) * (r.lat - q.lat)
    return Math.abs(v) < 1e-15 ? 0 : v > 0 ? 1 : 2
}
const onSegment = (p: LatLng, q: LatLng, r: LatLng) =>
    q.lng <= Math.max(p.lng, r.lng) && q.lng >= Math.min(p.lng, r.lng) && q.lat <= Math.max(p.lat, r.lat) && q.lat >= Math.min(p.lat, r.lat)

function segmentsIntersect(p1: LatLng, q1: LatLng, p2: LatLng, q2: LatLng): boolean {
    const o1 = orientation(p1, q1, p2), o2 = orientation(p1, q1, q2), o3 = orientation(p2, q2, p1), o4 = orientation(p2, q2, q1)
    if (o1 !== o2 && o3 !== o4) return true
    return (o1 === 0 && onSegment(p1, p2, q1)) || (o2 === 0 && onSegment(p1, q2, q1)) || (o3 === 0 && onSegment(p2, p1, q2)) || (o4 === 0 && onSegment(p2, q1, q2))
}

/** True when two non-adjacent edges of the ring cross or touch (a bow-tie). */
export function isSelfIntersecting(ring: LatLng[]): boolean {
    const points = openRing(ring)
    const n = points.length
    if (n < 4) return false
    for (let i = 0; i < n; i++) {
        const a1 = points[i], a2 = points[(i + 1) % n]
        for (let j = i + 1; j < n; j++) {
            // adjacent edges share a vertex by design
            if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
            if (segmentsIntersect(a1, a2, points[j], points[(j + 1) % n])) return true
        }
    }
    return false
}

/** True when two rings share any area: an edge crossing, or one ring's vertex inside the other. */
export function ringsOverlap(a: LatLng[], b: LatLng[]): boolean {
    const ra = openRing(a), rb = openRing(b)
    if (ra.length < 3 || rb.length < 3) return false
    for (let i = 0; i < ra.length; i++) {
        for (let j = 0; j < rb.length; j++) {
            if (segmentsIntersect(ra[i], ra[(i + 1) % ra.length], rb[j], rb[(j + 1) % rb.length])) return true
        }
    }
    return ra.some((p) => pointInRing(p, rb)) || rb.some((p) => pointInRing(p, ra))
}

/** Average of the ring's vertices (a marker position for an outline; not an area centroid). */
export function ringCenter(ring: LatLng[]): LatLng {
    const points = openRing(ring)
    const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
    return { lat: sum.lat / Math.max(1, points.length), lng: sum.lng / Math.max(1, points.length) }
}

/** Shortest distance (m) from a point to a ring's edges (0 when inside). Planar projection at the point's latitude. */
export function distanceToRingMeters(point: LatLng, ring: LatLng[]): number {
    const points = openRing(ring)
    if (points.length < 3) return Number.POSITIVE_INFINITY
    if (pointInRing(point, points)) return 0
    const mPerLat = 111_320
    const mPerLng = 111_320 * Math.cos(toRad(point.lat))
    const xy = (p: LatLng) => ({ x: (p.lng - point.lng) * mPerLng, y: (p.lat - point.lat) * mPerLat })
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < points.length; i++) {
        const a = xy(points[i]), b = xy(points[(i + 1) % points.length])
        const dx = b.x - a.x, dy = b.y - a.y
        const len2 = dx * dx + dy * dy
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2))
        best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy))
    }
    return best
}
