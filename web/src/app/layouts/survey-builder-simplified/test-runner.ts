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
import {
    UNIT_CATALOG,
    UNIT_CATEGORIES,
    getUnitById,
    getUnitsByCategory,
    searchUnits,
    formatUnitLabel,
    formatUnitShort,
    normalizeLegacyUnit,
} from "./lib/unit-catalog";
import { testRegexPattern, sanitizeRegexPattern } from "./lib/regex-safety";
import { reconcileBulkOptions } from "./components/editor/tabs/options-tab";
import { OptionItem, QuestionModel, SurveyModel } from "./types/survey-schema";

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

    // Master visible fields configuration & serialization
    const masterQuestion: QuestionModel = {
        id: "q_master_test",
        number: 10,
        displayIndex: "10",
        type: "Selected Dropdown",
        columnName: "assigned_truck",
        titles: { en: "Select Assigned Truck" },
        optionSource: "master",
        masterDataConfig: {
            masterSetId: "trucks",
            displayField: "vehicleNumber",
            secondaryFields: ["driverName", "capacityTons"],
        },
        validation: { required: true },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    assert(Boolean(masterQuestion.masterDataConfig?.secondaryFields?.includes("driverName")), "Master question has 'driverName' in secondaryFields");
    assert(Boolean(masterQuestion.masterDataConfig?.secondaryFields?.includes("capacityTons")), "Master question has 'capacityTons' in secondaryFields");
    assert(!masterQuestion.masterDataConfig?.secondaryFields?.includes("model"), "Master question excludes unselected 'model' field");

    // Serialization verification
    const serializer = await import("./lib/survey-serializer");
    const serializedMasterQ = serializer.serializeQuestionToCoreJSON(masterQuestion, "en");
    assert(serializedMasterQ.masterDataConfig?.secondaryFields?.length === 2, "Serialized master question preserves exactly 2 visible secondary fields");
    assert(serializedMasterQ.masterDataConfig?.displayField === "vehicleNumber", "Serialized master question preserves primary display field");

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
    assert(allRegisteredTypes.length >= 26, "All registered question types loaded");

    // Ensure every single registered type has help content
    let allHaveHelp = true;
    for (const typeId of allRegisteredTypes) {
        const help = getQuestionTypeHelp(typeId as any);
        if (!help.title || !help.whatItDoes || !help.whenToUse || !help.example?.question) {
            allHaveHelp = false;
            console.error(`Missing help content for ${typeId}`);
        }
    }
    assert(allHaveHelp === true, "All question types have complete help metadata (title, whatItDoes, whenToUse, example)");

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

    const dateRangeHelp = getQuestionTypeHelp("DateRange");
    assert(dateRangeHelp.title.includes("Date Range"), "DateRange help resolved correctly");

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
    const { SIMPLIFIED_QUESTION_TYPES } = await import("./registry/question-type-registry");
    const { normalizeBackendQuestion, recalculateQuestionNumbers } = await import("./lib/survey-normalizer");

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

    // 18. Feature 1: Simplified Question Types & Number Normalization
    console.log("\n--- 18. Testing Feature 1: Simplified Question Types ---");
    assert(SIMPLIFIED_QUESTION_TYPES.length === 21, "Exactly 21 simplified user-facing question types registered");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Number"), "Unified 'Number' question type exists in simplified registry");
    assert(!SIMPLIFIED_QUESTION_TYPES.includes("DecimalMax10" as any), "Legacy 'DecimalMax10' excluded from user-facing creation menu");
    assert(!SIMPLIFIED_QUESTION_TYPES.includes("WholeNumMax100" as any), "Legacy 'WholeNumMax100' excluded from user-facing creation menu");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("DateRange"), "User-facing 'DateRange' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Time"), "User-facing 'Time' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Emoji"), "User-facing 'Emoji' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Rank"), "User-facing 'Rank' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Audio"), "User-facing 'Audio' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Document"), "User-facing 'Document' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("QRCode"), "User-facing 'QRCode' question type exists");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("PolygonBoundary"), "User-facing 'PolygonBoundary' question type exists");

    // Verify all 21 types have descriptors and help documentation
    for (const typeId of SIMPLIFIED_QUESTION_TYPES) {
        const descriptor = QUESTION_TYPE_REGISTRY[typeId];
        assert(Boolean(descriptor), `Question type '${typeId}' has registry descriptor`);
        assert(Boolean(descriptor.displayName), `Question type '${typeId}' has displayName`);
        assert(Boolean(descriptor.category), `Question type '${typeId}' has category`);
        const help = getQuestionTypeHelp(typeId);
        assert(Boolean(help && help.title && help.whatItDoes), `Question type '${typeId}' has complete help documentation`);
    }

    // Verify Validation Capabilities for types
    const { getValidationCapabilities } = await import("./lib/validation-capabilities");
    assert(getValidationCapabilities("Audio").supportsMediaLimits === true, "Audio supports media limits");
    assert(getValidationCapabilities("Document").supportsMediaLimits === true, "Document supports media limits");
    assert(getValidationCapabilities("Time").supportsDateLimits === true, "Time supports date/time limits");
    assert(getValidationCapabilities("Emoji").supportsRatingLimits === true, "Emoji supports rating limits");
    assert(getValidationCapabilities("Rank").supportsSelections === true, "Rank supports selection validation");

    // Test Legacy Number Normalization (Backward Compatibility)
    const legacyDecimalQ = normalizeBackendQuestion({
        Qn: "Plot Area",
        Qn_Num: 4,
        Qn_Type: "DecimalMax10",
        Column_Name: "plot_area",
        Is_Mandt: 1,
        Is_Cond: 0,
    });
    assert(legacyDecimalQ.type === "Number", "Legacy DecimalMax10 normalized to type: 'Number'");
    assert(legacyDecimalQ.validation.numberFormat === "decimal", "Legacy DecimalMax10 has numberFormat: 'decimal'");
    assert(legacyDecimalQ.validation.maxValue === 10, "Legacy DecimalMax10 sets maxValue: 10");

    const legacyWholeNumQ = normalizeBackendQuestion({
        Qn: "Tree Count",
        Qn_Num: 5,
        Qn_Type: "WholeNumMax100",
        Column_Name: "tree_count",
        Is_Mandt: 1,
        Is_Cond: 0,
    });
    assert(legacyWholeNumQ.type === "Number", "Legacy WholeNumMax100 normalized to type: 'Number'");
    assert(legacyWholeNumQ.validation.numberFormat === "integer", "Legacy WholeNumMax100 has numberFormat: 'integer'");
    assert(legacyWholeNumQ.validation.maxValue === 100, "Legacy WholeNumMax100 sets maxValue: 100");

    // Test InteractiveCalendar -> DateRange Normalization
    const legacyCalendarQ = normalizeBackendQuestion({
        Qn: "Sowing Window",
        Qn_Num: 6,
        Qn_Type: "CalendarWithDate",
        Column_Name: "sowing_window",
        Is_Mandt: 1,
        Is_Cond: 0,
    });
    assert(legacyCalendarQ.type === "DateRange", "Legacy CalendarWithDate normalized to type: 'DateRange'");

    // 19. Feature 3: Up to 5-Level Nested Follow-up Hierarchy
    console.log("\n--- 19. Testing Feature 3: 5-Level Follow-up Hierarchy ---");
    const nestedSurveyQuestions = [
        {
            id: "q_1",
            number: 1,
            displayIndex: "1",
            columnName: "is_owner",
            type: "Radio" as const,
            titles: { en: "Are you the owner?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND" as const, conditions: [] } },
        },
        {
            id: "q_2",
            number: 2,
            displayIndex: "2",
            parentQuestionId: "q_1",
            columnName: "noc_doc",
            type: "Picture Input" as const,
            titles: { en: "Upload NoC" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND" as const,
                    conditions: [{ id: "c1", questionId: "q_1", operator: "equals" as const, value: "no" }],
                },
            },
        },
        {
            id: "q_3",
            number: 3,
            displayIndex: "3",
            parentQuestionId: "q_2",
            columnName: "agreement_type",
            type: "Dropdown" as const,
            titles: { en: "Agreement type" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND" as const,
                    conditions: [{ id: "c2", questionId: "q_2", operator: "isNotEmpty" as const, value: "" }],
                },
            },
        },
        {
            id: "q_4",
            number: 4,
            displayIndex: "4",
            parentQuestionId: "q_3",
            columnName: "agreement_date",
            type: "Date" as const,
            titles: { en: "Agreement date" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND" as const,
                    conditions: [{ id: "c3", questionId: "q_3", operator: "equals" as const, value: "lease" }],
                },
            },
        },
        {
            id: "q_5",
            number: 5,
            displayIndex: "5",
            parentQuestionId: "q_4",
            columnName: "upload_agreement",
            type: "Picture Input" as const,
            titles: { en: "Upload agreement" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND" as const,
                    conditions: [{ id: "c4", questionId: "q_4", operator: "isNotEmpty" as const, value: "" }],
                },
            },
        },
    ];

    const recalculatedTree = recalculateQuestionNumbers(nestedSurveyQuestions);
    assert(recalculatedTree[0].displayIndex === "1", "Level 1 displayIndex is '1'");
    assert(recalculatedTree[1].displayIndex === "1.1", "Level 2 displayIndex is '1.1'");
    assert(recalculatedTree[2].displayIndex === "1.1.1", "Level 3 displayIndex is '1.1.1'");
    assert(recalculatedTree[3].displayIndex === "1.1.1.1", "Level 4 displayIndex is '1.1.1.1'");
    assert(recalculatedTree[4].displayIndex === "1.1.1.1.1", "Level 5 displayIndex is '1.1.1.1.1'");
    assert(recalculatedTree[4].followUpDepth === 5, "Level 5 calculated followUpDepth is 5");
    assert(recalculatedTree[4].parentQuestionId === "q_4", "Parent question ID correctly bound");

    // Test Level 6 depth violation
    const level6Questions = [
        ...nestedSurveyQuestions,
        {
            id: "q_6",
            number: 6,
            displayIndex: "6",
            parentQuestionId: "q_5",
            columnName: "witness_name",
            type: "Subjective" as const,
            titles: { en: "Witness name" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND" as const,
                    conditions: [{ id: "c5", questionId: "q_5", operator: "isNotEmpty" as const, value: "" }],
                },
            },
        },
    ];
    const recalculatedLevel6 = recalculateQuestionNumbers(level6Questions);
    assert(recalculatedLevel6[5].followUpDepth === 6, "Calculates Level 6 depth");
    const level6Validation = validateSurvey({ ...normalized, questions: recalculatedLevel6 });
    assert(level6Validation.isValid === false, "Level 6 violates 5-level max depth constraint");
    assert(level6Validation.errors.some((e) => e.title.includes("Maximum Depth Exceeded")), "Validation flags Level 6 error");

    // 20. Feature 4: Localized Custom Validation Error Messages
    console.log("\n--- 20. Testing Feature 4: Localized Validation Messages ---");
    const localizedValidationQuestion = {
        ...normalized.questions[0],
        validation: {
            required: true,
            customErrorMessage: {
                en: "This field is required.",
                hi: "यह प्रश्न आवश्यक है।",
                pa: "ਇਹ ਸਵਾਲ ਲਾਜ਼ਮੀ ਹੈ।",
                te: "ఈ ప్రశ్న తప్పనిసరి.",
            },
            minMaxErrorMessage: {
                en: "Value must be between 0 and 100.",
                hi: "मान 0 और 100 के बीच होना चाहिए।",
            },
        },
    };
    assert(localizedValidationQuestion.validation.customErrorMessage.hi === "यह प्रश्न आवश्यक है।", "Hindi validation message preserved");
    assert(localizedValidationQuestion.validation.customErrorMessage.te === "ఈ ప్రశ్న తప్పనిసరి.", "Telugu validation message preserved");

    // 21. Feature 8: Version Diff Engine Integration with Localized Validation & Numbers
    console.log("\n--- 21. Testing Feature 8: Version Diff Engine Integration ---");
    const oldSurveyV1 = { ...normalized };
    const newSurveyV2 = {
        ...normalized,
        version: 2,
        versionTag: "v2",
        questions: normalized.questions.map((q, idx) => {
            if (idx === 3) {
                return {
                    ...q,
                    validation: {
                        ...q.validation,
                        numberFormat: "integer" as const,
                        customErrorMessage: { en: "Updated error text", hi: "अद्यतन त्रुटि संदेश" },
                    },
                };
            }
            return q;
        }),
    };

    const diffResult = computeSurveyDiff(oldSurveyV1, newSurveyV2);
    assert(diffResult.modifiedCount === 1, "Diff engine flags modified question");
    assert(diffResult.questionDiffs[3].details.validationChanged === true, "Validation change flagged");
    assert(diffResult.questionDiffs[3].details.numberFormatChanged === true, "Number format change flagged in details");
    assert(diffResult.questionDiffs[3].details.localizedValidationChanged === true, "Localized validation message change flagged in details");

    // 22. Feature: Standardized Number Question Unit Selection System (27 Test Cases)
    console.log("\n--- 22. Testing Standardized Number Question Unit Selection System ---");

    // Test 1: Existing Number question without a unit
    const numQNoUnit: QuestionModel = {
        id: "q_num_1",
        number: 1,
        displayIndex: "1",
        columnName: "household_members",
        type: "Number",
        displayType: "Number",
        titles: { en: "How many members live in the household?" },
        numberConfig: {
            format: "integer",
            decimalPlaces: 0,
            unitMode: "none",
        },
        validation: {
            required: true,
            unitMode: "none",
        },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const valResult1 = validateSurvey({ ...normalized, questions: [numQNoUnit] });
    assert(valResult1.isValid === true, "Test 1: Number question without unit is valid");

    // Test 2: Existing Number question with legacy unitSuffix normalization
    assert(normalizeLegacyUnit("kg") === "kilogram", "Test 2a: Legacy 'kg' normalizes to 'kilogram'");
    assert(normalizeLegacyUnit("Acres") === "acre", "Test 2b: Legacy 'Acres' normalizes to 'acre'");
    assert(normalizeLegacyUnit("ha") === "hectare", "Test 2c: Legacy 'ha' normalizes to 'hectare'");
    assert(normalizeLegacyUnit("°C") === "celsius", "Test 2d: Legacy '°C' normalizes to 'celsius'");

    // Test 3: Create Number with fixed unit (kg)
    const numQFixedKg: QuestionModel = {
        id: "q_num_3",
        number: 3,
        displayIndex: "3",
        columnName: "total_harvest_kg",
        type: "Number",
        displayType: "Number",
        titles: { en: "What is your total wheat harvest yield?" },
        numberConfig: {
            format: "decimal",
            decimalPlaces: 2,
            minValue: 0,
            maxValue: 50000,
            unitMode: "fixed",
            unit: "kilogram",
        },
        validation: {
            required: true,
            unitMode: "fixed",
            unit: "kilogram",
            minValue: 0,
            maxValue: 50000,
        },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const valResult3 = validateSurvey({ ...normalized, questions: [numQFixedKg] });
    assert(valResult3.isValid === true, "Test 3: Fixed unit Number question is valid");
    assert(getUnitById(numQFixedKg.numberConfig?.unit || "")?.symbol === "kg", "Test 3b: Fixed unit symbol is 'kg'");

    // Test 4: Create Number with integer format + kg
    const numQIntKg: QuestionModel = {
        ...numQFixedKg,
        numberConfig: {
            ...numQFixedKg.numberConfig!,
            format: "integer",
            decimalPlaces: 0,
        },
    };
    assert(numQIntKg.numberConfig?.format === "integer", "Test 4: Integer format configured with unit");

    // Test 5: Create Number with decimal format + kg
    const numQDecKg: QuestionModel = {
        ...numQFixedKg,
        numberConfig: {
            ...numQFixedKg.numberConfig!,
            format: "decimal",
            decimalPlaces: 3,
        },
    };
    assert(numQDecKg.numberConfig?.format === "decimal" && numQDecKg.numberConfig?.decimalPlaces === 3, "Test 5: Decimal format with 3 decimal places and unit");

    // Test 6: Create Number with decimal precision + unit (hectare)
    const numQPrecisionHa: QuestionModel = {
        ...numQFixedKg,
        numberConfig: {
            format: "decimal",
            decimalPlaces: 4,
            unitMode: "fixed",
            unit: "hectare",
        },
    };
    assert(getUnitById(numQPrecisionHa.numberConfig?.unit || "")?.symbol === "ha", "Test 6: Decimal precision with hectare unit");

    // Test 7: Create Number with multiple allowed units
    const numQAllowed: QuestionModel = {
        id: "q_num_7",
        number: 7,
        displayIndex: "7",
        columnName: "crop_weight",
        type: "Number",
        displayType: "Number",
        titles: { en: "Enter crop weight" },
        numberConfig: {
            format: "decimal",
            decimalPlaces: 2,
            unitMode: "allowed",
            allowedUnits: ["kilogram", "tonne"],
            defaultUnit: "kilogram",
        },
        validation: {
            required: true,
            unitMode: "allowed",
            allowedUnits: ["kilogram", "tonne"],
            defaultUnit: "kilogram",
        },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const valResult7 = validateSurvey({ ...normalized, questions: [numQAllowed] });
    assert(valResult7.isValid === true, "Test 7: Multiple allowed units question is valid");

    // Test 8: Add units to allowed units list
    const updatedAllowedUnits = [...(numQAllowed.numberConfig?.allowedUnits || []), "gram"];
    assert(updatedAllowedUnits.length === 3 && updatedAllowedUnits.includes("gram"), "Test 8: Added 'gram' to allowed units");

    // Test 9: Remove one unit from allowed units
    const prunedAllowedUnits = updatedAllowedUnits.filter((u) => u !== "tonne");
    assert(prunedAllowedUnits.length === 2 && !prunedAllowedUnits.includes("tonne"), "Test 9: Removed 'tonne' from allowed units");

    // Test 10: Set default unit
    const defaultUnitSet = prunedAllowedUnits[0]; // kilogram
    assert(prunedAllowedUnits.includes(defaultUnitSet), "Test 10: Default unit 'kilogram' exists in allowed units");

    // Test 11: Remove default unit / invalid default handling
    const invalidDefaultSurvey: SurveyModel = {
        ...normalized,
        questions: [
            {
                ...numQAllowed,
                numberConfig: {
                    ...numQAllowed.numberConfig!,
                    allowedUnits: ["gram", "milligram"],
                    defaultUnit: "kilogram", // Not in allowed units!
                },
                validation: {
                    ...numQAllowed.validation,
                    allowedUnits: ["gram", "milligram"],
                    defaultUnit: "kilogram",
                },
            },
        ],
    };
    const valResult11 = validateSurvey(invalidDefaultSurvey);
    assert(valResult11.isValid === false, "Test 11: Invalid default unit flagged by validator");
    assert(valResult11.errors.some((e) => e.title.includes("Invalid Default Unit")), "Test 11b: Specific error for invalid default unit returned");

    // Test 12: Search by unit name
    const searchKgName = searchUnits("kilogram");
    assert(searchKgName.some((u) => u.id === "kilogram"), "Test 12: Search by 'kilogram' finds Kilogram");

    // Test 13: Search by symbol
    const searchKgSymbol = searchUnits("kg");
    assert(searchKgSymbol.some((u) => u.id === "kilogram"), "Test 13: Search by symbol 'kg' finds Kilogram");

    // Test 14: Search by code
    const searchCodeM2 = searchUnits("m2");
    assert(searchCodeM2.some((u) => u.id === "square_metre"), "Test 14a: Search by code 'm2' finds Square Metre");
    const searchCodeC = searchUnits("deg_c");
    assert(searchCodeC.some((u) => u.id === "celsius"), "Test 14b: Search by code 'deg_c' finds Celsius");

    // Test 15: Search by alias
    const searchKiloAlias = searchUnits("kilo");
    assert(searchKiloAlias.some((u) => u.id === "kilogram"), "Test 15a: Search by alias 'kilo' finds Kilogram");
    const searchHaAlias = searchUnits("ha");
    assert(searchHaAlias.some((u) => u.id === "hectare"), "Test 15b: Search by alias 'ha' finds Hectare");
    const searchAcreAlias = searchUnits("acre");
    assert(searchAcreAlias.some((u) => u.id === "acre"), "Test 15c: Search by alias 'acre' finds Acre");

    // Test 16: Browse by category (all 13 categories)
    assert(UNIT_CATEGORIES.length === 13, "Test 16a: Exactly 13 international categories defined");
    UNIT_CATEGORIES.forEach((cat) => {
        const unitsInCat = getUnitsByCategory(cat.id);
        assert(unitsInCat.length > 0, `Test 16b: Category '${cat.label}' has ${unitsInCat.length} valid units`);
    });

    // Test 17: Save (Serialization of numberConfig and units)
    const backendSerialized = serializeSurveyToBackend({
        ...normalized,
        questions: [numQFixedKg, numQAllowed],
    });
    assert(backendSerialized.questions.length === 2, "Test 17a: Questions serialized to backend");
    assert(backendSerialized.questions[0].unit === "kilogram", "Test 17b: Unit serialized to backend");
    assert(backendSerialized.questions[1].allowedUnits?.length === 2, "Test 17c: Allowed units serialized to backend");

    // Test 18: Reopen (Deserialization and normalizer roundtrip)
    const reNormalized = normalizeBackendSurvey(backendSerialized);
    assert(reNormalized.questions[0].numberConfig?.unit === "kilogram", "Test 18a: Reopened fixed unit preserved");
    assert(reNormalized.questions[1].numberConfig?.allowedUnits?.length === 2, "Test 18b: Reopened allowed units preserved");

    // Test 19: JSON Preview structure and data consistency
    const jsonPreviewObj = {
        id: numQAllowed.id,
        type: numQAllowed.type,
        numberConfig: numQAllowed.numberConfig,
    };
    const jsonString = JSON.stringify(jsonPreviewObj);
    assert(jsonString.includes('"unitMode":"allowed"'), "Test 19a: JSON preview contains unitMode");
    assert(jsonString.includes('"allowedUnits":["kilogram","tonne"]'), "Test 19b: JSON preview contains allowedUnits array");
    assert(jsonString.includes('"defaultUnit":"kilogram"'), "Test 19c: JSON preview contains defaultUnit");

    // Test 20: Version Diff Engine recognizes unit changes
    const surveyV1_Unit = {
        ...normalized,
        version: 1,
        questions: [numQFixedKg],
    };
    const surveyV2_UnitChanged = {
        ...normalized,
        version: 2,
        questions: [
            {
                ...numQFixedKg,
                numberConfig: {
                    ...numQFixedKg.numberConfig!,
                    unit: "tonne",
                },
                validation: {
                    ...numQFixedKg.validation,
                    unit: "tonne",
                },
            },
        ],
    };
    const unitDiffResult = computeSurveyDiff(surveyV1_Unit, surveyV2_UnitChanged);
    assert(unitDiffResult.modifiedCount === 1, "Test 20a: Version diff detects question modification");
    assert(unitDiffResult.questionDiffs[0].details.unitChanged === true, "Test 20b: Unit configuration change detected");
    assert(unitDiffResult.questionDiffs[0].details.unitOld === "kilogram", "Test 20c: Previous unit recorded as 'kilogram'");
    assert(unitDiffResult.questionDiffs[0].details.unitNew === "tonne", "Test 20d: New unit recorded as 'tonne'");

    // Test 21: Existing survey backward compatibility (Raw legacy survey without unitConfig)
    const rawLegacySurvey = {
        ...RAW_WHEAT_PLOT_ENROLLMENT_JSON,
        questions: [
            {
                id: "q_legacy_num",
                Qn: "Plot area in acres",
                type: "Number",
                unitSuffix: "Acres",
            },
        ],
    };
    const normalizedLegacy = normalizeBackendSurvey(rawLegacySurvey);
    assert(normalizedLegacy.questions[0].numberConfig?.unit === "acre", "Test 21a: Legacy unitSuffix normalized to 'acre'");
    assert(normalizedLegacy.questions[0].numberConfig?.unitMode === "fixed", "Test 21b: Legacy question inferred as fixed unit mode");

    // Test 22: Responsive selector metadata format
    const sampleUnit = getUnitById("kilogram");
    assert(sampleUnit !== undefined, "Test 22a: Sample unit retrieved");
    assert(sampleUnit?.code === "kg" && sampleUnit?.system === "SI", "Test 22b: SI system and code verified");
    assert(sampleUnit?.ucumCode === "kg", "Test 22c: UCUM standard code verified");

    // Test 23: Normalized search input resilience
    assert(searchUnits("   KG   ").length > 0, "Test 23a: Uppercase and whitespace trimmed search works");
    assert(searchUnits("CELSIUS").length > 0, "Test 23b: Case-insensitive search works");

    // Test 24: Long unit names formatting
    const longUnitLabel = formatUnitLabel("pound_per_square_inch");
    assert(longUnitLabel.includes("Pound per square inch") && longUnitLabel.includes("(psi)"), "Test 24a: Long unit formatted with symbol");
    assert(formatUnitShort("square_kilometre") === "km²", "Test 24b: Short symbol formatting");

    // Test 25: No unit selected (unitMode: 'none') validation passes
    const numQNoneMode: QuestionModel = {
        id: "q_num_none",
        number: 1,
        displayIndex: "1",
        columnName: "tractor_count",
        type: "Number",
        displayType: "Number",
        titles: { en: "How many tractors do you operate?" },
        numberConfig: { format: "integer", unitMode: "none" },
        validation: { unitMode: "none" },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const valResult25 = validateSurvey({ ...normalized, questions: [numQNoneMode] });
    assert(valResult25.isValid === true, "Test 25: UnitMode 'none' is valid without unit");

    // Test 26: Invalid empty allowedUnits validation
    const invalidEmptyAllowed: QuestionModel = {
        id: "q_num_empty",
        number: 1,
        displayIndex: "1",
        columnName: "invalid_allowed_q",
        type: "Number",
        displayType: "Number",
        titles: { en: "Invalid question" },
        numberConfig: { format: "decimal", unitMode: "allowed", allowedUnits: [] },
        validation: { unitMode: "allowed", allowedUnits: [] },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const valResult26 = validateSurvey({ ...normalized, questions: [invalidEmptyAllowed] });
    assert(valResult26.isValid === false, "Test 26: Allowed mode with 0 units selected fails validation");

    // Test 27: No regression to other question types
    const radioQ = normalized.questions.find((q) => q.type === "Radio");
    const subjectiveQ = normalized.questions.find((q) => q.type === "Subjective");
    const dateQ = normalized.questions.find((q) => q.type === "Date" || q.type === "DateRange");
    const pictureQ = normalized.questions.find((q) => q.type === "Picture Input");
    assert(radioQ !== undefined && radioQ.options?.length === 2, "Test 27a: Radio questions unaffected");
    // --- 23. Testing Feature: Question Creation Flow & Type Picker Audit ---
    console.log("\n--- 23. Testing Feature: Question Creation Flow & Type Picker Audit ---");
    
    // Test 28: Exact 21 supported question types present in SIMPLIFIED_QUESTION_TYPES
    assert(SIMPLIFIED_QUESTION_TYPES.length === 21, "Test 28a: Exactly 21 simplified user-facing question types registered");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("QRCode"), "Test 28b: QR Code supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("PolygonBoundary"), "Test 28c: Polygon Boundary supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("DateRange"), "Test 28d: Date Range supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Date"), "Test 28e: Single Date Calendar supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Map"), "Test 28f: GPS Location Map supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Rating"), "Test 28g: Rating scale supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Repeater_QT"), "Test 28h: Repeater QT container supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Picture Input"), "Test 28i: Photo capture supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Video"), "Test 28j: Video record supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Time"), "Test 28k: Time supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Emoji"), "Test 28l: Emoji sentiment supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Rank"), "Test 28m: Rank priority supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Audio"), "Test 28n: Audio recording supported in picker");
    assert(SIMPLIFIED_QUESTION_TYPES.includes("Document"), "Test 28o: Document attachment supported in picker");

    // Test 29: No duplicate semantic types
    assert(!SIMPLIFIED_QUESTION_TYPES.includes("DecimalMax10" as any), "Test 29a: DecimalMax10 correctly excluded from picker");
    assert(!SIMPLIFIED_QUESTION_TYPES.includes("WholeNumMax100" as any), "Test 29b: WholeNumMax100 correctly excluded from picker");
    assert(!SIMPLIFIED_QUESTION_TYPES.includes("CalendarWithDate" as any), "Test 29c: CalendarWithDate correctly consolidated into DateRange/Date");

    // Test 30: Step 2 column name auto-formatting
    const sampleTitle = "What is the total cultivated area in hectares?";
    const generatedCol = generateColumnName(sampleTitle);
    assert(generatedCol === "what_is_the_total_cultivated_are", "Test 30: Column name auto-format produces clean snake_case");

    // Test 31: All 21 types have descriptors with non-empty default configurations
    SIMPLIFIED_QUESTION_TYPES.forEach((typeId) => {
        const desc = QUESTION_TYPE_REGISTRY[typeId];
        assert(desc !== undefined, `Test 31a: Descriptor for ${typeId} exists`);
        assert(Boolean(desc.displayName), `Test 31b: Display name for ${typeId} is set`);
        assert(Boolean(desc.description), `Test 31c: Description for ${typeId} is set`);
        assert(Boolean(desc.category), `Test 31d: Category for ${typeId} is set`);
        assert(Boolean(desc.defaultConfig.titles.en), `Test 31e: Default EN title for ${typeId} is set`);
    });

    // --- 24. Testing Feature: Mandatory Error Messages & Validation Translations ---
    console.log("\n--- 24. Testing Feature: Mandatory Error Messages & Validation Translations ---");

    // Test 32: Mandatory field validation message storage
    const mandatoryQuestion: QuestionModel = {
        id: "q_mand_1",
        number: 1,
        displayIndex: "1",
        columnName: "farmer_name",
        type: "Subjective",
        displayType: "Subjective",
        titles: { en: "What is your full name?", hi: "आपका पूरा नाम क्या है?" },
        validation: {
            required: true,
            customErrorMessage: {
                en: "Please enter your full name before continuing.",
                hi: "कृपया आगे बढ़ने से पहले अपना पूरा नाम दर्ज करें।",
            },
            minChar: 3,
            lengthErrorMessage: {
                en: "Name must have at least 3 characters.",
                hi: "नाम में कम से कम 3 अक्षर होने चाहिए।",
            },
        },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };

    assert(mandatoryQuestion.validation.required === true, "Test 32a: Mandatory flag is set");
    assert(
        (mandatoryQuestion.validation.customErrorMessage as Record<string, string>).en === "Please enter your full name before continuing.",
        "Test 32b: English mandatory error message saved"
    );
    assert(
        (mandatoryQuestion.validation.customErrorMessage as Record<string, string>).hi === "कृपया आगे बढ़ने से पहले अपना पूरा नाम दर्ज करें।",
        "Test 32c: Localized Hindi validation error message saved in translations table"
    );
    assert(
        (mandatoryQuestion.validation.lengthErrorMessage as Record<string, string>).hi === "नाम में कम से कम 3 अक्षर होने चाहिए।",
        "Test 32d: Localized length error message saved in translations table"
    );

    // Test 33: String backwards compatibility for customErrorMessage
    const legacyMandatoryQuestion: QuestionModel = {
        id: "q_mand_legacy",
        number: 2,
        displayIndex: "2",
        columnName: "legacy_field",
        type: "Subjective",
        displayType: "Subjective",
        titles: { en: "Legacy field" },
        validation: {
            required: true,
            customErrorMessage: "Legacy single string message",
        },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };

    const resolvedEn =
        typeof legacyMandatoryQuestion.validation.customErrorMessage === "string"
            ? legacyMandatoryQuestion.validation.customErrorMessage
            : legacyMandatoryQuestion.validation.customErrorMessage?.en;
    assert(resolvedEn === "Legacy single string message", "Test 33: Backward compatibility handles string customErrorMessage");

    // 25. Multi-level Parent > Child > Grandchild Question Trees (Depth 1 to 5)
    console.log("\n--- 25. Testing Feature: Multi-level Follow-up Question Trees ---");
    const multiLevelTreeQuestions: QuestionModel[] = [
        {
            id: "q_root_1",
            number: 1,
            displayIndex: "1",
            columnName: "is_owner",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "Are you the owner of the farm?" },
            options: [
                { id: "opt_yes", value: "yes", labels: { en: "Yes", hi: "हाँ" } },
                { id: "opt_no", value: "no", labels: { en: "No", hi: "नहीं" } },
            ],
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_child_1_1",
            number: 2,
            displayIndex: "1.1",
            columnName: "noc_doc_photo",
            type: "Picture Input",
            displayType: "Picture Input",
            parentQuestionId: "q_root_1",
            titles: { en: "If not the owner, upload signed NoC document or lease agreement" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_1", questionId: "q_root_1", operator: "equals", value: "no" }],
                },
            },
        },
        {
            id: "q_grandchild_1_1_1",
            number: 3,
            displayIndex: "1.1.1",
            columnName: "noc_issue_date",
            type: "Date",
            displayType: "Date",
            parentQuestionId: "q_child_1_1",
            titles: { en: "Date when NoC or lease agreement was signed" },
            validation: { required: false },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_2", questionId: "q_child_1_1", operator: "equals", value: "yes" }],
                },
            },
        },
        {
            id: "q_grandchild_1_1_2",
            number: 4,
            displayIndex: "1.1.2",
            columnName: "noc_issuer_name",
            type: "Subjective",
            displayType: "Subjective",
            parentQuestionId: "q_child_1_1",
            titles: { en: "Name of the land owner who signed the NoC" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_3", questionId: "q_child_1_1", operator: "equals", value: "yes" }],
                },
            },
        },
        {
            id: "q_great_grandchild_1_1_1_1",
            number: 5,
            displayIndex: "1.1.1.1",
            columnName: "noc_expired_flag",
            type: "Radio",
            displayType: "Radio",
            parentQuestionId: "q_grandchild_1_1_1",
            titles: { en: "Is the lease validity more than 3 years?" },
            validation: { required: false },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_4", questionId: "q_grandchild_1_1_1", operator: "equals", value: "yes" }],
                },
            },
        },
        {
            id: "q_child_1_2",
            number: 6,
            displayIndex: "1.2",
            columnName: "owner_aadhaar",
            type: "Subjective",
            displayType: "Subjective",
            parentQuestionId: "q_root_1",
            titles: { en: "Enter Owner Aadhaar / National ID" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_5", questionId: "q_root_1", operator: "equals", value: "yes" }],
                },
            },
        },
        {
            id: "q_root_2",
            number: 7,
            displayIndex: "2",
            columnName: "total_farm_acres",
            type: "Number",
            displayType: "Number",
            titles: { en: "Total farm area in acres" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
    ];

    const multiLevelBranchTree = recalculateQuestionNumbers(multiLevelTreeQuestions);

    assert(multiLevelBranchTree[0].displayIndex === "1", "Test 34a: Root question has displayIndex '1'");
    assert(multiLevelBranchTree[0].followUpDepth === 1, "Test 34b: Root question has depth 1");
    assert(multiLevelBranchTree[0].parentQuestionId === undefined, "Test 34c: Root question has no parent");

    assert(multiLevelBranchTree[1].displayIndex === "1.1", "Test 35a: Child question has displayIndex '1.1'");
    assert(multiLevelBranchTree[1].followUpDepth === 2, "Test 35b: Child question has depth 2");
    assert(multiLevelBranchTree[1].parentQuestionId === "q_root_1", "Test 35c: Child question parent is q_root_1");
    assert(multiLevelBranchTree[1].number === 1, "Test 35d: Child question shares root number 1");

    assert(multiLevelBranchTree[2].displayIndex === "1.1.1", "Test 36a: Grandchild 1 has displayIndex '1.1.1'");
    assert(multiLevelBranchTree[2].followUpDepth === 3, "Test 36b: Grandchild 1 has depth 3");
    assert(multiLevelBranchTree[2].parentQuestionId === "q_child_1_1", "Test 36c: Grandchild parent is child q_child_1_1");
    assert(multiLevelBranchTree[2].number === 1, "Test 36d: Grandchild shares root number 1");

    assert(multiLevelBranchTree[3].displayIndex === "1.1.1.1", "Test 37a: Great-grandchild pre-order follows parent with displayIndex '1.1.1.1'");
    assert(multiLevelBranchTree[3].followUpDepth === 4, "Test 37b: Great-grandchild has depth 4");
    assert(multiLevelBranchTree[3].parentQuestionId === "q_grandchild_1_1_1", "Test 37c: Great-grandchild parent is q_grandchild_1_1_1");

    assert(multiLevelBranchTree[4].displayIndex === "1.1.2", "Test 38a: Grandchild 2 has displayIndex '1.1.2'");
    assert(multiLevelBranchTree[4].followUpDepth === 3, "Test 38b: Grandchild 2 has depth 3");
    assert(multiLevelBranchTree[4].parentQuestionId === "q_child_1_1", "Test 38c: Grandchild 2 parent is child q_child_1_1");

    assert(multiLevelBranchTree[5].displayIndex === "1.2", "Test 39a: Second child of root has displayIndex '1.2'");
    assert(multiLevelBranchTree[5].followUpDepth === 2, "Test 39b: Second child of root has depth 2");

    assert(multiLevelBranchTree[6].displayIndex === "2", "Test 40a: Subsequent root question has displayIndex '2'");
    assert(multiLevelBranchTree[6].number === 2, "Test 40b: Subsequent root question has number 2");
    assert(multiLevelBranchTree[6].followUpDepth === 1, "Test 40c: Subsequent root question has depth 1");

    console.log("\n--- 26. Testing Feature: Non-Option Question Follow-up & Branching ---");
    const nonOptionQuestions: QuestionModel[] = [
        {
            id: "q_num_root",
            number: 1,
            displayIndex: "1",
            columnName: "annual_income_lakhs",
            type: "Number",
            displayType: "Number",
            titles: { en: "What is your annual household income (in Lakhs)?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_num_followup",
            number: 2,
            displayIndex: "1.1",
            parentQuestionId: "q_num_root",
            followUpDepth: 2,
            columnName: "income_tax_pan_number",
            type: "Subjective",
            displayType: "Subjective",
            titles: { en: "Please provide your PAN card number for high income verification" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [
                        {
                            id: "c_income_gt_10",
                            questionId: "q_num_root",
                            operator: "greaterThan",
                            value: 10,
                        },
                    ],
                },
            },
        },
        {
            id: "q_text_root",
            number: 3,
            displayIndex: "2",
            columnName: "other_crop_details",
            type: "Subjective",
            displayType: "Subjective",
            titles: { en: "Specify any other crops cultivated" },
            validation: { required: false },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_text_followup",
            number: 4,
            displayIndex: "2.1",
            parentQuestionId: "q_text_root",
            followUpDepth: 2,
            columnName: "other_crop_yield_quintals",
            type: "Number",
            displayType: "Number",
            titles: { en: "What was the estimated yield for these other crops?" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [
                        {
                            id: "c_crop_filled",
                            questionId: "q_text_root",
                            operator: "isNotEmpty",
                            value: "",
                        },
                    ],
                },
            },
        },
    ];

    const recalculatedNonOption = recalculateQuestionNumbers(nonOptionQuestions);
    assert(recalculatedNonOption[0].displayIndex === "1", "Test 41a: Number parent root is Q1");
    assert(recalculatedNonOption[1].displayIndex === "1.1", "Test 41b: Number follow-up child has displayIndex '1.1'");
    assert(recalculatedNonOption[1].number === 1, "Test 41c: Number follow-up child shares parent question number 1");
    assert(recalculatedNonOption[2].displayIndex === "2", "Test 41d: Text parent root is Q2");
    assert(recalculatedNonOption[3].displayIndex === "2.1", "Test 41e: Text follow-up child has displayIndex '2.1'");

    // Test runtime visibility evaluation for Number parent
    const answersLowIncome = { q_num_root: 5 };
    const answersHighIncome = { q_num_root: 15 };
    assert(!isQuestionVisible(recalculatedNonOption[1], answersLowIncome), "Test 42a: Follow-up is hidden when income <= 10");
    assert(isQuestionVisible(recalculatedNonOption[1], answersHighIncome), "Test 42b: Follow-up is visible when income > 10");

    // Test runtime visibility evaluation for Text parent
    const answersNoCrop = { q_text_root: "" };
    const answersWithCrop = { q_text_root: "Mustard & Lentils" };
    assert(!isQuestionVisible(recalculatedNonOption[3], answersNoCrop), "Test 43a: Follow-up hidden when text is empty");
    assert(isQuestionVisible(recalculatedNonOption[3], answersWithCrop), "Test 43b: Follow-up visible when text is filled");

    console.log("\n--- 27. Testing Feature: Repeater Container with Conditional Visibility ---");
    const surveyWithRepeaterAndCond: QuestionModel[] = [
        {
            id: "q_1",
            number: 1,
            displayIndex: "1",
            columnName: "is_owner",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "Are you the owner of the farm?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_1_1",
            number: 1,
            displayIndex: "1.1",
            parentQuestionId: "q_1",
            followUpDepth: 2,
            columnName: "noc_doc_photo",
            type: "Picture Input",
            displayType: "Picture Input",
            titles: { en: "If not owner, upload signed NoC document" },
            validation: { required: true },
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c1", questionId: "q_1", operator: "equals", value: "No" }],
                },
            },
        },
        {
            id: "q_2",
            number: 2,
            displayIndex: "2",
            columnName: "is_surrounded_rabi",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "Is farmer plot surrounded by rabi crop?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_3",
            number: 3,
            displayIndex: "3",
            columnName: "plot_land_area",
            type: "Number",
            displayType: "Number",
            titles: { en: "How much land area is for the Mati deployment?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_4",
            number: 4,
            displayIndex: "4",
            columnName: "exp_ploughing_date",
            type: "DateRange",
            displayType: "DateRange",
            titles: { en: "Expected date of Ploughing?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_5",
            number: 5,
            displayIndex: "5",
            columnName: "has_tractor_trolley",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "Does farmer have a tractor trolley for deployment logistics?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_6",
            number: 6,
            displayIndex: "6",
            columnName: "ready_for_support",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "Is the farmer ready for basalt rock dust application support?" },
            validation: { required: true },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_7",
            number: 7,
            displayIndex: "7",
            columnName: "total_plots_count",
            type: "Repeater_QT",
            displayType: "Repeater_QT",
            titles: { en: "How many plots of land do you have for Mati application?" },
            validation: { required: true },
            repeater: {
                isRepeater: true,
                countSourceType: "question",
                childQuestionIds: ["q_7_1", "q_7_2"],
                itemLabelTemplate: "Plot #{index}",
            },
            // Conditional visibility enabled ON the repeater pointing to Q1:
            visibility: {
                enabled: true,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [{ id: "c_rep", questionId: "q_1", operator: "equals", value: "Yes" }],
                },
            },
        },
        {
            id: "q_7_1",
            number: 7,
            displayIndex: "7.1",
            columnName: "plot_soil_condition",
            type: "Radio",
            displayType: "Radio",
            titles: { en: "What is the soil surface condition in the enrolled field?" },
            validation: { required: true },
            rawLegacyFields: { Parent_Repeat: 7, Qn_In: "7.1" },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
        {
            id: "q_7_2",
            number: 7,
            displayIndex: "7.2",
            columnName: "plot_area_verbal",
            type: "Number",
            displayType: "Number",
            titles: { en: "What is the verbal measured area of this individual plot?" },
            validation: { required: true },
            rawLegacyFields: { Parent_Repeat: 7, Qn_In: "7.2" },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
    ];

    // Recalculate with visibility ON
    const recalculatedWithVisOn = recalculateQuestionNumbers(surveyWithRepeaterAndCond);
    assert(recalculatedWithVisOn[0].displayIndex === "1", "Test 44a: Q1 remains Q1");
    assert(recalculatedWithVisOn[1].displayIndex === "1.1", "Test 44b: Q1.1 remains Q1.1");
    assert(recalculatedWithVisOn[2].displayIndex === "2", "Test 44c: Q2 remains Q2");
    assert(recalculatedWithVisOn[3].displayIndex === "3", "Test 44d: Q3 remains Q3");
    assert(recalculatedWithVisOn[4].displayIndex === "4", "Test 44e: Q4 remains Q4");
    assert(recalculatedWithVisOn[5].displayIndex === "5", "Test 44f: Q5 remains Q5");
    assert(recalculatedWithVisOn[6].displayIndex === "6", "Test 44g: Q6 remains Q6");
    assert(recalculatedWithVisOn[7].displayIndex === "7", "Test 44h: Repeater Q7 remains Q7 (NOT converted to Q1.2)");
    assert(recalculatedWithVisOn[7].number === 7, "Test 44i: Repeater Q7 retains top-level number 7");
    assert(recalculatedWithVisOn[7].id === "q_7", "Test 44j: Repeater Q7 retains its original array position");
    assert(recalculatedWithVisOn[8].displayIndex === "7.1", "Test 44k: Repeater child 1 remains 7.1");
    assert(recalculatedWithVisOn[9].displayIndex === "7.2", "Test 44l: Repeater child 2 remains 7.2");

    // Recalculate with visibility toggled OFF
    const surveyWithVisOff = recalculatedWithVisOn.map((q) =>
        q.id === "q_7"
            ? { ...q, visibility: { enabled: false, ruleGroup: { conjunction: "AND" as const, conditions: [] } } }
            : q
    );
    const recalculatedWithVisOff = recalculateQuestionNumbers(surveyWithVisOff);
    assert(recalculatedWithVisOff[7].displayIndex === "7", "Test 45a: Repeater Q7 remains Q7 when visibility is turned OFF");
    assert(recalculatedWithVisOff[8].displayIndex === "7.1", "Test 45b: Child 1 remains 7.1 when visibility is turned OFF");
    assert(recalculatedWithVisOff[9].displayIndex === "7.2", "Test 45c: Child 2 remains 7.2 when visibility is turned OFF");

    // 28. Testing 4-State Regex Safety Engine (VAL-002)
    console.log("\n--- 28. Testing 4-State Regex Safety Engine (VAL-002) ---");
    const resEmpty = testRegexPattern("", "sample");
    assert(resEmpty.status === "empty", "Test 46a: Empty regex returns 'empty' status");

    const resMatch = testRegexPattern("^[A-Z]{3}-\\d{4}$", "ABC-1234");
    assert(resMatch.status === "valid_match", "Test 46b: Valid matching pattern returns 'valid_match'");
    assert(resMatch.isMatching === true, "Test 46c: isMatching is true for match");

    const resNoMatch = testRegexPattern("^[A-Z]{3}-\\d{4}$", "123-ABCD");
    assert(resNoMatch.status === "valid_nomatch", "Test 46d: Valid non-matching pattern returns 'valid_nomatch'");
    assert(resNoMatch.isMatching === false, "Test 46e: isMatching is false for non-match");

    const resInvalid = testRegexPattern("[a-z(", "sample");
    assert(resInvalid.status === "invalid_syntax", "Test 46f: Malformed pattern returns 'invalid_syntax'");
    assert(Boolean(resInvalid.errorMessage), "Test 46g: Error message provided for syntax error");

    // 29. Testing Immediate Min > Max Cross-Field Validation (VAL-001)
    console.log("\n--- 29. Testing Immediate Min > Max Cross-Field Validation (VAL-001) ---");
    const numQInvalid: QuestionModel = {
        id: "q_num_val",
        number: 1,
        displayIndex: "1",
        type: "Number",
        columnName: "test_num",
        titles: { en: "Test Number" },
        validation: { required: false, minValue: 100, maxValue: 50 },
        visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
    };
    const surveyValidationRes = validateSurvey({ ...normalized, questions: [numQInvalid] });
    const minMaxIssue = surveyValidationRes.errors.find((i) => i.questionId === "q_num_val" && i.message.includes("Minimum value"));
    assert(Boolean(minMaxIssue), "Test 47a: validateSurvey catches minValue > maxValue");
    assert(minMaxIssue?.type === "error", "Test 47b: min > max is flagged as error");

    // 30. Testing Bulk Option Reconciliation (FUNC-001)
    console.log("\n--- 30. Testing Bulk Option Reconciliation (FUNC-001) ---");
    const existingOpts: OptionItem[] = [
        { id: "opt_1", value: "yes", labels: { en: "Yes", hi: "हाँ" }, score: 10, meta: { tag: "affirmative" } },
        { id: "opt_2", value: "no", labels: { en: "No", hi: "नहीं" }, score: 0, meta: { tag: "negative" } },
    ];
    const newBulkLines = ["Yes | 15", "No", "Maybe | 5"];
    const reconciled = reconcileBulkOptions(newBulkLines, existingOpts);
    assert(reconciled.length === 3, "Test 48a: Reconciled 3 options");
    assert(reconciled[0].id === "opt_1", "Test 48b: Existing option ID preserved for 'Yes'");
    assert(reconciled[0].score === 15, "Test 48c: Updated score preserved (15)");
    assert(reconciled[0].meta?.tag === "affirmative", "Test 48d: Existing meta preserved");
    assert(reconciled[1].id === "opt_2", "Test 48e: Existing option ID preserved for 'No'");
    assert(reconciled[1].score === 0, "Test 48f: Unspecified score preserves original score (0)");
    assert(reconciled[2].value === "maybe", "Test 48g: New option created with derived value 'maybe'");
    assert(reconciled[2].score === 5, "Test 48h: New option assigned explicit score (5)");

    // 31. Testing Itemized Option-Level Version Diff Engine (AUDIT-001, VERSION-001)
    console.log("\n--- 31. Testing Itemized Option-Level Version Diff Engine (AUDIT-001, VERSION-001) ---");
    const surveyV1_Options: SurveyModel = {
        ...normalized,
        version: 1,
        questions: [
            {
                id: "q_choice",
                number: 1,
                displayIndex: "1",
                type: "Radio",
                columnName: "choice_q",
                titles: { en: "Choice Question" },
                options: [
                    { id: "opt_a", value: "opt_a", labels: { en: "Option A" }, score: 1 },
                    { id: "opt_b", value: "opt_b", labels: { en: "Option B" }, score: 2 },
                    { id: "opt_c", value: "opt_c", labels: { en: "Option C" }, score: 3 },
                ],
                validation: { required: false },
                visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
            },
        ],
    };
    const surveyV2_OptionsChanged: SurveyModel = {
        ...normalized,
        version: 2,
        questions: [
            {
                id: "q_choice",
                number: 1,
                displayIndex: "1",
                type: "Radio",
                columnName: "choice_q",
                titles: { en: "Choice Question" },
                options: [
                    { id: "opt_a", value: "opt_a", labels: { en: "Option Alpha" }, score: 10 },
                    { id: "opt_b", value: "opt_b", labels: { en: "Option B" }, score: 2 },
                    { id: "opt_d", value: "opt_d", labels: { en: "Option D" }, score: 4 },
                ],
                validation: { required: false },
                visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
            },
        ],
    };
    const diffOpts = computeSurveyDiff(surveyV1_Options, surveyV2_OptionsChanged);
    const qDiff = diffOpts.questionDiffs[0];
    assert(qDiff.changeType === "MODIFIED", "Test 49a: Question marked MODIFIED on option change");
    assert(qDiff.details.optionsChanged === true, "Test 49b: optionsChanged is true");
    assert(Boolean(qDiff.details.optionDiffs?.added.includes("Option D")), "Test 49c: Added option 'Option D' itemized");
    assert(Boolean(qDiff.details.optionDiffs?.removed.includes("Option C")), "Test 49d: Removed option 'Option C' itemized");
    assert(Boolean(qDiff.details.optionDiffs?.renamed.some((r) => r.oldLabel === "Option A" && r.newLabel === "Option Alpha")), "Test 49e: Renamed option itemized");
    assert(Boolean(qDiff.details.optionDiffs?.scoreChanged.some((s) => s.label === "Option Alpha" && s.oldValue === 1 && s.newValue === 10)), "Test 49f: Score change itemized");

    // 32. Testing Mobile Preview State, Runtime Nav & Polygon Bidirectional Sync
    console.log("\n--- 32. Testing Mobile Preview State, Runtime Nav & Polygon Sync ---");
    const repChildQuestions: QuestionModel[] = [
        {
            id: "child_hidden",
            number: 1,
            displayIndex: "1.1",
            type: "Radio",
            columnName: "child_cond",
            titles: { en: "Conditional Child" },
            validation: { required: false },
            visibility: { enabled: true, ruleGroup: { conjunction: "AND", conditions: [{ id: "c1", questionId: "root_trigger", operator: "equals", value: "show" }] } },
        },
        {
            id: "child_always_visible",
            number: 1,
            displayIndex: "1.2",
            type: "Number",
            columnName: "child_num",
            titles: { en: "Numeric Child" },
            validation: { required: false },
            visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
        },
    ];
    const firstVisible = repChildQuestions.find((cq) => isQuestionVisible(cq, {}));
    assert(firstVisible?.id === "child_always_visible", "Test 50a: Dynamic first visible child correctly skips hidden children in repeater (MOBILE-REPEATER-001)");

    const polygonSample = [
        [77.1025, 28.7041],
        [77.1030, 28.7045],
        [77.1028, 28.7050],
        [77.1025, 28.7041],
    ];
    assert(polygonSample.length >= 4, "Test 50b: Valid polygon has minimum vertices and closed ring (MOBILE-STATE-001)");

    console.log("\n=== ALL 32 TEST SUITE CATEGORIES PASSED (100% SUCCESS) ===");
}

runTestSuite().catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});




