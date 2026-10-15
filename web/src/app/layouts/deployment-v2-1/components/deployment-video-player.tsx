"use client"

// Deployment V2.1 — the media viewer's video player: the browser's own <video> (no player library) with V2.1's control
// bar in place of the native controls, so the controls can follow the viewer's rules:
//   - while playing they fade out 2 s after the last interaction (pointer movement over the video, a key, a tap);
//   - they stay while paused, while a control has keyboard focus, while the pointer is over them and while seeking — a
//     focused control is never hidden, and moving between the video and the bar never flickers them;
//   - mouse: click = play / pause, double-click = fullscreen; touch: tap = show / hide the controls, double-tap = seek
//     ±10 s (left / right half). A single tap waits briefly for a second one, so one gesture never fires both actions;
//   - keyboard (the player focused): Space / K play-pause, ← / → seek 5 s, M mute, F fullscreen.
// Playback, seeking, volume, fullscreen (where the browser supports it), loading and the viewer's failed state are the
// browser's; nothing is simulated. Fullscreen is offered only when the document allows it.
import * as React from "react"
import { Loader2, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HIDE_AFTER_MS = 2000
/** How long a first tap / click waits for a second one (double-tap / double-click). */
const TAP_WINDOW_MS = 260
const KEY_SEEK_S = 5
const DOUBLE_TAP_SEEK_S = 10

const clock = (s: number) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00")

export function DeploymentVideoPlayer({ src, fit, onError }: { src: string; fit: "fill" | "fit"; onError: () => void }) {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const rootRef = React.useRef<HTMLDivElement>(null)
    const [playing, setPlaying] = React.useState(false)
    const [current, setCurrent] = React.useState(0)
    const [duration, setDuration] = React.useState(Number.NaN)
    const [muted, setMuted] = React.useState(false)
    const [volume, setVolume] = React.useState(1)
    const [buffering, setBuffering] = React.useState(true)
    const [awake, setAwake] = React.useState(true)
    const [controlFocused, setControlFocused] = React.useState(false)
    const [overControls, setOverControls] = React.useState(false)
    const [seeking, setSeeking] = React.useState(false)
    const [fullscreen, setFullscreen] = React.useState(false)
    const [fullscreenSupported, setFullscreenSupported] = React.useState(false)
    const hideTimer = React.useRef<number | undefined>(undefined)
    const tapTimer = React.useRef<number | undefined>(undefined)
    const lastTap = React.useRef<{ t: number; type: string } | null>(null)

    /** An interaction: the controls show, and fade again 2 s later (while playing). */
    const poke = React.useCallback(() => {
        setAwake(true)
        window.clearTimeout(hideTimer.current)
        hideTimer.current = window.setTimeout(() => setAwake(false), HIDE_AFTER_MS)
    }, [])
    React.useEffect(() => {
        setFullscreenSupported(!!document.fullscreenEnabled)
        poke()
        const onFullscreen = () => setFullscreen(document.fullscreenElement === rootRef.current)
        document.addEventListener("fullscreenchange", onFullscreen)
        return () => {
            window.clearTimeout(hideTimer.current)
            window.clearTimeout(tapTimer.current)
            document.removeEventListener("fullscreenchange", onFullscreen)
        }
    }, [poke])
    const visible = !playing || awake || controlFocused || overControls || seeking

    const togglePlay = () => {
        const v = videoRef.current
        if (!v) return
        if (v.paused) void v.play().catch(() => { /* blocked or failed: stays paused, the controls stay */ })
        else v.pause()
    }
    const seekBy = (delta: number) => {
        const v = videoRef.current
        if (!v) return
        const end = Number.isFinite(v.duration) ? v.duration : Number.POSITIVE_INFINITY
        v.currentTime = Math.min(end, Math.max(0, v.currentTime + delta))
    }
    const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted }
    const toggleFullscreen = () => {
        if (!fullscreenSupported) return
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
        else void rootRef.current?.requestFullscreen().catch(() => {})
    }

    /** The video surface (not the control bar): single vs double, by pointer type, never both. */
    const onSurfacePointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        const type = e.pointerType
        const rect = e.currentTarget.getBoundingClientRect()
        const side = e.clientX < rect.left + rect.width / 2 ? -1 : 1
        const last = lastTap.current
        if (last && last.type === type && e.timeStamp - last.t < TAP_WINDOW_MS) {
            window.clearTimeout(tapTimer.current)
            lastTap.current = null
            if (type === "mouse") toggleFullscreen()
            else { seekBy(side * DOUBLE_TAP_SEEK_S); poke() }
            return
        }
        lastTap.current = { t: e.timeStamp, type }
        window.clearTimeout(tapTimer.current)
        tapTimer.current = window.setTimeout(() => {
            lastTap.current = null
            if (type === "mouse") { togglePlay(); poke() }
            else if (visible && playing) { window.clearTimeout(hideTimer.current); setAwake(false) }
            else poke()
        }, TAP_WINDOW_MS)
    }
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLInputElement && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { poke(); return } // the seek slider's own keys
        const key = e.key.toLowerCase()
        if (key === " " || key === "k") { if (e.target instanceof HTMLButtonElement && key === " ") { poke(); return } e.preventDefault(); togglePlay() }
        else if (key === "arrowleft" || key === "arrowright") { e.preventDefault(); e.stopPropagation(); seekBy(key === "arrowleft" ? -KEY_SEEK_S : KEY_SEEK_S) }
        else if (key === "m") toggleMute()
        else if (key === "f") toggleFullscreen()
        poke()
    }

    const iconButton = "h-8 w-8 rounded-md text-white hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0"
    return (
        <div
            ref={rootRef}
            data-video-player
            data-controls={visible ? "visible" : "hidden"}
            data-playing={playing ? "" : undefined}
            tabIndex={0}
            aria-label="Video player"
            onPointerMove={(e) => { if (e.pointerType === "mouse") poke() }}
            onKeyDown={onKeyDown}
            className={cn("absolute inset-0 flex items-center justify-center bg-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50", playing && !visible && "cursor-none")}
        >
            <video
                ref={videoRef}
                src={src}
                autoPlay
                playsInline
                onPointerUp={onSurfacePointerUp}
                onPlay={() => { setPlaying(true); poke() }}
                onPause={() => { setPlaying(false); setAwake(true) }}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onCanPlay={() => setBuffering(false)}
                onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume) }}
                onError={onError}
                className={cn("w-full h-full bg-black", fit === "fill" ? "object-cover" : "object-contain")}
            />
            {buffering && (
                <span data-video-loading className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-label="Loading video" />
                </span>
            )}
            <div
                data-video-controls
                onPointerEnter={() => setOverControls(true)}
                onPointerLeave={() => setOverControls(false)}
                onFocus={() => { setControlFocused(true); poke() }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setControlFocused(false) }}
                className={cn(
                    "absolute inset-x-0 bottom-0 px-3 pt-2 pb-2 bg-black/60 text-white transition-opacity duration-200",
                    visible ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            >
                <input
                    type="range"
                    data-video-seek
                    aria-label="Seek"
                    aria-valuetext={`${clock(current)} of ${clock(duration)}`}
                    min={0}
                    max={Number.isFinite(duration) ? duration : 0}
                    step={0.1}
                    value={Math.min(current, Number.isFinite(duration) ? duration : 0)}
                    disabled={!Number.isFinite(duration)}
                    onPointerDown={() => setSeeking(true)}
                    onPointerUp={() => setSeeking(false)}
                    onChange={(e) => { const v = videoRef.current; if (v) v.currentTime = Number(e.target.value); poke() }}
                    className="block w-full h-1.5 cursor-pointer accent-white disabled:cursor-default"
                />
                <div className="mt-1.5 flex items-center gap-1">
                    <Button variant="ghost" size="icon" data-video-toggle aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause (K)" : "Play (K)"} onClick={() => { togglePlay(); poke() }} className={iconButton}>
                        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                    </Button>
                    <span data-video-time className="px-1 text-xs tabular-nums text-white/90">{clock(current)} / {clock(duration)}</span>
                    <span className="flex-1" />
                    <Button variant="ghost" size="icon" data-video-mute aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute (M)" : "Mute (M)"} onClick={() => { toggleMute(); poke() }} className={iconButton}>
                        {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <input
                        type="range"
                        data-video-volume
                        aria-label="Volume"
                        min={0}
                        max={1}
                        step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => { const v = videoRef.current; if (v) { v.volume = Number(e.target.value); v.muted = Number(e.target.value) === 0 } poke() }}
                        className="hidden sm:block w-20 h-1.5 cursor-pointer accent-white"
                    />
                    {fullscreenSupported && (
                        <Button variant="ghost" size="icon" data-video-fullscreen aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={() => { toggleFullscreen(); poke() }} className={iconButton}>
                            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
