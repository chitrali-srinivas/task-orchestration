import {
    LegacyBackendQuestionJSON,
    LegacyBackendSurveyJSON,
    LocaleDefinition,
    QuestionModel,
    SerializedCoreSurveyJSON,
    SerializedOptionJSON,
    SerializedQuestionJSON,
    SurveyModel,
} from "../types/survey-schema";

/**
 * Serializes a QuestionModel to the Core Survey Question JSON definition.
 * Holds ONLY the default language's canonical display text (title, hint, placeholder)
 * and all Advanced Settings / validation / visibility / repeaters / age dependencies / anomalies.
 * Strictly excludes non-default translations and repeated metadata.
 */
export function serializeQuestionToCoreJSON(
    question: QuestionModel,
    defaultLocale: string = "en"
): SerializedQuestionJSON {
    const rawDefaultTitle =
        question.titles?.[defaultLocale] ||
        question.titles?.["en"] ||
        (question.titles ? Object.values(question.titles)[0] : "") ||
        `Question ${question.number}`;

    const rawDefaultHint =
        question.descriptions?.[defaultLocale] ||
        question.descriptions?.["en"] ||
        undefined;

    const rawDefaultPlaceholder =
        question.placeholders?.[defaultLocale] ||
        question.placeholders?.["en"] ||
        undefined;

    let serializedOptions: SerializedOptionJSON[] | undefined = undefined;
    if (question.options && question.options.length > 0) {
        serializedOptions = question.options.map((opt) => ({
            id: opt.id,
            value: opt.value,
            label:
                opt.labels?.[defaultLocale] ||
                opt.labels?.["en"] ||
                (opt.labels ? Object.values(opt.labels)[0] : opt.value),
            ...(opt.score !== undefined ? { score: opt.score } : {}),
            ...(opt.meta !== undefined ? { meta: opt.meta } : {}),
        }));
    }

    return {
        id: question.id,
        number: question.number,
        displayIndex: question.displayIndex || String(question.number),
        type: question.type,
        displayType: question.displayType || question.type,
        columnName: question.columnName,
        title: rawDefaultTitle,
        ...(rawDefaultHint ? { hint: rawDefaultHint } : {}),
        ...(rawDefaultPlaceholder ? { placeholder: rawDefaultPlaceholder } : {}),
        ...(question.optionSource ? { optionSource: question.optionSource } : {}),
        ...(question.masterDataConfig ? { masterDataConfig: question.masterDataConfig } : {}),
        ...(serializedOptions ? { options: serializedOptions } : {}),
        validation: question.validation || { required: false },
        visibility: question.visibility || {
            enabled: false,
            ruleGroup: { conjunction: "AND", conditions: [] },
        },
        repeater: question.repeater || {
            isRepeater: false,
            countSourceType: "question",
            childQuestionIds: [],
            itemLabelTemplate: "Plot #{index}",
        },
        ageDependency: question.ageDependency || {
            enabled: false,
            isAgeParent: false,
        },
        anomalyDetection: question.anomalyDetection || {
            enabled: false,
        },
        ...(question.rawLegacyFields && Object.keys(question.rawLegacyFields).length > 0
            ? { rawLegacyFields: question.rawLegacyFields }
            : {}),
    };
}

/**
 * Serializes SurveyModel to the Core Survey JSON (survey.json).
 * Contains the complete survey definition, default locale display text,
 * translation resource manifest, and all behavior / Advanced Settings.
 */
export function serializeCoreSurveyJSON(survey: SurveyModel): SerializedCoreSurveyJSON {
    const defaultLang = survey.defaultLocale || "en";

    // Build canonical manifest in locales
    const canonicalLocales: LocaleDefinition[] = (
        survey.locales || [{ code: defaultLang, label: "English", isDefault: true }]
    ).map((loc) => {
        const isDefault = loc.code === defaultLang || Boolean(loc.isDefault);
        return {
            code: loc.code,
            label: loc.label,
            isDefault,
            direction: loc.direction || "ltr",
            ...(!isDefault
                ? {
                      translationFile: loc.translationFile || loc.translationResource || `translations/${loc.code}.json`,
                      translationVersion: loc.translationVersion || 1,
                  }
                : {}),
        };
    });

    const serializedQuestions = survey.questions.map((q) =>
        serializeQuestionToCoreJSON(q, defaultLang)
    );

    return {
        schemaVersion: "2.0",
        id: survey.id,
        azId: survey.azId,
        name: survey.name,
        ...(survey.description ? { description: survey.description } : {}),
        ...(survey.category ? { category: survey.category } : {}),
        ...(survey.appPath ? { appPath: survey.appPath } : {}),
        defaultLocale: defaultLang,
        locales: canonicalLocales,
        status: survey.status,
        version: survey.version,
        versionTag: survey.versionTag || `v${survey.version}`,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
        ...(survey.publishedAt ? { publishedAt: survey.publishedAt } : {}),
        createdBy: survey.createdBy,
        questions: serializedQuestions,
        ...(survey.sections && survey.sections.length > 0 ? { sections: survey.sections } : {}),
        ...(survey.availability ? { availability: survey.availability } : {}),
        ...(survey.statuses && survey.statuses.length > 0 ? { statuses: survey.statuses } : {}),
        ...(survey.metadata ? { metadata: survey.metadata } : {}),
    };
}

/**
 * Serializes normalized QuestionModel to legacy backend JSON format
 */
export function serializeQuestionToBackend(
    question: QuestionModel,
    allQuestions: QuestionModel[]
): LegacyBackendQuestionJSON {
    const raw: LegacyBackendQuestionJSON = {
        ...(question.rawLegacyFields || {}),
        Qn: question.titles.en || `Question ${question.number}`,
        S_Qn: question.titles.hi || "",
        Qn_Num: question.number,
        Qn_In: question.displayIndex || String(question.number),
        Qn_Type: question.type,
        Qn_Disp_Value: question.displayType || question.type,
        Column_Name: question.columnName,
        Is_Mandt: question.validation.required ? 1 : 0,
        Is_Cond: question.visibility.enabled ? 1 : 0,
    };

    // Option serialization
    if (question.options && question.options.length > 0) {
        raw.Opt_Name = question.options.map((opt) => opt.labels.en || opt.value);
        raw.S_Opt_Name = question.options.map((opt) => opt.labels.hi || opt.labels.en || opt.value);
    }

    // Min / Max constraints
    if (question.validation.minChar !== undefined) raw.Min_Char = question.validation.minChar;
    if (question.validation.maxChar !== undefined) raw.Max_Char = question.validation.maxChar;

    // Repeater serialization
    if (question.repeater?.isRepeater) {
        raw.Repeater = true;
        if (question.repeater.childQuestionIds && question.repeater.childQuestionIds.length > 0) {
            const childNums = question.repeater.childQuestionIds
                .map((cid) => {
                    const found = allQuestions.find((q) => q.id === cid);
                    return found ? found.number : parseInt(cid.replace("q_", ""), 10);
                })
                .filter((n) => !isNaN(n));
            raw.Qn_Repeat = childNums;
        }
    } else {
        raw.Repeater = false;
        // Check if this question is a child of a repeater parent
        const parentRepeater = allQuestions.find(
            (q) => q.repeater?.isRepeater && q.repeater.childQuestionIds?.includes(question.id)
        );
        if (parentRepeater) {
            raw.Parent_Repeat = parentRepeater.number;
            const childIdx = parentRepeater.repeater?.childQuestionIds?.indexOf(question.id) ?? -1;
            if (childIdx !== -1) {
                raw.Qn_In = `${parentRepeater.number}.${childIdx + 1}`;
            }
        }
    }

    // Visibility / Conditional logic serialization
    if (question.visibility.enabled && question.visibility.ruleGroup.conditions.length > 0) {
        const firstCond = question.visibility.ruleGroup.conditions[0];
        const parentQ = allQuestions.find((q) => q.id === firstCond.questionId);
        const parentNum = parentQ ? parentQ.number : parseInt(firstCond.questionId.replace("q_", ""), 10) || 1;

        raw.Parent_Dep = parentNum;
        raw.Opt_Dep = String(firstCond.value);
        raw.Qn_Deps = {
            questionId: firstCond.questionId,
            Qn_Num: parentNum,
            operator: firstCond.operator,
            value: firstCond.value,
        };
    }

    // Age dependency serialization
    if (question.ageDependency?.enabled) {
        if (question.ageDependency.minAge !== undefined && question.ageDependency.maxAge !== undefined) {
            raw.Age_Range = [question.ageDependency.minAge, question.ageDependency.maxAge];
        }
        if (question.ageDependency.parentAgeQuestionId) {
            const parentQ = allQuestions.find((q) => q.id === question.ageDependency?.parentAgeQuestionId);
            raw.Parent_Age = parentQ ? parentQ.number : parseInt(question.ageDependency.parentAgeQuestionId.replace("q_", ""), 10);
        }
        if (question.ageDependency.isAgeParent) {
            raw.Is_Age_Parent = true;
        }
    }

    // Anomaly detection serialization
    if (question.anomalyDetection?.enabled) {
        raw.IS_Anomaly = 1;
    }

    return raw;
}

/**
 * Serializes normalized SurveyModel to legacy backend Survey JSON format
 */
export function serializeSurveyToBackend(survey: SurveyModel): LegacyBackendSurveyJSON {
    const rawQuestions = survey.questions.map((q) => serializeQuestionToBackend(q, survey.questions));

    const rootRaw = (survey.metadata?.rawRootProps as Record<string, any>) || {};

    return {
        ...rootRaw,
        survey_id: survey.id,
        az_id: survey.azId,
        survey_name: survey.name,
        description: survey.description,
        version: survey.version,
        status: survey.status,
        updated_at: new Date().toISOString(),
        questions: rawQuestions,
    };
}
