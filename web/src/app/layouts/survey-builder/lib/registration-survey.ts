/**
 * The built-in Farmer Registration survey: the one survey that registers farmers, and where every farmer starts.
 *
 * Defined here in code and seeded into the survey store (services/survey-service.ts) when it's missing, so it always
 * exists. It shows in the Survey Builder like any survey, but can't be deleted, duplicated or archived, and only a
 * Super Admin can edit it (fork a draft, add questions, publish). Its system fields (farmer name, village, plot
 * boundary; lib/system-fields.ts) stay locked for everyone. It isn't a workflow step: workflows start for a farmer
 * once they reach the workflow's start status (verified by default).
 *
 * The extra questions are the owner / NoC / land-area questions of the Wheat Plot Enrollment template
 * (services/mock-surveys.ts).
 */
import { DEFAULT_SURVEY_STATUSES, type QuestionModel, type SurveyModel } from "../types/survey-schema";
import { FARMER_ENROLLMENT, REGISTRATION_SURVEY_ID, syncSystemFields } from "./system-fields";

const NO_LOGIC: QuestionModel["visibility"] = { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } };

const question = (q: Omit<QuestionModel, "number" | "displayIndex" | "visibility"> & Partial<Pick<QuestionModel, "visibility">>): QuestionModel => ({
    number: 0,
    displayIndex: "",
    visibility: NO_LOGIC,
    ...q,
});

/** The questions after the system fields. */
const EXTRA_QUESTIONS: QuestionModel[] = [
    question({
        id: "q_reg_phone",
        type: "Subjective",
        displayType: "Subjective",
        columnName: "farmer_phone",
        titles: { en: "Farmer's mobile number", hi: "किसान का मोबाइल नंबर" },
        validation: { required: true, presetId: "phone_in" },
    }),
    question({
        id: "q_reg_owner",
        type: "Radio",
        displayType: "Radio",
        columnName: "is_owner",
        titles: { en: "Are you the owner of the farm?", hi: "क्या आप खेत के मालिक हैं?" },
        options: [
            { id: "opt_reg_owner_yes", value: "yes", labels: { en: "Yes", hi: "हाँ" } },
            { id: "opt_reg_owner_no", value: "no", labels: { en: "No", hi: "नहीं" } },
        ],
        validation: { required: true },
    }),
    question({
        id: "q_reg_noc",
        parentQuestionId: "q_reg_owner",
        type: "Picture Input",
        displayType: "Picture Input",
        columnName: "noc_doc_photo",
        titles: {
            en: "If not the owner, upload signed NoC document or lease agreement",
            hi: "यदि मालिक नहीं हैं, तो हस्ताक्षरित अनापत्ति प्रमाण पत्र (NoC) या पट्टा समझौता अपलोड करें",
        },
        validation: { required: true },
        visibility: { enabled: true, ruleGroup: { conjunction: "AND", conditions: [{ id: "cond_reg_noc", questionId: "q_reg_owner", operator: "equals", value: "no" }] } },
    }),
    question({
        id: "q_reg_area",
        type: "DecimalMax100",
        displayType: "DecimalMax100",
        columnName: "mati_land_area_acres",
        titles: { en: "How much land area is for the Mati deployment? (in Acres)", hi: "माटी परिनियोजन (Mati deployment) के लिए कितना भूमि क्षेत्र है? (एकड़ में)" },
        validation: { required: true },
    }),
];

/** Number the questions top to bottom; a follow-up is numbered under its parent ("4.1"). */
function numbered(questions: QuestionModel[]): QuestionModel[] {
    let top = 0;
    const sub = new Map<string, number>();
    const indexOf = new Map<string, string>();
    return questions.map((q) => {
        if (q.parentQuestionId && indexOf.has(q.parentQuestionId)) {
            const n = (sub.get(q.parentQuestionId) ?? 0) + 1;
            sub.set(q.parentQuestionId, n);
            const displayIndex = `${indexOf.get(q.parentQuestionId)}.${n}`;
            return { ...q, number: top, displayIndex, followUpDepth: 2 };
        }
        top += 1;
        indexOf.set(q.id, String(top));
        return { ...q, number: top, displayIndex: String(top) };
    });
}

/** The survey as first seeded: published v1, system fields first. */
export function builtInRegistrationSurvey(now: string): SurveyModel {
    const base: SurveyModel = {
        id: REGISTRATION_SURVEY_ID,
        systemSurvey: "farmer_registration",
        azId: "AZ2",
        name: "Farmer Registration",
        description: "Registers a farmer. Built in: every farmer starts here. Only a Super Admin can edit it.",
        category: FARMER_ENROLLMENT,
        defaultLocale: "en",
        locales: [
            { code: "en", label: "English", isDefault: true },
            { code: "hi", label: "Hindi" },
        ],
        status: "Published",
        version: 1,
        versionTag: "v1",
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        createdBy: "System",
        questions: EXTRA_QUESTIONS,
        statuses: [...DEFAULT_SURVEY_STATUSES],
    };
    const withFields = syncSystemFields(base);
    return { ...withFields, questions: numbered(withFields.questions) };
}

/** The stored surveys with the built-in one present (added when missing; kept marked and categorised when found). */
export function withRegistrationSurvey(surveys: SurveyModel[], now: string): SurveyModel[] {
    const found = surveys.find((s) => s.id === REGISTRATION_SURVEY_ID);
    if (!found) return [builtInRegistrationSurvey(now), ...surveys];
    if (found.systemSurvey === "farmer_registration" && found.category === FARMER_ENROLLMENT) return surveys;
    return surveys.map((s) => (s.id === REGISTRATION_SURVEY_ID ? { ...s, systemSurvey: "farmer_registration" as const, category: FARMER_ENROLLMENT } : s));
}
