"use client";

import React, { useState } from "react";
import { Plus, FileText, Globe, Layers, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { AZOption } from "../../services/mock-surveys";
import { CATEGORY_REGISTRY, getCategoryPath } from "../../lib/category-registry";

interface CreateSurveyDialogProps {
    azs: AZOption[];
    currentAzId: string;
    onCreateSurvey: (payload: {
        name: string;
        description?: string;
        azId: string;
        defaultLocale: string;
        category?: string;
    }) => Promise<void>;
    trigger?: React.ReactNode;
}

export function CreateSurveyDialog({
    azs,
    currentAzId,
    onCreateSurvey,
    trigger,
}: CreateSurveyDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [azId, setAzId] = useState(currentAzId || "");
    const [defaultLocale, setDefaultLocale] = useState("en");
    const [category, setCategory] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Survey name is required.");
            return;
        }

        if (!category || !category.trim()) {
            setError("Survey category is required. Please select a category to continue.");
            return;
        }

        try {
            setIsSubmitting(true);
            await onCreateSurvey({
                name: name.trim(),
                description: description.trim() || undefined,
                azId,
                defaultLocale,
                category: category.trim(),
            });
            setName("");
            setDescription("");
            setCategory("");
            setError(null);
            setOpen(false);
        } catch (err: any) {
            setError(err.message || "Failed to create survey.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        size="sm"
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium gap-1.5 h-8 px-3 text-xs rounded-md shadow-none shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>New Survey</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <DialogTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Create Operational Survey</DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Configure new field survey schema in draft state (v1).
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-5 space-y-4 text-xs">
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="survey-name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Survey Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="survey-name"
                                placeholder="e.g. Wheat Plot Enrollment or Soil Baseline"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="survey-az" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Zone (AZ) <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="survey-az"
                                    placeholder="e.g. ERW"
                                    value={azId}
                                    onChange={(e) => setAzId(e.target.value)}
                                    className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="survey-lang" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Default Language <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={defaultLocale} onValueChange={setDefaultLocale}>
                                    <SelectTrigger id="survey-lang" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs">
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                        <SelectItem value="en" className="text-xs">English (EN)</SelectItem>
                                        <SelectItem value="hi" className="text-xs">Hindi (हिंदी)</SelectItem>
                                        <SelectItem value="pa" className="text-xs">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
                                        <SelectItem value="mr" className="text-xs">Marathi (मराठी)</SelectItem>
                                        <SelectItem value="te" className="text-xs">Telugu (తెలుగు)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="survey-cat" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Category <span className="text-rose-500">*</span>
                            </Label>
                            <Select value={category || undefined} onValueChange={setCategory}>
                                <SelectTrigger id="survey-cat" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 text-xs">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                    {CATEGORY_REGISTRY.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.name} className="text-xs">
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* App Location Info Panel */}
                            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 mt-1">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                    App Location
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
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
                            <Label htmlFor="survey-desc" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Description (Optional)
                            </Label>
                            <Textarea
                                id="survey-desc"
                                placeholder="Brief summary of survey objective and field operational scope..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 min-h-[70px] text-xs resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="h-8 px-3 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || !name.trim() || !category.trim()}
                            className="h-8 px-3.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-md shadow-xs disabled:opacity-50"
                        >
                            {isSubmitting ? "Creating..." : "Create Survey"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
