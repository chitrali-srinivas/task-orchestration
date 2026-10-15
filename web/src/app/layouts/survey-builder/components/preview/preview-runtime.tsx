"use client";

import React, { useState, useMemo, useEffect } from "react";
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
    Sparkles,
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
}

export function PreviewRuntime({
    survey,
    selectedQuestionId,
    locale,
    runtimeAnswers,
    onChangeAnswer,
    onResetAnswers,
    onSelectQuestion,
}: PreviewRuntimeProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Repeater state: track current iteration index for repeated groups (e.g. Plot 1 of 2)
    const [activeRepeaterTab, setActiveRepeaterTab] = useState<number>(0);

    // Sub-page state: for opening full-screen Master Data Catalog inside the smartphone simulator
    const [activeMasterQuestion, setActiveMasterQuestion] = useState<QuestionModel | null>(null);

    // Compute visible questions strictly according to live answers and conditional rules
    const visibleQuestions = useMemo(() => {
        return survey.questions.filter((q: QuestionModel) => {
            const parent = survey.questions.find(
                (p: QuestionModel) => p.repeater?.isRepeater && p.repeater.childQuestionIds?.includes(q.id)
            );
            if (parent) {
                // Build instance-scoped context for current repeater tab
                const scopedAnswers: Record<string, any> = { ...runtimeAnswers };
                Object.keys(runtimeAnswers).forEach((k) => {
                    if (k.endsWith(`_inst_${activeRepeaterTab}`)) {
                        const baseKey = k.replace(`_inst_${activeRepeaterTab}`, "");
                        scopedAnswers[baseKey] = runtimeAnswers[k];
                    }
                });
                return isQuestionVisible(q, scopedAnswers);
            }
            return isQuestionVisible(q, runtimeAnswers);
        });
    }, [survey.questions, runtimeAnswers, activeRepeaterTab]);

    // Automatically navigate preview to the currently selected question from builder if visible
    useEffect(() => {
        if (!selectedQuestionId) return;

        const targetIdx = visibleQuestions.findIndex((q) => q.id === selectedQuestionId);
        if (targetIdx !== -1) {
            setCurrentQuestionIndex(targetIdx);
            setIsSubmitted(false);
            setValidationError(null);
        }
    }, [selectedQuestionId, visibleQuestions]);

    // Ensure index stays in bounds if questions change dynamically
    useEffect(() => {
        if (currentQuestionIndex >= visibleQuestions.length && visibleQuestions.length > 0) {
            setCurrentQuestionIndex(visibleQuestions.length - 1);
        }
    }, [visibleQuestions.length, currentQuestionIndex]);

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

    const handleNext = () => {
        if (!activeQuestion) return;

        // Required field validation check
        if (activeQuestion.validation?.required) {
            const isEmpty =
                currentAnswer === undefined ||
                currentAnswer === null ||
                currentAnswer === "" ||
                (Array.isArray(currentAnswer) && currentAnswer.length === 0);

            if (isEmpty) {
                setValidationError(
                    locale === "hi" ? "कृपया जारी रखने से पहले यह उत्तर भरें।" : "This question is required."
                );
                return;
            }
        }

        setValidationError(null);

        // Check if currently on the last question of a repeater group
        if (repeaterParent && repeaterParent.repeater?.childQuestionIds) {
            const childIds = repeaterParent.repeater.childQuestionIds;
            const currentChildIdx = childIds.indexOf(activeQuestion.id);

            // If on the last question of this repeater instance
            if (currentChildIdx === childIds.length - 1) {
                // If there are more repeater instances to complete
                if (activeRepeaterTab < repeatCount - 1) {
                    setActiveRepeaterTab((prev) => prev + 1);
                    const firstChildId = childIds[0];
                    const firstChildVisibleIdx = visibleQuestions.findIndex((q) => q.id === firstChildId);
                    if (firstChildVisibleIdx !== -1) {
                        setCurrentQuestionIndex(firstChildVisibleIdx);
                        return;
                    }
                } else {
                    // Completed all instances of this repeater group
                    setActiveRepeaterTab(0);
                }
            }
        }

        if (currentQuestionIndex < visibleQuestions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        } else {
            setIsSubmitted(true);
        }
    };

    const handleBack = () => {
        setValidationError(null);

        // If at the first question of a repeated instance > 0, back should go to the last question of previous instance
        if (repeaterParent && repeaterParent.repeater?.childQuestionIds) {
            const childIds = repeaterParent.repeater.childQuestionIds;
            const currentChildIdx = childIds.indexOf(activeQuestion?.id || "");

            if (currentChildIdx === 0 && activeRepeaterTab > 0) {
                setActiveRepeaterTab((prev) => prev - 1);
                const lastChildId = childIds[childIds.length - 1];
                const lastChildVisibleIdx = visibleQuestions.findIndex((q) => q.id === lastChildId);
                if (lastChildVisibleIdx !== -1) {
                    setCurrentQuestionIndex(lastChildVisibleIdx);
                    return;
                }
            }
        }

        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
        }
    };

    const handleReset = () => {
        onResetAnswers();
        setCurrentQuestionIndex(0);
        setActiveRepeaterTab(0);
        setIsSubmitted(false);
        setValidationError(null);
        setActiveMasterQuestion(null);
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
            <div className="flex flex-col items-center justify-center p-6 text-center h-full space-y-4 bg-white dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-300">
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
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold text-xs h-8 gap-1.5 rounded-lg mt-2 shadow-xs"
                >
                    <RotateCcw className="h-3 w-3" />
                    {locale === "hi" ? "पुनः परीक्षण करें" : "Restart Preview"}
                </Button>
            </div>
        );
    }

    if (!activeQuestion) {
        return (
            <div className="p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-950 space-y-3">
                <p>No questions currently visible based on current logic branch.</p>
                <Button variant="outline" size="sm" onClick={handleReset} className="text-zinc-800 dark:text-zinc-200 text-xs rounded-lg">
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
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
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
                <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    <Layers className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0 mr-1" />
                    {Array.from({ length: repeatCount }).map((_, rIdx) => {
                        const tabLabel = itemLabelTemplate.replace("#{index}", String(rIdx + 1));
                        return (
                            <button
                                key={rIdx}
                                type="button"
                                onClick={() => setActiveRepeaterTab(rIdx)}
                                className={cn(
                                    "px-2.5 py-0.5 rounded text-[10px] font-semibold transition-colors shrink-0 cursor-pointer",
                                    activeRepeaterTab === rIdx
                                        ? "bg-purple-600 text-white font-bold shadow-2xs"
                                        : "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 hover:bg-purple-200"
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
                <div className="space-y-4 pb-4">
                    {/* Question Title & Badges */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700">
                                {questionNumBadge}
                            </span>
                            {repeaterParent && (
                                <Badge variant="outline" className="text-[9px] border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 px-1 py-0 gap-0.5">
                                    <Layers className="h-2.5 w-2.5" /> {itemLabelTemplate.replace("#{index}", String(activeRepeaterTab + 1))}
                                </Badge>
                            )}
                            {activeQuestion.validation?.required && (
                                <Badge variant="outline" className="text-[9px] border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 px-1 py-0 gap-0.5">
                                    <Asterisk className="h-2.5 w-2.5" /> Required
                                </Badge>
                            )}
                        </div>

                        <h3 className={cn("font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-snug", locale === "hi" && "font-hindi text-sm")}>
                            {titleText}
                        </h3>
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
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-200">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{validationError}</span>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Bottom Respondent Navigation Bar */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-850 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between gap-2 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={currentQuestionIndex === 0}
                    onClick={handleBack}
                    className="h-8 px-3 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-800 gap-1 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{locale === "hi" ? "पिछला" : "Back"}</span>
                </Button>

                <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 rounded-lg shadow-2xs cursor-pointer"
                >
                    <span>
                        {currentQuestionIndex === visibleQuestions.length - 1
                            ? locale === "hi" ? "जमा करें" : "Submit"
                            : locale === "hi" ? "आगे बढ़ें" : "Next"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
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
                            className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-transform active:scale-90"
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
                    <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                        Entering a number (e.g. 2) dynamically expands repeated plot sections in the next questions.
                    </p>
                </div>
            );

        case "Map":
            return (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 text-center">
                    <MapPin className="h-6 w-6 mx-auto text-zinc-700 dark:text-zinc-300" />
                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 block">
                        {value ? `${value.lat}, ${value.lng} (Accuracy: ±2.1m)` : "29.6857° N, 76.9905° E"}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => onChange({ lat: 29.685712, lng: 76.990521, accuracy: 2.1 })}
                        className="h-7 text-[10px] bg-zinc-900 text-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 rounded-lg"
                    >
                        Capture Current GPS Coordinates
                    </Button>
                </div>
            );

        default:
            return <PreviewText question={question} value={value} onChange={onChange} locale={locale} />;
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Stacked preview: every visible question one below the other (no paging).
// Used by the builder's phone frame; the paged PreviewRuntime stays for the
// full-screen Preview.
// ───────────────────────────────────────────────────────────────────────────
interface PreviewAllQuestionsProps {
    survey: SurveyModel;
    selectedQuestionId?: string | null;
    locale: string;
    runtimeAnswers: Record<string, any>;
    onChangeAnswer: (questionId: string, value: any) => void;
    onSelectQuestion?: (questionId: string) => void;
}

export function PreviewAllQuestions({
    survey,
    selectedQuestionId,
    locale,
    runtimeAnswers,
    onChangeAnswer,
    onSelectQuestion,
}: PreviewAllQuestionsProps) {
    const defaultLocale = survey.defaultLocale || "en";
    const childIds = useMemo(() => {
        const ids = new Set<string>();
        survey.questions.forEach((q) => (q.repeater?.isRepeater ? q.repeater.childQuestionIds || [] : []).forEach((id) => ids.add(id)));
        return ids;
    }, [survey.questions]);
    const topLevel = survey.questions.filter((q) => !childIds.has(q.id) && isQuestionVisible(q, runtimeAnswers));
    const title = (q: QuestionModel) => q.titles[locale] || q.titles[defaultLocale] || Object.values(q.titles)[0] || "";
    const hint = (q: QuestionModel) => q.descriptions?.[locale] || q.descriptions?.[defaultLocale] || "";

    // How many times a repeater block repeats: its own answer, another question's answer, or a fixed count.
    const repeatCount = (q: QuestionModel) => {
        const r = q.repeater!;
        if (r.countSourceType === "fixed") return Math.max(0, Number(r.fixedCount) || 0);
        const src = r.countQuestionId && r.countQuestionId !== q.id ? runtimeAnswers[r.countQuestionId] : runtimeAnswers[q.id];
        return Math.min(50, Math.max(0, Number(src) || 0));
    };
    const entryLabel = (q: QuestionModel, i: number) => (q.repeater?.itemLabelTemplate || "Entry #{index}").replace("#{index}", String(i + 1));

    const card = (q: QuestionModel, value: any, onChange: (v: any) => void, visibleAnswers: Record<string, any>, nested: boolean, children?: React.ReactNode) => (
        <div
            key={q.id}
            onClick={() => onSelectQuestion?.(q.id)}
            className={cn(
                "rounded-lg border p-3 space-y-2 cursor-pointer transition-colors",
                selectedQuestionId === q.id
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50/60 dark:bg-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400",
                nested && "bg-white dark:bg-zinc-950"
            )}
        >
            <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                    Q{q.displayIndex || q.number}
                </span>
                {q.validation?.required && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">* Required</span>}
            </div>
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{title(q) || <span className="italic text-zinc-400">Untitled question</span>}</p>
            {hint(q) && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint(q)}</p>}
            <div onClick={(e) => e.stopPropagation()}>{renderPreviewField(q, value, onChange, locale, () => {})}</div>
            {children}
        </div>
    );

    // A repeater: the count field, then one entry per count, each holding the block's questions with their own answers.
    const repeaterBlock = (q: QuestionModel) => {
        const children = (q.repeater?.childQuestionIds || [])
            .map((id) => survey.questions.find((x) => x.id === id))
            .filter(Boolean) as QuestionModel[];
        const count = repeatCount(q);
        const entries = Array.from({ length: count }, (_, i) => {
            // Answers scoped to this entry so conditional logic inside the block works per entry.
            const scoped: Record<string, any> = { ...runtimeAnswers };
            Object.keys(runtimeAnswers).forEach((k) => {
                if (k.endsWith(`_inst_${i}`)) scoped[k.replace(`_inst_${i}`, "")] = runtimeAnswers[k];
            });
            const visible = children.filter((c) => isQuestionVisible(c, scoped));
            return (
                <div key={`${q.id}_entry_${i}`} className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{entryLabel(q, i)}</div>
                    <div className="p-2 space-y-2">
                        {visible.length === 0 ? (
                            <p className="text-[11px] italic text-zinc-400">No questions in this block yet.</p>
                        ) : (
                            visible.map((c) => card(c, runtimeAnswers[`${c.id}_inst_${i}`], (v) => onChangeAnswer(`${c.id}_inst_${i}`, v), scoped, true))
                        )}
                    </div>
                </div>
            );
        });
        return card(q, runtimeAnswers[q.id], (v) => onChangeAnswer(q.id, v), runtimeAnswers, false, (
            <div className="space-y-2 pt-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                    {count === 0 ? "Enter a count above to add entries" : `${count} ${count === 1 ? "entry" : "entries"}`}
                </p>
                {entries}
            </div>
        ));
    };

    const block = (q: QuestionModel) =>
        q.repeater?.isRepeater ? repeaterBlock(q) : card(q, runtimeAnswers[q.id], (v) => onChangeAnswer(q.id, v), runtimeAnswers, false);

    return (
        <div className="h-full overflow-y-auto p-3 space-y-3 bg-white dark:bg-zinc-950">
            {topLevel.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-400">No questions yet.</p>
            ) : (
                topLevel.map((q) => block(q))
            )}
            {topLevel.length > 0 && (
                <Button type="button" size="sm" className="w-full h-9 text-xs font-semibold bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" disabled>
                    Submit
                </Button>
            )}
        </div>
    );
}
