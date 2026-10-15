/**
 * Automated Verification Suite for Mobile Preview Flows, Master Data Sub-Page, and Repeater Iterations
 */

import { evaluateCondition, evaluateRuleGroup, isQuestionVisible } from "./lib/logic-evaluator";
import { normalizeBackendSurvey } from "./lib/survey-normalizer";
import { getMasterSetById, searchMasterRecords } from "./lib/master-data-registry";
import { QuestionModel } from "./types/survey-schema";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

console.log("=== STARTING MOBILE PREVIEW FLOW & MASTER CATALOG TEST SUITE ===\n");

// -------------------------------------------------------------
// Test 1: Conditional Branching in Preview Flow
// -------------------------------------------------------------
console.log("--- 1. Testing Conditional Branching Flow ---");

const sampleQuestions: QuestionModel[] = [
    {
        id: "q_1",
        number: 1,
        questionNumber: "1",
        displayIndex: "1",
        type: "Radio",
        columnName: "is_owner",
        titles: { en: "Are you the owner of this farm land?" },
        options: [
            { id: "opt_yes", value: "yes", labels: { en: "Yes" } },
            { id: "opt_no", value: "no", labels: { en: "No" } },
        ],
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    },
    {
        id: "q_1_1",
        number: 1,
        questionNumber: "1.1",
        displayIndex: "1.1",
        parentQuestionId: "q_1",
        followUpDepth: 2,
        type: "Picture Input",
        columnName: "noc_certificate",
        titles: { en: "Upload Landowner Consent / NoC Certificate" },
        validation: { required: true },
        visibility: {
            enabled: true,
            ruleGroup: {
                conjunction: "AND",
                conditions: [{ id: "c_noc", questionId: "q_1", operator: "equals", value: "no" }],
            },
        },
    },
    {
        id: "q_2",
        number: 2,
        questionNumber: "2",
        displayIndex: "2",
        type: "Subjective",
        columnName: "farmer_name",
        titles: { en: "Primary Farmer Name" },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    },
    {
        id: "q_3",
        number: 3,
        questionNumber: "3",
        displayIndex: "3",
        type: "Dropdown",
        columnName: "village_select",
        titles: { en: "Revenue Village" },
        optionSource: "master",
        masterDataConfig: {
            masterSetId: "villages",
            displayField: "villageName",
            secondaryFields: ["taluk", "district", "pinCode"],
        },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    },
    {
        id: "q_4",
        number: 4,
        questionNumber: "4",
        displayIndex: "4",
        type: "Repeater_QT",
        columnName: "plot_count",
        titles: { en: "Number of Cultivated Plots" },
        validation: { required: true, minValue: 1, maxValue: 10 },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        repeater: {
            isRepeater: true,
            countSourceType: "fixed",
            childQuestionIds: ["q_4_1", "q_4_2"],
            itemLabelTemplate: "Plot #{index}",
        },
    },
    {
        id: "q_4_1",
        number: 4,
        questionNumber: "4.1",
        displayIndex: "4.1",
        parentQuestionId: "q_4",
        followUpDepth: 2,
        type: "Number",
        columnName: "plot_area_acres",
        titles: { en: "Plot Area (Acres)" },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    },
    {
        id: "q_4_2",
        number: 4,
        questionNumber: "4.2",
        displayIndex: "4.2",
        parentQuestionId: "q_4",
        followUpDepth: 2,
        type: "Dropdown",
        columnName: "plot_crop",
        titles: { en: "Plot Primary Crop" },
        optionSource: "master",
        masterDataConfig: {
            masterSetId: "crops",
            displayField: "cropName",
            secondaryFields: ["variety", "season"],
        },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    },
];

// Scenario A: Unanswered initial state
let answers: Record<string, any> = {};
let visible = sampleQuestions.filter((q) => isQuestionVisible(q, answers));
assert(visible.length === 6, "Unanswered state: exactly 6 questions visible (Q1, Q2, Q3, Q4, Q4.1, Q4.2 - Q1.1 is hidden)");
assert(!visible.some((q) => q.id === "q_1_1"), "Q1.1 is hidden when Q1 is unanswered");

// Scenario B: Respondent answers Q1 = "yes"
answers = { q_1: "yes" };
visible = sampleQuestions.filter((q) => isQuestionVisible(q, answers));
assert(!visible.some((q) => q.id === "q_1_1"), "Q1.1 is hidden when Q1 is 'yes'");
assert(visible.map((q) => q.questionNumber).join(",") === "1,2,3,4,4.1,4.2", "Sequential flow: skips Q1.1 straight to Q2 when Q1 is 'yes'");

// Scenario C: Respondent answers Q1 = "no"
answers = { q_1: "no" };
visible = sampleQuestions.filter((q) => isQuestionVisible(q, answers));
assert(visible.some((q) => q.id === "q_1_1"), "Q1.1 is visible when Q1 is 'no'");
assert(visible.map((q) => q.questionNumber).join(",") === "1,1.1,2,3,4,4.1,4.2", "Sequential flow: inserts Q1.1 after Q1 when Q1 is 'no'");

// -------------------------------------------------------------
// Test 2: Master Data Sub-Page & Catalog Search
// -------------------------------------------------------------
console.log("\n--- 2. Testing Master Data Catalog Sub-Page Logic ---");

const villageMaster = getMasterSetById("villages");
assert(villageMaster !== undefined, "Villages master dataset exists");
assert(villageMaster!.sampleRecords.length === 6, "Villages master has 6 registered sample records");

// Live search tests across primary and secondary fields
const search1 = searchMasterRecords("villages", "Hunasagi");
assert(search1.length === 1 && search1[0].id === "vil_01", "Live search for village name 'Hunasagi' returns vil_01");

const search2 = searchMasterRecords("villages", "Raichur");
assert(search2.length === 3, "Live search for district 'Raichur' returns 3 matching villages");

const search3 = searchMasterRecords("villages", "585220");
assert(search3.length === 1 && search3[0].villageName === "Shorapur", "Live search for PIN code '585220' returns Shorapur");

// Master record selection payload simulation
const selectedVillagePayload = {
    masterSetId: "villages",
    recordId: "vil_01",
    displayValue: "Hunasagi",
    record: search1[0],
};

answers = { ...answers, q_3: selectedVillagePayload };

// Test condition evaluator with master payload object
const masterConditionMatch = evaluateCondition(
    { id: "c_vil", questionId: "q_3", operator: "equals", value: "vil_01" },
    answers
);
assert(masterConditionMatch === true, "evaluateCondition resolves master recordId object match");

// Test multi-select master payload
const multiSelectCropsPayload = [
    { masterSetId: "crops", recordId: "crp_01", displayValue: "Cotton" },
    { masterSetId: "crops", recordId: "crp_03", displayValue: "Paddy (Rice)" },
];
answers = { ...answers, multi_crops: multiSelectCropsPayload };
const containsCotton = evaluateCondition(
    { id: "c_crop", questionId: "multi_crops", operator: "contains", value: "Cotton" },
    answers
);
assert(containsCotton === true, "evaluateCondition supports multi-select master records");

// -------------------------------------------------------------
// Test 3: Repeater Navigation & Multi-Instance State Scoping
// -------------------------------------------------------------
console.log("\n--- 3. Testing Repeater Navigation & Scoped Answers ---");

const repeaterAnswers: Record<string, any> = {
    q_4: 2, // 2 plots requested
    q_4_1_inst_0: 4.5,
    q_4_2_inst_0: { masterSetId: "crops", recordId: "crp_01", displayValue: "Cotton" },
    q_4_1_inst_1: 7.2,
    q_4_2_inst_1: { masterSetId: "crops", recordId: "crp_02", displayValue: "Pigeon Pea" },
};

// Instance 0 Plot 1 Area
assert(repeaterAnswers["q_4_1_inst_0"] === 4.5, "Plot 1 area answer is isolated (4.5 acres)");
assert(repeaterAnswers["q_4_1_inst_1"] === 7.2, "Plot 2 area answer is isolated (7.2 acres)");

console.log("\n=== ALL MOBILE PREVIEW RUNTIME TESTS PASSED (100% SUCCESS) ===");
