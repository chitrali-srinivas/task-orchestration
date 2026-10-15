"use client";

import * as React from "react";
import { SeasonRecord, SeasonActivity, ActivityType } from "../data/schema";
import { SeasonStatusBadge } from "./season-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Calendar,
    Check,
    Clock,
    CalendarDays,
    MapPin,
    Layers,
    Edit2,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SeasonTimelineProps {
    seasons: SeasonRecord[];
    selectedSeasonId?: string;
    onSelectSeason?: (seasonId: string) => void;
    onEditSeason?: (season: SeasonRecord) => void;
}

// Helper to parse dates safely
function parseDateSafe(dateStr?: string | Date): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const str = String(dateStr).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SeasonTimeline({
    seasons,
    selectedSeasonId,
    onSelectSeason,
    onEditSeason,
}: SeasonTimelineProps) {
    // Track expanded season IDs (default expands the first/selected season)
    const [expandedSeasonIds, setExpandedSeasonIds] = React.useState<Set<string>>(() => {
        const initial = new Set<string>();
        if (selectedSeasonId && seasons.some(s => s.id === selectedSeasonId)) {
            initial.add(selectedSeasonId);
        } else if (seasons[0]?.id) {
            initial.add(seasons[0].id);
        }
        return initial;
    });

    // Sync if selectedSeasonId changes from parent
    React.useEffect(() => {
        if (selectedSeasonId && seasons.some(s => s.id === selectedSeasonId)) {
            setExpandedSeasonIds(prev => new Set(prev).add(selectedSeasonId));
        }
    }, [selectedSeasonId, seasons]);

    const toggleSeason = (seasonId: string) => {
        setExpandedSeasonIds(prev => {
            const next = new Set(prev);
            if (next.has(seasonId)) {
                next.delete(seasonId);
            } else {
                next.add(seasonId);
            }
            return next;
        });
        onSelectSeason?.(seasonId);
    };

    const expandAll = () => {
        setExpandedSeasonIds(new Set(seasons.map(s => s.id)));
    };

    const collapseAll = () => {
        setExpandedSeasonIds(new Set());
    };

    // Calculate dynamic multi-season calendar header across ALL seasons and activities
    const { timelineMonths, timelineStart, timelineEnd, totalDuration } = React.useMemo(() => {
        let minT = Infinity;
        let maxT = -Infinity;

        seasons.forEach((s) => {
            if (s.seasonStart) {
                const d = parseDateSafe(s.seasonStart);
                if (d) {
                    minT = Math.min(minT, d.getTime());
                    maxT = Math.max(maxT, d.getTime());
                }
            }
            if (s.seasonEnd) {
                const d = parseDateSafe(s.seasonEnd);
                if (d) {
                    minT = Math.min(minT, d.getTime());
                    maxT = Math.max(maxT, d.getTime());
                }
            }

            (s.activities || []).forEach((act) => {
                if (act.activityStart) {
                    const d = parseDateSafe(act.activityStart);
                    if (d) {
                        minT = Math.min(minT, d.getTime());
                        maxT = Math.max(maxT, d.getTime());
                    }
                }
                if (act.activityEnd) {
                    const d = parseDateSafe(act.activityEnd);
                    if (d) {
                        minT = Math.min(minT, d.getTime());
                        maxT = Math.max(maxT, d.getTime());
                    }
                }
            });
        });

        // Fallback default if no dates exist
        const now = new Date();
        const startDate = minT !== Infinity ? new Date(minT) : new Date(now.getFullYear(), 2, 1);
        const endDate = maxT !== -Infinity ? new Date(maxT) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), 0);

        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth(); // 0-indexed

        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth(); // 0-indexed

        // Calculate total number of months to span the entire lifecycle
        let totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
        if (totalMonths < 12) totalMonths = 12; // Minimum 12 months

        const monthsList: { label: string; monthIndex: number; year: number }[] = [];
        for (let i = 0; i < totalMonths; i++) {
            const mIdx = (startMonth + i) % 12;
            const y = startYear + Math.floor((startMonth + i) / 12);
            const shortYear = String(y).slice(-2);
            monthsList.push({
                label: `${MONTH_NAMES[mIdx]} '${shortYear}`,
                monthIndex: mIdx,
                year: y,
            });
        }

        const tStart = new Date(startYear, startMonth, 1, 0, 0, 0, 0).getTime();
        const lastM = monthsList[monthsList.length - 1];
        const tEnd = new Date(lastM.year, lastM.monthIndex + 1, 0, 23, 59, 59, 999).getTime();
        const duration = Math.max(1, tEnd - tStart);

        return {
            timelineMonths: monthsList,
            timelineStart: tStart,
            timelineEnd: tEnd,
            totalDuration: duration,
        };
    }, [seasons]);

    // Calculate bar percentage coordinates across global dynamic timeline
    const calculateBarPosition = (startStr?: string, endStr?: string) => {
        let start = parseDateSafe(startStr)?.getTime() ?? timelineStart;
        let end = parseDateSafe(endStr)?.getTime() ?? (start + 15 * 24 * 60 * 60 * 1000);

        if (end < start) end = start + 24 * 60 * 60 * 1000;

        const clampedStart = Math.max(timelineStart, Math.min(timelineEnd, start));
        const clampedEnd = Math.max(clampedStart, Math.min(timelineEnd, end));

        const leftPercent = ((clampedStart - timelineStart) / totalDuration) * 100;
        const rawWidthPercent = ((clampedEnd - clampedStart) / totalDuration) * 100;
        const widthPercent = Math.max(0.6, rawWidthPercent);

        return {
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            minWidth: "75px",
        };
    };

    // Pill styling based on activity type & status
    const getActivityBarStyle = (activity: SeasonActivity) => {
        const type = activity.activityType;
        const status = activity.status;

        if (status === "Completed") {
            return {
                containerClass: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-xs font-semibold",
                dotClass: "bg-emerald-500",
                icon: <Check className="h-3 w-3 stroke-[2.5] text-emerald-600 dark:text-emerald-400 shrink-0" />,
                label: "Completed",
            };
        }

        if (status === "Inprogress") {
            return {
                containerClass: "bg-sky-50 text-sky-800 dark:bg-sky-950/90 dark:text-sky-200 border border-sky-300 dark:border-sky-800 shadow-xs font-semibold",
                dotClass: "bg-sky-500",
                icon: <Clock className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />,
                label: "In Progress",
            };
        }

        if (status === "Cancelled") {
            return {
                containerClass: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 shadow-xs line-through",
                dotClass: "bg-zinc-400",
                icon: <AlertCircle className="h-3 w-3 text-zinc-500 shrink-0" />,
                label: "Cancelled",
            };
        }

        // Planned (default)
        if (type === "Deployment") {
            return {
                containerClass: "bg-purple-50 text-purple-800 dark:bg-purple-950/90 dark:text-purple-200 border border-purple-300 dark:border-purple-800 shadow-xs font-semibold",
                dotClass: "bg-purple-500",
                icon: <CalendarDays className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />,
                label: "Planned",
            };
        }

        if (type === "Sampling") {
            return {
                containerClass: "bg-blue-50 text-blue-800 dark:bg-blue-950/90 dark:text-blue-200 border border-blue-300 dark:border-blue-800 shadow-xs",
                dotClass: "bg-blue-500",
                icon: <CalendarDays className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />,
                label: "Planned",
            };
        }

        if (type === "Sowing") {
            return {
                containerClass: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-dashed border-emerald-400 dark:border-emerald-700 shadow-xs",
                dotClass: "bg-emerald-500",
                icon: <CalendarDays className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />,
                label: "Planned",
            };
        }

        return {
            containerClass: "bg-amber-50/80 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-200 dark:border-amber-800 shadow-xs",
            dotClass: "bg-amber-500",
            icon: <CalendarDays className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />,
            label: "Planned",
        };
    };

    // Global stats across all seasons
    const globalStats = React.useMemo(() => {
        let totalActivities = 0;
        let completed = 0;
        let inProgress = 0;
        let planned = 0;

        seasons.forEach(s => {
            (s.activities || []).forEach(act => {
                totalActivities++;
                if (act.status === "Completed") completed++;
                else if (act.status === "Inprogress") inProgress++;
                else planned++;
            });
        });

        return {
            totalSeasons: seasons.length,
            totalActivities,
            completed,
            inProgress,
            planned,
        };
    }, [seasons]);

    const isAllExpanded = expandedSeasonIds.size === seasons.length && seasons.length > 0;

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col flex-1 h-full w-full min-h-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
                {/* 1. Global Multi-Season Timeline Toolbar */}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-[48px] shrink-0">
                    {/* Left: Overall Counter & Expand/Collapse All Buttons */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-zinc-500 shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Season Timeline
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0">
                                {seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}
                            </Badge>
                            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                            <span className="text-xs text-zinc-500 hidden sm:inline">
                                <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{globalStats.totalActivities}</strong> Total Activities
                            </span>
                        </div>

                        {/* Expand / Collapse All Controls */}
                        <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
                            {isAllExpanded ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={collapseAll}
                                    className="h-7 px-2 text-[11px] font-semibold gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                                    title="Collapse all season activities"
                                >
                                    <ChevronsDownUp className="h-3.5 w-3.5" />
                                    <span>Collapse All</span>
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={expandAll}
                                    className="h-7 px-2 text-[11px] font-semibold gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                                    title="Expand all season activities"
                                >
                                    <ChevronsUpDown className="h-3.5 w-3.5" />
                                    <span>Expand All</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right: Global Aggregate Stats Counters */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-3 text-xs pr-1 text-zinc-600 dark:text-zinc-400 font-medium">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-emerald-500" style={{ backgroundColor: "#10b981" }} />
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{globalStats.completed}</span>
                                <span>Completed</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-sky-500" style={{ backgroundColor: "#0ea5e9" }} />
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{globalStats.inProgress}</span>
                                <span>In Progress</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-amber-500" style={{ backgroundColor: "#f59e0b" }} />
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{globalStats.planned}</span>
                                <span>Planned</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Nested Timeline Tree-Grid Area */}
                <div className="flex-1 overflow-auto scrollbar-minimal relative min-h-0 w-full">
                    <div
                        className="w-full"
                        style={{
                            minWidth: `max(100%, calc(360px + ${timelineMonths.length} * 90px))`,
                        }}
                    >
                        {/* Time Header Row */}
                        <div
                            className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-muted/50 backdrop-blur w-full"
                            style={{
                                display: "grid",
                                gridTemplateColumns: `360px repeat(${timelineMonths.length}, minmax(90px, 1fr))`,
                            }}
                        >
                            {/* Fixed Left Header Column */}
                            <div className="h-11 px-4 text-left align-middle font-bold text-[11px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 bg-zinc-100 dark:bg-zinc-900 z-40 flex items-center justify-between shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                <span>Season & Activity Hierarchy</span>
                                <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0">
                                    {seasons.length}
                                </Badge>
                            </div>

                            {/* Horizontal Month Columns */}
                            {timelineMonths.map((m, idx) => (
                                <div
                                    key={idx}
                                    className="h-11 flex items-center justify-center text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200/60 dark:border-zinc-800/60 last:border-r-0 px-1 tracking-tight"
                                >
                                    {m.label}
                                </div>
                            ))}
                        </div>

                        {/* Seasons & Nested Activities Tree Rows */}
                        <div className="divide-y divide-zinc-200/90 dark:divide-zinc-800">
                            {seasons.map((season) => {
                                const isExpanded = expandedSeasonIds.has(season.id);
                                const seasonActivities = season.activities || [];
                                const seasonPos = calculateBarPosition(season.seasonStart, season.seasonEnd);

                                return (
                                    <div key={season.id} className="group/season flex flex-col w-full">
                                        {/* Top-Level Season Row (Parent Row) */}
                                        <div
                                            className="h-12 w-full transition-colors bg-zinc-50/70 dark:bg-zinc-900/50 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "360px 1fr",
                                            }}
                                        >
                                            {/* Left Cell: Season Information + Expand Toggle (Sticky) */}
                                            <div
                                                onClick={() => toggleSeason(season.id)}
                                                className="px-3 py-1.5 flex items-center justify-between border-r border-zinc-200 dark:border-zinc-800 sticky left-0 bg-zinc-50 dark:bg-zinc-900 group-hover/season:bg-zinc-100 dark:group-hover/season:bg-zinc-800/80 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] cursor-pointer select-none"
                                            >
                                                <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
                                                    {/* Expansion Chevron Button */}
                                                    <button
                                                        type="button"
                                                        className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition-transform shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSeason(season.id);
                                                        }}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4 stroke-[2.5]" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
                                                        )}
                                                    </button>

                                                    {/* Season Name & Sub-details */}
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                                {season.seasonName || season.id}
                                                            </span>
                                                            {season.season && (
                                                                <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                                                                    {season.season}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                                            <span className="truncate">{season.baseName}</span>
                                                            <span>•</span>
                                                            <span className="truncate">{season.azName}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Badges & Edit Button */}
                                                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 border-zinc-300 dark:border-zinc-700">
                                                        {seasonActivities.length}
                                                    </Badge>
                                                    <SeasonStatusBadge status={season.status} />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded opacity-0 group-hover/season:opacity-100 transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditSeason?.(season);
                                                        }}
                                                        title="Edit season details"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Right Cell: Season Overall Duration Gantt Bar */}
                                            <div
                                                className="relative h-full flex items-center w-full z-0 cursor-pointer"
                                                onClick={() => toggleSeason(season.id)}
                                            >
                                                {/* Vertical Month Grid Lines */}
                                                <div
                                                    className="absolute inset-0 pointer-events-none w-full h-full"
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(90px, 1fr))`,
                                                    }}
                                                >
                                                    {timelineMonths.map((_, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="border-r border-zinc-200/50 dark:border-zinc-800/50 last:border-r-0 h-full"
                                                        />
                                                    ))}
                                                </div>

                                                {/* Season Scope Duration Pill (Subtle, Refined Styling) */}
                                                {season.seasonStart && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="absolute h-8 rounded-lg px-3 flex items-center justify-between gap-2 text-xs select-none z-10 transition-all duration-150 hover:scale-[1.005] bg-zinc-100/90 hover:bg-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-700/90 text-zinc-800 dark:text-zinc-200 border border-zinc-300/90 dark:border-zinc-700 shadow-2xs font-semibold group/bar"
                                                                style={{
                                                                    left: seasonPos.left,
                                                                    width: seasonPos.width,
                                                                    minWidth: "120px",
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSeason(season.id);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                                                    <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                                        {season.seasonName || season.id}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">
                                                                    <span className="bg-white/90 dark:bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-200/80 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold shadow-2xs">
                                                                        {seasonActivities.length} activities
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span className="text-zinc-400 dark:text-zinc-500">{isExpanded ? "Collapse" : "Expand"}</span>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="top"
                                                            sideOffset={6}
                                                            className="p-3.5 text-xs max-w-sm space-y-1.5 z-[9999] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg"
                                                        >
                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                                                                <span className="font-bold">{season.seasonName || season.id}</span>
                                                                <SeasonStatusBadge status={season.status} />
                                                            </div>
                                                            <div className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 text-[11px] py-0.5">
                                                                <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                                <span>{season.seasonStart} &rarr; {season.seasonEnd || "Open"}</span>
                                                            </div>
                                                            <div className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 text-[11px]">
                                                                <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                                <span>{season.baseName} - {season.azName} ({season.country})</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                                                                <span className="text-zinc-400">{seasonActivities.length} total activities</span>
                                                                <span className="text-zinc-600 dark:text-zinc-300 font-semibold">{isExpanded ? "Expanded" : "Click to expand"}</span>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>

                                        {/* Nested Child Activity Rows */}
                                        {isExpanded && (
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950">
                                                {seasonActivities.length === 0 ? (
                                                    <div className="py-3 px-8 text-xs text-zinc-400 italic">
                                                        No activities scheduled for this season.
                                                    </div>
                                                ) : (
                                                    seasonActivities.map((activity, index) => {
                                                        const barStyle = getActivityBarStyle(activity);
                                                        const pos = calculateBarPosition(activity.activityStart, activity.activityEnd);

                                                        return (
                                                            <div
                                                                key={activity.id || `${season.id}_act_${index}`}
                                                                className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors h-10 w-full group/row"
                                                                style={{
                                                                    display: "grid",
                                                                    gridTemplateColumns: "360px 1fr",
                                                                }}
                                                            >
                                                                {/* Left Side: Indented Activity Information (Sticky) */}
                                                                <div className="pl-9 pr-3 py-1 flex items-center justify-between border-r border-zinc-200 dark:border-zinc-800 sticky left-0 bg-white dark:bg-zinc-950 group-hover/row:bg-zinc-50 dark:group-hover/row:bg-zinc-900/60 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                                                        {/* Tree guide line connector */}
                                                                        <span className="text-zinc-300 dark:text-zinc-700 select-none text-xs font-mono">
                                                                            └
                                                                        </span>
                                                                        <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-4 text-right">
                                                                            {index + 1}
                                                                        </span>
                                                                        <span
                                                                            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate cursor-pointer hover:underline"
                                                                            title={activity.activity}
                                                                            onClick={() => onEditSeason?.(season)}
                                                                        >
                                                                            {activity.activity}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <span
                                                                            className={cn(
                                                                                "text-[9px] px-1.5 py-0.5 rounded font-semibold",
                                                                                activity.activityType === "Sampling" && "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
                                                                                activity.activityType === "Deployment" && "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
                                                                                activity.activityType === "Sowing" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                                                                                activity.activityType === "Engagement" && "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                                                            )}
                                                                        >
                                                                            {activity.activityType}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono text-zinc-400 hidden lg:inline">
                                                                            {activity.surveyId}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Right Side: Activity Gantt Bar Lane */}
                                                                <div className="relative h-full flex items-center w-full z-0">
                                                                    {/* Vertical Month Grid Lines */}
                                                                    <div
                                                                        className="absolute inset-0 pointer-events-none w-full h-full"
                                                                        style={{
                                                                            display: "grid",
                                                                            gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(90px, 1fr))`,
                                                                        }}
                                                                    >
                                                                        {timelineMonths.map((_, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="border-r border-zinc-200/40 dark:border-zinc-800/40 last:border-r-0 h-full"
                                                                            />
                                                                        ))}
                                                                    </div>

                                                                    {/* Activity Gantt Pill */}
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div
                                                                                className={cn(
                                                                                    "absolute h-6.5 rounded-md px-2 flex items-center gap-1.5 text-xs cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.01] select-none z-10",
                                                                                    barStyle.containerClass
                                                                                )}
                                                                                style={{
                                                                                    left: pos.left,
                                                                                    width: pos.width,
                                                                                    minWidth: pos.minWidth,
                                                                                }}
                                                                                onClick={() => onEditSeason?.(season)}
                                                                            >
                                                                                {barStyle.icon}
                                                                                <span className="truncate text-[10px] font-medium">
                                                                                    {barStyle.label}
                                                                                </span>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent
                                                                            side="top"
                                                                            sideOffset={6}
                                                                            className="p-3.5 text-xs max-w-sm space-y-1.5 z-[9999] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg"
                                                                        >
                                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                                                                                <span className="font-bold">{activity.activity}</span>
                                                                                <Badge variant="outline" className="text-[10px] capitalize font-medium">
                                                                                    {activity.activityType}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 text-[11px] py-0.5">
                                                                                <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                                                <span>{activity.activityStart} &rarr; {activity.activityEnd}</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                                                                                <span className="text-zinc-400 font-mono">{activity.surveyId || "SRV-N/A"}</span>
                                                                                <SeasonStatusBadge status={activity.status} />
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. Timeline Bottom Legend */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-500">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                            Activity Types:
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-blue-500" style={{ backgroundColor: "#3b82f6" }} />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Sampling</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-purple-600 dark:bg-purple-400" style={{ backgroundColor: "#9333ea" }} />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Deployment</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-emerald-500" style={{ backgroundColor: "#10b981" }} />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Sowing</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-amber-500" style={{ backgroundColor: "#f59e0b" }} />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Engagement</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400">
                            Click any season row or chevron to expand/collapse activities. Click bars to view and edit details.
                        </span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
