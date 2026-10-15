"use client"

// Deployment V2.1 — hover previews in the farmer detail (the survey cards' pattern: shadcn HoverCard, compact content
// beside the trigger) for a plot's picture, a dispatch's video and a plot's location.
//   - opens after a short pause on the trigger (so sweeping the pointer across a list opens nothing), on keyboard focus
//     (not on focus a closing viewer returns after a mouse click), and on touch by a long press — a tap keeps the
//     trigger's own click (the viewer);
//   - picture: the URL the thumbnail already loaded (no other download), with a failed state; video: the file itself,
//     muted and inline at normal speed while the card is open (streamed, not downloaded first; one at a time; stopped
//     when the card closes) — the API sends one full-size file and no thumbnail or smaller rendition; location: the
//     plot's own coordinates (no map image fetched);
//   - placed beside the trigger, kept inside the viewport (Radix collision handling).
import * as React from "react"
import { ImageOff, Loader2, MapPin, Play, VideoOff } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { mediaFileName } from "./deployment-media"

const OPEN_DELAY_MS = 450
const CLOSE_DELAY_MS = 120
const LONG_PRESS_MS = 450

export type HoverPreview =
    | { kind: "image"; url: string; title: string; caption?: string }
    | { kind: "video"; url: string; title: string; caption?: string }
    | { kind: "location"; lat: number; lng: number; title: string; caption?: string }

const coordinates = (lat: number, lng: number) => `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? "E" : "W"}`

function PreviewImage({ url }: { url: string }) {
    const [failed, setFailed] = React.useState(false)
    if (failed) {
        return (
            <div data-hover-preview-state="failed" className="h-32 flex flex-col items-center justify-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500">
                <ImageOff className="h-5 w-5 text-zinc-300" aria-hidden />
                The picture couldn&apos;t be loaded
            </div>
        )
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img data-hover-preview-state="image" src={url} alt="" className="block w-full max-h-48 object-contain bg-zinc-100 dark:bg-zinc-900" onError={() => setFailed(true)} />
}

/** The one video preview allowed to play: a newer one pauses it, so there is never more than one stream. */
let playingPreview: HTMLVideoElement | null = null

/**
 * A video's preview: the file itself, muted and inline, looping at normal speed while the card is open. The browser
 * streams it (range requests as it plays — not the whole file first); closing the card pauses it and drops the source,
 * which stops the download. Autoplay refused: the first frame with the play mark. The file failing: said so.
 */
function PreviewVideo({ url }: { url: string }) {
    const ref = React.useRef<HTMLVideoElement>(null)
    const [state, setState] = React.useState<"loading" | "playing" | "paused" | "failed">("loading")
    React.useEffect(() => {
        const video = ref.current
        if (!video) return
        if (playingPreview && playingPreview !== video) playingPreview.pause()
        playingPreview = video
        // the source is set here, not as a prop: the cleanup drops it (to stop the download), and a remount (React's dev
        // double mount included) must set it again
        video.muted = true
        video.src = url
        video.play().catch(() => setState((current) => (current === "failed" ? current : "paused")))
        return () => {
            video.pause()
            video.removeAttribute("src")
            video.load()
            if (playingPreview === video) playingPreview = null
        }
    }, [url])
    if (state === "failed") {
        return (
            <div data-hover-preview-state="video-failed" className="h-32 flex flex-col items-center justify-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500">
                <VideoOff className="h-5 w-5 text-zinc-300" aria-hidden />
                The video preview couldn&apos;t be loaded
            </div>
        )
    }
    return (
        <div data-hover-preview-state={state === "playing" ? "video" : `video-${state}`} className="relative h-32 bg-zinc-900">
            <video
                ref={ref}
                data-hover-preview-video
                muted
                playsInline
                loop
                preload="metadata"
                disablePictureInPicture
                aria-hidden
                tabIndex={-1}
                onPlaying={() => setState("playing")}
                onWaiting={() => setState((current) => (current === "playing" ? "loading" : current))}
                onError={() => setState("failed")}
                className="absolute inset-0 h-full w-full object-cover"
            />
            {state === "loading" && (
                <span className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/70" aria-label="Loading the video preview" /></span>
            )}
            {state === "paused" && (
                <span className="absolute inset-0 flex items-center justify-center"><span className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center"><Play className="h-4 w-4 text-white fill-white" aria-hidden /></span></span>
            )}
        </div>
    )
}

export function MediaHoverPreview({ preview, children }: { preview: HoverPreview; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const pressTimer = React.useRef<number | undefined>(undefined)
    /** Opened by a long press: its release must not also click the trigger, and a tap elsewhere closes it. */
    const byTouch = React.useRef(false)
    const triggerRef = React.useRef<HTMLSpanElement>(null)
    const pointerInside = React.useRef(false)
    React.useEffect(() => () => window.clearTimeout(pressTimer.current), [])
    React.useEffect(() => {
        if (!open || !byTouch.current) return
        const close = (e: PointerEvent) => {
            if (triggerRef.current?.contains(e.target as Node)) return
            byTouch.current = false
            setOpen(false)
        }
        document.addEventListener("pointerdown", close, true)
        return () => document.removeEventListener("pointerdown", close, true)
    }, [open])
    const cancelPress = () => window.clearTimeout(pressTimer.current)
    /** An open by focus alone counts only when the focus is the keyboard's: a viewer closed with the mouse returns focus
     *  to the thumbnail, and that must not pop its preview. */
    const keyboardFocus = () => {
        const active = document.activeElement
        if (!active || !triggerRef.current?.contains(active)) return false
        try { return active.matches(":focus-visible") } catch { return true }
    }
    const onOpenChange = (next: boolean) => {
        if (!next) byTouch.current = false
        else if (!pointerInside.current && !keyboardFocus()) return
        setOpen(next)
    }
    return (
        <HoverCard open={open} onOpenChange={onOpenChange} openDelay={OPEN_DELAY_MS} closeDelay={CLOSE_DELAY_MS}>
            <HoverCardTrigger asChild>
                <span
                    ref={triggerRef}
                    data-hover-preview-trigger={preview.kind}
                    className="inline-flex min-w-0"
                    onPointerEnter={(e) => { if (e.pointerType === "mouse") pointerInside.current = true }}
                    onPointerDown={(e) => {
                        if (e.pointerType === "mouse") return
                        cancelPress()
                        pressTimer.current = window.setTimeout(() => { byTouch.current = true; setOpen(true) }, LONG_PRESS_MS)
                    }}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={() => { pointerInside.current = false; cancelPress() }}
                    onClickCapture={(e) => {
                        if (!byTouch.current) return
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onContextMenu={(e) => { if (byTouch.current) e.preventDefault() }}
                >
                    {/* Radix's trigger calls preventDefault on touchstart, which React listens to passively: a no-op that
                        logs a console error on every touch — the long press above is the touch path, so it stops here. */}
                    <span className="contents" onTouchStart={(e) => e.stopPropagation()}>{children}</span>
                </span>
            </HoverCardTrigger>
            <HoverCardContent
                side="left"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                data-hover-preview={preview.kind}
                className="w-60 p-0 overflow-hidden z-[300] border-zinc-200 dark:border-zinc-800 text-left"
                onClick={(e) => e.stopPropagation()}
            >
                {preview.kind === "image" && <PreviewImage url={preview.url} />}
                {preview.kind === "video" && <PreviewVideo url={preview.url} />}
                {preview.kind === "location" && (
                    <div data-hover-preview-state="location" className="flex items-start gap-2 px-3 pt-3">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-zinc-500" aria-hidden />
                        <p data-hover-preview-coordinates className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{coordinates(preview.lat, preview.lng)}</p>
                    </div>
                )}
                <div className="px-3 py-2">
                    <p data-hover-preview-title className="text-xs font-semibold font-mono text-zinc-900 dark:text-zinc-50 truncate" title={preview.title}>{preview.title}</p>
                    {preview.kind === "video" && <p className="text-[11px] text-zinc-500 truncate" title={mediaFileName(preview.url, "video")}>{mediaFileName(preview.url, "video")}</p>}
                    {preview.caption && <p className="text-[11px] text-zinc-500 [overflow-wrap:anywhere]">{preview.caption}</p>}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}
