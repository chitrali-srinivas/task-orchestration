"use client";

import React from "react";
import {
    Sparkles,
    HelpCircle,
    Check,
    AlertCircle,
    GitBranch,
    Plus,
    ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BackendQuestionType, QuestionModel, NumberQuestionConfig, NumberUnitMode } from "../../../types/survey-schema";
import { SIMPLIFIED_QUESTION_TYPES, QUESTION_TYPE_REGISTRY } from "../../../registry/question-type-registry";
import { generateColumnName } from "../../../lib/survey-normalizer";
import { QuestionTypeHelpPopover } from "../../common/question-type-help-popover";
import { UnitSelector } from "../../common/unit-selector";
import { normalizeLegacyUnit, formatUnitShort } from "../../../lib/unit-catalog";

interface BasicSettingsTabProps {
    question: QuestionModel;
    surveyQuestions?: QuestionModel[];
    onChangeQuestion: (updated: QuestionModel) => void;
    onSelectQuestion?: (questionId: string) => void;
    onAddFollowUp?: (question: QuestionModel) => void;
    isPublished?: boolean;
}

export function BasicSettingsTab({
    question,
    surveyQuestions = [],
    onChangeQuestion,
    onSelectQuestion,
    onAddFollowUp,
    isPublished,
}: BasicSettingsTabProps) {
    const handleTitleChange = (locale: string, val: string) => {
        const updatedTitles = { ...question.titles, [locale]: val };
        // If changing english title and column name hasn't been heavily customized, auto-suggest
        let newCol = question.columnName;
        if (locale === "en" && (!newCol || newCol === generateColumnName(question.titles.en || ""))) {
            newCol = generateColumnName(val);
        }

        onChangeQuestion({
            ...question,
            titles: updatedTitles,
            columnName: newCol,
        });
    };

    const handleTypeChange = (newType: BackendQuestionType) => {
        const typeDescriptor = QUESTION_TYPE_REGISTRY[newType];
        const newValidation = { ...question.validation };

        if (newType === "Number" && !newValidation.numberFormat) {
            newValidation.numberFormat = "decimal";
            newValidation.decimalPlaces = 2;
        }

        onChangeQuestion({
            ...question,
            type: newType,
            displayType: newType,
            validation: newValidation,
            options: typeDescriptor?.defaultConfig.options
                ? typeDescriptor.defaultConfig.options.map((opt, i) => ({
                      id: `opt_${Date.now()}_${i + 1}`,
                      value: opt.value,
                      labels: { en: opt.labels.en, hi: opt.labels.hi },
                  }))
                : question.options,
        });
    };

    const handleValidationUpdate = (updatedVal: Partial<typeof question.validation>) => {
        onChangeQuestion({
            ...question,
            validation: {
                ...question.validation,
                ...updatedVal,
            },
        });
    };

    const isSnakeCase = /^[a-z0-9_]+$/.test(question.columnName || "");
    const isNumberType = question.type === "Number" || question.type.includes("Decimal") || question.type.includes("WholeNum") || question.type.includes("NaturalNum");
    const isDateRangeType = question.type === "DateRange";

    const numberFormat = question.validation.numberFormat || (question.type.includes("WholeNum") || question.type.includes("NaturalNum") ? "integer" : "decimal");

    // Children branching from this question
    const followUpChildren = surveyQuestions.filter(
        (q) =>
            q.id !== question.id &&
            (q.parentQuestionId === question.id ||
                (q.visibility?.enabled &&
                    q.visibility.ruleGroup?.conditions?.some((c) => c.questionId === question.id)) ||
                (q.displayIndex &&
                    q.displayIndex.startsWith(`${question.displayIndex || question.number}.`)))
    );

    const isRepeater = question.type === "Repeater_QT" || Boolean(question.repeater?.isRepeater);

    return (
        <div className="space-y-6">
            {/* Primary Question Prompt Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Question Prompt
                </h3>

                {/* Primary English Prompt */}
                <div className="space-y-1.5">
                    <Label htmlFor="q-title-en" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                        <span>Primary Question Title <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] text-zinc-400 font-mono">Default Language (EN)</span>
                    </Label>
                    <Input
                        id="q-title-en"
                        placeholder="e.g. Are you the owner of the farm?"
                        value={question.titles.en || ""}
                        disabled={isPublished}
                        onChange={(e) => handleTitleChange("en", e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        The primary prompt shown to surveyors. Multilingual translations are managed in the Version Translations table.
                    </p>
                </div>
            </div>

            {/* Type & Schema Identification Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Question Type & Database Column
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Question Type Switcher */}
                    <div className="space-y-1.5">
                        <div className="h-5 flex items-center justify-between">
                            <Label htmlFor="q-type-select" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Response Type <span className="text-rose-500">*</span>
                            </Label>
                            <QuestionTypeHelpPopover type={question.type} side="right" />
                        </div>
                        <Select
                            value={question.type}
                            onValueChange={(val: any) => handleTypeChange(val)}
                            disabled={isPublished}
                        >
                            <SelectTrigger id="q-type-select" className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                {SIMPLIFIED_QUESTION_TYPES.map((typeId) => {
                                    const descriptor = QUESTION_TYPE_REGISTRY[typeId];
                                    if (!descriptor) return null;
                                    return (
                                        <SelectItem key={typeId} value={typeId} className="text-xs">
                                            {descriptor.displayName}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Database Column Name */}
                    <div className="space-y-1.5">
                        <div className="h-5 flex items-center justify-between">
                            <Label htmlFor="q-col-name" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Database Column Name <span className="text-rose-500">*</span>
                            </Label>
                            <button
                                type="button"
                                onClick={() =>
                                    onChangeQuestion({
                                        ...question,
                                        columnName: generateColumnName(question.titles.en || "field"),
                                    })
                                }
                                className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 font-medium"
                            >
                                <Sparkles className="h-3 w-3" /> Auto-Format
                            </button>
                        </div>
                        <Input
                            id="q-col-name"
                            placeholder="e.g. is_owner"
                            value={question.columnName || ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                onChangeQuestion({
                                    ...question,
                                    columnName: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                })
                            }
                            className="h-10 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                        {!isSnakeCase && question.columnName && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Column name must use lowercase letters, numbers, and underscores only.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Dedicated Card: Number Format & Unit Configuration */}
            {isNumberType && (() => {
                const unitMode: NumberUnitMode =
                    question.numberConfig?.unitMode ||
                    question.validation.unitMode ||
                    (question.validation.unitSuffix ? "fixed" : "none");

                const selectedUnit =
                    question.numberConfig?.unit ||
                    question.validation.unit ||
                    normalizeLegacyUnit(question.validation.unitSuffix);

                const allowedUnits =
                    question.numberConfig?.allowedUnits ||
                    question.validation.allowedUnits ||
                    [];

                const defaultUnit =
                    question.numberConfig?.defaultUnit ||
                    question.validation.defaultUnit;

                const handleNumberConfigUpdate = (updates: Partial<NumberQuestionConfig>) => {
                    const newConfig: NumberQuestionConfig = {
                        format: numberFormat,
                        decimalPlaces: question.validation.decimalPlaces,
                        minValue: question.validation.minValue,
                        maxValue: question.validation.maxValue,
                        unitMode,
                        unit: selectedUnit,
                        allowedUnits,
                        defaultUnit,
                        ...question.numberConfig,
                        ...updates,
                    };

                    onChangeQuestion({
                        ...question,
                        numberConfig: newConfig,
                        validation: {
                            ...question.validation,
                            numberFormat: newConfig.format,
                            decimalPlaces: newConfig.format === "integer" ? 0 : (newConfig.decimalPlaces !== undefined ? newConfig.decimalPlaces : 2),
                            minValue: newConfig.minValue,
                            maxValue: newConfig.maxValue,
                            unitMode: newConfig.unitMode,
                            unit: newConfig.unit,
                            allowedUnits: newConfig.allowedUnits,
                            defaultUnit: newConfig.defaultUnit,
                            unitSuffix: newConfig.unitMode === "fixed" ? newConfig.unit : undefined,
                        },
                    });
                };

                return (
                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Number & Unit Configuration
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700">
                                Numeric Field
                            </Badge>
                        </div>

                        {/* Format & Unit Mode in Clean Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Number Format Mode */}
                            <div className="space-y-1.5">
                                <Label htmlFor="q-num-format-select" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Number Format <span className="text-rose-500">*</span>
                                </Label>
                                <Select
                                    value={numberFormat}
                                    onValueChange={(val: "integer" | "decimal") => {
                                        handleNumberConfigUpdate({
                                            format: val,
                                            decimalPlaces: val === "integer" ? 0 : 2,
                                        });
                                    }}
                                    disabled={isPublished}
                                >
                                    <SelectTrigger id="q-num-format-select" className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                                        <SelectValue placeholder="Select number format" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="decimal">Decimal Number (e.g., 12.50, 0.75)</SelectItem>
                                        <SelectItem value="integer">Whole Integer (e.g., 1, 5, 42)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Unit Mode Selector */}
                            <div className="space-y-1.5">
                                <Label htmlFor="q-unit-mode-select" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Unit of Measurement
                                </Label>
                                <Select
                                    value={unitMode}
                                    onValueChange={(val: NumberUnitMode) => {
                                        handleNumberConfigUpdate({
                                            unitMode: val,
                                            unit: val === "fixed" ? (selectedUnit || "kilogram") : undefined,
                                            allowedUnits: val === "allowed" ? (allowedUnits.length > 0 ? allowedUnits : ["kilogram", "metric_ton"]) : undefined,
                                            defaultUnit: val === "allowed" ? (defaultUnit || "kilogram") : undefined,
                                        });
                                    }}
                                    disabled={isPublished}
                                >
                                    <SelectTrigger id="q-unit-mode-select" className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                                        <SelectValue placeholder="Select unit mode" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="none">No Unit (Pure Number)</SelectItem>
                                        <SelectItem value="fixed">Fixed Unit (Surveyor cannot change)</SelectItem>
                                        <SelectItem value="allowed">Multiple Allowed Units (Surveyor chooses unit)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Interactive Unit Configuration */}
                        {unitMode === "fixed" && (
                            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                <UnitSelector
                                    mode="fixed"
                                    value={selectedUnit}
                                    disabled={isPublished}
                                    onChange={(newUnit?: string) => {
                                        handleNumberConfigUpdate({ unit: newUnit });
                                    }}
                                />
                            </div>
                        )}
                        {unitMode === "allowed" && (
                            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                <UnitSelector
                                    mode="allowed"
                                    allowedUnits={allowedUnits}
                                    defaultUnit={defaultUnit}
                                    disabled={isPublished}
                                    onAllowedUnitsChange={(newAllowedUnits: string[]) => {
                                        handleNumberConfigUpdate({
                                            allowedUnits: newAllowedUnits,
                                        });
                                    }}
                                    onDefaultUnitChange={(newDefaultUnit?: string) => {
                                        handleNumberConfigUpdate({
                                            defaultUnit: newDefaultUnit,
                                        });
                                    }}
                                />
                            </div>
                        )}

                        {/* Boundaries: Min / Max / Decimals */}
                        {(() => {
                            const isMinMaxInvalid = question.validation.minValue !== undefined && question.validation.maxValue !== undefined && question.validation.minValue > question.validation.maxValue;
                            return (
                                <>
                                    <div className={cn(
                                        "grid grid-cols-1 gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800",
                                        numberFormat === "decimal" ? "sm:grid-cols-3" : "sm:grid-cols-2"
                                    )}>
                                        <div className="space-y-1">
                                            <Label htmlFor="q-min-val" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                                Min Value (Optional)
                                            </Label>
                                            <Input
                                                id="q-min-val"
                                                type="number"
                                                placeholder="No min"
                                                value={question.validation.minValue !== undefined ? question.validation.minValue : ""}
                                                disabled={isPublished}
                                                onChange={(e) =>
                                                    handleNumberConfigUpdate({
                                                        minValue: e.target.value === "" ? undefined : Number(e.target.value),
                                                    })
                                                }
                                                className={cn(
                                                    "h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                                    isMinMaxInvalid && "border-rose-500 focus-visible:ring-rose-500"
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="q-max-val" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                                Max Value (Optional)
                                            </Label>
                                            <Input
                                                id="q-max-val"
                                                type="number"
                                                placeholder="No max"
                                                value={question.validation.maxValue !== undefined ? question.validation.maxValue : ""}
                                                disabled={isPublished}
                                                onChange={(e) =>
                                                    handleNumberConfigUpdate({
                                                        maxValue: e.target.value === "" ? undefined : Number(e.target.value),
                                                    })
                                                }
                                                className={cn(
                                                    "h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                                    isMinMaxInvalid && "border-rose-500 focus-visible:ring-rose-500"
                                                )}
                                            />
                                        </div>

                                        {numberFormat === "decimal" && (
                                            <div className="space-y-1">
                                                <Label htmlFor="q-dec-places" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Decimal Precision
                                                </Label>
                                                <Input
                                                    id="q-dec-places"
                                                    type="number"
                                                    min={1}
                                                    max={6}
                                                    placeholder="2"
                                                    value={question.validation.decimalPlaces !== undefined ? question.validation.decimalPlaces : 2}
                                                    disabled={isPublished}
                                                    onChange={(e) =>
                                                        handleNumberConfigUpdate({
                                                            decimalPlaces: e.target.value === "" ? 2 : Number(e.target.value),
                                                        })
                                                    }
                                                    className="h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {isMinMaxInvalid && (
                                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in-50">
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                            <span>Minimum value ({question.validation.minValue}) cannot be greater than maximum value ({question.validation.maxValue}).</span>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* Date Range Configuration */}
            {isDateRangeType && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Date Range Configuration
                    </h3>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="space-y-0.5">
                            <Label htmlFor="allow-same-day" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Allow Single Day Selection
                            </Label>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Allows respondent to pick the exact same date for both Start and End date.
                            </p>
                        </div>
                        <Switch
                            id="allow-same-day"
                            checked={question.validation.allowSameDayRange !== false}
                            disabled={isPublished}
                            onCheckedChange={(checked) => handleValidationUpdate({ allowSameDayRange: checked })}
                        />
                    </div>
                </div>
            )}

            {/* Required Response Behavior Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Required Response Rule
                </h3>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="space-y-0.5">
                            <Label htmlFor="q-required-switch" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                <span>Required Field</span>
                                <span className="text-rose-500 font-bold">*</span>
                            </Label>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                When enabled, the respondent cannot submit the survey without answering this question.
                            </p>
                        </div>
                        <Switch
                            id="q-required-switch"
                            checked={Boolean(question.validation.required)}
                            disabled={isPublished}
                            onCheckedChange={(checked) => handleValidationUpdate({ required: checked })}
                        />
                    </div>

                    {/* Progressive Disclosure: Custom Error Message for Required Response */}
                    {Boolean(question.validation.required) && (
                        <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40 space-y-2 animate-in fade-in-50 duration-150">
                            <Label htmlFor="q-mandatory-error-msg" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                                <span>Required Error Message</span>
                                <span className="text-[10px] text-zinc-400 font-mono">Default Language (EN)</span>
                            </Label>
                            <Input
                                id="q-mandatory-error-msg"
                                placeholder="e.g. This question is required to proceed."
                                value={
                                    typeof question.validation.customErrorMessage === "string"
                                        ? question.validation.customErrorMessage
                                        : question.validation.customErrorMessage?.en || ""
                                }
                                disabled={isPublished}
                                onChange={(e) => {
                                    const currentMap =
                                        typeof question.validation.customErrorMessage === "object" && question.validation.customErrorMessage !== null
                                            ? question.validation.customErrorMessage
                                            : {};
                                    onChangeQuestion({
                                        ...question,
                                        validation: {
                                            ...question.validation,
                                            customErrorMessage: {
                                                ...currentMap,
                                                en: e.target.value,
                                            },
                                        },
                                    });
                                }}
                                className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                            />
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Message displayed when a surveyor leaves this field blank. Multilingual translations are managed in the Translations table.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Branching & Follow-up Questions Card (Accessible for Number, Text, Date, and all question types) */}
            {!isRepeater && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Follow-up Questions ({followUpChildren.length})
                            </h3>
                        </div>
                        {onAddFollowUp && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onAddFollowUp(question)}
                                disabled={isPublished || Boolean(question.followUpDepth && question.followUpDepth >= 5)}
                                className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-300 dark:border-zinc-700 gap-1.5 cursor-pointer font-medium"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add Follow-up Question</span>
                            </Button>
                        )}
                    </div>

                    {followUpChildren.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                            {followUpChildren.map((child) => (
                                <div
                                    key={child.id}
                                    onClick={() => onSelectQuestion?.(child.id)}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                            Q{child.displayIndex || child.number}
                                        </span>
                                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-[320px]">
                                            {child.titles.en || child.columnName}
                                        </span>
                                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-4">
                                            {child.type}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium">
                                        <span>Configure</span>
                                        <ArrowRight className="h-3 w-3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                No follow-up questions configured yet
                            </p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                Add conditional child questions that appear based on what respondent enters in Q{question.displayIndex || question.number}.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
