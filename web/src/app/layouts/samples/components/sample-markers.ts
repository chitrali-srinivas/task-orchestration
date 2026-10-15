// Samples — what a sample marker encodes. No new palette:
//   Colour = purpose, Matic's existing per-purpose sample colours (matic-dash lib/utils.ts getSampleColorBySampleType,
//            keyed there by the legacy table names). Matic's harvest value is the invalid "##7D55FF"; the intended
//            #7D55FF is used. Matic has no EO5Y colour (it falls to the default #FFA07A) — kept, and listed as an open
//            question.
//   Shape  = sample kind: deployment samples are circles, control samples are diamonds (shape, not another colour).
//   Ring   = Deployment V2's selection treatment (white surface ring; emerald #059669 selected, #34d399 group).
// Plot outlines follow Deployment V2: an existing plot polygon is white; the boundary being drawn is green #22c55e.
import type { SampleKind, SamplePurpose } from "../domain/types"

export const PURPOSE_COLOR: Record<SamplePurpose, string> = {
    pre: "#FF5733",
    start: "#A6F0C6",
    harvest: "#7D55FF",
    eoy: "#FFBF00",
    eo3y: "#2E86AB",
    eo5y: "#FFA07A",
}

/** Deployment V2 map-overlay / polygon colours (deployment-detail-sheet.tsx MapPreviewContent, plot-boundary-editor.tsx). */
export const PLOT_OUTLINE = "#ffffff"
export const PLOT_OUTLINE_SELECTED = "#22c55e"
export const RING_SELECTED = "#059669"
export const RING_GROUP = "#34d399"
/** Deployment V2's "not recorded" stroke — a sample whose verification is closed (approved / rejected) is drawn hollow. */
export const MUTED_STROKE = "#8a8984"

export const MARKER_DIAMETER = 18
const RING_PAD = 6

export type SampleMarkerEmphasis = "selected" | "group" | null

/**
 * A sample marker: purpose colour, kind shape, white surface ring, emphasis ring. `muted` (not in the detail's current
 * status view) draws the shape hollow in the purpose colour, so it stays identifiable but steps back.
 */
export function sampleMarkerIcon(purpose: SamplePurpose | null, kind: SampleKind, emphasis: SampleMarkerEmphasis, muted = false): google.maps.Icon {
    const color = purpose ? PURPOSE_COLOR[purpose] : MUTED_STROKE
    const d = MARKER_DIAMETER
    const size = d + 2 * RING_PAD
    const c = size / 2, r = d / 2
    const fill = muted ? "white" : color
    const stroke = muted ? color : "white"
    const body = kind === "deployment"
        ? `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${fill}" fill-opacity="${muted ? 0.85 : 1}" stroke="${stroke}" stroke-width="2"/>`
        : `<rect x="${c - (r - 2)}" y="${c - (r - 2)}" width="${2 * (r - 2)}" height="${2 * (r - 2)}" rx="2" transform="rotate(45 ${c} ${c})" fill="${fill}" fill-opacity="${muted ? 0.85 : 1}" stroke="${stroke}" stroke-width="2"/>`
    const ring = emphasis === "selected"
        ? `<circle cx="${c}" cy="${c}" r="${r + 2.5}" fill="none" stroke="${RING_SELECTED}" stroke-width="3.5"/>`
        : emphasis === "group"
            ? `<circle cx="${c}" cy="${c}" r="${r + 2}" fill="none" stroke="${RING_GROUP}" stroke-width="3"/>`
            : ""
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}${ring}</svg>`
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(c, c),
    }
}

/** Cluster bubble: the detail's zinc surface (zinc-900 disc, white count), sized by member count. Data URI, no CDN. */
export function clusterIconUrl(diameter: number): string {
    const c = diameter / 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}"><circle cx="${c}" cy="${c}" r="${c - 1.5}" fill="#18181b" fill-opacity="0.92" stroke="white" stroke-width="2.5"/></svg>`
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
