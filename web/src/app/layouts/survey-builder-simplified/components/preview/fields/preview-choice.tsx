"use client";

import React from "react";
import {
    Check,
    ChevronRight,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionModel, SurveyTranslationResource } from "../../../types/survey-schema";
import { getMasterSetById } from "../../../lib/master-data-registry";
import { TranslationService } from "../../../services/translation-service";

interface PreviewChoiceProps {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
    resource?: SurveyTranslationResource | null;
    onOpenMasterCatalog?: (question: QuestionModel) => void;
}

export function PreviewChoice({
    question,
    value,
    onChange,
    locale,
    resource,
    onOpenMasterCatalog,
}: PreviewChoiceProps) {
    const isMaster = question.optionSource === "master";

    if (isMaster) {
        return (
            <MasterDataTriggerCard
                question={question}
                value={value}
                onChange={onChange}
                locale={locale}
                onOpenMasterCatalog={onOpenMasterCatalog}
            />
        );
    }

    const options = question.options || [];
    const isMultiSelect = question.type === "Checkbox";

    const handleSelectOption = (optVal: string) => {
        if (isMultiSelect) {
            const currentArr = Array.isArray(value) ? value : [];
            if (currentArr.includes(optVal)) {
                onChange(currentArr.filter((x) => x !== optVal));
            } else {
                onChange([...currentArr, optVal]);
            }
        } else {
            onChange(optVal);
        }
    };

    return (
        <div className="space-y-1.5">
            {options.map((opt) => {
                const label = TranslationService.resolveChoiceText(opt, locale, resource);
                const isSelected = isMultiSelect
                    ? Array.isArray(value) && value.includes(opt.value)
                    : value === opt.value;

                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt.value)}
                        className={cn(
                            "w-full text-start p-3 min-h-[44px] rounded-xl border transition-all text-xs flex items-center justify-between cursor-pointer select-none",
                            isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 text-zinc-950 dark:text-zinc-50 font-semibold shadow-2xs"
                                : "bg-white dark:bg-zinc-900/70 hover:bg-zinc-50 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                        )}
                    >
                        <span className={cn(locale === "hi" && "font-hindi")}>{label}</span>
                        <div
                            className={cn(
                                "h-4 w-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                                isMultiSelect ? "rounded-xs" : "rounded-full",
                                isSelected
                                    ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950"
                                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                            )}
                        >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function MasterDataTriggerCard({
    question,
    value,
    onChange,
    locale,
    onOpenMasterCatalog,
}: {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
    onOpenMasterCatalog?: (question: QuestionModel) => void;
}) {
    const masterId = question.masterDataConfig?.masterSetId || "trucks";
    const masterDef = getMasterSetById(masterId);
    const displayKey = question.masterDataConfig?.displayField || masterDef?.displayFieldKey || "vehicleNumber";
    const isMultiSelect = question.type === "Checkbox" || Boolean(question.masterDataConfig?.allowMultiSelect);

    const secondaryFields = React.useMemo(() => {
        if (!masterDef) return [];
        if (question.masterDataConfig?.secondaryFields && question.masterDataConfig.secondaryFields.length > 0) {
            return question.masterDataConfig.secondaryFields.filter((k) => k !== displayKey);
        }
        return masterDef.fields.filter((f) => f.key !== displayKey).map((f) => f.key);
    }, [masterDef, question.masterDataConfig, displayKey]);

    // Extract selected record(s)
    const selectedRecords = React.useMemo(() => {
        if (!value || !masterDef) return [];
        if (Array.isArray(value)) {
            return value.map((item) => {
                if (typeof item === "object" && item.record) return item.record;
                const id = typeof item === "object" ? item.recordId || item.id : item;
                return masterDef.sampleRecords.find((r) => r.id === id || r[displayKey] === id);
            }).filter(Boolean);
        }
        if (typeof value === "object") {
            if (value.record) return [value.record];
            const id = value.recordId || value.id;
            const found = masterDef.sampleRecords.find((r) => r.id === id || r[displayKey] === id);
            return found ? [found] : [];
        }
        const found = masterDef.sampleRecords.find((r) => r.id === value || r[displayKey] === value);
        return found ? [found] : [];
    }, [value, masterDef, displayKey]);

    const handleTriggerClick = () => {
        if (onOpenMasterCatalog) {
            onOpenMasterCatalog(question);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(undefined);
    };

    // Render structured Detail rows: Detail 1: ..., Detail 2: ..., Detail 3: ...
    const renderCardDetails = (rec: Record<string, any>) => {
        return (
            <div className="space-y-0.5 pt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                {secondaryFields.map((fieldKey, idx) => {
                    const fieldDef = masterDef?.fields.find((f) => f.key === fieldKey);
                    const val = rec[fieldKey];
                    if (val === undefined || val === null || val === "") return null;
                    return (
                        <div key={fieldKey} className="leading-tight truncate">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                Detail {idx + 1}:
                            </span>{" "}
                            <span className="text-zinc-600 dark:text-zinc-400">
                                {fieldDef?.label ? `${fieldDef.label} - ` : ""}
                                {String(val)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Case 1: Empty state (Screen 1 in reference flow)
    if (selectedRecords.length === 0) {
        return (
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={handleTriggerClick}
                    className="w-full text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-all cursor-pointer select-none flex items-center justify-between shadow-2xs group"
                >
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {locale === "hi" ? "आइटम चुनें" : "Select item"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5 shrink-0" />
                </button>
            </div>
        );
    }

    // Case 2: Single Selection Question Active (Screen 3 & 5 in reference flow)
    if (!isMultiSelect && selectedRecords.length > 0) {
        const rec = selectedRecords[0];
        return (
            <div className="space-y-2">
                <div
                    onClick={handleTriggerClick}
                    className="w-full text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer select-none shadow-2xs relative group"
                >
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-0.5 flex-1 min-w-0 pr-6">
                            <h4 className="font-bold text-xs text-zinc-950 dark:text-zinc-50 truncate">
                                {rec[displayKey]}
                            </h4>
                            {renderCardDetails(rec)}
                        </div>

                        {/* Chevron right */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                            <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </div>

                    {/* Clear Button on top right */}
                    <button
                        type="button"
                        onClick={handleClear}
                        title="Clear selection"
                        className="absolute right-2.5 top-2.5 p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    // Case 3: Multiple Selection Active -> Shows summary card e.g. "4 selected"
    return (
        <div className="space-y-2">
            <div
                onClick={handleTriggerClick}
                className="w-full text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer select-none shadow-2xs relative flex items-center justify-between group"
            >
                <div className="flex items-center gap-2 pr-6 min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {locale === "hi"
                            ? `${selectedRecords.length} चयनित`
                            : `${selectedRecords.length} selected`}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleClear}
                        title="Clear selection"
                        className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer mr-0.5"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                </div>
            </div>
        </div>
    );
}
