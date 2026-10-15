"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    Search,
    Plus,
    FileText,
    CheckCircle2,
    Clock,
    Layers,
    ChevronRight,
    ChevronDown,
    ArrowUpRight,
    Download,
    Calendar,
    Globe,
    User,
    Sparkles,
    X,
    GitFork,
    Lock,
    Edit,
    AlertTriangle,
    Eye,
    Tag,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AZOption } from "../../services/mock-surveys";
import { SurveyModel, SurveyVersionSnapshot } from "../../types/survey-schema";
import { SurveyService } from "../../services/survey-service";
import { AZSelector } from "../navigation/az-selector";
import { CreateSurveyDialog } from "../navigation/create-survey-dialog";
import { serializeCoreSurveyJSON } from "../../lib/survey-serializer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SurveyTranslationDialog } from "./survey-translation-dialog";

interface SurveyHubViewProps {
    azs: AZOption[];
    selectedAzId: string;
    onSelectAz: (azId: string) => void;
    surveys: SurveyModel[];
    onSelectSurvey: (surveyId: string) => void;
    onEditVersion?: (surveyId: string, versionNumber: number) => Promise<void>;
    onViewVersion?: (surveyId: string, snapshot: SurveyVersionSnapshot) => void;
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
    onEditVersion,
    onViewVersion,
    onCreateSurvey,
    isLoading = false,
}: SurveyHubViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"All" | "Published" | "Draft">("All");
    const [expandedSurveyIds, setExpandedSurveyIds] = useState<Set<string>>(new Set(["srv_wheat_enrollment_001"]));
    const [versionSnapshotsMap, setVersionSnapshotsMap] = useState<Record<string, SurveyVersionSnapshot[]>>({});

    // Translation Dialog State
    const [translationTarget, setTranslationTarget] = useState<{
        survey: SurveyModel;
        versionSnapshot?: SurveyVersionSnapshot | null;
    } | null>(null);

    // Draft Conflict Confirmation Dialog State
    const [draftConflictTarget, setDraftConflictTarget] = useState<{
        surveyId: string;
        surveyName: string;
        targetVersion: number;
        targetVersionTag: string;
        existingDraftVersionTag: string;
        existingDraftBasedOnTag?: string;
    } | null>(null);

    const currentAz = azs.find((a) => a.id === selectedAzId) || azs[0];

    // Load version histories for all surveys
    useEffect(() => {
        let isMounted = true;
        async function loadVersions() {
            const map: Record<string, SurveyVersionSnapshot[]> = {};
            for (const s of surveys) {
                const history = await SurveyService.getVersionHistory(s.id);
                map[s.id] = history;
            }
            if (isMounted) {
                setVersionSnapshotsMap(map);
            }
        }
        if (surveys.length > 0) {
            loadVersions();
        }
        return () => {
            isMounted = false;
        };
    }, [surveys]);

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

    const toggleExpand = (surveyId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedSurveyIds((prev) => {
            const next = new Set(prev);
            if (next.has(surveyId)) {
                next.delete(surveyId);
            } else {
                next.add(surveyId);
            }
            return next;
        });
    };

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

    // Edit action on a specific version (Parent row or Nested child row)
    const handleEditVersionClick = async (survey: SurveyModel, targetVersion: number, targetVersionTag: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Check if an active draft already exists for this survey
        const hasDraft = survey.status === "Draft";

        if (hasDraft && survey.basedOnVersion !== targetVersion) {
            // Draft conflict: user is editing a published version while a different draft already exists
            setDraftConflictTarget({
                surveyId: survey.id,
                surveyName: survey.name,
                targetVersion,
                targetVersionTag,
                existingDraftVersionTag: survey.versionTag,
                existingDraftBasedOnTag: survey.basedOnVersionTag,
            });
            return;
        }

        if (onEditVersion) {
            await onEditVersion(survey.id, targetVersion);
        } else {
            onSelectSurvey(survey.id);
        }
    };

    const handleConfirmReplaceDraft = async () => {
        if (!draftConflictTarget) return;
        if (onEditVersion) {
            await onEditVersion(draftConflictTarget.surveyId, draftConflictTarget.targetVersion);
        }
        setDraftConflictTarget(null);
    };

    const handleContinueExistingDraft = () => {
        if (!draftConflictTarget) return;
        onSelectSurvey(draftConflictTarget.surveyId);
        setDraftConflictTarget(null);
    };

    return (
        <div className="flex flex-col h-full p-6 overflow-hidden min-w-0 w-full bg-white dark:bg-zinc-950">
            <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                
                {/* Top Toolbar matching season-toolbar and engagement layout */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full mb-3 min-w-0 py-1 shrink-0">
                    
                    {/* Left: Status Filter Tabs */}
                    <div className="flex items-center min-w-0 flex-1 gap-3">
                        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
                            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "All" | "Published" | "Draft")} className="w-auto shrink-0">
                                <TabsList className="h-10 w-max justify-start bg-muted p-1">
                                    <TabsTrigger
                                        value="All"
                                        className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                    >
                                        All <span className="ml-2 opacity-50 font-normal">{counts.total}</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="Published"
                                        className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                    >
                                        Published <span className="ml-2 opacity-50 font-normal">{counts.published}</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="Draft"
                                        className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                    >
                                        Drafts <span className="ml-2 opacity-50 font-normal">{counts.draft}</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    {/* Right: AZ Zone Selector, Search Bar, and + New Survey Button */}
                    <div className="flex items-center gap-2 justify-end shrink-0 py-0.5">
                        {/* Zone Selector */}
                        <div className="w-[180px] sm:w-[210px] shrink-0">
                            <AZSelector azs={azs} selectedAzId={selectedAzId} onSelectAz={onSelectAz} />
                        </div>

                        {/* Search Input */}
                        <div className="relative w-[200px] sm:w-[240px]">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Search surveys by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 h-10 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-md"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-3 h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* + New Survey Button */}
                        <CreateSurveyDialog
                            azs={azs}
                            currentAzId={selectedAzId}
                            onCreateSurvey={onCreateSurvey}
                            trigger={
                                <Button className="h-10 px-4 font-semibold text-xs gap-1.5 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-md shadow-sm shrink-0">
                                    <Plus className="h-4 w-4" />
                                    <span>New Survey</span>
                                </Button>
                            }
                        />
                    </div>
                </div>

                {/* Table Container matching season-table and engagement data-table */}
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white dark:bg-zinc-950">
                    <div className="flex-1 overflow-auto scrollbar-minimal w-full relative">
                        <table className="relative w-full border-collapse text-xs">
                            <thead className="sticky top-0 z-30 bg-muted/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr className="hover:bg-transparent">
                                    <th className="whitespace-nowrap h-12 px-4 text-left align-middle font-medium text-xs text-muted-foreground w-[380px]">
                                        Survey Name & Description
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-4 text-left align-middle font-medium text-xs text-muted-foreground w-[150px]">
                                        Category
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-3 text-center align-middle font-medium text-xs text-muted-foreground w-[90px]">
                                        Questions
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-3 text-left align-middle font-medium text-xs text-muted-foreground w-[110px]">
                                        Languages
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-3 text-center align-middle font-medium text-xs text-muted-foreground w-[110px]">
                                        Active Release
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-3 text-center align-middle font-medium text-xs text-muted-foreground w-[120px]">
                                        Status
                                    </th>
                                    <th className="whitespace-nowrap h-12 px-4 text-right align-middle font-medium text-xs text-muted-foreground w-[100px]">
                                        Actions
                                    </th>
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
                                                {searchQuery ? `No surveys match "${searchQuery}" in ${currentAz.name}` : `No surveys configured in ${currentAz.name}`}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSurveys.map((survey) => {
                                        const isExpanded = expandedSurveyIds.has(survey.id);
                                        const historySnapshots = versionSnapshotsMap[survey.id] || [];

                                        return (
                                            <React.Fragment key={survey.id}>
                                                {/* PARENT SURVEY ROW */}
                                                <tr
                                                    onClick={(e) => toggleExpand(survey.id, e)}
                                                    className={cn(
                                                        "group hover:bg-muted/50 cursor-pointer transition-colors border-b border-zinc-200/80 dark:border-zinc-800 select-none",
                                                        isExpanded && "bg-muted/30"
                                                    )}
                                                >
                                                    {/* Survey Name with Expand/Collapse Control & Description */}
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                                            {/* Expand / Collapse Button */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleExpand(survey.id, e)}
                                                                className="p-1 -ml-1 rounded hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 transition-transform cursor-pointer mt-0.5"
                                                                title={isExpanded ? "Collapse version history" : "Expand version history"}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                                                                )}
                                                            </button>

                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 truncate">
                                                                        {survey.name}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => toggleExpand(survey.id, e)}
                                                                        className="text-[10px] px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 bg-muted hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground font-mono font-medium rounded transition-colors"
                                                                        title="Toggle version history"
                                                                    >
                                                                        {historySnapshots.length || 1} {(historySnapshots.length || 1) === 1 ? "version" : "versions"} {isExpanded ? "▴" : "▾"}
                                                                    </button>
                                                                </div>
                                                                {survey.description && (
                                                                    <span className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-[420px] leading-relaxed">
                                                                        {survey.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Category */}
                                                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                                                        <span className="truncate block font-medium">
                                                            {survey.category || "Field Operations"}
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
                                                                        className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                                                                    >
                                                                        {loc.code}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                                    EN
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Active Release */}
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                            {survey.basedOnVersionTag ? `v${survey.basedOnVersion}` : survey.versionTag}
                                                        </span>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-3 px-3 text-center">
                                                        {survey.status === "Draft" ? (
                                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                                                                1 Active Draft
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                                Published
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Action Buttons */}
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <TooltipProvider>
                                                                <Tooltip delayDuration={300}>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={(e) => handleExportCore(survey, e)}
                                                                            className="h-8 w-8 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded cursor-pointer"
                                                                        >
                                                                            <Download className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">
                                                                        Export Schema ({survey.versionTag})
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* EXPANDED NESTED VERSION ROWS */}
                                                {isExpanded && (
                                                    <>
                                                        {/* Active Draft Row if survey has an in-progress draft */}
                                                        {survey.status === "Draft" && (
                                                            <tr
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSelectSurvey(survey.id);
                                                                }}
                                                                className="bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 border-b border-amber-100/60 dark:border-amber-900/20 transition-colors cursor-pointer"
                                                            >
                                                                <td className="py-2.5 px-4 pl-9">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <div className="font-mono text-amber-500 text-xs shrink-0 select-none font-bold">
                                                                            ├──
                                                                        </div>
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="font-mono text-xs font-bold px-2 py-0.5 border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-300 shrink-0"
                                                                            >
                                                                                Draft · Based on {survey.basedOnVersionTag || `v${survey.basedOnVersion || 1}`}
                                                                            </Badge>
                                                                            <span className="text-xs text-amber-700 dark:text-amber-400 truncate max-w-[240px]">
                                                                                Working draft (will publish as {survey.versionTag})
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2.5 px-4 text-zinc-400 text-[11px]">—</td>
                                                                <td className="py-2.5 px-3 text-center font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                                    {survey.questions.length} Qs
                                                                </td>
                                                                <td className="py-2.5 px-3 text-[11px] text-zinc-500 font-mono">
                                                                    {survey.locales?.map((l) => l.code).join(", ") || "en"}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center text-[11px] text-amber-600 dark:text-amber-400 font-mono font-medium">
                                                                    In Progress
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <span className="inline-flex items-center justify-center px-2 py-0.2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                                                        Draft
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right">
                                                                    <div className="flex items-center justify-end gap-1.5">
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
                                                                                    Export Schema ({survey.versionTag})
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}

                                                        {/* Published Historical Version Rows */}
                                                        {historySnapshots.map((snap, sIdx) => {
                                                            const isLast = sIdx === historySnapshots.length - 1;
                                                            const isSnapPublished = snap.status === "Published";

                                                            return (
                                                                <tr
                                                                    key={`${survey.id}_v_${snap.version}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onViewVersion) {
                                                                            onViewVersion(survey.id, snap);
                                                                        } else {
                                                                            onSelectSurvey(survey.id);
                                                                        }
                                                                    }}
                                                                    className="bg-zinc-50/40 dark:bg-zinc-900/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800/40 transition-colors cursor-pointer"
                                                                >
                                                                    <td className="py-2.5 px-4 pl-9">
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className="font-mono text-zinc-400 dark:text-zinc-600 text-xs shrink-0 select-none">
                                                                                {isLast ? "└──" : "├──"}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="font-mono text-xs font-bold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shrink-0"
                                                                                >
                                                                                    {snap.versionTag}
                                                                                </Badge>
                                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[240px]">
                                                                                    {snap.changeSummary || `Version ${snap.versionTag} release`}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-zinc-400 text-[11px]">—</td>
                                                                    <td className="py-2.5 px-3 text-center font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                                        {snap.surveySnapshot.questions.length} Qs
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-[11px] text-zinc-500 font-mono">
                                                                        {snap.surveySnapshot.locales?.map((l) => l.code).join(", ") || "en"}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center text-[11px] text-zinc-500 font-mono">
                                                                        {snap.publishedAt ? new Date(snap.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "Draft"}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center">
                                                                        {isSnapPublished ? (
                                                                            <span className="inline-flex items-center justify-center px-2 py-0.2 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                                                Published
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center justify-center px-2 py-0.2 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                                                                                Draft
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-right">
                                                                        <div className="flex items-center justify-end gap-1.5">
                                                                            <TooltipProvider>
                                                                                <Tooltip delayDuration={300}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            onClick={(e) => handleExportCore(snap.surveySnapshot, e)}
                                                                                            className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded cursor-pointer"
                                                                                        >
                                                                                            <Download className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="top" className="text-xs">
                                                                                        Export Schema ({snap.versionTag})
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Section matching other layouts */}
                <div className="shrink-0 py-3 px-1 border-t border-zinc-100 dark:border-zinc-800 mt-3 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                        <span>Showing <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{filteredSurveys.length}</strong> of {surveys.length} surveys in {currentAz.id} ({currentAz.name.split(" - ")[1] || currentAz.name})</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{counts.published} Published</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            <span>{counts.draft} Drafts</span>
                        </span>
                    </div>
                </div>

            </div>

            {/* Version Translation Modal */}
            {translationTarget && (
                <SurveyTranslationDialog
                    open={Boolean(translationTarget)}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) setTranslationTarget(null);
                    }}
                    survey={translationTarget.survey}
                    versionSnapshot={translationTarget.versionSnapshot}
                />
            )}

            {/* Single Active Draft Conflict Governance Dialog */}
            {draftConflictTarget && (
                <Dialog open={Boolean(draftConflictTarget)} onOpenChange={(open: boolean) => !open && setDraftConflictTarget(null)}>
                    <DialogContent className="sm:max-w-[520px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 shadow-sm shrink-0">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                        Draft Already Exists
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                        An in-progress draft is already open for this survey.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-6 space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                                    An in-progress draft (<strong className="font-mono font-bold">{draftConflictTarget.existingDraftVersionTag}</strong>
                                    {draftConflictTarget.existingDraftBasedOnTag ? ` · Based on ${draftConflictTarget.existingDraftBasedOnTag}` : ""}) already exists for <strong>{draftConflictTarget.surveyName}</strong>.
                                </p>
                            </div>
                            <p>
                                Would you like to continue editing the current active draft, or create a new draft starting from <strong className="font-mono font-semibold">{draftConflictTarget.targetVersionTag}</strong>?
                            </p>
                        </div>

                        <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-end gap-2.5 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleContinueExistingDraft}
                                className="h-9 px-4 text-xs font-medium border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                Continue Existing Draft
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmReplaceDraft}
                                className="h-9 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg shadow-sm cursor-pointer"
                            >
                                New Draft from {draftConflictTarget.targetVersionTag}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

