"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    Sliders,
    ListChecks,
    ShieldCheck,
    GitBranch,
    SlidersHorizontal,
    Layers,
    Lock,
    Copy,
    Trash2,
    CornerDownRight,
    ArrowRight,
    Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionModel, SurveyModel } from "../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";
import { BasicSettingsTab } from "./tabs/basic-settings-tab";
import { OptionsTab } from "./tabs/options-tab";
import { ValidationTab } from "./tabs/validation-tab";
import { RepeaterTab } from "./tabs/repeater-tab";
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
    onAddFollowUp?: (question: QuestionModel) => void;
    isPublished?: boolean;
}

export type EditorTabType = "basic" | "options" | "validation" | "repeater" | "advanced";

interface SectionConfig {
    id: EditorTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    badge?: string;
    count?: number;
    show: boolean;
}

export function QuestionEditor({
    question,
    survey,
    onChangeQuestion,
    onDuplicateQuestion,
    onDeleteQuestion,
    onOpenLanguageManager,
    onUpdateSurveyQuestions,
    onSelectQuestion,
    onAddFollowUp,
    isPublished = false,
}: QuestionEditorProps) {
    const [activeTab, setActiveTab] = useState<EditorTabType>("basic");
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const typeDescriptor = QUESTION_TYPE_REGISTRY[question.type];
    const isChoiceType =
        question.type === "Radio" ||
        question.type === "Checkbox" ||
        question.type === "Dropdown" ||
        question.type === "Selected Dropdown";

    const isRepeaterType = question.type === "Repeater_QT" || Boolean(question.repeater?.isRepeater);
    const conditionCount = question.visibility?.ruleGroup?.conditions?.length || 0;
    const optionCount = question.options?.length || 0;

    // Resolve full ancestor chain for nested questions (Feature 3)
    const ancestorChain = useMemo(() => {
        const chain: QuestionModel[] = [];
        let currId = question.parentQuestionId;
        const visited = new Set<string>([question.id]);

        while (currId && !visited.has(currId)) {
            visited.add(currId);
            const parent = survey.questions.find((q) => q.id === currId || `q_${q.number}` === currId || String(q.number) === currId);
            if (parent) {
                chain.unshift(parent);
                currId = parent.parentQuestionId;
                if (!currId && parent.visibility?.enabled && parent.visibility.ruleGroup?.conditions?.length) {
                    currId = parent.visibility.ruleGroup.conditions[0].questionId;
                }
            } else {
                break;
            }
        }

        if (chain.length === 0 && question.visibility?.enabled && question.visibility.ruleGroup?.conditions?.length) {
            const firstCond = question.visibility.ruleGroup.conditions[0];
            if (firstCond.questionId && firstCond.questionId !== question.id) {
                const p = survey.questions.find(
                    (q) =>
                        q.id === firstCond.questionId ||
                        q.id === `q_${firstCond.questionId}` ||
                        String(q.number) === firstCond.questionId
                );
                if (p) chain.push(p);
            }
        }

        return chain;
    }, [question, survey.questions]);

    // Direct parent question
    const parentQuestion = ancestorChain.length > 0 ? ancestorChain[ancestorChain.length - 1] : null;

    // Always reset tab to basic and scroll to top when switching to a new question
    useEffect(() => {
        setActiveTab("basic");
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [question.id]);

    // Define navigation sections with progressive disclosure
    const sections: SectionConfig[] = [
        {
            id: "basic",
            label: "Basic",
            icon: Sliders,
            title: "Basic Settings",
            description: "Question prompt, response type, database column, and mandatory rule",
            show: true,
        },
        {
            id: "options",
            label: `Options (${optionCount})`,
            icon: ListChecks,
            title: "Response Options",
            description: "Manage choices, presets, master datasets, and inline follow-up questions",
            count: optionCount,
            badge: `${optionCount} Options`,
            show: isChoiceType,
        },
        {
            id: "validation",
            label: "Validation",
            icon: ShieldCheck,
            title: "Validation & Constraints",
            description: "Range boundaries, regex safety patterns, and localized custom error messages",
            badge: question.validation?.required ? "Required" : undefined,
            show: true,
        },
        {
            id: "repeater",
            label: "Repeater",
            icon: Layers,
            title: "Repeater Configuration",
            description: "Repeating group items, limits, and dynamic nested sub-questions",
            show: isRepeaterType,
        },
        {
            id: "advanced",
            label: conditionCount > 0 ? `Advanced (${conditionCount})` : "Advanced",
            icon: SlidersHorizontal,
            title: "Advanced & Visibility",
            description: "Visibility condition builder, anomaly flags, and schema JSON preview",
            badge: conditionCount > 0 ? `${conditionCount} Rule${conditionCount > 1 ? "s" : ""}` : undefined,
            show: true,
        },
    ];

    const visibleSections = sections.filter((s) => s.show);

    const handleTabClick = (tabId: EditorTabType) => {
        setActiveTab(tabId);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    };

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
                    {!isRepeaterType && onAddFollowUp && (!question.followUpDepth || question.followUpDepth < 5) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddFollowUp(question)}
                            disabled={isPublished}
                            className="h-8 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700 gap-1.5 cursor-pointer font-medium"
                        >
                            <GitBranch className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                            <span className="hidden sm:inline">Add Follow-up</span>
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicateQuestion(question.id)}
                        className="h-8 px-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1 cursor-pointer"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Duplicate</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteQuestion(question)}
                        disabled={isPublished}
                        className="h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 disabled:opacity-40 cursor-pointer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                    </Button>
                </div>
            </div>

            {/* Multi-Level Ancestry Context Banner (Feature 3) */}
            {ancestorChain.length > 0 && (
                <div className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <CornerDownRight className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Ancestry:</span>
                        {ancestorChain.map((anc, idx) => (
                            <React.Fragment key={anc.id}>
                                {idx > 0 && <span className="text-zinc-400 font-bold">›</span>}
                                <button
                                    type="button"
                                    onClick={() => onSelectQuestion?.(anc.id)}
                                    className="hover:underline font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] cursor-pointer"
                                    title={`Jump to Q${anc.displayIndex || anc.number}: ${anc.titles.en || anc.columnName}`}
                                >
                                    Q{anc.displayIndex || anc.number}: {anc.titles.en || anc.columnName}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                            Level {question.followUpDepth || ancestorChain.length + 1} of 5
                        </Badge>
                        {parentQuestion && onSelectQuestion && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectQuestion(parentQuestion.id)}
                                className="h-6 px-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0 gap-1 cursor-pointer"
                            >
                                <span>Parent</span>
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Clean Tab Navigation Bar */}
            <div className="px-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 sticky top-0 z-10">
                <div className="flex items-center space-x-1 md:space-x-2 h-10 overflow-x-auto no-scrollbar">
                    {visibleSections.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeTab === section.id;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => handleTabClick(section.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all rounded-md cursor-pointer",
                                    isActive
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold shadow-2xs"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{section.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Active Tab Panel Content */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 bg-zinc-50/50 dark:bg-zinc-950/50"
            >
                <div className="max-w-4xl mx-auto pb-20">
                    {/* TAB 1: BASIC SETTINGS */}
                    {activeTab === "basic" && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        <Sliders className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                            Basic Settings
                                        </h2>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Question prompt, response type, database column, and mandatory rules
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <BasicSettingsTab
                                question={question}
                                surveyQuestions={survey.questions}
                                onChangeQuestion={onChangeQuestion}
                                onSelectQuestion={onSelectQuestion}
                                onAddFollowUp={onAddFollowUp}
                                isPublished={isPublished}
                            />
                        </div>
                    )}

                    {/* TAB 2: RESPONSE OPTIONS (Choice types only) */}
                    {activeTab === "options" && isChoiceType && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        <ListChecks className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                Response Options & Follow-ups
                                            </h2>
                                            <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-1.5 h-4 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                {optionCount} Choices
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Manage choices, presets, master datasets, and inline follow-up questions
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <OptionsTab
                                question={question}
                                allQuestions={survey.questions}
                                onChangeQuestion={onChangeQuestion}
                                onUpdateSurveyQuestions={onUpdateSurveyQuestions}
                                onSelectQuestion={onSelectQuestion}
                                isPublished={isPublished}
                            />
                        </div>
                    )}

                    {/* TAB 3: VALIDATION & CONSTRAINTS */}
                    {activeTab === "validation" && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                Validation & Constraints
                                            </h2>
                                            {question.validation?.required && (
                                                <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-1.5 h-4 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                    Mandatory
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Range boundaries, regex safety patterns, and localized custom error messaging
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <ValidationTab
                                question={question}
                                survey={survey}
                                onChangeQuestion={onChangeQuestion}
                                isPublished={isPublished}
                            />
                        </div>
                    )}



                    {/* TAB 5: REPEATER (Repeater questions only) */}
                    {activeTab === "repeater" && isRepeaterType && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                            Repeater Configuration
                                        </h2>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Repeating group items, limits, and dynamic nested sub-questions
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <RepeaterTab
                                question={question}
                                allQuestions={survey.questions}
                                onChangeQuestion={onChangeQuestion}
                                onUpdateSurveyQuestions={onUpdateSurveyQuestions}
                                onSelectQuestion={onSelectQuestion}
                                isPublished={isPublished}
                            />
                        </div>
                    )}

                    {/* TAB 6: ADVANCED & VISIBILITY */}
                    {activeTab === "advanced" && (
                        <div className="space-y-4 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                            Advanced & Visibility
                                        </h2>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Visibility condition builder, anomaly flags, and schema JSON definition
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <AdvancedTab
                                question={question}
                                allQuestions={survey.questions}
                                survey={survey}
                                onChangeQuestion={onChangeQuestion}
                                isPublished={isPublished}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
