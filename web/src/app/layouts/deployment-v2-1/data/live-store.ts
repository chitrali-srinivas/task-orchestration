// PROTOTYPE-ONLY — live-mode reconciliation after a mutation (the mock store does this by itself).
// reconcileLiveRow re-reads the authoritative metadata row (farmer + AZ, all statuses) so the open sheet shows the
// backend's status even when the row has left the current tab/page, and bumps a version so the table and counts
// refetch. No status is ever computed here.
import { getDeploymentRowKey } from "./adapter"
import { fetchDeploymentMetadata } from "./live-api"
import type { DeploymentMetadataRow } from "./schema"

const rowsByKey = new Map<string, DeploymentMetadataRow>()
let rowsSnapshot: DeploymentMetadataRow[] = []
let version = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function subscribeLiveStore(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
export const getLiveRowsSnapshot = () => rowsSnapshot
export const getLiveVersion = () => version

/**
 * Re-reads one deployment row from getDeploymentMetadata and invalidates the table. Resolves true when the row was
 * re-read (the open sheet then reloads from the new row), false when it was not found. Throws if the read fails.
 */
export async function reconcileLiveRow(row: DeploymentMetadataRow): Promise<boolean> {
    try {
        const { rows } = await fetchDeploymentMetadata({
            farmer_ids: [Number(row.farmer_id)],
            az_ids: [row.az_id],
            status: "all",
            rows: 100,
            page: 1,
        })
        const fresh = rows.find((r) => Number(r.deployment_num) === Number(row.deployment_num) && Number(r.az_id) === Number(row.az_id))
        if (!fresh) return false
        rowsByKey.set(getDeploymentRowKey(fresh), fresh)
        rowsSnapshot = [...rowsByKey.values()]
        return true
    } finally {
        version++
        emit()
    }
}
