"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewTextProps {
    question: QuestionModel;
    value: string;
    onChange: (val: string) => void;
    locale: string;
}

export function PreviewText({ question, value, onChange, locale }: PreviewTextProps) {
    const isLongText = question.type === "TextArea";
    const maxChar = question.validation?.maxChar;

    return (
        <div className="space-y-1.5">
            {isLongText ? (
                <Textarea
                    placeholder={locale === "hi" ? "विस्तृत विवरण दर्ज करें..." : "Enter details or remarks..."}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg text-xs resize-none"
                />
            ) : (
                <Input
                    placeholder={locale === "hi" ? "उत्तर दर्ज करें..." : "Enter response..."}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                />
            )}

            {maxChar && (
                <div className="text-right text-[10px] text-zinc-400 font-mono">
                    {(value || "").length} / {maxChar}
                </div>
            )}
        </div>
    );
}
