"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { MOCK_SCIENCE_PLOTS, SciencePlot } from "./data/mock-science-data";
import dynamic from "next/dynamic";
import { PlotsSidebar } from "./components/plots-sidebar";
import { SciencePlotlyCharts } from "./components/science-plotly-charts";
import { SearchDialog } from "./components/search-dialog";

const ScienceMap = dynamic(() => import("./components/science-map").then((mod) => mod.ScienceMap), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full min-h-[400px] bg-zinc-900 flex items-center justify-center text-zinc-400 text-sm font-mono">
            Loading Satellite Engine...
        </div>
    )
});
import { ComparisonWorkspaceModal } from "./components/comparison-workspace-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, User, Home, ArrowLeftRight, MapPin, Filter, ChevronDown, Check } from "lucide-react";
import { format } from "date-fns";

export default function ScienceAnalysisPage() {
    const mainContainerRef = useRef<HTMLDivElement>(null);

    // Plots state
    const [addedPlotIds, setAddedPlotIds] = useState<string[]>([]);
    const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>("2022-01-01");
    const [endDate, setEndDate] = useState<string>("2026-08-15");
    const [selectedGraphDate, setSelectedGraphDate] = useState<string | null>(null);

    // Minimizable Plots Sidebar State
    const [isPlotsMinimized, setIsPlotsMinimized] = useState<boolean>(false);

    // Pixel width for Right Analytics Panel when Plots Sidebar is OPEN
    const [rightPanelWidthPx, setRightPanelWidthPx] = useState<number>(500);

    // Pixel width for Right Analytics Panel when Plots Sidebar is MINIMIZED (Default: 40% of container)
    const [minimizedRightWidthPx, setMinimizedRightWidthPx] = useState<number | null>(null);

    const [isDragging, setIsDragging] = useState<boolean>(false);

    // 2 Separate Popover Filter Dropdowns state: Farmer & Village
    const [selectedFarmer, setSelectedFarmer] = useState<string>("all");
    const [selectedVillage, setSelectedVillage] = useState<string>("all");

    const [farmerSearchQuery, setFarmerSearchQuery] = useState<string>("");
    const [villageSearchQuery, setVillageSearchQuery] = useState<string>("");

    const [isFarmerDropdownOpen, setIsFarmerDropdownOpen] = useState<boolean>(false);
    const [isVillageDropdownOpen, setIsVillageDropdownOpen] = useState<boolean>(false);

    // Metrics Category State
    const [activeTimeRange, setActiveTimeRange] = useState<"All" | "5Y" | "2Y" | "1Y" | "6M" | "3M" | "1M" | "Custom">("All");

    // Dialogs state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);

    // Auto-calculate initial 60-40 split when container mounts or resizes
    useEffect(() => {
        if (!mainContainerRef.current) return;
        const updateDefaultSplit = () => {
            if (mainContainerRef.current && minimizedRightWidthPx === null) {
                const totalW = mainContainerRef.current.getBoundingClientRect().width;
                setMinimizedRightWidthPx(Math.round(totalW * 0.40));
            }
        };

        updateDefaultSplit();
        const observer = new ResizeObserver(updateDefaultSplit);
        observer.observe(mainContainerRef.current);
        return () => observer.disconnect();
    }, [minimizedRightWidthPx]);

    // Toggle Plots Sidebar minimize state & trigger window resize event for Plotly & Leaflet
    const handleTogglePlotsSidebar = useCallback(() => {
        setIsPlotsMinimized((prev) => {
            const next = !prev;
            if (next && mainContainerRef.current) {
                const totalW = mainContainerRef.current.getBoundingClientRect().width;
                setMinimizedRightWidthPx(Math.round(totalW * 0.40));
            }
            return next;
        });

        // Fire resize event so Leaflet map and Plotly SVG graphs auto-adjust canvas width!
        setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
        setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
    }, []);

    // Mouse Dragging for Resizing Right Panel
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !mainContainerRef.current) return;
            const containerRect = mainContainerRef.current.getBoundingClientRect();
            const rawRightWidth = containerRect.right - e.clientX;

            if (isPlotsMinimized) {
                // Constrain right panel between 20% and 80% of total main container width
                const minW = containerRect.width * 0.20;
                const maxW = containerRect.width * 0.80;
                const clampedW = Math.min(Math.max(rawRightWidth, minW), maxW);
                setMinimizedRightWidthPx(clampedW);
            } else {
                // Constrain right panel between 320px and (container - 320px)
                const maxW = containerRect.width - 320;
                const clampedW = Math.min(Math.max(rawRightWidth, 320), maxW);
                setRightPanelWidthPx(clampedW);
            }

            // Immediately trigger resize event so Plotly charts re-render SVG at 100% width on every drag frame!
            window.dispatchEvent(new Event("resize"));
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                window.dispatchEvent(new Event("resize"));
            }
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, isPlotsMinimized]);

    // Available Farmers & Villages list
    const farmersList = useMemo(() => Array.from(new Set(MOCK_SCIENCE_PLOTS.map((p) => p.farmerName))), []);
    const villagesList = useMemo(() => Array.from(new Set(MOCK_SCIENCE_PLOTS.map((p) => p.village))), []);

    const filteredFarmersList = useMemo(() => {
        if (!farmerSearchQuery.trim()) return farmersList;
        return farmersList.filter((f) => f.toLowerCase().includes(farmerSearchQuery.toLowerCase()));
    }, [farmersList, farmerSearchQuery]);

    const filteredVillagesList = useMemo(() => {
        if (!villageSearchQuery.trim()) return villagesList;
        return villagesList.filter((v) => v.toLowerCase().includes(villageSearchQuery.toLowerCase()));
    }, [villagesList, villageSearchQuery]);

    // Filter plots based on Farmer or Village dropdown filter
    const displayedPlots = useMemo(() => {
        if (selectedFarmer !== "all") {
            return MOCK_SCIENCE_PLOTS.filter((p) => p.farmerName === selectedFarmer);
        }
        if (selectedVillage !== "all") {
            return MOCK_SCIENCE_PLOTS.filter((p) => p.village === selectedVillage);
        }
        return MOCK_SCIENCE_PLOTS;
    }, [selectedFarmer, selectedVillage]);

    // Handle plot polygon toggle selection
    const handleTogglePlot = (plotId: string) => {
        if (isPlotsMinimized) {
            setIsPlotsMinimized(false);
        }

        setAddedPlotIds((prevAdded) => {
            const isAlreadyAdded = prevAdded.includes(plotId);
            if (!isAlreadyAdded) {
                const newAdded = [...prevAdded, plotId];
                // If this is the FIRST plot added, automatically select it!
                if (prevAdded.length === 0) {
                    setSelectedPlotIds([plotId]);
                }
                return newAdded;
            } else {
                // If already added, toggle its selected state
                setSelectedPlotIds((prevSelected) =>
                    prevSelected.includes(plotId)
                        ? prevSelected.filter((id) => id !== plotId)
                        : [...prevSelected, plotId]
                );
                return prevAdded;
            }
        });
    };

    const handleToggleSelectPlot = (plotId: string) => {
        setSelectedPlotIds((prevSelected) =>
            prevSelected.includes(plotId)
                ? prevSelected.filter((id) => id !== plotId)
                : [...prevSelected, plotId]
        );
    };

    const handleRemovePlotFromList = (plotId: string) => {
        setAddedPlotIds((prev) => prev.filter((id) => id !== plotId));
        setSelectedPlotIds((prev) => prev.filter((id) => id !== plotId));
    };

    const handleRemoveAllSelected = () => {
        setAddedPlotIds((prev) => prev.filter((id) => !selectedPlotIds.includes(id)));
        setSelectedPlotIds([]);
    };

    const selectedPlots = useMemo(() => {
        return MOCK_SCIENCE_PLOTS.filter((p) => selectedPlotIds.includes(p.id));
    }, [selectedPlotIds]);

    // Active width for the right analytics panel
    const currentRightWidth = isPlotsMinimized
        ? (minimizedRightWidthPx ?? 520)
        : rightPanelWidthPx;

    return (
        <NavBarType4
            pageTitle="Science Analysis Dashboard"
            activeItemUrl="#science-analysis"
            pageDescription="Comprehensive satellite-driven agricultural analytics dashboard. Review vegetation spectral indices, climate telemetry, soil profile depth matrix, Sentinel-1 radar backscatter, and crop phenology."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden min-w-0 w-full bg-zinc-100 dark:bg-zinc-950 select-none relative">
                {/* Full screen backdrop during mouse dragging to prevent pointer trapping */}
                {isDragging && (
                    <div className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent" />
                )}

                {/* Main Resizable & Minimizable Split Layout */}
                <div ref={mainContainerRef} className="flex-1 min-h-0 flex overflow-hidden relative w-full">
                    {/* Left Section: Satellite Map (Flexibly takes all remaining space) */}
                    <div className="flex-1 h-full relative overflow-hidden min-w-[280px]">
                        <ScienceMap
                            plots={displayedPlots}
                            addedPlotIds={addedPlotIds}
                            selectedPlotIds={selectedPlotIds}
                            onTogglePlot={handleTogglePlot}
                            onOpenSearch={() => setIsSearchOpen(true)}
                            startDate={startDate}
                            endDate={endDate}
                            selectedGraphDate={selectedGraphDate}
                            selectedFarmer={selectedFarmer}
                            selectedVillage={selectedVillage}
                            farmersList={farmersList}
                            villagesList={villagesList}
                            onFarmerSelect={(f) => {
                                setSelectedFarmer(f);
                                if (f === "all") {
                                    setAddedPlotIds([]);
                                    setSelectedPlotIds([]);
                                } else {
                                    setSelectedVillage("all");
                                    const fPlots = MOCK_SCIENCE_PLOTS.filter((p) => p.farmerName === f).map((p) => p.id);
                                    setAddedPlotIds(fPlots);
                                    setSelectedPlotIds(fPlots.length > 0 ? [fPlots[0]] : []);
                                }
                                setIsPlotsMinimized(false);
                                setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
                            }}
                            onVillageSelect={(v) => {
                                setSelectedVillage(v);
                                if (v === "all") {
                                    setAddedPlotIds([]);
                                    setSelectedPlotIds([]);
                                } else {
                                    setSelectedFarmer("all");
                                    const vPlots = MOCK_SCIENCE_PLOTS.filter((p) => p.village === v).map((p) => p.id);
                                    setAddedPlotIds(vPlots);
                                    setSelectedPlotIds(vPlots.length > 0 ? [vPlots[0]] : []);
                                }
                                setIsPlotsMinimized(false);
                                setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
                            }}
                            onResetFilters={() => {
                                setSelectedFarmer("all");
                                setSelectedVillage("all");
                                setAddedPlotIds([]);
                                setSelectedPlotIds([]);
                            }}
                        />
                    </div>

                    {/* Middle Section: Minimizable Plots Sidebar Section */}
                    <div
                        className={`h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
                            isPlotsMinimized ? "w-0 opacity-0 pointer-events-none" : "w-72 opacity-100"
                        }`}
                    >
                        <PlotsSidebar
                            plots={displayedPlots}
                            addedPlotIds={addedPlotIds}
                            selectedPlotIds={selectedPlotIds}
                            onTogglePlot={handleTogglePlot}
                            onToggleSelectPlot={handleToggleSelectPlot}
                            onRemovePlot={handleRemovePlotFromList}
                            onRemoveAllSelected={handleRemoveAllSelected}
                            isMinimized={isPlotsMinimized}
                            onToggleMinimize={handleTogglePlotsSidebar}
                        />
                    </div>

                    {/* Compact Draggable Resizer Line Handle */}
                    <div
                        onMouseDown={startResizing}
                        className={`w-2 -mx-1 cursor-col-resize flex items-center justify-center bg-transparent hover:bg-zinc-300/60 dark:hover:bg-zinc-700/60 z-20 group shrink-0 transition-colors ${
                            isDragging ? "bg-zinc-400 dark:bg-zinc-600" : ""
                        }`}
                        title="Drag to adjust panel width"
                    >
                        <div className="w-[1px] h-full bg-zinc-200 dark:bg-zinc-800 group-hover:bg-zinc-500 transition-colors" />
                    </div>

                    {/* Right Section: Resizable Analytical Dashboard Panel */}
                    <div
                        style={{ width: `${currentRightWidth}px` }}
                        className={`h-full shrink-0 overflow-hidden bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 ${
                            isDragging ? "transition-none" : "transition-[width] duration-300 ease-in-out"
                        }`}
                    >
                        <SciencePlotlyCharts
                            selectedPlots={selectedPlots}
                            activeTimeRange={activeTimeRange}
                            onTimeRangeChange={setActiveTimeRange}
                            startDate={startDate}
                            endDate={endDate}
                            onDateRangeChange={(start, end) => {
                                setStartDate(start);
                                setEndDate(end);
                            }}
                            onOpenComparison={() => setIsComparisonOpen(true)}
                            isPlotsMinimized={isPlotsMinimized}
                            onTogglePlotsSidebar={handleTogglePlotsSidebar}
                            selectedPlotsCount={selectedPlotIds.length}
                            selectedGraphDate={selectedGraphDate}
                            onSelectGraphDate={setSelectedGraphDate}
                        />
                    </div>
                </div>

                {/* Footer Section */}
                <div className="shrink-0 py-2.5 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <div className="flex items-center gap-4">
                            <span>Version 2.5.0-science</span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span>All rights reserved by Mati Carbon Pvt</span>
                                <button className="text-zinc-900 dark:text-zinc-300 hover:underline font-bold">TnC</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 font-mono">
                            <span>Session ID: MC-SCI-9021</span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <span suppressHydrationWarning>Refreshed: {format(new Date(), "dd MMM yyyy, hh:mm aa")}</span>
                        </div>
                    </div>
                </div>

                {/* Search Dialog */}
                <SearchDialog
                    open={isSearchOpen}
                    onOpenChange={setIsSearchOpen}
                    plots={displayedPlots}
                    selectedPlotIds={selectedPlotIds}
                    onSelectPlot={handleTogglePlot}
                />

                {/* User Story 3 Secondary Comparative Workspace Modal */}
                <ComparisonWorkspaceModal
                    open={isComparisonOpen}
                    onOpenChange={setIsComparisonOpen}
                    plots={MOCK_SCIENCE_PLOTS}
                />
            </div>
        </NavBarType4>
    );
}
