import { QuestionModel, SurveyModel } from "../types/survey-schema";

export type DiffChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "REORDERED" | "UNCHANGED";

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
        validationChanged?: boolean;
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

            // Options check
            const oldOptLabels = (oldQ.options || []).map((o) => o.labels.en || o.value);
            const newOptLabels = (newQ.options || []).map((o) => o.labels.en || o.value);
            const optionsChanged = JSON.stringify(oldOptLabels) !== JSON.stringify(newOptLabels);

            // Validation check
            const validationChanged = JSON.stringify(oldQ.validation) !== JSON.stringify(newQ.validation);

            // Logic check
            const logicChanged = JSON.stringify(oldQ.visibility) !== JSON.stringify(newQ.visibility);

            const isModified =
                titleChanged ||
                typeChanged ||
                columnNameChanged ||
                translationChanged ||
                optionsChanged ||
                validationChanged ||
                logicChanged;

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
                    validationChanged,
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
