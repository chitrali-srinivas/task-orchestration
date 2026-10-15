"use client";

import React, { useState, useCallback, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Polygon, Marker } from "@react-google-maps/api";
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Map as MapIcon, 
  PanelRightOpen, 
  Info,
  ChevronRight,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeploymentSidebar } from "./components/DeploymentSidebar";
import { dummyDeploymentData as initialData, FarmerDeployment } from "./data/dummy-data";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const center = {
  lat: 20.5,
  lng: 78.9,
};

const options = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      featureType: "all",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6c757d" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#e9ecef" }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#f8f9fa" }],
    },
  ],
};

export default function DeploymentPage() {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: ["geometry"] as any, // same as matic-dash (shared loader id "google-map-script")
  });

  const [data, setData] = useState<FarmerDeployment>(initialData);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onIdle = useCallback(() => {
    if (!isMapReady) {
      setIsMapReady(true);
    }
  }, [isMapReady]);

  const onUnmount = useCallback(function callback() {
    setMap(null);
    setIsMapReady(false);
  }, []);

  const handleUpdateData = (newData: FarmerDeployment) => {
    setData(newData);
  };

  // Reset map ready state when sidebar closes/opens to show loader if needed
  useEffect(() => {
    if (!isSidebarOpen) {
      setIsMapReady(false);
    }
  }, [isSidebarOpen]);

  // Extract all plots for map display
  const allPlots = data.tractors.flatMap(t => t.loads.flatMap(l => l.plots));

  return (
    <main className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <Link href="/components">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-zinc-500" />
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Deployment Verification</h1>
            <Badge variant="outline" className="ml-2 bg-zinc-100 dark:bg-zinc-900 text-[10px] font-bold">
              BETA
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
            <Info className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Verification Mode</span>
          </div>
          <Button 
            className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md h-9 px-4 gap-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <PanelRightOpen className="h-4 w-4" />
            {isSidebarOpen ? "Close Details" : "Open Deployment Details"}
          </Button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Main Background Map (Always visible behind) */}
        <div className="absolute inset-0 z-0">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={options}
            >
              {allPlots.map((plot) => (
                <Polygon
                  key={plot.id}
                  paths={plot.coordinates}
                  options={{
                    fillColor: plot.isApproved ? "#22c55e" : "#f59e0b",
                    fillOpacity: 0.35,
                    strokeColor: plot.isApproved ? "#166534" : "#b45309",
                    strokeWeight: 2,
                  }}
                />
              ))}
              {allPlots.map((plot) => (
                <Marker
                  key={`marker-${plot.id}`}
                  position={plot.coordinates[0]}
                  label={{
                    text: `${plot.id} (${plot.area})`,
                    color: plot.isApproved ? "#166534" : "#b45309",
                    fontSize: "12px",
                    fontWeight: "bold",
                    className: "bg-white/80 px-1 rounded shadow-sm border border-zinc-200"
                  }}
                />
              ))}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Loading Map...</p>
              </div>
            </div>
          )}

          {/* Floating Map Controls/Info */}
          <div className="absolute top-4 left-4 space-y-2 pointer-events-none">
            <Card className="w-64 bg-white/90 dark:bg-zinc-950/90 backdrop-blur shadow-lg border-zinc-200 dark:border-zinc-800 pointer-events-auto">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-zinc-500" />
                  Map Legend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500/30 border border-green-600" />
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Verified Plot</span>
                  </div>
                  <Badge variant="outline" className="h-4 text-[9px] px-1 bg-green-50 text-green-700 border-green-200">
                    {allPlots.filter(p => p.isApproved).length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500/30 border border-amber-600" />
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Pending Plot</span>
                  </div>
                  <Badge variant="outline" className="h-4 text-[9px] px-1 bg-amber-50 text-amber-700 border-amber-200">
                    {allPlots.filter(p => !p.isApproved).length}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Status Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-zinc-900/90 dark:bg-zinc-50/90 backdrop-blur text-white dark:text-zinc-900 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-6 pointer-events-auto border border-zinc-800 dark:border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Farmer</span>
                <span className="text-xs font-bold">{data.name}</span>
              </div>
              <div className="h-4 w-px bg-white/20 dark:bg-black/20" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Deployed</span>
                <span className="text-xs font-bold">{data.totalDeployedQty}</span>
              </div>
              <div className="h-4 w-px bg-white/20 dark:bg-black/20" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Tractors</span>
                <span className="text-xs font-bold">{data.tractors.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sliding Verification Frame (Map + Sidebar) - Slides as ONE unit from the right */}
        <div className={cn(
          "fixed inset-0 top-14 flex transition-all duration-500 ease-in-out z-20 bg-white dark:bg-zinc-950 shadow-2xl pointer-events-none",
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {/* Map Preview (Left side of the frame) */}
          <div className="flex-1 relative h-full bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 pointer-events-auto">
            {isLoaded ? (
              <>
                <div className={cn(
                  "absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-opacity duration-300",
                  isMapReady ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Initializing Map...</p>
                  </div>
                </div>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={center}
                  zoom={15}
                  onLoad={onLoad}
                  onIdle={onIdle}
                  onUnmount={onUnmount}
                  options={options}
                >
                  {allPlots.map((plot) => (
                    <Polygon
                      key={`frame-${plot.id}`}
                      paths={plot.coordinates}
                      options={{
                        fillColor: plot.isApproved ? "#22c55e" : "#f59e0b",
                        fillOpacity: 0.35,
                        strokeColor: plot.isApproved ? "#166534" : "#b45309",
                        strokeWeight: 2,
                      }}
                    />
                  ))}
                </GoogleMap>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 mx-auto text-zinc-400 animate-spin" />
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Loading Map API...</p>
                </div>
              </div>
            )}
            
            {/* Map Overlay Info */}
            <div className="absolute top-6 left-6 z-10">
              <div className="flex items-center gap-2">
                <Badge className="bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-50 shadow-xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-md px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider">
                  {allPlots.length} Plots
                </Badge>
                <Badge className="bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-50 shadow-xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-md px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider">
                  {data.totalDeployedQty} Deployed
                </Badge>
              </div>
            </div>
          </div>

          {/* Sidebar (Right side of the frame) */}
          <div className="w-full lg:w-[420px] h-full border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 pointer-events-auto">
            <DeploymentSidebar data={data} onUpdateData={handleUpdateData} />
          </div>
        </div>
      </div>
    </main>
  );
}
