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
                <DialogContent className="sm:max-w-[640px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="p-5 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shrink-0">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm shrink-0">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                        Survey Availability & Scheduling
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                                        Configure active collection dates and location windows ({survey.versionTag}).
                                    </DialogDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono font-semibold px-2 py-0.5 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shrink-0">
                                {survey.versionTag}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
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
                                    htmlFor="mode-always-simplified"
                                    className={cn(
                                        "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer select-none",
                                        availability.mode === "always"
                                            ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs font-semibold"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <RadioGroupItem value="always" id="mode-always-simplified" className="mt-0.5 shrink-0" />
                                    <div className="space-y-0.5 min-w-0">
                                        <span className="text-xs block">Always Available</span>
                                        <span className="text-[10px] text-zinc-500 block font-normal">Active across all locations without time limit</span>
                                    </div>
                                </label>

                                <label
                                    htmlFor="mode-scheduled-simplified"
                                    className={cn(
                                        "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer select-none",
                                        availability.mode === "scheduled"
                                            ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 shadow-2xs font-semibold"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <RadioGroupItem value="scheduled" id="mode-scheduled-simplified" className="mt-0.5 shrink-0" />
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
                            <div className="space-y-3 pt-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
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
                                        className="h-8 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 gap-1.5 rounded-lg font-semibold shadow-sm"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add Schedule</span>
                                    </Button>
                                </div>

                                {availability.schedules.length === 0 ? (
                                    <div className="p-8 text-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-2">
                                        <Calendar className="h-8 w-8 mx-auto text-zinc-400 opacity-60" />
                                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No schedules configured</div>
                                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                            Click &quot;Add Schedule&quot; to specify deployment dates and target surveyor locations.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {availability.schedules.map((sch) => {
                                            const status = getScheduleStatus(sch);
                                            return (
                                                <div
                                                    key={sch.id}
                                                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                                                                {sch.title || "Operational Schedule"}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[10px] font-semibold px-2 py-0.5",
                                                                    status === "Active" && "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
                                                                    status === "Upcoming" && "border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
                                                                    (status === "Expired" || status === "Disabled") && "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
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
                                                                className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg"
                                                                title="Edit Schedule"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPublished}
                                                                onClick={() => handleDuplicateSchedule(sch)}
                                                                className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg"
                                                                title="Duplicate Schedule"
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPublished}
                                                                onClick={() => handleDeleteSchedule(sch.id)}
                                                                className="h-7 w-7 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                                                title="Delete Schedule"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Date & Time Range with Timezone */}
                                                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                                                        <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                        <span>{formatScheduleDateRange(sch.startAt, sch.endAt, sch.timezone)}</span>
                                                    </div>

                                                    {/* Audience details */}
                                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
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

                    <DialogFooter className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-end gap-2.5 shrink-0">
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="h-9 px-4 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg shadow-sm"
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
