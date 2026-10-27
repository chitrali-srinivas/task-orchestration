"use client"

// Close job sheet (HQ), styled like the Tasks cancel-reason dialog (Deployment's report pop-up): a reason for every stop
// whose tasks aren't all done; those tasks go back to the pool. (Tasks are added in the job sheet by search or from the map.)
import * as React from "react"
import { ClipboardCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function DialogShell({ title, description, onClose, children, footer }: { title: string; description: React.ReactNode; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-[520px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                <div className="bg-white dark:bg-zinc-950">
                    <div className="p-6 pb-0 flex items-start justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">{description}</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="p-6">{children}</div>
                    <div className="p-6 pt-0 flex items-center justify-end gap-3">{footer}</div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export interface UnfinishedStop {
    index: number
    farmerName: string
    taskCodes: string
}

/** Mounted only while open. */
export function CloseJobDialog({ jobCode, doneStops, unfinished, onClose, onConfirm }: { jobCode: string; doneStops: number; unfinished: UnfinishedStop[]; onClose: () => void; onConfirm: (reasons: Record<number, string>) => void }) {
    const [reasons, setReasons] = React.useState<Record<number, string>>({})
    const complete = unfinished.every((s) => reasons[s.index]?.trim())
    return (
        <DialogShell
            title="Close job sheet"
            description={
                <>
                    {jobCode}: {doneStops} {doneStops === 1 ? "stop" : "stops"} done
                    {unfinished.length > 0 ? `, ${unfinished.length} not finished. Give a reason for each; their tasks go back to the pool and come first in the next plan.` : ". Every task on the job is done."}
                </>
            }
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" className="h-9 px-4 text-xs font-bold" onClick={onClose}>
                        Keep open
                    </Button>
                    <Button className="h-9 px-4 text-xs font-bold" disabled={!complete} onClick={() => onConfirm(reasons)}>
                        <ClipboardCheck className="mr-2 h-3.5 w-3.5" />
                        Close job sheet
                    </Button>
                </>
            }
        >
            {unfinished.length === 0 ? (
                <p className="text-xs text-zinc-500">Closing records the job as finished.</p>
            ) : (
                <div className="space-y-3">
                    {unfinished.map((s) => (
                        <div key={s.index} className="space-y-1">
                            <label htmlFor={`reason-${s.index}`} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Stop {s.index + 1} · {s.farmerName} <span className="font-normal text-zinc-500">· {s.taskCodes}</span>
                            </label>
                            <Input
                                id={`reason-${s.index}`}
                                placeholder="Why it wasn't done (e.g. farmer away)"
                                value={reasons[s.index] ?? ""}
                                onChange={(e) => setReasons((r) => ({ ...r, [s.index]: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                    ))}
                </div>
            )}
        </DialogShell>
    )
}
