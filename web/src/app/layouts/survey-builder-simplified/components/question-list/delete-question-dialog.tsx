"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Trash2, ArrowRight } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionModel } from "../../types/survey-schema";

interface DeleteQuestionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    question: QuestionModel | null;
    allQuestions: QuestionModel[];
    onConfirmDelete: (questionId: string) => void;
}

export function DeleteQuestionDialog({
    open,
    onOpenChange,
    question,
    allQuestions,
    onConfirmDelete,
}: DeleteQuestionDialogProps) {
    if (!question) return null;

    // Find direct and nested follow-up descendants (cascade deleted) (UX-002)
    const { cascadeDescendants, ruleDependents } = useMemo(() => {
        const descendants: QuestionModel[] = [];
        const descendantIds = new Set<string>();

        const findChildren = (pId: string) => {
            allQuestions.forEach((q) => {
                if (q.parentQuestionId === pId && !descendantIds.has(q.id)) {
                    descendantIds.add(q.id);
                    descendants.push(q);
                    findChildren(q.id);
                }
            });
        };
        findChildren(question.id);

        const otherDependents = allQuestions.filter((q) => {
            if (q.id === question.id || descendantIds.has(q.id)) return false;
            const hasCondDep = q.visibility?.enabled && q.visibility.ruleGroup?.conditions?.some((c) => c.questionId === question.id);
            const hasRepeaterDep = q.repeater?.childQuestionIds?.includes(question.id);
            return hasCondDep || hasRepeaterDep;
        });

        return { cascadeDescendants: descendants, ruleDependents: otherDependents };
    }, [question, allQuestions]);

    const handleConfirm = () => {
        onConfirmDelete(question.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 shadow-sm shrink-0">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Delete Question</DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                Confirm removal of question from survey schema.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                Q{question.displayIndex || question.number}
                            </span>
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {question.titles.en || "Untitled Question"}
                            </span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 block">
                            Column: {question.columnName} • Type: {question.type}
                        </span>
                    </div>

                    {/* Cascade Deleted Descendants Preview (UX-002) */}
                    {cascadeDescendants.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{cascadeDescendants.length} Nested Follow-up Question{cascadeDescendants.length > 1 ? "s" : ""} Will Be Cascade Deleted</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Deleting this parent question will also permanently remove the following nested follow-ups:
                            </p>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                                {cascadeDescendants.map((dq) => (
                                    <div key={dq.id} className="flex items-center justify-between text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-white/80 dark:bg-zinc-900/80 px-2.5 py-1 rounded-md border border-rose-100 dark:border-rose-900/50">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-bold text-rose-700 dark:text-rose-400">Q{dq.displayIndex || dq.number}:</span>
                                            <span className="truncate">{dq.titles.en || dq.columnName}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-zinc-500">
                                            {dq.type}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Independent Rule Dependents Warning */}
                    {ruleDependents.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{ruleDependents.length} Cross-Referenced Question{ruleDependents.length > 1 ? "s" : ""} Impacted</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                The following questions reference this question in their visibility rules. Their conditional logic will be cleared:
                            </p>
                            <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
                                {ruleDependents.map((dq) => (
                                    <div key={dq.id} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-white/70 dark:bg-zinc-900/70 px-2.5 py-1 rounded-md">
                                        <span>Q{dq.displayIndex || dq.number}:</span>
                                        <span className="truncate">{dq.titles.en || dq.columnName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {cascadeDescendants.length === 0 && ruleDependents.length === 0 && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Are you sure you want to remove this question? This action will renumber remaining questions across the survey.
                        </p>
                    )}
                </div>

                <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-end gap-2.5 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-4 text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
                        className="h-9 px-4 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg border border-red-700 shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Trash2 className="h-4 w-4 text-white shrink-0" />
                        <span className="text-white font-semibold">Delete Question</span>
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
