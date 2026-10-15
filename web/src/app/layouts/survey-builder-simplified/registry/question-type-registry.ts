import { BackendQuestionType, QuestionCategory } from "../types/survey-schema";

export interface QuestionTypeDescriptor {
    id: BackendQuestionType;
    displayName: string;
    category: QuestionCategory;
    description: string;
    iconName: string; // Lucide icon name
    defaultConfig: {
        titles: { en: string; hi?: string };
        validation?: Record<string, any>;
        options?: { value: string; labels: { en: string; hi: string } }[];
    };
    supports: {
        required: boolean;
        options: boolean;
        validation: boolean;
        conditionalLogic: boolean;
        repeater: boolean;
        translations: boolean;
        dataColumnName: boolean;
        anomaly: boolean;
        ageDependency: boolean;
    };
}

export const QUESTION_CATEGORIES: {
    id: QuestionCategory;
    name: string;
    description: string;
}[] = [
    { id: "choice", name: "Choice & Selection", description: "Single and multi-select options" },
    { id: "text", name: "Text Input", description: "Short and multi-line responses" },
    { id: "numeric", name: "Numeric & Precision", description: "Integers, decimals, and bounded numbers" },
    { id: "datetime", name: "Date & Time", description: "Dates, calendar selectors and time" },
    { id: "media", name: "Media Capture", description: "Photos, video records and attachments" },
    { id: "location", name: "Location & Boundary", description: "GPS points and plot polygon boundaries" },
    { id: "utilities", name: "Operational Utilities", description: "QR code scanners and satisfaction ratings" },
    { id: "advanced", name: "Dynamic Containers", description: "Repeater blocks and grouped iterations" },
];

export const QUESTION_TYPE_REGISTRY: Record<BackendQuestionType, QuestionTypeDescriptor> = {
    // 1. Choice
    Radio: {
        id: "Radio",
        displayName: "Single choice",
        category: "choice",
        description: "Respondent selects exactly one option from a list.",
        iconName: "Radio",
        defaultConfig: {
            titles: { en: "Select an option", hi: "एक विकल्प चुनें" },
            options: [
                { value: "yes", labels: { en: "Yes", hi: "हाँ" } },
                { value: "no", labels: { en: "No", hi: "नहीं" } },
            ],
            validation: { required: true },
        },
        supports: {
            required: true,
            options: true,
            validation: false,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: true,
        },
    },
    Checkbox: {
        id: "Checkbox",
        displayName: "Multiple choice",
        category: "choice",
        description: "Respondent can select one or more applicable options.",
        iconName: "CheckSquare",
        defaultConfig: {
            titles: { en: "Select all that apply", hi: "लागू होने वाले सभी विकल्प चुनें" },
            options: [
                { value: "opt_1", labels: { en: "Option 1", hi: "विकल्प 1" } },
                { value: "opt_2", labels: { en: "Option 2", hi: "विकल्प 2" } },
            ],
            validation: { required: false },
        },
        supports: {
            required: true,
            options: true,
            validation: false,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    Dropdown: {
        id: "Dropdown",
        displayName: "Dropdown",
        category: "choice",
        description: "Compact dropdown list for selecting a single item.",
        iconName: "ChevronDownSquare",
        defaultConfig: {
            titles: { en: "Select from dropdown", hi: "ड्रॉपडाउन से चुनें" },
            options: [
                { value: "val_1", labels: { en: "First Choice", hi: "पहला विकल्प" } },
                { value: "val_2", labels: { en: "Second Choice", hi: "दूसरा विकल्प" } },
            ],
            validation: { required: true },
        },
        supports: {
            required: true,
            options: true,
            validation: false,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    "Selected Dropdown": {
        id: "Selected Dropdown",
        displayName: "Cascading Dropdown",
        category: "choice",
        description: "Search-filtered select for large lists of options.",
        iconName: "ListFilter",
        defaultConfig: {
            titles: { en: "Search and select item", hi: "खोजें और चुनें" },
            options: [
                { value: "opt_a", labels: { en: "Item A", hi: "आइटम ए" } },
                { value: "opt_b", labels: { en: "Item B", hi: "आइटम बी" } },
            ],
            validation: { required: true },
        },
        supports: {
            required: true,
            options: true,
            validation: false,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 2. Text
    Subjective: {
        id: "Subjective",
        displayName: "Short answer",
        category: "text",
        description: "Single-line textual input for names, IDs, remarks.",
        iconName: "AlignLeft",
        defaultConfig: {
            titles: { en: "Enter brief response", hi: "संक्षिप्त विवरण दर्ज करें" },
            validation: { required: true, minChar: 1, maxChar: 250 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    TextArea: {
        id: "TextArea",
        displayName: "Long answer",
        category: "text",
        description: "Multi-line text area for extensive notes or observations.",
        iconName: "FileText",
        defaultConfig: {
            titles: { en: "Enter detailed notes", hi: "विस्तृत विवरण दर्ज करें" },
            validation: { required: false, minChar: 0, maxChar: 2000 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 3. Numeric
    Number: {
        id: "Number",
        displayName: "Number",
        category: "numeric",
        description: "Numerical response with configurable Integer / Decimal format and range boundaries.",
        iconName: "Hash",
        defaultConfig: {
            titles: { en: "Enter number", hi: "संख्या दर्ज करें" },
            validation: { required: true, numberFormat: "decimal", minValue: 0, maxValue: 100000, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: true,
        },
    },
    DecimalMax10: {
        id: "DecimalMax10",
        displayName: "Decimal Number (Max 10)",
        category: "numeric",
        description: "Precision decimal value bounded between 0 and 10 (e.g., plot area in acres).",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter area / decimal (Max 10)", hi: "दशमलव दर्ज करें (अधिकतम 10)" },
            validation: { required: true, minValue: 0, maxValue: 10, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    DecimalMax100: {
        id: "DecimalMax100",
        displayName: "Decimal Number (Max 100)",
        category: "numeric",
        description: "Precision decimal value bounded between 0 and 100.",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter decimal (Max 100)", hi: "दशमलव दर्ज करें (अधिकतम 100)" },
            validation: { required: true, minValue: 0, maxValue: 100, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    DecimalMax500: {
        id: "DecimalMax500",
        displayName: "Decimal Number (Max 500)",
        category: "numeric",
        description: "Precision decimal value bounded between 0 and 500.",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter decimal (Max 500)", hi: "दशमलव दर्ज करें (अधिकतम 500)" },
            validation: { required: true, minValue: 0, maxValue: 500, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    DecimalMax1000: {
        id: "DecimalMax1000",
        displayName: "Decimal Number (Max 1000)",
        category: "numeric",
        description: "Precision decimal value bounded between 0 and 1,000.",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter decimal (Max 1000)", hi: "दशमलव दर्ज करें (अधिकतम 1000)" },
            validation: { required: true, minValue: 0, maxValue: 1000, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    DecimalMax10000: {
        id: "DecimalMax10000",
        displayName: "Decimal Number (Max 10,000)",
        category: "numeric",
        description: "Precision decimal value bounded up to 10,000.",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter decimal (Max 10,000)", hi: "दशमलव दर्ज करें (अधिकतम 10,000)" },
            validation: { required: true, minValue: 0, maxValue: 10000, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    DecimalMax100000: {
        id: "DecimalMax100000",
        displayName: "Decimal Number (Max 100,000)",
        category: "numeric",
        description: "Precision decimal value bounded up to 100,000.",
        iconName: "Binary",
        defaultConfig: {
            titles: { en: "Enter decimal (Max 100,000)", hi: "दशमलव दर्ज करें (अधिकतम 100,000)" },
            validation: { required: true, minValue: 0, maxValue: 100000, decimalPlaces: 2 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    WholeNumMax100: {
        id: "WholeNumMax100",
        displayName: "Whole Number (0 to 100)",
        category: "numeric",
        description: "Non-negative integer (0, 1, 2... 100) such as percentage or count.",
        iconName: "Hash",
        defaultConfig: {
            titles: { en: "Enter whole count (0-100)", hi: "पूर्णांक दर्ज करें (0-100)" },
            validation: { required: true, minValue: 0, maxValue: 100, decimalPlaces: 0 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    WholeNumMax500: {
        id: "WholeNumMax500",
        displayName: "Whole Number (0 to 500)",
        category: "numeric",
        description: "Non-negative integer bounded up to 500.",
        iconName: "Hash",
        defaultConfig: {
            titles: { en: "Enter whole count (0-500)", hi: "पूर्णांक दर्ज करें (0-500)" },
            validation: { required: true, minValue: 0, maxValue: 500, decimalPlaces: 0 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    WholeNumMax1000: {
        id: "WholeNumMax1000",
        displayName: "Whole Number (0 to 1000)",
        category: "numeric",
        description: "Non-negative integer bounded up to 1,000.",
        iconName: "Hash",
        defaultConfig: {
            titles: { en: "Enter whole count (0-1000)", hi: "पूर्णांक दर्ज करें (0-1000)" },
            validation: { required: true, minValue: 0, maxValue: 1000, decimalPlaces: 0 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    NaturalNumMax10000: {
        id: "NaturalNumMax10000",
        displayName: "Natural Number (1 to 10,000)",
        category: "numeric",
        description: "Positive natural number (1, 2, 3... 10,000).",
        iconName: "Hash",
        defaultConfig: {
            titles: { en: "Enter natural count (1-10,000)", hi: "प्राकृतिक संख्या दर्ज करें (1-10,000)" },
            validation: { required: true, minValue: 1, maxValue: 10000, decimalPlaces: 0 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },

    // 4. Date & Time
    Date: {
        id: "Date",
        displayName: "Calendar",
        category: "datetime",
        description: "Standard single date selection field.",
        iconName: "Calendar",
        defaultConfig: {
            titles: { en: "Select date", hi: "दिनांक चुनें" },
            validation: { required: true },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    DateRange: {
        id: "DateRange",
        displayName: "Date Range",
        category: "datetime",
        description: "Select a continuous start date and end date range.",
        iconName: "CalendarDays",
        defaultConfig: {
            titles: { en: "Select date range", hi: "दिनांक सीमा चुनें" },
            validation: { required: true, allowSameDayRange: true },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    CalendarWithDate: {
        id: "CalendarWithDate",
        displayName: "Calendar Date",
        category: "datetime",
        description: "Visual calendar modal with minimum/maximum date boundaries.",
        iconName: "CalendarDays",
        defaultConfig: {
            titles: { en: "Select date from calendar", hi: "कैलेंडर से दिनांक चुनें" },
            validation: { required: true },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 5. Media
    "Picture Input": {
        id: "Picture Input",
        displayName: "Picture",
        category: "media",
        description: "Camera snapshot or gallery photo upload (e.g., NoC document, plot photo).",
        iconName: "Camera",
        defaultConfig: {
            titles: { en: "Take photo or upload image", hi: "फ़ोटो लें या छवि अपलोड करें" },
            validation: { required: true, minPhotos: 1, maxPhotos: 3, allowedMediaSource: "both" },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Video: {
        id: "Video",
        displayName: "Video",
        category: "media",
        description: "Short video clip recording for field condition audits.",
        iconName: "Video",
        defaultConfig: {
            titles: { en: "Record video overview", hi: "वीडियो रिकॉर्ड करें" },
            validation: { required: false, maxFileSizeMb: 50 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 6. Location
    Map: {
        id: "Map",
        displayName: "Location",
        category: "location",
        description: "Capture exact Latitude / Longitude coordinates with GPS accuracy check.",
        iconName: "MapPin",
        defaultConfig: {
            titles: { en: "Confirm GPS coordinates", hi: "जीपीएस स्थान की पुष्टि करें" },
            validation: { required: true },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    PolygonBoundary: {
        id: "PolygonBoundary",
        displayName: "Polygon boundary",
        category: "location",
        description: "Draw or walk plot vertices to generate GPS polygon geometry and KML record.",
        iconName: "Pentagon",
        defaultConfig: {
            titles: { en: "Record plot boundary vertices", hi: "खेत की सीमा (पॉलीगॉन) रिकॉर्ड करें" },
            validation: { required: true, minVertices: 3, maxVertices: 50 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 7. Utilities
    QRCode: {
        id: "QRCode",
        displayName: "QR Code",
        category: "utilities",
        description: "Scan physical sample barcode or QR code with prefix validation and manual fallback.",
        iconName: "QrCode",
        defaultConfig: {
            titles: { en: "Scan sample QR code", hi: "नमूना क्यूआर कोड स्कैन करें" },
            validation: { required: true, qrPrefix: "MATI-" },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: true,
            ageDependency: false,
        },
    },
    Rating: {
        id: "Rating",
        displayName: "Rating",
        category: "utilities",
        description: "1 to 5 star/number rating scale.",
        iconName: "Star",
        defaultConfig: {
            titles: { en: "Rate satisfaction level", hi: "संतुष्टि स्तर को रेट करें" },
            validation: { required: true, ratingMax: 5, ratingStep: 1 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Emoji: {
        id: "Emoji",
        displayName: "Emoji",
        category: "choice",
        description: "Visual emoji sentiment scale (e.g. 5-point smile/neutral/frown).",
        iconName: "Smile",
        defaultConfig: {
            titles: { en: "How was your experience?", hi: "आपका अनुभव कैसा रहा?" },
            validation: { required: true, emojiScale: "5-point" },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Rank: {
        id: "Rank",
        displayName: "Rank",
        category: "choice",
        description: "Order options by preference, priority, or importance.",
        iconName: "ListOrdered",
        defaultConfig: {
            titles: { en: "Rank the following in order of priority", hi: "प्राथमिकता के क्रम में रैंक करें" },
            options: [
                { value: "opt_1", labels: { en: "Priority 1", hi: "प्राथमिकता 1" } },
                { value: "opt_2", labels: { en: "Priority 2", hi: "प्राथमिकता 2" } },
                { value: "opt_3", labels: { en: "Priority 3", hi: "प्राथमिकता 3" } },
            ],
            validation: { required: true },
        },
        supports: {
            required: true,
            options: true,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Time: {
        id: "Time",
        displayName: "Time",
        category: "datetime",
        description: "Time of day selection (12-hour AM/PM or 24-hour clock).",
        iconName: "Clock",
        defaultConfig: {
            titles: { en: "Select time", hi: "समय चुनें" },
            validation: { required: true, timeFormat: "12h" },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Audio: {
        id: "Audio",
        displayName: "Audio",
        category: "media",
        description: "Audio recording or voice memo upload for field observations.",
        iconName: "Mic",
        defaultConfig: {
            titles: { en: "Record voice memo or upload audio", hi: "वॉयस मेमो रिकॉर्ड करें" },
            validation: { required: false, maxDurationSeconds: 120 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
    Document: {
        id: "Document",
        displayName: "Document",
        category: "media",
        description: "Attach PDF, Word doc, or spreadsheet file records.",
        iconName: "Paperclip",
        defaultConfig: {
            titles: { en: "Attach document / report (PDF)", hi: "दस्तावेज़ संलग्न करें (PDF)" },
            validation: { required: false, maxFileSizeMb: 25, allowedExtensions: ["pdf", "docx", "xlsx"] },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: false,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },

    // 8. Advanced / Repeater
    Repeater_QT: {
        id: "Repeater_QT",
        displayName: "Repeater QT",
        category: "advanced",
        description: "Repeats a group of questions dynamically based on a count or user answer.",
        iconName: "Layers",
        defaultConfig: {
            titles: { en: "How many plots do you have?", hi: "उपयोग के लिए आपके पास कितनी भूमि/प्लॉट हैं?" },
            validation: { required: true, minValue: 1, maxValue: 20 },
        },
        supports: {
            required: true,
            options: false,
            validation: true,
            conditionalLogic: true,
            repeater: true,
            translations: true,
            dataColumnName: true,
            anomaly: false,
            ageDependency: false,
        },
    },
};

/**
 * Clean, consolidated 21 user-facing question types.
 * Replaces duplicate numeric variants with one configurable 'Number' type
 * and contains all supported types from the complete survey question catalog.
 */
export const SIMPLIFIED_QUESTION_TYPES: BackendQuestionType[] = [
    // Choice & Selection
    "Radio",
    "Checkbox",
    "Dropdown",
    "Selected Dropdown",
    "Rank",
    "Emoji",
    // Text Input
    "Subjective",
    "TextArea",
    // Numeric & Precision
    "Number",
    // Date & Time
    "Date",
    "DateRange",
    "Time",
    // Media & Files
    "Picture Input",
    "Audio",
    "Video",
    "Document",
    // Location & Spatial
    "Map",
    "PolygonBoundary",
    // Operational Utilities
    "QRCode",
    "Rating",
    // Advanced / Dynamic Containers
    "Repeater_QT",
];

