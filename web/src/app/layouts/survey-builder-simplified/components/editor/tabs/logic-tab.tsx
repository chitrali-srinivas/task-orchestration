"use client";

import React, { useMemo, useState } from "react";
import { GitBranch, Plus, Info, ArrowRight, CornerDownRight, CheckCircle2, AlertTriangle, ExternalLink, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    BackendQuestionType,
    QuestionModel,
} from "../../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../../registry/question-type-registry";
import { QuestionSelectorModal } from "../../common/question-selector-modal";
import { generateColumnName, recalculateQuestionNumbers } from "../../../lib/survey-normalizer";

interface LogicTabProps {
    question: QuestionModel;
    allQuestions: QuestionModel[];
    onChangeQuestion: (updated: QuestionModel) => void;
    onUpdateSurveyQuestions?: (updatedQuestions: QuestionModel[]) => void;
    onSelectQuestion?: (questionId: string) => void;
    onNavigateTab?: (tab: "basic" | "options" | "validation" | "logic" | "repeater" | "advanced") => void;
    isPublished?: boolean;
}

export function LogicTab({
    question,
    allQuestions,
    onChangeQuestion,
    onUpdateSurveyQuestions,
    onSelectQuestion,
    onNavigateTab,
    isPublished = false,
}: LogicTabProps) {
    const [followUpModalOpen, setFollowUpModalOpen] = useState(false);

    const visibility = question.visibility || {
        enabled: false,
        ruleGroup: { conjunction: "AND", conditions: [] },
    };

    const isEnabled = Boolean(visibility.enabled);
    const conditions = visibility.ruleGroup?.conditions || [];
    const conjunction = visibility.ruleGroup?.conjunction || "AND";

    // Find all questions across the survey that are triggered by this question (outgoing follow-ups)
    const outgoingFollowUps = useMemo(() => {
        return allQuestions.filter(
            (q) =>
                q.parentQuestionId === question.id ||
                (q.visibility?.enabled &&
                    q.visibility.ruleGroup?.conditions?.some((c) => c.questionId === question.id))
        );
    }, [allQuestions, question.id]);

    // Find parent question if this is a follow-up (UX-001)
    const parentQuestion = useMemo(() => {
        if (!question.parentQuestionId) return null;
        return allQuestions.find((q) => q.id === question.parentQuestionId) || null;
    }, [allQuestions, question.parentQuestionId]);

    const parentTriggerLabel = useMemo(() => {
        if (!parentQuestion) return null;
        const cond = conditions.find((c) => c.questionId === parentQuestion.id);
        if (!cond) return "Linked to parent";
        if (cond.operator === "isNotEmpty" || (cond.operator as string) === "isFilled") return "When answered";
        if (cond.operator === "greaterThan") return `> ${cond.value}`;
        if (cond.operator === "lessThan") return `< ${cond.value}`;
        if (parentQuestion.options) {
            const opt = parentQuestion.options.find((o) => o.value === cond.value);
            if (opt) return opt.labels.en || opt.value;
        }
        return String(cond.value);
    }, [parentQuestion, conditions]);

    // Compute inbound visibility summary
    const inboundSummary = useMemo(() => {
        if (!isEnabled || conditions.length === 0) {
            if (parentQuestion) {
                return `Follow-up to Q${parentQuestion.displayIndex || parentQuestion.number} (${parentQuestion.titles.en || parentQuestion.columnName}) when answer is "${parentTriggerLabel}".`;
            }
            return "This question is always visible sequentially.";
        }

        const descriptions = conditions.map((c) => {
            const parent = allQuestions.find((q) => q.id === c.questionId);
            const pTitle = parent ? `Q${parent.displayIndex || parent.number} (${parent.titles.en || parent.columnName})` : "Parent Question";
            let valStr = String(c.value ?? "");
            if (parent?.options) {
                const opt = parent.options.find((o) => o.value === c.value);
                if (opt) valStr = opt.labels.en || opt.value;
            }
            return `${pTitle} ${c.operator} "${valStr}"`;
        });

        return `Displayed conditionally when: ${descriptions.join(` ${conjunction} `)}`;
    }, [isEnabled, conditions, conjunction, allQuestions, parentQuestion, parentTriggerLabel]);

    const handleJumpToAdvanced = () => {
        if (onNavigateTab) {
            onNavigateTab("advanced");
        }
    };

    const handleCreateFollowUp = (config: {
        type: BackendQuestionType;
        title: string;
        columnName: string;
        required: boolean;
        numberFormat?: "integer" | "decimal";
        minValue?: number;
        maxValue?: number;
        decimalPlaces?: number;
        unitMode?: any;
        unit?: string;
        allowedUnits?: string[];
        defaultUnit?: string;
        operator?: string;
        triggerValue?: string;
    }) => {
        const typeDescriptor = QUESTION_TYPE_REGISTRY[config.type];
        const newId = `q_${Date.now()}`;
        const currentDepth = question.followUpDepth || 1;
        const newDepth = Math.min(currentDepth + 1, 5);

        const newChildQuestion: QuestionModel = {
            id: newId,
            number: allQuestions.length + 1,
            displayIndex: `${question.displayIndex || question.number}.1`,
            parentQuestionId: question.id,
            followUpDepth: newDepth,
            columnName: config.columnName || generateColumnName(config.title),
            type: config.type,
            displayType: config.type,
            titles: {
                en: config.title,
                hi: "",
            },
            options: typeDescriptor?.defaultConfig.options
                ? typeDescriptor.defaultConfig.options.map((opt, i) => ({
                      id: `opt_${Date.now()}_${i + 1}`,
                      value: opt.value,
                      labels: { en: opt.labels.en, hi: opt.labels.hi },
                  }))
                : undefined,
            validation: {
                required: config.required,
                numberFormat: config.numberFormat,
                minValue: config.minValue,
                maxValue: config.maxValue,
                decimalPlaces: config.decimalPlaces,
            },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [
                        {
                            id: `cond_${Date.now()}`,
                            questionId: question.id,
                            operator: ((config.operator === "isFilled" ? "isNotEmpty" : config.operator) || "equals") as any,
                            value:
                                (config.operator === "isFilled" || config.operator === "isNotEmpty")
                                    ? ""
                                    : (config.operator === "greaterThan" || config.operator === "lessThan" || (question.type === "Number" || question.type.includes("Decimal") || question.type.includes("WholeNum") || question.type.includes("NaturalNum"))) && !isNaN(Number(config.triggerValue))
                                    ? Number(config.triggerValue)
                                    : (config.triggerValue || (question.options?.[0]?.value ?? "yes")),
                        },
                    ],
                },
            },
        };

        const parentIndex = allQuestions.findIndex((q) => q.id === question.id);
        const descendantIds = new Set<string>();
        const findDescendants = (pId: string) => {
            allQuestions.forEach((q) => {
                if (
                    q.parentQuestionId === pId ||
                    (q.visibility?.enabled &&
                        q.visibility.ruleGroup?.conditions?.some((c) => c.questionId === pId))
                ) {
                    if (!descendantIds.has(q.id)) {
                        descendantIds.add(q.id);
                        findDescendants(q.id);
                    }
                }
            });
        };
        findDescendants(question.id);

        let insertIndex = parentIndex !== -1 ? parentIndex + 1 : allQuestions.length;
        while (insertIndex < allQuestions.length && descendantIds.has(allQuestions[insertIndex].id)) {
            insertIndex++;
        }

        const nextQuestions = [...allQuestions];
        nextQuestions.splice(insertIndex, 0, newChildQuestion);

        const recalculated = recalculateQuestionNumbers(nextQuestions);
        if (onUpdateSurveyQuestions) {
            onUpdateSurveyQuestions(recalculated);
        }
        if (onSelectQuestion) {
            onSelectQuestion(newId);
        }
    };

    return (
        <div className="space-y-6">
            {/* 0. PARENT FOLLOW-UP TRIGGER CONTEXT (UX-001) */}
            {parentQuestion && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CornerDownRight className="h-4 w-4 text-zinc-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Parent Follow-up Trigger
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700">
                                Level {question.followUpDepth || 2}
                            </Badge>
                        </div>

                        {onSelectQuestion && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectQuestion(parentQuestion.id)}
                                className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1 font-medium cursor-pointer"
                            >
                                <span>View Parent (Q{parentQuestion.displayIndex || parentQuestion.number})</span>
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                Q{parentQuestion.displayIndex || parentQuestion.number}. {parentQuestion.titles.en || parentQuestion.columnName}
                            </span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shrink-0">
                            Trigger: &ldquo;{parentTriggerLabel}&rdquo;
                        </span>
                    </div>
                </div>
            )}

            {/* 1. INBOUND VISIBILITY CONDITIONS OVERVIEW */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <Eye className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Inbound Visibility Status
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                                Controls when this question is shown to surveyors based on prior answers
                            </p>
                        </div>
                    </div>

                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-[10px] font-semibold py-0.5 px-2 font-mono",
                            isEnabled
                                ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        )}
                    >
                        {isEnabled ? `${conditions.length} Condition${conditions.length > 1 ? "s" : ""}` : "Always Visible"}
                    </Badge>
                </div>

                <div className="p-3.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Active Rule Summary
                        </span>
                        <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                            {inboundSummary}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleJumpToAdvanced}
                        className="h-8 px-3 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1.5 shrink-0 font-semibold cursor-pointer rounded-lg shadow-2xs"
                    >
                        <span>Configure in Advanced</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* 2. OUTBOUND FOLLOW-UP RELATIONSHIPS */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <GitBranch className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Outbound Follow-up Questions ({outgoingFollowUps.length})
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                                Child questions that appear conditionally when surveyor responds to this question
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {outgoingFollowUps.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                {outgoingFollowUps.length} Child Question{outgoingFollowUps.length > 1 ? "s" : ""}
                            </Badge>
                        )}
                        {!isPublished && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setFollowUpModalOpen(true)}
                                className="h-8 px-3 text-xs font-semibold gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer shadow-2xs rounded-lg"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add Follow-up</span>
                            </Button>
                        )}
                    </div>
                </div>

                {outgoingFollowUps.length === 0 ? (
                    <div className="p-4 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                        <p>No questions currently branch directly from this question.</p>
                        <p className="text-[11px] text-zinc-400">
                            You can add follow-up questions directly on each option row in the <strong>Response Options</strong> section or click <strong>+ Add Follow-up</strong> above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {outgoingFollowUps.map((childQ) => {
                            const cond = childQ.visibility?.ruleGroup?.conditions?.find((c) => c.questionId === question.id);
                            let triggerLabel = "Condition";
                            if (cond) {
                                if (cond.operator === "isNotEmpty" || (cond.operator as string) === "isFilled") {
                                    triggerLabel = "Is Answered";
                                } else if (cond.operator === "greaterThan") {
                                    triggerLabel = `> ${cond.value}`;
                                } else if (cond.operator === "lessThan") {
                                    triggerLabel = `< ${cond.value}`;
                                } else if (cond.operator === "contains") {
                                    triggerLabel = `Contains "${cond.value}"`;
                                } else if (question.options) {
                                    const opt = question.options.find((o) => o.value === cond.value);
                                    if (opt) triggerLabel = opt.labels.en || opt.value;
                                    else triggerLabel = String(cond.value);
                                } else {
                                    triggerLabel = String(cond.value);
                                }
                            }

                            return (
                                <div
                                    key={childQ.id}
                                    className="p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <CornerDownRight className="h-4 w-4 text-zinc-500 shrink-0" />
                                        <Badge variant="outline" className="font-mono text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                                            Q{childQ.displayIndex || childQ.number}
                                        </Badge>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[280px]">
                                            {childQ.titles.en || childQ.columnName}
                                        </span>
                                        <span className="text-[10px] text-zinc-700 dark:text-zinc-300 font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                            Trigger: &ldquo;{triggerLabel}&rdquo;
                                        </span>
                                    </div>

                                    {onSelectQuestion && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onSelectQuestion(childQ.id)}
                                            className="h-7 px-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 gap-1 font-medium cursor-pointer"
                                        >
                                            <span>Open Question</span>
                                            <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Follow-up Question Selector Modal */}
            <QuestionSelectorModal
                open={followUpModalOpen}
                onOpenChange={setFollowUpModalOpen}
                mode="createFollowUp"
                parentQuestion={question}
                parentDepth={question.followUpDepth || 1}
                allQuestions={allQuestions}
                onCreateQuestion={(cfg) => {
                    handleCreateFollowUp(cfg);
                    setFollowUpModalOpen(false);
                }}
            />
        </div>
    );
}
