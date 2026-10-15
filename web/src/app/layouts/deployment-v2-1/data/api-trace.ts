// V2.1: DESIGN-TIME — this layout's Data / API Inspector trace (src/components/data-inspector/api-trace.ts).
// What records into it:
//   live         api-client.ts — every HTTP request: method, path, query, body, status, timing, response / error;
//   intercepted  api-client.ts — test-mode mutations captured instead of sent (mutation-intercept.ts);
//   mock         traceMockApi below (detail reads and mutations answered by mock-backend.ts) and data-source.ts (the
//                table page the mock answered, with the v4 request live mode would send for the same query).
// Never recorded: request headers, the dev auth token, cookies (the client passes none of them here).
import { createApiTrace, type TraceKind } from "@/components/data-inspector/api-trace"
import { isMutationRequest } from "./mutation-intercept"
import { DEPLOYMENT_ENDPOINTS } from "./live-api"
import type { DeploymentApi } from "./deployment-api"

export const deploymentTrace = createApiTrace(200)

export const traceKind = (method: string, path: string): TraceKind => (isMutationRequest(method, path) ? "mutation" : "read")

/**
 * V2.1: a short label naming WHAT a request concerns, from its body — the farmer / round / AZ of a dispatch read, the
 * dispatch of an approve / report, the plot of a boundary save — so the Inspector's entries can be matched to list rows
 * and stale reads diagnosed. Ids only (never names or phones).
 */
export function describeRequest(method: string, path: string, body: unknown): string | undefined {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
    const first = (value: unknown) => (Array.isArray(value) ? value[0] : undefined) as Record<string, unknown> | undefined
    if (path === DEPLOYMENT_ENDPOINTS.trailerDetails) {
        const t = first(b.trailerDetails)
        if (!t) return "Dispatches"
        return `Dispatches · farmer ${t.farmer_id} · round ${t.deployment_num} · AZ ${Array.isArray(t.az_id) ? t.az_id.join("/") : "?"}${t.status ? ` · ${t.status}` : " · all statuses"}`
    }
    if (path === DEPLOYMENT_ENDPOINTS.metadata) {
        const farmers = Array.isArray(b.farmer_ids) ? (b.farmer_ids as unknown[]) : []
        return farmers.length === 1 ? `Farmer rows · farmer ${farmers[0]} · ${b.status ?? "all"}` : `List rows · page ${b.page ?? "?"} · ${b.status ?? "all"}`
    }
    if (path === DEPLOYMENT_ENDPOINTS.counts) return "Status counts"
    if (path === DEPLOYMENT_ENDPOINTS.nocDetails) return `NOC · farmer ${b.farmer_id} · round ${b.deployment_num} · AZ ${Array.isArray(b.az_ids) ? b.az_ids.join("/") : "?"}`
    if (path === DEPLOYMENT_ENDPOINTS.reportHistory) return `History · farmer ${b.farmer_id} · round ${b.deployment_num}${b.az_id !== undefined ? ` · AZ ${b.az_id}` : ""}`
    if (path === DEPLOYMENT_ENDPOINTS.updateDispatch) {
        const entries = Array.isArray(b.deployment_trailer_dispatch_data) ? (b.deployment_trailer_dispatch_data as Record<string, unknown>[]) : []
        const ids = [...new Set(entries.map((e) => e.deployment_detail_id))]
        const status = entries[0]?.franchise_status
        return `${status === "approved" ? "Approve" : status === "rejected" ? "Reject (report)" : "Update"} dispatch ${ids.join(", ") || "?"}`
    }
    if (path === DEPLOYMENT_ENDPOINTS.reportFarmerDetails) {
        const entries = Array.isArray(b.reportData) ? (b.reportData as Record<string, unknown>[]) : []
        const ids = [...new Set(entries.map((e) => e.repeater_form_id))]
        return `Report · ${entries.length} field${entries.length === 1 ? "" : "s"} · dispatch ${ids.join(", ") || "?"}`
    }
    if (path === DEPLOYMENT_ENDPOINTS.nocDecision) return `NOC ${b.status} · farmer ${b.farmer_id} · AZ ${b.az_id}`
    if (path === DEPLOYMENT_ENDPOINTS.comment) return `Comment · plot deployment ${b.id}`
    if (path === DEPLOYMENT_ENDPOINTS.softDelete) return b.deletedBy === "Dispatch" ? `Delete dispatch ${b.dispatch_id}` : `Delete plot deployment ${Array.isArray(b.deployment_ids) ? b.deployment_ids.join(", ") : "?"}`
    if (path === DEPLOYMENT_ENDPOINTS.uploadGeoJson) {
        const entries = Array.isArray(b.geoJsonData) ? (b.geoJsonData as Record<string, unknown>[]) : []
        return `Boundary save · plot deployment ${entries.map((e) => e.deployment_id).join(", ") || "?"}`
    }
    return undefined
}

/**
 * The endpoint each DeploymentApi method stands for (live-api.ts), so mock calls read like the real ones. A function, not a
 * constant: api-client.ts imports this module and live-api.ts imports api-client.ts, so DEPLOYMENT_ENDPOINTS is read only
 * at call time (never while the modules are still loading).
 */
const mockEndpoints = (): Record<Exclude<keyof DeploymentApi, "reconcile">, { method: "POST" | "PATCH"; path: string }> => ({
    listFarmerRows: { method: "POST", path: DEPLOYMENT_ENDPOINTS.metadata },
    getTrailerDetails: { method: "POST", path: DEPLOYMENT_ENDPOINTS.trailerDetails },
    getDeploymentNocDetails: { method: "POST", path: DEPLOYMENT_ENDPOINTS.nocDetails },
    getFarmerReportedHistory: { method: "POST", path: DEPLOYMENT_ENDPOINTS.reportHistory },
    updateDeploymentTrailerDispatch: { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.updateDispatch },
    reportFarmerDetails: { method: "POST", path: DEPLOYMENT_ENDPOINTS.reportFarmerDetails },
    updateFarmerDeploymentNOC: { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.nocDecision },
    updateComment: { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.comment },
    softDeleteDispatch: { method: "PATCH", path: DEPLOYMENT_ENDPOINTS.softDelete },
    uploadGeoJson: { method: "POST", path: DEPLOYMENT_ENDPOINTS.uploadGeoJson },
})

/** The mock API with every call recorded (source "mock": answered in memory, no network request). */
export function traceMockApi(api: Omit<DeploymentApi, "reconcile">): Omit<DeploymentApi, "reconcile"> {
    const traced = {} as Record<string, unknown>
    for (const [name, endpoint] of Object.entries(mockEndpoints())) {
        const call = (api as unknown as Record<string, (request: unknown) => Promise<unknown>>)[name].bind(api)
        traced[name] = async (request: unknown) => {
            // listFarmerRows takes a farmer id; what is recorded is the v4 body live mode sends for it (live-api.ts).
            const recorded = name === "listFarmerRows" ? { farmer_ids: [Number(request)], status: "all", rows: 100, page: 1 } : request
            const finish = deploymentTrace.start({ source: "mock", kind: traceKind(endpoint.method, endpoint.path), method: endpoint.method, path: endpoint.path, label: describeRequest(endpoint.method, endpoint.path, recorded) ?? name, request: recorded })
            try {
                const response = await call(request)
                const status = response && typeof response === "object" && typeof (response as { status?: unknown }).status === "number" ? (response as { status: number }).status : 200
                finish({ status, response })
                return response
            } catch (error) {
                finish({ error: error instanceof Error ? error.message : String(error) })
                throw error
            }
        }
    }
    return traced as unknown as Omit<DeploymentApi, "reconcile">
}
