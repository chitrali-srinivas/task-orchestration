import { BackendQuestionType } from "../types/survey-schema";

export interface ValidationPreset {
    id: string;
    name: string;
    description: string;
    pattern: string;
    supportedQuestionTypes: BackendQuestionType[];
    exampleValid: string;
    exampleInvalid: string;
    defaultErrorMessage: string;
}

export const VALIDATION_PRESETS: ValidationPreset[] = [
    {
        id: "email",
        name: "Email Address",
        description: "Validates standard email address formats with domain extension.",
        pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        supportedQuestionTypes: ["Subjective", "TextArea"],
        exampleValid: "farmer.support@mati.earth",
        exampleInvalid: "farmer.support@mati",
        defaultErrorMessage: "Please enter a valid email address.",
    },
    {
        id: "phone_in",
        name: "Indian Mobile Number",
        description: "10-digit Indian mobile number with optional +91 country prefix.",
        pattern: "^(?:\\+91[\\s-]?)?[6-9]\\d{9}$",
        supportedQuestionTypes: ["Subjective", "Number", "DecimalMax100000", "NaturalNumMax10000"],
        exampleValid: "+91 9876543210 or 9876543210",
        exampleInvalid: "1234567890 or 98765",
        defaultErrorMessage: "Please enter a valid 10-digit mobile number.",
    },
    {
        id: "pin_in",
        name: "PIN Code (India)",
        description: "6-digit Indian postal PIN code (cannot start with 0).",
        pattern: "^[1-9][0-9]{5}$",
        supportedQuestionTypes: ["Subjective", "Number", "WholeNumMax1000", "NaturalNumMax10000"],
        exampleValid: "560001 or 110001",
        exampleInvalid: "012345 or 56001",
        defaultErrorMessage: "Please enter a valid 6-digit postal PIN code.",
    },
    {
        id: "pan_in",
        name: "PAN Card (India)",
        description: "Permanent Account Number: 5 uppercase letters, 4 digits, 1 uppercase letter.",
        pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
        supportedQuestionTypes: ["Subjective"],
        exampleValid: "ABCDE1234F",
        exampleInvalid: "ABCD12345F or abcde1234f",
        defaultErrorMessage: "Please enter a valid 10-character PAN number in uppercase.",
    },
    {
        id: "aadhaar_in",
        name: "Aadhaar Number (12 Digits)",
        description: "12-digit Indian national identity number.",
        pattern: "^\\d{12}$",
        supportedQuestionTypes: ["Subjective", "Number", "NaturalNumMax10000"],
        exampleValid: "123456789012",
        exampleInvalid: "12345678901 or 1234-5678-9012",
        defaultErrorMessage: "Please enter a valid 12-digit Aadhaar number.",
    },
    {
        id: "alphanumeric",
        name: "Alphanumeric Characters Only",
        description: "Allows only uppercase/lowercase letters (A-Z, a-z) and digits (0-9).",
        pattern: "^[A-Za-z0-9]+$",
        supportedQuestionTypes: ["Subjective", "TextArea"],
        exampleValid: "Khasra78A",
        exampleInvalid: "Khasra#78!",
        defaultErrorMessage: "Only letters and numbers are allowed without special characters.",
    },
    {
        id: "alpha_spaces",
        name: "Letters and Spaces Only",
        description: "Allows person names or plain words containing only letters and spaces.",
        pattern: "^[A-Za-z\\s]+$",
        supportedQuestionTypes: ["Subjective", "TextArea"],
        exampleValid: "Ramesh Kumar Sharma",
        exampleInvalid: "Ramesh_123",
        defaultErrorMessage: "Only alphabetic characters and spaces are allowed.",
    },
    {
        id: "integer",
        name: "Integer (Positive or Negative)",
        description: "Whole numbers including negative values (e.g. -5, 0, 42).",
        pattern: "^-?\\d+$",
        supportedQuestionTypes: ["Subjective", "Number", "WholeNumMax100", "WholeNumMax500", "WholeNumMax1000", "NaturalNumMax10000", "Repeater_QT"],
        exampleValid: "-10, 0, 45",
        exampleInvalid: "12.5 or abc",
        defaultErrorMessage: "Please enter a valid integer number.",
    },
    {
        id: "positive_integer",
        name: "Positive Integer (> 0)",
        description: "Strictly positive whole numbers starting from 1.",
        pattern: "^[1-9]\\d*$",
        supportedQuestionTypes: ["Subjective", "Number", "WholeNumMax100", "WholeNumMax500", "WholeNumMax1000", "NaturalNumMax10000", "Repeater_QT"],
        exampleValid: "1, 15, 250",
        exampleInvalid: "0, -5, 3.14",
        defaultErrorMessage: "Please enter a positive whole number greater than 0.",
    },
    {
        id: "decimal",
        name: "Decimal Number",
        description: "Standard integer or floating-point decimal number.",
        pattern: "^-?\\d+(?:\\.\\d+)?$",
        supportedQuestionTypes: ["Subjective", "Number", "DecimalMax10", "DecimalMax100", "DecimalMax500", "DecimalMax1000", "DecimalMax10000", "DecimalMax100000"],
        exampleValid: "4.75, -0.5, 100",
        exampleInvalid: "4.7.5 or abc",
        defaultErrorMessage: "Please enter a valid decimal number.",
    },
    {
        id: "vehicle_in",
        name: "Vehicle Registration (India)",
        description: "Standard Indian vehicle license plate format (State code, RTO, series, digits). Common format: users can customize.",
        pattern: "^[A-Z]{2}[\\s-]?[0-9]{1,2}[\\s-]?[A-Z]{1,3}[\\s-]?[0-9]{4}$",
        supportedQuestionTypes: ["Subjective"],
        exampleValid: "KA01AB1234 or DL 03 C 5678",
        exampleInvalid: "KA-01-ABCDEF or 12345",
        defaultErrorMessage: "Please enter a valid vehicle registration number (e.g. KA01AB1234).",
    },
];

/**
 * Retrieves presets relevant to a specific question type
 */
export function getPresetsForQuestionType(type: BackendQuestionType): ValidationPreset[] {
    const matched = VALIDATION_PRESETS.filter((p) => p.supportedQuestionTypes.includes(type));
    return matched.length > 0 ? matched : VALIDATION_PRESETS;
}

/**
 * Looks up a preset by its ID
 */
export function getPresetById(presetId?: string): ValidationPreset | undefined {
    if (!presetId) return undefined;
    return VALIDATION_PRESETS.find((p) => p.id === presetId);
}

/**
 * Validates a value against a preset's regex pattern
 */
export function testPresetValue(presetId: string, value: string): boolean {
    const preset = getPresetById(presetId);
    if (!preset) return true;
    try {
        const regex = new RegExp(preset.pattern);
        return regex.test(value);
    } catch {
        return false;
    }
}
