"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BackendQuestionType } from "../../types/survey-schema";

interface ChangeTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentType: BackendQuestionType;
    newType: BackendQuestionType;
    onConfirmChange: () => void;
}

export function ChangeTypeDialog({
    open,
    onOpenChange,
    currentType,
    newType,
    onConfirmChange,
}: ChangeTypeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 shadow-sm shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                Change Question Type?
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                Review potential impact on question validation and choices.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                            Changing question type from <span className="font-mono font-bold">{currentType}</span> to <span className="font-mono font-bold">{newType}</span> may reset options, validation constraints, or settings that are unsupported by the target type.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-end gap-2.5 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-4 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirmChange}
                        className="h-9 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg shadow-sm"
                    >
                        Change Type
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
