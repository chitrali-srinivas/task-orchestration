"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogPortal,
    DialogOverlay,
} from "@/components/ui/dialog"
import { EngagementRecord, VerificationComment } from "../data/schema"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, XCircle, Truck, Tractor } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquareText, AlertCircle, CheckCircle2, X, Check, Image as ImageIcon, Play, FileText, MapPin, Download, Info, MessageSquareWarning, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Scaling, AlignCenter, SlidersHorizontal, RotateCcw, Loader2, ChevronDown, User, Phone, Eye, EyeOff, Plus, Inbox } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Languages, PencilRuler } from "lucide-react"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SurveyItem, VariantType, surveyData, SurveyCard, translations } from "@/app/components/survey/SurveyComponents"
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow } from "@react-google-maps/api"
import { MOCK_FARMERS } from "@/data/mockData"
import { clientOnly } from "@/platform/client-only"
import { env } from "@/platform/env"
import { Farmer, Plot } from "@/types/map"

const MapEditor = clientOnly(() => import("@/components/map/MapEditor"), {
    loading: () => (
        <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-sm font-semibold">
            Loading Map Editor...
        </div>
    )
});

// Same loader id + libraries as matic-dash: @react-google-maps refuses a second load with different options.
const LIBRARIES: "geometry"[] = ["geometry"];
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 };
const DEFAULT_ZOOM = 5;

function MapPreviewContent({
    selectedFarmer,
    record,
    onIdle,
    center,
    zoom,
    specificMarker,
    onReset,
    onInteraction,
    resetCount,
    questionLocation,
    setIsMapInteracted,
    mapRef,
    isProgrammaticChange,
    hasLocationQuestion,
    selectedPlot,
    setSelectedPlot,
    hoveredPlotId,
    setHoveredPlotId,
    isShowingSpecificLocation,
    isMapInteracted,
    onEditClick
}: {
    selectedFarmer: Farmer | null,
    record: EngagementRecord | null,
    onIdle?: () => void,
    center?: google.maps.LatLngLiteral | null,
    zoom?: number,
    specificMarker?: google.maps.LatLngLiteral | null,
    onReset?: () => void,
    onInteraction?: () => void,
    resetCount: number,
    questionLocation?: google.maps.LatLngLiteral | null,
    setIsMapInteracted: (val: boolean) => void,
    mapRef: React.MutableRefObject<google.maps.Map | null>,
    isProgrammaticChange: React.MutableRefObject<boolean>,
    hasLocationQuestion: boolean,
    selectedPlot: any | null,
    setSelectedPlot: (plot: any | null) => void,
    hoveredPlotId: string | null,
    setHoveredPlotId: (id: string | null) => void,
    isShowingSpecificLocation: boolean,
    isMapInteracted: boolean,
    onEditClick?: () => void
}) {

    const fitBounds = React.useCallback(() => {
        if (!mapRef.current || !selectedFarmer || selectedFarmer.plots.length === 0) return;

        isProgrammaticChange.current = true;
        const bounds = new google.maps.LatLngBounds();
        selectedFarmer.plots.forEach(plot => {
            bounds.extend(plot.location);
            if (plot.path) {
                plot.path.forEach(point => bounds.extend(point));
            }
        });

        // Also include the question location in the initial view bounds if it exists
        if (questionLocation && hasLocationQuestion) {
            bounds.extend(questionLocation);
        }

        mapRef.current.fitBounds(bounds);
        
        // Add some padding so markers aren't right at the edge
        const listener = google.maps.event.addListener(mapRef.current, "idle", () => {
            if (mapRef.current) {
                // If the zoom is too high after fitBounds (e.g. only one plot), cap it
                if (mapRef.current.getZoom()! > 18) mapRef.current.setZoom(18);
            }
            // Use a small delay before allowing interaction detection again
            setTimeout(() => {
                isProgrammaticChange.current = false;
            }, 100);
            google.maps.event.removeListener(listener);
        });
    }, [selectedFarmer, questionLocation, mapRef, isProgrammaticChange, hasLocationQuestion]);

    const onLoad = React.useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        map.setMapTypeId("satellite");
        if (!center) {
            fitBounds();
        }
    }, [center, fitBounds, mapRef]);

    const onUnmount = React.useCallback(() => {
        mapRef.current = null;
    }, [mapRef]);

    React.useEffect(() => {
        if (mapRef.current) {
            isProgrammaticChange.current = true;
            if (center) {
                mapRef.current.panTo(center);
                mapRef.current.setZoom(zoom || 17);
                // Reset flag after a short delay since panTo/setZoom don't have callbacks
                setTimeout(() => { isProgrammaticChange.current = false; }, 500);
            } else if (selectedFarmer) {
                fitBounds();
            }
        }
    }, [selectedFarmer, center, zoom, fitBounds, resetCount, mapRef, isProgrammaticChange]);

    const activeDetailsPlot = selectedPlot || selectedFarmer?.plots.find(p => p.id === hoveredPlotId);

    return (
        <div className="relative w-full h-full">
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={center || selectedFarmer?.location || DEFAULT_CENTER}
                zoom={zoom || (selectedFarmer ? 17 : DEFAULT_ZOOM)}
                onLoad={onLoad}
                onIdle={onIdle}
                onUnmount={onUnmount}
                onDragStart={() => {
                    if (!isProgrammaticChange.current) {
                        setIsMapInteracted(true);
                        onInteraction?.();
                    }
                }}
                onZoomChanged={() => {
                    if (mapRef.current && !isProgrammaticChange.current) {
                        setIsMapInteracted(true);
                        onInteraction?.();
                    }
                }}
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
                        {selectedFarmer.plots.map((plot, index) => {
                            const isHovered = hoveredPlotId === plot.id || selectedPlot?.id === plot.id;
                            return (
                                <React.Fragment key={plot.id}>
                                    {plot.path && plot.path.length > 0 && (
                                        <Polygon
                                            path={plot.path}
                                            options={{
                                                fillColor: "#ffffff",
                                                fillOpacity: isHovered ? 0.35 : 0.2,
                                                strokeColor: isHovered ? "#22c55e" : "#ffffff",
                                                strokeWeight: isHovered ? 3 : 2,
                                            }}
                                            onMouseOver={() => {
                                                if (!selectedPlot) {
                                                    setHoveredPlotId(plot.id);
                                                }
                                            }}
                                            onMouseOut={() => {
                                                if (!selectedPlot) {
                                                    setHoveredPlotId(null);
                                                }
                                            }}
                                            onClick={() => {
                                                setSelectedPlot(plot);
                                            }}
                                        />
                                    )}
                                    <Marker
                                        position={plot.location}
                                        onMouseOver={() => {
                                            if (!selectedPlot) {
                                                setHoveredPlotId(plot.id);
                                            }
                                        }}
                                        onMouseOut={() => {
                                            if (!selectedPlot) {
                                                setHoveredPlotId(null);
                                            }
                                        }}
                                        onClick={() => {
                                            setSelectedPlot(plot);
                                        }}
                                        icon={{
                                            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                    <circle cx="12" cy="12" r="10" fill="white" stroke="white" stroke-width="2" />
                                                    <text x="12" y="15.5" fill="black" font-size="10" font-family="Arial" font-weight="bold" text-anchor="middle">${index + 1}</text>
                                                </svg>
                                            `)}`,
                                            scaledSize: new google.maps.Size(24, 24),
                                            anchor: new google.maps.Point(12, 12)
                                        }}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </GoogleMap>

            {/* Drawing Button and Reset View top-left */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onEditClick}
                    title="Edit Plot Boundaries"
                    className="h-9 w-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                    <PencilRuler className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </Button>
                {(isShowingSpecificLocation || isMapInteracted) && (
                    <Button 
                        variant="outline"
                        onClick={onReset}
                        className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-md hover:shadow-lg border border-zinc-200 dark:border-zinc-800 h-9 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                        Reset View
                    </Button>
                )}
            </div>

            {/* Plot Details Card top-right */}
            {activeDetailsPlot && (
                <div className="absolute top-4 right-4 z-10 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-4 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-3">
                        <span className="font-bold text-sm text-zinc-950 dark:text-zinc-50">Plot details</span>
                        <button 
                            onClick={() => {
                                setSelectedPlot(null);
                                setHoveredPlotId(null);
                            }}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                        <div className="flex">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Plot ID</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                                {activeDetailsPlot.id.match(/^\d+$/) ? `12AB${activeDetailsPlot.id.slice(-2)}` : activeDetailsPlot.id}
                            </span>
                        </div>
                        <div className="flex">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Area</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{activeDetailsPlot.area} Acres</span>
                        </div>
                        <div className="flex">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Created on</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {record?.submittedOn ? format(record.submittedOn, "dd MMM yy").toUpperCase() : "01 JUL 26"}
                            </span>
                        </div>
                        <div className="flex">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Created by</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {record?.surveyor.name || "Surveyor A"}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface EngagementDetailSheetProps {
    record: EngagementRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onNext: () => void
    onPrevious: () => void
    isFirst: boolean
    isLast: boolean
    currentIndex: number
    totalCount: number
    surveyData?: SurveyItem[]
    hasLocationQuestion?: boolean
    language?: "en" | "hi"
    onLanguageChange?: (lang: "en" | "hi") => void
    defaultTab?: "all" | "verified" | "pending" | "need_correction" | "details"
}

function ImagePreview({ item, zoom, rotation, imageMode }: { item: SurveyItem, zoom: number, rotation: number, imageMode: "fill" | "fit" | "stretch" | "center" }) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })

    React.useLayoutEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
            updateSize();
        }

        return () => observer.disconnect();
    }, []);

    const isRotated = rotation % 180 !== 0;
    
    // Calculate dimensions for the image wrapper when rotated
    const wrapperStyle: React.CSSProperties = isRotated && containerSize.width > 0 ? {
        width: `${containerSize.height}px`,
        height: `${containerSize.width}px`,
    } : {
        width: "100%",
        height: "100%",
    };

    return (
        <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing relative">
            <div 
                className="transition-all duration-300 ease-out flex items-center justify-center"
                style={{ 
                    ...wrapperStyle,
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
            >
                <img 
                    src={item.answer as string} 
                    alt="Preview" 
                    className={cn(
                        "transition-all duration-300",
                        imageMode === "fill" && "w-full h-full object-cover",
                        imageMode === "fit" && "w-full h-full object-contain",
                        imageMode === "stretch" && "w-full h-full object-fill",
                    )}
                />
            </div>
        </div>
    );
}

const REAL_DEPLOYMENT_DATA: Record<string, {
    video: string;
    pictures: string[];
    tons: number;
    coordinates: string;
    surveyorPhone: string;
    trailerNo: string;
}> = {
    "DEPL-1744692307629": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_15_41_448.mp4?alt=media&token=9a351f01-4e26-45ff-99d1-dfae85687b31",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_15_54_975.jpg?alt=media&token=7fdad133-44a1-471b-a318-b17c6664facb",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_16_00_329.jpg?alt=media&token=ca5b0c24-70f4-4eca-892a-7f5399a5438d"
        ],
        tons: 5,
        coordinates: "21.9161° N, 79.7993° E",
        surveyorPhone: "+91 95227 97884",
        trailerNo: "MP22AB4281"
    },
    "DEPL-1744691260136": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_09_57_48_898.mp4?alt=media&token=641c3bf4-0647-4d67-950b-75f9c9f45695",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_57_58_498.jpg?alt=media&token=f3346c2a-968c-4457-a71a-cb607992a7fd",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_03_885.jpg?alt=media&token=1a3a8a58-12c9-4fcc-b366-67960af3a7f0",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_10_100.jpg?alt=media&token=bd9eed19-ec09-4b07-a859-bd4629d521f9",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_19_579.jpg?alt=media&token=2c4f4427-4fa3-41ff-aacc-bea7e6417826",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_27_150.jpg?alt=media&token=03803c52-984d-46c0-8807-530cddf21c1f"
        ],
        tons: 5,
        coordinates: "21.9166° N, 79.7983° E",
        surveyorPhone: "+91 62694 54856",
        trailerNo: "MP22AB4281"
    },
    "DEPL-1744692512499": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_19_43_955.mp4?alt=media&token=d963ab58-4489-4797-8fc2-6e339c94f98d",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_19_53_985.jpg?alt=media&token=1f22662c-46aa-41a7-b210-1aedbc49c4ae",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_00_085.jpg?alt=media&token=22b69b29-52f4-4f9d-ad53-9b45946ca3a7",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_05_017.jpg?alt=media&token=e0ba9f31-5d14-4194-9b4f-961547200674",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_10_071.jpg?alt=media&token=1ca86d6f-7ecd-4582-a590-2217c026de7a",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_14_805.jpg?alt=media&token=709e3a82-1b58-4950-9199-43f15b7593ce"
        ],
        tons: 5,
        coordinates: "21.9161° N, 79.7997° E",
        surveyorPhone: "+91 62694 54856",
        trailerNo: "MP 22 AB 6517"
    },
    "DEPL-1744690715506": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_09_49_03_323.mp4?alt=media&token=ba72d56a-0127-4738-81a8-5cf29b955378",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_18_192.jpg?alt=media&token=3a8a5ddc-f940-4f66-9cbe-8a37aad1e3e3",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_43_891.jpg?alt=media&token=e7ad0320-ddd4-4b3e-871d-3409ded80303",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_52_812.jpg?alt=media&token=7640bcdb-6ce5-40a2-a9d8-311197bb7e5c"
        ],
        tons: 5,
        coordinates: "21.9167° N, 79.7980° E",
        surveyorPhone: "+91 62694 54856",
        trailerNo: "MP 22 AB 6517"
    },
    "DEPL-1744691719984": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_05_31_483.mp4?alt=media&token=08e6ab64-6ec5-452e-be0e-a9c047752307",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_05_43_826.jpg?alt=media&token=c75fe80d-9e13-4935-bdef-424a499426dd",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_05_53_820.jpg?alt=media&token=4341b52b-887a-4ef0-9bbd-8b6bbcad5e61",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_01_360.jpg?alt=media&token=96680d21-5c23-4b56-9733-cd45df3d87f8",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_06_772.jpg?alt=media&token=b06c064c-1bc4-476d-8661-633c8ac72e4f",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_12_708.jpg?alt=media&token=d6fc0aa0-0b88-4adf-b4c8-621c7dd5b1f1"
        ],
        tons: 5,
        coordinates: "21.9161° N, 79.7983° E",
        surveyorPhone: "+91 62694 54856",
        trailerNo: "MP 22 AB 6517"
    },
    "DEPL-1744693404669": {
        video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_34_40_070.mp4?alt=media&token=ddff56e8-18d3-4867-acfa-73585d4063b5",
        pictures: [
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_05_277.jpg?alt=media&token=285e9e59-1b77-467a-b661-39c2f46ec5c0",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_11_140.jpg?alt=media&token=62182dea-ad7f-4612-ab9d-f33112bfbba1",
            "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_20_127.jpg?alt=media&token=dedb6268-b4bb-4e83-97fc-29aab1ac5961"
        ],
        tons: 5,
        coordinates: "21.9156° N, 79.7981° E",
        surveyorPhone: "+91 62694 54856",
        trailerNo: "MP 22 AB 6517"
    }
};



const getDispatchSurveyItems = (dispatch: any, record: EngagementRecord): SurveyItem[] => {
    const formatTimestamp = (ts: any) => {
        if (!ts) return "-";
        const num = typeof ts === "string" ? parseInt(ts) : ts;
        if (isNaN(num)) return ts;
        return new Date(num).toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    };

    const formatDate = (ts: any) => {
        if (!ts) return "-";
        const num = typeof ts === "string" ? parseInt(ts) : ts;
        if (isNaN(num)) return ts;
        return new Date(num).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    };

    const items: SurveyItem[] = [
        {
            id: "trailer_no",
            question: "trailer_no:",
            type: "text",
            answer: dispatch.trailer_no || dispatch.vehicleId || "-",
            label: "Trailer Number"
        },
        {
            id: "source_name",
            question: "MATI Source name:",
            type: "text",
            answer: dispatch.source_name || dispatch.carrier || "-",
            label: "Source Name"
        },
        {
            id: "cluster_name",
            question: "Please select the Cluster Name in Which MATI is Deployed:",
            type: "badge",
            answer: [dispatch.cluster_name || "Cluster 1"],
            label: "Cluster Name"
        },
        {
            id: "num_tons",
            question: "Number of Tonnes loaded on this tractor?:",
            type: "quantity",
            answer: dispatch.num_tons !== undefined ? `${dispatch.num_tons} Tons` : dispatch.quantity || "-",
            label: "Number of Tons"
        },
        {
            id: "num_plots_unload",
            question: "Number of plots in which this trailer will unload:",
            type: "quantity",
            answer: dispatch.num_plots_unload !== undefined ? `${dispatch.num_plots_unload} Plots` : "2 Plots",
            label: "Number of Plots Unloaded"
        },
        {
            id: "date",
            question: "Date of deployment:",
            type: "text",
            answer: dispatch.date_raw ? formatDate(dispatch.date_raw) : dispatch.date || "-",
            label: "Dispatch Date"
        }
    ];

    if (dispatch.batch_id !== undefined) {
        items.push({
            id: "batch_id",
            question: "batch_id:",
            type: "text",
            answer: dispatch.batch_id,
            label: "Batch ID"
        });
    }
    if (dispatch.material_type !== undefined) {
        items.push({
            id: "material_type",
            question: "material_type:",
            type: "text",
            answer: dispatch.material_type,
            label: "Material Type"
        });
    }
    if (dispatch.crop_stage !== undefined) {
        items.push({
            id: "crop_stage",
            question: "crop_stage:",
            type: "text",
            answer: dispatch.crop_stage,
            label: "Crop Stage"
        });
    }
    if (dispatch.field_condition !== undefined) {
        items.push({
            id: "field_condition",
            question: "field_condition:",
            type: "text",
            answer: dispatch.field_condition,
            label: "Field Condition"
        });
    }
    if (dispatch.survey_type !== undefined) {
        items.push({
            id: "survey_type",
            question: "survey_type:",
            type: "text",
            answer: dispatch.survey_type,
            label: "Survey Type"
        });
    }
    if (dispatch.remarks !== undefined) {
        items.push({
            id: "remarks",
            question: "remarks:",
            type: "text",
            answer: dispatch.remarks,
            label: "Remarks"
        });
    }
    if (dispatch.responseId !== undefined) {
        items.push({
            id: "responseId",
            question: "responseId:",
            type: "text",
            answer: dispatch.responseId,
            label: "Response ID"
        });
    }

    // Add video
    if (dispatch.video) {
        items.push({
            id: "video",
            question: "Deployment video 1*:",
            type: "video",
            answer: dispatch.video,
            label: "Video of Deployment"
        });
    }

    return items;
};

const getDeploymentSurveyItems = (depl: any, record: EngagementRecord, dispatchPictures?: string[]): SurveyItem[] => {
    const items: SurveyItem[] = [
        {
            id: "plot_no",
            question: "Plot Number:",
            type: "text",
            answer: depl.plot_no !== undefined ? `Plot ${depl.plot_no}` : depl.plot || "-",
            label: "Plot Number"
        },
        {
            id: "amt_deploy",
            question: "Amount deployed in Plot 1 (In tonnes):",
            type: "quantity",
            answer: depl.amt_deploy !== undefined ? `${depl.amt_deploy} Tons` : depl.quantity || "-",
            label: "Amount Deployed"
        },
        {
            id: "coordinates",
            question: "Location of Plot:",
            type: "map",
            answer: record.village || "-",
            meta: depl.coordinates || "-",
            label: "GPS Coordinates"
        }
    ];

    if (depl.plot_code !== undefined) {
        items.push({
            id: "plot_code",
            question: "plot_code:",
            type: "text",
            answer: Array.isArray(depl.plot_code) ? depl.plot_code.join(", ") : depl.plot_code,
            label: "Plot Code"
        });
    }
    if (depl.amt_deploy !== undefined) {
        // Already handled by amt_deploy in standard items
    }
    if (depl.verbal_plot_area_enrolled !== undefined) {
        items.push({
            id: "verbal_plot_area_enrolled",
            question: "verbal_plot_area_enrolled:",
            type: "text",
            answer: `${depl.verbal_plot_area_enrolled} Acres`,
            label: "Verbal Plot Area Enrolled"
        });
    }
    if (depl.boost_amount_plot_applied !== undefined) {
        items.push({
            id: "boost_amount_plot_applied",
            question: "boost_amount_plot_applied:",
            type: "text",
            answer: `${depl.boost_amount_plot_applied} kg/l`,
            label: "Boost Amount Plot Applied"
        });
    }
    if (depl.plot_area !== undefined) {
        items.push({
            id: "plot_area",
            question: "plot_area:",
            type: "text",
            answer: `${depl.plot_area} Acres`,
            label: "Plot Area"
        });
    }
    if (depl.baler_type !== undefined) {
        items.push({
            id: "baler_type",
            question: "baler_type:",
            type: "text",
            answer: depl.baler_type,
            label: "Baler Type"
        });
    }
    if (depl.num_bales_prepared !== undefined) {
        items.push({
            id: "num_bales_prepared",
            question: "num_bales_prepared:",
            type: "text",
            answer: `${depl.num_bales_prepared} Bales`,
            label: "Number of Bales Prepared"
        });
    }

    // Determine deployment pictures from the parent dispatch pictures
    const picturesToUse: string[] = [];
    if (depl.pictures && depl.pictures.length > 0) {
        picturesToUse.push(...depl.pictures);
    } else if (depl.picture) {
        picturesToUse.push(depl.picture);
    } else if (dispatchPictures && dispatchPictures.length > 0) {
        // Try to get pictures corresponding to this plot number or index
        const plotIndex = depl.plot_no !== undefined ? (depl.plot_no - 1) : 0;
        if (plotIndex >= 0 && plotIndex < dispatchPictures.length) {
            picturesToUse.push(dispatchPictures[plotIndex]);
        } else if (dispatchPictures.length > 0) {
            // Fallback: if index out of bounds, use the first picture
            picturesToUse.push(dispatchPictures[0]);
        }
    }

    if (picturesToUse.length > 0) {
        picturesToUse.forEach((picUrl: string, idx: number) => {
            items.push({
                id: `depl_pictures_${idx}`,
                question: `Picture of Deployment ${idx + 1}:`,
                type: "image",
                answer: picUrl,
                label: `Picture of Deployment ${idx + 1}`
            });
        });
    } else {
        // Fallback placeholder image for other records
        items.push({
            id: "depl_pictures_0",
            question: "Picture of Deployment 1:",
            type: "image",
            answer: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
            label: "Picture of Deployment 1"
        });
    }

    return items;
};

export function EngagementDetailSheet({
    record,
    open,
    onOpenChange,
    onNext,
    onPrevious,
    isFirst,
    isLast,
    currentIndex,
    totalCount,
    surveyData: customSurveyData,
    hasLocationQuestion = true,
    language = "en",
    onLanguageChange,
    defaultTab
}: EngagementDetailSheetProps) {
    const [comment, setComment] = React.useState("")
    const [isSavingComment, setIsSavingComment] = React.useState(false)
    const [localComments, setLocalComments] = React.useState<VerificationComment[]>([])
    const [isApproving, setIsApproving] = React.useState(false)
    const [showCommentInput, setShowCommentInput] = React.useState(false)
    const [isReporting, setIsReporting] = React.useState(false)
    const [reportedIds, setReportedIds] = React.useState<string[]>([])
    const [previewItem, setPreviewItem] = React.useState<SurveyItem | null>(null)
    const [selectedPlot, setSelectedPlot] = React.useState<any | null>(null)
    const [hoveredPlotId, setHoveredPlotId] = React.useState<string | null>(null)
    const [zoom, setZoom] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [imageMode, setImageMode] = React.useState<"fill" | "fit" | "stretch" | "center">("fit")
    const [isDataLoading, setIsDataLoading] = React.useState(false)
    const [isSurveyorPhoneVisible, setIsSurveyorPhoneVisible] = React.useState(false)
    const [mapCenter, setMapCenter] = React.useState<google.maps.LatLngLiteral | null>(null)
    const [mapZoom, setMapZoom] = React.useState<number>(17)
    const [isShowingSpecificLocation, setIsShowingSpecificLocation] = React.useState(false)
    const [isMapInteracted, setIsMapInteracted] = React.useState(false)
    const [resetCount, setResetCount] = React.useState(0)
    const [localFarmerPlots, setLocalFarmerPlots] = React.useState<Plot[]>([])
    const [isMapEditorOpen, setIsMapEditorOpen] = React.useState(false)
    const [specificMarker, setSpecificMarker] = React.useState<google.maps.LatLngLiteral | null>(null)
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const isProgrammaticChange = React.useRef(false);

    const [expandedDispatches, setExpandedDispatches] = React.useState<string[]>([])
    const [expandedDeployments, setExpandedDeployments] = React.useState<string[]>([])
    const [hiddenDispatches, setHiddenDispatches] = React.useState<string[]>([])
    const [hiddenDeployments, setHiddenDeployments] = React.useState<string[]>([])
    const [activeReportingCardId, setActiveReportingCardId] = React.useState<string | null>(null)
    const [dispatchStatus, setDispatchStatus] = React.useState<"Pending" | "Verified" | "Need Correction">("Pending")
    const [deploymentStatus, setDeploymentStatus] = React.useState<"Pending" | "Verified" | "Need Correction">("Pending")
    const [dispatchVerifierName, setDispatchVerifierName] = React.useState<string>("Verifier F")
    const [dispatchVerifierTime, setDispatchVerifierTime] = React.useState<string>("15 Apr 2025, 10:15 AM")
    const [dispatchReporterName, setDispatchReporterName] = React.useState<string>("Auditor")
    const [dispatchReporterTime, setDispatchReporterTime] = React.useState<string>("15 Apr 2025, 09:30 AM")
    const [deploymentVerifierName, setDeploymentVerifierName] = React.useState<string>("Verifier F")
    const [deploymentVerifierTime, setDeploymentVerifierTime] = React.useState<string>("15 Apr 2025, 10:15 AM")
    const [deploymentReporterName, setDeploymentReporterName] = React.useState<string>("Auditor")
    const [deploymentReporterTime, setDeploymentReporterTime] = React.useState<string>("15 Apr 2025, 09:30 AM")

    // Dictionary states for independent card approvals and reporting
    const [dispatchStatuses, setDispatchStatuses] = React.useState<Record<string, "Pending" | "Verified" | "Need Correction">>({})
    const [deploymentStatuses, setDeploymentStatuses] = React.useState<Record<string, "Pending" | "Verified" | "Need Correction">>({})
    const [dispatchVerifierNames, setDispatchVerifierNames] = React.useState<Record<string, string>>({})
    const [dispatchVerifierTimes, setDispatchVerifierTimes] = React.useState<Record<string, string>>({})
    const [dispatchReporterNames, setDispatchReporterNames] = React.useState<Record<string, string>>({})
    const [dispatchReporterTimes, setDispatchReporterTimes] = React.useState<Record<string, string>>({})
    const [dispatchReportComments, setDispatchReportComments] = React.useState<Record<string, string>>({})
    const [deploymentVerifierNames, setDeploymentVerifierNames] = React.useState<Record<string, string>>({})
    const [deploymentVerifierTimes, setDeploymentVerifierTimes] = React.useState<Record<string, string>>({})
    const [deploymentReporterNames, setDeploymentReporterNames] = React.useState<Record<string, string>>({})
    const [deploymentReporterTimes, setDeploymentReporterTimes] = React.useState<Record<string, string>>({})
    const [deploymentReportComments, setDeploymentReportComments] = React.useState<Record<string, string>>({})
    const [reportingCardType, setReportingCardType] = React.useState<"dispatch" | "deployment" | null>(null)
    const [selectedReportFields, setSelectedReportFields] = React.useState<string[]>([])
    const [cardReportComment, setCardReportComment] = React.useState("")
    const [dispatchReportComment, setDispatchReportComment] = React.useState("")
    const [deploymentReportComment, setDeploymentReportComment] = React.useState("")
    const [toastMessage, setToastMessage] = React.useState<{ title: string; description: string; type: "success" | "error" } | null>(null)
    const [activeTab, setActiveTab] = React.useState<"all" | "verified" | "pending" | "need_correction" | "details">("all")
    const [selectedDispatchId, setSelectedDispatchId] = React.useState<string | null>(null)
    const [selectedDeploymentId, setSelectedDeploymentId] = React.useState<string | null>(null)
    // Per-section comment maps (dispatch and deployment level)
    const [dispatchCommentDraft, setDispatchCommentDraft] = React.useState<Record<string, string>>({})
    const [deploymentCommentDraft, setDeploymentCommentDraft] = React.useState<Record<string, string>>({})
    const [dispatchCommentsList, setDispatchCommentsList] = React.useState<Record<string, VerificationComment[]>>({})
    const [deploymentCommentsList, setDeploymentCommentsList] = React.useState<Record<string, VerificationComment[]>>({})
    const [showDispatchCommentInput, setShowDispatchCommentInput] = React.useState<Record<string, boolean>>({})
    const [showDeploymentCommentInput, setShowDeploymentCommentInput] = React.useState<Record<string, boolean>>({})

    React.useEffect(() => {
        setSelectedDispatchId(null);
        setSelectedDeploymentId(null);
    }, [record?.id, open]);

    React.useEffect(() => {
        setSelectedDeploymentId(null);
    }, [selectedDispatchId]);

    React.useEffect(() => {
        setIsReporting(false);
        setReportingCardType(null);
        setActiveReportingCardId(null);
        setReportedIds([]);
        setReportComment("");
    }, [selectedDispatchId, selectedDeploymentId]);

    React.useEffect(() => {
        if (open && defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab, record?.id]);

    const showToast = (title: string, description: string, type: "success" | "error") => {
        setToastMessage({ title, description, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Synchronize statuses with the record status when record or sheet open state changes
    React.useEffect(() => {
        if (record) {
            setExpandedDispatches([]);
            setExpandedDeployments([]);
            setHiddenDispatches([]);
            setHiddenDeployments([]);
            setActiveTab(defaultTab || "all");
            setActiveReportingCardId(null);

            const farmer = MOCK_FARMERS.find(f => f.name === record.farmer.name) || MOCK_FARMERS[0];
            setLocalFarmerPlots(farmer ? farmer.plots : []);

            const initialStatus = 
                record.status === "Verified" ? "Verified" :
                record.status === "Invalid" ? "Need Correction" :
                "Pending";
            setDispatchStatus(initialStatus);
            setDeploymentStatus(initialStatus);

            const vName = record.verified?.verifier || "Verifier F";
            const vTime = record.verified?.date
                ? format(new Date(record.verified.date), "dd MMM yyyy, hh:mm a")
                : "15 Apr 2025, 10:15 AM";

            const rName = record.surveyor?.name || "Auditor";
            const rTime = record.submittedOn
                ? format(new Date(record.submittedOn), "dd MMM yyyy, hh:mm a")
                : "15 Apr 2025, 09:30 AM";

            setDispatchVerifierName(vName);
            setDispatchVerifierTime(vTime);
            setDispatchReporterName(rName);
            setDispatchReporterTime(rTime);

            setDeploymentVerifierName(vName);
            setDeploymentVerifierTime(vTime);
            setDeploymentReporterName(rName);
            setDeploymentReporterTime(rTime);
            
            const fallbackComment = record.status === "Invalid"
                ? (record.reportComment || "The soil analysis report seems to be missing the nitrogen levels. Please re-upload the correct document.")
                : "";

            setDispatchReportComment(fallbackComment);
            setDeploymentReportComment(fallbackComment);

            // Populate dictionary states for all dispatches/deployments of this record
            let recordDispatches: any[] = [];
            if (record.farmer.name === "Farmer Science") {
                recordDispatches = [
                    { id: "DISP-1774084912326", deployments: [{ id: "DEPL-1774084912326" }] },
                    { id: "DISP-1774085356761", deployments: [{ id: "DEPL-1774085356761" }] }
                ];
            } else if (record.farmer.name === "Farmer AWD") {
                recordDispatches = [
                    {
                        id: "DISP-1776233378346",
                        deployments: [
                            { id: "DEPL-1776233378346-1" },
                            { id: "DEPL-1776233378346-2" },
                            { id: "DEPL-1776233378346-3" },
                            { id: "DEPL-1776233378346-4" },
                            { id: "DEPL-1776233378346-5" },
                            { id: "DEPL-1776233378346-6" },
                            { id: "DEPL-1776233378346-7" }
                        ]
                    }
                ];
            } else if (record.farmer.name === "Farmer MatiBoost") {
                recordDispatches = [
                    {
                        id: "DISP-1771928026711",
                        deployments: [
                            { id: "DEPL-1771928026711-1" },
                            { id: "DEPL-1771928026711-2" },
                            { id: "DEPL-1771928026711-3" },
                            { id: "DEPL-1771928026711-4" }
                        ]
                    }
                ];
            } else if (record.farmer.name === "Farmer Biomass") {
                recordDispatches = [
                    { id: "DISP-1775797163737", deployments: [{ id: "DEPL-1775797163737-1" }, { id: "DEPL-1775797163737-2" }] },
                    { id: "DISP-1775797204167", deployments: [{ id: "DEPL-1775797204167-1" }, { id: "DEPL-1775797204167-2" }] },
                    { id: "DISP-1775797244198", deployments: [{ id: "DEPL-1775797244198-1" }, { id: "DEPL-1775797244198-2" }] }
                ];
            } else if (record.farmer.name === "Aditya Puri") {
                recordDispatches = [
                    { id: "DISP-1766990550669", deployments: [{ id: "DEPL-1766990550669" }] },
                    { id: "DISP-1766990514355", deployments: [{ id: "DEPL-1766990514355" }] },
                    { id: "DISP-1766990598966", deployments: [{ id: "DEPL-1766990598966" }] },
                    { id: "DISP-1766991541477", deployments: [{ id: "DEPL-1766991541477" }] },
                    { id: "DISP-1766992895851", deployments: [{ id: "DEPL-1766992895851" }] },
                    { id: "DISP-1766991727733", deployments: [{ id: "DEPL-1766991727733" }] },
                    { id: "DISP-1766992559653", deployments: [{ id: "DEPL-1766992559653" }] },
                    { id: "DISP-1766990635389", deployments: [{ id: "DEPL-1766990635389" }] },
                    { id: "DISP-1766991586958", deployments: [{ id: "DEPL-1766991586958" }] },
                    { id: "DISP-1766991355325", deployments: [{ id: "DEPL-1766991355325" }] }
                ];
            } else if (record.farmer.name === "Sagar Rahangdale" || record.farmer.name === "Farmer J") {
                recordDispatches = [
                    { id: "DISP-1744692307629", deployments: [{ id: "DEPL-1744692307629-1" }, { id: "DEPL-1744692307629-2" }] },
                    { id: "DISP-1744691260136", deployments: [{ id: "DEPL-1744691260136-1" }, { id: "DEPL-1744691260136-2" }] },
                    { id: "DISP-1744691545620", deployments: [{ id: "DEPL-1744691545620-1" }, { id: "DEPL-1744691545620-2" }] },
                    { id: "DISP-1744691789963", deployments: [{ id: "DEPL-1744691789963-1" }, { id: "DEPL-1744691789963-2" }] },
                    { id: "DISP-1744692120023", deployments: [{ id: "DEPL-1744692120023-1" }, { id: "DEPL-1744692120023-2" }, { id: "DEPL-1744692120023-3" }] },
                    { id: "DISP-1744692558869", deployments: [{ id: "DEPL-1744692558869-1" }, { id: "DEPL-1744692558869-2" }, { id: "DEPL-1744692558869-3" }, { id: "DEPL-1744692558869-4" }, { id: "DEPL-1744692558869-5" }, { id: "DEPL-1744692558869-6" }] }
                ];
            } else {
                recordDispatches = [
                    { id: "DISP-1", deployments: [{ id: "DEPL-1" }, { id: "DEPL-2" }] },
                    { id: "DISP-2", deployments: [{ id: "DEPL-3" }] }
                ];
            }

            const newDispStatuses: Record<string, "Pending" | "Verified" | "Need Correction"> = {};
            const newDispVNames: Record<string, string> = {};
            const newDispVTimes: Record<string, string> = {};
            const newDispRNames: Record<string, string> = {};
            const newDispRTimes: Record<string, string> = {};
            const newDispComments: Record<string, string> = {};

            const newDeplStatuses: Record<string, "Pending" | "Verified" | "Need Correction"> = {};
            const newDeplVNames: Record<string, string> = {};
            const newDeplVTimes: Record<string, string> = {};
            const newDeplRNames: Record<string, string> = {};
            const newDeplRTimes: Record<string, string> = {};
            const newDeplComments: Record<string, string> = {};

            recordDispatches.forEach(disp => {
                newDispStatuses[disp.id] = initialStatus;
                newDispVNames[disp.id] = vName;
                newDispVTimes[disp.id] = vTime;
                newDispRNames[disp.id] = rName;
                newDispRTimes[disp.id] = rTime;
                newDispComments[disp.id] = fallbackComment;

                if (disp.deployments) {
                    disp.deployments.forEach((depl: any) => {
                        newDeplStatuses[depl.id] = initialStatus;
                        newDeplVNames[depl.id] = vName;
                        newDeplVTimes[depl.id] = vTime;
                        newDeplRNames[depl.id] = rName;
                        newDeplRTimes[depl.id] = rTime;
                        newDeplComments[depl.id] = fallbackComment;
                    });
                }
            });

            setDispatchStatuses(newDispStatuses);
            setDispatchVerifierNames(newDispVNames);
            setDispatchVerifierTimes(newDispVTimes);
            setDispatchReporterNames(newDispRNames);
            setDispatchReporterTimes(newDispRTimes);
            setDispatchReportComments(newDispComments);

            setDeploymentStatuses(newDeplStatuses);
            setDeploymentVerifierNames(newDeplVNames);
            setDeploymentVerifierTimes(newDeplVTimes);
            setDeploymentReporterNames(newDeplRNames);
            setDeploymentReporterTimes(newDeplRTimes);
            setDeploymentReportComments(newDeplComments);
        }
    }, [record, open]);

    const dispatchActivityInfo = (
        <div className="space-y-2 text-xs text-left">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide text-[10px]">Dispatch Activity Log</h4>
            <div className="space-y-1 text-zinc-500 dark:text-zinc-400 font-medium">
                <p>• <strong>12 Jul 2026, 09:30 AM:</strong> Created by Operator John Doe</p>
                <p>• <strong>12 Jul 2026, 11:15 AM:</strong> Dispatched from Main Warehouse</p>
                <p>• <strong>13 Jul 2026, 02:45 PM:</strong> Received at Transit Hub Bangalore</p>
            </div>
        </div>
    )

    const deploymentActivityInfo = (
        <div className="space-y-2 text-xs text-left">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide text-[10px]">Deployment Activity Log</h4>
            <div className="space-y-1 text-zinc-500 dark:text-zinc-400 font-medium">
                <p>• <strong>14 Jul 2026, 10:00 AM:</strong> Assigned to Agent Rajesh Kumar</p>
                <p>• <strong>15 Jul 2026, 04:30 PM:</strong> GPS boundary confirmed on-site</p>
                <p>• <strong>16 Jul 2026, 11:00 AM:</strong> Seed varieties distributed</p>
            </div>
        </div>
    )

    // Helper function to translate text
    const t = React.useCallback((text: string) => {
        if (language === "en") return text;
        return translations[language]?.[text] || text;
    }, [language]);

    // Find the farmer in MOCK_FARMERS to get plot data
    const baseFarmerData = MOCK_FARMERS.find(f => f.name === record?.farmer.name) || MOCK_FARMERS[0];
    const farmerData = React.useMemo(() => {
        return {
            ...baseFarmerData,
            plots: localFarmerPlots
        };
    }, [baseFarmerData, localFarmerPlots]);

    // Calculate a persistent question location for this farmer
    const questionLocation = React.useMemo(() => {
        if (farmerData && farmerData.plots.length > 0) {
            return {
                lat: farmerData.plots[0].location.lat + 0.0005,
                lng: farmerData.plots[0].location.lng + 0.0005
            };
        }
        return null;
    }, [farmerData?.id]);
    
    // Use custom survey data if provided, otherwise fallback to default surveyData
    const activeSurveyData = customSurveyData || surveyData;

    // Reporting states
    const [isReportingFinalStep, setIsReportingFinalStep] = React.useState(false)
    const [reportComment, setReportComment] = React.useState("")
    const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)
    const [reportSuccess, setReportSuccess] = React.useState(false)
    const [isReportCommentMinimized, setIsReportCommentMinimized] = React.useState(false)
    const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false)
    const [scrollProgress, setScrollProgress] = React.useState(0)
    const [isApproveLoaded, setIsApproveLoaded] = React.useState(false)
    const scrollAreaRef = React.useRef<HTMLDivElement>(null)
    const [infoSwitchIndex, setInfoSwitchIndex] = React.useState(0)
    const [isInfoHovered, setIsInfoHovered] = React.useState(false)

    // Switch info every 5 seconds
    React.useEffect(() => {
        if (isInfoHovered) return;

        const timer = setInterval(() => {
            setInfoSwitchIndex(prev => (prev + 1) % 2);
        }, 5000);

        return () => clearInterval(timer);
    }, [isInfoHovered]);

    // Reset switch index when record changes
    React.useEffect(() => {
        setInfoSwitchIndex(0);
    }, [record?.id]);

    // Track scroll progress for Approve button
    React.useEffect(() => {
        // Wait for a bit longer to ensure the DOM and images are ready
        const initTimer = setTimeout(() => {
            const scrollArea = scrollAreaRef.current
            if (!scrollArea) return

            // Find the viewport element. Radix ScrollArea uses a specific data attribute.
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                             
            if (!viewport) return

            const handleScroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = viewport;
                const totalScrollable = scrollHeight - clientHeight;
                
                // If content is not scrollable (fits in view), it's effectively "at the bottom"
                if (totalScrollable <= 0) {
                    setScrollProgress(100)
                    setHasScrolledToBottom(true)
                    setIsApproveLoaded(true)
                    return
                }

                const progress = (scrollTop / totalScrollable) * 100
                setScrollProgress(progress)

                // If we've reached within 20px of the bottom, consider it "scrolled to bottom"
                if (scrollTop + clientHeight >= scrollHeight - 20) {
                    setHasScrolledToBottom(true)
                    setIsApproveLoaded(true)
                }
            }

            viewport.addEventListener('scroll', handleScroll)
            // Initial check
            handleScroll();

            // Store for cleanup
            (viewport as any)._cleanup = () => viewport.removeEventListener('scroll', handleScroll);
        }, 1200);

        return () => {
            clearTimeout(initTimer);
            const scrollArea = scrollAreaRef.current;
            if (scrollArea) {
                const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as any;
                if (viewport && viewport._cleanup) viewport._cleanup();
            }
        }
    }, [farmerData, activeSurveyData, open])

    // Reset scroll state when a new farmer is selected
    React.useEffect(() => {
        setHasScrolledToBottom(false)
        setScrollProgress(0)
        setIsApproveLoaded(false)
    }, [record?.id]) // Reset when record ID changes

    // Determine if we are previewing something else (image, video, file)
    const activePreview = previewItem && previewItem.type !== "map" ? previewItem : null;

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: env.googleMapsApiKey,
        libraries: LIBRARIES
    });

    const [mapVisible, setMapVisible] = React.useState(false)
    const [isMapReady, setIsMapReady] = React.useState(false)

    const onMapIdle = React.useCallback(() => {
        if (!isMapReady) {
            setIsMapReady(true);
        }
    }, [isMapReady]);

    // Reset state when record changes
    React.useEffect(() => {
        setComment("")
        setIsSavingComment(false)
        setLocalComments(record?.verificationComments || [])
        setIsApproving(false)
        setShowCommentInput(false)
        setIsReporting(false)
        setReportedIds([])
        setPreviewItem(null);
        setZoom(1);
        setRotation(0);
        setImageMode("fit");
        setIsMapReady(false); // Reset map ready state
        setMapCenter(null); // Reset map center
        setSpecificMarker(null); // Reset specific marker
        setMapZoom(17); // Reset map zoom
        setIsShowingSpecificLocation(false); // Reset specific location state
        setIsMapInteracted(false); // Reset map interaction state
        
        if (open) {
            setMapVisible(true);
            setIsDataLoading(true);
            const timer = setTimeout(() => {
                setIsDataLoading(false);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setMapVisible(false);
            setIsDataLoading(false);
        }
    }, [record?.id, open])

    const mockDispatches = React.useMemo(() => {
        if (!record) return [];
        if (record.farmer.name === "Farmer Science") {
            return [
                {
                    id: "DISP-1774084912326",
                    date: "21 Mar 2026",
                    date_raw: 1774051200000,
                    vehicleId: "N/A",
                    trailer_no: "MP 22 AB 9081",
                    source_name: "Mati Boost",
                    carrier: "Mati Boost",
                    cluster_name: "Cluster 1",
                    surveyor_name: "Nilesh Kumar",
                    surveyor_registred_no: "+919406277649",
                    quantity: "2 Tons",
                    batch_id: "B7,12/03/26",
                    material_type: "Mati Boost",
                    created_at_raw: 1774084912326,
                    updated_at_raw: 1774085276544,
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FgHoTyOaEEmMPQfbfYcr4euSuE3p2%2Fvideos%2F2026_03_21_14_56_50_853.mp4?alt=media&token=cd23817e-38f0-410b-8152-5e29d6984ec9",
                    deployments: [
                        {
                            id: "DEPL-1774084912326",
                            plot_no: 1,
                            plot: "Plot 1",
                            plot_code: "CB12",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "22.6889° N, 81.8894° E",
                            plot_location: [{ lat: 22.688934343645382, lng: 81.88942708075047 }]
                        }
                    ]
                },
                {
                    id: "DISP-1774085356761",
                    date: "21 Mar 2026",
                    date_raw: 1774051200000,
                    vehicleId: "N/A",
                    trailer_no: "MP 22 AB 9081",
                    source_name: "Mati Boost",
                    carrier: "Mati Boost",
                    cluster_name: "Cluster 1",
                    surveyor_name: "Nilesh Kumar",
                    surveyor_registred_no: "+919406277649",
                    quantity: "3 Tons",
                    batch_id: "B7,12/03/26",
                    material_type: "Mati Boost",
                    created_at_raw: 1774085356761,
                    updated_at_raw: 1774085762954,
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FgHoTyOaEEmMPQfbfYcr4euSuE3p2%2Fvideos%2F2026_03_21_15_04_20_959.mp4?alt=media&token=26ab24f2-89a9-4ced-8f9c-b7f2850b6df0",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FgHoTyOaEEmMPQfbfYcr4euSuE3p2%2Fimages%2F2026_03_21_15_05_47_616.jpg?alt=media&token=ba76cd27-000f-41b0-9897-a0015b14ba06"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1774085356761",
                            plot_no: 1,
                            plot: "Plot 1",
                            plot_code: "CB11",
                            amt_deploy: 3,
                            quantity: "3 Tons",
                            coordinates: "22.6879° N, 81.8890° E",
                            plot_location: [{ lat: 22.687945102798523, lng: 81.88903514295816 }]
                        }
                    ]
                }
            ];
        }
        if (record.farmer.name === "Farmer AWD") {
            return [
                {
                    id: "DISP-1776233378346",
                    date: "15 Apr 2026",
                    date_raw: 1776211200000,
                    vehicleId: "N/A",
                    trailer_no: "MP 22 MA 5163",
                    source_name: "AWD",
                    carrier: "AWD",
                    cluster_name: "Cluster 2",
                    surveyor_name: "anuj kori",
                    surveyor_registred_no: "+916267685519",
                    quantity: "3 Tons",
                    num_plots_unload: 7,
                    created_at_raw: 1776233378346,
                    updated_at_raw: 1776262659876,
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_40_32_417.jpg?alt=media&token=3a1ff781-d242-4c38-820f-d3089539c816",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_42_13_251.jpg?alt=media&token=5d425b7f-6c4e-4ec6-9a08-3da2c91723a8",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_42_46_553.jpg?alt=media&token=75ac5888-c66d-4255-acb4-af7d08bc05f1",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_44_27_794.jpg?alt=media&token=eca216ce-afce-4900-ab30-ab9d6e60e426",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_46_05_637.jpg?alt=media&token=3fbeaaf0-d059-4c6b-a842-165bdd3f5345",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_47_12_343.jpg?alt=media&token=e3960ef1-b7e3-4c4b-807f-e2a4f7829ccc",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_48_38_860.jpg?alt=media&token=b764abc4-ccfa-4dbd-9f7c-2f95e8d37115"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1776233378346-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            verbal_plot_area_enrolled: 0.5,
                            amt_deploy: 0.5,
                            coordinates: "22.7892° N, 81.9863° E",
                            plot_location: [{ lat: 22.78924359078403, lng: 81.98627896606922 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_40_32_417.jpg?alt=media&token=3a1ff781-d242-4c38-820f-d3089539c816"]
                        },
                        {
                            id: "DEPL-1776233378346-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            verbal_plot_area_enrolled: 0.4,
                            amt_deploy: 0.4,
                            coordinates: "22.7893° N, 81.9857° E",
                            plot_location: [{ lat: 22.789254409391848, lng: 81.98565803468227 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_42_13_251.jpg?alt=media&token=5d425b7f-6c4e-4ec6-9a08-3da2c91723a8"]
                        },
                        {
                            id: "DEPL-1776233378346-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            verbal_plot_area_enrolled: 0.4,
                            amt_deploy: 0.4,
                            coordinates: "22.7891° N, 81.9860° E",
                            plot_location: [{ lat: 22.78905689238813, lng: 81.98604360222816 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_42_46_553.jpg?alt=media&token=75ac5888-c66d-4255-acb4-af7d08bc05f1"]
                        },
                        {
                            id: "DEPL-1776233378346-4",
                            plot_no: 4,
                            plot: "Plot 4",
                            verbal_plot_area_enrolled: 0.2,
                            amt_deploy: 0.2,
                            coordinates: "22.7888° N, 81.9858° E",
                            plot_location: [{ lat: 22.788847629147178, lng: 81.98580253869295 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_44_27_794.jpg?alt=media&token=eca216ce-afce-4900-ab30-ab9d6e60e426"]
                        },
                        {
                            id: "DEPL-1776233378346-5",
                            plot_no: 5,
                            plot: "Plot 5",
                            verbal_plot_area_enrolled: 0.6,
                            amt_deploy: 0.6,
                            coordinates: "22.7887° N, 81.9863° E",
                            plot_location: [{ lat: 22.788697713629446, lng: 81.98633294552565 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_46_05_637.jpg?alt=media&token=3fbeaaf0-d059-4c6b-a842-165bdd3f5345"]
                        },
                        {
                            id: "DEPL-1776233378346-6",
                            plot_no: 6,
                            plot: "Plot 6",
                            verbal_plot_area_enrolled: 0.4,
                            amt_deploy: 0.4,
                            coordinates: "22.7889° N, 81.9866° E",
                            plot_location: [{ lat: 22.78885659316262, lng: 81.98655422776937 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_47_12_343.jpg?alt=media&token=e3960ef1-b7e3-4c4b-807f-e2a4f7829ccc"]
                        },
                        {
                            id: "DEPL-1776233378346-7",
                            plot_no: 7,
                            plot: "Plot 7",
                            verbal_plot_area_enrolled: 0.5,
                            amt_deploy: 0.5,
                            coordinates: "22.7889° N, 81.9855° E",
                            plot_location: [{ lat: 22.788887812660025, lng: 81.98553130030632 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_04_15_11_48_38_860.jpg?alt=media&token=b764abc4-ccfa-4dbd-9f7c-2f95e8d37115"]
                        }
                    ]
                }
            ];
        }
        if (record.farmer.name === "Farmer MatiBoost") {
            return [
                {
                    id: "DISP-1771928026711",
                    date: "24 Feb 2026",
                    date_raw: 1771891200000,
                    vehicleId: "N/A",
                    trailer_no: "MP 22 MA 7842",
                    source_name: "MatiBoost",
                    carrier: "MatiBoost",
                    cluster_name: "Cluster 2",
                    surveyor_name: "anuj kori",
                    surveyor_registred_no: "+916267685519",
                    quantity: "62 Units",
                    num_plots_unload: 4,
                    crop_stage: "Sowing",
                    field_condition: "Wet",
                    batch_id: "b2",
                    created_at_raw: 1771928026711,
                    updated_at_raw: 1771928433785,
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fvideos%2F2026_02_24_15_44_16_736.mp4?alt=media&token=aacade01-a3e9-42a0-850a-677f4b87730e",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_48_22_191.jpg?alt=media&token=a4ce0038-efa9-453b-93ac-f2e8d101a5bf",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_48_42_597.jpg?alt=media&token=8b470950-be62-4c95-af92-f86f5d3611c8",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_49_03_955.jpg?alt=media&token=f9f44dc0-af5b-4092-b822-b0b19e3ce86d",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_50_03_349.jpg?alt=media&token=be1976ac-0c6c-4533-b4fa-3f3a5884029b"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1771928026711-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            boost_amount_plot_applied: 20,
                            amt_deploy: 2.0,
                            coordinates: "22.7890° N, 81.9861° E",
                            plot_location: [{ lat: 22.789047928385862, lng: 81.98608685284853 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_48_22_191.jpg?alt=media&token=a4ce0038-efa9-453b-93ac-f2e8d101a5bf"]
                        },
                        {
                            id: "DEPL-1771928026711-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            boost_amount_plot_applied: 20,
                            amt_deploy: 2.0,
                            coordinates: "22.7888° N, 81.9866° E",
                            plot_location: [{ lat: 22.788822591721672, lng: 81.98656395077705 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_48_42_597.jpg?alt=media&token=8b470950-be62-4c95-af92-f86f5d3611c8"]
                        },
                        {
                            id: "DEPL-1771928026711-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            boost_amount_plot_applied: 20,
                            amt_deploy: 2.0,
                            coordinates: "22.7887° N, 81.9864° E",
                            plot_location: [{ lat: 22.78868967691664, lng: 81.9863611087203 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_49_03_955.jpg?alt=media&token=f9f44dc0-af5b-4092-b822-b0b19e3ce86d"]
                        },
                        {
                            id: "DEPL-1771928026711-4",
                            plot_no: 4,
                            plot: "Plot 4",
                            boost_amount_plot_applied: 2,
                            amt_deploy: 0.2,
                            coordinates: "22.7888° N, 81.9858° E",
                            plot_location: [{ lat: 22.78884391989926, lng: 81.98578611016273 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2Fjk3k1HGfkqgnR7vaB7jJ1W0P4O72%2Fimages%2F2026_02_24_15_50_03_349.jpg?alt=media&token=be1976ac-0c6c-4533-b4fa-3f3a5884029b"]
                        }
                    ]
                }
            ];
        }
        if (record.farmer.name === "Farmer Biomass") {
            return [
                {
                    id: "DISP-1775797163737",
                    date: "10 Apr 2026",
                    date_raw: 1775779200000,
                    vehicleId: "TEST01ABCD124",
                    trailer_no: "TEST01ABCD124",
                    trailer_id: 1775797124964,
                    source_name: "Biomass Pellet",
                    carrier: "Biomass Pellet",
                    cluster_name: "Cluster 1",
                    surveyor_name: "Test Surveyor ",
                    surveyor_registred_no: "+911111122225",
                    quantity: "3 Acres",
                    num_plots_unload: 2,
                    remarks: "no",
                    survey_type: "slashingOps",
                    responseId: "1775797163737",
                    created_at_raw: 1775797169434,
                    updated_at_raw: 1776246030870,
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_29_35_331.jpg?alt=media&token=675252e1-1d2c-4939-9337-c5eb7f7613bf",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_29_42_932.jpg?alt=media&token=11e18bf1-b036-4712-ae58-d2e5b6bb5818"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1775797163737-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            plot_area: 1,
                            amt_deploy: 1.0,
                            coordinates: "12.8608° N, 77.6020° E",
                            plot_location: [{ lat: 12.860813660360131, lng: 77.60198134928942 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_29_35_331.jpg?alt=media&token=675252e1-1d2c-4939-9337-c5eb7f7613bf"]
                        },
                        {
                            id: "DEPL-1775797163737-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            plot_area: 2,
                            amt_deploy: 2.0,
                            coordinates: "12.8561° N, 77.6048° E",
                            plot_location: [{ lat: 12.85605478372246, lng: 77.60484896600246 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_29_42_932.jpg?alt=media&token=11e18bf1-b036-4712-ae58-d2e5b6bb5818"]
                        }
                    ]
                },
                {
                    id: "DISP-1775797204167",
                    date: "10 Apr 2026",
                    date_raw: 1775779200000,
                    vehicleId: "TEST01ABCD124",
                    trailer_no: "TEST01ABCD124",
                    trailer_id: 1775797124964,
                    source_name: "Biomass Pellet",
                    carrier: "Biomass Pellet",
                    cluster_name: "Cluster 1",
                    surveyor_name: "Test Surveyor ",
                    surveyor_registred_no: "+911111122225",
                    quantity: "3 Acres",
                    num_plots_unload: 2,
                    remarks: "test",
                    survey_type: "rackingOps",
                    responseId: "1775797204167",
                    created_at_raw: 1775797207641,
                    updated_at_raw: 1775797230077,
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_13_161.jpg?alt=media&token=6eb2e62f-8ee6-4878-8c7a-75baf1d56d39",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_22_212.jpg?alt=media&token=04d19eeb-f9b4-4dcc-89fe-9bf9e5c20855"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1775797204167-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            plot_area: 1,
                            amt_deploy: 1.0,
                            coordinates: "12.8608° N, 77.6020° E",
                            plot_location: [{ lat: 12.860815621551774, lng: 77.60197129100561 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_13_161.jpg?alt=media&token=6eb2e62f-8ee6-4878-8c7a-75baf1d56d39"]
                        },
                        {
                            id: "DEPL-1775797204167-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            plot_area: 2,
                            amt_deploy: 2.0,
                            coordinates: "12.8557° N, 77.6044° E",
                            plot_location: [{ lat: 12.855676920017505, lng: 77.60444931685925 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_22_212.jpg?alt=media&token=04d19eeb-f9b4-4dcc-89fe-9bf9e5c20855"]
                        }
                    ]
                },
                {
                    id: "DISP-1775797244198",
                    date: "10 Apr 2026",
                    date_raw: 1775779200000,
                    vehicleId: "TEST01ABCD124",
                    trailer_no: "TEST01ABCD124",
                    trailer_id: 1775797124964,
                    source_name: "Biomass Pellet",
                    carrier: "Biomass Pellet",
                    cluster_name: "Cluster 1",
                    surveyor_name: "Test Surveyor ",
                    surveyor_registred_no: "+911111122225",
                    quantity: "3 Acres",
                    num_plots_unload: 2,
                    remarks: "test",
                    survey_type: "balingOps",
                    responseId: "1775797244198",
                    created_at_raw: 1775797248002,
                    updated_at_raw: 1775797274757,
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_54_422.jpg?alt=media&token=a27308ea-966b-4802-9869-1fdcfe334edf",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_31_08_107.jpg?alt=media&token=f90f27c2-df0d-4987-9241-b9c4de1b8475"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1775797244198-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            baler_type: "Round Baler",
                            num_bales_prepared: 1,
                            amt_deploy: 1.0,
                            coordinates: "12.8608° N, 77.6020° E",
                            plot_location: [{ lat: 12.860821505126589, lng: 77.60197162628174 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_30_54_422.jpg?alt=media&token=a27308ea-966b-4802-9869-1fdcfe334edf"]
                        },
                        {
                            id: "DEPL-1775797244198-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            baler_type: "Square Baler",
                            num_bales_prepared: 10,
                            amt_deploy: 2.0,
                            coordinates: "12.8556° N, 77.6037° E",
                            plot_location: [{ lat: 12.855608930639983, lng: 77.60367549955845 }],
                            pictures: ["https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FIRJo6Z75tHUenwfxXL9TOnIuB7c2%2Fimages%2F2026_04_10_10_31_08_107.jpg?alt=media&token=f90f27c2-df0d-4987-9241-b9c4de1b8475"]
                        }
                    ]
                }
            ];
        }
        if (record.farmer.name === "Aditya Puri") {
            return [
                {
                    id: "DISP-1766990550669",
                    created_at_raw: 1766990550669,
                    updated_at_raw: 1770724881663,
                    date: "23 Jan 2026",
                    vehicleId: "1035MASSEY FERGUSON",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_13_00_167.mp4?alt=media&token=b65d9177-6f50-4a48-9a37-dc9fa3dad451",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_13_08_888.jpg?alt=media&token=0928176a-6d29-40d0-844e-95e7748cc6c2"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766990550669",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3914° N, 81.4534° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_13_08_888.jpg?alt=media&token=0928176a-6d29-40d0-844e-95e7748cc6c2"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766990514355",
                    created_at_raw: 1766990514355,
                    updated_at_raw: 1770725055119,
                    date: "23 Jan 2026",
                    vehicleId: "Mahindra 275",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_12_06_362.mp4?alt=media&token=287e8fca-9488-4a3b-afee-6322250b2194",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_12_17_319.jpg?alt=media&token=5d51ac0a-8986-432c-824d-8c86a135f93b"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766990514355",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3915° N, 81.4536° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_12_17_319.jpg?alt=media&token=5d51ac0a-8986-432c-824d-8c86a135f93b"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766990598966",
                    created_at_raw: 1766990598966,
                    updated_at_raw: 1770724913562,
                    date: "23 Jan 2026",
                    vehicleId: "Mahindra YUVO TECH",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_13_30_282.mp4?alt=media&token=00abfcc7-1047-4dd5-89d7-617f8e17da77",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_13_39_045.jpg?alt=media&token=dd502423-a2c4-4e15-b091-ef17d5b9a65b"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766990598966",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3913° N, 81.4536° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_13_39_045.jpg?alt=media&token=dd502423-a2c4-4e15-b091-ef17d5b9a65b"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766991541477",
                    created_at_raw: 1766991541477,
                    updated_at_raw: 1770724786868,
                    date: "23 Jan 2026",
                    vehicleId: "1035MASSEY FERGUSON",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_29_12_484.mp4?alt=media&token=b5fa8224-85ea-4dcc-9e42-e8c69dbecdba",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_29_20_586.jpg?alt=media&token=1e521343-d503-478d-8365-6b39036dfbfc"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766991541477",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3913° N, 81.4533° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_29_20_586.jpg?alt=media&token=1e521343-d503-478d-8365-6b39036dfbfc"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766992895851",
                    created_at_raw: 1766992895851,
                    updated_at_raw: 1770725085435,
                    date: "23 Jan 2026",
                    vehicleId: "Eicher",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_51_48_550.mp4?alt=media&token=85db9e9f-45a6-40c0-8ddc-cc6855bff703",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_51_57_623.jpg?alt=media&token=533b5cea-7a02-448d-8f57-6d7648447b63"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766992895851",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3916° N, 81.4537° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_51_57_623.jpg?alt=media&token=533b5cea-7a02-448d-8f57-6d7648447b63"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766991727733",
                    created_at_raw: 1766991727733,
                    updated_at_raw: 1770724830111,
                    date: "23 Jan 2026",
                    vehicleId: "Mahindra YUVO TECH",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_32_29_826.mp4?alt=media&token=004679fe-4305-493c-9580-aabf72330801",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_32_36_593.jpg?alt=media&token=9a133515-2317-46ba-8150-bbf34679dc6d"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766991727733",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3912° N, 81.4534° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_32_36_593.jpg?alt=media&token=9a133515-2317-46ba-8150-bbf34679dc6d"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766992559653",
                    created_at_raw: 1766992559653,
                    updated_at_raw: 1770725100613,
                    date: "23 Jan 2026",
                    vehicleId: "Mahindra 275",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_46_24_691.mp4?alt=media&token=325fddcc-7791-4c6d-a319-3b9c69f53b41",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_46_34_010.jpg?alt=media&token=97893986-f53d-4a0f-9194-72ea175be53f"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766992559653",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3932° N, 81.4543° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_46_34_010.jpg?alt=media&token=97893986-f53d-4a0f-9194-72ea175be53f"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766990635389",
                    created_at_raw: 1766990635389,
                    updated_at_raw: 1770725031770,
                    date: "23 Jan 2026",
                    vehicleId: "Eicher",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_14_07_954.mp4?alt=media&token=a0e8ca0f-6929-46b5-a182-f0963d1c6261",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_14_14_914.jpg?alt=media&token=d146bb91-f3d0-4855-bc78-df251ed01361"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766990635389",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3916° N, 81.4535° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_14_14_914.jpg?alt=media&token=d146bb91-f3d0-4855-bc78-df251ed01361"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766991586958",
                    created_at_raw: 1766991586958,
                    updated_at_raw: 1770725072195,
                    date: "23 Jan 2026",
                    vehicleId: "Eicher",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_30_57_449.mp4?alt=media&token=b0b38365-ec47-451d-9d10-2ac32e9e4145",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_31_05_184.jpg?alt=media&token=dfc16834-e71b-422e-bbdf-581d43cbde95"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766991586958",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3917° N, 81.4537° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_31_05_184.jpg?alt=media&token=dfc16834-e71b-422e-bbdf-581d43cbde95"
                            ]
                        }
                    ]
                },
                {
                    id: "DISP-1766991355325",
                    created_at_raw: 1766991355325,
                    updated_at_raw: 1770725131285,
                    date: "23 Jan 2026",
                    vehicleId: "Mahindra 275",
                    carrier: "KGSCS",
                    quantity: "5 Tons",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fvideos%2F2025_12_29_12_26_39_617.mp4?alt=media&token=8cd01131-324c-48f9-b3ec-845bbee3f44c",
                    picture_deployment: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_28_09_994_1000306688.jpg?alt=media&token=45c00011-413c-42b6-9f16-2145716c2bbd"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1766991355325",
                            agent: "Aditya Puri",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 5,
                            quantity: "5 Tons",
                            coordinates: "23.3933° N, 81.4541° E",
                            pictures: [
                                "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FjtsvxP6YokRmVcvI1onX1VF4bQx1%2Fimages%2F2025_12_29_12_28_09_994_1000306688.jpg?alt=media&token=45c00011-413c-42b6-9f16-2145716c2bbd"
                            ]
                        }
                    ]
                }
            ];
        }
        if (record.farmer.name === "Sagar Rahangdale" || record.farmer.name === "Farmer J") {
            return [
                {
                    id: "DISP-1744692307629",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP22AB4281",
                    trailer_no: "MP22AB4281",
                    trailer_id: 1714015547088,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "Sagar rahangdale",
                    surveyor_registred_no: "+919522797884",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 2,
                    created_at_raw: "1744692307629",
                    updated_at_raw: "1744819253618",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_15_41_448.mp4?alt=media&token=9a351f01-4e26-45ff-99d1-dfae85687b31",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_15_54_975.jpg?alt=media&token=7fdad133-44a1-471b-a318-b17c6664facb",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_16_00_329.jpg?alt=media&token=ca5b0c24-70f4-4eca-892a-7f5399a5438d"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744692307629-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 3,
                            quantity: "3 Tons",
                            coordinates: "21.9161° N, 79.7993° E"
                        },
                        {
                            id: "DEPL-1744692307629-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9157° N, 79.8003° E"
                        }
                    ]
                },
                {
                    id: "DISP-1744691260136",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP22AB4281",
                    trailer_no: "MP22AB4281",
                    trailer_id: 1714015547088,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "jayant pandre",
                    surveyor_registred_no: "+916269454856",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 4,
                    created_at_raw: "1744691260136",
                    updated_at_raw: "1744691637919",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_09_57_48_898.mp4?alt=media&token=641c3bf4-0647-4d67-950b-75f9c9f45695",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_57_58_498.jpg?alt=media&token=f3346c2a-968c-4457-a71a-cb607992a7fd",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_03_885.jpg?alt=media&token=1a3a8a58-12c9-4fcc-b366-67960af3a7f0",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_10_100.jpg?alt=media&token=bd9eed19-ec09-4b07-a859-bd4629d521f9",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_19_579.jpg?alt=media&token=2c4f4427-4fa3-41ff-aacc-bea7e6417826",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_58_27_150.jpg?alt=media&token=03803c52-984d-46c0-8807-530cddf21c1f"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744691260136-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 1,
                            quantity: "1 Tons",
                            coordinates: "21.9166° N, 79.7983° E"
                        },
                        {
                            id: "DEPL-1744691260136-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9167° N, 79.7991° E"
                        },
                        {
                            id: "DEPL-1744691260136-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9168° N, 79.7996° E"
                        },
                        {
                            id: "DEPL-1744691260136-4",
                            plot_no: 4,
                            plot: "Plot 4",
                            amt_deploy: 0.5,
                            quantity: "0.5 Tons",
                            coordinates: "21.9169° N, 79.8000° E"
                        }
                    ]
                },
                {
                    id: "DISP-1744692512499",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP 22 AB 6517",
                    trailer_no: "MP 22 AB 6517",
                    trailer_id: 1713929863427,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "jayant pandre",
                    surveyor_registred_no: "+916269454856",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 3,
                    created_at_raw: "1744692512499",
                    updated_at_raw: "1744693710670",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_19_43_955.mp4?alt=media&token=d963ab58-4489-4797-8fc2-6e339c94f98d",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_19_53_985.jpg?alt=media&token=1f22662c-46aa-41a7-b210-1aedbc49c4ae",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_00_085.jpg?alt=media&token=22b69b29-52f4-4f9d-ad53-9b45946ca3a7",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_05_017.jpg?alt=media&token=e0ba9f31-5d14-4194-9b4f-961547200674",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_10_071.jpg?alt=media&token=1ca86d6f-7ecd-4582-a590-2217c026de7a",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_20_14_805.jpg?alt=media&token=709e3a82-1b58-4950-9199-43f15b7593ce"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744692512499-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9161° N, 79.7997° E"
                        },
                        {
                            id: "DEPL-1744692512499-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9161° N, 79.8000° E"
                        },
                        {
                            id: "DEPL-1744692512499-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9161° N, 79.8003° E"
                        }
                    ]
                },
                {
                    id: "DISP-1744690715506",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP 22 AB 6517",
                    trailer_no: "MP 22 AB 6517",
                    trailer_id: 1713929863427,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "jayant pandre",
                    surveyor_registred_no: "+916269454856",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 2,
                    created_at_raw: "1744690715506",
                    updated_at_raw: "1744691552920",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_09_49_03_323.mp4?alt=media&token=ba72d56a-0127-4738-81a8-5cf29b955378",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_18_192.jpg?alt=media&token=3a8a5ddc-f940-4f66-9cbe-8a37aad1e3e3",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_43_891.jpg?alt=media&token=e7ad0320-ddd4-4b3e-871d-3409ded80303",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_09_49_52_812.jpg?alt=media&token=7640bcdb-6ce5-40a2-a9d8-311197bb7e5c"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744690715506-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 3,
                            quantity: "3 Tons",
                            coordinates: "21.9167° N, 79.7980° E"
                        },
                        {
                            id: "DEPL-1744690715506-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9166° N, 79.7987° E"
                        }
                    ]
                },
                {
                    id: "DISP-1744691719984",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP 22 AB 6517",
                    trailer_no: "MP 22 AB 6517",
                    trailer_id: 1713929863427,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "jayant pandre",
                    surveyor_registred_no: "+916269454856",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 3,
                    created_at_raw: "1744691719984",
                    updated_at_raw: "1744692143607",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_05_31_483.mp4?alt=media&token=08e6ab64-6ec5-452e-be0e-a9c047752307",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_05_43_826.jpg?alt=media&token=c75fe80d-9e13-4935-bdef-424a499426dd",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_05_53_820.jpg?alt=media&token=4341b52b-887a-4ef0-9bbd-8b6bbcad5e61",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_01_360.jpg?alt=media&token=96680d21-5c23-4b56-9733-cd45df3d87f8",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_06_772.jpg?alt=media&token=b06c064c-1bc4-476d-8661-633c8ac72e4f",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_06_12_708.jpg?alt=media&token=d6fc0aa0-0b88-4adf-b4c8-621c7dd5b1f1"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744691719984-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9161° N, 79.7983° E"
                        },
                        {
                            id: "DEPL-1744691719984-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9161° N, 79.7987° E"
                        },
                        {
                            id: "DEPL-1744691719984-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9161° N, 79.7990° E"
                        }
                    ]
                },
                {
                    id: "DISP-1744693404669",
                    date: "15 Apr 2025",
                    date_raw: 1744675200000,
                    vehicleId: "MP 22 AB 6517",
                    trailer_no: "MP 22 AB 6517",
                    trailer_id: 1713929863427,
                    source_name: "DSC",
                    carrier: "DSC",
                    cluster_name: "Cluster 2",
                    surveyor_name: "jayant pandre",
                    surveyor_registred_no: "+916269454856",
                    num_tons: 5,
                    quantity: "5 Tons",
                    num_plots_unload: 3,
                    created_at_raw: "1744693404669",
                    updated_at_raw: "1744817743760",
                    video: "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fvideos%2F2025_04_15_10_34_40_070.mp4?alt=media&token=ddff56e8-18d3-4867-acfa-73585d4063b5",
                    pictures: [
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_05_277.jpg?alt=media&token=285e9e59-1b77-467a-b661-39c2f46ec5c0",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_11_140.jpg?alt=media&token=62182dea-ad7f-4612-ab9d-f33112bfbba1",
                        "https://firebasestorage.googleapis.com/v0/b/mati-9b7e9.appspot.com/o/apps%2Ffarmer%2Frelease%2FKWXgQQLl0qfhJ6WFAYORh9e7pca2%2Fimages%2F2025_04_15_10_35_20_127.jpg?alt=media&token=dedb6268-b4bb-4e83-97fc-29aab1ac5961"
                    ],
                    deployments: [
                        {
                            id: "DEPL-1744693404669-1",
                            plot_no: 1,
                            plot: "Plot 1",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9156° N, 79.7981° E"
                        },
                        {
                            id: "DEPL-1744693404669-2",
                            plot_no: 2,
                            plot: "Plot 2",
                            amt_deploy: 1.5,
                            quantity: "1.5 Tons",
                            coordinates: "21.9156° N, 79.7983° E"
                        },
                        {
                            id: "DEPL-1744693404669-3",
                            plot_no: 3,
                            plot: "Plot 3",
                            amt_deploy: 2,
                            quantity: "2 Tons",
                            coordinates: "21.9157° N, 79.7985° E"
                        }
                    ]
                }
            ]
        }
        return [
            {
                id: "DISP-24901",
                date: "12 Jul 2026",
                vehicleId: "KA-02-MJ-4890",
                carrier: "FedEx Logistics",
                quantity: `${record.deployed} Bags`,
                deployments: [
                    {
                        id: "DEPL-88349",
                        agent: "Rajesh Kumar",
                        plot: `Plot 1 (${(record.area * 0.6).toFixed(1)} Acres)`,
                        seedVariety: `${record.azName || "Rice"} Variety A`,
                        coordinates: "12.9716° N, 77.5946° E"
                    },
                    {
                        id: "DEPL-88350",
                        agent: "Suresh Patel",
                        plot: `Plot 2 (${(record.area * 0.4).toFixed(1)} Acres)`,
                        seedVariety: `${record.azName || "Rice"} Variety B`,
                        coordinates: "12.9720° N, 77.5950° E"
                    }
                ]
            },
            {
                id: "DISP-24902",
                date: "14 Jul 2026",
                vehicleId: "KA-02-MJ-9912",
                carrier: "DHL Express",
                quantity: `${Math.round(record.deployed * 0.6)} Bags`,
                deployments: [
                    {
                        id: "DEPL-88351",
                        agent: "Amit Singh",
                        plot: `Plot 3 (${(record.area * 0.3).toFixed(1)} Acres)`,
                        seedVariety: `${record.azName || "Rice"} Variety A`,
                        coordinates: "12.9730° N, 77.5960° E"
                    }
                ]
            }
        ];
    }, [record, record?.id, record?.farmer.name, record?.area, record?.azName]);

    const activeReportingDispatch = React.useMemo(() => {
        if (!activeReportingCardId || reportingCardType !== "dispatch") return null;
        return mockDispatches.find(d => d.id === activeReportingCardId) || null;
    }, [activeReportingCardId, reportingCardType, mockDispatches]);

    const activeReportingDeployment = React.useMemo(() => {
        if (!activeReportingCardId || reportingCardType !== "deployment") return null;
        for (const d of mockDispatches) {
            const found = d.deployments.find(dep => dep.id === activeReportingCardId);
            if (found) return found;
        }
        return null;
    }, [activeReportingCardId, reportingCardType, mockDispatches]);

    const activeReportingDeploymentParentDispatch = React.useMemo(() => {
        if (!activeReportingCardId || reportingCardType !== "deployment") return null;
        return mockDispatches.find(d => d.deployments.some(dep => dep.id === activeReportingCardId)) || null;
    }, [activeReportingCardId, reportingCardType, mockDispatches]);

    if (!record) return null;

    const toggleDispatch = (id: string) => {
        setExpandedDispatches(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleDeployment = (id: string) => {
        setExpandedDeployments(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleReportId = (id: string) => {
        setReportedIds(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (reportedIds.length === activeSurveyData.length) {
            setReportedIds([])
        } else {
            setReportedIds(activeSurveyData.map(item => item.id))
        }
    }

    const handleSaveComment = () => {
        if (!comment.trim()) return
        setIsSavingComment(true)
        // Simulate API call
        setTimeout(() => {
            const newComment: VerificationComment = {
                id: `local-${Date.now()}`,
                verifier: "Current User", // In a real app, this would be the logged-in user
                date: new Date(),
                text: comment
            }
            setLocalComments(prev => [...prev, newComment])
            setComment("")
            setShowCommentInput(false)
            setIsSavingComment(false)
        }, 600)
    }

    const handleApprove = () => {
        setIsApproving(true)
        // Simulate API call with 1 second delay
        setTimeout(() => {
            console.log("Approving record:", record.id, "with comment:", comment)
            
            // Move to next record if available, otherwise close
            if (!isLast) {
                onNext()
                setIsApproving(false)
            } else {
                onOpenChange(false)
            }
        }, 1000)
    }

    const handleItemClick = (item: SurveyItem) => {
        if (item.type === "map") {
            if (item.meta) {
                const numbers = item.meta.match(/[\d.]+/g);
                if (numbers && numbers.length >= 2) {
                    const lat = parseFloat(numbers[0]);
                    const lng = parseFloat(numbers[1]);
                    
                    const foundPlot = farmerData.plots.find(p => {
                        const dLat = Math.abs(p.location.lat - lat);
                        const dLng = Math.abs(p.location.lng - lng);
                        return dLat < 0.0015 && dLng < 0.0015;
                    });
                    
                    if (foundPlot) {
                        if (mapRef.current) {
                            isProgrammaticChange.current = true;
                        }
                        setSelectedPlot(foundPlot);
                        setMapCenter(foundPlot.location);
                        setSpecificMarker(foundPlot.location);
                        setMapZoom(19);
                        setIsShowingSpecificLocation(true);
                        setIsMapInteracted(false);
                        return;
                    }
                }
            }
            if (questionLocation) {
                // Set programmatic flag before changing map state
                if (mapRef.current) {
                    isProgrammaticChange.current = true;
                }
                setMapCenter(questionLocation);
                setSpecificMarker(questionLocation);
                setMapZoom(19);
                setIsShowingSpecificLocation(true);
                setIsMapInteracted(false); // Ensure interaction is false when clicking question
            }
            return;
        }
        if (["image", "video", "file"].includes(item.type)) {
            setPreviewItem(item)
        }
    }

    const resetMapToFarmer = () => {
        if (mapRef.current) {
            isProgrammaticChange.current = true;
        }
        setMapCenter(null);
        setSpecificMarker(null);
        setMapZoom(17);
        setIsShowingSpecificLocation(false);
        setIsMapInteracted(false);
        setSelectedPlot(null);
        setHoveredPlotId(null);
        setResetCount(prev => prev + 1);
    }

    const handleCloseAll = () => {
        setPreviewItem(null)
        setIsReportingFinalStep(false)
        onOpenChange(false)
    }

    const handleReportSubmit = () => {
        setIsSubmittingReport(true)
        
        if (reportingCardType === "dispatch" || reportingCardType === "deployment") {
            setTimeout(() => {
                const nowStr = format(new Date(), "dd MMM yyyy, hh:mm a");
                const targetId = activeReportingCardId!;
                
                if (reportingCardType === "dispatch") {
                    setDispatchStatuses(prev => ({ ...prev, [targetId]: "Need Correction" }));
                    setDispatchReporterNames(prev => ({ ...prev, [targetId]: "Admin (You)" }));
                    setDispatchReporterTimes(prev => ({ ...prev, [targetId]: nowStr }));
                    setDispatchReportComments(prev => ({ ...prev, [targetId]: reportComment }));
                } else {
                    setDeploymentStatuses(prev => ({ ...prev, [targetId]: "Need Correction" }));
                    setDeploymentReporterNames(prev => ({ ...prev, [targetId]: "Admin (You)" }));
                    setDeploymentReporterTimes(prev => ({ ...prev, [targetId]: nowStr }));
                    setDeploymentReportComments(prev => ({ ...prev, [targetId]: reportComment }));
                }
                
                setIsSubmittingReport(false);
                setReportSuccess(true);
                
                setTimeout(() => {
                    setReportSuccess(false);
                    setIsReportingFinalStep(false);
                    setIsReporting(false);
                    setReportingCardType(null);
                    setActiveReportingCardId(null);
                    setReportedIds([]);
                    setReportComment("");
                    showToast("Reported Successfully", "Report submitted successfully.", "success");
                }, 1500);
            }, 1000);
            return;
        }

        // Simulate API call
        setTimeout(() => {
            console.log("Reporting items:", reportedIds, "with comment:", reportComment)
            setIsSubmittingReport(false)
            setReportSuccess(true)
            
            // Show success state for 1.5 seconds then move to next
            setTimeout(() => {
                setReportSuccess(false)
                setIsReportingFinalStep(false)
                setIsReporting(false)
                setReportedIds([])
                setReportComment("")
                
                // Move to next record if available, otherwise close
                if (!isLast) {
                    onNext()
                } else {
                    onOpenChange(false)
                }
            }, 1500)
        }, 1000)
    }

    // Determine if we should show the persistent map
    const showPersistentMap = mapVisible && record;

    const renderPreviewContent = (item: SurveyItem) => {
        switch (item.type) {
            case "image":
                const imgFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "image.jpg";
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-50 p-2 rounded-lg">
                                    <ImageIcon className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{imgFileName}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">2.4 MB</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Zoom Controls */}
                                <div className="flex items-center gap-1 mr-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-zinc-700" 
                                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="text-[10px] font-bold w-8 text-center">{Math.round(zoom * 100)}%</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-zinc-700" 
                                        onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* Rotation */}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full" 
                                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                                    title="Rotate 90°"
                                >
                                    <RotateCw className="h-4 w-4" />
                                </Button>

                                {/* Fit/Mode Menu */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full"
                                            title="View Modes"
                                        >
                                            <SlidersHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[140px] z-[10005]">
                                        <DropdownMenuItem onClick={() => setImageMode("fill")} className="flex items-center gap-2">
                                            <Maximize2 className="h-3.5 w-3.5" />
                                            <span>Fill</span>
                                            {imageMode === "fill" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("fit")} className="flex items-center gap-2">
                                            <Minimize2 className="h-3.5 w-3.5" />
                                            <span>Fit</span>
                                            {imageMode === "fit" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("stretch")} className="flex items-center gap-2">
                                            <Scaling className="h-3.5 w-3.5" />
                                            <span>Stretch</span>
                                            {imageMode === "stretch" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setImageMode("center")} className="flex items-center gap-2">
                                            <AlignCenter className="h-3.5 w-3.5" />
                                            <span>Center</span>
                                            {imageMode === "center" && <Check className="ml-auto h-3.5 w-3.5" />}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href={item.answer as string} download title="Download Image">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={() => setPreviewItem(null)}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <ImagePreview 
                            item={item} 
                            zoom={zoom} 
                            rotation={rotation} 
                            imageMode={imageMode} 
                        />
                    </div>
                );
            case "video":
                const vidFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "video.mp4";
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-50 p-2 rounded-lg">
                                    <Play className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{vidFileName}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">12.8 MB</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Fit Toggle */}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                                    onClick={() => setImageMode(prev => prev === "fill" ? "fit" : "fill")}
                                    title={imageMode === "fill" ? "Switch to Fit" : "Switch to Fill"}
                                >
                                    {imageMode === "fill" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>

                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href={item.answer as string} download title="Download Video">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={() => setPreviewItem(null)}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black">
                            <video 
                                src={item.answer as string} 
                                controls 
                                autoPlay 
                                className={cn(
                                    "w-full h-full transition-all duration-300 bg-black",
                                    imageMode === "fill" ? "object-cover" : "object-contain"
                                )}
                            />
                        </div>
                    </div>
                );
            case "file":
                return (
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                        {/* Header Bar */}
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900 leading-none">{(item.answer as { name: string }).name || "Document.pdf"}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">{(item.answer as { size: string }).size || "2.4 MB"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                                    <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" target="_blank" rel="noopener noreferrer" title="Download PDF">
                                        <Download className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={() => setPreviewItem(null)}
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        
                        {/* PDF Content */}
                        <div className="flex-1 w-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                            <iframe 
                                src={`https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&embedded=true`}
                                className="w-full h-full border-none"
                                title="PDF Preview"
                            />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={(val) => {
                if (!val) {
                    handleCloseAll();
                }
            }}>
                <SheetContent 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-visible z-[200] transition-all duration-500 ease-in-out focus-visible:outline-none"
                    onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.map-preview-module')) {
                            e.preventDefault();
                        }
                    }}
                >
                    {/* Persistent Map Module - Positioned next to the side module, sliding with it */}
                    <div 
                        className={cn(
                            "map-preview-module absolute top-0 bottom-0 bg-white dark:bg-zinc-950 flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-all duration-500 ease-in-out z-[-1]",
                            open ? "opacity-100" : "opacity-0"
                        )}
                        style={{ 
                            width: "50vw", 
                            right: "100%",
                            pointerEvents: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 relative">
                            {/* Map Loader Overlay */}
                            <div className={cn(
                                "absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-opacity duration-300",
                                isMapReady ? "opacity-0 pointer-events-none" : "opacity-100"
                            )}>
                                <div className="text-center space-y-3">
                                    <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Initializing Map...</p>
                                </div>
                            </div>

                            <div className="w-full h-full relative overflow-hidden">
                                {isLoaded ? (
                                    <>
                                        <MapPreviewContent 
                                            selectedFarmer={farmerData} 
                                            record={record}
                                            onIdle={onMapIdle} 
                                            center={mapCenter}
                                            zoom={mapZoom}
                                            specificMarker={specificMarker}
                                            onReset={resetMapToFarmer}
                                            onInteraction={() => setIsMapInteracted(true)}
                                            resetCount={resetCount}
                                            questionLocation={questionLocation}
                                            setIsMapInteracted={setIsMapInteracted}
                                            mapRef={mapRef}
                                            isProgrammaticChange={isProgrammaticChange}
                                            hasLocationQuestion={hasLocationQuestion}
                                            selectedPlot={selectedPlot}
                                            setSelectedPlot={setSelectedPlot}
                                            hoveredPlotId={hoveredPlotId}
                                            setHoveredPlotId={setHoveredPlotId}
                                            isShowingSpecificLocation={isShowingSpecificLocation}
                                            isMapInteracted={isMapInteracted}
                                            onEditClick={() => setIsMapEditorOpen(true)}
                                        />

                                        <Dialog open={isMapEditorOpen} onOpenChange={setIsMapEditorOpen}>
                                            <DialogContent className="fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none p-0 border-0 rounded-none bg-zinc-50 dark:bg-zinc-950 gap-0 flex flex-col z-[500] [&>button]:hidden">
                                                <DialogTitle className="sr-only">Edit Plot Boundaries</DialogTitle>
                                                <DialogDescription className="sr-only">Fullscreen editor for drawing and editing plot boundaries</DialogDescription>
                                                <MapEditor
                                                    mode="manual"
                                                    farmerId={farmerData.id}
                                                    initialPlots={farmerData.plots}
                                                    onClose={() => setIsMapEditorOpen(false)}
                                                    onSave={(updatedPlots) => {
                                                        const f = MOCK_FARMERS.find(farmer => farmer.id === farmerData.id);
                                                        if (f) {
                                                            f.plots = updatedPlots;
                                                            const calculateAreaAcres = (path: any[]) => {
                                                                if (typeof google === "undefined") return 0;
                                                                const polygonPath = path.map((p) => new google.maps.LatLng(p.lat, p.lng));
                                                                const areaSqMeters = google.maps.geometry.spherical.computeArea(polygonPath);
                                                                return areaSqMeters / 4046.86;
                                                            };
                                                            const calAreaAcres = updatedPlots.reduce((sum, p) => sum + (p.path ? calculateAreaAcres(p.path) : 0), 0);
                                                            f.calArea = `${calAreaAcres.toFixed(2)} Acres`;
                                                        }
                                                        setLocalFarmerPlots(updatedPlots);
                                                        setIsMapEditorOpen(false);
                                                    }}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-500">
                                        Loading Map...
                                    </div>
                                )}
                                {isShowingSpecificLocation && (
                                    <div className="absolute bottom-6 left-6 z-20 pointer-events-auto text-zinc-900 dark:text-zinc-50 px-3 h-[36px] flex items-center bg-white/95 dark:bg-zinc-950/95 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-lg text-[14px] font-bold uppercase tracking-wider whitespace-nowrap backdrop-blur-md">
                                        {record.village}, {record.block || "Block A"}, {record.state || "Karnataka"}, {record.country || "India"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                {/* Header section */}
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-12 w-12 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <AvatarImage src={record.farmer.avatar} />
                                    <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{record.farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                                        {record.farmer.name}
                                    </SheetTitle>
                                    <SheetDescription asChild>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 font-medium">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                {record.village}, {record.block || "Block A"}, {record.state || "Karnataka"}, {record.country || "India"}
                                            </span>
                                        </div>
                                    </SheetDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 h-14">
                                {/* Language Dropdown moved to top right */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            className="h-8 px-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0 flex items-center gap-1"
                                        >
                                            <Languages className="h-4 w-4" />
                                            <ChevronDown className="h-3 w-3 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 z-[300]">
                                        <DropdownMenuItem 
                                            className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"
                                            onClick={() => onLanguageChange?.("en")}
                                        >
                                            English
                                            {language === "en" && <Check className="h-3 w-3" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"
                                            onClick={() => onLanguageChange?.("hi")}
                                        >
                                            हिंदी
                                            {language === "hi" && <Check className="h-3 w-3" />}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    onClick={handleCloseAll}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Fixed Engagement Details Bar */}
                    <div className="bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        <div>{record.area} Acres . {record.plots} {record.plots === 1 ? "Plot" : "Plots"}</div>
                        <div>AZ {record.azs} . {record.azName || "Rice"}</div>
                    </div>
                    
                    {selectedDeploymentId ? (() => {
                        const dispatch = mockDispatches.find(d => d.deployments?.some(dep => dep.id === selectedDeploymentId));
                        const deployment = dispatch?.deployments?.find(dep => dep.id === selectedDeploymentId);
                        if (!deployment || !dispatch) return null;
                        const status = deploymentStatuses[deployment.id] || "Pending";
                        return (
                            <>
                                <div className="pl-4 pr-6 py-4 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between w-full select-none text-left gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setSelectedDeploymentId(null);
                                                setIsReporting(false);
                                                setReportingCardType(null);
                                                setActiveReportingCardId(null);
                                                setReportedIds([]);
                                                setReportComment("");
                                            }}
                                            className="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 shrink-0 -ml-1.5"
                                        >
                                            <ArrowLeft className="h-5 w-5" />
                                        </Button>
                                        <div className="flex flex-col text-left min-w-0 flex-1 overflow-hidden">
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">Deployment</h2>
                                            
                                            <div className="text-[11px] text-zinc-500 font-mono mt-1.5 flex items-center gap-1 select-none whitespace-nowrap overflow-hidden leading-none text-left w-full">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedDispatchId(null);
                                                        setSelectedDeploymentId(null);
                                                    }}
                                                    className="hover:underline hover:text-zinc-850 dark:hover:text-zinc-150 transition-colors focus:outline-none shrink-0"
                                                >
                                                    All
                                                </button>
                                                <span className="text-zinc-400 shrink-0">/</span>
                                                
                                                <HoverCard openDelay={200} closeDelay={100}>
                                                    <HoverCardTrigger asChild>
                                                        <button 
                                                            onClick={() => setSelectedDeploymentId(null)}
                                                            className="hover:underline hover:text-zinc-850 dark:hover:text-zinc-150 transition-colors focus:outline-none truncate min-w-0 shrink block text-left"
                                                        >
                                                            {dispatch.id}
                                                        </button>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent align="start" side="bottom" className="w-auto p-2 text-[10px] font-mono bg-zinc-900 text-white border-zinc-800 shadow-xl rounded-md z-[300] select-text">
                                                        {dispatch.id}
                                                    </HoverCardContent>
                                                </HoverCard>

                                                <span className="text-zinc-400 shrink-0">/</span>

                                                <HoverCard openDelay={200} closeDelay={100}>
                                                    <HoverCardTrigger asChild>
                                                        <span className="text-zinc-500 dark:text-zinc-400 truncate min-w-0 shrink block cursor-help font-semibold">
                                                            {deployment.id}
                                                        </span>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent align="start" side="bottom" className="w-auto p-2 text-[10px] font-mono bg-zinc-900 text-white border-zinc-800 shadow-xl rounded-md z-[300] select-text">
                                                        {deployment.id}
                                                    </HoverCardContent>
                                                </HoverCard>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full border shadow-none",
                                        status === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                                        status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                                        status === "Need Correction" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                                    )}>
                                        {status}
                                    </Badge>
                                </div>
                                {/* Subheader for Verification / Reporting info directly below the header */}
                                {status === "Verified" && (
                                     <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border-b border-emerald-100/50 dark:border-emerald-900/20 px-6 py-2.5 flex items-center gap-2 text-left w-full animate-in fade-in duration-300">
                                         <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                         <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                             Verified by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{deploymentVerifierNames[deployment.id] || "Admin (You)"}</strong> • {deploymentVerifierTimes[deployment.id]}
                                         </span>
                                     </div>
                                 )}
                                {status === "Need Correction" && (
                                     <div className="bg-red-50/40 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20 px-6 py-3 flex flex-col gap-1 text-left w-full animate-in fade-in duration-300">
                                         <div className="flex items-center gap-2">
                                             <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                                             <span className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-widest leading-none">Report Comment</span>
                                         </div>
                                         <div className="pl-6 text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium break-words [word-break:break-word]">
                                             {deploymentReportComments[deployment.id] || "No comments provided."}
                                         </div>
                                         <div className="pl-6 text-[10px] text-red-700/80 dark:text-red-300/80 font-semibold uppercase tracking-wider mt-0.5">
                                             Reported by <strong className="font-bold text-red-800 dark:text-red-200">{deploymentReporterNames[deployment.id] || "Admin (You)"}</strong> • {deploymentReporterTimes[deployment.id]}
                                         </div>
                                     </div>
                                 )}
                            </>
                        );
                    })() : selectedDispatchId ? (() => {
                        const dispatch = mockDispatches.find(d => d.id === selectedDispatchId);
                        if (!dispatch) return null;
                        const status = dispatchStatuses[dispatch.id] || "Pending";
                        return (
                            <>
                                <div className="pl-4 pr-6 py-4 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between w-full select-none text-left gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setSelectedDispatchId(null);
                                                setIsReporting(false);
                                                setReportingCardType(null);
                                                setActiveReportingCardId(null);
                                                setReportedIds([]);
                                                setReportComment("");
                                            }}
                                            className="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 shrink-0 -ml-1.5"
                                        >
                                            <ArrowLeft className="h-5 w-5" />
                                        </Button>
                                        <div className="flex flex-col text-left min-w-0 flex-1 overflow-hidden">
                                             <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">Dispatch</h2>
                                             <div className="text-[11px] text-zinc-500 font-mono mt-1.5 flex items-center gap-1 select-none whitespace-nowrap overflow-hidden leading-none text-left w-full">
                                                 <button 
                                                     onClick={() => setSelectedDispatchId(null)}
                                                     className="hover:underline hover:text-zinc-855 dark:hover:text-zinc-145 transition-colors focus:outline-none shrink-0"
                                                 >
                                                     All
                                                 </button>
                                                 <span className="text-zinc-400 shrink-0">/</span>
                                                 
                                                 <HoverCard openDelay={200} closeDelay={100}>
                                                     <HoverCardTrigger asChild>
                                                         <span className="text-zinc-500 dark:text-zinc-400 truncate min-w-0 shrink block cursor-help font-semibold">
                                                             {dispatch.id}
                                                         </span>
                                                     </HoverCardTrigger>
                                                     <HoverCardContent align="start" side="bottom" className="w-auto p-2 text-[10px] font-mono bg-zinc-900 text-white border-zinc-800 shadow-xl rounded-md z-[300] select-text">
                                                         {dispatch.id}
                                                     </HoverCardContent>
                                                 </HoverCard>
                                             </div>
                                         </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full border shadow-none",
                                        status === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                                        status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                                        status === "Need Correction" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                                    )}>
                                        {status}
                                    </Badge>
                                </div>
                                {/* Subheader for Verification / Reporting info directly below the header */}
                                {status === "Verified" && (
                                     <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border-b border-emerald-100/50 dark:border-emerald-900/20 px-6 py-2.5 flex items-center gap-2 text-left w-full animate-in fade-in duration-300">
                                         <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                         <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                             Verified by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{dispatchVerifierNames[dispatch.id] || "Admin (You)"}</strong> • {dispatchVerifierTimes[dispatch.id]}
                                         </span>
                                     </div>
                                 )}
                                {status === "Need Correction" && (
                                     <div className="bg-red-50/40 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20 px-6 py-3 flex flex-col gap-1 text-left w-full animate-in fade-in duration-300">
                                         <div className="flex items-center gap-2">
                                             <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                                             <span className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-widest leading-none">Report Comment</span>
                                         </div>
                                         <div className="pl-6 text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium break-words [word-break:break-word]">
                                             {dispatchReportComments[dispatch.id] || "No comments provided."}
                                         </div>
                                         <div className="pl-6 text-[10px] text-red-700/80 dark:text-red-300/80 font-semibold uppercase tracking-wider mt-0.5">
                                             Reported by <strong className="font-bold text-red-800 dark:text-red-200">{dispatchReporterNames[dispatch.id] || "Admin (You)"}</strong> • {dispatchReporterTimes[dispatch.id]}
                                         </div>
                                     </div>
                                 )}
                            </>
                        );
                    })() : (
                        <div className="px-6 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">Deployments</h2>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 px-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 flex items-center gap-1.5 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-zinc-200 dark:focus:border-zinc-800"
                                    >
                                        <span>{
                                            activeTab === "all" ? "All" :
                                            activeTab === "pending" ? "Pending" :
                                            activeTab === "verified" ? "Verified" :
                                            activeTab === "need_correction" ? "Need Correction" : "All"
                                        }</span>
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg rounded-xl z-[300]">
                                    {[
                                        { id: "all", label: "All" },
                                        { id: "pending", label: "Pending" },
                                        { id: "verified", label: "Verified" },
                                        { id: "need_correction", label: "Need Correction" }
                                    ].map((tab) => (
                                        <DropdownMenuItem
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={cn(
                                                "text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between outline-none focus:outline-none focus:bg-zinc-50 dark:focus:bg-zinc-900/60",
                                                activeTab === tab.id 
                                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-bold" 
                                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                            )}
                                        >
                                            {tab.label}
                                            {activeTab === tab.id && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-50" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                )}
                    </div>


                {/* Content section - Style 5 (Feedback based) */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 relative">
                    {/* Floating Selection Banner for Reporting mode */}
                    {isReporting && (
                        <div className="sticky top-0 z-[5] bg-red-50 dark:bg-red-955/20 border-b border-red-100 dark:border-red-900/30 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-300 select-none">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                            <p className="text-xs text-red-800 dark:text-red-300 font-medium text-left">
                                Select the fields that need correction. Click on individual cards to select.
                            </p>
                        </div>
                    )}
                    
                    <div className="p-6">
                        {/* Top position Metadata Cards Grid in main list */}
                        {(selectedDeploymentId || selectedDispatchId) && (() => {
                            const target = selectedDeploymentId 
                                ? (mockDispatches as any[]).flatMap((d: any) => (d.deployments as any[]) || []).find((dep: any) => dep.id === selectedDeploymentId) 
                                : mockDispatches.find(d => d.id === selectedDispatchId);
                            if (!target) return null;
                            const dispatchParent = mockDispatches.find(d => d.id === selectedDispatchId || d.deployments?.some((dep: any) => dep.id === selectedDeploymentId));
                            const createdTs = (target as any).created_at_raw || (dispatchParent as any)?.created_at_raw || (dispatchParent as any)?.date_raw;
                            
                            const safeFormatDate = (ts: any) => {
                                if (!ts) return "15 Apr 2025";
                                const num = typeof ts === "string" ? parseInt(ts) : ts;
                                if (isNaN(num)) return ts;
                                try {
                                    return format(new Date(num), "dd MMM yyyy");
                                } catch {
                                    return "15 Apr 2025";
                                }
                            };

                            const createdVal = safeFormatDate(createdTs);
                            const updatedVal = (target as any).updated_at_raw ? safeFormatDate((target as any).updated_at_raw) : "Just now";
                            const surveyorVal = (target as any).surveyor_name || record?.surveyor?.name || "Sagar Rahangdale";
                            const surveyorPhoneVal = (target as any).surveyor_registred_no || record?.surveyor?.phoneNumber || "+91 95227 97884";

                            return (
                                <div className="grid grid-cols-3 gap-2.5 mb-5 w-full select-none">
                                    <div className="bg-zinc-50/80 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col text-left min-w-0">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Created</span>
                                        <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                                            {createdVal}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-50/80 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col text-left min-w-0">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Updated</span>
                                        <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                                            {updatedVal}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-50/80 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col text-left min-w-0">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Surveyor</span>
                                        <HoverCard openDelay={100} closeDelay={100}>
                                            <HoverCardTrigger asChild>
                                                <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-dotted underline-offset-2 cursor-pointer transition-colors truncate mt-0.5 block">
                                                    {surveyorVal}
                                                </span>
                                            </HoverCardTrigger>
                                            <HoverCardContent align="end" className="w-64 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl z-[400]">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200 dark:border-emerald-800">
                                                        {surveyorVal.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col text-left min-w-0 flex-1">
                                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate">{surveyorVal}</span>
                                                        <span className="text-[10px] text-zinc-500 font-medium">Field Surveyor</span>
                                                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{surveyorPhoneVal}</span>
                                                    </div>
                                                </div>
                                            </HoverCardContent>
                                        </HoverCard>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="space-y-4">
                            {isDataLoading ? (
                                <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-in fade-in duration-500">
                                    <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedDeploymentId ? (() => {
                                        const dispatch = mockDispatches.find(d => d.deployments?.some(dep => dep.id === selectedDeploymentId));
                                        const deployment = dispatch?.deployments?.find(dep => dep.id === selectedDeploymentId);
                                        if (!deployment || !dispatch) return null;
                                        return (
                                            <div className="space-y-5 text-left animate-in fade-in duration-300">
                                                <div className="space-y-3">
                                                    {getDeploymentSurveyItems(deployment, record, (dispatch as any).pictures || (dispatch as any).survey_pictures).map((item) => (
                                                        <div key={item.id} className="cursor-pointer" onClick={(e) => {
                                                                const target = e.target as HTMLElement;
                                                                if (target.closest('.attachment-preview-trigger') || item.type === 'map') {
                                                                    handleItemClick(item);
                                                                }
                                                            }}>
                                                            <SurveyCard
                                                                item={item}
                                                                style="style-5-feedback"
                                                                showDetails={false}
                                                                isReporting={isReporting}
                                                                isSelected={reportedIds.includes(item.id)}
                                                                onToggleSelect={() => toggleReportId(item.id)}
                                                                disableDialog={true}
                                                                isInvalid={record.status === "Invalid"}
                                                                onMapClick={handleItemClick}
                                                                language={language}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Add / View Comment Section for Deployment */}
                                                {!isReporting && (() => {
                                                    const draftKey = selectedDeploymentId || "";
                                                    const draftVal = deploymentCommentDraft[draftKey] || "";
                                                    const comments = deploymentCommentsList[draftKey] || [];
                                                    const showInput = showDeploymentCommentInput[draftKey] || false;
                                                    const status = deploymentStatuses[selectedDeploymentId || ""] || "Pending";
                                                    const isEditable = status === "Pending";
                                                    return (
                                                        <div className="space-y-3 pt-2">
                                                            {isEditable && (
                                                                <div className="pt-2 pb-3">
                                                                    <div className="space-y-0.5 mb-3">
                                                                        <div className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">
                                                                            ADD COMMENT <span className="text-[10px] font-medium lowercase opacity-70">(optional)</span>
                                                                        </div>
                                                                        <div className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight">
                                                                            Share any additional observations or feedback regarding this survey.
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <Textarea
                                                                            rows={showInput || draftVal.trim() ? 4 : 1}
                                                                            placeholder="Type your comment here . . ."
                                                                            className={cn(
                                                                                "w-full box-border bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-md resize-none focus-visible:ring-1 focus-visible:ring-zinc-200 dark:focus-visible:ring-zinc-800 px-3 py-2 placeholder:text-zinc-400 transition-[min-height] duration-300 ease-in-out md:text-sm !min-h-0",
                                                                                showInput || draftVal.trim()
                                                                                    ? "min-h-[100px] text-base"
                                                                                    : "h-10 min-h-0 max-h-10 text-sm leading-tight"
                                                                            )}
                                                                            value={draftVal}
                                                                            onChange={(e) => setDeploymentCommentDraft(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                                                            onFocus={() => setShowDeploymentCommentInput(prev => ({ ...prev, [draftKey]: true }))}
                                                                            onBlur={() => {
                                                                                if (!draftVal.trim()) setShowDeploymentCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                            }}
                                                                        />
                                                                        <div className={cn(
                                                                            "flex items-center gap-2 overflow-hidden transition-[height,opacity,margin-top] duration-300 ease-in-out",
                                                                            draftVal.trim() ? "mt-2 h-7 opacity-100" : "mt-0 h-0 opacity-0 pointer-events-none"
                                                                        )}>
                                                                            <Button 
                                                                                size="sm"
                                                                                className="h-6 px-3 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 rounded-md shadow-sm transition-all duration-200"
                                                                                onClick={() => {
                                                                                    if (!draftVal.trim()) return;
                                                                                    const newC: VerificationComment = { id: Date.now().toString(), date: new Date(), verifier: "Admin (You)", text: draftVal.trim() };
                                                                                    setDeploymentCommentsList(prev => ({ ...prev, [draftKey]: [...(prev[draftKey] || []), newC] }));
                                                                                    setDeploymentCommentDraft(prev => ({ ...prev, [draftKey]: "" }));
                                                                                    setShowDeploymentCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                                }}
                                                                                disabled={!draftVal.trim()}
                                                                            >
                                                                                Save
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 px-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                                                                                onClick={() => {
                                                                                    setDeploymentCommentDraft(prev => ({ ...prev, [draftKey]: "" }));
                                                                                    setShowDeploymentCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                                }}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {comments.length > 0 && (
                                                                <div className="py-2">
                                                                    <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                                                        {comments.length > 1 ? 'Comments' : 'Comment'}
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {comments.map((c, idx) => (
                                                                            <div key={c.id} className="relative pl-4 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                                                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                                                                                <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic">"{c.text}"</div>
                                                                                <div className="flex items-center gap-2 pt-1">
                                                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{c.verifier}</span>
                                                                                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                                                    <span className="text-[10px] text-zinc-400 font-medium uppercase">{format(c.date, "dd MMM yyyy")}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })() : activeTab === "details" ? (
                                        <div className="space-y-5 animate-in fade-in duration-300 text-left">
                                            {/* Farmer Card */}
                                            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950">
                                                <CardHeader className="pb-3 bg-zinc-50/50 dark:bg-zinc-900/10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                                                            {record.farmer.name.split(" ").map((n: any) => n[0]).join("")}
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{record.farmer.name}</CardTitle>
                                                            <CardDescription className="text-xs text-zinc-500">Farmer profile & location</CardDescription>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-3 grid grid-cols-2 gap-4 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Village</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.village}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Surveyor</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.surveyor.name}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Submitted Date</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.deployed}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Activity ID</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.id}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* Crop Metrics */}
                                            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950">
                                                <CardHeader className="pb-3 bg-zinc-50/50 dark:bg-zinc-900/10">
                                                    <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Crop & Plot Metrics</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-3 grid grid-cols-2 gap-4 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Agro-Zone (AZ) Code</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">AZ {record.azs}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Crop Variety</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.azName || "Rice"}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Area</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.area} Acres</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Calibrated Area</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.calArea} Acres</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Plots count</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.plots} Plots</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* Verification Log */}
                                            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950">
                                                <CardHeader className="pb-3 bg-zinc-50/50 dark:bg-zinc-900/10">
                                                    <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Verification History</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-3 grid grid-cols-2 gap-4 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Status</span>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 mt-0.5",
                                                            record.status === "Verified" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400" :
                                                            record.status === "Invalid" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400" :
                                                            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                                                        )}>
                                                            {record.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Verified By</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.verified?.verifier || "Pending Review"}</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Verified On</span>
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{record.verified?.date ? format(new Date(record.verified.date), 'dd MMM yyyy') : "-"}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    ) : (
                                        (() => {
                                            const filteredDispatches = mockDispatches
                                                .filter((d) => {
                                                    const status = dispatchStatuses[d.id] || "Pending";
                                                    if (activeTab === "all") return true;
                                                    if (activeTab === "pending") return status === "Pending";
                                                    if (activeTab === "verified") return status === "Verified";
                                                    if (activeTab === "need_correction") return status === "Need Correction";
                                                    return true;
                                                });

                                            if (filteredDispatches.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/5 select-none animate-in fade-in duration-300">
                                                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
                                                            <Inbox className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                                                        </div>
                                                        <span className="text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase block mb-1">
                                                            No Dispatches Found
                                                        </span>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px]">
                                                            There are no dispatches matching the {activeTab === "all" ? "" : activeTab.replace("_", " ")} status for this record.
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-4">
                                                    {selectedDispatchId ? (() => {
                                                        const dispatch = mockDispatches.find(d => d.id === selectedDispatchId);
                                                        if (!dispatch) return null;
                                                        return (
                                                            <div className="space-y-5 text-left animate-in fade-in duration-300">
                                                                {/* Checklist Items */}
                                                                <div className="space-y-3">
                                                                    {getDispatchSurveyItems(dispatch, record).map((item) => (
                                                                        <div key={item.id} className="cursor-pointer" onClick={(e) => {
                                                                                const target = e.target as HTMLElement;
                                                                                if (target.closest('.attachment-preview-trigger') || item.type === 'map') {
                                                                                    handleItemClick(item);
                                                                                }
                                                                            }}>
                                                                            <SurveyCard
                                                                                item={item}
                                                                                style="style-5-feedback"
                                                                                showDetails={false}
                                                                                isReporting={isReporting}
                                                                                isSelected={reportedIds.includes(item.id)}
                                                                                onToggleSelect={() => toggleReportId(item.id)}
                                                                                disableDialog={true}
                                                                                isInvalid={record.status === "Invalid"}
                                                                                onMapClick={handleItemClick}
                                                                                language={language}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Add Comment Section for Dispatch */}
                                                                {!isReporting && (() => {
                                                                    const draftKey = selectedDispatchId || "";
                                                                    const draftVal = dispatchCommentDraft[draftKey] || "";
                                                                    const comments = dispatchCommentsList[draftKey] || [];
                                                                    const showInput = showDispatchCommentInput[draftKey] || false;
                                                                    const status = dispatchStatuses[selectedDispatchId || ""] || "Pending";
                                                                    const isEditable = status === "Pending";
                                                                    return (
                                                                        <div className="space-y-3 pt-2">
                                                                            {isEditable && (
                                                                                <div className="pt-2 pb-3">
                                                                                    <div className="space-y-0.5 mb-3">
                                                                                        <div className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">
                                                                                            ADD COMMENT <span className="text-[10px] font-medium lowercase opacity-70">(optional)</span>
                                                                                        </div>
                                                                                        <div className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight">
                                                                                            Share any additional observations or feedback regarding this survey.
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex flex-col">
                                                                                        <Textarea
                                                                                            rows={showInput || draftVal.trim() ? 4 : 1}
                                                                                            placeholder="Type your comment here . . ."
                                                                                            className={cn(
                                                                                                "w-full box-border bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-md resize-none focus-visible:ring-1 focus-visible:ring-zinc-200 dark:focus-visible:ring-zinc-800 px-3 py-2 placeholder:text-zinc-400 transition-[min-height] duration-300 ease-in-out md:text-sm !min-h-0",
                                                                                                showInput || draftVal.trim()
                                                                                                    ? "min-h-[100px] text-base"
                                                                                                    : "h-10 min-h-0 max-h-10 text-sm leading-tight"
                                                                                            )}
                                                                                            value={draftVal}
                                                                                            onChange={(e) => setDispatchCommentDraft(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                                                                            onFocus={() => setShowDispatchCommentInput(prev => ({ ...prev, [draftKey]: true }))}
                                                                                            onBlur={() => {
                                                                                                if (!draftVal.trim()) setShowDispatchCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                                            }}
                                                                                        />
                                                                                        <div className={cn(
                                                                                            "flex items-center gap-2 overflow-hidden transition-[height,opacity,margin-top] duration-300 ease-in-out",
                                                                                            draftVal.trim() ? "mt-2 h-7 opacity-100" : "mt-0 h-0 opacity-0 pointer-events-none"
                                                                                        )}>
                                                                                            <Button 
                                                                                                size="sm"
                                                                                                className="h-6 px-3 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 rounded-md shadow-sm transition-all duration-200"
                                                                                                onClick={() => {
                                                                                                    if (!draftVal.trim()) return;
                                                                                                    const newC: VerificationComment = { id: Date.now().toString(), date: new Date(), verifier: "Admin (You)", text: draftVal.trim() };
                                                                                                    setDispatchCommentsList(prev => ({ ...prev, [draftKey]: [...(prev[draftKey] || []), newC] }));
                                                                                                    setDispatchCommentDraft(prev => ({ ...prev, [draftKey]: "" }));
                                                                                                    setShowDispatchCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                                                }}
                                                                                                disabled={!draftVal.trim()}
                                                                                            >
                                                                                                Save
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                className="h-6 px-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                                                                                                onClick={() => {
                                                                                                    setDispatchCommentDraft(prev => ({ ...prev, [draftKey]: "" }));
                                                                                                    setShowDispatchCommentInput(prev => ({ ...prev, [draftKey]: false }));
                                                                                                }}
                                                                                            >
                                                                                                Cancel
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {comments.length > 0 && (
                                                                                <div className="py-2">
                                                                                    <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                                                                        {comments.length > 1 ? 'Comments' : 'Comment'}
                                                                                    </div>
                                                                                    <div className="space-y-3">
                                                                                        {comments.map((c, idx) => (
                                                                                            <div key={c.id} className="relative pl-4 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                                                                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                                                                                                <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic">"{c.text}"</div>
                                                                                                <div className="flex items-center gap-2 pt-1">
                                                                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{c.verifier}</span>
                                                                                                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                                                                    <span className="text-[10px] text-zinc-400 font-medium uppercase">{format(c.date, "dd MMM yyyy")}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Nested Deployments list */}
                                                                {dispatch.deployments && dispatch.deployments.length > 0 && (
                                                                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                                                        <div className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase select-none text-left mb-2">
                                                                            Deployments ({dispatch.deployments.length})
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            {dispatch.deployments.map((depl: any) => {
                                                                                return (
                                                                                    <div key={depl.id} className="relative">
                                                                                        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950 transition-all cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                                                                                            onClick={() => {
                                                                                                setSelectedDeploymentId(depl.id);
                                                                                                setIsReporting(false);
                                                                                                setReportingCardType(null);
                                                                                                setActiveReportingCardId(null);
                                                                                                setReportedIds([]);
                                                                                                setReportComment("");
                                                                                            }}
                                                                                        >
                                                                                            <div className="p-3.5 flex flex-col select-none">
                                                                                                <div className="flex items-center justify-between w-full">
                                                                                                    <div className="flex flex-col text-left">
                                                                                                         <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 font-mono">{depl.id}</span>
                                                                                                         <span className="text-[11px] text-zinc-500 font-mono block mt-0.5">{dispatch.date || record?.deployed || "15 Apr 2025"}</span>
                                                                                                     </div>
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <Badge variant="outline" className={cn(
                                                                                                            "text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full border shadow-none",
                                                                                                            (deploymentStatuses[depl.id] || "Pending") === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                                                                                                            (deploymentStatuses[depl.id] || "Pending") === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                                                                                                            (deploymentStatuses[depl.id] || "Pending") === "Need Correction" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-955/30 dark:text-red-400 dark:border-red-900/50"
                                                                                                        )}>
                                                                                                            {deploymentStatuses[depl.id] || "Pending"}
                                                                                                        </Badge>
                                                                                                    </div>
                                                                                                </div>
                                                                                                {/* Separate Section Banner for Verification / Reporting Info */}
                                                                                                {(deploymentStatuses[depl.id] || "Pending") === "Verified" && (
                                                                                                     <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5 text-left w-full">
                                                                                                         <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                                                         <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                                                                                             Verified by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{deploymentVerifierNames[depl.id] || "Admin (You)"}</strong> • {deploymentVerifierTimes[depl.id]}
                                                                                                         </span>
                                                                                                     </div>
                                                                                                 )}
                                                                                                {(deploymentStatuses[depl.id] || "Pending") === "Need Correction" && (
                                                                                                     <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5 text-left w-full">
                                                                                                         <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0" />
                                                                                                         <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                                                                                                             Reported by <strong className="font-semibold text-red-800 dark:text-red-200">{deploymentReporterNames[depl.id] || "Admin (You)"}</strong> • {deploymentReporterTimes[depl.id]}
                                                                                                         </span>
                                                                                                     </div>
                                                                                                 )}
                                                                                            </div>
                                                                                        </Card>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })() : (
                                                    filteredDispatches.map((dispatch) => {
                                                        const isDispExpanded = expandedDispatches.includes(dispatch.id);
                                                        return (
                                                            <div key={dispatch.id} className="space-y-4">
                                                                {/* Dispatch Card (Level 1) */}
                                                                <Card 
                                                                    className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-950 transition-all cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                                                                    onClick={() => setSelectedDispatchId(dispatch.id)}
                                                                >
                                                                    <div className="p-3.5 flex flex-col select-none">
                                                                        {/* Top Header Row: Title, Badge, ID */}
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <div className="flex flex-col text-left">
                                                                                 <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 font-mono">{dispatch.id}</span>
                                                                                 <span className="text-[11px] text-zinc-500 font-mono block mt-0.5">{dispatch.date}</span>
                                                                             </div>
                                                                            <Badge variant="outline" className={cn(
                                                                                "text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full border shadow-none",
                                                                                (dispatchStatuses[dispatch.id] || "Pending") === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                                                                                (dispatchStatuses[dispatch.id] || "Pending") === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                                                                                (dispatchStatuses[dispatch.id] || "Pending") === "Need Correction" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-955/30 dark:text-red-400 dark:border-red-900/50"
                                                                            )}>
                                                                                {dispatchStatuses[dispatch.id] || "Pending"}
                                                                            </Badge>
                                                                        </div>

                                                                        {/* Separate Section Banner for Verification / Reporting Info */}
                                                                        {(dispatchStatuses[dispatch.id] || "Pending") === "Verified" && (
                                                                             <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5 text-left w-full">
                                                                                 <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                                 <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                                                                     Verified by <strong className="font-semibold text-emerald-800 dark:text-emerald-200">{dispatchVerifierNames[dispatch.id] || "Admin (You)"}</strong> • {dispatchVerifierTimes[dispatch.id]}
                                                                                 </span>
                                                                             </div>
                                                                         )}
                                                                        {(dispatchStatuses[dispatch.id] || "Pending") === "Need Correction" && (
                                                                            <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5 text-left w-full">
                                                                                <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0" />
                                                                                <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                                                                                    Reported by <strong className="font-semibold text-red-800 dark:text-red-200">{dispatchReporterNames[dispatch.id] || "Admin (You)"}</strong> • {dispatchReporterTimes[dispatch.id]}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </Card>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {(() => {
                    const hasSelected = !!(selectedDeploymentId || selectedDispatchId);
                    if (hasSelected) {
                        const status = selectedDeploymentId
                            ? (deploymentStatuses[selectedDeploymentId] || "Pending")
                            : (dispatchStatuses[selectedDispatchId || ""] || "Pending");
                        if (status !== "Pending") return null;
                    }
                    return (
                        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 flex flex-col relative">
                            <div className="p-4 flex items-center justify-between gap-4">
                                {/* Left: Navigation */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onPrevious}
                                        disabled={isFirst || isDataLoading}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                        {currentIndex + 1} / {totalCount}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                                        onClick={onNext}
                                        disabled={isLast || isDataLoading}
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Right: Actions for selected Dispatch / Deployment */}
                                {(selectedDeploymentId || selectedDispatchId) && (() => {
                                    if (selectedDeploymentId) {
                                        const dispatch = mockDispatches.find(d => d.deployments?.some(dep => dep.id === selectedDeploymentId));
                                        const deployment = dispatch?.deployments?.find(dep => dep.id === selectedDeploymentId);
                                        if (!deployment) return null;
                                        const status = deploymentStatuses[deployment.id] || "Pending";
                                        if (status !== "Pending") return null;
                                        return (
                                            <div className="flex items-center gap-2">
                                                {isReporting ? (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="h-9 px-4 text-xs font-bold border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all dark:bg-zinc-955 dark:border-zinc-800"
                                                            onClick={() => {
                                                                setIsReporting(false);
                                                                setReportingCardType(null);
                                                                setActiveReportingCardId(null);
                                                                setReportedIds([]);
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            className={cn(
                                                                "h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:text-white"
                                                            )}
                                                            onClick={() => setIsReportingFinalStep(true)}
                                                            disabled={reportedIds.length === 0}
                                                        >
                                                            <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                            {reportedIds.length === 0 ? "Report" : `Report Selected (${reportedIds.length})`}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="h-9 px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all dark:bg-zinc-955 dark:hover:bg-red-950/20"
                                                            onClick={() => {
                                                                setIsReporting(true);
                                                                setReportingCardType("deployment");
                                                                setActiveReportingCardId(deployment.id);
                                                                setReportedIds([]);
                                                            }}
                                                        >
                                                            <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                            Report
                                                        </Button>
                                                        <Button
                                                            className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                            onClick={() => {
                                                                const nowStr = format(new Date(), "dd MMM yyyy, hh:mm a");
                                                                setDeploymentStatuses(prev => ({ ...prev, [deployment.id]: "Verified" }));
                                                                setDeploymentVerifierNames(prev => ({ ...prev, [deployment.id]: "Admin (You)" }));
                                                                setDeploymentVerifierTimes(prev => ({ ...prev, [deployment.id]: nowStr }));
                                                                showToast("Approved Successfully", "Deployment approved successfully.", "success");
                                                            }}
                                                        >
                                                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                                            Approve
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        const dispatch = mockDispatches.find(d => d.id === selectedDispatchId);
                                        if (!dispatch) return null;
                                        const status = dispatchStatuses[dispatch.id] || "Pending";
                                        if (status !== "Pending") return null;
                                        return (
                                            <div className="flex items-center gap-2">
                                                {isReporting ? (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="h-9 px-4 text-xs font-bold border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all dark:bg-zinc-955 dark:border-zinc-800"
                                                            onClick={() => {
                                                                setIsReporting(false);
                                                                setReportingCardType(null);
                                                                setActiveReportingCardId(null);
                                                                setReportedIds([]);
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            className={cn(
                                                                "h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:text-white"
                                                            )}
                                                            onClick={() => setIsReportingFinalStep(true)}
                                                            disabled={reportedIds.length === 0}
                                                        >
                                                            <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                            {reportedIds.length === 0 ? "Report" : `Report Selected (${reportedIds.length})`}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="h-9 px-4 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all dark:bg-zinc-955 dark:hover:bg-red-950/20"
                                                            onClick={() => {
                                                                setIsReporting(true);
                                                                setReportingCardType("dispatch");
                                                                setActiveReportingCardId(dispatch.id);
                                                                setReportedIds([]);
                                                            }}
                                                        >
                                                            <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                            Report
                                                        </Button>
                                                        <Button
                                                            className="h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                                                            onClick={() => {
                                                                const nowStr = format(new Date(), "dd MMM yyyy, hh:mm a");
                                                                setDispatchStatuses(prev => ({ ...prev, [dispatch.id]: "Verified" }));
                                                                setDispatchVerifierNames(prev => ({ ...prev, [dispatch.id]: "Admin (You)" }));
                                                                setDispatchVerifierTimes(prev => ({ ...prev, [dispatch.id]: nowStr }));

                                                                if (dispatch.deployments) {
                                                                    setDeploymentStatuses(prev => {
                                                                        const updated = { ...prev };
                                                                        dispatch.deployments.forEach((depl: any) => {
                                                                            updated[depl.id] = "Verified";
                                                                        });
                                                                        return updated;
                                                                    });
                                                                    setDeploymentVerifierNames(prev => {
                                                                        const updated = { ...prev };
                                                                        dispatch.deployments.forEach((depl: any) => {
                                                                            updated[depl.id] = "Admin (You)";
                                                                        });
                                                                        return updated;
                                                                    });
                                                                    setDeploymentVerifierTimes(prev => {
                                                                        const updated = { ...prev };
                                                                        dispatch.deployments.forEach((depl: any) => {
                                                                            updated[depl.id] = nowStr;
                                                                        });
                                                                        return updated;
                                                                    });
                                                                }
                                                                showToast("Approved Successfully", "Dispatch and its deployments approved successfully.", "success");
                                                            }}
                                                        >
                                                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                                            Approve
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    );
                })()}

            </SheetContent>
        </Sheet>

            <Dialog open={!!activePreview} onOpenChange={(val) => {
                if (!val) setPreviewItem(null);
            }}>
                <DialogPortal>
                    <DialogContent className="max-w-[1200px] w-[95vw] h-[800px] max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl z-[500] flex items-center justify-center rounded-2xl [&>button]:hidden">
                        <DialogTitle className="sr-only">Attachment Preview</DialogTitle>
                        <DialogDescription className="sr-only">Basic view of the survey attachment</DialogDescription>
                        
                        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/5">
                            {activePreview && renderPreviewContent(activePreview)}
                        </div>
                    </DialogContent>
                </DialogPortal>
            </Dialog>

            {/* New Report Comment Pop-up */}
            <Dialog open={isReportingFinalStep} onOpenChange={setIsReportingFinalStep}>
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[550] rounded-xl [&>button]:hidden">
                    <DialogTitle className="sr-only">Finalize Report</DialogTitle>
                    <DialogDescription className="sr-only">Add additional comments before submitting the report</DialogDescription>
                    
                    <div className="bg-white dark:bg-zinc-950">
                        {reportSuccess ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reported Successfully</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Moving to the next farmer...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="p-6 pb-0 flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Report Survey</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            You are reporting <span className="font-semibold text-zinc-900 dark:text-zinc-100">{reportedIds.length} items</span>.
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all"
                                        onClick={() => setIsReportingFinalStep(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Body */}
                                <div className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Additional Comments <span className="text-red-500">*</span></Label>
                                        <Textarea 
                                            placeholder="Describe what needs to be corrected..."
                                            className="min-h-[120px] resize-none border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-50 rounded-md bg-transparent p-3 text-sm leading-relaxed"
                                            value={reportComment}
                                            onChange={(e) => setReportComment(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-6 pt-0 flex items-center justify-end gap-3">
                                    <Button 
                                        variant="outline"
                                        className="h-9 px-4 text-xs font-bold"
                                        onClick={() => setIsReportingFinalStep(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-none"
                                        onClick={handleReportSubmit}
                                        disabled={isSubmittingReport || !reportComment.trim()}
                                    >
                                        {isSubmittingReport ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                Submit Report
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>



            {/* Custom Toast Message */}
            {toastMessage && (
                <div 
                    className={cn(
                        "fixed top-4 right-4 z-[999] w-full max-w-[360px] p-4 rounded-xl shadow-lg border flex gap-3 animate-in fade-in slide-in-from-top-3 duration-300 group bg-white dark:bg-zinc-950",
                        toastMessage.type === "success" 
                            ? "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-50 dark:border-emerald-900/50" 
                            : "bg-red-50 text-red-950 border-red-200 dark:bg-red-950/90 dark:text-red-50 dark:border-red-900/50"
                    )}
                >
                    <div 
                        className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            toastMessage.type === "success" 
                                ? "bg-emerald-100 dark:bg-emerald-900/40" 
                                : "bg-red-100 dark:bg-red-900/40"
                        )}
                    >
                        {toastMessage.type === "success" ? (
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                        <h5 className={cn(
                            "font-bold text-[12px] leading-tight mb-0.5",
                            toastMessage.type === "success" ? "text-emerald-950 dark:text-emerald-50" : "text-red-950 dark:text-red-50"
                        )}>{toastMessage.title}</h5>
                        <p className={cn(
                            "text-[10px] font-medium leading-relaxed opacity-90 truncate-2-lines",
                            toastMessage.type === "success" ? "text-emerald-800 dark:text-emerald-300/80" : "text-red-800 dark:text-red-300/80"
                        )}>{toastMessage.description}</p>
                    </div>
                    <button 
                        onClick={() => setToastMessage(null)}
                        className={cn(
                            "absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-0.5",
                            toastMessage.type === "success" 
                                ? "text-emerald-900/40 hover:text-emerald-900 hover:bg-emerald-100/50 dark:text-emerald-50/40 dark:hover:text-emerald-50 dark:hover:bg-emerald-900/30"
                                : "text-red-900/40 hover:text-red-900 hover:bg-red-100/50 dark:text-red-50/40 dark:hover:text-red-50 dark:hover:bg-red-900/30"
                        )}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
        </>
    )
}
