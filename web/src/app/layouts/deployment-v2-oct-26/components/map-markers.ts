// Deployment V2 — what a plot marker encodes: source / material → colour, deployed amount → size. The map draws the
// normalized values each map plot carries (map-data.ts MapPlotSemantics); nothing here knows a deployment type.
//   Colour  categorical, in a fixed order: the record's distinct sources, sorted by name, take slots 1–3 of a
//           palette validated for a scatter-like map (all pairs distinguishable, colour-vision deficiencies included);
//           a fourth or later source folds into "Other sources" (a neutral); a plot without a source is a hollow grey
//           circle — "not recorded" is never told by colour alone. The same record always paints the same source the
//           same way; nothing is random or per render.
//   Size    area-proportional and zero-based (circle area ∝ amount relative to the record's largest), bounded so a
//           large deployment can't dominate and a small one stays clickable; a plot without an amount takes the
//           minimum size. All circles; selection (ring / opacity / z-index / bounce) is layered on top.
import type { MapPlot } from "../data/map-data"

/** Categorical slots 1–3 (blue, orange, aqua): pass every all-pairs check of the data-viz validator in light mode. */
export const SOURCE_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a"] as const
/** The fold for a fourth or later source: a neutral, separated from all three slots by lightness. */
export const OTHER_SOURCE_COLOR = "#52514e"
/** A plot whose source was not recorded: hollow, a dashed grey outline. */
export const NO_SOURCE_STROKE = "#8a8984"

/** Marker diameters (px): every marker stays easy to click; the largest stays a marker, not a blob. */
export const MARKER_MIN_D = 14
export const MARKER_MAX_D = 30

export interface SourceLegendEntry {
    /** The source as the data names it; null: not recorded; "other": the fold. */
    source: string | null | "other"
    label: string
    /** Fill colour; null: hollow (not recorded). */
    color: string | null
    plots: number
}

export interface SourceColors {
    colorOf: (source: string | null) => string | null
    legend: SourceLegendEntry[]
}

const key = (source: string) => source.trim().toLowerCase()

/** Colour per source for one record's map plots (fixed order: sorted by name; slots 1–3, then "Other sources"). */
export function sourceColors(plots: MapPlot[]): SourceColors {
    const counts = new Map<string, { name: string; plots: number }>()
    let unknown = 0
    for (const plot of plots) {
        if (!plot.source) { unknown++; continue }
        const k = key(plot.source)
        const entry = counts.get(k) ?? { name: plot.source.trim(), plots: 0 }
        entry.plots++
        counts.set(k, entry)
    }
    const sorted = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
    const slot = new Map(sorted.map(([k], i) => [k, i < SOURCE_PALETTE.length ? SOURCE_PALETTE[i] : OTHER_SOURCE_COLOR]))
    const legend: SourceLegendEntry[] = sorted.slice(0, SOURCE_PALETTE.length).map(([, e], i) => ({ source: e.name, label: e.name, color: SOURCE_PALETTE[i], plots: e.plots }))
    const folded = sorted.slice(SOURCE_PALETTE.length)
    if (folded.length > 0) legend.push({ source: "other", label: `Other sources (${folded.length})`, color: OTHER_SOURCE_COLOR, plots: folded.reduce((n, [, e]) => n + e.plots, 0) })
    if (unknown > 0) legend.push({ source: null, label: "Source not recorded", color: null, plots: unknown })
    return { colorOf: (source) => (source ? slot.get(key(source)) ?? OTHER_SOURCE_COLOR : null), legend }
}

export interface AmountScale {
    diameterOf: (amount: number | null) => number
    /** The recorded range (for the legend); null when no plot has an amount. */
    range: { min: number; max: number } | null
}

/**
 * Size per amount for one record's map plots: zero-based and area-proportional — the circle's area ∝ amount / ref, where
 * ref is the record's largest amount (its 95th percentile when there are 10+ amounts, so one outlier can't shrink every
 * other marker). Near-equal amounts look near-equal; a small amount stays at least MARKER_MIN_D; nothing exceeds
 * MARKER_MAX_D. A plot without an amount takes MARKER_MIN_D.
 */
export function amountScale(plots: MapPlot[]): AmountScale {
    const values = plots.map((p) => p.amount).filter((a): a is number => typeof a === "number" && a > 0).sort((a, b) => a - b)
    if (values.length === 0) return { diameterOf: () => MARKER_MIN_D, range: null }
    const ref = values.length >= 10 ? values[Math.floor(0.95 * (values.length - 1))] : values[values.length - 1]
    return {
        diameterOf: (a) => (!a || a <= 0 ? MARKER_MIN_D : Math.round(MARKER_MIN_D + (MARKER_MAX_D - MARKER_MIN_D) * Math.sqrt(Math.min(a, ref) / ref))),
        range: { min: values[0], max: values[values.length - 1] },
    }
}

export type MarkerEmphasis = "selected" | "group" | null

/** Room around the circle for the selection ring (the icon grows by this on each side; the circle itself doesn't). */
const RING_PAD = 6

/**
 * A circular marker: the semantic fill (null: hollow, dashed grey) at the semantic diameter, a 2px white surface ring
 * (contrast on satellite imagery), and — when selected / in the selected dispatch — an emerald ring outside it.
 */
export function markerIcon(fill: string | null, diameter: number, emphasis: MarkerEmphasis): google.maps.Icon {
    const size = diameter + 2 * RING_PAD
    const c = size / 2, r = diameter / 2
    const body = fill
        ? `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${fill}" stroke="white" stroke-width="2"/>`
        : `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="white" fill-opacity="0.9" stroke="${NO_SOURCE_STROKE}" stroke-width="2" stroke-dasharray="3 2"/>`
    const ring = emphasis === "selected"
        ? `<circle data-ring="selected" cx="${c}" cy="${c}" r="${r + 2.5}" fill="none" stroke="#059669" stroke-width="3.5"/>`
        : emphasis === "group"
            ? `<circle data-ring="group" cx="${c}" cy="${c}" r="${r + 2}" fill="none" stroke="#34d399" stroke-width="3"/>`
            : ""
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}${ring}</svg>`
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(c, c),
    }
}

/** A compact amount for the legend ("0.5", "12", "1.25"). */
export const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100))
