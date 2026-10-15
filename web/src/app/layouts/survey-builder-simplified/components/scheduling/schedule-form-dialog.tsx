"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Users, Globe, AlertCircle } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { AvailabilitySchedule } from "../../types/survey-schema";
import {
    AVAILABLE_BASES,
    AVAILABLE_VILLAGES,
    AVAILABLE_SURVEYORS,
    AVAILABLE_TIMEZONES,
} from "../../lib/scheduling-engine";

interface ScheduleFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialSchedule?: AvailabilitySchedule | null;
    onSaveSchedule: (schedule: AvailabilitySchedule) => void;
}

export function ScheduleFormDialog({
    open,
    onOpenChange,
    initialSchedule,
    onSaveSchedule,
}: ScheduleFormDialogProps) {
    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [timezone, setTimezone] = useState("Asia/Kolkata");
    const [allLocations, setAllLocations] = useState(true);
    const [selectedBases, setSelectedBases] = useState<string[]>([]);
    const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
    const [selectedSurveyors, setSelectedSurveyors] = useState<string[]>([]);
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Populate on edit
    useEffect(() => {
        if (initialSchedule) {
            setTitle(initialSchedule.title || "");
            setStartAt(initialSchedule.startAt || "");
            setEndAt(initialSchedule.endAt || "");
            setTimezone(initialSchedule.timezone || "Asia/Kolkata");
            setAllLocations(initialSchedule.scope.allLocations);
            setSelectedBases(initialSchedule.scope.baseIds || []);
            setSelectedVillages(initialSchedule.scope.villageIds || []);
            setSelectedSurveyors(initialSchedule.scope.surveyorIds || []);
            setNotes(initialSchedule.notes || "");
        } else {
            // Defaults for new schedule
            const now = new Date();
            const startIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
            const endIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
            setTitle("Operational Schedule Phase 1");
            setStartAt(startIso);
            setEndAt(endIso);
            setTimezone("Asia/Kolkata");
            setAllLocations(true);
            setSelectedBases([]);
            setSelectedVillages([]);
            setSelectedSurveyors([]);
            setNotes("");
        }
        setError(null);
    }, [initialSchedule, open]);

    // Filter villages and surveyors by selected bases if specific bases are chosen
    const filteredVillages = React.useMemo(() => {
        if (selectedBases.length === 0) return AVAILABLE_VILLAGES;
        return AVAILABLE_VILLAGES.filter((v) => selectedBases.includes(v.baseId));
    }, [selectedBases]);

    const filteredSurveyors = React.useMemo(() => {
        if (selectedBases.length === 0) return AVAILABLE_SURVEYORS;
        return AVAILABLE_SURVEYORS.filter((s) => selectedBases.includes(s.baseId));
    }, [selectedBases]);

    const handleSave = () => {
        if (!startAt || !endAt) {
            setError("Both start date and end date are required.");
            return;
        }

        if (new Date(startAt) >= new Date(endAt)) {
            setError("End date and time must be after start date and time.");
            return;
        }

        if (!allLocations && selectedBases.length === 0 && selectedVillages.length === 0 && selectedSurveyors.length === 0) {
            setError("Please select at least one Base, Village, or Surveyor when targeting specific locations.");
            return;
        }

        const schedule: AvailabilitySchedule = {
            id: initialSchedule?.id || `sch_${Date.now()}`,
            title: title.trim() || "Operational Schedule",
            startAt,
            endAt,
            timezone,
            scope: {
                allLocations,
                baseIds: allLocations ? undefined : selectedBases,
                villageIds: allLocations ? undefined : selectedVillages,
                surveyorIds: allLocations ? undefined : selectedSurveyors,
            },
            notes: notes.trim() || undefined,
        };

        onSaveSchedule(schedule);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900">
                            <Clock className="h-4 w-4" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                {initialSchedule ? "Edit Availability Schedule" : "Add Availability Schedule"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Set operational date windows and geographic location boundaries.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-5 space-y-4 text-xs max-h-[65vh] overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Schedule Title / Purpose
                        </Label>
                        <Input
                            placeholder="e.g. Kharif Harvest Window - Raichur Cluster"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    {/* Unified Shadcn DateTimePickers */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-zinc-500" /> Start Date & Time
                            </Label>
                            <DateTimePicker
                                value={startAt}
                                onChange={setStartAt}
                                placeholder="Select start date & time"
                                size="sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-zinc-500" /> End Date & Time
                            </Label>
                            <DateTimePicker
                                value={endAt}
                                onChange={setEndAt}
                                placeholder="Select end date & time"
                                size="sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-zinc-500" /> Timezone
                        </Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                {AVAILABLE_TIMEZONES.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location Audience Scope with Shadcn RadioGroup */}
                    <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Availability Audience & Locations
                        </Label>

                        <RadioGroup
                            value={allLocations ? "all" : "specific"}
                            onValueChange={(v) => setAllLocations(v === "all")}
                            className="flex items-center gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="loc-all-simplified" />
                                <Label htmlFor="loc-all-simplified" className="text-xs font-medium cursor-pointer">
                                    All Locations
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="specific" id="loc-specific-simplified" />
                                <Label htmlFor="loc-specific-simplified" className="text-xs font-medium cursor-pointer">
                                    Specific Locations & Staff
                                </Label>
                            </div>
                        </RadioGroup>

                        {!allLocations && (
                            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                {/* Bases Selector */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                                        Target Operational Bases ({selectedBases.length} selected)
                                    </Label>
                                    <ScrollArea className="h-28 pr-2">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {AVAILABLE_BASES.map((b) => {
                                                const checked = selectedBases.includes(b.id);
                                                return (
                                                    <Label
                                                        key={b.id}
                                                        className="flex items-center gap-2 p-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors font-normal"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(c) => {
                                                                if (c) setSelectedBases([...selectedBases, b.id]);
                                                                else setSelectedBases(selectedBases.filter((id) => id !== b.id));
                                                            }}
                                                        />
                                                        <span className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{b.name}</span>
                                                    </Label>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Villages Selector (Hierarchical) */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                                        Target Revenue Villages ({selectedVillages.length} selected)
                                    </Label>
                                    <ScrollArea className="h-28 pr-2">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {filteredVillages.map((v) => {
                                                const checked = selectedVillages.includes(v.id);
                                                return (
                                                    <Label
                                                        key={v.id}
                                                        className="flex items-center gap-2 p-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors font-normal"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(c) => {
                                                                if (c) setSelectedVillages([...selectedVillages, v.id]);
                                                                else setSelectedVillages(selectedVillages.filter((id) => id !== v.id));
                                                            }}
                                                        />
                                                        <span className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{v.name}</span>
                                                    </Label>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Surveyors Selector */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                                        Assigned Field Surveyors ({selectedSurveyors.length} selected)
                                    </Label>
                                    <ScrollArea className="h-28 pr-2">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {filteredSurveyors.map((s) => {
                                                const checked = selectedSurveyors.includes(s.id);
                                                return (
                                                    <Label
                                                        key={s.id}
                                                        className="flex items-center gap-2 p-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors font-normal"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(c) => {
                                                                if (c) setSelectedSurveyors([...selectedSurveyors, s.id]);
                                                                else setSelectedSurveyors(selectedSurveyors.filter((id) => id !== s.id));
                                                            }}
                                                        />
                                                        <span className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{s.name}</span>
                                                    </Label>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="h-8 px-3 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSave}
                        className="h-8 px-3.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer shadow-xs"
                    >
                        {initialSchedule ? "Save Changes" : "Add Schedule"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
