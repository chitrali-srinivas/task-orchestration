"use client";

import React, { useState, useMemo } from "react";
import {
    Globe,
    Plus,
    Trash2,
    Check,
    Search,
    Star,
    Sparkles,
    Download,
    Upload,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocaleDefinition, QuestionModel, SurveyModel } from "../../types/survey-schema";
import {
    LanguageCatalogItem,
    SUPPORTED_LANGUAGES_CATALOG,
} from "../../data/supported-languages";

interface LanguageManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey: SurveyModel;
    onUpdateLocales: (updatedLocales: LocaleDefinition[], newDefaultLocale?: string) => void;
    isPublished?: boolean;
}

export function LanguageManagerDialog({
    open,
    onOpenChange,
    survey,
    onUpdateLocales,
    isPublished,
}: LanguageManagerDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [customCode, setCustomCode] = useState("");
    const [customName, setCustomName] = useState("");
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeLocales = survey.locales || [{ code: "en", label: "English (EN)", isDefault: true }];
    const defaultLocale = survey.defaultLocale || "en";

    // Compute translation completion percentage per active language across all survey questions
    const localeStats = useMemo(() => {
        const totalQuestions = survey.questions.length;
        if (totalQuestions === 0) return {};

        const stats: Record<string, { translatedCount: number; percentage: number }> = {};

        activeLocales.forEach((loc) => {
            let translated = 0;
            survey.questions.forEach((q) => {
                const text = q.titles[loc.code];
                if (text && text.trim().length > 0) {
                    translated++;
                }
            });
            stats[loc.code] = {
                translatedCount: translated,
                percentage: Math.round((translated / totalQuestions) * 100),
            };
        });

        return stats;
    }, [survey.questions, activeLocales]);

    // Available catalog languages that are not already active
    const availableCatalog = useMemo(() => {
        const activeCodes = new Set(activeLocales.map((l) => l.code));
        return SUPPORTED_LANGUAGES_CATALOG.filter((item) => {
            const notActive = !activeCodes.has(item.code);
            const matches =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.region.toLowerCase().includes(searchQuery.toLowerCase());
            return notActive && matches;
        });
    }, [activeLocales, searchQuery]);

    const handleAddLanguage = (item: LanguageCatalogItem) => {
        setError(null);
        const newLocale: LocaleDefinition = {
            code: item.code,
            label: item.label,
            isDefault: false,
            direction: item.direction || "ltr",
            translationFile: `translations/${item.code}.json`,
            translationVersion: 1,
        };
        const updated = [...activeLocales, newLocale];
        onUpdateLocales(updated);
    };

    const handleAddCustomLanguage = (e: React.FormEvent) => {
        e.preventDefault();
        const code = customCode.trim().toLowerCase();
        const name = customName.trim();

        if (!code || !name) {
            setError("Language code and name are required.");
            return;
        }

        if (activeLocales.some((l) => l.code === code)) {
            setError(`Language code '${code}' is already enabled.`);
            return;
        }

        const newLocale: LocaleDefinition = {
            code,
            label: `${name} (${code.toUpperCase()})`,
            isDefault: false,
            direction: "ltr",
            translationFile: `translations/${code}.json`,
            translationVersion: 1,
        };

        const updated = [...activeLocales, newLocale];
        onUpdateLocales(updated);
        setCustomCode("");
        setCustomName("");
        setIsAddingCustom(false);
        setError(null);
    };

    const handleSetDefault = (localeCode: string) => {
        const updated = activeLocales.map((loc) => ({
            ...loc,
            isDefault: loc.code === localeCode,
        }));
        onUpdateLocales(updated, localeCode);
    };

    const handleRemoveLanguage = (localeCode: string) => {
        if (localeCode === defaultLocale) {
            setError("Cannot remove the default survey language. Set another language as default first.");
            return;
        }

        const updated = activeLocales.filter((l) => l.code !== localeCode);
        onUpdateLocales(updated);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{ width: "min(840px, 94vw)", maxWidth: "840px", maxHeight: "82vh", zIndex: 600 }}
                className="!max-w-[840px] w-[94vw] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 flex flex-col max-h-[82vh] rounded-2xl overflow-hidden !z-[600]"
            >
                <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/80 dark:bg-zinc-900/70">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                Multilingual & Localization Manager
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                Add regional Indian and global languages for scalable mobile survey deployment.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 py-5">
                    <div className="space-y-5 pb-1">
                        {error && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Section 1: Currently Enabled Languages */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                    Active Survey Languages ({activeLocales.length})
                                </h4>
                                <span className="text-[11px] text-zinc-400 font-mono">
                                    Total Questions: {survey.questions.length}
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {activeLocales.map((loc) => {
                                    const isDef = loc.code === defaultLocale;
                                    const stats = localeStats[loc.code] || { translatedCount: 0, percentage: 0 };

                                    return (
                                        <div
                                            key={loc.code}
                                            className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-2.5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-[10px] uppercase font-bold border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5"
                                                    >
                                                        {loc.code}
                                                    </Badge>
                                                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                                        {loc.label}
                                                    </span>
                                                    {isDef && (
                                                        <Badge className="text-[9px] bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-1.5 py-0 font-medium">
                                                            Primary Default
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {!isDef && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isPublished}
                                                            onClick={() => handleSetDefault(loc.code)}
                                                            className="h-7 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2.5 gap-1.5"
                                                        >
                                                            <Star className="h-3 w-3 text-zinc-400" /> Set as Default
                                                        </Button>
                                                    )}

                                                    {!isDef && activeLocales.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={isPublished}
                                                            onClick={() => handleRemoveLanguage(loc.code)}
                                                            className="h-7 w-7 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                            title="Remove language from survey"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                                                    <span>
                                                        {stats.translatedCount} of {survey.questions.length} questions translated
                                                    </span>
                                                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                                        {stats.percentage}%
                                                    </span>
                                                </div>
                                                <Progress value={stats.percentage} className="h-1 bg-zinc-200 dark:bg-zinc-800" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section 2: Add From Catalog */}
                        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                    Add Supported Regional / Global Language
                                </h4>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingCustom(!isAddingCustom)}
                                    className="h-7 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Custom Language
                                </Button>
                            </div>

                            {/* Custom Language Form */}
                            {isAddingCustom && (
                                <form
                                    onSubmit={handleAddCustomLanguage}
                                    className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 space-y-3 animate-in fade-in duration-200"
                                >
                                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                                        Configure Custom Language
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                                ISO Code <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                placeholder="e.g. bho, raj, hmn"
                                                value={customCode}
                                                onChange={(e) => setCustomCode(e.target.value)}
                                                className="h-8 text-xs font-mono bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                                Display Label <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                placeholder="e.g. Bhojpuri (भोजपुरी)"
                                                value={customName}
                                                onChange={(e) => setCustomName(e.target.value)}
                                                className="h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsAddingCustom(false)}
                                            className="h-7 text-xs"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="sm"
                                            className="h-7 text-xs bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                                        >
                                            Add Custom Language
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {/* Search Catalog */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                <Input
                                    placeholder="Search languages (e.g. Punjabi, Telugu, Tamil, Marathi, Spanish)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8.5 h-8.5 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                                />
                            </div>

                            {/* Language Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[230px] overflow-y-auto pr-1">
                                {availableCatalog.length === 0 ? (
                                    <div className="col-span-2 p-6 text-center text-xs text-zinc-500">
                                        No matching un-added languages in catalog.
                                    </div>
                                ) : (
                                    availableCatalog.map((item) => (
                                        <div
                                            key={item.code}
                                            className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-[9px] uppercase border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0"
                                                    >
                                                        {item.code}
                                                    </Badge>
                                                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                                                    {item.nativeName} • {item.region}
                                                </span>
                                            </div>

                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={isPublished}
                                                onClick={() => handleAddLanguage(item)}
                                                className="h-7 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium shrink-0"
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-between sm:justify-between shrink-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        {activeLocales.length} active language{activeLocales.length !== 1 ? "s" : ""} configured
                    </span>
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 h-9 px-4 text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
