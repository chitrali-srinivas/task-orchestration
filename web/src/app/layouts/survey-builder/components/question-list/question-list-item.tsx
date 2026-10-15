"use client";

import React from "react";
import {
    GripVertical,
    MoreVertical,
    Copy,
    Trash2,
    ArrowUp,
    ArrowDown,
    Radio,
    CheckSquare,
    ChevronDownSquare,
    ListFilter,
    AlignLeft,
    FileText,
    Hash,
    Binary,
    Calendar,
    CalendarDays,
    Camera,
    Video,
    MapPin,
    Pentagon,
    QrCode,
    Star,
    Layers,
    GitBranch,
    Asterisk,
    AlertCircle,
    Plus,
    FolderInput,
    FolderOutput,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BackendQuestionType, QuestionModel } from "../../types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "../../registry/question-type-registry";
import { ValidationItem } from "../../lib/survey-validator";
import { AddQuestionPopover } from "./add-question-popover";

interface QuestionListItemProps {
    question: QuestionModel;
    index: number;
    isSelected: boolean;
    hasErrors?: boolean;
    issues?: ValidationItem[];
    isFirst: boolean;
    isLast: boolean;
    isDragging?: boolean;
    isDragOver?: boolean;
    isNewlyAdded?: boolean;
    isPublished?: boolean;
    isCollapsed?: boolean;
    isLastChild?: boolean;
    railLines?: boolean[];
    depth?: number;
    parentInfo?: {
        parent: QuestionModel;
        type: "repeater" | "followup";
        triggerOptionLabel?: string;
        isLastChild: boolean;
    } | null;
    hasChildren?: boolean;
    followUpCount?: number;
    allRepeaters?: { id: string; number: number; title: string }[];
    parentRepeater?: QuestionModel;
    onToggleCollapse?: (questionId: string) => void;
    onSelect: (questionId: string) => void;
    onDuplicate: (questionId: string) => void;
    onDelete: (question: QuestionModel) => void;
    onMoveUp: (questionId: string) => void;
    onMoveDown: (questionId: string) => void;
    onMoveToRepeater?: (questionId: string, targetRepeaterId: string) => void;
    onMoveOutOfRepeater?: (questionId: string) => void;
    onDetachFollowUp?: (questionId: string) => void;
    onAddFollowUp?: (question: QuestionModel) => void;
    onAddChildToRepeater?: (repeaterId: string, type: BackendQuestionType) => void;
    onDragStart?: (e: React.DragEvent, index: number) => void;
    onDragOver?: (e: React.DragEvent, index: number) => void;
    onDragEnter?: (e: React.DragEvent, index: number) => void;
    onDragLeave?: (e: React.DragEvent, index: number) => void;
    onDrop?: (e: React.DragEvent, index: number) => void;
    onDragEnd?: (e: React.DragEvent) => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Radio,
    CheckSquare,
    ChevronDownSquare,
    ListFilter,
    AlignLeft,
    FileText,
    Hash,
    Binary,
    Calendar,
    CalendarDays,
    Camera,
    Video,
    MapPin,
    Pentagon,
    QrCode,
    Star,
    Layers,
};

export function QuestionListItem({
    question,
    index,
    isSelected,
    hasErrors,
    issues = [],
    isFirst,
    isLast,
    isDragging,
    isDragOver,
    isNewlyAdded,
    isPublished = false,
    isCollapsed = false,
    isLastChild = false,
    railLines = [],
    depth: propDepth,
    parentInfo,
    hasChildren = false,
    followUpCount = 0,
    allRepeaters = [],
    parentRepeater,
    onToggleCollapse,
    onSelect,
    onDuplicate,
    onDelete,
    onMoveUp,
    onMoveDown,
    onMoveToRepeater,
    onMoveOutOfRepeater,
    onDetachFollowUp,
    onAddFollowUp,
    onAddChildToRepeater,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd,
}: QuestionListItemProps) {
    const typeDescriptor = QUESTION_TYPE_REGISTRY[question.type];
    const IconComponent = typeDescriptor ? ICON_MAP[typeDescriptor.iconName] || FileText : FileText;

    const formattedNum = String(question.number || index + 1).padStart(2, "0");
    const isRepeaterParent = question.type === "Repeater_QT" || Boolean(question.repeater?.isRepeater);
    
    // Check if this is a nested child (either repeater child or conditional follow-up child)
    const depth = propDepth || question.followUpDepth || (question.displayIndex ? question.displayIndex.split(".").length : 1);
    const isChild = depth > 1 || Boolean(parentInfo || parentRepeater || (question.displayIndex && question.displayIndex.includes(".")));
    const isFollowUpChild = parentInfo?.type === "followup" || (isChild && !parentRepeater && parentInfo?.type !== "repeater");
    const isRepeaterChild = parentInfo?.type === "repeater" || Boolean(parentRepeater);
    const isLastBranchChild = parentInfo ? parentInfo.isLastChild : isLastChild;

    // Ensure displayNum is always non-empty and clearly formatted
    const displayNum = (question.displayIndex && question.displayIndex.trim())
        ? question.displayIndex.trim()
        : formattedNum;

    const countSourceLabel = question.repeater?.countSourceType === "fixed"
        ? `Fixed (${question.repeater.fixedCount || 2})`
        : question.repeater?.countQuestionId && question.repeater.countQuestionId !== question.id
        ? "Other Qn"
        : "Self Answer";

    // Gutter width for hierarchical tree lines
    const indentWidth = isChild ? (depth - 1) * 20 : 0;

    return (
        <div
            id={`question-item-${question.id}`}
            className="relative flex items-stretch w-full group/branch"
        >
            {/* MULTI-COLUMN TREE GUIDE RAILS (Up to 5 Levels) */}
            {isChild && (
                <div
                    style={{ width: `${indentWidth}px` }}
                    className="relative shrink-0 select-none pointer-events-none"
                >
                    {/* Ancestor Vertical Rails */}
                    {Array.from({ length: depth - 1 }).map((_, colIdx) => {
                        const isImmediateParentCol = colIdx === depth - 2;
                        const hasContinuingRail = railLines[colIdx] ?? false;

                        if (isImmediateParentCol) {
                            // Immediate parent branch spur: vertical line from top to center + horizontal spur to card
                            return (
                                <React.Fragment key={colIdx}>
                                    {/* Vertical branch line from top to card branch level */}
                                    <div
                                        style={{ left: `${colIdx * 20 + 9}px` }}
                                        className={cn(
                                            "absolute top-0 w-[1.5px] bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover/branch:bg-zinc-400 dark:group-hover/branch:bg-zinc-500",
                                            isLastBranchChild ? "h-5 rounded-bl-[3px]" : "bottom-0"
                                        )}
                                    />
                                    {/* Horizontal branch spur into child card */}
                                    <div
                                        style={{ left: `${colIdx * 20 + 9}px`, width: "11px" }}
                                        className="absolute top-5 h-[1.5px] bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover/branch:bg-zinc-400 dark:group-hover/branch:bg-zinc-500"
                                    />
                                </React.Fragment>
                            );
                        }

                        // Ancestor column rail (connects higher-level branches across this child)
                        if (hasContinuingRail) {
                            return (
                                <div
                                    key={colIdx}
                                    style={{ left: `${colIdx * 20 + 9}px` }}
                                    className="absolute top-0 bottom-0 w-[1.5px] bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover/branch:bg-zinc-400 dark:group-hover/branch:bg-zinc-500"
                                />
                            );
                        }

                        return null;
                    })}
                </div>
            )}

            {/* Downward stem from parent row if it has children and is expanded */}
            {hasChildren && !isCollapsed && (
                <div
                    style={{ left: `${(depth - 1) * 20 + 9}px` }}
                    className="absolute -bottom-2 w-[1.5px] h-2 z-10 bg-zinc-300 dark:bg-zinc-700 pointer-events-none transition-colors group-hover/branch:bg-zinc-400 dark:group-hover/branch:bg-zinc-500"
                />
            )}

            {/* Question Card Container */}
            <div
                draggable={!isPublished}
                onDragStart={(e) => {
                    if (isPublished) return;
                    e.dataTransfer.setData("text/plain", question.id);
                    e.dataTransfer.effectAllowed = "move";
                    onDragStart?.(e, index);
                }}
                onDragOver={(e) => {
                    if (isPublished) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDragOver?.(e, index);
                }}
                onDragEnter={(e) => {
                    if (isPublished) return;
                    e.preventDefault();
                    onDragEnter?.(e, index);
                }}
                onDragLeave={(e) => {
                    if (isPublished) return;
                    e.preventDefault();
                    onDragLeave?.(e, index);
                }}
                onDrop={(e) => {
                    if (isPublished) return;
                    e.preventDefault();
                    onDrop?.(e, index);
                }}
                onDragEnd={(e) => {
                    if (isPublished) return;
                    onDragEnd?.(e);
                }}
                onClick={() => onSelect(question.id)}
                className={cn(
                    "group relative flex-1 min-w-0 flex flex-col gap-1.5 p-2.5 rounded-lg border transition-all text-xs cursor-pointer select-none",
                    isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800/90 border-zinc-900/50 dark:border-zinc-400 shadow-2xs"
                        : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800",
                    hasErrors && "border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20",
                    isDragging && "opacity-40 scale-[0.98] border-dashed border-zinc-400 dark:border-zinc-600 shadow-none",
                    isDragOver && !isDragging && "border-t-2 border-t-zinc-900 dark:border-t-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10 bg-zinc-50 dark:bg-zinc-800/50",
                    isNewlyAdded && "animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ring-2 ring-emerald-500/60 border-emerald-500/70 bg-emerald-50/40 dark:bg-emerald-950/30 shadow-md"
                )}
            >

                {/* Line 1: [Grip] [Display Number Badge] [Type Icon + Name] ... [Repeater Toggle / 3-dots] */}
                <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {!isPublished && (
                            <div
                                className="text-zinc-300 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                                title="Drag to reorder question"
                            >
                                <GripVertical className="h-3.5 w-3.5" />
                            </div>
                        )}

                        {/* Hierarchical Question Number Badge */}
                        <span
                            className={cn(
                                "font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-none transition-colors",
                                isSelected
                                    ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                    : "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                            )}
                        >
                            {displayNum}
                        </span>

                        {/* Depth Level Indicator Pill for Deep Trees (Levels 3, 4, 5) */}
                        {depth >= 3 && (
                            <span
                                className={cn(
                                    "font-mono text-[9px] font-bold px-1 py-0.2 rounded border shrink-0 leading-tight",
                                    depth === 5
                                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                )}
                                title={`Nesting Depth: Level ${depth} of 5`}
                            >
                                L{depth}
                            </span>
                        )}

                        {/* Question Type with Icon */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 min-w-0 truncate">
                            <IconComponent
                                className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-400"
                            />
                            <span className="truncate">{typeDescriptor?.displayName || question.type}</span>
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                        {isRepeaterParent && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleCollapse?.(question.id);
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={isCollapsed ? "Expand repeater questions" : "Collapse repeater questions"}
                            >
                                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-zinc-500", isCollapsed && "-rotate-90 text-zinc-700 dark:text-zinc-300")} />
                            </button>
                        )}

                        {!isPublished && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-6 w-6 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 opacity-70 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 text-xs">
                                    {/* 1-Click Add Follow-up for any question with depth < 5 */}
                                    {depth < 5 && onAddFollowUp && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddFollowUp(question);
                                                }}
                                                className="gap-2 cursor-pointer font-semibold text-zinc-900 dark:text-zinc-100"
                                            >
                                                <GitBranch className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                                                <span>Add Follow-up Question</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    {isRepeaterParent && onAddChildToRepeater && (
                                        <>
                                            <div className="p-1">
                                                <AddQuestionPopover
                                                    onAddQuestion={(type) => onAddChildToRepeater(question.id, type)}
                                                    trigger={
                                                        <button
                                                            type="button"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer text-xs text-zinc-900 dark:text-zinc-100"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            <span>Add Question to Repeater</span>
                                                        </button>
                                                    }
                                                />
                                            </div>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    {isRepeaterChild && onMoveOutOfRepeater && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMoveOutOfRepeater(question.id);
                                                }}
                                                className="gap-2 cursor-pointer font-medium text-zinc-800 dark:text-zinc-200"
                                            >
                                                <FolderOutput className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                <span>Move Out of Repeater</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    {isFollowUpChild && onDetachFollowUp && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDetachFollowUp(question.id);
                                                }}
                                                className="gap-2 cursor-pointer font-medium text-zinc-800 dark:text-zinc-200"
                                            >
                                                <FolderOutput className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                <span>Make Top-Level Question</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    {!isRepeaterParent && !isChild && allRepeaters.length > 0 && onMoveToRepeater && (
                                        <>
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="gap-2 cursor-pointer font-medium">
                                                    <FolderInput className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                    <span>Move to Repeater</span>
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="w-56 text-xs">
                                                    {allRepeaters.map((rep) => (
                                                        <DropdownMenuItem
                                                            key={rep.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onMoveToRepeater(question.id, rep.id);
                                                            }}
                                                            className="gap-2 cursor-pointer"
                                                        >
                                                            <Layers className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                                            <span className="truncate">Q{rep.number}: {rep.title}</span>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    {!isRepeaterParent && onAddFollowUp && depth < 5 && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddFollowUp(question);
                                                }}
                                                className="gap-2 cursor-pointer font-medium text-zinc-800 dark:text-zinc-200"
                                            >
                                                <GitBranch className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                                                <span>Add Follow-up Question</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                                        </>
                                    )}

                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDuplicate(question.id);
                                        }}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <Copy className="h-3.5 w-3.5 text-zinc-500" />
                                        <span>Duplicate</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

                                    <DropdownMenuItem
                                        disabled={isFirst}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveUp(question.id);
                                        }}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5 text-zinc-500" />
                                        <span>Move Up</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        disabled={isLast}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveDown(question.id);
                                        }}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5 text-zinc-500" />
                                        <span>Move Down</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(question);
                                        }}
                                        className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40 cursor-pointer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Line 2: Question Title */}
                <TooltipProvider>
                    <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                            <h4
                                className={cn(
                                    "text-xs leading-snug line-clamp-2 transition-colors",
                                    isSelected ? "font-semibold text-zinc-950 dark:text-zinc-50" : "font-medium text-zinc-800 dark:text-zinc-200"
                                )}
                            >
                                {question.titles.en || <span className="italic text-zinc-400">Untitled question</span>}
                            </h4>
                        </TooltipTrigger>
                        {question.titles.en && question.titles.en.length > 50 && (
                            <TooltipContent side="top" className="max-w-[320px] text-xs bg-zinc-900 border-zinc-800 text-zinc-100 p-2">
                                <p>{question.titles.en}</p>
                                {question.titles.hi && (
                                    <p className="text-zinc-400 mt-1 font-hindi">{question.titles.hi}</p>
                                )}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>

                {/* Line 3: Column Name + Metadata Badges */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-200/80 dark:border-zinc-700/80 truncate max-w-[130px]">
                        {question.columnName}
                    </span>

                    {isFollowUpChild && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 gap-0.5 font-medium shrink-0"
                        >
                            <GitBranch className="h-2.5 w-2.5" /> If &ldquo;{parentInfo?.triggerOptionLabel || "Yes"}&rdquo;
                        </Badge>
                    )}

                    {question.validation.required && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 gap-0.5 font-medium"
                        >
                            <Asterisk className="h-2 w-2" /> Required
                        </Badge>
                    )}

                    {isRepeaterParent && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono"
                        >
                            Repeat: {countSourceLabel}
                        </Badge>
                    )}

                    {followUpCount !== undefined && followUpCount > 0 && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 gap-0.5 font-medium"
                        >
                            <GitBranch className="h-2.5 w-2.5" /> {followUpCount} Follow-up{followUpCount > 1 ? "s" : ""}
                        </Badge>
                    )}

                    {!isFollowUpChild && question.visibility.enabled && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 gap-0.5 font-medium"
                        >
                            <GitBranch className="h-2.5 w-2.5" /> Logic ({question.visibility.ruleGroup?.conditions?.length || 1})
                        </Badge>
                    )}

                    {hasErrors && (
                        <HoverCard openDelay={120} closeDelay={150}>
                            <HoverCardTrigger asChild>
                                <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 h-4 border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200 gap-0.5 font-bold cursor-pointer hover:bg-rose-200/90 dark:hover:bg-rose-900/90 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <AlertCircle className="h-2.5 w-2.5" /> Issue{issues && issues.length > 1 ? `s (${issues.length})` : ""}
                                </Badge>
                            </HoverCardTrigger>
                            <HoverCardContent
                                align="start"
                                side="top"
                                sideOffset={6}
                                className="w-80 p-3 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 shadow-xl rounded-lg space-y-2 text-xs z-50 pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between pb-1.5 border-b border-rose-100 dark:border-rose-950">
                                    <div className="flex items-center gap-1.5 font-semibold text-rose-950 dark:text-rose-200 text-xs">
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                        <span>Validation {issues && issues.length > 1 ? `Issues (${issues.length})` : "Issue"}</span>
                                    </div>
                                    {issues && issues.length > 0 && (
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-medium">
                                            {issues.length} {issues.length > 1 ? "Errors" : "Error"}
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {issues && issues.length > 0 ? (
                                        issues.map((issue, idx) => (
                                            <div
                                                key={issue.id || idx}
                                                className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-950 dark:text-rose-200 space-y-1 text-left"
                                            >
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <span className="font-semibold text-[11px] text-zinc-900 dark:text-zinc-100 leading-tight">
                                                        {issue.title}
                                                    </span>
                                                    {issue.category && (
                                                        <span className="text-[9px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-900/50 px-1.5 py-0.5 rounded shrink-0">
                                                            {issue.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-normal">
                                                    {issue.message}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-left">
                                            <p className="font-semibold text-[11px] text-zinc-900 dark:text-zinc-100">
                                                Schema Validation Error
                                            </p>
                                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-normal">
                                                This question contains configuration issues that must be resolved before publishing.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    )}
                </div>
            </div>
        </div>
    );
}
