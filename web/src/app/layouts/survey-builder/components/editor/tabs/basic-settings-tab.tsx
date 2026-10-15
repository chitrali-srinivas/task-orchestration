"use client";

import React from "react";
import { Sparkles, HelpCircle, Check, AlertCircle } from "lucide-react";
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
import { BackendQuestionType, QuestionModel } from "../../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../../registry/question-type-registry";
import { generateColumnName } from "../../../lib/survey-normalizer";
import { QuestionTypeHelpPopover } from "../../common/question-type-help-popover";

interface BasicSettingsTabProps {
    question: QuestionModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

export function BasicSettingsTab({
    question,
    onChangeQuestion,
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
        onChangeQuestion({
            ...question,
            type: newType,
            displayType: newType,
            options: typeDescriptor?.defaultConfig.options
                ? typeDescriptor.defaultConfig.options.map((opt, i) => ({
                      id: `opt_${Date.now()}_${i + 1}`,
                      value: opt.value,
                      labels: { en: opt.labels.en, hi: opt.labels.hi },
                  }))
                : question.options,
        });
    };

    const isSnakeCase = /^[a-z0-9_]+$/.test(question.columnName || "");

    return (
        <div className="space-y-6">
            {/* Primary Titles Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Question Prompts & Labels
                </h3>

                {/* English Prompt */}
                <div className="space-y-1.5">
                    <Label htmlFor="q-title-en" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                        <span>Primary Question Title (English) <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] text-zinc-400 font-mono">Qn</span>
                    </Label>
                    <Input
                        id="q-title-en"
                        placeholder="e.g. Are you the owner of the farm?"
                        value={question.titles.en || ""}
                        disabled={isPublished}
                        onChange={(e) => handleTitleChange("en", e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                </div>
                {/* Regional-language titles are managed on the Translation tab. */}

                {/* Required toggle */}
                <div className="flex items-center justify-between">
                    <Label htmlFor="q-required" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Required
                    </Label>
                    <Switch
                        id="q-required"
                        checked={Boolean(question.validation.required)}
                        disabled={isPublished}
                        onCheckedChange={(checked) =>
                            onChangeQuestion({
                                ...question,
                                validation: {
                                    ...question.validation,
                                    required: checked,
                                },
                            })
                        }
                    />
                </div>

                {/* Question type & database column */}
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
                                {Object.values(QUESTION_TYPE_REGISTRY).map((type) => (
                                    <SelectItem key={type.id} value={type.id} className="text-xs">
                                        {type.displayName}
                                    </SelectItem>
                                ))}
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
        </div>
    );
}
