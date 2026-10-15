"use client";

import React, { useState } from "react";
import { Undo2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewPolygonProps {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
}

interface Vertex {
    x: number;
    y: number;
    lat: number;
    lng: number;
}

export function PreviewPolygon({ question, value, onChange, locale }: PreviewPolygonProps) {
    const [vertices, setVertices] = useState<Vertex[]>(
        Array.isArray(value?.vertices) ? value.vertices : []
    );

    const minV = question.validation?.minVertices || 3;
    const maxV = question.validation?.maxVertices || 50;

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        const lat = +(29.6857 + (y / 200) * 0.005).toFixed(6);
        const lng = +(76.9905 + (x / 280) * 0.005).toFixed(6);

        const newVertices = [...vertices, { x, y, lat, lng }];
        setVertices(newVertices);
        updateOutput(newVertices);
    };

    const handleUndo = () => {
        const newVertices = vertices.slice(0, -1);
        setVertices(newVertices);
        updateOutput(newVertices);
    };

    const handleReset = () => {
        setVertices([]);
        onChange(null);
    };

    const handleAutoPlot = () => {
        const sample: Vertex[] = [
            { x: 50, y: 40, lat: 29.685812, lng: 76.990621 },
            { x: 230, y: 55, lat: 29.686015, lng: 76.993845 },
            { x: 210, y: 150, lat: 29.683412, lng: 76.993412 },
            { x: 40, y: 130, lat: 29.683210, lng: 76.990450 },
        ];
        setVertices(sample);
        updateOutput(sample);
    };

    const updateOutput = (verts: Vertex[]) => {
        if (verts.length >= minV) {
            onChange({
                vertices: verts,
                vertexCount: verts.length,
                estimatedAreaAcres: (verts.length * 1.25).toFixed(2),
                kmlSnippet: `<Polygon><outerBoundaryIs><LinearRing><coordinates>${verts
                    .map((v) => `${v.lng},${v.lat},0`)
                    .join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`,
            });
        } else {
            onChange(null);
        }
    };

    const pointsString = vertices.map((v) => `${v.x},${v.y}`).join(" ");

    return (
        <div className="space-y-2.5">
            {/* Interactive Drawing Canvas */}
            <div className="relative w-full h-[180px] bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden select-none">
                {/* Simulated Grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#71717a_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

                <svg
                    className="w-full h-full cursor-crosshair relative z-10"
                    onClick={handleCanvasClick}
                >
                    {/* Polygon Fill & Stroke */}
                    {vertices.length >= 3 && (
                        <polygon
                            points={pointsString}
                            fill="rgba(39, 39, 42, 0.15)"
                            stroke="#18181b"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                        />
                    )}

                    {/* Open Line Segments if < 3 */}
                    {vertices.length === 2 && (
                        <line
                            x1={vertices[0].x}
                            y1={vertices[0].y}
                            x2={vertices[1].x}
                            y2={vertices[1].y}
                            stroke="#18181b"
                            strokeWidth="2"
                        />
                    )}

                    {/* Vertex Handles */}
                    {vertices.map((v, i) => (
                        <g key={i}>
                            <circle cx={v.x} cy={v.y} r="5" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
                            <text
                                x={v.x + 8}
                                y={v.y - 6}
                                fill="#18181b"
                                fontSize="9"
                                fontFamily="monospace"
                                fontWeight="bold"
                            >
                                P{i + 1}
                            </text>
                        </g>
                    ))}
                </svg>

                {/* Status Overlay */}
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 pointer-events-none">
                    <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-white/90 dark:bg-zinc-950/90 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 backdrop-blur-xs"
                    >
                        {vertices.length} vertices {vertices.length >= minV ? "(Complete)" : `(Min ${minV})`}
                    </Badge>
                    {vertices.length >= minV && (
                        <Badge
                            variant="outline"
                            className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                        >
                            ~{(vertices.length * 1.25).toFixed(2)} Acres
                        </Badge>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoPlot}
                    className="h-7 text-[10px] border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1 rounded-lg"
                >
                    <Sparkles className="h-3 w-3" /> Auto-Draw Sample Plot
                </Button>

                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={vertices.length === 0}
                        onClick={handleUndo}
                        className="h-7 px-2 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                        <Undo2 className="h-3 w-3" /> Undo
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={vertices.length === 0}
                        onClick={handleReset}
                        className="h-7 px-2 text-[10px] text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                        <RotateCcw className="h-3 w-3" /> Clear
                    </Button>
                </div>
            </div>
        </div>
    );
}
