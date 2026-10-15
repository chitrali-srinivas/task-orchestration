import { BackendQuestionType } from "../types/survey-schema";

export interface QuestionTypeHelpContent {
    id: BackendQuestionType | string;
    title: string;
    whatItDoes: string;
    whenToUse: string;
    example: {
        question: string;
        response?: string;
        options?: string[];
    };
    tip?: string;
}

export const QUESTION_TYPE_HELP_REGISTRY: Record<BackendQuestionType, QuestionTypeHelpContent> = {
    // 1. Choice & Selection
    Radio: {
        id: "Radio",
        title: "Single Choice (Radio)",
        whatItDoes: "Lets respondents choose exactly one option from a list of predefined choices.",
        whenToUse: "Use for mutually exclusive options where only a single selection is permitted (e.g. Yes/No, Gender, Ownership status).",
        example: {
            question: "Is the farmer the legal owner of the land?",
            options: ["Yes", "No"],
        },
        tip: "Use this instead of Multi Select (Checkbox) when only one answer is allowed.",
    },
    Checkbox: {
        id: "Checkbox",
        title: "Multiple Choice (Checkbox)",
        whatItDoes: "Lets respondents select one or more applicable choices simultaneously.",
        whenToUse: "Use when respondents can select multiple valid answers (e.g. crops grown, equipment owned, irrigation sources).",
        example: {
            question: "Which crops are currently cultivated on this plot?",
            options: ["Wheat", "Mustard", "Paddy", "Sugarcane"],
        },
        tip: "Configure Min/Max selection limits in the Validation tab to restrict how many options can be chosen.",
    },
    Dropdown: {
        id: "Dropdown",
        title: "Dropdown Select",
        whatItDoes: "Provides a compact expandable menu to select exactly one option.",
        whenToUse: "Use when you have a list of options (5–20 items) and want to conserve vertical screen space on mobile devices.",
        example: {
            question: "Select the primary soil type of this field:",
            options: ["Alluvial Soil", "Black Clay Soil", "Red Sandy Loam", "Laterite Soil"],
        },
        tip: "For large or dynamic datasets like villages or trucks, consider connecting Master Data.",
    },
    "Selected Dropdown": {
        id: "Selected Dropdown",
        title: "Searchable Dropdown",
        whatItDoes: "Provides a searchable select menu with real-time text filtering for extensive option lists.",
        whenToUse: "Use for long option lists (20+ items) such as village names, seed varieties, or district registries where typing to filter is required.",
        example: {
            question: "Search and select the supplier base:",
            response: "Mati Operations Hub - Gorakhpur East",
        },
        tip: "Allows field agents to quickly type a keyword to filter long lists instead of scrolling.",
    },

    // 2. Text Input
    Subjective: {
        id: "Subjective",
        title: "Short Text",
        whatItDoes: "Accepts a single-line textual response for brief answers, names, codes, or identifiers.",
        whenToUse: "Use for farmer names, Aadhaar numbers, phone numbers, vehicle registrations, and brief remarks.",
        example: {
            question: "What is the primary farmer's full name?",
            response: "Ramesh Kumar Sharma",
        },
        tip: "Use validation presets (e.g. Indian Mobile, Aadhaar, PAN) or custom regex patterns to enforce format accuracy.",
    },
    TextArea: {
        id: "TextArea",
        title: "Long Text (Paragraph)",
        whatItDoes: "Provides an expandable multi-line text box for longer narrative observations, feedback, or field notes.",
        whenToUse: "Use when the response requires complete sentences, crop condition details, or auditor remarks.",
        example: {
            question: "Describe any visible pest damage or soil anomalies:",
            response: "Minor stem borer infestation observed on western plot boundary. Recommended organic spray.",
        },
        tip: "Set character limits in the Validation tab if you want to keep responses concise.",
    },

    // 3. Numeric & Precision
    Number: {
        id: "Number",
        title: "Generic Number",
        whatItDoes: "Accepts numerical input with customizable decimal precision and min/max limits.",
        whenToUse: "Use for generic counts, weights, distances, financial figures, or measurements.",
        example: {
            question: "What is the expected crop yield this season (in quintals)?",
            response: "45.5",
        },
        tip: "Specify minimum and maximum allowed limits and unit suffixes (e.g. 'Kg', 'Acres') in Validation.",
    },
    DecimalMax10: {
        id: "DecimalMax10",
        title: "Decimal Number (Max 10)",
        whatItDoes: "Precision decimal input strictly bounded between 0 and 10 with up to 2 decimal places.",
        whenToUse: "Ideal for individual land plot measurements (e.g. plot area in acres or hectares) where values rarely exceed 10.",
        example: {
            question: "Enter total plot area to enroll (Acres):",
            response: "3.75",
        },
        tip: "Prevents accidental entry of unrealistic plot sizes by capping input at 10.0.",
    },
    DecimalMax100: {
        id: "DecimalMax100",
        title: "Decimal Number (Max 100)",
        whatItDoes: "Precision decimal input bounded between 0 and 100 with 2 decimal places.",
        whenToUse: "Use for percentages, chemical dosage (e.g. liters per hectare), or medium-scale farm metrics.",
        example: {
            question: "Enter soil organic moisture percentage (%):",
            response: "24.8",
        },
        tip: "Ensures decimal entries stay within 0 to 100 boundaries.",
    },
    DecimalMax500: {
        id: "DecimalMax500",
        title: "Decimal Number (Max 500)",
        whatItDoes: "Precision decimal value bounded between 0 and 500.",
        whenToUse: "Use for mid-scale measurements such as fertilizer quantity (kg) or bag counts.",
        example: {
            question: "Quantity of biochar applied to plot (Kg):",
            response: "350.0",
        },
        tip: "Guarantees numerical precision up to 500.",
    },
    DecimalMax1000: {
        id: "DecimalMax1000",
        title: "Decimal Number (Max 1000)",
        whatItDoes: "Precision decimal value bounded up to 1,000.",
        whenToUse: "Use for bulk quantities such as total harvested weight in kilograms or metric volume.",
        example: {
            question: "Total biomass collected for pyrolysis (Kg):",
            response: "840.5",
        },
        tip: "Provides reliable input bounds for metric quantities.",
    },
    DecimalMax10000: {
        id: "DecimalMax10000",
        title: "Decimal Number (Max 10,000)",
        whatItDoes: "Precision decimal value bounded up to 10,000.",
        whenToUse: "Use for large financial payments, subsidy amounts, or bulk seed kilograms.",
        example: {
            question: "Estimated seasonal input cost (₹):",
            response: "8500.00",
        },
        tip: "Suitable for larger budget numbers and cost tracking.",
    },
    DecimalMax100000: {
        id: "DecimalMax100000",
        title: "Decimal Number (Max 100,000)",
        whatItDoes: "Precision decimal value bounded up to 100,000.",
        whenToUse: "Use for large financial revenues, village budgets, or annual farm earnings.",
        example: {
            question: "Total annual farm revenue (₹):",
            response: "75000",
        },
        tip: "Provides upper safety bound for village-level metrics.",
    },
    WholeNumMax100: {
        id: "WholeNumMax100",
        title: "Whole Number (0 to 100)",
        whatItDoes: "Accepts non-negative integers only (0, 1, 2... 100) without decimals.",
        whenToUse: "Use for counting items like tree counts, livestock, or whole percentage points.",
        example: {
            question: "How many fruit trees are planted on the plot boundary?",
            response: "18",
        },
        tip: "Rejects decimal fractions or negative numbers automatically.",
    },
    WholeNumMax500: {
        id: "WholeNumMax500",
        title: "Whole Number (0 to 500)",
        whatItDoes: "Non-negative integer strictly bounded between 0 and 500.",
        whenToUse: "Use for medium counts such as seed bags, farmer group sizes, or labor days.",
        example: {
            question: "Total number of labor days utilized during sowing:",
            response: "42",
        },
        tip: "Restricts responses to valid whole integer counts up to 500.",
    },
    WholeNumMax1000: {
        id: "WholeNumMax1000",
        title: "Whole Number (0 to 1000)",
        whatItDoes: "Non-negative integer bounded up to 1,000.",
        whenToUse: "Use for counting farm animals, seedling counts, or total surveyed households.",
        example: {
            question: "Total number of saplings distributed:",
            response: "650",
        },
        tip: "Clean integer counting with safety ceiling of 1,000.",
    },
    NaturalNumMax10000: {
        id: "NaturalNumMax10000",
        title: "Natural Number (1 to 10,000)",
        whatItDoes: "Positive counting integers strictly starting from 1 (1, 2, 3... 10,000).",
        whenToUse: "Use for counts that cannot be zero, such as family members, active farm workers, or positive survey IDs.",
        example: {
            question: "Total active household members residing on farm:",
            response: "6",
        },
        tip: "Automatically blocks 0 and negative numbers from being entered.",
    },

    // 4. Date & Time
    Date: {
        id: "Date",
        title: "Date Input",
        whatItDoes: "Standard date picker allowing respondents to select a single calendar date.",
        whenToUse: "Use for sowing dates, harvest dates, inspection dates, or agreement signatures.",
        example: {
            question: "Date of first irrigation cycle:",
            response: "15 Oct 2026",
        },
        tip: "Use 'Disallow Future Dates' in Validation for past events to prevent date errors.",
    },
    DateRange: {
        id: "DateRange",
        title: "Date Range (Start → End)",
        whatItDoes: "Captures a continuous time interval with explicit start and end dates.",
        whenToUse: "Use for sowing-to-harvest cycles, verification date windows, or lease agreement terms.",
        example: {
            question: "Active crop cycle duration (Start date to harvest date):",
            response: "01 Oct 2026 → 15 Dec 2026",
        },
        tip: "Enforce minimum and maximum duration in days and toggle single-day range in Validation.",
    },
    CalendarWithDate: {
        id: "CalendarWithDate",
        title: "Interactive Calendar Date",
        whatItDoes: "Visual modal calendar selector with visual date range boundaries.",
        whenToUse: "Use when surveyor needs a full visual month calendar view to select milestone dates.",
        example: {
            question: "Select scheduled biomass collection date:",
            response: "28 Nov 2026",
        },
        tip: "Supports min/max date constraints and past/future validation toggles.",
    },

    // 5. Media Capture
    "Picture Input": {
        id: "Picture Input",
        title: "Photo Capture / Upload",
        whatItDoes: "Enables field surveyors to capture live camera photos or upload gallery images.",
        whenToUse: "Use for capturing farmer Aadhaar cards, plot ownership NoC, crop health snapshots, or baseline soil photos.",
        example: {
            question: "Capture a clear photo of the farmer's signed NoC consent document:",
            response: "[Photo Attachment: noc_signed_page1.jpg]",
        },
        tip: "Enable 'Enforce GPS Geotag in Photo EXIF' in Validation to reject photos taken away from the field.",
    },
    Video: {
        id: "Video",
        title: "Video Record / Upload",
        whatItDoes: "Allows recording or attaching short video clips for field condition audits.",
        whenToUse: "Use for 360-degree plot overviews, machinery inspections, or farmer testimonial recordings.",
        example: {
            question: "Record a 15-second video scan of the wheat crop canopy:",
            response: "[Video Attachment: crop_scan.mp4]",
        },
        tip: "Set maximum file size limits in validation to prevent high bandwidth usage in rural zones.",
    },

    // 6. Location & Boundary
    Map: {
        id: "Map",
        title: "GPS Location Point",
        whatItDoes: "Captures high-accuracy Latitude and Longitude coordinates from device GPS.",
        whenToUse: "Use for marking plot center points, farm gates, water pump locations, or soil sampling points.",
        example: {
            question: "Capture GPS coordinates of the central soil sample point:",
            response: "26.8467° N, 80.9462° E (Accuracy: ±3.2m)",
        },
        tip: "Specify maximum allowed GPS accuracy (e.g. ±10 meters) to ensure reliable coordinates.",
    },
    PolygonBoundary: {
        id: "PolygonBoundary",
        title: "Plot Polygon Boundary GIS",
        whatItDoes: "Interactive GIS tool that records GPS polygon vertices as a farmer walks the perimeter of their plot.",
        whenToUse: "Mandatory for carbon credit land enrollment to calculate precise land area, KML geometry, and satellite audit layers.",
        example: {
            question: "Walk the perimeter of Plot 1 to generate the GIS polygon boundary:",
            response: "Polygon Geometry [12 vertices, Calculated Area: 3.42 Acres]",
        },
        tip: "Set min/max vertices (e.g. 3 to 50) and min/max area bounds in the Validation tab.",
    },

    // 7. Operational Utilities
    QRCode: {
        id: "QRCode",
        title: "QR Code / Barcode Scanner",
        whatItDoes: "Uses the device camera to scan physical QR codes or barcodes on sample bags or equipment tags.",
        whenToUse: "Use for tracking physical soil sample bags, biochar bag labels, or surveyor identity badges.",
        example: {
            question: "Scan the barcode sticker attached to the soil sample bag:",
            response: "MATI-SOIL-2026-9842",
        },
        tip: "Set a Required Prefix (e.g. 'MATI-') in Validation to prevent scanning incorrect QR codes.",
    },
    Rating: {
        id: "Rating",
        title: "Satisfaction Rating",
        whatItDoes: "Provides an interactive 1 to 5 (or 1 to 10) star rating scale for quick assessments.",
        whenToUse: "Use for farmer satisfaction reviews, program feedback, or surveyor rating of soil moisture.",
        example: {
            question: "How satisfied is the farmer with the biochar training session?",
            response: "★★★★★ (5 / 5 - Very Satisfied)",
        },
        tip: "Choose between 5-star or 10-star maximum scales in the Validation tab.",
    },

    // 8. Specialized & New Question Types
    Time: {
        id: "Time",
        title: "Time Input",
        whatItDoes: "Captures a specific time of day with AM/PM (12h) or 24-hour military clock selector.",
        whenToUse: "Use for equipment runtime start/stop, surveyor inspection check-in time, or scheduled delivery time.",
        example: {
            question: "What time was the soil core sample extracted?",
            response: "09:30 AM",
        },
        tip: "Choose between 12-Hour or 24-Hour clock format in the creation dialog.",
    },
    Emoji: {
        id: "Emoji",
        title: "Emoji Sentiment Scale",
        whatItDoes: "Presents an intuitive visual facial expression sentiment scale (3-point or 5-point).",
        whenToUse: "Use for quick farmer satisfaction ratings, training sentiment feedback, or non-literate survey workflows.",
        example: {
            question: "How satisfied are you with the technical guidance provided by the field officer?",
            response: "😍 (Delighted)",
        },
        tip: "Choose between 5-point (😡 🙁 😐 🙂 😍) or 3-point (🙁 😐 🙂) scale ranges.",
    },
    Rank: {
        id: "Rank",
        title: "Ranking / Priority Order",
        whatItDoes: "Allows respondents to sort or rank a list of options in order of preference or severity.",
        whenToUse: "Use for prioritizing agronomic challenges, ranking crop disease concerns, or ordering investment preferences.",
        example: {
            question: "Rank the top three challenges impacting your harvest this season:",
            response: "1. Water Scarcity > 2. Fertilizer Cost > 3. Pest Infestation",
        },
        tip: "Customize the ranking choices in the Options tab after creation.",
    },
    Audio: {
        id: "Audio",
        title: "Voice Memo / Audio",
        whatItDoes: "Records live voice notes via the device microphone or allows uploading short audio recordings.",
        whenToUse: "Use for collecting verbal farmer feedback, local dialect qualitative commentary, or surveyor field notes.",
        example: {
            question: "Record the farmer's verbal explanation of pest management practices:",
            response: "[Audio Recording: farmer_interview_q4.m4a (45s)]",
        },
        tip: "Set maximum recording duration in seconds to preserve device storage and sync bandwidth.",
    },
    Document: {
        id: "Document",
        title: "Document Upload (PDF / Office)",
        whatItDoes: "Allows attaching PDF certificates, DOCX agreements, or official land registration documents.",
        whenToUse: "Use for formal land patta deeds, bank passbook copies, water test lab certificates, or signed paper contracts.",
        example: {
            question: "Upload the official revenue department land registry extract (PDF):",
            response: "[Document Attachment: land_registry_record_2026.pdf]",
        },
        tip: "Set maximum file size in MB to ensure smooth uploads over rural 2G/3G networks.",
    },

    // 9. Advanced / Repeater
    Repeater_QT: {
        id: "Repeater_QT",
        title: "Repeater Container",
        whatItDoes: "Dynamic container that repeats a nested group of questions for multiple items (e.g. plots, crops, household members).",
        whenToUse: "Use when a respondent owns multiple plots or items, and you need to ask the same sub-questions for each item.",
        example: {
            question: "How many plots do you wish to enroll? (e.g. 3)",
            response: "Repeats Plot Area, Crop Type, and Boundary for Plot 1, Plot 2, Plot 3...",
        },
        tip: "Manage child sub-questions in the Repeater tab and set min/max iteration bounds in Validation.",
    },
};

/**
 * Returns help content for a given question type with safe fallback
 */
export function getQuestionTypeHelp(type: BackendQuestionType | string): QuestionTypeHelpContent {
    if (type && type in QUESTION_TYPE_HELP_REGISTRY) {
        return QUESTION_TYPE_HELP_REGISTRY[type as BackendQuestionType];
    }

    // Safe fallback for unlisted or legacy custom types
    return {
        id: type || "custom",
        title: type || "Custom Question Type",
        whatItDoes: "Captures responses according to the configured question type settings.",
        whenToUse: "Use when you want to collect data matching this response format.",
        example: {
            question: "Sample question prompt",
            response: "Sample response value",
        },
        tip: "Configure required rules and validation in the Validation tab.",
    };
}
