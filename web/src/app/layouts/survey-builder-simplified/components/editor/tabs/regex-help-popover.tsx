"use client";

import React from "react";
import { HelpCircle, Code2 } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function RegexHelpPopover() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1 font-medium cursor-pointer"
                >
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Regex Help</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="left"
                align="start"
                className="w-80 sm:w-96 p-4 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl space-y-3"
            >
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <Code2 className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Regular Expression Syntax Guide
                    </h4>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">^</span> = Start of input</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">$</span> = End of input</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">\d</span> = Any digit (0-9)</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">[A-Z]</span> = Uppercase letter</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">[a-z]</span> = Lowercase letter</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">+</span> = One or more</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">*</span> = Zero or more</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">?</span> = Optional (0 or 1)</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">{"{n}"}</span> = Exactly n times</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">{"{n,m}"}</span> = Between n and m</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">(...)</span> = Group</div>
                        <div><span className="font-bold text-zinc-900 dark:text-zinc-100">|</span> = Logical OR</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 text-[11px]">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 block">Example:</span>
                        <code className="text-[11px] font-mono font-bold text-zinc-900 dark:text-zinc-100 block">
                            ^[A-Z]{"{4}"}$
                        </code>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Meaning: Exactly 4 uppercase letters.
                        </p>
                        <div className="flex items-center gap-2 pt-1 font-mono text-[10px]">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">ABCD → Valid</span>
                            <span>•</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">ABC1 / ABCDE → Invalid</span>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
