"use client";

import React, { useState } from "react";
import { AlertTriangle, Code2, FileJson, Check, Copy, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LocaleDefinition, QuestionModel, SurveyModel } from "../../../types/survey-schema";
import { serializeQuestionToCoreJSON } from "../../../lib/survey-serializer";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe } from "lucide-react";

interface AdvancedTabProps {
    question: QuestionModel;
    allQuestions: QuestionModel[];
    survey?: SurveyModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

export function AdvancedTab({
    question,
    allQuestions,
    survey,
    onChangeQuestion,
    isPublished = false,
}: AdvancedTabProps) {
    const [inspectorView, setInspectorView] = useState<"core" | "translation">("core");
    const [copied, setCopied] = useState(false);

    const defaultLocale = survey?.defaultLocale || "en";
    const nonDefaultLocales = (survey?.locales || []).filter((l) => l.code !== defaultLocale);
    const [selectedLocaleCode, setSelectedLocaleCode] = useState<string>("all");

    // Active selected locale
    const activeLocale =
        selectedLocaleCode === "all"
            ? null
            : nonDefaultLocales.find((l) => l.code === selectedLocaleCode) || nonDefaultLocales[0] || null;

    const handleUpdate = (updated: Partial<QuestionModel>) => {
        onChangeQuestion({
            ...question,
            ...updated,
        });
    };

    const anomaly = question.anomalyDetection || { enabled: false };

    // Helper to generate a single modular translation resource excerpt for a locale
    const buildSingleExcerpt = (locCode: string) => ({
        schemaVersion: "1.0",
        locale: locCode,
        translationVersion: 1,
        translations: {
            questions: {
                [question.id]: {
                    title: question.titles[locCode] || question.titles[defaultLocale] || "",
                    ...(question.descriptions?.[locCode] ? { hint: question.descriptions[locCode] } : {}),
                    ...(question.placeholders?.[locCode] ? { placeholder: question.placeholders[locCode] } : {}),
                },
            },
            ...(question.options && question.options.length > 0
                ? {
                      choices: Object.fromEntries(
                          question.options.map((opt) => [
                              opt.id,
                              opt.labels[locCode] || opt.labels[defaultLocale] || opt.value,
                          ])
                      ),
                  }
                : {}),
        },
    });

    let translationExcerpt: any;
    if (selectedLocaleCode === "all") {
        if (nonDefaultLocales.length === 0) {
            translationExcerpt = {
                message: "No non-default translation languages configured for this survey.",
            };
        } else {
            translationExcerpt = Object.fromEntries(
                nonDefaultLocales.map((loc) => [
                    `translations/${loc.code}.json`,
                    buildSingleExcerpt(loc.code),
                ])
            );
        }
    } else {
        translationExcerpt = buildSingleExcerpt(selectedLocaleCode);
    }

    const activeJSONString =
        inspectorView === "core"
            ? JSON.stringify(serializeQuestionToCoreJSON(question, defaultLocale), null, 2)
            : JSON.stringify(translationExcerpt, null, 2);

    const handleCopy = () => {
        navigator.clipboard.writeText(activeJSONString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const filename =
            inspectorView === "core"
                ? `question_${question.displayIndex || question.number}_schema_v2.json`
                : selectedLocaleCode === "all"
                ? `translations_all_${question.id}.json`
                : `translations_${selectedLocaleCode}_${question.id}.json`;
        const blob = new Blob([activeJSONString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Quality & Anomaly Flags */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-zinc-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Operational Quality & Anomaly Flags
                    </h3>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
                    <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">
                            Flag as Anomaly Detector <span className="text-zinc-400 font-mono text-[10px]">(IS_Anomaly)</span>
                        </span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Highlights responses exceeding standard deviations in operational analytics dashboard.
                        </p>
                    </div>
                    <Switch
                        checked={Boolean(anomaly.enabled)}
                        disabled={isPublished}
                        onCheckedChange={(checked) =>
                            handleUpdate({
                                anomalyDetection: {
                                    ...anomaly,
                                    enabled: checked,
                                },
                            })
                        }
                    />
                </div>
            </div>

            {/* JSON Schema & Translation Payload Inspector */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                {/* Section Header */}
                <div>
                    <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-zinc-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            Schema & JSON Definition
                        </h3>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {inspectorView === "core"
                            ? "Full source-of-truth question schema (v2.0) including validation constraints, visibility logic, repeater parameters, and Advanced Settings."
                            : selectedLocaleCode === "all"
                            ? `All modular translation resource files (v1.0) holding user-facing text only for ${nonDefaultLocales.length} configured language${nonDefaultLocales.length === 1 ? "" : "s"}. Advanced Settings are strictly excluded.`
                            : `Modular translation resource format (translations/${selectedLocaleCode}.json) holding user-facing text only for ${activeLocale?.label || selectedLocaleCode}. Advanced Settings are strictly excluded.`}
                    </p>
                </div>

                {/* Integrated Code Workbench Container (Clean Light Theme) */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 overflow-hidden shadow-2xs">
                    {/* Workbench Top Toolbar: Tabs (Left) & Controls (Right) */}
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-100/70 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs flex-wrap">
                        {/* Left: View Tabs (Fixed Left Alignment - No Layout Shift) */}
                        <div className="flex items-center p-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 shrink-0">
                            <button
                                type="button"
                                onClick={() => setInspectorView("core")}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                    inspectorView === "core"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                )}
                            >
                                <Code2 className="h-3 w-3" />
                                <span>Core Schema (2.0)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setInspectorView("translation")}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                                    inspectorView === "translation"
                                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                )}
                            >
                                <Globe className="h-3 w-3" />
                                <span>Translations (1.0)</span>
                            </button>
                        </div>

                        {/* Right: Language Filter (if translation mode) + Format Badge + Copy Action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Language Selector Dropdown (In Translation Mode) */}
                            {inspectorView === "translation" && nonDefaultLocales.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-[11px] font-medium border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white gap-1 shadow-2xs cursor-pointer rounded"
                                        >
                                            <Globe className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                            <span>
                                                {selectedLocaleCode === "all"
                                                    ? `All Languages (${nonDefaultLocales.length})`
                                                    : activeLocale?.label || selectedLocaleCode}
                                            </span>
                                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-56 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => setSelectedLocaleCode("all")}
                                            className={cn(
                                                "cursor-pointer flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800",
                                                selectedLocaleCode === "all" && "font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                            )}
                                        >
                                            <span>All Languages</span>
                                            <span className="font-mono text-[10px] text-zinc-400">
                                                {nonDefaultLocales.length} files
                                            </span>
                                        </DropdownMenuItem>
                                        <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                                        {nonDefaultLocales.map((loc) => (
                                            <DropdownMenuItem
                                                key={loc.code}
                                                onClick={() => setSelectedLocaleCode(loc.code)}
                                                className={cn(
                                                    "cursor-pointer flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800",
                                                    loc.code === selectedLocaleCode && "font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                )}
                                            >
                                                <span>{loc.label}</span>
                                                <span className="font-mono text-[10px] text-zinc-400">
                                                    translations/{loc.code}.json
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            <Badge
                                variant="outline"
                                className="font-mono text-[10px] border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800/60 px-1.5 py-0.5 rounded"
                            >
                                JSON
                            </Badge>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleDownload}
                                className="h-7 px-2 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 gap-1 cursor-pointer rounded transition-colors"
                                title="Download active JSON file"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span>Download</span>
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-7 px-2 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 gap-1 cursor-pointer rounded transition-colors"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                <span className={copied ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                                    {copied ? "Copied" : "Copy"}
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* File Context & Path Bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100/40 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800/80 text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                            <FileJson className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                                {inspectorView === "core"
                                    ? `question_${question.displayIndex || question.number}.json`
                                    : selectedLocaleCode === "all"
                                    ? `translations/*.json (${nonDefaultLocales.length} manifests)`
                                    : `translations/${selectedLocaleCode}.json`}
                            </span>
                            <span className="text-zinc-400 dark:text-zinc-600 text-xs hidden sm:inline">•</span>
                            <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-sans truncate hidden sm:inline">
                                {inspectorView === "core"
                                    ? `ID: ${question.id} | Column: ${question.columnName}`
                                    : selectedLocaleCode === "all"
                                    ? `Multi-resource bundle | ${nonDefaultLocales.map((l) => l.code).join(", ")}`
                                    : `${activeLocale?.label || selectedLocaleCode} locale`}
                            </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 font-sans">
                            {inspectorView === "core" ? "Schema v2.0 • Canonical" : "Schema v1.0 • Decoupled Strings"}
                        </span>
                    </div>

                    {/* Code Content */}
                    <pre className="p-3.5 text-[11.5px] font-mono text-zinc-800 dark:text-zinc-200 overflow-auto max-h-[280px] leading-relaxed select-text bg-white dark:bg-zinc-950">
                        <code>{activeJSONString}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
}
