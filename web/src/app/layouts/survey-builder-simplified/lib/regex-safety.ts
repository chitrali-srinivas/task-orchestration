/**
 * Safe Regex syntax checking and ReDoS protection utilities
 */

export interface RegexValidationResult {
    isValid: boolean;
    error?: string;
    isReDoSRisky?: boolean;
    warning?: string;
}

export type RegexTestStatus = "empty" | "valid_match" | "valid_nomatch" | "invalid_syntax";

export interface RegexTestResult {
    status: RegexTestStatus;
    isMatching: boolean;
    matches: boolean;
    errorMessage?: string;
    error?: string;
    isEmptyPattern?: boolean;
    isEmptyInput?: boolean;
}

// Common patterns with dangerous nested quantifiers causing exponential backtracking (ReDoS)
const REDOS_PATTERNS = [
    /\([^)]*[+*]\)[+*]/, // e.g. (a+)+ or (.*)*
    /\([^)]*\+?\)[*+]\+/, // e.g. (a+)*+
    /([a-zA-Z0-9_\\]\+)\+\+/, // excessive quantifiers
];

/**
 * Validates whether a regular expression is syntactically valid and free of dangerous ReDoS patterns.
 */
export function validateRegexSafety(pattern: string): RegexValidationResult {
    if (!pattern || pattern.trim().length === 0) {
        return { isValid: true };
    }

    // 1. Syntax check
    try {
        new RegExp(pattern);
    } catch (err: any) {
        return {
            isValid: false,
            error: err?.message || "Invalid regular expression syntax.",
        };
    }

    // 2. ReDoS check for catastrophic backtracking
    const hasRisk = REDOS_PATTERNS.some((p) => p.test(pattern));
    if (hasRisk) {
        return {
            isValid: true,
            isReDoSRisky: true,
            warning: "Caution: This regular expression contains nested quantifiers that may cause slow performance.",
        };
    }

    return { isValid: true };
}

/**
 * Safely tests a string against a regex pattern without crashing the application.
 * Returns a 4-state result: 'empty' | 'valid_match' | 'valid_nomatch' | 'invalid_syntax'
 */
export function testRegexPattern(
    pattern: string,
    testValue: string
): RegexTestResult {
    if (!pattern || pattern.trim().length === 0) {
        return {
            status: "empty",
            isMatching: false,
            matches: false,
            isEmptyPattern: true,
        };
    }

    try {
        const regex = new RegExp(pattern);
        if (!testValue || testValue.trim().length === 0) {
            return {
                status: "empty",
                isMatching: false,
                matches: false,
                isEmptyInput: true,
            };
        }
        const matches = regex.test(testValue);
        return {
            status: matches ? "valid_match" : "valid_nomatch",
            isMatching: matches,
            matches,
        };
    } catch (err: any) {
        const msg = err?.message || "Invalid regular expression syntax.";
        return {
            status: "invalid_syntax",
            isMatching: false,
            matches: false,
            errorMessage: msg,
            error: msg,
        };
    }
}

/**
 * Sanitizes and escapes raw user input for safe literal regex matching
 */
export function sanitizeRegexPattern(str: string): string {
    if (!str) return "";
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
