"use client";

import React from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, AlertCircle } from "lucide-react";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewDateProps {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
}

export function PreviewDate({ question, value, onChange, locale }: PreviewDateProps) {
    const isRange = question.type === "DateRange";

    if (!isRange) {
        return (
            <div className="space-y-1.5">
                <DatePicker
                    value={typeof value === "string" ? value : ""}
                    onChange={(val) => onChange(val)}
                    placeholder="Select date..."
                    size="default"
                />
            </div>
        );
    }

    // DateRange handling
    const rangeValue = (typeof value === "object" && value !== null)
        ? value
        : { start: "", end: "" };

    const startDate = rangeValue.start || "";
    const endDate = rangeValue.end || "";

    const handleStartChange = (s: string) => {
        onChange({
            start: s,
            end: endDate,
        });
    };

    const handleEndChange = (e: string) => {
        onChange({
            start: startDate,
            end: e,
        });
    };

    let isInvalidOrder = false;
    let durationDays: number | null = null;

    if (startDate && endDate) {
        const d1 = new Date(startDate);
        const d2 = new Date(endDate);
        if (d1 > d2) {
            isInvalidOrder = true;
        } else {
            const diffTime = Math.abs(d2.getTime() - d1.getTime());
            durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
    }

    return (
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Date Range Selection
                    </span>
                </div>
                {durationDays !== null && !isInvalidOrder && (
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {durationDays} {durationDays === 1 ? "day" : "days"}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        Start Date
                    </Label>
                    <DatePicker
                        value={startDate}
                        onChange={handleStartChange}
                        placeholder="Select start date..."
                        size="sm"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        End Date
                    </Label>
                    <DatePicker
                        value={endDate}
                        onChange={handleEndChange}
                        placeholder="Select end date..."
                        size="sm"
                    />
                </div>
            </div>

            {isInvalidOrder && (
                <div className="p-2 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Start date cannot be after end date.</span>
                </div>
            )}
        </div>
    );
}
