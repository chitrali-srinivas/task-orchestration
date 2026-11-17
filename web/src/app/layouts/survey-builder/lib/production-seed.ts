/**
 * The production surveys in the builder: every survey of data/questionnaire.prod.json (11 questionnaire rows and the
 * 66 task surveys inside them) is added to the survey store when it isn't there yet, under its production id. Surveys
 * already in the store are left as they are (edits are kept); a newer file only adds what's new.
 *
 * Production's Farmer_Registration is the built-in registration survey: only a Super Admin edits it, and it holds the
 * system fields planning needs (lib/system-fields.ts) — farmer_name and village_name as they are, plus a locked
 * plot_location Map question after the village.
 */
import type { SurveyModel } from "../types/survey-schema";
import { decodeQuestionnaire, encodeQuestions } from "./production-contract";
import { FARMER_ENROLLMENT, REGISTRATION_SURVEY_ID, syncSystemFields } from "./system-fields";

/** The registration survey this app seeded before the production questionnaire was in the code. */
const PLACEHOLDER_ID = "srv_farmer_registration";

/** Numbers and labels by production's rules (position; parent label + ".k"). */
function renumbered(survey: SurveyModel): SurveyModel {
    const encoded = encodeQuestions(survey.questions);
    return { ...survey, questions: survey.questions.map((q, i) => ({ ...q, number: encoded[i].Qn_Num, displayIndex: encoded[i].Qn_In })) };
}

/** The registration survey marked, categorised and holding its system fields. Same survey back when it already is. */
function asRegistration(survey: SurveyModel): SurveyModel {
    const marked = survey.systemSurvey === "farmer_registration" && survey.category === FARMER_ENROLLMENT ? survey : { ...survey, systemSurvey: "farmer_registration" as const, category: FARMER_ENROLLMENT };
    const synced = syncSystemFields(marked);
    return synced === survey ? survey : renumbered(synced);
}

/** The stored surveys with every production survey present. Same array back when nothing changed. */
export function withProductionSurveys(stored: SurveyModel[], rows: unknown[][], now: string): SurveyModel[] {
    const kept = stored.filter((s) => !(s.id === PLACEHOLDER_ID && s.createdBy === "System"));
    const have = new Set(kept.map((s) => s.id));
    const added = decodeQuestionnaire(rows, now).filter((s) => !have.has(s.id));
    const all = [...kept, ...added];
    let changed = kept.length !== stored.length || added.length > 0;
    const next = all.map((s) => {
        if (s.id !== REGISTRATION_SURVEY_ID) return s;
        const reg = asRegistration(s);
        if (reg !== s) changed = true;
        return reg;
    });
    return changed ? next : stored;
}
