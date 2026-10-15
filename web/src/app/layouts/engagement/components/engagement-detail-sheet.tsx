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
import { Calendar, XCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, MessageSquareText, AlertCircle, CheckCircle2, X, Check, Image as ImageIcon, Play, FileText, MapPin, Download, Info, MessageSquareWarning, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Scaling, AlignCenter, SlidersHorizontal, RotateCcw, Loader2, ChevronDown, User, Phone, Eye, EyeOff, Plus } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Languages } from "lucide-react"
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
import { SurveyItem, surveyData, SurveyCard, translations } from "@/app/components/survey/SurveyComponents"
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow } from "@react-google-maps/api"
import { MOCK_FARMERS } from "@/data/mockData"
import { env } from "@/platform/env"
import { Farmer, Plot } from "@/types/map"

// Same loader id + libraries as matic-dash: @react-google-maps refuses a second load with different options.
const LIBRARIES: "geometry"[] = ["geometry"];
const DEFAULT_CENTER = { lat: 20.5, lng: 78.9 };
const DEFAULT_ZOOM = 5;

function MapPreviewContent({ selectedFarmer, onIdle, center, zoom, specificMarker, onReset, onInteraction, resetCount, questionLocation, setIsMapInteracted, mapRef, isProgrammaticChange, hasLocationQuestion }: { selectedFarmer: Farmer | null, onIdle?: () => void, center?: google.maps.LatLngLiteral | null, zoom?: number, specificMarker?: google.maps.LatLngLiteral | null, onReset?: () => void, onInteraction?: () => void, resetCount: number, questionLocation?: google.maps.LatLngLiteral | null, setIsMapInteracted: (val: boolean) => void, mapRef: React.MutableRefObject<google.maps.Map | null>, isProgrammaticChange: React.MutableRefObject<boolean>, hasLocationQuestion: boolean }) {
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

    return (
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
            {questionLocation && hasLocationQuestion && (
                <Marker
                    position={questionLocation}
                    animation={specificMarker ? google.maps.Animation.BOUNCE : undefined}
                    icon={{
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="white" stroke-width="2" />
                                <text x="12" y="15.5" fill="white" font-size="10" font-family="Arial" font-weight="bold" text-anchor="middle">7</text>
                            </svg>
                        `)}`,
                        scaledSize: new google.maps.Size(24, 24),
                        anchor: new google.maps.Point(12, 12)
                    }}
                />
            )}
            {selectedFarmer && (
                <>
                    {selectedFarmer.plots.map((plot, index) => (
                        <React.Fragment key={plot.id}>
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
                            <Marker
                                position={plot.location}
                                clickable={false}
                                icon={{
                                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="white" stroke-width="2" />
                                            <text x="12" y="15.5" fill="white" font-size="10" font-family="Arial" font-weight="bold" text-anchor="middle">${index + 1}</text>
                                        </svg>
                                    `)}`,
                                    scaledSize: new google.maps.Size(24, 24),
                                    anchor: new google.maps.Point(12, 12)
                                }}
                            />
                        </React.Fragment>
                    ))}
                </>
            )}
        </GoogleMap>
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
                        imageMode === "center" && "max-w-none max-h-none w-auto h-auto object-none"
                    )}
                />
            </div>
        </div>
    );
}

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
    onLanguageChange
}: EngagementDetailSheetProps) {
    const [comment, setComment] = React.useState("")
    const [isSavingComment, setIsSavingComment] = React.useState(false)
    const [localComments, setLocalComments] = React.useState<VerificationComment[]>([])
    const [isApproving, setIsApproving] = React.useState(false)
    const [showCommentInput, setShowCommentInput] = React.useState(false)
    const [isReporting, setIsReporting] = React.useState(false)
    const [reportedIds, setReportedIds] = React.useState<string[]>([])
    const [previewItem, setPreviewItem] = React.useState<SurveyItem | null>(null)
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
    const [specificMarker, setSpecificMarker] = React.useState<google.maps.LatLngLiteral | null>(null)
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const isProgrammaticChange = React.useRef(false);

    // Helper function to translate text
    const t = React.useCallback((text: string) => {
        if (language === "en") return text;
        return translations[language]?.[text] || text;
    }, [language]);

    // Find the farmer in MOCK_FARMERS to get plot data
    const farmerData = MOCK_FARMERS.find(f => f.name === record?.farmer.name) || MOCK_FARMERS[0];

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

    if (!record) return null

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
        setResetCount(prev => prev + 1);
    }

    const handleCloseAll = () => {
        setPreviewItem(null)
        setIsReportingFinalStep(false)
        onOpenChange(false)
    }

    const handleReportSubmit = () => {
        setIsSubmittingReport(true)
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
                                    <MapPreviewContent 
                                        selectedFarmer={farmerData} 
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
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-500">
                                        Loading Map...
                                    </div>
                                )}
                                <div className="absolute top-6 left-6 z-20 pointer-events-none w-[calc(100%-48px)]">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 pointer-events-auto text-zinc-900 dark:text-zinc-50">
                                            {isShowingSpecificLocation && (
                                                <div className="px-3 h-[36px] flex items-center bg-white/95 dark:bg-zinc-950/95 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-lg text-[14px] font-bold uppercase tracking-wider whitespace-nowrap backdrop-blur-md">
                                                    {record.village}, {record.block || "Block A"}, {record.state || "Karnataka"}, {record.country || "India"}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {(isShowingSpecificLocation || isMapInteracted) && (
                                            <Button 
                                                variant="outline"
                                                onClick={resetMapToFarmer}
                                                className="pointer-events-auto bg-white/95 dark:bg-zinc-950/95 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xl border border-zinc-200 dark:border-zinc-800 h-[36px] px-4 text-xs font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <RotateCcw className="h-4 w-4 text-zinc-500" />
                                                Reset View
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Map Legend */}
                                <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
                                    <div className="flex flex-col gap-2 pointer-events-auto bg-white/95 dark:bg-zinc-950/95 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-[#dc2626] border-2 border-white shadow-sm" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Deployed Plot</span>
                                        </div>
                                        {hasLocationQuestion && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-[#2563eb] border-2 border-white shadow-sm animate-pulse" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Survey Location</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                            <div className="flex flex-col items-end gap-2 h-14 justify-center">
                                <div className="flex items-center gap-1.5">
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
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-none pointer-events-none select-none",
                                        record.status === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                                        record.status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                                        record.status === "Invalid" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                                    )}
                                >
                                    {record.status === "Invalid" ? "Need Correction" : record.status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Fixed Engagement Details Bar */}
                    <div className="bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 px-6 py-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-900 dark:text-zinc-50 leading-none">{record.engagementType}</span>
                        </div>
                        
                        {/* Info Switcher Container */}
                        <div 
                            className="h-[14px] overflow-hidden relative min-w-[200px]"
                            onMouseEnter={() => setIsInfoHovered(true)}
                            onMouseLeave={() => setIsInfoHovered(false)}
                        >
                            <div 
                                className="transition-transform duration-700 ease-in-out absolute top-0 right-0 w-full grid grid-rows-[14px_14px]"
                                style={{ transform: `translateY(-${infoSwitchIndex * 14}px)` }}
                            >
                                {/* First Info: AZ Code and AZ Name */}
                                <div className="h-[14px] flex items-center justify-end gap-2 leading-none">
                                    <span>AZ-{record.azs}</span>
                                    <span className="text-zinc-200 dark:text-zinc-800">•</span>
                                    <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">{record.azName || "Cotton Cluster"}</span>
                                </div>

                                {/* Second Info: Surveyor and Verifier */}
                                <div className="h-[14px] flex items-center justify-end gap-2 leading-none">
                                    <HoverCard openDelay={100} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <span className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-help transition-colors">
                                                {record.surveyor.name}
                                            </span>
                                        </HoverCardTrigger>
                                        <HoverCardContent align="start" side="bottom" className="w-80 z-[300] p-4">
                                            <div className="space-y-2 text-left">
                                                <h4 className="text-sm font-semibold leading-none">{record.surveyor.name}</h4>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <Phone className="h-3 w-3 opacity-70 shrink-0" />
                                                    <div className="flex items-center gap-2 group">
                                                        <span className="text-sm font-medium font-mono">
                                                            {isSurveyorPhoneVisible 
                                                                ? record.surveyor.phoneNumber 
                                                                : record.surveyor.phoneNumber?.replace(/.(?=.{4})/g, "*")}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 transition-opacity opacity-100"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setIsSurveyorPhoneVisible(!isSurveyorPhoneVisible)
                                                            }}
                                                        >
                                                            {isSurveyorPhoneVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>

                                    {record.status === "Verified" && record.verified && (
                                        <>
                                            <span className="text-zinc-200 dark:text-zinc-800">•</span>
                                            <HoverCard openDelay={100} closeDelay={100}>
                                                <HoverCardTrigger asChild>
                                                    <span className="text-emerald-600 dark:text-emerald-400 hover:opacity-70 cursor-help transition-opacity">
                                                        {record.verified.verifier}
                                                    </span>
                                                </HoverCardTrigger>
                                                <HoverCardContent align="start" side="bottom" className="w-80 z-[300] p-4">
                                                    <div className="space-y-2 text-left">
                                                        <h4 className="text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-50">{record.verified.verifier}</h4>
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <div className="flex items-center gap-1.5 leading-none text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                                                <span>Verified on</span>
                                                                <span className="text-zinc-300 dark:text-zinc-700 font-normal">-</span>
                                                                <span>{format(record.verified.date, "dd MMM yyyy")}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Comment Bar for Need Correction */}
                    {record.status === "Invalid" && (
                        <div className="bg-red-50 dark:bg-red-950/20 border-t border-red-100 dark:border-red-900/30 px-6 py-3 flex flex-col gap-1 min-h-[72px] relative overflow-hidden">
                            {isDataLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-50/50 dark:bg-red-950/10 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 text-red-400 animate-spin" />
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Loading Report...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-500">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                                        <p className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-widest">Report Comment</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-4 shrink-0" /> {/* Spacer to align with icon above */}
                                        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
                                            {record.reportComment || "The soil analysis report seems to be missing the nitrogen levels. Please re-upload the correct document."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content section - Style 5 (Feedback based) */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 relative">
                    <div className="p-6">
                        <div className="space-y-1">
                            {isDataLoading ? (
                                <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-in fade-in duration-500">
                                    <Loader2 className="h-8 w-8 text-zinc-300 animate-spin" />
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Loading Records...</p>
                                </div>
                            ) : (
                                <>
                                    {activeSurveyData.map((item) => {
                                        // Custom question text logic for questions 8, 9, and 11
                                        let displayQuestion = item.question;
                                        if (item.id === "8") displayQuestion = "Measure the total cultivated area: (in Acres)";
                                        if (item.id === "9") displayQuestion = "Enter the quantity of seeds used: (in Tons)";
                                        if (item.id === "11") displayQuestion = "Estimated cost of inputs per acre: (in INR)";

                                        return (
                                            <div 
                                                key={item.id} 
                                                className="relative"
                                            >
                                                <div 
                                                    className="cursor-pointer"
                                                    onClick={(e) => {
                                                        // If the click came from the attachment preview trigger or map item, handle it
                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('.attachment-preview-trigger') || item.type === 'map') {
                                                            handleItemClick(item);
                                                        }
                                                    }}
                                                >
                                                    <SurveyCard
                                                        item={{
                                                            ...item,
                                                            question: displayQuestion,
                                                            answer: item.type === "map" ? record.village : item.answer,
                                                            meta: item.type === "map" && questionLocation ? 
                                                                `${questionLocation.lat.toFixed(4)}° N, ${questionLocation.lng.toFixed(4)}° E` : 
                                                                item.meta
                                                        }}
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
                                            </div>
                                        );
                                    })}

                                    {/* Approval Comment Section for Pending */}
                                    {record.status === "Pending" && !isReporting && (
                                        <div className="border-b border-zinc-100 dark:border-zinc-800 pt-2 pb-3">
                                            <div className="space-y-0.5 mb-3">
                                                <div className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">
                                                    {t("Add Comment")} <span className="text-[10px] font-medium lowercase opacity-70">({t("optional")})</span>
                                                </div>
                                                <div className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight">
                                                    {t("Share any additional observations or feedback regarding this survey.")}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <Textarea
                                                    rows={showCommentInput || comment.trim() ? 4 : 1}
                                                    placeholder={t("Type your comment here . . .")}
                                                    className={cn(
                                                        "w-full box-border bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-md resize-none focus-visible:ring-1 focus-visible:ring-zinc-200 dark:focus-visible:ring-zinc-800 px-3 py-2 placeholder:text-zinc-400 transition-[min-height] duration-300 ease-in-out md:text-sm !min-h-0",
                                                        showCommentInput || comment.trim()
                                                            ? "min-h-[100px] text-base"
                                                            : "h-10 min-h-0 max-h-10 text-sm leading-tight"
                                                    )}
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    onFocus={() => setShowCommentInput(true)}
                                                    onBlur={() => {
                                                        if (!comment.trim()) setShowCommentInput(false);
                                                    }}
                                                />
                                                <div className={cn(
                                                    "flex items-center gap-2 overflow-hidden transition-[height,opacity,margin-top] duration-300 ease-in-out",
                                                    comment.trim() ? "mt-2 h-7 opacity-100" : "mt-0 h-0 opacity-0 pointer-events-none"
                                                )}>
                                                    <Button 
                                                        size="sm"
                                                        className="h-6 px-3 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 rounded-md shadow-sm transition-all duration-200"
                                                        onClick={handleSaveComment}
                                                        disabled={isSavingComment || !comment.trim()}
                                                    >
                                                        {isSavingComment ? (
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                                        ) : null}
                                                        {t("Save")}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                                                        onClick={() => {
                                                            setComment("")
                                                            setShowCommentInput(false)
                                                        }}
                                                    >
                                                        {t("Cancel")}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Verification Comments List */}
                                    {localComments.length > 0 && (
                                        <div className="py-2 border-b border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                                {localComments.length > 1 ? 'Comments' : 'Comment'}
                                            </div>
                                            <div className="space-y-3">
                                                {localComments.map((c, idx) => (
                                                    <div key={c.id} className="relative pl-4 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                        {/* Left accent line */}
                                                        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                                                        
                                                        <div className="text-[14px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                                                            "{c.text}"
                                                        </div>
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                                                {c.verifier}
                                                            </span>
                                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                            <span className="text-[10px] text-zinc-400 font-medium uppercase">
                                                                {format(c.date, "dd MMM yyyy")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Display Comment for Verified (Legacy Support) */}
                                    {record.status === "Verified" && (record.verified?.comment || record.approvalComment) && localComments.length === 0 && (
                                        <div className="py-2 border-b border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                                Comment
                                            </div>
                                            <div className="space-y-3">
                                                <div className="relative pl-4 animate-in fade-in slide-in-from-left-2 duration-500">
                                                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                                                    <div className="text-[14px] text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                                                        "{record.verified?.comment || record.approvalComment}"
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                                            {record.verified?.verifier}
                                                        </span>
                                                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                        <span className="text-[10px] text-zinc-400 font-medium uppercase">
                                                            {record.verified?.date ? format(record.verified.date, "dd MMM yyyy") : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Scroll Progress Bar (Minimal) */}
                {record.status === "Pending" && !isReporting && (
                    <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0">
                        <div 
                            className="h-full bg-zinc-900 dark:bg-zinc-50 transition-all duration-200 ease-out"
                            style={{ width: `${scrollProgress}%` }}
                        />
                    </div>
                )}

                {/* Footer section */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 flex flex-col relative">
                    {/* Report Selection Bar - Only visible during reporting */}
                    {isReporting && (
                        <div className="bg-amber-50/50 dark:bg-[#1a1608]/50 border-b border-amber-100/50 dark:border-amber-900/20 px-6 py-2 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-3">
                                <Checkbox 
                                    id="select-all-footer" 
                                    checked={reportedIds.length === activeSurveyData.length}
                                    onCheckedChange={toggleSelectAll}
                                    className="h-4 w-4 border-amber-400 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 rounded"
                                />
                                <label 
                                    htmlFor="select-all-footer" 
                                    className="text-[10px] font-bold text-amber-800 dark:text-amber-500 uppercase tracking-widest cursor-pointer select-none"
                                >
                                    Report whole survey
                                </label>
                            </div>
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/40">
                                {reportedIds.length} SELECTED
                            </span>
                        </div>
                    )}

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

                                    {/* Right: Actions */}
                                {record.status !== "Verified" && record.status !== "Invalid" && (
                                    <div className="flex items-center gap-2">
                                        {isReporting ? (
                                            <Button
                                                variant="outline"
                                                className="h-9 px-4 text-xs font-bold border-zinc-100 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
                                                onClick={() => {
                                                    setIsReporting(false)
                                                    setReportedIds([])
                                                }}
                                            >
                                                {t("Cancel")}
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="h-9 px-4 text-xs font-bold border-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                                                onClick={() => setIsReporting(true)}
                                            >
                                                <AlertCircle className="mr-2 h-3.5 w-3.5" /> {t("Report")}
                                            </Button>
                                        )}
                                        
                                        {/* Only show Approve button for Pending records and when not in reporting mode */}
                                        {record.status === "Pending" && !isReporting && (
                                            <div className="flex flex-col items-end gap-1.5">
                                                <Button
                                                    className={cn(
                                                        "h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] relative overflow-hidden",
                                                        isApproveLoaded 
                                                            ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900" 
                                                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed shadow-none"
                                                    )}
                                                    onClick={handleApprove}
                                                    disabled={isApproving || !isApproveLoaded}
                                                >
                                                    {/* Background Loading Fill */}
                                                    {!isApproveLoaded && (
                                                        <div 
                                                            className="absolute inset-y-0 left-0 bg-zinc-200 dark:bg-zinc-700 transition-all duration-200 ease-out z-0"
                                                            style={{ width: `${scrollProgress}%` }}
                                                        />
                                                    )}
                                                    
                                                    <div className="relative z-10 flex items-center">
                                                        {isApproving ? (
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className={cn(
                                                                "mr-2 h-3.5 w-3.5 transition-colors",
                                                                isApproveLoaded ? "text-white dark:text-zinc-900" : "text-zinc-300 dark:text-zinc-600"
                                                            )} />
                                                        )}
                                                        <span>{isApproving ? t("Approving...") : t("Approve")}</span>
                                                    </div>
                                                </Button>
                                            </div>
                                        )}

                                        {/* Show Report Selected button when in reporting mode */}
                                        {isReporting && (
                                            <Button
                                                className={cn(
                                                    "h-9 px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white"
                                                )}
                                                onClick={() => setIsReportingFinalStep(true)}
                                                disabled={reportedIds.length === 0}
                                            >
                                                <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                                {reportedIds.length === 0 ? t("Report") : `${t("Report Selected")} (${reportedIds.length})`}
                                            </Button>
                                        )}
                                    </div>
                                )}
                    </div>
                </div>

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
        </>
    )
}
