import { SurveyModel } from "../types/survey-schema";
import { analyzeDependencyGraph, DependencyIssue } from "./dependency-validator";
import { QUESTION_TYPE_REGISTRY } from "../registry/question-type-registry";
import { validateRegexSafety } from "./regex-safety";

export interface ValidationItem {
    id: string;
    type: "error" | "warning";
    category: "General" | "Question" | "Options" | "Logic" | "Translation" | "Validation" | "Master Data" | "Schedule";
    questionId?: string;
    questionNumber?: number;
    questionDisplayIndex?: string;
    title: string;
    message: string;
}

export interface SurveyValidationResult {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    errors: ValidationItem[];
    warnings: ValidationItem[];
}

/**
 * Performs deep pre-publish validation on the survey model
 */
export function validateSurvey(survey: SurveyModel): SurveyValidationResult {
    const errors: ValidationItem[] = [];
    const warnings: ValidationItem[] = [];

    // 1. Survey Metadata Checks
    if (!survey.name || survey.name.trim().length === 0) {
        errors.push({
            id: "err_survey_name",
            type: "error",
            category: "General",
            title: "Survey Name Missing",
            message: "The survey must have a non-empty name.",
        });
    }

    if (!survey.azId) {
        errors.push({
            id: "err_az_missing",
            type: "error",
            category: "General",
            title: "Agricultural Zone (AZ) Missing",
            message: "An Agricultural Zone must be assigned to this survey.",
        });
    }

    if (!survey.questions || survey.questions.length === 0) {
        errors.push({
            id: "err_no_questions",
            type: "error",
            category: "General",
            title: "No Questions Defined",
            message: "The survey must contain at least one question before publishing.",
        });
        return {
            isValid: false,
            errorCount: errors.length,
            warningCount: 0,
            errors,
            warnings,
        };
    }

    // 2. Uniqueness of Column Names
    const columnNameMap = new Map<string, string[]>(); // colName -> questionIds[]
    const snakeCaseRegex = /^[a-z0-9_]+$/;

    survey.questions.forEach((q) => {
        const col = q.columnName ? q.columnName.trim() : "";
        if (!col) {
            errors.push({
                id: `err_col_missing_${q.id}`,
                type: "error",
                category: "Question",
                questionId: q.id,
                questionNumber: q.number,
                title: `Missing Column Name (Q${q.number})`,
                message: `Question ${q.number} must specify an internal data column name.`,
            });
        } else {
            if (!snakeCaseRegex.test(col)) {
                warnings.push({
                    id: `warn_col_format_${q.id}`,
                    type: "warning",
                    category: "Question",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Non-standard Column Name (Q${q.number})`,
                    message: `Column name "${col}" should preferably use lowercase snake_case (e.g. is_owner).`,
                });
            }

            const existing = columnNameMap.get(col) || [];
            existing.push(q.id);
            columnNameMap.set(col, existing);
        }
    });

    // Check duplicate column names
    columnNameMap.forEach((qIds, col) => {
        if (qIds.length > 1) {
            qIds.forEach((qId) => {
                const q = survey.questions.find((x) => x.id === qId);
                errors.push({
                    id: `err_col_dup_${qId}`,
                    type: "error",
                    category: "Question",
                    questionId: qId,
                    questionNumber: q?.number,
                    title: `Duplicate Column Name: "${col}"`,
                    message: `Column name "${col}" is used across multiple questions. Internal data names must be unique.`,
                });
            });
        }
    });

    // 3. Question Level Config & Translations
    survey.questions.forEach((q) => {
        const typeDescriptor = QUESTION_TYPE_REGISTRY[q.type];

        // English Title
        if (!q.titles.en || q.titles.en.trim().length === 0) {
            errors.push({
                id: `err_title_en_${q.id}`,
                type: "error",
                category: "Question",
                questionId: q.id,
                questionNumber: q.number,
                title: `Missing Title (Q${q.number})`,
                message: `Question ${q.number} is missing its primary English text.`,
            });
        }

        // Secondary Language Translations
        survey.locales.forEach((loc) => {
            if (!loc.isDefault) {
                const tr = q.titles[loc.code];
                if (!tr || tr.trim().length === 0) {
                    warnings.push({
                        id: `warn_tr_${loc.code}_${q.id}`,
                        type: "warning",
                        category: "Translation",
                        questionId: q.id,
                        questionNumber: q.number,
                        title: `Missing ${loc.label} Translation (Q${q.number})`,
                        message: `Question ${q.number} does not have a translation for ${loc.label}.`,
                    });
                }
            }
        });

        // Choice Questions Option Verification
        if (typeDescriptor?.supports.options) {
            if (!q.options || q.options.length < 2) {
                errors.push({
                    id: `err_options_count_${q.id}`,
                    type: "error",
                    category: "Options",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Insufficient Options (Q${q.number})`,
                    message: `Choice question "${q.titles.en || `Q${q.number}`}" must have at least 2 selectable options.`,
                });
            } else {
                const optValues = new Set<string>();
                q.options.forEach((opt, oIdx) => {
                    if (!opt.labels.en || opt.labels.en.trim().length === 0) {
                        errors.push({
                            id: `err_opt_label_${q.id}_${oIdx}`,
                            type: "error",
                            category: "Options",
                            questionId: q.id,
                            questionNumber: q.number,
                            title: `Blank Option Label in Q${q.number}`,
                            message: `Option ${oIdx + 1} has an empty English label.`,
                        });
                    }
                    if (optValues.has(opt.value)) {
                        errors.push({
                            id: `err_opt_val_dup_${q.id}_${oIdx}`,
                            type: "error",
                            category: "Options",
                            questionId: q.id,
                            questionNumber: q.number,
                            title: `Duplicate Option Value in Q${q.number}`,
                            message: `Option value "${opt.value}" is repeated. Option values must be unique.`,
                        });
                    }
                    optValues.add(opt.value);
                });
            }
        }

        // Numeric Constraints
        if (q.validation.minValue !== undefined && q.validation.maxValue !== undefined) {
            if (q.validation.minValue > q.validation.maxValue) {
                errors.push({
                    id: `err_numeric_range_${q.id}`,
                    type: "error",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Invalid Numeric Range (Q${q.number})`,
                    message: `Minimum value (${q.validation.minValue}) cannot exceed maximum value (${q.validation.maxValue}).`,
                });
            }
        }

        // Character Constraints
        if (q.validation.minChar !== undefined && q.validation.maxChar !== undefined) {
            if (q.validation.minChar > q.validation.maxChar) {
                errors.push({
                    id: `err_char_range_${q.id}`,
                    type: "error",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Invalid Character Length (Q${q.displayIndex || q.number})`,
                    message: `Minimum characters (${q.validation.minChar}) cannot exceed maximum (${q.validation.maxChar}).`,
                });
            }
        }

        // Multi-Select Checkbox Constraints
        if (q.type === "Checkbox") {
            if (q.validation.minSelections !== undefined && q.validation.maxSelections !== undefined) {
                if (q.validation.minSelections > q.validation.maxSelections) {
                    errors.push({
                        id: `err_sel_range_${q.id}`,
                        type: "error",
                        category: "Validation",
                        questionId: q.id,
                        questionNumber: q.number,
                        title: `Invalid Selection Range (Q${q.displayIndex || q.number})`,
                        message: `Minimum selections (${q.validation.minSelections}) cannot exceed maximum selections (${q.validation.maxSelections}).`,
                    });
                }
            }
            if (q.options && q.validation.maxSelections !== undefined && q.validation.maxSelections > q.options.length) {
                warnings.push({
                    id: `warn_sel_max_${q.id}`,
                    type: "warning",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Max Selections Exceeds Options (Q${q.displayIndex || q.number})`,
                    message: `Maximum selections (${q.validation.maxSelections}) is greater than total available options (${q.options.length}).`,
                });
            }
        }

        // Date Constraints
        if (q.type === "Date" || q.type === "CalendarWithDate") {
            if (q.validation.minDate && q.validation.maxDate) {
                if (new Date(q.validation.minDate) > new Date(q.validation.maxDate)) {
                    errors.push({
                        id: `err_date_range_${q.id}`,
                        type: "error",
                        category: "Validation",
                        questionId: q.id,
                        questionNumber: q.number,
                        title: `Invalid Date Range (Q${q.displayIndex || q.number})`,
                        message: `Minimum allowable date (${q.validation.minDate}) cannot be after maximum date (${q.validation.maxDate}).`,
                    });
                }
            }
        }

        // Media File Constraints
        if (q.type === "Picture Input" || q.type === "Video") {
            if (q.validation.minPhotos !== undefined && q.validation.maxPhotos !== undefined) {
                if (q.validation.minPhotos > q.validation.maxPhotos) {
                    errors.push({
                        id: `err_media_files_${q.id}`,
                        type: "error",
                        category: "Validation",
                        questionId: q.id,
                        questionNumber: q.number,
                        questionDisplayIndex: q.displayIndex,
                        title: `Invalid Photo Count Range (Q${q.displayIndex || q.number})`,
                        message: `Minimum required photos (${q.validation.minPhotos}) cannot exceed maximum allowed photos (${q.validation.maxPhotos}).`,
                    });
                }
            }
        }

        // Custom Special Field Checks
        if (q.type === "PolygonBoundary") {
            const minV = q.validation.minVertices ?? 3;
            if (minV < 3) {
                errors.push({
                    id: `err_poly_vert_${q.id}`,
                    type: "error",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Invalid Polygon Vertices (Q${q.displayIndex || q.number})`,
                    message: "A polygon geometry boundary must require at least 3 vertices.",
                });
            }
        }

        if (q.type === "QRCode" && !q.validation.qrPrefix) {
            warnings.push({
                id: `warn_qr_prefix_${q.id}`,
                type: "warning",
                category: "Validation",
                questionId: q.id,
                questionNumber: q.number,
                title: `QR Prefix Not Set (Q${q.displayIndex || q.number})`,
                message: "No validation prefix (e.g. MATI-) set for QR code scanner. Any barcode will be accepted.",
            });
        }

        // Regular Expression Pattern Validation Check
        if (q.validation.regexPattern) {
            const safety = validateRegexSafety(q.validation.regexPattern);
            if (!safety.isValid) {
                errors.push({
                    id: `err_regex_syntax_${q.id}`,
                    type: "error",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    questionDisplayIndex: q.displayIndex,
                    title: `Invalid Regex Pattern (Q${q.displayIndex || q.number})`,
                    message: `Regular expression pattern is invalid: ${safety.error}`,
                });
            } else if (safety.isReDoSRisky) {
                warnings.push({
                    id: `warn_regex_redos_${q.id}`,
                    type: "warning",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    questionDisplayIndex: q.displayIndex,
                    title: `ReDoS Regex Warning (Q${q.displayIndex || q.number})`,
                    message: safety.warning || "Regular expression contains nested quantifiers.",
                });
            }
        }

        // Master Data Configuration Check (Feature 5)
        if (q.optionSource === "master") {
            if (!q.masterDataConfig?.masterSetId) {
                errors.push({
                    id: `err_master_set_${q.id}`,
                    type: "error",
                    category: "Master Data",
                    questionId: q.id,
                    questionNumber: q.number,
                    questionDisplayIndex: q.displayIndex,
                    title: `Missing Master Data Set (Q${q.displayIndex || q.number})`,
                    message: "Question is configured to use Master Data but no master set is selected.",
                });
            }
        }

        // Multilingual completeness checks across all enabled locales
        survey.locales.forEach((loc) => {
            if (!loc.isDefault && (!q.titles[loc.code] || q.titles[loc.code].trim().length === 0)) {
                warnings.push({
                    id: `warn_trans_${loc.code}_${q.id}`,
                    type: "warning",
                    category: "Translation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Missing ${loc.label.split(" ")[0]} Translation (Q${q.displayIndex || q.number})`,
                    message: `Question prompt is untranslated in ${loc.label}.`,
                });
            }
        });

        // 4. Repeater Question Validation
        if (q.repeater?.isRepeater || q.type === "Repeater_QT") {
            const childIds = q.repeater?.childQuestionIds || [];
            const qIndex = survey.questions.findIndex((x) => x.id === q.id);

            // Empty repeater block check
            if (childIds.length === 0) {
                errors.push({
                    id: `err_repeater_empty_${q.id}`,
                    type: "error",
                    category: "Validation",
                    questionId: q.id,
                    questionNumber: q.number,
                    title: `Empty Repeater Block (Q${q.number})`,
                    message: `Repeater container Q${q.number} must contain at least one repeated child question.`,
                });
            } else {
                // Check if all referenced children exist and are valid
                childIds.forEach((cid) => {
                    const childQ = survey.questions.find((x) => x.id === cid);
                    if (!childQ) {
                        errors.push({
                            id: `err_repeater_broken_${q.id}_${cid}`,
                            type: "error",
                            category: "Validation",
                            questionId: q.id,
                            questionNumber: q.number,
                            title: `Broken Repeater Reference (Q${q.number})`,
                            message: `Repeater references question ID "${cid}" which does not exist in the survey.`,
                        });
                    } else {
                        const childIdx = survey.questions.findIndex((x) => x.id === cid);
                        if (childIdx <= qIndex) {
                            errors.push({
                                id: `err_repeater_order_${q.id}_${cid}`,
                                type: "error",
                                category: "Validation",
                                questionId: q.id,
                                questionNumber: q.number,
                                title: `Misplaced Repeated Question (Q${childQ.number})`,
                                message: `Repeated child question Q${childQ.number} must appear after repeater parent Q${q.number}.`,
                            });
                        }
                    }
                });
            }

            // Check count source validity
            if (q.repeater?.countSourceType === "question" && q.repeater.countQuestionId && q.repeater.countQuestionId !== q.id) {
                const countQ = survey.questions.find((x) => x.id === q.repeater?.countQuestionId);
                if (!countQ) {
                    errors.push({
                        id: `err_repeater_count_missing_${q.id}`,
                        type: "error",
                        category: "Validation",
                        questionId: q.id,
                        questionNumber: q.number,
                        title: `Invalid Count Source Question (Q${q.number})`,
                        message: "The question selected as repeat count source does not exist in the survey.",
                    });
                }
            } else if (q.repeater?.countSourceType === "fixed") {
                if (!q.repeater.fixedCount || q.repeater.fixedCount < 1) {
                    errors.push({
                        id: `err_repeater_fixed_count_${q.id}`,
                        type: "error",
                        category: "Validation",
                        questionId: q.id,
                        questionNumber: q.number,
                        title: `Invalid Fixed Repeat Count (Q${q.number})`,
                        message: "Fixed repeat count must be a positive integer greater than or equal to 1.",
                    });
                }
            }
        }
    });

    // 4. Dependency Graph Analysis
    const depIssues = analyzeDependencyGraph(survey.questions);
    depIssues.forEach((issue) => {
        const item: ValidationItem = {
            id: `dep_${issue.code}_${issue.questionId}`,
            type: issue.type,
            category: "Logic",
            questionId: issue.questionId,
            questionNumber: issue.questionNumber,
            questionDisplayIndex: issue.questionDisplayIndex,
            title: issue.code.replace(/_/g, " "),
            message: issue.message,
        };

        if (issue.type === "error") {
            errors.push(item);
        } else {
            warnings.push(item);
        }
    });

    return {
        isValid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors,
        warnings,
    };
}
