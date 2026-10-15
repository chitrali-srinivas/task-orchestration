"use client";

import React, { useState } from "react";
import { Info, HelpCircle, Lightbulb, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { BackendQuestionType } from "../../types/survey-schema";
import { getQuestionTypeHelp } from "../../data/question-type-help";

interface QuestionTypeHelpPopoverProps {
    type: BackendQuestionType | string;
    className?: string;
    iconClassName?: string;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
}

export function QuestionTypeHelpPopover({
    type,
    className,
    iconClassName,
    side = "bottom",
    align = "start",
}: QuestionTypeHelpPopoverProps) {
    const [open, setOpen] = useState(false);
    const help = getQuestionTypeHelp(type);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Learn about ${help.title} question type`}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                    "inline-flex items-center justify-center h-6 w-6 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 shrink-0 cursor-pointer",
                                    className
                                )}
                            >
                                <Info className={cn("h-3.5 w-3.5", iconClassName)} />
                            </button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    {!open && (
                        <TooltipContent side="top" className="text-[11px] px-2 py-1 font-medium bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                            About {help.title}
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>

            <PopoverContent
                side={side}
                align={align}
                sideOffset={6}
                className="w-80 sm:w-92 p-4 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-xl space-y-3 z-[9999] max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-bold text-xs">
                            ⓘ
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {help.title}
                        </h4>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                        {String(help.id)}
                    </span>
                </div>

                {/* 2. What it does */}
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        What it does
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {help.whatItDoes}
                    </p>
                </div>

                {/* 3. When to use */}
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        When to use
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {help.whenToUse}
                    </p>
                </div>

                {/* 4. Example Box */}
                <div className="space-y-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        Example
                    </span>
                    <div className="p-2.5 rounded-lg bg-zinc-50/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5 text-xs">
                        <div>
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                                Question
                            </span>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                {help.example.question}
                            </p>
                        </div>

                        {help.example.options && (
                            <div>
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                                    Options
                                </span>
                                <div className="space-y-1 pl-1">
                                    {help.example.options.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                                            <span className="text-zinc-400">•</span>
                                            <span>{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {help.example.response && (
                            <div>
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                                    Response
                                </span>
                                <p className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 p-1 rounded border border-zinc-200/60 dark:border-zinc-800 mt-0.5">
                                    {help.example.response}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Tip (if present) */}
                {help.tip && (
                    <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                                Helpful Tip
                            </span>
                            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                                {help.tip}
                            </p>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
