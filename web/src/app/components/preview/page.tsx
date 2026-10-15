"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    Search,
    ChevronDown,
    Calendar,
    MapPin,
    MessageSquare,
    Clock,
    Filter,
    MoreHorizontal,
    ChevronRight,
    Map,
    Check,
    CheckCircle2,
    AlertCircle,
    X
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { surveyData, SurveyCard, BulkSubmissionCard } from "../survey/SurveyComponents";

export default function DashboardPreviewPage() {
    const [selectedFarmer, setSelectedFarmer] = useState("Farmer A");
    const [currentStyle, setCurrentStyle] = useState<"style-1" | "style-2" | "style-3" | "style-4" | "style-5" | "style-5-feedback" | "current">("style-3");
    const [isReporting, setIsReporting] = useState(false);
    const [reportedIds, setReportedIds] = useState<string[]>([]);

    const toggleReporting = () => {
        setIsReporting(!isReporting);
        if (isReporting) setReportedIds([]);
    };

    const toggleReportId = (id: string) => {
        setReportedIds(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const toggleAllReport = () => {
        if (reportedIds.length === surveyData.length) {
            setReportedIds([]);
        } else {
            setReportedIds(surveyData.map(d => d.id));
        }
    };

    const farmers = [
        { name: "Farmer A", location: "Village A", status: "pending" },
        { name: "Farmer B", location: "Village A", status: "verified" },
        { name: "Farmer C", location: "Village A", status: "rejected" },
        { name: "Farmer D", location: "Village A", status: "pending" },
        { name: "Farmer E", location: "Village A", status: "pending" },
        { name: "Farmer F", location: "Village A", status: "verified" },
        { name: "Farmer G", location: "Village A", status: "pending" },
        { name: "Farmer H", location: "Village B", status: "pending" },
        { name: "Farmer I", location: "Village B", status: "pending" },
    ];

    return (
        <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
            {/* --- Top Navigation --- */}
            <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 flex-shrink-0 z-20">
                <div className="flex items-center gap-8">
                    {/* Logo Placeholder */}
                    <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center text-white font-bold">M</div>

                    <nav className="flex items-center gap-6">
                        <Link href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">Qualification</Link>
                        <Link href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">Deployment</Link>
                        <Link href="#" className="text-sm font-bold text-zinc-900 dark:text-zinc-50 border-b-2 border-zinc-900 dark:border-zinc-50 py-4">Engagement</Link>
                        <Link href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">Conversation</Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                        <Input type="text" placeholder="Search..." className="pl-9 h-9 bg-zinc-100 dark:bg-zinc-800 border-none" />
                    </div>
                    <Button variant="outline" className="h-9 gap-2">
                        Base A <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </div>
            </header>

            {/* --- Secondary Header --- */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 flex-shrink-0 z-10">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span>Overview</span>
                    <ChevronRight className="h-4 w-4" />
                    <span>Engagement 1</span>
                    <ChevronRight className="h-4 w-4" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Verification (24)</span>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 relative">
                        <MessageSquare className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-2 ring-white dark:ring-zinc-950">5</span>
                    </Button>
                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
                    <Button variant="outline" className="h-9 gap-2 text-zinc-600 dark:text-zinc-300">
                        <MapPin className="h-4 w-4" /> Seoni & 3... <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                    <Button variant="outline" className="h-9 gap-2 text-zinc-600 dark:text-zinc-300">
                        <Calendar className="h-4 w-4" /> 01 JAN 25 - 0...
                    </Button>

                    {/* Components Link Button */}
                    <div className="ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-800">
                        <Link href="/components/survey">
                            <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm">
                                View Styles
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* --- Main Content Grid --- */}
            <div className="flex-1 flex overflow-hidden">

                {/* --- Left Panel: List (20%) --- */}
                <div className="w-[300px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 z-10">
                    <div className="p-4 flex flex-col gap-4">
                        <div className="p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex p-1">
                            <button className="flex-1 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950 rounded shadow-sm flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800">
                                <Check className="w-3.5 h-3.5" /> Ready to verify (20)
                            </button>
                            <button className="flex-1 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center justify-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" /> Action required (4)
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Farmers</h2>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Map className="w-4 h-4" /></Button>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                <Input className="h-9 text-xs pl-8" placeholder="Search here..." />
                            </div>
                            <Button variant="outline" className="h-9 px-3 text-xs gap-1"><Filter className="w-3 h-3" /> All AZs</Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-4 pt-0 space-y-2">
                            {farmers.map((farmer, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedFarmer(farmer.name)}
                                    className={cn(
                                        "p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group",
                                        selectedFarmer === farmer.name
                                            ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                                            : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                            {farmer.name.charAt(farmer.name.length - 1)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                {farmer.name}
                                                {i === 0 && <Clock className="w-3 h-3 text-zinc-400" />}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-zinc-400">{farmer.location}</span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* --- Center Panel: Map (50%) --- */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 relative">
                    <img
                        src="https://images.unsplash.com/photo-1596327022839-a9a30d508f71?q=80&w=2500&auto=format&fit=crop"
                        alt="Satellite Map"
                        className="w-full h-full object-cover grayscale opacity-90"
                    />
                    {/* Map Overlays */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <div className="bg-white dark:bg-zinc-950 p-2 rounded-md shadow-md">
                            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </div>

                {/* --- Right Panel: Responses (30%) --- */}
                <div className="w-[480px] flex-shrink-0 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-10">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Response</h2>
                            <span className="text-zinc-500 font-medium">AZ 1</span>
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={currentStyle} onValueChange={(val: "style-1" | "style-2" | "style-3" | "style-4" | "style-5" | "current") => setCurrentStyle(val)}>
                                <SelectTrigger className="h-8 w-[110px] text-xs">
                                    <SelectValue placeholder="Style" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="style-3">Style 3</SelectItem>
                                    <SelectItem value="style-5">Style 5 (Compact Verifier)</SelectItem>
                                    <SelectItem value="style-5-feedback">Style 5 (Feedback based)</SelectItem>
                                    <SelectItem value="style-4">Style 4 (Bulk View)</SelectItem>
                                    <SelectItem value="style-1">Style 1</SelectItem>
                                    <SelectItem value="style-2">Style 2</SelectItem>
                                    <SelectItem value="current">Current</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-green-600 transition-colors"><CheckCircle2 className="w-4 h-4" /></Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleReporting}
                                    className={cn(
                                        "h-8 w-8 transition-colors",
                                        isReporting ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20" : "text-zinc-400 hover:text-amber-600"
                                    )}
                                >
                                    <AlertCircle className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {isReporting && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 px-4 py-2 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between animate-in slide-in-from-top duration-300">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    checked={reportedIds.length === surveyData.length && surveyData.length > 0}
                                    onCheckedChange={toggleAllReport}
                                    className="w-4 h-4 border-amber-300 dark:border-amber-800 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                />
                                <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">Report whole survey</span>
                            </div>
                            <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider">{reportedIds.length} selected</span>
                        </div>
                    )}

                    <ScrollArea className="flex-1">
                        <div className={cn(
                            "p-4",
                            (currentStyle === "style-5" || currentStyle === "style-5-feedback") ? "space-y-0" : "space-y-6"
                        )}>
                            {currentStyle === "style-4" ? (
                                <BulkSubmissionCard
                                    submissionId={2481}
                                    data={surveyData}
                                    showHeader={false}
                                    compact={true}
                                    isReporting={isReporting}
                                    selectedIds={reportedIds}
                                    onToggleId={toggleReportId}
                                />
                            ) : (
                                surveyData.map((item) => (
                                    <SurveyCard
                                        key={item.id}
                                        item={item}
                                        style={currentStyle}
                                        showDetails={false}
                                        isReporting={isReporting}
                                        isSelected={reportedIds.includes(item.id)}
                                        onToggleSelect={toggleReportId}
                                    />
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    {isReporting && (
                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom duration-300">
                            <Button
                                disabled={reportedIds.length === 0}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:grayscale transition-all"
                            >
                                {reportedIds.length === 0
                                    ? "Report"
                                    : reportedIds.length === surveyData.length
                                        ? "Report Whole Survey"
                                        : "Report Selected"}
                            </Button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
