// Run: node --test src/app/layouts/survey-builder/lib/system-fields.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { QuestionModel } from "../types/survey-schema.ts";
import { REGISTRATION_SURVEY_ID, SYSTEM_FIELDS, isFarmerEnrollment, isRegistrationSurvey, lockSystemFields, syncSystemFields, systemFieldIssues } from "./system-fields.ts";

const q = (id: string, type: QuestionModel["type"], extra: Partial<QuestionModel> = {}): QuestionModel => ({
    id,
    number: 0,
    displayIndex: "",
    type,
    columnName: id,
    titles: { en: id },
    validation: {},
    visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    ...extra,
});
const enrollment = (questions: QuestionModel[]) => ({ id: REGISTRATION_SURVEY_ID, category: "Farmer Enrollment", questions });
const keys = (questions: QuestionModel[]) => questions.map((x) => x.systemKey ?? "-");

test("the built-in registration survey is the one that registers farmers", () => {
    assert.equal(isRegistrationSurvey({ id: REGISTRATION_SURVEY_ID }), true);
    assert.equal(isRegistrationSurvey({ id: "x", systemSurvey: "farmer_registration" }), true);
    assert.equal(isRegistrationSurvey({ id: "srv_1" }), false);
    assert.equal(isFarmerEnrollment({ category: "farmer_enrollment" }), true);
    assert.equal(isFarmerEnrollment({ category: "Field Operations" }), false);
});

test("the registration survey gets name, village and plot at the top, locked", () => {
    const out = syncSystemFields(enrollment([q("crop", "Radio")]));
    assert.deepEqual(keys(out.questions), ["farmer.name", "farmer.village", "farmer.plot", "-"]);
    const [name, village, plot] = out.questions;
    assert.deepEqual([name.type, name.columnName], ["Subjective", "farmer_name"]);
    assert.deepEqual([village.type, village.columnName], ["Subjective", "village_name"]);
    assert.deepEqual([plot.type, plot.columnName], ["Map", "plot_location"]);
    assert.ok(out.questions.slice(0, 3).every((x) => x.validation.required && !x.visibility.enabled));
    assert.deepEqual(systemFieldIssues(out), []);
    // Idempotent: the same object back when nothing needs doing.
    assert.equal(syncSystemFields(out), out);
});

test("questions that already ask for a field are tagged in place; a missing one goes after the last system field", () => {
    const name = q("q1", "Subjective", { columnName: "farmer_name", titles: { en: "Farmer Name?" } });
    const father = q("q3", "Subjective", { titles: { en: "Father's name" } });
    const village = q("q9", "Subjective", { columnName: "village_name", titles: { en: "Village Name?" } });
    const land = q("q10", "DecimalMax1000");
    const out = syncSystemFields(enrollment([name, father, village, land]));
    assert.deepEqual(keys(out.questions), ["farmer.name", "-", "farmer.village", "farmer.plot", "-"]);
    assert.deepEqual(out.questions.map((x) => x.id), ["q1", "q3", "q9", "q_farmer_plot", "q10"]);
    assert.equal(out.questions[0].titles.en, "Farmer Name?");
    // A plot already asked as a Map question is adopted.
    const spot = q("q4", "Map", { columnName: "plot_location", titles: { en: "Where is the plot?" } });
    assert.deepEqual(keys(syncSystemFields(enrollment([name, village, spot])).questions), ["farmer.name", "farmer.village", "farmer.plot"]);
});

test("other surveys lose the tags (even Farmer Enrollment ones); a second copy of a key becomes ordinary", () => {
    const tagged = syncSystemFields(enrollment([]));
    assert.deepEqual(keys(syncSystemFields({ id: "srv_old", category: "Farmer Enrollment", questions: tagged.questions }).questions), ["-", "-", "-"]);
    const dup = { ...tagged.questions[2], id: "copy" };
    assert.deepEqual(keys(syncSystemFields(enrollment([...tagged.questions, dup])).questions), ["farmer.name", "farmer.village", "farmer.plot", "-"]);
});

test("locking undoes edits a system field can't take and pulls it out of a repeater", () => {
    const [, , plot] = syncSystemFields(enrollment([])).questions;
    const edited = { ...plot, type: "Subjective" as const, columnName: "gps", validation: { required: false }, visibility: { enabled: true, ruleGroup: { conjunction: "AND" as const, conditions: [] } }, titles: { en: "Mark the plot" } };
    const repeater = q("rep", "Repeater_QT", { repeater: { isRepeater: true, countSourceType: "fixed", fixedCount: 2, childQuestionIds: [plot.id, "other"] } });
    const [locked, rep] = lockSystemFields([edited, repeater]);
    assert.equal(locked.type, "Map");
    assert.equal(locked.columnName, "plot_location");
    assert.equal(locked.validation.required, true);
    assert.equal(locked.visibility.enabled, false);
    assert.equal(locked.titles.en, "Mark the plot");
    assert.deepEqual(rep.repeater?.childQuestionIds, ["other"]);
});

test("publish issues: a missing or loosened system field is reported with its question", () => {
    const [name, village, plot] = syncSystemFields(enrollment([])).questions;
    const issues = systemFieldIssues(enrollment([name, { ...plot, validation: { ...plot.validation, required: false } }]));
    assert.deepEqual(issues.map((i) => i.key), ["farmer.village", "farmer.plot"]);
    assert.equal(issues[1].questionId, plot.id);
    assert.match(issues[0].message, /missing/);
    assert.deepEqual(systemFieldIssues({ id: "srv_other", questions: [village] }), []);
    assert.equal(SYSTEM_FIELDS.length, 3);
});
