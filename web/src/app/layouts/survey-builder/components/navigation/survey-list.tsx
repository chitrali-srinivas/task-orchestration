"use client";

import React, { useState, useMemo } from "react";
import { Search, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SurveyModel } from "../../types/survey-schema";

interface SurveyListProps {
    surveys: SurveyModel[];
    selectedSurveyId: string | null;
    onSelectSurvey: (surveyId: string) => void;
    isLoading?: boolean;
}

export function SurveyList({
    surveys,
    selectedSurveyId,
    onSelectSurvey,
    isLoading,
}: SurveyListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");

    const filteredSurveys = useMemo(() => {
        return surveys.filter((s) => {
            const matchesSearch =
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                s.versionTag.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;
            if (statusFilter === "DRAFT") return s.status === "Draft";
            if (statusFilter === "PUBLISHED") return s.status === "Published";
            return true;
        });
    }, [surveys, searchQuery, statusFilter]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 w-full min-w-0">
            {/* Header & Search */}
            <div className="p-3 space-y-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                        Surveys ({surveys.length})
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setStatusFilter("ALL")}
                            className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                                statusFilter === "ALL"
                                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter("DRAFT")}
                            className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                                statusFilter === "DRAFT"
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            Draft
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter("PUBLISHED")}
                            className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                                statusFilter === "PUBLISHED"
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            Published
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                    <Input
                        placeholder="Search surveys..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                        ))}
                    </div>
                ) : filteredSurveys.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500 space-y-1">
                        <FileText className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                        <p className="font-medium text-zinc-600 dark:text-zinc-400">No surveys found</p>
                        <p className="text-[11px] text-zinc-400">Try changing search query or zone</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {filteredSurveys.map((survey) => {
                            const isSelected = survey.id === selectedSurveyId;
                            const isPublished = survey.status === "Published";

                            return (
                                <button
                                    key={survey.id}
                                    type="button"
                                    onClick={() => onSelectSurvey(survey.id)}
                                    className={cn(
                                        "w-full text-left p-2.5 rounded-lg transition-all border group relative cursor-pointer",
                                        isSelected
                                            ? "bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-900/30 dark:border-zinc-600 shadow-2xs"
                                            : "bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h4
                                            className={cn(
                                                "font-semibold text-xs leading-snug line-clamp-1 transition-colors",
                                                isSelected ? "text-zinc-950 dark:text-zinc-50 font-bold" : "text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-50"
                                            )}
                                        >
                                            {survey.name}
                                        </h4>
                                        <ChevronRight
                                            className={cn(
                                                "h-3.5 w-3.5 shrink-0 transition-transform",
                                                isSelected ? "text-zinc-900 dark:text-zinc-100 translate-x-0.5" : "text-zinc-400 group-hover:text-zinc-600"
                                            )}
                                        />
                                    </div>

                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                            {survey.questions.length} {survey.questions.length === 1 ? "question" : "questions"}
                                        </span>

                                        <span className="text-zinc-300 dark:text-zinc-600 text-xs">•</span>

                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[9px] px-1.5 py-0 font-medium tracking-wide uppercase border",
                                                isPublished
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                            )}
                                        >
                                            {survey.status}
                                        </Badge>

                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                                            {survey.versionTag}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
