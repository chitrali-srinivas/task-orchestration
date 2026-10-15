"use client"

// Deployment V2.1 — full-screen boundary editor for SEVERAL plots in one session (same page: an overlay over the detail,
// never a route). V2.1 change (backlog D); V2 Oct 26 keeps its one-plot editor.
//   One plot is active at a time: its outline is the editable shape. Pick another plot in the list (or click its marker)
//   to edit it — every plot keeps its own edits while you move between them; nothing is lost by switching.
//   Edit:  drag a point to move it; drag a midpoint to add one; select a point (click: ringed on the map) → Delete point
//          (or right-click it, or Delete / Backspace). A click off the outline clears the selection.
//   Draw:  when the plot has no outline (or after Redraw): click the map to place points; click the first point (or
//          Finish shape) to close the shape (3+ points). Finishing only closes the shape; Save all writes.
//   Undo / Redo (V2.1, per plot, Ctrl+Z / Ctrl+Shift+Z): every geometry step — a point placed, Clear, Finish, Redraw,
//          Reset, a point moved / added / deleted — can be undone and redone; nothing is saved by either.
//   The list shows each plot's state: Unchanged · Modified · Needs attention (unfinished / fewer than 3 points / the
//   outline crosses itself) · Saving · Saved · Failed. Reset (per plot) goes back to its saved outline.
//   Save all: the explicit, only write — the modified plots are saved ONE BY ONE (one uploadGeoJsonData request per plot:
//   whether a multi-entry request is atomic isn't known, so each plot's result stays exact). A failed plot keeps its
//   edits and is retried by the next Save all; saved plots are done. Cancel asks first while unsaved edits exist.
// Nothing is saved while editing; the detail map shows a plot's new outline only after its save succeeded.
// Layout (V2.1 Plot Drawing workspace): one low toolbar (what is edited, its save state, Reset / Cancel / Save all), one
// panel docked beside the map (the active plot's drawing tools, then the session's plots) and the map filling the rest —
// nothing floats over the map but the save-failure alert. Below lg the panel is a short strip above the map.
import * as React from "react"
import { GoogleMap, Marker, Polygon, Polyline } from "@react-google-maps/api"
import { AlertCircle, Check, CheckCircle2, Loader2, PencilRuler, Redo2, RotateCcw, Trash2, Undo2, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { MapPlot } from "../data/map-data"
import { STATUS_BADGE_CLASS } from "./deployment-details-panel"
import { markerIcon } from "./map-markers"
import { SQUARE_METERS_TO_ACRES } from "../data/request-builders"
import { isInsideOutline, outlineKey } from "../data/boundary-coverage"
import { selfIntersects } from "../data/boundary-gate"

type LatLng = google.maps.LatLngLiteral

/** A plot that can be edited in this session (it has a plot deployment to save to). */
export interface EditablePlot {
    mapPlot: MapPlot
    /** "DEPL-…" and the line under it (dispatch · source · plot). */
    title: string
    subtitle: string
    /** The API's plot id (shown under the deployment in the list); empty when the API sends none. */
    plotId?: string
}

export interface SaveAllResult {
    saved: string[]
    failed: string[]
}

export interface BoundaryEditorProps {
    /** Every plot of the record (context on the map). */
    plots: MapPlot[]
    /** The plots this session can edit, in list order. */
    editable: EditablePlot[]
    /** The plot the session opens on. */
    initialTargetId: string
    /** The marker semantics of the detail map (fill / diameter), so the context looks the same. */
    markerFill: (plot: MapPlot) => string | null
    markerDiameter: (plot: MapPlot) => number
    onCancel: () => void
    /** Saves ONE plot's outline (the real request); rejects with a message on failure. `session.plotIds`: every plot
     *  this Save all saves with its own outline; `session.include`: plots whose outline was removed to be covered by
     *  this one. Resolves with the plots (of this list) the outline was saved to besides this one. */
    onSavePlot: (plotId: string, path: LatLng[], areaSquareMeters: number, session: { plotIds: string[]; include: string[] }) => Promise<{ coveredPlotIds: string[] } | void>
    /** Before Save all: per outline to be saved (in save order), the other deployments it will also go to (the same
     *  rule as the save), `replaces` when one already has a boundary. */
    previewSave?: (queue: { plotId: string; path: LatLng[] }[]) => Record<string, { title: string; replaces: boolean }[]>
    /** After every Save all: the parent closes the editor when nothing failed. */
    onSaveAllDone: (result: SaveAllResult) => void
}

type PlotState = "unchanged" | "modified" | "invalid" | "covered" | "saving" | "saved" | "failed"

interface PlotEdit {
    /** The outline as last saved (open ring; [] = none). */
    persisted: LatLng[]
    mode: "edit" | "draw"
    /** Edit mode: the outline as edited. */
    current: LatLng[]
    /** Draw mode: the points placed so far. */
    draft: LatLng[]
    /** Saved in this session (and unchanged since). */
    saved: boolean
    /** The last save attempt failed with this message (kept until the next attempt). */
    error: string | null
}

/** One plot's geometry at a step of the session (Undo / Redo restore it). */
type Snapshot = Pick<PlotEdit, "mode" | "current" | "draft">
interface History { past: Snapshot[]; future: Snapshot[] }
const snapOf = (e: PlotEdit): Snapshot => ({ mode: e.mode, current: e.current, draft: e.draft })
/** Steps kept per plot. */
const HISTORY_LIMIT = 100

const samePath = (a: LatLng[], b: LatLng[]) => a.length === b.length && a.every((p, i) => Math.abs(p.lat - b[i].lat) < 1e-9 && Math.abs(p.lng - b[i].lng) < 1e-9)
const pathOf = (polygon: google.maps.Polygon | null): LatLng[] => (polygon ? polygon.getPath().getArray().map((p) => p.toJSON()) : [])
const areaOf = (path: LatLng[]) => (path.length >= 3 && typeof google !== "undefined" && google.maps.geometry ? google.maps.geometry.spherical.computeArea(path.map((p) => new google.maps.LatLng(p.lat, p.lng))) : 0)

/** A GeoJSON ring repeats its first point at the end; the editor edits the open ring (the save closes it again). */
function openRing(path: LatLng[] | undefined): LatLng[] {
    const ring = (path ?? []).map((p) => ({ lat: p.lat, lng: p.lng }))
    if (ring.length > 1 && samePath([ring[0]], [ring[ring.length - 1]])) ring.pop()
    return ring.length >= 3 ? ring : []
}

const isModified = (e: PlotEdit) => (e.mode === "draw" ? e.draft.length > 0 || e.persisted.length >= 3 : !samePath(e.current, e.persisted))

/** Why a modified plot can't be saved yet (null: it can). */
function problemOf(e: PlotEdit): string | null {
    if (!isModified(e)) return null
    if (e.mode === "draw") return e.draft.length === 0 ? "Outline removed — draw a new one or reset" : "Unfinished outline — click the first point or Finish shape (3+ points)"
    if (e.current.length < 3) return "Fewer than 3 points"
    if (selfIntersects(e.current)) return "The outline crosses itself"
    return null
}

const STATE_LABEL: Record<PlotState, string> = { unchanged: "Unchanged", modified: "Modified", invalid: "Needs attention", covered: "Covered", saving: "Saving…", saved: "Saved", failed: "Failed" }
const STATE_CLASS: Record<PlotState, string> = {
    unchanged: "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
    modified: STATUS_BADGE_CLASS.Pending,
    invalid: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
    covered: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
    saving: "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300",
    saved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
}

export function PlotBoundaryEditor({ plots, editable, initialTargetId, markerFill, markerDiameter, onCancel, onSavePlot, previewSave, onSaveAllDone }: BoundaryEditorProps) {
    const [edits, setEdits] = React.useState<Record<string, PlotEdit>>(() => Object.fromEntries(editable.map(({ mapPlot }) => {
        const persisted = openRing(mapPlot.path)
        return [mapPlot.id, { persisted, mode: persisted.length >= 3 ? "edit" : "draw", current: persisted, draft: [], saved: false, error: null } satisfies PlotEdit]
    })))
    const editsRef = React.useRef(edits)
    editsRef.current = edits
    const [activeId, setActiveId] = React.useState(() => (editable.some((e) => e.mapPlot.id === initialTargetId) ? initialTargetId : editable[0]?.mapPlot.id ?? initialTargetId))
    const activeRef = React.useRef(activeId)
    activeRef.current = activeId
    /** A new key mounts a new editable polygon (switching plots, Reset, Finish drawing). */
    const [polygonKey, setPolygonKey] = React.useState(0)
    /**
     * The editable polygon's starting path, fixed for its mount: edits flow polygon → state (bind), never back as a prop —
     * a changing `path` prop would replace the polygon's path object and detach its listeners mid-edit.
     */
    const [mountPath, setMountPath] = React.useState<LatLng[]>(() => edits[activeId]?.current ?? [])
    const remount = (path: LatLng[]) => {
        setMountPath(path)
        setPolygonKey((k) => k + 1)
    }
    const [selectedVertex, setSelectedVertex] = React.useState<number | null>(null)
    const [saving, setSaving] = React.useState<{ plotId: string; index: number; total: number } | null>(null)
    const [result, setResult] = React.useState<SaveAllResult | null>(null)
    const [confirmDiscard, setConfirmDiscard] = React.useState(false)
    const polygonRef = React.useRef<google.maps.Polygon | null>(null)
    const listenersRef = React.useRef<google.maps.MapsEventListener[]>([])
    const mapRef = React.useRef<google.maps.Map | null>(null)
    /** The camera the map starts with — read once; `frame` moves it afterwards (a controlled centre would undo each fit). */
    const [initialCamera] = React.useState(() => ({ center: editable.find((e) => e.mapPlot.id === activeId)?.mapPlot.location ?? editable[0]?.mapPlot.location, zoom: 18 }))

    const active = editable.find((e) => e.mapPlot.id === activeId) ?? editable[0]
    const edit = active ? edits[active.mapPlot.id] : undefined
    const update = (id: string, change: (e: PlotEdit) => PlotEdit) => setEdits((prev) => (prev[id] ? { ...prev, [id]: change(prev[id]) } : prev))

    /**
     * V2.1 (SMP-925): a plot whose outline was removed in this session is COVERED by another plot's new, finished outline
     * when its location lies inside it — saved with that plot (the same request), as the original Deployment page saves
     * one outline to every point inside it, instead of needing an outline of its own.
     */
    const finishedOutline = (id: string) => { const e = edits[id]; return e && e.mode === "edit" && isModified(e) && !problemOf(e) ? e.current : null }
    const coveredBy: Record<string, string> = {}
    for (const { mapPlot } of editable) {
        const e = edits[mapPlot.id]
        if (!e || e.mode !== "draw" || e.draft.length > 0 || e.persisted.length < 3) continue
        const by = editable.find((c) => { const outline = c.mapPlot.id !== mapPlot.id ? finishedOutline(c.mapPlot.id) : null; return !!outline && isInsideOutline(mapPlot.location, outline) })
        if (by) coveredBy[mapPlot.id] = by.mapPlot.id
    }
    const titleOf = (id: string) => editable.find((e) => e.mapPlot.id === id)?.title ?? id
    const stateOf = (id: string): PlotState => {
        const e = edits[id]
        if (!e) return "unchanged"
        if (saving?.plotId === id || (saving && coveredBy[id] === saving.plotId)) return "saving"
        if (isModified(e)) return e.error ? "failed" : coveredBy[id] ? "covered" : problemOf(e) ? "invalid" : "modified"
        return e.saved ? "saved" : "unchanged"
    }
    const modifiedIds = editable.map((e) => e.mapPlot.id).filter((id) => edits[id] && isModified(edits[id]))
    const invalidIds = modifiedIds.filter((id) => problemOf(edits[id]) && !coveredBy[id])
    const dirty = modifiedIds.length > 0
    const canSaveAll = dirty && invalidIds.length === 0 && !saving
    /** What Save all will send besides each outline's own plot (production's rule: every point inside it). */
    const alsoSaves = previewSave && !saving ? previewSave(modifiedIds.filter((id) => !coveredBy[id] && !problemOf(edits[id])).map((id) => ({ plotId: id, path: edits[id].current }))) : {}
    const shape = edit ? (edit.mode === "draw" ? edit.draft : edit.current) : []
    const acres = areaOf(shape) * SQUARE_METERS_TO_ACRES

    /** Per plot: the geometry steps that Undo / Redo walk (session only; nothing is saved by them). */
    const [history, setHistory] = React.useState<Record<string, History>>({})
    /** Records a plot's geometry BEFORE a change (one step); a new change clears its Redo. */
    const record = React.useCallback((id: string) => {
        const e = editsRef.current[id]
        if (!e) return
        setHistory((prev) => ({ ...prev, [id]: { past: [...(prev[id]?.past ?? []), snapOf(e)].slice(-HISTORY_LIMIT), future: [] } }))
    }, [])

    // the active polygon's path → its plot's edit (moves, inserted midpoints, removed points — each one Undo step)
    const bind = React.useCallback((polygon: google.maps.Polygon) => {
        listenersRef.current.forEach((l) => l.remove())
        const path = polygon.getPath()
        const sync = () => {
            const id = activeRef.current
            const next = pathOf(polygon)
            setEdits((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], current: next, saved: prev[id].saved && samePath(next, prev[id].persisted) } } : prev))
        }
        /** A change the user made to the outline: recorded first (the edit still holds the geometry before it). */
        const change = () => { record(activeRef.current); sync() }
        listenersRef.current = [
            google.maps.event.addListener(path, "set_at", change),
            google.maps.event.addListener(path, "insert_at", change),
            google.maps.event.addListener(path, "remove_at", change),
            google.maps.event.addListener(polygon, "click", (e: google.maps.PolyMouseEvent) => setSelectedVertex(typeof e.vertex === "number" ? e.vertex : null)),
            google.maps.event.addListener(polygon, "contextmenu", (e: google.maps.PolyMouseEvent) => {
                if (typeof e.vertex === "number" && path.getLength() > 3) path.removeAt(e.vertex)
                setSelectedVertex(null)
            }),
        ]
        sync()
    }, [record])
    React.useEffect(() => () => listenersRef.current.forEach((l) => l.remove()), [])

    /** Frames one plot: its outline when it has one, else its location at a close zoom. */
    const frame = React.useCallback((id: string) => {
        const map = mapRef.current
        const target = editable.find((e) => e.mapPlot.id === id)
        if (!map || !target) return
        const e = editsRef.current[id]
        const outline = e && e.current.length >= 3 ? e.current : e && e.persisted.length >= 3 ? e.persisted : []
        if (outline.length >= 3) {
            const bounds = new google.maps.LatLngBounds()
            outline.forEach((p) => bounds.extend(p))
            map.fitBounds(bounds, 96)
        } else {
            map.panTo(target.mapPlot.location)
            map.setZoom(19)
        }
    }, [editable])

    const selectPlot = (id: string) => {
        if (id === activeId || saving || !edits[id]) return
        setSelectedVertex(null)
        polygonRef.current = null
        setActiveId(id)
        remount(edits[id].current)
        frame(id)
    }
    const deleteSelected = () => {
        const path = polygonRef.current?.getPath()
        if (!path || selectedVertex === null || path.getLength() <= 3) return
        path.removeAt(selectedVertex)
        setSelectedVertex(null)
    }
    const resetPlot = (id: string) => {
        if (saving) return
        if (edits[id] && isModified(edits[id])) record(id)
        update(id, (e) => ({ ...e, mode: e.persisted.length >= 3 ? "edit" : "draw", current: e.persisted, draft: [], error: null }))
        if (id === activeId) {
            setSelectedVertex(null)
            remount(edits[id].persisted)
        }
    }
    const redraw = () => {
        if (!active) return
        setSelectedVertex(null)
        record(active.mapPlot.id)
        update(active.mapPlot.id, (e) => ({ ...e, mode: "draw", current: [], draft: [], saved: false }))
    }
    const finishDrawing = () => {
        if (!active || !edit || edit.draft.length < 3) return
        const drawn = edit.draft
        record(active.mapPlot.id)
        update(active.mapPlot.id, (e) => ({ ...e, mode: "edit", current: drawn, draft: [], saved: false }))
        remount(drawn)
    }
    const clearDraft = () => {
        if (!active || !edit || edit.draft.length === 0 || saving) return
        record(active.mapPlot.id)
        update(active.mapPlot.id, (p) => ({ ...p, draft: [] }))
    }
    const historyOf = (id: string): History => history[id] ?? { past: [], future: [] }
    /** Puts a plot's geometry back to a recorded step (the editable outline is remounted on it). */
    const restore = (id: string, snap: Snapshot) => {
        setSelectedVertex(null)
        update(id, (p) => ({ ...p, mode: snap.mode, current: snap.current, draft: snap.draft, saved: p.saved && samePath(snap.current, p.persisted) }))
        if (id === activeId) {
            polygonRef.current = null
            remount(snap.current)
        }
    }
    const undo = () => {
        if (!active || saving) return
        const id = active.mapPlot.id
        const h = historyOf(id)
        const e = edits[id]
        if (!e || h.past.length === 0) return
        setHistory((prev) => ({ ...prev, [id]: { past: h.past.slice(0, -1), future: [...h.future, snapOf(e)] } }))
        restore(id, h.past[h.past.length - 1])
    }
    const redo = () => {
        if (!active || saving) return
        const id = active.mapPlot.id
        const h = historyOf(id)
        const e = edits[id]
        if (!e || h.future.length === 0) return
        setHistory((prev) => ({ ...prev, [id]: { past: [...h.past, snapOf(e)].slice(-HISTORY_LIMIT), future: h.future.slice(0, -1) } }))
        restore(id, h.future[h.future.length - 1])
    }
    const saveAll = async () => {
        if (!canSaveAll) return
        const covered = { ...coveredBy }
        const queue = modifiedIds.filter((id) => !covered[id])
        const done: SaveAllResult = { saved: [], failed: [] }
        setResult(null)
        for (const [index, id] of queue.entries()) {
            setSaving({ plotId: id, index, total: queue.length })
            const path = editsRef.current[id].current
            const include = Object.keys(covered).filter((r) => covered[r] === id)
            try {
                const res = await onSavePlot(id, path, areaOf(path), { plotIds: queue, include })
                done.saved.push(id)
                update(id, (e) => ({ ...e, persisted: path, saved: samePath(e.current, path), error: null }))
                // the plots this outline was saved to besides this one: theirs now (covered ones and any others inside)
                const savedWith = new Set(res?.coveredPlotIds ?? [])
                for (const other of savedWith) {
                    if (!editsRef.current[other] || queue.includes(other)) continue
                    if (!done.saved.includes(other)) done.saved.push(other)
                    update(other, (e) => ({ ...e, persisted: path, mode: "edit", current: path, draft: [], saved: true, error: null }))
                }
                for (const r of include.filter((r) => !savedWith.has(r))) {
                    done.failed.push(r)
                    update(r, (e) => ({ ...e, error: `Not saved with ${titleOf(id)}'s outline (another farmer or round, or not editable here) — draw its own outline or reset.` }))
                }
            } catch (error) {
                done.failed.push(id)
                update(id, (e) => ({ ...e, error: error instanceof Error ? error.message : String(error) }))
                for (const r of include) {
                    done.failed.push(r)
                    update(r, (e) => ({ ...e, error: `Not saved: ${titleOf(id)}'s save failed (it was to cover this plot).` }))
                }
            }
        }
        setSaving(null)
        setResult(done)
        onSaveAllDone(done)
    }
    const requestCancel = () => (dirty ? setConfirmDiscard(true) : onCancel())

    // Escape: cancel (asks first with unsaved edits); Delete / Backspace: remove the selected point
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
            if ((e.ctrlKey || e.metaKey) && !typing && !confirmDiscard && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
                e.preventDefault()
                if (e.key.toLowerCase() === "y" || e.shiftKey) redo()
                else undo()
                return
            }
            if (e.key === "Escape") {
                if (confirmDiscard) return // the confirmation dialog closes itself (Radix)
                e.preventDefault()
                if (!saving) requestCancel()
            } else if ((e.key === "Delete" || e.key === "Backspace") && selectedVertex !== null && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault()
                deleteSelected()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })
    // leaving the page with unsaved edits asks first
    React.useEffect(() => {
        if (!dirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [dirty])

    const onMapLoad = React.useCallback((map: google.maps.Map) => {
        mapRef.current = map
        map.setMapTypeId("satellite") // as the detail map (the prop alone isn't applied at creation)
        frame(activeRef.current)
    }, [frame])

    if (!active || !edit) {
        return (
            <div data-boundary-editor="" className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
                No plot of this record can be edited.
                <Button variant="outline" data-boundary-cancel onClick={onCancel} className="ml-3 h-9 px-4 text-xs font-bold">Close</Button>
            </div>
        )
    }
    const activeTarget = active.mapPlot
    /** V2.1: the context plots that draw their outline: one per outline several deployments share (the API stores a copy
     *  per deployment), none under the outline being edited. Every plot keeps its marker. */
    const contextOutlineIds = (() => {
        const drawn = new Set<string>(edit && edit.mode === "edit" ? [outlineKey(edit.current)] : [])
        const ids = new Set<string>()
        for (const plot of plots) {
            if (plot.id === activeTarget.id) continue
            const e = edits[plot.id]
            const outline = e ? (e.mode === "edit" ? e.current : e.persisted) : openRing(plot.path)
            const key = outlineKey(outline)
            if (outline.length >= 3 && !drawn.has(key)) { drawn.add(key); ids.add(plot.id) }
        }
        return ids
    })()
    const editableIds = new Set(editable.map((e) => e.mapPlot.id))
    const toolButton = "h-8 px-2.5 gap-1.5 text-xs font-semibold"
    const activeProblem = problemOf(edit)
    const savedEarlier = editable.filter((e) => edits[e.mapPlot.id]?.saved).length
    const activeHistory = historyOf(activeTarget.id)
    const canUndo = activeHistory.past.length > 0 && !saving
    const canRedo = activeHistory.future.length > 0 && !saving
    /** What to do next, for this step (the panel's one line of guidance). */
    const guidance = saving ? "Saving…"
        : coveredBy[active.mapPlot.id]
            ? `Inside ${titleOf(coveredBy[active.mapPlot.id])}'s new outline: saved with it (one request), replacing this plot's old outline. Or draw an outline of its own.`
        : edit.mode === "draw"
            ? edit.draft.length === 0 ? "Click on the map to place the first point."
                : edit.draft.length < 3 ? `Place ${3 - edit.draft.length} more point${3 - edit.draft.length === 1 ? "" : "s"} — an outline needs at least 3.`
                    : "Click the first point or Finish shape to close the outline. Nothing is saved until Save all."
            : selectedVertex !== null
                ? edit.current.length <= 3 ? `Point ${selectedVertex + 1} selected. An outline needs at least 3 points, so it can't be deleted — drag it to move it.` : `Point ${selectedVertex + 1} selected — drag it to move it, or delete it.`
                : "Drag a point to move it, or a midpoint to add one. Click a point to select it."
    return (
        <TooltipProvider delayDuration={200}>
        <div data-boundary-editor={activeTarget.id} data-boundary-mode={edit.mode} data-boundary-dirty={dirty ? "" : undefined} data-boundary-modified={modifiedIds.length} data-boundary-shape={shape.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";")} data-boundary-selected-vertex={selectedVertex ?? undefined} className="relative flex flex-col w-full h-full bg-white dark:bg-zinc-950">
            {/* V2.1: one low toolbar — what is being edited, its save state, and the session's actions (always visible) */}
            <header data-boundary-toolbar className="shrink-0 flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="min-w-0 flex-1 flex items-center gap-2 text-left">
                    <h2 className="hidden sm:block shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Edit boundaries</h2>
                    <Separator orientation="vertical" className="hidden sm:block h-4 bg-zinc-200 dark:bg-zinc-800" />
                    <span data-boundary-active-title className="shrink-0 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{active.title}</span>
                    <span className="hidden sm:inline min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400" title={active.subtitle}>{active.subtitle}</span>
                </div>
                <Badge
                    variant="outline"
                    data-boundary-state={saving ? "saving" : dirty ? "unsaved" : "clean"}
                    className={cn(
                        "hidden lg:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full border shadow-none",
                        saving || !dirty ? "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400" : STATUS_BADGE_CLASS.Pending
                    )}
                >
                    {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving {saving.index + 1} of {saving.total}…</> : dirty ? `${modifiedIds.length} unsaved` : "No unsaved changes"}
                </Badge>
                <Button variant="ghost" data-boundary-reset onClick={() => resetPlot(activeTarget.id)} disabled={!!saving || !isModified(edit)} className="h-8 px-2.5 gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    <RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Reset plot</span>
                </Button>
                <Button variant="outline" data-boundary-cancel onClick={requestCancel} disabled={!!saving} className="h-8 px-3 text-xs font-semibold">Cancel</Button>
                <Button data-boundary-save onClick={saveAll} disabled={!canSaveAll} className="h-8 px-3 gap-1.5 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {result && result.failed.length > 0 && dirty ? `Retry (${modifiedIds.length})` : `Save all${modifiedIds.length ? ` (${modifiedIds.length})` : ""}`}
                </Button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                {/* V2.1: the workspace's one panel, docked beside the map (never over it): the active plot's drawing tools,
                    then the session's plots. Below lg it is a short strip above the map (plots in one scrolling row). */}
                <aside data-boundary-panel className="shrink-0 flex flex-col min-h-0 lg:w-60 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-left">
                    {/*
                      V2.1: the active plot's editing controls, in the order of the work — what step this is, what to do next (or
                      what's wrong), then the tools: Undo / Redo always first (one place in every step), the step's start-over
                      action apart from them, and the step's own primary action last, on its own line. Finishing a shape only
                      closes it here; Save all (the toolbar) is what writes.
                    */}
                    <section data-boundary-tools data-boundary-step={edit.mode} aria-label="Drawing tools" className="shrink-0 px-3 py-2 lg:py-3 space-y-1.5 lg:space-y-2 border-b border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{edit.mode === "draw" ? "Drawing outline" : "Editing outline"}</p>
                            <p data-boundary-area className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                                {shape.length >= 3 ? <>{shape.length} points · <span className="font-semibold text-zinc-900 dark:text-zinc-100">{acres.toFixed(3)} acres</span></> : `${shape.length} point${shape.length === 1 ? "" : "s"}`}
                            </p>
                        </div>
                        <p data-boundary-hint role="status" aria-live="polite" className="text-xs leading-5 text-zinc-500 dark:text-zinc-400 line-clamp-2 lg:line-clamp-none">{guidance}</p>
                        {edit.mode === "edit" && activeProblem && <p data-boundary-active-problem className="text-[11px] leading-4 font-semibold text-red-600 dark:text-red-400">{activeProblem}</p>}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <div role="group" aria-label="History" className="flex items-center gap-1">
                                <Button variant="outline" size="icon" data-boundary-undo aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} className="h-8 w-8"><Undo2 className="h-3.5 w-3.5" /></Button>
                                <Button variant="outline" size="icon" data-boundary-redo aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} className="h-8 w-8"><Redo2 className="h-3.5 w-3.5" /></Button>
                            </div>
                            <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-200 dark:bg-zinc-800" />
                            {edit.mode === "draw" ? (
                                <Button variant="ghost" data-boundary-clear onClick={clearDraft} disabled={edit.draft.length === 0 || !!saving} className={cn(toolButton, "text-zinc-600 dark:text-zinc-300")}><X className="h-3.5 w-3.5" />Clear points</Button>
                            ) : (
                                <Button variant="ghost" data-boundary-redraw onClick={redraw} disabled={!!saving} className={cn(toolButton, "text-zinc-600 dark:text-zinc-300")}><PencilRuler className="h-3.5 w-3.5" />Redraw outline</Button>
                            )}
                            {/* the step's primary action: its own line in the docked panel, the row's end below lg */}
                            {edit.mode === "draw" && (
                                <Button data-boundary-finish onClick={finishDrawing} disabled={edit.draft.length < 3 || !!saving} className={cn(toolButton, "ml-auto lg:ml-0 lg:basis-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900")}><Check className="h-3.5 w-3.5" />Finish shape</Button>
                            )}
                            {edit.mode === "edit" && selectedVertex !== null && (
                                <Button variant="outline" data-boundary-delete-point onClick={deleteSelected} disabled={edit.current.length <= 3 || !!saving} className={cn(toolButton, "ml-auto lg:ml-0 lg:basis-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30")}><Trash2 className="h-3.5 w-3.5" />Delete point {selectedVertex + 1}</Button>
                            )}
                        </div>
                    </section>

                    {/* the session's plots: switch, see what changed, reset one */}
                    <section data-boundary-plots aria-label="Plots in this session" className="min-h-0 flex items-center lg:items-stretch lg:flex-col lg:flex-1">
                        <p className="shrink-0 pl-3 pr-1 lg:px-3 lg:pt-2.5 lg:pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 select-none whitespace-nowrap">Plots · {editable.length}</p>
                        <ul className="min-w-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto px-2 py-1.5 lg:pt-0 lg:pb-2 lg:flex-1 lg:min-h-0">
                            {editable.map(({ mapPlot, title, plotId }) => {
                                const state = stateOf(mapPlot.id)
                                const e = edits[mapPlot.id]
                                const isActive = mapPlot.id === activeTarget.id
                                const problem = e && !coveredBy[mapPlot.id] ? problemOf(e) : null
                                return (
                                    <li key={mapPlot.id} data-boundary-plot={mapPlot.id} data-boundary-plot-state={state} data-active={isActive ? "" : undefined} className={cn("shrink-0 lg:shrink rounded-md", isActive ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                data-boundary-select={mapPlot.id}
                                                aria-current={isActive ? "true" : undefined}
                                                onClick={() => selectPlot(mapPlot.id)}
                                                disabled={!!saving}
                                                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-default"
                                            >
                                                <span className="min-w-0 flex flex-col">
                                                    <span className={cn("font-mono text-xs truncate text-zinc-900 dark:text-zinc-50", isActive ? "font-semibold" : "font-medium")}>{title}</span>
                                                    {plotId && <span data-boundary-plot-id={plotId} className="text-[11px] leading-4 truncate text-zinc-500 dark:text-zinc-400" title={`Plot ID ${plotId}`}>Plot {plotId}</span>}
                                                </span>
                                                {state === "unchanged" ? (
                                                    <span className="ml-auto shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">{STATE_LABEL[state]}</span>
                                                ) : (
                                                    <Badge variant="outline" className={cn("ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full shadow-none", STATE_CLASS[state])}>
                                                        {state === "saving" && <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />}
                                                        {state === "saved" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                                                        {STATE_LABEL[state]}
                                                    </Badge>
                                                )}
                                            </button>
                                            {e && isModified(e) && (
                                                <Button variant="ghost" size="icon" data-boundary-reset-plot={mapPlot.id} aria-label={`Reset ${title} to its saved boundary`} title="Reset to the saved boundary" onClick={() => resetPlot(mapPlot.id)} disabled={!!saving} className="h-7 w-7 shrink-0 text-zinc-500">
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        {(problem || (state === "failed" && e?.error)) && (
                                            <p data-boundary-problem className="px-2 pb-1.5 text-[11px] leading-4 text-red-600 dark:text-red-400 [overflow-wrap:anywhere] max-w-[16rem] lg:max-w-none">{state === "failed" ? e?.error : problem}</p>
                                        )}
                                        {(alsoSaves[mapPlot.id]?.length ?? 0) > 0 && (
                                            <p data-boundary-also-saves={alsoSaves[mapPlot.id].map((x) => x.title).join(",")} className="px-2 pb-1.5 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300 [overflow-wrap:anywhere] max-w-[16rem] lg:max-w-none">
                                                Also saves to: {alsoSaves[mapPlot.id].map((x) => `${x.title}${x.replaces ? " (replaces its outline)" : ""}`).join(", ")}
                                            </p>
                                        )}
                                        {coveredBy[mapPlot.id] && !(state === "failed" && e?.error) && (
                                            <p data-boundary-covered-by={coveredBy[mapPlot.id]} className="px-2 pb-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400 [overflow-wrap:anywhere] max-w-[16rem] lg:max-w-none">Inside {titleOf(coveredBy[mapPlot.id])}&apos;s outline — saved with it</p>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                </aside>

                <div data-boundary-map className="relative flex-1 min-h-0 min-w-0">
                    <GoogleMap
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        center={initialCamera.center}
                        zoom={initialCamera.zoom}
                        onLoad={onMapLoad}
                        mapTypeId="satellite"
                        options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true, disableDoubleClickZoom: edit.mode === "draw", draggableCursor: edit.mode === "draw" ? "crosshair" : undefined, clickableIcons: false }}
                        onClick={(e) => {
                            if (edit.mode === "edit") { setSelectedVertex(null); return } // a click off the outline clears the selection
                            if (!e.latLng || saving) return
                            const point = e.latLng.toJSON()
                            record(activeTarget.id)
                            update(activeTarget.id, (p) => ({ ...p, draft: [...p.draft, point], error: null }))
                        }}
                    >
                        {/* context: every other plot. Editable ones are clickable (switch to it); a modified one shows its edited outline in amber. */}
                        {plots.filter((p) => p.id !== activeTarget.id).map((plot) => {
                            const e = edits[plot.id]
                            // while drawing, a click places a point — switching then goes through the plot list only
                            const canSwitch = editableIds.has(plot.id) && !saving && edit.mode !== "draw"
                            const outline = e ? (e.mode === "edit" ? e.current : e.persisted) : openRing(plot.path)
                            const modified = !!e && isModified(e)
                            return (
                                <React.Fragment key={plot.id}>
                                    {outline.length >= 3 && contextOutlineIds.has(plot.id) && (
                                        <Polygon
                                            path={outline}
                                            onClick={canSwitch ? () => selectPlot(plot.id) : undefined}
                                            options={{ clickable: canSwitch, editable: false, fillColor: modified ? "#f59e0b" : "#ffffff", fillOpacity: modified ? 0.18 : 0.08, strokeColor: modified ? "#f59e0b" : "#ffffff", strokeOpacity: modified ? 0.95 : 0.45, strokeWeight: modified ? 2 : 1.5, zIndex: 1 }}
                                        />
                                    )}
                                    <Marker position={plot.location} clickable={canSwitch} onClick={canSwitch ? () => selectPlot(plot.id) : undefined} opacity={canSwitch ? 0.85 : 0.55} zIndex={1} icon={markerIcon(markerFill(plot), markerDiameter(plot), null)} />
                                </React.Fragment>
                            )
                        })}
                        {/* the plot being edited: the map's selection treatment (green outline, selected marker) */}
                        <Marker position={activeTarget.location} clickable={false} zIndex={20} icon={markerIcon(markerFill(activeTarget), markerDiameter(activeTarget), "selected")} />
                        {edit.mode === "edit" && mountPath.length >= 3 && (
                            <Polygon
                                key={`${activeTarget.id}:${polygonKey}`}
                                path={mountPath}
                                onLoad={(polygon) => { polygonRef.current = polygon; bind(polygon) }}
                                onUnmount={() => { polygonRef.current = null }}
                                options={{ editable: !saving, draggable: false, fillColor: activeProblem ? "#ef4444" : "#22c55e", fillOpacity: 0.22, strokeColor: activeProblem ? "#ef4444" : "#22c55e", strokeOpacity: 1, strokeWeight: 3, zIndex: 10 }}
                            />
                        )}
                        {edit.mode === "edit" && selectedVertex !== null && edit.current[selectedVertex] && (
                            <Marker position={edit.current[selectedVertex]} clickable={false} zIndex={40} icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 10, fillOpacity: 0, strokeColor: "#ffffff", strokeWeight: 3 }} />
                        )}
                        {edit.mode === "draw" && edit.draft.length > 0 && (
                            <>
                                <Polyline path={edit.draft} options={{ clickable: false, strokeColor: "#22c55e", strokeWeight: 3, zIndex: 10 }} />
                                {edit.draft.map((p, i) => (
                                    <Marker
                                        key={i}
                                        position={p}
                                        zIndex={30}
                                        clickable={i === 0 && edit.draft.length >= 3}
                                        onClick={i === 0 ? finishDrawing : undefined}
                                        icon={{ path: google.maps.SymbolPath.CIRCLE, scale: i === 0 ? 6 : 4, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#22c55e", strokeWeight: 2 }}
                                    />
                                ))}
                            </>
                        )}
                    </GoogleMap>

                    {result && result.failed.length > 0 && (
                        <Alert variant="destructive" role="alert" data-boundary-result data-saved={result.saved.length} data-failed={result.failed.length} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(32rem,calc(100%-1.5rem))] bg-white dark:bg-zinc-950 shadow-md text-left">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="text-sm font-bold">{result.saved.length > 0 ? `${result.saved.length} saved, ${result.failed.length} not saved` : `${result.failed.length === 1 ? "The boundary wasn't" : "The boundaries weren't"} saved`}</AlertTitle>
                            <AlertDescription className="text-xs space-y-2">
                                <p>Not saved: {result.failed.map((id) => editable.find((e) => e.mapPlot.id === id)?.title ?? id).join(", ")} — the list shows why. Their edits are kept: retry, or cancel to discard them.</p>
                                {result.saved.length > 0 && <p className="text-zinc-600 dark:text-zinc-400">Saved: {result.saved.map((id) => editable.find((e) => e.mapPlot.id === id)?.title ?? id).join(", ")}.</p>}
                                <Button variant="outline" data-boundary-retry onClick={saveAll} disabled={!canSaveAll} className="h-8 px-3 text-xs font-bold">Retry</Button>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>

            {/* the dialog's own overlay sits under this full-screen editor: dim the editor the same way while it asks */}
            {confirmDiscard && <div aria-hidden data-boundary-dim className="absolute inset-0 z-40 bg-black/30 animate-in fade-in-0" />}

            {/* unsaved edits: the detail's confirmation dialog (as Confirm approval) */}
            <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <DialogContent data-boundary-confirm className="max-w-[440px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg z-[560] rounded-xl [&>button]:hidden">
                    <div className="bg-white dark:bg-zinc-950 text-left">
                        <div className="p-6 pb-0 space-y-1">
                            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                Discard {modifiedIds.length === 1 ? "the unsaved boundary" : `${modifiedIds.length} unsaved boundaries`}?
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                {modifiedIds.length === 1 ? "The plot keeps its saved boundary." : "These plots keep their saved boundaries."} Your edits are not saved.
                                {savedEarlier > 0 ? ` ${savedEarlier} ${savedEarlier === 1 ? "plot" : "plots"} saved earlier in this session ${savedEarlier === 1 ? "stays" : "stay"} saved.` : ""}
                            </DialogDescription>
                        </div>
                        <div className="p-6 flex items-center justify-end gap-3">
                            <Button variant="outline" data-boundary-keep onClick={() => setConfirmDiscard(false)} className="h-9 px-4 text-xs font-bold" autoFocus>Keep editing</Button>
                            <Button data-boundary-discard onClick={onCancel} className="h-9 px-5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white">Discard</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    )
}
