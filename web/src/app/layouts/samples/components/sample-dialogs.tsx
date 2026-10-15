"use client"

// Samples — the dialogs that open over the detail, in Deployment V2's dialog language (deployment-detail-sheet.tsx:
// rounded-xl, p-6 sections, text-xl bold titles, h-9 text-xs bold buttons, the red Submit Report / zinc Approve, the
// "Reported Successfully" state, the V2 history cards). V2's are inline JSX in its sheet; these carry the same markup.
import * as React from "react"
import { format } from "date-fns"
import { AlertCircle, CheckCircle2, Loader2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { KIND_LABEL, PURPOSE_LABEL, REPORTABLE_FIELD_LABEL, personName } from "../domain/labels"
import type { ReportableField, Sample, SampleEvent } from "../domain/types"
import type { AsyncState } from "../data/use-samples-data"

const DIALOG = "max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden"
const PRIMARY = "h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
const whenTime = (ms: number) => format(new Date(ms), "dd MMM yyyy, hh:mm a")
const label = (s: Sample) => s.sample_code ?? s.sample_id

function CloseButton({ onClick, label: name = "Close" }: { onClick: () => void; label?: string }) {
    return (
        <Button variant="ghost" size="icon" aria-label={name} className="h-8 w-8 shrink-0 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onClick}>
            <X className="h-4 w-4" />
        </Button>
    )
}

function ErrorLine({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <p role="alert" data-dialog-error className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300 [overflow-wrap:anywhere]">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />{message}
        </p>
    )
}

// ── Approve (V2 "Confirm approval", for the one sample being approved) ──────────────────────────────

export function ApproveDialog({ sample, onCancel, onConfirm, submitting, error }: {
    sample: Sample | null
    onCancel: () => void
    onConfirm: () => void
    submitting: boolean
    error: string | null
}) {
    return (
        <Dialog open={!!sample} onOpenChange={(open) => { if (!open && !submitting) onCancel() }}>
            <DialogContent className={DIALOG} data-approve-dialog>
                {sample && (
                    <div className="bg-white dark:bg-zinc-950 text-left">
                        <div className="p-6 pb-0 space-y-1">
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Confirm approval</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                {sample.approval.allowed ? 1 : 0} out of 1 sample can be approved.
                            </DialogDescription>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-left">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{label(sample)}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    {KIND_LABEL[sample.kind]} · {PURPOSE_LABEL[sample.purpose]} · {sample.az.code}{sample.plot ? ` · Plot ${sample.plot.plot_id}` : " · No plot"}
                                </div>
                                {!sample.approval.allowed && sample.approval.blockers.map((b) => <p key={b.message} className="text-xs text-amber-800 dark:text-amber-300 mt-1">{b.message}</p>)}
                            </div>
                            <ErrorLine message={error} />
                        </div>
                        <div className="p-6 pt-0 flex items-center justify-end gap-3">
                            <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onCancel} disabled={submitting}>Cancel</Button>
                            <Button data-confirm-approve className={PRIMARY} disabled={submitting || !sample.approval.allowed} onClick={onConfirm}>
                                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Approve</>}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ── Report — the finalize step (V2 "Finalize Report": the warning, Additional Comments, Submit Report, success) ──

export function ReportFinalizeDialog({ open, sample, fields, comment, onCommentChange, onCancel, onSubmit, submitting, success, error }: {
    open: boolean
    sample: Sample | null
    fields: ReportableField[]
    comment: string
    onCommentChange: (value: string) => void
    onCancel: () => void
    onSubmit: () => void
    submitting: boolean
    success: boolean
    error: string | null
}) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting && !success) onCancel() }}>
            <DialogContent className={DIALOG} data-report-dialog>
                <DialogTitle className="sr-only">Finalize Report</DialogTitle>
                <DialogDescription className="sr-only">Add additional comments before submitting the report</DialogDescription>
                <div className="bg-white dark:bg-zinc-950 text-left">
                    {success ? (
                        <div data-report-success className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reported Successfully</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Updating the sample status...</p>
                            </div>
                        </div>
                    ) : sample && (
                        <>
                            <div className="p-6 pb-0 flex items-start justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Report Sample</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        You are reporting <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fields.length} {fields.length === 1 ? "item" : "items"}</span> on <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{label(sample)}</span>.
                                    </p>
                                </div>
                                <CloseButton onClick={onCancel} />
                            </div>
                            <div className="p-6 space-y-4">
                                <div data-report-warning className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-3 flex items-start gap-2 text-left">
                                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
                                        <p className="font-bold">Reporting marks this sample for correction.</p>
                                        <p>{fields.map((f) => REPORTABLE_FIELD_LABEL[f]).join(", ")} will be sent back to the surveyor; the sample can be verified again after the correction.</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Additional Comments <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        data-report-comment
                                        placeholder="Describe what needs to be corrected..."
                                        className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-50 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                        value={comment}
                                        onChange={(e) => onCommentChange(e.target.value)}
                                    />
                                </div>
                                <ErrorLine message={error} />
                            </div>
                            <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onCancel} disabled={submitting}>Cancel</Button>
                                <Button data-submit-report className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-none" onClick={onSubmit} disabled={submitting || !comment.trim() || fields.length === 0}>
                                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><AlertCircle className="mr-2 h-3.5 w-3.5" />Submit Report</>}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ── Comment ─────────────────────────────────────────────────────────────────────────────────────────

export function CommentDialog({ sample, canEdit, onCancel, onSave, saving, error }: {
    sample: Sample | null
    canEdit: boolean
    onCancel: () => void
    onSave: (comment: string) => void
    saving: boolean
    error: string | null
}) {
    const [draft, setDraft] = React.useState("")
    const [forSample, setForSample] = React.useState<string | null>(null)
    if (sample && forSample !== sample.sample_id) {
        setForSample(sample.sample_id)
        setDraft(sample.comment ?? "")
    }
    return (
        <Dialog open={!!sample} onOpenChange={(open) => { if (!open && !saving) onCancel() }}>
            <DialogContent className={DIALOG} data-comment-dialog>
                {sample && (
                    <div className="bg-white dark:bg-zinc-950 text-left">
                        <div className="p-6 pb-0 flex items-start justify-between">
                            <div className="space-y-1 min-w-0">
                                <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{canEdit ? (sample.comment ? "Update Comment" : "Add Comment") : "Comment"}</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground font-mono truncate">{label(sample)}</DialogDescription>
                            </div>
                            <CloseButton onClick={onCancel} />
                        </div>
                        <div className="p-6 space-y-2">
                            {canEdit ? (
                                <>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Share any additional observations or feedback regarding this sample.</p>
                                    <Textarea data-comment-input placeholder="Type your comment here . . ." className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 rounded-md bg-transparent p-3 text-sm leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} />
                                </>
                            ) : (
                                <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic">{sample.comment ? `"${sample.comment}"` : "No comment."}</p>
                            )}
                            <ErrorLine message={error} />
                        </div>
                        <div className="p-6 pt-0 flex items-center justify-end gap-3">
                            <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onCancel} disabled={saving}>{canEdit ? "Cancel" : "Close"}</Button>
                            {canEdit && (
                                <Button data-save-comment className={PRIMARY} disabled={saving || draft.trim() === (sample.comment ?? "").trim()} onClick={() => onSave(draft)}>
                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sample.comment ? "Update Comment" : "Add Comment"}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ── History (V2 "Report history" dialog) ────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<SampleEvent["type"], string> = {
    collected: "Collected",
    validated: "Validated",
    reported: "Reported",
    corrected: "Corrected",
    approved: "Verified",
    boundary_saved: "Boundary saved",
    boundary_updated: "Boundary updated",
    comment_updated: "Comment",
}

export function HistoryDialog({ sample, onClose, history }: {
    /** The sample whose history is shown (null: closed). History always belongs to one sample. */
    sample: Sample | null
    onClose: () => void
    history: AsyncState<SampleEvent[]>
}) {
    const items = sample ? (history.data ?? []).filter((e) => e.sample_id === sample.sample_id) : []
    return (
        <Dialog open={!!sample} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent data-history-dialog className="flex flex-col gap-0 w-[calc(100vw-2rem)] max-w-[520px] max-h-[85vh] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl bg-white dark:bg-zinc-950 [&>button]:hidden">
                <div className="shrink-0 p-6 pb-4 flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="space-y-1 min-w-0 text-left">
                        <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">History</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {sample && <><span data-history-sample className="font-mono font-semibold text-zinc-600 dark:text-zinc-300">{label(sample)}</span> · {KIND_LABEL[sample.kind]} · {PURPOSE_LABEL[sample.purpose]} — newest first</>}
                        </DialogDescription>
                    </div>
                    <CloseButton onClick={onClose} label="Close history" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
                    {history.error ? (
                        <div data-history-state="error" className="py-8 flex flex-col items-center gap-3 text-center">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Couldn&apos;t load history</p>
                            <p className="text-xs text-zinc-500">{history.error}</p>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={history.retry}>Retry</Button>
                        </div>
                    ) : history.isLoading && !history.data ? (
                        <div data-history-state="loading" className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 text-zinc-300 animate-spin" /></div>
                    ) : items.length === 0 ? (
                        <p data-history-state="empty" className="py-8 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">No history yet.</p>
                    ) : (
                        <div className="space-y-3 min-w-0">
                            {items.map((e) => (
                                <div key={e.event_id} data-history-entry={e.type} className="min-w-0 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-left space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{EVENT_LABEL[e.type]}</span>
                                        <span className="shrink-0 text-[10px] text-zinc-400 font-medium uppercase">{whenTime(e.at)}</span>
                                    </div>
                                    {(e.report_fields?.length || e.report_state) && (
                                    <div className="flex items-center justify-between gap-2 text-[10px] font-medium">
                                        <span data-history-fields className="flex flex-wrap gap-1 min-w-0">
                                            {(e.report_fields ?? []).map((f) => (
                                                <span key={f} className="rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-1.5 py-px font-semibold text-red-700 dark:text-red-300">{REPORTABLE_FIELD_LABEL[f]}</span>
                                            ))}
                                        </span>
                                        {e.report_state && (
                                            <span className={cn("shrink-0 font-bold uppercase tracking-wider", e.report_state === "ongoing" ? "text-red-600 dark:text-red-400" : "text-zinc-400")}>
                                                {e.report_state === "ongoing" ? "Ongoing" : "Completed"}
                                            </span>
                                        )}
                                    </div>
                                    )}
                                    <p className="text-xs text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">{e.summary}</p>
                                    {e.actor && <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">By {personName(e.actor, e.type === "collected" || e.type === "corrected" ? "Surveyor" : "Verifier")}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ── Photo preview (the attachment preview pattern: zoom · rotate · close) ───────────────────────────

export function PhotoPreviewDialog({ sample, onClose }: { sample: Sample | null; onClose: () => void }) {
    const [zoom, setZoom] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [state, setState] = React.useState<"loading" | "ok" | "failed">("loading")
    const [forSample, setForSample] = React.useState<string | null>(null)
    if (sample && forSample !== sample.sample_id) {
        setForSample(sample.sample_id)
        setZoom(1)
        setRotation(0)
        setState("loading")
    }
    return (
        <Dialog open={!!sample} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent data-photo-preview data-photo-state={state} className="max-w-[1100px] w-[95vw] h-[80vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl z-[560] flex flex-col rounded-2xl [&>button]:hidden">
                <DialogTitle className="sr-only">Sample picture</DialogTitle>
                <DialogDescription className="sr-only">Picture of the sample, with zoom and rotation</DialogDescription>
                {sample && (
                    <>
                        <div className="shrink-0 h-14 px-4 flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="min-w-0 text-left">
                                <p className="text-sm font-bold font-mono truncate">{label(sample)}</p>
                                <p className="text-[11px] text-zinc-500">{KIND_LABEL[sample.kind]} · {PURPOSE_LABEL[sample.purpose]}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                                <span className="text-[11px] font-bold tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></Button>
                                <CloseButton onClick={onClose} />
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto bg-black/5 flex items-center justify-center relative">
                            {state === "loading" && <Loader2 className="absolute h-6 w-6 text-zinc-400 animate-spin" />}
                            {state === "failed" ? (
                                <p className="text-sm text-zinc-500">The picture couldn&apos;t be loaded.</p>
                            ) : sample.picture_url ? (
                                <div style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: "transform 150ms" }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- prototype media (port-bound code can't use next/image) */}
                                    <img src={sample.picture_url} alt={`Picture of sample ${label(sample)}`} onLoad={() => setState("ok")} onError={() => setState("failed")} className={cn("max-h-[68vh] max-w-[90vw] w-auto h-auto object-contain rounded-md", state === "loading" && "opacity-0")} />
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-500">No picture was uploaded for this sample.</p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
