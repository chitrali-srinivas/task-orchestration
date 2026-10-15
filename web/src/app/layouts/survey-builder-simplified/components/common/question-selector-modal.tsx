"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    Search,
    Plus,
    Check,
    ArrowRight,
    ArrowLeft,
    Sliders,
    HelpCircle,
    Layers,
    GitBranch,
    Hash,
    Binary,
    Radio,
    CheckSquare,
    ChevronDownSquare,
    ListFilter,
    AlignLeft,
    FileText,
    Calendar,
    CalendarDays,
    Camera,
    Video,
    MapPin,
    Pentagon,
    QrCode,
    Star,
    Clock,
    Smile,
    ListOrdered,
    Mic,
    Paperclip,
    Divide,
    Sparkles,
    CheckCircle2,
    Info,
    FolderInput,
    Copy,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
    BackendQuestionType,
    OptionItem,
    QuestionCategory,
    QuestionModel,
    NumberUnitMode,
} from "../../types/survey-schema";
import { UnitSelector } from "./unit-selector";
import {
    QUESTION_CATEGORIES,
    QUESTION_TYPE_REGISTRY,
    SIMPLIFIED_QUESTION_TYPES,
} from "../../registry/question-type-registry";
import { generateColumnName } from "../../lib/survey-normalizer";
import { QuestionTypeHelpPopover } from "./question-type-help-popover";
import { QuestionTypeGrid } from "./question-type-grid";

export type QuestionSelectorMode = "createQuestion" | "createFollowUp" | "selectQuestion" | "repeater";

export interface QuestionSelectorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: QuestionSelectorMode;
    // Context for createFollowUp / repeater
    parentQuestion?: QuestionModel;
    triggerOption?: OptionItem;
    triggerValue?: string;
    parentDepth?: number;
    // Context for selectQuestion / repeater
    allQuestions?: QuestionModel[];
    selectedQuestionId?: string;
    excludeQuestionId?: string;
    // Handlers
    onSelectQuestion?: (question: QuestionModel) => void;
    onMoveQuestion?: (questionId: string) => void;
    onDuplicateQuestion?: (questionId: string) => void;
    onCreateQuestion?: (config: {
        type: BackendQuestionType;
        title: string;
        columnName: string;
        required: boolean;
        numberFormat?: "integer" | "decimal";
        minValue?: number;
        maxValue?: number;
        decimalPlaces?: number;
        unitMode?: NumberUnitMode;
        unit?: string;
        allowedUnits?: string[];
        defaultUnit?: string;
        parentQuestionId?: string;
        operator?: string;
        triggerValue?: string;
        timeFormat?: "12h" | "24h";
        emojiScale?: "5-point" | "3-point";
        audioMaxDuration?: number;
        documentMaxMb?: number;
    }) => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Radio,
    CheckSquare,
    ChevronDownSquare,
    ListFilter,
    AlignLeft,
    FileText,
    Hash,
    Binary,
    Calendar,
    CalendarDays,
    Camera,
    Video,
    MapPin,
    Pentagon,
    QrCode,
    Star,
    Layers,
    Clock,
    Smile,
    ListOrdered,
    Mic,
    Paperclip,
    Divide,
    Info,
};

export function QuestionSelectorModal({
    open,
    onOpenChange,
    mode = "createQuestion",
    parentQuestion,
    triggerOption,
    triggerValue,
    parentDepth = 1,
    allQuestions = [],
    selectedQuestionId,
    excludeQuestionId,
    onSelectQuestion,
    onMoveQuestion,
    onDuplicateQuestion,
    onCreateQuestion,
}: QuestionSelectorModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [repeaterSubMode, setRepeaterSubMode] = useState<"choose" | "create" | "move" | "duplicate">("choose");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<BackendQuestionType>("Radio");

    // Question Essential Form State
    const [title, setTitle] = useState("");
    const [columnName, setColumnName] = useState("");
    const [required, setRequired] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string | undefined>(parentQuestion?.id);
    const [selectedTriggerOperator, setSelectedTriggerOperator] = useState<string>("equals");
    const [selectedTriggerValue, setSelectedTriggerValue] = useState<string>("");

    // Number & Unit Configuration State
    const [numberFormat, setNumberFormat] = useState<"integer" | "decimal">("decimal");
    const [minValue, setMinValue] = useState<number | undefined>(0);
    const [maxValue, setMaxValue] = useState<number | undefined>(100);
    const [decimalPlaces, setDecimalPlaces] = useState<number | undefined>(2);
    const [unitMode, setUnitMode] = useState<NumberUnitMode>("none");
    const [selectedUnit, setSelectedUnit] = useState<string | undefined>(undefined);
    const [allowedUnits, setAllowedUnits] = useState<string[]>([]);
    const [defaultUnit, setDefaultUnit] = useState<string | undefined>(undefined);

    // Advanced constraints defaults
    const [allowSameDayRange, setAllowSameDayRange] = useState(true);
    const [qrPrefix, setQrPrefix] = useState("MATI-");
    const [minVertices, setMinVertices] = useState(3);
    const [maxVertices, setMaxVertices] = useState(50);
    const [ratingMax, setRatingMax] = useState(5);
    const [maxPhotos, setMaxPhotos] = useState(3);
    const [allowedMediaSource, setAllowedMediaSource] = useState<"camera" | "upload" | "both">("both");
    const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
    const [emojiScale, setEmojiScale] = useState<"5-point" | "3-point">("5-point");
    const [audioMaxDuration, setAudioMaxDuration] = useState(120);
    const [documentMaxMb, setDocumentMaxMb] = useState(25);

    // Reset form on open
    useEffect(() => {
        if (open) {
            setStep(1);
            setRepeaterSubMode("choose");
            setSearchQuery("");
            setSelectedCategory("all");
            setTitle("");
            setColumnName("");
            setRequired(false);
            setSelectedType(mode === "createFollowUp" ? "Subjective" : "Radio");
            setSelectedParentId(parentQuestion?.id);

            // Configure trigger default based on parent question type
            if (parentQuestion) {
                if (parentQuestion.options && parentQuestion.options.length > 0) {
                    setSelectedTriggerOperator("equals");
                    setSelectedTriggerValue(triggerOption?.value || triggerValue || parentQuestion.options[0]?.value || "yes");
                } else if (parentQuestion.type === "Number" || parentQuestion.type.includes("Decimal") || parentQuestion.type.includes("WholeNum") || parentQuestion.type.includes("NaturalNum")) {
                    setSelectedTriggerOperator("greaterThan");
                    setSelectedTriggerValue(triggerValue || "0");
                } else if (parentQuestion.type === "Subjective" || parentQuestion.type === "TextArea") {
                    setSelectedTriggerOperator("isFilled");
                    setSelectedTriggerValue(triggerValue || "");
                } else if (parentQuestion.type === "Date" || parentQuestion.type === "DateRange") {
                    setSelectedTriggerOperator("isFilled");
                    setSelectedTriggerValue(triggerValue || "");
                } else if (parentQuestion.type === "Rating") {
                    setSelectedTriggerOperator("equals");
                    setSelectedTriggerValue(triggerValue || "5");
                } else {
                    setSelectedTriggerOperator("isFilled");
                    setSelectedTriggerValue("");
                }
            } else {
                setSelectedTriggerOperator("equals");
                setSelectedTriggerValue(triggerOption?.value || triggerValue || "yes");
            }

            setNumberFormat("decimal");
            setMinValue(0);
            setMaxValue(100);
            setDecimalPlaces(2);
            setUnitMode("none");
            setSelectedUnit(undefined);
            setAllowedUnits([]);
            setDefaultUnit(undefined);
            setAllowSameDayRange(true);
            setQrPrefix("MATI-");
            setMinVertices(3);
            setMaxVertices(50);
            setRatingMax(5);
            setMaxPhotos(3);
            setAllowedMediaSource("both");
        }
    }, [open, mode, parentQuestion, triggerOption, triggerValue]);

    // Available simplified types
    const availableTypes = useMemo(() => {
        const types = SIMPLIFIED_QUESTION_TYPES.map((typeId) => QUESTION_TYPE_REGISTRY[typeId]).filter(Boolean);
        if (mode === "repeater") {
            return types.filter((t) => t.id !== "Repeater_QT");
        }
        return types;
    }, [mode]);

    const filteredTypes = useMemo(() => {
        return availableTypes.filter((t) => {
            const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
            const matchesQuery =
                t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesQuery;
        });
    }, [availableTypes, selectedCategory, searchQuery]);

    // Available existing questions for selectQuestion mode or parent selection
    const selectableQuestions = useMemo(() => {
        return allQuestions.filter((q) => {
            if (excludeQuestionId && q.id === excludeQuestionId) return false;
            const qTitle = q.titles.en || "";
            const matchesQuery =
                qTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.columnName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(q.number).includes(searchQuery) ||
                q.displayIndex.includes(searchQuery);
            return matchesQuery;
        });
    }, [allQuestions, excludeQuestionId, searchQuery]);

    // Repeater Child IDs
    const childIds = parentQuestion?.repeater?.childQuestionIds || [];

    // Questions eligible to MOVE into repeater
    const movableQuestions = useMemo(() => {
        if (!parentQuestion) return [];
        return allQuestions.filter(
            (q) =>
                q.id !== parentQuestion.id &&
                !childIds.includes(q.id) &&
                !q.repeater?.isRepeater &&
                q.type !== "Repeater_QT"
        );
    }, [allQuestions, parentQuestion, childIds]);

    // Questions eligible to DUPLICATE into repeater
    const duplicatableQuestions = useMemo(() => {
        if (!parentQuestion) return [];
        return allQuestions.filter(
            (q) =>
                q.id !== parentQuestion.id &&
                !q.repeater?.isRepeater &&
                q.type !== "Repeater_QT"
        );
    }, [allQuestions, parentQuestion]);

    // Filtered questions for move list
    const filteredMovableQuestions = useMemo(() => {
        if (!searchQuery.trim()) return movableQuestions;
        const qLower = searchQuery.toLowerCase().trim();
        return movableQuestions.filter(
            (q) =>
                q.titles.en?.toLowerCase().includes(qLower) ||
                (q.titles.hi && q.titles.hi.includes(searchQuery)) ||
                q.columnName.toLowerCase().includes(qLower) ||
                q.type.toLowerCase().includes(qLower) ||
                String(q.number).includes(qLower) ||
                q.displayIndex?.includes(qLower)
        );
    }, [movableQuestions, searchQuery]);

    // Filtered questions for duplicate list
    const filteredDuplicatableQuestions = useMemo(() => {
        if (!searchQuery.trim()) return duplicatableQuestions;
        const qLower = searchQuery.toLowerCase().trim();
        return duplicatableQuestions.filter(
            (q) =>
                q.titles.en?.toLowerCase().includes(qLower) ||
                (q.titles.hi && q.titles.hi.includes(searchQuery)) ||
                q.columnName.toLowerCase().includes(qLower) ||
                q.type.toLowerCase().includes(qLower) ||
                String(q.number).includes(qLower) ||
                q.displayIndex?.includes(qLower)
        );
    }, [duplicatableQuestions, searchQuery]);

    // Eligible parent questions (must have nesting depth < 5)
    const eligibleParentQuestions = useMemo(() => {
        return allQuestions.filter((q) => {
            const depth = q.followUpDepth || (q.displayIndex ? q.displayIndex.split(".").length : 1);
            return depth < 5;
        });
    }, [allQuestions]);

    const activeParentQuestion = useMemo(() => {
        if (mode === "createFollowUp" && parentQuestion) return parentQuestion;
        if (selectedParentId) return allQuestions.find((q) => q.id === selectedParentId);
        return undefined;
    }, [mode, parentQuestion, selectedParentId, allQuestions]);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        if (!columnName || columnName === generateColumnName(title)) {
            setColumnName(generateColumnName(val));
        }
    };

    const handleProceedToConfig = (type: BackendQuestionType) => {
        setSelectedType(type);
        if (type === "Number") {
            setNumberFormat("decimal");
            setMinValue(0);
            setMaxValue(1000);
            setDecimalPlaces(2);
            setUnitMode("none");
            setSelectedUnit(undefined);
            setAllowedUnits([]);
            setDefaultUnit(undefined);
        }
        setStep(2);
    };

    const handleConfirmCreate = (overrideType?: BackendQuestionType) => {
        const typeToUse = overrideType || selectedType;
        if (!title.trim() || !onCreateQuestion) return;
        const finalParentId = mode === "createFollowUp" ? (parentQuestion?.id || selectedParentId) : selectedParentId;
        const finalParent = allQuestions.find((q) => q.id === finalParentId) || (mode === "createFollowUp" ? parentQuestion : undefined);
        const finalTriggerValue =
            selectedTriggerValue ||
            triggerOption?.value ||
            triggerValue ||
            finalParent?.options?.[0]?.value ||
            "yes";

        onCreateQuestion({
            type: typeToUse,
            title: title.trim(),
            columnName: columnName.trim() || generateColumnName(title.trim()),
            required,
            numberFormat: typeToUse === "Number" ? numberFormat : undefined,
            minValue: typeToUse === "Number" ? minValue : undefined,
            maxValue: typeToUse === "Number" ? maxValue : undefined,
            decimalPlaces: typeToUse === "Number" ? (numberFormat === "integer" ? 0 : decimalPlaces) : undefined,
            unitMode: typeToUse === "Number" ? unitMode : undefined,
            unit: typeToUse === "Number" && unitMode === "fixed" ? selectedUnit : undefined,
            allowedUnits: typeToUse === "Number" && unitMode === "allowed" ? allowedUnits : undefined,
            defaultUnit: typeToUse === "Number" && unitMode === "allowed" ? defaultUnit : undefined,
            parentQuestionId: finalParentId,
            operator: finalParentId ? selectedTriggerOperator : undefined,
            triggerValue: finalParentId ? finalTriggerValue : undefined,
        });
        onOpenChange(false);
    };

    const isDepthExceeded = mode === "createFollowUp" && parentDepth >= 5;
    const SelectedTypeIcon = ICON_MAP[QUESTION_TYPE_REGISTRY[selectedType]?.iconName || "Hash"] || Hash;

    // Trigger Condition sub-component
    const renderTriggerConditionSection = (parent: QuestionModel) => {
        return (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <GitBranch className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            Trigger Condition (When this follow-up appears)
                        </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shrink-0 font-semibold text-zinc-700 dark:text-zinc-300">
                        Based on Q{parent.displayIndex || parent.number}
                    </Badge>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    {parent.options && parent.options.length > 0 ? (
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                When respondent selects option:
                            </Label>
                            <Select
                                value={selectedTriggerValue || parent.options[0]?.value}
                                onValueChange={setSelectedTriggerValue}
                            >
                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Select trigger choice..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                    {parent.options.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.value}>
                                            {opt.labels.en || opt.value} ({opt.value})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                This follow-up question appears only when the respondent chooses this option on Q{parent.displayIndex || parent.number}.
                            </p>
                        </div>
                    ) : (parent.type === "Number" || parent.type.includes("Decimal") || parent.type.includes("WholeNum") || parent.type.includes("NaturalNum")) ? (
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                Numeric comparison rule:
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Select
                                    value={selectedTriggerOperator}
                                    onValueChange={setSelectedTriggerOperator}
                                >
                                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        <SelectValue placeholder="Condition" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="greaterThan">Greater than (&gt;)</SelectItem>
                                        <SelectItem value="lessThan">Less than (&lt;)</SelectItem>
                                        <SelectItem value="equals">Equal to (=)</SelectItem>
                                        <SelectItem value="notEquals">Not equal to (!=)</SelectItem>
                                        <SelectItem value="isFilled">Any number entered</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedTriggerOperator !== "isFilled" && (
                                    <Input
                                        type="number"
                                        placeholder="Threshold value (e.g. 50)..."
                                        value={selectedTriggerValue}
                                        onChange={(e) => setSelectedTriggerValue(e.target.value)}
                                        className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                    />
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Appears when answer to Q{parent.displayIndex || parent.number} {selectedTriggerOperator === "greaterThan" ? "is greater than" : selectedTriggerOperator === "lessThan" ? "is less than" : selectedTriggerOperator === "equals" ? "equals" : selectedTriggerOperator === "notEquals" ? "does not equal" : "is entered"} {selectedTriggerOperator !== "isFilled" ? (selectedTriggerValue || "threshold") : ""}.
                            </p>
                        </div>
                    ) : (parent.type === "Subjective" || parent.type === "TextArea") ? (
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                Text condition rule:
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Select
                                    value={selectedTriggerOperator}
                                    onValueChange={setSelectedTriggerOperator}
                                >
                                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        <SelectValue placeholder="Condition" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="isFilled">Is answered / Not empty</SelectItem>
                                        <SelectItem value="contains">Contains text / keyword</SelectItem>
                                        <SelectItem value="equals">Equals exact text</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedTriggerOperator !== "isFilled" && (
                                    <Input
                                        placeholder="Keyword or text..."
                                        value={selectedTriggerValue}
                                        onChange={(e) => setSelectedTriggerValue(e.target.value)}
                                        className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                    />
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Appears when respondent answers text question Q{parent.displayIndex || parent.number}.
                            </p>
                        </div>
                    ) : (parent.type === "Date" || parent.type === "DateRange") ? (
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                Date condition rule:
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Select
                                    value={selectedTriggerOperator}
                                    onValueChange={setSelectedTriggerOperator}
                                >
                                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        <SelectValue placeholder="Condition" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="isFilled">When date is selected</SelectItem>
                                        <SelectItem value="equals">On specific date</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedTriggerOperator === "equals" && (
                                    <DatePicker
                                        value={selectedTriggerValue}
                                        onChange={(dateStr) => setSelectedTriggerValue(dateStr)}
                                        placeholder="Pick specific date..."
                                        size="sm"
                                        className="h-9"
                                    />
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Appears when respondent fills date question Q{parent.displayIndex || parent.number}.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                                Condition: <strong>When answered / captured</strong> (Is not empty)
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Appears automatically when respondent completes Q{parent.displayIndex || parent.number}.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Question Prompt + Database Column Name in ONE 2-Column Row
    const renderPromptAndColumnInputs = (isAutoFocus: boolean) => {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Column 1: Question Prompt */}
                <div className="space-y-1.5">
                    <div className="h-5 flex items-center justify-between">
                        <Label htmlFor="popup-title" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                            <span>Question Prompt <span className="text-rose-500">*</span></span>
                        </Label>
                        <span className="text-[10px] text-zinc-400 font-mono">Primary Language (EN)</span>
                    </div>
                    <Input
                        id="popup-title"
                        placeholder={
                            mode === "createFollowUp"
                                ? "e.g. If not owner, please upload signed NoC document"
                                : mode === "repeater"
                                ? "e.g. Plot boundary coordinates / Sub-sample weight"
                                : selectedType === "Number"
                                ? "e.g. What is the total cultivated farm area?"
                                : selectedType === "QRCode"
                                ? "e.g. Scan sample QR code barcode"
                                : selectedType === "DateRange"
                                ? "e.g. Select the crop harvest period"
                                : selectedType === "PolygonBoundary"
                                ? "e.g. Walk plot perimeter to record boundary polygon"
                                : selectedType === "Time"
                                ? "e.g. Preferred time of day for plot inspection"
                                : selectedType === "Emoji"
                                ? "e.g. Rate your overall satisfaction with the field training"
                                : selectedType === "Rank"
                                ? "e.g. Rank the observed crop disease priorities"
                                : selectedType === "Audio"
                                ? "e.g. Record field surveyor verbal notes"
                                : selectedType === "Document"
                                ? "e.g. Upload official land registry extract (PDF)"
                                : "e.g. Select the primary soil classification:"
                        }
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="h-10 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium w-full"
                        autoFocus={isAutoFocus}
                    />
                    <p className="text-[10px] text-zinc-400">
                        Visible prompt displayed to respondents in the survey form
                    </p>
                </div>

                {/* Column 2: Database Column Name */}
                <div className="space-y-1.5">
                    <div className="h-5 flex items-center justify-between">
                        <Label htmlFor="popup-col" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Database Column Name <span className="text-rose-500">*</span>
                        </Label>
                        <button
                            type="button"
                            onClick={() => setColumnName(generateColumnName(title))}
                            className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 font-medium cursor-pointer"
                        >
                            <Sparkles className="h-3 w-3" /> Auto-Format
                        </button>
                    </div>
                    <Input
                        id="popup-col"
                        placeholder="e.g. farm_area_acres"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                        className="h-10 text-xs font-mono rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 w-full"
                    />
                    <p className="text-[10px] text-zinc-400 font-mono">
                        Export key for CSV & API payloads
                    </p>
                </div>
            </div>
        );
    };

    // Required Response Toggle sub-component
    const renderMandatoryToggle = () => {
        return (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="popup-req" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                            Required Response
                        </Label>
                        <Badge variant="outline" className={cn(
                            "text-[10px] font-mono px-1.5 py-0 font-semibold",
                            required
                                ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                                : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}>
                            {required ? "Required" : "Optional"}
                        </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {required ? "Respondent must answer this question before proceeding" : "Optional; respondent may skip this question"}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                        Enforced in field validator & completion checks
                    </p>
                </div>
                <Switch
                    id="popup-req"
                    checked={required}
                    onCheckedChange={setRequired}
                />
            </div>
        );
    };

    // Type Grid & Search sub-component (Powered by DS-001 shared QuestionTypeGrid)
    const renderTypeSelectorGrid = (onCardDoubleClick?: (typeId: BackendQuestionType) => void) => {
        return (
            <QuestionTypeGrid
                availableTypes={availableTypes}
                selectedType={selectedType}
                onSelectType={setSelectedType}
                onDoubleClickType={(typeId) => {
                    if (onCardDoubleClick) {
                        onCardDoubleClick(typeId);
                    } else {
                        handleProceedToConfig(typeId);
                    }
                }}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onSelectedCategoryChange={setSelectedCategory}
                columns={3}
                showSearch={true}
                showCategories={true}
                showHelpPopover={true}
            />
        );
    };

    // Type-Specific Settings sub-component
    const renderTypeSpecificSettings = (type: BackendQuestionType) => {
        if (type === "Number") {
            const isMinMaxInvalid = minValue !== undefined && maxValue !== undefined && minValue > maxValue;

            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Number Format & Unit Configuration
                    </span>
                    <div className={cn(
                        "grid grid-cols-1 gap-3",
                        numberFormat === "decimal" ? "sm:grid-cols-2" : "sm:grid-cols-1"
                    )}>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Number Format</Label>
                            <Select value={numberFormat} onValueChange={(val: any) => setNumberFormat(val)}>
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="integer">Integer (Whole Count)</SelectItem>
                                    <SelectItem value="decimal">Decimal (Floating Point)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {numberFormat === "decimal" && (
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Decimal Places</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={6}
                                    value={decimalPlaces !== undefined ? decimalPlaces : 2}
                                    onChange={(e) => setDecimalPlaces(Number(e.target.value))}
                                    className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Min Value</Label>
                            <Input
                                type="number"
                                value={minValue !== undefined ? minValue : ""}
                                onChange={(e) => setMinValue(e.target.value === "" ? undefined : Number(e.target.value))}
                                className={cn(
                                    "h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                    isMinMaxInvalid && "border-rose-500 focus-visible:ring-rose-500"
                                )}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Max Value</Label>
                            <Input
                                type="number"
                                value={maxValue !== undefined ? maxValue : ""}
                                onChange={(e) => setMaxValue(e.target.value === "" ? undefined : Number(e.target.value))}
                                className={cn(
                                    "h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                    isMinMaxInvalid && "border-rose-500 focus-visible:ring-rose-500"
                                )}
                            />
                        </div>
                    </div>

                    {isMinMaxInvalid && (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in-50">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>Minimum value ({minValue}) cannot be greater than maximum value ({maxValue}).</span>
                        </div>
                    )}

                    {/* Unit Selector Integration */}
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Unit of Measurement</Label>
                            <Select value={unitMode} onValueChange={(val: any) => setUnitMode(val)}>
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Unit (Pure Number)</SelectItem>
                                    <SelectItem value="fixed">Fixed Unit (Surveyor cannot change)</SelectItem>
                                    <SelectItem value="allowed">Multiple Allowed Units (Surveyor chooses)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {unitMode === "fixed" && (
                            <UnitSelector
                                mode="fixed"
                                value={selectedUnit}
                                onChange={(newUnit?: string) => setSelectedUnit(newUnit)}
                            />
                        )}
                        {unitMode === "allowed" && (
                            <UnitSelector
                                mode="allowed"
                                allowedUnits={allowedUnits}
                                defaultUnit={defaultUnit}
                                onAllowedUnitsChange={(newUnits: string[]) => setAllowedUnits(newUnits)}
                                onDefaultUnitChange={(newDef?: string) => setDefaultUnit(newDef)}
                            />
                        )}
                    </div>
                </div>
            );
        }

        if (type === "DateRange") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Date Range Rules
                    </span>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                        <div>
                            <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                Allow Same-Day Range
                            </Label>
                            <p className="text-[11px] text-zinc-500">
                                Permit start date and end date to be identical.
                            </p>
                        </div>
                        <Switch
                            checked={allowSameDayRange}
                            onCheckedChange={setAllowSameDayRange}
                        />
                    </div>
                </div>
            );
        }

        if (type === "QRCode") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Barcode / QR Code Validation
                    </span>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Required Prefix Filter (Optional)
                        </Label>
                        <Input
                            placeholder="e.g. MATI-"
                            value={qrPrefix}
                            onChange={(e) => setQrPrefix(e.target.value)}
                            className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                        <p className="text-[10px] text-zinc-400 font-mono">Scanned QR values must begin with this prefix</p>
                    </div>
                </div>
            );
        }

        if (type === "PolygonBoundary") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Polygon Boundary Geometry Constraints
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Min Vertices</Label>
                            <Input
                                type="number"
                                min={3}
                                max={10}
                                value={minVertices}
                                onChange={(e) => setMinVertices(Number(e.target.value))}
                                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Max Vertices</Label>
                            <Input
                                type="number"
                                min={10}
                                max={100}
                                value={maxVertices}
                                onChange={(e) => setMaxVertices(Number(e.target.value))}
                                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (type === "Rating") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Rating Configuration
                    </span>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Maximum Stars</Label>
                        <Select value={String(ratingMax)} onValueChange={(val) => setRatingMax(Number(val))}>
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3 Stars</SelectItem>
                                <SelectItem value="5">5 Stars</SelectItem>
                                <SelectItem value="10">10 Stars</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        if (type === "Time") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Time Configuration
                    </span>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Time Format</Label>
                        <Select value={timeFormat} onValueChange={(val: any) => setTimeFormat(val)}>
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="12h">12-Hour (AM / PM)</SelectItem>
                                <SelectItem value="24h">24-Hour (Military Clock)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        if (type === "Emoji") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Emoji Scale Configuration
                    </span>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Emoji Scale Range</Label>
                        <Select value={emojiScale} onValueChange={(val: any) => setEmojiScale(val)}>
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5-point">5-Point Scale (😡 🙁 😐 🙂 😍)</SelectItem>
                                <SelectItem value="3-point">3-Point Scale (🙁 😐 🙂)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        if (type === "Audio") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Audio Recording Rules
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Max Duration (Seconds)</Label>
                            <Input
                                type="number"
                                min={10}
                                max={600}
                                value={audioMaxDuration}
                                onChange={(e) => setAudioMaxDuration(Number(e.target.value))}
                                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Audio Source</Label>
                            <Select defaultValue="both">
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Microphone Record & Upload</SelectItem>
                                    <SelectItem value="mic">Microphone Live Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            );
        }

        if (type === "Document") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Document Upload Constraints
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Max File Size (MB)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={documentMaxMb}
                                onChange={(e) => setDocumentMaxMb(Number(e.target.value))}
                                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Accepted Formats</Label>
                            <Select defaultValue="pdf_office">
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pdf_office">PDF, DOCX, XLSX</SelectItem>
                                    <SelectItem value="pdf_only">PDF Only</SelectItem>
                                    <SelectItem value="all">Any Document Format</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            );
        }

        if (type === "Rank") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Default ranking choices (Priority 1, 2, 3) are initialized automatically. You can add, edit, or customize ranking items in the <strong>Options</strong> tab.
                    </p>
                </div>
            );
        }

        if (type === "Picture Input") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                        Media Capture Rules
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Maximum Photos</Label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                value={maxPhotos}
                                onChange={(e) => setMaxPhotos(Number(e.target.value))}
                                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Allowed Source</Label>
                            <Select value={allowedMediaSource} onValueChange={(val: any) => setAllowedMediaSource(val)}>
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="camera">Camera Only</SelectItem>
                                    <SelectItem value="upload">Gallery / Upload Only</SelectItem>
                                    <SelectItem value="both">Both Camera & Upload</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            );
        }

        if (type === "Radio" || type === "Checkbox" || type === "Dropdown" || type === "Selected Dropdown") {
            return (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Predefined choices will be initialized automatically. You can add, edit, reorder, or localize choice options in the <strong>Options</strong> tab.
                    </p>
                </div>
            );
        }

        return null;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{
                    width: "min(960px, 94vw)",
                    maxWidth: "960px",
                    height: "680px",
                    maxHeight: "90dvh",
                }}
                className="!w-[94vw] !max-w-[960px] !h-[680px] !max-h-[90dvh] !p-0 !gap-0 !flex !flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden rounded-2xl"
            >
                {/* Fixed Dialog Header */}
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                            {mode === "repeater" && repeaterSubMode !== "choose" ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        if (repeaterSubMode === "create" && step === 2) {
                                            setStep(1);
                                        } else {
                                            setRepeaterSubMode("choose");
                                            setStep(1);
                                        }
                                    }}
                                    className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 -ml-1 cursor-pointer shrink-0"
                                    title="Back"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            ) : null}

                            <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs shrink-0">
                                {mode === "createFollowUp" ? (
                                    <GitBranch className="h-5 w-5" />
                                ) : mode === "selectQuestion" ? (
                                    <Search className="h-5 w-5" />
                                ) : mode === "repeater" ? (
                                    <Layers className="h-5 w-5" />
                                ) : (
                                    <Sparkles className="h-5 w-5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                        {mode === "createQuestion" && (step === 1 ? "Choose Question Type" : "Configure Question Essentials")}
                                        {mode === "createFollowUp" && (step === 1 ? "Set Trigger Condition & Details" : "Choose Question Type")}
                                        {mode === "selectQuestion" && "Select Question"}
                                        {mode === "repeater" && (
                                            repeaterSubMode === "choose"
                                                ? `Add Question to Repeater (Q${parentQuestion?.displayIndex || parentQuestion?.number})`
                                                : repeaterSubMode === "create"
                                                ? (step === 1 ? "Select Question Type for Repeater" : "Configure Repeater Question")
                                                : repeaterSubMode === "move"
                                                ? `Move Question into Repeater (Q${parentQuestion?.displayIndex || parentQuestion?.number})`
                                                : `Duplicate Question into Repeater (Q${parentQuestion?.displayIndex || parentQuestion?.number})`
                                        )}
                                    </DialogTitle>
                                    {mode !== "selectQuestion" && mode !== "repeater" && (
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-[11px] font-semibold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                        >
                                            Step {step} of 2
                                        </Badge>
                                    )}
                                    {mode === "repeater" && repeaterSubMode === "create" && (
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-[11px] font-semibold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                        >
                                            Step {step} of 2
                                        </Badge>
                                    )}
                                </div>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                    {mode === "createQuestion" && (step === 1 ? "Select a question type to add to your survey workflow." : "Set initial prompt, database column identifier, and core input rules.")}
                                    {mode === "createFollowUp" && (step === 1 ? `Specify when this question appears based on Q${parentQuestion?.displayIndex || ""}, and enter the prompt.` : `Select the question type and response format for this follow-up question.`)}
                                    {mode === "selectQuestion" && "Pick an existing survey question for condition evaluation, calculation, or referencing."}
                                    {mode === "repeater" && (
                                        repeaterSubMode === "choose"
                                            ? "Choose whether to create a brand new field, or move/duplicate an existing survey question into this repeater container."
                                            : repeaterSubMode === "create"
                                            ? (step === 1 ? "Click a type to create and add it to the repeater container." : "Set question prompt, column identifier, and input rules.")
                                            : repeaterSubMode === "move"
                                            ? "Select an existing survey question to relocate inside this repeater block."
                                            : "Select a survey question to clone and add as a new child item inside this repeater block."
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {/* Follow-up / Repeater Breadcrumb Context */}
                    {mode === "createFollowUp" && parentQuestion && (
                        <div className="mt-3 p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between gap-2 text-zinc-800 dark:text-zinc-200">
                            <div className="flex items-center gap-2 min-w-0">
                                <GitBranch className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
                                <span className="truncate">
                                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Parent Question:</strong> Q{parentQuestion.displayIndex}. {parentQuestion.titles.en}
                                </span>
                            </div>
                            <Badge variant="outline" className="shrink-0 font-mono text-[11px] border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                                Level {parentDepth + 1} of 5
                            </Badge>
                        </div>
                    )}
                    {mode === "repeater" && parentQuestion && repeaterSubMode !== "choose" && (
                        <div className="mt-3 p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between gap-2 text-zinc-800 dark:text-zinc-200">
                            <div className="flex items-center gap-2 min-w-0">
                                <Layers className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
                                <span className="truncate">
                                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Repeater Container:</strong> Q{parentQuestion.displayIndex || parentQuestion.number}. {parentQuestion.titles.en || "Repeater Block"}
                                </span>
                            </div>
                            <Badge variant="outline" className="shrink-0 font-mono text-[11px] border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                                {childIds.length} Child Questions
                            </Badge>
                        </div>
                    )}
                </DialogHeader>

                {/* Bounded Content Area (Internal scrollable when content exceeds height) */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-6">
                    {/* MODE 1: selectQuestion */}
                    {mode === "selectQuestion" && (
                        <div className="flex-1 min-h-0 flex flex-col space-y-4">
                            <div className="relative shrink-0">
                                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                                <Input
                                    placeholder="Search by question title, index, or column name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg"
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2.5 content-start">
                                {selectableQuestions.length === 0 ? (
                                    <div className="col-span-2 p-10 text-center text-xs text-zinc-500 border border-dashed rounded-xl">
                                        No questions matched your search criteria.
                                    </div>
                                ) : (
                                    selectableQuestions.map((q) => {
                                        const isSelected = q.id === selectedQuestionId;
                                        return (
                                            <button
                                                key={q.id}
                                                type="button"
                                                onClick={() => {
                                                    onSelectQuestion?.(q);
                                                    onOpenChange(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all cursor-pointer",
                                                    isSelected
                                                        ? "bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900/30 dark:ring-zinc-100/30 text-zinc-900 dark:text-zinc-100 font-medium shadow-xs"
                                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className={cn(
                                                        "font-mono text-[11px] font-bold px-2 py-0.5 rounded border shrink-0",
                                                        isSelected
                                                            ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                                            : "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100"
                                                    )}>
                                                        Q{q.displayIndex}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold truncate">{q.titles.en || `Question ${q.number}`}</p>
                                                        <p className={cn("text-[11px] font-mono mt-0.5", isSelected ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400")}>
                                                            {q.columnName} · {q.type}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 shrink-0 text-zinc-900 dark:text-zinc-100" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODE 2: createFollowUp - STEP 1 (Condition First & Question Details) */}
                    {mode === "createFollowUp" && step === 1 && (
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                            {isDepthExceeded ? (
                                <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-xs space-y-2">
                                    <p className="font-bold text-sm">Maximum follow-up depth reached (5 levels)</p>
                                    <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                                        Surveys support a maximum branching nesting of 5 levels to preserve respondent usability and field performance.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Condition Builder Card */}
                                    {activeParentQuestion && renderTriggerConditionSection(activeParentQuestion)}

                                    {/* 2. Prompt & Column in One Row */}
                                    {renderPromptAndColumnInputs(true)}

                                    {/* 3. Mandatory Toggle Card */}
                                    {renderMandatoryToggle()}
                                </>
                            )}
                        </div>
                    )}

                    {/* MODE 2: createFollowUp - STEP 2 (Question Type Selection Second) */}
                    {mode === "createFollowUp" && step === 2 && (
                        renderTypeSelectorGrid((typeId) => {
                            setSelectedType(typeId);
                            handleConfirmCreate(typeId);
                        })
                    )}

                    {/* MODE 3: createQuestion - STEP 1 (Choose Question Type First) */}
                    {mode === "createQuestion" && step === 1 && (
                        renderTypeSelectorGrid((typeId) => {
                            handleProceedToConfig(typeId);
                        })
                    )}

                    {/* MODE 3: createQuestion - STEP 2 (Configure Essentials Second) */}
                    {mode === "createQuestion" && step === 2 && (
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
                            {/* Selected Type Pill Banner */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shrink-0">
                                        <SelectedTypeIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                            {QUESTION_TYPE_REGISTRY[selectedType]?.displayName || selectedType}
                                        </Badge>
                                        <QuestionTypeHelpPopover type={selectedType} side="right" />
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStep(1)}
                                    className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                >
                                    Change Type
                                </Button>
                            </div>

                            {/* Parent Question / Branching Selector (Optional for general creation) */}
                            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        <GitBranch className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                        <span>Parent Question / Branching (Optional)</span>
                                    </Label>
                                    {activeParentQuestion && (
                                        <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">
                                            Level {(activeParentQuestion.followUpDepth || (activeParentQuestion.displayIndex ? activeParentQuestion.displayIndex.split(".").length : 1)) + 1} of 5
                                        </Badge>
                                    )}
                                </div>
                                <Select
                                    value={selectedParentId || "none"}
                                    onValueChange={(val) => {
                                        if (val === "none") {
                                            setSelectedParentId(undefined);
                                        } else {
                                            setSelectedParentId(val);
                                            const p = allQuestions.find((q) => q.id === val);
                                            if (p?.options?.length) {
                                                setSelectedTriggerOperator("equals");
                                                setSelectedTriggerValue(p.options[0].value);
                                            } else if (p?.type === "Number" || p?.type.includes("Decimal") || p?.type.includes("WholeNum") || p?.type.includes("NaturalNum")) {
                                                setSelectedTriggerOperator("greaterThan");
                                                setSelectedTriggerValue("0");
                                            } else {
                                                setSelectedTriggerOperator("isFilled");
                                                setSelectedTriggerValue("");
                                            }
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        <SelectValue placeholder="None (Top-level question)" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        <SelectItem value="none">None (Top-level question)</SelectItem>
                                        {eligibleParentQuestions.map((q) => (
                                            <SelectItem key={q.id} value={q.id}>
                                                Q{q.displayIndex}. {q.titles.en || q.columnName} ({q.type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {activeParentQuestion && renderTriggerConditionSection(activeParentQuestion)}
                            </div>

                            {/* Prompt & Column in One Row */}
                            {renderPromptAndColumnInputs(true)}

                            {/* Mandatory Toggle Card */}
                            {renderMandatoryToggle()}

                            {/* Type Specific Settings */}
                            {renderTypeSpecificSettings(selectedType)}
                        </div>
                    )}

                    {/* MODE 4: repeater */}
                    {mode === "repeater" && (
                        <>
                            {/* SUBMODE 4.1: CHOOSE ACTION (Monochrome 3 Cards) */}
                            {repeaterSubMode === "choose" && (
                                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3.5">
                                    {/* Option 1: Create New Question */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSelectedCategory("all");
                                            setRepeaterSubMode("create");
                                            setStep(1);
                                        }}
                                        className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all group flex items-start gap-4 cursor-pointer shadow-2xs"
                                    >
                                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 group-hover:scale-105 transition-transform">
                                            <Plus className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                                    Create New Question
                                                </h4>
                                                <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                                    {availableTypes.length} Types Available
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                Build a brand new question from scratch (Choice, Text, Number, Date, Photo, GPS, etc.) directly inside this repeater.
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                                    </button>

                                    {/* Option 2: Move Existing Question */}
                                    <button
                                        type="button"
                                        disabled={movableQuestions.length === 0}
                                        onClick={() => {
                                            setSearchQuery("");
                                            setRepeaterSubMode("move");
                                        }}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border transition-all group flex items-start gap-4 shadow-2xs",
                                            movableQuestions.length > 0
                                                ? "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer"
                                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-60 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 group-hover:scale-105 transition-transform">
                                            <FolderInput className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                                    Move Existing Question
                                                </h4>
                                                <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                                    {movableQuestions.length} Available
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                {movableQuestions.length > 0
                                                    ? "Relocate an existing question from outside the repeater into this repeater block."
                                                    : "No external survey questions available to move."}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                                    </button>

                                    {/* Option 3: Make a Copy (Duplicate) */}
                                    <button
                                        type="button"
                                        disabled={duplicatableQuestions.length === 0}
                                        onClick={() => {
                                            setSearchQuery("");
                                            setRepeaterSubMode("duplicate");
                                        }}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border transition-all group flex items-start gap-4 shadow-2xs",
                                            duplicatableQuestions.length > 0
                                                ? "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer"
                                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-60 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 group-hover:scale-105 transition-transform">
                                            <Copy className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                                    Make a Copy (Duplicate)
                                                </h4>
                                                <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                                    Clone & Reuse
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                Clone an existing survey question with all its options and validations, and place the new copy inside this repeater.
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                </div>
                            )}

                            {/* SUBMODE 4.2: CREATE NEW QUESTION - STEP 1 (Type Grid) */}
                            {repeaterSubMode === "create" && step === 1 && (
                                renderTypeSelectorGrid((typeId) => {
                                    handleProceedToConfig(typeId);
                                })
                            )}

                            {/* SUBMODE 4.2: CREATE NEW QUESTION - STEP 2 (Configuration) */}
                            {repeaterSubMode === "create" && step === 2 && (
                                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
                                    {/* Selected Type Pill Banner */}
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shrink-0">
                                                <SelectedTypeIcon className="h-4 w-4" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                    {QUESTION_TYPE_REGISTRY[selectedType]?.displayName || selectedType}
                                                </Badge>
                                                <QuestionTypeHelpPopover type={selectedType} side="right" />
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setStep(1)}
                                            className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                        >
                                            Change Type
                                        </Button>
                                    </div>

                                    {/* Prompt & Column in One Row */}
                                    {renderPromptAndColumnInputs(true)}

                                    {/* Mandatory Toggle Card */}
                                    {renderMandatoryToggle()}

                                    {/* Type Specific Settings */}
                                    {renderTypeSpecificSettings(selectedType)}
                                </div>
                            )}

                            {/* SUBMODE 4.3: MOVE EXISTING QUESTION */}
                            {repeaterSubMode === "move" && (
                                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                                    <div className="relative shrink-0">
                                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search questions by title, number, or column name..."
                                            className="pl-10 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                                        {filteredMovableQuestions.length === 0 ? (
                                            <div className="p-10 text-center text-xs text-zinc-500 border border-dashed rounded-xl space-y-2">
                                                <FolderInput className="h-6 w-6 text-zinc-400 mx-auto opacity-60" />
                                                <p className="font-medium text-zinc-700 dark:text-zinc-300">No matching questions found</p>
                                                <p className="text-[11px] text-zinc-400">Try adjusting your search query.</p>
                                            </div>
                                        ) : (
                                            filteredMovableQuestions.map((q) => (
                                                <div
                                                    key={q.id}
                                                    onClick={() => {
                                                        onMoveQuestion?.(q.id);
                                                        onOpenChange(false);
                                                    }}
                                                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1.5 py-0 shrink-0 font-bold"
                                                        >
                                                            Q{q.displayIndex || q.number}
                                                        </Badge>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                                {q.titles.en || q.columnName}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-400 font-mono truncate">
                                                                ({q.columnName}) • {q.displayType || q.type}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold gap-1 shrink-0 cursor-pointer"
                                                    >
                                                        <span>Move</span>
                                                        <ArrowRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SUBMODE 4.4: DUPLICATE EXISTING QUESTION */}
                            {repeaterSubMode === "duplicate" && (
                                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                                    <div className="relative shrink-0">
                                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search questions by title, number, or column name..."
                                            className="pl-10 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                                        {filteredDuplicatableQuestions.length === 0 ? (
                                            <div className="p-10 text-center text-xs text-zinc-500 border border-dashed rounded-xl space-y-2">
                                                <Copy className="h-6 w-6 text-zinc-400 mx-auto opacity-60" />
                                                <p className="font-medium text-zinc-700 dark:text-zinc-300">No matching questions found</p>
                                                <p className="text-[11px] text-zinc-400">Try adjusting your search query.</p>
                                            </div>
                                        ) : (
                                            filteredDuplicatableQuestions.map((q) => (
                                                <div
                                                    key={q.id}
                                                    onClick={() => {
                                                        onDuplicateQuestion?.(q.id);
                                                        onOpenChange(false);
                                                    }}
                                                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1.5 py-0 shrink-0 font-bold"
                                                        >
                                                            Q{q.displayIndex || q.number}
                                                        </Badge>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                                {q.titles.en || q.columnName}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-400 font-mono truncate">
                                                                ({q.columnName}) • {q.displayType || q.type}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold gap-1 shrink-0 cursor-pointer"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                        <span>Duplicate</span>
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Fixed Dialog Footer */}
                <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80 shrink-0 flex items-center justify-between sm:justify-between">
                    {mode === "selectQuestion" ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="h-9 px-4 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                    ) : mode === "createFollowUp" ? (
                        step === 1 ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setStep(2)}
                                    disabled={!title.trim() || isDepthExceeded}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    <span>Next: Choose Question Type</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStep(1)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Condition & Details
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleConfirmCreate()}
                                    disabled={!title.trim()}
                                    className="h-9 px-5 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Create Follow-up Question</span>
                                </Button>
                            </>
                        )
                    ) : mode === "repeater" ? (
                        repeaterSubMode === "choose" ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="h-9 px-4 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                Cancel
                            </Button>
                        ) : repeaterSubMode === "create" ? (
                            step === 1 ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setRepeaterSubMode("choose")}
                                        className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Actions
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleProceedToConfig(selectedType)}
                                        className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs cursor-pointer"
                                    >
                                        <span>Continue to Configure</span>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setStep(1)}
                                        className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Types
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleConfirmCreate()}
                                        disabled={!title.trim()}
                                        className="h-9 px-5 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md cursor-pointer disabled:opacity-50"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Add to Repeater</span>
                                    </Button>
                                </>
                            )
                        ) : (
                            // repeaterSubMode === "move" || "duplicate"
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRepeaterSubMode("choose")}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Actions
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                            </>
                        )
                    ) : (
                        // mode === "createQuestion"
                        step === 1 ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleProceedToConfig(selectedType)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs cursor-pointer"
                                >
                                    <span>Continue to Configure</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStep(1)}
                                    className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Types
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleConfirmCreate()}
                                    disabled={!title.trim()}
                                    className="h-9 px-5 text-xs font-semibold rounded-lg gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Create Question</span>
                                </Button>
                            </>
                        )
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
