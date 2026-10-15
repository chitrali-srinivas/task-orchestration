// PROTOTYPE-ONLY — selects where Deployment V2 gets its data. The UI never reads this; only the data layer does.
//
//   NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE=mock   (default) in-memory mock backend (mock-backend.ts)
//   NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE=live   dev backend at NEXT_PUBLIC_MATI_API_BASE_URL (live-api.ts)
//
// Production (matic-dash) has no mode: it always uses the live API.
import { env } from "@/platform/env"

export type DeploymentDataMode = "mock" | "live"

export const deploymentDataMode: DeploymentDataMode = env.deploymentV2DataMode === "live" ? "live" : "mock"

export const isLiveMode = deploymentDataMode === "live"

/** The effective data source, as the page's mode badge and the Inspector state it (never a secret: the API host only). */
export interface DataSourceDescription {
    mode: DeploymentDataMode
    /** Live mode with an API base URL set; mock mode is always "configured". */
    configured: boolean
    /** The configured API host (live mode), or null. */
    apiHost: string | null
    /** Why this mode is in effect, in the user's terms. */
    reason: string
    /** What has to change for live data (mock mode / an unconfigured live mode); null when live is configured. */
    prerequisite: string | null
}

const LIVE_PREREQUISITE = "Live needs NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE=live and NEXT_PUBLIC_MATI_API_BASE_URL at build time (Next.js inlines NEXT_PUBLIC_* when `next dev` / `next build` starts): set them in .env.local and restart `next dev`, or pass them to `next build` and serve that build with `next start`. A dev token in localStorage changes nothing in a mock build."

export function describeDataSource(): DataSourceDescription {
    if (!isLiveMode) {
        const raw = env.deploymentV2DataMode
        return {
            mode: "mock",
            configured: true,
            apiHost: null,
            reason: raw === "" ? "NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE is not set, so the in-memory mock backend answers every call (the default)." : `NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE is "${raw}" (not "live"), so the in-memory mock backend answers every call.`,
            prerequisite: LIVE_PREREQUISITE,
        }
    }
    let apiHost: string | null = null
    try {
        apiHost = env.matiApiBaseUrl ? new URL(env.matiApiBaseUrl).host : null
    } catch {
        apiHost = null
    }
    if (!apiHost) {
        return { mode: "live", configured: false, apiHost: null, reason: "NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE is \"live\" but NEXT_PUBLIC_MATI_API_BASE_URL is not a valid URL: every call fails before it is sent.", prerequisite: LIVE_PREREQUISITE }
    }
    return { mode: "live", configured: true, apiHost, reason: `Real requests to ${apiHost} with the session's bearer token.`, prerequisite: null }
}

/**
 * TEST-ONLY: live build with NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS=1 captures workflow mutations instead of
 * sending them (mutation-intercept.ts). Read directly (not via @/platform/env): prototype validation only, never ported.
 */
export const isMutationInterceptMode = isLiveMode && process.env.NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS === "1"
