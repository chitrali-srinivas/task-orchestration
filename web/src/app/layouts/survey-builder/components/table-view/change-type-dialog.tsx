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
            <DialogContent className="sm:max-w-[440px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-5">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-5 w-5" />
                        <DialogTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            Change Question Type?
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Changing question type from <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{currentType}</span> to <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{newType}</span> may remove options, validation rules, or settings that are not supported by the new type.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="pt-3 gap-2 flex items-center justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-8 text-xs border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirmChange}
                        className="h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                    >
                        Change Type
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
