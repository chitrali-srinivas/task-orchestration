import {
    LocaleDefinition,
    OptionItem,
    QuestionModel,
    SurveyModel,
    SurveyTranslationResource,
    TranslationManifest,
    TranslationResourceMeta,
} from "../types/survey-schema";
import { SurveyService } from "./survey-service";

export interface TranslationCompletenessResult {
    totalTranslatable: number;
    translatedCount: number;
    missingCount: number;
    percentage: number;
    untranslatedQuestionIds: string[];
    details: {
        surveyTitleTranslated: boolean;
        questionsStats: Record<string, { total: number; translated: number; missingFields: string[] }>;
        choicesStats: { total: number; translated: number };
    };
}

/**
 * Builds the decoupled application-level Translation Manifest for a survey
 */
export function buildTranslationManifest(survey: SurveyModel): TranslationManifest {
    const defaultLang = survey.defaultLocale || "en";
    const locales = survey.locales || [{ code: "en", label: "English (EN)", isDefault: true }];

    const available: TranslationResourceMeta[] = locales
        .filter((loc) => loc.code !== defaultLang)
        .map((loc) => {
            const existingMeta = survey.translations?.available?.find((m) => m.code === loc.code);
            return {
                code: loc.code,
                name: loc.label,
                file: `translations/${loc.code}.json`,
                version: existingMeta?.version || survey.version,
                surveyVersion: existingMeta?.surveyVersion || survey.version,
                sizeBytes: existingMeta?.sizeBytes || 2400,
                checksum: existingMeta?.checksum || `sha256-${loc.code}-${survey.version}`,
                updatedAt: existingMeta?.updatedAt || survey.updatedAt,
            };
        });

    return {
        default: defaultLang,
        available,
    };
}

/**
 * Generates a clean, modular translation resource JSON strictly containing user-facing strings
 * and zero Advanced Settings / logic / validation bounds.
 */
export function createModularTranslationResource(
    survey: SurveyModel,
    targetLocaleCode: string,
    targetLocaleName: string,
    overrides?: Partial<SurveyTranslationResource["translations"]>
): SurveyTranslationResource {
    const defaultLang = survey.defaultLocale || "en";

    // 1. Survey strings
    const surveyName =
        overrides?.survey?.name !== undefined
            ? overrides.survey.name
            : overrides?.survey?.title !== undefined
            ? overrides.survey.title
            : targetLocaleCode === defaultLang
            ? survey.name
            : survey.name || "";
    const surveyDesc =
        overrides?.survey?.description !== undefined
            ? overrides.survey.description
            : targetLocaleCode === defaultLang
            ? survey.description || ""
            : "";

    // 2. Question strings
    const questionsTrans: Record<
        string,
        { title?: string; label?: string; hint?: string; placeholder?: string; validationMessage?: string }
    > = {};

    survey.questions.forEach((q) => {
        if (overrides?.questions !== undefined) {
            if (overrides.questions[q.id]) {
                const ov = overrides.questions[q.id];
                const titleVal = ov.title ?? ov.label;
                if (titleVal || ov.hint || ov.placeholder) {
                    questionsTrans[q.id] = {
                        ...(titleVal ? { title: titleVal } : {}),
                        ...(ov.hint ? { hint: ov.hint } : {}),
                        ...(ov.placeholder ? { placeholder: ov.placeholder } : {}),
                    };
                }
            }
        } else {
            const transTitle = q.titles[targetLocaleCode];
            const transHint = q.descriptions?.[targetLocaleCode];
            const transPlaceholder = q.placeholders?.[targetLocaleCode];

            if (transTitle || transHint || transPlaceholder || targetLocaleCode === defaultLang) {
                questionsTrans[q.id] = {
                    title: transTitle || (targetLocaleCode === defaultLang ? q.titles[defaultLang] || `Question ${q.number}` : undefined),
                    ...(transHint ? { hint: transHint } : {}),
                    ...(transPlaceholder ? { placeholder: transPlaceholder } : {}),
                };
            }
        }
    });

    // 3. Choices (Choice ID -> Translated Label)
    const choicesTrans: Record<string, string> = {};
    survey.questions.forEach((q) => {
        if (q.options && q.options.length > 0) {
            q.options.forEach((opt) => {
                if (overrides?.choices !== undefined) {
                    const optVal = overrides.choices[opt.id] ?? overrides.choices[opt.value];
                    if (optVal) {
                        choicesTrans[opt.id] = optVal;
                    }
                } else {
                    const optVal =
                        opt.labels[targetLocaleCode] ||
                        (targetLocaleCode === defaultLang ? opt.labels[defaultLang] || opt.value : undefined);
                    if (optVal) {
                        choicesTrans[opt.id] = optVal;
                    }
                }
            });
        }
    });

    return {
        schemaVersion: "1.0",
        surveyId: survey.id,
        surveyVersion: survey.version,
        locale: targetLocaleCode,
        translationVersion: 1,
        language: {
            code: targetLocaleCode,
            name: targetLocaleName,
        },
        translations: {
            survey: {
                ...(surveyName ? { name: surveyName } : {}),
                ...(surveyDesc ? { description: surveyDesc } : {}),
            },
            ...(overrides?.sections && Object.keys(overrides.sections).length > 0 ? { sections: overrides.sections } : {}),
            questions: questionsTrans,
            choices: choicesTrans,
        },
    };
}

/**
 * Computes deterministic translation completeness based only on user-facing translatable fields.
 * Excludes IDs, validation rules, advanced settings, logic, and internal properties.
 */
export function calculateTranslationCompleteness(
    survey: SurveyModel,
    targetLocaleCode?: string,
    resource?: SurveyTranslationResource | null
): TranslationCompletenessResult {
    let totalTranslatable = 0;
    let translatedCount = 0;
    const untranslatedQuestionIds: string[] = [];
    const targetCode = targetLocaleCode || survey.locales?.find((l) => !l.isDefault)?.code || "hi";

    // 1. Survey Name / Title
    totalTranslatable += 1;
    const surveyTitle =
        resource?.translations?.survey?.name?.trim() ||
        resource?.translations?.survey?.title?.trim() ||
        (targetCode === survey.defaultLocale ? survey.name : undefined);
    const surveyTitleTranslated = Boolean(surveyTitle && surveyTitle.length > 0);
    if (surveyTitleTranslated) {
        translatedCount += 1;
    }

    // Survey Description (if survey has description in core)
    if (survey.description && survey.description.trim().length > 0) {
        totalTranslatable += 1;
        const surveyDesc = resource?.translations?.survey?.description?.trim();
        if (surveyDesc && surveyDesc.length > 0) {
            translatedCount += 1;
        }
    }

    // 2. Questions (Prompt / Title, Hint / Description, Placeholder)
    const questionsStats: Record<string, { total: number; translated: number; missingFields: string[] }> = {};

    survey.questions.forEach((q) => {
        let qTotal = 0;
        let qTranslated = 0;
        const missingFields: string[] = [];
        const qTranslation = resource?.translations?.questions?.[q.id];

        // Question Label / Prompt / Title
        qTotal += 1;
        const labelVal =
            qTranslation?.title?.trim() ||
            qTranslation?.label?.trim() ||
            (resource
                ? undefined
                : q.titles[targetCode]?.trim() ||
                  (targetCode === survey.defaultLocale ? q.titles[survey.defaultLocale] : undefined));

        if (labelVal && labelVal.length > 0) {
            qTranslated += 1;
        } else {
            missingFields.push("title");
        }

        // Question Hint (if English/default has hint)
        const hasDefaultHint = Boolean(q.descriptions?.[survey.defaultLocale || "en"]?.trim());
        if (hasDefaultHint) {
            qTotal += 1;
            const hintVal = qTranslation?.hint?.trim() || (resource ? undefined : q.descriptions?.[targetCode]?.trim());
            if (hintVal && hintVal.length > 0) {
                qTranslated += 1;
            } else {
                missingFields.push("hint");
            }
        }

        // Question Placeholder (if English/default has placeholder)
        const hasDefaultPlaceholder = Boolean(q.placeholders?.[survey.defaultLocale || "en"]?.trim());
        if (hasDefaultPlaceholder) {
            qTotal += 1;
            const placeholderVal = qTranslation?.placeholder?.trim() || (resource ? undefined : q.placeholders?.[targetCode]?.trim());
            if (placeholderVal && placeholderVal.length > 0) {
                qTranslated += 1;
            } else {
                missingFields.push("placeholder");
            }
        }

        totalTranslatable += qTotal;
        translatedCount += qTranslated;

        questionsStats[q.id] = {
            total: qTotal,
            translated: qTranslated,
            missingFields,
        };

        if (missingFields.length > 0) {
            untranslatedQuestionIds.push(q.id);
        }
    });

    // 3. Option Choices (Choice Labels)
    let choicesTotal = 0;
    let choicesTranslated = 0;

    survey.questions.forEach((q) => {
        if (q.options && q.options.length > 0) {
            q.options.forEach((opt) => {
                choicesTotal += 1;
                const choiceVal =
                    resource?.translations?.choices?.[opt.id]?.trim() ||
                    resource?.translations?.choices?.[opt.value]?.trim() ||
                    (resource ? undefined : opt.labels[targetCode]?.trim());

                if (choiceVal && choiceVal.length > 0) {
                    choicesTranslated += 1;
                }
            });
        }
    });

    totalTranslatable += choicesTotal;
    translatedCount += choicesTranslated;

    const missingCount = Math.max(0, totalTranslatable - translatedCount);
    const percentage = totalTranslatable > 0 ? Math.round((translatedCount / totalTranslatable) * 100) : 100;

    return {
        totalTranslatable,
        translatedCount,
        missingCount,
        percentage,
        untranslatedQuestionIds,
        details: {
            surveyTitleTranslated,
            questionsStats,
            choicesStats: {
                total: choicesTotal,
                translated: choicesTranslated,
            },
        },
    };
}

export const TranslationService = {
    /**
     * Builds the root translation manifest for a survey model
     */
    buildTranslationManifest(survey: SurveyModel): TranslationManifest {
        return buildTranslationManifest(survey);
    },

    /**
     * Creates an exportable modular translation resource JSON containing only localized strings
     */
    createModularTranslationResource(
        survey: SurveyModel,
        targetLocaleCode: string,
        targetLocaleName?: string,
        overrides?: Partial<SurveyTranslationResource["translations"]>
    ): SurveyTranslationResource {
        const name = targetLocaleName || survey.locales.find((l) => l.code === targetLocaleCode)?.label || targetLocaleCode;
        return createModularTranslationResource(survey, targetLocaleCode, name, overrides);
    },

    /**
     * Resolves a question's localized string with default English fallback
     */
    resolveQuestionText(
        question: QuestionModel,
        field: "label" | "hint" | "placeholder",
        localeCode: string,
        resource?: SurveyTranslationResource | null,
        defaultLang: string = "en"
    ): string {
        const defaultText =
            field === "label"
                ? question.titles[defaultLang] || Object.values(question.titles)[0] || ""
                : field === "hint"
                ? question.descriptions?.[defaultLang] || ""
                : question.placeholders?.[defaultLang] || "";

        if (localeCode === defaultLang) {
            return defaultText;
        }

        if (resource) {
            const trans = resource.translations?.questions?.[question.id];
            const titleOrLabel = trans?.title || trans?.label;
            if (field === "label" && titleOrLabel?.trim()) return titleOrLabel.trim();
            if (field === "hint" && trans?.hint?.trim()) return trans.hint.trim();
            if (field === "placeholder" && trans?.placeholder?.trim()) return trans.placeholder.trim();
            return defaultText;
        }

        // Fallback to core titles[localeCode] if present and no modular resource loaded
        if (field === "label" && question.titles[localeCode]?.trim()) return question.titles[localeCode].trim();
        if (field === "hint" && question.descriptions?.[localeCode]?.trim()) return question.descriptions[localeCode].trim();
        if (field === "placeholder" && question.placeholders?.[localeCode]?.trim()) return question.placeholders[localeCode].trim();

        return defaultText;
    },

    /**
     * Resolves a choice option's localized label with default fallback
     */
    resolveChoiceText(
        option: OptionItem,
        localeCode: string,
        resource?: SurveyTranslationResource | null,
        defaultLang: string = "en"
    ): string {
        const defaultText = option.labels[defaultLang] || option.value;

        if (localeCode === defaultLang || !resource) {
            if (option.labels[localeCode]?.trim()) return option.labels[localeCode].trim();
            return defaultText;
        }

        const transByOptId = resource.translations?.choices?.[option.id]?.trim();
        if (transByOptId) return transByOptId;

        const transByValue = resource.translations?.choices?.[option.value]?.trim();
        if (transByValue) return transByValue;

        if (option.labels[localeCode]?.trim()) return option.labels[localeCode].trim();

        return defaultText;
    },
};
