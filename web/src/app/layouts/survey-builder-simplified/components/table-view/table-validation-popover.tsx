"use client";

import React, { useState } from "react";
import { ShieldCheck, Asterisk, Languages, ChevronDown, ChevronUp } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LocaleDefinition, QuestionModel } from "../../types/survey-schema";
import { getPresetsForQuestionType, getPresetById } from "../../lib/validation-presets";

interface TableValidationPopoverProps {
    question: QuestionModel;
    onUpdateQuestion: (updated: QuestionModel) => void;
    locales?: LocaleDefinition[];
    isPublished?: boolean;
}

export function TableValidationPopover({
    question,
    onUpdateQuestion,
    locales = [],
    isPublished = false,
}: TableValidationPopoverProps) {
    const [open, setOpen] = React.useState(false);
    const [showTranslations, setShowTranslations] = useState(false);
    const val = question.validation || {};
    const nonDefaultLocales = locales.filter((l) => l.code !== "en" && !l.isDefault);

    const isNumeric =
        question.type.includes("Decimal") ||
        question.type.includes("WholeNum") ||
        question.type.includes("NaturalNum") ||
        question.type === "Number";

    const isText = question.type === "Subjective" || question.type === "TextArea";
    const availablePresets = getPresetsForQuestionType(question.type);

    const handleUpdate = (updatedVal: Partial<typeof val>) => {
        onUpdateQuestion({
            ...question,
            validation: {
                ...val,
                ...updatedVal,
            },
        });
    };

    const handleLocalizedCustomErrorChange = (localeCode: string, text: string) => {
        const currentMap =
            typeof val.customErrorMessage === "object" && val.customErrorMessage !== null
                ? val.customErrorMessage
                : typeof val.customErrorMessage === "string"
                ? { en: val.customErrorMessage }
                : {};
        handleUpdate({
            customErrorMessage: {
                ...currentMap,
                [localeCode]: text,
            },
        });
    };

    const defaultRequiredMsg =
        typeof val.customErrorMessage === "string"
            ? val.customErrorMessage
            : val.customErrorMessage?.en || "";

    // Compact chip summary
    const summaryChips: string[] = [];
    if (val.required) summaryChips.push("Required");
    if (val.minValue !== undefined || val.maxValue !== undefined) {
        summaryChips.push(`Range: ${val.minValue ?? 0}-${val.maxValue ?? "∞"}`);
    }
    if (val.minChar !== undefined || val.maxChar !== undefined) {
        summaryChips.push(`Len: ${val.minChar ?? 0}-${val.maxChar ?? "∞"}`);
    }
    if (val.presetId) {
        const preset = getPresetById(val.presetId);
        summaryChips.push(preset ? preset.name : "Preset");
    } else if (val.regexPattern) {
        summaryChips.push(`Regex: ${val.regexPattern.slice(0, 10)}...`);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="w-full text-left p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 flex-wrap cursor-pointer"
                >
                    {summaryChips.length === 0 ? (
                        <span className="text-[11px] text-zinc-400 italic">None (Optional)</span>
                    ) : (
                        summaryChips.map((chip) => (
                            <span
                                key={chip}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                            >
                                {chip}
                            </span>
                        ))
                    )}
                </button>
            </PopoverTrigger>

            <PopoverContent
                side="left"
                align="start"
                className="w-88 p-4 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl space-y-3.5 max-h-[85vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Validation (Q{question.displayIndex || question.number})
                        </h4>
                    </div>
                </div>

                {/* Required Toggle & Prompt for Error Message */}
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <Asterisk className="h-3.5 w-3.5 text-rose-500" /> Mandatory Field
                        </Label>
                        <Switch
                            checked={Boolean(val.required)}
                            disabled={isPublished}
                            onCheckedChange={(checked) => handleUpdate({ required: checked })}
                        />
                    </div>

                    {Boolean(val.required) && (
                        <div className="space-y-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 animate-in fade-in-50 duration-150">
                            <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                Required Error Message (EN)
                            </Label>
                            <Input
                                placeholder="e.g. This question is required to proceed."
                                value={defaultRequiredMsg}
                                disabled={isPublished}
                                onChange={(e) => handleLocalizedCustomErrorChange("en", e.target.value)}
                                className="h-7.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />

                            {/* Option to add translations to validation in table */}
                            {nonDefaultLocales.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowTranslations(!showTranslations)}
                                        className="flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
                                    >
                                        <Languages className="h-3 w-3 text-zinc-500" />
                                        <span>Translations ({nonDefaultLocales.length})</span>
                                        {showTranslations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>

                                    {showTranslations && (
                                        <div className="space-y-2 pl-1 border-l-2 border-zinc-200 dark:border-zinc-800 animate-in fade-in-50 duration-150">
                                            {nonDefaultLocales.map((loc) => {
                                                const locMsg =
                                                    typeof val.customErrorMessage === "object" && val.customErrorMessage !== null
                                                        ? val.customErrorMessage[loc.code] || ""
                                                        : "";

                                                return (
                                                    <div key={loc.code} className="space-y-1">
                                                        <Label className="text-[10px] font-medium text-zinc-500">
                                                            {loc.label} Error Message
                                                        </Label>
                                                        <Input
                                                            placeholder={`Error text in ${loc.label}...`}
                                                            value={locMsg}
                                                            disabled={isPublished}
                                                            onChange={(e) => handleLocalizedCustomErrorChange(loc.code, e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Preset Validator */}
                {availablePresets.length > 0 && (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Format Preset
                        </Label>
                        <Select
                            disabled={isPublished}
                            value={val.presetId || "none"}
                            onValueChange={(pId) => {
                                if (pId === "none") {
                                    handleUpdate({ presetId: undefined, regexPattern: undefined });
                                } else {
                                    const preset = getPresetById(pId);
                                    handleUpdate({
                                        presetId: pId,
                                        regexPattern: preset?.pattern,
                                        patternDescription: preset?.description,
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <SelectValue placeholder="Select preset..." />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                <SelectItem value="none">None (Free input)</SelectItem>
                                {availablePresets.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Custom Regex Pattern */}
                {(isText || isNumeric) && (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Custom Regex Pattern
                        </Label>
                        <Input
                            placeholder="e.g. ^[A-Z0-9]+$"
                            value={val.regexPattern || ""}
                            disabled={isPublished}
                            onChange={(e) => handleUpdate({ regexPattern: e.target.value || undefined, presetId: undefined })}
                            className="h-8 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>
                )}

                {/* Numeric Range */}
                {isNumeric && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Min Value</Label>
                            <Input
                                type="number"
                                placeholder="Min"
                                value={val.minValue !== undefined ? val.minValue : ""}
                                disabled={isPublished}
                                onChange={(e) => handleUpdate({ minValue: e.target.value === "" ? undefined : Number(e.target.value) })}
                                className="h-7 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Max Value</Label>
                            <Input
                                type="number"
                                placeholder="Max"
                                value={val.maxValue !== undefined ? val.maxValue : ""}
                                disabled={isPublished}
                                onChange={(e) => handleUpdate({ maxValue: e.target.value === "" ? undefined : Number(e.target.value) })}
                                className="h-7 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                )}

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="h-7 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium"
                    >
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

