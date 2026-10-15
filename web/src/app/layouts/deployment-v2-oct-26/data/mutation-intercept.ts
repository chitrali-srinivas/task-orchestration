// TEST-ONLY — mutation interception for validating live-mode workflows without changing shared dev data.
// Enabled only by a live build with NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS=1 (data-mode.ts). Normal mock and
// live builds never reach this code path.
//
// In intercept mode (enforced in api-client.ts before `fetch`):
//   - GET and the read-only POST endpoints below go to the dev API as usual;
//   - the workflow mutations are captured (method, path, exact body) and answered locally with HTTP 200;
//   - any other POST / PATCH / DELETE is refused loudly and never sent.
// Captures: window.__DEPLOYMENT_V2_INTERCEPTED__ and console "[deployment-v2] INTERCEPTED (not sent)". Request
// headers / tokens are never part of a capture.
// One-shot simulated failures for error-path tests: push "METHOD /path" onto window.__DEPLOYMENT_V2_INTERCEPT_FAIL__.

/** POST endpoints that only read (safe to send). */
export const READ_ONLY_POST_PATHS = new Set([
    "/adminFarmApp/v4/getDeploymentMetadata",
    "/adminFarmApp/v4/getDeploymentStatusCounts",
    "/adminDeploymentSec/v3/getTrailerDetails",
    "/adminFarmApp/v3/getDeploymentNocDetails",
    "/adminDeploymentSec/v3/getFarmerReportedHistory",
    "/api/v1/auth/bootstrap",
])

/** Workflow mutations that are captured instead of sent. */
export const INTERCEPTED_MUTATIONS = new Set([
    "PATCH /adminFarmApp/v3/updateDeploymentTrailerDispatch",
    "POST /adminDeploymentSec/v3/reportFarmerDetails",
    "PATCH /adminDeploymentSec/updateFarmerDeploymentNOC",
    "PATCH /adminDeploymentSec/v3/comment",
    "PATCH /adminDeploymentSec/v3/softDeleteDispatch",
    "POST /adminDeploymentSec/uploadGeoJsonData",
])

export interface InterceptedMutation {
    seq: number
    method: string
    path: string
    body: unknown
    at: number
}

type InterceptHost = typeof globalThis & {
    __DEPLOYMENT_V2_INTERCEPTED__?: InterceptedMutation[]
    __DEPLOYMENT_V2_INTERCEPT_FAIL__?: string[]
}

/** True when the request would change backend data (anything but GET and the read-only POSTs). */
export function isMutationRequest(method: string, path: string): boolean {
    return method !== "GET" && !(method === "POST" && READ_ONLY_POST_PATHS.has(path))
}

/**
 * Captures a mutation. Returns the simulated HTTP status (200), or throws for a refused endpoint or a queued
 * simulated failure. Never performs network I/O.
 */
export async function interceptMutation(method: string, path: string, body: unknown): Promise<{ status: number; body: unknown }> {
    const key = `${method} ${path}`
    const host = globalThis as InterceptHost
    if (!INTERCEPTED_MUTATIONS.has(key)) {
        console.error(`[deployment-v2] BLOCKED (not sent): ${key} is not an allow-listed mutation in intercept mode`)
        throw new Error(`Intercept mode: ${key} is not an allow-listed mutation and was blocked (not sent).`)
    }
    const log = (host.__DEPLOYMENT_V2_INTERCEPTED__ ??= [])
    const entry: InterceptedMutation = { seq: log.length + 1, method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)), at: Date.now() }
    log.push(entry)
    await new Promise((resolve) => setTimeout(resolve, 250))
    const failures = host.__DEPLOYMENT_V2_INTERCEPT_FAIL__ ?? []
    const failAt = failures.indexOf(key)
    if (failAt >= 0) {
        failures.splice(failAt, 1)
        console.warn(`[deployment-v2] INTERCEPTED (not sent) #${entry.seq} ${key} → simulated failure`, entry.body)
        throw new Error(`${key} failed (simulated, intercept mode).`)
    }
    console.warn(`[deployment-v2] INTERCEPTED (not sent) #${entry.seq} ${key}`, entry.body)
    return { status: 200, body: { status_code: 200, message: "Intercepted — not sent", data: [] } }
}
