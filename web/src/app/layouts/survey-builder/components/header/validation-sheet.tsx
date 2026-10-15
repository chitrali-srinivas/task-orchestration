"use client";

import React from "react";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    Check,
    HelpCircle,
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
import { SurveyValidationResult, ValidationItem } from "../../lib/survey-validator";

interface ValidationSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    validation: SurveyValidationResult;
    onSelectQuestion: (questionId: string) => void;
}

export function ValidationSheet({
    open,
    onOpenChange,
    validation,
    onSelectQuestion,
}: ValidationSheetProps) {
    const handleJumpToQuestion = (questionId?: string) => {
        if (questionId) {
            onSelectQuestion(questionId);
            onOpenChange(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[420px] sm:w-[500px] max-w-[95vw] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-0 flex flex-col shadow-2xl">
                <SheetHeader className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0 pr-12 space-y-3">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "p-2.5 rounded-xl shrink-0 shadow-xs mt-0.5",
                                validation.errorCount > 0
                                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                                    : validation.warningCount > 0
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                            )}
                        >
                            {validation.errorCount > 0 ? (
                                <AlertCircle className="h-5 w-5" />
                            ) : validation.warningCount > 0 ? (
                                <AlertTriangle className="h-5 w-5" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <SheetTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">
                                Pre-Publish Integrity Rules
                            </SheetTitle>
                            <SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-normal font-normal">
                                Automated schema and dependency integrity checks
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Status Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {validation.errorCount > 0 && (
                            <Badge
                                variant="outline"
                                className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 text-[11px] px-2.5 py-0.5 font-semibold gap-1.5 shadow-2xs"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                {validation.errorCount} {validation.errorCount === 1 ? "Blocking Error" : "Blocking Errors"}
                            </Badge>
                        )}
                        {validation.warningCount > 0 && (
                            <Badge
                                variant="outline"
                                className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 text-[11px] px-2.5 py-0.5 font-semibold gap-1.5 shadow-2xs"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {validation.warningCount} {validation.warningCount === 1 ? "Warning" : "Warnings"}
                            </Badge>
                        )}
                        {validation.isValid && validation.warningCount === 0 && (
                            <Badge
                                variant="outline"
                                className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[11px] px-2.5 py-0.5 font-semibold gap-1.5 shadow-2xs"
                            >
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                All Checks Passed
                            </Badge>
                        )}
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-4">
                    {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                        <div className="p-8 text-center space-y-3">
                            <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 w-12 h-12 mx-auto flex items-center justify-center">
                                <Check className="h-6 w-6 stroke-[3]" />
                            </div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Survey Schema is 100% Valid</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[280px] mx-auto leading-relaxed">
                                No blocking structural errors, circular logic cycles, broken parent links, or duplicate database columns detected.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Blocking Errors */}
                            {validation.errors.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                                        Blocking Errors ({validation.errors.length})
                                    </span>
                                    {validation.errors.map((err) => (
                                        <ValidationIssueCard
                                            key={err.id}
                                            issue={err}
                                            type="error"
                                            onJump={handleJumpToQuestion}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Warnings */}
                            {validation.warnings.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                                        Warnings ({validation.warnings.length})
                                    </span>
                                    {validation.warnings.map((warn) => (
                                        <ValidationIssueCard
                                            key={warn.id}
                                            issue={warn}
                                            type="warning"
                                            onJump={handleJumpToQuestion}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

function ValidationIssueCard({
    issue,
    type,
    onJump,
}: {
    issue: ValidationItem;
    type: "error" | "warning";
    onJump: (qId?: string) => void;
}) {
    const isError = type === "error";

    return (
        <div
            className={cn(
                "p-3 rounded-lg border text-xs space-y-2 transition-colors",
                isError
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-950 dark:text-rose-200"
                    : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-950 dark:text-amber-200"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                    {isError ? (
                        <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span>{issue.title}</span>
                </div>

                {(issue.questionDisplayIndex || issue.questionNumber) && (
                    <Badge
                        variant="outline"
                        className={cn(
                            "font-mono text-[10px] shrink-0 border",
                            isError
                                ? "border-rose-300 dark:border-rose-800 bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
                                : "border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                        )}
                    >
                        Q{issue.questionDisplayIndex || issue.questionNumber}
                    </Badge>
                )}
            </div>

            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                {issue.message}
            </p>

            {issue.questionId && (
                <div className="pt-1 flex justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onJump(issue.questionId)}
                        className={cn(
                            "h-6 px-2.5 text-[11px] font-semibold gap-1 rounded-md shadow-2xs cursor-pointer transition-all",
                            isError
                                ? "border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 bg-white dark:bg-zinc-900 hover:bg-rose-100/70 dark:hover:bg-rose-950/80 hover:border-rose-400"
                                : "border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 bg-white dark:bg-zinc-900 hover:bg-amber-100/70 dark:hover:bg-amber-950/80 hover:border-amber-400"
                        )}
                    >
                        <span>Jump to Question</span>
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}
