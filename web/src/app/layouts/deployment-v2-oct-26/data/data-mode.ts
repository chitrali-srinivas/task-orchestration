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

/**
 * TEST-ONLY: live build with NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS=1 captures workflow mutations instead of
 * sending them (mutation-intercept.ts). Read directly (not via @/platform/env): prototype validation only, never ported.
 */
export const isMutationInterceptMode = isLiveMode && process.env.NEXT_PUBLIC_DEPLOYMENT_V2_INTERCEPT_MUTATIONS === "1"
