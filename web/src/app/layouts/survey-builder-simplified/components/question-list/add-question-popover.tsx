"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { BackendQuestionType } from "../../types/survey-schema";
import { QuestionTypeGrid } from "../common/question-type-grid";

interface AddQuestionPopoverProps {
    onAddQuestion: (type: BackendQuestionType) => void;
    trigger?: React.ReactNode;
}

export function AddQuestionPopover({ onAddQuestion, trigger }: AddQuestionPopoverProps) {
    const [open, setOpen] = useState(false);

    const handleSelectType = (type: BackendQuestionType) => {
        onAddQuestion(type);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {trigger || (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium gap-1.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-none shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Question</span>
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="w-[360px] sm:w-[480px] max-h-[calc(100vh-140px)] flex flex-col p-3 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden z-[150]"
            >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Select Question Type</span>
                </div>

                <QuestionTypeGrid
                    compact
                    columns={2}
                    showSearch={true}
                    showCategories={true}
                    showHelpPopover={true}
                    onSelectType={handleSelectType}
                    className="flex-1 min-h-0 pt-2"
                />
            </PopoverContent>
        </Popover>
    );
}
