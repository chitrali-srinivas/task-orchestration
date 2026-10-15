// Data / API Inspector — runtime trace: the requests a layout actually made (live HTTP, mock backend calls, intercepted
// test mutations), with their parameters, status, timing, response and errors. Generic and framework-neutral: a layout
// creates one trace (`createApiTrace`), records at its data layer, and shows it with <ApiActivity> (api-activity.tsx).
// DESIGN-TIME ONLY: the trace lives in memory for the page's lifetime; nothing is sent anywhere.
//
// Safety: request headers are never recorded (callers pass only method, path, params and body). Values are redacted on
// the way in — keys that name credentials (authorization, token, cookie, password, secret, api key) and values that look
// like a bearer token or a JWT — so a credential can't reach the Inspector even if a backend echoes one.
import * as React from "react"

/** Where an entry came from: a real HTTP call, the prototype's mock backend, or a test-mode capture that was not sent. */
export type TraceSource = "live" | "mock" | "intercepted"
export type TraceKind = "read" | "mutation"

export interface ApiTraceEntry {
    id: number
    /** Epoch ms when the call started. */
    at: number
    source: TraceSource
    kind: TraceKind
    method: string
    path: string
    /** A short name for the call ("getTrailerDetails", "Table page 2"). */
    label?: string
    /** Query-string parameters (GET). */
    params?: unknown
    /** The request body as sent. */
    request?: unknown
    /** HTTP status (live), or the mock's status; undefined while pending or when the call never reached a server. */
    status?: number
    state: "pending" | "ok" | "error"
    durationMs?: number
    /** The response body (live: as received, before any transformation). */
    response?: unknown
    error?: string
    /** Context the layout adds ("mock: the v4 request live mode would send"). */
    notes?: string[]
}

const SENSITIVE_KEY = /authorization|token|cookie|password|passwd|secret|api[_-]?key|session[_-]?id/i
/** Keys that carry a person's phone number (Matic ids for surveyors / verifiers are phone numbers). */
const PHONE_KEY = /phone|_no$|verifier_id|surveyor_registred_no|surveyor_no|reported_by$/i
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi
const JWT = /\beyJ[\w-]*\.[\w-]+\.[\w-]+/g

/** A phone-like value keeps its last 2 digits only ("••••••••45"), so entries stay matchable without showing the number. */
export function maskPhone(value: string): string {
    const digits = value.replace(/\D/g, "")
    if (digits.length < 7) return value
    return `${"•".repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`
}

/**
 * A display-safe deep copy: credential-named keys and token-shaped strings are replaced, phone-number keys are masked,
 * nothing else changes. Never applied to the data the UI uses — only to what the Inspector stores.
 */
export function redactCredentials(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[…]"
    if (typeof value === "string") return value.replace(BEARER, "Bearer [redacted]").replace(JWT, "[redacted token]")
    if (Array.isArray(value)) return value.map((item) => redactCredentials(item, depth + 1))
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {}
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_KEY.test(key) && item !== null && item !== undefined && item !== "") out[key] = "[redacted]"
            else if (PHONE_KEY.test(key) && (typeof item === "string" || typeof item === "number") && String(item).replace(/\D/g, "").length >= 7) out[key] = maskPhone(String(item))
            else out[key] = redactCredentials(item, depth + 1)
        }
        return out
    }
    return value
}

export interface ApiTrace {
    /** Starts an entry; call the returned `finish` once with the outcome. */
    start(entry: Omit<ApiTraceEntry, "id" | "at" | "state">): (outcome: { status?: number; response?: unknown; error?: string; notes?: string[] }) => void
    /** Records a completed call in one step (a mock call, a capture). */
    record(entry: Omit<ApiTraceEntry, "id" | "at" | "state"> & { state?: "ok" | "error"; at?: number }): void
    clear(): void
    subscribe(listener: () => void): () => void
    getSnapshot(): readonly ApiTraceEntry[]
}

/** One trace per layout. `limit`: the newest entries kept (older ones are dropped). */
export function createApiTrace(limit = 150): ApiTrace {
    let entries: readonly ApiTraceEntry[] = []
    let seq = 0
    const listeners = new Set<() => void>()
    const emit = () => listeners.forEach((listener) => listener())
    const put = (entry: ApiTraceEntry) => {
        entries = [...entries.filter((e) => e.id !== entry.id), entry].slice(-limit)
        emit()
    }
    const safe = <T extends object>(entry: T): T => ({
        ...entry,
        ...("params" in entry ? { params: redactCredentials((entry as { params?: unknown }).params) } : {}),
        ...("request" in entry ? { request: redactCredentials((entry as { request?: unknown }).request) } : {}),
        ...("response" in entry ? { response: redactCredentials((entry as { response?: unknown }).response) } : {}),
        ...("error" in entry && typeof (entry as { error?: unknown }).error === "string" ? { error: redactCredentials((entry as { error: string }).error) as string } : {}),
    })
    return {
        start(entry) {
            const started = performance.now()
            const base: ApiTraceEntry = safe({ ...entry, id: ++seq, at: Date.now(), state: "pending" })
            put(base)
            let done = false
            return (outcome) => {
                if (done) return
                done = true
                put(safe({
                    ...base,
                    ...outcome,
                    notes: [...(base.notes ?? []), ...(outcome.notes ?? [])],
                    state: outcome.error ? "error" : "ok",
                    durationMs: Math.round(performance.now() - started),
                }))
            }
        },
        record(entry) {
            put(safe({ ...entry, id: ++seq, at: entry.at ?? Date.now(), state: entry.state ?? (entry.error ? "error" : "ok") }))
        },
        clear() {
            entries = []
            emit()
        },
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        getSnapshot: () => entries,
    }
}

const NO_ENTRIES: readonly ApiTraceEntry[] = []

/** The trace's entries, re-rendering on each new / finished entry. */
export function useApiTrace(trace: ApiTrace): readonly ApiTraceEntry[] {
    return React.useSyncExternalStore(trace.subscribe, trace.getSnapshot, () => NO_ENTRIES)
}

// ── Field mapping: how an API object became what the UI shows ──────────────────────────────────────────────

/** How one UI value relates to the API: shown as received, renamed, computed, a default for a missing value, or absent. */
export type MappingKind = "direct" | "renamed" | "derived" | "defaulted" | "missing"

export interface FieldMapping {
    /** Where it shows in the UI (column, card field, count). */
    ui: string
    /** The API field(s) it comes from. */
    source: string
    raw: unknown
    shown: unknown
    kind: MappingKind
    note?: string
}

/** Shape changes between an API object and its normalised form, key by key (type coerced, defaulted, dropped, added). */
export interface ShapeChange { key: string; raw: unknown; normalised: unknown; change: "coerced" | "defaulted" | "dropped" | "added" }

export function describeShapeChanges(raw: unknown, normalised: unknown): ShapeChange[] {
    if (!raw || typeof raw !== "object" || !normalised || typeof normalised !== "object") return []
    const r = raw as Record<string, unknown>, n = normalised as Record<string, unknown>
    const changes: ShapeChange[] = []
    const isEmpty = (v: unknown) => v === undefined || v === null || v === ""
    for (const key of new Set([...Object.keys(r), ...Object.keys(n)])) {
        const a = r[key], b = n[key]
        if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === "object") || (b && typeof b === "object")) continue
        if (!(key in n)) changes.push({ key, raw: a, normalised: undefined, change: "dropped" })
        else if (!(key in r)) changes.push({ key, raw: undefined, normalised: b, change: "added" })
        else if (isEmpty(a) && !isEmpty(b)) changes.push({ key, raw: a, normalised: b, change: "defaulted" })
        else if (typeof a !== typeof b && !(isEmpty(a) && isEmpty(b))) changes.push({ key, raw: a, normalised: b, change: "coerced" })
    }
    return changes
}
