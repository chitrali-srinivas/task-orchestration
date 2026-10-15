// Deployment V2 — per-AZ deployment types: the one place where AWD / Mati Boost / later types differ from the
// AZ 1–3 Matic Deployment workflow. Every type uses the same Deployment cards and drill-down
// (deployment → trailer or type grouping → dispatch → plot); a type only decides what is shown and which
// established actions it allows. Workflow (approve, report, NOC, permissions, status) is not configured here.
//   AZ 1–3  Matic Deployment workflow (matic-dash deployment-trailer.tsx): trailer / source / cluster / tons,
//           report source / amount / location, soft delete of a dispatch or a plot deployment.
//   AZ 4    AWD, AZ 5 Mati Boost (matic-dash awd-details.tsx): no trailer / source / cluster / tons in their data
//           (null on every dev dispatch); their recorded values are shown instead. V2.1 (M1): their production actions
//           are ported — the AWD approve body, the ten report fields per plot, plot-only delete, Tons / Litres labels.
//           OPEN — backend/contract confirmation required: approval extra fields, per-AZ report fields, the Mati Boost
//           unit, delete semantics (docs/deployment/deployment-v2-phase-3e-b-backend-clarification.md).
//   AZ 6+   No workflow of its own is known (matic-dash has no AZ 6 code): every field is shown only when the API
//           sent a value; display only (actions: null).
import type { DeploymentMetadataRow, TrailerDeploymentPlot, TrailerDispatchItem, UpdateDeploymentTrailerDispatchRequest } from "../data/schema"
import {
    awdReportOptions,
    fieldReportOptions,
    getDispatchFieldItems,
    getPlotFieldItems,
    getPresentDispatchFieldItems,
    getPresentPlotFieldItems,
    getRecordedDispatchFieldItems,
    getRecordedPlotFieldItems,
    type FieldItems,
    type ReportOption,
} from "./deployment-field-cards"
import {
    buildApproveDispatchRequest,
    buildAwdApproveDispatchRequest,
    buildAwdReportRequests,
    buildReportRequests,
    type ReportRequests,
    type ReportSelection,
} from "../data/request-builders"

export type DeploymentTypeKey = "matic" | "awd" | "mati_boost" | "unconfigured"

/** matic-dash's permission keys (route-permissions.json), one per deployment workflow. */
export const DEPLOYMENT_PERMISSION = {
    deploymentEdit: "verifier.farm.deployment_verification.create",
    deploymentDelete: "verifier.farm.deployment_verification.delete",
    awdEdit: "verifier.farm.awd_deployment_verification.create",
    matiBoostEdit: "verifier.farm.mati_boost_deployment_verification.create",
} as const

/**
 * V2.1 (M1): a type's verification actions, ported from matic-dash (src/components/deployment/types/deployment-types.ts):
 * the permission keys, which deletes exist, and the production payload builders.
 */
export interface DeploymentActions {
    /** Approve, report, NOC decisions, comments and plot boundaries. */
    editPermission: string
    /** Soft delete; matic-dash has no AWD / Mati Boost delete key, so their plot delete follows their edit key (OPEN). */
    deletePermission: string
    /** What may be soft-deleted: a whole dispatch (AZ 1–3 only) and / or one plot deployment. */
    deleteScopes: { dispatch: boolean; plot: boolean }
    approveRequest: (row: DeploymentMetadataRow, dispatch: TrailerDispatchItem, verifierId: string) => UpdateDeploymentTrailerDispatchRequest
    /** Values selectable in report mode, on the dispatch card and on each plot card. */
    dispatchReportOptions: (dispatch: TrailerDispatchItem) => ReportOption[]
    plotReportOptions: (plot: TrailerDeploymentPlot, dispatch: TrailerDispatchItem, villageName: string) => ReportOption[]
    reportRequests: (row: DeploymentMetadataRow, selections: ReportSelection[], comment: string, verifierId: string) => ReportRequests
}

export interface DeploymentTypeConfig {
    key: DeploymentTypeKey
    /**
     * V2.1: the type has a verification workflow — approve, report, NOC decisions, comment edits, boundary edits. AZ 6+
     * has none (matic-dash has no AZ 6 Deployment workflow): display only. AWD / Mati Boost keep V2's actions until the
     * product decision on their own workflow (post-migration audit M1).
     */
    supportsActions: boolean
    /** V2.1: Pre-Sample (pre-sampling navigation) applies — AZ 1–3 only, as matic-dash. */
    preSample: boolean
    /**
     * V2.1 (M1): what a verifier may do on this type, with matic-dash's payloads and permission keys; null for types
     * with no workflow (AZ 6+: display only). The row / dispatch gates (status, NOC, boundaries) are the detail's.
     */
    actions: DeploymentActions | null
    /** Dispatches are grouped by trailer when their data names trailers (AWD / Mati Boost record none). */
    groupByTrailer: boolean
    /** Short facts on a dispatch card, right of the plot count (values the API sent; empty ones are left out). */
    dispatchCardFacts: (dispatch: TrailerDispatchItem) => string[]
    /** Short facts on a plot card, under its DEPL id. */
    plotCardFacts: (plot: TrailerDeploymentPlot) => string[]
    /** Level 2 (dispatch) field cards and which of them are reportable. */
    dispatchFieldItems: (dispatch: TrailerDispatchItem) => FieldItems
    /** Level 3 (plot) field cards and which of them are reportable. */
    plotFieldItems: (plot: TrailerDeploymentPlot, villageName: string) => FieldItems
    /**
     * Field cards can carry a "Reported" marker from report history. Only AZ 1–3, whose history labels map to their
     * fields (Source Name / Mati Deployed / Location). AWD / Mati Boost report fields have no established history
     * contract yet, and AZ 6+ has none: they show dispatch / plot indicators only.
     */
    reportedFieldMarkers: boolean
    /**
     * Map semantics (marker size): the plot's deployed quantity in the type's own field, or null when the data has
     * none (AWD records no quantity; a 0 / missing value is not a recorded amount). Never derived or invented.
     */
    plotAmount: (plot: TrailerDeploymentPlot) => number | null
    /** What `plotAmount` measures, for the map legend (null: the type records no deployment quantity). */
    amountLabel: string | null
    /** Map semantics (marker colour): the dispatch's source / material, or null when the data names none. */
    dispatchSource: (dispatch: TrailerDispatchItem) => string | null
}

const present = (values: (string | null | false)[]): string[] => values.filter((v): v is string => !!v)

/** A recorded positive quantity, else null (0 / missing / not a number is "not recorded", never a zero-size plot). */
const positive = (value: number | null | undefined): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null)
const sourceName = (dispatch: TrailerDispatchItem): string | null => dispatch.source_name?.trim() || null

/** Plot facts every type can show: the plot number, and the area when one was recorded. */
const genericPlotFacts = (plot: TrailerDeploymentPlot) => present([plot.plot_id, plot.area > 0 && `${plot.area} Acres`])

/**
 * V2.1 (M1): AWD / Mati Boost actions (matic-dash awd-details.tsx): their approve body, the ten report fields per plot,
 * plot-only delete. OPEN — backend/contract confirmation required: delete permission / semantics for AZ 4 / 5 (matic-dash
 * has no AWD / Mati Boost delete key; its plot delete follows the edit key), and which report fields each AZ accepts.
 */
const awdActions = (editPermission: string, amountField: "amt_plot_deploy" | "boost_amount_plot_applied"): DeploymentActions => ({
    editPermission,
    deletePermission: editPermission,
    deleteScopes: { dispatch: false, plot: true },
    approveRequest: buildAwdApproveDispatchRequest,
    dispatchReportOptions: () => [],
    plotReportOptions: (plot, dispatch) => awdReportOptions(plot, dispatch, amountField),
    reportRequests: (row, selections, comment, verifierId) => buildAwdReportRequests(row, selections, comment, verifierId, amountField),
})

const MATIC: DeploymentTypeConfig = {
    key: "matic",
    supportsActions: true,
    preSample: true,
    actions: {
        editPermission: DEPLOYMENT_PERMISSION.deploymentEdit,
        deletePermission: DEPLOYMENT_PERMISSION.deploymentDelete,
        deleteScopes: { dispatch: true, plot: true },
        approveRequest: (_row, dispatch, verifierId) => buildApproveDispatchRequest(dispatch, verifierId),
        dispatchReportOptions: (dispatch) => fieldReportOptions(getDispatchFieldItems(dispatch)),
        plotReportOptions: (plot, _dispatch, villageName) => fieldReportOptions(getPlotFieldItems(plot, villageName)),
        reportRequests: buildReportRequests,
    },
    groupByTrailer: true,
    dispatchCardFacts: (dispatch) => present([dispatch.source_name, `${dispatch.num_tons} Tons`]),
    plotCardFacts: (plot) => present([plot.plot_id, `${plot.area} Acres`, `${plot.amt_plot_deploy} Tons`]),
    dispatchFieldItems: getDispatchFieldItems,
    plotFieldItems: getPlotFieldItems,
    reportedFieldMarkers: true,
    plotAmount: (plot) => positive(plot.amt_plot_deploy),
    amountLabel: "Amount deployed (Tons)",
    dispatchSource: sourceName,
}

const TYPES: Record<number, DeploymentTypeConfig> = {
    1: MATIC,
    2: MATIC,
    3: MATIC,
    4: {
        key: "awd",
        supportsActions: true,
        preSample: false,
        actions: awdActions(DEPLOYMENT_PERMISSION.awdEdit, "amt_plot_deploy"),
        groupByTrailer: false,
        dispatchCardFacts: (dispatch) => present([dispatch.field_condition, dispatch.crop_stage]),
        // matic-dash awd-details.tsx shows the plot amount in Tons (amt_plot_deploy); null when the data has none.
        plotCardFacts: (plot) => [
            ...genericPlotFacts(plot),
            ...present([positive(plot.amt_plot_deploy) !== null && `${plot.amt_plot_deploy} Tons`, plot.verbal_plot_area_enrolled !== null && `Verbal area ${plot.verbal_plot_area_enrolled}`]),
        ],
        dispatchFieldItems: getRecordedDispatchFieldItems,
        plotFieldItems: getRecordedPlotFieldItems,
        reportedFieldMarkers: false,
        plotAmount: (plot) => positive(plot.amt_plot_deploy),
        amountLabel: "Amount deployed (Tons)",
        dispatchSource: sourceName,
    },
    5: {
        key: "mati_boost",
        supportsActions: true,
        preSample: false,
        actions: awdActions(DEPLOYMENT_PERMISSION.matiBoostEdit, "boost_amount_plot_applied"),
        groupByTrailer: false,
        dispatchCardFacts: (dispatch) => present([dispatch.batch_id && `Batch ${dispatch.batch_id}`, dispatch.crop_stage, dispatch.field_condition]),
        // "Litres" is matic-dash's label (commit dd9e883); the backend defines no unit — OPEN (phase-3e-b question 4).
        plotCardFacts: (plot) => [...genericPlotFacts(plot), ...present([plot.boost_amount_plot_applied !== null && `Boost ${plot.boost_amount_plot_applied} Litres`])],
        dispatchFieldItems: getRecordedDispatchFieldItems,
        plotFieldItems: getRecordedPlotFieldItems,
        reportedFieldMarkers: false,
        plotAmount: (plot) => positive(plot.boost_amount_plot_applied),
        amountLabel: "Boost applied (Litres)",
        dispatchSource: sourceName,
    },
}

const UNCONFIGURED: DeploymentTypeConfig = {
    key: "unconfigured",
    supportsActions: false,
    preSample: false,
    actions: null,
    groupByTrailer: true,
    dispatchCardFacts: (dispatch) => present([dispatch.source_name, dispatch.num_tons > 0 && `${dispatch.num_tons} Tons`]),
    plotCardFacts: (plot) => [...genericPlotFacts(plot), ...present([plot.verbal_plot_area_enrolled !== null && `Verbal area ${plot.verbal_plot_area_enrolled}`])],
    dispatchFieldItems: getPresentDispatchFieldItems,
    plotFieldItems: getPresentPlotFieldItems,
    reportedFieldMarkers: false,
    plotAmount: (plot) => positive(plot.amt_plot_deploy),
    amountLabel: "Amount deployed",
    dispatchSource: sourceName,
}

export function getDeploymentType(azId: number): DeploymentTypeConfig {
    return TYPES[azId] ?? UNCONFIGURED
}
