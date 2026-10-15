// PORT-BOUND — display labels. Status words are Deployment V2's (approved → "Verified"); purpose names follow Matic
// (ReportFormName "End of year sample" …); people without a name in the data are shown by their role, phone masked
// the way Deployment V2 masks phones.
import type { BoundaryState, PersonRef, ReportableField, SampleKind, SamplePurpose, StatusBucket } from "./types"

export const PURPOSE_LABEL: Record<SamplePurpose, string> = {
    pre: "Pre",
    start: "Start",
    harvest: "Harvest",
    eoy: "EOY",
    eo3y: "EO3Y",
    eo5y: "EO5Y",
}

/** Long form (Matic ReportFormName / getSampleTypeLabel wording). */
export const PURPOSE_LONG_LABEL: Record<SamplePurpose, string> = {
    pre: "Pre-sample",
    start: "Start sample",
    harvest: "Harvest sample",
    eoy: "End of year sample",
    eo3y: "End of 3rd year sample",
    eo5y: "End of 5th year sample",
}

export const KIND_LABEL: Record<SampleKind, string> = { deployment: "Deployment", control: "Control" }

/** Deployment V2's status words, by bucket. */
export const BUCKET_LABEL: Record<StatusBucket, string> = { pending: "Pending", need_correction: "Need Correction", approved: "Verified" }

export const BOUNDARY_LABEL: Record<BoundaryState, string> = {
    deployment_plot: "Deployment plot",
    control_plot: "Control plot",
    boundary_required: "Boundary required",
    not_located: "No GPS",
}

/** Deployment V2's field labels for the reportable sample fields (deployment-field-cards.ts: "GPS Coordinates"). */
export const REPORTABLE_FIELD_LABEL: Record<ReportableField, string> = {
    sample_id: "Sample ID",
    location: "GPS Coordinates",
    picture: "Sample Picture",
}

/** Deployment V2's phone mask (deployment/components/columns.tsx): every digit but the last four. */
export const maskPhone = (phone: string) => phone.replace(/.(?=.{4})/g, "*")

/** A person's display name: the recorded name, else the role (names are not in the CSV export). */
export const personName = (person: PersonRef | null, role: string) => person?.name ?? role

/** A farmer's display name: the recorded name, else its (derived) id. */
export const farmerName = (farmer: { id: string; name: string | null }) => farmer.name ?? farmer.id

/** Deployment V2's GPS wording (deployment-field-cards.ts), sign-aware: "21.3187° N, 81.4248° E". */
export const formatLatLng = (lat: number, lng: number) =>
    `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`
