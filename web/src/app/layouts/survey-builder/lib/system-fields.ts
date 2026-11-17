/**
 * System fields: questions planning can't work without, defined here in code (like the masters).
 *
 * The built-in Farmer Registration survey (production's Farmer_Registration, seeded from data/questionnaire.prod.json
 * by lib/production-seed.ts) holds the farmer name, the village and the plot location, on production's columns.
 * Each carries a fixed `systemKey`, so the planner reads it by key instead of guessing from titles. In the builder
 * they can't be deleted, duplicated, retyped, made optional, hidden by logic or put in a repeater, not even by a
 * Super Admin; wording, hint, translations and position stay editable. Only types the field app renders are used.
 *
 * Pure: no React, no storage. Run the tests with: node --test src/app/layouts/survey-builder/lib/system-fields.test.ts
 */
import type { BackendQuestionType, QuestionModel, SurveyModel } from "../types/survey-schema";

export type SystemFieldKey = "farmer.name" | "farmer.village" | "farmer.plot";

/** The category (lib/category-registry.ts, id `farmer_enrollment`) of the built-in registration survey. */
export const FARMER_ENROLLMENT = "Farmer Enrollment";

/** Id of the built-in Farmer Registration survey (production's Farmer_Registration): edited only by a Super Admin. */
export const REGISTRATION_SURVEY_ID = "3756719938187133848";
export const isRegistrationSurvey = (survey: { id?: string; systemSurvey?: string } | undefined) =>
    survey?.id === REGISTRATION_SURVEY_ID || survey?.systemSurvey === "farmer_registration";

export interface SystemFieldDefinition {
    key: SystemFieldKey;
    label: string;
    /** Why it's locked, shown on the badge and in publish errors. */
    purpose: string;
    type: BackendQuestionType;
    columnName: string;
    titles: Record<string, string>;
}

export const SYSTEM_FIELDS: SystemFieldDefinition[] = [
    {
        key: "farmer.name",
        label: "Farmer name",
        purpose: "How the farmer is shown on tasks, jobs and the phone.",
        type: "Subjective",
        columnName: "farmer_name",
        titles: { en: "Farmer Name?", hi: "किसान का नाम?" },
    },
    {
        key: "farmer.village",
        label: "Village",
        purpose: "Groups farmers by village, and planning falls back to the village centre (matched by name).",
        type: "Subjective",
        columnName: "village_name",
        titles: { en: "Village Name?", hi: "गांव का नाम?" },
    },
    {
        key: "farmer.plot",
        label: "Plot location",
        purpose: "Planning sends the surveyor to this GPS point.",
        type: "Map",
        columnName: "plot_location",
        titles: { en: "Plot location", hi: "खेत का स्थान" },
    },
];

const NO_LOGIC: QuestionModel["visibility"] = { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } };
/** Legacy fields that make a question a follow-up or a repeater child. */
const NESTING_FIELDS = ["Parent_Dep", "Opt_Dep", "Parent_Repeat", "Qn_In"];

export function isFarmerEnrollment(survey: { category?: string } | undefined): boolean {
    const c = (survey?.category || "").trim().toLowerCase();
    return c === FARMER_ENROLLMENT.toLowerCase() || c === "farmer_enrollment";
}

export function systemFieldOf(q: { systemKey?: string } | undefined): SystemFieldDefinition | undefined {
    return q?.systemKey ? SYSTEM_FIELDS.find((f) => f.key === q.systemKey) : undefined;
}

/** Re-apply what a system field must be, whatever was edited: type, column, required, no logic, top level. */
export function lockQuestion(q: QuestionModel, def: SystemFieldDefinition): QuestionModel {
    const legacy = q.rawLegacyFields ? Object.fromEntries(Object.entries(q.rawLegacyFields).filter(([k]) => !NESTING_FIELDS.includes(k))) : undefined;
    const out: QuestionModel = {
        ...q,
        systemKey: def.key,
        type: def.type,
        displayType: def.type,
        columnName: def.columnName,
        validation: { ...q.validation, required: true },
        visibility: NO_LOGIC,
        ...(legacy ? { rawLegacyFields: legacy } : {}),
    };
    delete out.parentQuestionId;
    delete out.followUpDepth;
    delete out.repeater;
    return out;
}

/** Lock every tagged question and take them out of any repeater. Returns the same array when nothing changed. */
export function lockSystemFields(questions: QuestionModel[]): QuestionModel[] {
    const systemIds = new Set(questions.filter((q) => systemFieldOf(q)).map((q) => q.id));
    if (systemIds.size === 0) return questions;
    const next = questions.map((q) => {
        const def = systemFieldOf(q);
        if (def) return lockQuestion(q, def);
        const children = q.repeater?.childQuestionIds;
        if (children?.some((id) => systemIds.has(id))) {
            return { ...q, repeater: { ...q.repeater!, childQuestionIds: children.filter((id) => !systemIds.has(id)) } };
        }
        return q;
    });
    return JSON.stringify(next) === JSON.stringify(questions) ? questions : next;
}

/** "Farmer name", "Farmer's name", "Name" (not "Father's name" or "Village name"). */
const asksFarmerName = (q: QuestionModel) =>
    ["farmer_name", "farmername", "name"].includes((q.columnName || "").toLowerCase()) || /^\s*(farmer('?s)?\s+)?name\s*$/i.test(q.titles?.en || "");
const isTopLevel = (q: QuestionModel, questions: QuestionModel[]) =>
    !q.parentQuestionId && !questions.some((p) => p.repeater?.childQuestionIds?.includes(q.id));

/** An untagged question that already asks for this field (so an older survey keeps its question and answers). */
function existingFor(def: SystemFieldDefinition, questions: QuestionModel[]): QuestionModel | undefined {
    const candidates = questions.filter((q) => !q.systemKey && isTopLevel(q, questions));
    if (def.key === "farmer.plot") return candidates.find((q) => q.type === "Map" && ["plot_location", "location_plot"].includes(q.columnName));
    if (def.key === "farmer.village") return candidates.find((q) => q.type === "Subjective" && q.columnName === "village_name");
    return candidates.find((q) => q.type === "Subjective" && asksFarmerName(q));
}

function newQuestion(def: SystemFieldDefinition, questions: QuestionModel[]): QuestionModel {
    const base = `q_${def.key.replace(/\W/g, "_")}`;
    let id = base;
    for (let i = 2; questions.some((q) => q.id === id); i++) id = `${base}_${i}`;
    return lockQuestion(
        {
            id,
            number: 0,
            displayIndex: "",
            type: def.type,
            columnName: def.columnName,
            titles: { ...def.titles },
            validation: { required: true },
            visibility: NO_LOGIC,
        },
        def
    );
}

/**
 * Bring a survey's system fields in line: the registration survey gets them (questions that already ask for them are
 * tagged; missing ones go right after the last system field there is, or at the top, in SYSTEM_FIELDS order) and
 * they're locked. Any other survey loses the tags, so those questions become ordinary ones. Returns the same survey
 * when nothing changed; renumbering is the caller's.
 */
export function syncSystemFields<S extends Pick<SurveyModel, "id" | "systemSurvey" | "questions">>(survey: S): S {
    let questions = survey.questions;
    if (!isRegistrationSurvey(survey)) {
        if (!questions.some((q) => q.systemKey)) return survey;
        return {
            ...survey,
            questions: questions.map((q) => {
                if (!q.systemKey) return q;
                const rest = { ...q };
                delete rest.systemKey;
                return rest;
            }),
        };
    }
    // One question per key: the first keeps it, later copies become ordinary questions.
    const seen = new Set<string>();
    questions = questions.map((q) => {
        if (!q.systemKey) return q;
        if (!systemFieldOf(q) || seen.has(q.systemKey)) {
            const rest = { ...q };
            delete rest.systemKey;
            return rest;
        }
        seen.add(q.systemKey);
        return q;
    });
    const added: QuestionModel[] = [];
    SYSTEM_FIELDS.forEach((def) => {
        if (seen.has(def.key)) return;
        const existing = existingFor(def, questions);
        if (existing) {
            questions = questions.map((q) => (q.id === existing.id ? { ...q, systemKey: def.key } : q));
        } else {
            added.push(newQuestion(def, [...questions, ...added]));
        }
    });
    let at = 0;
    questions.forEach((q, i) => {
        if (q.systemKey) at = i + 1;
    });
    const next = lockSystemFields([...questions.slice(0, at), ...added, ...questions.slice(at)]);
    return JSON.stringify(next) === JSON.stringify(survey.questions) ? survey : { ...survey, questions: next };
}

export interface SystemFieldIssue {
    key: SystemFieldKey;
    questionId?: string;
    message: string;
}

/** What stops the registration survey from being published: a system field missing or changed. */
export function systemFieldIssues(survey: Pick<SurveyModel, "id" | "systemSurvey" | "questions">): SystemFieldIssue[] {
    if (!isRegistrationSurvey(survey)) return [];
    const issues: SystemFieldIssue[] = [];
    SYSTEM_FIELDS.forEach((def) => {
        const tagged = survey.questions.filter((q) => q.systemKey === def.key);
        if (tagged.length === 0) {
            issues.push({ key: def.key, message: `${def.label} is missing. The registration survey must ask for it: ${def.purpose}` });
            return;
        }
        if (tagged.length > 1) issues.push({ key: def.key, questionId: tagged[1].id, message: `${def.label} is asked more than once.` });
        const q = tagged[0];
        const problems: string[] = [];
        if (q.type !== def.type) problems.push("its type was changed");
        if (q.columnName !== def.columnName) problems.push("its column name was changed");
        if (!q.validation?.required) problems.push("it isn't required");
        if (q.visibility?.enabled) problems.push("it has show-if logic");
        if (!isTopLevel(q, survey.questions)) problems.push("it is inside a repeater or under another question");
        if (problems.length > 0) issues.push({ key: def.key, questionId: q.id, message: `${def.label}: ${problems.join(", ")}.` });
    });
    return issues;
}
