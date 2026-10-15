"use client"

// Deployment V2 — the detail map's overlays, in the detail's own ShadCN / Zinc language: the legend (what marker colour
// / size mean) and the one-plot details card. Only the marker swatches carry data colours (source); the surfaces,
// type, buttons and badges are the panel's.
import * as React from "react"
import { PencilRuler, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { MapPlot } from "../data/map-data"
import type { TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import type { ClassifiedDispatch } from "./deployment-dispatch-view"
import { DetailRow, DispatchViewBadge, fieldValue } from "./deployment-details-panel"
import { dispatchLabel, plotLabel } from "./deployment-field-cards"
import type { DeploymentTypeConfig } from "./deployment-types"
import { NO_SOURCE_STROKE, formatAmount, type AmountScale, type SourceLegendEntry } from "./map-markers"

/** The panel's detail row, compact for a card floating on the map (a narrower label column, tighter rows); in the sheet
 *  (below lg) label over value, three to a line, so the card under the map stays short. */
const CARD_ROW = "grid-cols-[104px_minmax(0,1fr)] gap-2 px-1.5 py-px max-lg:grid-cols-1 max-lg:gap-0 max-lg:py-0.5 max-lg:leading-4 max-lg:odd:bg-transparent max-lg:dark:odd:bg-transparent max-lg:[&_[data-detail-label]]:text-[10px]"
/** The panel's section label (DetailList title). */
const SECTION_LABEL = "text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none"

/** A source swatch: the marker's own look (filled circle, or the hollow dashed one for "not recorded"). */
function Swatch({ color, size = 10 }: { color: string | null; size?: number }) {
    return (
        <span
            aria-hidden
            className="inline-block shrink-0 rounded-full"
            style={color ? { width: size, height: size, background: color, boxShadow: "0 0 0 1.5px white, 0 0 0 2.5px rgba(0,0,0,0.12)" } : { width: size, height: size, background: "white", border: `1.5px dashed ${NO_SOURCE_STROKE}` }}
        />
    )
}

/**
 * A one-line label that truncates; when cut, its full text is a tooltip (the detail's tooltip, not a native title).
 * The same span is rendered either way (only the tooltip's content comes and goes), so the size observer keeps
 * measuring the element on screen.
 */
function TruncatedLabel({ text }: { text: string }) {
    const ref = React.useRef<HTMLSpanElement>(null)
    const [cut, setCut] = React.useState(false)
    React.useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const measure = () => setCut(el.scrollWidth > el.clientWidth + 1)
        measure()
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
        observer?.observe(el)
        return () => observer?.disconnect()
    }, [text])
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span ref={ref} data-full-name={text} data-truncated={cut ? "" : undefined} className="truncate min-w-0">{text}</span>
            </TooltipTrigger>
            {cut && <TooltipContent side="top" className="max-w-[16rem] text-xs [overflow-wrap:anywhere]">{text}</TooltipContent>}
        </Tooltip>
    )
}

const LEGEND_SOURCES = 4

/**
 * What the markers mean — Deployment V2's legend (deployment-v2-oct-26 map-overlays.tsx MapLegend): two stacked sections,
 * colour = source / material (at most four rows; long names truncate, the full name in a tooltip; "+n more"), then size
 * = the type's deployed amount (the smallest and largest recorded, at their real marker sizes). Beside the sheet (lg)
 * the same card bottom-left on the map, above Google's logo; in the sheet (below lg) a strip under the map with the two
 * sections side by side, so it never covers the map.
 */
export function MapLegend({ sources, scale, amountLabel, className }: { sources: SourceLegendEntry[]; scale: AmountScale; amountLabel: string | null; className?: string }) {
    const shown = sources.slice(0, LEGEND_SOURCES)
    const more = sources.length - shown.length
    return (
        <TooltipProvider delayDuration={200}>
            <Card data-map-legend className={cn(
                "relative w-full shrink-0 rounded-none border-0 border-t border-zinc-100 dark:border-zinc-800 shadow-none bg-white dark:bg-zinc-950 px-3 py-2 text-left pointer-events-auto grid grid-cols-2 gap-x-4",
                "lg:absolute lg:left-2 lg:bottom-7 lg:z-10 lg:block lg:w-[min(13.75rem,calc(100%-1rem))] lg:px-2.5 lg:py-2 lg:space-y-1.5 lg:rounded-lg lg:border lg:border-zinc-200 dark:lg:border-zinc-800 lg:shadow-md",
                className
            )}>
                <div className="min-w-0">
                    <p className={SECTION_LABEL}>Colour · source</p>
                    <ul className="mt-0.5 space-y-0.5">
                        {shown.map((entry) => (
                            <li key={String(entry.source)} data-legend-source={entry.source === null ? "none" : entry.source === "other" ? "other" : entry.source} className="flex items-center gap-1.5 min-w-0 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                                <Swatch color={entry.color} />
                                <TruncatedLabel text={entry.label} />
                            </li>
                        ))}
                        {more > 0 && <li className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">+{more} more</li>}
                        {shown.length === 0 && <li className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">No plots on the map</li>}
                    </ul>
                </div>
                <Separator className="bg-zinc-100 dark:bg-zinc-800 max-lg:hidden" />
                <div className="min-w-0">
                    <p className={SECTION_LABEL}>Size · <span data-legend-amount>{amountLabel ?? "amount"}</span></p>
                    {scale.range && amountLabel ? (
                        <div data-legend-size className="mt-0.5 flex items-center gap-2 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                            {/* the markers' own sizes for the smallest and largest recorded amounts */}
                            <span data-legend-min className="inline-flex items-center gap-1"><span aria-hidden className="inline-block rounded-full bg-zinc-300 dark:bg-zinc-600" style={{ width: scale.diameterOf(scale.range.min), height: scale.diameterOf(scale.range.min) }} />{formatAmount(scale.range.min)}</span>
                            {scale.range.max > scale.range.min && (
                                <>
                                    <span aria-hidden className="text-zinc-300 dark:text-zinc-600">→</span>
                                    <span data-legend-max className="inline-flex items-center gap-1"><span aria-hidden className="inline-block rounded-full bg-zinc-300 dark:bg-zinc-600" style={{ width: scale.diameterOf(scale.range.max), height: scale.diameterOf(scale.range.max) }} />{formatAmount(scale.range.max)}</span>
                                </>
                            )}
                        </div>
                    ) : (
                        <p data-legend-size="none" className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">Not recorded — markers at the smallest size</p>
                    )}
                </div>
            </Card>
        </TooltipProvider>
    )
}

/** The plot behind the selected map plot: its dispatch, the dispatch plot and the dispatch's classification. */
export interface SelectedDeployment {
    dispatch: TrailerDispatchItem
    plot: TrailerDeploymentPlot
    view: ClassifiedDispatch | null
}

/**
 * ONE selected plot, compact (top-right of the map), as a detail card: its deployment id, a few key facts from the
 * type's own plot fields (the panel's label + value rows; no picture, no coordinates — the map is the location), its
 * source with the marker's colour, the dispatch it belongs to with its state badge, and what an open report names on
 * it. Values wrap; the card scrolls within the map's height. A demo-map plot without a dispatch plot shows only what
 * the map data has.
 */
export function PlotMapCard({ mapPlot, deployment, deploymentType, color, correctionFields, onClose, onEditBoundary }: {
    mapPlot: MapPlot
    deployment: SelectedDeployment | null
    deploymentType: DeploymentTypeConfig
    color: string | null
    /** Field ids an open report names (red rows). */
    correctionFields: ReadonlySet<string>
    onClose: () => void
    /** Set when the signed-in verifier may edit this plot's boundary. */
    onEditBoundary?: () => void
}) {
    // A card that has just appeared lets clicks through for a moment: a click meant for the map (picking the next marker
    // quickly) mustn't land on the card — let alone on its Edit button. The card is keyed by plot, so this re-arms per plot.
    const [armed, setArmed] = React.useState(false)
    React.useEffect(() => {
        const timer = window.setTimeout(() => setArmed(true), 350)
        return () => window.clearTimeout(timer)
    }, [])
    const fields = deployment ? deploymentType.plotFieldItems(deployment.plot, deployment.dispatch.village_name) : null
    const rows = fields
        ? fields.items.filter((item) => item.type !== "image" && item.type !== "map" && fieldValue(item).trim() !== "").slice(0, 4).map((item) => ({ id: item.id, label: item.label, value: fieldValue(item), red: correctionFields.has(item.id) }))
        : [mapPlot.area > 0 ? { id: "area", label: "Plot area", value: `${mapPlot.area} Acres`, red: false } : null].filter((r): r is NonNullable<typeof r> => !!r)
    const reportedLocation = deployment && fields?.items.some((item) => item.type === "map" && correctionFields.has(item.id))
    const source = deployment ? deploymentType.dispatchSource(deployment.dispatch) : mapPlot.source
    const title = deployment ? plotLabel(deployment.plot) : mapPlot.name
    return (
        <Card
            data-plot-map-card={deployment ? deployment.plot.deployment_id : mapPlot.id}
            data-armed={armed ? "" : undefined}
            role="region"
            aria-label={`Selected plot ${title}`}
            className={cn(
                // V2.1: beside the sheet (lg) the card it always was, top-right on the map; in the sheet (below lg) a section
                // under the map — on a phone-sized map a floating card would cover the plot it describes
                "relative w-full shrink-0 rounded-none border-0 border-t border-zinc-100 dark:border-zinc-800 shadow-none bg-white dark:bg-zinc-950 overflow-x-hidden text-left animate-in fade-in duration-200 motion-reduce:animate-none",
                "lg:absolute lg:top-3 lg:right-3 lg:z-10 lg:w-[min(17rem,calc(100%-1.5rem))] lg:max-h-[calc(100%-1.5rem)] lg:overflow-y-auto lg:rounded-lg lg:border lg:border-zinc-200 dark:lg:border-zinc-800 lg:shadow-md lg:slide-in-from-top-2",
                !armed && "pointer-events-none"
            )}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose() } }}
        >
            {/* V2.1: the header — the plot's dispatch (its ID left, its status at the other end, one line; the only ID shown)
                and Close; the plot's own rows follow (Plot Number first; its deployment ID is the card's region name and the
                list row's header, not repeated here). A demo-map plot without a dispatch plot: its name and Close. */}
            <div data-plot-map-header className={cn("flex items-center gap-2 pl-3 pr-1.5 pt-1.5", deployment ? "pb-1 border-b border-zinc-100 dark:border-zinc-800" : "pb-1")}>
                {deployment ? (
                    <>
                        <span data-plot-map-dispatch={deployment.dispatch.dispatch_id} title={dispatchLabel(deployment.dispatch)} className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">{dispatchLabel(deployment.dispatch)}</span>
                        {deployment.view && <span data-plot-map-status className="shrink-0"><DispatchViewBadge view={deployment.view.view} /></span>}
                    </>
                ) : (
                    <p data-plot-map-title className="min-w-0 flex-1 font-bold text-sm leading-5 font-mono text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{title}</p>
                )}
                <Button
                    variant="ghost"
                    data-plot-map-close
                    aria-label="Close plot details"
                    title="Close plot details"
                    onClick={onClose}
                    className="h-7 w-7 p-0 shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <dl className="px-1.5 pt-0.5 pb-1.5 min-w-0 max-lg:grid max-lg:grid-cols-3 max-lg:gap-x-2 max-lg:gap-y-0.5">
                {rows.map((row) => (
                    <div key={row.id} data-plot-map-row={row.id.split(":")[0]}>
                        <DetailRow id={row.id.split(":")[0]} label={row.label} correctionId={row.red ? row.id : undefined} className={CARD_ROW}>{row.value}</DetailRow>
                    </div>
                ))}
                <div data-plot-map-row="source" className="max-lg:col-span-2">
                    <DetailRow id="source" label="Source" className={CARD_ROW}>
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Swatch color={color} size={9} />
                            <span className={cn("[overflow-wrap:anywhere]", !source && "text-zinc-500 dark:text-zinc-400")}>{source ?? "Not recorded"}</span>
                        </span>
                    </DetailRow>
                </div>
                {reportedLocation && (
                    <p data-plot-map-reported className="max-lg:col-span-2 px-2 pt-0.5 text-[11px] leading-4 font-medium text-red-700 dark:text-red-300">GPS Coordinates reported</p>
                )}
            </dl>
            {onEditBoundary && (
                <div className="px-2 pb-2">
                    <Button variant="outline" data-edit-boundary onClick={onEditBoundary} className="h-7 w-full gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                        <PencilRuler className="h-3.5 w-3.5" />
                        {mapPlot.path && mapPlot.path.length >= 3 ? "Edit plot boundary" : "Draw plot boundary"}
                    </Button>
                </div>
            )}
        </Card>
    )
}
