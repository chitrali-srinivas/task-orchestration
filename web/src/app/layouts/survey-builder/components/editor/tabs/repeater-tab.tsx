"use client";

import React, { useState } from "react";
import {
    Layers,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    ArrowRight,
    HelpCircle,
    CheckCircle2,
    MoveRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BackendQuestionType, QuestionModel, RepeaterConfig, NumberUnitMode } from "../../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../../registry/question-type-registry";
import { generateColumnName, recalculateQuestionNumbers } from "../../../lib/survey-normalizer";
import { QuestionSelectorModal } from "../../common/question-selector-modal";

interface RepeaterTabProps {
    question: QuestionModel;
    allQuestions: QuestionModel[];
    onChangeQuestion: (updated: QuestionModel) => void;
    onUpdateSurveyQuestions?: (updatedQuestions: QuestionModel[]) => void;
    onSelectQuestion?: (questionId: string) => void;
    isPublished?: boolean;
}

export function RepeaterTab({
    question,
    allQuestions,
    onChangeQuestion,
    onUpdateSurveyQuestions,
    onSelectQuestion,
    isPublished,
}: RepeaterTabProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const repeater: RepeaterConfig = question.repeater || {
        isRepeater: false,
        countSourceType: "question",
        childQuestionIds: [],
        itemLabelTemplate: "Plot #{index}",
    };

    const isRepeater = Boolean(repeater.isRepeater);
    const childIds: string[] = repeater.childQuestionIds || [];

    // Eligible child questions that follow this repeater
    const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
    const availableSuccessorQuestions = allQuestions.filter(
        (q, idx) => idx > currentIndex && !childIds.includes(q.id) && !q.repeater?.isRepeater && q.type !== "Repeater_QT"
    );

    // Other numeric questions that could serve as count source
    const numericQuestions = allQuestions.filter(
        (q) =>
            q.id !== question.id &&
            (q.type.includes("Number") ||
                q.type.includes("Decimal") ||
                q.type.includes("WholeNum") ||
                q.type.includes("NaturalNum"))
    );

    const handleToggleRepeater = (checked: boolean) => {
        onChangeQuestion({
            ...question,
            repeater: {
                ...repeater,
                isRepeater: checked,
                countSourceType: repeater.countSourceType || "question",
                childQuestionIds: checked ? childIds : [],
                itemLabelTemplate: repeater.itemLabelTemplate || "Plot #{index}",
            },
        });
    };

    // Create a brand new question directly inside the repeater
    const handleAddNewChildQuestion = (type: BackendQuestionType, config?: {
        title?: string;
        columnName?: string;
        required?: boolean;
        numberFormat?: "integer" | "decimal";
        minValue?: number;
        maxValue?: number;
        decimalPlaces?: number;
        unitMode?: NumberUnitMode;
        unit?: string;
        allowedUnits?: string[];
        defaultUnit?: string;
    }) => {
        const descriptor = QUESTION_TYPE_REGISTRY[type];
        const newId = `q_${Date.now()}`;
        const newChildNum = childIds.length + 1;
        const hierarchicalDisplay = `${question.displayIndex || question.number}.${newChildNum}`;

        const newChildQuestion: QuestionModel = {
            id: newId,
            number: allQuestions.length + 1,
            displayIndex: hierarchicalDisplay,
            type,
            displayType: descriptor ? descriptor.displayName : type,
            columnName: config?.columnName || generateColumnName(descriptor ? `${question.columnName}_${descriptor.displayName}` : `q_${newChildNum}`),
            titles: {
                en: config?.title || (descriptor ? `${descriptor.displayName} (Repeater Item)` : "New Repeater Question"),
                hi: "",
            },
            options: descriptor?.defaultConfig?.options ? JSON.parse(JSON.stringify(descriptor.defaultConfig.options)) : undefined,
            validation: {
                ...(descriptor?.defaultConfig?.validation ? JSON.parse(JSON.stringify(descriptor.defaultConfig.validation)) : {}),
                required: config?.required ?? true,
            },
            numberConfig: type === "Number" ? {
                format: config?.numberFormat,
                minValue: config?.minValue,
                maxValue: config?.maxValue,
                decimalPlaces: config?.decimalPlaces,
                unitMode: config?.unitMode,
                unit: config?.unit,
                allowedUnits: config?.allowedUnits,
                defaultUnit: config?.defaultUnit,
            } : undefined,
            visibility: {
                enabled: false,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [],
                },
            },
            rawLegacyFields: {
                Parent_Repeat: question.number,
                Qn_In: hierarchicalDisplay,
            },
        };

        // Find position to insert: right after the last child of this repeater, or right after this repeater
        const parentIndex = allQuestions.findIndex((q) => q.id === question.id);
        let insertIndex = parentIndex + 1;
        if (childIds.length > 0) {
            const lastChildId = childIds[childIds.length - 1];
            const lastChildIdx = allQuestions.findIndex((q) => q.id === lastChildId);
            if (lastChildIdx !== -1) {
                insertIndex = lastChildIdx + 1;
            }
        }

        const updatedAllQuestions = [...allQuestions];
        updatedAllQuestions.splice(insertIndex, 0, newChildQuestion);

        const updatedChildIds = [...childIds, newId];

        // Update repeater parent with new childId
        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updatedChildIds,
            },
        };

        const finalQuestions = recalculateQuestionNumbers(
            updatedAllQuestions.map((q) => (q.id === question.id ? updatedParent : q))
        );

        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }

        if (onSelectQuestion) {
            onSelectQuestion(newId);
        }
    };

    // Move an existing survey question into this repeater container
    const handleMoveExistingQuestion = (targetQuestionId: string) => {
        const targetQuestion = allQuestions.find((q) => q.id === targetQuestionId);
        if (!targetQuestion) return;

        const newChildNum = childIds.length + 1;
        const hierarchicalDisplay = `${question.displayIndex || question.number}.${newChildNum}`;

        const updatedTargetQuestion: QuestionModel = {
            ...targetQuestion,
            displayIndex: hierarchicalDisplay,
            rawLegacyFields: {
                ...(targetQuestion.rawLegacyFields || {}),
                Parent_Repeat: question.number,
                Qn_In: hierarchicalDisplay,
            },
        };

        const updatedChildIds = [...childIds, targetQuestionId];

        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updatedChildIds,
            },
        };

        // Filter out target from old position and insert it right after the repeater or its last child
        const remainingQuestions = allQuestions.filter((q) => q.id !== targetQuestionId);
        const parentIndex = remainingQuestions.findIndex((q) => q.id === question.id);
        let insertIndex = parentIndex + 1;
        if (childIds.length > 0) {
            const lastChildId = childIds[childIds.length - 1];
            const lastChildIdx = remainingQuestions.findIndex((q) => q.id === lastChildId);
            if (lastChildIdx !== -1) {
                insertIndex = lastChildIdx + 1;
            }
        }

        const updatedAllQuestions = [...remainingQuestions];
        updatedAllQuestions.splice(insertIndex, 0, updatedTargetQuestion);

        const finalQuestions = recalculateQuestionNumbers(
            updatedAllQuestions.map((q) => (q.id === question.id ? updatedParent : q))
        );

        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }

        if (onSelectQuestion) {
            onSelectQuestion(targetQuestionId);
        }
    };

    // Duplicate an existing survey question into this repeater container
    const handleDuplicateExistingQuestion = (sourceQuestionId: string) => {
        const sourceQuestion = allQuestions.find((q) => q.id === sourceQuestionId);
        if (!sourceQuestion) return;

        const newId = `q_${Date.now()}`;
        const newChildNum = childIds.length + 1;
        const hierarchicalDisplay = `${question.displayIndex || question.number}.${newChildNum}`;
        const baseCol = sourceQuestion.columnName || "q";

        const clonedQuestion: QuestionModel = {
            ...JSON.parse(JSON.stringify(sourceQuestion)),
            id: newId,
            number: allQuestions.length + 1,
            displayIndex: hierarchicalDisplay,
            columnName: generateColumnName(`${baseCol}_rep_${newChildNum}`),
            titles: {
                ...sourceQuestion.titles,
                en: sourceQuestion.titles.en ? `${sourceQuestion.titles.en} (Copy)` : "Copied Question",
            },
            repeater: undefined,
            visibility: {
                enabled: false,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [],
                },
            },
            rawLegacyFields: {
                ...(sourceQuestion.rawLegacyFields || {}),
                Parent_Repeat: question.number,
                Qn_In: hierarchicalDisplay,
            },
        };

        const updatedChildIds = [...childIds, newId];

        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updatedChildIds,
            },
        };

        const parentIndex = allQuestions.findIndex((q) => q.id === question.id);
        let insertIndex = parentIndex + 1;
        if (childIds.length > 0) {
            const lastChildId = childIds[childIds.length - 1];
            const lastChildIdx = allQuestions.findIndex((q) => q.id === lastChildId);
            if (lastChildIdx !== -1) {
                insertIndex = lastChildIdx + 1;
            }
        }

        const updatedAllQuestions = [...allQuestions];
        updatedAllQuestions.splice(insertIndex, 0, clonedQuestion);

        const finalQuestions = recalculateQuestionNumbers(
            updatedAllQuestions.map((q) => (q.id === question.id ? updatedParent : q))
        );

        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }

        if (onSelectQuestion) {
            onSelectQuestion(newId);
        }
    };

    const handleAddChild = (childId: string) => {
        handleMoveExistingQuestion(childId);
    };

    const handleRemoveChild = (childId: string) => {
        const updated = childIds.filter((id) => id !== childId);
        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updated,
            },
        };

        const updatedAllQuestions = allQuestions.map((q) => {
            if (q.id === childId) {
                const legacy = { ...(q.rawLegacyFields || {}) };
                delete legacy.Parent_Repeat;
                delete legacy.Qn_In;
                return {
                    ...q,
                    rawLegacyFields: legacy,
                };
            }
            if (q.id === question.id) {
                return updatedParent;
            }
            return q;
        });

        const finalQuestions = recalculateQuestionNumbers(updatedAllQuestions);
        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }
    };

    const handleMoveChildUp = (index: number) => {
        if (index <= 0) return;
        const updated = [...childIds];
        const temp = updated[index - 1];
        updated[index - 1] = updated[index];
        updated[index] = temp;

        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updated,
            },
        };

        const targetAId = updated[index - 1];
        const targetBId = updated[index];
        const idxA = allQuestions.findIndex((q) => q.id === targetAId);
        const idxB = allQuestions.findIndex((q) => q.id === targetBId);
        let updatedAllQuestions = [...allQuestions];
        if (idxA !== -1 && idxB !== -1) {
            const tempQ = updatedAllQuestions[idxA];
            updatedAllQuestions[idxA] = updatedAllQuestions[idxB];
            updatedAllQuestions[idxB] = tempQ;
        }
        updatedAllQuestions = updatedAllQuestions.map((q) => (q.id === question.id ? updatedParent : q));

        const finalQuestions = recalculateQuestionNumbers(updatedAllQuestions);
        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }
    };

    const handleMoveChildDown = (index: number) => {
        if (index >= childIds.length - 1) return;
        const updated = [...childIds];
        const temp = updated[index + 1];
        updated[index + 1] = updated[index];
        updated[index] = temp;

        const updatedParent: QuestionModel = {
            ...question,
            repeater: {
                ...repeater,
                isRepeater: true,
                childQuestionIds: updated,
            },
        };

        const targetAId = updated[index];
        const targetBId = updated[index + 1];
        const idxA = allQuestions.findIndex((q) => q.id === targetAId);
        const idxB = allQuestions.findIndex((q) => q.id === targetBId);
        let updatedAllQuestions = [...allQuestions];
        if (idxA !== -1 && idxB !== -1) {
            const tempQ = updatedAllQuestions[idxA];
            updatedAllQuestions[idxA] = updatedAllQuestions[idxB];
            updatedAllQuestions[idxB] = tempQ;
        }
        updatedAllQuestions = updatedAllQuestions.map((q) => (q.id === question.id ? updatedParent : q));

        const finalQuestions = recalculateQuestionNumbers(updatedAllQuestions);
        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(finalQuestions);
        } else {
            onChangeQuestion(updatedParent);
        }
    };

    // Determine count source mode: "self" | "other_question" | "fixed"
    const countMode =
        repeater.countSourceType === "fixed"
            ? "fixed"
            : repeater.countQuestionId && repeater.countQuestionId !== question.id
            ? "other_question"
            : "self";

    return (
        <div className="space-y-6">
            {/* Master Repeater Toggle */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                Dynamic Repeater Group (Repeater_QT & Qn_Repeat)
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                            Repeats a block of questions N times dynamically in the mobile app based on the number entered.
                        </p>
                    </div>

                    <Switch
                        checked={isRepeater}
                        disabled={isPublished}
                        onCheckedChange={handleToggleRepeater}
                    />
                </div>
            </div>

            {/* Repeater Configuration Details */}
            {isRepeater && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* SECTION 2: QUESTIONS IN THIS REPEATER */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                    Questions in this Repeater ({childIds.length})
                                </h3>
                            </div>

                            {/* Add Question Button (Always Visible) */}
                            {!isPublished && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsAddDialogOpen(true)}
                                    className="h-8 px-3 text-xs font-semibold gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-2xs cursor-pointer rounded-lg"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Question</span>
                                </Button>
                            )}
                        </div>

                        {/* Child Questions List */}
                        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                            {childIds.length === 0 ? (
                                <div className="p-6 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 space-y-3">
                                    <Layers className="h-8 w-8 text-zinc-400 mx-auto opacity-70" />
                                    <div>
                                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">No questions in this repeater block</p>
                                        <p className="text-[11px] text-zinc-400">Click below to create a new question, or move/duplicate existing questions into this repeater.</p>
                                    </div>
                                    {!isPublished && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setIsAddDialogOpen(true)}
                                            className="h-8 px-3 text-xs font-semibold gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-2xs cursor-pointer rounded-lg"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>Add Question</span>
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {childIds.map((cid, cIdx) => {
                                        const childQ = allQuestions.find((q) => q.id === cid);
                                        const hierarchicalNum = `${question.displayIndex || question.number}.${cIdx + 1}`;
                                        return (
                                            <div
                                                key={cid}
                                                className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-xs flex items-center justify-between gap-2 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60 transition-colors"
                                            >
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-2 min-w-0 flex-1",
                                                        onSelectQuestion && childQ ? "cursor-pointer" : ""
                                                    )}
                                                    onClick={() => onSelectQuestion && childQ && onSelectQuestion(childQ.id)}
                                                >
                                                    <Badge
                                                        variant="secondary"
                                                        className="font-mono text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-1.5 py-0 shrink-0 font-bold"
                                                    >
                                                        Q{childQ?.displayIndex || hierarchicalNum}
                                                    </Badge>
                                                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                                                        {childQ ? childQ.titles.en : cid}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline truncate">
                                                        ({childQ?.columnName})
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    {onSelectQuestion && childQ && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onSelectQuestion(childQ.id)}
                                                            className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1 cursor-pointer font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                            title={`Jump to Q${childQ.displayIndex || hierarchicalNum}`}
                                                        >
                                                            <span>Configure</span>
                                                            <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    {!isPublished && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={cIdx === 0}
                                                                onClick={() => handleMoveChildUp(cIdx)}
                                                                className="h-6 w-6 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                                                                title="Move up in repeater"
                                                            >
                                                                <ArrowUp className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={cIdx === childIds.length - 1}
                                                                onClick={() => handleMoveChildDown(cIdx)}
                                                                className="h-6 w-6 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                                                                title="Move down in repeater"
                                                            >
                                                                <ArrowDown className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveChild(cid)}
                                                                className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                                title="Move out of repeater block"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Additional bottom Add Question button */}
                            {childIds.length > 0 && !isPublished && (
                                <div className="pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsAddDialogOpen(true)}
                                        className="w-full h-8 text-xs font-semibold gap-1.5 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer rounded-lg"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add Question</span>
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Available Successor Questions to Add */}
                        {!isPublished && availableSuccessorQuestions.length > 0 && (
                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Move Existing Question into Repeater Block
                                </Label>
                                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                                    {availableSuccessorQuestions.map((succ) => (
                                        <button
                                            key={succ.id}
                                            type="button"
                                            onClick={() => handleAddChild(succ.id)}
                                            className="w-full text-left p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs flex items-center justify-between transition-colors group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 shrink-0">
                                                    Q{succ.number}
                                                </span>
                                                <span className="truncate text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                                                    {succ.titles.en}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 shrink-0 flex items-center gap-0.5">
                                                <Plus className="h-3 w-3" /> Move In
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Unified Question Selector Modal with Repeater Mode */}
            <QuestionSelectorModal
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                mode="repeater"
                parentQuestion={question}
                allQuestions={allQuestions}
                onMoveQuestion={(qid) => {
                    handleMoveExistingQuestion(qid);
                    setIsAddDialogOpen(false);
                }}
                onDuplicateQuestion={(qid) => {
                    handleDuplicateExistingQuestion(qid);
                    setIsAddDialogOpen(false);
                }}
                onCreateQuestion={(config) => {
                    handleAddNewChildQuestion(config.type, config);
                    setIsAddDialogOpen(false);
                }}
            />
        </div>
    );
}
