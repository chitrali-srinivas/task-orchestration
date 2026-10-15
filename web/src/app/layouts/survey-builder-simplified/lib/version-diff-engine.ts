import { QuestionModel, SurveyModel } from "../types/survey-schema";

export type DiffChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "REORDERED" | "UNCHANGED";

export interface OptionDiffDetail {
    added: string[];
    removed: string[];
    renamed: { oldLabel: string; newLabel: string; value: string }[];
    scoreChanged: { label: string; oldValue?: number; newValue?: number }[];
}

export interface QuestionDiffItem {
    questionId: string;
    questionNumberOld?: number;
    questionNumberNew?: number;
    titleOld?: string;
    titleNew?: string;
    changeType: DiffChangeType;
    details: {
        titleChanged?: boolean;
        typeChanged?: boolean;
        typeOld?: string;
        typeNew?: string;
        optionsChanged?: boolean;
        optionsOld?: string[];
        optionsNew?: string[];
        optionDiffs?: OptionDiffDetail;
        validationChanged?: boolean;
        numberFormatChanged?: boolean;
        unitChanged?: boolean;
        unitOld?: string;
        unitNew?: string;
        localizedValidationChanged?: boolean;
        followUpHierarchyChanged?: boolean;
        logicChanged?: boolean;
        columnNameChanged?: boolean;
        translationChanged?: boolean;
    };
}

export interface SurveyVersionDiff {
    surveyId: string;
    versionOld: string;
    versionNew: string;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    reorderedCount: number;
    unchangedCount: number;
    questionDiffs: QuestionDiffItem[];
    metadataChanges: {
        nameChanged?: boolean;
        nameOld?: string;
        nameNew?: string;
        descriptionChanged?: boolean;
        azChanged?: boolean;
    };
}

/**
 * Computes semantic version difference between two survey snapshots
 */
export function computeSurveyDiff(oldSurvey: SurveyModel, newSurvey: SurveyModel): SurveyVersionDiff {
    const oldQuestions = oldSurvey.questions || [];
    const newQuestions = newSurvey.questions || [];

    const oldMap = new Map<string, QuestionModel>();
    oldQuestions.forEach((q) => oldMap.set(q.id, q));

    const newMap = new Map<string, QuestionModel>();
    newQuestions.forEach((q) => newMap.set(q.id, q));

    const questionDiffs: QuestionDiffItem[] = [];

    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;
    let reorderedCount = 0;
    let unchangedCount = 0;

    // 1. Check for removed questions
    oldQuestions.forEach((oldQ) => {
        if (!newMap.has(oldQ.id)) {
            removedCount++;
            questionDiffs.push({
                questionId: oldQ.id,
                questionNumberOld: oldQ.number,
                titleOld: oldQ.titles.en,
                changeType: "REMOVED",
                details: {},
            });
        }
    });

    // 2. Check for added, reordered, modified, or unchanged in new survey
    newQuestions.forEach((newQ, newIdx) => {
        const oldQ = oldMap.get(newQ.id);

        if (!oldQ) {
            addedCount++;
            questionDiffs.push({
                questionId: newQ.id,
                questionNumberNew: newQ.number,
                titleNew: newQ.titles.en,
                changeType: "ADDED",
                details: {},
            });
        } else {
            const oldIdx = oldQuestions.findIndex((q) => q.id === oldQ.id);
            const isReordered = oldIdx !== newIdx || oldQ.number !== newQ.number;

            // Deep check for modifications
            const titleChanged = oldQ.titles.en !== newQ.titles.en;
            const typeChanged = oldQ.type !== newQ.type;
            const columnNameChanged = oldQ.columnName !== newQ.columnName;

            // Translation check (e.g. Hindi)
            const translationChanged = JSON.stringify(oldQ.titles) !== JSON.stringify(newQ.titles);

            // Options check & granular diffing
            const oldOpts = oldQ.options || [];
            const newOpts = newQ.options || [];
            const addedOptions: string[] = [];
            const removedOptions: string[] = [];
            const renamedOptions: { oldLabel: string; newLabel: string; value: string }[] = [];
            const scoreChangedOptions: { label: string; oldValue?: number; newValue?: number }[] = [];

            const oldOptMap = new Map<string, typeof oldOpts[0]>();
            oldOpts.forEach((o) => {
                oldOptMap.set(o.id, o);
                if (o.value) oldOptMap.set(`val:${o.value}`, o);
            });

            const newOptMap = new Map<string, typeof newOpts[0]>();
            newOpts.forEach((o) => {
                newOptMap.set(o.id, o);
                if (o.value) newOptMap.set(`val:${o.value}`, o);
            });

            newOpts.forEach((newO) => {
                const matchedOld = oldOptMap.get(newO.id) || (newO.value ? oldOptMap.get(`val:${newO.value}`) : undefined);
                if (!matchedOld) {
                    addedOptions.push(newO.labels?.en || newO.value);
                } else {
                    const oldLabel = matchedOld.labels?.en || matchedOld.value;
                    const newLabel = newO.labels?.en || newO.value;
                    if (oldLabel !== newLabel) {
                        renamedOptions.push({ oldLabel, newLabel, value: newO.value });
                    }
                    if (matchedOld.score !== newO.score) {
                        scoreChangedOptions.push({
                            label: newLabel,
                            oldValue: matchedOld.score,
                            newValue: newO.score,
                        });
                    }
                }
            });

            oldOpts.forEach((oldO) => {
                const matchedNew = newOptMap.get(oldO.id) || (oldO.value ? newOptMap.get(`val:${oldO.value}`) : undefined);
                if (!matchedNew) {
                    removedOptions.push(oldO.labels?.en || oldO.value);
                }
            });

            const oldOptLabels = oldOpts.map((o) => o.labels?.en || o.value);
            const newOptLabels = newOpts.map((o) => o.labels?.en || o.value);
            const optionsChanged =
                addedOptions.length > 0 ||
                removedOptions.length > 0 ||
                renamedOptions.length > 0 ||
                scoreChangedOptions.length > 0 ||
                JSON.stringify(oldOptLabels) !== JSON.stringify(newOptLabels);

            const optionDiffs: OptionDiffDetail = {
                added: addedOptions,
                removed: removedOptions,
                renamed: renamedOptions,
                scoreChanged: scoreChangedOptions,
            };

            // Validation & Unit check
            const validationChanged = JSON.stringify(oldQ.validation) !== JSON.stringify(newQ.validation);
            const numberFormatChanged = oldQ.validation?.numberFormat !== newQ.validation?.numberFormat;
            
            const unitOld = oldQ.numberConfig?.unit || oldQ.validation?.unit || oldQ.validation?.unitSuffix;
            const unitNew = newQ.numberConfig?.unit || newQ.validation?.unit || newQ.validation?.unitSuffix;
            const unitModeOld = oldQ.numberConfig?.unitMode || oldQ.validation?.unitMode;
            const unitModeNew = newQ.numberConfig?.unitMode || newQ.validation?.unitMode;
            const allowedUnitsOld = JSON.stringify(oldQ.numberConfig?.allowedUnits || oldQ.validation?.allowedUnits || []);
            const allowedUnitsNew = JSON.stringify(newQ.numberConfig?.allowedUnits || newQ.validation?.allowedUnits || []);
            const unitChanged = unitOld !== unitNew || unitModeOld !== unitModeNew || allowedUnitsOld !== allowedUnitsNew;

            const localizedValidationChanged =
                JSON.stringify(oldQ.validation?.customErrorMessage) !== JSON.stringify(newQ.validation?.customErrorMessage) ||
                JSON.stringify(oldQ.validation?.minMaxErrorMessage) !== JSON.stringify(newQ.validation?.minMaxErrorMessage) ||
                JSON.stringify(oldQ.validation?.patternErrorMessage) !== JSON.stringify(newQ.validation?.patternErrorMessage);

            // Logic & Follow-up check
            const logicChanged = JSON.stringify(oldQ.visibility) !== JSON.stringify(newQ.visibility);
            const followUpHierarchyChanged =
                oldQ.displayIndex !== newQ.displayIndex ||
                oldQ.parentQuestionId !== newQ.parentQuestionId ||
                oldQ.followUpDepth !== newQ.followUpDepth;

            const isModified =
                titleChanged ||
                typeChanged ||
                columnNameChanged ||
                translationChanged ||
                optionsChanged ||
                validationChanged ||
                unitChanged ||
                logicChanged ||
                followUpHierarchyChanged;

            let changeType: DiffChangeType = "UNCHANGED";
            if (isModified) {
                changeType = "MODIFIED";
                modifiedCount++;
            } else if (isReordered) {
                changeType = "REORDERED";
                reorderedCount++;
            } else {
                unchangedCount++;
            }

            questionDiffs.push({
                questionId: newQ.id,
                questionNumberOld: oldQ.number,
                questionNumberNew: newQ.number,
                titleOld: oldQ.titles.en,
                titleNew: newQ.titles.en,
                changeType,
                details: {
                    titleChanged,
                    typeChanged,
                    typeOld: oldQ.type,
                    typeNew: newQ.type,
                    optionsChanged,
                    optionsOld: oldOptLabels,
                    optionsNew: newOptLabels,
                    optionDiffs,
                    validationChanged,
                    numberFormatChanged,
                    unitChanged,
                    unitOld,
                    unitNew,
                    localizedValidationChanged,
                    followUpHierarchyChanged,
                    logicChanged,
                    columnNameChanged,
                    translationChanged,
                },
            });
        }
    });

    return {
        surveyId: newSurvey.id,
        versionOld: oldSurvey.versionTag || `v${oldSurvey.version}`,
        versionNew: newSurvey.versionTag || `v${newSurvey.version}`,
        addedCount,
        removedCount,
        modifiedCount,
        reorderedCount,
        unchangedCount,
        questionDiffs,
        metadataChanges: {
            nameChanged: oldSurvey.name !== newSurvey.name,
            nameOld: oldSurvey.name,
            nameNew: newSurvey.name,
            descriptionChanged: oldSurvey.description !== newSurvey.description,
            azChanged: oldSurvey.azId !== newSurvey.azId,
        },
    };
}
