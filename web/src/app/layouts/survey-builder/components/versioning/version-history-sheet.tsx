"use client";

import React, { useState } from "react";
import {
    History,
    GitCompare,
    RotateCcw,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogEntry, SurveyModel, SurveyVersionSnapshot } from "../../types/survey-schema";
import { computeSurveyDiff, SurveyVersionDiff } from "../../lib/version-diff-engine";
import { VersionDiffModal } from "./version-diff-modal";
import { ChangeLogView } from "./change-log-view";

interface VersionHistorySheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentSurvey: SurveyModel;
    versions: SurveyVersionSnapshot[];
    auditLogs: AuditLogEntry[];
    onRestoreVersionAsDraft: (snapshot: SurveyModel) => void;
}

export function VersionHistorySheet({
    open,
    onOpenChange,
    currentSurvey,
    versions,
    auditLogs,
    onRestoreVersionAsDraft,
}: VersionHistorySheetProps) {
    const [activeTab, setActiveTab] = useState<"versions" | "audit">("versions");
    const [selectedDiff, setSelectedDiff] = useState<SurveyVersionDiff | null>(null);
    const [diffOldSurvey, setDiffOldSurvey] = useState<SurveyModel | null>(null);
    const [diffNewSurvey, setDiffNewSurvey] = useState<SurveyModel | null>(null);
    const [diffModalOpen, setDiffModalOpen] = useState(false);

    const handleCompare = (snapshot: SurveyVersionSnapshot) => {
        const diff = computeSurveyDiff(snapshot.surveySnapshot, currentSurvey);
        setSelectedDiff(diff);
        setDiffOldSurvey(snapshot.surveySnapshot);
        setDiffNewSurvey(currentSurvey);
        setDiffModalOpen(true);
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="w-[420px] sm:w-[500px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-0 flex flex-col shadow-2xl">
                    <SheetHeader className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                                    Version History & Change Log
                                </SheetTitle>
                                <SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Audit immutable published releases and restore historical snapshots.
                                </SheetDescription>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                                <TabsList className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-8 p-0.5 w-full grid grid-cols-2">
                                    <TabsTrigger value="versions" className="text-xs h-7 font-semibold">
                                        Versions ({versions.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" className="text-xs h-7 font-semibold">
                                        Audit Log ({auditLogs.length})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </SheetHeader>

                    <ScrollArea className="flex-1 p-4">
                        {activeTab === "versions" ? (
                            <div className="space-y-3">
                                {versions.map((ver) => {
                                    const isCurrent = ver.version === currentSurvey.version;
                                    const isPublished = ver.status === "Published";

                                    return (
                                        <div
                                            key={ver.version}
                                            className={cn(
                                                "p-3.5 rounded-xl border text-xs space-y-2.5 transition-all",
                                                isCurrent
                                                    ? "bg-zinc-50 dark:bg-zinc-900/90 border-zinc-900/40 dark:border-zinc-600 shadow-2xs"
                                                    : "bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "font-mono text-xs font-bold px-2 py-0.5 border",
                                                            isPublished
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                                        )}
                                                    >
                                                        {ver.versionTag}
                                                    </Badge>

                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0"
                                                    >
                                                        {ver.status}
                                                    </Badge>

                                                    {isCurrent && (
                                                        <span className="text-[10px] text-zinc-900 dark:text-zinc-100 font-semibold font-mono">
                                                            (Active)
                                                        </span>
                                                    )}
                                                </div>

                                                <span className="text-[10px] font-mono text-zinc-400">
                                                    {new Date(ver.createdAt).toLocaleDateString([], {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </span>
                                            </div>

                                            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                                                {ver.changeSummary}
                                            </p>

                                            <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500">
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    <span>{ver.createdBy}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCompare(ver)}
                                                        className="h-6 text-[10px] px-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1 rounded"
                                                    >
                                                        <GitCompare className="h-3 w-3" /> Compare
                                                    </Button>

                                                    {!isCurrent && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                onRestoreVersionAsDraft(ver.surveySnapshot);
                                                                onOpenChange(false);
                                                            }}
                                                            className="h-6 text-[10px] px-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1 rounded"
                                                        >
                                                            <RotateCcw className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Restore as Draft
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <ChangeLogView logs={auditLogs} />
                        )}
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* Version Diff Modal */}
            <VersionDiffModal
                open={diffModalOpen}
                onOpenChange={setDiffModalOpen}
                diff={selectedDiff}
                oldSurvey={diffOldSurvey}
                newSurvey={diffNewSurvey}
            />
        </>
    );
}
