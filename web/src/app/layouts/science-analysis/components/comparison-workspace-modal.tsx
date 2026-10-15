"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { SciencePlot, MOCK_VEGETATION_INDICES, MOCK_CLIMATE_DATA } from "../data/mock-science-data";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X, Layers, Download, SlidersHorizontal, ArrowLeftRight } from "lucide-react";

// Dynamically import Plotly factory component with SSR disabled
const Plot = dynamic(() => import("./PlotlyComponent"), { ssr: false });

interface ComparisonWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plots: SciencePlot[];
}

export function ComparisonWorkspaceModal({
    open,
    onOpenChange,
    plots,
}: ComparisonWorkspaceModalProps) {
    const [plotAId, setPlotAId] = useState<string>(plots[0]?.id || "plot-01");
    const [plotBId, setPlotBId] = useState<string>(plots[1]?.id || "plot-04");
    const [activeTab, setActiveTab] = useState<"plotComparison" | "correlation" | "sourceFilter">("plotComparison");

    // Satellite Sensor Toggles
    const [showSentinel, setShowSentinel] = useState(true);
    const [showLandsat, setShowLandsat] = useState(true);
    const [showPlanet, setShowPlanet] = useState(true);

    const plotA = plots.find((p) => p.id === plotAId) || plots[0];
    const plotB = plots.find((p) => p.id === plotBId) || plots[1] || plots[0];

    const plotAVeg = MOCK_VEGETATION_INDICES[plotA.id] || MOCK_VEGETATION_INDICES["plot-01"];
    const plotBVeg = MOCK_VEGETATION_INDICES[plotB.id] || MOCK_VEGETATION_INDICES["plot-01"];

    const plotANDVI = plotAVeg.find((v) => v.key === "NDVI")?.observations || [];
    const plotBNDVI = plotBVeg.find((v) => v.key === "NDVI")?.observations || [];

    // Export CSV handler
    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,Date,Plot_A_NDVI,Plot_B_NDVI\n";
        plotANDVI.forEach((obs, idx) => {
            const bVal = plotBNDVI[idx]?.smoothed || 0;
            csvContent += `${obs.date},${obs.smoothed},${bVal}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `mati_secondary_analysis_${plotA.name}_vs_${plotB.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1300px] h-[90vh] p-0 flex flex-col bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl overflow-hidden z-[700]">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5 text-emerald-500" />
                            Secondary Data Analysis & Comparative Workspace
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            Perform multi-plot cross-correlation, satellite sensor spectral comparison, and seasonal trend analytics.
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            className="h-9 gap-1.5 text-xs font-semibold border-zinc-300 dark:border-zinc-700"
                        >
                            <Download className="h-4 w-4" />
                            Export Analytical CSV
                        </Button>
                    </div>
                </DialogHeader>

                {/* Workspace Body */}
                <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
                    {/* Control Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0 mb-4">
                        {/* Target Selectors */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Plot A:</span>
                                <select
                                    value={plotAId}
                                    onChange={(e) => setPlotAId(e.target.value)}
                                    className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                                >
                                    {plots.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.farmerName})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <span className="text-xs font-bold text-zinc-400">VS</span>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Plot B:</span>
                                <select
                                    value={plotBId}
                                    onChange={(e) => setPlotBId(e.target.value)}
                                    className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                                >
                                    {plots.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.farmerName})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800/60 p-1 rounded-lg text-xs font-medium">
                            <button
                                onClick={() => setActiveTab("plotComparison")}
                                className={`px-3 py-1.5 rounded-md transition-all ${
                                    activeTab === "plotComparison"
                                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                                }`}
                            >
                                Plot vs Plot Overlay
                            </button>
                            <button
                                onClick={() => setActiveTab("correlation")}
                                className={`px-3 py-1.5 rounded-md transition-all ${
                                    activeTab === "correlation"
                                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                                }`}
                            >
                                Multi-Metric Correlation Scatter
                            </button>
                            <button
                                onClick={() => setActiveTab("sourceFilter")}
                                className={`px-3 py-1.5 rounded-md transition-all ${
                                    activeTab === "sourceFilter"
                                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                                }`}
                            >
                                Satellite Sensor Filtering
                            </button>
                        </div>
                    </div>

                    {/* Active View Container */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-hidden">
                        {/* TAB 1: PLOT VS PLOT OVERLAY */}
                        {activeTab === "plotComparison" && (
                            <div className="h-full flex flex-col">
                                <div className="text-xs text-zinc-500 font-medium mb-2">
                                    Direct Vegetation Index (NDVI) trajectory comparison between <strong className="text-emerald-600">{plotA.name}</strong> and <strong className="text-blue-600">{plotB.name}</strong>.
                                </div>
                                <div className="flex-1 min-h-0">
                                    <Plot
                                        data={[
                                            {
                                                x: plotANDVI.map((o) => o.date),
                                                y: plotANDVI.map((o) => o.smoothed),
                                                name: `${plotA.name} (${plotA.farmerName})`,
                                                type: "scatter",
                                                mode: "lines+markers",
                                                line: { color: "#10b981", width: 3 }
                                            },
                                            {
                                                x: plotBNDVI.map((o) => o.date),
                                                y: plotBNDVI.map((o) => o.smoothed),
                                                name: `${plotB.name} (${plotB.farmerName})`,
                                                type: "scatter",
                                                mode: "lines+markers",
                                                line: { color: "#3b82f6", width: 3, dash: "dot" }
                                            }
                                        ]}
                                        layout={{
                                            autosize: true,
                                            margin: { l: 50, r: 20, t: 20, b: 50 },
                                            showlegend: true,
                                            legend: { orientation: "h", y: -0.15 },
                                            paper_bgcolor: "transparent",
                                            plot_bgcolor: "transparent",
                                            xaxis: { title: "Telemetry Date", gridcolor: "#e4e4e7" },
                                            yaxis: { title: "NDVI Index Value", gridcolor: "#e4e4e7" },
                                            hovermode: "x unified"
                                        }}
                                        useResizeHandler={true}
                                        className="w-full h-full"
                                        config={{ displayModeBar: true }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 2: MULTI-METRIC CORRELATION SCATTER */}
                        {activeTab === "correlation" && (
                            <div className="h-full flex flex-col">
                                <div className="text-xs text-zinc-500 font-medium mb-2">
                                    Scatter correlation between <strong>Precipitation (Rainfall mm)</strong> and <strong>Vegetation NDVI</strong> response.
                                </div>
                                <div className="flex-1 min-h-0">
                                    <Plot
                                        data={[
                                            {
                                                x: MOCK_CLIMATE_DATA.map((c) => c.rainfallMm),
                                                y: plotANDVI.slice(0, MOCK_CLIMATE_DATA.length).map((o) => o.smoothed),
                                                name: `${plotA.name} Correlation`,
                                                type: "scatter",
                                                mode: "markers",
                                                marker: { size: 10, color: "#10b981" }
                                            },
                                            {
                                                x: MOCK_CLIMATE_DATA.map((c) => c.rainfallMm),
                                                y: plotBNDVI.slice(0, MOCK_CLIMATE_DATA.length).map((o) => o.smoothed),
                                                name: `${plotB.name} Correlation`,
                                                type: "scatter",
                                                mode: "markers",
                                                marker: { size: 10, color: "#3b82f6" }
                                            }
                                        ]}
                                        layout={{
                                            autosize: true,
                                            margin: { l: 50, r: 20, t: 20, b: 50 },
                                            showlegend: true,
                                            legend: { orientation: "h", y: -0.15 },
                                            paper_bgcolor: "transparent",
                                            plot_bgcolor: "transparent",
                                            xaxis: { title: "Rainfall (mm)", gridcolor: "#e4e4e7" },
                                            yaxis: { title: "Vegetation NDVI", gridcolor: "#e4e4e7" },
                                            hovermode: "closest"
                                        }}
                                        useResizeHandler={true}
                                        className="w-full h-full"
                                        config={{ displayModeBar: true }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 3: SATELLITE SENSOR FILTERING */}
                        {activeTab === "sourceFilter" && (
                            <div className="h-full flex flex-col">
                                <div className="flex items-center gap-4 mb-3">
                                    <span className="text-xs font-bold text-zinc-500">Toggle Satellite Sources:</span>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showSentinel}
                                            onChange={(e) => setShowSentinel(e.target.checked)}
                                            className="rounded border-zinc-300"
                                        />
                                        <span>Sentinel-2 (ESA)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showLandsat}
                                            onChange={(e) => setShowLandsat(e.target.checked)}
                                            className="rounded border-zinc-300"
                                        />
                                        <span>Landsat 8/9 (USGS)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showPlanet}
                                            onChange={(e) => setShowPlanet(e.target.checked)}
                                            className="rounded border-zinc-300"
                                        />
                                        <span>PlanetScope (3m High-Res)</span>
                                    </label>
                                </div>

                                <div className="flex-1 min-h-0">
                                    <Plot
                                        data={[
                                            ...(showSentinel
                                                ? [
                                                      {
                                                          x: plotANDVI.map((o) => o.date),
                                                          y: plotANDVI.map((o) => o.sentinel2),
                                                          name: "Sentinel-2 Scatter",
                                                          type: "scatter",
                                                          mode: "markers",
                                                          marker: { color: "#3b82f6", size: 6 }
                                                      }
                                                  ]
                                                : []),
                                            ...(showLandsat
                                                ? [
                                                      {
                                                          x: plotANDVI.map((o) => o.date),
                                                          y: plotANDVI.map((o) => o.landsat),
                                                          name: "Landsat 8/9 Scatter",
                                                          type: "scatter",
                                                          mode: "markers",
                                                          marker: { color: "#f59e0b", size: 6 }
                                                      }
                                                  ]
                                                : []),
                                            ...(showPlanet
                                                ? [
                                                      {
                                                          x: plotANDVI.map((o) => o.date),
                                                          y: plotANDVI.map((o) => o.planetScope),
                                                          name: "PlanetScope Scatter",
                                                          type: "scatter",
                                                          mode: "markers",
                                                          marker: { color: "#ec4899", size: 6 }
                                                      }
                                                  ]
                                                : []),
                                            {
                                                x: plotANDVI.map((o) => o.date),
                                                y: plotANDVI.map((o) => o.smoothed),
                                                name: "Composite Fit Curve",
                                                type: "scatter",
                                                mode: "lines",
                                                line: { color: "#10b981", width: 3 }
                                            }
                                        ]}
                                        layout={{
                                            autosize: true,
                                            margin: { l: 50, r: 20, t: 20, b: 50 },
                                            showlegend: true,
                                            legend: { orientation: "h", y: -0.15 },
                                            paper_bgcolor: "transparent",
                                            plot_bgcolor: "transparent",
                                            xaxis: { title: "Date", gridcolor: "#e4e4e7" },
                                            yaxis: { title: "NDVI Index Value", gridcolor: "#e4e4e7" }
                                        }}
                                        useResizeHandler={true}
                                        className="w-full h-full"
                                        config={{ displayModeBar: true }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
