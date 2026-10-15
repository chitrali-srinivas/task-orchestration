"use client";

import React, { useState } from "react";
import { Wifi, Battery, Signal, Smartphone, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SurveyModel } from "../../types/survey-schema";
import { PreviewControls } from "./preview-controls";
import { PreviewRuntime } from "./preview-runtime";

interface MobilePreviewProps {
    survey: SurveyModel;
    selectedQuestionId?: string | null;
    runtimeAnswers: Record<string, any>;
    onChangeAnswer: (questionId: string, value: any) => void;
    onResetAnswers: () => void;
    onSelectQuestion?: (questionId: string) => void;
}

export function MobilePreview({
    survey,
    selectedQuestionId,
    runtimeAnswers,
    onChangeAnswer,
    onResetAnswers,
    onSelectQuestion,
}: MobilePreviewProps) {
    const [locale, setLocale] = useState<string>(survey.defaultLocale || "en");
    const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);

    return (
        <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/60 border-l border-zinc-200 dark:border-zinc-800 p-3 space-y-2 min-w-0">
            {/* Top Preview Controls Bar */}
            <PreviewControls
                locales={survey.locales}
                currentLocale={locale}
                onSelectLocale={setLocale}
                onResetData={onResetAnswers}
                onToggleTestDrawer={() => setIsTestDrawerOpen(!isTestDrawerOpen)}
                isTestDrawerOpen={isTestDrawerOpen}
            />

            {/* Test Data Inspector Drawer (Collapsible) */}
            {isTestDrawerOpen && (
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-2.5 text-xs animate-in slide-in-from-top duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                            <span>Developer Test Values</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsTestDrawerOpen(false)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Directly set test response state to verify conditional logic and repeater count.
                    </p>

                    {/* Dedicated Repeater Test Count Control */}
                    {survey.questions.some((q) => q.repeater?.isRepeater) && (() => {
                        const repQ = survey.questions.find((q) => q.repeater?.isRepeater)!;
                        const currentRepVal = runtimeAnswers[repQ.id] || 2;
                        return (
                            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[11px] text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                        <span>Repeater Count Override (Q{repQ.number})</span>
                                    </span>
                                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-mono font-bold">
                                        {currentRepVal} iterations
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={currentRepVal}
                                        onChange={(e) => onChangeAnswer(repQ.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-16 h-7 text-xs font-mono bg-white dark:bg-zinc-950 border border-purple-300 dark:border-purple-700 rounded px-2 text-purple-950 dark:text-purple-100 font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onChangeAnswer(repQ.id, 2)}
                                        className="h-7 px-2 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900 rounded border border-purple-300 dark:border-purple-700 cursor-pointer"
                                    >
                                        Apply 2 Plots
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onChangeAnswer(repQ.id, 3)}
                                        className="h-7 px-2 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900 rounded border border-purple-300 dark:border-purple-700 cursor-pointer"
                                    >
                                        Apply 3 Plots
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {survey.questions.slice(0, 8).map((q) => (
                            <div key={q.id} className="grid grid-cols-12 gap-1.5 items-center">
                                <span className="col-span-5 font-mono text-[10px] text-zinc-500 truncate">
                                    Q{q.number} ({q.columnName})
                                </span>
                                <div className="col-span-7">
                                    {q.options && q.options.length > 0 ? (
                                        <select
                                            value={runtimeAnswers[q.id] ?? ""}
                                            onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                                            className="w-full h-6 text-[11px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded px-1"
                                        >
                                            <option value="">-- Unanswered --</option>
                                            {q.options.map((opt) => (
                                                <option key={opt.id} value={opt.value}>
                                                    {opt.labels.en || opt.value}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={runtimeAnswers[q.id] ?? ""}
                                            onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                                            placeholder="Test value"
                                            className="w-full h-6 text-[11px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded px-1.5"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Smartphone Simulated Hardware Shell */}
            <div className="flex-1 flex items-center justify-center p-1 min-h-0">
                <div className="w-full max-w-[340px] h-full max-h-[580px] bg-white dark:bg-zinc-900 border-[6px] border-zinc-900 dark:border-zinc-700 rounded-[38px] shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-zinc-200 dark:ring-zinc-800">
                    {/* Top Notch & Status Bar */}
                    <div className="h-7 bg-zinc-900 text-zinc-400 px-5 flex items-center justify-between text-[11px] font-medium shrink-0 select-none z-30">
                        <span className="font-mono text-[10px] text-zinc-300">09:41</span>
                        {/* Hardware Speaker Notch */}
                        <div className="h-3.5 w-20 bg-zinc-950 rounded-full flex items-center justify-center">
                            <div className="h-1 w-6 bg-zinc-800 rounded-full" />
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Signal className="h-3 w-3" />
                            <Wifi className="h-3 w-3" />
                            <Battery className="h-3.5 w-3.5" />
                        </div>
                    </div>

                    {/* App Header Bar in Mobile */}
                    <div className="h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 select-none z-20">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Smartphone className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                            <span className="font-bold text-[11px] text-zinc-900 dark:text-zinc-100 truncate">
                                {survey.name}
                            </span>
                        </div>
                        <span className="text-[9px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.2 rounded shrink-0">
                            {survey.versionTag}
                        </span>
                    </div>

                    {/* Mobile Screen Runtime */}
                    <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-950">
                        <PreviewRuntime
                            survey={survey}
                            selectedQuestionId={selectedQuestionId}
                            locale={locale}
                            runtimeAnswers={runtimeAnswers}
                            onChangeAnswer={onChangeAnswer}
                            onResetAnswers={onResetAnswers}
                            onSelectQuestion={onSelectQuestion}
                        />
                    </div>

                    {/* Bottom Home Bar */}
                    <div className="h-4 bg-zinc-900 flex items-center justify-center shrink-0">
                        <div className="h-1 w-24 bg-zinc-700 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
