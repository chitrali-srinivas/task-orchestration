/**
 * The production questionnaire contract: how the field app's surveys are stored (data/questionnaire.prod.json, an
 * export of the questionnaire table) and how the Survey Builder reads and writes them.
 *
 * File: an array of questionnaire rows. Each row is positional; the ones used here:
 *   [0] questions · [3] survey name · [5] created · [6] survey id · [9] child survey ids · [10] group name
 *   [11] child surveys (task surveys: { qID, adminID, question[], surveyName, surveyType, surveyTable, az, version,
 *   parent_group, … }) · [17] is the registration survey · [18] version · [19] table.
 * Every survey's id (row [6] or qID) is kept as is: the app picks how to render a survey (cards, maps) by its id.
 *
 * A question always carries the same 28 fields (QUESTION_KEYS), some with Allowed_Media_Source or Is_Range:
 *  - Qn_Num is the position (1…n); Qn_In the label: top-level 1, 2, 3…, a child its parent's label + ".k".
 *  - Show-if: the child has Is_Cond, Parent_Dep (the parent's Qn_Num) and Opt_Dep (the parent's option indexes that
 *    show it); the parent lists child numbers in Qn_Deps. Repeaters: Repeater, Qn_Repeat (children), Parent_Repeat.
 *  - Yes/no fields are booleans; Qn_Disp_Value is the display name of the type ("Single Choice", "Location", …);
 *    Min_Char / Max_Char are the length limits, or the value limits of number types.
 *  - is_Visible, Is_Sub_Visible, user_Res and Qn_Deps don't follow a fixed rule in production, so imported values are
 *    kept as they are; new questions get production's defaults.
 *
 * Pure (type imports only), so `node --test` runs it: lib/production-contract.test.ts round-trips the real file.
 */
import type { BackendQuestionType, LogicCondition, OptionItem, QuestionModel, SurveyModel } from "../types/survey-schema";

/** The fields of every production question, in production's usual order. */
export const QUESTION_KEYS = [
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
] as const;

export type ProductionQuestion = {
    Qn: string;
    S_Qn: string;
    Qn_Num: number;
    Qn_In: string;
    Qn_Deps: number[];
    Opt_Dep: number[];
    Age_Range: unknown[];
    Repeater: boolean;
    Qn_Repeat: number[];
    Opt_Name: string[];
    S_Opt_Name: string[];
    Is_Mandt: boolean;
    Is_Cond: boolean;
    Min_Char: number;
    Max_Char: number;
    IS_Anomaly: boolean;
    is_double_dependent: boolean;
    Repeat_Dependence: unknown;
    user_Res: unknown[];
    is_Visible: boolean;
    Is_Sub_Visible: boolean;
    Parent_Age: unknown;
    Parent_Dep: number | null;
    Parent_Repeat: number | null;
    Is_Age_Parent: boolean;
    Qn_Type: string;
    Qn_Disp_Value: string;
    Column_Name: string;
    Allowed_Media_Source?: string;
    Is_Range?: boolean;
    [key: string]: unknown;
};

/** Number types and their cap (Max_Char of a new question). */
export const NUMBER_CAPS: Record<string, number> = {
    DecimalMax10: 10,
    DecimalMax100: 100,
    DecimalMax500: 500,
    DecimalMax1000: 1000,
    DecimalMax10000: 10000,
    DecimalMax100000: 100000,
    DecimalMax1000000: 1000000,
    DecimalMax10000000: 10000000,
    WholeNumMax100: 100,
    WholeNumMax500: 500,
    WholeNumMax1000: 1000,
    NaturalNumMax200: 200,
    NaturalNumMax10000: 10000,
};

/** The 27 question types the field app renders, in the order the builder offers them. */
export const PRODUCTION_TYPES: BackendQuestionType[] = [
    "Radio",
    "Checkbox",
    "Selected Dropdown",
    "Subjective",
    "TextArea",
    "MobileNumMAX10",
    "WholeNumMax100",
    "WholeNumMax500",
    "WholeNumMax1000",
    "NaturalNumMax200",
    "NaturalNumMax10000",
    "DecimalMax10",
    "DecimalMax100",
    "DecimalMax500",
    "DecimalMax1000",
    "DecimalMax10000",
    "DecimalMax100000",
    "DecimalMax1000000",
    "DecimalMax10000000",
    "CalendarWithDate",
    "Time",
    "Picture Input",
    "Video",
    "Map",
    "QRCode",
    "Rating",
    "Repeater_QT",
];
export const isProductionType = (type: string) => (PRODUCTION_TYPES as string[]).includes(type);

/** Qn_Disp_Value for each type (one per type in production). */
export function displayValueOf(type: string): string {
    if (type in NUMBER_CAPS || type === "MobileNumMAX10") return "Number";
    const named: Record<string, string> = {
        Radio: "Single Choice",
        Checkbox: "Multiple Choice",
        "Selected Dropdown": "Dropdown",
        Subjective: "Short Text",
        TextArea: "Long Text",
        CalendarWithDate: "Calendar",
        Map: "Location",
        QRCode: "Short Text",
    };
    return named[type] ?? type;
}

const isNumberType = (type: string) => type in NUMBER_CAPS || type === "MobileNumMAX10";

/** Min_Char / Max_Char of a new question. */
export function defaultLimits(type: string): { min: number; max: number } {
    if (type in NUMBER_CAPS) return { min: 1, max: NUMBER_CAPS[type] };
    if (type === "Repeater_QT") return { min: 1, max: 100 };
    return { min: 1, max: 500 };
}

/** Allowed_Media_Source ↔ the builder's photo source. */
const MEDIA_IN: Record<string, "camera" | "upload" | "both"> = { Camera: "camera", camera_and_gallery: "both", Gallery: "upload" };
const MEDIA_OUT: Record<"camera" | "upload" | "both", string> = { camera: "Camera", both: "camera_and_gallery", upload: "Gallery" };

/** Kept from the imported question and written back as they were (new questions: production's defaults). */
const PASSTHROUGH = ["Age_Range", "is_double_dependent", "Repeat_Dependence", "user_Res", "is_Visible", "Is_Sub_Visible", "Parent_Age", "Is_Age_Parent"] as const;
const KNOWN = new Set<string>([...QUESTION_KEYS, "Allowed_Media_Source"]);

const idOf = (num: number) => `q_${num}`;
const slug = (label: string, i: number) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `opt_${i + 1}`;

function optionsOf(q: ProductionQuestion): OptionItem[] {
    const used = new Set<string>();
    return q.Opt_Name.map((label, i) => {
        let value = slug(label, i);
        while (used.has(value)) value = `${value}_${i + 1}`;
        used.add(value);
        const labels: Record<string, string> = { en: label };
        if (q.S_Opt_Name.length > 0) labels.hi = q.S_Opt_Name[i] ?? "";
        return { id: `opt_${q.Qn_Num}_${i + 1}`, value, labels };
    });
}

/* ------------------------------ Questions ------------------------------ */

/** Production questions → builder questions (ids q_<Qn_Num>; options, show-if and repeaters as builder structures). */
export function decodeQuestions(raw: ProductionQuestion[]): QuestionModel[] {
    const byNum = new Map(raw.map((q) => [q.Qn_Num, q]));
    return raw.map((q) => {
        const options = optionsOf(q);
        const parent = q.Parent_Dep != null ? byNum.get(q.Parent_Dep) : undefined;
        const parentOptions = parent ? optionsOf(parent) : [];
        const conditions: LogicCondition[] =
            q.Is_Cond && q.Parent_Dep != null
                ? q.Opt_Dep.map((index, k) => ({ id: `cond_${q.Qn_Num}_${k + 1}`, questionId: idOf(q.Parent_Dep!), operator: "equals", value: parentOptions[index]?.value ?? String(index) }))
                : [];
        const rawLegacyFields: Record<string, unknown> = {};
        PASSTHROUGH.forEach((k) => (rawLegacyFields[k] = q[k]));
        Object.keys(q).forEach((k) => {
            if (!KNOWN.has(k)) rawLegacyFields[k] = q[k];
        });
        const number = isNumberType(q.Qn_Type);
        const media = q.Allowed_Media_Source !== undefined ? MEDIA_IN[q.Allowed_Media_Source] : undefined;
        // A photo source the builder doesn't know is kept as it is.
        if (q.Allowed_Media_Source !== undefined && !media) rawLegacyFields.Allowed_Media_Source = q.Allowed_Media_Source;
        return {
            id: idOf(q.Qn_Num),
            number: q.Qn_Num,
            displayIndex: q.Qn_In,
            ...(q.Parent_Dep != null ? { parentQuestionId: idOf(q.Parent_Dep), followUpDepth: q.Qn_In.split(".").length } : {}),
            type: q.Qn_Type as BackendQuestionType,
            displayType: q.Qn_Disp_Value,
            columnName: q.Column_Name,
            titles: { en: q.Qn, hi: q.S_Qn },
            ...(options.length > 0 ? { optionSource: "custom" as const, options } : {}),
            validation: {
                required: q.Is_Mandt === true,
                minChar: q.Min_Char,
                maxChar: q.Max_Char,
                ...(number ? { minValue: q.Min_Char, maxValue: q.Max_Char } : {}),
                ...(media ? { allowedMediaSource: media } : {}),
            },
            visibility: { enabled: conditions.length > 0, ruleGroup: { conjunction: conditions.length > 1 ? "OR" : "AND", conditions } },
            ...(q.Repeater ? { repeater: { isRepeater: true, countSourceType: "question" as const, childQuestionIds: q.Qn_Repeat.map(idOf) } } : {}),
            ...(q.IS_Anomaly ? { anomalyDetection: { enabled: true } } : {}),
            rawLegacyFields,
            // A Qn_Deps number with no question behind it (production has a few) is kept as "#<n>".
            production: { depIds: q.Qn_Deps.map((n) => (byNum.has(n) ? idOf(n) : `#${n}`)), childIds: raw.filter((c) => c.Parent_Dep === q.Qn_Num).map((c) => idOf(c.Qn_Num)), optDep: [...q.Opt_Dep] },
        };
    });
}

/** The question whose show-if this one depends on (its follow-up parent), if any. */
function showIfParent(q: QuestionModel, byId: Map<string, QuestionModel>): QuestionModel | undefined {
    const conditions = q.visibility?.enabled ? q.visibility.ruleGroup?.conditions ?? [] : [];
    if (conditions.length === 0) return undefined;
    const id = q.parentQuestionId && byId.has(q.parentQuestionId) ? q.parentQuestionId : conditions[0].questionId;
    return byId.get(id);
}

/** Builder questions (in survey order) → production questions, with numbering, labels and links recomputed. */
export function encodeQuestions(questions: QuestionModel[]): ProductionQuestion[] {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const numOf = new Map(questions.map((q, i) => [q.id, i + 1]));
    const repeaterOf = new Map<string, QuestionModel>();
    questions.forEach((q) => (q.repeater?.isRepeater ? q.repeater.childQuestionIds ?? [] : []).forEach((c) => byId.has(c) && repeaterOf.set(c, q)));
    const parentOf = new Map<string, QuestionModel | undefined>(questions.map((q) => [q.id, showIfParent(q, byId)]));

    // Labels: top-level 1, 2, 3…; a child is its parent's label + ".k" (show-if parent first, else the repeater).
    const label = new Map<string, string>();
    const childCount = new Map<string, number>();
    let top = 0;
    questions.forEach((q) => {
        const parent = parentOf.get(q.id) ?? repeaterOf.get(q.id);
        if (parent && label.has(parent.id)) {
            const k = (childCount.get(parent.id) ?? 0) + 1;
            childCount.set(parent.id, k);
            label.set(q.id, `${label.get(parent.id)}.${k}`);
        } else {
            label.set(q.id, String(++top));
        }
    });

    return questions.map((q) => {
        const parent = parentOf.get(q.id);
        const repeater = repeaterOf.get(q.id);
        const v = q.validation ?? {};
        const limits = defaultLimits(q.type);
        const number = isNumberType(q.type);
        const raw = q.rawLegacyFields ?? {};

        // Show-if: option indexes of the parent's current options; the imported ones when a value no longer matches.
        let optDep: number[] = [];
        if (parent) {
            const conditions = q.visibility.ruleGroup?.conditions ?? [];
            const indexes = conditions.map((c) => (parent.options ?? []).findIndex((o) => o.value === String(c.value)));
            optDep = indexes.every((i) => i >= 0) ? indexes : q.production?.optDep ?? indexes.filter((i) => i >= 0);
        }
        // Qn_Deps: the imported list (minus children that moved to another parent), then new children.
        const children = questions.filter((c) => parentOf.get(c.id)?.id === q.id).map((c) => c.id);
        const imported = (q.production?.depIds ?? []).filter((id) => {
            if (id.startsWith("#")) return true;
            if (!byId.has(id)) return false;
            const wasChild = q.production?.childIds.includes(id);
            return !wasChild || children.includes(id);
        });
        const deps = [...imported, ...children.filter((id) => !imported.includes(id))];

        const media = v.allowedMediaSource;
        const out: ProductionQuestion = {
            Qn: q.titles?.en ?? "",
            S_Qn: q.titles?.hi ?? "",
            Qn_Num: numOf.get(q.id)!,
            Qn_In: label.get(q.id)!,
            Qn_Deps: deps.map((id) => (id.startsWith("#") ? Number(id.slice(1)) : numOf.get(id)!)),
            Opt_Dep: optDep,
            Age_Range: (raw.Age_Range as unknown[]) ?? [],
            Repeater: Boolean(q.repeater?.isRepeater),
            Qn_Repeat: q.repeater?.isRepeater ? (q.repeater.childQuestionIds ?? []).filter((id) => byId.has(id)).map((id) => numOf.get(id)!) : [],
            Opt_Name: (q.options ?? []).map((o) => o.labels.en ?? o.value),
            S_Opt_Name: (q.options ?? []).every((o) => o.labels.hi !== undefined) ? (q.options ?? []).map((o) => o.labels.hi!) : [],
            Is_Mandt: Boolean(v.required),
            Is_Cond: Boolean(parent),
            Min_Char: (number ? v.minValue ?? v.minChar : v.minChar ?? v.minValue) ?? limits.min,
            Max_Char: (number ? v.maxValue ?? v.maxChar : v.maxChar ?? v.maxValue) ?? limits.max,
            IS_Anomaly: Boolean(q.anomalyDetection?.enabled),
            is_double_dependent: (raw.is_double_dependent as boolean) ?? false,
            Repeat_Dependence: raw.Repeat_Dependence ?? null,
            user_Res: (raw.user_Res as unknown[]) ?? [""],
            is_Visible: (raw.is_Visible as boolean) ?? !(parent || repeater),
            Is_Sub_Visible: (raw.Is_Sub_Visible as boolean) ?? deps.length > 0,
            Parent_Age: raw.Parent_Age ?? null,
            Parent_Dep: parent ? numOf.get(parent.id)! : null,
            Parent_Repeat: repeater ? numOf.get(repeater.id)! : null,
            Is_Age_Parent: (raw.Is_Age_Parent as boolean) ?? false,
            Qn_Type: q.type,
            Qn_Disp_Value: displayValueOf(q.type),
            Column_Name: q.columnName,
        };
        if (media) out.Allowed_Media_Source = MEDIA_OUT[media];
        else if (raw.Allowed_Media_Source !== undefined) out.Allowed_Media_Source = raw.Allowed_Media_Source;
        Object.keys(raw).forEach((k) => {
            if (!KNOWN.has(k)) out[k] = raw[k];
        });
        return out;
    });
}

/* ------------------------------ Surveys ------------------------------ */

/** Where a survey came from in the file, so the export rebuilds the same row or task survey around new questions. */
export interface ProductionSurveyInfo {
    kind: "row" | "task";
    /** The row (array) or task survey (object) as imported, questions emptied; written back with new questions. */
    template: unknown;
    /** Task surveys: the id of the row they sit in, and their place there. */
    rowId?: string;
    index: number;
}

const REGISTRATION_FLAG = 17;

/** The questionnaire file → one builder survey per row and per task survey, ids kept. */
export function decodeQuestionnaire(rows: unknown[][], now: string): SurveyModel[] {
    const surveys: SurveyModel[] = [];
    const base = (id: string, name: string, version: string, createdAt: string | undefined, questions: ProductionQuestion[]): SurveyModel => ({
        id,
        azId: "ALL",
        name: name || id,
        defaultLocale: "en",
        locales: [
            { code: "en", label: "English", isDefault: true },
            { code: "hi", label: "Hindi" },
        ],
        status: "Published",
        version: parseInt(version.replace(/\D/g, ""), 10) || 0,
        versionTag: version || "v0",
        createdAt: createdAt || now,
        updatedAt: createdAt || now,
        publishedAt: createdAt || now,
        createdBy: "Production",
        questions: decodeQuestions(questions),
        statuses: ["planned", "collected", "verified", "expired", "cancelled"],
    });
    rows.forEach((row, rowIndex) => {
        const id = String(row[6]);
        const table = typeof row[19] === "string" ? row[19] : "";
        const survey = base(id, String(row[3] ?? ""), String(row[18] ?? "v0"), typeof row[5] === "string" ? row[5] : undefined, (row[0] as ProductionQuestion[]) ?? []);
        const template = row.map((v, i) => (i === 0 ? [] : i === 11 && Array.isArray(v) ? [] : v));
        surveys.push({
            ...survey,
            description: table ? `Questionnaire table ${table}` : undefined,
            ...(row[REGISTRATION_FLAG] === true ? { systemSurvey: "farmer_registration" as const, category: "Farmer Enrollment" } : {}),
            metadata: { production: { kind: "row", template, index: rowIndex } as ProductionSurveyInfo, table },
        });
        const tasks = Array.isArray(row[11]) ? (row[11] as Record<string, unknown>[]) : [];
        tasks.forEach((t, index) => {
            const az = typeof t.az === "string" ? t.az.toUpperCase() : "ALL";
            const s = base(String(t.qID), String(t.surveyName ?? ""), String(t.version ?? "v0"), typeof t.createdAt === "string" ? t.createdAt : undefined, (t.question as ProductionQuestion[]) ?? []);
            surveys.push({
                ...s,
                azId: az,
                description: `${az} · table ${String(t.surveyTable ?? "")}`,
                metadata: { production: { kind: "task", template: { ...t, question: [] }, rowId: id, index } as ProductionSurveyInfo, table: t.surveyTable, group: row[10] },
            });
        });
    });
    return surveys;
}

const infoOf = (s: SurveyModel) => s.metadata?.production as ProductionSurveyInfo | undefined;

/**
 * One survey in production shape: a task survey object (qID, surveyName, question, …) — what a new survey becomes —
 * or, for a questionnaire row, the row array. Imported surveys keep every field they came with; the name and
 * questions come from the builder.
 */
export function encodeSurvey(survey: SurveyModel): Record<string, unknown> | unknown[] {
    const question = encodeQuestions(survey.questions);
    const info = infoOf(survey);
    if (info?.kind === "row") {
        const row = [...(info.template as unknown[])];
        row[0] = question;
        row[3] = survey.name;
        return row;
    }
    const template = (info?.template as Record<string, unknown>) ?? {
        qID: survey.id,
        adminID: null,
        question: [],
        surveyName: survey.name,
        surveyType: 4,
        anamoly: false,
        cascadeLocation: [],
        createdAt: survey.createdAt,
        parent_group: null,
        child_group: null,
        group_name: null,
        isGrouped: null,
        version: survey.versionTag || "v0",
        surveyTable: (survey.metadata?.table as string) ?? "",
        az: survey.azId ? survey.azId.toLowerCase() : null,
    };
    return { ...template, question, surveyName: survey.name };
}

/** The whole file again: each row with its task surveys back in place, in the original order. New surveys are left out. */
export function encodeQuestionnaire(surveys: SurveyModel[]): unknown[][] {
    const rows = surveys.filter((s) => infoOf(s)?.kind === "row").sort((a, b) => infoOf(a)!.index - infoOf(b)!.index);
    return rows.map((r) => {
        const row = encodeSurvey(r) as unknown[];
        const tasks = surveys.filter((s) => infoOf(s)?.kind === "task" && infoOf(s)!.rowId === r.id).sort((a, b) => infoOf(a)!.index - infoOf(b)!.index);
        if (tasks.length > 0) row[11] = tasks.map((t) => encodeSurvey(t));
        return row;
    });
}
