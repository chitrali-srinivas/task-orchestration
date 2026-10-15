import { SurveyService as V1Service } from "../survey-builder/services/survey-service";
import { SurveyService as V1_1Service } from "./services/survey-service";

async function runIsolationVerification() {
    console.log("=== STARTING STATE ISOLATION & COMPATIBILITY SUITE ===\n");

    // 1. Initial State Retrieval
    const v1_initial_az2 = await V1Service.getSurveysByAZ("AZ2");
    const v1_1_initial_az2 = await V1_1Service.getSurveysByAZ("AZ2");

    console.log(`V1.0 AZ2 surveys count: ${v1_initial_az2.length}`);
    console.log(`V1.1 AZ2 surveys count: ${v1_1_initial_az2.length}`);
    if (v1_initial_az2.length !== v1_1_initial_az2.length) {
        throw new Error("Initial survey count mismatch between V1.0 and V1.1");
    }
    console.log("✅ PASS: V1.0 and V1.1 baseline surveys match initially.\n");

    // 2. TEST A & TEST B: Mutate V1.1 and verify V1.0 remains untouched
    console.log("--- TEST A & B: Mutating V1.1 state ---");
    const targetV1_1 = v1_1_initial_az2[0];
    console.log(`Forking draft from V1.1 survey "${targetV1_1.name}" (ID: ${targetV1_1.id})`);

    const draftV1_1 = await V1_1Service.createDraftFromPublished(targetV1_1.id);
    const modifiedV1_1 = await V1_1Service.saveDraft(draftV1_1.id, {
        ...draftV1_1,
        name: "Wheat Plot Enrollment (Modified in V1.1)",
        questions: [
            ...draftV1_1.questions,
            {
                id: "q_v1_1_custom",
                number: targetV1_1.questions.length + 1,
                displayIndex: `${targetV1_1.questions.length + 1}`,
                type: "Subjective",
                displayType: "Subjective",
                columnName: "v1_1_custom_field",
                titles: { en: "V1.1 Unique Question" },
                validation: { required: false },
                visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
            },
        ],
    });

    console.log(`Saved V1.1 survey name: "${modifiedV1_1.name}", questions: ${modifiedV1_1.questions.length}`);

    // Verify V1.1 retained changes
    const fetchedV1_1 = await V1_1Service.getSurveyById(draftV1_1.id);
    if (!fetchedV1_1 || fetchedV1_1.name !== "Wheat Plot Enrollment (Modified in V1.1)") {
        throw new Error("V1.1 failed to retain its modified state");
    }
    if (fetchedV1_1.questions.length !== draftV1_1.questions.length + 1) {
        throw new Error("V1.1 question count not updated");
    }
    console.log("✅ PASS: V1.1 successfully updated and retained changes.");

    // Verify V1.0 is completely untouched!
    const fetchedV1_0 = await V1Service.getSurveyById(targetV1_1.id);
    if (!fetchedV1_0) {
        throw new Error("V1.0 survey not found");
    }
    if (fetchedV1_0.name !== "Wheat Plot Enrollment") {
        throw new Error(`State leak! V1.0 survey name was mutated to "${fetchedV1_0.name}"`);
    }
    if (fetchedV1_0.questions.length !== targetV1_1.questions.length) {
        throw new Error(`State leak! V1.0 question count changed to ${fetchedV1_0.questions.length}`);
    }
    console.log("✅ PASS: V1.0 survey remained completely untouched after V1.1 mutation!\n");

    // 3. TEST C: Mutate V1.0 and verify V1.1 remains untouched
    console.log("--- TEST C: Mutating V1.0 state ---");
    const createdV1_0 = await V1Service.createSurvey({
        name: "V1.0 Brand New Independent Survey",
        azId: "AZ2",
        category: "Field Operations",
        defaultLocale: "en",
    });
    console.log(`Created new survey in V1.0: "${createdV1_0.name}" (ID: ${createdV1_0.id})`);

    const v1SurveysAfterCreate = await V1Service.getSurveysByAZ("AZ2");
    const v1_1SurveysAfterCreate = await V1_1Service.getSurveysByAZ("AZ2");

    if (!v1SurveysAfterCreate.some((s) => s.id === createdV1_0.id)) {
        throw new Error("Created survey not found in V1.0");
    }
    if (v1_1SurveysAfterCreate.some((s) => s.id === createdV1_0.id)) {
        throw new Error("State leak! Newly created V1.0 survey appeared in V1.1");
    }
    console.log("✅ PASS: V1.0 new survey creation did NOT affect V1.1 list!\n");

    // 4. TEST D: HTTP Route Verification
    console.log("--- TEST D: Verifying HTTP Routes on Live Dev Server ---");
    const routes = [
        "http://localhost:3000/layouts",
        "http://localhost:3000/layouts/survey-builder",
        "http://localhost:3000/layouts/survey-builder/v1-0",
        "http://localhost:3000/layouts/survey-builder/v1-1",
        "http://localhost:3000/layouts/survey-builder-simplified",
        "http://localhost:3000/layouts/survey-builder/simplified",
    ];

    for (const url of routes) {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`HTTP ${res.status} for ${url} (length: ${text.length} bytes)`);
        if (res.status !== 200) {
            throw new Error(`Route ${url} returned status ${res.status}`);
        }
    }
    console.log("✅ PASS: All 6 layouts and survey builder version routes returned HTTP 200!\n");

    console.log("=== ALL ISOLATION & COMPATIBILITY TESTS PASSED WITH 100% SUCCESS ===");
}

runIsolationVerification().catch((err) => {
    console.error("❌ ISOLATION TEST FAILED:", err);
    process.exit(1);
});
