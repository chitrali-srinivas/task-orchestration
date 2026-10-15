"use client";

import React, { useState } from "react";
import {
    Clock,
    Plus,
    Calendar,
    MapPin,
    AlertTriangle,
    Copy,
    Trash2,
    Edit2,
    Globe,
    CheckCircle2,
    Lock,
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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    AvailabilityMode,
    AvailabilitySchedule,
    SurveyAvailabilityConfig,
    SurveyModel,
} from "../../types/survey-schema";
import {
    checkScheduleOverlap,
    formatScheduleDateRange,
    getScheduleStatus,
} from "../../lib/scheduling-engine";
import { ScheduleFormDialog } from "./schedule-form-dialog";

interface AvailabilityManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey: SurveyModel;
    onUpdateAvailability: (config: SurveyAvailabilityConfig) => void;
    isPublished?: boolean;
}

export function AvailabilityManagerDialog({
    open,
    onOpenChange,
    survey,
    onUpdateAvailability,
    isPublished = false,
}: AvailabilityManagerDialogProps) {
    const availability: SurveyAvailabilityConfig = survey.availability || {
        mode: "always",
        schedules: [],
    };

    const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<AvailabilitySchedule | null>(null);

    const overlapResult = React.useMemo(() => {
        return checkScheduleOverlap(availability.schedules);
    }, [availability.schedules]);

    const handleModeChange = (mode: AvailabilityMode) => {
        onUpdateAvailability({
            ...availability,
            mode,
        });
    };

    const handleSaveSchedule = (schedule: AvailabilitySchedule) => {
        const existingIdx = availability.schedules.findIndex((s) => s.id === schedule.id);
        let updatedList: AvailabilitySchedule[];
        if (existingIdx >= 0) {
            updatedList = availability.schedules.map((s) => (s.id === schedule.id ? schedule : s));
        } else {
            updatedList = [...availability.schedules, schedule];
        }
        onUpdateAvailability({
            ...availability,
            schedules: updatedList,
        });
    };

    const handleDeleteSchedule = (scheduleId: string) => {
        onUpdateAvailability({
            ...availability,
            schedules: availability.schedules.filter((s) => s.id !== scheduleId),
        });
    };

    const handleDuplicateSchedule = (schedule: AvailabilitySchedule) => {
        const duplicated: AvailabilitySchedule = {
            ...JSON.parse(JSON.stringify(schedule)),
            id: `sch_${Date.now()}`,
            title: `${schedule.title || "Schedule"} (Copy)`,
        };
        onUpdateAvailability({
            ...availability,
            schedules: [...availability.schedules, duplicated],
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[620px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <div>
                                    <DialogTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                        Survey Availability & Scheduling
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Configure active collection dates and location windows ({survey.versionTag}).
                                    </DialogDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                                {survey.versionTag}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                        {/* 1. Mode Selector */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Availability Mode
                            </span>
                            <RadioGroup
                                value={availability.mode}
                                onValueChange={(v) => handleModeChange(v as AvailabilityMode)}
                                disabled={isPublished}
                                className="grid grid-cols-2 gap-3"
                            >
                                <label
                                    htmlFor="mode-always"
                                    className={cn(
                                        "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer select-none",
                                        availability.mode === "always"
                                            ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs font-semibold"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <RadioGroupItem value="always" id="mode-always" className="mt-0.5 shrink-0" />
                                    <div className="space-y-0.5 min-w-0">
                                        <span className="text-xs block">Always Available</span>
                                        <span className="text-[10px] text-zinc-500 block font-normal">Active across all locations without time limit</span>
                                    </div>
                                </label>

                                <label
                                    htmlFor="mode-scheduled"
                                    className={cn(
                                        "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer select-none",
                                        availability.mode === "scheduled"
                                            ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs font-semibold"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <RadioGroupItem value="scheduled" id="mode-scheduled" className="mt-0.5 shrink-0" />
                                    <div className="space-y-0.5 min-w-0">
                                        <span className="text-xs block">Scheduled Availability</span>
                                        <span className="text-[10px] text-zinc-500 block font-normal">Strict time windows and location boundaries</span>
                                    </div>
                                </label>
                            </RadioGroup>
                        </div>

                        {/* 2. Overlap Warning Banner */}
                        {availability.mode === "scheduled" && overlapResult.hasOverlap && (
                            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>{overlapResult.warningMessage}</span>
                            </div>
                        )}

                        {/* 3. Schedules List */}
                        {availability.mode === "scheduled" && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                        Configured Schedules ({availability.schedules.length})
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={isPublished}
                                        onClick={() => {
                                            setEditingSchedule(null);
                                            setScheduleFormOpen(true);
                                        }}
                                        className="h-7 px-2.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add Schedule</span>
                                    </Button>
                                </div>

                                {availability.schedules.length === 0 ? (
                                    <div className="p-8 text-center rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
                                        <Clock className="h-8 w-8 text-zinc-400 mx-auto" />
                                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Schedules Configured</p>
                                        <p className="text-[11px] text-zinc-500">
                                            Add a schedule to restrict survey start dates and target specific locations.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {availability.schedules.map((sch, idx) => {
                                            const status = getScheduleStatus(sch);
                                            const isOverlapping = overlapResult.overlappingScheduleIds.includes(sch.id);

                                            return (
                                                <div
                                                    key={sch.id}
                                                    className={cn(
                                                        "p-3.5 rounded-lg border bg-white dark:bg-zinc-900 text-xs transition-all space-y-2",
                                                        isOverlapping
                                                            ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/20"
                                                            : "border-zinc-200 dark:border-zinc-800 shadow-2xs"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                                {sch.title || `Schedule ${idx + 1}`}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[10px] font-semibold",
                                                                    status === "Active" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
                                                                    status === "Upcoming" && "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800",
                                                                    status === "Expired" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                                                )}
                                                            >
                                                                {status}
                                                            </Badge>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPublished}
                                                                onClick={() => {
                                                                    setEditingSchedule(sch);
                                                                    setScheduleFormOpen(true);
                                                                }}
                                                                className="h-6 w-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                                title="Edit Schedule"
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPublished}
                                                                onClick={() => handleDuplicateSchedule(sch)}
                                                                className="h-6 w-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                                title="Duplicate Schedule"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPublished}
                                                                onClick={() => handleDeleteSchedule(sch.id)}
                                                                className="h-6 w-6 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                                title="Delete Schedule"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Date & Time Range with Timezone */}
                                                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                                                        <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                        <span>{formatScheduleDateRange(sch.startAt, sch.endAt, sch.timezone)}</span>
                                                    </div>

                                                    {/* Audience details */}
                                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                                        <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                        <span>
                                                            {sch.scope.allLocations
                                                                ? "All Bases & Villages"
                                                                : `${sch.scope.baseIds?.length || 0} Bases • ${sch.scope.villageIds?.length || 0} Villages • ${sch.scope.surveyorIds?.length || 0} Surveyors`}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="h-8 px-4 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Schedule Form Modal */}
            <ScheduleFormDialog
                open={scheduleFormOpen}
                onOpenChange={setScheduleFormOpen}
                initialSchedule={editingSchedule}
                onSaveSchedule={handleSaveSchedule}
            />
        </>
    );
}
