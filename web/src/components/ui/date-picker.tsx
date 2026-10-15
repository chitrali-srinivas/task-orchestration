"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
    value?: string | Date;
    onChange?: (dateStr: string) => void;
    placeholder?: string;
    className?: string;
    size?: "default" | "sm";
    disabled?: boolean;
    clearable?: boolean;
    displayFormat?: string; // default "dd-MM-yyyy"
    valueFormat?: string;   // default "yyyy-MM-dd"
}

export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    className,
    size = "default",
    disabled = false,
    clearable,
    displayFormat = "dd-MM-yyyy",
    valueFormat = "yyyy-MM-dd",
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    // Parse incoming value to a valid Date object
    const selectedDate = React.useMemo(() => {
        if (!value) return undefined;
        if (value instanceof Date) return isValid(value) ? value : undefined;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return undefined;
            // Check yyyy-MM-dd
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const [y, m, d] = trimmed.split("-").map(Number);
                const parsed = new Date(y, m - 1, d);
                return isValid(parsed) ? parsed : undefined;
            }
            // Check dd-MM-yyyy
            if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
                const [d, m, y] = trimmed.split("-").map(Number);
                const parsed = new Date(y, m - 1, d);
                return isValid(parsed) ? parsed : undefined;
            }
            const fallback = new Date(trimmed);
            return isValid(fallback) ? fallback : undefined;
        }
        return undefined;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
        if (!date) {
            onChange?.("");
        } else {
            onChange?.(format(date, valueFormat));
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal text-left transition-colors",
                        size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3 text-xs",
                        !selectedDate && "text-muted-foreground",
                        "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-visible:ring-1",
                        className
                    )}
                >
                    <span className="truncate">
                        {selectedDate ? format(selectedDate, displayFormat) : placeholder}
                    </span>
                    <CalendarIcon className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg bg-white dark:bg-zinc-950 overflow-hidden"
                align="start"
                side="bottom"
                sideOffset={4}
                onWheel={(e) => e.stopPropagation()}
            >
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
