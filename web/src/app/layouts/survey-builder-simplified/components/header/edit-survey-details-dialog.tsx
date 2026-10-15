"use client";

import React, { useState, useEffect } from "react";
import { Settings2, AlertCircle, Lock, Layers } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SurveyModel } from "../../types/survey-schema";
import { CATEGORY_REGISTRY, getCategoryPath } from "../../lib/category-registry";
import { AZOption } from "../../services/mock-surveys";

interface EditSurveyDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey: SurveyModel;
    azs: AZOption[];
    onSaveDetails: (updatedFields: {
        name: string;
        description?: string;
        category?: string;
        defaultLocale?: string;
        azId?: string;
    }) => Promise<void>;
}

export function EditSurveyDetailsDialog({
    open,
    onOpenChange,
    survey,
    azs,
    onSaveDetails,
}: EditSurveyDetailsDialogProps) {
    const isPublished = survey.status === "Published";

    const [name, setName] = useState(survey.name);
    const [description, setDescription] = useState(survey.description || "");
    const [category, setCategory] = useState(survey.category || "Field Operations");
    const [defaultLocale, setDefaultLocale] = useState(survey.defaultLocale || "en");
    const [azId, setAzId] = useState(survey.azId || "AZ2");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setName(survey.name);
            setDescription(survey.description || "");
            setCategory(survey.category || "Field Operations");
            setDefaultLocale(survey.defaultLocale || "en");
            setAzId(survey.azId || "AZ2");
            setError(null);
        }
    }, [open, survey]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPublished) {
            setError("Published survey snapshots are immutable. Fork a new draft version to edit details.");
            return;
        }

        if (!name.trim()) {
            setError("Survey name is required.");
            return;
        }

        if (!category || !category.trim()) {
            setError("Survey category is required. Please select a category.");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);
            await onSaveDetails({
                name: name.trim(),
                description: description.trim() || undefined,
                category: category.trim(),
                defaultLocale,
                azId,
            });
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.message || "Failed to update survey details.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <form onSubmit={handleSave}>
                    <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                                    <Settings2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                        Edit Survey Details
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                        Update survey metadata and category routing for version {survey.versionTag}.
                                    </DialogDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono font-semibold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shrink-0">
                                {survey.versionTag}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-4 text-xs">
                        {/* Version Isolation Notice */}
                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                                {isPublished ? (
                                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                                ) : (
                                    <Layers className="h-3.5 w-3.5 text-zinc-500" />
                                )}
                                <span>Version Governance Notice</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {isPublished
                                    ? `Version ${survey.versionTag} is Published and immutable. Changes cannot be applied directly.`
                                    : `Editing ${survey.versionTag} (Draft). Changes will apply strictly to this version and will not mutate historical snapshots.`}
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-name" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Survey Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="edit-name"
                                value={name}
                                disabled={isPublished}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs placeholder:text-zinc-400 rounded-lg"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-az" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Zone (AZ)
                                </Label>
                                <Select value={azId} onValueChange={setAzId} disabled={isPublished}>
                                    <SelectTrigger id="edit-az" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs rounded-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        {azs.map((az) => (
                                            <SelectItem key={az.id} value={az.id}>
                                                {az.id} - {az.name.split(" - ")[1] || az.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit-lang" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Default Language
                                </Label>
                                <Select value={defaultLocale} onValueChange={setDefaultLocale} disabled={isPublished}>
                                    <SelectTrigger id="edit-lang" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs rounded-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="en">English (EN)</SelectItem>
                                        <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                                        <SelectItem value="pa">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
                                        <SelectItem value="mr">Marathi (मराठी)</SelectItem>
                                        <SelectItem value="te">Telugu (తెలుగు)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Category & App Location Panel */}
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-cat" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Category <span className="text-rose-500">*</span>
                            </Label>
                            <Select value={category || undefined} onValueChange={setCategory} disabled={isPublished}>
                                <SelectTrigger id="edit-cat" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs rounded-lg">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    {CATEGORY_REGISTRY.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* App Location Info Panel */}
                            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 mt-1.5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                                    App Location Path
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex-wrap">
                                    {getCategoryPath(category) ? (
                                        getCategoryPath(category)?.map((crumb, idx, arr) => (
                                            <React.Fragment key={crumb}>
                                                <span>{crumb}</span>
                                                {idx < arr.length - 1 && <span className="text-zinc-400">→</span>}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <span className="text-zinc-400 font-normal italic">Select a category to view its assigned application path.</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-desc" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Description
                            </Label>
                            <Textarea
                                id="edit-desc"
                                value={description}
                                disabled={isPublished}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 min-h-[70px] text-xs resize-none rounded-lg placeholder:text-zinc-400"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-end gap-2.5 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="h-9 px-4 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSaving || isPublished || !name.trim() || !category.trim()}
                            className="h-9 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50 rounded-lg shadow-sm"
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
