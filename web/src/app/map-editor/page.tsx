"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { MapMode } from "@/types/map";

const MapEditor = dynamic(() => import("@/components/map/MapEditor"), {
    ssr: false,
    loading: () => <div className="flex h-screen items-center justify-center text-zinc-500">Loading Map Editor...</div>
});

function MapEditorContent() {
    const searchParams = useSearchParams();
    const modeParam = searchParams.get("mode");
    const farmerId = searchParams.get("farmerId") || undefined;
    const mode: MapMode = modeParam === "ml" ? "ml" : "manual";

    return (
        <div className="h-screen w-full overflow-hidden">
            <MapEditor
                mode={mode}
                farmerId={farmerId}
                onSave={(plots: any[]) => console.log("Saved plots:", plots)}
            />
        </div>
    );
}

export default function MapEditorPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading Editor...</div>}>
            <MapEditorContent />
        </Suspense>
    );
}
