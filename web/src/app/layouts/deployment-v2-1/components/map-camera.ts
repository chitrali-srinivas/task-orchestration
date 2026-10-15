// PORT-BOUND — Deployment V2.1's map camera: the room its overlays need, and the explicit fly-to-plot transition.
// V2.1's own copy (V2's map-camera.ts is shared with the Samples detail map and stays unchanged). V2.1 change: direct
// camera moves without an unnecessary zoom-out / zoom-in (see flyToPlot).
import type * as React from "react"

// ── V2: map ↔ list navigation motion (transition only; what is selected is decided elsewhere) ──────────────────

/** The user asked for reduced motion: navigation still happens, without animation. */
export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

/** Camera zooms for a focused plot: a point (GPS only) at a close, still readable zoom; an outline fitted within these. */
const FOCUS_POINT_ZOOM = 19
const FOCUS_MIN_ZOOM = 16
const FOCUS_MAX_ZOOM = 20
/** V2.1: the longest glide (in map sizes) the camera makes without zooming out first. */
const DIRECT_GLIDE_SCREENS = 1.5
/** One zoom level per step (each animates); quicker steps on a long leg so a trip stays short. */
const zoomStepMs = (steps: number) => (steps > 4 ? 95 : 130)
/** The least room kept for the map's overlays when the camera frames plots, beside the sheet (a full-height map). */
const MAP_OVERLAY_PADDING = { top: 64, right: 24, bottom: 144, left: 24 }
/** V2.1: …and in the sheet (below 1024 px the map is short): its overlays are measured, so the floor stays small. */
const COMPACT_OVERLAY_PADDING = { top: 16, right: 16, bottom: 16, left: 16 }
const COMPACT_MAP_HEIGHT = 440
/** Clear space between a framed plot and an overlay: the largest marker's radius with its ring (42 px icon), and a little air. */
const OVERLAY_CLEARANCE = 24
/** A dispatch's plots: framed with a little more air than the farmer view, never closer than a field's zoom. */
const GROUP_AIR = { v: 24, h: 32 }
const GROUP_MAX_ZOOM = 18
export type Padding = number | { top: number; right: number; bottom: number; left: number }

/**
 * Room for the map's overlays when the camera frames plots (the farmer view, a dispatch's plots, one plot): measured,
 * since the legend grows with its source rows. Beside the sheet (a full-height map) exactly as before: the bottom clears
 * the legend's top; the top keeps its floor. In the sheet (a short map, below 1024 px) the legend and the plot card are
 * under the map, not on it, so only the control group on the map is cleared, with a smaller floor. Never more than ~45 %
 * of the map's height a side, so a small map still frames something.
 */
export function overlayPadding(map: google.maps.Map, air = { v: 0, h: 0 }): { top: number; right: number; bottom: number; left: number } {
    const div = map.getDiv()
    const box = div.getBoundingClientRect()
    const panel = div.closest(".map-preview-module") ?? div.parentElement
    /** An overlay's box, when it is on the map (not beside or under it). */
    const onMap = (selector: string) => {
        const r = panel?.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
        return r && r.height > 0 && r.top < box.bottom - 1 && r.bottom > box.top + 1 ? r : null
    }
    const compact = box.height < COMPACT_MAP_HEIGHT
    const legend = onMap("[data-map-legend]"), controls = compact ? onMap("[data-map-controls]") : null
    const floor = compact ? COMPACT_OVERLAY_PADDING : MAP_OVERLAY_PADDING
    const cap = Math.max(floor.bottom, Math.round(box.height * 0.45))
    const bottomEdge = Math.min(legend?.top ?? Infinity, controls?.top ?? Infinity)
    const bottom = Number.isFinite(bottomEdge) ? Math.ceil(box.bottom - bottomEdge) + OVERLAY_CLEARANCE : 0
    return {
        top: floor.top + air.v,
        right: floor.right + air.h,
        bottom: Math.min(cap, Math.max(floor.bottom, bottom)) + air.v,
        left: floor.left + air.h,
    }
}

/** The zoom at which `bounds` fits the map inside `padding` px (one value, or per side) (Web Mercator, 256-px tiles). */
function zoomToFit(map: google.maps.Map, bounds: google.maps.LatLngBounds, padding: Padding): number {
    const div = map.getDiv()
    const pad = typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding
    const width = Math.max(1, div.clientWidth - pad.left - pad.right), height = Math.max(1, div.clientHeight - pad.top - pad.bottom)
    const ne = bounds.getNorthEast(), sw = bounds.getSouthWest()
    const latRad = (lat: number) => {
        const sin = Math.sin((lat * Math.PI) / 180)
        const rad = Math.log((1 + sin) / (1 - sin)) / 2
        return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2
    }
    const latFraction = Math.max(1e-9, (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI)
    const lngDiff = ne.lng() - sw.lng()
    const lngFraction = Math.max(1e-9, (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360)
    const fit = (px: number, fraction: number) => Math.floor(Math.log(px / 256 / fraction) / Math.LN2)
    return Math.min(fit(height, latFraction), fit(width, lngFraction))
}

/** Screen distance (px) between two points at `zoom` (Web Mercator; small-distance approximation). */
function pixelsApart(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral, zoom: number): number {
    const perDegree = (256 * 2 ** zoom) / 360
    const dx = (b.lng - a.lng) * perDegree
    const dy = ((b.lat - a.lat) / Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)) * perDegree
    return Math.hypot(dx, dy)
}

/**
 * The camera centre that shows `center` in the middle of the padded box (not of the whole map) at `zoom`: with a taller
 * bottom padding the content sits a little higher, clear of the legend.
 */
function paddedCenter(center: google.maps.LatLngLiteral, zoom: number, pad: { top: number; right: number; bottom: number; left: number }): google.maps.LatLngLiteral {
    const scale = 256 * 2 ** zoom
    const sin = Math.sin((center.lat * Math.PI) / 180)
    const x = (center.lng / 360 + 0.5) * scale - (pad.left - pad.right) / 2
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale - (pad.top - pad.bottom) / 2
    const lng = (x / scale - 0.5) * 360
    const lat = (2 * Math.atan(Math.exp((0.5 - y / scale) * 2 * Math.PI)) - Math.PI / 2) * (180 / Math.PI)
    return { lat, lng }
}

/**
 * What the camera focuses: one plot (its real location, and its outline when it has one) or — for a dispatch with
 * several located plots — all of them (`group`: their locations and outline points). Never invented.
 */
export interface CameraFocus {
    seq: number
    location: google.maps.LatLngLiteral
    path?: google.maps.LatLngLiteral[]
    /** A dispatch's plots (2+ points): the camera fits them all instead of one plot. */
    group?: google.maps.LatLngLiteral[]
    /** The map plot's id (one plot). */
    plotId?: string
    /** The markers that bounce once the camera arrives, and the selection they belong to (a newer one wins). */
    bounceIds?: string[]
    owner?: number
    kind?: "dispatch" | "deployment"
}

/**
 * Moves the camera to a plot as one explicit transition (the latest selection wins; a cancel stops everything):
 *   1. current camera → 2. target (an outline's centre, else the plot's location) and its final zoom (outline fitted
 *   within 16–20; a point at 19) → 3. a travel zoom → 4. zoom OUT, only when needed → 5. glide to the target →
 *   6. zoom IN to the final zoom, when needed → 7. `onArrive` (the target marker's highlight) → 8. stable.
 * V2.1 travel zoom: the lower of the start and final zooms — so the zoom only ever goes one way — unless the glide there
 * would exceed 1.5 map sizes (a long trip), which zooms out only the levels needed to shorten it. The same place at the
 * final zoom is no move at all. Reduced motion: one instant camera move.
 */
export function flyToPlot(map: google.maps.Map, target: CameraFocus, programmatic: React.MutableRefObject<boolean>, onArrive?: () => void): () => void {
    let cancelled = false
    let raf = 0
    const timers = new Set<number>()
    const wait = (ms: number) => new Promise<void>((resolve) => {
        const t = window.setTimeout(() => { timers.delete(t); resolve() }, ms)
        timers.add(t)
    })
    const cancel = () => {
        cancelled = true
        cancelAnimationFrame(raf)
        timers.forEach((t) => clearTimeout(t))
        timers.clear()
        programmatic.current = false
    }
    const group = target.group && target.group.length >= 2 ? target.group.reduce((b, p) => b.extend(p), new google.maps.LatLngBounds()) : null
    const bounds = group ?? (target.path && target.path.length >= 3 ? target.path.reduce((b, p) => b.extend(p), new google.maps.LatLngBounds()) : null)
    // a dispatch's plots: fitted inside the overlay-aware padding, at most a field's zoom; one plot: as before
    const groupPadding = overlayPadding(map, GROUP_AIR)
    const goal = group ? Math.min(GROUP_MAX_ZOOM, Math.max(3, zoomToFit(map, group, groupPadding)))
        : bounds ? Math.min(FOCUS_MAX_ZOOM, Math.max(FOCUS_MIN_ZOOM, zoomToFit(map, bounds, 56))) : FOCUS_POINT_ZOOM
    const center = group ? paddedCenter(group.getCenter().toJSON(), goal, groupPadding) : bounds ? bounds.getCenter().toJSON() : target.location
    const startZoom = Math.round(map.getZoom() ?? goal)
    const from = map.getCenter()?.toJSON() ?? center
    // Already there (the same plot again): no camera move, only the arrival highlight.
    if (startZoom === goal && pixelsApart(from, center, startZoom) < 3) {
        onArrive?.()
        return cancel
    }
    programmatic.current = true
    const finish = () => {
        if (cancelled) return
        const t = window.setTimeout(() => { if (!cancelled) programmatic.current = false }, 200)
        timers.add(t)
        onArrive?.()
    }
    if (prefersReducedMotion()) {
        map.moveCamera({ center, zoom: goal })
        finish()
        return cancel
    }
    // V2.1 (backlog C): a direct move whenever it is enough — no zoom-out-then-in for a nearby target. The camera never
    // goes below the lower of the start and final zooms unless the glide there would be longer than DIRECT_GLIDE_SCREENS:
    //   zooming out (goal < start): zoom out to the goal first, then glide;
    //   zooming in (goal >= start): glide at the current zoom, then zoom in;
    //   a long trip: zoom out only the levels that bring the glide back within DIRECT_GLIDE_SCREENS, glide, zoom in.
    // (V2 always left a close view by at least two zoom levels before travelling.)
    let travel = Math.min(startZoom, goal)
    const div = map.getDiv()
    const reach = DIRECT_GLIDE_SCREENS * Math.max(1, div.clientWidth, div.clientHeight)
    const trip = pixelsApart(from, center, travel)
    if (trip > reach) travel = Math.max(3, travel - Math.ceil(Math.log2(trip / reach)))
    const glide = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral, ms: number) => new Promise<void>((resolve) => {
        const start = performance.now()
        const step = (now: number) => {
            if (cancelled) return resolve()
            const k = Math.min(1, (now - start) / ms)
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 // ease-in-out: leaves, travels, settles
            map.moveCamera({ center: { lat: a.lat + (b.lat - a.lat) * e, lng: a.lng + (b.lng - a.lng) * e } })
            if (k < 1) raf = requestAnimationFrame(step)
            else resolve()
        }
        raf = requestAnimationFrame(step)
    })
    const zoomTo = async (to: number) => {
        let zoom = Math.round(map.getZoom() ?? startZoom)
        const stepMs = zoomStepMs(Math.abs(to - zoom))
        while (!cancelled && zoom !== to) {
            zoom += zoom < to ? 1 : -1
            map.setZoom(zoom)
            await wait(stepMs)
        }
    }
    void (async () => {
        if (travel < startZoom) await zoomTo(travel) // 4. zoom out only when the move needs it (never up-then-down)
        if (cancelled) return
        const here = map.getCenter()?.toJSON() ?? from
        const distance = pixelsApart(here, center, travel)
        // 5. travel — judged at the FINAL zoom: a sub-pixel offset at the travel zoom is many pixels once zoomed in
        if (pixelsApart(here, center, goal) >= 1) await glide(here, center, Math.min(650, Math.max(300, 260 + distance * 0.5)))
        else map.moveCamera({ center }) // already there even at the final zoom: just make it exact
        if (cancelled) return
        await zoomTo(goal) // 6. arrive
        finish() // 7–8
    })()
    return cancel
}
