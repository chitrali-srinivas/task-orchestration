// TypeScript definitions for MATIC Survey Builder
// Bridges normalized internal application model and legacy MATIC backend schema

export type QuestionCategory =
    | "choice"
    | "text"
    | "numeric"
    | "datetime"
    | "media"
    | "location"
    | "utilities"
    | "advanced";

export type BackendQuestionType =
    | "Radio"
    | "Checkbox"
    | "Dropdown"
    | "Selected Dropdown"
    | "Subjective"
    | "TextArea"
    | "Number"
    | "DecimalMax10"
    | "DecimalMax100"
    | "DecimalMax500"
    | "DecimalMax1000"
    | "DecimalMax10000"
    | "DecimalMax100000"
    | "WholeNumMax100"
    | "WholeNumMax500"
    | "WholeNumMax1000"
    | "NaturalNumMax10000"
    | "Date"
    | "DateRange"
    | "CalendarWithDate"
    | "Picture Input"
    | "Video"
    | "Map"
    | "PolygonBoundary"
    | "QRCode"
    | "Rating"
    | "Repeater_QT";

export type SurveyStatus = "Draft" | "Published" | "Archived";

export interface LocaleDefinition {
    code: string;
    label: string;
    isDefault?: boolean;
    direction?: "ltr" | "rtl";
    translationFile?: string;     // e.g. "translations/hi.json"
    translationResource?: string; // alias for backwards compatibility
    translationVersion?: number;  // e.g. 1
}

export interface TranslationResourceMeta {
    code: string;
    name: string;
    file: string;
    version: string | number;
    surveyVersion: number;
    sizeBytes?: number;
    checksum?: string;
    updatedAt?: string;
}

export interface TranslationManifest {
    default: string; // e.g. "en"
    available: TranslationResourceMeta[];
}

export interface SurveySection {
    id: string;
    title: string;
    description?: string;
    questionIds?: string[];
}

export interface SurveyTranslationResource {
    schemaVersion: string; // "1.0"
    surveyId: string;
    surveyVersion: number;
    locale: string; // e.g. "hi"
    translationVersion: number;
    language?: {
        code: string;
        name: string;
    };
    metadata?: {
        status?: "manual" | "auto" | "edited" | "verified";
        translatedAt?: string;
        author?: string;
    };
    translations: {
        survey?: {
            name?: string;
            title?: string;
            description?: string;
        };
        sections?: Record<string, {
            title?: string;
            description?: string;
        }>;
        questions: Record<string, {
            title?: string;
            label?: string;
            hint?: string;
            placeholder?: string;
            validationMessage?: string;
        }>;
        choices: Record<string, string>; // choice ID -> translated label
    };
}

export interface SerializedOptionJSON {
    id: string;
    value: string;
    label: string;
    score?: number;
    meta?: Record<string, any>;
}

export interface SerializedQuestionJSON {
    id: string;
    number: number;
    questionNumber?: string;
    displayIndex: string;
    parentQuestionId?: string;
    followUpDepth?: number;
    type: BackendQuestionType;
    displayType?: string;
    columnName: string;
    title: string;
    hint?: string;
    placeholder?: string;
    optionSource?: OptionSourceType;
    masterDataConfig?: MasterDataOptionConfig;
    options?: SerializedOptionJSON[];
    validation: QuestionValidationConfig;
    visibility: QuestionVisibilityLogic;
    repeater?: RepeaterConfig;
    ageDependency?: AgeDependencyConfig;
    anomalyDetection?: {
        enabled: boolean;
        rule?: string;
    };
    rawLegacyFields?: Record<string, any>;
}

export interface SerializedCoreSurveyJSON {
    schemaVersion: string; // "2.0"
    id: string;
    azId: string;
    name: string;
    description?: string;
    category?: string;
    appPath?: string[];
    defaultLocale: string;
    locales: LocaleDefinition[];
    status: SurveyStatus;
    version: number;
    versionTag: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    createdBy: string;
    questions: SerializedQuestionJSON[];
    sections?: SurveySection[];
    availability?: SurveyAvailabilityConfig;
    statuses?: string[];
    metadata?: Record<string, any>;
}

export interface OptionItem {
    id: string;
    value: string;
    labels: Record<string, string>; // e.g. { en: "Yes", hi: "हाँ" }
    score?: number;
    meta?: Record<string, any>;
}

export type OptionSourceType = "custom" | "master";

export interface MasterDataOptionConfig {
    masterSetId: string;
    displayField?: string;
    secondaryFields?: string[];
    searchFields?: string[];
    allowMultiSelect?: boolean;
}

export type LogicOperator =
    | "equals"
    | "notEquals"
    | "contains"
    | "notContains"
    | "greaterThan"
    | "greaterThanOrEqual"
    | "lessThan"
    | "lessThanOrEqual"
    | "isEmpty"
    | "isNotEmpty";

export interface LogicCondition {
    id: string;
    questionId: string;
    operator: LogicOperator;
    value: string | number | boolean | string[];
}

export interface LogicRuleGroup {
    conjunction: "AND" | "OR";
    conditions: LogicCondition[];
}

export interface QuestionVisibilityLogic {
    enabled: boolean;
    ruleGroup: LogicRuleGroup;
}

export type NumberUnitMode = "none" | "fixed" | "allowed";

export interface NumberQuestionConfig {
    format?: "integer" | "decimal";
    decimalPlaces?: number;
    minValue?: number;
    maxValue?: number;
    unitMode?: NumberUnitMode;
    unit?: string; // Machine-readable unit ID for fixed mode (e.g. "kilogram")
    allowedUnits?: string[]; // Array of machine-readable unit IDs for allowed mode (e.g. ["kilogram", "metric_ton"])
    defaultUnit?: string; // Default unit ID if allowed mode
}

export interface QuestionValidationConfig {
    required?: boolean;
    presetId?: string; // e.g. "email", "phone_in", "pin_in", "pan_in"
    validationPresetId?: string; // alias for presetId
    patternDescription?: string; // Optional user-authored description of what the validation does
    numberFormat?: "integer" | "decimal";
    minChar?: number;
    maxChar?: number;
    minValue?: number;
    maxValue?: number;
    decimalPlaces?: number;
    unitSuffix?: string;
    unitMode?: NumberUnitMode;
    unit?: string;
    allowedUnits?: string[];
    defaultUnit?: string;
    regexPattern?: string;
    presetFormat?: string;
    customErrorMessage?: Record<string, string>;
    minSelections?: number;
    maxSelections?: number;
    minDate?: string;
    maxDate?: string;
    disallowFutureDates?: boolean;
    disallowPastDates?: boolean;
    minPhotos?: number;
    maxPhotos?: number;
    maxFileSizeMb?: number;
    allowedMediaSource?: "camera" | "upload" | "both";
    requireGpsTag?: boolean;
    maxGpsAccuracyMeters?: number;
    minVertices?: number;
    maxVertices?: number;
    minAreaAcres?: number;
    maxAreaAcres?: number;
    qrPrefix?: string;
    qrValidationRegex?: string;
    disallowDuplicateScans?: boolean;
    ratingMax?: number;
    ratingStep?: number;
}

export interface RepeaterConfig {
    isRepeater: boolean;
    countSourceType: "fixed" | "question";
    countQuestionId?: string;
    fixedCount?: number;
    childQuestionIds: string[];
    itemLabelTemplate?: string; // e.g. "Plot #{index}"
}

export interface AgeDependencyConfig {
    enabled: boolean;
    parentAgeQuestionId?: string;
    minAge?: number;
    maxAge?: number;
    isAgeParent?: boolean;
}

export interface QuestionModel {
    id: string;
    number: number;
    questionNumber?: string;
    displayIndex: string; // e.g. "1", "2", "8.1", "8.2"
    parentQuestionId?: string;
    followUpDepth?: number;
    type: BackendQuestionType;
    displayType?: string;
    columnName: string;
    titles: Record<string, string>; // e.g. { en: "Are you the owner?", hi: "क्या आप खेत के मालिक हैं?" }
    descriptions?: Record<string, string>;
    placeholders?: Record<string, string>;
    optionSource?: OptionSourceType;
    masterDataConfig?: MasterDataOptionConfig;
    options?: OptionItem[];
    numberConfig?: NumberQuestionConfig;
    numberValidation?: {
        minValue?: number;
        maxValue?: number;
        decimalPlaces?: number;
    };
    numberUnits?: {
        mode: NumberUnitMode;
        unit?: string;
        allowedUnits?: string[];
        defaultUnit?: string;
    };
    validation: QuestionValidationConfig;
    visibility: QuestionVisibilityLogic;
    repeater?: RepeaterConfig;
    ageDependency?: AgeDependencyConfig;
    anomalyDetection?: {
        enabled: boolean;
        rule?: string;
    };
    translationsMeta?: Record<
        string,
        {
            status: "manual" | "auto" | "edited" | "failed";
            translatedAt?: string;
            error?: string;
        }
    >;
    rawLegacyFields?: Record<string, any>; // Preserves any unmodeled backend fields
}

export type AvailabilityMode = "always" | "scheduled";

export interface LocationScope {
    allLocations: boolean;
    baseIds?: string[];
    villageIds?: string[];
    surveyorIds?: string[];
}

export interface AvailabilitySchedule {
    id: string;
    title?: string;
    startAt: string; // YYYY-MM-DDTHH:mm or ISO
    endAt: string;
    timezone: string; // e.g. "Asia/Kolkata (IST)"
    scope: LocationScope;
    status?: "Upcoming" | "Active" | "Expired" | "Disabled";
    notes?: string;
}

export interface SurveyAvailabilityConfig {
    mode: AvailabilityMode;
    schedules: AvailabilitySchedule[];
}

export interface SurveyModel {
    id: string;
    azId: string;
    name: string;
    description?: string;
    category?: string;
    appPath?: string[]; // e.g. ["Farm", "Farmer", "Enrollment"]
    defaultLocale: string;
    locales: LocaleDefinition[];
    status: SurveyStatus;
    version: number;
    versionTag: string; // e.g. "v1", "v2", "v3"
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    createdBy: string;
    questions: QuestionModel[];
    sections?: SurveySection[];
    translations?: TranslationManifest;
    availability?: SurveyAvailabilityConfig;
    statuses?: string[]; // task statuses a response of this survey can have, in order (see DEFAULT_SURVEY_STATUSES)
    metadata?: Record<string, any>;
}

// Default task statuses for a survey: 1st = task created, 2nd = surveyor submitted, the rest are set by the verifier.
export const DEFAULT_SURVEY_STATUSES: string[] = ["planned", "collected"];

export interface SurveyVersionSnapshot {
    version: number;
    versionTag: string;
    status: SurveyStatus;
    createdAt: string;
    createdBy: string;
    publishedAt?: string;
    changeSummary: string;
    surveySnapshot: SurveyModel;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    questionId?: string;
    questionNumber?: number;
    summary: string;
    details?: Record<string, any>;
}

// -------------------------------------------------------------
// Legacy MATIC Backend JSON Schema Definitions
// -------------------------------------------------------------

export interface LegacyBackendQuestionJSON {
    Qn?: string; // English question
    S_Qn?: string; // Hindi question
    Qn_Num?: number | string; // Question number
    Qn_In?: string | number; // Display index e.g. 1 or 8.1
    Qn_Deps?: any; // Dependency metadata
    Opt_Dep?: any; // Option dependency metadata
    Age_Range?: string | number[];
    Repeater?: boolean | string;
    Qn_Repeat?: (number | string)[] | string;
    Opt_Name?: string[] | string;
    S_Opt_Name?: string[] | string;
    Is_Mandt?: boolean | string | number; // Required
    Is_Cond?: boolean | string | number; // Conditional
    Min_Char?: number | string;
    Max_Char?: number | string;
    IS_Anomaly?: boolean | string | number;
    is_double_dependent?: boolean | string;
    Repeat_Dependence?: any;
    user_Res?: any;
    is_Visible?: boolean | string | number;
    Is_Sub_Visible?: boolean | string | number;
    Parent_Age?: any;
    Parent_Dep?: any;
    Parent_Repeat?: any;
    Is_Age_Parent?: boolean | string;
    Qn_Type?: string;
    Qn_Disp_Value?: string;
    Column_Name?: string;
    [key: string]: any; // Allow arbitrary legacy fields
}

export interface LegacyBackendSurveyJSON {
    survey_id?: string;
    az_id?: string;
    survey_name?: string;
    description?: string;
    version?: number;
    status?: string;
    questions: LegacyBackendQuestionJSON[];
    [key: string]: any;
}
