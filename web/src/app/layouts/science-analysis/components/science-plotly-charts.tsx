"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    MOCK_VEGETATION_INDICES,
    MOCK_CLIMATE_DATA,
    MOCK_SOIL_PROFILE,
    MOCK_DETECTED_SEASONS,
    MOCK_ANNUAL_SUMMARY,
    SciencePlot
} from "../data/mock-science-data";
import { Maximize2, Calendar as CalendarIcon, ChevronDown, MapPin, Satellite, Check, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ExpandedCardModal, ExpandedModalItem } from "./expanded-card-modal";

// Dynamically import Plotly factory component with SSR disabled
const Plot = dynamic(() => import("./PlotlyComponent"), { ssr: false });

interface SciencePlotlyChartsProps {
    selectedPlots: SciencePlot[];
    activeTimeRange: "All" | "5Y" | "2Y" | "1Y" | "6M" | "3M" | "1M" | "Custom";
    onTimeRangeChange: (range: "All" | "5Y" | "2Y" | "1Y" | "6M" | "3M" | "1M" | "Custom") => void;
    startDate: string;
    endDate: string;
    onDateRangeChange: (start: string, end: string) => void;
    onOpenComparison: () => void;
    isPlotsMinimized?: boolean;
    onTogglePlotsSidebar?: () => void;
    selectedPlotsCount?: number;
    selectedGraphDate?: string | null;
    onSelectGraphDate?: (date: string | null) => void;
}

const RADAR_RAW_DATA = [
    { date: "2022-01-01", vv: -5.2, vh: -14.5 },
    { date: "2022-04-01", vv: -6.1, vh: -15.2 },
    { date: "2022-07-01", vv: -4.8, vh: -13.8 },
    { date: "2022-10-01", vv: -7.5, vh: -16.5 },
    { date: "2023-01-01", vv: -5.9, vh: -14.9 },
    { date: "2023-04-01", vv: -6.8, vh: -15.8 },
    { date: "2023-07-01", vv: -4.2, vh: -13.2 },
    { date: "2023-10-01", vv: -7.1, vh: -16.1 },
    { date: "2024-01-01", vv: -5.4, vh: -14.4 },
    { date: "2024-04-01", vv: -6.2, vh: -15.2 },
    { date: "2024-07-01", vv: -4.0, vh: -13.0 },
    { date: "2024-10-01", vv: -6.9, vh: -15.9 },
    { date: "2025-01-01", vv: -5.1, vh: -14.1 },
    { date: "2025-04-01", vv: -6.5, vh: -15.5 },
    { date: "2025-07-01", vv: -4.3, vh: -13.3 },
    { date: "2025-10-01", vv: -7.0, vh: -16.0 },
    { date: "2026-01-01", vv: -5.8, vh: -14.8 },
    { date: "2026-04-01", vv: -6.4, vh: -15.4 },
    { date: "2026-08-01", vv: -5.0, vh: -14.0 },
];

interface MetricDefinition {
    id: string;
    label: string;
    color: string;
    minY: number;
    maxY: number;
    unit?: string;
    category: "veg" | "climate" | "radar";
}

const ALL_AVAILABLE_METRICS: MetricDefinition[] = [
    { id: "NDVI", label: "NDVI", color: "#1d4ed8", minY: -0.01, maxY: 1.06, category: "veg" },
    { id: "NDRE", label: "NDRE", color: "#ea580c", minY: -0.01, maxY: 0.95, category: "veg" },
    { id: "MOISTURE", label: "MOISTURE", color: "#15803d", minY: -0.01, maxY: 0.85, category: "climate" },
    { id: "EVI", label: "EVI", color: "#b91c1c", minY: -0.01, maxY: 0.92, category: "veg" },
    { id: "SAVI", label: "SAVI", color: "#7c3aed", minY: -0.01, maxY: 0.90, category: "veg" },
    { id: "GNDVI", label: "GNDVI", color: "#b45309", minY: -0.01, maxY: 0.88, category: "veg" },
    { id: "NDWI", label: "NDWI", color: "#db2777", minY: -0.01, maxY: 0.80, category: "veg" },
    { id: "EN SOIL", label: "EN SOIL", color: "#4b5563", minY: -0.01, maxY: 0.70, category: "climate" },
    { id: "RAINFALL", label: "RAINFALL", color: "#0284c7", minY: 0, maxY: 120, unit: "mm", category: "climate" },
    { id: "RADAR VV", label: "RADAR VV", color: "#0f172a", minY: -20, maxY: 0, unit: "dB", category: "radar" },
    { id: "RADAR VH", label: "RADAR VH", color: "#64748b", minY: -25, maxY: -5, unit: "dB", category: "radar" },
];

// Memoized Subplot Chart Item component with Optimized Ultra-Tight Margins
const SubplotChartItem = React.memo(function SubplotChartItem({
    xValues,
    yValues,
    metric,
    sharedXDomain,
    onRelayout,
    showXAxisTicks = false,
    hoveredIdx = null,
    onPlotClick,
}: {
    xValues: string[];
    yValues: number[];
    metric: MetricDefinition;
    sharedXDomain: [string, string] | null;
    onRelayout: (e: any) => void;
    showXAxisTicks?: boolean;
    hoveredIdx?: number | null;
    onPlotClick?: (date: string) => void;
}) {
    const data = useMemo(() => {
        const traces: any[] = [
            {
                x: xValues,
                y: yValues,
                type: metric.id === "RAINFALL" ? ("bar" as const) : ("scatter" as const),
                mode: metric.id === "RAINFALL" ? undefined : ("lines" as const),
                line: { color: metric.color, width: 2, shape: "spline" as const },
                hoverinfo: "none" as const,
            },
        ];

        // 100% Native Plotly SVG Marker: Drawn directly on exact (x,y) data coordinate
        if (hoveredIdx !== null && xValues[hoveredIdx] !== undefined && yValues[hoveredIdx] !== undefined) {
            traces.push({
                x: [xValues[hoveredIdx]],
                y: [yValues[hoveredIdx]],
                type: "scatter" as const,
                mode: "markers" as const,
                marker: {
                    size: 7,
                    color: "#ffffff",
                    line: { color: metric.color, width: 2.5 },
                },
                hoverinfo: "none" as const,
            });
        }

        return traces;
    }, [xValues, yValues, metric, hoveredIdx]);

    const layout = useMemo(
        () => ({
            autosize: true,
            margin: { l: 22, r: 5, t: 6, b: showXAxisTicks ? 18 : 4 },
            showlegend: false,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            xaxis: {
                showgrid: true,
                gridcolor: "#f4f4f5",
                showticklabels: showXAxisTicks,
                tickfont: { size: 9, color: "#52525b" },
                range: sharedXDomain ? sharedXDomain : undefined,
                autorange: sharedXDomain ? false : true,
            },
            yaxis: {
                showgrid: true,
                gridcolor: "#f4f4f5",
                showticklabels: true,
                tickfont: { size: 9, color: "#a1a1aa" },
                automargin: true,
                range: [metric.minY, metric.maxY],
            },
            hovermode: false as const,
            // 100% Native Plotly Synchronized Vertical Crosshair Spike Line
            shapes:
                hoveredIdx !== null && xValues[hoveredIdx] !== undefined
                    ? [
                          {
                              type: "line" as const,
                              xref: "x" as const,
                              yref: "paper" as const,
                              x0: xValues[hoveredIdx],
                              x1: xValues[hoveredIdx],
                              y0: 0,
                              y1: 1,
                              line: { color: "#27272a", width: 1 },
                          },
                      ]
                    : [],
            // 100% Native Plotly Data-Anchored Callout Tooltip Card with Arrow: Moves natively with point during Zoom & Pan
            annotations:
                hoveredIdx !== null &&
                xValues[hoveredIdx] !== undefined &&
                yValues[hoveredIdx] !== undefined
                    ? [
                          {
                              x: xValues[hoveredIdx],
                              y: yValues[hoveredIdx],
                              xref: "x" as const,
                              yref: "y" as const,
                              text: `<span style="color:#71717a;font-weight:500;">${xValues[hoveredIdx]}</span> &nbsp;<b style="color:${metric.color};">${metric.label}: ${typeof yValues[hoveredIdx] === "number" ? yValues[hoveredIdx].toFixed(2) : yValues[hoveredIdx]} ${metric.unit || ""}</b>`,
                              showarrow: true,
                              arrowhead: 6,
                              arrowsize: 0.8,
                              arrowcolor: metric.color,
                              ax: 0,
                              ay: -24,
                              bgcolor: "#ffffff",
                              bordercolor: "#e4e4e7",
                              borderwidth: 1,
                              borderpad: 4,
                              font: {
                                  family: "monospace",
                                  size: 10,
                                  color: "#09090b",
                              },
                              opacity: 0.96,
                          },
                      ]
                    : [],
        }),
        [metric, sharedXDomain, showXAxisTicks, hoveredIdx, xValues, yValues]
    );

    return (
        <Plot
            data={data}
            layout={layout}
            onRelayout={onRelayout}
            onClick={(e: any) => {
                if (e && e.points && e.points[0] && e.points[0].x) {
                    onPlotClick?.(String(e.points[0].x));
                }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
            className="w-full h-full pointer-events-auto cursor-pointer"
            config={{ responsive: true, displayModeBar: false }}
        />
    );
});

export function SciencePlotlyCharts({
    selectedPlots,
    activeTimeRange,
    onTimeRangeChange,
    startDate,
    endDate,
    onDateRangeChange,
    onOpenComparison,
    isPlotsMinimized,
    onTogglePlotsSidebar,
    selectedPlotsCount,
    selectedGraphDate,
    onSelectGraphDate,
}: SciencePlotlyChartsProps) {
    // Active Plot View selection state: "all" or specific plot ID from selected plots list
    const [activePlotView, setActivePlotView] = useState<string>("all");

    // Reset active plot view if selected plots change and current view is no longer available
    useEffect(() => {
        if (activePlotView !== "all" && !selectedPlots.some((p) => p.id === activePlotView)) {
            setActivePlotView("all");
        }
    }, [selectedPlots, activePlotView]);

    const targetPlotId = activePlotView !== "all"
        ? activePlotView
        : (selectedPlots.length > 0 ? selectedPlots[0].id : "plot-01");

    const vegData = MOCK_VEGETATION_INDICES[targetPlotId] || MOCK_VEGETATION_INDICES["plot-01"];

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const chartStackRef = useRef<HTMLDivElement>(null);

    // Section Refs
    const graphStackRef = useRef<HTMLDivElement>(null);
    const soilRef = useRef<HTMLDivElement>(null);
    const phenologyRef = useRef<HTMLDivElement>(null);

    const [selectedSatellite, setSelectedSatellite] = useState<string>("Sentinel-2");

    // Active Metrics selection for stacked subplots
    const [activeMetrics, setActiveMetrics] = useState<string[]>([
        "NDVI",
        "NDRE",
        "MOISTURE",
        "EVI",
        "SAVI",
        "GNDVI",
        "NDWI",
        "EN SOIL",
    ]);

    // Synchronized Hover State across all subplots
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // Shared X-axis zoom range state across all subplots
    const [sharedXDomain, setSharedXDomain] = useState<[string, string] | null>(null);

    // Modal state for individual card expand view
    const [expandedModalItem, setExpandedModalItem] = useState<ExpandedModalItem | null>(null);
    const [isExpandedModalOpen, setIsExpandedModalOpen] = useState<boolean>(false);

    const handleExpandCard = (item: ExpandedModalItem) => {
        setExpandedModalItem(item);
        setIsExpandedModalOpen(true);
    };

    const toggleMetric = (metricId: string) => {
        setActiveMetrics((prev) => {
            if (prev.includes(metricId)) {
                if (prev.length === 1) return prev;
                return prev.filter((m) => m !== metricId);
            } else {
                return [...prev, metricId];
            }
        });
    };

    // Auto-trigger window resize event on container resize so Plotly SVG charts auto-fill 100% width!
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            window.dispatchEvent(new Event("resize"));
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Preset Clicks
    const handlePresetClick = (preset: "All" | "5Y" | "2Y" | "1Y" | "6M" | "3M" | "1M") => {
        onTimeRangeChange(preset);
        const end = "2026-08-15";
        let start = "2022-01-01";
        if (preset === "5Y") start = "2022-01-01";
        else if (preset === "2Y") start = "2024-08-15";
        else if (preset === "1Y") start = "2025-08-15";
        else if (preset === "6M") start = "2026-02-15";
        else if (preset === "3M") start = "2026-05-15";
        else if (preset === "1M") start = "2026-07-15";
        onDateRangeChange(start, end);
    };

    const handleCustomDateChange = (type: "start" | "end", val: string) => {
        onTimeRangeChange("Custom");
        if (type === "start") {
            onDateRangeChange(val, endDate);
        } else {
            onDateRangeChange(startDate, val);
        }
    };

    // Filter dynamic datasets
    const filteredVegData = useMemo(() => {
        return vegData.map((series) => ({
            ...series,
            observations: series.observations.filter(
                (o) => o.date >= startDate && o.date <= endDate
            ),
        }));
    }, [vegData, startDate, endDate]);

    const filteredClimateData = useMemo(() => {
        return MOCK_CLIMATE_DATA.filter((o) => o.date >= startDate && o.date <= endDate);
    }, [startDate, endDate]);

    const filteredRadarData = useMemo(() => {
        return RADAR_RAW_DATA.filter((o) => o.date >= startDate && o.date <= endDate);
    }, [startDate, endDate]);

    const observations = useMemo(() => {
        return filteredVegData[0]?.observations || [];
    }, [filteredVegData]);

    const xDateValues = useMemo(() => observations.map((o: any) => o.date), [observations]);

    const handleChartClick = useCallback(() => {
        if (hoveredIdx !== null && xDateValues[hoveredIdx]) {
            onSelectGraphDate?.(xDateValues[hoveredIdx]);
        }
    }, [hoveredIdx, xDateValues, onSelectGraphDate]);

    const computedMetricValuesMap = useMemo(() => {
        const map: Record<string, number[]> = {};
        ALL_AVAILABLE_METRICS.forEach((metric) => {
            map[metric.id] = observations.map((o: any, idx: number) => {
                const val = o.smoothed || 0.4;
                if (metric.id === "NDVI") return val;
                if (metric.id === "NDRE") return Number((val * 0.82).toFixed(2));
                if (metric.id === "MOISTURE") return Number((val * 0.65).toFixed(2));
                if (metric.id === "EVI") return Number((val * 0.91).toFixed(2));
                if (metric.id === "SAVI") return Number((val * 0.85).toFixed(2));
                if (metric.id === "GNDVI") return Number((val * 0.78).toFixed(2));
                if (metric.id === "NDWI") return Number((val * 0.52).toFixed(2));
                if (metric.id === "EN SOIL") return Number((val * 0.45).toFixed(2));
                if (metric.id === "RAINFALL") return filteredClimateData[idx % (filteredClimateData.length || 1)]?.rainfallMm || 25;
                if (metric.id === "RADAR VV") return filteredRadarData[idx % (filteredRadarData.length || 1)]?.vv || -6.5;
                if (metric.id === "RADAR VH") return filteredRadarData[idx % (filteredRadarData.length || 1)]?.vh || -15.2;
                return val;
            });
        });
        return map;
    }, [observations, filteredClimateData, filteredRadarData]);

    const handleRelayout = useCallback((e: any) => {
        if (e["xaxis.range[0]"] && e["xaxis.range[1]"]) {
            setSharedXDomain([e["xaxis.range[0]"], e["xaxis.range[1]"]]);
        } else if (e["xaxis.autorange"]) {
            setSharedXDomain(null);
        }
    }, []);

    // 100% Mathematical Exact Point Ratio Mouse Tracking
    const handleMouseMoveRow = (e: React.MouseEvent<HTMLDivElement>) => {
        if (observations.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const leftMargin = 22;
        const rightMargin = 5;
        const plotWidth = rect.width - leftMargin - rightMargin;
        if (plotWidth <= 0) return;

        const mouseXInPlot = e.clientX - rect.left - leftMargin;
        const ratio = Math.max(0, Math.min(1, mouseXInPlot / plotWidth));
        const totalPoints = observations.length;
        
        const idx = Math.min(
            totalPoints - 1,
            Math.max(0, Math.round(ratio * (totalPoints - 1)))
        );
        setHoveredIdx(idx);
    };

    const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (observations.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const leftMargin = 22;
        const rightMargin = 5;
        const plotWidth = rect.width - leftMargin - rightMargin;
        if (plotWidth <= 0) return;

        const mouseXInPlot = e.clientX - rect.left - leftMargin;
        const ratio = Math.max(0, Math.min(1, mouseXInPlot / plotWidth));
        const totalPoints = observations.length;
        
        const idx = Math.min(
            totalPoints - 1,
            Math.max(0, Math.round(ratio * (totalPoints - 1)))
        );
        const clickedDate = xDateValues[idx];
        if (clickedDate) {
            onSelectGraphDate?.(clickedDate);
        }
    };

    const handleMouseLeaveContainer = () => {
        setHoveredIdx(null);
    };

    const startYear = useMemo(() => new Date(startDate).getFullYear(), [startDate]);
    const endYear = useMemo(() => new Date(endDate).getFullYear(), [endDate]);

    const filteredSeasons = useMemo(() => {
        return MOCK_DETECTED_SEASONS.filter(
            (row) => row.year >= startYear && row.year <= endYear
        );
    }, [startYear, endYear]);

    const filteredAnnualSummary = useMemo(() => {
        return MOCK_ANNUAL_SUMMARY.filter(
            (row) => row.year >= startYear && row.year <= endYear
        );
    }, [startYear, endYear]);

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-zinc-950 min-w-0 select-none overflow-hidden w-full">
            {/* Header Area with 2 Clean Tiers */}
            <div className="sticky top-0 z-20 shrink-0 min-w-0 bg-white dark:bg-zinc-950">
                {/* Tier 1: Main Header Title & Plots Counter Button (Left) and Download Icon Button (Right) */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        {onTogglePlotsSidebar && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onTogglePlotsSidebar}
                                className="relative h-8 w-8 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-accent rounded-md cursor-pointer shrink-0"
                                title="Toggle Plots Sidebar"
                            >
                                <MapPin className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-400" />
                                <Badge
                                    variant="secondary"
                                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm border border-white dark:border-zinc-950 pointer-events-none"
                                >
                                    {selectedPlotsCount ?? selectedPlots.length}
                                </Badge>
                            </Button>
                        )}

                        <h2 className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                            Analytical Dashboard
                        </h2>
                    </div>

                    {/* Top Right: Download Icon Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                        title="Download Data"
                    >
                        <Download className="h-4.5 w-4.5 opacity-60" />
                    </Button>
                </div>

                {/* Tier 2: Separate Sub-Header Controls Section */}
                <div className="w-full px-3.5 py-1.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-900/30">
                    {/* Left: Plot View Dropdown */}
                    <div className="min-w-0 flex-1">
                        <Select value={activePlotView} onValueChange={setActivePlotView}>
                            <SelectTrigger className="h-8 w-auto border-0 bg-transparent hover:bg-accent hover:text-accent-foreground text-xs font-semibold gap-2 px-2.5 rounded-md shadow-none focus:ring-0 focus:outline-none ring-0 outline-none cursor-pointer">
                                <SelectValue placeholder="Select Plot View" />
                            </SelectTrigger>
                            <SelectContent align="start" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-[1000]">
                                <SelectItem value="all" className="text-xs font-bold cursor-pointer">
                                    All Selected Plots ({selectedPlots.length})
                                </SelectItem>
                                {selectedPlots.map((plot) => (
                                    <SelectItem key={plot.id} value={plot.id} className="text-xs font-medium cursor-pointer">
                                        {plot.name} ({plot.farmerName})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Right: Date Range Picker Popover & Satellite Select Dropdown */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Standard Shadcn Ghost Date Range Picker Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 px-2.5 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors border-0 bg-transparent shadow-none focus:ring-0 rounded-md cursor-pointer"
                                >
                                    <CalendarIcon className="h-4 w-4 opacity-50" />
                                    <span>
                                        {format(parseISO(startDate), "yyyy-MM-dd")} ~ {format(parseISO(endDate), "yyyy-MM-dd")}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[320px] p-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl space-y-3 z-[1000]">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                        Preset Ranges
                                    </label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[
                                            { label: "All time", value: "All" },
                                            { label: "5 Years", value: "5Y" },
                                            { label: "2 Years", value: "2Y" },
                                            { label: "1 Year", value: "1Y" },
                                            { label: "6 Months", value: "6M" },
                                            { label: "1 Month", value: "1M" },
                                        ].map((preset) => (
                                            <button
                                                key={preset.value}
                                                onClick={() => handlePresetClick(preset.value as any)}
                                                className={`px-2 py-1.5 rounded-md text-[10px] font-bold text-center transition-all ${
                                                    activeTimeRange === preset.value
                                                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                                        : "bg-zinc-50 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                        Custom Range
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase">Start</span>
                                            <input
                                                type="date"
                                                value={startDate}
                                                min="2022-01-01"
                                                max="2026-08-15"
                                                onChange={(e) => handleCustomDateChange("start", e.target.value)}
                                                className="w-full h-8 px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-450 font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase">End</span>
                                            <input
                                                type="date"
                                                value={endDate}
                                                min="2022-01-01"
                                                max="2026-08-15"
                                                onChange={(e) => handleCustomDateChange("end", e.target.value)}
                                                className="w-full h-8 px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-450 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

                        {/* Satellite Selection Dropdown */}
                        <Select value={selectedSatellite} onValueChange={setSelectedSatellite}>
                            <SelectTrigger className="h-8 w-auto border-0 bg-transparent hover:bg-accent hover:text-accent-foreground text-xs font-semibold gap-2 px-2.5 rounded-md shadow-none focus:ring-0 focus:outline-none ring-0 outline-none cursor-pointer">
                                <Satellite className="h-4 w-4 opacity-50 shrink-0" />
                                <SelectValue placeholder="Select Satellite" />
                            </SelectTrigger>
                            <SelectContent align="end" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-[1000]">
                                <SelectItem value="Sentinel-2" className="text-xs font-medium cursor-pointer">Sentinel-2</SelectItem>
                                <SelectItem value="Landsat 8/9" className="text-xs font-medium cursor-pointer">Landsat 8/9</SelectItem>
                                <SelectItem value="MODIS" className="text-xs font-medium cursor-pointer">MODIS</SelectItem>
                                <SelectItem value="PlanetScope" className="text-xs font-medium cursor-pointer">PlanetScope</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {selectedPlots.length === 0 ? (
                /* Compact Minimalistic Empty State when No Plots are selected */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50/50 dark:bg-zinc-950/20">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3.5 border border-zinc-200/50 dark:border-zinc-800">
                        <MapPin className="h-5 w-5 text-zinc-400 dark:text-zinc-500 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No Plot Selected</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-xs leading-relaxed font-medium">
                        Select a plot boundary on the map or click on the Plots sidebar to begin analyzing satellite, climate, and radar metrics.
                    </p>
                </div>
            ) : (
                /* Scrollable Dashboard Body - Ultra-Compact Edge-to-Edge Width (px-1 py-1) */
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 px-1 py-1 space-y-4 scroll-smooth snap-y snap-mandatory">
                    
                    {/* VIEWPORT 1: TELEMETRY GRAPHS WORKSPACE */}
                    <div ref={graphStackRef} className="snap-start h-full min-h-full flex flex-col justify-between relative">
                        {/* Filter Bar (GRAPHS): Standard shadcn UI Component Theme */}
                        <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 border-b border-border bg-card/40 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 select-none">
                                Metrics:
                            </span>
                            {ALL_AVAILABLE_METRICS.map((metric) => {
                                const isActive = activeMetrics.includes(metric.id);
                                return (
                                    <Badge
                                        key={metric.id}
                                        variant={isActive ? "secondary" : "outline"}
                                        onClick={() => toggleMetric(metric.id)}
                                        className={`cursor-pointer transition-all gap-1.5 px-2.5 py-1 text-[10px] font-semibold select-none border ${
                                            isActive
                                                ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent shadow-2xs"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent border-border"
                                        }`}
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full inline-block shrink-0"
                                            style={{ backgroundColor: metric.color }}
                                        />
                                        <span>{metric.label}</span>
                                        {isActive && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
                                    </Badge>
                                );
                            })}
                        </div>

                        {/* Stacked Telemetry Graphs Container: Single Plotly Native X-Axis */}
                        <div className="flex-1 min-h-0 flex flex-col justify-between relative overflow-hidden">
                            {/* Subplots Stack Container */}
                            <div
                                ref={chartStackRef}
                                onMouseLeave={handleMouseLeaveContainer}
                                onClickCapture={handleRowClick}
                                onMouseDownCapture={handleRowClick}
                                className="flex-1 min-h-0 flex flex-col justify-between py-0.5 relative cursor-crosshair overflow-hidden"
                            >
                                {/* Render Stacked Subplot Rows with Clean Bottom Separator Lines */}
                                {activeMetrics.map((metricId, index) => {
                                    const isLast = index === activeMetrics.length - 1;
                                    const metric: MetricDefinition = ALL_AVAILABLE_METRICS.find((m) => m.id === metricId) || {
                                        id: metricId,
                                        label: metricId,
                                        color: "#2563eb",
                                        minY: -0.01,
                                        maxY: 1.0,
                                        category: "veg",
                                    };

                                    const metricValues = computedMetricValuesMap[metric.id] || [];

                                    return (
                                        <div
                                            key={metric.id}
                                            onMouseMove={handleMouseMoveRow}
                                            onClick={handleRowClick}
                                            onMouseDown={handleRowClick}
                                            className={`flex-1 min-h-[65px] ${
                                                activeMetrics.length <= 4 ? "max-h-[150px]" : ""
                                            } relative flex items-stretch bg-transparent cursor-pointer ${
                                                !isLast ? "border-b border-zinc-100 dark:border-zinc-800/60" : ""
                                            }`}
                                        >
                                            {/* Micro Vertical Left Metric Name Badge */}
                                            <div className="w-5 bg-transparent text-zinc-600 dark:text-zinc-400 flex items-center justify-center py-1 shrink-0 select-none">
                                                <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-extrabold uppercase tracking-wider">
                                                    {metric.label}
                                                </span>
                                            </div>

                                            {/* Subplot Chart View Container with Edge-to-Edge Width */}
                                            <div className="flex-1 h-full min-h-0 relative flex flex-col justify-center overflow-hidden">
                                                <SubplotChartItem
                                                    xValues={xDateValues}
                                                    yValues={metricValues}
                                                    metric={metric}
                                                    sharedXDomain={sharedXDomain}
                                                    onRelayout={handleRelayout}
                                                    showXAxisTicks={isLast}
                                                    hoveredIdx={hoveredIdx}
                                                    onPlotClick={(date) => onSelectGraphDate?.(date)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* VIEWPORT 2: ALL DATA TABLES WORKSPACE */}
                    <div className="snap-start min-h-full flex flex-col justify-between space-y-5 pt-3 pb-6 border-t border-zinc-200/80 dark:border-zinc-800 px-2">
                        {/* SOIL PROFILE DEPTH MATRIX TABLE */}
                        <div ref={soilRef} className="space-y-2">
                            {/* Heading OUTSIDE the table card */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-50">
                                        Soil Profile Depth Matrix
                                    </h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                                        Soil depth-stratified physical & chemical properties matrix
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleExpandCard({
                                        id: "soil",
                                        title: "Soil Profile Depth Matrix",
                                        subtitle: "Soil depth-stratified physical & chemical properties matrix",
                                        type: "table"
                                    })}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                                    title="Expand Table View"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Table Card Container */}
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                                <Table>
                                    <TableHeader className="bg-zinc-50/80 dark:bg-zinc-800/80">
                                        <TableRow className="border-b border-zinc-200 dark:border-zinc-800">
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Depth (cm)</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">pH</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Organic C (g/kg)</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Clay %</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Sand %</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-400">Silt %</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-400">CEC</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-400">N (g/kg)</TableHead>
                                            <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-zinc-400">Bulk Dens.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="font-mono text-[11px]">
                                        {MOCK_SOIL_PROFILE.map((layer) => (
                                            <TableRow key={layer.depthCm} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <TableCell className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{layer.depthCm}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.pH}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{layer.organicC}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.clayPct}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.sandPct}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.siltPct}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.cec}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.nitrogenGKg}</TableCell>
                                                <TableCell className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">{layer.bulkDensity}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* CROP PHENOLOGY & ANNUAL SUMMARY TABLES */}
                        <div ref={phenologyRef} className="space-y-5 pt-2">
                            {/* Main Section Header OUTSIDE */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-50">
                                        Phenology & Annual Summary
                                    </h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                                        Multi-year season detection & climate summary statistics
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleExpandCard({
                                        id: "phenology",
                                        title: "Phenology & Annual Summary",
                                        subtitle: "Multi-year season detection & climate summary statistics",
                                        type: "table"
                                    })}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                                    title="Expand Table View"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Table 1: DETECTED SEASONS (NDVI) */}
                            <div className="space-y-2 w-full">
                                {/* Heading OUTSIDE above Table 1 */}
                                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-0.5">
                                    Detected Seasons (NDVI)
                                </div>

                                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                                    <Table>
                                        <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
                                            <TableRow className="border-b border-zinc-200 dark:border-zinc-800">
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Year</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Start</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Peak</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">End</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Length D</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Amplitude</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">AUC</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="font-mono text-[11px]">
                                            {filteredSeasons.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-4 text-center text-zinc-400">
                                                        No seasonal data in dynamic range.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredSeasons.map((row) => (
                                                    <TableRow key={row.year} className="hover:bg-zinc-50 dark:hover:bg-zinc-850">
                                                        <TableCell className="py-2 px-3 font-bold text-zinc-900 dark:text-zinc-100">{row.year}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.start}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.peak}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.end}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.lengthD}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.amplitude.toFixed(3)}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.auc.toFixed(1)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Table 2: ANNUAL SUMMARY */}
                            <div className="space-y-2 w-full pt-1">
                                {/* Heading OUTSIDE above Table 2 */}
                                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-0.5">
                                    Annual Summary
                                </div>

                                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                                    <Table>
                                        <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
                                            <TableRow className="border-b border-zinc-200 dark:border-zinc-800">
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Year</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Rain MM</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">ETo MM</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">GDD</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Heat Days</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">Dry Days</TableHead>
                                                <TableHead className="py-2 px-3 text-[10px] uppercase font-bold text-zinc-400">NDVI Mean</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="font-mono text-[11px]">
                                            {filteredAnnualSummary.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-4 text-center text-zinc-400">
                                                        No annual summary in dynamic range.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredAnnualSummary.map((row) => (
                                                    <TableRow key={row.year} className="hover:bg-zinc-50 dark:hover:bg-zinc-850">
                                                        <TableCell className="py-2 px-3 font-bold text-zinc-900 dark:text-zinc-100">{row.year}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.rainMm}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.etoMm}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.gdd}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.heatDays}</TableCell>
                                                        <TableCell className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.dryDays}</TableCell>
                                                        <TableCell className="py-2 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{row.ndviMean.toFixed(3)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Expanded Card (Graph/Table) */}
            <ExpandedCardModal
                open={isExpandedModalOpen}
                onOpenChange={setIsExpandedModalOpen}
                item={expandedModalItem}
                selectedPlots={selectedPlots}
                startDate={startDate}
                endDate={endDate}
                vegData={filteredVegData}
                climateData={filteredClimateData}
                soilData={MOCK_SOIL_PROFILE}
                radarData={filteredRadarData}
                phenologyData={MOCK_DETECTED_SEASONS}
                selectedSatellite={selectedSatellite}
                onSatelliteChange={setSelectedSatellite}
            />
        </div>
    );
}
