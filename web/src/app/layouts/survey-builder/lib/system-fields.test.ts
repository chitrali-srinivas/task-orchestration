// Run: node --test src/app/layouts/survey-builder/lib/system-fields.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { QuestionModel } from "../types/survey-schema.ts";
import { SYSTEM_FIELDS, isFarmerEnrollment, lockSystemFields, syncSystemFields, systemFieldIssues } from "./system-fields.ts";

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
const enrollment = (questions: QuestionModel[]) => ({ category: "Farmer Enrollment", questions });
const keys = (questions: QuestionModel[]) => questions.map((x) => x.systemKey ?? "-");

test("only the Farmer Enrollment category registers farmers", () => {
    assert.equal(isFarmerEnrollment({ category: "Farmer Enrollment" }), true);
    assert.equal(isFarmerEnrollment({ category: "farmer_enrollment" }), true);
    assert.equal(isFarmerEnrollment({ category: "Field Operations" }), false);
    assert.equal(isFarmerEnrollment({}), false);
});

test("a new enrollment survey gets name, village and plot at the top, locked", () => {
    const out = syncSystemFields(enrollment([q("crop", "Radio")]));
    assert.deepEqual(keys(out.questions), ["farmer.name", "farmer.village", "farmer.plot", "-"]);
    const [name, village, plot] = out.questions;
    assert.equal(name.type, "Subjective");
    assert.equal(village.optionSource, "master");
    assert.equal(village.masterDataConfig?.masterSetId, "villages");
    assert.equal(plot.type, "PolygonBoundary");
    assert.equal(plot.validation.minVertices, 3);
    assert.ok(out.questions.slice(0, 3).every((x) => x.validation.required && !x.visibility.enabled));
    assert.deepEqual(systemFieldIssues(out), []);
    // Idempotent: the same object back when nothing needs doing.
    assert.equal(syncSystemFields(out), out);
});

test("questions that already ask for a field are tagged in place, keeping their ids and wording", () => {
    const plot = q("q7", "PolygonBoundary", { titles: { en: "Walk the field" } });
    const village = q("q2", "Selected Dropdown", { optionSource: "master", masterDataConfig: { masterSetId: "villages" } });
    const father = q("q3", "Subjective", { titles: { en: "Father's name" } });
    const name = q("q1", "Subjective", { titles: { en: "Farmer's name" } });
    const out = syncSystemFields(enrollment([name, village, father, plot]));
    assert.deepEqual(keys(out.questions), ["farmer.name", "farmer.village", "-", "farmer.plot"]);
    assert.deepEqual(out.questions.map((x) => x.id), ["q1", "q2", "q3", "q7"]);
    assert.equal(out.questions[3].titles.en, "Walk the field");
    assert.equal(out.questions[3].columnName, "plot_boundary");
});

test("other categories lose the tags; a second copy of a key becomes an ordinary question", () => {
    const tagged = syncSystemFields(enrollment([]));
    assert.deepEqual(keys(syncSystemFields({ category: "Field Operations", questions: tagged.questions }).questions), ["-", "-", "-"]);
    const dup = { ...tagged.questions[2], id: "copy" };
    assert.deepEqual(keys(syncSystemFields(enrollment([...tagged.questions, dup])).questions), ["farmer.name", "farmer.village", "farmer.plot", "-"]);
});

test("locking undoes edits a system field can't take and pulls it out of a repeater", () => {
    const [, , plot] = syncSystemFields(enrollment([])).questions;
    const edited = { ...plot, type: "Map" as const, columnName: "gps", validation: { required: false, minVertices: 1 }, visibility: { enabled: true, ruleGroup: { conjunction: "AND" as const, conditions: [] } }, titles: { en: "Draw the plot" } };
    const repeater = q("rep", "Repeater_QT", { repeater: { isRepeater: true, countSourceType: "fixed", fixedCount: 2, childQuestionIds: [plot.id, "other"] } });
    const [locked, rep] = lockSystemFields([edited, repeater]);
    assert.equal(locked.type, "PolygonBoundary");
    assert.equal(locked.columnName, "plot_boundary");
    assert.equal(locked.validation.required, true);
    assert.equal(locked.validation.minVertices, 3);
    assert.equal(locked.visibility.enabled, false);
    assert.equal(locked.titles.en, "Draw the plot");
    assert.deepEqual(rep.repeater?.childQuestionIds, ["other"]);
});

test("publish issues: a missing or loosened system field is reported with its question", () => {
    const [name, village, plot] = syncSystemFields(enrollment([])).questions;
    const issues = systemFieldIssues(enrollment([name, { ...plot, validation: { ...plot.validation, required: false } }]));
    assert.deepEqual(issues.map((i) => i.key), ["farmer.village", "farmer.plot"]);
    assert.equal(issues[1].questionId, plot.id);
    assert.match(issues[0].message, /missing/);
    assert.deepEqual(systemFieldIssues({ category: "Field Operations", questions: [village] }), []);
    assert.equal(SYSTEM_FIELDS.length, 3);
});
