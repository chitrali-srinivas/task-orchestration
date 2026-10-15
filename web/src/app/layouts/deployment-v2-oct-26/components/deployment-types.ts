// Deployment V2 — per-AZ deployment types: the one place where AWD / Mati Boost / later types differ from the
// AZ 1–3 Matic Deployment workflow. Every type uses the same Deployment cards and drill-down
// (deployment → trailer or type grouping → dispatch → plot); a type only decides what is shown and which
// established actions it allows. Workflow (approve, report, NOC, permissions, status) is not configured here.
//   AZ 1–3  Matic Deployment workflow (matic-dash deployment-trailer.tsx): trailer / source / cluster / tons,
//           report source / amount / location, soft delete of a dispatch or a plot deployment.
//   AZ 4    AWD, AZ 5 Mati Boost (matic-dash awd-details.tsx): no trailer / source / cluster / tons in their data
//           (null on every dev dispatch); their recorded values are shown instead, unit-neutral. Their report fields,
//           approval payload, delete behavior and amount unit are open backend questions
//           (docs/deployment/deployment-v2-phase-3e-b-backend-clarification.md), so V2 leaves those flows as they are.
//   AZ 6+   No workflow of its own is known (matic-dash has no AZ 6 code): every field is shown only when the API
//           sent a value; nothing type-specific is enabled.
import type { TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import {
    getDispatchFieldItems,
    getPlotFieldItems,
    getPresentDispatchFieldItems,
    getPresentPlotFieldItems,
    getRecordedDispatchFieldItems,
    getRecordedPlotFieldItems,
    type FieldItems,
} from "./deployment-field-cards"

export type DeploymentTypeKey = "matic" | "awd" | "mati_boost" | "unconfigured"

export interface DeploymentTypeConfig {
    key: DeploymentTypeKey
    /** Soft delete of dispatches / plot deployments (matic-dash offers it for AZ 1–3 only). */
    supportsDelete: boolean
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

const MATIC: DeploymentTypeConfig = {
    key: "matic",
    supportsDelete: true,
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
        supportsDelete: false,
        groupByTrailer: false,
        dispatchCardFacts: (dispatch) => present([dispatch.field_condition, dispatch.crop_stage]),
        plotCardFacts: (plot) => [...genericPlotFacts(plot), ...present([plot.verbal_plot_area_enrolled !== null && `Verbal area ${plot.verbal_plot_area_enrolled}`])],
        dispatchFieldItems: getRecordedDispatchFieldItems,
        plotFieldItems: getRecordedPlotFieldItems,
        reportedFieldMarkers: false,
        // AWD records no deployment quantity (the verbal area is an area) and no source.
        plotAmount: () => null,
        amountLabel: null,
        dispatchSource: sourceName,
    },
    5: {
        key: "mati_boost",
        supportsDelete: false,
        groupByTrailer: false,
        dispatchCardFacts: (dispatch) => present([dispatch.batch_id && `Batch ${dispatch.batch_id}`, dispatch.crop_stage, dispatch.field_condition]),
        plotCardFacts: (plot) => [...genericPlotFacts(plot), ...present([plot.boost_amount_plot_applied !== null && `Boost ${plot.boost_amount_plot_applied}`])],
        dispatchFieldItems: getRecordedDispatchFieldItems,
        plotFieldItems: getRecordedPlotFieldItems,
        reportedFieldMarkers: false,
        plotAmount: (plot) => positive(plot.boost_amount_plot_applied),
        amountLabel: "Boost amount applied",
        dispatchSource: sourceName,
    },
}

const UNCONFIGURED: DeploymentTypeConfig = {
    key: "unconfigured",
    supportsDelete: false,
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
