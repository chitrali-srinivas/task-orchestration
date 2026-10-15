import { QuestionModel } from "../types/survey-schema";

export interface DependencyIssue {
    type: "error" | "warning";
    code:
        | "CIRCULAR_DEPENDENCY"
        | "SELF_REFERENCE"
        | "MISSING_PARENT_QUESTION"
        | "FORWARD_DEPENDENCY"
        | "BROKEN_REPEATER_PARENT"
        | "BROKEN_REPEATER_CHILD";
    questionId: string;
    questionNumber: number;
    questionDisplayIndex?: string;
    message: string;
    targetQuestionId?: string;
}

/**
 * Builds dependency graph and checks for cyclic references and invalid linkages.
 */
export function analyzeDependencyGraph(questions: QuestionModel[]): DependencyIssue[] {
    const issues: DependencyIssue[] = [];
    const questionMap = new Map<string, QuestionModel>();
    const orderIndexMap = new Map<string, number>();

    questions.forEach((q, idx) => {
        questionMap.set(q.id, q);
        orderIndexMap.set(q.id, idx);
    });

    // Build adjacency list for dependency tracking: child -> parents (prerequisites)
    const dependsOn = new Map<string, Set<string>>();

    questions.forEach((q) => {
        const parents = new Set<string>();

        // 1. Conditional visibility dependencies
        if (q.visibility.enabled && q.visibility.ruleGroup.conditions) {
            q.visibility.ruleGroup.conditions.forEach((cond) => {
                if (cond.questionId) {
                    parents.add(cond.questionId);

                    // Self reference check
                    if (cond.questionId === q.id) {
                        issues.push({
                            type: "error",
                            code: "SELF_REFERENCE",
                            questionId: q.id,
                            questionNumber: q.number,
                            questionDisplayIndex: q.displayIndex,
                            message: `Question ${q.displayIndex || q.number} cannot depend on itself.`,
                        });
                    }

                    // Missing parent check
                    const parentQ = questionMap.get(cond.questionId);
                    if (!parentQ) {
                        issues.push({
                            type: "error",
                            code: "MISSING_PARENT_QUESTION",
                            questionId: q.id,
                            questionNumber: q.number,
                            questionDisplayIndex: q.displayIndex,
                            message: `Question ${q.displayIndex || q.number} depends on non-existent question "${cond.questionId}".`,
                            targetQuestionId: cond.questionId,
                        });
                    } else {
                        // Forward dependency check (parent is positioned after child)
                        const childIdx = orderIndexMap.get(q.id) ?? 0;
                        const parentIdx = orderIndexMap.get(cond.questionId) ?? 0;
                        if (parentIdx > childIdx) {
                            issues.push({
                                type: "warning",
                                code: "FORWARD_DEPENDENCY",
                                questionId: q.id,
                                questionNumber: q.number,
                                questionDisplayIndex: q.displayIndex,
                                message: `Question ${q.displayIndex || q.number} depends on downstream Question ${parentQ.displayIndex || parentQ.number}. Place prerequisite questions before dependent questions.`,
                                targetQuestionId: cond.questionId,
                            });
                        }
                    }
                }
            });
        }

        // 2. Repeater dependencies
        if (q.repeater?.isRepeater) {
            if (q.repeater.countSourceType === "question" && q.repeater.countQuestionId && q.repeater.countQuestionId !== q.id) {
                if (!questionMap.has(q.repeater.countQuestionId)) {
                    issues.push({
                        type: "error",
                        code: "BROKEN_REPEATER_PARENT",
                        questionId: q.id,
                        questionNumber: q.number,
                        message: `Repeater Question ${q.number} references missing count question "${q.repeater.countQuestionId}".`,
                        targetQuestionId: q.repeater.countQuestionId,
                    });
                }
            }

            if (q.repeater.childQuestionIds) {
                q.repeater.childQuestionIds.forEach((childId) => {
                    if (!questionMap.has(childId)) {
                        issues.push({
                            type: "error",
                            code: "BROKEN_REPEATER_CHILD",
                            questionId: q.id,
                            questionNumber: q.number,
                            message: `Repeater Question ${q.number} includes deleted child question "${childId}".`,
                            targetQuestionId: childId,
                        });
                    }
                });
            }
        }

        dependsOn.set(q.id, parents);
    });

    // 3. Circular Dependency Detection via DFS
    const visited = new Map<string, "UNVISITED" | "VISITING" | "VISITED">();
    questions.forEach((q) => visited.set(q.id, "UNVISITED"));

    function dfs(currentId: string, path: string[]) {
        visited.set(currentId, "VISITING");
        path.push(currentId);

        const parents = dependsOn.get(currentId) || new Set<string>();
        parents.forEach((parentId) => {
            if (!questionMap.has(parentId)) return;

            const state = visited.get(parentId);
            if (state === "VISITING") {
                const cycleStart = path.indexOf(parentId);
                const cyclePath = path.slice(cycleStart).concat(parentId);
                const cycleNames = cyclePath
                    .map((id) => `Q${questionMap.get(id)?.displayIndex || questionMap.get(id)?.number || id}`)
                    .join(" → ");

                const currentQ = questionMap.get(currentId);
                issues.push({
                    type: "error",
                    code: "CIRCULAR_DEPENDENCY",
                    questionId: currentId,
                    questionNumber: currentQ?.number || 0,
                    questionDisplayIndex: currentQ?.displayIndex,
                    message: `Circular dependency detected: ${cycleNames}.`,
                    targetQuestionId: parentId,
                });
            } else if (state === "UNVISITED") {
                dfs(parentId, path);
            }
        });

        path.pop();
        visited.set(currentId, "VISITED");
    }

    questions.forEach((q) => {
        if (visited.get(q.id) === "UNVISITED") {
            dfs(q.id, []);
        }
    });

    return issues;
}
