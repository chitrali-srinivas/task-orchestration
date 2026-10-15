"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Download,
    Calendar as CalendarIcon,
    Search,
    Satellite,
    ChevronDown,
    Check,
    X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { format, parseISO, subYears, subMonths } from "date-fns";
import { MOCK_ANNUAL_SUMMARY, MOCK_DETECTED_SEASONS } from "../data/mock-science-data";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface ExpandedModalItem {
    id: "veg" | "climate" | "soil" | "radar" | "phenology";
    title: string;
    subtitle: string;
    type: "graph" | "table";
}

interface ExpandedCardModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: ExpandedModalItem | null;
    selectedPlots: any[];
    startDate: string;
    endDate: string;
    vegData: any[];
    climateData: any[];
    soilData: any[];
    radarData: any[];
    phenologyData: any[];
    selectedSatellite?: string;
    onSatelliteChange?: (sat: string) => void;
}

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
    { id: "NDRE", label: "NDRE", color: "#ea580c", minY: -0.75, maxY: 0.95, category: "veg" },
    { id: "MOISTURE", label: "MOISTURE", color: "#15803d", minY: -0.17, maxY: 0.85, category: "climate" },
    { id: "EVI", label: "EVI", color: "#b91c1c", minY: -0.75, maxY: 0.92, category: "veg" },
    { id: "SAVI", label: "SAVI", color: "#7c3aed", minY: -0.75, maxY: 0.90, category: "veg" },
    { id: "GNDVI", label: "GNDVI", color: "#b45309", minY: -0.75, maxY: 0.88, category: "veg" },
    { id: "NDWI", label: "NDWI", color: "#db2777", minY: -0.75, maxY: 0.80, category: "veg" },
    { id: "EN SOIL", label: "EN SOIL", color: "#4b5563", minY: -0.75, maxY: 0.70, category: "climate" },
    { id: "RAINFALL", label: "RAINFALL", color: "#0284c7", minY: 0, maxY: 120, unit: "mm", category: "climate" },
    { id: "RADAR VV", label: "RADAR VV", color: "#0f172a", minY: -20, maxY: 0, unit: "dB", category: "radar" },
    { id: "RADAR VH", label: "RADAR VH", color: "#64748b", minY: -25, maxY: -5, unit: "dB", category: "radar" },
];

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const csvContent = [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function ExpandedCardModal({
    open,
    onOpenChange,
    item,
    selectedPlots,
    startDate: initialStartDate,
    endDate: initialEndDate,
    vegData,
    climateData,
    soilData,
    radarData,
    phenologyData,
    selectedSatellite: propSelectedSatellite,
    onSatelliteChange,
}: ExpandedCardModalProps) {
    const [localStartDate, setLocalStartDate] = useState<string>(initialStartDate);
    const [localEndDate, setLocalEndDate] = useState<string>(initialEndDate);
    const [modalActiveTimeRange, setModalActiveTimeRange] = useState<string>("All");
    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
    
    // Controlled Inline Dropdown State (100% Reliable inside Dialog)
    const [isSatDropdownOpen, setIsSatDropdownOpen] = useState<boolean>(false);
    const satDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (satDropdownRef.current && !satDropdownRef.current.contains(event.target as Node)) {
                setIsSatDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleModalPresetClick = (range: string) => {
        setModalActiveTimeRange(range);
        const end = "2026-08-15";
        const maxDate = new Date(end);
        let start = "2022-01-01";

        if (range === "5Y") {
            start = format(subYears(maxDate, 5), "yyyy-MM-dd");
        } else if (range === "2Y") {
            start = format(subYears(maxDate, 2), "yyyy-MM-dd");
        } else if (range === "1Y") {
            start = format(subYears(maxDate, 1), "yyyy-MM-dd");
        } else if (range === "6M") {
            start = format(subMonths(maxDate, 6), "yyyy-MM-dd");
        } else if (range === "1M") {
            start = format(subMonths(maxDate, 1), "yyyy-MM-dd");
        }

        setLocalStartDate(start);
        setLocalEndDate(end);
    };

    const handleModalCustomDateChange = (type: "start" | "end", val: string) => {
        setModalActiveTimeRange("Custom");
        if (type === "start") setLocalStartDate(val);
        else setLocalEndDate(val);
    };

    const [internalSatellite, setInternalSatellite] = useState<string>("Sentinel-2");
    const activeSatellite = propSelectedSatellite || internalSatellite;

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

    const [tableSearchQuery, setTableSearchQuery] = useState<string>("");

    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [hoveredXRatio, setHoveredXRatio] = useState<number | null>(null);
    const [sharedXDomain, setSharedXDomain] = useState<[string, string] | null>(null);

    const chartContainerRef = useRef<HTMLDivElement>(null);

    const handleRelayout = (e: any) => {
        if (e["xaxis.range[0]"] && e["xaxis.range[1]"]) {
            setSharedXDomain([e["xaxis.range[0]"], e["xaxis.range[1]"]]);
        } else if (e["xaxis.autorange"]) {
            setSharedXDomain(null);
        }
    };

    const filteredVeg = useMemo(() => {
        if (!vegData) return [];
        return vegData.map((series) => ({
            ...series,
            observations: (series.observations || []).filter((obs: any) => {
                return obs.date >= localStartDate && obs.date <= localEndDate;
            }),
        }));
    }, [vegData, localStartDate, localEndDate]);

    const filteredClimate = useMemo(() => {
        if (!climateData) return [];
        return climateData.filter(
            (obs: any) => obs.date >= localStartDate && obs.date <= localEndDate
        );
    }, [climateData, localStartDate, localEndDate]);

    const filteredRadar = useMemo(() => {
        if (!radarData) return [];
        return radarData.filter(
            (obs: any) => obs.date >= localStartDate && obs.date <= localEndDate
        );
    }, [radarData, localStartDate, localEndDate]);

    const observations = useMemo(() => {
        return filteredVeg[0]?.observations || [];
    }, [filteredVeg]);

    const handleSatelliteSelect = (sat: string) => {
        setInternalSatellite(sat);
        if (onSatelliteChange) onSatelliteChange(sat);
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

    const handleMouseMoveContainer = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!chartContainerRef.current || observations.length === 0) return;
        const rect = chartContainerRef.current.getBoundingClientRect();
        const leftOffset = 52;
        const rightOffset = 16;
        const plotWidth = rect.width - leftOffset - rightOffset;
        const mouseXInPlot = e.clientX - rect.left - leftOffset;
        const ratio = Math.max(0, Math.min(1, mouseXInPlot / plotWidth));
        const idx = Math.min(
            observations.length - 1,
            Math.max(0, Math.floor(ratio * observations.length))
        );
        setHoveredIdx(idx);
        const plotPixelX = leftOffset + ratio * plotWidth;
        setHoveredXRatio((plotPixelX / rect.width) * 100);
    };

    const handleMouseLeaveContainer = () => {
        setHoveredIdx(null);
        setHoveredXRatio(null);
    };

    const handleDownloadCSV = () => {
        if (item?.type === "graph") {
            const headers = ["Date", "Satellite", ...activeMetrics];
            const rows = observations.map((o: any, idx: number) => {
                const rowVal = activeMetrics.map((m) => {
                    if (m === "NDVI") return o.smoothed;
                    if (m === "NDRE") return (o.raw * 0.82).toFixed(2);
                    if (m === "MOISTURE") return (o.raw * 0.65).toFixed(2);
                    if (m === "EVI") return (o.smoothed * 0.91).toFixed(2);
                    if (m === "SAVI") return (o.smoothed * 0.85).toFixed(2);
                    if (m === "GNDVI") return (o.smoothed * 0.78).toFixed(2);
                    if (m === "NDWI") return (o.raw * 0.52).toFixed(2);
                    if (m === "EN SOIL") return (o.raw * 0.45).toFixed(2);
                    if (m === "RAINFALL") return (filteredClimate[idx % (filteredClimate.length || 1)]?.rainfallMm || 0);
                    if (m === "RADAR VV") return (filteredRadar[idx % (filteredRadar.length || 1)]?.vv || -6.5);
                    if (m === "RADAR VH") return (filteredRadar[idx % (filteredRadar.length || 1)]?.vh || -15.2);
                    return o.smoothed;
                });
                return [o.date, activeSatellite, ...rowVal];
            });
            downloadCSV(`telemetry_stack_${activeSatellite}_${localStartDate}_to_${localEndDate}.csv`, headers, rows);
        } else if (item?.id === "soil") {
            const headers = ["Depth_cm", "pH", "OrganicC_g_kg", "Clay_pct", "Sand_pct", "Silt_pct", "CEC", "N_g_kg", "BulkDensity"];
            const rows = soilData.map((l: any) => [
                l.depthCm,
                l.pH,
                l.organicC,
                l.clayPct,
                l.sandPct,
                l.siltPct,
                l.cec,
                l.nitrogenGKg,
                l.bulkDensity,
            ]);
            downloadCSV(`soil_profile_matrix.csv`, headers, rows);
        } else if (item?.id === "phenology") {
            const headers = ["Year", "Start_Date", "Peak_Date", "End_Date", "Length_Days", "Amplitude", "AUC"];
            const rows = MOCK_DETECTED_SEASONS.map((s: any) => [
                s.year,
                s.start,
                s.peak,
                s.end,
                s.lengthD,
                s.amplitude,
                s.auc,
            ]);
            downloadCSV(`phenology_annual_summary.csv`, headers, rows);
        }
    };

    const filteredSoilRows = useMemo(() => {
        if (!soilData) return [];
        if (!tableSearchQuery.trim()) return soilData;
        const q = tableSearchQuery.toLowerCase();
        return soilData.filter((row: any) =>
            Object.values(row).some((val) => String(val).toLowerCase().includes(q))
        );
    }, [soilData, tableSearchQuery]);

    const filteredSeasonsRows = useMemo(() => {
        if (!MOCK_DETECTED_SEASONS) return [];
        if (!tableSearchQuery.trim()) return MOCK_DETECTED_SEASONS;
        const q = tableSearchQuery.toLowerCase();
        return MOCK_DETECTED_SEASONS.filter((row: any) =>
            Object.values(row).some((val) => String(val).toLowerCase().includes(q))
        );
    }, [tableSearchQuery]);

    const filteredAnnualRows = useMemo(() => {
        if (!MOCK_ANNUAL_SUMMARY) return [];
        if (!tableSearchQuery.trim()) return MOCK_ANNUAL_SUMMARY;
        const q = tableSearchQuery.toLowerCase();
        return MOCK_ANNUAL_SUMMARY.filter((row: any) =>
            Object.values(row).some((val) => String(val).toLowerCase().includes(q))
        );
    }, [tableSearchQuery]);

    const currentHoveredObs = hoveredIdx !== null ? observations[hoveredIdx] : null;

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Guaranteed 70vw Width & 70vh Height Pop-up via Direct Inline Styles */}
            <DialogContent
                hideDefaultClose={true}
                style={{
                    width: "70vw",
                    maxWidth: "70vw",
                    minWidth: "70vw",
                    height: "70vh",
                    maxHeight: "70vh",
                    minHeight: "70vh",
                }}
                className="p-0 bg-background border border-border rounded-xl shadow-2xl overflow-hidden z-[2000] flex flex-col"
            >
                {/* Header Control Bar */}
                <DialogHeader className="p-3.5 border-b border-border flex flex-col gap-2 shrink-0 bg-card/60 backdrop-blur-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground">
                                {item.title}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-medium">
                                {item.subtitle}
                            </DialogDescription>
                        </div>

                        {/* Right Action Controls */}
                        <div className="flex items-center gap-2">
                            {/* Search Input with Crisp Outline Border */}
                            {item.type === "table" && (
                                <div className="relative w-48">
                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search in table..."
                                        value={tableSearchQuery}
                                        onChange={(e) => setTableSearchQuery(e.target.value)}
                                        className="h-8 pl-8 pr-2 text-xs bg-background border border-input rounded-lg shadow-2xs focus:ring-1 focus:ring-ring"
                                    />
                                </div>
                            )}

                            {/* 1. Download CSV Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDownloadCSV}
                                className="h-8 gap-1.5 text-xs font-semibold hover:bg-accent border-0 shadow-none cursor-pointer"
                            >
                                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                Export CSV
                            </Button>

                            {/* 2. Guaranteed Working Satellite Dropdown Menu */}
                            <div className="relative" ref={satDropdownRef}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsSatDropdownOpen((prev) => !prev)}
                                    className="h-8 gap-1.5 px-2 text-xs font-semibold hover:bg-accent text-foreground border-0 shadow-none cursor-pointer flex items-center"
                                >
                                    <Satellite className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span>{activeSatellite}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-0.5 shrink-0 transition-transform ${isSatDropdownOpen ? "rotate-180" : ""}`} />
                                </Button>

                                {isSatDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-44 p-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-[9999] flex flex-col gap-0.5">
                                        {["Sentinel-2", "Landsat 8/9", "MODIS", "PlanetScope"].map((sat) => (
                                            <button
                                                key={sat}
                                                type="button"
                                                onClick={() => {
                                                    handleSatelliteSelect(sat);
                                                    setIsSatDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                                                    activeSatellite === sat
                                                        ? "bg-accent text-accent-foreground font-semibold"
                                                        : "hover:bg-muted text-foreground"
                                                }`}
                                            >
                                                <span>{sat}</span>
                                                {activeSatellite === sat && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-4 w-px bg-border my-auto mx-0.5 shrink-0" />

                            {/* Header Inline Ghost Close Button (X) */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent border-0 shadow-none cursor-pointer flex items-center justify-center shrink-0"
                                title="Close dialog"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Metric Selector Toggle Pills Bar (for Graphs) */}
                    {item.type === "graph" && (
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1 select-none">
                                Graphs:
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
                    )}
                </DialogHeader>

                {/* Body Area: Fill Height Tables to Utilize 100% of Pop-up Height */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 bg-background flex flex-col justify-between">
                    {item.type === "graph" ? (
                        <div className="flex-1 flex flex-col min-h-0 relative select-none overflow-hidden h-full">
                            <div
                                ref={chartContainerRef}
                                onMouseMove={handleMouseMoveContainer}
                                onMouseLeave={handleMouseLeaveContainer}
                                className="flex-1 flex flex-col justify-between overflow-y-auto px-4 py-2 space-y-2 relative cursor-crosshair min-h-0 scrollbar-thin"
                            >
                                {hoveredXRatio !== null && (
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-zinc-800 dark:bg-zinc-200 z-20 pointer-events-none transition-all duration-75 shadow-sm"
                                        style={{ left: `${hoveredXRatio}%` }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100 -translate-x-[3.5px] -translate-y-1 border border-white" />
                                    </div>
                                )}

                                {activeMetrics.map((metricId) => {
                                    const metric = ALL_AVAILABLE_METRICS.find((m) => m.id === metricId) || {
                                        id: metricId,
                                        label: metricId,
                                        color: "#2563eb",
                                        minY: -0.75,
                                        maxY: 1.0,
                                        unit: "",
                                        category: "veg" as const,
                                    };

                                    const metricValues = observations.map((o: any, idx: number) => {
                                        if (metric.id === "NDVI") return o.smoothed;
                                        if (metric.id === "NDRE") return (o.raw * 0.82);
                                        if (metric.id === "MOISTURE") return (o.raw * 0.65);
                                        if (metric.id === "EVI") return (o.smoothed * 0.91);
                                        if (metric.id === "SAVI") return (o.smoothed * 0.85);
                                        if (metric.id === "GNDVI") return (o.smoothed * 0.78);
                                        if (metric.id === "NDWI") return (o.raw * 0.52);
                                        if (metric.id === "EN SOIL") return (o.raw * 0.45);
                                        if (metric.id === "RAINFALL") return (filteredClimate[idx % (filteredClimate.length || 1)]?.rainfallMm || 0);
                                        if (metric.id === "RADAR VV") return (filteredRadar[idx % (filteredRadar.length || 1)]?.vv || -6.5);
                                        if (metric.id === "RADAR VH") return (filteredRadar[idx % (filteredRadar.length || 1)]?.vh || -15.2);
                                        return o.smoothed;
                                    });

                                    const currentMetricVal = hoveredIdx !== null ? metricValues[hoveredIdx] : null;

                                    return (
                                        <div
                                            key={metric.id}
                                            className="relative flex items-stretch border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs group hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex-1 min-h-[60px]"
                                        >
                                            <div className="w-7 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 flex items-center justify-center py-2 shrink-0 select-none">
                                                <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-extrabold uppercase tracking-wider">
                                                    {metric.label}
                                                </span>
                                            </div>

                                            <div className="flex-1 h-full min-h-0 relative px-2 flex flex-col justify-center">
                                                <Plot
                                                    data={[
                                                        {
                                                            x: observations.map((o: any) => o.date),
                                                            y: metricValues,
                                                            type: metric.id === "RAINFALL" ? "bar" : "scatter",
                                                            mode: metric.id === "RAINFALL" ? undefined : "lines+markers",
                                                            line: { color: metric.color, width: 2, shape: "spline" },
                                                            marker: { size: 3, color: metric.color },
                                                        },
                                                    ]}
                                                    layout={{
                                                        autosize: true,
                                                        margin: { l: 25, r: 10, t: 5, b: 15 },
                                                        showlegend: false,
                                                        paper_bgcolor: "transparent",
                                                        plot_bgcolor: "transparent",
                                                        xaxis: {
                                                            showgrid: true,
                                                            gridcolor: "#f4f4f5",
                                                            showticklabels: false,
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
                                                        hovermode: false,
                                                    }}
                                                    onRelayout={handleRelayout}
                                                    useResizeHandler={true}
                                                    style={{ width: "100%", height: "100%" }}
                                                    className="w-full h-full"
                                                    config={{ responsive: true, displayModeBar: false }}
                                                />

                                                {currentMetricVal !== null && currentHoveredObs && hoveredXRatio !== null && (
                                                    <div
                                                        className="absolute z-40 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-50 border border-zinc-200/90 dark:border-zinc-700/90 rounded-md px-2 py-0.5 shadow-lg text-[10px] font-mono pointer-events-none -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md"
                                                        style={{
                                                            left: `${hoveredXRatio}%`,
                                                            top: "35%",
                                                        }}
                                                    >
                                                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">{currentHoveredObs.date}</span>
                                                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                                            {metric.label}: {typeof currentMetricVal === "number" ? currentMetricVal.toFixed(2) : currentMetricVal} {metric.unit || ""}
                                                        </span>
                                                        <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white dark:border-t-zinc-900" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="shrink-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-20 py-2.5 flex items-center justify-between text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 shadow-md z-30">
                                <span>'22</span>
                                <span>'23</span>
                                <span>'24</span>
                                <span>'25</span>
                                <span>'26</span>
                            </div>
                        </div>
                    ) : (
                        /* Fill Height Table View: Fully Stretching Containers & Rows */
                        <div className="flex-1 flex flex-col justify-between min-h-0 h-full space-y-4">
                            <div className="flex-1 min-h-0 flex flex-col justify-between space-y-4 overflow-y-auto">
                                {item.id === "soil" && (
                                    <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden shadow-2xs flex flex-col">
                                        <Table className="h-full">
                                            <TableHeader className="bg-muted/70 backdrop-blur-xs sticky top-0 z-10">
                                                <TableRow className="border-b border-border">
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Depth (cm)</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">pH</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organic C (g/kg)</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clay %</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sand %</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Silt %</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CEC</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">N (g/kg)</TableHead>
                                                    <TableHead className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bulk Density</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="font-mono text-xs">
                                                {filteredSoilRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                                            No matching records found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredSoilRows.map((layer: any) => (
                                                        <TableRow key={layer.depthCm} className="hover:bg-muted/50 border-b border-border/80">
                                                            <TableCell className="py-3.5 px-4 font-bold text-foreground">{layer.depthCm}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.pH}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{layer.organicC}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.clayPct}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.sandPct}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.siltPct}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.cec}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.nitrogenGKg}</TableCell>
                                                            <TableCell className="py-3.5 px-4 text-foreground">{layer.bulkDensity}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                {item.id === "phenology" && (
                                    <div className="flex-1 flex flex-col justify-between space-y-4">
                                        {/* Table 1: Detected Seasons (NDVI) */}
                                        <div className="flex-1 flex flex-col space-y-2">
                                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground px-0.5">
                                                Detected Seasons (NDVI)
                                            </div>
                                            <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden shadow-2xs flex flex-col">
                                                <Table className="h-full">
                                                    <TableHeader className="bg-muted/70 backdrop-blur-xs sticky top-0 z-10">
                                                        <TableRow className="border-b border-border">
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Year</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Start</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Peak</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">End</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Length (D)</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Amplitude</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">AUC</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody className="font-mono text-xs">
                                                        {filteredSeasonsRows.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                                                    No matching seasons.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            filteredSeasonsRows.map((row: any) => (
                                                                <TableRow key={row.year} className="hover:bg-muted/50 border-b border-border/80">
                                                                    <TableCell className="py-3 px-4 font-bold text-foreground">{row.year}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.start}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{row.peak}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.end}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.lengthD} days</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.amplitude?.toFixed(3)}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.auc?.toFixed(1)}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {/* Table 2: Annual Summary */}
                                        <div className="flex-1 flex flex-col space-y-2 pt-1">
                                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground px-0.5">
                                                Annual Summary
                                            </div>
                                            <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden shadow-2xs flex flex-col">
                                                <Table className="h-full">
                                                    <TableHeader className="bg-muted/70 backdrop-blur-xs sticky top-0 z-10">
                                                        <TableRow className="border-b border-border">
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Year</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Rain (mm)</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">ETo (mm)</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">GDD</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Heat Days</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">Dry Days</TableHead>
                                                            <TableHead className="py-3 px-4 text-[10px] font-bold uppercase text-muted-foreground">NDVI Mean</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody className="font-mono text-xs">
                                                        {filteredAnnualRows.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                                                    No matching annual records.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            filteredAnnualRows.map((row: any) => (
                                                                <TableRow key={row.year} className="hover:bg-muted/50 border-b border-border/80">
                                                                    <TableCell className="py-3 px-4 font-bold text-foreground">{row.year}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.rainMm}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.etoMm}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.gdd}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.heatDays}</TableCell>
                                                                    <TableCell className="py-3 px-4 text-muted-foreground">{row.dryDays}</TableCell>
                                                                    <TableCell className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{row.ndviMean?.toFixed(3)}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
