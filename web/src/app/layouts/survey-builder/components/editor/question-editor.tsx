"use client";

import React, { useState } from "react";
import {
    Sliders,
    ShieldCheck,
    GitBranch,
    Languages,
    SlidersHorizontal,
    Layers,
    Lock,
    Copy,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionModel, SurveyModel } from "../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";
import { BasicSettingsTab } from "./tabs/basic-settings-tab";
import { OptionsTab } from "./tabs/options-tab";
import { ValidationTab } from "./tabs/validation-tab";
import { LogicTab } from "./tabs/logic-tab";
import { RepeaterTab } from "./tabs/repeater-tab";
import { TranslationTab } from "./tabs/translation-tab";
import { AdvancedTab } from "./tabs/advanced-tab";
import { QuestionTypeHelpPopover } from "../common/question-type-help-popover";

interface QuestionEditorProps {
    question: QuestionModel;
    survey: SurveyModel;
    onChangeQuestion: (updatedQuestion: QuestionModel) => void;
    onDuplicateQuestion: (questionId: string) => void;
    onDeleteQuestion: (question: QuestionModel) => void;
    onOpenLanguageManager: () => void;
    onUpdateSurveyQuestions?: (updatedQuestions: QuestionModel[]) => void;
    onSelectQuestion?: (questionId: string) => void;
    isPublished?: boolean;
}

type EditorTabType = "basic" | "options" | "validation" | "logic" | "repeater" | "translations" | "advanced";

export function QuestionEditor({
    question,
    survey,
    onChangeQuestion,
    onDuplicateQuestion,
    onDeleteQuestion,
    onOpenLanguageManager,
    onUpdateSurveyQuestions,
    onSelectQuestion,
    isPublished = false,
}: QuestionEditorProps) {
    const [activeTab, setActiveTab] = useState<EditorTabType>("basic");

    // Always reset tab to basic when switching to a new question
    React.useEffect(() => {
        setActiveTab("basic");
    }, [question.id]);

    const typeDescriptor = QUESTION_TYPE_REGISTRY[question.type];
    const isChoiceType =
        question.type === "Radio" ||
        question.type === "Checkbox" ||
        question.type === "Dropdown" ||
        question.type === "Selected Dropdown";

    const isRepeaterType = question.type === "Repeater_QT" || Boolean(question.repeater?.isRepeater);

    const conditionCount = question.visibility.ruleGroup?.conditions?.length || 0;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 min-w-0 w-full overflow-hidden">
            {/* Top Question Header Bar */}
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                            Q{question.displayIndex || question.number}
                        </span>
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50 truncate max-w-[280px] lg:max-w-[400px]">
                            {typeDescriptor?.displayName || question.type}
                        </span>
                        <QuestionTypeHelpPopover type={question.type} side="bottom" align="start" />
                    </div>

                    <span className="text-zinc-300 dark:text-zinc-700 text-xs hidden sm:inline">•</span>

                    <span className="font-mono text-xs text-zinc-500 bg-white dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 truncate hidden sm:inline max-w-[180px]">
                        {question.columnName}
                    </span>

                    {isPublished && (
                        <Badge variant="outline" className="text-[10px] border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 gap-1 bg-zinc-100 dark:bg-zinc-800">
                            <Lock className="h-3 w-3" /> Read-Only
                        </Badge>
                    )}
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicateQuestion(question.id)}
                        className="h-8 px-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Duplicate</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteQuestion(question)}
                        disabled={isPublished}
                        className="h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 disabled:opacity-40"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                    </Button>
                </div>
            </div>

            {/* Original 7-Tab Navigation Bar with Active Underline State */}
            <div className="px-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                <div className="flex items-center space-x-4 h-10 overflow-x-auto no-scrollbar">
                    {/* Basic Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("basic")}
                        className={cn(
                            "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                            activeTab === "basic"
                                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        )}
                    >
                        <Sliders className="h-3.5 w-3.5" />
                        <span>Basic</span>
                    </button>

                    {/* Validation Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("validation")}
                        className={cn(
                            "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                            activeTab === "validation"
                                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        )}
                    >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Validation</span>
                    </button>

                    {/* Logic Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("logic")}
                        className={cn(
                            "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                            activeTab === "logic"
                                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        )}
                    >
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>Logic {conditionCount > 0 && `(${conditionCount})`}</span>
                    </button>

                    {/* Repeater Tab (if repeater) */}
                    {isRepeaterType && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("repeater")}
                            className={cn(
                                "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                                activeTab === "repeater"
                                    ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            <Layers className="h-3.5 w-3.5" />
                            <span>Repeater</span>
                        </button>
                    )}

                    {/* Translations Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("translations")}
                        className={cn(
                            "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                            activeTab === "translations"
                                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        )}
                    >
                        <Languages className="h-3.5 w-3.5" />
                        <span>Translations</span>
                    </button>

                    {/* Advanced Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("advanced")}
                        className={cn(
                            "flex items-center gap-1.5 px-1 py-2 text-xs font-semibold transition-all border-b-2 -mb-px shrink-0 cursor-pointer",
                            activeTab === "advanced"
                                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        )}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Advanced</span>
                    </button>
                </div>
            </div>

            {/* Active Tab Content Pane */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 bg-zinc-50/40 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto">
                    {activeTab === "basic" && (
                        <div className="space-y-6">
                            <BasicSettingsTab
                                question={question}
                                onChangeQuestion={onChangeQuestion}
                                isPublished={isPublished}
                            />
                            {/* Choices live on the Basic tab for choice-type questions */}
                            {isChoiceType && (
                                <OptionsTab
                                    question={question}
                                    onChangeQuestion={onChangeQuestion}
                                    isPublished={isPublished}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === "validation" && (
                        <ValidationTab
                            question={question}
                            onChangeQuestion={onChangeQuestion}
                            isPublished={isPublished}
                        />
                    )}

                    {activeTab === "logic" && (
                        <LogicTab
                            question={question}
                            allQuestions={survey.questions}
                            onChangeQuestion={onChangeQuestion}
                            isPublished={isPublished}
                        />
                    )}

                    {activeTab === "repeater" && isRepeaterType && (
                        <RepeaterTab
                            question={question}
                            allQuestions={survey.questions}
                            onChangeQuestion={onChangeQuestion}
                            onUpdateSurveyQuestions={onUpdateSurveyQuestions}
                            onSelectQuestion={onSelectQuestion}
                            isPublished={isPublished}
                        />
                    )}

                    {activeTab === "translations" && (
                        <TranslationTab
                            question={question}
                            survey={survey}
                            locales={survey.locales}
                            onChangeQuestion={onChangeQuestion}
                            onOpenLanguageManager={onOpenLanguageManager}
                            isPublished={isPublished}
                        />
                    )}

                    {activeTab === "advanced" && (
                        <AdvancedTab
                            question={question}
                            allQuestions={survey.questions}
                            survey={survey}
                            onChangeQuestion={onChangeQuestion}
                            isPublished={isPublished}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
