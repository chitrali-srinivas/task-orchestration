"use client";

import React, { useState } from "react";
import { SciencePlot } from "../data/mock-science-data";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Info, MapPin, PanelLeftClose, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface PlotsSidebarProps {
    plots: SciencePlot[];
    addedPlotIds: string[];
    selectedPlotIds: string[];
    onTogglePlot: (plotId: string) => void;
    onToggleSelectPlot: (plotId: string) => void;
    onRemovePlot: (plotId: string) => void;
    onRemoveAllSelected: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

export function PlotsSidebar({
    plots,
    addedPlotIds,
    selectedPlotIds,
    onTogglePlot,
    onToggleSelectPlot,
    onRemovePlot,
    onRemoveAllSelected,
    isMinimized = false,
    onToggleMinimize,
}: PlotsSidebarProps) {
    const [expandedPlotIds, setExpandedPlotIds] = useState<string[]>(["plot-01"]);
    const [detailPlot, setDetailPlot] = useState<SciencePlot | null>(null);

    const selectedCount = selectedPlotIds.length;

    const toggleExpand = (plotId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedPlotIds((prev) =>
            prev.includes(plotId)
                ? prev.filter((id) => id !== plotId)
                : [...prev, plotId]
        );
    };

    // If Minimized state is active, hide sidebar container
    if (isMinimized) {
        return null;
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 min-w-0 select-none">
            {/* Header with Minimize Button - Clean Bottom Separator */}
            <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h2 className="text-xs font-black tracking-tight uppercase text-zinc-900 dark:text-zinc-50">
                    Plots Selected
                </h2>

                {onToggleMinimize && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleMinimize}
                        title="Minimize Plots Sidebar"
                        className="h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Scrollable Plot List with Clean Bottom Separator Lines (Zero Box Cards or Outlines) */}
            {(() => {
                const addedPlotsList = addedPlotIds
                    .map((id) => plots.find((p) => p.id === id))
                    .filter((p): p is SciencePlot => p !== undefined);
                if (addedPlotsList.length === 0) {
                    return (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-50/30 dark:bg-zinc-950/20">
                            <div className="h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3 border border-zinc-200/50 dark:border-zinc-800">
                                <MapPin className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                            </div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">No Plots Added</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px] leading-relaxed font-medium">
                                Click on plot boundaries on the map to add them to your tracking list.
                            </p>
                        </div>
                    );
                }

                return (
                    <div className="flex-1 overflow-y-auto">
                        {addedPlotsList.map((plot) => {
                            const isSelected = selectedPlotIds.includes(plot.id);
                            const isExpanded = expandedPlotIds.includes(plot.id);

                            return (
                                <div
                                    key={plot.id}
                                    className={`border-b border-zinc-100 dark:border-zinc-800/80 transition-all cursor-pointer bg-transparent hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 ${
                                        isSelected ? "bg-zinc-50/60 dark:bg-zinc-900/40" : ""
                                    }`}
                                >
                                    {/* Item Header Row */}
                                    <div className="flex items-start gap-2.5 p-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleSelectPlot(plot.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-0.5 h-4 w-4 rounded border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900 dark:data-[state=checked]:bg-zinc-100 dark:data-[state=checked]:border-zinc-100"
                                        />

                                        <div className="flex-1 min-w-0" onClick={() => onToggleSelectPlot(plot.id)}>
                                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                {plot.name}
                                            </div>
                                            <div className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                                {plot.areaAcres} Acres . {plot.observationsCount} Obvs.
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-6 w-6 rounded-full transition-colors ${
                                                    isExpanded
                                                        ? "text-zinc-900 dark:text-zinc-50 bg-zinc-200/70 dark:bg-zinc-800"
                                                        : "text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                                }`}
                                                onClick={(e) => toggleExpand(plot.id, e)}
                                                title="Toggle Plot Telemetry Stats"
                                            >
                                                <Info className="h-3.5 w-3.5" />
                                                <span className="sr-only">Toggle Info</span>
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-full text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemovePlot(plot.id);
                                                }}
                                                title="Remove Plot from List"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                <span className="sr-only">Remove Plot</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded Telemetry Stats Section - Bottom Separator Style */}
                                    {isExpanded && (
                                        <div className="px-4 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-xs space-y-2 bg-zinc-50/30 dark:bg-zinc-900/20 font-mono">
                                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                <span className="uppercase tracking-wider font-semibold text-[10px] font-sans">Acquisitions Stored</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{plot.acquisitionsStored}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                <span className="uppercase tracking-wider font-semibold text-[10px] font-sans">Data Sources</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{plot.dataSourcesCount}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                <span className="uppercase tracking-wider font-semibold text-[10px] font-sans">&ge;30% Clear</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{plot.clearObservationsCount}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                <span className="uppercase tracking-wider font-semibold text-[10px] font-sans">Latest Observation</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{plot.latestObservationDate}</span>
                                            </div>

                                            <div className="pt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDetailPlot(plot);
                                                    }}
                                                    className="text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 font-medium font-sans underline underline-offset-2 block"
                                                >
                                                    View data coverage
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Sticky Bottom Footer Section with Clean Top Separator */}
            {addedPlotIds.length > 0 && (
                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs text-zinc-500 font-medium shrink-0">
                    <span>{selectedCount} of {addedPlotIds.length} Selected</span>
                    {selectedCount > 0 && (
                        <button
                            onClick={onRemoveAllSelected}
                            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium hover:underline underline-offset-2"
                        >
                            Remove selected
                        </button>
                    )}
                </div>
            )}

            {/* Plot Detail Dialog when "View data coverage" is clicked */}
            <Dialog open={!!detailPlot} onOpenChange={() => setDetailPlot(null)}>
                <DialogContent className="sm:max-w-[420px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    {detailPlot && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-emerald-500" />
                                    {detailPlot.name}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500">
                                    Comprehensive agricultural plot attributes and satellite telemetry coverage.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3 pt-2 text-xs">
                                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
                                    <div>
                                        <div className="text-[10px] uppercase font-semibold text-zinc-400">Farmer</div>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{detailPlot.farmerName}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-semibold text-zinc-400">Village</div>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{detailPlot.village}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-semibold text-zinc-400">Acreage</div>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{detailPlot.areaAcres} Acres</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-semibold text-zinc-400">Crop Type</div>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{detailPlot.cropType}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
