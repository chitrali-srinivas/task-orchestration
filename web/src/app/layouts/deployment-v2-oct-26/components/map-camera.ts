// PORT-BOUND — Deployment V2's map camera: the room its overlays need, and the explicit fly-to-plot transition.
// Shared by the Deployment V2 detail sheet and the Samples detail map (src/app/layouts/samples) — one motion system.
import type * as React from "react"

// ── V2: map ↔ list navigation motion (transition only; what is selected is decided elsewhere) ──────────────────

/** The user asked for reduced motion: navigation still happens, without animation. */
export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

/** Camera zooms for a focused plot: a point (GPS only) at a close, still readable zoom; an outline fitted within these. */
const FOCUS_POINT_ZOOM = 19
const FOCUS_MIN_ZOOM = 16
const FOCUS_MAX_ZOOM = 20
/** One zoom level per step (each animates); quicker steps on a long leg so a trip stays short. */
const zoomStepMs = (steps: number) => (steps > 4 ? 95 : 130)
/** The least room kept for the map's overlays when the camera frames plots (top-left buttons, bottom-left legend). */
const MAP_OVERLAY_PADDING = { top: 64, right: 24, bottom: 144, left: 24 }
/** Clear space between a framed plot and an overlay: the largest marker's radius with its ring (42 px icon), and a little air. */
const OVERLAY_CLEARANCE = 24
/** A dispatch's plots: framed with a little more air than the farmer view, never closer than a field's zoom. */
const GROUP_AIR = { v: 24, h: 32 }
const GROUP_MAX_ZOOM = 18
export type Padding = number | { top: number; right: number; bottom: number; left: number }

/**
 * Room for the map's overlays when the camera frames plots (the farmer view, a dispatch's plots): measured, since the
 * legend grows with its source rows — the bottom clears the legend's top, the top clears the buttons. Never more than
 * ~45 % of the map's height a side, so a small map still frames something.
 */
export function overlayPadding(map: google.maps.Map, air = { v: 0, h: 0 }): { top: number; right: number; bottom: number; left: number } {
    const div = map.getDiv()
    const box = div.getBoundingClientRect()
    const host = div.parentElement
    const legend = host?.querySelector<HTMLElement>("[data-map-legend]")?.getBoundingClientRect()
    const controls = host?.querySelector<HTMLElement>("[data-map-controls]")?.getBoundingClientRect()
    const cap = Math.max(MAP_OVERLAY_PADDING.bottom, Math.round(box.height * 0.45))
    const bottom = legend && legend.height > 0 ? Math.ceil(box.bottom - legend.top) + OVERLAY_CLEARANCE : 0
    const top = controls && controls.height > 0 ? Math.ceil(controls.bottom - box.top) + OVERLAY_CLEARANCE : 0
    return {
        top: Math.min(cap, Math.max(MAP_OVERLAY_PADDING.top, top)) + air.v,
        right: MAP_OVERLAY_PADDING.right + air.h,
        bottom: Math.min(cap, Math.max(MAP_OVERLAY_PADDING.bottom, bottom)) + air.v,
        left: MAP_OVERLAY_PADDING.left + air.h,
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

/** The point lies in the middle of the current view (the inner 60 %): a short hop, no need to leave the view. */
function inMiddleOfView(map: google.maps.Map, point: google.maps.LatLngLiteral): boolean {
    const view = map.getBounds()
    if (!view) return false
    const ne = view.getNorthEast(), sw = view.getSouthWest()
    const dLat = (ne.lat() - sw.lat()) * 0.2, dLng = (ne.lng() - sw.lng()) * 0.2
    return point.lat > sw.lat() + dLat && point.lat < ne.lat() - dLat && point.lng > sw.lng() + dLng && point.lng < ne.lng() - dLng
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
 *   within 16–20; a point at 19) → 3. a travel zoom → 4. zoom OUT step by step, staying on the current place →
 *   5. glide to the target at the travel zoom → 6. zoom IN step by step to the final zoom → 7. `onArrive` (the target
 *   marker's highlight) → 8. stable.
 * Travel zoom: low enough to show where the camera comes from and where it goes; from a close view (zoom ≥ 16) at least
 * two levels out, so it visibly leaves the old place. A target already in the middle of the view is a short hop (no
 * zoom out); the same place at the final zoom is no move at all. Reduced motion: one instant camera move.
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
    let travel = startZoom
    if (!inMiddleOfView(map, center)) {
        const both = new google.maps.LatLngBounds().extend(from).extend(center)
        if (bounds) both.union(bounds)
        travel = Math.min(startZoom, zoomToFit(map, both, 72))
        if (startZoom >= FOCUS_MIN_ZOOM) travel = Math.min(travel, startZoom - 2)
        travel = Math.max(3, travel)
    }
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
        await zoomTo(travel) // 4. leave the current place
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
