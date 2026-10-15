"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Globe,
    Sparkles,
    Check,
    AlertCircle,
    Download,
    Search,
    Plus,
    CheckCircle2,
    List,
    ShieldCheck,
    RotateCcw,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LocaleDefinition, QuestionModel, SurveyModel, SurveyVersionSnapshot } from "../../types/survey-schema";
import { SurveyService } from "../../services/survey-service";
import { TranslationService } from "../../services/translation-service";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";

interface SurveyTranslationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey: SurveyModel;
    versionSnapshot?: SurveyVersionSnapshot | null;
    onSaveTranslations?: (localeCode: string, translationData: any) => Promise<void> | void;
    onOpenLanguageManager?: () => void;
}

interface QuestionDraftState {
    title: string;
    hint: string;
    placeholder: string;
    customErrorMessage: string;
    patternErrorMessage: string;
    minMaxErrorMessage: string;
    lengthErrorMessage: string;
    dateRangeErrorMessage: string;
    selectionCountErrorMessage: string;
}

export function SurveyTranslationDialog({
    open,
    onOpenChange,
    survey,
    versionSnapshot,
    onSaveTranslations,
    onOpenLanguageManager,
}: SurveyTranslationDialogProps) {
    // Target survey object (either the specific historical snapshot or the current active model)
    const targetSurvey = versionSnapshot ? versionSnapshot.surveySnapshot : survey;
    const versionTag = versionSnapshot ? versionSnapshot.versionTag : survey.versionTag;

    const defaultLocale = targetSurvey.defaultLocale || "en";
    const locales = targetSurvey.locales || [{ code: "en", label: "English", isDefault: true }];
    const nonDefaultLocales = locales.filter((l) => l.code !== defaultLocale);

    // Active selected target language
    const [selectedLocale, setSelectedLocale] = useState<string>(
        nonDefaultLocales.length > 0 ? nonDefaultLocales[0].code : "hi"
    );

    // Keep selectedLocale valid when survey locales change (e.g. after Language Manager adds/removes a language)
    useEffect(() => {
        if (locales.length > 0 && !locales.some((l) => l.code === selectedLocale)) {
            const firstNonDefault = nonDefaultLocales[0]?.code;
            const fallback = firstNonDefault || locales[0]?.code || "en";
            setSelectedLocale(fallback);
        }
    }, [locales, nonDefaultLocales, selectedLocale]);

    // Draft local translation state
    const [draftSurveyName, setDraftSurveyName] = useState("");
    const [draftSurveyDesc, setDraftSurveyDesc] = useState("");
    const [draftQuestions, setDraftQuestions] = useState<Record<string, QuestionDraftState>>({});
    const [draftChoices, setDraftChoices] = useState<Record<string, string>>({});

    const [filterCategory, setFilterCategory] = useState<"all" | "missing" | "choices" | "validation">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isAutoTranslating, setIsAutoTranslating] = useState(false);
    const [translatingQId, setTranslatingQId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initialize local translation state whenever targetSurvey or selectedLocale changes
    useEffect(() => {
        if (!open) return;

        setDraftSurveyName(targetSurvey.name || "");
        setDraftSurveyDesc(targetSurvey.description || "");

        const qMap: Record<string, QuestionDraftState> = {};
        targetSurvey.questions.forEach((q) => {
            const locError =
                typeof q.validation?.customErrorMessage === "object" && q.validation?.customErrorMessage !== null
                    ? q.validation.customErrorMessage[selectedLocale] || ""
                    : selectedLocale === defaultLocale && typeof q.validation?.customErrorMessage === "string"
                    ? q.validation.customErrorMessage
                    : "";

            qMap[q.id] = {
                title: q.titles[selectedLocale] || "",
                hint: q.descriptions?.[selectedLocale] || "",
                placeholder: q.placeholders?.[selectedLocale] || "",
                customErrorMessage: locError,
                patternErrorMessage: q.validation?.patternErrorMessage?.[selectedLocale] || "",
                minMaxErrorMessage: q.validation?.minMaxErrorMessage?.[selectedLocale] || "",
                lengthErrorMessage: q.validation?.lengthErrorMessage?.[selectedLocale] || "",
                dateRangeErrorMessage: q.validation?.dateRangeErrorMessage?.[selectedLocale] || "",
                selectionCountErrorMessage: q.validation?.selectionCountErrorMessage?.[selectedLocale] || "",
            };
        });
        setDraftQuestions(qMap);

        const cMap: Record<string, string> = {};
        targetSurvey.questions.forEach((q) => {
            q.options?.forEach((opt) => {
                cMap[opt.id] = opt.labels[selectedLocale] || "";
            });
        });
        setDraftChoices(cMap);
        setSuccessMessage(null);
    }, [open, targetSurvey, selectedLocale, defaultLocale]);

    // Calculate dynamic completeness
    const completeness = useMemo(() => {
        let total = 0;
        let filled = 0;

        targetSurvey.questions.forEach((q) => {
            // Prompt title
            total += 1;
            if (draftQuestions[q.id]?.title?.trim()) filled += 1;

            // Hint / Description
            if (q.descriptions?.[defaultLocale] || q.descriptions?.en) {
                total += 1;
                if (draftQuestions[q.id]?.hint?.trim()) filled += 1;
            }

            // Placeholder
            if (q.placeholders?.[defaultLocale] || q.placeholders?.en) {
                total += 1;
                if (draftQuestions[q.id]?.placeholder?.trim()) filled += 1;
            }

            // Choices
            q.options?.forEach((opt) => {
                total += 1;
                if (draftChoices[opt.id]?.trim()) filled += 1;
            });

            // Validation Error: Mandatory
            if (q.validation?.required || Boolean(q.validation?.customErrorMessage)) {
                total += 1;
                if (draftQuestions[q.id]?.customErrorMessage?.trim()) filled += 1;
            }

            // Validation Error: Pattern
            if (q.validation?.regexPattern || q.validation?.validationPresetId) {
                total += 1;
                if (draftQuestions[q.id]?.patternErrorMessage?.trim()) filled += 1;
            }

            // Validation Error: Min/Max Value
            if (q.validation?.minValue !== undefined || q.validation?.maxValue !== undefined) {
                total += 1;
                if (draftQuestions[q.id]?.minMaxErrorMessage?.trim()) filled += 1;
            }

            // Validation Error: Character Length
            if (q.validation?.minChar !== undefined || q.validation?.maxChar !== undefined) {
                total += 1;
                if (draftQuestions[q.id]?.lengthErrorMessage?.trim()) filled += 1;
            }

            // Validation Error: Date Range
            if (q.type === "DateRange" || q.validation?.minDate || q.validation?.maxDate) {
                total += 1;
                if (draftQuestions[q.id]?.dateRangeErrorMessage?.trim()) filled += 1;
            }

            // Validation Error: Multi-Select Count
            if (q.validation?.minSelections !== undefined || q.validation?.maxSelections !== undefined) {
                total += 1;
                if (draftQuestions[q.id]?.selectionCountErrorMessage?.trim()) filled += 1;
            }
        });

        const pct = total > 0 ? Math.round((filled / total) * 100) : 100;
        const missing = Math.max(0, total - filled);
        return { total, filled, missing, percentage: pct };
    }, [targetSurvey, draftQuestions, draftChoices, defaultLocale]);

    // Handle Auto-Translate Single Question
    const handleAutoTranslateQuestion = async (qId: string) => {
        const q = targetSurvey.questions.find((item) => item.id === qId);
        if (!q) return;

        setTranslatingQId(qId);
        setSuccessMessage(null);
        try {
            const textsToTranslate: { field: string; text: string; optId?: string }[] = [];

            // Title
            const enTitle = q.titles[defaultLocale] || q.titles.en || "";
            if (enTitle) textsToTranslate.push({ field: "title", text: enTitle });

            // Hint
            const enHint = q.descriptions?.[defaultLocale] || q.descriptions?.en || "";
            if (enHint) textsToTranslate.push({ field: "hint", text: enHint });

            // Placeholder
            const enPlaceholder = q.placeholders?.[defaultLocale] || q.placeholders?.en || "";
            if (enPlaceholder) textsToTranslate.push({ field: "placeholder", text: enPlaceholder });

            // Choices
            q.options?.forEach((opt) => {
                const enOpt = opt.labels[defaultLocale] || opt.labels.en || opt.value;
                if (enOpt) textsToTranslate.push({ field: "choice", text: enOpt, optId: opt.id });
            });

            // Mandatory Error
            if (q.validation?.required || Boolean(q.validation?.customErrorMessage)) {
                const enErr =
                    typeof q.validation?.customErrorMessage === "string"
                        ? q.validation.customErrorMessage
                        : q.validation?.customErrorMessage?.[defaultLocale] || "This question is required to proceed.";
                textsToTranslate.push({ field: "customErrorMessage", text: enErr });
            }

            // Pattern Error
            if (q.validation?.regexPattern || q.validation?.validationPresetId) {
                const enPattern =
                    q.validation?.patternErrorMessage?.[defaultLocale] || "Value does not match the required format.";
                textsToTranslate.push({ field: "patternErrorMessage", text: enPattern });
            }

            // Min/Max Error
            if (q.validation?.minValue !== undefined || q.validation?.maxValue !== undefined) {
                const enMinMax =
                    q.validation?.minMaxErrorMessage?.[defaultLocale] ||
                    `Value must be between ${q.validation?.minValue ?? "min"} and ${q.validation?.maxValue ?? "max"}.`;
                textsToTranslate.push({ field: "minMaxErrorMessage", text: enMinMax });
            }

            // Length Error
            if (q.validation?.minChar !== undefined || q.validation?.maxChar !== undefined) {
                const enLen =
                    q.validation?.lengthErrorMessage?.[defaultLocale] ||
                    `Length must be between ${q.validation?.minChar ?? 0} and ${q.validation?.maxChar ?? "max"} characters.`;
                textsToTranslate.push({ field: "lengthErrorMessage", text: enLen });
            }

            // Date Range Error
            if (q.type === "DateRange" || q.validation?.minDate || q.validation?.maxDate) {
                const enDate =
                    q.validation?.dateRangeErrorMessage?.[defaultLocale] || "Selected date is outside the allowed range.";
                textsToTranslate.push({ field: "dateRangeErrorMessage", text: enDate });
            }

            // Selection Count Error
            if (q.validation?.minSelections !== undefined || q.validation?.maxSelections !== undefined) {
                const enSel =
                    q.validation?.selectionCountErrorMessage?.[defaultLocale] ||
                    `Please select between ${q.validation?.minSelections ?? 1} and ${q.validation?.maxSelections ?? "all"} options.`;
                textsToTranslate.push({ field: "selectionCountErrorMessage", text: enSel });
            }

            if (textsToTranslate.length === 0) return;

            const translatedResults = await SurveyService.translateTexts(
                defaultLocale,
                selectedLocale,
                textsToTranslate.map((t) => t.text)
            );

            const updatedQState: QuestionDraftState = { ...(draftQuestions[qId] || {
                title: "",
                hint: "",
                placeholder: "",
                customErrorMessage: "",
                patternErrorMessage: "",
                minMaxErrorMessage: "",
                lengthErrorMessage: "",
                dateRangeErrorMessage: "",
                selectionCountErrorMessage: "",
            }) };

            const updatedChoices = { ...draftChoices };

            textsToTranslate.forEach((item, idx) => {
                const trans = translatedResults[idx] || item.text;
                if (item.field === "choice" && item.optId) {
                    updatedChoices[item.optId] = trans;
                } else {
                    (updatedQState as any)[item.field] = trans;
                }
            });

            setDraftQuestions((prev) => ({ ...prev, [qId]: updatedQState }));
            setDraftChoices(updatedChoices);
            setSuccessMessage(`Auto-translated Question Q${q.displayIndex || q.number} to ${selectedLocale.toUpperCase()}.`);
        } catch (err) {
            console.error("Translate single question error:", err);
        } finally {
            setTranslatingQId(null);
        }
    };

    // Handle Auto-Translate Missing (Global for active locale)
    const handleAutoTranslate = async () => {
        setIsAutoTranslating(true);
        setSuccessMessage(null);
        try {
            const missingItems: { qId: string; field: string; text: string; optId?: string }[] = [];

            targetSurvey.questions.forEach((q) => {
                const qState = draftQuestions[q.id];

                // Title
                const enTitle = q.titles[defaultLocale] || q.titles.en || "";
                if (!qState?.title?.trim() && enTitle) {
                    missingItems.push({ qId: q.id, field: "title", text: enTitle });
                }

                // Hint
                const enHint = q.descriptions?.[defaultLocale] || q.descriptions?.en || "";
                if (enHint && !qState?.hint?.trim()) {
                    missingItems.push({ qId: q.id, field: "hint", text: enHint });
                }

                // Placeholder
                const enPlaceholder = q.placeholders?.[defaultLocale] || q.placeholders?.en || "";
                if (enPlaceholder && !qState?.placeholder?.trim()) {
                    missingItems.push({ qId: q.id, field: "placeholder", text: enPlaceholder });
                }

                // Choices
                q.options?.forEach((opt) => {
                    const current = draftChoices[opt.id]?.trim();
                    const en = opt.labels[defaultLocale] || opt.labels.en || opt.value;
                    if (!current && en) {
                        missingItems.push({ qId: q.id, field: "choice", text: en, optId: opt.id });
                    }
                });

                // Mandatory Error
                if ((q.validation?.required || Boolean(q.validation?.customErrorMessage)) && !qState?.customErrorMessage?.trim()) {
                    const en =
                        typeof q.validation?.customErrorMessage === "string"
                            ? q.validation.customErrorMessage
                            : q.validation?.customErrorMessage?.[defaultLocale] || "This question is required to proceed.";
                    if (en) missingItems.push({ qId: q.id, field: "customErrorMessage", text: en });
                }

                // Pattern Error
                if ((q.validation?.regexPattern || q.validation?.validationPresetId) && !qState?.patternErrorMessage?.trim()) {
                    const en = q.validation?.patternErrorMessage?.[defaultLocale] || "Value does not match the required format.";
                    missingItems.push({ qId: q.id, field: "patternErrorMessage", text: en });
                }

                // Min/Max Error
                if ((q.validation?.minValue !== undefined || q.validation?.maxValue !== undefined) && !qState?.minMaxErrorMessage?.trim()) {
                    const en =
                        q.validation?.minMaxErrorMessage?.[defaultLocale] ||
                        `Value must be between ${q.validation?.minValue ?? "min"} and ${q.validation?.maxValue ?? "max"}.`;
                    missingItems.push({ qId: q.id, field: "minMaxErrorMessage", text: en });
                }

                // Length Error
                if ((q.validation?.minChar !== undefined || q.validation?.maxChar !== undefined) && !qState?.lengthErrorMessage?.trim()) {
                    const en =
                        q.validation?.lengthErrorMessage?.[defaultLocale] ||
                        `Length must be between ${q.validation?.minChar ?? 0} and ${q.validation?.maxChar ?? "max"} characters.`;
                    missingItems.push({ qId: q.id, field: "lengthErrorMessage", text: en });
                }

                // Date Range Error
                if ((q.type === "DateRange" || q.validation?.minDate || q.validation?.maxDate) && !qState?.dateRangeErrorMessage?.trim()) {
                    const en = q.validation?.dateRangeErrorMessage?.[defaultLocale] || "Selected date is outside the allowed range.";
                    missingItems.push({ qId: q.id, field: "dateRangeErrorMessage", text: en });
                }

                // Selection Count Error
                if ((q.validation?.minSelections !== undefined || q.validation?.maxSelections !== undefined) && !qState?.selectionCountErrorMessage?.trim()) {
                    const en =
                        q.validation?.selectionCountErrorMessage?.[defaultLocale] ||
                        `Please select between ${q.validation?.minSelections ?? 1} and ${q.validation?.maxSelections ?? "all"} options.`;
                    missingItems.push({ qId: q.id, field: "selectionCountErrorMessage", text: en });
                }
            });

            if (missingItems.length === 0) {
                setSuccessMessage("All translatable items already have values.");
                return;
            }

            const translatedResults = await SurveyService.translateTexts(
                defaultLocale,
                selectedLocale,
                missingItems.map((m) => m.text)
            );

            const updatedQMap = { ...draftQuestions };
            const updatedChoices = { ...draftChoices };

            missingItems.forEach((item, idx) => {
                const trans = translatedResults[idx] || item.text;
                if (item.field === "choice" && item.optId) {
                    updatedChoices[item.optId] = trans;
                } else {
                    updatedQMap[item.qId] = {
                        ...(updatedQMap[item.qId] || {
                            title: "",
                            hint: "",
                            placeholder: "",
                            customErrorMessage: "",
                            patternErrorMessage: "",
                            minMaxErrorMessage: "",
                            lengthErrorMessage: "",
                            dateRangeErrorMessage: "",
                            selectionCountErrorMessage: "",
                        }),
                        [item.field]: trans,
                    };
                }
            });

            setDraftQuestions(updatedQMap);
            setDraftChoices(updatedChoices);
            setSuccessMessage(`Successfully auto-translated ${missingItems.length} missing fields for ${selectedLocale.toUpperCase()}.`);
        } catch (err: any) {
            console.error("Auto-translate error:", err);
        } finally {
            setIsAutoTranslating(false);
        }
    };

    // Handle Save
    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMessage(null);
        try {
            const payload = {
                surveyName: draftSurveyName,
                surveyDesc: draftSurveyDesc,
                questions: draftQuestions,
                choices: draftChoices,
            };

            await SurveyService.saveVersionTranslations(
                targetSurvey.id,
                targetSurvey.version,
                selectedLocale,
                payload
            );

            if (onSaveTranslations) {
                await onSaveTranslations(selectedLocale, payload);
            }

            setSuccessMessage(`Translations for ${selectedLocale.toUpperCase()} saved successfully.`);
            setTimeout(() => {
                onOpenChange(false);
            }, 600);
        } catch (err: any) {
            console.error("Save translation error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Export Translation JSON
    const handleExportJSON = () => {
        const targetLocaleName = locales.find((l) => l.code === selectedLocale)?.label || selectedLocale.toUpperCase();
        const resource = TranslationService.createModularTranslationResource(
            targetSurvey,
            selectedLocale,
            targetLocaleName,
            {
                questions: draftQuestions,
                choices: draftChoices,
            }
        );

        const blob = new Blob([JSON.stringify(resource, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${targetSurvey.name.toLowerCase().replace(/\s+/g, "_")}_${selectedLocale}_${versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filtered Question Items
    const filteredQuestions = useMemo(() => {
        return targetSurvey.questions.filter((q) => {
            const enTitle = q.titles[defaultLocale] || q.titles.en || "";
            const currentTrans = draftQuestions[q.id]?.title || "";

            if (searchQuery) {
                const qMatches =
                    enTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    currentTrans.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.columnName.toLowerCase().includes(searchQuery.toLowerCase());
                if (!qMatches) return false;
            }

            if (filterCategory === "missing") {
                const qState = draftQuestions[q.id];
                const isQMissing = !qState?.title?.trim();
                const areChoicesMissing = q.options?.some((opt) => !draftChoices[opt.id]?.trim());
                const isErrorMissing =
                    ((q.validation?.required || Boolean(q.validation?.customErrorMessage)) && !qState?.customErrorMessage?.trim()) ||
                    ((q.validation?.regexPattern || q.validation?.validationPresetId) && !qState?.patternErrorMessage?.trim()) ||
                    ((q.validation?.minValue !== undefined || q.validation?.maxValue !== undefined) && !qState?.minMaxErrorMessage?.trim()) ||
                    ((q.validation?.minChar !== undefined || q.validation?.maxChar !== undefined) && !qState?.lengthErrorMessage?.trim());
                return isQMissing || areChoicesMissing || isErrorMissing;
            }

            if (filterCategory === "choices") {
                return Boolean(q.options && q.options.length > 0);
            }

            if (filterCategory === "validation") {
                return Boolean(
                    q.validation?.required ||
                    q.validation?.customErrorMessage ||
                    q.validation?.regexPattern ||
                    q.validation?.validationPresetId ||
                    q.validation?.minValue !== undefined ||
                    q.validation?.maxValue !== undefined ||
                    q.validation?.minChar !== undefined ||
                    q.validation?.maxChar !== undefined ||
                    q.type === "DateRange"
                );
            }

            return true;
        });
    }, [targetSurvey.questions, defaultLocale, draftQuestions, draftChoices, searchQuery, filterCategory]);

    const activeLocaleLabel = locales.find((l) => l.code === selectedLocale)?.label || selectedLocale.toUpperCase();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{
                    width: "95vw",
                    maxWidth: "1160px",
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                }}
                className="!w-[95vw] !max-w-[1160px] !max-h-[90vh] !p-0 !gap-0 !flex !flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden rounded-2xl"
            >
                {/* Header */}
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0 space-y-3.5">
                    {/* Row 1: Title and Description */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                                <Globe className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                                        Survey Translations Workspace · {targetSurvey.name}
                                    </DialogTitle>
                                    <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                        {versionTag}
                                    </Badge>
                                </div>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                    Single unified section for localized prompts, hints, choice options, and validation error messages for {versionTag}.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Language Selector on Left, Actions on Right */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex-wrap">
                        {/* Language Selector Dropdown (Left, no 'Target Language:' text) */}
                        <div className="flex items-center gap-2">
                            <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 min-w-[180px] shadow-2xs font-medium">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    {locales.map((loc) => (
                                        <SelectItem key={loc.code} value={loc.code} className="text-xs font-medium">
                                            {loc.label} {loc.isDefault ? "(Primary)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Action Buttons (Right) */}
                        <div className="flex items-center gap-2 shrink-0">
                            {onOpenLanguageManager && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onOpenLanguageManager}
                                    className="h-9 px-3 text-xs gap-1.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg shadow-2xs cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Manage Languages</span>
                                </Button>
                            )}

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleAutoTranslate}
                                disabled={isAutoTranslating || selectedLocale === defaultLocale}
                                className="h-9 px-3.5 text-xs gap-1.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-semibold rounded-lg shadow-2xs cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                {isAutoTranslating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600 dark:text-zinc-400" />
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                )}
                                <span>{isAutoTranslating ? "Translating..." : "Auto-Translate Missing"}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Progress Bar & Filter Toolbar */}
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0 max-w-md">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-zinc-500">{completeness.filled} of {completeness.total} strings translated ({activeLocaleLabel})</span>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{completeness.percentage}%</span>
                                </div>
                                <Progress value={completeness.percentage} className="h-1.5 bg-zinc-200 dark:bg-zinc-800" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Filter Chips */}
                            <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory("all")}
                                    className={cn(
                                        "px-2.5 py-1 text-[11px] rounded-md font-semibold transition-all cursor-pointer",
                                        filterCategory === "all"
                                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                                    )}
                                >
                                    All ({targetSurvey.questions.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory("missing")}
                                    className={cn(
                                        "px-2.5 py-1 text-[11px] rounded-md font-semibold transition-all cursor-pointer",
                                        filterCategory === "missing"
                                            ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 shadow-2xs"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                                    )}
                                >
                                    Missing ({completeness.missing})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory("choices")}
                                    className={cn(
                                        "px-2.5 py-1 text-[11px] rounded-md font-semibold transition-all cursor-pointer",
                                        filterCategory === "choices"
                                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                                    )}
                                >
                                    Choices
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory("validation")}
                                    className={cn(
                                        "px-2.5 py-1 text-[11px] rounded-md font-semibold transition-all cursor-pointer",
                                        filterCategory === "validation"
                                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                                    )}
                                >
                                    Errors
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative w-44">
                                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                                <Input
                                    placeholder="Filter questions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Main Scrollable Content: 2-Column Source vs Translation */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 w-full bg-zinc-50/40 dark:bg-zinc-950/40">
                    {successMessage && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Column Headers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-1 text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">
                        <div>Original Source Language ({defaultLocale.toUpperCase()})</div>
                        <div>Target Translation ({selectedLocale.toUpperCase()} - {activeLocaleLabel})</div>
                    </div>

                    {filteredQuestions.length === 0 ? (
                        <div className="py-12 text-center text-zinc-400 text-xs space-y-1">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No items match current filter</p>
                            <p className="text-[11px] text-zinc-500">All translatable items have been translated for {activeLocaleLabel}.</p>
                        </div>
                    ) : (
                        filteredQuestions.map((q) => {
                            const enTitle = q.titles[defaultLocale] || q.titles.en || `Question ${q.number}`;
                            const enHint = q.descriptions?.[defaultLocale] || q.descriptions?.en || "";
                            const enPlaceholder = q.placeholders?.[defaultLocale] || q.placeholders?.en || "";
                            const qState = draftQuestions[q.id] || {
                                title: "",
                                hint: "",
                                placeholder: "",
                                customErrorMessage: "",
                                patternErrorMessage: "",
                                minMaxErrorMessage: "",
                                lengthErrorMessage: "",
                                dateRangeErrorMessage: "",
                                selectionCountErrorMessage: "",
                            };

                            const isTitleTranslated = Boolean(qState.title?.trim());
                            const hasRequired = Boolean(q.validation?.required || q.validation?.customErrorMessage);
                            const hasPattern = Boolean(q.validation?.regexPattern || q.validation?.validationPresetId);
                            const hasMinMax = Boolean(q.validation?.minValue !== undefined || q.validation?.maxValue !== undefined);
                            const hasLength = Boolean(q.validation?.minChar !== undefined || q.validation?.maxChar !== undefined);
                            const hasDate = Boolean(q.type === "DateRange" || q.validation?.minDate || q.validation?.maxDate);
                            const hasSelection = Boolean(q.validation?.minSelections !== undefined || q.validation?.maxSelections !== undefined);

                            const isErrorTranslated =
                                (!hasRequired || Boolean(qState.customErrorMessage?.trim())) &&
                                (!hasPattern || Boolean(qState.patternErrorMessage?.trim())) &&
                                (!hasMinMax || Boolean(qState.minMaxErrorMessage?.trim())) &&
                                (!hasLength || Boolean(qState.lengthErrorMessage?.trim())) &&
                                (!hasDate || Boolean(qState.dateRangeErrorMessage?.trim())) &&
                                (!hasSelection || Boolean(qState.selectionCountErrorMessage?.trim()));

                            const areChoicesTranslated = !q.options || q.options.every((opt) => Boolean(draftChoices[opt.id]?.trim()));
                            const isFullyTranslated = isTitleTranslated && isErrorTranslated && areChoicesTranslated;
                            const isTranslatingThisQ = translatingQId === q.id;

                            const typeDescriptor = QUESTION_TYPE_REGISTRY[q.type];

                            return (
                                <div
                                    key={q.id}
                                    className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                                >
                                    {/* Question Header with Type badge and Per-Question Auto-Translate button */}
                                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                                Q{q.displayIndex || q.number}
                                            </Badge>
                                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                {typeDescriptor?.displayName || q.type}
                                            </span>
                                            <span className="font-mono text-[11px] text-zinc-400">
                                                • {q.columnName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {selectedLocale !== defaultLocale && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isTranslatingThisQ || isAutoTranslating}
                                                    onClick={() => handleAutoTranslateQuestion(q.id)}
                                                    className="h-7 text-xs gap-1.5 px-2.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-semibold cursor-pointer rounded-lg shadow-2xs"
                                                >
                                                    {isTranslatingThisQ ? (
                                                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                                                    ) : (
                                                        <RotateCcw className="h-3 w-3 text-zinc-500" />
                                                    )}
                                                    <span>{isTranslatingThisQ ? "Translating..." : "Auto-Translate Q"}</span>
                                                </Button>
                                            )}

                                            {isFullyTranslated ? (
                                                <Badge className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold gap-1">
                                                    <Check className="h-3 w-3" /> Translated
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold">
                                                    Missing
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* 1. Question Prompt Translation */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                            Question Prompt
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 font-medium min-h-[38px] flex items-center">
                                                {enTitle}
                                            </div>

                                            <Input
                                                placeholder={`Enter question prompt in ${activeLocaleLabel}...`}
                                                value={qState.title || ""}
                                                onChange={(e) =>
                                                    setDraftQuestions({
                                                        ...draftQuestions,
                                                        [q.id]: {
                                                            ...qState,
                                                            title: e.target.value,
                                                        },
                                                    })
                                                }
                                                className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                            />
                                        </div>
                                    </div>

                                    {/* 2. Hint / Description Translation (if exists) */}
                                    {(enHint || qState.hint) && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                                Hint / Helper Description
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-normal min-h-[38px] flex items-center">
                                                    {enHint || <span className="italic text-zinc-400">None</span>}
                                                </div>

                                                <Input
                                                    placeholder={`Enter hint in ${activeLocaleLabel}...`}
                                                    value={qState.hint || ""}
                                                    onChange={(e) =>
                                                        setDraftQuestions({
                                                            ...draftQuestions,
                                                            [q.id]: {
                                                                ...qState,
                                                                hint: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Placeholder Translation (if exists) */}
                                    {(enPlaceholder || qState.placeholder) && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                                Input Placeholder
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-normal min-h-[38px] flex items-center font-mono">
                                                    {enPlaceholder || <span className="italic text-zinc-400">None</span>}
                                                </div>

                                                <Input
                                                    placeholder={`Enter placeholder in ${activeLocaleLabel}...`}
                                                    value={qState.placeholder || ""}
                                                    onChange={(e) =>
                                                        setDraftQuestions({
                                                            ...draftQuestions,
                                                            [q.id]: {
                                                                ...qState,
                                                                placeholder: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Choice Options Translations (if choice question) */}
                                    {q.options && q.options.length > 0 && (
                                        <div className="pt-2.5 mt-1 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <List className="h-3.5 w-3.5 text-zinc-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block font-mono">
                                                    Option Choices ({q.options.length})
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {q.options.map((opt) => {
                                                    const enOpt = opt.labels[defaultLocale] || opt.labels.en || opt.value;
                                                    return (
                                                        <div key={opt.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                            <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                {enOpt} <span className="text-[10px] text-zinc-400 font-mono">({opt.value})</span>
                                                            </div>
                                                            <Input
                                                                placeholder={`Translate choice '${enOpt}'...`}
                                                                value={draftChoices[opt.id] || ""}
                                                                onChange={(e) =>
                                                                    setDraftChoices({
                                                                        ...draftChoices,
                                                                        [opt.id]: e.target.value,
                                                                    })
                                                                }
                                                                className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 5. Validation Error Messages Translations */}
                                    {(hasRequired || hasPattern || hasMinMax || hasLength || hasDate || hasSelection) && (
                                        <div className="pt-2.5 mt-1 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block font-mono">
                                                    Validation Error Messages ({activeLocaleLabel})
                                                </span>
                                            </div>

                                            <div className="space-y-2.5">
                                                {/* Mandatory Error */}
                                                {hasRequired && (() => {
                                                    const enErrMsg =
                                                        typeof q.validation?.customErrorMessage === "string"
                                                            ? q.validation.customErrorMessage
                                                            : q.validation?.customErrorMessage?.[defaultLocale] ||
                                                              "This question is required to proceed.";

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Mandatory Response Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate mandatory error in ${activeLocaleLabel}...`}
                                                                    value={qState.customErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                customErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Pattern / Regex Error */}
                                                {hasPattern && (() => {
                                                    const enErrMsg =
                                                        q.validation?.patternErrorMessage?.[defaultLocale] ||
                                                        "Value does not match the required format.";

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Format / Regex Pattern Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate format error in ${activeLocaleLabel}...`}
                                                                    value={qState.patternErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                patternErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Numeric Min/Max Range Error */}
                                                {hasMinMax && (() => {
                                                    const enErrMsg =
                                                        q.validation?.minMaxErrorMessage?.[defaultLocale] ||
                                                        `Value must be between ${q.validation?.minValue ?? "min"} and ${q.validation?.maxValue ?? "max"}.`;

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Numeric Range Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate number range error in ${activeLocaleLabel}...`}
                                                                    value={qState.minMaxErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                minMaxErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Character Length Error */}
                                                {hasLength && (() => {
                                                    const enErrMsg =
                                                        q.validation?.lengthErrorMessage?.[defaultLocale] ||
                                                        `Length must be between ${q.validation?.minChar ?? 0} and ${q.validation?.maxChar ?? "max"} characters.`;

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Character Length Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate character length error in ${activeLocaleLabel}...`}
                                                                    value={qState.lengthErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                lengthErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Date Range Error */}
                                                {hasDate && (() => {
                                                    const enErrMsg =
                                                        q.validation?.dateRangeErrorMessage?.[defaultLocale] ||
                                                        "Selected date is outside the allowed range.";

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Date Range Boundary Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate date error in ${activeLocaleLabel}...`}
                                                                    value={qState.dateRangeErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                dateRangeErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Selection Count Error */}
                                                {hasSelection && (() => {
                                                    const enErrMsg =
                                                        q.validation?.selectionCountErrorMessage?.[defaultLocale] ||
                                                        `Please select between ${q.validation?.minSelections ?? 1} and ${q.validation?.maxSelections ?? "all"} options.`;

                                                    return (
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-zinc-500 block">
                                                                Multi-Select Options Count Error
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 font-medium border border-zinc-200/60 dark:border-zinc-800">
                                                                    {enErrMsg}
                                                                </div>
                                                                <Input
                                                                    placeholder={`Translate selection count error in ${activeLocaleLabel}...`}
                                                                    value={qState.selectionCountErrorMessage || ""}
                                                                    onChange={(e) =>
                                                                        setDraftQuestions({
                                                                            ...draftQuestions,
                                                                            [q.id]: {
                                                                                ...qState,
                                                                                selectionCountErrorMessage: e.target.value,
                                                                            },
                                                                        })
                                                                    }
                                                                    className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-between sm:justify-between gap-3 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportJSON}
                        className="h-9 px-4 text-xs font-semibold rounded-lg gap-1.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs"
                    >
                        <Download className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Download {selectedLocale.toUpperCase()} JSON</span>
                    </Button>

                    <div className="flex items-center gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-9 px-4 text-xs font-semibold rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold h-9 px-5 text-xs rounded-lg shadow-md gap-1.5 cursor-pointer"
                        >
                            {isSaving ? "Saving..." : `Save ${selectedLocale.toUpperCase()} Translations`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
