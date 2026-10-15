"use client";

import React, { useState, useMemo } from "react";
import {
    ArrowLeft,
    Search,
    Check,
    X,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuestionModel } from "../../../types/survey-schema";
import { MASTER_DEFINITIONS, getMasterSetById, searchMasterRecords } from "../../../lib/master-data-registry";

interface PreviewMasterCatalogPageProps {
    question: QuestionModel;
    value: any;
    onConfirm: (newValue: any) => void;
    onBack: () => void;
    locale: string;
}

export function PreviewMasterCatalogPage({
    question,
    value,
    onConfirm,
    onBack,
    locale,
}: PreviewMasterCatalogPageProps) {
    const masterId = question.masterDataConfig?.masterSetId || MASTER_DEFINITIONS[0].id;
    const masterDef = getMasterSetById(masterId);
    const displayKey = question.masterDataConfig?.displayField || masterDef?.displayFieldKey || MASTER_DEFINITIONS[0].displayFieldKey;

    // Determine if multi-select mode is enabled
    const isMultiSelect = question.type === "Checkbox" || Boolean(question.masterDataConfig?.allowMultiSelect);

    // Parse initial selected IDs
    const initialSelectedIds = useMemo<string[]>(() => {
        if (!value) return [];
        if (Array.isArray(value)) {
            return value.map((item) => (typeof item === "object" ? item.recordId || item.id : item)).filter(Boolean);
        }
        if (typeof value === "object") {
            const id = value.recordId || value.id;
            return id ? [id] : [];
        }
        return [String(value)];
    }, [value]);

    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredRecords = useMemo(() => {
        return searchMasterRecords(masterId, searchQuery);
    }, [masterId, searchQuery]);

    const selectedRecords = useMemo(() => {
        return filteredRecords.filter((rec) => selectedIds.includes(rec.id));
    }, [filteredRecords, selectedIds]);

    const otherRecords = useMemo(() => {
        return filteredRecords.filter((rec) => !selectedIds.includes(rec.id));
    }, [filteredRecords, selectedIds]);

    const secondaryFields = useMemo(() => {
        if (!masterDef) return [];
        if (question.masterDataConfig?.secondaryFields && question.masterDataConfig.secondaryFields.length > 0) {
            return question.masterDataConfig.secondaryFields.filter((k) => k !== displayKey);
        }
        return masterDef.fields.filter((f) => f.key !== displayKey).map((f) => f.key);
    }, [masterDef, question.masterDataConfig, displayKey]);

    // Dynamic search bar hint text following the flow (e.g. Search Vehicle Number/Driver Name/Vehicle Type...)
    const searchPlaceholder = useMemo(() => {
        if (!masterDef) return "Search Title/Detail 1/Detail 2...";
        const displayLabel = masterDef.fields.find((f) => f.key === displayKey)?.label || "Title";
        const secLabels = secondaryFields
            .map((k) => masterDef.fields.find((f) => f.key === k)?.label)
            .filter(Boolean)
            .slice(0, 2);

        if (secLabels.length > 0) {
            return `Search ${displayLabel}/${secLabels.join("/")}...`;
        }
        return `Search ${displayLabel}/Detail 1/Detail 2...`;
    }, [masterDef, displayKey, secondaryFields]);

    const applySelectionAndClose = (idsToConfirm: string[]) => {
        if (!masterDef) {
            onConfirm(undefined);
            onBack();
            return;
        }

        if (isMultiSelect) {
            const records = masterDef.sampleRecords.filter((r) => idsToConfirm.includes(r.id));
            const formatted = records.map((rec) => ({
                masterSetId: masterId,
                recordId: rec.id,
                displayValue: rec[displayKey],
                record: rec,
            }));
            onConfirm(formatted.length > 0 ? formatted : undefined);
        } else {
            if (idsToConfirm.length === 0) {
                onConfirm(undefined);
            } else {
                const rec = masterDef.sampleRecords.find((r) => r.id === idsToConfirm[0]);
                if (rec) {
                    onConfirm({
                        masterSetId: masterId,
                        recordId: rec.id,
                        displayValue: rec[displayKey],
                        record: rec,
                    });
                } else {
                    onConfirm(undefined);
                }
            }
        }
        onBack();
    };

    const handleSelectCard = (rec: Record<string, any>) => {
        if (isMultiSelect) {
            const id = rec.id;
            const updated = selectedIds.includes(id)
                ? selectedIds.filter((x) => x !== id)
                : [...selectedIds, id];
            setSelectedIds(updated);
        } else {
            // In Single-select: tap to immediately select and return to form view
            setSelectedIds([rec.id]);
            applySelectionAndClose([rec.id]);
        }
    };

    const handleClearSelection = () => {
        setSelectedIds([]);
        if (!isMultiSelect) {
            onConfirm(undefined);
        }
    };

    const handleConfirm = () => {
        applySelectionAndClose(selectedIds);
    };

    const handleBackWithSave = () => {
        if (isMultiSelect) {
            applySelectionAndClose(selectedIds);
        } else {
            onBack();
        }
    };

    // Render structured Detail rows: Detail 1: ..., Detail 2: ..., Detail 3: ...
    const renderCardDetails = (rec: Record<string, any>) => {
        return (
            <div className="space-y-0.5 pt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                {secondaryFields.map((fieldKey, idx) => {
                    const fieldDef = masterDef?.fields.find((f) => f.key === fieldKey);
                    const val = rec[fieldKey];
                    if (val === undefined || val === null || val === "") return null;
                    return (
                        <div key={fieldKey} className="leading-tight truncate">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                Detail {idx + 1}:
                            </span>{" "}
                            <span className="text-zinc-600 dark:text-zinc-400">
                                {fieldDef?.label ? `${fieldDef.label} - ` : ""}
                                {String(val)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Top Navigation App Header (Clean standard neutral colors matching the rest of the application) */}
            <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 flex items-center justify-between shrink-0 shadow-2xs">
                <button
                    type="button"
                    onClick={handleBackWithSave}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors cursor-pointer -ml-1 px-1.5 py-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                >
                    <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {locale === "hi" ? "आइटम चुनें" : "Select item"}
                    </span>
                </button>

                <div className="flex items-center gap-2">
                    {isMultiSelect ? (
                        <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 rounded-full"
                        >
                            Multi-select ({selectedIds.length})
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-full"
                        >
                            {masterDef?.name || "Catalog"}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Search Bar Section */}
            <div className="p-3 pb-2 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 space-y-2 shrink-0">
                <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 pr-7 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs placeholder:text-zinc-400 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600"
                        autoFocus
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Options List */}
            <ScrollArea className="flex-1 p-3">
                <div className="space-y-4 pb-4">
                    {filteredRecords.length === 0 ? (
                        <div className="p-8 text-center space-y-3 bg-white dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            <div className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 w-fit mx-auto">
                                <Search className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    No matching items found
                                </p>
                                <p className="text-[11px] text-zinc-400 max-w-[200px] mx-auto">
                                    No records matched &ldquo;{searchQuery}&rdquo;
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setSearchQuery("")}
                                className="h-7 text-xs rounded-lg"
                            >
                                Clear search
                            </Button>
                        </div>
                    ) : selectedIds.length > 0 ? (
                        <>
                            {/* 1. SELECTED SECTION (Screen 4 Layout) */}
                            {selectedRecords.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                            Selected {isMultiSelect ? `(${selectedRecords.length})` : ""}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleClearSelection}
                                            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:underline cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {selectedRecords.map((rec) => (
                                            <button
                                                key={rec.id}
                                                type="button"
                                                onClick={() => handleSelectCard(rec)}
                                                className="w-full text-left p-3.5 rounded-xl border border-zinc-900 dark:border-zinc-100 bg-zinc-100/90 dark:bg-zinc-800/90 shadow-2xs cursor-pointer select-none transition-all flex items-start justify-between gap-2.5"
                                            >
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <h4 className="font-bold text-xs text-zinc-950 dark:text-zinc-50 truncate">
                                                        {rec[displayKey]}
                                                    </h4>
                                                    {renderCardDetails(rec)}
                                                </div>

                                                <div className="h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                                    <Check className="h-3 w-3 stroke-[3]" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. OTHER OPTIONS SECTION (Screen 4 Layout) */}
                            {otherRecords.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                            Other options
                                        </span>
                                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                            {otherRecords.length}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {otherRecords.map((rec) => (
                                            <button
                                                key={rec.id}
                                                type="button"
                                                onClick={() => handleSelectCard(rec)}
                                                className="w-full text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer select-none flex items-start justify-between gap-2.5 shadow-2xs"
                                            >
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <h4 className="font-bold text-xs text-zinc-950 dark:text-zinc-50 truncate">
                                                        {rec[displayKey]}
                                                    </h4>
                                                    {renderCardDetails(rec)}
                                                </div>

                                                <div
                                                    className={cn(
                                                        "h-5 w-5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center shrink-0 mt-0.5",
                                                        isMultiSelect ? "rounded-md" : "rounded-full"
                                                    )}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* 3. DEFAULT OPTIONS LIST (Screen 2 Layout when no selection yet) */
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                    Options
                                </span>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {filteredRecords.length}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {filteredRecords.map((rec) => (
                                    <button
                                        key={rec.id}
                                        type="button"
                                        onClick={() => handleSelectCard(rec)}
                                        className="w-full text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer select-none flex items-start justify-between gap-2.5 shadow-2xs"
                                    >
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <h4 className="font-bold text-xs text-zinc-950 dark:text-zinc-50 truncate">
                                                {rec[displayKey]}
                                            </h4>
                                            {renderCardDetails(rec)}
                                        </div>

                                        <div
                                            className={cn(
                                                "h-5 w-5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center shrink-0 mt-0.5",
                                                isMultiSelect ? "rounded-md" : "rounded-full"
                                            )}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Sticky Bottom Action Bar for Multi-Select Mode */}
            {isMultiSelect && (
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2 shrink-0 shadow-md">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selectedIds.length === 0}
                        onClick={handleClearSelection}
                        className="h-8 px-2.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg disabled:opacity-30"
                    >
                        Clear Selection
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        onClick={handleConfirm}
                        className="h-8 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 rounded-lg shadow-2xs"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                            {selectedIds.length === 0
                                ? "Confirm (None)"
                                : `Confirm Selection (${selectedIds.length})`}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
}
