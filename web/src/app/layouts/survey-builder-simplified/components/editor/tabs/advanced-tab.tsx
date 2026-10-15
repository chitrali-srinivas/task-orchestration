"use client";

import React, { useState, useMemo } from "react";
import {
    AlertTriangle,
    Code2,
    Eye,
    Plus,
    Trash2,
    Check,
    Copy,
    Download,
    GitBranch,
    Info,
    ChevronDown,
    Globe,
    CheckCircle2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
    BackendQuestionType,
    LogicCondition,
    LogicOperator,
    QuestionModel,
    SurveyModel,
} from "../../../types/survey-schema";
import { serializeQuestionToCoreJSON } from "../../../lib/survey-serializer";

interface AdvancedTabProps {
    question: QuestionModel;
    allQuestions: QuestionModel[];
    survey?: SurveyModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

// Cycle Detection Helper: returns true if targetId depends directly or indirectly on sourceId
function hasDependencyOn(
    targetId: string,
    sourceId: string,
    questions: QuestionModel[],
    visited = new Set<string>()
): boolean {
    if (targetId === sourceId) return true;
    if (visited.has(targetId)) return false;
    visited.add(targetId);

    const targetQ = questions.find((q) => q.id === targetId);
    if (!targetQ || !targetQ.visibility?.enabled) return false;

    const conds = targetQ.visibility.ruleGroup?.conditions || [];
    for (const c of conds) {
        if (c.questionId === sourceId || hasDependencyOn(c.questionId, sourceId, questions, new Set(visited))) {
            return true;
        }
    }
    return false;
}

// Type-aware operator mapper
function getOperatorsForQuestionType(type: BackendQuestionType): { operator: LogicOperator; label: string }[] {
    if (type === "Radio" || type === "Dropdown" || type === "Selected Dropdown") {
        return [
            { operator: "equals", label: "Equals (=)" },
            { operator: "notEquals", label: "Does not equal (≠)" },
        ];
    }
    if (type === "Checkbox") {
        return [
            { operator: "contains", label: "Contains choice" },
            { operator: "notContains", label: "Does not contain choice" },
            { operator: "isNotEmpty", label: "Has any selection" },
            { operator: "isEmpty", label: "Is unselected / empty" },
        ];
    }
    if (type.includes("Decimal") || type.includes("WholeNum") || type.includes("NaturalNum") || type === "Number") {
        return [
            { operator: "equals", label: "Equals (=)" },
            { operator: "notEquals", label: "Does not equal (≠)" },
            { operator: "greaterThan", label: "Greater than (>)" },
            { operator: "greaterThanOrEqual", label: "Greater than or equal (≥)" },
            { operator: "lessThan", label: "Less than (<)" },
            { operator: "lessThanOrEqual", label: "Less than or equal (≤)" },
        ];
    }
    if (type === "Date" || type === "DateRange" || type === "CalendarWithDate") {
        return [
            { operator: "equals", label: "Is exact date" },
            { operator: "greaterThan", label: "After date (>)" },
            { operator: "lessThan", label: "Before date (<)" },
            { operator: "isNotEmpty", label: "Date is selected" },
            { operator: "isEmpty", label: "Date is empty" },
        ];
    }
    if (
        type === "Picture Input" ||
        type === "Video" ||
        type === "Map" ||
        type === "PolygonBoundary" ||
        type === "QRCode"
    ) {
        return [
            { operator: "isNotEmpty", label: "Has captured value / attachment" },
            { operator: "isEmpty", label: "Is empty / unattached" },
        ];
    }
    // Default text types (Subjective, TextArea, etc.)
    return [
        { operator: "isNotEmpty", label: "Is answered / not empty" },
        { operator: "isEmpty", label: "Is empty" },
        { operator: "contains", label: "Contains text" },
        { operator: "notContains", label: "Does not contain text" },
        { operator: "equals", label: "Exact match (=)" },
    ];
}

export function AdvancedTab({
    question,
    allQuestions,
    survey,
    onChangeQuestion,
    isPublished = false,
}: AdvancedTabProps) {
    const [inspectorView, setInspectorView] = useState<"core" | "translation">("core");
    const [copied, setCopied] = useState(false);

    const defaultLocale = survey?.defaultLocale || "en";
    const nonDefaultLocales = (survey?.locales || []).filter((l) => l.code !== defaultLocale);
    const [selectedLocaleCode, setSelectedLocaleCode] = useState<string>("all");

    // Active selected locale
    const activeLocale =
        selectedLocaleCode === "all"
            ? null
            : nonDefaultLocales.find((l) => l.code === selectedLocaleCode) || nonDefaultLocales[0] || null;

    const handleUpdate = (updated: Partial<QuestionModel>) => {
        onChangeQuestion({
            ...question,
            ...updated,
        });
    };

    const anomaly = question.anomalyDetection || { enabled: false };

    // ---------------------------------------------------------------------------
    // FEATURE 6: VISIBILITY CONDITIONS IN ADVANCED SETTINGS
    // ---------------------------------------------------------------------------
    const visibility = question.visibility || {
        enabled: false,
        ruleGroup: { conjunction: "AND", conditions: [] },
    };

    const isVisibilityEnabled = Boolean(visibility.enabled);
    const conditions = visibility.ruleGroup?.conditions || [];
    const conjunction = visibility.ruleGroup?.conjunction || "AND";

    // Filter candidate dependency questions:
    // 1. Must not be the question itself
    // 2. Must not depend on the current question (strict cycle prevention)
    // 3. Follow forward ordering preference (index < currentIndex)
    const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
    const candidateQuestions = useMemo(() => {
        return allQuestions.filter((q, idx) => {
            if (q.id === question.id) return false;
            if (hasDependencyOn(q.id, question.id, allQuestions)) return false;
            return idx < currentIndex;
        });
    }, [allQuestions, question.id, currentIndex]);

    const handleToggleVisibility = (checked: boolean) => {
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
        const operators = getOperatorsForQuestionType(firstCand.type);
        const defaultOp = operators[0]?.operator || "equals";

        const newCond: LogicCondition = {
            id: `cond_${Date.now()}`,
            questionId: firstCand.id,
            operator: defaultOp,
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

    const handleToggleConjunction = (newConj: "AND" | "OR") => {
        onChangeQuestion({
            ...question,
            visibility: {
                ...visibility,
                ruleGroup: {
                    ...visibility.ruleGroup,
                    conjunction: newConj,
                },
            },
        });
    };

    // Human-readable rule summary computation
    const ruleSummaryText = useMemo(() => {
        if (!isVisibilityEnabled || conditions.length === 0) {
            return "Always visible to surveyors (No conditional display rules).";
        }

        const conditionDescriptions = conditions.map((c) => {
            const targetQ = allQuestions.find((q) => q.id === c.questionId);
            const qTitle = targetQ ? `"${targetQ.titles.en || `Q${targetQ.number}`}"` : "Question";
            let valLabel = String(c.value ?? "");
            if (targetQ?.options && targetQ.options.length > 0) {
                const matchedOpt = targetQ.options.find((o) => o.value === c.value);
                if (matchedOpt) {
                    valLabel = `"${matchedOpt.labels.en || matchedOpt.value}"`;
                }
            }

            switch (c.operator) {
                case "equals":
                    return `${qTitle} equals ${valLabel}`;
                case "notEquals":
                    return `${qTitle} ≠ ${valLabel}`;
                case "contains":
                    return `${qTitle} contains ${valLabel}`;
                case "notContains":
                    return `${qTitle} does not contain ${valLabel}`;
                case "greaterThan":
                    return `${qTitle} > ${c.value}`;
                case "greaterThanOrEqual":
                    return `${qTitle} ≥ ${c.value}`;
                case "lessThan":
                    return `${qTitle} < ${c.value}`;
                case "lessThanOrEqual":
                    return `${qTitle} ≤ ${c.value}`;
                case "isNotEmpty":
                    return `${qTitle} is answered`;
                case "isEmpty":
                    return `${qTitle} is blank`;
                default:
                    return `${qTitle} ${c.operator} ${c.value}`;
            }
        });

        return `Visible when: ${conditionDescriptions.join(` ${conjunction} `)}`;
    }, [isVisibilityEnabled, conditions, conjunction, allQuestions]);

    // ---------------------------------------------------------------------------
    // JSON & Translation Excerpt Generators
    // ---------------------------------------------------------------------------
    const buildSingleExcerpt = (locCode: string) => ({
        schemaVersion: "1.0",
        locale: locCode,
        translationVersion: 1,
        translations: {
            questions: {
                [question.id]: {
                    title: question.titles[locCode] || question.titles[defaultLocale] || "",
                    ...(question.descriptions?.[locCode] ? { hint: question.descriptions[locCode] } : {}),
                    ...(question.placeholders?.[locCode] ? { placeholder: question.placeholders[locCode] } : {}),
                },
            },
            ...(question.options && question.options.length > 0
                ? {
                      choices: Object.fromEntries(
                          question.options.map((opt) => [
                              opt.id,
                              opt.labels[locCode] || opt.labels[defaultLocale] || opt.value,
                          ])
                      ),
                  }
                : {}),
        },
    });

    let translationExcerpt: any;
    if (selectedLocaleCode === "all") {
        if (nonDefaultLocales.length === 0) {
            translationExcerpt = {
                message: "No non-default translation languages configured for this survey.",
            };
        } else {
            translationExcerpt = Object.fromEntries(
                nonDefaultLocales.map((loc) => [
                    `translations/${loc.code}.json`,
                    buildSingleExcerpt(loc.code),
                ])
            );
        }
    } else {
        translationExcerpt = buildSingleExcerpt(selectedLocaleCode);
    }

    const activeJSONString =
        inspectorView === "core"
            ? JSON.stringify(serializeQuestionToCoreJSON(question, defaultLocale), null, 2)
            : JSON.stringify(translationExcerpt, null, 2);

    const handleCopy = () => {
        navigator.clipboard.writeText(activeJSONString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const filename =
            inspectorView === "core"
                ? `question_${question.displayIndex || question.number}_schema_v2.json`
                : selectedLocaleCode === "all"
                ? `translations_all_${question.id}.json`
                : `translations_${selectedLocaleCode}_${question.id}.json`;
        const blob = new Blob([activeJSONString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* 1. VISIBILITY CONDITIONS BUILDER (Feature 6) */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <Eye className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Conditional Visibility Display Rules
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                                Show or hide this question dynamically based on responses to previous questions
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label htmlFor="vis-toggle" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {isVisibilityEnabled ? "Enabled" : "Always Visible"}
                        </Label>
                        <Switch
                            id="vis-toggle"
                            checked={isVisibilityEnabled}
                            disabled={isPublished}
                            onCheckedChange={handleToggleVisibility}
                        />
                    </div>
                </div>

                {isVisibilityEnabled ? (
                    <div className="space-y-4 pt-1">
                        {/* Conjunction Grouping Selector (AND vs OR) */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                When evaluating multiple conditions:
                            </span>

                            <div className="flex items-center p-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-xs">
                                <button
                                    type="button"
                                    disabled={isPublished}
                                    onClick={() => handleToggleConjunction("AND")}
                                    className={cn(
                                        "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                        conjunction === "AND"
                                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                                    )}
                                >
                                    Match ALL (AND)
                                </button>
                                <button
                                    type="button"
                                    disabled={isPublished}
                                    onClick={() => handleToggleConjunction("OR")}
                                    className={cn(
                                        "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                        conjunction === "OR"
                                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                                    )}
                                >
                                    Match ANY (OR)
                                </button>
                            </div>
                        </div>

                        {/* List of WHEN ... IS ... VALUE conditions */}
                        <div className="space-y-3">
                            {conditions.map((cond, cIdx) => {
                                const targetQ = allQuestions.find((q) => q.id === cond.questionId) || candidateQuestions[0];
                                const availableOps = targetQ ? getOperatorsForQuestionType(targetQ.type) : [];
                                const isValueRequired = cond.operator !== "isEmpty" && cond.operator !== "isNotEmpty";

                                return (
                                    <div
                                        key={cond.id || cIdx}
                                        className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 space-y-3"
                                    >
                                        <div className="flex items-center justify-between pb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                                                <GitBranch className="h-3 w-3 text-zinc-500" />
                                                Condition #{cIdx + 1}
                                            </span>

                                            {!isPublished && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteCondition(cIdx)}
                                                    className="h-6 px-2 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 rounded-md"
                                                >
                                                    <Trash2 className="h-3 w-3" /> Remove
                                                </Button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                            {/* WHEN: [ Question ▼ ] */}
                                            <div className="sm:col-span-5 space-y-1">
                                                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                                    WHEN (Target Question)
                                                </Label>
                                                <Select
                                                    value={cond.questionId}
                                                    disabled={isPublished}
                                                    onValueChange={(qId) => {
                                                        const newTargetQ = allQuestions.find((q) => q.id === qId);
                                                        const ops = newTargetQ ? getOperatorsForQuestionType(newTargetQ.type) : [];
                                                        handleUpdateCondition(cIdx, {
                                                             questionId: qId,
                                                             operator: ops[0]?.operator || "equals",
                                                             value: newTargetQ?.options && newTargetQ.options.length > 0 ? newTargetQ.options[0].value : "",
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                                        <SelectValue placeholder="Select trigger question..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-56 text-xs">
                                                        {candidateQuestions.map((cand) => (
                                                            <SelectItem key={cand.id} value={cand.id}>
                                                                <span className="font-semibold">Q{cand.displayIndex || cand.number}.</span>{" "}
                                                                <span className="truncate">{cand.titles.en || cand.columnName}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* IS: [ Operator ▼ ] */}
                                            <div className="sm:col-span-3 space-y-1">
                                                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                                    IS (Operator)
                                                </Label>
                                                <Select
                                                    value={cond.operator}
                                                    disabled={isPublished}
                                                    onValueChange={(opVal: LogicOperator) => handleUpdateCondition(cIdx, { operator: opVal })}
                                                >
                                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="text-xs">
                                                        {availableOps.map((op) => (
                                                            <SelectItem key={op.operator} value={op.operator}>
                                                                {op.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* VALUE: [ Answer ▼ / Input ] */}
                                            <div className="sm:col-span-4 space-y-1">
                                                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                                    VALUE (Answer)
                                                </Label>
                                                {isValueRequired ? (
                                                    targetQ?.options && targetQ.options.length > 0 ? (
                                                        <Select
                                                            value={String(cond.value ?? "")}
                                                            disabled={isPublished}
                                                            onValueChange={(val) => handleUpdateCondition(cIdx, { value: val })}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                                                <SelectValue placeholder="Select choice..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="text-xs">
                                                                {targetQ.options.map((opt) => (
                                                                    <SelectItem key={opt.id} value={opt.value}>
                                                                        {opt.labels.en || opt.value}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            placeholder="Type required value..."
                                                            value={String(cond.value ?? "")}
                                                            disabled={isPublished}
                                                            onChange={(e) => handleUpdateCondition(cIdx, { value: e.target.value })}
                                                            className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                                        />
                                                    )
                                                ) : (
                                                    <div className="h-9 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-zinc-400 text-xs flex items-center italic">
                                                        No value required
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add Condition Action */}
                        {!isPublished && candidateQuestions.length > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddCondition}
                                className="h-8 px-3 rounded-lg text-xs font-semibold border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shadow-2xs cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Another Condition
                            </Button>
                        )}

                        {/* Rule Summary Box */}
                        <div className="p-3.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
                            <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400 tracking-wider block">
                                    Rule Evaluation Summary
                                </span>
                                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                                    {ruleSummaryText}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-3.5 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                        This question will always be presented sequentially to surveyors without any conditional branching.
                    </div>
                )}
            </div>

            {/* 2. Operational Quality & Anomaly Flags */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <AlertTriangle className="h-4 w-4 text-zinc-500" />
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            Operational Quality & Anomaly Flags
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                            Statistical quality control markers and operational deviation triggers
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
                    <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">
                            Flag as Anomaly Detector <span className="text-zinc-400 font-mono text-[10px]">(IS_Anomaly)</span>
                        </span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Highlights responses exceeding standard deviations in operational analytics dashboard.
                        </p>
                    </div>
                    <Switch
                        checked={Boolean(anomaly.enabled)}
                        disabled={isPublished}
                        onCheckedChange={(checked) =>
                            handleUpdate({
                                anomalyDetection: {
                                    ...anomaly,
                                    enabled: checked,
                                },
                            })
                        }
                    />
                </div>
            </div>

            {/* 3. JSON Schema & Translation Payload Inspector */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-zinc-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            Schema & JSON Definition
                        </h3>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {inspectorView === "core"
                            ? "Full source-of-truth question schema (v2.0) including validation constraints, visibility logic, repeater parameters, and Advanced Settings."
                            : selectedLocaleCode === "all"
                            ? `All modular translation resource files (v1.0) holding user-facing text only for ${nonDefaultLocales.length} configured language${nonDefaultLocales.length === 1 ? "" : "s"}. Advanced Settings are strictly excluded.`
                            : `Modular translation resource format (translations/${selectedLocaleCode}.json) holding user-facing text only for ${activeLocale?.label || selectedLocaleCode}. Advanced Settings are strictly excluded.`}
                    </p>
                </div>

                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 overflow-hidden shadow-2xs">
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-100/70 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs flex-wrap">
                        <div className="flex items-center p-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 shrink-0">
                            <button
                                type="button"
                                onClick={() => setInspectorView("core")}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                    inspectorView === "core"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                )}
                            >
                                <Code2 className="h-3 w-3" />
                                <span>Core Schema (2.0)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setInspectorView("translation")}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                    inspectorView === "translation"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                )}
                            >
                                <Globe className="h-3 w-3" />
                                <span>Translations (1.0)</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {inspectorView === "translation" && nonDefaultLocales.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7.5 px-2.5 text-[11px] font-medium border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:white gap-1 shadow-2xs cursor-pointer rounded-lg"
                                        >
                                            <Globe className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                            <span>
                                                {selectedLocaleCode === "all"
                                                    ? `All Languages (${nonDefaultLocales.length})`
                                                    : activeLocale?.label || selectedLocaleCode}
                                            </span>
                                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-56 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => setSelectedLocaleCode("all")}
                                            className={cn(
                                                "cursor-pointer flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800",
                                                selectedLocaleCode === "all" && "font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                            )}
                                        >
                                            <span>All Languages</span>
                                            <span className="font-mono text-[10px] text-zinc-400">
                                                {nonDefaultLocales.length} files
                                            </span>
                                        </DropdownMenuItem>
                                        {nonDefaultLocales.map((loc) => (
                                            <DropdownMenuItem
                                                key={loc.code}
                                                onClick={() => setSelectedLocaleCode(loc.code)}
                                                className={cn(
                                                    "cursor-pointer flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800",
                                                    selectedLocaleCode === loc.code && "font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                )}
                                            >
                                                <span>{loc.label}</span>
                                                <span className="font-mono text-[10px] text-zinc-400">
                                                    {loc.code}.json
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="h-7.5 px-2.5 text-[11px] font-medium border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 gap-1 shadow-2xs cursor-pointer rounded-lg"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3 w-3" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                className="h-7.5 px-2.5 text-[11px] font-medium border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 gap-1 shadow-2xs cursor-pointer rounded-lg"
                            >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                            </Button>
                        </div>
                    </div>

                    <pre className="p-4 font-mono text-xs text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-[340px] select-all leading-relaxed">
                        <code>{activeJSONString}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
}
