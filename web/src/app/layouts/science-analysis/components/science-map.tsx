"use client";

import React, { useState, useEffect, useRef } from "react";
import { SciencePlot } from "../data/mock-science-data";
import { Button } from "@/components/ui/button";
import { Play, Pause, Search, Layers, Check, MapPin, ListFilter, Maximize2, Eye, EyeOff, User, Home, ChevronDown } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface ScienceMapProps {
    plots: SciencePlot[];
    addedPlotIds?: string[];
    selectedPlotIds: string[];
    onTogglePlot: (plotId: string) => void;
    onOpenSearch: () => void;
    startDate: string;
    endDate: string;
    selectedGraphDate?: string | null;
    // Farmer & Village Filters inside map
    selectedFarmer?: string;
    selectedVillage?: string;
    onFarmerSelect?: (farmer: string) => void;
    onVillageSelect?: (village: string) => void;
    onResetFilters?: () => void;
    farmersList?: string[];
    villagesList?: string[];
}

// Controller to max-zoom into plot field bounds when plot selection changes or trigger fired
function MapController({
    plots,
    selectedPlotIds,
    zoomTrigger,
}: {
    plots: SciencePlot[];
    selectedPlotIds: string[];
    zoomTrigger: number;
}) {
    const map = useMap();

    useEffect(() => {
        if (!map || plots.length === 0) return;

        const L = require("leaflet");
        const targetPlots = plots.filter((p) => selectedPlotIds.includes(p.id));
        const activePlots = targetPlots.length > 0 ? targetPlots : [plots[0]];

        const allCoords = activePlots.flatMap((p) => p.coordinates.map((c) => [c.lat, c.lng] as [number, number]));

        if (allCoords.length > 0) {
            const bounds = L.latLngBounds(allCoords);
            map.fitBounds(bounds, {
                padding: [60, 60],
                maxZoom: 18,
                animate: true,
            });
        }
    }, [map, plots, selectedPlotIds, zoomTrigger]);

    return null;
}

// Controller to auto-invalidate size whenever map container resizes
function MapResizeController() {
    const map = useMap();
    useEffect(() => {
        const invalidate = () => {
            if (map) {
                map.invalidateSize();
            }
        };

        window.addEventListener("resize", invalidate);
        const t1 = setTimeout(invalidate, 100);
        const t2 = setTimeout(invalidate, 350);

        return () => {
            window.removeEventListener("resize", invalidate);
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [map]);
    return null;
}

export function ScienceMap({
    plots,
    addedPlotIds = [],
    selectedPlotIds,
    onTogglePlot,
    onOpenSearch,
    startDate,
    endDate,
    selectedGraphDate,
    selectedFarmer = "all",
    selectedVillage = "all",
    onFarmerSelect,
    onVillageSelect,
    onResetFilters,
    farmersList = [],
    villagesList = [],
}: ScienceMapProps) {
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [tileMode, setTileMode] = useState<"satellite" | "street" | "terrain" | "ndvi">("satellite");
    const [zoomTrigger, setZoomTrigger] = useState<number>(0);
    
    // Toggle state to hide/unhide unselected plot field boundaries (white outline plots)
    const [showUnselectedPlots, setShowUnselectedPlots] = useState<boolean>(true);

    // Playback state for clicked graph dates
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    // Popovers state inside map
    const [isFarmerDropdownOpen, setIsFarmerDropdownOpen] = useState(false);
    const [isVillageDropdownOpen, setIsVillageDropdownOpen] = useState(false);
    const [farmerSearchQuery, setFarmerSearchQuery] = useState("");
    const [villageSearchQuery, setVillageSearchQuery] = useState("");

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const L = require("leaflet");
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });
            setLeafletLoaded(true);
        }
    }, []);

    const mapCenter: [number, number] = plots.length > 0 && plots[0].coordinates.length > 0
        ? [plots[0].coordinates[0].lat, plots[0].coordinates[0].lng]
        : [20.5225, 78.9315];

    const tileUrls = {
        satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        terrain: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        ndvi: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    };

    const tileAttributions = {
        satellite: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        street: "&copy; OpenStreetMap contributors",
        terrain: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)",
        ndvi: "Mati Satellite NDVI Layer &copy; Esri"
    };

    const filteredFarmers = farmersList.filter((f) =>
        f.toLowerCase().includes(farmerSearchQuery.toLowerCase())
    );

    const filteredVillages = villagesList.filter((v) =>
        v.toLowerCase().includes(villageSearchQuery.toLowerCase())
    );

    if (!leafletLoaded) {
        return (
            <div className="w-full h-full min-h-[400px] bg-zinc-900 flex items-center justify-center text-zinc-400 text-sm font-mono">
                Loading Satellite Engine...
            </div>
        );
    }

    const isPlayEnabled = Boolean(selectedGraphDate);

    return (
        <div ref={containerRef} className="relative w-full h-full min-h-[450px] bg-zinc-950 overflow-hidden select-none">
            <MapContainer
                center={mapCenter}
                zoom={18}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
                zoomControl={false}
            >
                <MapController plots={plots} selectedPlotIds={selectedPlotIds} zoomTrigger={zoomTrigger} />
                <MapResizeController />
                <TileLayer
                    url={tileUrls[tileMode]}
                    attribution={tileAttributions[tileMode]}
                    maxZoom={19}
                />

                {/* Render Plot Polygons */}
                {plots.map((plot) => {
                    const isSelected = selectedPlotIds.includes(plot.id);
                    const isAdded = addedPlotIds.includes(plot.id);

                    // If unselected plots are hidden via Eye toggle, skip rendering non-selected boundary plots
                    if (!isSelected && !isAdded && !showUnselectedPlots) {
                        return null;
                    }

                    const polyPositions = plot.coordinates.map((c) => [c.lat, c.lng] as [number, number]);

                    let strokeColor = "#ffffff";
                    let fillColor = "#000000";
                    let weight = 1.5;
                    let opacity = 0.75;
                    let fillOpacity = 0.15;

                    if (isSelected) {
                        strokeColor = "#22c55e"; // Emerald green for checked/selected
                        fillColor = "#22c55e";
                        weight = 3;
                        opacity = 1;
                        fillOpacity = 0.35;
                    } else if (isAdded) {
                        strokeColor = "#f59e0b"; // Amber/orange for added but unselected
                        fillColor = "#f59e0b";
                        weight = 2;
                        opacity = 0.9;
                        fillOpacity = 0.25;
                    }

                    return (
                        <Polygon
                            key={plot.id}
                            positions={polyPositions}
                            eventHandlers={{
                                click: () => onTogglePlot(plot.id),
                            }}
                            pathOptions={{
                                color: strokeColor,
                                weight: weight,
                                opacity: opacity,
                                fillColor: fillColor,
                                fillOpacity: fillOpacity,
                            }}
                        />
                    );
                })}
            </MapContainer>

            {/* Top-Left Floating Controls: Play Button & Separate Buttons inside Map */}
            <div className="absolute top-4 left-4 z-[400] flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                    {/* 1. Play Button: Standard Shadcn Button in Disabled State by Default */}
                    <TooltipProvider>
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <span className="inline-block">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={!isPlayEnabled}
                                        onClick={() => isPlayEnabled && setIsPlaying((prev) => !prev)}
                                        className="h-9 w-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md backdrop-blur-md"
                                    >
                                        {isPlaying ? (
                                            <Pause className="h-4 w-4" />
                                        ) : (
                                            <Play className="h-4 w-4 ml-0.5" />
                                        )}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs bg-zinc-900 text-zinc-50 border-zinc-800 p-2">
                                {isPlayEnabled
                                    ? isPlaying
                                        ? "Pause observation date playback"
                                        : `Play observation time-lapse starting from ${selectedGraphDate}`
                                    : "Click on any graph point to enable date playback"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* 2. Separate Dropdown: Farmer Filter Dropdown */}
                    <Popover open={isFarmerDropdownOpen} onOpenChange={setIsFarmerDropdownOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs px-3 gap-2 backdrop-blur-md cursor-pointer font-medium text-zinc-800 dark:text-zinc-200"
                            >
                                <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                <span>{selectedFarmer === "all" ? "All Farmers" : selectedFarmer}</span>
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            className="w-[240px] p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-[1000] space-y-2"
                        >
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search farmer..."
                                    value={farmerSearchQuery}
                                    onChange={(e) => setFarmerSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium"
                                />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto space-y-1 p-0.5 scrollbar-none">
                                <button
                                    onClick={() => {
                                        onFarmerSelect?.("all");
                                        setIsFarmerDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                        selectedFarmer === "all"
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-bold"
                                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium"
                                    }`}
                                >
                                    <span>All Farmers</span>
                                    {selectedFarmer === "all" && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />}
                                </button>

                                {filteredFarmers.map((f) => {
                                    const isSelected = selectedFarmer === f;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => {
                                                onFarmerSelect?.(f);
                                                setIsFarmerDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                                isSelected
                                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-bold"
                                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium"
                                            }`}
                                        >
                                            <span className="truncate">{f}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                                        </button>
                                    );
                                })}
                                {filteredFarmers.length === 0 && (
                                    <div className="p-3 text-center text-xs text-zinc-400 font-medium">No farmer found.</div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* 3. Separate Dropdown: Village Filter Dropdown */}
                    <Popover open={isVillageDropdownOpen} onOpenChange={setIsVillageDropdownOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs px-3 gap-2 backdrop-blur-md cursor-pointer font-medium text-zinc-800 dark:text-zinc-200"
                            >
                                <Home className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                <span>{selectedVillage === "all" ? "All Villages" : selectedVillage}</span>
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            className="w-[220px] p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-[1000] space-y-2"
                        >
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search village..."
                                    value={villageSearchQuery}
                                    onChange={(e) => setVillageSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium"
                                />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto space-y-1 p-0.5 scrollbar-none">
                                <button
                                    onClick={() => {
                                        onVillageSelect?.("all");
                                        setIsVillageDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                        selectedVillage === "all"
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-bold"
                                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium"
                                    }`}
                                >
                                    <span>All Villages</span>
                                    {selectedVillage === "all" && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />}
                                </button>

                                {filteredVillages.map((v) => {
                                    const isSelected = selectedVillage === v;
                                    return (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                onVillageSelect?.(v);
                                                setIsVillageDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                                isSelected
                                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-bold"
                                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium"
                                            }`}
                                        >
                                            <span className="truncate">{v}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                                        </button>
                                    );
                                })}
                                {filteredVillages.length === 0 && (
                                    <div className="p-3 text-center text-xs text-zinc-400 font-medium">No village found.</div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* 4. Separate Reset Filters Button */}
                    {(selectedFarmer !== "all" || selectedVillage !== "all") && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onResetFilters}
                            className="h-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs px-3 backdrop-blur-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                        >
                            Reset
                        </Button>
                    )}
                </div>

                {/* Date Display Badge Below Play Button: ONLY Visible When Clicked on a Graph */}
                {selectedGraphDate && (
                    <div className="px-3 py-1 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-md text-xs font-mono font-medium backdrop-blur-md flex items-center gap-1.5 select-none animate-in fade-in-0 duration-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedGraphDate}</span>
                        <span className="text-zinc-400 font-normal">-</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{endDate}</span>
                    </div>
                )}
            </div>

            {/* Top-Right Floating Controls: Layer View & Eye Toggle for Unselected Plots */}
            <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
                {/* Eye Icon Button to Hide/Unhide Unselected Boundary Plots */}
                <TooltipProvider>
                    <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowUnselectedPlots((prev) => !prev)}
                                className="h-9 w-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                {showUnselectedPlots ? (
                                    <Eye className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs bg-zinc-900 text-zinc-50 border-zinc-800 p-2">
                            {showUnselectedPlots ? "Hide unselected plots (white boundaries)" : "Show unselected plots (white boundaries)"}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Map Layer Switcher */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <Layers className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 z-[500] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <DropdownMenuLabel className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            Map Layer View
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTileMode("satellite")} className="justify-between text-xs cursor-pointer">
                            Satellite View {tileMode === "satellite" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTileMode("ndvi")} className="justify-between text-xs cursor-pointer">
                            NDVI Satellite Overlay {tileMode === "ndvi" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTileMode("street")} className="justify-between text-xs cursor-pointer">
                            Street Map {tileMode === "street" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTileMode("terrain")} className="justify-between text-xs cursor-pointer">
                            Terrain / Topo {tileMode === "terrain" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
