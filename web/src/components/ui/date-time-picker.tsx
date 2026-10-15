"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export interface DateTimePickerProps {
    value?: string | Date; // ISO string e.g. "2026-09-21T11:29" or Date
    onChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    size?: "default" | "sm";
    disabled?: boolean;
    clearable?: boolean;
    displayFormat?: string; // e.g. "dd-MM-yyyy HH:mm" or "dd MMM yyyy, hh:mm a"
}

export function DateTimePicker({
    value,
    onChange,
    placeholder = "Select date & time",
    className,
    size = "default",
    disabled = false,
    clearable = false,
    displayFormat = "dd-MM-yyyy HH:mm",
}: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false);

    // Parse date & time from value
    const parsedDate = React.useMemo(() => {
        if (!value) return undefined;
        if (value instanceof Date) return isValid(value) ? value : undefined;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return undefined;
            const d = new Date(trimmed);
            if (isValid(d)) return d;
            // Fallback for YYYY-MM-DDTHH:mm
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
                const parts = trimmed.split(/[-T:]/);
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const hours = parseInt(parts[3], 10);
                const mins = parseInt(parts[4], 10);
                const customD = new Date(year, month, day, hours, mins);
                return isValid(customD) ? customD : undefined;
            }
        }
        return undefined;
    }, [value]);

    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsedDate);
    const [hours, setHours] = React.useState<string>(
        parsedDate ? String(parsedDate.getHours()).padStart(2, "0") : "09"
    );
    const [minutes, setMinutes] = React.useState<string>(
        parsedDate ? String(parsedDate.getMinutes()).padStart(2, "0") : "00"
    );

    // Sync when value prop changes externally
    React.useEffect(() => {
        if (parsedDate) {
            setSelectedDate(parsedDate);
            setHours(String(parsedDate.getHours()).padStart(2, "0"));
            setMinutes(String(parsedDate.getMinutes()).padStart(2, "0"));
        } else if (!value) {
            setSelectedDate(undefined);
        }
    }, [value, parsedDate]);

    const emitChange = (date: Date | undefined, h: string, m: string) => {
        if (!date) {
            onChange?.("");
            return;
        }
        const updated = new Date(date);
        updated.setHours(parseInt(h, 10) || 0);
        updated.setMinutes(parseInt(m, 10) || 0);
        updated.setSeconds(0);
        updated.setMilliseconds(0);

        // Format to ISO slice e.g. "YYYY-MM-DDTHH:mm"
        const year = updated.getFullYear();
        const month = String(updated.getMonth() + 1).padStart(2, "0");
        const day = String(updated.getDate()).padStart(2, "0");
        const hh = String(updated.getHours()).padStart(2, "0");
        const mm = String(updated.getMinutes()).padStart(2, "0");
        const isoString = `${year}-${month}-${day}T${hh}:${mm}`;
        onChange?.(isoString);
    };

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        if (date) {
            emitChange(date, hours, minutes);
        } else {
            onChange?.("");
        }
    };

    const handleHourChange = (newHour: string) => {
        setHours(newHour);
        const baseDate = selectedDate || new Date();
        if (!selectedDate) setSelectedDate(baseDate);
        emitChange(baseDate, newHour, minutes);
    };

    const handleMinuteChange = (newMinute: string) => {
        setMinutes(newMinute);
        const baseDate = selectedDate || new Date();
        if (!selectedDate) setSelectedDate(baseDate);
        emitChange(baseDate, hours, newMinute);
    };

    const handleSetNow = () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        setSelectedDate(now);
        setHours(hh);
        setMinutes(mm);
        emitChange(now, hh, mm);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedDate(undefined);
        onChange?.("");
    };

    // Format display string
    const displayString = React.useMemo(() => {
        if (!selectedDate) return null;
        try {
            const combined = new Date(selectedDate);
            combined.setHours(parseInt(hours, 10) || 0);
            combined.setMinutes(parseInt(minutes, 10) || 0);
            return format(combined, displayFormat);
        } catch {
            return null;
        }
    }, [selectedDate, hours, minutes, displayFormat]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal text-left transition-colors cursor-pointer select-none",
                        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs",
                        !displayString && "text-muted-foreground",
                        "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800/80 focus-visible:ring-1",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <CalendarIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                        <span
                            className={cn(
                                "truncate font-medium",
                                !displayString
                                    ? "text-zinc-400 dark:text-zinc-500 font-normal text-xs"
                                    : "text-zinc-900 dark:text-zinc-100 font-mono text-[11px]"
                            )}
                        >
                            {displayString || placeholder}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {clearable && displayString && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={handleClear}
                                className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </span>
                        )}
                        <Clock className="h-3.5 w-3.5 text-zinc-400 opacity-60" />
                    </div>
                </Button>
            </PopoverTrigger>

            <PopoverContent
                className="w-auto p-0 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl bg-white dark:bg-zinc-950 overflow-hidden z-50"
                align="start"
                side="bottom"
                sideOffset={4}
                onWheel={(e) => e.stopPropagation()}
            >
                {/* Calendar Date Section */}
                <div className="p-1 border-b border-zinc-100 dark:border-zinc-800">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                    />
                </div>

                {/* Time Selection Bar */}
                <div className="p-3 bg-zinc-50/80 dark:bg-zinc-900/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            <Clock className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Time (24h)</span>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSetNow}
                            className="h-6 px-2 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                            Set to Current Time
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                        <div className="space-y-0.5 flex-1">
                            <span className="text-[9px] uppercase font-bold text-zinc-400 block text-center">Hours</span>
                            <Select value={hours} onValueChange={handleHourChange}>
                                <SelectTrigger className="h-8 text-xs font-mono font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-center">
                                    <SelectValue>{hours}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-48 text-xs font-mono">
                                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                                        <SelectItem key={h} value={h}>
                                            {h}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <span className="font-bold text-zinc-400 pt-3 text-sm">:</span>

                        <div className="space-y-0.5 flex-1">
                            <span className="text-[9px] uppercase font-bold text-zinc-400 block text-center">Minutes</span>
                            <Select value={minutes} onValueChange={handleMinuteChange}>
                                <SelectTrigger className="h-8 text-xs font-mono font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-center">
                                    <SelectValue>{minutes}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-48 text-xs font-mono">
                                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                                        <SelectItem key={m} value={m}>
                                            :{m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pt-1 flex items-center justify-end">
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="h-7 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg cursor-pointer"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
