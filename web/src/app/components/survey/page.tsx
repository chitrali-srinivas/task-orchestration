"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { surveyData, SurveyCard, BulkSubmissionCard } from "./SurveyComponents";

// --- Main Page Component ---
export default function SurveyPage() {
    const [currentStyle, setCurrentStyle] = useState<"current" | "style-1" | "style-2" | "style-3" | "style-4" | "style-5" | "style-5-feedback">("current");
    const [showDetails, setShowDetails] = useState(true);

    // Mock submissions for Style 4 (Bulk View)
    const mockSubmissions = [2481, 2480, 2479, 2478, 2477];

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/components">
                            <Button variant="outline" size="icon" className="h-10 w-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Survey Responses</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Review feedback across various data types.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <Link href="/components/preview">
                            <Button variant="secondary" className="gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard Preview
                            </Button>
                        </Link>

                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

                        {/* Visibility Toggle */}
                        {currentStyle !== "style-4" && (
                            <div className="flex items-center space-x-2">
                                <Switch id="show-details" checked={showDetails} onCheckedChange={setShowDetails} />
                                <label htmlFor="show-details" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">Show Usage Details</label>
                            </div>
                        )}

                        {/* Style Selector */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Card Style:</label>
                            <Select value={currentStyle} onValueChange={(val: "current" | "style-1" | "style-2" | "style-3" | "style-4" | "style-5" | "style-5-feedback") => setCurrentStyle(val)}>
                                <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900">
                                    <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current">Current</SelectItem>
                                    <SelectItem value="style-1">Style 1</SelectItem>
                                    <SelectItem value="style-2">Style 2</SelectItem>
                                    <SelectItem value="style-3">Style 3</SelectItem>
                                    <SelectItem value="style-5">Style 5 (Compact)</SelectItem>
                                    <SelectItem value="style-5-feedback">Style 5 (Feedback based)</SelectItem>
                                    <SelectItem value="style-4">Style 4 (Bulk View)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Filters/Grid */}
                <div className={cn(
                    "flex flex-col mx-auto transition-all duration-500",
                    currentStyle === "style-4" ? "max-w-4xl gap-6" : "max-w-3xl",
                    (currentStyle === "style-5" || currentStyle === "style-5-feedback") ? "gap-0" : "gap-6"
                )}>
                    {currentStyle === "style-4" ? (
                        <BulkSubmissionCard submissionId={2481} data={surveyData} showHeader={false} />
                    ) : (
                        surveyData.map((item) => (
                            <SurveyCard key={item.id} item={item} style={currentStyle} showDetails={showDetails} />
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
