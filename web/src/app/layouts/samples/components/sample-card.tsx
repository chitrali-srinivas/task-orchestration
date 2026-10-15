"use client"

// Samples — one sample in the detail list, built from Deployment V2's card primitives (deployment-details-panel.tsx):
// the same Card, toggle header (mono id + date line, state badge, icon actions, More menu, chevron), one truncated
// summary line while collapsed, the V2 footers (verified line / CorrectionBlock), and an expanded body of
// DetailList + DetailRow rows (a reported value red in place), the media field, CommentPreview, and V2's actions —
// Report puts the card in REPORT MODE (its reportable values become selectable, then "Report Selected (n)" opens the
// finalize dialog), Approve asks for confirmation. Only the content is sample-specific.
import * as React from "react"
import { format } from "date-fns"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Info, MessageSquareText } from "lucide-react"
import type { SurveyItem } from "@/app/components/survey/SurveyComponents"
import {
    CardIconAction,
    CardMoreMenu,
    CommentPreview,
    CorrectionBlock,
    DetailList,
    DetailRow,
    HistoryIndicator,
    PlotThumbnail,
    ReportFieldOption,
    SurveyorCell,
    type CardAction,
} from "@/app/layouts/deployment-v2-oct-26/components/deployment-details-panel"
import type { CorrectionContext } from "@/app/layouts/deployment-v2-oct-26/components/deployment-dispatch-view"
import { mediaFileName } from "@/app/layouts/deployment-v2-oct-26/components/deployment-media"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { BOUNDARY_LABEL, KIND_LABEL, PURPOSE_LABEL, REPORTABLE_FIELD_LABEL, formatLatLng, personName } from "../domain/labels"
import { REPORTABLE_FIELDS, type ReportableField, type Sample } from "../domain/types"
import { BucketBadge, toHoverPerson } from "./columns"

const when = (ms: number | null) => (ms ? format(new Date(ms), "dd MMM yyyy") : null)
const whenTime = (ms: number | null) => (ms ? format(new Date(ms), "dd MMM yyyy, hh:mm a") : null)
/** V2's card footer divider. */
const FOOTER = "mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60"

/** The sample's photo as the SurveyItem V2's media pieces read. */
const photoItem = (sample: Sample): SurveyItem => ({ id: `picture:${sample.sample_id}`, question: "Sample picture", label: "Sample Picture", type: "image", answer: sample.picture_url ?? "" } as SurveyItem)

/** The reportable values of a sample, in V2's report-option shape (label + value). */
function reportableItems(sample: Sample): SurveyItem[] {
    return [
        { id: "sample_id", question: "Sample ID", label: REPORTABLE_FIELD_LABEL.sample_id, type: "text", answer: sample.sample_code ?? "Not recorded" },
        { id: "location", question: "GPS", label: REPORTABLE_FIELD_LABEL.location, type: "text", answer: sample.location ? formatLatLng(sample.location.lat, sample.location.lng) : "Not recorded" },
        { id: "picture", question: "Picture", label: REPORTABLE_FIELD_LABEL.picture, type: "text", answer: sample.picture_url ? mediaFileName(sample.picture_url, "image") : "Not uploaded" },
    ] as SurveyItem[]
}

const failedErrors = (sample: Sample) => sample.validation.filter((c) => c.severity === "error" && c.result === "fail")

/** What the sample's open report / failed validation says, as V2's CorrectionContext (manual report first). */
export function correctionContexts(sample: Sample): CorrectionContext[] {
    const out: CorrectionContext[] = []
    if (sample.open_report) {
        // the reason is the verifier's explanation only — the reported fields are the red rows in Sample details
        out.push({ origin: "manual_report", reason: sample.open_report.comment || null, by: personName(sample.open_report.reported_by, "Verifier"), at: sample.open_report.reported_at })
    }
    const failed = failedErrors(sample)
    if (sample.status === "pending" && failed.length > 0) {
        out.push({ origin: "system_validation", reason: failed.map((c) => c.message).filter(Boolean).join(" "), by: null, at: null })
    }
    return out
}

/** The plot (or what stands in for it) as one line. */
export function plotLine(sample: Sample): string {
    if (sample.plot) {
        if (sample.plot.outline_available) return `${sample.plot.plot_id}${sample.plot.area_acres !== null ? ` · ${sample.plot.area_acres} acres` : ""}`
        return `${sample.plot.plot_id} · outline not in dataset`
    }
    if (sample.status === "approved" && sample.boundary_state === "boundary_required") return "No plot recorded"
    return BOUNDARY_LABEL[sample.boundary_state]
}

export interface ReportMode {
    /** This card is the one in report mode. */
    active: boolean
    selected: ReportableField[]
    onToggleField: (field: ReportableField) => void
    onCancel: () => void
    /** "Report Selected (n)": the finalize dialog. */
    onFinalize: () => void
}

export interface SampleCardActions {
    onApprove: (sample: Sample) => void
    onStartReport: (sample: Sample) => void
    onComment: (sample: Sample) => void
    onHistory: (sample: Sample) => void
    onPreview: (sample: Sample) => void
    onDrawBoundary: (sample: Sample) => void
}

export function SampleCard({ sample, expanded, highlighted, onToggle, canComment, report, actions, cardRef }: {
    sample: Sample
    expanded: boolean
    /** The sample selected in the detail (also on the map): V2's map-focus ring. */
    highlighted: boolean
    onToggle: () => void
    canComment: boolean
    report: ReportMode
    actions: SampleCardActions
    cardRef?: (el: HTMLDivElement | null) => void
}) {
    const label = sample.sample_code ?? sample.sample_id
    const contexts = correctionContexts(sample)
    const manual = contexts.some((c) => c.origin === "manual_report")
    const reported = new Set<ReportableField>(sample.open_report?.fields ?? [])
    const blockers = sample.status === "pending" ? sample.approval.blockers : []
    const Chevron = expanded ? ChevronDown : ChevronRight
    const bodyId = `sample-body-${sample.sample_id}`
    const reporting = report.active
    const photo = photoItem(sample)
    const hasPhoto = !!(photo.answer as string)
    // Collapsed: one line — AZ · kind · purpose · plot / boundary · surveyor (present-only, truncated).
    const summary = [sample.az.id === 0 ? null : sample.az.code, `${KIND_LABEL[sample.kind]} · ${PURPOSE_LABEL[sample.purpose]}`, plotLine(sample), sample.surveyor ? personName(sample.surveyor, "Surveyor") : null].filter((p): p is string => !!p)
    const moreActions: CardAction[] = [
        ...(hasPhoto ? [{ id: "view-picture", label: "View picture", onSelect: () => actions.onPreview(sample) }] : []),
        ...(canComment || sample.comment ? [{ id: "comment", label: sample.comment ? "Comment" : "Add comment", onSelect: () => actions.onComment(sample) }] : []),
    ]
    return (
        <Card
            ref={cardRef}
            data-sample-card={sample.sample_id}
            data-bucket={sample.bucket}
            data-expanded={expanded ? "" : undefined}
            data-highlighted={highlighted ? "" : undefined}
            data-reporting={reporting ? "" : undefined}
            className={cn(
                "border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950 transition-[box-shadow,border-color] duration-500 ease-out motion-reduce:transition-none scroll-mt-4",
                reporting && "border-red-200 dark:border-red-900/50",
                highlighted && "border-emerald-300 dark:border-emerald-700 shadow-md ring-2 ring-emerald-300/60 dark:ring-emerald-600/40"
            )}
        >
            <div
                role="button"
                tabIndex={0}
                data-sample-toggle
                aria-expanded={expanded}
                aria-controls={expanded ? bodyId : undefined}
                className="p-3.5 flex flex-col select-none cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700"
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        onToggle()
                    }
                }}
            >
                <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {hasPhoto ? (
                            <button
                                type="button"
                                data-sample-thumb-open
                                aria-label={`View the picture of ${label}`}
                                title="View picture"
                                className="flex shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 hover:opacity-90"
                                onClick={(e) => { e.stopPropagation(); actions.onPreview(sample) }}
                                onKeyDown={(e) => e.stopPropagation()}
                            >
                                <PlotThumbnail key={photo.answer as string} item={photo} noun="sample picture" />
                            </button>
                        ) : (
                            <PlotThumbnail key="none" item={photo} noun="sample picture" />
                        )}
                        <div className="flex flex-col text-left min-w-0">
                            <span className={cn("font-bold text-sm font-mono truncate", sample.sample_code ? "text-zinc-900 dark:text-zinc-50" : "font-sans text-red-700 dark:text-red-300")}>
                                {sample.sample_code ?? "No sample code"}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-mono block mt-0.5 truncate">{when(sample.submitted_at)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <BucketBadge bucket={sample.bucket} />
                        {sample.has_report_history && <HistoryIndicator onOpen={() => actions.onHistory(sample)} />}
                        {(canComment || sample.comment) && (
                            <CardIconAction label={sample.comment ? `Comment on ${label}` : `Add a comment to ${label}`} onClick={() => actions.onComment(sample)} data-sample-comment={sample.comment ? "has" : "none"}>
                                <MessageSquareText className={cn("h-3.5 w-3.5", sample.comment && "text-zinc-700 dark:text-zinc-300")} />
                            </CardIconAction>
                        )}
                        <CardMoreMenu label={`More actions for ${label}`} actions={moreActions} />
                        <Chevron data-sample-chevron className="h-4 w-4 text-zinc-400 shrink-0" aria-hidden />
                    </div>
                </div>
                {!expanded && (
                    <p data-sample-summary className="mt-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-400 text-left truncate min-w-0" title={summary.join(" · ")}>
                        {summary.map((part, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span aria-hidden className="text-zinc-300 dark:text-zinc-600">{"  ·  "}</span>}
                                <span>{part}</span>
                            </React.Fragment>
                        ))}
                    </p>
                )}
                {sample.status === "approved" && (
                    <div className={cn(FOOTER, "flex items-center gap-1.5 text-left w-full")}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified{sample.verified_by ? <> by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{personName(sample.verified_by, "Verifier")}</strong></> : null}
                            {sample.verified_at ? <> • {whenTime(sample.verified_at)}</> : null}
                        </span>
                    </div>
                )}
                {/* Need Correction: one line while collapsed; the full correction while expanded (said once either way). */}
                {contexts.length > 0 && (
                    <div data-correction-detail data-correction-origin={contexts.map((c) => c.origin).join(" ")} className={cn(FOOTER, "space-y-2 text-left w-full min-w-0")}>
                        {(expanded ? contexts : contexts.slice(0, 1)).map((context) => <CorrectionBlock key={context.origin} context={context} full={expanded} />)}
                        {expanded && manual && (
                            <button
                                type="button"
                                data-view-report-history
                                onClick={(e) => { e.stopPropagation(); actions.onHistory(sample) }}
                                className="ml-5 w-fit text-left text-[10px] text-red-700/80 dark:text-red-300/80 font-semibold uppercase tracking-wider hover:underline underline-offset-2"
                            >
                                View report history
                            </button>
                        )}
                    </div>
                )}
            </div>

            {expanded && (
                <div id={bodyId} data-sample-body className="px-3.5 pb-3.5">
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
                        <DetailList title="Sample details" data-sample-details>
                            <DetailRow id="sample_id" label="Sample ID" correctionId={reported.has("sample_id") ? "sample_id" : undefined}>{sample.sample_code ?? "Not recorded"}</DetailRow>
                            <DetailRow id="kind" label="Sample type">{KIND_LABEL[sample.kind]}</DetailRow>
                            <DetailRow id="purpose" label="Purpose">{PURPOSE_LABEL[sample.purpose]}</DetailRow>
                            <DetailRow id="az" label="AZ">{sample.az.id === 0 ? "Not recorded" : [sample.az.code, sample.az.name].filter(Boolean).join(" · ")}</DetailRow>
                            <DetailRow id="submitted" label="Submitted on">{whenTime(sample.submitted_at)}</DetailRow>
                            <DetailRow id="collected" label="Collected on">{when(sample.collected_at) ?? "Not recorded"}</DetailRow>
                            <DetailRow id="surveyor" label="Surveyor">
                                {sample.surveyor ? <SurveyorCell surveyor={toHoverPerson(sample.surveyor, "Surveyor")} /> : <span className="text-zinc-500">-</span>}
                            </DetailRow>
                            <DetailRow id="location" label="GPS Coordinates" correctionId={reported.has("location") ? "location" : undefined}>
                                {sample.location ? formatLatLng(sample.location.lat, sample.location.lng) : "Not recorded"}
                            </DetailRow>
                            <DetailRow id="picture" label="Picture" correctionId={reported.has("picture") ? "picture" : undefined}>
                                {hasPhoto ? (
                                    <button type="button" data-picture-view onClick={() => actions.onPreview(sample)} className="font-semibold underline underline-offset-2 decoration-zinc-300 hover:decoration-current focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-sm">
                                        View
                                    </button>
                                ) : "Not uploaded"}
                            </DetailRow>
                            <DetailRow id="plot" label="Plot">
                                {sample.plot ? <span className="font-mono">{plotLine(sample)}</span> : plotLine(sample)}
                                {sample.plot?.origin === "generated" && sample.plot.drawn_by && <span className="text-zinc-500"> · drawn by {personName(sample.plot.drawn_by, "Verifier")}{sample.plot.drawn_at ? ` on ${when(sample.plot.drawn_at)}` : ""}</span>}
                            </DetailRow>
                            {sample.hq_status === "approved" && <DetailRow id="hq_status" label="HQ review">Approved</DetailRow>}
                        </DetailList>

                        {sample.comment && (
                            <section data-sample-comment-section className="text-left min-w-0">
                                <p className="mb-1 text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none">Comment</p>
                                <CommentPreview text={sample.comment} />
                            </section>
                        )}

                        {/* Report mode (V2): the instruction, then the sample's reportable values as selectable options */}
                        {reporting && (
                            <div data-report-mode className="space-y-3 text-left">
                                <div data-report-info role="note" className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/10 px-2.5 py-2">
                                    <Info className="h-3.5 w-3.5 mt-px shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                                    <p className="text-[11px] leading-4 text-amber-900 dark:text-amber-200">Select what needs correction. Reporting marks this sample for correction; the surveyor is asked to fix the selected values.</p>
                                </div>
                                <div data-report-fields className="space-y-1.5">
                                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none">Sample fields</p>
                                    {reportableItems(sample).map((item) => (
                                        <ReportFieldOption key={item.id} item={item} selected={report.selected.includes(item.id as ReportableField)} onToggle={() => report.onToggleField(item.id as ReportableField)} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* The sample's own actions (Pending only), V2's dispatch actions: the blocker beside Approve, then Report / Approve. */}
                        {sample.status === "pending" && (
                            <div data-sample-actions className="pt-1 space-y-2">
                                {!reporting && blockers.map((b) => (
                                    <p key={b.code + b.message} data-approve-blocker={b.code} className="flex items-start gap-1.5 text-[11px] leading-4 font-medium text-amber-800 dark:text-amber-300 text-left min-w-0">
                                        <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
                                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{b.message}</span>
                                        {b.code === "boundary_required" && sample.boundary_editable && (
                                            <button type="button" data-draw-boundary onClick={(e) => { e.stopPropagation(); actions.onDrawBoundary(sample) }} className="shrink-0 text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 hover:no-underline">
                                                Draw boundary
                                            </button>
                                        )}
                                    </p>
                                ))}
                                <div className="flex items-center justify-end gap-2">
                                    {reporting ? (
                                        <>
                                            <Button variant="outline" data-cancel-report className="h-8 px-3 text-xs font-bold" onClick={report.onCancel}>Cancel</Button>
                                            <Button data-finalize-report className="h-8 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white" disabled={report.selected.length === 0} onClick={report.onFinalize}>
                                                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                                {report.selected.length === 0 ? "Report" : `Report Selected (${report.selected.length})`}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                data-start-report
                                                className="h-8 px-3 text-xs font-bold text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-950/20"
                                                disabled={!sample.can_report}
                                                onClick={() => actions.onStartReport(sample)}
                                            >
                                                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                                Report
                                            </Button>
                                            <Button
                                                data-approve-sample
                                                className="h-8 px-4 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                disabled={!sample.approval.allowed}
                                                onClick={() => actions.onApprove(sample)}
                                            >
                                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                Approve
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    )
}

export { REPORTABLE_FIELDS }
