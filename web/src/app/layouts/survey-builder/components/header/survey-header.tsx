"use client";

import React, { useState } from "react";
import {
    Save,
    Send,
    History,
    AlertCircle,
    CheckCircle2,
    Lock,
    Download,
    GitFork,
    MoreVertical,
    Check,
    Cloud,
    FileJson,
    Globe,
    Smartphone,
    ArrowLeft,
    ChevronDown,
    FolderKanban,
    Copy,
    Settings2,
    Clock,
    LayoutGrid,
    Table,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { LocaleDefinition, SurveyModel } from "../../types/survey-schema";
import { SurveyValidationResult } from "../../lib/survey-validator";
import { serializeSurveyToBackend, serializeCoreSurveyJSON } from "../../lib/survey-serializer";
import { TranslationService } from "../../services/translation-service";
import { getCategoryById } from "../../lib/category-registry";
import { PublishDialog } from "./publish-dialog";
import { ValidationSheet } from "./validation-sheet";
import { LanguageManagerDialog } from "./language-manager-dialog";

interface SurveyHeaderProps {
    survey: SurveyModel;
    allSurveys: SurveyModel[];
    onSelectAnotherSurvey: (surveyId: string) => void;
    onBackToHub: () => void;
    isDirty: boolean;
    isSaving: boolean;
    lastSavedAt: Date | null;
    validation: SurveyValidationResult;
    isPreviewPanelOpen: boolean;
    onTogglePreviewPanel: () => void;
    currentView?: "builder" | "table";
    onViewChange?: (view: "builder" | "table") => void;
    onOpenEditDetails?: () => void;
    onDuplicateSurvey?: () => void;
    onOpenAvailabilityManager?: () => void;
    onSave: () => Promise<void>;
    onPublish: (changeSummary: string) => Promise<void>;
    onForkDraft: () => Promise<void>;
    onOpenVersionHistory: () => void;
    onSelectQuestion: (questionId: string) => void;
    onUpdateLocales: (updatedLocales: LocaleDefinition[], newDefaultLocale?: string) => void;
    languageManagerOpen: boolean;
    setLanguageManagerOpen: (open: boolean) => void;
}

export function SurveyHeader({
    survey,
    allSurveys,
    onSelectAnotherSurvey,
    onBackToHub,
    isDirty,
    isSaving,
    lastSavedAt,
    validation,
    isPreviewPanelOpen,
    onTogglePreviewPanel,
    currentView = "builder",
    onViewChange,
    onOpenEditDetails,
    onDuplicateSurvey,
    onOpenAvailabilityManager,
    onSave,
    onPublish,
    onForkDraft,
    onOpenVersionHistory,
    onSelectQuestion,
    onUpdateLocales,
    languageManagerOpen,
    setLanguageManagerOpen,
}: SurveyHeaderProps) {
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [validationSheetOpen, setValidationSheetOpen] = useState(false);

    const isPublished = survey.status === "Published";
    const localesCount = survey.locales?.length || 1;
    const categoryDef = getCategoryById(survey.category);

    const handleExportLegacyJSON = () => {
        const legacyJSON = serializeSurveyToBackend(survey);
        const blob = new Blob([JSON.stringify(legacyJSON, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${survey.name.toLowerCase().replace(/\s+/g, "_")}_legacy_${survey.versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportNormalizedJSON = () => {
        const coreJSON = serializeCoreSurveyJSON(survey);
        const blob = new Blob([JSON.stringify(coreJSON, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${survey.name.toLowerCase().replace(/\s+/g, "_")}_core_${survey.versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportAllTranslationsJSON = () => {
        const nonDefaultLocales = (survey.locales || []).filter(
            (l) => !l.isDefault && l.code !== (survey.defaultLocale || "en")
        );
        const bundle = Object.fromEntries(
            (nonDefaultLocales.length > 0 ? nonDefaultLocales : [{ code: "hi", label: "Hindi" }]).map((loc) => [
                `translations/${loc.code}.json`,
                TranslationService.createModularTranslationResource(survey, loc.code, loc.label),
            ])
        );

        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${survey.name.toLowerCase().replace(/\s+/g, "_")}_translations_${survey.versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPackageJSON = () => {
        const coreJSON = serializeCoreSurveyJSON(survey);
        const nonDefaultLocales = (survey.locales || []).filter(
            (l) => !l.isDefault && l.code !== (survey.defaultLocale || "en")
        );
        const translationsMap = Object.fromEntries(
            (nonDefaultLocales.length > 0 ? nonDefaultLocales : [{ code: "hi", label: "Hindi" }]).map((loc) => [
                `translations/${loc.code}.json`,
                TranslationService.createModularTranslationResource(survey, loc.code, loc.label),
            ])
        );

        const completePackage = {
            "survey.json": coreJSON,
            ...translationsMap,
        };

        const blob = new Blob([JSON.stringify(completePackage, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${survey.name.toLowerCase().replace(/\s+/g, "_")}_package_${survey.versionTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportTranslationJSON = (langCode: string = "hi") => {
        const targetLocale = survey.locales?.find((l) => l.code === langCode) || {
            code: langCode,
            label: langCode.toUpperCase(),
        };
        const translationBundle = TranslationService.createModularTranslationResource(
            survey,
            targetLocale.code,
            targetLocale.label
        );

        const blob = new Blob([JSON.stringify(translationBundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${langCode}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <header className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
                {/* Left: Back to Hub Icon + Survey Switcher Dropdown & Rich Metadata */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <TooltipProvider>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onBackToHub}
                                    className="h-8 w-8 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md shrink-0"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span className="sr-only">Back to All Surveys</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                Back to All Surveys
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

                    {/* Survey Switcher Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-1.5 text-left group p-1 -m-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors min-w-0"
                            >
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-[160px] sm:max-w-[240px] md:max-w-[340px]">
                                            {survey.name}
                                        </span>
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0" />
                                    </div>

                                    {/* Consolidated Sub-line metadata */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex-wrap mt-0.5">
                                        {/* AZ Zone */}
                                        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">{survey.azId}</span>
                                        <span className="text-zinc-300 dark:text-zinc-700">•</span>

                                        {/* Version */}
                                        <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{survey.versionTag}</span>

                                        {/* Status Text only with color */}
                                        <span
                                            className={cn(
                                                "font-semibold text-[11px]",
                                                isPublished
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-amber-600 dark:text-amber-400"
                                            )}
                                        >
                                            {survey.status}
                                        </span>

                                        {/* Category / App Path */}
                                        {categoryDef && (
                                            <>
                                                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                                                <span
                                                    className="text-zinc-600 dark:text-zinc-400 truncate max-w-[160px] hidden sm:inline"
                                                    title={`App Location: ${categoryDef.appPath.join(" → ")}`}
                                                >
                                                    {categoryDef.name}
                                                </span>
                                            </>
                                        )}

                                        {/* Questions Count */}
                                        <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">•</span>
                                        <span className="text-zinc-500 dark:text-zinc-400 hidden md:inline">{survey.questions.length} questions</span>

                                        {/* Languages Count */}
                                        <span className="text-zinc-300 dark:text-zinc-700 hidden lg:inline">•</span>
                                        <span className="text-zinc-500 dark:text-zinc-400 hidden lg:inline">{localesCount} {localesCount === 1 ? "lang" : "langs"}</span>

                                        {/* Save state */}
                                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                        {isSaving ? (
                                            <span className="flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                                                <Cloud className="h-3 w-3 animate-spin text-zinc-400" /> Saving...
                                            </span>
                                        ) : isDirty ? (
                                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved
                                            </span>
                                        ) : isPublished ? (
                                            <span className="flex items-center gap-1 text-zinc-500 text-[10px]">
                                                <Lock className="h-3 w-3 text-zinc-400" /> Published
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                Saved {lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "now"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl p-1.5">
                            <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 font-semibold px-2 py-1">
                                Switch Survey in {survey.azId}
                            </DropdownMenuLabel>
                            {allSurveys.map((s) => (
                                <DropdownMenuItem
                                    key={s.id}
                                    onClick={() => onSelectAnotherSurvey(s.id)}
                                    className={cn(
                                        "flex items-center justify-between text-xs p-2 rounded-md cursor-pointer",
                                        s.id === survey.id && "bg-zinc-100 dark:bg-zinc-800 font-semibold"
                                    )}
                                >
                                    <div className="min-w-0 pr-2">
                                        <span className="truncate block">{s.name}</span>
                                        <span className="text-[10px] text-zinc-400 font-mono">
                                            {s.questions.length} questions • {s.status}
                                        </span>
                                    </div>
                                    {s.id === survey.id && (
                                        <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Center / Right: Builder vs Table View Switcher */}
                {onViewChange && (
                    <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => onViewChange("builder")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                                currentView === "builder"
                                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span>Builder</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewChange("table")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                                currentView === "table"
                                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <Table className="h-3.5 w-3.5" />
                            <span>Table View</span>
                        </button>
                    </div>
                )}

                {/* Right Action Bar */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Live Mobile Preview Simple Toggle Button */}
                    <Button
                        variant={isPreviewPanelOpen ? "default" : "outline"}
                        size="sm"
                        onClick={onTogglePreviewPanel}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 font-medium rounded-lg shadow-2xs transition-all",
                            isPreviewPanelOpen
                                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800"
                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        )}
                        title={isPreviewPanelOpen ? "Hide Mobile Preview" : "Show Mobile Preview"}
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Preview</span>
                    </Button>

                    {/* Validation Drawer Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setValidationSheetOpen(true)}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 border transition-all",
                            validation.errorCount > 0
                                ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                : validation.warningCount > 0
                                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        )}
                    >
                        {validation.errorCount > 0 ? (
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="hidden md:inline">Validation</span>
                        <span className="font-mono text-[10px] font-bold">
                            {validation.errorCount > 0
                                ? `${validation.errorCount} errors`
                                : validation.warningCount > 0
                                ? `${validation.warningCount} warns`
                                : "0 issues"}
                        </span>
                    </Button>

                    {/* Version History Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenVersionHistory}
                        className="h-8 px-2.5 text-xs gap-1.5 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                        <History className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="hidden md:inline">History</span>
                    </Button>

                    {/* Separator on left of Save button */}
                    <div className="h-4 w-px bg-zinc-200 dark:border-zinc-800 shrink-0 mx-0.5" />

                    {/* Save Draft / Fork New Draft */}
                    {isPublished ? (
                        <Button
                            size="sm"
                            onClick={onForkDraft}
                            className="h-8 px-3 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 shadow-2xs cursor-pointer"
                        >
                            <GitFork className="h-3.5 w-3.5" />
                            Create Draft
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onSave}
                            disabled={isSaving || !isDirty}
                            className="h-8 px-3 text-xs font-medium border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <Save className="h-3.5 w-3.5" />
                            <span>Save</span>
                        </Button>
                    )}

                    {/* Publish Button */}
                    {!isPublished && (
                        <Button
                            size="sm"
                            onClick={() => setPublishDialogOpen(true)}
                            className="h-8 px-3.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 shadow-2xs"
                        >
                            <Send className="h-3.5 w-3.5" />
                            <span>Publish</span>
                        </Button>
                    )}

                    {/* More Actions Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                                Survey Management
                            </DropdownMenuLabel>
                            {onOpenEditDetails && (
                                <DropdownMenuItem onClick={onOpenEditDetails} className="gap-2 text-xs cursor-pointer">
                                    <Settings2 className="h-4 w-4 text-zinc-500" />
                                    Edit Survey Details
                                </DropdownMenuItem>
                            )}
                            {onDuplicateSurvey && (
                                <DropdownMenuItem onClick={onDuplicateSurvey} className="gap-2 text-xs cursor-pointer">
                                    <Copy className="h-4 w-4 text-zinc-500" />
                                    Duplicate Survey
                                </DropdownMenuItem>
                            )}
                            {onOpenAvailabilityManager && (
                                <DropdownMenuItem onClick={onOpenAvailabilityManager} className="gap-2 text-xs cursor-pointer">
                                    <Clock className="h-4 w-4 text-zinc-500" />
                                    Availability & Schedules
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                            <DropdownMenuItem onClick={() => setLanguageManagerOpen(true)} className="gap-2 text-xs cursor-pointer">
                                <Globe className="h-4 w-4 text-zinc-500" />
                                Manage Languages ({localesCount})
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-2 py-1">
                                Export & Download Schema
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={handleExportNormalizedJSON} className="gap-2 text-xs cursor-pointer">
                                <Download className="h-4 w-4 text-zinc-500" />
                                <span>Export Core Schema (v2.0 JSON)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportAllTranslationsJSON} className="gap-2 text-xs cursor-pointer">
                                <Globe className="h-4 w-4 text-zinc-500" />
                                <span>Export All Translations (v1.0 Bundle)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportPackageJSON} className="gap-2 text-xs cursor-pointer">
                                <FileJson className="h-4 w-4 text-zinc-500" />
                                <span>Export Complete Package (Core + All Trans)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportLegacyJSON} className="gap-2 text-xs cursor-pointer">
                                <FileJson className="h-4 w-4 text-zinc-500" />
                                <span>Export Legacy Backend JSON (v1.0)</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                            <DropdownMenuItem onClick={onOpenVersionHistory} className="gap-2 text-xs cursor-pointer">
                                <History className="h-4 w-4 text-zinc-500" />
                                View Version Change Log
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBackToHub} className="gap-2 text-xs cursor-pointer">
                                <FolderKanban className="h-4 w-4 text-zinc-500" />
                                Return to Surveys Hub
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Validation Drawer Sheet */}
            <ValidationSheet
                open={validationSheetOpen}
                onOpenChange={setValidationSheetOpen}
                validation={validation}
                onSelectQuestion={onSelectQuestion}
            />

            {/* Publish Confirmation Dialog */}
            <PublishDialog
                open={publishDialogOpen}
                onOpenChange={setPublishDialogOpen}
                survey={survey}
                validation={validation}
                onConfirmPublish={onPublish}
            />

            {/* Language Manager Dialog */}
            <LanguageManagerDialog
                open={languageManagerOpen}
                onOpenChange={setLanguageManagerOpen}
                survey={survey}
                onUpdateLocales={onUpdateLocales}
                isPublished={isPublished}
            />
        </>
    );
}
