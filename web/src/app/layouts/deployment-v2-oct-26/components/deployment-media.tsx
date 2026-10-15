"use client"

// Deployment V2 — media field card for dispatch videos and plot pictures.
// The shared SurveyCard (style-5-feedback) prints fixed file sizes ("2.4 MB" / "12.8 MB") and has no state for an
// image that fails to load. V2 cannot change the shared card, so image / video fields with a URL render with this copy
// of its markup instead: the decoded file name, no size (the API sends none), and a visible failed state.
// Fields without a URL still use SurveyCard ("Not available").
import * as React from "react"
import { ImageOff, Play } from "lucide-react"
import type { SurveyItem } from "@/app/components/survey/SurveyComponents"

/** Readable file name of a media URL: the last path segment, URL-decoded (Firebase paths are %2F-encoded). */
export function mediaFileName(url: string, fallback: string): string {
    try {
        const path = decodeURIComponent(new URL(url, "http://localhost").pathname)
        return path.split("/").filter(Boolean).pop() || fallback
    } catch {
        return url.split("?")[0].split("/").filter(Boolean).pop() || fallback
    }
}

export function DeploymentMediaField({ item, question, onOpen }: { item: SurveyItem; question: string; onOpen: () => void }) {
    const url = item.answer as string
    const isImage = item.type === "image"
    const [failed, setFailed] = React.useState(false)
    const fileName = mediaFileName(url, isImage ? "image" : "video")

    return (
        <div className="w-full transition-all mb-0">
            <div className="relative overflow-hidden bg-transparent border-0 border-b border-zinc-100 dark:border-zinc-800 shadow-none rounded-none py-2 px-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold leading-snug text-[14px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight">{question}</h3>
                </div>
                <button
                    type="button"
                    onClick={onOpen}
                    data-media-field={item.type}
                    data-media-state={failed ? "failed" : "ok"}
                    title={url}
                    className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer w-full max-w-full overflow-hidden text-left"
                >
                    {isImage ? (
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 mr-3 flex items-center justify-center">
                            {failed ? (
                                <ImageOff className="w-4 h-4 text-zinc-400" />
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
                            )}
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-900 flex items-center justify-center mr-3">
                            <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fileName}</p>
                        <p className={failed ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-zinc-500"}>
                            {failed ? "Image couldn't be loaded. Open to try the original." : isImage ? "Image · open to view" : "Video · open to play"}
                        </p>
                    </div>
                </button>
            </div>
        </div>
    )
}
