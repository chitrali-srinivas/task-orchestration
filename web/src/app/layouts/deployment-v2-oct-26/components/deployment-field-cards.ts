// Deployment V2 — builds the existing SurveyCard field items (same labels / item shapes as the existing
// Deployment detail sheet) from the Matic trailer data. Reportable cards are limited to the fields Matic
// reports: dispatch source_name, plot mati_deployed and plot location.
// AZ 1–3 use getDispatchFieldItems / getPlotFieldItems. AWD / Mati Boost use the "recorded" builders (the values
// those types record; no trailer / source / cluster / tons). Other types use the "present" builders, which show a
// field only when the API sent a value. Which builder a type uses is set in deployment-types.ts.
import { format } from "date-fns"
import type { SurveyItem } from "@/app/components/survey/SurveyComponents"
import type { TrailerDeploymentPlot, TrailerDispatchItem } from "../data/schema"
import type { ReportSelection } from "../data/request-builders"

/** Report-mode ids of the reportable cards. */
export const reportId = {
    source: (dispatch: TrailerDispatchItem) => `source_name:${dispatch.deployment_detail_id}`,
    amount: (plot: TrailerDeploymentPlot) => `mati_deployed:${plot.deployment_id}`,
    location: (plot: TrailerDeploymentPlot) => `location:${plot.deployment_id}`,
}

export const formatDispatchDate = (epochMs: number | null) => (epochMs === null ? "-" : format(new Date(epochMs), "dd MMM yyyy"))
export const dispatchLabel = (dispatch: TrailerDispatchItem) => `DISP-${dispatch.dispatch_id}`
export const plotLabel = (plot: TrailerDeploymentPlot) => `DEPL-${plot.deployment_id}`

export interface FieldItems {
    items: SurveyItem[]
    /** Ids of the cards that can be selected in report mode. */
    reportable: Set<string>
}

export function getDispatchFieldItems(dispatch: TrailerDispatchItem): FieldItems {
    const items: SurveyItem[] = [
        { id: `trailer_no:${dispatch.deployment_detail_id}`, question: "trailer_no:", type: "text", answer: dispatch.trailer_no, label: "Trailer Number" },
        { id: reportId.source(dispatch), question: "MATI Source name:", type: "text", answer: dispatch.source_name, label: "Source Name" },
        { id: `cluster_name:${dispatch.deployment_detail_id}`, question: "Please select the Cluster Name in Which MATI is Deployed:", type: "badge", answer: dispatch.cluster_name ? [dispatch.cluster_name] : [], label: "Cluster Name" },
        { id: `num_tons:${dispatch.deployment_detail_id}`, question: "Number of Tonnes loaded on this tractor?:", type: "quantity", answer: `${dispatch.num_tons} Tons`, label: "Number of Tons" },
        { id: `num_plots:${dispatch.deployment_detail_id}`, question: "Number of plots in which this trailer will unload:", type: "quantity", answer: `${dispatch.deployment_plots_data.length} Plots`, label: "Number of Plots Unloaded" },
        { id: `date:${dispatch.deployment_detail_id}`, question: "Date of deployment:", type: "text", answer: formatDispatchDate(dispatch.date), label: "Date of Deployment" },
        { id: `video:${dispatch.deployment_detail_id}`, question: "Deployment video 1*:", type: "video", answer: dispatch.video ?? "", label: "Deployment Video" },
    ]
    return { items, reportable: new Set([reportId.source(dispatch)]) }
}

const locationItem = (plot: TrailerDeploymentPlot, villageName: string): SurveyItem => ({
    id: reportId.location(plot),
    question: "Location of Plot:",
    type: "map",
    answer: plot.location ? villageName : "",
    meta: plot.location ? `${plot.location.lat.toFixed(4)}° N, ${plot.location.lng.toFixed(4)}° E` : "",
    label: "GPS Coordinates",
})

export function getPlotFieldItems(plot: TrailerDeploymentPlot, villageName: string): FieldItems {
    const items: SurveyItem[] = [
        { id: `plot_id:${plot.deployment_id}`, question: "Plot Number:", type: "text", answer: plot.plot_id, label: "Plot Number" },
        { id: reportId.amount(plot), question: "Amount deployed in Plot (In tonnes):", type: "quantity", answer: `${plot.amt_plot_deploy} Tons`, label: "Amount Deployed" },
        { id: `plot_area:${plot.deployment_id}`, question: "plot_area:", type: "text", answer: `${plot.area} Acres`, label: "Plot Area" },
        locationItem(plot, villageName),
        { id: `picture:${plot.deployment_id}`, question: "Picture of Deployment 1:", type: "image", answer: plot.picture_deployment ?? "", label: "Deployment Picture" },
    ]
    const reportable = new Set([reportId.amount(plot)])
    if (plot.location) reportable.add(reportId.location(plot))
    return { items, reportable }
}

// ── Type-specific detail fields (display only; units only where the API names them) ───────────────

const textItem = (id: string, label: string, answer: string): SurveyItem => ({ id, question: `${label}:`, type: "text", answer, label })
const hasText = (value: string | null | undefined): value is string => typeof value === "string" && value.trim() !== ""

/** Values a dispatch may record whatever its type (each shown only when sent). */
function optionalDispatchItems(dispatch: TrailerDispatchItem): SurveyItem[] {
    const key = dispatch.deployment_detail_id
    const items: SurveyItem[] = []
    if (dispatch.num_plots_unload !== null) items.push({ id: `num_plots_unload:${key}`, question: "Plots unloaded (as recorded):", type: "quantity", answer: String(dispatch.num_plots_unload), label: "Plots unloaded" })
    if (hasText(dispatch.batch_id)) items.push(textItem(`batch_id:${key}`, "Batch ID", dispatch.batch_id))
    if (hasText(dispatch.field_condition)) items.push(textItem(`field_condition:${key}`, "Field condition", dispatch.field_condition))
    if (hasText(dispatch.crop_stage)) items.push(textItem(`crop_stage:${key}`, "Crop stage", dispatch.crop_stage))
    if (dispatch.video) items.push({ id: `video:${key}`, question: "Deployment video:", type: "video", answer: dispatch.video, label: "Deployment Video" })
    return items
}

const dateItem = (dispatch: TrailerDispatchItem): SurveyItem =>
    textItem(`date:${dispatch.deployment_detail_id}`, "Date of deployment", dispatch.date === null ? "" : formatDispatchDate(dispatch.date))

/** AWD / Mati Boost dispatch: date plus what these types record. Nothing here is reportable (display only). */
export function getRecordedDispatchFieldItems(dispatch: TrailerDispatchItem): FieldItems {
    return { items: [dateItem(dispatch), ...optionalDispatchItems(dispatch)], reportable: new Set() }
}

/** Plot values a type may record (verbal plot area, boost amount), unit-neutral, each shown only when sent. */
export function recordedPlotItems(plot: TrailerDeploymentPlot): SurveyItem[] {
    const items: SurveyItem[] = []
    if (plot.verbal_plot_area_enrolled !== null) items.push(textItem(`verbal_plot_area_enrolled:${plot.deployment_id}`, "Verbal Plot area enrolled", String(plot.verbal_plot_area_enrolled)))
    if (plot.boost_amount_plot_applied !== null) items.push(textItem(`boost_amount_plot_applied:${plot.deployment_id}`, "Boost amount plot applied", String(plot.boost_amount_plot_applied)))
    return items
}

/** AWD / Mati Boost plot: plot number, recorded values, area / location / picture when available. Location stays reportable. */
export function getRecordedPlotFieldItems(plot: TrailerDeploymentPlot, villageName: string): FieldItems {
    const items: SurveyItem[] = [textItem(`plot_id:${plot.deployment_id}`, "Plot Number", plot.plot_id), ...recordedPlotItems(plot)]
    if (plot.area > 0) items.push(textItem(`plot_area:${plot.deployment_id}`, "Plot area", `${plot.area} Acres`))
    if (plot.location) items.push(locationItem(plot, villageName))
    if (plot.picture_deployment) items.push({ id: `picture:${plot.deployment_id}`, question: "Picture of Deployment 1:", type: "image", answer: plot.picture_deployment, label: "Deployment Picture" })
    return { items, reportable: new Set(plot.location ? [reportId.location(plot)] : []) }
}

/**
 * Types without a configured field set (AZ 6 and later): every field only when the API sent a value. The trailer,
 * source, cluster and tons cards therefore appear only for types whose data carries them. Fields that were
 * reportable before stay reportable while they are shown.
 */
export function getPresentDispatchFieldItems(dispatch: TrailerDispatchItem): FieldItems {
    const key = dispatch.deployment_detail_id
    const items: SurveyItem[] = []
    const reportable = new Set<string>()
    if (hasText(dispatch.trailer_no)) items.push({ id: `trailer_no:${key}`, question: "trailer_no:", type: "text", answer: dispatch.trailer_no, label: "Trailer Number" })
    if (hasText(dispatch.source_name)) {
        items.push({ id: reportId.source(dispatch), question: "MATI Source name:", type: "text", answer: dispatch.source_name, label: "Source Name" })
        reportable.add(reportId.source(dispatch))
    }
    if (hasText(dispatch.cluster_name)) items.push({ id: `cluster_name:${key}`, question: "Please select the Cluster Name in Which MATI is Deployed:", type: "badge", answer: [dispatch.cluster_name], label: "Cluster Name" })
    if (dispatch.num_tons > 0) items.push({ id: `num_tons:${key}`, question: "Number of Tonnes loaded on this tractor?:", type: "quantity", answer: `${dispatch.num_tons} Tons`, label: "Number of Tons" })
    items.push({ id: `num_plots:${key}`, question: "Number of plots:", type: "quantity", answer: `${dispatch.deployment_plots_data.length} Plots`, label: "Number of Plots" })
    items.push(dateItem(dispatch), ...optionalDispatchItems(dispatch))
    return { items, reportable }
}

export function getPresentPlotFieldItems(plot: TrailerDeploymentPlot, villageName: string): FieldItems {
    const items: SurveyItem[] = [textItem(`plot_id:${plot.deployment_id}`, "Plot Number", plot.plot_id)]
    const reportable = new Set<string>()
    if (plot.amt_plot_deploy > 0) {
        items.push({ id: reportId.amount(plot), question: "Amount deployed in Plot:", type: "quantity", answer: String(plot.amt_plot_deploy), label: "Amount Deployed" })
        reportable.add(reportId.amount(plot))
    }
    if (plot.area > 0) items.push(textItem(`plot_area:${plot.deployment_id}`, "Plot area", `${plot.area} Acres`))
    items.push(...recordedPlotItems(plot))
    if (plot.location) {
        items.push(locationItem(plot, villageName))
        reportable.add(reportId.location(plot))
    }
    if (plot.picture_deployment) items.push({ id: `picture:${plot.deployment_id}`, question: "Picture of Deployment 1:", type: "image", answer: plot.picture_deployment, label: "Deployment Picture" })
    return { items, reportable }
}

/** Resolves report-mode ids back to the Matic report selections. */
export function toReportSelections(ids: string[], dispatches: TrailerDispatchItem[]): ReportSelection[] {
    const selections: ReportSelection[] = []
    for (const id of ids) {
        const [kind, key] = id.split(":")
        if (kind === "source_name") {
            const dispatch = dispatches.find((d) => d.deployment_detail_id === key)
            if (dispatch) selections.push({ kind, dispatch })
            continue
        }
        for (const dispatch of dispatches) {
            const plot = dispatch.deployment_plots_data.find((p) => String(p.deployment_id) === key)
            if (plot && (kind === "mati_deployed" || kind === "location")) selections.push({ kind, dispatch, plot })
        }
    }
    return selections
}
