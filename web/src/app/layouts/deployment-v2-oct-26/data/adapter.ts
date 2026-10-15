// PORT-BOUND — maps Deployment API rows onto the record shape the existing Deployment components render.
// Status is translated 1:1 from the API `status` (label mapping only — never recalculated from
// franchise_status / action_required).
import type { EngagementRecord } from "@/app/layouts/deployment/data/schema"
import type { DeploymentMetadataRow, DeploymentStatus, DeploymentStatusCounts, DeploymentV2Record, EpochMs } from "./schema"

/** API status → the status labels used by the existing Deployment UI ("Invalid" is shown as "Need Correction"). */
export const STATUS_TO_RECORD: Record<DeploymentStatus, EngagementRecord["status"]> = {
    approved: "Verified",
    pending: "Pending",
    need_correction: "Invalid",
}

/** Largest |epoch ms| a JavaScript Date can hold; beyond it `new Date(ms)` is an Invalid Date. */
const MAX_DATE_MS = 8.64e15

/**
 * Epoch ms as the API sends it: a number, or a string of digits (the dev API serializes these columns as strings).
 * Anything else — null, "", ISO / "dd-MM-yyyy" text, malformed or out-of-range values — is not a date and returns
 * null, so a non-null result is always safe to pass to `new Date()` / `format()`.
 */
export function parseEpochMs(value: EpochMs | null | undefined): number | null {
    const ms = typeof value === "number" ? value
        : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim())
        : null
    return ms !== null && Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS ? ms : null
}

/** "9425011201" → "+91 94250 11201" (the phone format used by the existing Deployment mock). */
function formatPhone(phone: string | null): string | undefined {
    if (!phone) return undefined
    const digits = phone.replace(/\D/g, "")
    const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits
    return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : phone
}

export function toDeploymentV2Record(row: DeploymentMetadataRow, index: number): DeploymentV2Record {
    const errorMessages = row.err_msg ?? []
    const createdAt = parseEpochMs(row.created_at)
    const verifiedAt = parseEpochMs(row.verified_at) ?? createdAt
    return {
        id: index + 1,
        // No valid created_at → no date (the V2 Submitted on cell renders "-").
        submittedOn: createdAt === null ? undefined : new Date(createdAt),
        farmer: {
            // Dev sends farmer_name null on some rows; the shared cells call string methods on it (a null crashed the page).
            name: row.farmer_name ?? "",
            id: String(row.farmer_id),
            avatar: row.farmer_picture ?? undefined,
            phoneNumber: formatPhone(row.phone_no),
        },
        engagementType: "Deployment",
        village: row.village_name,
        plots: row.plots,
        area: row.actual_area,
        calArea: row.calculated_area,
        azs: row.az_id,
        azName: row.az_name,
        deployed: row.deployed_amount,
        surveyor: {
            name: row.surveyor_name ?? "",
            id: row.surveyor_registred_no ?? "",
            phoneNumber: formatPhone(row.surveyor_phone_no),
        },
        verified:
            row.status === "approved" && row.verified_by && verifiedAt !== null
                ? { verifier: row.verified_by, date: new Date(verifiedAt) }
                : null,
        status: STATUS_TO_RECORD[row.status],
        // err_msg is what the existing detail sheet shows as the correction ("report") comment.
        reportComment: errorMessages.length > 0 ? errorMessages.join(" ") : undefined,
        comments: "",
        verificationComments: [],
        score: 0,
        api: row,
    }
}

/** getDeploymentStatusCounts → the tab-count keys the existing toolbar reads. */
export function toToolbarCounts(counts: DeploymentStatusCounts) {
    return { all: counts.all, verified: counts.approved, pending: counts.pending, invalid: counts.need_correction }
}

/** Stable identity of a metadata row (API row grain: farmer_id + deployment_num + az_id). */
export function getDeploymentRowKey(row: Pick<DeploymentMetadataRow, "farmer_id" | "deployment_num" | "az_id">): string {
    return `${row.farmer_id}-${row.deployment_num}-${row.az_id}`
}
