"use client";

import React, { useState, useMemo } from "react";
import {
    Search,
    Filter,
    Plus,
    RotateCw,
    Languages,
    Sparkles,
    MoreHorizontal,
    Check,
    AlertCircle,
    ShieldCheck,
    Columns,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    BackendQuestionType,
    LocaleDefinition,
    QuestionModel,
    SurveyModel,
} from "../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";
import { SurveyService } from "../../services/survey-service";
import { ChangeTypeDialog } from "./change-type-dialog";
import { TableValidationPopover } from "./table-validation-popover";
import { QuestionTypeHelpPopover } from "../common/question-type-help-popover";

const QUESTION_TYPE_OPTIONS: { id: BackendQuestionType; label: string }[] = [
    { id: "Radio", label: "Radio" },
    { id: "Checkbox", label: "Checkbox" },
    { id: "Dropdown", label: "Dropdown" },
    { id: "Selected Dropdown", label: "Search Dropdown" },
    { id: "Subjective", label: "Short Text" },
    { id: "TextArea", label: "TextArea" },
    { id: "Number", label: "Number" },
    { id: "DecimalMax10", label: "Decimal (≤10)" },
    { id: "DecimalMax100", label: "Decimal (≤100)" },
    { id: "DecimalMax500", label: "Decimal (≤500)" },
    { id: "DecimalMax1000", label: "Decimal (≤1000)" },
    { id: "DecimalMax10000", label: "Decimal (≤10k)" },
    { id: "DecimalMax100000", label: "Decimal (≤100k)" },
    { id: "WholeNumMax100", label: "Whole (0-100)" },
    { id: "WholeNumMax500", label: "Whole (0-500)" },
    { id: "WholeNumMax1000", label: "Whole (0-1000)" },
    { id: "NaturalNumMax10000", label: "Natural (1-10k)" },
    { id: "Date", label: "Date" },
    { id: "CalendarWithDate", label: "Calendar" },
    { id: "Picture Input", label: "Photo Upload" },
    { id: "Video", label: "Video" },
    { id: "Map", label: "GPS Location" },
    { id: "PolygonBoundary", label: "Polygon GIS" },
    { id: "QRCode", label: "QR Code" },
    { id: "Rating", label: "Rating" },
    { id: "Repeater_QT", label: "Repeater" },
];

interface SurveyTableViewProps {
    survey: SurveyModel;
    onUpdateSurvey: (updated: SurveyModel) => void;
    onOpenLanguageManager: () => void;
    isPublished?: boolean;
    selectedQuestionId?: string | null;
    onSelectQuestion?: (qId: string) => void;
}

export function SurveyTableView({
    survey,
    onUpdateSurvey,
    onOpenLanguageManager,
    isPublished = false,
    selectedQuestionId,
    onSelectQuestion,
}: SurveyTableViewProps) {
    // Toolbar search & filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("ALL");
    const [filterSection, setFilterSection] = useState<string>("ALL");
    const [filterValidation, setFilterValidation] = useState<string>("ALL"); // "ALL" | "HAS_VALIDATION" | "MISSING_TRANSLATION" | "HAS_REGEX"

    // Column visibility toggles
    const [showSectionCol, setShowSectionCol] = useState(true);
    const [showValidationCol, setShowValidationCol] = useState(true);

    // Question type change modal state
    const [typeChangeModalOpen, setTypeChangeModalOpen] = useState(false);
    const [targetQuestion, setTargetQuestion] = useState<QuestionModel | null>(null);
    const [pendingType, setPendingType] = useState<BackendQuestionType | null>(null);

    // Overwrite translation confirmation modal state
    const [retranslateModalOpen, setRetranslateModalOpen] = useState(false);
    const [retranslateTargetLocale, setRetranslateTargetLocale] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    // Selected questions for bulk actions
    const [selectedQIds, setSelectedQIds] = useState<string[]>([]);

    const locales = survey.locales || [{ code: "en", label: "English", isDefault: true }];
    const defaultLocale = survey.defaultLocale || "en";

    // Section context resolver
    const getSectionContext = (q: QuestionModel): string => {
        // 1. Repeater container check
        if (q.type === "Repeater_QT" || q.repeater?.isRepeater) {
            return "Repeater Container";
        }

        // 2. Repeater child check
        const parentRepeater = survey.questions.find(
            (p) => (p.repeater?.isRepeater || p.type === "Repeater_QT") && p.repeater?.childQuestionIds?.includes(q.id)
        );
        if (parentRepeater) {
            return `Repeater Child (Q${parentRepeater.displayIndex || parentRepeater.number})`;
        }

        // 3. Follow-up child check
        let folParent: QuestionModel | undefined = undefined;

        // A. Explicit parentQuestionId (and not self-referential)
        if (q.parentQuestionId && q.parentQuestionId !== q.id) {
            folParent = survey.questions.find((p) => p.id === q.parentQuestionId);
        }

        // B. Visibility dependency rule condition
        if (!folParent && q.visibility?.enabled && q.visibility.ruleGroup?.conditions?.length) {
            const firstCond = q.visibility.ruleGroup.conditions[0];
            if (firstCond?.questionId && firstCond.questionId !== q.id) {
                folParent = survey.questions.find(
                    (p) =>
                        p.id !== q.id &&
                        (p.id === firstCond.questionId ||
                            p.id === `q_${firstCond.questionId}` ||
                            String(p.number) === firstCond.questionId ||
                            `q_${p.number}` === firstCond.questionId)
                );
            }
        }

        // C. Legacy Parent_Dep field
        if (!folParent && q.rawLegacyFields?.Parent_Dep) {
            const depNum = Number(q.rawLegacyFields.Parent_Dep);
            folParent = survey.questions.find(
                (p) =>
                    p.id !== q.id &&
                    (p.number === depNum ||
                        p.id === `q_${depNum}` ||
                        String(p.id) === String(q.rawLegacyFields?.Parent_Dep))
            );
        }

        // D. Hierarchical display index (e.g. "1.1", "1.2", "1.3.1")
        if (!folParent && q.displayIndex && q.displayIndex.includes(".")) {
            const parts = q.displayIndex.split(".");
            const parentIndex = parts.slice(0, -1).join(".");
            folParent = survey.questions.find((p) => p.displayIndex === parentIndex);
            if (folParent) {
                return `Follow-up (Q${folParent.displayIndex || folParent.number})`;
            } else if (parentIndex) {
                return `Follow-up (Q${parentIndex})`;
            }
        }

        if (folParent) {
            return `Follow-up (Q${folParent.displayIndex || folParent.number})`;
        }

        return "Main Survey";
    };

    // Filtered questions
    const filteredQuestions = useMemo(() => {
        return survey.questions.filter((q) => {
            // Search query filter
            if (searchQuery.trim() !== "") {
                const query = searchQuery.toLowerCase().trim();
                const enTitle = (q.titles.en || "").toLowerCase();
                const transTitles = Object.values(q.titles).map((t) => t.toLowerCase()).join(" ");
                const section = getSectionContext(q).toLowerCase();
                const typeName = q.type.toLowerCase();
                const presetName = (q.validation.presetId || "").toLowerCase();

                const matchesSearch =
                    enTitle.includes(query) ||
                    transTitles.includes(query) ||
                    section.includes(query) ||
                    typeName.includes(query) ||
                    presetName.includes(query) ||
                    q.columnName.toLowerCase().includes(query) ||
                    q.displayIndex.includes(query);

                if (!matchesSearch) return false;
            }

            // Question Type filter
            if (filterType !== "ALL" && q.type !== filterType) {
                return false;
            }

            // Section filter
            if (filterSection !== "ALL") {
                const sec = getSectionContext(q);
                if (filterSection === "MAIN" && sec !== "Main Survey") return false;
                if (filterSection === "FOLLOWUP" && !sec.startsWith("Follow-up")) return false;
                if (filterSection === "REPEATER" && !sec.startsWith("Repeater")) return false;
            }

            // Validation & Translation special filters
            if (filterValidation === "HAS_VALIDATION") {
                const hasVal = Boolean(
                    q.validation.required ||
                    q.validation.regexPattern ||
                    q.validation.presetId ||
                    q.validation.minValue !== undefined ||
                    q.validation.minChar !== undefined
                );
                if (!hasVal) return false;
            } else if (filterValidation === "HAS_REGEX") {
                if (!q.validation.regexPattern) return false;
            } else if (filterValidation === "MISSING_TRANSLATION") {
                const hasMissing = locales.some((loc) => !q.titles[loc.code] || q.titles[loc.code].trim() === "");
                if (!hasMissing) return false;
            }

            return true;
        });
    }, [survey.questions, searchQuery, filterType, filterSection, filterValidation, locales]);

    // Question edit mutations
    const handleUpdateQuestion = (updatedQ: QuestionModel) => {
        const updatedQuestions = survey.questions.map((q) => (q.id === updatedQ.id ? updatedQ : q));
        onUpdateSurvey({
            ...survey,
            questions: updatedQuestions,
            updatedAt: new Date().toISOString(),
        });
    };

    const handleTitleCellChange = (qId: string, localeCode: string, newTitle: string) => {
        const updatedQuestions = survey.questions.map((q) => {
            if (q.id !== qId) return q;
            return {
                ...q,
                titles: {
                    ...q.titles,
                    [localeCode]: newTitle,
                },
                translationsMeta: {
                    ...q.translationsMeta,
                    [localeCode]: {
                        status: "manual" as const,
                        translatedAt: new Date().toISOString(),
                    },
                },
            };
        });
        onUpdateSurvey({
            ...survey,
            questions: updatedQuestions,
            updatedAt: new Date().toISOString(),
        });
    };

    // Question type change handler with confirmation
    const handleInitiateTypeChange = (question: QuestionModel, newType: BackendQuestionType) => {
        if (question.type === newType) return;
        setTargetQuestion(question);
        setPendingType(newType);
        setTypeChangeModalOpen(true);
    };

    const handleConfirmTypeChange = () => {
        if (!targetQuestion || !pendingType) return;
        const typeDescriptor = QUESTION_TYPE_REGISTRY[pendingType];
        const updated: QuestionModel = {
            ...targetQuestion,
            type: pendingType,
            displayType: pendingType,
            options: typeDescriptor?.defaultConfig.options
                ? typeDescriptor.defaultConfig.options.map((opt, i) => ({
                      id: `opt_${Date.now()}_${i + 1}`,
                      value: opt.value,
                      labels: { en: opt.labels.en, hi: opt.labels.hi },
                  }))
                : undefined,
            validation: {
                required: targetQuestion.validation.required,
            },
        };

        handleUpdateQuestion(updated);
        setTypeChangeModalOpen(false);
        setTargetQuestion(null);
        setPendingType(null);
    };

    // Auto-translation batch actions
    const handleAutoTranslateColumn = async (targetLocaleCode: string, overwriteAll = false) => {
        setIsTranslating(true);
        try {
            const questionsToTranslate = survey.questions.filter((q) => {
                if (overwriteAll) return Boolean(q.titles.en);
                return Boolean(q.titles.en) && (!q.titles[targetLocaleCode] || q.titles[targetLocaleCode].trim() === "");
            });

            if (questionsToTranslate.length === 0) return;

            const texts = questionsToTranslate.map((q) => q.titles.en || "");
            const translatedTexts = await SurveyService.translateTexts("en", targetLocaleCode, texts);

            const translationMap = new Map<string, string>();
            questionsToTranslate.forEach((q, idx) => {
                translationMap.set(q.id, translatedTexts[idx] || q.titles.en || "");
            });

            const updatedQuestions = survey.questions.map((q) => {
                if (!translationMap.has(q.id)) return q;
                return {
                    ...q,
                    titles: {
                        ...q.titles,
                        [targetLocaleCode]: translationMap.get(q.id)!,
                    },
                    translationsMeta: {
                        ...q.translationsMeta,
                        [targetLocaleCode]: {
                            status: "auto" as const,
                            translatedAt: new Date().toISOString(),
                        },
                    },
                };
            });

            onUpdateSurvey({
                ...survey,
                questions: updatedQuestions,
                updatedAt: new Date().toISOString(),
            });
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 h-full max-h-full bg-white dark:bg-zinc-950 overflow-hidden select-none">
            {/* 1. TOP TOOLBAR (Compact & Information-Dense) */}
            <div className="h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
                {/* Left: Search & Filters */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative w-64 md:w-80">
                        <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                        <Input
                            placeholder="Search questions, translations, types..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-7 pl-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    {/* Question Type Filter */}
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-7 w-36 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent className="text-xs max-h-72">
                            <SelectItem value="ALL">All Types</SelectItem>
                            {QUESTION_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Section Filter */}
                    <Select value={filterSection} onValueChange={setFilterSection}>
                        <SelectTrigger className="h-7 w-36 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            <SelectItem value="ALL">All Sections</SelectItem>
                            <SelectItem value="MAIN">Main Survey</SelectItem>
                            <SelectItem value="FOLLOWUP">Follow-up Questions</SelectItem>
                            <SelectItem value="REPEATER">Repeater Child</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Validation / Missing Translations Filter */}
                    <Select value={filterValidation} onValueChange={setFilterValidation}>
                        <SelectTrigger className="h-7 w-36 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <SelectValue placeholder="Validation Filter" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            <SelectItem value="ALL">All Rules</SelectItem>
                            <SelectItem value="HAS_VALIDATION">Has Validation</SelectItem>
                            <SelectItem value="HAS_REGEX">Has Regex Pattern</SelectItem>
                            <SelectItem value="MISSING_TRANSLATION">Missing Translation</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Right: Columns Toggle & Language Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 border-zinc-200 dark:border-zinc-800">
                                <Columns className="h-3 w-3 text-zinc-500" />
                                <span className="hidden sm:inline">Columns</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                            <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-500">
                                Visible Columns
                            </DropdownMenuLabel>
                            <DropdownMenuCheckboxItem checked={showSectionCol} onCheckedChange={setShowSectionCol}>
                                Section / Context
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showValidationCol} onCheckedChange={setShowValidationCol}>
                                Validation Summary
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onOpenLanguageManager}
                        className="h-7 px-2.5 text-xs gap-1 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    >
                        <Languages className="h-3 w-3 text-zinc-500" />
                        <span>Add Language +</span>
                    </Button>

                    <Badge variant="outline" className="h-6 font-mono text-[10px] text-zinc-500 border-zinc-200 dark:border-zinc-800">
                        {filteredQuestions.length} / {survey.questions.length} rows
                    </Badge>
                </div>
            </div>

            {/* 2. SPREADSHEET GRID (Sticky Left Headers + Horizontally Scrollable Middle) */}
            <div className="flex-1 min-h-0 overflow-auto border-b border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left border-collapse text-xs">
                    {/* TABLE HEADERS */}
                    <thead className="sticky top-0 z-30 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold shadow-xs">
                        <tr>
                            {/* STICKY COL 1: Index Number */}
                            <th className="sticky left-0 z-40 bg-zinc-100 dark:bg-zinc-900 w-[52px] min-w-[52px] max-w-[52px] px-2.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 text-center font-mono">
                                #
                            </th>

                            {/* STICKY COL 2: Question Type */}
                            <th className="sticky left-[52px] z-40 bg-zinc-100 dark:bg-zinc-900 w-[140px] min-w-[140px] max-w-[140px] px-3 py-2.5 border-r border-zinc-200 dark:border-zinc-800">
                                Type
                            </th>

                            {/* STICKY COL 3: Section */}
                            {showSectionCol && (
                                <th className="sticky left-[192px] z-40 bg-zinc-100 dark:bg-zinc-900 w-[140px] min-w-[140px] max-w-[140px] px-3 py-2.5 border-r border-zinc-200 dark:border-zinc-800">
                                    Section
                                </th>
                            )}

                            {/* STICKY COL 4: English Primary Title */}
                            <th
                                className={cn(
                                    "sticky z-40 bg-zinc-100 dark:bg-zinc-900 min-w-[280px] px-3 py-2.5 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]",
                                    showSectionCol ? "left-[332px]" : "left-[192px]"
                                )}
                            >
                                Primary Prompt (English)
                            </th>

                            {/* TRANSLATION COLUMNS (Horizontally Scrollable) */}
                            {locales.map((loc) => {
                                if (loc.code === "en") return null;
                                return (
                                    <th
                                        key={loc.code}
                                        className="min-w-[260px] px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/90"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                {loc.label}
                                            </span>

                                            {/* Auto-Translate Column Dropdown */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                                    <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-500">
                                                        {loc.label} Actions
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        onClick={() => handleAutoTranslateColumn(loc.code, false)}
                                                        disabled={isTranslating || isPublished}
                                                        className="gap-2 cursor-pointer"
                                                    >
                                                        <Sparkles className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                        Translate missing only
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setRetranslateTargetLocale(loc.code);
                                                            setRetranslateModalOpen(true);
                                                        }}
                                                        disabled={isTranslating || isPublished}
                                                        className="gap-2 cursor-pointer text-amber-600 dark:text-amber-400"
                                                    >
                                                        <RotateCw className="h-3.5 w-3.5" />
                                                        Re-translate all prompts
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </th>
                                );
                            })}

                            {/* VALIDATION COLUMN */}
                            {showValidationCol && (
                                <th className="min-w-[200px] px-3 py-2.5 border-r border-zinc-200 dark:border-zinc-800">
                                    Validation Rules
                                </th>
                            )}
                        </tr>
                    </thead>

                    {/* TABLE BODY */}
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {filteredQuestions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-zinc-500 text-xs">
                                    No questions match the current filter criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredQuestions.map((q) => {
                                const sectionContext = getSectionContext(q);

                                return (
                                    <tr
                                        key={q.id}
                                        onClick={() => onSelectQuestion?.(q.id)}
                                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60 transition-colors group cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                                    >
                                        {/* 1. STICKY NUMBER */}
                                        <td className="sticky left-0 z-20 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50/80 dark:group-hover:bg-zinc-900/60 w-[52px] min-w-[52px] max-w-[52px] px-2.5 py-2 border-r border-zinc-200 dark:border-zinc-800 text-center font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                                            Q{q.displayIndex || q.number}
                                        </td>

                                        {/* 2. STICKY QUESTION TYPE */}
                                        <td className="sticky left-[52px] z-20 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50/80 dark:group-hover:bg-zinc-900/60 w-[140px] min-w-[140px] max-w-[140px] px-1.5 py-1.5 border-r border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-0.5 w-full">
                                                <Select
                                                    value={q.type}
                                                    disabled={isPublished}
                                                    onValueChange={(val: BackendQuestionType) => handleInitiateTypeChange(q, val)}
                                                >
                                                    <SelectTrigger className="h-7 text-[11px] bg-transparent border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 font-medium text-left justify-between flex-1 min-w-0 px-1 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                                        <SelectValue placeholder={QUESTION_TYPE_OPTIONS.find((o) => o.id === q.type)?.label || q.type} />
                                                    </SelectTrigger>
                                                    <SelectContent className="text-xs max-h-72">
                                                        {QUESTION_TYPE_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.id} value={opt.id}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <QuestionTypeHelpPopover type={q.type} side="right" />
                                            </div>
                                        </td>

                                        {/* 3. STICKY SECTION */}
                                        {showSectionCol && (
                                            <td className="sticky left-[192px] z-20 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50/80 dark:group-hover:bg-zinc-900/60 w-[140px] min-w-[140px] max-w-[140px] px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 font-mono">
                                                {sectionContext}
                                            </td>
                                        )}

                                        {/* 4. STICKY ENGLISH PROMPT */}
                                        <td
                                            className={cn(
                                                "sticky z-20 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50/80 dark:group-hover:bg-zinc-900/60 p-1.5 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]",
                                                showSectionCol ? "left-[332px]" : "left-[192px]"
                                            )}
                                        >
                                            <Input
                                                value={q.titles.en || ""}
                                                disabled={isPublished}
                                                onChange={(e) => handleTitleCellChange(q.id, "en", e.target.value)}
                                                className="h-7 text-xs border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 bg-transparent rounded-sm"
                                            />
                                        </td>

                                        {/* 5. DYNAMIC TRANSLATION COLUMNS */}
                                        {locales.map((loc) => {
                                            if (loc.code === "en") return null;
                                            const val = q.titles[loc.code] || "";
                                            const meta = q.translationsMeta?.[loc.code];

                                            return (
                                                <td
                                                    key={loc.code}
                                                    className="p-1.5 border-r border-zinc-200 dark:border-zinc-800"
                                                >
                                                    <div className="relative">
                                                        <Input
                                                            value={val}
                                                            disabled={isPublished}
                                                            placeholder={`Enter ${loc.label} translation...`}
                                                            onChange={(e) => handleTitleCellChange(q.id, loc.code, e.target.value)}
                                                            className={cn(
                                                                "h-7 text-xs border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 bg-transparent rounded-sm",
                                                                loc.code === "hi" && "font-hindi"
                                                            )}
                                                        />
                                                        {meta?.status === "auto" && (
                                                            <span
                                                                title="Auto-translated via backend service"
                                                                className="absolute right-1.5 top-1.5 text-[9px] text-zinc-400 font-mono"
                                                            >
                                                                [AI]
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        {/* 6. VALIDATION POPOVER COLUMN */}
                                        {showValidationCol && (
                                            <td className="p-1.5 border-r border-zinc-200 dark:border-zinc-800">
                                                <TableValidationPopover
                                                    question={q}
                                                    onUpdateQuestion={handleUpdateQuestion}
                                                    isPublished={isPublished}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Type Change Confirmation Dialog */}
            {targetQuestion && pendingType && (
                <ChangeTypeDialog
                    open={typeChangeModalOpen}
                    onOpenChange={setTypeChangeModalOpen}
                    currentType={targetQuestion.type}
                    newType={pendingType}
                    onConfirmChange={handleConfirmTypeChange}
                />
            )}

            {/* Re-translation Overwrite Confirmation Dialog */}
            <Dialog open={retranslateModalOpen} onOpenChange={setRetranslateModalOpen}>
                <DialogContent className="sm:max-w-[440px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-5">
                    <DialogHeader className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-5 w-5" />
                            <DialogTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                Overwrite Existing Translations?
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Some questions already contain manual translations. Re-translating will replace all existing text with freshly generated translations.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-3 gap-2 flex items-center justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRetranslateModalOpen(false)}
                            className="h-8 text-xs border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (retranslateTargetLocale) {
                                    handleAutoTranslateColumn(retranslateTargetLocale, true);
                                }
                                setRetranslateModalOpen(false);
                            }}
                            className="h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                        >
                            Replace All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
