// PORT-BOUND — V2.1: the ONE way a list row's dispatches are read (the table's dispatch rows and the farmer-level
// detail both use it), with the production contract as the safety net.
//   preferred   getTrailerDetails with the row's AZ and `status` OMITTED → every dispatch of the row, each with its own
//               franchise_status. OBSERVED on the dev API only (8 rows, docs/deployment/deployment-v2-phase-3e-backend-
//               api-answers.md:36-45); production matic-dash never omits `status` (services/api.ts getTrailerDetails
//               defaults it to "approved"), so the backend's handling of an omitted status is not a documented contract.
//   fallback    when that read fails, or returns nothing although the list row states dispatches (trailers_deployed /
//               franchise_statuses), the production contract is used instead: one read per status (pending, approved,
//               rejected — `status` always sent), merged, each dispatch keeping the status it was read with when the
//               response carries none. The fallback is recorded in the Inspector trace so it is diagnosable.
// Nothing here invents a dispatch: a row the backend answers with nothing stays empty.
import { mergeDispatchReads } from "../components/deployment-dispatch-view"
import { deploymentTrace } from "./api-trace"
import { deploymentApi } from "./deployment-api"
import { buildAllStatusTrailerDetailsRequest, buildTrailerDetailsRequest } from "./request-builders"
import type { DeploymentMetadataRow, DispatchStatus, TrailerDispatchItem } from "./schema"

export const DISPATCH_READ_STATUSES: readonly DispatchStatus[] = ["pending", "approved", "rejected"]

export type DispatchReadMode = "all-status" | "per-status-fallback"

export interface RowDispatchRead {
    dispatches: TrailerDispatchItem[]
    /** How the dispatches were obtained (shown by the Inspector; the UI treats both the same). */
    mode: DispatchReadMode
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The list row says it has dispatches (the API's own count / statuses), so an empty read is suspect. */
const rowStatesDispatches = (row: DeploymentMetadataRow) => (row.trailers_deployed !== null && row.trailers_deployed > 0) || (row.franchise_statuses ?? []).length > 0

/** The production contract: every status read with `status` sent; a dispatch without a status keeps the one it was read with. */
async function readPerStatus(row: DeploymentMetadataRow): Promise<TrailerDispatchItem[]> {
    const reads = await Promise.all(DISPATCH_READ_STATUSES.map((status) =>
        deploymentApi.getTrailerDetails(buildTrailerDetailsRequest(row, status))
            .then((dispatches) => dispatches.map((d) => ({ ...d, franchise_status: d.franchise_status ?? status })))
    ))
    return mergeDispatchReads(reads)
}

const note = (row: DeploymentMetadataRow, text: string) =>
    deploymentTrace.record({ source: "live", kind: "read", method: "NOTE", path: "(client)", label: `Dispatch read · farmer ${row.farmer_id} · AZ ${row.az_id}: ${text}`, state: "ok" })

/**
 * Every dispatch of one list row. Rejects only when the fallback fails too (the preferred read's failure is noted, not
 * surfaced, when the production contract then answers).
 */
export async function readRowDispatches(row: DeploymentMetadataRow): Promise<RowDispatchRead> {
    let preferredError: string | null = null
    try {
        const dispatches = await deploymentApi.getTrailerDetails(buildAllStatusTrailerDetailsRequest(row))
        if (dispatches.length > 0 || !rowStatesDispatches(row)) return { dispatches, mode: "all-status" }
        note(row, `the status-omitted read returned no dispatch although the list row states dispatches (trailers_deployed: ${row.trailers_deployed ?? "not sent"}, franchise_statuses: ${(row.franchise_statuses ?? []).join("/") || "none"}); reading per status (the production contract) instead`)
    } catch (error) {
        preferredError = errorMessage(error)
        note(row, `the status-omitted read failed (${preferredError}); reading per status (the production contract) instead`)
    }
    try {
        return { dispatches: await readPerStatus(row), mode: "per-status-fallback" }
    } catch (error) {
        throw new Error(preferredError ? `${preferredError} (per-status fallback also failed: ${errorMessage(error)})` : errorMessage(error))
    }
}
