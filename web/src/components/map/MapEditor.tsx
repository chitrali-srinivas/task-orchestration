"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Undo,
    Redo,
    Trash2,
    Save,
    MousePointer2,
    Pencil,
    User,
    AlertCircle,
    RotateCcw,
} from "lucide-react";
import { MapMode, Plot, LatLng, MapEditorProps } from "@/types/map";
import { MOCK_FARMERS } from "@/data/mockData";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Polygon, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// --- Constants & Types ---
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 }; // Central India
const DEFAULT_ZOOM = 15;

// --- Pure JS Geodesic Spherical Area Calculation ---
const calculateAreaAcres = (path: LatLng[]) => {
    if (!path || path.length < 3) return 0;
    const radius = 6378137; // Earth radius in meters
    let area = 0;
    const len = path.length;
    for (let i = 0; i < len; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % len];
        const rad1_lat = (p1.lat * Math.PI) / 180;
        const rad2_lat = (p2.lat * Math.PI) / 180;
        const rad1_lng = (p1.lng * Math.PI) / 180;
        const rad2_lng = (p2.lng * Math.PI) / 180;
        area += (rad2_lng - rad1_lng) * (2 + Math.sin(rad1_lat) + Math.sin(rad2_lat));
    }
    area = (Math.abs(area) * radius * radius) / 2; // Sq meters
    return area / 4046.85642; // Convert to acres
};

// --- Map Panning Controller Child Component ---
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom, { animate: true, duration: 0.8 });
    }, [center, zoom, map]);
    return null;
}

// --- Map Drawing Event Listener Child Component ---
function MapDrawEvents({
    isDrawing,
    newPath,
    setNewPath,
    onComplete,
    hasExistingPath
}: {
    isDrawing: boolean;
    newPath: LatLng[];
    setNewPath: React.Dispatch<React.SetStateAction<LatLng[]>>;
    onComplete: (path: LatLng[]) => void;
    hasExistingPath: boolean;
}) {
    useMapEvents({
        click(e) {
            if (!isDrawing || hasExistingPath) return;
            const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
            setNewPath(prev => [...prev, newPoint]);
        }
    });
    return null;
}

// --- Component ---
export default function MapEditor({ mode, farmerId, initialPlots = [], onSave, onClose }: MapEditorProps) {
    const router = useRouter();

    // Leaflet Icon loader workaround
    const [leafletIcon, setLeafletIcon] = useState<any>(null);
    useEffect(() => {
        if (typeof window !== "undefined") {
            const L = require("leaflet");
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });
            setLeafletIcon(L);
        }
    }, []);

    // Get current farmer details
    const farmer = MOCK_FARMERS.find(f => f.id === farmerId) || MOCK_FARMERS[0];

    // State
    const [plots, setPlots] = useState<Plot[]>(initialPlots);
    const [history, setHistory] = useState<Plot[][]>([initialPlots]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
    const [drawingMode, setDrawingMode] = useState<string | null>(null); // "polygon" | null
    const [newPath, setNewPath] = useState<LatLng[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Map Center and Zoom State
    const [center, setCenter] = useState<[number, number]>([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]);
    const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);

    // Initialize plots from farmerId
    useEffect(() => {
        if (farmerId) {
            const currentFarmer = MOCK_FARMERS.find(f => f.id === farmerId);
            if (currentFarmer) {
                const activePlots = (initialPlots && initialPlots.length > 0) ? initialPlots : currentFarmer.plots;
                setPlots(activePlots);
                setHistory([activePlots]);
                setHistoryIndex(0);
                setIsDirty(false);
                
                if (activePlots && activePlots.length > 0) {
                    const firstPlot = activePlots[0];
                    setSelectedPlotId(firstPlot.id);
                    setDrawingMode("polygon");
                    setCenter([firstPlot.location.lat, firstPlot.location.lng]);
                    setZoom(20);
                } else {
                    setCenter([currentFarmer.location.lat, currentFarmer.location.lng]);
                    setZoom(16);
                }
            }
        }
    }, [farmerId, initialPlots]);

    // Selected plot object for top-right panel
    const selectedPlot = plots.find(p => p.id === selectedPlotId);

    // Custom plot index DivIcon generator
    const createPlotIcon = (index: number, isSelected: boolean) => {
        if (typeof window === "undefined" || !leafletIcon) return undefined;
        return new leafletIcon.DivIcon({
            className: "bg-transparent",
            html: `<div class="w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md text-xs font-bold text-white transition-all ${
                isSelected 
                    ? "bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 scale-110 ring-2 ring-zinc-500/30" 
                    : "bg-zinc-600 hover:bg-zinc-700"
            }">
                ${index + 1}
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    };

    // --- History Management ---
    const addToHistory = (newPlots: Plot[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newPlots);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setPlots(newPlots);
        setIsDirty(true);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setPlots(history[historyIndex - 1]);
            setSelectedPlotId(null);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setPlots(history[historyIndex + 1]);
            setSelectedPlotId(null);
        }
    };

    // --- Polygon Handlers ---
    const handleNewPolygonComplete = (coordinates: LatLng[]) => {
        if (!selectedPlotId) {
            alert("Please select a plot pointer on the map before drawing a shape.");
            setNewPath([]);
            setDrawingMode(null);
            return;
        }

        const updatedPlots = plots.map(p =>
            p.id === selectedPlotId ? { ...p, path: coordinates, area: calculateAreaAcres(coordinates) } : p
        );

        addToHistory(updatedPlots);
        setNewPath([]);
        setDrawingMode(null); // Exit drawing mode
    };

    const handlePlotClick = (id: string) => {
        setSelectedPlotId(id);
        setDrawingMode("polygon"); // Automatically enter drawmode

        const plot = plots.find(p => p.id === id);
        if (plot) {
            setCenter([plot.location.lat, plot.location.lng]);
            setZoom(20); // Close-up zoom for easy editing
        }
    };

    // --- Toolbar Actions ---
    const handleDeleteShape = () => {
        if (selectedPlotId) {
            const updatedPlots = plots.map((p) =>
                p.id === selectedPlotId ? { ...p, path: undefined } : p
            );
            addToHistory(updatedPlots);
        }
    };

    const handleSave = () => {
        console.log("Saving plots:", plots);
        if (onSave) onSave(plots);
        setIsDirty(false);
    };

    const saveAndExit = () => {
        handleSave();
        setIsDirty(false);
        if (onClose) {
            onClose();
        } else {
            router.push("/map-view");
        }
    };

    const handleDiscardAndExit = () => {
        setIsDirty(false);
        if (onClose) {
            onClose();
        } else {
            router.push("/map-view");
        }
    };

    const handleBackClick = (e: React.MouseEvent) => {
        if (isDirty) {
            e.preventDefault();
            setShowExitConfirm(true);
        } else if (onClose) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div className="flex h-screen w-full flex-col md:flex-row bg-zinc-50 dark:bg-zinc-900 overflow-hidden select-none">
            {/* Sidebar / Toolbar */}
            <aside className="w-full md:w-80 bg-white dark:bg-zinc-950 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-[100] overflow-hidden shadow-sm shrink-0">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                            onClick={handleBackClick}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h2 className="font-bold text-lg tracking-tight">Boundary Editor</h2>
                    </div>
                </div>

                <div className="p-4 space-y-6 flex-1 overflow-y-auto min-h-0">
                    {/* Section 1: Farmer Info Card */}
                    <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Farmer profile</Label>
                        <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-black text-xs shadow-sm">
                                    {farmer.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{farmer.name}</h3>
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{farmer.village}</p>
                                </div>
                            </div>

                            {/* Area Comparison */}
                            {(() => {
                                const totalArea = plots.reduce((sum, p) => sum + p.area, 0);
                                const calArea = plots.reduce((sum, p) => sum + (p.path ? calculateAreaAcres(p.path) : 0), 0);
                                const maxVal = Math.max(totalArea, calArea, 0.1);

                                return (
                                    <div className="space-y-3 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-zinc-500">
                                                <span>Reported Area</span>
                                                <span className="text-zinc-900 dark:text-zinc-100 font-black">{totalArea.toFixed(2)} Ac</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-zinc-300 dark:bg-zinc-700 rounded-full transition-all duration-550 ease-out"
                                                    style={{ width: `${(totalArea / maxVal) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-zinc-500">
                                                <span>Calculated Area</span>
                                                <span className="text-zinc-900 dark:text-zinc-100 font-black">{calArea.toFixed(2)} Ac</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden border border-zinc-200/10 dark:border-zinc-700/10">
                                                <div
                                                    className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-550 ease-out shadow-sm"
                                                    style={{ width: `${(calArea / maxVal) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Section 3: Plot Details (Permanent List) */}
                    <div className="space-y-3 flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Farmer plots</Label>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {plots.map((plot, idx) => (
                                <div
                                    key={plot.id}
                                    className={`p-2.5 border transition-all cursor-pointer rounded-xl flex items-center justify-between ${selectedPlotId === plot.id
                                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/50 ring-1 ring-zinc-900 dark:ring-zinc-100"
                                        : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-800 bg-white dark:bg-zinc-950"
                                        }`}
                                    onClick={() => handlePlotClick(plot.id)}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${selectedPlotId === plot.id 
                                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" 
                                            : "text-zinc-400 border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900"}`}
                                        >
                                            {idx + 1}
                                        </div>
                                        <div className="text-left min-w-0">
                                            <span className="block text-[11px] font-bold text-zinc-900 dark:text-zinc-50 truncate">
                                                {plot.name || `Plot ${plot.id}`}
                                            </span>
                                            <span className="block text-[10px] text-zinc-450 dark:text-zinc-400 font-medium">
                                                Reported: <strong className="text-zinc-700 dark:text-zinc-300">{plot.area.toFixed(1)} Ac</strong>
                                                {" • "}
                                                Calculated: <strong className={plot.path ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}>
                                                    {plot.path ? `${calculateAreaAcres(plot.path).toFixed(1)} Ac` : "None"}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: plot.color || "#3b82f6" }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                    {/* Save All Work */}
                    <Button className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 font-bold shadow-lg rounded-xl" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" /> Save All Work
                    </Button>
                </div>
            </aside>

            {/* Map Area */}
            <div className="flex-1 relative h-full w-full overflow-hidden">
                <MapContainer
                    center={center}
                    zoom={zoom}
                    scrollWheelZoom={true}
                    zoomControl={true}
                    className="w-full h-full z-0"
                >
                    <TileLayer
                        attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                    
                    <MapController center={center} zoom={zoom} />
                    
                    <MapDrawEvents
                        isDrawing={drawingMode === "polygon"}
                        newPath={newPath}
                        setNewPath={setNewPath}
                        onComplete={handleNewPolygonComplete}
                        hasExistingPath={!!selectedPlot?.path}
                    />

                    {/* Render Plots & Markers */}
                    {plots.map((plot, index) => {
                        const isSelected = plot.id === selectedPlotId;
                        const plotIcon = createPlotIcon(index, isSelected);
                        
                        return (
                            <React.Fragment key={plot.id}>
                                {plot.path && plot.path.length > 0 && (
                                    <Polygon
                                        positions={plot.path.map(p => [p.lat, p.lng] as [number, number])}
                                        pathOptions={{
                                            fillColor: isSelected ? "#000000" : (plot.color || "#FFFFFF"),
                                            fillOpacity: isSelected ? 0.35 : 0.2,
                                            color: isSelected ? "#000000" : (plot.color || "#FFFFFF"),
                                            weight: isSelected ? 3 : 2
                                        }}
                                        eventHandlers={{
                                            click: () => handlePlotClick(plot.id)
                                        }}
                                    />
                                )}

                                {/* Plot Pointer */}
                                {plotIcon && (
                                    <Marker
                                        position={[plot.location.lat, plot.location.lng]}
                                        icon={plotIcon}
                                        eventHandlers={{
                                            click: () => handlePlotClick(plot.id)
                                        }}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Rendering drawn path points in drawing mode */}
                    {drawingMode === "polygon" && newPath.length > 0 && (
                        <>
                            <Polyline
                                positions={newPath.map(p => [p.lat, p.lng] as [number, number])}
                                pathOptions={{ color: "#3b82f6", weight: 3, dashArray: "5, 5" }}
                            />
                            {newPath.map((p, idx) => {
                                const dotIcon = leafletIcon && new leafletIcon.DivIcon({
                                    className: "bg-transparent",
                                    html: `<div class="w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow"></div>`,
                                    iconSize: [12, 12],
                                    iconAnchor: [6, 6]
                                });
                                return dotIcon && (
                                    <Marker
                                        key={`draw-vertex-${idx}`}
                                        position={[p.lat, p.lng]}
                                        icon={dotIcon}
                                    />
                                );
                            })}
                        </>
                    )}

                    {/* Render draggable handles for selected polygon vertices */}
                    {selectedPlotId && (() => {
                        const selectedPlot = plots.find(p => p.id === selectedPlotId);
                        if (!selectedPlot || !selectedPlot.path || selectedPlot.path.length === 0) return null;
                        
                        const path = selectedPlot.path;
                        return (
                            <>
                                {path.map((coord, idx) => {
                                    const handleIcon = leafletIcon && new leafletIcon.DivIcon({
                                        className: "bg-transparent",
                                        html: `<div class="w-3.5 h-3.5 bg-white border-2 border-zinc-900 rounded-full shadow hover:scale-125 transition-transform cursor-pointer"></div>`,
                                        iconSize: [14, 14],
                                        iconAnchor: [7, 7]
                                    });
                                    
                                    return handleIcon && (
                                        <Marker
                                            key={`edit-vertex-${idx}`}
                                            position={[coord.lat, coord.lng]}
                                            draggable={true}
                                            icon={handleIcon}
                                            eventHandlers={{
                                                drag: (e) => {
                                                    const target = e.target;
                                                    const latlng = target.getLatLng();
                                                    
                                                    const updatedPlots = plots.map(p => {
                                                        if (p.id === selectedPlotId && p.path) {
                                                            const pathCopy = [...p.path];
                                                            pathCopy[idx] = { lat: latlng.lat, lng: latlng.lng };
                                                            return {
                                                                ...p,
                                                                path: pathCopy,
                                                                area: calculateAreaAcres(pathCopy)
                                                            };
                                                        }
                                                        return p;
                                                    });
                                                    setPlots(updatedPlots);
                                                },
                                                dragend: () => {
                                                    addToHistory(plots);
                                                }
                                            }}
                                        />
                                    );
                                })}

                                {/* Render midpoint handles to add new vertices */}
                                {path.length >= 2 && path.map((coord, idx) => {
                                    const nextIdx = (idx + 1) % path.length;
                                    const nextCoord = path[nextIdx];
                                    
                                    const midLat = (coord.lat + nextCoord.lat) / 2;
                                    const midLng = (coord.lng + nextCoord.lng) / 2;
                                    
                                    const midpointIcon = leafletIcon && new leafletIcon.DivIcon({
                                        className: "bg-transparent",
                                        html: `<div class="w-2.5 h-2.5 bg-zinc-400/80 border border-white rounded-full shadow hover:scale-125 transition-transform cursor-pointer opacity-70 hover:opacity-100"></div>`,
                                        iconSize: [10, 10],
                                        iconAnchor: [5, 5]
                                    });
                                    
                                    return midpointIcon && (
                                        <Marker
                                            key={`midpoint-${idx}`}
                                            position={[midLat, midLng]}
                                            draggable={true}
                                            icon={midpointIcon}
                                            eventHandlers={{
                                                dragstart: () => {
                                                    const newVertex = { lat: midLat, lng: midLng };
                                                    const pathCopy = [...path];
                                                    pathCopy.splice(nextIdx, 0, newVertex);
                                                    
                                                    const updatedPlots = plots.map(p => {
                                                        if (p.id === selectedPlotId) {
                                                            return {
                                                                ...p,
                                                                path: pathCopy,
                                                                area: calculateAreaAcres(pathCopy)
                                                            };
                                                        }
                                                        return p;
                                                    });
                                                    setPlots(updatedPlots);
                                                },
                                                drag: (e) => {
                                                    const target = e.target;
                                                    const latlng = target.getLatLng();
                                                    
                                                    const updatedPlots = plots.map(p => {
                                                        if (p.id === selectedPlotId && p.path) {
                                                            const pathCopy = [...p.path];
                                                            pathCopy[nextIdx] = { lat: latlng.lat, lng: latlng.lng };
                                                            return {
                                                                ...p,
                                                                path: pathCopy,
                                                                area: calculateAreaAcres(pathCopy)
                                                            };
                                                        }
                                                        return p;
                                                    });
                                                    setPlots(updatedPlots);
                                                },
                                                dragend: () => {
                                                    addToHistory(plots);
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </>
                        );
                    })()}
                </MapContainer>
                
                {/* Floating Map Actions Panel (Center Bottom) */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] flex items-center gap-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
                    {/* Active Plot Title or Status */}
                    {selectedPlot ? (
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-r border-zinc-200 dark:border-zinc-800 pr-3 mr-1 flex items-center gap-1.5 shrink-0 select-none">
                            <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: selectedPlot.color || "#3b82f6" }} />
                            <span className="max-w-[100px] truncate">{selectedPlot.name}</span>
                        </div>
                    ) : (
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 pr-3 mr-1 shrink-0 select-none">
                            No Selection
                        </div>
                    )}

                    {/* History Actions */}
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" 
                            onClick={undo} 
                            disabled={historyIndex <= 0}
                            title="Undo"
                        >
                            <Undo className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" 
                            onClick={redo} 
                            disabled={historyIndex >= history.length - 1}
                            title="Redo"
                        >
                            <Redo className="h-4 w-4" />
                        </Button>
                    </div>

                    <span className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 shrink-0" />

                    {/* Shape Actions */}
                    <div className="flex items-center gap-1.5">
                        {drawingMode === "polygon" && newPath.length > 0 && (
                            <Button 
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 text-[10px] font-black uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                                onClick={() => setNewPath([])}
                            >
                                Clear points
                            </Button>
                        )}
                        
                        {drawingMode === "polygon" && newPath.length >= 3 && (
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8 px-3 text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg shadow-md"
                                onClick={() => handleNewPolygonComplete(newPath)}
                            >
                                Finish shape
                            </Button>
                        )}

                        {selectedPlot && selectedPlot.path && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2.5 text-[10px] font-black uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg flex items-center gap-1"
                                onClick={handleDeleteShape}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Clear shape
                            </Button>
                        )}
                    </div>
                </div>

                {/* Real-time Plot Details Panel top-right */}
                {selectedPlot && (
                    <div className="absolute top-4 right-4 z-[1000] w-80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedPlot.color || "#3b82f6" }} />
                                <span className="font-bold text-sm text-zinc-950 dark:text-zinc-50">{selectedPlot.name || `Plot ${selectedPlot.id}`}</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-bold tracking-wider uppercase bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                Active Plot
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-tight mb-0.5">Reported Area</span>
                                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{selectedPlot.area.toFixed(2)} Ac</span>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-tight mb-0.5">Calculated Area</span>
                                    <span className={`text-sm font-black ${selectedPlot.path ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                                        {selectedPlot.path ? `${calculateAreaAcres(selectedPlot.path).toFixed(2)} Ac` : "No Shape"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                                <div className="flex justify-between">
                                    <span>Plot ID:</span>
                                    <span className="font-mono text-zinc-850 dark:text-zinc-150 font-bold">{selectedPlot.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Deployed Tons:</span>
                                    <span className="text-zinc-850 dark:text-zinc-150 font-bold">{selectedPlot.deployedTons} Tons</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Vertices:</span>
                                    <span className="text-zinc-850 dark:text-zinc-150 font-bold">
                                        {selectedPlot.path ? `${selectedPlot.path.length} points` : "None"}
                                    </span>
                                </div>
                                {selectedPlot.path && selectedPlot.path.length > 0 && (
                                    <div className="space-y-1 pt-1.5 border-t border-zinc-100 dark:border-zinc-900">
                                        <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Vertex Coordinates</span>
                                        <div className="space-y-1 font-mono text-[9px] text-zinc-450 dark:text-zinc-500">
                                            {selectedPlot.path.map((p, i) => (
                                                <div key={i} className="flex justify-between bg-zinc-50/50 dark:bg-zinc-900/30 p-1 rounded">
                                                    <span>Pt {i + 1}:</span>
                                                    <span>{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedPlot.path && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full h-8 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 border-red-200/50 dark:border-red-955/30 mt-1"
                                    onClick={handleDeleteShape}
                                >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear Boundary Shape
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Unsaved Changes Confirmation Dialog */}
                <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                    <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl p-0 gap-0">
                        <div className="p-6 pb-4 space-y-3">
                            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-2">
                                <AlertCircle className="h-6 w-6 text-amber-500" />
                            </div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Discard Changes?</DialogTitle>
                            <p className="text-[15px] text-zinc-500 leading-relaxed font-medium">
                                Your map edits aren't saved. Would you like to save your work before leaving the editor?
                            </p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900 flex flex-col sm:flex-row gap-3">
                            <Button variant="ghost" className="flex-1 h-11 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setShowExitConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="outline" className="flex-1 h-11 border-zinc-200 dark:border-zinc-800 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-950/20" onClick={handleDiscardAndExit}>
                                Discard & Exit
                            </Button>
                            <Button className="flex-1 h-11 bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 text-white font-bold shadow-md hover:shadow-lg transition-all" onClick={saveAndExit}>
                                Save & Exit
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
