"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    RotateCcw,
    Layers,
    AlertCircle,
    Asterisk,
    Star,
    MapPin,
    Calendar,
    Clock,
    Smile,
    ListOrdered,
    Mic,
    Paperclip,
    Info,
    Play,
    Square,
    UploadCloud,
    MoveUp,
    MoveDown,
    Volume2,
    FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuestionModel, SurveyModel } from "../../types/survey-schema";
import { isQuestionVisible } from "../../lib/logic-evaluator";
import { TranslationService } from "../../services/translation-service";
import { PreviewChoice } from "./fields/preview-choice";
import { PreviewText } from "./fields/preview-text";
import { PreviewNumber } from "./fields/preview-number";
import { PreviewDate } from "./fields/preview-date";
import { PreviewMedia } from "./fields/preview-media";
import { PreviewQR } from "./fields/preview-qr";
import { PreviewPolygon } from "./fields/preview-polygon";
import { PreviewMasterCatalogPage } from "./fields/preview-master-catalog-page";

interface PreviewRuntimeProps {
    survey: SurveyModel;
    selectedQuestionId?: string | null;
    locale: string;
    runtimeAnswers: Record<string, any>;
    onChangeAnswer: (questionId: string, value: any) => void;
    onResetAnswers: () => void;
    onSelectQuestion?: (questionId: string) => void;
    // Lifted position props for Option B close/reopen retention
    activeQuestionId?: string | null;
    onActiveQuestionChange?: (questionId: string | null) => void;
    activeRepeaterTab?: number;
    onActiveRepeaterTabChange?: (tab: number) => void;
}

export function PreviewRuntime({
    survey,
    selectedQuestionId,
    locale,
    runtimeAnswers,
    onChangeAnswer,
    onResetAnswers,
    onSelectQuestion,
    activeQuestionId: propActiveQuestionId,
    onActiveQuestionChange,
    activeRepeaterTab: propActiveRepeaterTab,
    onActiveRepeaterTabChange,
}: PreviewRuntimeProps) {
    // Primary runtime question identifier
    const [internalActiveQuestionId, setInternalActiveQuestionId] = useState<string | null>(
        selectedQuestionId || (survey.questions[0]?.id ?? null)
    );
    const activeQuestionId = propActiveQuestionId !== undefined ? propActiveQuestionId : internalActiveQuestionId;
    const setActiveQuestionId = (qId: string | null) => {
        if (onActiveQuestionChange) onActiveQuestionChange(qId);
        setInternalActiveQuestionId(qId);
    };

    // Repeater iteration index state
    const [internalActiveRepeaterTab, setInternalActiveRepeaterTab] = useState<number>(0);
    const activeRepeaterTab = propActiveRepeaterTab !== undefined ? propActiveRepeaterTab : internalActiveRepeaterTab;
    const setActiveRepeaterTab = (tab: number) => {
        if (onActiveRepeaterTabChange) onActiveRepeaterTabChange(tab);
        setInternalActiveRepeaterTab(tab);
    };

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Sub-page state: for opening full-screen Master Data Catalog inside the smartphone simulator
    const [activeMasterQuestion, setActiveMasterQuestion] = useState<QuestionModel | null>(null);

    // Desktop selection tracking ref to decouple builder clicks from live answer changes (MOBILE-NAV-001)
    const lastDesktopSelectedIdRef = useRef<string | null>(selectedQuestionId || null);

    // Helper to extract instance-scoped answers for a given repeater iteration
    const getScopedAnswers = useMemo(() => {
        return (tabIdx: number) => {
            const scoped: Record<string, any> = { ...runtimeAnswers };
            Object.keys(runtimeAnswers).forEach((k) => {
                if (k.endsWith(`_inst_${tabIdx}`)) {
                    const baseKey = k.replace(`_inst_${tabIdx}`, "");
                    scoped[baseKey] = runtimeAnswers[k];
                }
            });
            return scoped;
        };
    }, [runtimeAnswers]);

    // Compute visible questions strictly according to live answers and conditional rules
    const visibleQuestions = useMemo(() => {
        return survey.questions.filter((q: QuestionModel) => {
            const parent = survey.questions.find(
                (p: QuestionModel) => p.repeater?.isRepeater && p.repeater.childQuestionIds?.includes(q.id)
            );
            if (parent) {
                const scopedAnswers = getScopedAnswers(activeRepeaterTab);
                return isQuestionVisible(q, scopedAnswers);
            }
            return isQuestionVisible(q, runtimeAnswers);
        });
    }, [survey.questions, runtimeAnswers, activeRepeaterTab, getScopedAnswers]);

    // Only sync to desktop selection when the desktop author explicitly selected a DIFFERENT question (MOBILE-NAV-001)
    useEffect(() => {
        if (!selectedQuestionId) return;

        if (selectedQuestionId !== lastDesktopSelectedIdRef.current) {
            lastDesktopSelectedIdRef.current = selectedQuestionId;
            const isVisible = visibleQuestions.some((q) => q.id === selectedQuestionId);
            if (isVisible) {
                setActiveQuestionId(selectedQuestionId);
                setIsSubmitted(false);
                setValidationError(null);
            }
        }
    }, [selectedQuestionId, visibleQuestions]);

    // Ensure activeQuestionId stays valid when dynamic conditions show/hide questions (MOBILE-NAV-002)
    useEffect(() => {
        if (visibleQuestions.length === 0) return;

        if (!activeQuestionId || !visibleQuestions.some((q) => q.id === activeQuestionId)) {
            // Move to nearest valid visible question (or first visible)
            setActiveQuestionId(visibleQuestions[0].id);
        }
    }, [visibleQuestions, activeQuestionId]);

    // Derive visible index from activeQuestionId + current visible sequence
    const currentQuestionIndex = useMemo(() => {
        if (!activeQuestionId) return 0;
        const found = visibleQuestions.findIndex((q) => q.id === activeQuestionId);
        return found !== -1 ? found : 0;
    }, [visibleQuestions, activeQuestionId]);

    const activeQuestion: QuestionModel | undefined = visibleQuestions[currentQuestionIndex];

    // Check if active question is a repeater parent or part of a repeater
    const repeaterParent = survey.questions.find(
        (q: QuestionModel) => q.repeater?.isRepeater && q.repeater.childQuestionIds?.includes(activeQuestion?.id || "")
    );

    const repeatCount = repeaterParent
        ? Math.max(1, Number(runtimeAnswers[repeaterParent.id] || repeaterParent.repeater?.fixedCount || 2))
        : 1;

    // Instance-isolated answer key for repeated questions
    const answerKey = repeaterParent && repeatCount > 1
        ? `${activeQuestion?.id}_inst_${activeRepeaterTab}`
        : activeQuestion?.id || "";

    const currentAnswer = activeQuestion
        ? (runtimeAnswers[answerKey] !== undefined ? runtimeAnswers[answerKey] : runtimeAnswers[activeQuestion.id])
        : undefined;

    const progressPercentage = visibleQuestions.length > 0
        ? Math.round(((currentQuestionIndex + 1) / visibleQuestions.length) * 100)
        : 0;

    const getQuestionNumberLabel = (q?: QuestionModel) => {
        if (!q) return "";
        const num = q.questionNumber || q.displayIndex || q.number || "";
        if (!num) return "";
        return String(num).startsWith("Q") ? String(num) : `Q${num}`;
    };

    // RTL detection (MOBILE-RTL-001)
    const localeDef = survey.locales?.find((l) => l.code === locale);
    const isRtl = localeDef?.direction === "rtl" || ["ar", "he", "fa", "ur"].includes(locale);

    const handleNext = () => {
        if (!activeQuestion) return;

        // Full Field Validation Check with Localized Error Messages
        const val = activeQuestion.validation || {};
        const isEmpty =
            currentAnswer === undefined ||
            currentAnswer === null ||
            currentAnswer === "" ||
            (Array.isArray(currentAnswer) && currentAnswer.length === 0);

        if (val.required && isEmpty) {
            const customMsg =
                typeof val.customErrorMessage === "string"
                    ? val.customErrorMessage
                    : val.customErrorMessage?.[locale] || val.customErrorMessage?.en;
            setValidationError(
                customMsg || (locale === "hi" ? "यह प्रश्न आवश्यक है।" : "This question is required.")
            );
            return;
        }

        if (!isEmpty) {
            // Text length constraints
            if (typeof currentAnswer === "string") {
                if (val.minChar !== undefined && currentAnswer.length < val.minChar) {
                    const msg = val.lengthErrorMessage?.[locale] || val.lengthErrorMessage?.en || `Must be at least ${val.minChar} characters.`;
                    setValidationError(msg);
                    return;
                }
                if (val.maxChar !== undefined && currentAnswer.length > val.maxChar) {
                    const msg = val.lengthErrorMessage?.[locale] || val.lengthErrorMessage?.en || `Cannot exceed ${val.maxChar} characters.`;
                    setValidationError(msg);
                    return;
                }
            }

            // Numeric min / max / format constraints
            const isNumeric =
                activeQuestion.type === "Number" ||
                activeQuestion.type.includes("Decimal") ||
                activeQuestion.type.includes("WholeNum") ||
                activeQuestion.type.includes("NaturalNum");

            if (isNumeric && currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== "") {
                const numVal = Number(currentAnswer);
                if (!isNaN(numVal)) {
                    if (val.numberFormat === "integer" && !Number.isInteger(numVal)) {
                        setValidationError("Please enter a valid whole number (integer).");
                        return;
                    }
                    if (val.minValue !== undefined && numVal < val.minValue) {
                        const msg = val.minMaxErrorMessage?.[locale] || val.minMaxErrorMessage?.en || `Value must be at least ${val.minValue}.`;
                        setValidationError(msg);
                        return;
                    }
                    if (val.maxValue !== undefined && numVal > val.maxValue) {
                        const msg = val.minMaxErrorMessage?.[locale] || val.minMaxErrorMessage?.en || `Value cannot exceed ${val.maxValue}.`;
                        setValidationError(msg);
                        return;
                    }
                }
            }

            // Checkbox selection limits
            if (Array.isArray(currentAnswer)) {
                if (val.minSelections !== undefined && currentAnswer.length < val.minSelections) {
                    const msg = val.selectionCountErrorMessage?.[locale] || val.selectionCountErrorMessage?.en || `Please select at least ${val.minSelections} options.`;
                    setValidationError(msg);
                    return;
                }
                if (val.maxSelections !== undefined && currentAnswer.length > val.maxSelections) {
                    const msg = val.selectionCountErrorMessage?.[locale] || val.selectionCountErrorMessage?.en || `Cannot select more than ${val.maxSelections} options.`;
                    setValidationError(msg);
                    return;
                }
            }

            // DateRange start/end order constraints
            if (activeQuestion.type === "DateRange" && typeof currentAnswer === "object" && currentAnswer !== null) {
                const { start, end } = currentAnswer as { start?: string; end?: string };
                if (start && end) {
                    if (start > end) {
                        const msg = val.dateRangeErrorMessage?.[locale] || val.dateRangeErrorMessage?.en || "Start date cannot be after end date.";
                        setValidationError(msg);
                        return;
                    }
                    if (val.allowSameDayRange === false && start === end) {
                        const msg = val.dateRangeErrorMessage?.[locale] || val.dateRangeErrorMessage?.en || "Start and end dates cannot be on the same day.";
                        setValidationError(msg);
                        return;
                    }
                }
            }
        }

        setValidationError(null);

        // Repeater group navigation (MOBILE-REPEATER-001)
        if (repeaterParent && repeaterParent.repeater?.childQuestionIds) {
            const childIds = repeaterParent.repeater.childQuestionIds;
            const childQuestions = survey.questions.filter((q) => childIds.includes(q.id));
            const currentScopedAnswers = getScopedAnswers(activeRepeaterTab);
            const currentVisibleChildren = childQuestions.filter((cq) => isQuestionVisible(cq, currentScopedAnswers));

            // Check if currently on the last visible child question of this repeater iteration
            const isLastVisibleChild = currentVisibleChildren.length > 0 &&
                currentVisibleChildren[currentVisibleChildren.length - 1].id === activeQuestion.id;

            if (isLastVisibleChild) {
                if (activeRepeaterTab < repeatCount - 1) {
                    // Find first visible child in the NEXT iteration(s)
                    let foundNextChild: QuestionModel | null = null;
                    let nextTabIdx = activeRepeaterTab + 1;

                    while (nextTabIdx < repeatCount) {
                        const nextScopedAnswers = getScopedAnswers(nextTabIdx);
                        const nextVisChildren = childQuestions.filter((cq) => isQuestionVisible(cq, nextScopedAnswers));
                        if (nextVisChildren.length > 0) {
                            foundNextChild = nextVisChildren[0];
                            break;
                        }
                        nextTabIdx++;
                    }

                    if (foundNextChild) {
                        setActiveRepeaterTab(nextTabIdx);
                        setActiveQuestionId(foundNextChild.id);
                        return;
                    } else {
                        // Completed all repeater instances
                        setActiveRepeaterTab(0);
                    }
                } else {
                    // Completed all repeater instances
                    setActiveRepeaterTab(0);
                }
            }
        }

        // Navigate to next visible question in the runtime sequence (MOBILE-NAV-002)
        const currentIdx = visibleQuestions.findIndex((q) => q.id === activeQuestion.id);
        if (currentIdx !== -1 && currentIdx < visibleQuestions.length - 1) {
            setActiveQuestionId(visibleQuestions[currentIdx + 1].id);
        } else {
            setIsSubmitted(true);
        }
    };

    const handleBack = () => {
        setValidationError(null);

        // Repeater group back navigation (MOBILE-REPEATER-001)
        if (repeaterParent && repeaterParent.repeater?.childQuestionIds) {
            const childIds = repeaterParent.repeater.childQuestionIds;
            const childQuestions = survey.questions.filter((q) => childIds.includes(q.id));
            const currentScopedAnswers = getScopedAnswers(activeRepeaterTab);
            const currentVisibleChildren = childQuestions.filter((cq) => isQuestionVisible(cq, currentScopedAnswers));

            const isFirstVisibleChild = currentVisibleChildren.length > 0 &&
                currentVisibleChildren[0].id === activeQuestion?.id;

            if (isFirstVisibleChild && activeRepeaterTab > 0) {
                // Find last visible child in PREVIOUS iteration
                let prevTabIdx = activeRepeaterTab - 1;
                let foundPrevChild: QuestionModel | null = null;

                while (prevTabIdx >= 0) {
                    const prevScopedAnswers = getScopedAnswers(prevTabIdx);
                    const prevVisChildren = childQuestions.filter((cq) => isQuestionVisible(cq, prevScopedAnswers));
                    if (prevVisChildren.length > 0) {
                        foundPrevChild = prevVisChildren[prevVisChildren.length - 1];
                        break;
                    }
                    prevTabIdx--;
                }

                if (foundPrevChild) {
                    setActiveRepeaterTab(prevTabIdx);
                    setActiveQuestionId(foundPrevChild.id);
                    return;
                }
            }
        }

        // Navigate to previous visible question in the runtime sequence (MOBILE-NAV-002)
        const currentIdx = visibleQuestions.findIndex((q) => q.id === activeQuestion?.id);
        if (currentIdx > 0) {
            setActiveQuestionId(visibleQuestions[currentIdx - 1].id);
        }
    };

    const handleReset = () => {
        onResetAnswers();
        setActiveRepeaterTab(0);
        setIsSubmitted(false);
        setValidationError(null);
        setActiveMasterQuestion(null);
        if (visibleQuestions.length > 0) {
            setActiveQuestionId(visibleQuestions[0].id);
        }
    };

    // Sub-Page Navigation: If a master data catalog page is opened
    if (activeMasterQuestion) {
        const masterAnswerKey = repeaterParent && repeatCount > 1
            ? `${activeMasterQuestion.id}_inst_${activeRepeaterTab}`
            : activeMasterQuestion.id;
        const masterCurrentVal = runtimeAnswers[masterAnswerKey] ?? runtimeAnswers[activeMasterQuestion.id];

        return (
            <PreviewMasterCatalogPage
                question={activeMasterQuestion}
                value={masterCurrentVal}
                onConfirm={(newVal) => {
                    onChangeAnswer(masterAnswerKey, newVal);
                    if (activeRepeaterTab === 0) {
                        onChangeAnswer(activeMasterQuestion.id, newVal);
                    }
                    setValidationError(null);
                }}
                onBack={() => setActiveMasterQuestion(null)}
                locale={locale}
            />
        );
    }

    if (isSubmitted) {
        return (
            <div
                dir={isRtl ? "rtl" : "ltr"}
                className="flex flex-col items-center justify-center p-6 text-center h-full space-y-4 bg-white dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-300"
            >
                <div className="p-3.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10">
                    <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {locale === "hi" ? "सर्वेक्षण सफलतापूर्वक पूर्ण हुआ!" : "Survey Completed Successfully!"}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px] leading-relaxed">
                        {locale === "hi"
                            ? "सभी डेटा मान्य और स्थानीय रूप से संग्रहीत किया गया है।"
                            : "All responses validated and recorded into MATIC field database."}
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={handleReset}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold text-xs h-10 min-h-[40px] px-4 gap-1.5 rounded-lg mt-2 shadow-xs cursor-pointer"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{locale === "hi" ? "पुनः परीक्षण करें" : "Restart Preview"}</span>
                </Button>
            </div>
        );
    }

    if (!activeQuestion) {
        return (
            <div
                dir={isRtl ? "rtl" : "ltr"}
                className="p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-950 space-y-3"
            >
                <p>No questions currently visible based on current logic branch.</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-zinc-800 dark:text-zinc-200 text-xs rounded-lg h-10 min-h-[40px] px-4 cursor-pointer"
                >
                    Reset Survey Answers
                </Button>
            </div>
        );
    }

    const titleText = TranslationService.resolveQuestionText(
        activeQuestion,
        "label",
        locale,
        null,
        survey.defaultLocale || "en"
    );
    const itemLabelTemplate = repeaterParent?.repeater?.itemLabelTemplate || "Plot #{index}";
    const questionNumBadge = getQuestionNumberLabel(activeQuestion);

    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none"
        >
            {/* Accessible Polite Live Region for Screen Readers (MOBILE-A11Y-001) */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {`${questionNumBadge}: ${titleText}. ${activeQuestion.validation?.required ? "Required." : ""}`}
            </div>

            {/* Top Respondent Progress Header */}
            <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-850 bg-zinc-50/80 dark:bg-zinc-900/60 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                            {locale === "hi" ? "प्रश्न" : "Question"} {currentQuestionIndex + 1} {locale === "hi" ? "कुल" : "of"} {visibleQuestions.length}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0">
                            {questionNumBadge}
                        </span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 font-semibold shrink-0">
                        {progressPercentage}%
                    </span>
                </div>
                <Progress value={progressPercentage} className="h-1.5 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* Repeater Instance Tabs (if question belongs to repeated group) */}
            {repeaterParent && repeatCount > 1 && (
                <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    <Layers className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0 mr-1" />
                    {Array.from({ length: repeatCount }).map((_, rIdx) => {
                        const tabLabel = itemLabelTemplate.replace("#{index}", String(rIdx + 1));
                        return (
                            <button
                                key={rIdx}
                                type="button"
                                onClick={() => {
                                    setActiveRepeaterTab(rIdx);
                                    // Also jump to first visible question in that tab
                                    const childIds = repeaterParent.repeater?.childQuestionIds || [];
                                    const childQuestions = survey.questions.filter((q) => childIds.includes(q.id));
                                    const scoped = getScopedAnswers(rIdx);
                                    const firstVis = childQuestions.find((cq) => isQuestionVisible(cq, scoped));
                                    if (firstVis) {
                                        setActiveQuestionId(firstVis.id);
                                    }
                                }}
                                className={cn(
                                    "px-2.5 py-1 rounded text-[10px] font-semibold transition-colors shrink-0 cursor-pointer min-h-[28px]",
                                    activeRepeaterTab === rIdx
                                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-2xs"
                                        : "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                                )}
                            >
                                {tabLabel} ({rIdx + 1}/{repeatCount})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Question Card Scroll Area */}
            <ScrollArea className="flex-1 p-4">
                <div role="region" aria-labelledby="preview-question-title" className="space-y-4 pb-4">
                    {/* Question Title & Badges */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700">
                                {questionNumBadge}
                            </span>
                            {repeaterParent && (
                                <Badge variant="outline" className="text-[9px] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 px-1 py-0 gap-0.5">
                                    <Layers className="h-2.5 w-2.5" /> {itemLabelTemplate.replace("#{index}", String(activeRepeaterTab + 1))}
                                </Badge>
                            )}
                            {activeQuestion.validation?.required && (
                                <Badge variant="outline" className="text-[9px] border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 px-1 py-0 gap-0.5">
                                    <Asterisk className="h-2.5 w-2.5" /> Required
                                </Badge>
                            )}
                        </div>

                        <h2
                            id="preview-question-title"
                            className={cn(
                                "font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-snug",
                                locale === "hi" && "font-hindi text-sm"
                            )}
                        >
                            {titleText}
                        </h2>
                    </div>

                    {/* Question Input Simulator Field */}
                    <div className="pt-1">
                        {renderPreviewField(
                            activeQuestion,
                            currentAnswer,
                            (val) => {
                                onChangeAnswer(answerKey, val);
                                if (activeRepeaterTab === 0) {
                                    onChangeAnswer(activeQuestion.id, val);
                                }
                                setValidationError(null);
                            },
                            locale,
                            (masterQ) => setActiveMasterQuestion(masterQ)
                        )}
                    </div>

                    {/* Validation Error Message */}
                    {validationError && (
                        <div
                            role="alert"
                            className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-200"
                        >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{validationError}</span>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Bottom Respondent Navigation Bar with 40-44px Touch Targets (MOBILE-UI-001) */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-850 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between gap-2 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={currentQuestionIndex === 0 && activeRepeaterTab === 0}
                    onClick={handleBack}
                    className="h-10 sm:h-11 min-h-[40px] px-3.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-800 gap-1.5 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>{locale === "hi" ? "पिछला" : "Back"}</span>
                </Button>

                <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    className="h-10 sm:h-11 min-h-[40px] px-5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 rounded-lg shadow-2xs cursor-pointer"
                >
                    <span>
                        {currentQuestionIndex === visibleQuestions.length - 1 && activeRepeaterTab === repeatCount - 1
                            ? locale === "hi" ? "जमा करें" : "Submit"
                            : locale === "hi" ? "आगे बढ़ें" : "Next"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

/**
 * Dispatcher to render the appropriate interactive field simulator
 */
function renderPreviewField(
    question: QuestionModel,
    value: any,
    onChange: (val: any) => void,
    locale: string,
    onOpenMasterCatalog: (question: QuestionModel) => void
) {
    switch (question.type) {
        case "Radio":
        case "Checkbox":
        case "Dropdown":
        case "Selected Dropdown":
            return (
                <PreviewChoice
                    question={question}
                    value={value}
                    onChange={onChange}
                    locale={locale}
                    onOpenMasterCatalog={onOpenMasterCatalog}
                />
            );

        case "Subjective":
        case "TextArea":
            return <PreviewText question={question} value={value} onChange={onChange} locale={locale} />;

        case "Number":
        case "DecimalMax10":
        case "DecimalMax100":
        case "DecimalMax500":
        case "DecimalMax1000":
        case "DecimalMax10000":
        case "DecimalMax100000":
        case "WholeNumMax100":
        case "WholeNumMax500":
        case "WholeNumMax1000":
        case "NaturalNumMax10000":
            return <PreviewNumber question={question} value={value} onChange={onChange} locale={locale} />;

        case "Date":
        case "DateRange":
        case "CalendarWithDate":
            return <PreviewDate question={question} value={value} onChange={onChange} locale={locale} />;

        case "Picture Input":
        case "Video":
            return <PreviewMedia question={question} value={value} onChange={onChange} locale={locale} />;

        case "QRCode":
            return <PreviewQR question={question} value={value} onChange={onChange} locale={locale} />;

        case "PolygonBoundary":
            return <PreviewPolygon question={question} value={value} onChange={onChange} locale={locale} />;

        case "Rating":
            return (
                <div className="flex items-center gap-1.5 justify-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => onChange(star)}
                            className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-transform active:scale-90 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                        >
                            <Star
                                className={cn(
                                    "h-7 w-7",
                                    Number(value) >= star ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700"
                                )}
                            />
                        </button>
                    ))}
                </div>
            );

        case "Repeater_QT":
            return (
                <div className="space-y-2">
                    <PreviewNumber question={question} value={value} onChange={onChange} locale={locale} />
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                        Entering a number (e.g. 2) dynamically expands repeated plot sections in the next questions.
                    </p>
                </div>
            );

        case "Time": {
            return (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {locale === "hi" ? "समय चुनें" : "Select Time"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="time"
                            value={typeof value === "string" ? value : "09:30"}
                            onChange={(e) => onChange(e.target.value)}
                            className="h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-mono text-zinc-900 dark:text-zinc-100 flex-1 focus:outline-none focus:ring-1 focus:ring-zinc-400 min-h-[40px]"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const now = new Date();
                                const hh = String(now.getHours()).padStart(2, "0");
                                const mm = String(now.getMinutes()).padStart(2, "0");
                                onChange(`${hh}:${mm}`);
                            }}
                            className="h-10 text-[11px] px-3 border-zinc-200 dark:border-zinc-700 font-medium min-h-[40px]"
                        >
                            Now
                        </Button>
                    </div>
                </div>
            );
        }

        case "Emoji": {
            const emojis = [
                { emoji: "😡", label: "Very Bad", score: 1 },
                { emoji: "🙁", label: "Bad", score: 2 },
                { emoji: "😐", label: "Neutral", score: 3 },
                { emoji: "🙂", label: "Good", score: 4 },
                { emoji: "😍", label: "Excellent", score: 5 },
            ];
            return (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-around gap-1 pt-1">
                        {emojis.map((item) => {
                            const isSelected = value === item.score;
                            return (
                                <button
                                    key={item.score}
                                    type="button"
                                    onClick={() => onChange(item.score)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px]",
                                        isSelected
                                            ? "bg-zinc-200 dark:bg-zinc-800 scale-110 shadow-xs ring-1 ring-zinc-400 dark:ring-zinc-600"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 opacity-80 hover:opacity-100"
                                    )}
                                >
                                    <span className="text-2xl select-none leading-none">{item.emoji}</span>
                                    <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[50px]">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        case "Rank": {
            const defaultItems = (question.options && question.options.length > 0)
                ? question.options.map((o) => o.labels.en || o.value)
                : ["Priority 1: Soil Quality", "Priority 2: Water Access", "Priority 3: Market Linkage"];
            const currentList: string[] = Array.isArray(value) && value.length > 0 ? value : defaultItems;

            const moveItem = (fromIdx: number, toIdx: number) => {
                if (toIdx < 0 || toIdx >= currentList.length) return;
                const next = [...currentList];
                const [moved] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, moved);
                onChange(next);
            };

            return (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                        Drag or Use Arrows to Rank Items
                    </span>
                    <div className="space-y-1.5">
                        {currentList.map((item, idx) => (
                            <div
                                key={item}
                                className="flex items-center justify-between p-2 px-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs shadow-2xs min-h-[40px]"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[10px] font-bold w-5 h-5 rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{item}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => moveItem(idx, idx - 1)}
                                        className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-20 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                                    >
                                        <MoveUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={idx === currentList.length - 1}
                                        onClick={() => moveItem(idx, idx + 1)}
                                        className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-20 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                                    >
                                        <MoveDown className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        case "Audio": {
            const isRecorded = Boolean(value);
            return (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                {isRecorded ? "Voice Note Recorded" : "Voice Memo Recorder"}
                            </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700">
                            {isRecorded ? "00:42" : "Max 120s"}
                        </Badge>
                    </div>

                    {isRecorded ? (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[44px]">
                            <div className="flex items-center gap-2 min-w-0">
                                <Volume2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="text-xs font-mono truncate text-zinc-700 dark:text-zinc-300">
                                    audio_recording_42s.m4a
                                </span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onChange(null)}
                                className="h-8 min-h-[32px] text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                                Delete
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onChange("audio_recording_42s.m4a")}
                                className="h-10 min-h-[40px] px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2 cursor-pointer shadow-xs flex-1"
                            >
                                <Mic className="h-4 w-4 animate-pulse" />
                                <span>Record Voice Memo</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onChange("audio_sample_clip.m4a")}
                                className="h-10 min-h-[40px] text-xs border-zinc-200 dark:border-zinc-700"
                            >
                                Upload Audio
                            </Button>
                        </div>
                    )}
                </div>
            );
        }

        case "Document": {
            const hasDoc = Boolean(value);
            return (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Document Attachment
                            </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-zinc-300 dark:border-zinc-700">
                            PDF / Office (Max 25MB)
                        </Badge>
                    </div>

                    {hasDoc ? (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[44px]">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="text-xs font-mono truncate text-zinc-700 dark:text-zinc-300">
                                    land_registry_extract.pdf (2.4 MB)
                                </span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onChange(null)}
                                className="h-8 min-h-[32px] text-[10px] text-rose-600 hover:text-rose-700"
                            >
                                Remove
                            </Button>
                        </div>
                    ) : (
                        <div
                            onClick={() => onChange("land_registry_extract.pdf")}
                            className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-950 text-center cursor-pointer transition-colors space-y-1.5 min-h-[80px]"
                        >
                            <UploadCloud className="h-6 w-6 text-zinc-400 mx-auto" />
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                Click or drag document here to upload
                            </p>
                            <p className="text-[10px] text-zinc-400">PDF, DOCX, XLSX supported</p>
                        </div>
                    )}
                </div>
            );
        }

        default:
            return <PreviewText question={question} value={value} onChange={onChange} locale={locale} />;
    }
}
