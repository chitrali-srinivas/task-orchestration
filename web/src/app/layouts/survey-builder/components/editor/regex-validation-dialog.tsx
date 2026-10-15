"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Regex } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuestionModel } from "../../types/survey-schema";
import { validateRegexSafety, testRegexPattern } from "../../lib/regex-safety";

interface RegexValidationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    question: QuestionModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    /** Called when the dialog is dismissed without saving a pattern (so the caller can switch the toggle back off). */
    onCancel?: () => void;
}

/**
 * Add / edit a regular-expression validation for a question, with a live tester.
 * Opened from the "Validation" toggle on the Basic tab.
 */
export function RegexValidationDialog({ open, onOpenChange, question, onChangeQuestion, onCancel }: RegexValidationDialogProps) {
    const [pattern, setPattern] = useState(question.validation.regexPattern || "");
    const [sample, setSample] = useState("");
    const [errorMessage, setErrorMessage] = useState(question.validation.customErrorMessage?.en || "");

    useEffect(() => {
        if (open) {
            setPattern(question.validation.regexPattern || "");
            setErrorMessage(question.validation.customErrorMessage?.en || "");
            setSample("");
        }
    }, [open, question]);

    const safety = useMemo(() => validateRegexSafety(pattern), [pattern]);
    const test = useMemo(() => (sample ? testRegexPattern(pattern, sample) : null), [pattern, sample]);
    const canSave = pattern.trim().length > 0 && safety.isValid;

    const save = () => {
        onChangeQuestion({
            ...question,
            validation: {
                ...question.validation,
                regexPattern: pattern.trim(),
                presetId: undefined,
                validationPresetId: undefined,
                patternDescription: undefined,
                customErrorMessage: errorMessage.trim()
                    ? { ...(question.validation.customErrorMessage || {}), en: errorMessage.trim() }
                    : undefined,
            },
        });
        onOpenChange(false);
    };

    const dismiss = (next: boolean) => {
        if (!next && !question.validation.regexPattern) onCancel?.();
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={dismiss}>
            <DialogContent className="sm:max-w-[520px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden">
                <DialogHeader className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Regex className="h-4 w-4 text-zinc-500" /> Validation pattern
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                        The surveyor&apos;s answer must match this regular expression. Test it with a sample value before saving.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="regex-pattern" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Regular expression
                            </Label>
                            {pattern.trim() && (
                                safety.isValid ? (
                                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Valid syntax
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                                        <XCircle className="h-3.5 w-3.5" /> Invalid
                                    </span>
                                )
                            )}
                        </div>
                        <Input
                            id="regex-pattern"
                            autoFocus
                            placeholder="e.g. ^[0-9]{10}$"
                            value={pattern}
                            onChange={(e) => setPattern(e.target.value)}
                            className="h-9 font-mono text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                        {!safety.isValid && safety.error && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400">{safety.error}</p>
                        )}
                        {safety.isReDoSRisky && safety.warning && (
                            <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" /> {safety.warning}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="regex-sample" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Test with a sample value
                        </Label>
                        <Input
                            id="regex-sample"
                            placeholder="Type a sample response value to test..."
                            value={sample}
                            onChange={(e) => setSample(e.target.value)}
                            className="h-9 font-mono text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                        {test && (
                            test.error ? (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400">{test.error}</p>
                            ) : test.matches ? (
                                <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> &ldquo;{sample}&rdquo; matches
                                </p>
                            ) : (
                                <p className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                                    <XCircle className="h-3.5 w-3.5" /> &ldquo;{sample}&rdquo; does not match
                                </p>
                            )
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="regex-error" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Error message shown to the surveyor (optional)
                        </Label>
                        <Input
                            id="regex-error"
                            placeholder="Value does not match the required format."
                            value={errorMessage}
                            onChange={(e) => setErrorMessage(e.target.value)}
                            className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => dismiss(false)} className="h-8 px-3 text-xs">
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={!canSave}
                        onClick={save}
                        className="h-8 px-3.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50"
                    >
                        Save pattern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
