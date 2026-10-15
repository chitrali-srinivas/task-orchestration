"use client";

import React, { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackendQuestionType, QuestionModel } from "../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";
import { generateColumnName, recalculateQuestionNumbers } from "../../lib/survey-normalizer";
import { ValidationItem } from "../../lib/survey-validator";
import { QuestionListItem } from "./question-list-item";
import { AddQuestionPopover } from "./add-question-popover";
import { DeleteQuestionDialog } from "./delete-question-dialog";

interface QuestionListPanelProps {
    questions: QuestionModel[];
    selectedQuestionId: string | null;
    errorQuestionIds: Set<string>;
    validationErrors?: ValidationItem[];
    isPublished?: boolean;
    onSelectQuestion: (questionId: string) => void;
    onAddQuestion: (type: BackendQuestionType) => void;
    onDuplicateQuestion: (questionId: string) => void;
    onDeleteQuestion: (questionId: string) => void;
    onReorderQuestions: (reorderedQuestions: QuestionModel[]) => void;
}

type FilterTag = "ALL" | "REQUIRED" | "CONDITIONAL" | "REPEATER" | "ISSUES";

export function QuestionListPanel({
    questions,
    selectedQuestionId,
    errorQuestionIds,
    validationErrors = [],
    isPublished = false,
    onSelectQuestion,
    onAddQuestion,
    onDuplicateQuestion,
    onDeleteQuestion,
    onReorderQuestions,
}: QuestionListPanelProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTag, setFilterTag] = useState<FilterTag>("ALL");
    const [questionToDelete, setQuestionToDelete] = useState<QuestionModel | null>(null);

    // Map question ID to its validation issues
    const questionIssuesMap = useMemo(() => {
        const map = new Map<string, ValidationItem[]>();
        (validationErrors || []).forEach((issue) => {
            if (issue.questionId) {
                const list = map.get(issue.questionId) || [];
                list.push(issue);
                map.set(issue.questionId, list);
            }
        });
        return map;
    }, [validationErrors]);

    // Scroll & newly added animation state
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const prevQuestionIdsRef = React.useRef<Set<string>>(new Set(questions.map((q) => q.id)));
    const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

    // Auto-scroll to newly added question (in-place) and highlight without jumping to the bottom
    React.useEffect(() => {
        const prevIds = prevQuestionIdsRef.current;
        if (prevIds.size > 0 && questions.length > prevIds.size) {
            const newlyAdded =
                questions.find((q) => !prevIds.has(q.id)) ||
                (selectedQuestionId ? questions.find((q) => q.id === selectedQuestionId) : undefined);

            if (newlyAdded) {
                setRecentlyAddedId(newlyAdded.id);

                // Smoothly scroll specifically to the newly added question element
                requestAnimationFrame(() => {
                    const el = document.getElementById(`question-item-${newlyAdded.id}`);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                });

                // Clear highlight animation after 2.4s
                const timer = setTimeout(() => {
                    setRecentlyAddedId(null);
                }, 2400);

                prevQuestionIdsRef.current = new Set(questions.map((q) => q.id));
                return () => clearTimeout(timer);
            }
        }
        prevQuestionIdsRef.current = new Set(questions.map((q) => q.id));
    }, [questions, selectedQuestionId]);

    // Drag-and-drop reorder state
    const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
    const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

    // Track collapsed repeaters state
    const [collapsedRepeaterIds, setCollapsedRepeaterIds] = useState<Set<string>>(new Set());

    const handleToggleCollapseRepeater = (repeaterId: string) => {
        setCollapsedRepeaterIds((prev) => {
            const next = new Set(prev);
            if (next.has(repeaterId)) {
                next.delete(repeaterId);
            } else {
                next.add(repeaterId);
            }
            return next;
        });
    };

    // Auto-expand parent if a child question gets selected
    React.useEffect(() => {
        if (!selectedQuestionId) return;
        const parent = questions.find(
            (q) => (q.repeater?.isRepeater || q.type === "Repeater_QT") && q.repeater?.childQuestionIds?.includes(selectedQuestionId)
        );
        if (parent && collapsedRepeaterIds.has(parent.id)) {
            setCollapsedRepeaterIds((prev) => {
                const next = new Set(prev);
                next.delete(parent.id);
                return next;
            });
        }
    }, [selectedQuestionId, questions]);

    // Helpers to identify conditional and repeater questions
    const isConditionalQuestion = (q: QuestionModel) => {
        return Boolean(
            q.visibility?.enabled ||
            (q.visibility?.ruleGroup?.conditions && q.visibility.ruleGroup.conditions.length > 0) ||
            q.rawLegacyFields?.Parent_Dep ||
            q.rawLegacyFields?.Is_Cond
        );
    };

    const isRepeaterQuestion = (q: QuestionModel) => {
        return Boolean(
            q.repeater?.isRepeater ||
            q.type === "Repeater_QT" ||
            (q.repeater?.childQuestionIds && q.repeater.childQuestionIds.length > 0) ||
            q.rawLegacyFields?.Repeater
        );
    };

    // Filtering
    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            const matchesSearch =
                q.titles.en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (q.titles.hi && q.titles.hi.includes(searchQuery)) ||
                q.columnName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(q.number).includes(searchQuery) ||
                q.displayIndex?.includes(searchQuery);

            if (!matchesSearch) return false;

            if (filterTag === "REQUIRED") return Boolean(q.validation?.required);
            if (filterTag === "CONDITIONAL") return isConditionalQuestion(q);
            if (filterTag === "REPEATER") return isRepeaterQuestion(q);
            if (filterTag === "ISSUES") return errorQuestionIds.has(q.id);

            return true;
        });
    }, [questions, searchQuery, filterTag, errorQuestionIds]);

    const counts = useMemo(() => {
        return {
            all: questions.length,
            required: questions.filter((q) => q.validation?.required).length,
            conditional: questions.filter(isConditionalQuestion).length,
            repeater: questions.filter(isRepeaterQuestion).length,
            issues: errorQuestionIds.size,
        };
    }, [questions, errorQuestionIds]);

    const allRepeaters = useMemo(() => {
        return questions
            .filter((q) => q.repeater?.isRepeater || q.type === "Repeater_QT")
            .map((q) => ({
                id: q.id,
                number: q.number,
                title: q.titles.en || `Question ${q.number}`,
            }));
    }, [questions]);

    const getParentRepeater = (questionId: string) => {
        return questions.find(
            (q) => (q.repeater?.isRepeater || q.type === "Repeater_QT") && q.repeater?.childQuestionIds?.includes(questionId)
        );
    };

    const getQuestionParentInfo = (targetQ: QuestionModel): {
        parent: QuestionModel;
        type: "repeater" | "followup";
        triggerOptionLabel?: string;
        isLastChild: boolean;
    } | null => {
        // 1. Repeater Child Check
        const repParent = questions.find(
            (q) => (q.repeater?.isRepeater || q.type === "Repeater_QT") && q.repeater?.childQuestionIds?.includes(targetQ.id)
        );
        if (repParent) {
            const childIds = repParent.repeater?.childQuestionIds || [];
            const isLast = childIds[childIds.length - 1] === targetQ.id;
            return {
                parent: repParent,
                type: "repeater",
                isLastChild: isLast,
            };
        }

        // 2. Follow-up Child Check (visibility rule referencing parent)
        if (targetQ.visibility?.enabled && targetQ.visibility.ruleGroup?.conditions && targetQ.visibility.ruleGroup.conditions.length > 0) {
            const firstCond = targetQ.visibility.ruleGroup.conditions[0];
            if (firstCond.questionId && firstCond.questionId !== targetQ.id) {
                const folParent = questions.find(
                    (p) =>
                        p.id !== targetQ.id &&
                        (p.id === firstCond.questionId ||
                            p.id === `q_${firstCond.questionId}` ||
                            String(p.number) === firstCond.questionId ||
                            `q_${p.number}` === firstCond.questionId)
                );
                if (folParent) {
                    let triggerLabel = String(firstCond.value ?? "yes");
                    if (folParent.options && folParent.options.length > 0) {
                        const opt = folParent.options.find((o) => o.value === firstCond.value || o.id === firstCond.value);
                        if (opt) {
                            triggerLabel = opt.labels.en || opt.value;
                        }
                    }
                    const siblings = questions.filter(
                        (q) =>
                            q.id !== folParent.id &&
                            ((q.visibility?.enabled &&
                                q.visibility.ruleGroup?.conditions?.some(
                                    (c) =>
                                        c.questionId === folParent.id ||
                                        c.questionId === `q_${folParent.number}` ||
                                        c.questionId === String(folParent.number)
                                )) ||
                                Number(q.rawLegacyFields?.Parent_Dep) === folParent.number ||
                                String(q.rawLegacyFields?.Parent_Dep) === folParent.id)
                    );
                    const isLast = siblings.length > 0 && siblings[siblings.length - 1].id === targetQ.id;

                    return {
                        parent: folParent,
                        type: "followup",
                        triggerOptionLabel: triggerLabel,
                        isLastChild: isLast,
                    };
                }
            }
        } else if (targetQ.rawLegacyFields?.Parent_Dep) {
            const depNum = Number(targetQ.rawLegacyFields.Parent_Dep);
            const folParent = questions.find(
                (p) =>
                    p.id !== targetQ.id &&
                    (p.number === depNum ||
                        p.id === `q_${depNum}` ||
                        String(p.id) === String(targetQ.rawLegacyFields?.Parent_Dep))
            );
            if (folParent) {
                const siblings = questions.filter(
                    (q) =>
                        q.id !== folParent.id &&
                        (Number(q.rawLegacyFields?.Parent_Dep) === depNum ||
                            String(q.rawLegacyFields?.Parent_Dep) === folParent.id ||
                            (q.visibility?.enabled &&
                                q.visibility.ruleGroup?.conditions?.some(
                                    (c) =>
                                        c.questionId === folParent.id ||
                                        c.questionId === `q_${folParent.number}` ||
                                        c.questionId === String(folParent.number)
                                )))
                );
                const isLast = siblings.length > 0 && siblings[siblings.length - 1].id === targetQ.id;
                return {
                    parent: folParent,
                    type: "followup",
                    triggerOptionLabel: targetQ.rawLegacyFields.Opt_Dep || "Yes",
                    isLastChild: isLast,
                };
            }
        }

        return null;
    };

    const getAncestors = (child: QuestionModel, visited = new Set<string>()): string[] => {
        if (!child || visited.has(child.id)) return [];
        visited.add(child.id);
        const pInfo = getQuestionParentInfo(child);
        if (!pInfo) return [];
        return [...getAncestors(pInfo.parent, new Set(visited)), pInfo.parent.id];
    };

    const hasQuestionChildren = (targetQ: QuestionModel): boolean => {
        if (targetQ.repeater?.isRepeater || targetQ.type === "Repeater_QT") {
            return Boolean(targetQ.repeater?.childQuestionIds && targetQ.repeater.childQuestionIds.length > 0);
        }
        return questions.some(
            (q) =>
                q.id !== targetQ.id &&
                ((q.visibility?.enabled &&
                    q.visibility.ruleGroup?.conditions?.some(
                        (c) =>
                            c.questionId === targetQ.id ||
                            c.questionId === `q_${targetQ.number}` ||
                            c.questionId === String(targetQ.number)
                    )) ||
                    Number(q.rawLegacyFields?.Parent_Dep) === targetQ.number ||
                    String(q.rawLegacyFields?.Parent_Dep) === targetQ.id)
        );
    };

    const getFollowUpCount = (targetQ: QuestionModel): number => {
        return questions.filter(
            (q) =>
                q.id !== targetQ.id &&
                ((q.visibility?.enabled &&
                    q.visibility.ruleGroup?.conditions?.some(
                        (c) =>
                            c.questionId === targetQ.id ||
                            c.questionId === `q_${targetQ.number}` ||
                            c.questionId === String(targetQ.number)
                    )) ||
                    Number(q.rawLegacyFields?.Parent_Dep) === targetQ.number ||
                    String(q.rawLegacyFields?.Parent_Dep) === targetQ.id)
        ).length;
    };

    const handleDetachFollowUp = (questionId: string) => {
        const updatedQuestions = questions.map((q) => {
            if (q.id === questionId) {
                const copy: QuestionModel = {
                    ...q,
                    visibility: {
                        enabled: false,
                        ruleGroup: {
                            conjunction: "AND",
                            conditions: [],
                        },
                    },
                };
                if (copy.rawLegacyFields) {
                    delete copy.rawLegacyFields.Parent_Dep;
                    delete copy.rawLegacyFields.Opt_Dep;
                }
                return copy;
            }
            return q;
        });
        recalculateNumbers(updatedQuestions);
    };

    const recalculateNumbers = (list: QuestionModel[]) => {
        const updated = recalculateQuestionNumbers(list);
        onReorderQuestions(updated);
    };

    const handleMoveUp = (questionId: string) => {
        const index = questions.findIndex((q) => q.id === questionId);
        if (index <= 0) return;
        const newQuestions = [...questions];
        const temp = newQuestions[index - 1];
        newQuestions[index - 1] = newQuestions[index];
        newQuestions[index] = temp;
        recalculateNumbers(newQuestions);
    };

    const handleMoveDown = (questionId: string) => {
        const index = questions.findIndex((q) => q.id === questionId);
        if (index < 0 || index >= questions.length - 1) return;
        const newQuestions = [...questions];
        const temp = newQuestions[index + 1];
        newQuestions[index + 1] = newQuestions[index];
        newQuestions[index] = temp;
        recalculateNumbers(newQuestions);
    };

    const handleMoveToRepeater = (questionId: string, targetRepeaterId: string) => {
        const targetRep = questions.find((q) => q.id === targetRepeaterId);
        if (!targetRep) return;

        const currentChildIds = targetRep.repeater?.childQuestionIds || [];
        if (currentChildIds.includes(questionId)) return;

        const updatedChildIds = [...currentChildIds, questionId];
        const updatedTargetRep: QuestionModel = {
            ...targetRep,
            repeater: {
                countSourceType: targetRep.repeater?.countSourceType || "question",
                itemLabelTemplate: targetRep.repeater?.itemLabelTemplate || "Plot #{index}",
                countQuestionId: targetRep.repeater?.countQuestionId,
                fixedCount: targetRep.repeater?.fixedCount,
                ...targetRep.repeater,
                isRepeater: true,
                childQuestionIds: updatedChildIds,
            },
        };

        const updatedQuestions = questions.map((q) => {
            if (q.id === targetRepeaterId) return updatedTargetRep;
            if (q.repeater?.childQuestionIds?.includes(questionId)) {
                return {
                    ...q,
                    repeater: {
                        ...q.repeater,
                        countSourceType: q.repeater?.countSourceType || "question",
                        itemLabelTemplate: q.repeater?.itemLabelTemplate || "Plot #{index}",
                        isRepeater: Boolean(q.repeater?.isRepeater),
                        childQuestionIds: (q.repeater?.childQuestionIds || []).filter((cid) => cid !== questionId),
                    },
                };
            }
            return q;
        });

        const targetRepIndex = updatedQuestions.findIndex((q) => q.id === targetRepeaterId);
        const movedQIndex = updatedQuestions.findIndex((q) => q.id === questionId);
        const [movedQ] = updatedQuestions.splice(movedQIndex, 1);

        let insertIndex = targetRepIndex + 1;
        if (currentChildIds.length > 0) {
            const lastChildId = currentChildIds[currentChildIds.length - 1];
            const lastChildIdx = updatedQuestions.findIndex((q) => q.id === lastChildId);
            if (lastChildIdx !== -1) {
                insertIndex = lastChildIdx + 1;
            }
        }

        updatedQuestions.splice(insertIndex, 0, movedQ);
        recalculateNumbers(updatedQuestions);
    };

    const handleMoveOutOfRepeater = (questionId: string) => {
        const parentRep = getParentRepeater(questionId);
        if (!parentRep) return;

        const updatedChildIds = (parentRep.repeater?.childQuestionIds || []).filter((cid) => cid !== questionId);
        const updatedParentRep: QuestionModel = {
            ...parentRep,
            repeater: {
                countSourceType: parentRep.repeater?.countSourceType || "question",
                itemLabelTemplate: parentRep.repeater?.itemLabelTemplate || "Plot #{index}",
                ...parentRep.repeater,
                isRepeater: Boolean(parentRep.repeater?.isRepeater),
                childQuestionIds: updatedChildIds,
            },
        };

        const updatedQuestions = questions.map((q) => {
            if (q.id === parentRep.id) return updatedParentRep;
            if (q.id === questionId) {
                const copy = { ...q };
                if (copy.rawLegacyFields) {
                    delete copy.rawLegacyFields.Parent_Repeat;
                }
                return copy;
            }
            return q;
        });

        recalculateNumbers(updatedQuestions);
    };

    const handleAddChildToRepeater = (repeaterId: string, type: BackendQuestionType) => {
        const targetRep = questions.find((q) => q.id === repeaterId);
        if (!targetRep) return;

        const descriptor = QUESTION_TYPE_REGISTRY[type];
        const newId = `q_${Date.now()}`;
        const currentChildIds = targetRep.repeater?.childQuestionIds || [];
        const newChildNum = currentChildIds.length + 1;
        const hierarchicalDisplay = `${targetRep.displayIndex || targetRep.number}.${newChildNum}`;

        const newChildQuestion: QuestionModel = {
            id: newId,
            number: questions.length + 1,
            displayIndex: hierarchicalDisplay,
            type,
            displayType: descriptor ? descriptor.displayName : type,
            columnName: generateColumnName(descriptor ? `${targetRep.columnName}_${descriptor.displayName}` : `q_${newChildNum}`),
            titles: {
                en: descriptor ? `${descriptor.displayName} (Repeater Item)` : "New Repeater Question",
                hi: "",
            },
            options: descriptor?.defaultConfig?.options ? JSON.parse(JSON.stringify(descriptor.defaultConfig.options)) : undefined,
            validation: descriptor?.defaultConfig?.validation ? JSON.parse(JSON.stringify(descriptor.defaultConfig.validation)) : { required: true },
            visibility: {
                enabled: false,
                ruleGroup: {
                    conjunction: "AND",
                    conditions: [],
                },
            },
            rawLegacyFields: {
                Parent_Repeat: targetRep.number,
                Qn_In: hierarchicalDisplay,
            },
        };

        const repIndex = questions.findIndex((q) => q.id === repeaterId);
        let insertIndex = repIndex + 1;
        if (currentChildIds.length > 0) {
            const lastChildId = currentChildIds[currentChildIds.length - 1];
            const lastChildIdx = questions.findIndex((q) => q.id === lastChildId);
            if (lastChildIdx !== -1) {
                insertIndex = lastChildIdx + 1;
            }
        }

        const updatedQuestions = [...questions];
        updatedQuestions.splice(insertIndex, 0, newChildQuestion);

        const updatedTargetRep: QuestionModel = {
            ...targetRep,
            repeater: {
                countSourceType: targetRep.repeater?.countSourceType || "question",
                itemLabelTemplate: targetRep.repeater?.itemLabelTemplate || "Plot #{index}",
                ...targetRep.repeater,
                isRepeater: true,
                childQuestionIds: [...currentChildIds, newId],
            },
        };

        const finalQuestions = updatedQuestions.map((q) => (q.id === repeaterId ? updatedTargetRep : q));
        recalculateNumbers(finalQuestions);
        onSelectQuestion(newId);
    };

    // Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, questionId: string) => {
        setDraggedQuestionId(questionId);
    };

    const handleDragOver = (e: React.DragEvent, questionId: string) => {
        e.preventDefault();
        if (draggedQuestionId !== questionId && dragOverQuestionId !== questionId) {
            setDragOverQuestionId(questionId);
        }
    };

    const handleDragLeave = (e: React.DragEvent, questionId: string) => {
        if (dragOverQuestionId === questionId) {
            setDragOverQuestionId(null);
        }
    };

    const handleDrop = (e: React.DragEvent, targetQuestionId: string) => {
        e.preventDefault();
        if (!draggedQuestionId || draggedQuestionId === targetQuestionId) {
            setDraggedQuestionId(null);
            setDragOverQuestionId(null);
            return;
        }

        const sourceIndex = questions.findIndex((q) => q.id === draggedQuestionId);
        const targetIndex = questions.findIndex((q) => q.id === targetQuestionId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
            const reordered = [...questions];
            const [movedItem] = reordered.splice(sourceIndex, 1);
            reordered.splice(targetIndex, 0, movedItem);
            recalculateNumbers(reordered);
        }

        setDraggedQuestionId(null);
        setDragOverQuestionId(null);
    };

    const handleDragEnd = () => {
        setDraggedQuestionId(null);
        setDragOverQuestionId(null);
    };

    const visibleListQuestions = useMemo(() => {
        return filteredQuestions.filter((question) => {
            const parent = getParentRepeater(question.id);
            if (!parent) return true;
            if (searchQuery.trim() !== "" || filterTag !== "ALL") return true;
            if (collapsedRepeaterIds.has(parent.id) && question.id !== selectedQuestionId) {
                return false;
            }
            return true;
        });
    }, [filteredQuestions, collapsedRepeaterIds, selectedQuestionId, searchQuery, filterTag, questions]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 select-none">
            {/* Header & Controls */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                            Questions
                        </span>
                        <Badge
                            variant="secondary"
                            className="font-mono text-[10px] px-1.5 py-0 h-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold"
                        >
                            {questions.length}
                        </Badge>
                    </div>

                    {!isPublished && (
                        <AddQuestionPopover
                            onAddQuestion={onAddQuestion}
                            trigger={
                                <Button
                                    size="sm"
                                    className="h-7 px-2.5 text-xs font-semibold gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-2xs cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Question</span>
                                </Button>
                            }
                        />
                    )}
                </div>

                {/* Search input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        type="text"
                        placeholder="Search questions or column..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-7 text-xs bg-zinc-50/80 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 placeholder:text-zinc-400"
                    />
                </div>

            </div>

            {/* Questions Native Scrollable List */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5 scrollbar-minimal"
            >
                {visibleListQuestions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                        <p>No questions match your filter.</p>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setFilterTag("ALL");
                                }}
                                className="text-zinc-900 dark:text-zinc-100 underline text-[11px]"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    visibleListQuestions.map((question, idx) => {
                        const isSelected = question.id === selectedQuestionId;
                        const hasErrors = errorQuestionIds.has(question.id);
                        const isFirst = idx === 0;
                        const isLast = idx === visibleListQuestions.length - 1;
                        const isDragging = draggedQuestionId === question.id;
                        const isDragOver = dragOverQuestionId === question.id;
                        const isNewlyAdded = recentlyAddedId === question.id;
                        const parentInfo = getQuestionParentInfo(question);
                        const hasChildren = hasQuestionChildren(question);
                        const followUpCount = getFollowUpCount(question);
                        const parentRepeater = parentInfo?.type === "repeater" ? parentInfo.parent : undefined;
                        const isCollapsed = collapsedRepeaterIds.has(question.id);
                        const depth = question.followUpDepth || (question.displayIndex ? question.displayIndex.split(".").length : 1);
                        const ancestors = getAncestors(question);

                        // Calculate multi-column rail continuing lines
                        const railLines: boolean[] = [];
                        if (depth > 1) {
                            for (let col = 0; col < depth - 1; col++) {
                                const ancestorIdAtCol = ancestors[col];
                                if (!ancestorIdAtCol) {
                                    railLines.push(false);
                                    continue;
                                }
                                const hasContinuing = visibleListQuestions.slice(idx + 1).some((futureQ) => {
                                    const futureAncestors = getAncestors(futureQ);
                                    return futureAncestors.includes(ancestorIdAtCol);
                                });
                                railLines.push(hasContinuing);
                            }
                        }

                        // Determine if last child of its immediate parent in visible list
                        let isLastChild = false;
                        if (parentInfo && parentInfo.parent) {
                            const parentId = parentInfo.parent.id;
                            const hasLaterSibling = visibleListQuestions.slice(idx + 1).some((futureQ) => {
                                const fInfo = getQuestionParentInfo(futureQ);
                                return fInfo && fInfo.parent.id === parentId;
                            });
                            isLastChild = !hasLaterSibling;
                        }

                        return (
                            <QuestionListItem
                                key={question.id}
                                question={question}
                                index={idx}
                                isSelected={isSelected}
                                hasErrors={hasErrors}
                                issues={questionIssuesMap.get(question.id) || []}
                                isFirst={isFirst}
                                isLast={isLast}
                                isDragging={isDragging}
                                isDragOver={isDragOver}
                                isNewlyAdded={isNewlyAdded}
                                isPublished={isPublished}
                                isCollapsed={isCollapsed}
                                isLastChild={isLastChild}
                                railLines={railLines}
                                depth={depth}
                                parentInfo={parentInfo}
                                hasChildren={hasChildren}
                                followUpCount={followUpCount}
                                allRepeaters={allRepeaters}
                                parentRepeater={parentRepeater}
                                onToggleCollapse={handleToggleCollapseRepeater}
                                onSelect={onSelectQuestion}
                                onDuplicate={onDuplicateQuestion}
                                onDelete={(q) => setQuestionToDelete(q)}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                                onMoveToRepeater={handleMoveToRepeater}
                                onMoveOutOfRepeater={handleMoveOutOfRepeater}
                                onDetachFollowUp={handleDetachFollowUp}
                                onAddChildToRepeater={handleAddChildToRepeater}
                                onDragStart={(e) => handleDragStart(e, question.id)}
                                onDragOver={(e) => handleDragOver(e, question.id)}
                                onDragLeave={(e) => handleDragLeave(e, question.id)}
                                onDrop={(e) => handleDrop(e, question.id)}
                                onDragEnd={handleDragEnd}
                            />
                        );
                    })
                )}
            </div>

            {/* Safe Delete Question Dialog */}
            <DeleteQuestionDialog
                open={Boolean(questionToDelete)}
                onOpenChange={(open) => !open && setQuestionToDelete(null)}
                question={questionToDelete}
                allQuestions={questions}
                onConfirmDelete={onDeleteQuestion}
            />
        </div>
    );
}
