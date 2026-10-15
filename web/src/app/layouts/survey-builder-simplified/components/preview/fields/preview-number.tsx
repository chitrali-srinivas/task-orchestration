"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewNumberProps {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
}

export function PreviewNumber({ question, value, onChange, locale }: PreviewNumberProps) {
    const valConfig = question.validation || {};
    const min = valConfig.minValue;
    const max = valConfig.maxValue;
    const stepNum = valConfig.decimalPlaces && valConfig.decimalPlaces > 0 ? Math.pow(10, -valConfig.decimalPlaces) : 1;
    const step = String(stepNum);

    const numVal = value !== undefined && value !== null && value !== "" ? Number(value) : null;

    const handleIncrement = () => {
        const curr = numVal !== null ? numVal : (min !== undefined ? min : 0);
        const next = curr + stepNum;
        if (max !== undefined && next > max) return;
        onChange(Number(next.toFixed(valConfig.decimalPlaces || 0)));
    };

    const handleDecrement = () => {
        const curr = numVal !== null ? numVal : (min !== undefined ? min : 0);
        const next = curr - stepNum;
        if (min !== undefined && next < min) return;
        onChange(Number(next.toFixed(valConfig.decimalPlaces || 0)));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleDecrement}
                    disabled={min !== undefined && numVal !== null && numVal <= min}
                    className="h-10 w-10 shrink-0 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer"
                >
                    <Minus className="h-4 w-4" />
                </Button>

                <Input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    placeholder={min !== undefined && max !== undefined ? `e.g. ${min} - ${max}` : "Enter number"}
                    value={value !== undefined && value !== null ? value : ""}
                    onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-10 text-center text-sm font-semibold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono rounded-xl px-3"
                />

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIncrement}
                    disabled={max !== undefined && numVal !== null && numVal >= max}
                    className="h-10 w-10 shrink-0 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {(min !== undefined || max !== undefined) && (
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono px-1">
                    {min !== undefined && <span>Min: {min}</span>}
                    {max !== undefined && <span>Max: {max}</span>}
                </div>
            )}
        </div>
    );
}
