"use client";

import React, { useState } from "react";
import {
    Plus,
    Trash2,
    GripVertical,
    Sparkles,
    ArrowUp,
    ArrowDown,
    List,
    Database,
    Layers,
    GitBranch,
    ArrowRight,
    CornerDownRight,
    AlertCircle,
    Info,
    Eye,
    Check,
    Lock,
    Search,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BackendQuestionType, OptionItem, QuestionModel } from "../../../types/survey-schema";
import { MASTER_SETS, getMasterSetById } from "../../../lib/master-data-registry";
import { SIMPLIFIED_QUESTION_TYPES, QUESTION_TYPE_REGISTRY } from "../../../registry/question-type-registry";
import { generateColumnName, recalculateQuestionNumbers } from "../../../lib/survey-normalizer";
import { QuestionSelectorModal } from "../../common/question-selector-modal";

export function reconcileBulkOptions(lines: string[], existingOptions: OptionItem[] = []): OptionItem[] {
    return lines.map((line, idx) => {
        const parts = line.split("|").map((p) => p.trim());
        const label = parts[0];
        const explicitScore = parts.length > 1 && !isNaN(Number(parts[1])) ? Number(parts[1]) : undefined;
        const derivedValue = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `option_${idx + 1}`;

        // Match against existing option by value or label to preserve existing id, score, isOther, metadata (FUNC-001)
        const existing = existingOptions.find((o) =>
            (o.labels?.en && o.labels.en.toLowerCase() === label.toLowerCase()) ||
            (o.value && o.value.toLowerCase() === derivedValue.toLowerCase())
        );

        if (existing) {
            const mergedLabels: Record<string, string> = {
                ...existing.labels,
                en: label,
            };
            return {
                ...existing,
                labels: mergedLabels,
                score: explicitScore !== undefined ? explicitScore : existing.score,
                isOther: existing.isOther,
                code: existing.code,
                meta: existing.meta,
            };
        }

        const newLabels: Record<string, string> = { en: label, hi: "" };
        return {
            id: `opt_${Date.now()}_${idx + 1}`,
            value: derivedValue,
            labels: newLabels,
            score: explicitScore,
        };
    });
}

interface OptionsTabProps {
    question: QuestionModel;
    allQuestions?: QuestionModel[];
    onChangeQuestion: (updated: QuestionModel) => void;
    onUpdateSurveyQuestions?: (updatedQuestions: QuestionModel[]) => void;
    onSelectQuestion?: (questionId: string) => void;
    isPublished?: boolean;
}

const OPTION_PRESETS = [
    {
        name: "Yes / No",
        options: [
            { value: "yes", labels: { en: "Yes", hi: "हाँ" } },
            { value: "no", labels: { en: "No", hi: "नहीं" } },
        ],
    },
    {
        name: "Pass / Fail",
        options: [
            { value: "pass", labels: { en: "Pass (Approved)", hi: "उत्तीर्ण (स्वीकृत)" } },
            { value: "fail", labels: { en: "Fail (Rejected)", hi: "अनुत्तीर्ण (अस्वीकृत)" } },
        ],
    },
    {
        name: "High / Med / Low",
        options: [
            { value: "high", labels: { en: "High", hi: "उच्च" } },
            { value: "medium", labels: { en: "Medium", hi: "मध्यम" } },
            { value: "low", labels: { en: "Low", hi: "निम्न" } },
        ],
    },
    {
        name: "Soil Situations",
        options: [
            { value: "sandy", labels: { en: "Sandy Soil", hi: "बलुई मिट्टी" } },
            { value: "clay", labels: { en: "Clay Loam", hi: "चिकनी दोमट" } },
            { value: "saline", labels: { en: "Saline / Alkaline", hi: "खारी / क्षारीय" } },
        ],
    },
];

// Helper to calculate question follow-up depth
function getQuestionDepth(qId: string, questions: QuestionModel[], visited = new Set<string>()): number {
    if (visited.has(qId)) return 1;
    visited.add(qId);
    const target = questions.find((q) => q.id === qId);
    if (!target) return 1;
    if (target.followUpDepth) return target.followUpDepth;
    if (!target.visibility?.enabled) return 1;
    const conds = target.visibility.ruleGroup?.conditions || [];
    let maxParentDepth = 0;
    for (const c of conds) {
        if (c.questionId && c.questionId !== qId) {
            maxParentDepth = Math.max(maxParentDepth, getQuestionDepth(c.questionId, questions, new Set(visited)));
        }
    }
    return 1 + maxParentDepth;
}

export function OptionsTab({
    question,
    allQuestions = [],
    onChangeQuestion,
    onUpdateSurveyQuestions,
    onSelectQuestion,
    isPublished = false,
}: OptionsTabProps) {
    const options = question.options || [];

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Follow-up modal state
    const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
    const [selectedTriggerValue, setSelectedTriggerValue] = useState<string>("");
    const [depthWarning, setDepthWarning] = useState<string | null>(null);

    // Master dataset follow-up search and filter state
    const [masterSearchQuery, setMasterSearchQuery] = useState("");
    const [masterFollowUpFilter, setMasterFollowUpFilter] = useState<"all" | "withFollowUps">("all");

    // Bulk option editor modal state (FUNC-001)
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [bulkEditText, setBulkEditText] = useState("");

    const currentDepth = getQuestionDepth(question.id, allQuestions);
    const isMaxDepthReached = currentDepth >= 5;

    const handleAddOption = () => {
        const nextIdx = options.length + 1;
        const newOpt: OptionItem = {
            id: `opt_${Date.now()}_${nextIdx}`,
            value: `option_${nextIdx}`,
            labels: {
                en: `Option ${nextIdx}`,
                hi: `विकल्प ${nextIdx}`,
            },
        };
        onChangeQuestion({
            ...question,
            options: [...options, newOpt],
        });
    };

    const handleUpdateOption = (index: number, updated: Partial<OptionItem>) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], ...updated };
        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    const handleDeleteOption = (index: number) => {
        const newOptions = options.filter((_, idx) => idx !== index);
        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    const handleMoveOption = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === options.length - 1)
        ) {
            return;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const newOptions = [...options];
        const temp = newOptions[index];
        newOptions[index] = newOptions[targetIndex];
        newOptions[targetIndex] = temp;

        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (isPublished) return;
        setDraggedIndex(index);
        e.dataTransfer.setData("text/plain", String(index));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        if (isPublished) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        if (isPublished) return;
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const updatedOptions = [...options];
        const [movedItem] = updatedOptions.splice(draggedIndex, 1);
        updatedOptions.splice(targetIndex, 0, movedItem);

        onChangeQuestion({
            ...question,
            options: updatedOptions,
        });

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleApplyPreset = (presetOpts: { value: string; labels: { en: string; hi: string } }[]) => {
        // Reconcile against existing options to preserve score, isOther, code, meta (FUNC-001)
        const mapped: OptionItem[] = presetOpts.map((p, idx) => {
            const existing = options.find((o) =>
                o.value.toLowerCase() === p.value.toLowerCase() ||
                o.labels.en.toLowerCase() === p.labels.en.toLowerCase()
            );
            if (existing) {
                return {
                    ...existing,
                    value: p.value,
                    labels: {
                        ...existing.labels,
                        en: p.labels.en,
                        hi: p.labels.hi || existing.labels.hi,
                    },
                    score: existing.score,
                    isOther: existing.isOther,
                    code: existing.code,
                    meta: existing.meta,
                };
            }
            return {
                id: `opt_${Date.now()}_${idx + 1}`,
                value: p.value,
                labels: { en: p.labels.en, hi: p.labels.hi },
            };
        });

        onChangeQuestion({
            ...question,
            options: mapped,
        });
    };

    const handleOpenBulkEdit = () => {
        const text = options
            .map((o) => {
                const label = o.labels.en || o.value;
                const scorePart = o.score !== undefined ? ` | ${o.score}` : "";
                return `${label} (${o.value})${scorePart}`;
            })
            .join("\n");
        setBulkEditText(
            options.length > 0
                ? options.map((o) => `${o.labels.en || o.value}${o.score !== undefined ? ` | ${o.score}` : ""}`).join("\n")
                : ""
        );
        setBulkEditOpen(true);
    };

    const handleSaveBulkEdit = () => {
        const lines = bulkEditText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

        const reconciled = reconcileBulkOptions(lines, options);

        onChangeQuestion({
            ...question,
            options: reconciled,
        });
        setBulkEditOpen(false);
    };

    const isMasterSource = question.optionSource === "master";
    const masterConfig = question.masterDataConfig || { masterSetId: "trucks" };
    const selectedMaster = getMasterSetById(masterConfig.masterSetId) || MASTER_SETS[0];

    const handleOptionSourceChange = (source: "custom" | "master") => {
        if (source === "master") {
            onChangeQuestion({
                ...question,
                optionSource: "master",
                masterDataConfig: {
                    masterSetId: masterConfig.masterSetId || "trucks",
                    displayField: selectedMaster.displayFieldKey,
                },
            });
        } else {
            onChangeQuestion({
                ...question,
                optionSource: "custom",
            });
        }
    };

    const handleSelectMasterSet = (masterSetId: string) => {
        const found = getMasterSetById(masterSetId);
        onChangeQuestion({
            ...question,
            masterDataConfig: {
                ...masterConfig,
                masterSetId,
                displayField: found?.displayFieldKey || "",
                secondaryFields: found ? found.fields.filter((f) => f.key !== found.displayFieldKey).map((f) => f.key) : undefined,
            },
        });
    };

    const handleToggleSecondaryField = (fieldKey: string) => {
        if (isPublished) return;
        const currentDisplayKey = masterConfig.displayField || selectedMaster.displayFieldKey;
        if (fieldKey === currentDisplayKey) return; // Primary display field is always visible as title

        const currentSecondary = masterConfig.secondaryFields !== undefined
            ? masterConfig.secondaryFields.filter((k) => k !== currentDisplayKey)
            : selectedMaster.fields.filter((f) => f.key !== currentDisplayKey).map((f) => f.key);

        const isCurrentlySelected = currentSecondary.includes(fieldKey);
        let newSecondary: string[];
        if (isCurrentlySelected) {
            newSecondary = currentSecondary.filter((k) => k !== fieldKey);
        } else {
            newSecondary = [...currentSecondary, fieldKey];
        }

        onChangeQuestion({
            ...question,
            masterDataConfig: {
                ...masterConfig,
                secondaryFields: newSecondary,
            },
        });
    };

    const handleSelectAllSecondaryFields = () => {
        if (isPublished) return;
        const currentDisplayKey = masterConfig.displayField || selectedMaster.displayFieldKey;
        const allNonPrimary = selectedMaster.fields
            .filter((f) => f.key !== currentDisplayKey)
            .map((f) => f.key);
        onChangeQuestion({
            ...question,
            masterDataConfig: {
                ...masterConfig,
                secondaryFields: allNonPrimary,
            },
        });
    };

    const handleClearSecondaryFields = () => {
        if (isPublished) return;
        onChangeQuestion({
            ...question,
            masterDataConfig: {
                ...masterConfig,
                secondaryFields: [],
            },
        });
    };

    // Open reusable question selector modal in follow-up mode
    const handleStartFollowUpModal = (triggerVal: string) => {
        if (isMaxDepthReached) {
            setDepthWarning("Maximum follow-up depth reached (5 levels).");
            setTimeout(() => setDepthWarning(null), 4000);
            return;
        }
        setDepthWarning(null);
        setSelectedTriggerValue(triggerVal);
        setFollowUpModalOpen(true);
    };

    // Callback when question is created via QuestionSelectorModal
    const handleCreatedFollowUpQuestion = (config: {
        type: BackendQuestionType;
        title: string;
        columnName: string;
        required: boolean;
        numberFormat?: "integer" | "decimal";
        minValue?: number;
        maxValue?: number;
        decimalPlaces?: number;
        parentQuestionId?: string;
        triggerValue?: string;
    }) => {
        if (!onUpdateSurveyQuestions || allQuestions.length === 0) return;

        const descriptor = QUESTION_TYPE_REGISTRY[config.type];
        const newChildId = `q_${Date.now()}`;
        const newChildQuestion: QuestionModel = {
            id: newChildId,
            number: allQuestions.length + 1,
            displayIndex: `${question.displayIndex || question.number}.1`,
            type: config.type,
            columnName: config.columnName,
            titles: { en: config.title, hi: "" },
            options: descriptor?.defaultConfig.options
                ? descriptor.defaultConfig.options.map((o: any) => ({
                      id: `opt_${Date.now()}_${o.value}`,
                      value: o.value,
                      labels: { ...o.labels },
                  }))
                : undefined,
            parentQuestionId: question.id,
            validation: {
                required: config.required,
                numberFormat: config.numberFormat,
                minValue: config.minValue,
                maxValue: config.maxValue,
                decimalPlaces: config.decimalPlaces,
                minPhotos: config.type === "Picture Input" ? 1 : undefined,
                maxPhotos: config.type === "Picture Input" ? 3 : undefined,
            },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [
                        {
                            id: `cond_${Date.now()}`,
                            questionId: question.id,
                            operator: "equals",
                            value: config.triggerValue || "yes",
                        },
                    ],
                },
            },
        };

        // Find position to insert: after the parent question and all its descendants (direct and nested)
        const parentIdx = allQuestions.findIndex((q) => q.id === question.id);
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

        let insertIdx = parentIdx + 1;
        while (insertIdx < allQuestions.length && descendantIds.has(allQuestions[insertIdx].id)) {
            insertIdx++;
        }

        const nextQuestions = [...allQuestions];
        nextQuestions.splice(insertIdx, 0, newChildQuestion);
        const recalculated = recalculateQuestionNumbers(nextQuestions);
        onUpdateSurveyQuestions(recalculated);

        setFollowUpModalOpen(false);
        if (onSelectQuestion) {
            onSelectQuestion(newChildQuestion.id);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. OPTION SOURCE SELECTION (CUSTOM OPTIONS vs MASTER DATA) */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            Option Source
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                            Choose between bespoke survey choices or centralized enterprise master data
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleOptionSourceChange("custom")}
                        className={cn(
                            "flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                            !isMasterSource
                                ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                            !isMasterSource
                                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100"
                                : "border-zinc-400 dark:border-zinc-600"
                        )}>
                            {!isMasterSource && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Custom Options</span>
                            <span className="text-[11px] text-zinc-500 block">Static survey choices with conditional follow-ups</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleOptionSourceChange("master")}
                        className={cn(
                            "flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                            isMasterSource
                                ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                            isMasterSource
                                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100"
                                : "border-zinc-400 dark:border-zinc-600"
                        )}>
                            {isMasterSource && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Master Data</span>
                            <span className="text-[11px] text-zinc-500 block">Searchable selector bound to live operational database</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Depth Warning Alert */}
            {depthWarning && (
                <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{depthWarning}</span>
                </div>
            )}

            {/* 2. MASTER DATA CONFIGURATION & PREVIEW */}
            {isMasterSource ? (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Master Set Registry
                            </Label>
                            <Select
                                disabled={isPublished}
                                value={masterConfig.masterSetId || "trucks"}
                                onValueChange={handleSelectMasterSet}
                            >
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Select master dataset..." />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    {MASTER_SETS.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            <div className="flex items-center gap-2">
                                                <Database className="h-3.5 w-3.5 text-zinc-500" />
                                                <span className="font-semibold">{m.name}</span>
                                                <span className="text-zinc-400 text-[10px]">({m.category})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedMaster && (() => {
                            const displayKey = masterConfig.displayField || selectedMaster.displayFieldKey;
                            const activeSecondaryKeys = masterConfig.secondaryFields !== undefined
                                ? masterConfig.secondaryFields.filter((k) => k !== displayKey)
                                : selectedMaster.fields.filter((f) => f.key !== displayKey).map((f) => f.key);

                            return (
                                <div className="space-y-4 pt-1">
                                    {/* Primary Display Field Configuration */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                            Primary Display Field (Option Title)
                                        </Label>
                                        <Select
                                            disabled={isPublished}
                                            value={displayKey}
                                            onValueChange={(fKey) => {
                                                const currentSecondary = masterConfig.secondaryFields !== undefined
                                                    ? masterConfig.secondaryFields.filter((k) => k !== fKey)
                                                    : selectedMaster.fields.filter((f) => f.key !== fKey).map((f) => f.key);
                                                onChangeQuestion({
                                                    ...question,
                                                    masterDataConfig: {
                                                        ...masterConfig,
                                                        displayField: fKey,
                                                        secondaryFields: currentSecondary,
                                                    },
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-mono">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="text-xs">
                                                {selectedMaster.fields.map((f) => (
                                                    <SelectItem key={f.key} value={f.key}>
                                                        {f.label} <span className="text-zinc-400 font-mono">({f.key})</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-zinc-400">
                                            Main title label used for the option item in list views and answer selections.
                                        </p>
                                    </div>

                                    {/* Interactive Fields Visible in App Selector */}
                                    <div className="space-y-2.5 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Eye className="h-3.5 w-3.5 text-zinc-500" />
                                                    <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                        Fields Visible in Mobile App Selector
                                                    </Label>
                                                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                                                        {activeSecondaryKeys.length + 1} of {selectedMaster.fields.length} visible
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                    Select which attributes are displayed as subtitle details under each option in the respondent app.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPublished}
                                                    onClick={handleSelectAllSecondaryFields}
                                                    className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                                                >
                                                    Select All
                                                </Button>
                                                <span className="text-zinc-300 dark:text-zinc-700 text-xs">|</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPublished}
                                                    onClick={handleClearSecondaryFields}
                                                    className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                                                >
                                                    Clear All
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Field Selection Cards Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                            {selectedMaster.fields.map((f) => {
                                                const isPrimary = f.key === displayKey;
                                                const isVisible = isPrimary || activeSecondaryKeys.includes(f.key);

                                                return (
                                                    <div
                                                        key={f.key}
                                                        onClick={() => {
                                                            if (!isPrimary) {
                                                                handleToggleSecondaryField(f.key);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2.5 transition-all select-none",
                                                            isPrimary
                                                                ? "bg-zinc-100/90 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 cursor-default opacity-90"
                                                                : isVisible
                                                                ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900/20 dark:ring-zinc-100/20 cursor-pointer shadow-2xs"
                                                                : "bg-white/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {isPrimary ? (
                                                                <div className="h-4 w-4 rounded flex items-center justify-center bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shrink-0">
                                                                    <Check className="h-3 w-3" />
                                                                </div>
                                                            ) : (
                                                                <Checkbox
                                                                    checked={isVisible}
                                                                    disabled={isPublished}
                                                                    onCheckedChange={() => handleToggleSecondaryField(f.key)}
                                                                    className="shrink-0"
                                                                />
                                                            )}
                                                            <div className="min-w-0">
                                                                <span className={cn(
                                                                    "font-medium block truncate",
                                                                    isVisible ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
                                                                )}>
                                                                    {f.label}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-zinc-400 block truncate">
                                                                    {f.key}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isPrimary ? (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-400 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold gap-1">
                                                                    <Lock className="h-2.5 w-2.5" />
                                                                    Primary
                                                                </Badge>
                                                            ) : isVisible ? (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                                                    Visible
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-400 italic">Hidden</span>
                                                            )}
                                                            {f.isSearchable && (
                                                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-zinc-400 border-zinc-200 dark:border-zinc-800">
                                                                    Searchable
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Master Dataset Preview Card with Follow-up Search & Management */}
                                    <div className="p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3.5">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-zinc-500" />
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                                                        Master Options & Conditional Follow-ups
                                                    </span>
                                                    <span className="text-[11px] text-zinc-500">
                                                        Search master records and attach follow-up questions to specific options.
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                                {selectedMaster.sampleRecords.length} options
                                            </Badge>
                                        </div>

                                        {/* Search and Filter Control Bar */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="relative flex-1 min-w-[220px]">
                                                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                                                <Input
                                                    placeholder={`Search ${selectedMaster.name} options (e.g. name, code, vehicle, driver)...`}
                                                    value={masterSearchQuery}
                                                    onChange={(e) => setMasterSearchQuery(e.target.value)}
                                                    className="h-8.5 pl-8 pr-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg"
                                                />
                                                {masterSearchQuery && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setMasterSearchQuery("")}
                                                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                                        title="Clear search"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Filter Tabs */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setMasterFollowUpFilter("all")}
                                                    className={cn(
                                                        "text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                                                        masterFollowUpFilter === "all"
                                                            ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                                    )}
                                                >
                                                    All Options ({selectedMaster.sampleRecords.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMasterFollowUpFilter("withFollowUps")}
                                                    className={cn(
                                                        "text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                                                        masterFollowUpFilter === "withFollowUps"
                                                            ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                                    )}
                                                >
                                                    With Follow-ups
                                                </button>
                                            </div>
                                        </div>

                                        {/* Master Records List */}
                                        {(() => {
                                            const query = masterSearchQuery.toLowerCase().trim();
                                            const matchingRecords = selectedMaster.sampleRecords.filter((rec) => {
                                                const matchesText = !query || Object.values(rec).some((val) =>
                                                    val !== undefined && String(val).toLowerCase().includes(query)
                                                );
                                                if (!matchesText) return false;

                                                if (masterFollowUpFilter === "withFollowUps") {
                                                    const recVal = String(rec[displayKey]);
                                                    const hasFollowUps = allQuestions.some(
                                                        (q) =>
                                                            q.visibility?.enabled &&
                                                            q.visibility.ruleGroup?.conditions?.some(
                                                                (c) => c.questionId === question.id && c.value === recVal
                                                            )
                                                    );
                                                    return hasFollowUps;
                                                }
                                                return true;
                                            });

                                            if (matchingRecords.length === 0) {
                                                return (
                                                    <div className="p-8 text-center border border-dashed rounded-xl bg-white dark:bg-zinc-900/40 text-xs text-zinc-500 space-y-2">
                                                        <Search className="h-6 w-6 mx-auto text-zinc-400 opacity-60" />
                                                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                            {masterSearchQuery
                                                                ? `No master options match "${masterSearchQuery}"`
                                                                : "No master options currently have attached follow-ups."}
                                                        </p>
                                                        <p className="text-[11px] text-zinc-400">
                                                            {masterSearchQuery
                                                                ? "Try searching with another name, code, or keyword."
                                                                : "Switch to 'All Options' and click '+ Add Follow-up' on any option to create a branching question."}
                                                        </p>
                                                        {masterSearchQuery && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setMasterSearchQuery("")}
                                                                className="h-7 text-xs border-zinc-200 dark:border-zinc-700 cursor-pointer"
                                                            >
                                                                Clear Search
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                    {matchingRecords.map((rec, i) => {
                                                        const recVal = String(rec[displayKey]);
                                                        const linkedFollowUps = allQuestions.filter(
                                                            (q) =>
                                                                (q.parentQuestionId === question.id ||
                                                                    (q.visibility?.enabled &&
                                                                        q.visibility.ruleGroup?.conditions?.some(
                                                                            (c) => c.questionId === question.id
                                                                        ))) &&
                                                                (q.visibility?.ruleGroup?.conditions?.some((c) => c.value === recVal) ||
                                                                    q.rawLegacyFields?.Opt_Dep === recVal)
                                                        );

                                                        const subtitleParts = activeSecondaryKeys
                                                            .map((k) => {
                                                                const val = rec[k];
                                                                const fieldDef = selectedMaster.fields.find((f) => f.key === k);
                                                                return val !== undefined ? `${fieldDef?.label || k}: ${val}` : null;
                                                            })
                                                            .filter(Boolean);

                                                        return (
                                                            <div
                                                                key={rec.id || i}
                                                                className={cn(
                                                                    "p-3 rounded-xl border text-xs transition-all space-y-2",
                                                                    linkedFollowUps.length > 0
                                                                        ? "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-2xs"
                                                                        : "bg-white/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800"
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0 flex-1">
                                                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono block truncate">
                                                                            {recVal}
                                                                        </span>
                                                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block mt-0.5">
                                                                            {subtitleParts.length > 0
                                                                                ? subtitleParts.join(" • ")
                                                                                : <span className="italic text-zinc-400">No secondary fields selected</span>}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {linkedFollowUps.length > 0 && (
                                                                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono">
                                                                                {linkedFollowUps.length} follow-up{linkedFollowUps.length > 1 ? "s" : ""}
                                                                            </Badge>
                                                                        )}
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            disabled={isPublished || isMaxDepthReached}
                                                                            onClick={() => handleStartFollowUpModal(recVal)}
                                                                            className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1 font-medium disabled:opacity-40 cursor-pointer"
                                                                            title={isMaxDepthReached ? "Maximum follow-up depth reached (5 levels)" : `Add follow-up triggered by "${recVal}"`}
                                                                        >
                                                                            <Plus className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                                            <span>Add Follow-up</span>
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Attached Follow-up Questions List with Quick Navigation */}
                                                                {linkedFollowUps.length > 0 && (
                                                                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                                                                        <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1">
                                                                            <GitBranch className="h-3 w-3 text-zinc-400" />
                                                                            <span>Triggered Follow-up Questions:</span>
                                                                        </span>
                                                                        <div className="space-y-1">
                                                                            {linkedFollowUps.map((childQ) => (
                                                                                <div
                                                                                    key={childQ.id}
                                                                                    className="p-1.5 px-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] flex items-center justify-between gap-2"
                                                                                >
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 shrink-0">
                                                                                            Q{childQ.displayIndex}
                                                                                        </Badge>
                                                                                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                                                            {childQ.titles.en || `Question ${childQ.number}`}
                                                                                        </span>
                                                                                        <span className="text-zinc-400 text-[10px] font-mono shrink-0">
                                                                                            ({childQ.type})
                                                                                        </span>
                                                                                    </div>
                                                                                    {onSelectQuestion && (
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => onSelectQuestion(childQ.id)}
                                                                                            className="h-5 px-1.5 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 gap-0.5 cursor-pointer"
                                                                                        >
                                                                                            <span>Edit</span>
                                                                                            <ArrowRight className="h-2.5 w-2.5" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            ) : (
                /* 3. BESPOKE CUSTOM OPTIONS CONFIGURATION */
                <div className="space-y-6">
                    {/* Quick Option Presets */}
                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Quick Option Presets</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {OPTION_PRESETS.map((preset) => (
                                <Button
                                    key={preset.name}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPublished}
                                    onClick={() => handleApplyPreset(preset.options)}
                                    className="h-7.5 px-3 text-xs rounded-lg border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                    {preset.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Configured Choices List */}
                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                    Configured Choices ({options.length})
                                </h3>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                    Define response choices and create inline conditional follow-up questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPublished}
                                    onClick={handleOpenBulkEdit}
                                    className="text-xs font-semibold h-8 px-3 rounded-lg border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                >
                                    Bulk Edit
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={isPublished}
                                    onClick={handleAddOption}
                                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold h-8 px-3 rounded-lg gap-1.5 shadow-2xs cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Choice
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {options.map((opt, idx) => {
                                const isDragging = draggedIndex === idx;
                                const isDragOver = dragOverIndex === idx;

                                const linkedFollowUps = allQuestions.filter(
                                    (q) =>
                                        (q.parentQuestionId === question.id ||
                                            (q.visibility?.enabled &&
                                                q.visibility.ruleGroup?.conditions?.some(
                                                    (c) => c.questionId === question.id
                                                ))) &&
                                        (q.visibility?.ruleGroup?.conditions?.some((c) => c.value === opt.value) ||
                                            q.rawLegacyFields?.Opt_Dep === opt.value ||
                                            q.rawLegacyFields?.Opt_Dep === opt.labels?.en)
                                );

                                return (
                                    <div
                                        key={opt.id || idx}
                                        draggable={!isPublished}
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={cn(
                                            "p-3.5 rounded-lg border transition-all space-y-3 select-none",
                                            "bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800",
                                            isDragging && "opacity-40 scale-[0.99] border-dashed border-zinc-400 dark:border-zinc-600 shadow-none",
                                            isDragOver && !isDragging && "border-t-2 border-t-zinc-900 dark:border-t-zinc-100 bg-zinc-100 dark:bg-zinc-800/60 ring-1 ring-zinc-900/10"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {!isPublished && (
                                                    <div
                                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing p-0.5"
                                                        title="Drag to reorder choice"
                                                    >
                                                        <GripVertical className="h-4 w-4" />
                                                    </div>
                                                )}
                                                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                    {opt.labels.en || `Choice ${idx + 1}`}
                                                </span>
                                                {linkedFollowUps.length > 0 && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono">
                                                        {linkedFollowUps.length} follow-up{linkedFollowUps.length > 1 ? "s" : ""}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {!isPublished && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={isMaxDepthReached}
                                                        onClick={() => handleStartFollowUpModal(opt.value)}
                                                        className="h-7 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1 font-medium disabled:opacity-40"
                                                        title={isMaxDepthReached ? "Maximum follow-up depth reached (5 levels)" : "Add conditional follow-up question"}
                                                    >
                                                        <Plus className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                                                        <span>Follow-up</span>
                                                    </Button>
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isPublished || idx === 0}
                                                    onClick={() => handleMoveOption(idx, "up")}
                                                    className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                                    title="Move Up"
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isPublished || idx === options.length - 1}
                                                    onClick={() => handleMoveOption(idx, "down")}
                                                    className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                                    title="Move Down"
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isPublished || options.length <= 1}
                                                    onClick={() => handleDeleteOption(idx)}
                                                    className="h-7 w-7 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                    title="Delete Choice"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* 2-Column Choice Inputs (English Label & Backend Value) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                    Choice Label (English)
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Yes"
                                                    value={opt.labels.en || ""}
                                                    disabled={isPublished}
                                                    onChange={(e) =>
                                                        handleUpdateOption(idx, {
                                                            labels: { ...opt.labels, en: e.target.value },
                                                            value: opt.value || e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                                        })
                                                    }
                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                    Backend Value <span className="text-zinc-400 font-mono text-[10px]">(Raw Key)</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. yes"
                                                    value={opt.value || ""}
                                                    disabled={isPublished}
                                                    onChange={(e) =>
                                                        handleUpdateOption(idx, {
                                                            value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                                        })
                                                    }
                                                    className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>
                                        </div>

                                        {/* Visually Nested Linked Follow-up Questions */}
                                        {linkedFollowUps.length > 0 && (
                                            <div className="mt-2 pl-3 border-l-2 border-zinc-300 dark:border-zinc-700 space-y-1.5">
                                                <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400 tracking-wider block">
                                                    Follow-up Questions Triggered by &ldquo;{opt.labels.en || opt.value}&rdquo;
                                                </span>
                                                {linkedFollowUps.map((fq) => (
                                                    <div
                                                        key={fq.id}
                                                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                                                    >
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <CornerDownRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                                                                Q{fq.displayIndex || fq.number}
                                                            </Badge>
                                                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[260px]">
                                                                {fq.titles.en}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400 font-mono">({fq.type})</span>
                                                        </div>

                                                        {onSelectQuestion && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => onSelectQuestion(fq.id)}
                                                                className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 font-medium"
                                                            >
                                                                Jump to Q →
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Reusable Guided Question Creator Modal */}
            <QuestionSelectorModal
                open={followUpModalOpen}
                onOpenChange={setFollowUpModalOpen}
                mode="createFollowUp"
                parentQuestion={question}
                triggerValue={selectedTriggerValue}
                parentDepth={currentDepth}
                allQuestions={allQuestions}
                onCreateQuestion={handleCreatedFollowUpQuestion}
            />

            {/* Bulk Option Editor Modal (FUNC-001) */}
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <List className="h-4 w-4" />
                            Bulk Edit Options
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            Enter each option on a new line. Optional scores can be specified with a pipe (e.g. <code>Label | 5</code>).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <Textarea
                            value={bulkEditText}
                            onChange={(e) => setBulkEditText(e.target.value)}
                            placeholder={"Yes\nNo\nMaybe | 2"}
                            rows={8}
                            className="text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 resize-none"
                        />
                        <p className="text-[11px] text-zinc-400">
                            Existing option IDs, scores, and metadata will be preserved for matching options.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkEditOpen(false)}
                            className="h-8 text-xs cursor-pointer"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveBulkEdit}
                            className="h-8 text-xs bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 cursor-pointer"
                        >
                            Apply Options
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
