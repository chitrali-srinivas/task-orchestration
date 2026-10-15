import { LogicCondition, LogicRuleGroup, QuestionModel } from "../types/survey-schema";

/**
 * Deterministically evaluates a single condition against current respondent answers.
 * Zero eval, purely declarative Boolean logic.
 */
export function evaluateCondition(
    condition: LogicCondition,
    answers: Record<string, any>
): boolean {
    let rawAnswer = answers[condition.questionId];
    if (rawAnswer === undefined) {
        if (condition.questionId.startsWith("q_")) {
            rawAnswer = answers[condition.questionId.substring(2)];
        } else {
            rawAnswer = answers[`q_${condition.questionId}`];
        }
    }
    if (rawAnswer === undefined && answers) {
        const cleanCondId = condition.questionId.replace(/^q_/, "");
        const matchingKey = Object.keys(answers).find((k) => k.replace(/^q_/, "") === cleanCondId);
        if (matchingKey) {
            rawAnswer = answers[matchingKey];
        }
    }

    // Handle empty checks first
    if (condition.operator === "isEmpty") {
        return rawAnswer === undefined || rawAnswer === null || rawAnswer === "" || (Array.isArray(rawAnswer) && rawAnswer.length === 0);
    }
    if (condition.operator === "isNotEmpty") {
        return rawAnswer !== undefined && rawAnswer !== null && rawAnswer !== "" && (!Array.isArray(rawAnswer) || rawAnswer.length > 0);
    }

    if (rawAnswer === undefined || rawAnswer === null) {
        return false;
    }

    // Unwrap master object or complex answer to its primitive value if needed
    let answerVal = rawAnswer;
    if (rawAnswer && typeof rawAnswer === "object" && !Array.isArray(rawAnswer)) {
        answerVal = rawAnswer.recordId ?? rawAnswer.value ?? rawAnswer.id ?? rawAnswer.displayValue ?? rawAnswer;
    }

    const targetVal = condition.value;

    switch (condition.operator) {
        case "equals": {
            if (typeof targetVal === "boolean") {
                return Boolean(answerVal) === targetVal;
            }
            if (typeof targetVal === "number" || (!isNaN(Number(targetVal)) && typeof answerVal === "number")) {
                return Number(answerVal) === Number(targetVal);
            }
            return String(answerVal).toLowerCase().trim() === String(targetVal).toLowerCase().trim();
        }

        case "notEquals": {
            if (typeof targetVal === "boolean") {
                return Boolean(answerVal) !== targetVal;
            }
            if (typeof targetVal === "number" || (!isNaN(Number(targetVal)) && typeof answerVal === "number")) {
                return Number(answerVal) !== Number(targetVal);
            }
            return String(answerVal).toLowerCase().trim() !== String(targetVal).toLowerCase().trim();
        }

        case "contains": {
            if (Array.isArray(rawAnswer)) {
                return rawAnswer.some((item) => {
                    if (item && typeof item === "object") {
                        const vals = [item.recordId, item.value, item.id, item.displayValue].filter(Boolean);
                        return vals.some((v) => String(v).toLowerCase().trim() === String(targetVal).toLowerCase().trim() || String(v).toLowerCase().includes(String(targetVal).toLowerCase()));
                    }
                    return String(item).toLowerCase().trim() === String(targetVal).toLowerCase().trim() || String(item).toLowerCase().includes(String(targetVal).toLowerCase());
                });
            }
            return String(answerVal).toLowerCase().includes(String(targetVal).toLowerCase());
        }

        case "notContains": {
            if (Array.isArray(rawAnswer)) {
                return !rawAnswer.some((item) => {
                    if (item && typeof item === "object") {
                        const vals = [item.recordId, item.value, item.id, item.displayValue].filter(Boolean);
                        return vals.some((v) => String(v).toLowerCase().trim() === String(targetVal).toLowerCase().trim() || String(v).toLowerCase().includes(String(targetVal).toLowerCase()));
                    }
                    return String(item).toLowerCase().trim() === String(targetVal).toLowerCase().trim() || String(item).toLowerCase().includes(String(targetVal).toLowerCase());
                });
            }
            return !String(answerVal).toLowerCase().includes(String(targetVal).toLowerCase());
        }

        case "greaterThan": {
            const numA = Number(rawAnswer);
            const numB = Number(targetVal);
            return !isNaN(numA) && !isNaN(numB) && numA > numB;
        }

        case "greaterThanOrEqual": {
            const numA = Number(rawAnswer);
            const numB = Number(targetVal);
            return !isNaN(numA) && !isNaN(numB) && numA >= numB;
        }

        case "lessThan": {
            const numA = Number(rawAnswer);
            const numB = Number(targetVal);
            return !isNaN(numA) && !isNaN(numB) && numA < numB;
        }

        case "lessThanOrEqual": {
            const numA = Number(rawAnswer);
            const numB = Number(targetVal);
            return !isNaN(numA) && !isNaN(numB) && numA <= numB;
        }

        default:
            return true;
    }
}

/**
 * Evaluates a rule group (AND / OR) of conditions.
 */
export function evaluateRuleGroup(
    ruleGroup: LogicRuleGroup,
    answers: Record<string, any>
): boolean {
    if (!ruleGroup.conditions || ruleGroup.conditions.length === 0) {
        return true;
    }

    if (ruleGroup.conjunction === "AND") {
        return ruleGroup.conditions.every((cond) => evaluateCondition(cond, answers));
    } else {
        return ruleGroup.conditions.some((cond) => evaluateCondition(cond, answers));
    }
}

/**
 * Determines whether a question should currently be visible.
 */
export function isQuestionVisible(
    question: QuestionModel,
    answers: Record<string, any>
): boolean {
    if (!question.visibility.enabled) {
        return true;
    }
    return evaluateRuleGroup(question.visibility.ruleGroup, answers);
}
