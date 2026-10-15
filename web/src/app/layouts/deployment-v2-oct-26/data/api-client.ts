// PROTOTYPE-ONLY — minimal authenticated client for the Matic admin dev API (live mode only).
// Production: replaced by matic-dash's `localApi` (src/services/api.ts), which adds the Firebase ID token of the
// signed-in user and refreshes it once on 401 / `code: "invalid_token"`.
//
// Auth (dev only): mati-demo has no Matic login, so the Firebase ID token of a matic-dash dev session is read from
// this browser's localStorage key `mati_dev_auth_token` (copy `localStorage.authToken` from a signed-in matic-dash
// dev tab). It is never stored in the repo. Firebase ID tokens expire after ~1 hour and cannot be refreshed here.
import { env } from "@/platform/env"
import { isMutationInterceptMode } from "./data-mode"
import { interceptMutation, isMutationRequest } from "./mutation-intercept"

export const DEV_AUTH_TOKEN_STORAGE_KEY = "mati_dev_auth_token"

export class ApiError extends Error {
    constructor(
        message: string,
        /** HTTP status, or 0 when the request never reached the server. */
        readonly status: number,
        readonly endpoint: string,
        readonly body?: unknown
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

function readDevToken(): string | null {
    try {
        return window.localStorage.getItem(DEV_AUTH_TOKEN_STORAGE_KEY)?.trim() || null
    } catch {
        return null
    }
}

function bodyMessage(body: unknown): string | null {
    if (!body || typeof body !== "object") return null
    const b = body as Record<string, unknown>
    const message = b.message ?? b.msg
    return typeof message === "string" ? message : null
}

/** The dev API answers some auth failures with HTTP 200 and `{success:false, msg}` (e.g. no token). */
function isAuthFailureBody(body: unknown): boolean {
    if (!body || typeof body !== "object") return false
    const b = body as Record<string, unknown>
    return b.success === false || b.code === "invalid_token"
}

async function request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    options: { body?: unknown; params?: Record<string, string | number>; signal?: AbortSignal } = {}
): Promise<ApiResponse<T>> {
    const endpoint = `${method} ${path}`
    // TEST-ONLY intercept mode: mutations never reach fetch (captured, or refused if not allow-listed).
    if (isMutationInterceptMode && isMutationRequest(method, path)) {
        return (await interceptMutation(method, path, options.body)) as ApiResponse<T>
    }
    if (!env.matiApiBaseUrl) {
        throw new ApiError("Live mode: NEXT_PUBLIC_MATI_API_BASE_URL is not set.", 0, endpoint)
    }
    const token = readDevToken()
    if (!token) {
        throw new ApiError(
            `Live mode: no dev auth token. Set localStorage "${DEV_AUTH_TOKEN_STORAGE_KEY}" to a matic-dash dev Firebase ID token.`,
            401,
            endpoint
        )
    }

    const url = new URL(path, env.matiApiBaseUrl)
    for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, String(value))

    let response: Response
    try {
        response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: options.signal,
        })
    } catch (error) {
        if ((error as Error)?.name === "AbortError") throw error
        throw new ApiError(`${endpoint} failed: ${(error as Error)?.message ?? "network error"}`, 0, endpoint)
    }

    const text = await response.text()
    let body: unknown = null
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        throw new ApiError(`${endpoint} returned a non-JSON response (HTTP ${response.status}).`, response.status, endpoint, text)
    }

    if (!response.ok) {
        const reason = bodyMessage(body) ?? response.statusText
        const hint = response.status === 401 ? " The dev auth token is invalid or expired." : ""
        throw new ApiError(`${endpoint} failed (HTTP ${response.status}): ${reason}.${hint}`, response.status, endpoint, body)
    }
    if (isAuthFailureBody(body)) {
        throw new ApiError(`${endpoint} rejected the request: ${bodyMessage(body) ?? "auth failure"}.`, 401, endpoint, body)
    }
    return { status: response.status, body: body as T }
}

export const matiApi = {
    get: <T>(path: string, params?: Record<string, string | number>, signal?: AbortSignal) => request<T>("GET", path, { params, signal }),
    post: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("POST", path, { body, signal }),
    patch: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("PATCH", path, { body, signal }),
}
