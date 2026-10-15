"use client";

import React, { useState } from "react";
import {
    Plus,
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
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    BackendQuestionType,
    QuestionCategory,
} from "../../types/survey-schema";
import {
    QUESTION_CATEGORIES,
    QUESTION_TYPE_REGISTRY,
} from "../../registry/question-type-registry";
import { QuestionTypeHelpPopover } from "../common/question-type-help-popover";

interface AddQuestionPopoverProps {
    onAddQuestion: (type: BackendQuestionType) => void;
    trigger?: React.ReactNode;
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

export function AddQuestionPopover({ onAddQuestion, trigger }: AddQuestionPopoverProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | "all">("all");

    const allTypes = Object.values(QUESTION_TYPE_REGISTRY);

    const filteredTypes = allTypes.filter((t) => {
        const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
        const matchesQuery =
            t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
    });

    const handleSelectType = (type: BackendQuestionType) => {
        onAddQuestion(type);
        setOpen(false);
        setSearchQuery("");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {trigger || (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium gap-1.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-none shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Question</span>
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="w-[360px] sm:w-[460px] max-h-[calc(100vh-140px)] flex flex-col p-0 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden z-[150]"
            >
                {/* Header & Filter Controls (Fixed, non-scrolling) */}
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Select Question Type</span>
                        <Badge variant="outline" className="text-[10px] border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                            {filteredTypes.length} of {allTypes.length} Types
                        </Badge>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                            placeholder="Search types (e.g. decimal, photo, qr, polygon)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                            autoFocus
                        />
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-minimal">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory("all")}
                            className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full shrink-0 transition-colors border",
                                selectedCategory === "all"
                                    ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                        >
                            All ({allTypes.length})
                        </button>
                        {QUESTION_CATEGORIES.map((cat) => {
                            const count = allTypes.filter((t) => t.category === cat.id).length;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full shrink-0 transition-colors border",
                                        selectedCategory === cat.id
                                            ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    {cat.name.split(" ")[0]} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Native Scrollable Question Types Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 max-h-[380px] scrollbar-minimal">
                    {filteredTypes.length === 0 ? (
                        <div className="p-8 text-center text-xs text-zinc-500">
                            No question types match "{searchQuery}"
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {filteredTypes.map((type) => {
                                const IconComponent = ICON_MAP[type.iconName] || FileText;
                                return (
                                    <div
                                        key={type.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSelectType(type.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                handleSelectType(type.id);
                                            }
                                        }}
                                        className="text-left p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:border-zinc-700 transition-all group cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                    >
                                        <div className="flex items-start gap-2 min-w-0">
                                            <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors shrink-0 mt-0.5">
                                                <IconComponent className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <h5 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                                        {type.displayName}
                                                    </h5>
                                                    <QuestionTypeHelpPopover type={type.id} side="right" className="opacity-70 hover:opacity-100 h-5 w-5" />
                                                </div>
                                                <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-tight mt-0.5">
                                                    {type.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
