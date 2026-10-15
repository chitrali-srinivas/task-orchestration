"use client";

import React, { useState } from "react";
import {
    Send,
    Lock,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Globe,
    ShieldCheck,
    GitBranch,
    Database,
    Clock,
    FolderKanban,
    ChevronRight,
    Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SurveyModel } from "../../types/survey-schema";
import { SurveyValidationResult } from "../../lib/survey-validator";
import { formatCategoryPathString } from "../../lib/category-registry";

interface PublishDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey: SurveyModel;
    validation: SurveyValidationResult;
    onConfirmPublish: (changeSummary: string) => Promise<void>;
}

const QUICK_CHANGE_TAGS = [
    "Added validation rules",
    "Updated field logic",
    "Schema refinement",
    "New locale support",
    "Initial draft release",
];

export function PublishDialog({
    open,
    onOpenChange,
    survey,
    validation,
    onConfirmPublish,
}: PublishDialogProps) {
    const [changeSummary, setChangeSummary] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasErrors = validation.errorCount > 0;

    // Derived Actual Metrics
    const totalQuestions = survey.questions.length;

    // Derived Sections count (Main + Repeaters)
    const repeatersCount = survey.questions.filter(
        (q) => q.type === "Repeater_QT" || Boolean(q.repeater?.isRepeater)
    ).length;
    const sectionsCount = 1 + repeatersCount;

    // Validation metrics
    const validatedQuestionsCount = survey.questions.filter((q) => {
        const v = q.validation;
        return Boolean(
            v.required ||
            v.regexPattern ||
            v.presetId ||
            v.minValue !== undefined ||
            v.minChar !== undefined ||
            v.minPhotos !== undefined ||
            v.minSelections !== undefined ||
            v.minDate
        );
    }).length;
    const unvalidatedQuestionsCount = Math.max(0, totalQuestions - validatedQuestionsCount);

    // Progression logic rules count
    const logicRulesCount = survey.questions.filter(
        (q) => q.visibility?.enabled && q.visibility.ruleGroup.conditions.length > 0
    ).length;

    // Master data questions count
    const masterDataCount = survey.questions.filter((q) => q.optionSource === "master").length;

    // Availability summary
    const schedules = survey.availability?.schedules || [];
    const schedulesCount = schedules.length;

    // Aggregate unique locations targeted
    const uniqueBases = new Set<string>();
    const uniqueVillages = new Set<string>();
    const uniqueSurveyors = new Set<string>();
    let targetsAllLocations = false;

    schedules.forEach((s) => {
        if (s.scope.allLocations) targetsAllLocations = true;
        s.scope.baseIds?.forEach((b) => uniqueBases.add(b));
        s.scope.villageIds?.forEach((v) => uniqueVillages.add(v));
        s.scope.surveyorIds?.forEach((surv) => uniqueSurveyors.add(surv));
    });

    const handleAddTag = (tag: string) => {
        setChangeSummary((prev) => {
            const trimmed = prev.trim();
            if (!trimmed) return tag;
            if (trimmed.includes(tag)) return prev;
            return `${trimmed}; ${tag}`;
        });
    };

    const handlePublish = async () => {
        if (hasErrors) {
            setError("Cannot publish survey while blocking validation errors exist.");
            return;
        }

        try {
            setIsPublishing(true);
            setError(null);
            await onConfirmPublish(changeSummary.trim() || `Published release ${survey.versionTag}`);
            onOpenChange(false);
            setChangeSummary("");
        } catch (err: any) {
            setError(err?.message || "Failed to publish survey.");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{
                    width: "92vw",
                    maxWidth: "960px",
                    maxHeight: "88vh",
                    display: "flex",
                    flexDirection: "column",
                }}
                className="!w-[92vw] !max-w-[960px] !max-h-[88vh] !p-0 !gap-0 !flex !flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden rounded-2xl"
            >
                {/* Header */}
                <DialogHeader className="p-5 px-6 sm:px-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                                <Send className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                        Publish Survey Release Review
                                    </DialogTitle>
                                    <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                        {survey.versionTag}
                                    </Badge>
                                </div>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Review schema integrity, deployment scope, and release notes before freezing version.
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Top Right Status Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                            {hasErrors ? (
                                <Badge variant="outline" className="text-xs px-3 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800 gap-1.5 font-semibold">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Blocked ({validation.errorCount} Errors)
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-xs px-3.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 gap-1.5 font-semibold">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Ready to Publish
                                </Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* Main Scrollable Content */}
                <div className="p-6 sm:p-7 space-y-6 overflow-y-auto flex-1 min-h-0 w-full">
                    {/* Immutability & Governance Banner */}
                    <div className="p-3.5 px-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                            <Lock className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                            <span className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                                Publishing version <strong className="font-mono font-bold text-amber-950 dark:text-amber-100">{survey.versionTag}</strong> locks this schema as permanently immutable. Ongoing field surveys continue uninterrupted, while future revisions fork into a new draft.
                            </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0 self-start sm:self-auto font-medium">
                            Zero Downtime Sync
                        </Badge>
                    </div>

                    {/* 2-Column Responsive Layout: Survey Identity (Left) vs Pre-Flight & Schema Metrics (Right) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 w-full">
                        {/* LEFT COLUMN: SURVEY IDENTITY & HIERARCHY */}
                        <div className="space-y-4 min-w-0 flex flex-col justify-between">
                            {/* Survey Title & Description */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                                        Survey Identity & Routing
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-400">ID: {survey.id}</span>
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 break-words">
                                    {survey.name}
                                </h3>
                                {survey.description && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed break-words">
                                        {survey.description}
                                    </p>
                                )}
                            </div>

                            {/* Application Hierarchy & Category */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-medium text-zinc-500 block">
                                    Application Hierarchy Path
                                </span>
                                <div className="flex items-center gap-2 flex-wrap font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/80 p-2.5 px-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                                    <FolderKanban className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {survey.category || "Field Operations"}
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        {formatCategoryPathString(survey.category)}
                                    </span>
                                </div>
                            </div>

                            {/* Supported Languages */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-medium text-zinc-500 block">
                                    Supported Locales ({survey.locales.length})
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Globe className="h-4 w-4 text-zinc-400 shrink-0" />
                                    {survey.locales.map((l) => (
                                        <Badge
                                            key={l.code}
                                            variant="secondary"
                                            className="text-xs px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-medium"
                                        >
                                            {l.label} {l.isDefault && <span className="text-[10px] text-zinc-500 ml-1 font-semibold">• Default</span>}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PRE-FLIGHT INTEGRITY & SCHEMA SPECIFICATION */}
                        <div className="space-y-4 min-w-0 flex flex-col justify-between">
                            {/* Pre-Flight Health Status Card */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono block">
                                    Pre-Flight Integrity Status
                                </span>

                                {hasErrors ? (
                                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
                                        <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300 text-xs">
                                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                                            <span>{validation.errorCount} Blocking Error{validation.errorCount === 1 ? "" : "s"} Found</span>
                                        </div>
                                        <ul className="list-disc list-inside text-xs text-rose-700 dark:text-rose-400 space-y-1">
                                            {validation.errors.slice(0, 3).map((err) => (
                                                <li key={err.id} className="truncate">
                                                    <strong>{err.title}</strong>: {err.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : validation.warningCount > 0 ? (
                                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs">
                                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                            <span>{validation.warningCount} Non-blocking Warning{validation.warningCount === 1 ? "" : "s"}</span>
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                            Schema is valid and eligible for release. Reviewing warnings is optional.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            <span>All Pre-Flight Checks Passed</span>
                                        </div>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                            Zero blocking errors or warnings. Ready for immediate deployment.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Schema Specification 2x2 Metric Grid */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono block">
                                    Schema Specification
                                </span>

                                <div className="grid grid-cols-2 gap-2.5 w-full">
                                    {/* Metric 1 */}
                                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-zinc-500">
                                            <Layers className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                            <span className="text-[11px] font-medium">Questions</span>
                                        </div>
                                        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {totalQuestions}
                                        </div>
                                        <span className="text-[10px] text-zinc-500 block">{sectionsCount} Section{sectionsCount === 1 ? "" : "s"}</span>
                                    </div>

                                    {/* Metric 2 */}
                                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-zinc-500">
                                            <ShieldCheck className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                            <span className="text-[11px] font-medium">Validation</span>
                                        </div>
                                        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {validatedQuestionsCount}
                                        </div>
                                        <span className="text-[10px] text-zinc-500 block">{unvalidatedQuestionsCount} optional</span>
                                    </div>

                                    {/* Metric 3 */}
                                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-zinc-500">
                                            <GitBranch className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                            <span className="text-[11px] font-medium">Branching</span>
                                        </div>
                                        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {logicRulesCount}
                                        </div>
                                        <span className="text-[10px] text-zinc-500 block">Visibility rules</span>
                                    </div>

                                    {/* Metric 4 */}
                                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-zinc-500">
                                            <Database className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                            <span className="text-[11px] font-medium">Master Data</span>
                                        </div>
                                        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {masterDataCount}
                                        </div>
                                        <span className="text-[10px] text-zinc-500 block">Live lookups</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FULL-WIDTH SECTION: Deployment Scope & Target Schedules */}
                    <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2 w-full">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                                Deployment Scope & Availability
                            </span>
                            <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-zinc-50 dark:bg-zinc-900 font-semibold">
                                {survey.availability?.mode === "always" ? "Always Available" : "Targeted Schedule"}
                            </Badge>
                        </div>

                        {survey.availability?.mode === "always" ? (
                            <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-3 rounded-xl">
                                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-xs leading-relaxed">
                                    <strong>Always Active</strong> • Survey is accessible across all operational bases, villages, and surveyor teams without restriction.
                                </span>
                            </div>
                        ) : (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl flex items-center gap-4 sm:gap-6 flex-wrap text-xs text-zinc-700 dark:text-zinc-300">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span><strong>{schedulesCount}</strong> Schedules</span>
                                </div>
                                <div>
                                    Target Bases: <strong>{targetsAllLocations ? "All Bases" : `${uniqueBases.size} Bases`}</strong>
                                </div>
                                <div>
                                    Villages: <strong>{targetsAllLocations ? "All Villages" : `${uniqueVillages.size} Villages`}</strong>
                                </div>
                                <div>
                                    Surveyors: <strong>{uniqueSurveyors.size > 0 ? `${uniqueSurveyors.size} Assigned` : "All Surveyors"}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Full-Width Section: Release Change Notes */}
                    <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2.5 w-full min-w-0">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="change-summary" className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                Release Change Notes & Operational Audit Log
                            </Label>
                            <span className="text-[10px] text-zinc-400 font-mono">Optional Changelog</span>
                        </div>

                        {/* Quick Add Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1 mr-1 font-medium">
                                <Tag className="h-3 w-3" /> Quick Add:
                            </span>
                            {QUICK_CHANGE_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleAddTag(tag)}
                                    className="px-2.5 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>

                        <Textarea
                            id="change-summary"
                            placeholder="e.g. Added NoC verification step, updated Hindi translations, and enabled Raichur Kharif target schedule..."
                            value={changeSummary}
                            onChange={(e) => setChangeSummary(e.target.value)}
                            rows={3}
                            className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-xs resize-none w-full leading-relaxed"
                        />
                    </div>

                    {/* Error Banner if any */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 px-6 sm:px-7 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs min-w-0">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Immutable schema freeze upon publish • {survey.versionTag}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPublishing}
                            className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-9 px-4 text-xs font-semibold"
                        >
                            Back to Edit
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePublish}
                            disabled={isPublishing || hasErrors}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold h-9 px-5 text-xs shadow-md gap-2 cursor-pointer"
                        >
                            {isPublishing ? (
                                <>
                                    <div className="h-3.5 w-3.5 border-2 border-zinc-400 border-t-zinc-50 animate-spin rounded-full" />
                                    <span>Publishing Release...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="h-3.5 w-3.5" />
                                    <span>Publish Survey ({survey.versionTag})</span>
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
