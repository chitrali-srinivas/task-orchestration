"use client";

import React, { useState } from "react";
import { SciencePlot } from "../data/mock-science-data";
import { Search, MapPin, User, Home, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plots: SciencePlot[];
    selectedPlotIds: string[];
    onSelectPlot: (plotId: string) => void;
}

export function SearchDialog({
    open,
    onOpenChange,
    plots,
    selectedPlotIds,
    onSelectPlot,
}: SearchDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredPlots = plots.filter((plot) => {
        const q = searchQuery.toLowerCase();
        return (
            plot.name.toLowerCase().includes(q) ||
            plot.farmerName.toLowerCase().includes(q) ||
            plot.village.toLowerCase().includes(q) ||
            plot.id.toLowerCase().includes(q) ||
            plot.cropType.toLowerCase().includes(q)
        );
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl z-[600]">
                <DialogHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Search className="h-4 w-4 text-zinc-500" />
                        Search Agricultural Database
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">
                        Find plots by Plot ID, Farmer Name, Village, or Crop type.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Type Plot ID, Farmer Name, Village (e.g. Manegaon, Ramesh)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs h-10"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {filteredPlots.length === 0 ? (
                            <div className="py-8 text-center text-xs text-zinc-400">
                                No plots matching "{searchQuery}"
                            </div>
                        ) : (
                            filteredPlots.map((plot) => {
                                const isSelected = selectedPlotIds.includes(plot.id);
                                return (
                                    <div
                                        key={plot.id}
                                        onClick={() => {
                                            onSelectPlot(plot.id);
                                            onOpenChange(false);
                                        }}
                                        className="p-2.5 rounded-lg flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                <span>{plot.name}</span>
                                                <Badge variant="outline" className="text-[10px] py-0 h-4 border-zinc-300 dark:border-zinc-700">
                                                    {plot.areaAcres} Acres
                                                </Badge>
                                            </div>
                                            <div className="text-[11px] text-zinc-500 flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3 text-zinc-400" />
                                                    {plot.farmerName}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Home className="h-3 w-3 text-zinc-400" />
                                                    {plot.village}
                                                </span>
                                                <span>• {plot.cropType}</span>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
