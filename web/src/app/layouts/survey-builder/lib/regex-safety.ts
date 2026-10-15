/**
 * Safe Regex syntax checking and ReDoS protection utilities
 */

export interface RegexValidationResult {
    isValid: boolean;
    error?: string;
    isReDoSRisky?: boolean;
    warning?: string;
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
    let compiled: RegExp;
    try {
        compiled = new RegExp(pattern);
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
 * Safely tests a string against a regex pattern without crashing the application
 */
export function testRegexPattern(
    pattern: string,
    testValue: string
): { matches: boolean; error?: string } {
    if (!pattern || pattern.trim().length === 0) {
        return { matches: true };
    }

    try {
        const regex = new RegExp(pattern);
        const matches = regex.test(testValue);
        return { matches };
    } catch (err: any) {
        return {
            matches: false,
            error: err?.message || "Failed to execute regular expression test.",
        };
    }
}
