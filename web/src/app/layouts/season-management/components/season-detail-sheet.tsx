"use client";

import * as React from "react";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SeasonRecord, SeasonActivity, ActivityType, ActivityStatus, SeasonStatus, DEFAULT_ACTIVITY_TEMPLATES } from "../data/schema";
import { SeasonStatusBadge } from "./season-status-badge";
import {
    Plus,
    Trash2,
    ChevronLeft,
    ChevronRight,
    X,
    Layers,
    MapPin,
    Eye,
    EyeOff,
    Calendar,
    Search,
    Check,
    ChevronsUpDown,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface RowActivitySelectProps {
    currentActivity: string;
    currentType?: ActivityType;
    onSelect: (tpl: { activity: string; activityType: ActivityType }) => void;
}

function RowActivitySelect({
    currentActivity,
    currentType,
    onSelect,
}: RowActivitySelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const getActivityTypeBadgeStyle = (type?: ActivityType) => {
        switch (type) {
            case "Sampling":
                return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
            case "Deployment":
                return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300";
            case "Sowing":
                return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
            case "Engagement":
                return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
            default:
                return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="h-8 w-full flex items-center justify-between gap-2 px-2.5 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors shadow-2xs text-left"
                >
                    <span className="truncate flex-1 min-w-0 font-medium text-xs">
                        {currentActivity || "Select activity..."}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {currentType && (
                            <span
                                className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                                    getActivityTypeBadgeStyle(currentType)
                                )}
                            >
                                {currentType}
                            </span>
                        )}
                        <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400 shrink-0 opacity-70" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions
                collisionPadding={16}
                className="w-72 sm:w-80 p-0 z-[600] max-h-[260px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg overflow-hidden flex flex-col"
            >
                <Command className="bg-transparent text-zinc-900 dark:text-zinc-100 flex flex-col">
                    <CommandInput
                        placeholder="Search activity (e.g. Sampling, Phase 1)..."
                        value={search}
                        onValueChange={setSearch}
                        className="h-9 text-xs shrink-0"
                    />
                    <CommandList className="max-h-[190px] p-1 overflow-y-auto">
                        <CommandEmpty className="py-4 text-center text-xs text-zinc-500">
                            No matching activity found.
                        </CommandEmpty>
                        <CommandGroup heading={<span className="text-[10px] uppercase text-zinc-400 font-bold px-1">Available Activities</span>}>
                            {DEFAULT_ACTIVITY_TEMPLATES.map((tpl) => {
                                const isSelected = currentActivity.toLowerCase() === tpl.activity.toLowerCase();
                                return (
                                    <CommandItem
                                        key={tpl.activity}
                                        value={`${tpl.activity} ${tpl.activityType}`}
                                        onSelect={() => {
                                            onSelect(tpl);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer rounded-md text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {isSelected && (
                                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                                            )}
                                            <span className={cn("font-medium text-zinc-900 dark:text-zinc-100 truncate", isSelected && "font-semibold")}>
                                                {tpl.activity}
                                            </span>
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0",
                                                getActivityTypeBadgeStyle(tpl.activityType)
                                            )}
                                        >
                                            {tpl.activityType}
                                        </span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

interface SeasonDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    season: SeasonRecord | null;
    mode: "create" | "edit";
    onSave: (savedSeason: SeasonRecord) => void;
    onNext?: () => void;
    onPrevious?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
    currentIndex?: number;
    totalCount?: number;
}

const BASES = ["GPM_ANP", "Seoni", "Wheat ERW", "Paddy ERW", "Mati Boost"];
const SEASONS = ["Kharif", "Rabi", "Zaid"];
const AZ_OPTIONS = [
    { label: "AZ1 - paddy ERW", azName: "Paddy ERW" },
    { label: "AZ1 - wheat ERW", azName: "Wheat ERW" },
    { label: "AZ1 - mati boost", azName: "Mati Boost" },
    { label: "AZ2 - paddy ERW", azName: "Paddy ERW" },
    { label: "AZ2 - wheat ERW", azName: "Wheat ERW" },
    { label: "AZ3 - wheat ERW", azName: "Wheat ERW" },
];
const STATUS_OPTIONS: SeasonStatus[] = ["Draft", "Planned", "Inprogress", "Completed", "Cancelled"];
const ACTIVITY_TYPES: ActivityType[] = ["Sampling", "Deployment", "Sowing", "Engagement"];
const ACTIVITY_STATUSES: ActivityStatus[] = ["Planned", "Inprogress", "Completed", "Cancelled"];

export function SeasonDetailSheet({
    open,
    onOpenChange,
    season,
    mode,
    onSave,
    onNext,
    onPrevious,
    isFirst = false,
    isLast = false,
    currentIndex = -1,
    totalCount = 0,
}: SeasonDetailSheetProps) {
    const [formData, setFormData] = React.useState<Partial<SeasonRecord>>({
        id: "",
        seasonName: "",
        season: "Kharif",
        baseName: "",
        country: "",
        azName: "",
        azId: "",
        status: "Draft",
        createdBy: "Aarav Sharma",
        createdAt: "",
        updatedBy: "Aarav Sharma",
        updatedAt: "",
        seasonStart: "",
        seasonEnd: "",
        activities: [],
    });

    React.useEffect(() => {
        const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();

        if (mode === "edit" && season) {
            setFormData({
                ...season,
                season: season.season || "Kharif",
                activities: season.activities ? [...season.activities] : [],
            });
        } else if (mode === "create") {
            // When creating a new season, all form fields and activities are initially empty
            setFormData({
                id: "",
                seasonName: "",
                season: "Kharif",
                baseName: "",
                country: "",
                azName: "",
                azId: "",
                status: "Draft",
                createdBy: "Aarav Sharma",
                createdAt: todayStr,
                updatedBy: "Aarav Sharma",
                updatedAt: todayStr,
                seasonStart: "",
                seasonEnd: "",
                activities: [],
            });
        }
    }, [season, mode, open]);

    const handleFieldChange = (field: keyof SeasonRecord, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleBaseChange = (baseVal: string) => {
        setFormData(prev => ({
            ...prev,
            baseName: baseVal,
            country: prev.country || "India",
        }));
    };

    const [addActivityOpen, setAddActivityOpen] = React.useState(false);
    const [activitySearch, setActivitySearch] = React.useState("");

    const handleAzChange = (azIdValue: string) => {
        const found = AZ_OPTIONS.find(a => a.label === azIdValue);
        setFormData(prev => ({
            ...prev,
            azId: azIdValue,
            azName: found ? found.azName : prev.azName || "",
        }));
    };

    const handleActivityChange = (index: number, field: keyof SeasonActivity, value: any) => {
        setFormData(prev => {
            const updated = [...(prev.activities || [])];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, activities: updated };
        });
    };

    const handleAddActivityFromTemplate = (template: { activity: string; activityType: ActivityType }) => {
        setFormData(prev => {
            const currentList = prev.activities || [];
            const nextIndex = currentList.length + 1;
            const typePrefixes: Record<ActivityType, string> = {
                Sampling: "SRV-SMP",
                Deployment: "SRV-DEP",
                Sowing: "SRV-SOW",
                Engagement: "SRV-ENG",
            };
            const prefix = typePrefixes[template.activityType] || "SRV-ACT";
            const surveyId = `${prefix}-${String(nextIndex).padStart(3, "0")}`;

            const newAct: SeasonActivity = {
                id: `act_${Date.now()}_${nextIndex}`,
                activity: template.activity,
                activityType: template.activityType,
                surveyId,
                activityStart: prev.seasonStart || "",
                activityEnd: prev.seasonEnd || "",
                hidden: 0,
                status: "Planned",
            };

            return {
                ...prev,
                activities: [...currentList, newAct],
            };
        });
        setAddActivityOpen(false);
        setActivitySearch("");
    };


    const handleActivityNameChange = (index: number, newActivityName: string) => {
        const template = DEFAULT_ACTIVITY_TEMPLATES.find(t => t.activity === newActivityName);
        setFormData(prev => {
            const updated = [...(prev.activities || [])];
            const current = updated[index];
            updated[index] = {
                ...current,
                activity: newActivityName,
                activityType: template ? template.activityType : current.activityType,
            };
            return { ...prev, activities: updated };
        });
    };

    const handleRemoveActivity = (index: number) => {
        setFormData(prev => {
            const updated = [...(prev.activities || [])];
            updated.splice(index, 1);
            return { ...prev, activities: updated };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.seasonName?.trim()) return;

        const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();
        const basePrefix = formData.baseName ? formData.baseName.replace(/\s+/g, "_") : "BASE";
        const seasonPrefix = formData.seasonName.trim().replace(/\s+/g, "_");
        const generatedId = formData.id || `${basePrefix}_${seasonPrefix}_${Math.floor(100 + Math.random() * 900)}`;

        const completeRecord: SeasonRecord = {
            id: generatedId,
            seasonName: formData.seasonName.trim(),
            season: formData.season || "Kharif",
            baseName: formData.baseName || "GPM_ANP",
            country: formData.country || "India",
            azName: formData.azName || "Paddy ERW",
            azId: formData.azId || "AZ1 - paddy ERW",
            status: (formData.status as SeasonStatus) || "Draft",
            createdBy: formData.createdBy || "Aarav Sharma",
            createdAt: formData.createdAt || todayStr,
            updatedBy: "Aarav Sharma",
            updatedAt: todayStr,
            seasonStart: formData.seasonStart || "2026-03-01",
            seasonEnd: formData.seasonEnd || "2027-02-28",
            activities: formData.activities || [],
        };

        onSave(completeRecord);
        onOpenChange(false);
    };

    const activitiesList = formData.activities || [];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{ width: "65vw", maxWidth: "65vw" }}
                className="w-[65vw] max-w-[65vw] sm:max-w-[65vw] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[200] transition-all duration-300 ease-in-out focus-visible:outline-none"
            >
                {/* Dynamic Reactive Header Section */}
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
                    <div className="px-6 py-4">
                        <div className="flex items-start justify-between">
                            <div className="text-left min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <SheetTitle className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight truncate">
                                        {mode === "create" ? (formData.seasonName?.trim() || "Create New Season") : (formData.seasonName || "Season Details")}
                                    </SheetTitle>
                                    {mode === "create" && (
                                        <Badge variant="outline" className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700">
                                            New
                                        </Badge>
                                    )}
                                </div>
                                <SheetDescription asChild>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-medium">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                        <span>
                                            {formData.baseName
                                                ? `${formData.baseName}${formData.country ? `, ${formData.country}` : ", India"}`
                                                : (mode === "create" ? "Select base & zone to configure location" : "India")}
                                        </span>
                                        {formData.id ? (
                                            <>
                                                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                <span className="font-mono text-zinc-600 dark:text-zinc-400 font-semibold">{formData.id}</span>
                                            </>
                                        ) : null}
                                    </div>
                                </SheetDescription>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 h-12 justify-center">
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {formData.status ? (
                                    <SeasonStatusBadge status={formData.status as SeasonStatus} />
                                ) : (
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-zinc-400 border-zinc-200">
                                        Draft
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sub-header Details Bar (Revises Reactively Based on Filled Values) */}
                    <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-2 truncate">
                            {formData.baseName ? (
                                <>
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formData.baseName}</span>
                                    {formData.azName && (
                                        <>
                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                            <span>{formData.azName}</span>
                                        </>
                                    )}
                                    {formData.azId && (
                                        <>
                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                            <span className="font-mono text-zinc-500">{formData.azId}</span>
                                        </>
                                    )}
                                </>
                            ) : (
                                <span className="text-zinc-400 italic">Fill in Season Parameters below to configure</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                            <span>Created: <strong className="font-medium text-zinc-700 dark:text-zinc-300">{formData.createdAt || "Today"}</strong></span>
                            <span>•</span>
                            <span>Updated: <strong className="font-medium text-zinc-700 dark:text-zinc-300">{formData.updatedAt || "Today"}</strong></span>
                            <span>•</span>
                            <span>By: <strong className="font-medium text-zinc-700 dark:text-zinc-300">{formData.createdBy || "Aarav Sharma"}</strong></span>
                        </div>
                    </div>
                </div>

                {/* Form & Scrollable Body */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <ScrollArea className="flex-1 relative">
                        <div className="p-6 space-y-6">
                            {/* Section 1: Season Parameters with Clean, Spaced Layout */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                        Season Parameters
                                    </h4>
                                </div>

                                <div className="space-y-4 pt-3 pb-1">
                                    {/* Row 1: Season Name (50%), Season (25%), Status (25%) filling 100% width */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div 
                                            className="col-span-2 sm:col-span-2 md:col-span-2 flex flex-col gap-1.5 min-w-0"
                                            style={{ gridColumn: "span 2 / span 2" }}
                                        >
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Season Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                value={formData.seasonName || ""}
                                                onChange={(e) => handleFieldChange("seasonName", e.target.value)}
                                                placeholder="e.g. Kharif_GPM_2026"
                                                className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs focus-visible:ring-1 w-full"
                                                required
                                            />
                                        </div>

                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Season
                                            </Label>
                                            <Select
                                                value={formData.season || "Kharif"}
                                                onValueChange={(val) => handleFieldChange("season", val)}
                                            >
                                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs w-full">
                                                    <SelectValue placeholder="Select season..." />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    {SEASONS.map((s) => (
                                                        <SelectItem key={s} value={s} className="text-xs">
                                                            {s}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Status
                                            </Label>
                                            <Select
                                                value={formData.status || "Draft"}
                                                onValueChange={(val) => handleFieldChange("status", val)}
                                            >
                                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs w-full">
                                                    <SelectValue placeholder="Select status..." />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    {STATUS_OPTIONS.map((st) => (
                                                        <SelectItem key={st} value={st} className="text-xs">
                                                            {st}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Row 2: Base (25%), AZ ID & Zone (25%), Start Date (25%), End Date (25%) filling 100% width */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Base
                                            </Label>
                                            <Select
                                                value={formData.baseName || ""}
                                                onValueChange={handleBaseChange}
                                            >
                                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs w-full">
                                                    <SelectValue placeholder="Select base..." />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    {BASES.map((b) => (
                                                        <SelectItem key={b} value={b} className="text-xs">
                                                            {b}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                AZ ID & Zone
                                            </Label>
                                            <Select
                                                value={formData.azId || ""}
                                                onValueChange={handleAzChange}
                                            >
                                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs w-full">
                                                    <SelectValue placeholder="Select zone..." />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    {AZ_OPTIONS.map((az) => (
                                                        <SelectItem key={az.label} value={az.label} className="text-xs">
                                                            {az.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Start Date
                                            </Label>
                                            <DatePicker
                                                value={formData.seasonStart || ""}
                                                onChange={(val) => handleFieldChange("seasonStart", val)}
                                                placeholder="Select start date..."
                                                className="h-9 w-full"
                                            />
                                        </div>

                                        <div className="sm:col-span-1 md:col-span-1 flex flex-col gap-1.5 min-w-0">
                                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                End Date
                                            </Label>
                                            <DatePicker
                                                value={formData.seasonEnd || ""}
                                                onChange={(val) => handleFieldChange("seasonEnd", val)}
                                                placeholder="Select end date..."
                                                className="h-9 w-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Activity Schedule in Compact Table Format */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                            Activity Schedule
                                        </h4>
                                        <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0">
                                            {activitiesList.length}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Searchable Activity Dropdown */}
                                        <Popover open={addActivityOpen} onOpenChange={setAddActivityOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs font-semibold gap-1.5 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Add activity
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="end"
                                                side="bottom"
                                                sideOffset={4}
                                                avoidCollisions
                                                collisionPadding={16}
                                                className="w-80 p-0 z-[600] max-h-[260px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg overflow-hidden flex flex-col"
                                            >
                                                <Command className="bg-transparent text-zinc-900 dark:text-zinc-100 flex flex-col">
                                                    <CommandInput
                                                        placeholder="Search activity (e.g. Sampling, Phase 1)..."
                                                        value={activitySearch}
                                                        onValueChange={setActivitySearch}
                                                        className="h-9 text-xs shrink-0"
                                                    />
                                                    <CommandList className="max-h-[190px] p-1 overflow-y-auto">
                                                        <CommandEmpty className="py-4 text-center text-xs text-zinc-500">
                                                            No matching activity found.
                                                        </CommandEmpty>

                                                        <CommandGroup heading={<span className="text-[10px] uppercase text-zinc-400 font-bold px-1">Available Activities</span>}>
                                                            {DEFAULT_ACTIVITY_TEMPLATES.map((tpl) => {
                                                                const isAlreadyAdded = activitiesList.some(a => a.activity.toLowerCase() === tpl.activity.toLowerCase());
                                                                return (
                                                                    <CommandItem
                                                                        key={tpl.activity}
                                                                        value={`${tpl.activity} ${tpl.activityType}`}
                                                                        onSelect={() => handleAddActivityFromTemplate(tpl)}
                                                                        className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer rounded-md text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                                                                    >
                                                                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                                            {tpl.activity}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span className={cn(
                                                                                "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                                                                                tpl.activityType === "Sampling" && "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
                                                                                tpl.activityType === "Deployment" && "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
                                                                                tpl.activityType === "Sowing" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                                                                                tpl.activityType === "Engagement" && "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                                                            )}>
                                                                                {tpl.activityType}
                                                                            </span>
                                                                            {isAlreadyAdded && (
                                                                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-zinc-400 border-zinc-200">
                                                                                    Added
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {activitiesList.length === 0 ? (
                                    /* Clean Empty State without extra buttons */
                                    <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center bg-zinc-50/40 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-2">
                                        <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-1">
                                            <Layers className="h-4.5 w-4.5 text-zinc-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                            No activities added yet
                                        </p>
                                        <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
                                            Click the <span className="font-semibold text-zinc-700 dark:text-zinc-300">"+ Add activity"</span> button above to search and select activities for this season schedule.
                                        </p>
                                    </div>
                                ) : (
                                    /* Populated Activity Table Layout */
                                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto bg-white dark:bg-zinc-900/40">
                                        <Table className="w-full min-w-[860px] text-xs">
                                            <colgroup>
                                                <col style={{ width: "40px" }} />
                                                <col style={{ width: "240px" }} />
                                                <col style={{ width: "140px" }} />
                                                <col style={{ width: "125px" }} />
                                                <col style={{ width: "125px" }} />
                                                <col style={{ width: "56px" }} />
                                                <col style={{ width: "115px" }} />
                                                <col style={{ width: "40px" }} />
                                            </colgroup>
                                            <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/80">
                                                <TableRow className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
                                                    <TableHead className="w-10 min-w-[40px] text-center py-2.5 px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">#</TableHead>
                                                    <TableHead className="w-[240px] min-w-[200px] py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Activity</TableHead>
                                                    <TableHead className="w-[140px] min-w-[140px] py-2.5 px-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Survey ID</TableHead>
                                                    <TableHead className="w-[125px] min-w-[125px] py-2.5 px-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Start Date</TableHead>
                                                    <TableHead className="w-[125px] min-w-[125px] py-2.5 px-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">End Date</TableHead>
                                                    <TableHead className="w-14 min-w-[56px] text-center py-2.5 px-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Hidden</TableHead>
                                                    <TableHead className="w-[115px] min-w-[115px] py-2.5 px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Status</TableHead>
                                                    <TableHead className="w-10 min-w-[40px] text-center py-2.5 px-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activitiesList.map((act, index) => (
                                                    <TableRow
                                                        key={act.id || index}
                                                        className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60 transition-colors"
                                                    >
                                                        <TableCell className="w-10 min-w-[40px] text-center py-2 px-2 font-mono text-[11px] font-semibold text-zinc-400">
                                                            {index + 1}
                                                        </TableCell>
                                                        <TableCell className="w-[240px] min-w-[200px] py-2 px-3">
                                                            <RowActivitySelect
                                                                currentActivity={act.activity || ""}
                                                                currentType={act.activityType}
                                                                onSelect={(tpl) => handleActivityNameChange(index, tpl.activity)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="w-[140px] min-w-[140px] py-2 px-2.5">
                                                            <Input
                                                                value={act.surveyId}
                                                                onChange={(e) => handleActivityChange(index, "surveyId", e.target.value)}
                                                                className="h-8 w-full min-w-[125px] text-xs font-mono font-medium bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800 px-2.5"
                                                                placeholder="SRV-001"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="w-[125px] min-w-[125px] py-2 px-1.5">
                                                            <DatePicker
                                                                value={act.activityStart || ""}
                                                                onChange={(val) => handleActivityChange(index, "activityStart", val)}
                                                                placeholder="Start date"
                                                                size="sm"
                                                                className="w-full h-8 text-[11px] px-2"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="w-[125px] min-w-[125px] py-2 px-1.5">
                                                            <DatePicker
                                                                value={act.activityEnd || ""}
                                                                onChange={(val) => handleActivityChange(index, "activityEnd", val)}
                                                                placeholder="End date"
                                                                size="sm"
                                                                className="w-full h-8 text-[11px] px-2"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="w-14 min-w-[56px] text-center py-2 px-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleActivityChange(index, "hidden", act.hidden === 1 ? 0 : 1)}
                                                                className={cn(
                                                                    "h-6.5 px-2 rounded text-[11px] font-semibold border transition-colors inline-flex items-center gap-1",
                                                                    act.hidden === 1
                                                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                                                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 hover:bg-zinc-100"
                                                                )}
                                                                title={act.hidden === 1 ? "Activity is hidden" : "Activity is visible"}
                                                            >
                                                                {act.hidden === 1 ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                                <span>{act.hidden === 1 ? "1" : "0"}</span>
                                                            </button>
                                                        </TableCell>
                                                        <TableCell className="w-[115px] min-w-[115px] py-2 px-2">
                                                            <Select
                                                                value={act.status || "Planned"}
                                                                onValueChange={(val) => handleActivityChange(index, "status", val)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800 px-2">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="z-[300]">
                                                                    {ACTIVITY_STATUSES.map((st) => (
                                                                        <SelectItem key={st} value={st} className="text-xs">
                                                                            {st}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="w-10 min-w-[40px] text-center py-2 px-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded"
                                                                onClick={() => handleRemoveActivity(index)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer Section */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 flex flex-col relative shrink-0">
                        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                            {/* Left: Navigation Controls (Only visible in Edit mode) */}
                            {mode === "edit" ? (
                                <div className="flex items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onPrevious}
                                        disabled={isFirst || !onPrevious}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex >= 0 && totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : "1 / 1"}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onNext}
                                        disabled={isLast || !onNext}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div />
                            )}

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="h-8 px-3 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-8 px-4 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm font-semibold"
                                >
                                    {mode === "create" ? "Create Season" : "Save Changes"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
