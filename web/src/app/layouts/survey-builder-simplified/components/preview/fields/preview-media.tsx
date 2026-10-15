"use client";

import React from "react";
import { Camera, Image as ImageIcon, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionModel } from "../../../types/survey-schema";

interface PreviewMediaProps {
    question: QuestionModel;
    value: any;
    onChange: (val: any) => void;
    locale: string;
}

export function PreviewMedia({ question, value, onChange, locale }: PreviewMediaProps) {
    const isVideo = question.type === "Video";
    const photos: string[] = Array.isArray(value) ? value : value ? [value] : [];

    const handleAddMockPhoto = () => {
        const mockImgUrl = `https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&auto=format&fit=crop&q=80`;
        const updated = [...photos, mockImgUrl];
        onChange(updated);
    };

    const handleRemovePhoto = (index: number) => {
        const updated = photos.filter((_, idx) => idx !== index);
        onChange(updated.length > 0 ? updated : null);
    };

    return (
        <div className="space-y-3">
            {photos.length > 0 ? (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {photos.map((url, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 group aspect-video">
                                <img src={url} alt="Uploaded sample" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(idx)}
                                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-zinc-900/80 text-rose-400 hover:bg-rose-950 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-zinc-900/80 text-[9px] text-zinc-200 font-mono">
                                    Photo #{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddMockPhoto}
                        className="w-full h-8 text-[10px] border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 gap-1 rounded-lg"
                    >
                        <Camera className="h-3 w-3 text-zinc-500" />
                        Add Another Photo
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        onClick={handleAddMockPhoto}
                        className="h-12 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] shadow-2xs"
                    >
                        {isVideo ? <Video className="h-4 w-4 text-zinc-600 dark:text-zinc-400" /> : <Camera className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />}
                        <span>{isVideo ? "Record Video" : "Take Photo"}</span>
                    </Button>

                    <Button
                        type="button"
                        onClick={handleAddMockPhoto}
                        variant="outline"
                        className="h-12 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-1 rounded-lg text-[11px]"
                    >
                        <ImageIcon className="h-4 w-4 text-zinc-500" />
                        <span>Upload File</span>
                    </Button>
                </div>
            )}
        </div>
    );
}
