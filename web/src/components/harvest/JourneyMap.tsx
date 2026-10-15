"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { cn } from "@/lib/utils";

// Custom DivIcon for finer control
const createCustomIcon = (icon: string, isActive: boolean) => new L.DivIcon({
    className: "bg-transparent",
    html: `<div class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-lg border-2 ${isActive ? 'border-[#556B2F] scale-125' : 'border-gray-200'} transition-all duration-500">
            <span class="text-xl">${icon}</span>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

// Journey Data
const JOURNEY_STAGES = [
    { id: "harvest", lat: 30.9010, lng: 75.8573, label: "Harvest", desc: "Punjab, India", icon: "🚜", details: "Harvested by Anita using regenerative SRI methods, saving 30% water." },
    { id: "process", lat: 21.1702, lng: 72.8311, label: "Processing", desc: "Gujarat, India", icon: "🏭", details: "Cleaned and sorted in a solar-powered facility, ensuring zero-emission processing." },
    { id: "port_in", lat: 18.9438, lng: 72.8360, label: "Port Exit", desc: "Mumbai, India", icon: "⚓", details: "Loaded onto carbon-efficient vessels. Every mile tracked." },
    { id: "port_us", lat: 33.7405, lng: -118.2786, label: "Port Entry", desc: "Los Angeles, USA", icon: "🚢", details: "Arrived at US port. Customs cleared with full transparency documentation." },
    { id: "retail", lat: 34.0522, lng: -118.2437, label: "Retail", desc: "California, USA", icon: "🛒", details: "On the shelf at your local store. Ready for a net-zero meal." }
];

const ROUTE_POSITIONS = JOURNEY_STAGES.map(s => [s.lat, s.lng] as [number, number]);

// Map Controller for smooth flyTo animations
function MapController({ activeIndex }: { activeIndex: number }) {
    const map = useMap();

    useEffect(() => {
        const stage = JOURNEY_STAGES[activeIndex];
        if (stage) {
            // Zoom levels: Higher = Closer
            // activeIndex 0 (Harvest) -> Zoom 8 (Overview of Punjab)
            // activeIndex 2 (Mumbai) -> Zoom 10 (City level)
            const targetZoom = activeIndex === 0 ? 8 : activeIndex >= 3 ? 9 : 8;

            map.flyTo([stage.lat, stage.lng], targetZoom, {
                animate: true,
                duration: 2.0,
                easeLinearity: 0.25
            });
        }
    }, [activeIndex, map]);

    return null;
}

export default function JourneyMap() {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <div className="relative bg-[#F9F8F6]">
            {/* Sticky Map Container */}
            <div className="sticky top-0 h-screen w-full z-0">
                <MapContainer
                    center={[30.9010, 75.8573]}
                    zoom={6}
                    scrollWheelZoom={false}
                    dragging={false}
                    zoomControl={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                    className="w-full h-full"
                >
                    <TileLayer
                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />

                    <Polyline
                        positions={ROUTE_POSITIONS.slice(0, activeIndex + 1)}
                        pathOptions={{ color: '#556B2F', dashArray: '10, 10', weight: 4, opacity: 0.8 }}
                    />

                    {JOURNEY_STAGES.map((stage, i) => (
                        <Marker
                            key={stage.id}
                            position={[stage.lat, stage.lng]}
                            icon={createCustomIcon(stage.icon, i === activeIndex)}
                            zIndexOffset={i === activeIndex ? 1000 : 0}
                        />
                    ))}

                    <MapController activeIndex={activeIndex} />
                </MapContainer>

                {/* Gradient overlays */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F9F8F6] to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#F9F8F6] to-transparent pointer-events-none" />
            </div>

            {/* Scrolling Content Overlay */}
            <div className="relative z-10 -mt-[100vh] pt-[50vh] pb-[50vh]">
                {JOURNEY_STAGES.map((stage, index) => (
                    <JourneyStep
                        key={stage.id}
                        stage={stage}
                        index={index}
                        onActive={setActiveIndex}
                    />
                ))}
            </div>
        </div>
    );
}

function JourneyStep({ stage, index, onActive }: { stage: any, index: number, onActive: (i: number) => void }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" });

    useEffect(() => {
        if (isInView) {
            onActive(index);
        }
    }, [isInView, index, onActive]);

    return (
        <div ref={ref} className="min-h-screen flex items-end md:items-center justify-center md:justify-start px-6 md:pl-24 py-24 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isInView ? 1 : 0.4, x: isInView ? 0 : -20 }}
                transition={{ duration: 0.5 }}
                className={cn(
                    "bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md border-l-4 pointer-events-auto mb-12 md:mb-0 transition-all duration-500",
                    isInView ? "border-[#D4AF37] scale-100 shadow-2xl" : "border-gray-200 scale-95 shadow-md"
                )}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-[#556B2F]/10 text-[#556B2F] rounded-full flex items-center justify-center text-3xl shrink-0">
                        {stage.icon}
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold font-serif text-[#1a1a1a]">{stage.label}</h3>
                        <p className="text-[#556B2F] font-bold text-sm tracking-wide">{stage.desc}</p>
                    </div>
                </div>
                <p className="text-gray-700 leading-relaxed text-lg">
                    {stage.details}
                </p>
                {/* Visual Connector Line (Desktop) */}
                <div className="absolute -left-24 top-1/2 w-24 h-0.5 bg-gradient-to-r from-transparent to-[#D4AF37] hidden md:block opacity-0 lg:opacity-100" />
            </motion.div>
        </div>
    );
}
