"use client";

import React from "react";
import { GitBranch, Plus, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import {
    LogicCondition,
    LogicOperator,
    QuestionModel,
} from "../../../types/survey-schema";

interface LogicTabProps {
    question: QuestionModel;
    allQuestions: QuestionModel[];
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

const OPERATOR_LABELS: Record<LogicOperator, string> = {
    equals: "equals (=)",
    notEquals: "does not equal (≠)",
    greaterThan: "greater than (>)",
    greaterThanOrEqual: "greater than or equal (≥)",
    lessThan: "less than (<)",
    lessThanOrEqual: "less than or equal (≤)",
    contains: "contains string",
    notContains: "does not contain",
    isEmpty: "is empty (unanswered)",
    isNotEmpty: "is answered (not empty)",
};

export function LogicTab({
    question,
    allQuestions,
    onChangeQuestion,
    isPublished,
}: LogicTabProps) {
    const visibility = question.visibility || {
        enabled: false,
        ruleGroup: { conjunction: "AND", conditions: [] },
    };

    const isEnabled = Boolean(visibility.enabled);
    const conditions = visibility.ruleGroup?.conditions || [];
    const conjunction = visibility.ruleGroup?.conjunction || "AND";

    // Eligible candidate questions that come strictly before this question
    const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
    const candidateQuestions = allQuestions.filter((_, idx) => idx < currentIndex);

    const handleToggleEnabled = (checked: boolean) => {
        let initialConditions = conditions;
        if (checked && conditions.length === 0 && candidateQuestions.length > 0) {
            const firstCand = candidateQuestions[0];
            initialConditions = [
                {
                    id: `cond_${Date.now()}`,
                    questionId: firstCand.id,
                    operator: "equals",
                    value: firstCand.options && firstCand.options.length > 0 ? firstCand.options[0].value : "yes",
                },
            ];
        }

        onChangeQuestion({
            ...question,
            visibility: {
                enabled: checked,
                ruleGroup: {
                    conjunction: conjunction,
                    conditions: initialConditions,
                },
            },
        });
    };

    const handleAddCondition = () => {
        if (candidateQuestions.length === 0) return;
        const firstCand = candidateQuestions[0];
        const newCond: LogicCondition = {
            id: `cond_${Date.now()}`,
            questionId: firstCand.id,
            operator: "equals",
            value: firstCand.options && firstCand.options.length > 0 ? firstCand.options[0].value : "",
        };

        onChangeQuestion({
            ...question,
            visibility: {
                ...visibility,
                ruleGroup: {
                    ...visibility.ruleGroup,
                    conditions: [...conditions, newCond],
                },
            },
        });
    };

    const handleUpdateCondition = (index: number, updated: Partial<LogicCondition>) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], ...updated } as LogicCondition;

        onChangeQuestion({
            ...question,
            visibility: {
                ...visibility,
                ruleGroup: {
                    ...visibility.ruleGroup,
                    conditions: newConditions,
                },
            },
        });
    };

    const handleDeleteCondition = (index: number) => {
        const newConditions = conditions.filter((_, idx) => idx !== index);
        onChangeQuestion({
            ...question,
            visibility: {
                ...visibility,
                enabled: newConditions.length > 0,
                ruleGroup: {
                    ...visibility.ruleGroup,
                    conditions: newConditions,
                },
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Conditional Enable Toggle */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                                Conditional Visibility Rule (Is_Cond)
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Show or hide this question depending on answers provided to earlier questions.
                        </p>
                    </div>

                    <Switch
                        checked={isEnabled}
                        disabled={isPublished || candidateQuestions.length === 0}
                        onCheckedChange={handleToggleEnabled}
                    />
                </div>

                {candidateQuestions.length === 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>This is the first question in the survey. Conditional visibility requires preceding questions to depend upon.</span>
                    </div>
                )}
            </div>

            {/* Rule Group Builder */}
            {isEnabled && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show this question when:</span>
                            <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-0.5">
                                <button
                                    type="button"
                                    disabled={isPublished}
                                    onClick={() =>
                                        onChangeQuestion({
                                            ...question,
                                            visibility: {
                                                ...visibility,
                                                ruleGroup: { ...visibility.ruleGroup, conjunction: "AND" },
                                            },
                                        })
                                    }
                                    className={cn(
                                        "text-xs px-2.5 py-0.5 rounded font-semibold transition-colors",
                                        conjunction === "AND"
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    )}
                                >
                                    ALL conditions match (AND)
                                </button>
                                <button
                                    type="button"
                                    disabled={isPublished}
                                    onClick={() =>
                                        onChangeQuestion({
                                            ...question,
                                            visibility: {
                                                ...visibility,
                                                ruleGroup: { ...visibility.ruleGroup, conjunction: "OR" },
                                            },
                                        })
                                    }
                                    className={cn(
                                        "text-xs px-2.5 py-0.5 rounded font-semibold transition-colors",
                                        conjunction === "OR"
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    )}
                                >
                                    ANY condition matches (OR)
                                </button>
                            </div>
                        </div>

                        <Button
                            type="button"
                            size="sm"
                            disabled={isPublished}
                            onClick={handleAddCondition}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold h-8 gap-1.5 shadow-2xs"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Condition
                        </Button>
                    </div>

                    {/* Condition Rows */}
                    <div className="space-y-3">
                        {conditions.map((cond, idx) => {
                            const targetQ = candidateQuestions.find((q) => q.id === cond.questionId);
                            const targetOptions = targetQ?.options || [];

                            return (
                                <div
                                    key={cond.id || idx}
                                    className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-2"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <Badge variant="outline" className="font-mono text-[10px] border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                            Condition #{idx + 1}
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPublished || conditions.length <= 1}
                                            onClick={() => handleDeleteCondition(idx)}
                                            className="h-6 w-6 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                        {/* Target Preceding Question */}
                                        <div className="sm:col-span-5">
                                            <Label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                                                Depends on Question
                                            </Label>
                                            <Select
                                                value={cond.questionId}
                                                disabled={isPublished}
                                                onValueChange={(qId) => {
                                                    const selected = candidateQuestions.find((q) => q.id === qId);
                                                    handleUpdateCondition(idx, {
                                                        questionId: qId,
                                                        value: selected?.options && selected.options.length > 0 ? selected.options[0].value : "",
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                    <SelectValue placeholder="Select question" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[220px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                    {candidateQuestions.map((cq) => (
                                                        <SelectItem key={cq.id} value={cq.id} className="text-xs">
                                                            Q{cq.displayIndex || cq.number}: {cq.titles.en?.slice(0, 35)}...
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Comparison Operator */}
                                        <div className="sm:col-span-3">
                                            <Label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                                                Operator
                                            </Label>
                                            <Select
                                                value={cond.operator}
                                                disabled={isPublished}
                                                onValueChange={(op: any) => handleUpdateCondition(idx, { operator: op })}
                                            >
                                                <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                    <SelectValue placeholder="Operator" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                    {Object.entries(OPERATOR_LABELS).map(([k, label]) => (
                                                        <SelectItem key={k} value={k} className="text-xs font-mono">
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Target Value */}
                                        <div className="sm:col-span-4">
                                            <Label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                                                Expected Value
                                            </Label>
                                            {targetOptions.length > 0 ? (
                                                <Select
                                                    value={String(cond.value ?? "")}
                                                    disabled={isPublished}
                                                    onValueChange={(val) => handleUpdateCondition(idx, { value: val })}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                        <SelectValue placeholder="Select choice" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                        {targetOptions.map((opt) => (
                                                            <SelectItem key={opt.id} value={opt.value} className="text-xs">
                                                                {opt.labels.en || opt.value} ({opt.value})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    placeholder="Target value"
                                                    value={String(cond.value ?? "")}
                                                    disabled={isPublished}
                                                    onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                                                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
