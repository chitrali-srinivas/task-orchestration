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
    Languages,
    Pencil,
    Clock,
    LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);   // blocking-errors popup
    const [isPublishing, setIsPublishing] = useState(false);
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

                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                                        <span className="font-mono text-zinc-700 dark:text-zinc-300">{survey.versionTag}</span>
                                        <span
                                            className={cn(
                                                "font-semibold",
                                                isPublished ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                            )}
                                        >
                                            {survey.status}
                                        </span>
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
                                                <Check className="h-3 w-3" /> Saved
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

                    {onOpenEditDetails && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit survey"
                            onClick={onOpenEditDetails}
                            className="h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {/* Center / Right: Builder vs Translations switcher (view key 'table' kept for the page state) */}
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
                            <Languages className="h-3.5 w-3.5" />
                            <span>Translations</span>
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
                            disabled={isPublishing}
                            onClick={async () => {
                                if (validation.errorCount > 0) {
                                    setPublishDialogOpen(true);   // shows the blocking errors
                                    return;
                                }
                                setIsPublishing(true);
                                try {
                                    await onPublish("");
                                } finally {
                                    setIsPublishing(false);
                                }
                            }}
                            className="h-8 px-3.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 shadow-2xs"
                        >
                            <Send className="h-3.5 w-3.5" />
                            <span>{isPublishing ? "Publishing..." : "Publish"}</span>
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

            {/* Publish blocked: list the errors to fix */}
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogContent className="sm:max-w-[460px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden">
                    <DialogHeader className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-rose-50/60 dark:bg-rose-950/20">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-700 dark:text-rose-300">
                            <AlertCircle className="h-4 w-4" /> Can&apos;t publish yet
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                            Fix {validation.errorCount === 1 ? "this error" : `these ${validation.errorCount} errors`} and press Publish again.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="max-h-[50vh] overflow-y-auto p-5 space-y-2 text-xs">
                        {validation.errors.map((e) => (
                            <li key={e.id} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {e.questionDisplayIndex ? `Q${e.questionDisplayIndex} · ` : ""}{e.title}
                                </div>
                                <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">{e.message}</div>
                            </li>
                        ))}
                    </ul>
                    <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <Button type="button" size="sm" onClick={() => setPublishDialogOpen(false)} className="h-8 px-3.5 text-xs">
                            Back to edit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
