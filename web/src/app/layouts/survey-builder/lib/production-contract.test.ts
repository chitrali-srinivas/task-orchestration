// Run: node --test src/app/layouts/survey-builder/lib/production-contract.test.ts   (Node 24 strips types natively)
// The production questionnaire must come back unchanged after a trip through the builder, and questions made in the
// builder must come out in the same shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { QuestionModel } from "../types/survey-schema.ts";
import { PRODUCTION_TYPES, QUESTION_KEYS, decodeQuestionnaire, displayValueOf, encodeQuestionnaire, encodeQuestions, encodeSurvey } from "./production-contract.ts";
import { syncSystemFields } from "./system-fields.ts";

const rows = JSON.parse(readFileSync(new URL("../data/questionnaire.prod.json", import.meta.url), "utf8")) as unknown[][];
const surveys = decodeQuestionnaire(rows, "2026-11-17T00:00:00Z");

test("the file holds 11 questionnaire rows and 66 task surveys, ids kept; one is the registration survey", () => {
    assert.equal(rows.length, 11);
    assert.equal(surveys.length, 77);
    assert.equal(new Set(surveys.map((s) => s.id)).size, 77);
    assert.equal(surveys.reduce((n, s) => n + s.questions.length, 0), 873);
    const reg = surveys.filter((s) => s.systemSurvey === "farmer_registration");
    assert.deepEqual(reg.map((s) => [s.id, s.name]), [[String(rows[1][6]), "Farmer_Registration"]]);
});

test("every survey and question round-trips: the exported file equals the production file", () => {
    const again = encodeQuestionnaire(surveys);
    assert.equal(again.length, rows.length);
    let checked = 0;
    rows.forEach((row, r) => {
        // Every row field except the questions and task surveys, which are compared one by one below.
        row.forEach((v, i) => {
            if (i !== 0 && i !== 11) assert.deepEqual(again[r][i], v, `row ${r} field ${i}`);
        });
        const pairs: [unknown, unknown, string][] = [[row[0], again[r][0], `row ${r}`]];
        if (Array.isArray(row[11])) {
            const tasks = row[11] as Record<string, unknown>[];
            const tasksAgain = again[r][11] as Record<string, unknown>[];
            assert.equal(tasksAgain.length, tasks.length);
            tasks.forEach((t, k) => {
                const { question, ...meta } = t;
                const { question: qAgain, ...metaAgain } = tasksAgain[k];
                assert.deepEqual(metaAgain, meta, `task ${k} of row ${r}`);
                pairs.push([question, qAgain, `${String(t.surveyName)}`]);
            });
        }
        pairs.forEach(([original, exported, where]) => {
            const a = original as Record<string, unknown>[];
            const b = exported as Record<string, unknown>[];
            assert.equal(b.length, a.length, where);
            a.forEach((q, i) => {
                assert.deepEqual(b[i], q, `${where} Q${String(q.Qn_In)} (${String(q.Column_Name)})`);
                checked++;
            });
        });
    });
    assert.equal(checked, 873);
});

test("the builder offers exactly the 27 types the app uses, each with production's display value", () => {
    const used = new Set<string>();
    const walk = (qs: { Qn_Type: string; Qn_Disp_Value: string }[]) =>
        qs.forEach((q) => {
            used.add(q.Qn_Type);
            assert.equal(displayValueOf(q.Qn_Type), q.Qn_Disp_Value, q.Qn_Type);
        });
    rows.forEach((row) => {
        walk(row[0] as never);
        if (Array.isArray(row[11])) (row[11] as { question: never }[]).forEach((t) => walk(t.question));
    });
    assert.deepEqual([...used].sort(), [...PRODUCTION_TYPES].sort());
});

const q = (id: string, type: QuestionModel["type"], extra: Partial<QuestionModel> = {}): QuestionModel => ({
    id,
    number: 0,
    displayIndex: "",
    type,
    columnName: id,
    titles: { en: id, hi: "" },
    validation: {},
    visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    ...extra,
});

test("questions made in the builder come out with all 28 fields, production defaults, show-if and repeaters", () => {
    const owner = q("owner", "Radio", {
        validation: { required: true },
        options: [
            { id: "o1", value: "yes", labels: { en: "Yes", hi: "हाँ" } },
            { id: "o2", value: "no", labels: { en: "No", hi: "नहीं" } },
        ],
    });
    const noc = q("noc", "Picture Input", {
        parentQuestionId: "owner",
        validation: { required: true, allowedMediaSource: "camera" },
        visibility: { enabled: true, ruleGroup: { conjunction: "AND", conditions: [{ id: "c", questionId: "owner", operator: "equals", value: "no" }] } },
    });
    const plots = q("plots", "Repeater_QT", { repeater: { isRepeater: true, countSourceType: "question", childQuestionIds: ["area", "spot"] } });
    const area = q("area", "DecimalMax1000000");
    const spot = q("spot", "Map");
    const time = q("time", "Time");
    const out = encodeQuestions([owner, noc, plots, area, spot, time]);

    out.forEach((o) => assert.deepEqual(Object.keys(o).slice(0, QUESTION_KEYS.length), [...QUESTION_KEYS]));
    assert.deepEqual(out.map((o) => [o.Qn_Num, o.Qn_In]), [[1, "1"], [2, "1.1"], [3, "2"], [4, "2.1"], [5, "2.2"], [6, "3"]]);
    assert.deepEqual([out[0].Qn_Deps, out[0].Is_Sub_Visible, out[0].Is_Mandt, out[0].Qn_Disp_Value, out[0].S_Opt_Name], [[2], true, true, "Single Choice", ["हाँ", "नहीं"]]);
    assert.deepEqual([out[1].Is_Cond, out[1].Parent_Dep, out[1].Opt_Dep, out[1].is_Visible, out[1].Allowed_Media_Source], [true, 1, [1], false, "Camera"]);
    assert.deepEqual([out[2].Repeater, out[2].Qn_Repeat, out[2].Min_Char, out[2].Max_Char], [true, [4, 5], 1, 100]);
    assert.deepEqual([out[3].Parent_Repeat, out[3].Max_Char, out[3].Qn_Disp_Value, out[3].is_Visible], [3, 1000000, "Number", false]);
    assert.deepEqual([out[5].Qn_Disp_Value, out[5].Max_Char, out[5].user_Res, out[5].Repeat_Dependence, out[5].Is_Mandt], ["Time", 500, [""], null, false]);

    const survey = encodeSurvey({ id: "srv_new", azId: "AZ2", name: "New survey", defaultLocale: "en", locales: [], status: "Draft", version: 1, versionTag: "v1", createdAt: "", updatedAt: "", createdBy: "", questions: [time] }) as Record<string, unknown>;
    assert.deepEqual(Object.keys(survey), ["qID", "adminID", "question", "surveyName", "surveyType", "anamoly", "cascadeLocation", "createdAt", "parent_group", "child_group", "group_name", "isGrouped", "version", "surveyTable", "az"]);
    assert.deepEqual([survey.qID, survey.surveyName, survey.az, (survey.question as unknown[]).length], ["srv_new", "New survey", "az2", 1]);
});

test("editing an imported survey keeps the links right: a moved question renumbers its parent's lists", () => {
    const reg = surveys.find((s) => s.systemSurvey === "farmer_registration")!;
    // Move the first question to the end: every number shifts, the district follow-up still points at its parent.
    const moved = [...reg.questions.slice(1), reg.questions[0]];
    const out = encodeQuestions(moved);
    const district = out.find((o) => o.Column_Name === "district_name")!;
    const other = out.find((o) => o.Column_Name === "other_district_name")!;
    assert.deepEqual([district.Qn_Deps, other.Parent_Dep, other.Opt_Dep, other.Qn_In], [[other.Qn_Num], district.Qn_Num, [14], `${district.Qn_In}.1`]);
    assert.equal(out.at(-1)!.Column_Name, "farmer_name");
});

test("production's Farmer_Registration keeps its 13 questions and gains the locked plot location after the village", () => {
    const reg = surveys.find((x) => x.systemSurvey === "farmer_registration")!;
    const synced = syncSystemFields(reg);
    const out = encodeQuestions(synced.questions);
    assert.equal(out.length, 14);
    assert.deepEqual(synced.questions.filter((x) => x.systemKey).map((x) => [x.systemKey, x.columnName]), [["farmer.name", "farmer_name"], ["farmer.village", "village_name"], ["farmer.plot", "plot_location"]]);
    const plot = out.find((o) => o.Column_Name === "plot_location")!;
    assert.deepEqual([plot.Qn_Type, plot.Qn_Disp_Value, plot.Is_Mandt, plot.Qn_In], ["Map", "Location", true, "10"]);
    assert.equal(out[plot.Qn_Num - 2].Column_Name, "village_name");
    // The other 13 come out as in production, apart from the numbers after the new question.
    const original = rows[1][0] as Record<string, unknown>[];
    original.forEach((o) => {
        const again = out.find((x) => x.Column_Name === o.Column_Name)!;
        const shift = (o.Qn_Num as number) > 10 ? 1 : 0; // village_name is the 10th question (the district follow-up counts)
        assert.deepEqual({ ...again, Qn_Num: (again.Qn_Num as number) - shift, Qn_In: o.Qn_In, Qn_Deps: o.Qn_Deps, Parent_Dep: o.Parent_Dep }, o, String(o.Column_Name));
    });
});
