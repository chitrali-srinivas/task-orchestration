"use client";

import React from "react";
import { Globe, RotateCcw, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LocaleDefinition } from "../../types/survey-schema";

interface PreviewControlsProps {
    locales: LocaleDefinition[];
    currentLocale: string;
    onSelectLocale: (code: string) => void;
    onResetData: () => void;
    onToggleTestDrawer: () => void;
    isTestDrawerOpen?: boolean;
}

export function PreviewControls({
    locales,
    currentLocale,
    onSelectLocale,
    onResetData,
    onToggleTestDrawer,
    isTestDrawerOpen,
}: PreviewControlsProps) {
    const activeLocale = locales.find((l) => l.code === currentLocale) || locales[0];

    return (
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs shrink-0">
            {/* Language Switcher */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1.5 font-medium rounded-lg"
                    >
                        <Globe className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                        <span>{activeLocale?.label}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs shadow-xl">
                    <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 font-semibold">
                        Preview Language
                    </DropdownMenuLabel>
                    {locales.map((loc) => (
                        <DropdownMenuItem
                            key={loc.code}
                            onClick={() => onSelectLocale(loc.code)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <span>{loc.label}</span>
                            {loc.code === currentLocale && (
                                <Badge variant="outline" className="text-[9px] border-zinc-300 dark:border-zinc-700 font-mono">
                                    Active
                                </Badge>
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Test Data & Reset Actions */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleTestDrawer}
                    className="h-8 px-2.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1 rounded-lg"
                >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span className="hidden sm:inline">Test Values</span>
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetData}
                    className="h-8 px-2 text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    title="Reset all preview respondent inputs"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
