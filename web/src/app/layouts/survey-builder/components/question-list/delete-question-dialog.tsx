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

    // Find any questions that depend on this question's visibility or repeater
    const dependentQuestions = useMemo(() => {
        return allQuestions.filter((q) => {
            if (q.id === question.id) return false;
            // Check conditional visibility dependency
            const hasCondDep = q.visibility.ruleGroup.conditions.some((c) => c.questionId === question.id);
            // Check repeater child dependency
            const hasRepeaterDep = q.repeater?.childQuestionIds?.includes(question.id);
            return hasCondDep || hasRepeaterDep;
        });
    }, [question, allQuestions]);

    const handleConfirm = () => {
        onConfirmDelete(question.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-md bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50">Delete Question</DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Confirm removal of question from survey schema.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-5 space-y-3 text-sm">
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                Q{question.displayIndex || question.number}
                            </span>
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {question.titles.en || "Untitled Question"}
                            </span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-500 block">
                            Column: {question.columnName} • Type: {question.type}
                        </span>
                    </div>

                    {dependentQuestions.length > 0 ? (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{dependentQuestions.length} Dependent Questions Impacted</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                The following subsequent questions currently depend on this question for visibility or repeat group logic. Deleting it will reset their conditional rules:
                            </p>
                            <div className="space-y-1 max-h-[100px] overflow-y-auto">
                                {dependentQuestions.map((dq) => (
                                    <div key={dq.id} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-white/70 dark:bg-zinc-900/70 px-2 py-1 rounded">
                                        <span>Q{dq.displayIndex || dq.number}:</span>
                                        <span className="truncate">{dq.titles.en}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            Are you sure you want to remove this question? This action will renumber remaining questions.
                        </p>
                    )}
                </div>

                <DialogFooter className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-3.5 text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
                        className="h-9 px-4 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md border border-red-700 shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Trash2 className="h-4 w-4 text-white shrink-0" />
                        <span className="text-white font-semibold">Delete Question</span>
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
