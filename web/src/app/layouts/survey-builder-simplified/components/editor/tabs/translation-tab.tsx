"use client";

import React, { useState } from "react";
import {
    Globe,
    Plus,
    Sparkles,
    RotateCcw,
    Languages,
    Loader2,
    ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocaleDefinition, QuestionModel, SurveyModel } from "../../../types/survey-schema";
import { SurveyService } from "../../../services/survey-service";

interface TranslationTabProps {
    question: QuestionModel;
    survey?: SurveyModel;
    locales: LocaleDefinition[];
    onChangeQuestion: (updated: QuestionModel) => void;
    onOpenLanguageManager?: () => void;
    isPublished?: boolean;
}

export function TranslationTab({
    question,
    survey,
    locales,
    onChangeQuestion,
    onOpenLanguageManager,
    isPublished,
}: TranslationTabProps) {
    const defaultLangCode = survey?.defaultLocale || "en";

    // Active tab state: "all" or specific locale code (e.g. "en", "hi", "pa")
    const [activeLocaleTab, setActiveLocaleTab] = useState<string>("all");

    // Translation loading states
    const [translatingLangs, setTranslatingLangs] = useState<Record<string, boolean>>({});
    const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);

    // Question-level base English texts
    const defaultTitle = question.titles[defaultLangCode] || Object.values(question.titles)[0] || "";
    const defaultHint = question.descriptions?.[defaultLangCode] || "";
    const defaultPlaceholder = question.placeholders?.[defaultLangCode] || "";

    const defaultRequiredMsg =
        typeof question.validation?.customErrorMessage === "string"
            ? question.validation.customErrorMessage
            : question.validation?.customErrorMessage?.[defaultLangCode] ||
              (question.validation?.required ? "This question is required to proceed." : "");

    const defaultMinMaxMsg = question.validation?.minMaxErrorMessage?.[defaultLangCode] || "";
    const defaultLengthMsg = question.validation?.lengthErrorMessage?.[defaultLangCode] || "";
    const defaultPatternMsg = question.validation?.patternErrorMessage?.[defaultLangCode] || "";
    const defaultDateMsg = question.validation?.dateRangeErrorMessage?.[defaultLangCode] || "";
    const defaultSelectionMsg = question.validation?.selectionCountErrorMessage?.[defaultLangCode] || "";

    const handleTitleChange = (localeCode: string, val: string) => {
        const updatedQuestion: QuestionModel = {
            ...question,
            titles: { ...question.titles, [localeCode]: val },
            translationsMeta: {
                ...(question.translationsMeta || {}),
                [localeCode]: { status: "manual", translatedAt: new Date().toISOString() },
            },
        };
        onChangeQuestion(updatedQuestion);
    };

    const handleHintChange = (localeCode: string, val: string) => {
        const updatedQuestion: QuestionModel = {
            ...question,
            descriptions: { ...(question.descriptions || {}), [localeCode]: val },
            translationsMeta: {
                ...(question.translationsMeta || {}),
                [localeCode]: { status: "manual", translatedAt: new Date().toISOString() },
            },
        };
        onChangeQuestion(updatedQuestion);
    };

    const handlePlaceholderChange = (localeCode: string, val: string) => {
        const updatedQuestion: QuestionModel = {
            ...question,
            placeholders: { ...(question.placeholders || {}), [localeCode]: val },
            translationsMeta: {
                ...(question.translationsMeta || {}),
                [localeCode]: { status: "manual", translatedAt: new Date().toISOString() },
            },
        };
        onChangeQuestion(updatedQuestion);
    };

    const handleValidationMessageChange = (
        field: "customErrorMessage" | "minMaxErrorMessage" | "lengthErrorMessage" | "patternErrorMessage" | "selectionCountErrorMessage" | "dateRangeErrorMessage",
        localeCode: string,
        val: string
    ) => {
        const currentVal = question.validation || {};
        const currentFieldMap = (currentVal[field] as Record<string, string>) || {};
        const updatedQuestion: QuestionModel = {
            ...question,
            validation: {
                ...currentVal,
                [field]: {
                    ...currentFieldMap,
                    [localeCode]: val,
                },
            },
            translationsMeta: {
                ...(question.translationsMeta || {}),
                [localeCode]: { status: "manual", translatedAt: new Date().toISOString() },
            },
        };
        onChangeQuestion(updatedQuestion);
    };

    const handleOptionTranslationChange = (optionIndex: number, localeCode: string, val: string) => {
        if (!question.options) return;
        const newOptions = [...question.options];
        newOptions[optionIndex] = {
            ...newOptions[optionIndex],
            labels: { ...newOptions[optionIndex].labels, [localeCode]: val },
        };
        const updatedQuestion: QuestionModel = {
            ...question,
            options: newOptions,
            translationsMeta: {
                ...(question.translationsMeta || {}),
                [localeCode]: { status: "manual", translatedAt: new Date().toISOString() },
            },
        };
        onChangeQuestion(updatedQuestion);
    };

    // Auto-translate single language for this question
    const handleAutoTranslateLanguage = async (localeCode: string) => {
        if (!defaultTitle) return;
        setTranslatingLangs((prev) => ({ ...prev, [localeCode]: true }));

        try {
            const textsToTranslate: string[] = [defaultTitle];
            let hintIdx = -1;
            let placeholderIdx = -1;
            let reqMsgIdx = -1;
            let minMaxIdx = -1;
            let lengthIdx = -1;
            let patternIdx = -1;
            let dateIdx = -1;
            let selectionIdx = -1;

            if (defaultHint) {
                hintIdx = textsToTranslate.length;
                textsToTranslate.push(defaultHint);
            }
            if (defaultPlaceholder) {
                placeholderIdx = textsToTranslate.length;
                textsToTranslate.push(defaultPlaceholder);
            }
            if (defaultRequiredMsg) {
                reqMsgIdx = textsToTranslate.length;
                textsToTranslate.push(defaultRequiredMsg);
            }
            if (defaultMinMaxMsg) {
                minMaxIdx = textsToTranslate.length;
                textsToTranslate.push(defaultMinMaxMsg);
            }
            if (defaultLengthMsg) {
                lengthIdx = textsToTranslate.length;
                textsToTranslate.push(defaultLengthMsg);
            }
            if (defaultPatternMsg) {
                patternIdx = textsToTranslate.length;
                textsToTranslate.push(defaultPatternMsg);
            }
            if (defaultDateMsg) {
                dateIdx = textsToTranslate.length;
                textsToTranslate.push(defaultDateMsg);
            }
            if (defaultSelectionMsg) {
                selectionIdx = textsToTranslate.length;
                textsToTranslate.push(defaultSelectionMsg);
            }

            const optStartIdx = textsToTranslate.length;
            if (question.options) {
                question.options.forEach((opt) => textsToTranslate.push(opt.labels[defaultLangCode] || opt.value));
            }

            const translated = await SurveyService.translateTexts(defaultLangCode, localeCode, textsToTranslate);
            const newTitle = translated[0] || defaultTitle;
            const newHint = hintIdx !== -1 ? translated[hintIdx] || defaultHint : undefined;
            const newPlaceholder = placeholderIdx !== -1 ? translated[placeholderIdx] || defaultPlaceholder : undefined;
            const newRequiredMsg = reqMsgIdx !== -1 ? translated[reqMsgIdx] || defaultRequiredMsg : undefined;
            const newMinMaxMsg = minMaxIdx !== -1 ? translated[minMaxIdx] || defaultMinMaxMsg : undefined;
            const newLengthMsg = lengthIdx !== -1 ? translated[lengthIdx] || defaultLengthMsg : undefined;
            const newPatternMsg = patternIdx !== -1 ? translated[patternIdx] || defaultPatternMsg : undefined;
            const newDateMsg = dateIdx !== -1 ? translated[dateIdx] || defaultDateMsg : undefined;
            const newSelectionMsg = selectionIdx !== -1 ? translated[selectionIdx] || defaultSelectionMsg : undefined;

            let newOptions = question.options;
            if (question.options) {
                newOptions = question.options.map((opt, i) => ({
                    ...opt,
                    labels: { ...opt.labels, [localeCode]: translated[optStartIdx + i] || opt.labels[defaultLangCode] || opt.value },
                }));
            }

            const updatedValidation = { ...question.validation };
            if (newRequiredMsg) {
                updatedValidation.customErrorMessage = {
                    ...(typeof updatedValidation.customErrorMessage === "object" ? updatedValidation.customErrorMessage : {}),
                    [localeCode]: newRequiredMsg,
                };
            }
            if (newMinMaxMsg) {
                updatedValidation.minMaxErrorMessage = {
                    ...(updatedValidation.minMaxErrorMessage || {}),
                    [localeCode]: newMinMaxMsg,
                };
            }
            if (newLengthMsg) {
                updatedValidation.lengthErrorMessage = {
                    ...(updatedValidation.lengthErrorMessage || {}),
                    [localeCode]: newLengthMsg,
                };
            }
            if (newPatternMsg) {
                updatedValidation.patternErrorMessage = {
                    ...(updatedValidation.patternErrorMessage || {}),
                    [localeCode]: newPatternMsg,
                };
            }
            if (newDateMsg) {
                updatedValidation.dateRangeErrorMessage = {
                    ...(updatedValidation.dateRangeErrorMessage || {}),
                    [localeCode]: newDateMsg,
                };
            }
            if (newSelectionMsg) {
                updatedValidation.selectionCountErrorMessage = {
                    ...(updatedValidation.selectionCountErrorMessage || {}),
                    [localeCode]: newSelectionMsg,
                };
            }

            const updatedQuestion: QuestionModel = {
                ...question,
                titles: { ...question.titles, [localeCode]: newTitle },
                descriptions: newHint ? { ...(question.descriptions || {}), [localeCode]: newHint } : question.descriptions,
                placeholders: newPlaceholder ? { ...(question.placeholders || {}), [localeCode]: newPlaceholder } : question.placeholders,
                validation: updatedValidation,
                options: newOptions,
                translationsMeta: {
                    ...(question.translationsMeta || {}),
                    [localeCode]: { status: "auto", translatedAt: new Date().toISOString() },
                },
            };
            onChangeQuestion(updatedQuestion);
        } catch (err) {
            console.error(err);
        } finally {
            setTranslatingLangs((prev) => ({ ...prev, [localeCode]: false }));
        }
    };

    // Auto-translate all configured non-default languages for this question
    const handleAutoTranslateAll = async () => {
        const nonDefaultLocales = locales.filter((l) => l.code !== defaultLangCode);
        if (!defaultTitle || nonDefaultLocales.length === 0) return;
        setIsTranslatingAll(true);
        try {
            for (const loc of nonDefaultLocales) {
                await handleAutoTranslateLanguage(loc.code);
            }
        } finally {
            setIsTranslatingAll(false);
        }
    };

    // Filter displayed locales based on active tab
    const displayedLocales =
        activeLocaleTab === "all"
            ? locales
            : locales.filter((l) => l.code === activeLocaleTab);

    return (
        <div className="space-y-4">
            {/* Top Toolbar Card: Header, Action Buttons & Language Filter Tabs */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                {/* Top Row: Icon + Title + Subtitle & Action Buttons */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Languages className="h-5 w-5 text-zinc-500" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Question Translations
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal mt-0.5">
                                {locales.length} {locales.length === 1 ? "language" : "languages"} configured for this survey
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPublished || isTranslatingAll}
                            onClick={handleAutoTranslateAll}
                            className="h-8 px-3 text-xs border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 gap-1.5 rounded-lg font-semibold cursor-pointer shadow-2xs"
                        >
                            {isTranslatingAll ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                            <span>Auto-Translate All</span>
                        </Button>

                        {onOpenLanguageManager && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onOpenLanguageManager}
                                className="h-8 px-3 text-xs border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 gap-1.5 rounded-lg font-semibold cursor-pointer shadow-2xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Manage Languages</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Language Tabs with Status Dots */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                        type="button"
                        onClick={() => setActiveLocaleTab("all")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                            activeLocaleTab === "all"
                                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        )}
                    >
                        All ({locales.length})
                    </button>

                    {locales.map((loc) => {
                        const isDefault = loc.code === defaultLangCode || loc.isDefault;
                        const hasTranslation = Boolean(
                            isDefault
                                ? question.titles[defaultLangCode]?.trim()
                                : question.titles[loc.code]?.trim()
                        );
                        const isActive = activeLocaleTab === loc.code;
                        const shortLabel = loc.label.split("(")[0].trim();

                        return (
                            <button
                                key={loc.code}
                                type="button"
                                onClick={() => setActiveLocaleTab(loc.code)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                    isActive
                                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                )}
                            >
                                <span>{shortLabel}</span>
                                <span
                                    className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        hasTranslation
                                            ? "bg-emerald-500"
                                            : "bg-zinc-300 dark:bg-zinc-600"
                                    )}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Language Translation Cards */}
            <div className="space-y-4">
                {displayedLocales.map((locale) => {
                    const isDefault = locale.code === defaultLangCode || locale.isDefault;
                    const titleVal = question.titles[locale.code] || (isDefault ? defaultTitle : "");
                    const hintVal = question.descriptions?.[locale.code] || "";
                    const placeholderVal = question.placeholders?.[locale.code] || "";
                    const isTranslated = Boolean(titleVal && titleVal.trim().length > 0);
                    const isTranslating = Boolean(translatingLangs[locale.code]);

                    return (
                        <div
                            key={locale.code}
                            className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-zinc-500" />
                                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                        {locale.label}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] uppercase font-medium border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0"
                                    >
                                        {locale.code.toUpperCase()}
                                    </Badge>
                                    {isDefault && (
                                        <Badge className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                            Primary
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isDefault && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isPublished || isTranslating}
                                            onClick={() => handleAutoTranslateLanguage(locale.code)}
                                            className="h-7.5 text-xs gap-1.5 px-2.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 font-semibold cursor-pointer rounded-lg shadow-2xs"
                                        >
                                            {isTranslating ? (
                                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                                            ) : (
                                                <RotateCcw className="h-3 w-3 text-zinc-500" />
                                            )}
                                            <span>{isTranslating ? "Translating..." : "Re-translate"}</span>
                                        </Button>
                                    )}

                                    <span
                                        className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border",
                                            isTranslated
                                                ? "bg-emerald-50/70 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                                                : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                        )}
                                    >
                                        {isTranslated ? "Translated" : "Untranslated"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Question Prompt ({locale.label})
                                </Label>
                                <Input
                                    placeholder={`Enter question prompt in ${locale.label}...`}
                                    value={titleVal}
                                    disabled={isPublished || isTranslating}
                                    onChange={(e) => handleTitleChange(locale.code, e.target.value)}
                                    className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                                />
                            </div>

                            {(defaultHint || hintVal) && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                        Hint / Description ({locale.label})
                                    </Label>
                                    <Input
                                        placeholder={`Enter hint in ${locale.label}...`}
                                        value={hintVal}
                                        disabled={isPublished || isTranslating}
                                        onChange={(e) => handleHintChange(locale.code, e.target.value)}
                                        className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                    />
                                </div>
                            )}

                            {(defaultPlaceholder || placeholderVal) && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                        Placeholder ({locale.label})
                                    </Label>
                                    <Input
                                        placeholder={`Enter placeholder in ${locale.label}...`}
                                        value={placeholderVal}
                                        disabled={isPublished || isTranslating}
                                        onChange={(e) => handlePlaceholderChange(locale.code, e.target.value)}
                                        className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                    />
                                </div>
                            )}

                            {question.options && question.options.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                                        Choice Options ({question.options.length})
                                    </Label>
                                    <div className="space-y-2">
                                        {question.options.map((opt, optIdx) => {
                                            const defaultOptLabel = opt.labels[defaultLangCode] || opt.value;
                                            const currentOptLabel = isDefault
                                                ? defaultOptLabel
                                                : opt.labels[locale.code] || "";

                                            return (
                                                <div key={opt.id || optIdx} className="grid grid-cols-2 gap-3">
                                                    <Input
                                                        value={defaultOptLabel}
                                                        disabled
                                                        className="h-9 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                    />
                                                    <Input
                                                        placeholder={defaultOptLabel}
                                                        value={currentOptLabel}
                                                        disabled={isPublished || isTranslating}
                                                        onChange={(e) => handleOptionTranslationChange(optIdx, locale.code, e.target.value)}
                                                        className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Validation Error Messages Translations */}
                            {(() => {
                                const currentRequiredMsg =
                                    typeof question.validation?.customErrorMessage === "object" && question.validation?.customErrorMessage !== null
                                        ? question.validation.customErrorMessage[locale.code] || ""
                                        : isDefault && typeof question.validation?.customErrorMessage === "string"
                                        ? question.validation.customErrorMessage
                                        : "";

                                const currentMinMaxMsg = question.validation?.minMaxErrorMessage?.[locale.code] || (isDefault ? defaultMinMaxMsg : "");
                                const currentLengthMsg = question.validation?.lengthErrorMessage?.[locale.code] || (isDefault ? defaultLengthMsg : "");
                                const currentPatternMsg = question.validation?.patternErrorMessage?.[locale.code] || (isDefault ? defaultPatternMsg : "");
                                const currentDateMsg = question.validation?.dateRangeErrorMessage?.[locale.code] || (isDefault ? defaultDateMsg : "");
                                const currentSelectionMsg = question.validation?.selectionCountErrorMessage?.[locale.code] || (isDefault ? defaultSelectionMsg : "");

                                const hasValidationRules = Boolean(
                                    question.validation?.required ||
                                    defaultRequiredMsg ||
                                    question.validation?.minValue !== undefined ||
                                    question.validation?.maxValue !== undefined ||
                                    defaultMinMaxMsg ||
                                    question.validation?.minChar !== undefined ||
                                    question.validation?.maxChar !== undefined ||
                                    defaultLengthMsg ||
                                    question.validation?.regexPattern ||
                                    question.validation?.presetId ||
                                    question.validation?.validationPresetId ||
                                    defaultPatternMsg ||
                                    question.validation?.minDate ||
                                    question.validation?.maxDate ||
                                    defaultDateMsg ||
                                    question.validation?.minSelections !== undefined ||
                                    question.validation?.maxSelections !== undefined ||
                                    defaultSelectionMsg
                                );

                                if (!hasValidationRules) return null;

                                return (
                                    <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                            <div>
                                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                                                    Validation Error Messages ({locale.label})
                                                </Label>
                                                <p className="text-[11px] text-zinc-500">
                                                    Custom error messages displayed when validation fails in {locale.label}
                                                </p>
                                            </div>
                                        </div>

                                            {/* Required Response Error Message */}
                                            {(question.validation?.required || defaultRequiredMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Required Response Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultRequiredMsg || "This question is required to proceed."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentRequiredMsg}
                                                            disabled={isPublished || isTranslating}
                                                            dir={locale.direction === "rtl" || (locale as any).isRtl ? "rtl" : "ltr"}
                                                            onChange={(e) => handleValidationMessageChange("customErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Numeric Range / Boundaries Error Message */}
                                            {(question.validation?.minValue !== undefined || question.validation?.maxValue !== undefined || defaultMinMaxMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Numeric Range Limit Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultMinMaxMsg || "Please enter a value within the permitted range."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentMinMaxMsg}
                                                            disabled={isPublished || isTranslating}
                                                            onChange={(e) => handleValidationMessageChange("minMaxErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Character Length Error Message */}
                                            {(question.validation?.minChar !== undefined || question.validation?.maxChar !== undefined || defaultLengthMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Character Length Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultLengthMsg || "Text does not meet the required length constraints."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentLengthMsg}
                                                            disabled={isPublished || isTranslating}
                                                            onChange={(e) => handleValidationMessageChange("lengthErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pattern / Regex Error Message */}
                                            {(question.validation?.regexPattern || question.validation?.presetId || question.validation?.validationPresetId || defaultPatternMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Format / Regex Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultPatternMsg || "Value does not match the required format."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentPatternMsg}
                                                            disabled={isPublished || isTranslating}
                                                            onChange={(e) => handleValidationMessageChange("patternErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Date Range Error Message */}
                                            {(question.validation?.minDate || question.validation?.maxDate || defaultDateMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Date Boundary Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultDateMsg || "Please select a valid date range."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentDateMsg}
                                                            disabled={isPublished || isTranslating}
                                                            onChange={(e) => handleValidationMessageChange("dateRangeErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Selection Count Error Message */}
                                            {(question.validation?.minSelections !== undefined || question.validation?.maxSelections !== undefined || defaultSelectionMsg) && (
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                        Selection Count Error ({locale.label})
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            value={defaultSelectionMsg || "Please select the required number of options."}
                                                            disabled
                                                            className="h-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-not-allowed"
                                                        />
                                                        <Input
                                                            placeholder={`e.g. Translated error in ${locale.label}...`}
                                                            value={currentSelectionMsg}
                                                            disabled={isPublished || isTranslating}
                                                            onChange={(e) => handleValidationMessageChange("selectionCountErrorMessage", locale.code, e.target.value)}
                                                            className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                );
                            })()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
