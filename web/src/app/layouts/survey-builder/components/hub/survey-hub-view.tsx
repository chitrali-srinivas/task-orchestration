"use client";

import React, { useState, useMemo } from "react";
import {
    Search,
    Plus,
    FileText,
    CheckCircle2,
    Clock,
    Layers,
    ChevronRight,
    ArrowUpRight,
    Download,
    Calendar,
    Globe,
    User,
    Sparkles,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AZOption } from "../../services/mock-surveys";
import { SurveyModel } from "../../types/survey-schema";
import { CreateSurveyDialog } from "../navigation/create-survey-dialog";
import { serializeCoreSurveyJSON, serializeSurveyToBackend } from "../../lib/survey-serializer";

interface SurveyHubViewProps {
    azs: AZOption[];
    selectedAzId: string;
    onSelectAz: (azId: string) => void;
    surveys: SurveyModel[];
    onSelectSurvey: (surveyId: string) => void;
    onCreateSurvey: (payload: {
        name: string;
        description?: string;
        azId: string;
        defaultLocale: string;
        category?: string;
        copyFromSurveyId?: string;
    }) => Promise<void>;
    isLoading?: boolean;
}

export function SurveyHubView({
    azs,
    selectedAzId,
    onSelectAz,
    surveys,
    onSelectSurvey,
    onCreateSurvey,
    isLoading = false,
}: SurveyHubViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"All" | "Published" | "Draft">("All");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Status counts
    const counts = useMemo(() => {
        return {
            total: surveys.length,
            published: surveys.filter((s) => s.status === "Published").length,
            draft: surveys.filter((s) => s.status === "Draft").length,
        };
    }, [surveys]);

    // Filtered survey list
    const filteredSurveys = useMemo(() => {
        return surveys.filter((survey) => {
            const matchesSearch =
                survey.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (survey.description && survey.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (survey.category && survey.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
                survey.versionTag.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (activeTab === "Published") return survey.status === "Published";
            if (activeTab === "Draft") return survey.status === "Draft";

            return true;
        });
    }, [surveys, searchQuery, activeTab]);

    const handleExportCore = (survey: SurveyModel, e: React.MouseEvent) => {
        e.stopPropagation();
        const coreJSON = serializeCoreSurveyJSON(survey);
        const blob = new Blob([JSON.stringify(coreJSON, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${survey.name.toLowerCase().replace(/\s+/g, "_")}_core_${survey.versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full p-6 overflow-hidden min-w-0 w-full bg-zinc-50/50 dark:bg-zinc-950">
            {/* Clean White Card Surface matching Engagement & Deployment tables */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden shadow-2xs">
                
                {/* Clean, Uniform Single-Row Toolbar Header */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 shrink-0">
                    
                    {/* Left: Zone Selector & Search Input */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">

                        <div className="relative w-full max-w-[280px] sm:max-w-[320px]">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                            <Input
                                placeholder="Search surveys by name, category..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-8 h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-md"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-2 h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Status Tabs & Create Button */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Status Filter Tabs */}
                        <div className="flex items-center h-8 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-700/80">
                            <button
                                type="button"
                                onClick={() => setActiveTab("All")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 h-7 rounded text-xs transition-all",
                                    activeTab === "All"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                                )}
                            >
                                <span>All</span>
                                <span
                                    className={cn(
                                        "px-1.5 py-0.2 rounded-full text-[11px] font-normal transition-colors",
                                        activeTab === "All"
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                                            : "bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
                                    )}
                                >
                                    {counts.total}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("Published")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 h-7 rounded text-xs transition-all",
                                    activeTab === "Published"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                                )}
                            >
                                <span>Published</span>
                                <span
                                    className={cn(
                                        "px-1.5 py-0.2 rounded-full text-[11px] font-normal transition-colors",
                                        activeTab === "Published"
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                                            : "bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
                                    )}
                                >
                                    {counts.published}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("Draft")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 h-7 rounded text-xs transition-all",
                                    activeTab === "Draft"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                                )}
                            >
                                <span>Drafts</span>
                                <span
                                    className={cn(
                                        "px-1.5 py-0.2 rounded-full text-[11px] font-normal transition-colors",
                                        activeTab === "Draft"
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                                            : "bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
                                    )}
                                >
                                    {counts.draft}
                                </span>
                            </button>
                        </div>

                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />

                        {/* Create Survey Modal Trigger */}
                        <CreateSurveyDialog
                            azs={azs}
                            currentAzId={selectedAzId}
                            onCreateSurvey={onCreateSurvey}
                        />
                    </div>
                </div>

                {/* Minimalist Data Table */}
                <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 sticky top-0 z-10 select-none">
                                <th className="py-2.5 px-4 font-semibold text-xs w-[320px]">Survey Name</th>
                                <th className="py-2.5 px-3 font-semibold text-xs w-[130px]">Category</th>
                                <th className="py-2.5 px-3 font-semibold text-xs text-center w-[90px]">Questions</th>
                                <th className="py-2.5 px-3 font-semibold text-xs w-[130px]">Languages</th>
                                <th className="py-2.5 px-3 font-semibold text-xs text-center w-[80px]">Version</th>
                                <th className="py-2.5 px-3 font-semibold text-xs text-center w-[110px]">Status</th>
                                <th className="py-2.5 px-4 font-semibold text-xs text-right w-[120px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="h-5 w-5 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent animate-spin rounded-full" />
                                            <span className="text-xs">Loading operational surveys...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSurveys.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-500 space-y-2">
                                        <Layers className="h-8 w-8 text-zinc-400 mx-auto" />
                                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">No surveys found</p>
                                        <p className="text-[11px] text-zinc-400">
                                            {searchQuery ? `No surveys match "${searchQuery}"` : "No surveys yet. Create the first one."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSurveys.map((survey) => {
                                    const isPublished = survey.status === "Published";
                                    return (
                                        <tr
                                            key={survey.id}
                                            onClick={() => onSelectSurvey(survey.id)}
                                            className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                        >
                                            {/* Survey Name & Description */}
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 truncate">
                                                            {survey.name}
                                                        </span>
                                                        {survey.id === "srv_wheat_enrollment_001" && (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-mono">
                                                                Flagship
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {survey.description && (
                                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[340px] mt-0.5">
                                                            {survey.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                                                <span className="truncate block font-medium">
                                                    {survey.category || "Field Ops"}
                                                </span>
                                            </td>

                                            {/* Question Count */}
                                            <td className="py-3 px-3 text-center">
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] font-medium">
                                                    {survey.questions.length} Qs
                                                </span>
                                            </td>

                                            {/* Languages */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {survey.locales && survey.locales.length > 0 ? (
                                                        survey.locales.map((loc) => (
                                                            <span
                                                                key={loc.code}
                                                                className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium"
                                                            >
                                                                {loc.code}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                                            EN
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Version */}
                                            <td className="py-3 px-3 text-center">
                                                <span className="font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                                    {survey.versionTag}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3 px-3 text-center">
                                                {isPublished ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                        Published
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                                                        Draft
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <TooltipProvider>
                                                        <Tooltip delayDuration={300}>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => handleExportCore(survey, e)}
                                                                    className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded cursor-pointer"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-xs">
                                                                Export Core Schema (v2.0)
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Count Summary */}
                <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                    <div className="flex items-center gap-2">
                        <span>Showing <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{filteredSurveys.length}</strong> of {surveys.length} surveys</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{counts.published} Published</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            <span>{counts.draft} Drafts</span>
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}
