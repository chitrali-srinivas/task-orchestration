"use client";

import React, { useState } from "react";
import { GitCompare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SurveyVersionDiff } from "../../lib/version-diff-engine";
import { SurveyModel } from "../../types/survey-schema";
import { serializeCoreSurveyJSON } from "../../lib/survey-serializer";

interface VersionDiffModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diff: SurveyVersionDiff | null;
    oldSurvey?: SurveyModel | null;
    newSurvey?: SurveyModel | null;
}

export function VersionDiffModal({
    open,
    onOpenChange,
    diff,
    oldSurvey,
    newSurvey,
}: VersionDiffModalProps) {
    const [viewMode, setViewMode] = useState<"visual" | "json">("visual");

    if (!diff) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{
                    width: "94vw",
                    maxWidth: "1480px",
                    height: "88vh",
                    maxHeight: "88vh",
                    display: "flex",
                    flexDirection: "column",
                }}
                className="!w-[94vw] !max-w-[1480px] !h-[88vh] !max-h-[88vh] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 gap-0 flex flex-col overflow-hidden rounded-2xl"
            >
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/80 dark:bg-zinc-900/70">
                    <div className="flex items-center justify-between gap-4 pr-8">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                                <GitCompare className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    Version Comparison: {diff.versionOld} ↔ {diff.versionNew}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                    Detailed delta of questions, validation constraints, and visibility logic.
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Summary Badges */}
                        <div className="flex items-center gap-1.5 font-mono text-[10px] shrink-0">
                            <Badge variant="outline" className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                                +{diff.addedCount} Added
                            </Badge>
                            <Badge variant="outline" className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
                                ~{diff.modifiedCount} Modified
                            </Badge>
                            <Badge variant="outline" className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40">
                                -{diff.removedCount} Removed
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setViewMode("visual")}
                            className={cn(
                                "text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer",
                                viewMode === "visual"
                                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/60"
                            )}
                        >
                            Visual Diff
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("json")}
                            className={cn(
                                "text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer",
                                viewMode === "json"
                                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/60"
                            )}
                        >
                            Raw JSON Diff
                        </button>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-col bg-zinc-50/30 dark:bg-zinc-950/30">
                    {viewMode === "visual" ? (
                        <ScrollArea className="flex-1 min-h-0 h-full p-4">
                            <div className="space-y-3 pb-4">
                                {diff.questionDiffs.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-zinc-500">
                                        No structural differences detected between these versions.
                                    </div>
                                ) : (
                                    diff.questionDiffs.map((item, idx) => (
                                        <div
                                            key={item.questionId || idx}
                                            className={cn(
                                                "p-3.5 rounded-lg border text-xs space-y-2",
                                                item.changeType === "ADDED" && "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                                                item.changeType === "REMOVED" && "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800",
                                                item.changeType === "MODIFIED" && "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                                                item.changeType === "REORDERED" && "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                                                item.changeType === "UNCHANGED" && "bg-zinc-50/40 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 opacity-60"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[9px] font-mono font-bold px-1.5 py-0",
                                                            item.changeType === "ADDED" && "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                                                            item.changeType === "REMOVED" && "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
                                                            item.changeType === "MODIFIED" && "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                                                            item.changeType === "REORDERED" && "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                                                            item.changeType === "UNCHANGED" && "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                                        )}
                                                    >
                                                        {item.changeType}
                                                    </Badge>
                                                    <span className="font-mono text-zinc-500 font-semibold">
                                                        Q{item.questionNumberNew ?? item.questionNumberOld}
                                                    </span>
                                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[500px]">
                                                        {item.titleNew || item.titleOld}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Detailed breakdown for modified questions */}
                                            {item.changeType === "MODIFIED" && (
                                                <div className="space-y-1.5 pt-1 text-[11px] text-zinc-700 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-800">
                                                    {item.details.titleChanged && (
                                                        <div className="grid grid-cols-2 gap-2 p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                                                            <div>
                                                                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-mono block font-bold">OLD TITLE</span>
                                                                <span className="text-zinc-600 dark:text-zinc-400">{item.titleOld}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono block font-bold">NEW TITLE</span>
                                                                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{item.titleNew}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.details.typeChanged && (
                                                        <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-mono">
                                                            <span>Type: {item.details.typeOld}</span>
                                                            <ArrowRight className="h-3 w-3" />
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.details.typeNew}</span>
                                                        </div>
                                                    )}

                                                    {item.details.optionsChanged && (
                                                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1.5">
                                                            <span className="text-amber-700 dark:text-amber-400 font-semibold block text-xs">Choice Options Modified:</span>
                                                            {item.details.optionDiffs ? (
                                                                <div className="space-y-1">
                                                                    {item.details.optionDiffs.added.length > 0 && (
                                                                        <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                                            <span className="font-bold shrink-0">+ Added:</span>
                                                                            <span>{item.details.optionDiffs.added.join(", ")}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.details.optionDiffs.removed.length > 0 && (
                                                                        <div className="flex items-start gap-1.5 text-rose-700 dark:text-rose-400">
                                                                            <span className="font-bold shrink-0">- Removed:</span>
                                                                            <span>{item.details.optionDiffs.removed.join(", ")}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.details.optionDiffs.renamed.length > 0 && (
                                                                        <div className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
                                                                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">Renamed:</span>
                                                                            {item.details.optionDiffs.renamed.map((r, i) => (
                                                                                <div key={i} className="pl-2 font-mono text-[10px]">
                                                                                    <span className="line-through text-rose-600 dark:text-rose-400">{r.oldLabel}</span> → <span className="text-emerald-600 dark:text-emerald-400 font-bold">{r.newLabel}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {item.details.optionDiffs.scoreChanged.length > 0 && (
                                                                        <div className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
                                                                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">Score Modified:</span>
                                                                            {item.details.optionDiffs.scoreChanged.map((s, i) => (
                                                                                <div key={i} className="pl-2 font-mono text-[10px]">
                                                                                    <span>{s.label}: </span>
                                                                                    <span className="text-zinc-500">{s.oldValue ?? "none"}</span> → <span className="text-amber-600 dark:text-amber-400 font-bold">{s.newValue ?? "none"}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="text-zinc-500 block">Old: {item.details.optionsOld?.join(", ")}</span>
                                                                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold block">New: {item.details.optionsNew?.join(", ")}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {item.details.validationChanged && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px]">
                                                            Validation rules modified
                                                        </span>
                                                    )}

                                                    {item.details.unitChanged && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] ml-1">
                                                            Unit configuration updated
                                                        </span>
                                                    )}

                                                    {item.details.logicChanged && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] ml-1">
                                                            Visibility logic updated
                                                        </span>
                                                    )}

                                                    {item.details.translationChanged && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] ml-1">
                                                            Translations updated
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div
                            className="flex-1 min-h-0 h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden"
                            style={{ gridTemplateRows: "minmax(0, 1fr)" }}
                        >
                            <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                                <div className="px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Snapshot {diff.versionOld}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-400">
                                        {(oldSurvey?.questions || []).length} questions
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-auto p-4 bg-zinc-50/50 dark:bg-zinc-950 font-mono text-xs leading-relaxed">
                                    <pre className="text-zinc-700 dark:text-zinc-300 whitespace-pre font-mono text-[11px]">
                                        {JSON.stringify(oldSurvey ? serializeCoreSurveyJSON(oldSurvey) : {}, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                                <div className="px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        Snapshot {diff.versionNew}
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                        {(newSurvey?.questions || []).length} questions
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-auto p-4 bg-zinc-50/50 dark:bg-zinc-950 font-mono text-xs leading-relaxed">
                                    <pre className="text-zinc-900 dark:text-emerald-200/90 whitespace-pre font-mono text-[11px]">
                                        {JSON.stringify(newSurvey ? serializeCoreSurveyJSON(newSurvey) : {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
