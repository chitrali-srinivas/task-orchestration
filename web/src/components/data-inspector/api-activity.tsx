"use client"

// Data / API Inspector — runtime views: the API activity log of a trace (api-trace.ts) and the field-mapping tables
// that show how an API object became what the UI displays. Generic: a layout passes its trace / mappings and adds
// these as extra Inspector sections (DataInspector `sections`). DESIGN-TIME ONLY.
import * as React from "react"
import { ChevronRight, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Chip, InspectorCode, InspectorTable } from "./inspector-primitives"
import { useApiTrace, type ApiTrace, type ApiTraceEntry, type FieldMapping, type MappingKind, type ShapeChange, type TraceSource } from "./api-trace"

const SOURCE: Record<TraceSource, { label: string; title: string; className: string }> = {
    live: { label: "Live", title: "A real HTTP request to the API", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300" },
    mock: { label: "Mock", title: "Answered by the prototype's in-memory mock backend — no network request", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" },
    intercepted: { label: "Not sent", title: "Test mode: the mutation was captured instead of sent", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" },
}

const MAPPING: Record<MappingKind, { label: string; title: string; className: string }> = {
    direct: { label: "As received", title: "Shown exactly as the API sent it", className: "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300" },
    renamed: { label: "Renamed", title: "Same value under another name", className: "border-sky-200 text-sky-700 dark:border-sky-900/60 dark:text-sky-300" },
    derived: { label: "Derived", title: "Computed in the UI from one or more API fields", className: "border-violet-200 text-violet-700 dark:border-violet-900/60 dark:text-violet-300" },
    defaulted: { label: "Defaulted", title: "The API sent no value; the UI shows a default", className: "border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-300" },
    missing: { label: "Missing", title: "The API sent no value and nothing is shown", className: "border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-300" },
}

const pill = "text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full shadow-none whitespace-nowrap"

export function TraceSourceBadge({ source }: { source: TraceSource }) {
    const s = SOURCE[source]
    return <Badge variant="outline" data-trace-source-badge={source} title={s.title} className={cn(pill, s.className)}>{s.label}</Badge>
}

export function MappingBadge({ kind }: { kind: MappingKind }) {
    const m = MAPPING[kind]
    return <Badge variant="outline" data-mapping-kind={kind} title={m.title} className={cn(pill, "bg-transparent", m.className)}>{m.label}</Badge>
}

/** Readable JSON for any value (dates as ISO, undefined dropped, cycles cut). Never truncated. */
export function toJson(value: unknown): string {
    const seen = new WeakSet<object>()
    try {
        return JSON.stringify(value, (_key, v) => {
            if (v instanceof Date) return v.toISOString()
            if (v && typeof v === "object") {
                if (seen.has(v)) return "[circular]"
                seen.add(v)
            }
            return v
        }, 2) ?? String(value)
    } catch {
        return String(value)
    }
}

/** A value in a mapping cell: short JSON, "—" for nothing. */
export function ValueCell({ value }: { value: unknown }) {
    if (value === undefined) return <span className="text-zinc-400">—</span>
    const text = typeof value === "string" ? JSON.stringify(value) : toJson(value)
    return <span className="font-mono text-[11px] [overflow-wrap:anywhere]">{text.length > 160 ? `${text.slice(0, 160)}…` : text}</span>
}

const time = (ms: number) => {
    const d = new Date(ms)
    const pad = (n: number, w = 2) => String(n).padStart(w, "0")
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}
const bytes = (value: unknown) => {
    const n = toJson(value).length
    return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`
}

type ActivityFilter = "all" | "read" | "mutation" | "error"

function EntryDetails({ entry }: { entry: ApiTraceEntry }) {
    const parts: { title: string; value: unknown }[] = []
    if (entry.params !== undefined) parts.push({ title: "Query parameters", value: entry.params })
    if (entry.request !== undefined) parts.push({ title: "Request body", value: entry.request })
    if (entry.response !== undefined) parts.push({ title: `Response body · ${bytes(entry.response)}`, value: entry.response })
    return (
        <div data-trace-details className="space-y-3 px-3 pb-3 pt-1">
            {entry.error && (
                <div data-trace-error className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.error}</div>
            )}
            {entry.notes && entry.notes.length > 0 && (
                <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4">
                    {entry.notes.map((note, i) => <li key={i}>{note}</li>)}
                </ul>
            )}
            {parts.map((part) => (
                <div key={part.title} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{part.title}</p>
                    <InspectorCode className="max-h-80 overflow-auto">{toJson(part.value)}</InspectorCode>
                </div>
            ))}
            {parts.length === 0 && !entry.error && <p className="text-xs text-zinc-500">No parameters, body or response recorded.</p>}
        </div>
    )
}

function EntryRow({ entry, defaultOpen }: { entry: ApiTraceEntry; defaultOpen: boolean }) {
    const [open, setOpen] = React.useState(defaultOpen)
    return (
        <li
            data-trace-entry={entry.id}
            data-trace-source={entry.source}
            data-trace-kind={entry.kind}
            data-trace-state={entry.state}
            data-trace-path={entry.path}
            className={cn("rounded-lg border bg-white dark:bg-zinc-950", entry.state === "error" ? "border-red-200 dark:border-red-900/60" : "border-zinc-200 dark:border-zinc-800")}
        >
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-lg"
            >
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform", open && "rotate-90")} />
                <span className="font-mono text-[10px] text-zinc-400 tabular-nums">{time(entry.at)}</span>
                <TraceSourceBadge source={entry.source} />
                <Chip mono>{entry.method}</Chip>
                <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere] min-w-0">{entry.path}</span>
                {entry.label && <span className="text-[11px] text-zinc-500">{entry.label}</span>}
                <span className="ml-auto flex items-center gap-2 text-[11px] tabular-nums">
                    {entry.state === "pending" ? (
                        <span className="flex items-center gap-1 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" />pending</span>
                    ) : (
                        <span data-trace-status className={cn("font-semibold", entry.state === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                            {entry.status !== undefined ? `HTTP ${entry.status}` : entry.state === "error" ? "failed" : "ok"}
                        </span>
                    )}
                    {entry.durationMs !== undefined && <span className="text-zinc-400">{entry.durationMs} ms</span>}
                </span>
            </button>
            {open && <EntryDetails entry={entry} />}
        </li>
    )
}

/** The trace as a newest-first log with filters; each entry expands to its parameters, request, response and error. */
export function ApiActivity({ trace, emptyHint }: { trace: ApiTrace; emptyHint?: string }) {
    const entries = useApiTrace(trace)
    const [filter, setFilter] = React.useState<ActivityFilter>("all")
    const counts = {
        all: entries.length,
        read: entries.filter((e) => e.kind === "read").length,
        mutation: entries.filter((e) => e.kind === "mutation").length,
        error: entries.filter((e) => e.state === "error").length,
    }
    const shown = [...entries].reverse().filter((e) => filter === "all" || (filter === "error" ? e.state === "error" : e.kind === filter))
    const labels: Record<ActivityFilter, string> = { all: "All", read: "Reads", mutation: "Mutations", error: "Errors" }
    return (
        <div data-api-activity className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(labels) as ActivityFilter[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        data-activity-filter={key}
                        aria-pressed={filter === key}
                        onClick={() => setFilter(key)}
                        className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            filter === key ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        )}
                    >
                        {labels[key]} <span className="tabular-nums opacity-70">{counts[key]}</span>
                    </button>
                ))}
                <Button variant="ghost" size="sm" data-activity-clear onClick={() => trace.clear()} disabled={entries.length === 0} className="ml-auto h-7 gap-1.5 text-[11px] font-semibold text-zinc-500">
                    <Trash2 className="h-3.5 w-3.5" />Clear log
                </Button>
            </div>
            {shown.length === 0 ? (
                <p data-activity-empty className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-xs text-zinc-500">
                    {entries.length === 0 ? emptyHint ?? "No API activity yet." : "No entries match this filter."}
                </p>
            ) : (
                <ul className="space-y-2">
                    {shown.map((entry, i) => <EntryRow key={entry.id} entry={entry} defaultOpen={i === 0 && entry.state === "error"} />)}
                </ul>
            )}
        </div>
    )
}

/** UI value ← API field, with how it got there. */
export function FieldMappingTable({ rows, ...rest }: { rows: FieldMapping[] } & Record<`data-${string}`, string>) {
    return (
        <InspectorTable
            {...rest}
            columns={["Shown in the UI", "API field", "Received", "Shown", "Mapping"]}
            rows={rows.map((r) => [
                <span key="ui" className="font-semibold">{r.ui}</span>,
                <span key="src" className="font-mono text-[11px]">{r.source}</span>,
                <ValueCell key="raw" value={r.raw} />,
                <ValueCell key="shown" value={r.shown} />,
                <span key="kind" className="space-y-1 block"><MappingBadge kind={r.kind} />{r.note && <span className="block text-[11px] text-zinc-500">{r.note}</span>}</span>,
            ])}
        />
    )
}

/** Key-level differences between an API object and its normalised form. */
export function ShapeChangesTable({ changes, ...rest }: { changes: ShapeChange[] } & Record<`data-${string}`, string>) {
    if (changes.length === 0) return <p className="text-xs text-zinc-500" {...rest}>No key changes: the normalised object has the API&apos;s keys and value types.</p>
    return (
        <InspectorTable
            {...rest}
            columns={["Key", "Received", "Normalised", "Change"]}
            rows={changes.map((c) => [
                <span key="k" className="font-mono text-[11px]">{c.key}</span>,
                <ValueCell key="r" value={c.raw} />,
                <ValueCell key="n" value={c.normalised} />,
                <Chip key="c">{c.change}</Chip>,
            ])}
        />
    )
}
