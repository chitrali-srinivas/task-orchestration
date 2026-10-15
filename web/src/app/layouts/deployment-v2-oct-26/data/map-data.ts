// PROTOTYPE-ONLY (mode switch) — the farmer + plots the detail map draws.
// mock: the existing mati-demo map mock (MOCK_FARMERS, matched by farmer name, else the first mock farmer).
// live: the real plots of the loaded dispatches (getTrailerDetails deployment_plots_data[]), as matic-dash draws them:
//   marker = plot.location, outline = plot.geometry (GeoJSON Polygon, first ring). A plot without a usable location
//   has no marker; a plot without a usable outline has no polygon. Nothing is substituted or invented.
// Map semantics (V2): each map plot carries its deployment identity and two normalized values the deployment type
// provides (DeploymentTypeConfig.plotAmount / dispatchSource): the deployed amount (marker size) and the source /
// material (marker colour). The map draws them; it never knows how a type stores them.
import { MOCK_FARMERS } from "@/data/mockData"
import type { Farmer, Plot } from "@/types/map"
import { isLiveMode } from "./data-mode"
import { toPolygonPath } from "./live-normalize"
import type { DeploymentV2Record, TrailerDeploymentPlot, TrailerDispatchItem } from "./schema"

/** What a map plot means (V2), normalized from the dispatch data; null where the data has nothing. */
export interface MapPlotSemantics {
    /** The dispatch plot behind the map plot (live: always; mock: the dispatch plot at the demo plot's place, if any). */
    deploymentId: number | null
    dispatchId: string | null
    /** Source / material (marker colour). */
    source: string | null
    /** The type's deployed quantity (marker size). */
    amount: number | null
}
export type MapPlot = Plot & MapPlotSemantics

/** A map farmer; `location` (map centring) is absent when no plot has a real location. */
export type MapFarmer = Omit<Farmer, "location" | "plots"> & { location?: Farmer["location"]; plots: MapPlot[] }

/** How the record's deployment type reads amount and source (DeploymentTypeConfig.plotAmount / dispatchSource). */
export interface PlotSemanticsReader {
    amountOf: (plot: TrailerDeploymentPlot) => number | null
    sourceOf: (dispatch: TrailerDispatchItem) => string | null
}
const NO_SEMANTICS: PlotSemanticsReader = { amountOf: () => null, sourceOf: () => null }

const semanticsOf = (dispatch: TrailerDispatchItem, plot: TrailerDeploymentPlot, read: PlotSemanticsReader): MapPlotSemantics => ({
    deploymentId: plot.deployment_id,
    dispatchId: dispatch.deployment_detail_id,
    source: read.sourceOf(dispatch),
    amount: read.amountOf(plot),
})
const EMPTY_SEMANTICS: MapPlotSemantics = { deploymentId: null, dispatchId: null, source: null, amount: null }

/**
 * The demo map's plots, each linked to the record's dispatch plot at the same place (within 0.0015°, the rule the
 * sheet uses to locate a dispatch plot on the demo map) — so mock markers show real mock amounts / sources; a demo
 * plot with no dispatch plot there carries none.
 */
function mockMapFarmer(record: DeploymentV2Record | null, trailers: TrailerDispatchItem[], read: PlotSemanticsReader): MapFarmer {
    const farmer = MOCK_FARMERS.find((f) => f.name === record?.farmer.name) || MOCK_FARMERS[0]
    const pairs = trailers.flatMap((dispatch) => dispatch.deployment_plots_data.map((plot) => ({ dispatch, plot })))
    return {
        ...farmer,
        plots: farmer.plots.map((demo) => {
            const here = pairs.filter(({ plot }) => plot.location && Math.abs(plot.location.lat - demo.location.lat) < 0.0015 && Math.abs(plot.location.lng - demo.location.lng) < 0.0015)
            const at = here[0]
            // a boundary saved for a dispatch plot at this place (the mock store keeps it) replaces the demo outline
            const saved = here.map(({ plot }) => toPolygonPath(plot.geometry)).find((path) => !!path) ?? null
            return { ...demo, ...(saved ? { path: saved } : {}), ...(at ? semanticsOf(at.dispatch, at.plot, read) : EMPTY_SEMANTICS) }
        }),
    }
}

function liveMapFarmer(record: DeploymentV2Record | null, trailers: TrailerDispatchItem[], read: PlotSemanticsReader): MapFarmer {
    const plots: MapPlot[] = trailers.flatMap((dispatch) =>
        dispatch.deployment_plots_data
            .filter((plot) => plot.location !== null)
            .map((plot) => ({
                id: String(plot.deployment_id),
                farmerId: String(plot.farmer_id),
                name: plot.plot_id || `DEPL-${plot.deployment_id}`,
                area: plot.area,
                deployedTons: plot.amt_plot_deploy,
                path: toPolygonPath(plot.geometry) ?? undefined,
                location: plot.location!,
                color: "#ffffff",
                ...semanticsOf(dispatch, plot, read),
            }))
    )
    const api = record?.api
    return {
        id: api ? `${api.farmer_id}-${api.deployment_num}-${api.az_id}` : "none",
        name: record?.farmer.name ?? "",
        date: "",
        village: record?.village ?? "",
        calArea: api ? `${api.calculated_area} Acres` : "",
        trailersDeployed: trailers.length,
        deployed: api ? `${api.deployed_amount} Tons` : "",
        location: plots[0]?.location,
        plots,
    }
}

export function buildMapFarmer(record: DeploymentV2Record | null, trailers: TrailerDispatchItem[], read: PlotSemanticsReader = NO_SEMANTICS): MapFarmer {
    return isLiveMode ? liveMapFarmer(record, trailers, read) : mockMapFarmer(record, trailers, read)
}
