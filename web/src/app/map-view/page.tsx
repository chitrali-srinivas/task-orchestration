"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow } from "@react-google-maps/api";
import { ArrowLeft, Map as MapIcon, Sparkles, Info, MessageSquareWarning, Trash2, Pencil } from "lucide-react";
import FarmerListSidebar from "@/components/map/FarmerListSidebar";
import { Farmer, Plot } from "@/types/map";

// --- Constants ---
// Same loader id + libraries as matic-dash: @react-google-maps refuses a second load with different options.
const LIBRARIES: "geometry"[] = ["geometry"];
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 }; // Central India
const DEFAULT_ZOOM = 5;

// --- Helper Component for Map ---
function MapContent({ selectedFarmer, mapType }: { selectedFarmer: Farmer | null, mapType: string }) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const [hoveredPlot, setHoveredPlot] = useState<Plot | null>(null);

    const onLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        map.setMapTypeId("satellite"); // Force satellite view on load
    }, []);

    const onUnmount = useCallback(() => {
        mapRef.current = null;
    }, []);

    // Effect to pan map when farmer is selected
    useEffect(() => {
        if (selectedFarmer && mapRef.current) {
            mapRef.current.panTo(selectedFarmer.location);
            mapRef.current.setZoom(17); // Close up zoom
        } else if (!selectedFarmer && mapRef.current) {
            mapRef.current.setZoom(DEFAULT_ZOOM);
            mapRef.current.panTo(DEFAULT_CENTER);
        }
        setHoveredPlot(null); // Clear hover if farmer changes
    }, [selectedFarmer]);

    const onMapClick = useCallback(() => {
        setHoveredPlot(null);
    }, []);

    return (
        <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={onMapClick}
            mapTypeId="satellite"
            options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
            }}
        >
            {selectedFarmer && (
                <>
                    {/* Render Farmer Plots */}
                    {selectedFarmer.plots.map(plot => (
                        <React.Fragment key={plot.id}>
                            {/* Polygon shape if available */}
                            {plot.path && plot.path.length > 0 && (
                                <Polygon
                                    path={plot.path}
                                    options={{
                                        fillColor: "#ffffff",
                                        fillOpacity: 0.3,
                                        strokeColor: "#ffffff",
                                        strokeWeight: 2,
                                        clickable: false,
                                    }}
                                />
                            )}

                            {/* Center Point Marker */}
                            <Marker
                                position={plot.location}
                                onMouseOver={() => setHoveredPlot(plot)}
                            />
                        </React.Fragment>
                    ))}

                    {/* Hover Card (InfoWindow) */}
                    {hoveredPlot && (
                        <InfoWindow
                            position={hoveredPlot.location}
                            onCloseClick={() => setHoveredPlot(null)}
                            options={{
                                pixelOffset: new google.maps.Size(0, -35),
                                disableAutoPan: true,
                            }}
                        >
                            <div className="p-4 w-[280px] bg-white dark:bg-zinc-950 flex flex-col font-sans">
                                {/* Top Section: ID & Action Icon */}
                                <div className="flex justify-between items-start mb-0.5">
                                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
                                        <h4 className="text-base font-bold tracking-tight">
                                            Plot ID: {hoveredPlot.id}
                                        </h4>
                                        <Info className="h-4 w-4" />
                                    </div>
                                    <div className="h-10 w-10 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                                        <MessageSquareWarning className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
                                    </div>
                                </div>

                                {/* Area Text */}
                                <p className="text-base font-medium text-zinc-400 dark:text-zinc-500 mb-5">
                                    {hoveredPlot.area} Acres
                                </p>

                                {/* Separator Line */}
                                <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full mb-5" />

                                {/* Deployed Row */}
                                <div className="flex justify-between items-center mb-4 text-zinc-900 dark:text-zinc-50">
                                    <span className="text-base font-bold">Deployed</span>
                                    <span className="text-base font-bold">{hoveredPlot.deployedTons} Tons</span>
                                </div>

                                {/* Shape File Row */}
                                <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500">
                                    <span className="text-base font-medium">Shape file</span>
                                    <Trash2 className="h-4 w-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" />
                                </div>
                            </div>
                        </InfoWindow>
                    )}
                </>
            )}
        </GoogleMap>
    );
}

export default function MapViewPage() {
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [mapType, setMapType] = useState<string>("satellite");

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: LIBRARIES
    });



    return (
        <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-zinc-900 overflow-hidden text-zinc-900 dark:text-zinc-50 font-sans">
            {/* Top Navigation Bar */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center px-4 justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/components">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                        <h1 className="font-semibold text-sm md:text-base">Mati Deployment Map</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 hidden md:inline">Logged in as Admin</span>
                        <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            AD
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Farmer List Sidebar */}
                <div className="h-full z-10 shadow-xl w-full max-w-[380px] hidden md:block border-r border-zinc-200 dark:border-zinc-800">
                    <FarmerListSidebar
                        onSelectFarmer={(farmer) => {
                            setSelectedFarmer(farmer);
                        }}
                        selectedFarmerId={selectedFarmer?.id}
                    />
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-800">
                    {isLoaded ? (
                        <MapContent selectedFarmer={selectedFarmer} mapType={mapType} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                            Loading Map...
                        </div>
                    )}

                    {/* Restored Farmer Card - Top Left */}
                    {selectedFarmer && (
                        <div className="absolute top-6 left-6 z-20 w-[420px]">
                            <div className="bg-white/95 dark:bg-zinc-950/95 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 backdrop-blur-md">
                                <div className="flex items-center justify-between gap-6">
                                    <div className="space-y-3">
                                        <div>
                                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                                                {selectedFarmer.name}
                                            </h3>
                                            <p className="text-sm text-zinc-400 dark:text-zinc-500">
                                                {selectedFarmer.village}
                                            </p>
                                        </div>

                                        <div className="flex gap-1.5">
                                            <div className="px-2 py-0.5 bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800 rounded-md text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                                {selectedFarmer.calArea}
                                            </div>
                                            <div className="px-2 py-0.5 bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800 rounded-md text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                                {selectedFarmer.plots.length} Plots
                                            </div>
                                        </div>
                                    </div>

                                    <Link href={`/map-editor?mode=manual&farmerId=${selectedFarmer.id}`} className="shrink-0">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-12 w-12 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all active:scale-95 shadow-sm"
                                        >
                                            <Pencil className="h-5 w-5" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
