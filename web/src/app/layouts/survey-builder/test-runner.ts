import { normalizeBackendSurvey, generateColumnName } from "./lib/survey-normalizer";
import { serializeSurveyToBackend } from "./lib/survey-serializer";
import { evaluateCondition, evaluateRuleGroup, isQuestionVisible } from "./lib/logic-evaluator";
import { analyzeDependencyGraph } from "./lib/dependency-validator";
import { validateSurvey } from "./lib/survey-validator";
import { computeSurveyDiff } from "./lib/version-diff-engine";
import { RAW_WHEAT_PLOT_ENROLLMENT_JSON } from "./services/mock-surveys";
import { SurveyService } from "./services/survey-service";
import { QUESTION_TYPE_REGISTRY } from "./registry/question-type-registry";
import { QUESTION_TYPE_HELP_REGISTRY, getQuestionTypeHelp } from "./data/question-type-help";

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${msg}`);
        throw new Error(msg);
    } else {
        console.log(`✅ PASS: ${msg}`);
    }
}

async function runTestSuite() {
    console.log("=== STARTING MATIC SURVEY BUILDER TEST SUITE ===\n");

    // 1. Column Name Normalization
    console.log("--- 1. Testing Column Name Generator ---");
    assert(generateColumnName("Are you the owner of the farm?") === "are_you_the_owner_of_the_farm", "Generates snake_case column name");
    assert(generateColumnName("GPS Coordinates (Lat/Long)!") === "gps_coordinates_lat_long", "Cleans special characters");

    // 2. Normalization of Flagship 18-Question Fixture
    console.log("\n--- 2. Testing Survey Normalizer ---");
    const normalized = normalizeBackendSurvey(RAW_WHEAT_PLOT_ENROLLMENT_JSON);
    assert(normalized.name === "Wheat Plot Enrollment", "Survey name normalized");
    assert(normalized.questions.length === 18, "All 18 questions parsed");
    assert(normalized.questions[0].titles.hi === "क्या आप खेत के मालिक हैं?", "Hindi title preserved for Q1");
    assert(normalized.questions[0].options?.length === 2, "Q1 Radio options parsed (Yes/No)");
    assert(normalized.questions[1].visibility.enabled === true, "Q2 conditional visibility enabled");
    assert(normalized.questions[1].visibility.ruleGroup.conditions[0].value === "no", "Q2 depends on Q1 = 'no'");
    assert(normalized.questions[7].repeater?.isRepeater === true, "Q8 parsed as Repeater");
    assert(normalized.questions[7].repeater?.childQuestionIds.length === 8, "Q8 has 8 repeated children (Q9 to Q16)");

    // 3. Serialization back to Legacy Backend Format
    console.log("\n--- 3. Testing Survey Serializer ---");
    const serialized = serializeSurveyToBackend(normalized);
    assert(serialized.survey_name === "Wheat Plot Enrollment", "Serialized survey name matches");
    assert(serialized.questions.length === 18, "Serialized 18 questions");
    assert(serialized.questions[0].Qn === "Are you the owner of the farm?", "Q1 English title serialized to Qn");
    assert(serialized.questions[0].S_Qn === "क्या आप खेत के मालिक हैं?", "Q1 Hindi title serialized to S_Qn");
    assert(serialized.questions[0].Is_Mandt === 1, "Is_Mandt serialized as 1");
    assert(serialized.questions[1].Is_Cond === 1, "Q2 Is_Cond serialized as 1");
    assert(serialized.questions[7].Repeater === true, "Q8 Repeater serialized as true");
    assert(Array.isArray(serialized.questions[7].Qn_Repeat), "Q8 Qn_Repeat serialized as array");
    assert(serialized.questions[8].Parent_Repeat === serialized.questions[7].Qn_Num, "Q9 serialized with Parent_Repeat matching parent repeater");

    // 4. Deterministic Logic Evaluator (Zero eval)
    console.log("\n--- 4. Testing Logic Evaluator ---");
    const q2 = normalized.questions[1]; // Shows if q_1 == 'no'
    assert(isQuestionVisible(q2, { q_1: "no" }) === true, "Q2 is visible when Q1 == 'no'");
    assert(isQuestionVisible(q2, { q_1: "yes" }) === false, "Q2 is hidden when Q1 == 'yes'");
    assert(isQuestionVisible(q2, {}) === false, "Q2 is hidden when Q1 is unanswered");

    // Test Numeric Conditions
    assert(evaluateCondition({ id: "c1", questionId: "area", operator: "greaterThan", value: 5 }, { area: 10 }) === true, "greaterThan works (10 > 5)");
    assert(evaluateCondition({ id: "c2", questionId: "area", operator: "lessThanOrEqual", value: 5 }, { area: 10 }) === false, "lessThanOrEqual works (10 not <= 5)");

    // Test Conjunctions (AND / OR)
    assert(evaluateRuleGroup({
        conjunction: "AND",
        conditions: [
            { id: "1", questionId: "q_1", operator: "equals", value: "no" },
            { id: "2", questionId: "q_4", operator: "greaterThan", value: 3 },
        ],
    }, { q_1: "no", q_4: 5.5 }) === true, "AND group evaluates to true when both met");

    assert(evaluateRuleGroup({
        conjunction: "AND",
        conditions: [
            { id: "1", questionId: "q_1", operator: "equals", value: "no" },
            { id: "2", questionId: "q_4", operator: "greaterThan", value: 10 },
        ],
    }, { q_1: "no", q_4: 5.5 }) === false, "AND group evaluates to false when one fails");

    // 5. Dependency Graph & Cycle Detection
    console.log("\n--- 5. Testing Dependency Validator ---");
    const validIssues = analyzeDependencyGraph(normalized.questions);
    const errorsOnly = validIssues.filter((i) => i.type === "error");
    assert(errorsOnly.length === 0, "No dependency errors in baseline survey");

    // Test Circular Dependency Detection
    const cyclicQuestions = JSON.parse(JSON.stringify(normalized.questions));
    cyclicQuestions[0].visibility = {
        enabled: true,
        ruleGroup: { conjunction: "AND", conditions: [{ id: "c_cyc", questionId: "q_2", operator: "equals", value: "test" }] },
    };
    const cycleIssues = analyzeDependencyGraph(cyclicQuestions);
    assert(cycleIssues.some((i) => i.code === "CIRCULAR_DEPENDENCY"), "Circular dependency (Q1 -> Q2 -> Q1) correctly detected");

    // 6. Pre-Publish Validation
    console.log("\n--- 6. Testing Survey Validator ---");
    const valResult = validateSurvey(normalized);
    assert(valResult.isValid === true, "Baseline survey passes pre-publish validation");
    assert(valResult.errorCount === 0, "Zero blocking errors in baseline");

    // Test Validation Failure on Duplicate Column Name
    const duplicateColSurvey = JSON.parse(JSON.stringify(normalized));
    duplicateColSurvey.questions[1].columnName = "is_owner"; // Same as Q1
    const dupResult = validateSurvey(duplicateColSurvey);
    assert(dupResult.isValid === false, "Duplicate column name invalidates survey");
    assert(dupResult.errors.some((e: any) => e.title.includes("Duplicate Column Name")), "Identifies duplicate column name error");

    // Test Validation Failure on Empty Repeater Block
    const emptyRepeaterSurvey = JSON.parse(JSON.stringify(normalized));
    emptyRepeaterSurvey.questions[7].repeater.childQuestionIds = [];
    const emptyRepResult = validateSurvey(emptyRepeaterSurvey);
    assert(emptyRepResult.isValid === false, "Empty repeater invalidates survey");
    assert(emptyRepResult.errors.some((e) => e.title.includes("Empty Repeater Block")), "Identifies empty repeater error");

    // 7. Version Diff Engine
    console.log("\n--- 7. Testing Version Diff Engine ---");
    const modifiedSurvey = JSON.parse(JSON.stringify(normalized));
    modifiedSurvey.version = 2;
    modifiedSurvey.versionTag = "v2";
    modifiedSurvey.questions[3].titles.en = "How much land area is allocated for MATI deployment? (in Acres)"; // Title changed
    modifiedSurvey.questions.pop(); // Removed Q18
    modifiedSurvey.questions.push({
        id: "q_19",
        number: 18,
        displayIndex: "18",
        type: "Rating",
        columnName: "new_rating",
        titles: { en: "Rate verification speed" },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    });

    const diff = computeSurveyDiff(normalized, modifiedSurvey);
    assert(diff.modifiedCount === 1, "Identifies exactly 1 modified question (Q4)");
    assert(diff.removedCount === 1, "Identifies 1 removed question");
    assert(diff.addedCount === 1, "Identifies 1 added question (Q19)");

    // 8. Service Layer CRUD & Immutability
    console.log("\n--- 8. Testing Service Layer & Immutability ---");
    const azs = await SurveyService.getAZs();
    assert(azs.length >= 5, "Retrieved all AZs");

    const az2Surveys = await SurveyService.getSurveysByAZ("AZ2");
    assert(az2Surveys.length > 0, "Retrieved surveys for AZ2");

    // Test Publishing
    const published = await SurveyService.publishSurvey(normalized.id, "Published v1 baseline");
    assert(published.status === "Published", "Survey status updated to Published");

    // Verify Immutability Check
    let saveFailed = false;
    try {
        await SurveyService.saveDraft(published.id, published);
    } catch (e) {
        saveFailed = true;
    }
    assert(saveFailed === true, "Direct save on published immutable survey is blocked");

    // Test Forking Draft from Published
    const forkedDraft = await SurveyService.createDraftFromPublished(published.id);
    assert(forkedDraft.status === "Draft", "Forked survey is in Draft state");
    assert(forkedDraft.version === published.version + 1, `Forked survey version incremented to v${published.version + 1}`);

    // Test Version 0 Published Survey Normalization & Forking v0 -> v1
    console.log("\n--- 9. Testing Version 0 Normalization & Forking ---");
    const az1Surveys = await SurveyService.getSurveysByAZ("AZ1");
    const v0Survey = az1Surveys.find((s) => s.version === 0 || s.versionTag === "v0");
    assert(Boolean(v0Survey), "Found existing v0 survey in AZ1 dataset");
    if (v0Survey) {
        assert(v0Survey.version === 0, "Version 0 correctly normalized as integer 0");
        assert(v0Survey.versionTag === "v0", "Version tag correctly preserved as 'v0'");
        assert(v0Survey.status === "Published", "Legacy v0 survey status is Published");

        // Test forking v0 -> v1
        const v0Draft = await SurveyService.createDraftFromPublished(v0Survey.id);
        assert(v0Draft.version === 1, "Creating draft from v0 published survey produces version 1 (v1)");
        assert(v0Draft.versionTag === "v1", "Creating draft from v0 published survey produces versionTag 'v1'");
        assert(v0Draft.status === "Draft", "Forked v0 survey is in Draft state");
    }

    // 10. Feature 1: Validation Presets & Safe Regex
    console.log("\n--- 10. Testing Feature 1: Validation Presets & Regex Safety ---");
    const { VALIDATION_PRESETS, getPresetById, testPresetValue } = await import("./lib/validation-presets");
    const { validateRegexSafety, testRegexPattern } = await import("./lib/regex-safety");

    assert(VALIDATION_PRESETS.length === 11, "All 11 enterprise validation presets registered");

    // Email preset
    const emailPreset = getPresetById("email");
    assert(Boolean(emailPreset), "Email preset exists");
    assert(testPresetValue("email", "surveyor.mati@carbon.org") === true, "Valid email matches");
    assert(testPresetValue("email", "invalid-email@") === false, "Invalid email fails");

    // Indian Mobile preset
    assert(testPresetValue("phone_in", "9845012345") === true, "Valid 10-digit mobile passes");
    assert(testPresetValue("phone_in", "1234567890") === false, "Mobile starting with 1 fails");

    // Aadhaar 12-digit preset
    assert(testPresetValue("aadhaar_in", "987654321098") === true, "Valid 12-digit Aadhaar passes");
    assert(testPresetValue("aadhaar_in", "9876543210") === false, "10-digit Aadhaar fails");

    // Regex Safety & ReDoS Protection
    const safeCheck = validateRegexSafety("^[A-Z]{5}[0-9]{4}[A-Z]{1}$");
    assert(safeCheck.isValid === true, "Standard PAN regex is valid and safe");

    const invalidRegex = validateRegexSafety("[a-z(");
    assert(invalidRegex.isValid === false, "Unterminated regex syntax is caught safely without crashing");

    const redosRegex = validateRegexSafety("(a+)+$");
    assert(redosRegex.isReDoSRisky === true, "Catastrophic backtracking ReDoS pattern detected and flagged with risk warning");

    // Safe execution
    assert(testRegexPattern("^[0-9]+$", "12345").matches === true, "Safe regex test matches digits");
    assert(testRegexPattern("^[0-9]+$", "123a").matches === false, "Safe regex test fails on alpha");

    // 11. Feature 2: Table View & Backend Translation Service
    console.log("\n--- 11. Testing Feature 2: Backend Translation Service ---");
    const translated = await SurveyService.translateTexts("en", "hi", [
        "Yes",
        "No",
        "Are you the owner of this plot?",
    ]);
    assert(translated[0] === "हाँ", "Dictionary translation for 'Yes' returns 'हाँ'");
    assert(translated[1] === "नहीं", "Dictionary translation for 'No' returns 'नहीं'");
    assert(translated[2] === "क्या आप इस खेत के मालिक हैं?", "Dictionary translation for prompt returns expected Hindi");

    // 12. Feature 3: Survey Duplication & Version Metadata Isolation
    console.log("\n--- 12. Testing Feature 3: Survey Duplication & Isolation ---");
    const duplicated = await SurveyService.duplicateSurvey(normalized.id);
    assert(duplicated.id !== normalized.id, "Duplicated survey has a brand new unique ID");
    assert(duplicated.version === 1 && duplicated.versionTag === "v1", "Duplicated survey is initialized as v1");
    assert(duplicated.status === "Draft", "Duplicated survey is initialized as Draft");
    assert(duplicated.name === `${normalized.name} (Copy)`, "Duplicated survey name appends (Copy)");
    assert(duplicated.questions.length === normalized.questions.length, "All questions copied accurately");
    assert(duplicated.availability?.schedules.length === 0, "Active operational schedules reset for clean draft");

    // Test Metadata Edit on Draft
    const updatedDetails = await SurveyService.updateSurveyDetails(duplicated.id, {
        name: "Wheat Baseline 2026",
        category: "Soil Baseline",
    });
    assert(updatedDetails.name === "Wheat Baseline 2026", "Survey details updated successfully on draft");

    // 13. Feature 4: Category Registry & App Location Path Derivation
    console.log("\n--- 13. Testing Feature 4: Category Registry & App Location ---");
    const { CATEGORY_REGISTRY, getCategoryPath, formatCategoryPathString } = await import("./lib/category-registry");
    assert(CATEGORY_REGISTRY.length >= 6, "Category registry contains required business categories");

    const enrollmentPath = getCategoryPath("Farmer Enrollment");
    assert(Array.isArray(enrollmentPath) && enrollmentPath.join(" → ") === "Farm → Farmer → Enrollment", "Farmer Enrollment maps to Farm → Farmer → Enrollment");

    const soilPath = getCategoryPath("Soil Baseline");
    assert(Array.isArray(soilPath) && soilPath.join(" → ") === "Agronomy → Soil → Baseline", "Soil Baseline maps to Agronomy → Soil → Baseline");

    const boundaryPath = getCategoryPath("Boundary Mapping");
    assert(Array.isArray(boundaryPath) && boundaryPath.join(" → ") === "GIS → Field Geometry → Boundary", "Boundary Mapping maps to GIS → Field Geometry → Boundary");

    // 14. Feature 5: Centralized Master Data Registry & Combobox Query
    console.log("\n--- 14. Testing Feature 5: Master Data Registry ---");
    const { MASTER_SETS, getMasterSetById, searchMasterRecords } = await import("./lib/master-data-registry");
    assert(MASTER_SETS.length >= 5, "Registered master datasets: trucks, villages, bases, surveyors, crops");

    const truckSet = getMasterSetById("trucks");
    assert(Boolean(truckSet), "Trucks master set found");
    assert(Boolean(truckSet?.fields.some((f) => f.key === "vehicleNumber")), "Truck dataset has vehicleNumber field");

    // Search master records
    const searchTrucks = searchMasterRecords("trucks", "KA01");
    assert(searchTrucks.length > 0, "Search query 'KA01' matched truck records");
    assert(searchTrucks[0].vehicleNumber.includes("KA01"), "Primary display field matches query");

    const searchSurveyors = searchMasterRecords("surveyors", "Prakash");
    assert(searchSurveyors.length > 0, "Search query 'Prakash' matched surveyor record");

    // 15. Feature 6: Scheduling & Multi-Schedule Availability Engine
    console.log("\n--- 15. Testing Feature 6: Scheduling Engine ---");
    const { getScheduleStatus, checkScheduleOverlap, formatScheduleDateRange } = await import("./lib/scheduling-engine");

    const now = new Date();
    const futureStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const pastStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const activeStart = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const activeEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

    const upcomingStatus = getScheduleStatus({
        id: "s1",
        title: "Future",
        startAt: futureStart,
        endAt: futureEnd,
        timezone: "Asia/Kolkata",
        scope: { allLocations: true },
    }, now);
    assert(upcomingStatus === "Upcoming", "Future schedule derived as 'Upcoming'");

    const activeStatus = getScheduleStatus({
        id: "s2",
        title: "Active",
        startAt: activeStart,
        endAt: activeEnd,
        timezone: "Asia/Kolkata",
        scope: { allLocations: true },
    }, now);
    assert(activeStatus === "Active", "Current schedule derived as 'Active'");

    const expiredStatus = getScheduleStatus({
        id: "s3",
        title: "Expired",
        startAt: pastStart,
        endAt: pastEnd,
        timezone: "Asia/Kolkata",
        scope: { allLocations: true },
    }, now);
    assert(expiredStatus === "Expired", "Past schedule derived as 'Expired'");

    // Overlap Detection
    const overlapTest = checkScheduleOverlap([
        {
            id: "sch_a",
            title: "Window A",
            startAt: activeStart,
            endAt: activeEnd,
            timezone: "Asia/Kolkata",
            scope: { allLocations: true },
        },
        {
            id: "sch_b",
            title: "Window B",
            startAt: activeStart,
            endAt: activeEnd,
            timezone: "Asia/Kolkata",
            scope: { allLocations: true },
        },
    ]);
    assert(overlapTest.hasOverlap === true, "Overlapping active schedules correctly flagged with warning");

    // 16. Feature: Question Type Info / Help Registry
    console.log("\n--- 16. Testing Question Type Info / Help Registry ---");
    const allRegisteredTypes = Object.keys(QUESTION_TYPE_REGISTRY);
    assert(allRegisteredTypes.length === 27, "All 27 registered question types loaded");

    // Ensure every single registered type has help content
    let allHaveHelp = true;
    for (const typeId of allRegisteredTypes) {
        const help = getQuestionTypeHelp(typeId as any);
        if (!help.title || !help.whatItDoes || !help.whenToUse || !help.example?.question) {
            allHaveHelp = false;
            console.error(`Missing help content for ${typeId}`);
        }
    }
    assert(allHaveHelp === true, "All 27 question types have complete help metadata (title, whatItDoes, whenToUse, example)");

    // Test specific types
    const radioHelp = getQuestionTypeHelp("Radio");
    assert(radioHelp.title.includes("Radio"), "Radio help resolved correctly");
    assert(Boolean(radioHelp.tip), "Radio includes useful tip");
    assert(radioHelp.example.options?.length === 2, "Radio includes example options");

    const polygonHelp = getQuestionTypeHelp("PolygonBoundary");
    assert(polygonHelp.title.includes("Polygon"), "PolygonBoundary help resolved correctly");
    assert(polygonHelp.whatItDoes.includes("GPS polygon"), "Polygon Boundary explains GIS perimeter");

    const repeaterHelp = getQuestionTypeHelp("Repeater_QT");
    assert(repeaterHelp.title.includes("Repeater"), "Repeater help resolved correctly");
    assert(repeaterHelp.whenToUse.includes("multiple plots"), "Repeater explains multi-item dynamic iterations");

    // 17. Feature: Translation & Export Architecture
    console.log("\n--- 17. Testing Translation & Export Architecture ---");
    const {
        TranslationService,
        calculateTranslationCompleteness,
        createModularTranslationResource,
        buildTranslationManifest,
    } = await import("./services/translation-service");
    const {
        serializeCoreSurveyJSON,
        serializeQuestionToCoreJSON,
    } = await import("./lib/survey-serializer");

    // CASE 1: Survey with only English
    const englishOnlySurvey: typeof normalized = {
        ...normalized,
        defaultLocale: "en",
        locales: [{ code: "en", label: "English", isDefault: true }],
        translations: undefined,
    };
    const case1Manifest = buildTranslationManifest(englishOnlySurvey);
    assert(case1Manifest.default === "en", "Case 1: English-only manifest default is 'en'");
    assert(case1Manifest.available.length === 0, "Case 1: English-only survey has 0 external translation resources");

    // CASE 2: Survey with English + Hindi
    const enHiSurvey: typeof normalized = {
        ...normalized,
        defaultLocale: "en",
        locales: [
            { code: "en", label: "English", isDefault: true },
            { code: "hi", label: "Hindi (हिंदी)", isDefault: false },
        ],
    };
    const case2Manifest = buildTranslationManifest(enHiSurvey);
    assert(case2Manifest.available.length === 1, "Case 2: 1 available translation resource");
    assert(case2Manifest.available[0].code === "hi", "Case 2: Manifest available code is 'hi'");
    assert(case2Manifest.available[0].file === "translations/hi.json", "Case 2: Manifest file is 'translations/hi.json'");

    // CASE 3: Survey with English + Hindi + Telugu
    const multiLangSurvey: typeof normalized = {
        ...normalized,
        defaultLocale: "en",
        locales: [
            { code: "en", label: "English", isDefault: true },
            { code: "hi", label: "Hindi (हिंदी)", isDefault: false },
            { code: "te", label: "Telugu (తెలుగు)", isDefault: false },
        ],
    };
    const case3Manifest = buildTranslationManifest(multiLangSurvey);
    assert(case3Manifest.available.length === 2, "Case 3: Manifest registers both Hindi and Telugu");
    const modularHi = createModularTranslationResource(multiLangSurvey, "hi", "Hindi (हिंदी)");
    const modularTe = createModularTranslationResource(multiLangSurvey, "te", "Telugu (తెలుగు)");
    assert(modularHi.locale === "hi" && modularTe.locale === "te", "Case 3: Independent modular resources generated");
    assert(modularHi.translations.questions["q_1"]?.title !== undefined, "Case 3: Question translations indexed by stable question ID");

    // CASE 4: Core Survey JSON Serialization (Schema 2.0)
    const coreSurveyJSON = serializeCoreSurveyJSON(multiLangSurvey);
    assert(coreSurveyJSON.schemaVersion === "2.0", "Case 4: Core survey JSON has schemaVersion '2.0'");
    assert(coreSurveyJSON.defaultLocale === "en", "Case 4: Core survey defaultLocale is 'en'");
    assert(coreSurveyJSON.locales.length === 3, "Case 4: Core survey has 3 locales in manifest");
    assert(coreSurveyJSON.locales[1].translationFile === "translations/hi.json", "Case 4: Manifest points to translations/hi.json via translationFile");
    assert(coreSurveyJSON.locales[2].translationFile === "translations/te.json", "Case 4: Manifest points to translations/te.json via translationFile");

    // Question 1 in Core survey: single "title", options have single "label", no "titles" or "labels" dict
    const coreQ1 = coreSurveyJSON.questions[0];
    assert(typeof coreQ1.title === "string", "Case 4: Core question has single title string");
    assert((coreQ1 as any).titles === undefined, "Case 4: Core question does NOT contain titles dictionary");
    assert(coreQ1.options !== undefined && typeof coreQ1.options[0].label === "string", "Case 4: Core option has single label string");
    assert((coreQ1.options![0] as any).labels === undefined, "Case 4: Core option does NOT contain labels dictionary");
    assert(Boolean(coreQ1.validation), "Case 4: Core question preserves validation");
    assert(Boolean(coreQ1.visibility), "Case 4: Core question preserves visibility");
    assert(Boolean(coreQ1.repeater), "Case 4: Core question preserves repeater config");
    assert(Boolean(coreQ1.ageDependency), "Case 4: Core question preserves age dependency");
    assert(Boolean(coreQ1.anomalyDetection), "Case 4: Core question preserves anomaly detection");

    // CASE 5: Modular Translation File (translations/hi.json)
    const rawModularHi = JSON.stringify(modularHi);
    assert(!rawModularHi.includes('"validation"'), "Case 5: Validation config strictly EXCLUDED from translation JSON");
    assert(!rawModularHi.includes('"visibility"'), "Case 5: Visibility logic strictly EXCLUDED from translation JSON");
    assert(!rawModularHi.includes('"repeater"'), "Case 5: Repeater config strictly EXCLUDED from translation JSON");
    assert(!rawModularHi.includes('"ageDependency"'), "Case 5: Age dependency strictly EXCLUDED from translation JSON");
    assert(!rawModularHi.includes('"anomalyDetection"'), "Case 5: Anomaly detection strictly EXCLUDED from translation JSON");
    assert(modularHi.translations.choices["opt_1_1"] === "हाँ", "Case 5: Choices translated by opt ID");

    // CASE 6: Choices and stable IDs resolution
    const choiceQ = normalized.questions[0]; // Q1 Radio (Yes/No)
    const optYes = choiceQ.options![0]; // opt_1_1
    const resolvedChoiceLabel = TranslationService.resolveChoiceText(optYes, "hi", modularHi, "en");
    assert(resolvedChoiceLabel === "हाँ", "Case 6: Resolves translated choice display label ('हाँ')");
    assert(optYes.value === "yes" && optYes.id === "opt_1_1", "Case 6: Underlying choice value ('yes') and stable ID ('opt_1_1') remain unchanged");

    // CASE 7: Missing translation string fallback
    const partialResource = createModularTranslationResource(normalized, "hi", "Hindi", {
        questions: {
            "q_1": { title: "क्या आप खेत के मालिक हैं?" },
            // q_2 intentionally omitted to test fallback!
        },
    });
    const q2Resolved = TranslationService.resolveQuestionText(
        normalized.questions[1],
        "label",
        "hi",
        partialResource,
        "en"
    );
    assert(q2Resolved === normalized.questions[1].titles.en, "Case 7: Missing translated string falls back cleanly to English title");

    // CASE 8: Backward compatibility - Normalizing serialized Schema 2.0 core survey
    const reNormalized = normalizeBackendSurvey(coreSurveyJSON);
    assert(reNormalized.questions.length === 18, "Case 8: Re-normalized Schema 2.0 survey preserves all 18 questions");
    assert(reNormalized.questions[0].titles.en === coreQ1.title, "Case 8: Re-normalized survey extracts canonical title");
    assert(reNormalized.locales.length === 3, "Case 8: Re-normalized survey preserves locales manifest");

    // Completeness test
    const completeness = calculateTranslationCompleteness(normalized, "hi", modularHi);
    assert(completeness.totalTranslatable > 0, "Completeness: Total translatable calculated");
    assert(typeof completeness.percentage === "number", "Completeness: Percentage calculated");

    console.log("\n=== ALL 17 TEST SUITE CATEGORIES PASSED (100% SUCCESS) ===");
}

runTestSuite().catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});



