// PROTOTYPE-ONLY — deterministic mock rows shaped exactly like getDeploymentMetadata rows, and mock
// status counts shaped like getDeploymentStatusCounts. Production: both come from the API.
//
// Farmer / village / AZ / surveyor / verifier names use the option lists of the existing filter sidebar
// (src/app/components/filter/components/FilterSidebar.tsx) so the existing filter UI works on this data.
import type { DeploymentMetadataRow, DeploymentStatus, DeploymentStatusCounts } from "./schema"

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

const VILLAGES = [
    { id: 12, name: "Village A" },
    { id: 13, name: "Village B" },
    { id: 14, name: "Village C" },
]

const AZS = [
    { id: 1, code: "AZ1", name: "Wheat" },
    { id: 2, code: "AZ2", name: "Rice" },
    { id: 3, code: "AZ3", name: "Maize" },
]

const SURVEYORS = [
    { name: "Surveyor 1", phone: "9406277649" },
    { name: "Surveyor 2", phone: "6267685519" },
    { name: "Surveyor 3", phone: "9522797884" },
]

const VERIFIERS = [
    { name: "Verifier A", phone: "9812345678" },
    { name: "Verifier B", phone: "9811122233" },
    { name: "Verifier C", phone: "9899988877" },
]

const FARMERS = [
    { id: 1001, name: "Rajesh Kumar", villageIdx: 0, phone: "9425011201" },
    { id: 1002, name: "Sunita Devi", villageIdx: 1, phone: "9425011202" },
    { id: 1003, name: "Amit Patel", villageIdx: 2, phone: "9425011203" },
    { id: 1004, name: "Priya Sharma", villageIdx: 0, phone: "9425011204" },
    { id: 1005, name: "Ramesh Yadav", villageIdx: 1, phone: "9425011205" },
    { id: 1006, name: "Meena Kumari", villageIdx: 2, phone: "9425011206" },
    { id: 1007, name: "Suresh Tiwari", villageIdx: 0, phone: "9425011207" },
    { id: 1008, name: "Lakshmi Bai", villageIdx: 1, phone: null },
]

/** Example validation messages for need_correction rows (illustrative; real messages come from the API). */
const CORRECTION_MESSAGES: string[][] = [
    ["Video is missing."],
    ["Deployment picture is missing."],
    ["Video is missing.", "Trailer details are missing."],
    ["Deployment date is missing."],
]

// A = approved, P = pending, N = need_correction → 16 / 11 / 7 (the same mix as the existing Deployment mock).
const STATUS_PATTERN = "APANAPAPNAAPAPNAAPANAPAPNAAPAPNAPN"
const STATUS_BY_CODE: Record<string, DeploymentStatus> = { A: "approved", P: "pending", N: "need_correction" }

const BASE_DATE = Date.UTC(2025, 0, 6)
const round2 = (n: number) => Math.round(n * 100) / 100

function buildRow(i: number): Omit<DeploymentMetadataRow, "total_count"> {
    const farmerIdx = i % FARMERS.length
    const round = Math.floor(i / FARMERS.length) // 0..4
    const farmer = FARMERS[farmerIdx]
    const village = VILLAGES[farmer.villageIdx]
    // Unique row grain: farmer_id + deployment_num + az_id.
    const az = AZS[(farmerIdx + round) % AZS.length]
    const surveyor = SURVEYORS[(i * 2) % SURVEYORS.length]
    const verifier = VERIFIERS[i % VERIFIERS.length]
    const status = STATUS_BY_CODE[STATUS_PATTERN[i]]
    const isApproved = status === "approved"

    const epochDate = BASE_DATE + ((i * 37) % 300) * DAY
    const createdAt = epochDate + (1 + (i % 3)) * DAY + (9 + (i % 8)) * HOUR
    const actualArea = round2(1 + ((i * 13) % 40) / 4)
    const deployedAmount = round2(actualArea * (1.25 + (i % 4) * 0.25))

    return {
        created_at: createdAt,
        epoch_date: epochDate,
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        farmer_picture: farmerIdx === 7 ? null : `https://i.pravatar.cc/150?u=mati-v2-farmer-${farmer.id}`,
        phone_no: farmer.phone,
        village_id: village.id,
        village_name: village.name,
        deployment_num: round < 3 ? 1 : 2,
        az_id: az.id,
        az_code: az.code,
        az_name: az.name,
        plots: 1 + ((i * 7) % 12),
        actual_area: actualArea,
        calculated_area: round2(actualArea * (0.9 + ((i * 3) % 15) / 100)),
        deployed_amount: deployedAmount,
        num_tons: Math.ceil(deployedAmount),
        trailers_deployed: Math.max(1, Math.ceil(deployedAmount / 5)),
        status,
        franchise_status: isApproved ? "approved" : "pending",
        action_required: status === "need_correction",
        err_msg: status === "need_correction" ? CORRECTION_MESSAGES[i % CORRECTION_MESSAGES.length] : [],
        surveyor_registred_no: surveyor.phone,
        surveyor_name: surveyor.name,
        surveyor_phone_no: surveyor.phone,
        franchise_verifier_id: isApproved ? verifier.phone : null,
        verified_by: isApproved ? verifier.name : null,
        verified_at: isApproved ? createdAt + (2 + (i % 5)) * DAY + (i % 6) * HOUR : null,
    }
}

const rows = Array.from({ length: STATUS_PATTERN.length }, (_, i) => buildRow(i))

/** Every mock deployment row, with `total_count` as the metadata endpoint returns it for an unfiltered request. */
export const deploymentMetadataRows: DeploymentMetadataRow[] = rows.map((row) => ({ ...row, total_count: rows.length }))

/** Mock getDeploymentStatusCounts response for a set of rows (`all` is returned, not summed by the UI). */
export function getMockDeploymentStatusCounts(source: Pick<DeploymentMetadataRow, "status">[]): DeploymentStatusCounts {
    return {
        all: source.length,
        approved: source.filter((row) => row.status === "approved").length,
        pending: source.filter((row) => row.status === "pending").length,
        need_correction: source.filter((row) => row.status === "need_correction").length,
    }
}
