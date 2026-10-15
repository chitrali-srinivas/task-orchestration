// PROTOTYPE-ONLY — minimal authenticated client for the Matic admin dev API (live mode only).
// Production: replaced by matic-dash's `localApi` (src/services/api.ts), which adds the Firebase ID token of the
// signed-in user and refreshes it once on 401 / `code: "invalid_token"`.
//
// Auth (auth-source.ts): the app's own Firebase session first (the production mechanism — valid for the Matic API
// only when mati-demo's NEXT_PUBLIC_FIREBASE_* name matic-dash's Firebase project), refreshed once on 401 /
// invalid_token; else the dev token in this browser's localStorage key `mati_dev_auth_token` (a matic-dash dev
// session's `localStorage.authToken`, copied by hand — never stored in the repo, never read by tooling); else the call
// is refused before any request. The token source (never the token) is noted on every Inspector trace entry.
import { env } from "@/platform/env"
import { isMutationInterceptMode } from "./data-mode"
import { interceptMutation, isMutationRequest } from "./mutation-intercept"
import { deploymentTrace, describeRequest, traceKind } from "./api-trace"
import { AUTH_SOURCE_LABEL, DEV_AUTH_TOKEN_STORAGE_KEY, pageOrigin, resolveAuthToken, type AuthSource } from "./auth-source"

export { DEV_AUTH_TOKEN_STORAGE_KEY }

export class ApiError extends Error {
    constructor(
        message: string,
        /** HTTP status, or 0 when the request never reached the server. */
        readonly status: number,
        readonly endpoint: string,
        readonly body?: unknown,
        /** V2.1: the server's own reason (the one in `message`), in full; null when its body says nothing readable. */
        readonly reason: string | null = null,
        /**
         * V2.1: everything readable the server said, in full — its messages and the diagnostic fields it sent (e.g. a
         * database error's table / column / constraint). Never inferred. null when it said nothing readable.
         */
        readonly details: string | null = null
    ) {
        super(message)
        this.name = "ApiError"
    }
}

export interface ApiResponse<T> {
    /** HTTP status (matic-dash mutations check `status == 200`). */
    status: number
    body: T
}

// ── V2.1: the server's reason, whatever the body's shape (post-migration audit P4) ─────────────────────────────

/** Credential-shaped text (a bearer token, a JWT) is never shown, even if a server echoes one back. */
const redactCredentials = (text: string) =>
    text.replace(/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]").replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, "[redacted token]")

/** Server text as shown: tags dropped, whitespace collapsed (line breaks kept with `keepLines`), credentials redacted. Never shortened. */
function readableText(text: string, keepLines = false): string {
    const plain = text.replace(/<[^>]*>/g, " ")
    const collapsed = keepLines
        ? plain.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n")
        : plain.replace(/\s+/g, " ").trim()
    return redactCredentials(collapsed)
}

/** The body keys that may carry the server's reason, in the order they're read. */
const MESSAGE_KEYS = ["message", "msg", "error", "errors", "detail", "details", "data"] as const
/** Diagnostic fields a database error may carry (node-postgres). Shown as the server sends them, never inferred. */
const DIAGNOSTIC_KEYS = ["code", "schema", "table", "column", "dataType", "constraint", "hint"] as const

/** A validation entry `{ param | path | field | key, msg | message }` → "<field>: <message>"; null for anything else. */
function validationEntry(b: Record<string, unknown>): string | null {
    const field = [b.param, b.path, b.field, b.key].find((v): v is string => typeof v === "string" && v.trim() !== "")
    const entry = [b.msg, b.message].find((v): v is string => typeof v === "string" && v.trim() !== "")
    return field && entry ? readableText(`${field}: ${entry}`) : null
}

/** The server's reason: the first readable message (a string, a list, a nested object or plain text). In full. */
function bodyMessage(body: unknown, depth = 0): string | null {
    if (depth > 3 || body === null || body === undefined) return null
    if (typeof body === "string") return readableText(body) || null
    if (Array.isArray(body)) {
        const parts = body.map((item) => bodyMessage(item, depth + 1)).filter((part): part is string => !!part)
        return parts.length ? [...new Set(parts)].join("; ") : null
    }
    if (typeof body !== "object") return null
    const b = body as Record<string, unknown>
    const entry = validationEntry(b)
    if (entry) return entry
    for (const key of MESSAGE_KEYS) {
        const reason = bodyMessage(b[key], depth + 1)
        if (reason) return reason
    }
    return null
}

/** Everything readable in an error body — every distinct message, then the diagnostic fields present, one per line. In full. */
function bodyDetails(body: unknown): string | null {
    const lines = new Set<string>()
    const collect = (value: unknown, depth: number) => {
        if (depth > 3 || value === null || value === undefined) return
        if (typeof value === "string") {
            const text = readableText(value, true)
            if (text) lines.add(text)
            return
        }
        if (Array.isArray(value)) {
            value.forEach((item) => collect(item, depth + 1))
            return
        }
        if (typeof value !== "object") return
        const b = value as Record<string, unknown>
        const entry = validationEntry(b)
        if (entry) lines.add(entry)
        for (const key of MESSAGE_KEYS) if (!entry || (key !== "message" && key !== "msg")) collect(b[key], depth + 1)
        for (const key of DIAGNOSTIC_KEYS) {
            const field = b[key]
            if ((typeof field === "string" && field.trim() !== "") || typeof field === "number") lines.add(`${key}: ${redactCredentials(String(field).trim())}`)
        }
    }
    collect(body, 0)
    return lines.size ? [...lines].join("\n") : null
}

/**
 * V2.1: the ApiError a non-2xx response becomes — the reason from any body (JSON or plain text), in full; the details
 * keep everything readable it said. The mock's simulated failures are built the same way (mock-backend.ts).
 */
export function apiErrorFromResponse(endpoint: string, status: number, statusText: string, body: unknown): ApiError {
    const serverReason = bodyMessage(body)
    const reason = serverReason ?? statusText
    const hint = status === 401 ? " The dev auth token is invalid or expired." : ""
    return new ApiError(`${endpoint} failed (HTTP ${status}): ${reason}.${hint}`, status, endpoint, body, serverReason, bodyDetails(body))
}

/** The dev API answers some auth failures with HTTP 200 and `{success:false, msg}` (e.g. no token). */
function isAuthFailureBody(body: unknown): boolean {
    if (!body || typeof body !== "object") return false
    const b = body as Record<string, unknown>
    return b.success === false || b.code === "invalid_token"
}

type RequestOptions = { body?: unknown; params?: Record<string, string | number>; signal?: AbortSignal }

/**
 * V2.1: every request is recorded in the Data / API Inspector trace (api-trace.ts): method, path, query, body, status,
 * timing, the response as received, or the error. Headers and the token are never passed to the trace.
 */
async function request<T>(method: "GET" | "POST" | "PATCH", path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const intercepted = isMutationInterceptMode && isMutationRequest(method, path)
    const finish = deploymentTrace.start({
        source: intercepted ? "intercepted" : "live",
        kind: traceKind(method, path),
        method,
        path,
        label: describeRequest(method, path, options.body),
        params: options.params,
        request: options.body,
        notes: intercepted ? ["Test mode: captured, not sent (mutation-intercept.ts)."] : undefined,
    })
    const auth: { source: AuthSource | null } = { source: null }
    const authNote = () => (auth.source ? [`auth: ${AUTH_SOURCE_LABEL[auth.source]}`] : undefined)
    try {
        const response = await send<T>(method, path, options, auth)
        finish({ status: response.status, response: response.body, notes: authNote() })
        return response
    } catch (error) {
        if ((error as Error)?.name === "AbortError") finish({ error: "Cancelled: a newer request replaced it (AbortController).", notes: authNote() })
        else if (error instanceof ApiError) finish({ status: error.status || undefined, response: error.body, error: error.message, notes: authNote() })
        else finish({ error: (error as Error)?.message ?? String(error), notes: authNote() })
        throw error
    }
}

/** The dev API's auth rejections: HTTP 401, or HTTP 200 with `{ success: false }` / `code: "invalid_token"`. */
const isAuthRejection = (status: number, body: unknown) => status === 401 || isAuthFailureBody(body)

async function send<T>(method: "GET" | "POST" | "PATCH", path: string, options: RequestOptions, auth: { source: AuthSource | null }): Promise<ApiResponse<T>> {
    const endpoint = `${method} ${path}`
    // TEST-ONLY intercept mode: mutations never reach fetch (captured, or refused if not allow-listed).
    if (isMutationInterceptMode && isMutationRequest(method, path)) {
        return (await interceptMutation(method, path, options.body)) as ApiResponse<T>
    }
    if (!env.matiApiBaseUrl) {
        throw new ApiError("Live mode: NEXT_PUBLIC_MATI_API_BASE_URL is not set.", 0, endpoint)
    }
    const url = new URL(path, env.matiApiBaseUrl)
    for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, String(value))

    // One attempt, then — as matic-dash does — one retry with a re-minted Firebase token when the API rejected the session.
    for (let attempt = 0; attempt < 2; attempt++) {
        const resolved = await resolveAuthToken(attempt === 1)
        auth.source = resolved.source
        if (!resolved.token) {
            const origin = pageOrigin()
            throw new ApiError(
                `Live mode: no session${origin ? ` in ${origin}` : ""}. Sign in to this app (its Firebase project must be the Matic API's) or set localStorage "${DEV_AUTH_TOKEN_STORAGE_KEY}" to a matic-dash dev session token${origin ? ` in this origin (${origin} — a token stored on another port or host is not visible here)` : ""}. Nothing was sent.`,
                401,
                endpoint
            )
        }
        let response: Response
        try {
            response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.token}` },
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                signal: options.signal,
            })
        } catch (error) {
            if ((error as Error)?.name === "AbortError") throw error
            throw new ApiError(`${endpoint} failed: ${(error as Error)?.message ?? "network error"}`, 0, endpoint)
        }

        // The server may echo the bearer token in an auth error ("Wrong number of segments in token: …"): it is scrubbed
        // from the response text before anything (the error, the Inspector) can carry it.
        const text = (await response.text()).split(resolved.token).join("[redacted token]")
        let body: unknown = null
        let json = true
        try {
            body = text ? JSON.parse(text) : null
        } catch {
            body = text
            json = false
        }

        // A rejected Firebase token is refreshed once (the dev token can't be: its session isn't this app's).
        if (attempt === 0 && resolved.source === "firebase-session" && isAuthRejection(response.status, body)) continue

        if (!response.ok) throw apiErrorFromResponse(endpoint, response.status, response.statusText, body)
        if (!json) {
            throw new ApiError(`${endpoint} returned a non-JSON response (HTTP ${response.status}).`, response.status, endpoint, text, null, readableText(text, true) || null)
        }
        if (isAuthFailureBody(body)) {
            throw new ApiError(`${endpoint} rejected the request: ${bodyMessage(body) ?? "auth failure"} (${AUTH_SOURCE_LABEL[resolved.source]}).`, 401, endpoint, body)
        }
        return { status: response.status, body: body as T }
    }
    throw new ApiError(`${endpoint} failed: the session was rejected twice.`, 401, endpoint)
}

export const matiApi = {
    get: <T>(path: string, params?: Record<string, string | number>, signal?: AbortSignal) => request<T>("GET", path, { params, signal }),
    post: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("POST", path, { body, signal }),
    patch: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("PATCH", path, { body, signal }),
}
