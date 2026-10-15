import {
    BackendQuestionType,
    LegacyBackendQuestionJSON,
    LegacyBackendSurveyJSON,
    OptionItem,
    QuestionModel,
    SurveyModel,
    DEFAULT_SURVEY_STATUSES,
} from "../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../registry/question-type-registry";

/**
 * Normalizes an internal column name from English question text
 */
export function generateColumnName(text: string): string {
    if (!text) return "question_field";
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32) || "question_field";
}

/**
 * Parses legacy backend question JSON into typed QuestionModel
 */
/**
 * Parses legacy backend question JSON or serialized Core JSON into typed QuestionModel
 */
export function normalizeBackendQuestion(
    raw: any,
    index: number,
    allRawQuestions?: any[]
): QuestionModel {
    const rawType = (raw.type || raw.Qn_Type || "Subjective") as BackendQuestionType;
    const type: BackendQuestionType = QUESTION_TYPE_REGISTRY[rawType] ? rawType : "Subjective";

    const qNum =
        typeof raw.number === "number"
            ? raw.number
            : typeof raw.Qn_Num === "number"
            ? raw.Qn_Num
            : parseInt(String(raw.Qn_Num || raw.number || index + 1), 10) || index + 1;

    const displayIndex = raw.displayIndex
        ? String(raw.displayIndex)
        : raw.Qn_In
        ? String(raw.Qn_In)
        : String(qNum);

    const questionId = raw.id || `q_${qNum}`;

    // Extract options
    let options: OptionItem[] | undefined = undefined;

    if (raw.options && Array.isArray(raw.options) && raw.options.length > 0) {
        options = raw.options.map((opt: any, optIdx: number) => {
            const optId = opt.id || `opt_${qNum}_${optIdx + 1}`;
            const optVal = opt.value || `opt_${optIdx + 1}`;
            const labels: Record<string, string> = opt.labels
                ? { ...opt.labels }
                : { en: opt.label || optVal, hi: opt.label || optVal };

            if (opt.label && !labels.en) {
                labels.en = opt.label;
            }

            return {
                id: optId,
                value: optVal,
                labels,
                ...(opt.score !== undefined ? { score: opt.score } : {}),
                ...(opt.meta !== undefined ? { meta: opt.meta } : {}),
            };
        });
    } else {
        const optNames = Array.isArray(raw.Opt_Name)
            ? raw.Opt_Name
            : typeof raw.Opt_Name === "string"
            ? raw.Opt_Name.split(",").map((s: string) => s.trim())
            : [];
        const sOptNames = Array.isArray(raw.S_Opt_Name)
            ? raw.S_Opt_Name
            : typeof raw.S_Opt_Name === "string"
            ? raw.S_Opt_Name.split(",").map((s: string) => s.trim())
            : [];

        if (optNames.length > 0) {
            options = optNames.map((enOpt: string, optIdx: number) => {
                const hiOpt = sOptNames[optIdx] || enOpt;
                const value =
                    enOpt.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") ||
                    `opt_${optIdx + 1}`;
                return {
                    id: `opt_${qNum}_${optIdx + 1}`,
                    value,
                    labels: {
                        en: enOpt,
                        hi: hiOpt,
                    },
                };
            });
        }
    }

    // Determine Required
    const isRequired =
        raw.validation?.required !== undefined
            ? Boolean(raw.validation.required)
            : raw.Is_Mandt === true ||
              raw.Is_Mandt === "true" ||
              raw.Is_Mandt === 1 ||
              raw.Is_Mandt === "1";

    // Determine Conditional Logic
    let isConditional = false;
    let conditions: any[] = [];

    if (raw.visibility && typeof raw.visibility === "object") {
        isConditional = Boolean(raw.visibility.enabled);
        conditions = raw.visibility.ruleGroup?.conditions || [];
    } else {
        isConditional =
            raw.Is_Cond === true ||
            raw.Is_Cond === "true" ||
            raw.Is_Cond === 1 ||
            raw.Is_Cond === "1" ||
            Boolean(raw.Parent_Dep) ||
            (Array.isArray(raw.Opt_Dep) && raw.Opt_Dep.length > 0);

        if (isConditional) {
            if (raw.Qn_Deps && Array.isArray(raw.Qn_Deps) && raw.Qn_Deps.length > 0 && typeof raw.Qn_Deps[0] === "object") {
                conditions = raw.Qn_Deps.map((dep: any, depIdx: number) => ({
                    id: `cond_${depIdx + 1}`,
                    questionId: String(dep.questionId || (dep.Qn_Num ? `q_${dep.Qn_Num}` : "") || dep.parent_id || ""),
                    operator: dep.operator || "equals",
                    value: dep.value ?? dep.dep_val ?? "no",
                }));
            } else if (raw.Qn_Deps && typeof raw.Qn_Deps === "object" && !Array.isArray(raw.Qn_Deps)) {
                conditions = [
                    {
                        id: "cond_1",
                        questionId: String(raw.Qn_Deps.questionId || (raw.Qn_Deps.Qn_Num ? `q_${raw.Qn_Deps.Qn_Num}` : "") || (raw.Parent_Dep ? `q_${raw.Parent_Dep}` : "") || ""),
                        operator: raw.Qn_Deps.operator || "equals",
                        value: raw.Qn_Deps.value ?? raw.Opt_Dep ?? "no",
                    },
                ];
            } else if (raw.Parent_Dep) {
                conditions = [
                    {
                        id: "cond_1",
                        questionId: `q_${raw.Parent_Dep}`,
                        operator: "equals",
                        value: Array.isArray(raw.Opt_Dep) ? String(raw.Opt_Dep[0]) : raw.Opt_Dep || "no",
                    },
                ];
            }
        }
    }

    // Determine Repeater Config
    let isRepeater = false;
    let childQuestionIds: string[] = [];

    if (raw.repeater && typeof raw.repeater === "object") {
        isRepeater = Boolean(raw.repeater.isRepeater);
        childQuestionIds = raw.repeater.childQuestionIds || [];
    } else {
        isRepeater =
            raw.Repeater === true ||
            raw.Repeater === "true" ||
            type === "Repeater_QT";

        if (raw.Qn_Repeat) {
            if (Array.isArray(raw.Qn_Repeat)) {
                childQuestionIds = raw.Qn_Repeat.map((n: any) => `q_${n}`);
            } else if (typeof raw.Qn_Repeat === "string") {
                childQuestionIds = raw.Qn_Repeat.split(",").map((s: string) => `q_${s.trim()}`);
            }
        }
    }

    // Parse Numeric & Character validation bounds
    const minChar =
        raw.validation?.minChar !== undefined
            ? raw.validation.minChar
            : raw.Min_Char !== undefined
            ? Number(raw.Min_Char)
            : undefined;

    const maxChar =
        raw.validation?.maxChar !== undefined
            ? raw.validation.maxChar
            : raw.Max_Char !== undefined
            ? Number(raw.Max_Char)
            : undefined;

    let minValue: number | undefined = raw.validation?.minValue;
    let maxValue: number | undefined = raw.validation?.maxValue;
    let decimalPlaces: number | undefined = raw.validation?.decimalPlaces;

    if (minValue === undefined && maxValue === undefined) {
        if (type.startsWith("DecimalMax")) {
            decimalPlaces = 2;
            const maxStr = type.replace("DecimalMax", "");
            maxValue = Number(maxStr) || 10;
            minValue = 0;
        } else if (type.startsWith("WholeNumMax")) {
            decimalPlaces = 0;
            const maxStr = type.replace("WholeNumMax", "");
            maxValue = Number(maxStr) || 100;
            minValue = 0;
        } else if (type.startsWith("NaturalNumMax")) {
            decimalPlaces = 0;
            const maxStr = type.replace("NaturalNumMax", "");
            maxValue = Number(maxStr) || 10000;
            minValue = 1;
        }
    }

    // Collect unknown/legacy properties into rawLegacyFields
    const standardKeys = new Set([
        "id",
        "number",
        "displayIndex",
        "type",
        "displayType",
        "columnName",
        "title",
        "titles",
        "hint",
        "descriptions",
        "placeholder",
        "placeholders",
        "options",
        "validation",
        "visibility",
        "repeater",
        "ageDependency",
        "anomalyDetection",
        "optionSource",
        "masterDataConfig",
        "translationsMeta",
        "rawLegacyFields",
        "Qn",
        "S_Qn",
        "Qn_Num",
        "Qn_In",
        "Qn_Deps",
        "Opt_Dep",
        "Age_Range",
        "Repeater",
        "Qn_Repeat",
        "Opt_Name",
        "S_Opt_Name",
        "Is_Mandt",
        "Is_Cond",
        "Min_Char",
        "Max_Char",
        "IS_Anomaly",
        "is_double_dependent",
        "Repeat_Dependence",
        "user_Res",
        "is_Visible",
        "Is_Sub_Visible",
        "Parent_Age",
        "Parent_Dep",
        "Parent_Repeat",
        "Is_Age_Parent",
        "Qn_Type",
        "Qn_Disp_Value",
        "Column_Name",
    ]);

    const rawLegacyFields: Record<string, any> = {
        ...(raw.rawLegacyFields || {}),
    };
    for (const [key, value] of Object.entries(raw)) {
        if (!standardKeys.has(key)) {
            rawLegacyFields[key] = value;
        }
    }

    const parentQuestionId =
        raw.parentQuestionId ||
        (raw.Parent_Dep ? `q_${raw.Parent_Dep}` : undefined) ||
        (isConditional && conditions.length > 0 && conditions[0].questionId && !isRepeater
            ? String(conditions[0].questionId)
            : undefined);

    if (raw.Parent_Dep !== undefined) {
        rawLegacyFields.Parent_Dep = raw.Parent_Dep;
    }
    if (raw.Opt_Dep !== undefined) {
        rawLegacyFields.Opt_Dep = raw.Opt_Dep;
    }
    if (raw.Parent_Repeat !== undefined) {
        rawLegacyFields.Parent_Repeat = raw.Parent_Repeat;
    }

    const enTitle =
        raw.titles?.en ||
        raw.title ||
        raw.Qn ||
        (raw.titles ? Object.values(raw.titles)[0] : "") ||
        `Question ${qNum}`;

    const hiTitle = raw.titles?.hi || raw.S_Qn || "";
    const colName = raw.columnName || raw.Column_Name || generateColumnName(enTitle);

    const titles: Record<string, string> = raw.titles
        ? { ...raw.titles }
        : {
              en: enTitle,
              ...(hiTitle ? { hi: hiTitle } : {}),
          };

    const descriptions: Record<string, string> | undefined = raw.descriptions
        ? { ...raw.descriptions }
        : raw.hint
        ? { en: raw.hint }
        : undefined;

    const placeholders: Record<string, string> | undefined = raw.placeholders
        ? { ...raw.placeholders }
        : raw.placeholder
        ? { en: raw.placeholder }
        : undefined;

    return {
        id: questionId,
        number: qNum,
        displayIndex,
        type,
        displayType: raw.displayType || raw.Qn_Disp_Value || type,
        columnName: colName,
        parentQuestionId,
        titles,
        ...(descriptions ? { descriptions } : {}),
        ...(placeholders ? { placeholders } : {}),
        ...(raw.optionSource ? { optionSource: raw.optionSource } : {}),
        ...(raw.masterDataConfig ? { masterDataConfig: raw.masterDataConfig } : {}),
        options,
        validation: {
            required: isRequired,
            minChar,
            maxChar,
            minValue,
            maxValue,
            decimalPlaces,
            minPhotos: type === "Picture Input" ? 1 : undefined,
            maxPhotos: type === "Picture Input" ? 3 : undefined,
            minVertices: type === "PolygonBoundary" ? 3 : undefined,
            maxVertices: type === "PolygonBoundary" ? 50 : undefined,
            qrPrefix: type === "QRCode" ? "MATI-" : undefined,
            ratingMax: type === "Rating" ? 5 : undefined,
            ratingStep: type === "Rating" ? 1 : undefined,
            ...(raw.validation || {}),
        },
        visibility: {
            enabled: isConditional,
            ruleGroup: raw.visibility?.ruleGroup || {
                conjunction: "AND",
                conditions: conditions.length > 0 ? conditions : [],
            },
        },
        repeater: {
            isRepeater,
            countSourceType: raw.repeater?.countSourceType || "question",
            countQuestionId: raw.repeater?.countQuestionId || (isRepeater ? `q_${qNum}` : undefined),
            fixedCount: raw.repeater?.fixedCount,
            childQuestionIds,
            itemLabelTemplate: raw.repeater?.itemLabelTemplate || "Plot #{index}",
        },
        ageDependency: {
            enabled:
                raw.ageDependency?.enabled !== undefined
                    ? raw.ageDependency.enabled
                    : Boolean(raw.Age_Range || raw.Parent_Age || raw.Is_Age_Parent),
            parentAgeQuestionId:
                raw.ageDependency?.parentAgeQuestionId ||
                (raw.Parent_Age ? `q_${raw.Parent_Age}` : undefined),
            minAge:
                raw.ageDependency?.minAge !== undefined
                    ? raw.ageDependency.minAge
                    : Array.isArray(raw.Age_Range)
                    ? raw.Age_Range[0]
                    : undefined,
            maxAge:
                raw.ageDependency?.maxAge !== undefined
                    ? raw.ageDependency.maxAge
                    : Array.isArray(raw.Age_Range)
                    ? raw.Age_Range[1]
                    : undefined,
            isAgeParent:
                raw.ageDependency?.isAgeParent !== undefined
                    ? raw.ageDependency.isAgeParent
                    : Boolean(raw.Is_Age_Parent),
        },
        anomalyDetection: {
            enabled:
                raw.anomalyDetection?.enabled !== undefined
                    ? raw.anomalyDetection.enabled
                    : Boolean(raw.IS_Anomaly),
            rule:
                raw.anomalyDetection?.rule ||
                (typeof raw.IS_Anomaly === "string" ? raw.IS_Anomaly : undefined),
        },
        rawLegacyFields,
    };
}

/**
 * Normalizes full backend survey JSON or Core survey JSON into typed SurveyModel
 */
export function normalizeBackendSurvey(raw: any): SurveyModel {
    const rawQuestions = Array.isArray(raw.questions)
        ? raw.questions
        : Array.isArray(raw.question)
        ? raw.question
        : [];
    const questions = rawQuestions.map((q: any, idx: number) => normalizeBackendQuestion(q, idx, rawQuestions));

    const defaultLocale = raw.defaultLocale || "en";
    const locales = raw.locales && Array.isArray(raw.locales) && raw.locales.length > 0
        ? raw.locales.map((loc: any) => ({
              code: loc.code,
              label: loc.label,
              isDefault: loc.code === defaultLocale || Boolean(loc.isDefault),
              direction: loc.direction || "ltr",
              translationResource: loc.translationResource || (loc.code !== defaultLocale ? `translations/${loc.code}.json` : undefined),
              translationVersion: loc.translationVersion || 1,
          }))
        : [
              { code: "en", label: "English", isDefault: true, direction: "ltr" as const },
              { code: "hi", label: "Hindi (हिंदी)", isDefault: false, direction: "ltr" as const, translationResource: "translations/hi.json", translationVersion: 1 },
          ];

    const rawVersion = raw.version;
    let versionNum = 1;
    let versionTag = "v1";

    if (rawVersion !== undefined && rawVersion !== null) {
        if (typeof rawVersion === "number") {
            versionNum = rawVersion;
            versionTag = `v${rawVersion}`;
        } else if (typeof rawVersion === "string") {
            const digits = rawVersion.replace(/\D/g, "");
            if (digits !== "") {
                versionNum = parseInt(digits, 10);
                versionTag = rawVersion.startsWith("v") ? rawVersion : `v${versionNum}`;
            } else {
                versionNum = 0;
                versionTag = "v0";
            }
        }
    }

    // Infer category from surveyTable or surveyName
    let category = raw.category || "Field Operations";
    const table = (raw.surveyTable || "").toLowerCase();
    const name = (raw.name || raw.surveyName || raw.survey_name || "").toLowerCase();
    if (!raw.category) {
        if (table.includes("enrollment") || name.includes("enrollment")) category = "Farmer Enrollment";
        else if (table.includes("sampling") || table.includes("sample") || name.includes("sample") || name.includes("sampling")) category = "Crop Sampling & Monitoring";
        else if (
            table.includes("deployment") ||
            table.includes("dispatch") ||
            table.includes("baling") ||
            table.includes("slashing") ||
            table.includes("racking") ||
            name.includes("dispatch") ||
            name.includes("deployment") ||
            name.includes("ops")
        )
            category = "Basalt Rock Dust Application";
        else if (table.includes("engagement") || table.includes("control") || name.includes("engagement") || name.includes("awd")) category = "Agronomy & Soil Baseline";
        else if (table.includes("harvest") || name.includes("harvest") || name.includes("yield")) category = "Harvest & Yield Assessment";
        else if (table.includes("noc") || table.includes("bale_collection") || name.includes("noc")) category = "Verification & Audit";
    }

    const rawAz = raw.azId || raw.az || raw.az_id || "az2";
    const azId = String(rawAz).toUpperCase();

    const surveyName = raw.name || raw.surveyName || raw.survey_name || "Untitled Survey";
    const surveyId = raw.id || raw.survey_id || raw.qID || `srv_${surveyName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

    // Ensure bidirectional reconstruction between parent Qn_Repeat and child Parent_Repeat
    questions.forEach((q: QuestionModel) => {
        if (q.rawLegacyFields?.Parent_Repeat) {
            const parentNum = Number(q.rawLegacyFields.Parent_Repeat);
            const parentQ = questions.find((p: QuestionModel) => p.number === parentNum);
            if (parentQ) {
                if (!parentQ.repeater) {
                    parentQ.repeater = {
                        isRepeater: true,
                        countSourceType: "question",
                        childQuestionIds: [],
                        itemLabelTemplate: "Plot #{index}",
                    };
                }
                parentQ.repeater.isRepeater = true;
                if (!parentQ.repeater.childQuestionIds.includes(q.id)) {
                    parentQ.repeater.childQuestionIds.push(q.id);
                }
            }
        }
    });

    // Recalculate question numbers for all questions (top-level 1, 2, 3... and nested 1.1, 1.2, 8.1, 8.2...)
    const processedQuestions = recalculateQuestionNumbers(questions);

    const surveyStatus: "Draft" | "Published" =
        raw.status === "Draft" || raw.status === "Published"
            ? raw.status
            : "Published";

    const surveyModel: SurveyModel = {
        id: surveyId,
        azId,
        name: surveyName,
        description: raw.description || `Operational field survey for ${surveyName} in ${azId} (${table || "ops"}).`,
        category,
        appPath: raw.appPath,
        defaultLocale,
        locales,
        status: surveyStatus,
        version: versionNum,
        versionTag: raw.versionTag || versionTag,
        createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
        updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
        publishedAt: raw.publishedAt || raw.published_at,
        createdBy: raw.createdBy || raw.created_by || (raw.adminID ? "Admin (MRV Team)" : "MATIC Operations"),
        questions: processedQuestions,
        sections: raw.sections,
        availability: raw.availability,
        statuses: Array.isArray(raw.statuses) && raw.statuses.length > 0 ? raw.statuses : [...DEFAULT_SURVEY_STATUSES],
        translations: raw.translations || {
            default: defaultLocale,
            available: locales
                .filter((l: any) => l.code !== defaultLocale)
                .map((loc: any) => ({
                    code: loc.code,
                    name: loc.label,
                    file: `translations/${loc.code}.json`,
                    version: versionNum,
                    surveyVersion: versionNum,
                    sizeBytes: 2450,
                    checksum: `sha256-${loc.code}-${versionNum}`,
                    updatedAt: raw.updatedAt || new Date().toISOString(),
                })),
        },
        metadata: {
            sourceFormat: raw.schemaVersion ? `SCHEMA_${raw.schemaVersion}` : "MATIC_LEGACY_V1",
            surveyTable: raw.surveyTable,
            parentGroup: raw.parent_group,
            adminId: raw.adminID,
            surveyType: raw.surveyType,
            ...(raw.metadata || {}),
        },
    };

    return surveyModel;
}

/**
 * Automatically recalculates sequential top-level question numbering (Q1, Q2, Q3...)
 * and hierarchical child numbering (Q1.1, Q1.2, Q8.1, Q8.2...) across repeaters and linked follow-up questions.
 */
export function recalculateQuestionNumbers(questions: QuestionModel[]): QuestionModel[] {
    if (!questions || questions.length === 0) return [];

    // 1. Build map of child -> parent QuestionModel
    const childParentMap = new Map<string, { parent: QuestionModel; type: "repeater" | "followup" }>();

    // First pass: register repeater children
    questions.forEach((q) => {
        if (q.repeater?.isRepeater || q.type === "Repeater_QT") {
            const childIds = q.repeater?.childQuestionIds || [];
            childIds.forEach((childId) => {
                const target = questions.find(
                    (t) => t.id === childId || t.id === `q_${childId}` || String(t.number) === childId
                );
                if (target && target.id !== q.id) {
                    childParentMap.set(target.id, { parent: q, type: "repeater" });
                }
            });
        }
    });

    // Second pass: register explicit parentQuestionId, legacy Parent_Dep, and conditional follow-ups
    questions.forEach((q) => {
        if (!childParentMap.has(q.id)) {
            // Repeaters themselves are top-level containers (unless nested in another repeater) and are not follow-ups
            if (q.repeater?.isRepeater || q.type === "Repeater_QT") {
                return;
            }

            // 1) parentQuestionId is explicitly defined (set during follow-up creation or normalization)
            if (q.parentQuestionId && q.parentQuestionId !== q.id) {
                const parentQ = questions.find(
                    (p) =>
                        p.id !== q.id &&
                        (p.id === q.parentQuestionId ||
                            p.id === `q_${q.parentQuestionId}` ||
                            String(p.number) === String(q.parentQuestionId) ||
                            `q_${p.number}` === String(q.parentQuestionId))
                );
                if (parentQ) {
                    childParentMap.set(q.id, { parent: parentQ, type: "followup" });
                    return;
                }
            } 
            // 2) Or legacy Parent_Dep is explicitly set
            if (q.rawLegacyFields?.Parent_Dep) {
                const depNum = Number(q.rawLegacyFields.Parent_Dep);
                const parentQ = questions.find(
                    (p) =>
                        p.id !== q.id &&
                        (p.number === depNum ||
                            p.id === `q_${depNum}` ||
                            String(p.id) === String(q.rawLegacyFields?.Parent_Dep))
                );
                if (parentQ) {
                    childParentMap.set(q.id, { parent: parentQ, type: "followup" });
                    return;
                }
            }
            // 3) Or visibility conditions reference a parent question
            if (
                q.visibility?.enabled &&
                q.visibility.ruleGroup?.conditions &&
                q.visibility.ruleGroup.conditions.length > 0
            ) {
                const firstCond = q.visibility.ruleGroup.conditions[0];
                if (firstCond.questionId && firstCond.questionId !== q.id) {
                    const parentQ = questions.find(
                        (p) =>
                            p.id !== q.id &&
                            (p.id === firstCond.questionId ||
                                p.id === `q_${firstCond.questionId}` ||
                                String(p.number) === String(firstCond.questionId) ||
                                `q_${p.number}` === String(firstCond.questionId))
                    );
                    if (parentQ) {
                        childParentMap.set(q.id, { parent: parentQ, type: "followup" });
                        return;
                    }
                }
            }
        }
    });

    // Prevent cycles in childParentMap
    const isAncestorOf = (potentialAncestorId: string, childId: string, visited = new Set<string>()): boolean => {
        if (visited.has(childId)) return false;
        visited.add(childId);
        const info = childParentMap.get(childId);
        if (!info) return false;
        if (info.parent.id === potentialAncestorId) return true;
        return isAncestorOf(potentialAncestorId, info.parent.id, visited);
    };

    // Clean any accidental cycles
    for (const [childId, info] of Array.from(childParentMap.entries())) {
        if (isAncestorOf(childId, info.parent.id)) {
            childParentMap.delete(childId);
        }
    }

    // Build parent -> children map preserving relative question array order
    const parentToChildrenMap = new Map<string, QuestionModel[]>();
    questions.forEach((q) => {
        const info = childParentMap.get(q.id);
        if (info) {
            const list = parentToChildrenMap.get(info.parent.id) || [];
            list.push(q);
            parentToChildrenMap.set(info.parent.id, list);
        }
    });

    // Root questions are those not mapped to any parent
    const rootQuestions = questions.filter((q) => !childParentMap.has(q.id));

    // Pre-order tree traversal to calculate numbering and order
    const orderedQuestions: QuestionModel[] = [];
    const computedIndices = new Map<string, string>();
    const computedDepths = new Map<string, number>();
    const computedTopNumbers = new Map<string, number>();

    const traverseSubtree = (
        node: QuestionModel,
        displayIndex: string,
        depth: number,
        topNumber: number,
        visited = new Set<string>()
    ) => {
        if (visited.has(node.id)) return;
        visited.add(node.id);

        computedIndices.set(node.id, displayIndex);
        computedDepths.set(node.id, depth);
        computedTopNumbers.set(node.id, topNumber);
        orderedQuestions.push(node);

        const children = parentToChildrenMap.get(node.id) || [];
        children.forEach((child, childIdx) => {
            const childDisplay = `${displayIndex}.${childIdx + 1}`;
            traverseSubtree(child, childDisplay, depth + 1, topNumber, visited);
        });
    };

    // Traverse from each root question
    rootQuestions.forEach((rootQ, rootIdx) => {
        const topNum = rootIdx + 1;
        traverseSubtree(rootQ, String(topNum), 1, topNum);
    });

    // Handle any orphaned questions (safety fallback)
    questions.forEach((q) => {
        if (!computedIndices.has(q.id)) {
            const topNum = orderedQuestions.length + 1;
            computedIndices.set(q.id, String(topNum));
            computedDepths.set(q.id, 1);
            computedTopNumbers.set(q.id, topNum);
            orderedQuestions.push(q);
        }
    });

    // Construct final updated models
    return orderedQuestions.map((q) => {
        const info = childParentMap.get(q.id);
        const depth = computedDepths.get(q.id) || 1;
        const displayIndex = computedIndices.get(q.id) || String(q.number);
        const topNumber = computedTopNumbers.get(q.id) || 1;

        if (info) {
            return {
                ...q,
                number: topNumber,
                displayIndex,
                parentQuestionId: info.parent.id,
                followUpDepth: depth,
                rawLegacyFields: {
                    ...q.rawLegacyFields,
                    Parent_Repeat: info.type === "repeater" ? topNumber : q.rawLegacyFields?.Parent_Repeat,
                    Parent_Dep: info.type === "followup" ? topNumber : q.rawLegacyFields?.Parent_Dep,
                    Qn_In: displayIndex,
                },
            };
        }

        return {
            ...q,
            number: topNumber,
            displayIndex,
            parentQuestionId: undefined,
            followUpDepth: 1,
            rawLegacyFields: {
                ...q.rawLegacyFields,
                Qn_In: displayIndex,
            },
        };
    });
}

