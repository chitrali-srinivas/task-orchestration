"use client";

import React, { useState } from "react";
import { QrCode, Camera, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewQRProps {
    question: QuestionModel;
    value: string;
    onChange: (val: string) => void;
    locale: string;
}

export function PreviewQR({ question, value, onChange, locale }: PreviewQRProps) {
    const [isScanning, setIsScanning] = useState(false);
    const prefix = question.validation?.qrPrefix || "MATI-";

    const handleSimulateScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            const randomCode = `${prefix}LAB-${Math.floor(10000 + Math.random() * 90000)}`;
            onChange(randomCode);
            setIsScanning(false);
        }, 800);
    };

    return (
        <div className="space-y-2.5">
            {value ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block uppercase">Scanned Code</span>
                                <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">{value}</span>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSimulateScan}
                            className="h-7 text-[10px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 gap-1"
                        >
                            <RefreshCw className="h-3 w-3" /> Rescan
                        </Button>
                    </div>
                </div>
            ) : isScanning ? (
                <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
                    <div className="w-16 h-16 border-2 border-dashed border-zinc-500 rounded-lg flex items-center justify-center animate-pulse">
                        <QrCode className="h-8 w-8 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 font-medium">Scanning Sample Barcode...</span>
                </div>
            ) : (
                <div className="space-y-2">
                    <Button
                        type="button"
                        onClick={handleSimulateScan}
                        className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold gap-2 text-xs rounded-lg shadow-2xs"
                    >
                        <Camera className="h-4 w-4" />
                        <span>Scan QR / Barcode</span>
                    </Button>

                    <Input
                        placeholder={`Or enter manually (e.g. ${prefix}00123)`}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-lg"
                    />
                </div>
            )}
        </div>
    );
}
