"use client";

import React, { useState } from "react";
import {
    Plus,
    Trash2,
    GripVertical,
    ArrowUp,
    ArrowDown,
    List,
    Database,
    Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OptionItem, QuestionModel } from "../../../types/survey-schema";
import { MASTER_SETS, getMasterSetById } from "../../../lib/master-data-registry";

interface OptionsTabProps {
    question: QuestionModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}


export function OptionsTab({
    question,
    onChangeQuestion,
    isPublished = false,
}: OptionsTabProps) {
    const options = question.options || [];

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleAddOption = () => {
        const nextIdx = options.length + 1;
        const newOpt: OptionItem = {
            id: `opt_${Date.now()}_${nextIdx}`,
            value: `option_${nextIdx}`,
            labels: {
                en: `Option ${nextIdx}`,
                hi: `विकल्प ${nextIdx}`,
            },
        };
        onChangeQuestion({
            ...question,
            options: [...options, newOpt],
        });
    };

    const handleUpdateOption = (index: number, updated: Partial<OptionItem>) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], ...updated };
        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    const handleDeleteOption = (index: number) => {
        const newOptions = options.filter((_, idx) => idx !== index);
        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    const handleMoveOption = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === options.length - 1)
        ) {
            return;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const newOptions = [...options];
        const temp = newOptions[index];
        newOptions[index] = newOptions[targetIndex];
        newOptions[targetIndex] = temp;

        onChangeQuestion({
            ...question,
            options: newOptions,
        });
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (isPublished) return;
        setDraggedIndex(index);
        e.dataTransfer.setData("text/plain", String(index));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        if (isPublished) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        if (isPublished) return;
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const updatedOptions = [...options];
        const [movedItem] = updatedOptions.splice(draggedIndex, 1);
        updatedOptions.splice(targetIndex, 0, movedItem);

        onChangeQuestion({
            ...question,
            options: updatedOptions,
        });

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };


    const isMasterSource = question.optionSource === "master";
    const masterConfig = question.masterDataConfig || { masterSetId: "trucks" };
    const selectedMaster = getMasterSetById(masterConfig.masterSetId) || MASTER_SETS[0];

    const handleOptionSourceChange = (source: "custom" | "master") => {
        if (source === "master") {
            onChangeQuestion({
                ...question,
                optionSource: "master",
                masterDataConfig: {
                    masterSetId: masterConfig.masterSetId || "trucks",
                    displayField: selectedMaster.displayFieldKey,
                },
            });
        } else {
            onChangeQuestion({
                ...question,
                optionSource: "custom",
            });
        }
    };

    const handleSelectMasterSet = (masterSetId: string) => {
        const found = getMasterSetById(masterSetId);
        onChangeQuestion({
            ...question,
            masterDataConfig: {
                ...masterConfig,
                masterSetId,
                displayField: found?.displayFieldKey || "",
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* 1. OPTION SOURCE SELECTION (CUSTOM OPTIONS vs MASTER DATA) */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Option Source
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                            Choose between bespoke survey choices or centralized enterprise master data
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleOptionSourceChange("custom")}
                        className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer",
                            !isMasterSource
                                ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                            !isMasterSource
                                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100"
                                : "border-zinc-400 dark:border-zinc-600"
                        )}>
                            {!isMasterSource && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Custom Options</span>
                            <span className="text-[11px] text-zinc-500 block">Static survey choices with multilingual translations</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleOptionSourceChange("master")}
                        className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer",
                            isMasterSource
                                ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                            isMasterSource
                                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100"
                                : "border-zinc-400 dark:border-zinc-600"
                        )}>
                            {isMasterSource && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Master Data</span>
                            <span className="text-[11px] text-zinc-500 block">Searchable selector bound to live operational database</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* 2. MASTER DATA CONFIGURATION & PREVIEW */}
            {isMasterSource ? (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Master Set Registry
                            </Label>
                            <Select
                                disabled={isPublished}
                                value={masterConfig.masterSetId || "trucks"}
                                onValueChange={handleSelectMasterSet}
                            >
                                <SelectTrigger className="h-9 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Select master dataset..." />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    {MASTER_SETS.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            <div className="flex items-center gap-2">
                                                <Database className="h-3.5 w-3.5 text-zinc-500" />
                                                <span className="font-semibold">{m.name}</span>
                                                <span className="text-zinc-400 text-[10px]">({m.category})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedMaster && (
                            <div className="space-y-3 pt-1">
                                {/* Display Field Configuration */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                        Primary Display Field (Option Title)
                                    </Label>
                                    <Select
                                        disabled={isPublished}
                                        value={masterConfig.displayField || selectedMaster.displayFieldKey}
                                        onValueChange={(fKey) => {
                                            onChangeQuestion({
                                                ...question,
                                                masterDataConfig: {
                                                    ...masterConfig,
                                                    displayField: fKey,
                                                },
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-mono">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="text-xs">
                                            {selectedMaster.fields.map((f) => (
                                                <SelectItem key={f.key} value={f.key}>
                                                    {f.label} <span className="text-zinc-400 font-mono">({f.key})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Master Dataset Preview Card */}
                                <div className="p-3.5 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-3.5 w-3.5 text-zinc-500" />
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                Master Preview: {selectedMaster.name}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 border-zinc-200 dark:border-zinc-700">
                                            {selectedMaster.sampleRecords.length} sample records
                                        </Badge>
                                    </div>

                                    {/* Fields displayed */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                            Fields Displayed in Mobile App Selector
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {selectedMaster.fields.map((f) => (
                                                <Badge
                                                    key={f.key}
                                                    variant="secondary"
                                                    className="text-[11px] font-normal bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                                                >
                                                    {f.label}
                                                    {f.isSearchable && <span className="ml-1 text-[9px] text-zinc-400">(Searchable)</span>}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sample Records Box */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                            Sample Live Records
                                        </span>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {selectedMaster.sampleRecords.slice(0, 4).map((rec, i) => (
                                                <div
                                                    key={rec.id || i}
                                                    className="p-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between"
                                                >
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                                                        {rec[masterConfig.displayField || selectedMaster.displayFieldKey]}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                                                        {Object.entries(rec)
                                                            .filter(([k]) => k !== "id" && k !== (masterConfig.displayField || selectedMaster.displayFieldKey))
                                                            .map(([k, v]) => `${v}`)
                                                            .join(" • ")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-zinc-400 italic pt-1">
                                            * Preview data only. Response storage saves stable master identity ({selectedMaster.id} / record ID).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* 3. BESPOKE CUSTOM OPTIONS CONFIGURATION */
                <div className="space-y-6">
            {/* Configured Choices List */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            Configured Choices ({options.length})
                        </h3>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            Add the choices the surveyor can pick. Translations are managed on the Translation tab. Drag to reorder.
                        </p>
                    </div>

                    {/* Single Clean Add Choice Action */}
                    <Button
                        type="button"
                        size="sm"
                        disabled={isPublished}
                        onClick={handleAddOption}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold h-8 gap-1.5 shadow-2xs cursor-pointer"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Choice
                    </Button>
                </div>

                <div className="space-y-2.5">
                    {options.map((opt, idx) => {
                        const isDragging = draggedIndex === idx;
                        const isDragOver = dragOverIndex === idx;

                        return (
                            <div
                                key={opt.id || idx}
                                draggable={!isPublished}
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                    "p-3.5 rounded-lg border transition-all space-y-3 select-none",
                                    "bg-zinc-50/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800",
                                    isDragging && "opacity-40 scale-[0.99] border-dashed border-zinc-400 dark:border-zinc-600 shadow-none",
                                    isDragOver && !isDragging && "border-t-2 border-t-zinc-900 dark:border-t-zinc-100 bg-zinc-100 dark:bg-zinc-800/60 ring-1 ring-zinc-900/10"
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {!isPublished && (
                                            <div
                                                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing p-0.5"
                                                title="Drag to reorder choice"
                                            >
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                        )}
                                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                            {opt.labels.en || `Choice ${idx + 1}`}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPublished || idx === 0}
                                            onClick={() => handleMoveOption(idx, "up")}
                                            className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            title="Move Up"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPublished || idx === options.length - 1}
                                            onClick={() => handleMoveOption(idx, "down")}
                                            className="h-7 w-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            title="Move Down"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPublished || options.length <= 1}
                                            onClick={() => handleDeleteOption(idx)}
                                            className="h-7 w-7 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                            title="Delete Choice"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                            English Label <span className="text-zinc-400 font-mono text-[10px]">(Opt_Name)</span>
                                        </Label>
                                        <Input
                                            placeholder="e.g. Yes"
                                            value={opt.labels.en || ""}
                                            disabled={isPublished}
                                            onChange={(e) =>
                                                handleUpdateOption(idx, {
                                                    labels: { ...opt.labels, en: e.target.value },
                                                    value: opt.value || e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                                })
                                            }
                                            className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                            Backend Value <span className="text-zinc-400 font-mono text-[10px]">(Raw Key)</span>
                                        </Label>
                                        <Input
                                            placeholder="e.g. yes"
                                            value={opt.value || ""}
                                            disabled={isPublished}
                                            onChange={(e) =>
                                                handleUpdateOption(idx, {
                                                    value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                                })
                                            }
                                            className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        )}
    </div>
    );
}
