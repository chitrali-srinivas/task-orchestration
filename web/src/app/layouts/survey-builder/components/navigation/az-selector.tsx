"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AZOption } from "../../services/mock-surveys";

interface AZSelectorProps {
    azs: AZOption[];
    selectedAzId: string;
    onSelectAz: (azId: string) => void;
    className?: string;
}

export function AZSelector({ azs, selectedAzId, onSelectAz, className }: AZSelectorProps) {
    const [open, setOpen] = useState(false);

    const currentAz = azs.find((az) => az.id === selectedAzId) || azs[0];
    const shortName = currentAz?.name.split(" - ")[1] || currentAz?.name;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-8 px-2.5 text-xs font-normal shadow-2xs transition-colors rounded-md",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
                            {currentAz?.id}
                        </span>
                        <span className="text-zinc-400 shrink-0">•</span>
                        <span className="text-zinc-600 dark:text-zinc-300 truncate">
                            {shortName}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-40 text-zinc-500" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl" align="start">
                <Command className="bg-transparent text-zinc-900 dark:text-zinc-100">
                    <CommandInput placeholder="Search Agricultural Zone..." className="h-8 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                    <CommandList className="max-h-[240px] p-1">
                        <CommandEmpty className="py-3 text-center text-xs text-zinc-500">
                            No zone found.
                        </CommandEmpty>
                        <CommandGroup heading={<span className="text-[10px] uppercase text-zinc-500 font-semibold px-1">Agricultural Zones</span>}>
                            {azs.map((az) => {
                                const isSelected = az.id === selectedAzId;
                                const azShort = az.name.split(" - ")[1] || az.name;
                                return (
                                    <CommandItem
                                        key={az.id}
                                        value={`${az.id} ${az.name} ${az.location}`}
                                        onSelect={() => {
                                            onSelectAz(az.id);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            "flex items-center justify-between px-2.5 py-1.5 cursor-pointer rounded-md text-xs transition-colors",
                                            isSelected
                                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{az.id}</span>
                                                <span className="text-zinc-600 dark:text-zinc-300 truncate">{azShort}</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-400 truncate">
                                                {az.location}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                                        )}
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
