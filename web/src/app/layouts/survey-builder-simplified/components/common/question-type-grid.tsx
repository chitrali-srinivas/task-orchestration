"use client";

import React, { useState, useMemo } from "react";
import {
    Search,
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
    Clock,
    Smile,
    ListOrdered,
    Mic,
    Paperclip,
    Layers,
    Divide,
    Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    BackendQuestionType,
    QuestionCategory,
} from "../../types/survey-schema";
import {
    QUESTION_CATEGORIES,
    QUESTION_TYPE_REGISTRY,
    QuestionTypeDescriptor,
    SIMPLIFIED_QUESTION_TYPES,
} from "../../registry/question-type-registry";
import { QuestionTypeHelpPopover } from "./question-type-help-popover";

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
    Clock,
    Smile,
    ListOrdered,
    Mic,
    Paperclip,
    Layers,
    Divide,
    Info,
};

export interface QuestionTypeGridProps {
    availableTypes?: QuestionTypeDescriptor[];
    selectedType?: BackendQuestionType;
    onSelectType: (type: BackendQuestionType) => void;
    onDoubleClickType?: (type: BackendQuestionType) => void;
    searchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    selectedCategory?: string;
    onSelectedCategoryChange?: (category: string) => void;
    showSearch?: boolean;
    showCategories?: boolean;
    showHelpPopover?: boolean;
    columns?: 1 | 2 | 3 | 4;
    compact?: boolean;
    className?: string;
}

export function QuestionTypeGrid({
    availableTypes,
    selectedType,
    onSelectType,
    onDoubleClickType,
    searchQuery: externalSearchQuery,
    onSearchQueryChange,
    selectedCategory: externalSelectedCategory,
    onSelectedCategoryChange,
    showSearch = true,
    showCategories = true,
    showHelpPopover = true,
    columns = 3,
    compact = false,
    className,
}: QuestionTypeGridProps) {
    const [internalSearchQuery, setInternalSearchQuery] = useState("");
    const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>("all");

    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
    const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;

    const selectedCategory = externalSelectedCategory !== undefined ? externalSelectedCategory : internalSelectedCategory;
    const setSelectedCategory = onSelectedCategoryChange || setInternalSelectedCategory;

    const types = useMemo(() => {
        if (availableTypes) return availableTypes;
        return SIMPLIFIED_QUESTION_TYPES.map((typeId) => QUESTION_TYPE_REGISTRY[typeId]).filter(Boolean);
    }, [availableTypes]);

    const filteredTypes = useMemo(() => {
        return types.filter((t) => {
            const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
            const matchesQuery =
                !searchQuery.trim() ||
                t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesQuery;
        });
    }, [types, selectedCategory, searchQuery]);

    const gridColsClass =
        columns === 1
            ? "grid-cols-1"
            : columns === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : columns === 4
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

    return (
        <div className={cn("flex-1 min-h-0 flex flex-col space-y-3.5", className)}>
            {(showSearch || showCategories) && (
                <div className="shrink-0 space-y-2.5">
                    {showSearch && (
                        <div className="relative">
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Search question types (e.g. number, qr code, date range, photo, location)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg w-full"
                            />
                        </div>
                    )}

                    {showCategories && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("all")}
                                className={cn(
                                    "text-xs px-3 py-1 rounded-full shrink-0 border transition-colors cursor-pointer",
                                    selectedCategory === "all"
                                        ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                )}
                            >
                                All Types ({types.length})
                            </button>
                            {QUESTION_CATEGORIES.map((cat) => {
                                const catCount = types.filter((t) => t.category === cat.id).length;
                                if (catCount === 0) return null;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            "text-xs px-3 py-1 rounded-full shrink-0 border transition-colors cursor-pointer",
                                            selectedCategory === cat.id
                                                ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                        )}
                                    >
                                        {cat.name} ({catCount})
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Question Type Cards Grid */}
            <div className={cn("flex-1 min-h-0 overflow-y-auto pr-1 grid gap-3 content-start", gridColsClass)}>
                {filteredTypes.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-xs text-zinc-500 border border-dashed rounded-xl">
                        No question types match &ldquo;{searchQuery}&rdquo;
                    </div>
                ) : (
                    filteredTypes.map((type) => {
                        const Icon = ICON_MAP[type.iconName] || Hash;
                        const isSelected = selectedType === type.id;

                        return (
                            <div
                                key={type.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelectType(type.id)}
                                onDoubleClick={() => onDoubleClickType && onDoubleClickType(type.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelectType(type.id);
                                    }
                                }}
                                className={cn(
                                    "rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
                                    compact ? "p-2.5" : "p-3.5",
                                    isSelected
                                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-900 dark:ring-zinc-100 shadow-2xs"
                                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                                )}
                            >
                                <div
                                    className={cn(
                                        "rounded-lg shrink-0 transition-colors",
                                        compact ? "p-2" : "p-2.5",
                                        isSelected
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                                    )}
                                >
                                    <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                            {type.displayName}
                                        </h4>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] font-mono text-zinc-400">
                                                {type.category}
                                            </span>
                                            {showHelpPopover && (
                                                <QuestionTypeHelpPopover
                                                    type={type.id}
                                                    side="right"
                                                    align="start"
                                                    className="h-5 w-5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                                                    iconClassName="h-3 w-3"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight line-clamp-2">
                                        {type.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
